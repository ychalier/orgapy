import datetime
import json
import re
from typing import Callable, Literal, TypeVar, Any
from urllib.parse import urlencode

from django.contrib.auth.models import AbstractBaseUser, AnonymousUser
from django.core.exceptions import PermissionDenied, BadRequest
from django.core.paginator import Page, Paginator
from django.db import models, connection
from django.db.models import Q, QuerySet, Min, Max
from django.http import HttpRequest, Http404, HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone

from ..models import Settings, Category, Document, ProgressLog, Project, MoodLog, Task, Objective, Calendar
from ..utils import date_timestamp


UserObject = TypeVar("UserObject", Category, Document, ProgressLog, Project, MoodLog, Task, Objective, Calendar)
LogT = TypeVar("LogT", ProgressLog, MoodLog)
LoggedUser = AbstractBaseUser


def pretty_paginator(page: Page, show_around: int = 2, **attrs) -> dict:
    to_show = sorted({
        1,
        *[
            max(1, min(page.paginator.num_pages, i))
            for i in range(page.number - show_around, page.number + show_around + 1)
        ],
        page.paginator.num_pages,
    })
    attr_string = urlencode(attrs)
    if attr_string != "":
        attr_string = "&" + attr_string
    paginator = {
        "prev": None,
        "next": None,
        "pages": list(),
        "active": page.number,
        "attr_string": attr_string,
        "max": page.paginator.num_pages,
        "count": page.paginator.count,
    }
    for item in to_show:
        if len(paginator["pages"]) > 0 and paginator["pages"][-1] < item - 1:
            paginator["pages"].append(None)
        paginator["pages"].append(item)
    if page.has_previous():
        paginator["prev"] = page.previous_page_number()
    if page.has_next():
        paginator["next"] = page.next_page_number()
    return paginator


def find_user_object(
        model: type[UserObject],
        key: str | list[str],
        value: int | str,
        required_user: LoggedUser | AnonymousUser | None = None,
        allow_deleted: bool = False,
        ) -> UserObject:
    fields = [key] if isinstance(key, str) else key
    if "id" in fields:
        try:
            int(value)
        except ValueError:
            fields.remove("id")
    if not fields:
        raise BadRequest("Missing filtering key")
    nodes = Q(**{fields[0]: value})
    for field in fields[1:]:
        nodes |= Q(**{field: value})
    query = model.objects.filter(nodes)
    if required_user is not None:
        query = query.filter(user=required_user)
    try:
        obj = query.get()
    except model.DoesNotExist:
        raise Http404()
    if required_user is not None and getattr(obj, "user", None) != required_user:
        raise PermissionDenied()
    if not allow_deleted and getattr(obj, "deleted", False):
        raise Http404()
    return obj


def get_checked_items(checklist: str) -> list[str]:
    return re.findall(r"\[x\] (.*)", checklist)


def compare_checklists(user: LoggedUser | AnonymousUser, reference: str, before: str | None, after: str | None):
    if isinstance(user, AnonymousUser):
        raise PermissionDenied()
    if before is None or after is None:
        return
    checked_before = set(get_checked_items(before))
    checked_after = set(get_checked_items(after))
    for item in checked_after.difference(checked_before):
        ProgressLog.objects.create(
            user=user,
            type=ProgressLog.PROJECT_CHECKLIST_ITEM_CHECKED,
            description=f"{reference} - {item}"
        )


def get_or_create_settings(user: LoggedUser | AnonymousUser) -> Settings:
    if isinstance(user, AnonymousUser):
        raise PermissionDenied()
    query = Settings.objects.filter(user=user)
    if query.exists():
        return query.get()
    return Settings.objects.create(user=user)


def build_fts_query(user_input: str) -> str:
    phrases = re.findall(r'"([^"]+)"', user_input)
    remaining = re.sub(r'"[^"]+"', '', user_input)
    words = re.findall(r'\w+', remaining)
    parts = []
    parts.extend(f'"{p}"' for p in phrases)
    parts.extend(f'{w}*' for w in words)
    return ' '.join(parts)


def search_within_queryset(
        qs: QuerySet[Document],
        query: str,
        limit: int = 500,
        title_weight: float = 10,
        content_weight: float = 1,
    ) -> QuerySet[Document]:

    if not query:
        return qs

    fts_query = build_fts_query(query)

    subquery = qs.values("id")
    base_sql, base_params = subquery.query.sql_with_params()

    sql = f"""
        SELECT d.id, bm25(orgapy_document_fts, {title_weight}, {content_weight}) AS rank
        FROM orgapy_document_fts
        JOIN orgapy_document d ON d.id = orgapy_document_fts.rowid
        WHERE orgapy_document_fts MATCH %s
        AND d.id IN (
            {base_sql}
        )
        ORDER BY rank
        LIMIT {limit}
    """

    with connection.cursor() as cursor:
        cursor.execute(sql, [fts_query, *base_params])
        rows = cursor.fetchall()

    if not rows:
        return qs.none()

    ids = [row[0] for row in rows]

    ordering = models.Case(*[
        models.When(pk=pk, then=pos)
        for pos, pk in enumerate(ids)
    ])

    return qs.filter(pk__in=ids).annotate(relevance=ordering).order_by("relevance")


