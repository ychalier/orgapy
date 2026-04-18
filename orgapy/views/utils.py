import datetime
import json
import re
from typing import Literal, TypeVar, Any
from urllib.parse import urlencode

from django.contrib.auth.models import AbstractBaseUser, AnonymousUser
from django.core.exceptions import PermissionDenied, BadRequest
from django.core.paginator import Page, Paginator
from django.db.models import Q
from django.http import HttpRequest, Http404, HttpResponse
from django.shortcuts import redirect, render
from django.utils import timezone

from ..models import Settings, Category, Document, ProgressLog, Project, MoodLog


UserObject = TypeVar("UserObject", Category, Document, ProgressLog, Project, MoodLog)
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


def retrieve_document(request: HttpRequest, nonce: str) -> tuple[Document, bool]:
    doc = find_user_object(Document, "nonce", nonce)
    has_permission = False
    readonly = True
    if request.user is not None and doc.user == request.user and request.user.has_perm("orgapy.view_document"):
        readonly = False
        has_permission = True
    elif doc.public:
        has_permission = True
    if not has_permission:
        raise PermissionDenied()
    if request.GET.get("embed"):
        readonly = True
    return doc, readonly


def get_checked_items(checklist: str) -> list[str]:
    return re.findall(r"\[x\] (.*)", checklist)


def compare_checklists(user: LoggedUser, reference: str, before: str | None, after: str | None):
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


def compare_objective_histories(user: LoggedUser, name: str, before: str | None, after: str | None):
    if before is None or after is None:
        return
    history_before = json.loads(before) if before else []
    history_after = json.loads(after) if after else []
    for _ in range(len(history_after) - len(history_before)):
        ProgressLog.objects.create(
            user=user,
            type=ProgressLog.OBJECTIVE_COMPLETED,
            description=name
        )


def save_document_core(document: Document):
    document.date_modification = timezone.now()
    nonces = set()
    pattern = re.compile(r"@(?:embed)?(note|sheet|map)/([a-zA-Z0-9]+)")
    if document.content:
        nonces = set([nonce for _, nonce in re.findall(pattern, document.content)])
    document.references.set(Document.objects.filter(user=document.user, nonce__in=nonces))
    document.save()


def get_or_create_settings(user: LoggedUser) -> Settings:
    query = Settings.objects.filter(user=user)
    if query.exists():
        return query.get()
    return Settings.objects.create(user=user)


def view_document_list(
        request: HttpRequest,
        template_name: str,
        search_query: str | None = None,
        type_filter: Literal["note", "sheet", "map"] | None = None,
        status_filter: Literal["public", "hidden", "deleted", "projects"] | None = None,
        category_filters: str | None = None,
        sort_key: Literal["creation", "modification", "access", "deletion", "title"] | None = "modification",
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

    category_ids: list[int] = []
    filter_uncategorized = False
    if category_filters is None:
        category_filters = request.GET.get("categories")
    if category_filters:
        attrs["categories"] = category_filters
        category_ids = [c.id for c in Category.objects.filter(user=request.user, name__in=category_filters.split(";"))]
        filter_uncategorized = "uncategorized" in category_filters.split(";")

    if sort_key is None:
        s = request.GET.get("sort")
        sort_key = s if s in ["creation", "modification", "access", "deletion", "title"] else None # type: ignore
    if sort_key:
        attrs["sort"] = sort_key

    category_pattern = re.compile(r"#([a-zA-Z0-9]+)")
    spaces_pattern = re.compile(r" +")

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
    if search_query:
        for name in category_pattern.findall(search_query):
            if name == "uncategorized":
                qs = qs.filter(categories__isnull=True)
            else:
                qs = qs.filter(categories__name__exact=name)
        search_query = spaces_pattern.sub(" ", category_pattern.sub("", search_query)).strip()
        qs = qs.filter(Q(title__icontains=search_query) | Q(content__icontains=search_query))
    
    if sort_key:
        if sort_key == "title":
            qs = qs.order_by("-pinned", "title")
        else:
            qs = qs.order_by("-pinned", f"-date_{sort_key}")

    paginator = Paginator(qs, page_size)
    page = request.GET.get("page")
    objects = paginator.get_page(page)
    return render(request, template_name, {
        "active": "documents",
        "objects": objects,
        "query": attrs.get("query", ""),
        "paginator": pretty_paginator(objects, **attrs),
        **kwargs
    })


def toggle_document_attribute(request: HttpRequest, nonce: str, attrname: str) -> HttpResponse:
    doc = find_user_object(Document, "nonce", nonce, request.user)
    setattr(doc, attrname, not getattr(doc, attrname, False))
    doc.save()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect(doc.get_absolute_url())


def get_pending_mood_logs(user: LoggedUser, today_hours: int, lookback_days: int) -> list[datetime.date]:
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