def view_document_list(
        request: HttpRequest,
        template_name: str,
        search_query: str | None = None,
        type_filter: Literal["note", "sheet", "map"] | None = None,
        status_filter: Literal["public", "hidden", "deleted", "projects"] | None = None,
        category_filters: str | None = None,
        dt_start: datetime.date | None = None,
        dt_end: datetime.date | None = None,
        sort_key: Literal["creation", "modification", "access", "deletion", "title", "relevance"] | None = None,
        page_size: int | None = None,
        kwargs: dict[str, Any] = {},
    ) -> HttpResponse:
    """
    Filter, sort and render a list of documents.

    Args:
        request: The incoming HttpRequest from an authenticated user
        template_name: Path to an HTML template.
            Must extend layout/documents.html
        search_query: Text query for filtering document titles or content (for notes and sheets)
        type_filter: Filter document type.
            If None, uses GET params.
        status_filter: Filter document status.
            If None, uses GET params.
            If not 'hidden', hidden document will be excluded.
            If not 'deleted', deleted documents will be excluded.
            If 'projects', only notes with ongoing (ie. not archived) projects are shown.
        category_filters: Filter document categories.
            If None, uses GET params.
            Specify category names. Multiple names can be passed, separated by semi-colons (;).
            If multiple names are passed, documents must have all listed categories to be selected.
            If the name 'uncategorized' is passed, filters documents without any categories.
        sort_key: Sort documents, in decreasing order.
            If None, uses GET params.
            Pinned documents will always appear first.
        page_size: Number of documents per page.
        kwargs: Any arguments to be passed to the template.
    """

    attrs = {}

    if page_size is None:
        page_size = int(request.GET.get("size", 25))
    if page_size != 25:
        attrs["size"] = page_size

    if search_query is None:
        search_query = request.GET.get("query")

    category_names: set[str] = set()
    if search_query:
        category_pattern = re.compile(r"#([a-zA-Z0-9]+)")
        for name in category_pattern.findall(search_query):
            category_names.add(name)
        search_query = re.sub(r" +", " ", category_pattern.sub("", search_query)).strip()
    if search_query:
        attrs["query"] = search_query

    if type_filter is None:
        s = request.GET.get("type")
        type_filter = s if s in ["note", "sheet", "map"] else None # type: ignore
    if type_filter:
        attrs["type"] = type_filter

    if status_filter is None:
        s = request.GET.get("status")
        status_filter = s if s in ["public", "hidden", "deleted", "projects"] else None # type: ignore
    if status_filter:
        attrs["status"] = status_filter

    if category_filters is None:
        category_filters = request.GET.get("categories")
    if category_filters:
        category_names.update(category_filters.split(";"))
    category_ids: list[int] = []
    filter_uncategorized = False
    if category_names:
        category_ids = [c.id for c in Category.objects.filter(user=request.user, name__in=category_names)]
        filter_uncategorized = "uncategorized" in category_names
        attrs["categories"] = ";".join(sorted(category_names))
    
    if dt_start is None and "start" in request.GET:
        dt_start = datetime.datetime.strptime(request.GET["start"], "%Y-%m-%d")
    if dt_start:
        attrs["start"] = dt_start.strftime("%Y-%m-%d")
    
    if dt_end is None and "end" in request.GET:
        dt_end = datetime.datetime.strptime(request.GET["end"], "%Y-%m-%d")
    if dt_end:
        attrs["end"] = dt_end.strftime("%Y-%m-%d")
    
    if sort_key is None:
        s = request.GET.get("sort")
        sort_key = s if s in ["creation", "modification", "access", "deletion", "title", "relevance"] else None # type: ignore
    if sort_key:
        attrs["sort"] = sort_key

    qs = Document.objects.filter(user=request.user)
    if type_filter is not None:
        qs = qs.filter(type=type_filter)
    if status_filter == "public":
        qs = qs.filter(public=True)
    if status_filter == "hidden":
        qs = qs.filter(hidden=True)
    else:
        qs = qs.filter(hidden=False)
    if status_filter == "projects":
        qs = qs.filter(project__status__in=[Project.ACTIVE, Project.INACTIVE, Project.FUTURE]).distinct()
    if status_filter == "deleted":
        qs = qs.filter(deleted=True)
    else:
        qs = qs.filter(deleted=False)
    for category_id in category_ids:
        qs = qs.filter(categories__in=[category_id])
    if filter_uncategorized:
        qs = qs.filter(categories__isnull=True)
    
    if dt_start and dt_end:
        qs = qs.filter(date_creation__range=[dt_start, dt_end + datetime.timedelta(days=1)])
    elif dt_start:
        qs = qs.filter(date_creation__gt=dt_start)
    elif dt_end:
        qs = qs.filter(date_creation__lt=dt_end)

    if search_query:
        qs = search_within_queryset(qs, search_query)

    if sort_key:
        if sort_key == "relevance":
            pass
        elif sort_key == "title":
            qs = qs.order_by("-pinned", "title")
        else:
            qs = qs.order_by("-pinned", f"-date_{sort_key}")
    else:
        qs = qs.order_by("-pinned", "-date_modification")
        
    if request.GET.get("format") == "json":
        mindt = Document.objects.values("date_creation").aggregate(Min("date_creation"))["date_creation__min"]
        maxdt = Document.objects.values("date_creation").aggregate(Max("date_creation"))["date_creation__max"]
        data = {
            "entries": [],
            "mindt": date_timestamp(mindt),
            "maxdt": date_timestamp(maxdt),
        }
        for doc in qs:
            data["entries"].append({
                "dt": date_timestamp(doc.date_creation),
                "label": doc.title,
                "icon": doc.type_icon,
                "href": doc.get_absolute_url()
            })
        return JsonResponse(data)

    if request.GET.get("format") == "tsv":
        lines = ["id\tnonce\ttype\ttitle\tdate_creation\tdate_modification\tdate_access\tdate_deletion\tpublic\tpinned\thidden\tdeleted\tcategories"]
        for doc in qs:
            lines.append("\t".join([
                str(doc.id),
                doc.nonce,
                doc.type,
                doc.title if doc.title else "",
                doc.date_creation.isoformat(),
                doc.date_modification.isoformat(),
                doc.date_access.isoformat(),
                doc.date_deletion.isoformat() if doc.date_deletion else "",
                str(doc.public),
                str(doc.pinned),
                str(doc.hidden),
                str(doc.deleted),
                ";".join([category.name for category in doc.categories.all()])
            ]))
        response = HttpResponse("\n".join(lines), content_type="text/tab-separated-values; charset=utf-8")
        response["Content-Disposition"] = f'inline; filename="documents.tsv"'
        return response

    paginator = Paginator(qs, page_size)
    page = request.GET.get("page")
    objects = paginator.get_page(page)
    return render(request, template_name, {
        "active": "documents",
        "objects": objects,
        "query": attrs.get("query", ""),
        "paginator": pretty_paginator(objects, **attrs),
        "attrs": attrs,
        **kwargs
    })


def get_pending_mood_logs(user: LoggedUser | AnonymousUser, today_hours: int, lookback_days: int) -> list[datetime.date]:
    if isinstance(user, AnonymousUser):
        raise PermissionDenied()
    last_mood_log = MoodLog.objects.filter(user=user).order_by("-date").first()
    now = datetime.datetime.now()
    today = now.date()
    if last_mood_log is None:
        date_start = today
    else:
        date_start = last_mood_log.date + datetime.timedelta(days=1)
    date_start_lookback = today - datetime.timedelta(days=lookback_days)
    date_start = max(date_start, date_start_lookback)
    if date_start > today:
        return []
    dates: list[datetime.date] = [date_start]
    while dates[-1] < today:
        dates.append(dates[-1] + datetime.timedelta(days=1))
    if now.hour < today_hours:
        dates.pop()
    return dates


def view_calendar(
        request: HttpRequest,
        model: type[LogT],
        date_field: str,
        json_generator: Callable[[LogT], dict],
        tsv_header: str,
        tsv_generator: Callable[[LogT], str],
        template: str,
        filename: str,
        kwargs: dict[str, Any] = {},
        ) -> HttpResponse:
    year = datetime.datetime.now().year

    dt_start = datetime.datetime(year, 1, 1, 0, 0, 0, 0)
    dt_end = datetime.datetime(year, 12, 31, 0, 0, 0, 0)
    try:
        if "start" in request.GET:
            dt_start = datetime.datetime.strptime(request.GET["start"], "%Y-%m-%d")
        if "end" in request.GET:
            dt_end = datetime.datetime.strptime(request.GET["end"], "%Y-%m-%d")
    except ValueError:
        raise BadRequest("Wrong value")

    logs = model.objects.filter(user=request.user, **{f"{date_field}__range": [dt_start, dt_end + datetime.timedelta(days=1)]})

    if request.GET.get("format") == "json":
        mindt = model.objects.values(date_field).aggregate(Min(date_field))[f"{date_field}__min"]
        maxdt = model.objects.values(date_field).aggregate(Max(date_field))[f"{date_field}__max"]
        data = {
            "entries": [],
            "mindt": date_timestamp(mindt),
            "maxdt": date_timestamp(maxdt),
        }
        for log in logs:
            data["entries"].append(json_generator(log))
        return JsonResponse(data)

    elif request.GET.get("format") == "tsv":
        lines = [tsv_header]
        for log in logs:
            lines.append(tsv_generator(log))
        response = HttpResponse("\n".join(lines), content_type="text/tab-separated-values; charset=utf-8")
        response["Content-Disposition"] = f'inline; filename="{filename}-{dt_start.date()}-{dt_end.date()}.tsv"'
        return response

    return render(request, template, {**kwargs})