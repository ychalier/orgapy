import datetime
import json
import re
import time
from typing import Callable, Literal, TypeVar, Any
from urllib.parse import urlencode

from django.contrib.auth.decorators import permission_required
from django.contrib.auth.models import AbstractBaseUser, AnonymousUser
from django.core.exceptions import PermissionDenied, BadRequest
from django.core.paginator import Page, Paginator
from django.db import models, connection
from django.db.models import Q, QuerySet, Min, Max
from django.http import HttpRequest, HttpResponse, Http404, JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.utils.text import slugify
from django.views.decorators.http import condition

from .models import *
from .utils import date_timestamp


UserObject = TypeVar("UserObject", Tag, Document, ProgressLog, Project, MoodLog, Task, Objective, Calendar)
LogT = TypeVar("LogT", ProgressLog, MoodLog)
LoggedUser = AbstractBaseUser


def _pretty_paginator(page: Page, show_around: int = 2, **attrs) -> dict:
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


def _find_user_object(
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


def _get_checked_items(checklist: str) -> list[str]:
    return re.findall(r"\[x\] (.*)", checklist)


def _compare_checklists(user: LoggedUser | AnonymousUser, reference: str, before: str | None, after: str | None):
    if isinstance(user, AnonymousUser):
        raise PermissionDenied()
    if before is None or after is None:
        return
    checked_before = set(_get_checked_items(before))
    checked_after = set(_get_checked_items(after))
    for item in checked_after.difference(checked_before):
        ProgressLog.objects.create(
            user=user,
            type=ProgressLog.PROJECT_CHECKLIST_ITEM_CHECKED,
            description=f"{reference} - {item}"
        )


def _get_or_create_settings(user: LoggedUser | AnonymousUser) -> Settings:
    if isinstance(user, AnonymousUser):
        raise PermissionDenied()
    query = Settings.objects.filter(user=user)
    if query.exists():
        return query.get()
    return Settings.objects.create(user=user)


def _build_fts_query(user_input: str) -> str:
    phrases = re.findall(r'"([^"]+)"', user_input)
    remaining = re.sub(r'"[^"]+"', '', user_input)
    words = re.findall(r'\w+', remaining)
    parts = []
    parts.extend(f'"{p}"' for p in phrases)
    parts.extend(f'{w}*' for w in words)
    return ' '.join(parts)


def _search_within_queryset(
        qs: QuerySet[Document],
        query: str,
        limit: int = 500,
        title_weight: float = 10,
        content_weight: float = 1,
    ) -> QuerySet[Document]:

    if not query:
        return qs

    fts_query = _build_fts_query(query)

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


def _render_document_list(
        request: HttpRequest,
        template_name: str,
        search_query: str | None = None,
        type_filter: Literal["note", "sheet", "map"] | None = None,
        status_filter: Literal["public", "hidden", "deleted", "projects", "all"] | None = None,
        tag_filters: str | None = None,
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
            If not 'hidden', hidden document will be excluded (unless 'all').
            If not 'deleted', deleted documents will be excluded (unless 'all').
            If 'projects', only notes with ongoing (ie. not archived) projects are shown.
            If 'all', all documents are shown, even hidden and deleted.
        tag_filters: Filter document tags.
            If None, uses GET params.
            Specify tag names. Multiple names can be passed, separated by semi-colons (;).
            If multiple names are passed, documents must have all listed tags to be selected.
            If the name 'uncategorized' is passed, filters documents without any tags.
        sort_key: Sort documents, in decreasing order.
            If None, uses GET params.
            Pinned documents will always appear first.
        page_size: Number of documents per page.
        kwargs: Any arguments to be passed to the template.
    """

    attrs = {}

    if page_size is None:
        page_size = int(request.GET.get("size", 23))
    if page_size != 23:
        attrs["size"] = page_size

    if search_query is None:
        search_query = request.GET.get("query")

    tag_names: set[str] = set()
    if search_query:
        tag_pattern = re.compile(r"#([a-zA-Z0-9]+)")
        for name in tag_pattern.findall(search_query):
            tag_names.add(name)
        search_query = re.sub(r" +", " ", tag_pattern.sub("", search_query)).strip()
    if search_query:
        attrs["query"] = search_query

    if type_filter is None:
        s = request.GET.get("type")
        type_filter = s if s in ["note", "sheet", "map"] else None # type: ignore
    if type_filter:
        attrs["type"] = type_filter

    if status_filter is None:
        s = request.GET.get("status")
        status_filter = s if s in ["public", "hidden", "deleted", "projects", "all"] else None # type: ignore
    if status_filter:
        attrs["status"] = status_filter

    if tag_filters is None:
        tag_filters = request.GET.get("tags")
    if tag_filters:
        tag_names.update(tag_filters.split(";"))
    tag_ids: list[int] = []
    filter_uncategorized = False
    if tag_names:
        tag_ids = [c.id for c in Tag.objects.filter(user=request.user, name__in=tag_names)]
        filter_uncategorized = "uncategorized" in tag_names
        attrs["tags"] = ";".join(sorted(tag_names))
    
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
    elif status_filter != "all":
        qs = qs.filter(hidden=False)
    if status_filter == "projects":
        qs = qs.filter(project__status__in=[Project.ACTIVE, Project.INACTIVE, Project.FUTURE]).distinct()
    if status_filter == "deleted":
        qs = qs.filter(deleted=True)
    elif status_filter != "all":
        qs = qs.filter(deleted=False)
    for tag_id in tag_ids:
        qs = qs.filter(tags__in=[tag_id])
    if filter_uncategorized:
        qs = qs.filter(tags__isnull=True)
    
    if dt_start and dt_end:
        qs = qs.filter(date_creation__range=[dt_start, dt_end + datetime.timedelta(days=1)])
    elif dt_start:
        qs = qs.filter(date_creation__gt=dt_start)
    elif dt_end:
        qs = qs.filter(date_creation__lt=dt_end)

    if search_query:
        qs = _search_within_queryset(qs, search_query)

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
        lines = ["id\tnonce\ttype\ttitle\tdate_creation\tdate_modification\tdate_access\tdate_deletion\tpublic\tpinned\thidden\tdeleted\ttags"]
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
                ";".join([tag.name for tag in doc.tags.all()])
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
        "paginator": _pretty_paginator(objects, **attrs),
        "attrs": attrs,
        **kwargs
    })


def _get_pending_mood_logs(user: LoggedUser | AnonymousUser, today_hours: int, lookback_days: int) -> list[datetime.date]:
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


def _render_calendar(
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


def view_landing(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("orgapy:home")
    return redirect("orgapy:about")


def view_about(request: HttpRequest) -> HttpResponse:
    return render(request, "orgapy/about.html", {})


@permission_required("orgapy.view_project")
def view_home(request: HttpRequest) -> HttpResponse:
    settings = _get_or_create_settings(request.user)
    pending_mood_logs = _get_pending_mood_logs(request.user, settings.mood_log_hours, settings.mood_log_lookback_days)
    active_projects = Project.objects.filter(user=request.user, status=Project.ACTIVE).order_by("date_creation")

    now = timezone.now()

    events = []
    for calendar in Calendar.objects.filter(user=request.user):
        events += calendar.get_events()
    event_groups_dict = {}
    for event in events:
        dtstart = datetime.datetime.fromisoformat(event["dtstart"])
        dtend = datetime.datetime.fromisoformat(event["dtend"])
        date = dtstart.date()
        event_groups_dict.setdefault(date, [])
        event_groups_dict[date].append({
            "title": event["title"],
            "time": None if len(event["dtstart"]) < 11 else dtstart.time(),
            "location": event["location"],
            "over": now > dtend
        })
    event_groups = sorted(event_groups_dict.items())
    for i in range(len(event_groups)):
        event_groups[i][1].sort(key=lambda x: x["time"])

    tasks = Task.objects\
        .filter(user=request.user, completed=False, start_date__lte=now)\
        .order_by("due_date", "start_date")
    today = now.date()
    task_groups_dict = {}
    for task in tasks:
        group = task.get_group(today)
        task_groups_dict.setdefault(group, [])
        task_groups_dict[group].append(task)
    task_groups = []
    for group_index, group_tasks in sorted(task_groups_dict.items()):
        task_groups.append({
            "label": Task.GROUP_LABELS[group_index],
            "tasks": group_tasks,
            "open": group_index <= Task.THISWEEK
        })

    return render(request, "orgapy/home.html", {
        "settings": settings,
        "pending_mood_logs": pending_mood_logs,
        "projects": active_projects,
        "event_groups": event_groups,
        "task_groups": task_groups,
        "active": "home",
    })


@permission_required("orgapy.view_project")
def view_projects(request: HttpRequest) -> HttpResponse:

    if request.method == "POST":
        if not request.user.has_perm("orgapy.add_project"):
            raise PermissionDenied()
        if not "title" in request.POST:
            raise BadRequest("Missing title")
        document = None
        if "document" in request.POST:
            try:
                document = Document.objects.get(user=request.user, nonce=request.POST["document"])
            except Document.DoesNotExist:
                raise BadRequest("Incorrect document")
        project = Project.objects.create(
            user=request.user,
            title=request.POST["title"],
            document=document)
        return redirect(project.get_absolute_url() + "?format=json")

    attrs = {}

    page_size = int(request.GET.get("size", 23))
    attrs["size"] = page_size

    search_query = request.GET.get("query")
    if search_query:
        attrs["query"] = search_query

    s = request.GET.get("status")
    status_filter = s if s in [status for status, _ in Project.STATUS_CHOICES] else None
    if status_filter:
        attrs["status"] = status_filter

    document_filter = request.GET.get("document")
    if document_filter:
        attrs["document"] = document_filter

    dt_start = None
    if "start" in request.GET:
        dt_start = datetime.datetime.strptime(request.GET["start"], "%Y-%m-%d")
    if dt_start:
        attrs["start"] = dt_start.strftime("%Y-%m-%d")

    dt_end = None
    if "end" in request.GET:
        dt_end = datetime.datetime.strptime(request.GET["end"], "%Y-%m-%d")
    if dt_end:
        attrs["end"] = dt_end.strftime("%Y-%m-%d")

    s = request.GET.get("sort")
    sort_key = s if s in ["creation", "modification", "archived"] else None
    if sort_key:
        attrs["sort"] = sort_key

    qs = Project.objects.filter(user=request.user)
    if status_filter:
        qs = qs.filter(status=status_filter)
    if document_filter:
        qs = qs.filter(document__nonce=document_filter)
    if dt_start and dt_end:
        qs = qs.filter(date_creation__range=[dt_start, dt_end + datetime.timedelta(days=1)])
    elif dt_start:
        qs = qs.filter(date_creation__gt=dt_start)
    elif dt_end:
        qs = qs.filter(date_creation__lt=dt_end)
    if search_query:
        qs = qs.filter(Q(title__icontains=search_query) | Q(checklist__icontains=search_query))

    if sort_key:
        qs = qs.order_by(f"-date_{sort_key}")
    else:
        qs = qs.order_by("-date_modification")

    if request.GET.get("format") == "json":
        mindt = Project.objects.values("date_creation").aggregate(Min("date_creation"))["date_creation__min"]
        maxdt = Project.objects.values("date_creation").aggregate(Max("date_creation"))["date_creation__max"]
        data = {
            "entries": [],
            "mindt": date_timestamp(mindt),
            "maxdt": date_timestamp(maxdt),
        }
        for project in qs:
            data["entries"].append({
                "dt": date_timestamp(project.date_creation),
                "label": project.reference,
                "icon": "ri-briefcase-line",
                "href": project.get_absolute_url()
            })
        return JsonResponse(data)

    if request.GET.get("format") == "tsv":
        lines = ["id\ttitle\tdocument_nonce\tdocument_title\tdate_creation\tdate_modification\tdate_archived\tstatus"]
        for project in qs:
            lines.append("\t".join([
                str(project.id),
                project.title if project.title else "",
                project.document.nonce if project.document else "",
                project.document.title if project.document and project.document.title else "",
                project.date_creation.isoformat(),
                project.date_modification.isoformat(),
                project.date_archived.isoformat() if project.date_archived else "",
                project.get_status_display(), # type: ignore
            ]))
        response = HttpResponse("\n".join(lines), content_type="text/tab-separated-values; charset=utf-8")
        response["Content-Disposition"] = f'inline; filename="documents.tsv"'
        return response

    paginator = Paginator(qs, page_size)
    page = request.GET.get("page")
    projects = paginator.get_page(page)

    template_name = "orgapy/" + ("projects_calendar.html" if request.GET.get("calendar") else "projects_list.html")
    return render(request, template_name, {
        "projects": projects,
        "paginator": _pretty_paginator(projects),
        "active": "projects",
        "attrs": attrs,
        "active": "projects",
    })


def _project_etag_func(request: HttpRequest, project_id: str) -> str | None:
    try:
        project = Project.objects.get(user=request.user, id=project_id)
    except Project.DoesNotExist:
        return None
    return project.etag


def _project_last_modified_func(request: HttpRequest, project_id: str) -> datetime.datetime | None:
    try:
        project = Project.objects.get(user=request.user, id=project_id)
    except Project.DoesNotExist:
        return None
    return project.updated_at


@permission_required("orgapy.view_project")
@condition(_project_etag_func, _project_last_modified_func)
def view_project(request: HttpRequest, project_id: str) -> HttpResponse:
    project = _find_user_object(Project, "id", project_id, request.user)

    if request.method == "POST":

        now = timezone.now()

        is_ajax = request.headers.get("X-Requested-With") == "XMLHttpRequest"
        client_etag = request.headers.get("If-Match") or request.POST.get("etag")
        current_etag = project.etag

        if client_etag != current_etag:
            if is_ajax:
                return HttpResponse(status=412)
            else:
                return HttpResponse(
                    "This project was modified by someone else while you were editing. "
                    "Please review the latest version before saving again.",
                    content_type="text/plain",
                    status=412)

        if request.POST.get("delete") == "on":
            project.delete()
            if "next" in request.POST:
                return redirect(request.POST["next"])
            if is_ajax:
                return HttpResponse(status=204)
            return redirect("orgapy:projects")

        update_fields = []

        if "title" in request.POST:
            update_fields.append("title")
            new_title = request.POST["title"]
            project.title = new_title if new_title else None

        if "checklist" in request.POST:
            update_fields.append("checklist")
            new_checklist = request.POST["checklist"]
            _compare_checklists(request.user, project.reference, project.checklist, new_checklist)
            project.checklist = new_checklist
            update_fields.append("date_modification")
            project.date_modification = now

        if "document" in request.POST:
            update_fields.append("document")
            nonce = request.POST["document"]
            if nonce:
                project.document = Document.objects.get(user=request.user, nonce=nonce) # type: ignore
            else:
                project.document = None

        if "status" in request.POST:
            update_fields.append("status")
            new_status = request.POST["status"]
            if not new_status in [status for status, _ in Project.STATUS_CHOICES]:
                raise BadRequest("Invalid status value")
            project.status = new_status
            if new_status == Project.ARCHIVED:
                update_fields.append("date_archived")
                project.date_archived = now

        project.updated_at = now
        project.save(update_fields=update_fields + ["updated_at"])

        if "next" in request.POST:
            return redirect(request.POST["next"])

        if is_ajax:
            response = HttpResponse(status=204)
        else:
            response = redirect(request.path)

        response["ETag"] = project.etag
        return response

    if request.GET.get("format") == "json":
        return JsonResponse(project.to_json_dict())

    return render(request, "orgapy/project.html", {
        "project": project,
        "active": "projects",
    })


@permission_required("orgapy.view_document")
def view_documents(request: HttpRequest) -> HttpResponse:

    if request.method == "POST":
        doctype = request.POST.get("type", "note")
        if doctype not in ["note", "sheet", "map"]:
            raise BadRequest("Incorrect document type")
        doc = Document.objects.create(user=request.user, type=doctype)
        return redirect(doc.get_absolute_url() + "?edit=1")
    
    if request.GET.get("part") == "snippet":
        nonces = request.GET.getlist("nonce")
        results = []
        for nonce in nonces:
            result = {"nonce": nonce, "title": None, "href": None, "icon": None, "error": None}
            try:
                doc = Document.objects.get(user=request.user, nonce=nonce)
                result["title"] = doc.title
                result["href"] = doc.get_absolute_url()
                result["icon"] = doc.type_icon
            except Document.DoesNotExist:
                result["error"] = "Invalid reference"
            except Exception:
                result["error"] = "Error"
            results.append(result)
        return JsonResponse({"results": results})

    template_name = "orgapy/" + ("documents_calendar.html" if request.GET.get("calendar") else "documents_list.html")
    return _render_document_list(request, template_name)


def _document_etag_func(request: HttpRequest, nonce: str) -> str | None:
    try:
        doc = Document.objects.get(nonce=nonce)
    except Document.DoesNotExist:
        return None
    return doc.etag


def _document_last_modified_func(request: HttpRequest, nonce: str) -> datetime.datetime | None:
    try:
        doc = Document.objects.get(nonce=nonce)
    except Document.DoesNotExist:
        return None
    return doc.updated_at


@condition(_document_etag_func, _document_last_modified_func)
def view_document(request: HttpRequest, nonce: str) -> HttpResponse:

    try:
        doc = Document.objects.get(nonce=nonce)
    except Document.DoesNotExist:
        raise Http404()
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

    now = timezone.now()

    if request.method == "POST":
        if doc.user != request.user:
            raise PermissionDenied()

        is_ajax = request.headers.get("X-Requested-With") == "XMLHttpRequest"
        client_etag = request.headers.get("If-Match") or request.POST.get("etag")
        current_etag = doc.etag

        if client_etag != current_etag:
            if is_ajax:
                return HttpResponse(status=412)
            else:
                return HttpResponse(
                    "This document was modified by someone else while you were editing. "
                    "Please review the latest version before saving again.",
                    content_type="text/plain",
                    status=412)

        if request.POST.get("destroy") == "on":
            doc.delete()
            if "next" in request.POST:
                return redirect(request.POST["next"])
            return redirect("orgapy:documents")
        
        new_content = None
        if "widgets" in request.POST and doc.content:
            new_content = doc.content
            widget_updates = json.loads(request.POST["widgets"])
            for update in widget_updates:
                widget_type = update.get("type")
                widget_index = update.get("index")
                widget_value = update.get("value")
                if widget_type is None or widget_index is None or widget_value is None:
                    continue
                if widget_type in ["status", "color_round", "color_square"]:
                    regex = {
                        "status": r"(✅|❌|⏺️)",
                        "color_round": r"(🔴|🟠|🟡|🟢|🔵|🟣|🟤|⚫|⚪)",
                        "color_square": r"(🟥|🟧|🟨|🟩|🟦|🟪|🟫|⬛|⬜)"
                    }[widget_type]
                    for i, widget_match in enumerate(re.finditer(regex, new_content)):
                        if i != widget_index:
                            continue
                        start, end = widget_match.span(0)
                        text = new_content
                        new_content = text[:start] + widget_value + text[end:]
                        break
                elif widget_type == "checkbox":
                    for i, widget_match in enumerate(re.finditer(r"^ *- \[(x| )\]", new_content, re.MULTILINE)):
                        if i != widget_index:
                            continue
                        start, end = widget_match.span(1)
                        text = new_content
                        if widget_value:
                            widget_value = "x"
                        else:
                            widget_value = " "
                        new_content = text[:start] + widget_value + text[end:]
                        break

        update_fields = []

        if "public" in request.POST:
            update_fields.append("public")
            doc.public = request.POST["public"] == "on"

        if "pinned" in request.POST:
            update_fields.append("pinned")
            doc.pinned = request.POST["pinned"] == "on"

        if "hidden" in request.POST:
            update_fields.append("hidden")
            doc.hidden = request.POST["hidden"] == "on"

        if "deleted" in request.POST:
            update_fields.append("deleted")
            doc.deleted = request.POST["deleted"] == "on"
            if doc.deleted:
                update_fields.append("date_deletion")
                doc.date_deletion = now

        if "title" in request.POST:
            update_fields.append("title")
            doc.title = request.POST["title"]

        if "subtitle" in request.POST:
            update_fields.append("subtitle")
            doc.subtitle = request.POST["subtitle"]

        if "content" in request.POST or new_content:
            if not new_content:
                new_content = request.POST["content"]
            if new_content and new_content != doc.content:
                update_fields.append("content")
                update_fields.append("date_modification")
                doc.content = new_content
                doc.date_modification = now
                pattern = re.compile(r"@(?:embed)?(note|sheet|map)/([a-zA-Z0-9]+)")
                nonces = set([nonce for _, nonce in re.findall(pattern, new_content)])
                doc.references.set(Document.objects.filter(user=doc.user, nonce__in=nonces))

        if "config" in request.POST:
            update_fields.append("config")
            doc.config = request.POST["config"]

        if "tags" in request.POST:
            doc.tags.clear()
            name_list = request.POST.get("tags", "").split(";")
            for dirty_name in name_list:
                name = dirty_name.lower().strip()
                if name == "" or name == "uncategorized":
                    continue
                try:
                    tag = Tag.objects.get(name=name, user=request.user)
                except Tag.DoesNotExist:
                    tag = Tag.objects.create(name=name, user=request.user)
                doc.tags.add(tag)

        doc.updated_at = now
        doc.save(update_fields=update_fields + ["updated_at"])

        if "next" in request.POST:
            return redirect(request.POST["next"])

        action = request.POST.get("action")
        if action == "continue":
            if is_ajax:
                response = HttpResponse(status=204)
            else:
                response = redirect(request.path)
        else:
            response = redirect("orgapy:document", doc.nonce)

        response["ETag"] = doc.etag
        return response

    if doc.deleted:
        raise Http404()

    doc.date_access = now
    doc.save(update_fields=["date_access"])

    if request.GET.get("raw"):
        content, ext, mimetype = "", ".txt", "text/plain"
        if doc.type == "note":
            content = f"""
---
title: {doc.title if doc.title else "Untitled"}
creation: {doc.date_creation.isoformat()}
modication: {doc.date_modification.isoformat()}
tags:  {", ".join(category.name for category in doc.tags.all())}
---
            """.strip() + "\n\n"
            if doc.content:
                content += doc.content
            ext = ".md"
            mimetype = "text/markdown"
        elif doc.type == "sheet":
            if doc.content:
                content = doc.content
            ext = ".tsv"
            mimetype = "text/tab-separated-values"
        elif doc.type == "map":
            if doc.content:
                content = doc.content
            ext = ".geojson"
            mimetype = "application/geo+json"

        filename = f"{slugify(doc.title)}{ext}" if doc.title else f"untitled{ext}"
        response = HttpResponse(content=content, content_type=f"{mimetype}; charset=utf-8")
        response["Content-Disposition"] = f'inline; filename="{filename}"'

    elif request.GET.get("embed"):
        template = f"orgapy/{doc.type}.html"
        if doc.type == "note":
            template = "orgapy/note_embed.html"
        response = render(request, template, {
            "document": doc,
            "readonly": True,
        })

    elif request.GET.get("edit"):
        if readonly:
            raise PermissionDenied()
        response = render(request, f"orgapy/edit_{doc.type}.html", {
            "document": doc,
            "active": "documents",
            "etag": doc.etag,
        })

    elif request.GET.get("format") == "json":
        response = JsonResponse({
            "title": doc.title,
            "subtitle": doc.subtitle,
            "content": doc.content,
            "config": doc.config,
        })

    else:
        response = render(request, f"orgapy/{doc.type}.html", {
            "document": doc,
            "readonly": readonly,
            "active": "documents",
            "etag": doc.etag,
        })

    response["Cache-Control"] = "no-cache; must-revalidate"
    return response


@permission_required("orgapy.view_document")
def view_trash(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        if request.POST.get("restore") and request.user.has_perm("orgapy.change_document"):
            Document.objects.filter(user=request.user, deleted=True).update(deleted=False)
        if request.POST.get("destroy") and request.user.has_perm("orgapy.delete_document"):
            Document.objects.filter(user=request.user, deleted=True).delete()
        if "next" in request.POST:
            return redirect(request.POST["next"])
        return redirect("orgapy:documents")
    return _render_document_list(request, "orgapy/trash.html", status_filter="deleted", sort_key="deletion")


@permission_required("orgapy.view_tag")
def view_tags(request: HttpRequest) -> HttpResponse:
    uncategorized = Document.objects.filter(user=request.user, tags__isnull=True).count()
    return render(request, "orgapy/tags.html", {
        "tags": Tag.objects.filter(user=request.user),
        "active": "documents",
        "uncategorized": uncategorized
    })


@permission_required("orgapy.view_tag")
def view_tag(request: HttpRequest, name: str) -> HttpResponse:
    if name == "uncategorized":
        tag = {"id": -1, "name": "uncategorized"}
    else:
        tag = _find_user_object(Tag, "name", name, request.user)

    if request.method == "POST":
        if isinstance(tag, dict):
            raise Http404()

        if request.POST.get("delete"):
            tag.delete()
            return redirect("orgapy:tags")
        if "name" in request.POST:
            new_name = request.POST.get("name")
            if new_name is None:
                raise BadRequest("Missing name")
            if len(new_name) > 0:
                tag.name = new_name.lower()
                tag.save()
            return redirect("orgapy:tag", name=tag.name)

    return _render_document_list(request,
        "orgapy/tag.html",
        tag_filters=name,
        status_filter="all",
        kwargs={"tag": tag})


@permission_required("orgapy.view_progress_log")
def view_progress(request: HttpRequest) -> HttpResponse:

    if request.method == "POST":
        if not request.user.has_perm("orgapy.add_progress_log"):
            raise PermissionDenied()
        log = ProgressLog.objects.create(
            user=request.user,
            type=ProgressLog.OTHER
        )
        return redirect(log.get_absolute_url())

    def json_generator(log: ProgressLog) -> dict:
        return {
            "dt": int(1000 * log.dt.timestamp()),
            "label": "" if log.description is None else log.description,
            "icon": log.get_icon_class(),
            "href": log.get_absolute_url(),
        }
    def tsv_generator(log: ProgressLog) -> str:
        return "\t".join([
            str(log.id),
            log.type,
            log.dt.isoformat(),
            str(log.description)
        ])
    return _render_calendar(request,
        ProgressLog,
        "dt",
        json_generator,
        "id\ttype\tdt\tdescription",
        tsv_generator,
        "orgapy/progress.html",
        "progress")


@permission_required("orgapy.view_progress_log")
def view_progress_log(request: HttpRequest, log_id: str) -> HttpResponse:
    log = _find_user_object(ProgressLog, "id", log_id, request.user)

    if request.method == "POST":

        action = request.POST.get("action")

        if action == "delete":
            if not request.user.has_perm("orgapy.delete_progress_log"):
                raise PermissionDenied()
            log.delete()

        if action == "save":
            if not request.user.has_perm("orgapy.change_progress_log"):
                raise PermissionDenied()
            if "description" in request.POST:
                log.description = request.POST["description"]
            if "type" in request.POST:
                log.type = request.POST["type"]
            if "dt" in request.POST:
                log.dt = datetime.datetime.strptime(request.POST["dt"], f"%Y-%m-%dT%H:%M")
            log.save()

        return redirect("orgapy:progress")

    return render(request, "orgapy/progress_log.html", {"log": log})


@permission_required("orgapy.change_settings")
def view_settings(request: HttpRequest) -> HttpResponse:
    user_settings = _get_or_create_settings(request.user)
    if request.method == "POST":
        user_settings.objective_start_hours = int(request.POST.get("objective_start_hours", 0))
        user_settings.calendar_lookahead = int(request.POST.get("calendar_lookahead", 3))
        user_settings.trash_period = int(request.POST.get("trash_period", 30))
        user_settings.mood_log_hours = int(request.POST.get("mood_log_hours", 19))
        user_settings.mood_log_lookback_days = int(request.POST.get("mood_log_lookback_days", 2))
        user_settings.mood_activities = request.POST.get("mood_activities", "").strip()
        user_settings.beach_mode = bool(request.POST.get("beach_mode", False))
        user_settings.save()
        if "ref" in request.POST and request.POST["ref"]:
            return redirect(request.POST["ref"])
    return render(request, "orgapy/settings.html", {"settings": user_settings})


@permission_required("orgapy.view_mood_log")
def view_mood(request: HttpRequest, year: int | str | None = None) -> HttpResponse:

    settings = _get_or_create_settings(request.user)
    pending_mood_logs = _get_pending_mood_logs(request.user, settings.mood_log_hours, settings.mood_log_lookback_days)

    if request.method == "POST":

        if not request.user.has_perm("orgapy.add_mood_log"):
            raise PermissionDenied()
        log = MoodLog.objects.create(
            user=request.user,
            date=datetime.datetime.strptime(request.POST["date"], "%Y-%m-%d"),
            mood=int(request.POST["mood"]),
            energy=int(request.POST["energy"]),
            health=int(request.POST["health"]),
            stress=int(request.POST["stress"]),
            activities=request.POST["activities"].strip().strip(","))

        is_ajax = request.headers.get("X-Requested-With") == "XMLHttpRequest"
        if is_ajax:
            return HttpResponse(status=204)
        else:
            return redirect(log.get_absolute_url())


    def json_generator(log: MoodLog) -> dict:
        return {
            "dt": int(1000 * time.mktime(log.date.timetuple())),
            "label": log.label,
            "level": log.overall,
            "mood": log.mood_classname,
            "energy": log.energy_classname,
            "health": log.health_classname,
            "stress": log.stress_classname,
            "activities": log.activities_display,
            "href": log.get_absolute_url()
        }

    def tsv_generator(log: MoodLog) -> str:
        return "\t".join([
            str(log.id),
            log.date.isoformat(),
            str(log.mood),
            str(log.energy),
            str(log.health),
            str(log.stress),
            log.activities
        ])

    return _render_calendar(
        request,
        MoodLog,
        "date",
        json_generator,
        "id\tdt\tmood\tenergy\thealth\tstress\tactivities",
        tsv_generator,
        "orgapy/mood.html",
        "mood",
        kwargs={
            "settings": settings,
            "pending_mood_logs": pending_mood_logs,
        })


@permission_required("orgapy.view_mood_loog")
def view_mood_log(request: HttpRequest, log_id: int) -> HttpResponse:
    log = _find_user_object(MoodLog, "id", log_id, request.user)

    if request.method == "POST":

        action = request.POST.get("action")

        if action == "delete":
            if not request.user.has_perm("delete_mood_log"):
                raise PermissionDenied()
            log.delete()

        if action == "save":
            if not request.user.has_perm("change_mood_log"):
                raise PermissionDenied()
            log.mood = int(request.POST["mood"])
            log.energy = int(request.POST["energy"])
            log.health = int(request.POST["health"])
            log.stress = int(request.POST["stress"])
            log.activities = request.POST["activities"]
            log.save()

        return redirect("orgapy:mood")

    return render(request, "orgapy/mood_log.html", {"log": log})


@permission_required("orgapy.view_settings")
def view_groceries(request: HttpRequest) -> HttpResponse:

    settings = _get_or_create_settings(request.user)

    if request.method == "POST":
        if not request.user.has_perm("orgapy.change_settings"):
            raise PermissionDenied()

        if "groceries" in request.POST:
            settings.groceries_data = request.POST.get("groceries")
            settings.save()

        note = None
        if request.POST.get("action") == "create":
            items: list[tuple[str, str]] = []
            data = settings.groceries
            for section_data in data.get("sections", []):
                for item_data in section_data.get("items", []):
                    if item_data.get("checked"):
                        items.append((section_data.get("label", "Unnamed section"), item_data.get("label", "Unnamed item")))
                    item_data["checked"] = False
            settings.groceries_data = json.dumps(data)
            settings.save()
            try:
                cat = Tag.objects.get(user=request.user, name="groceries")
            except Tag.DoesNotExist:
                cat = Tag.objects.create(user=request.user, name="groceries")
            old_section = None
            note_content = ""
            for section_label, item_label in items:
                if section_label != old_section:
                    note_content += f"\n**{section_label}**\n\n"
                    old_section = section_label
                note_content += f"- [ ] {item_label}\n"
            note = Document.objects.create(
                user=request.user,
                title=f"Shopping list {datetime.datetime.now().strftime("%b, %d")}",
                content=note_content.strip(),
                type="note",
                pinned=True
            )
            note.tags.add(cat)

        if request.POST.get("action") == "clear":
            data = settings.groceries
            for section_data in data.get("sections", []):
                for item_data in section_data.get("items", []):
                    item_data["checked"] = False
            settings.groceries_data = json.dumps(data)
            settings.save()

        is_ajax = request.headers.get("X-Requested-With") == "XMLHttpRequest"
        if is_ajax:
            return HttpResponse(status=204)

        if note is not None:
            return redirect(note.get_absolute_url())

    if request.GET.get("format") == "json":
        return JsonResponse(settings.groceries)

    return render(request, "orgapy/groceries.html", {})


@permission_required("orgapy.view_task")
def view_tasks(request: HttpRequest) -> HttpResponse:

    if request.method == "POST":
        if not request.user.has_perm("orgapy.add_task"):
            raise PermissionDenied()
        task = Task.objects.create(
            user=request.user,
            start_date=timezone.now().date(),
            title="My task"
        )
        redirect_url = task.get_absolute_url()
        if request.POST.get("next"):
            redirect_url += "?" + urlencode({"next": request.POST["next"]})
        return redirect(redirect_url)

    page_size = 23
    objects = Task.objects.filter(user=request.user).order_by("completed", "-date_completion", "-due_date")
    paginator = Paginator(objects, page_size)
    page = request.GET.get("page")
    tasks = paginator.get_page(page)

    return render(request, "orgapy/tasks.html", {
        "tasks": tasks,
        "paginator": _pretty_paginator(tasks)
    })


@permission_required("orgapy.view_task")
def view_task(request: HttpRequest, task_id: str) -> HttpResponse:
    task = _find_user_object(Task, "id", task_id, request.user)

    if request.method == "POST":
        action = request.POST.get("action")

        if action == "delete":
            if not request.user.has_perm("orgapy.delete_task"):
                raise PermissionDenied()
            task.delete()

        if action == "save":
            if not request.user.has_perm("orgapy.change_task"):
                raise PermissionDenied()
            if "title" in request.POST:
                task.title = request.POST["title"]
            if "start_date" in request.POST:
                task.start_date = datetime.datetime.strptime(request.POST["start_date"], "%Y-%m-%d").date()
            if "due_date" in request.POST:
                if request.POST["due_date"]:
                    task.due_date = datetime.datetime.strptime(request.POST["due_date"], "%Y-%m-%d").date()
                else:
                    task.due_date = None
            if "recurring_mode" in request.POST:
                task.recurring_mode = request.POST["recurring_mode"]
            if "recurring_period" in request.POST:
                if request.POST["recurring_period"]:
                    task.recurring_period = int(request.POST["recurring_period"])
                else:
                    task.recurring_period = None
            task.save()

        if action == "complete":
            task.completed = True
            task.date_completion = timezone.now()
            task.save()
            ProgressLog.objects.create(
                user=request.user,
                type=ProgressLog.TASK_COMPLETED,
                description=task.title
            )
            task.create_recurring_child()

        if request.POST.get("next"):
            return redirect(request.POST["next"])

    return render(request, "orgapy/task.html", {"task": task})


@permission_required("orgapy.view_objective")
def view_objectives(request: HttpRequest) -> HttpResponse:

    qs = Objective.objects.filter(user=request.user).order_by("id")

    if request.GET.get("format") == "json":
        if not request.GET.get("archived"):
            qs = qs.exclude(archived=True)
        settings = _get_or_create_settings(request.user)
        return JsonResponse({
            "startHours": settings.objective_start_hours,
            "objectives": [
                objective.to_dict()
                for objective in qs
            ]
        })

    objectives = list(qs)
    return render(request, "orgapy/objectives.html", {
        "objectives": list(objectives),
    })


@permission_required("orgapy.view_objective")
def view_objective(request: HttpRequest, objective_id: str) -> HttpResponse:
    objective = _find_user_object(Objective, "id", objective_id, request.user)

    if request.method == "POST":

        action = request.POST.get("action")

        is_ajax = request.headers.get("X-Requested-With") == "XMLHttpRequest"

        if action == "delete":
            if not request.user.has_perm("orgapy.delete_objective"):
                raise PermissionDenied()
            objective.delete()
        elif not request.user.has_perm("orgapy.change_objective"):
            raise PermissionDenied()

        if action == "add-completion":
            if "ts" in request.POST:
                ts = int(request.POST["ts"])
            elif "date" in request.POST and "time" in request.POST:
                ts = int(datetime.datetime.strptime(request.POST["date"] + " " + request.POST["time"], "%Y-%m-%d %H:%M:%S").timestamp())
            else:
                raise BadRequest("Missing timestamp")
            history = json.loads(objective.history) if objective.history else []
            history.append(ts)
            objective.history = json.dumps(history)
            ProgressLog.objects.create(
                user=request.user,
                type=ProgressLog.OBJECTIVE_COMPLETED,
                description=objective.name
            )

        if action == "delete-completion":
            ts = int(request.POST["ts"])
            history = json.loads(objective.history) if objective.history else []
            history.remove(ts)
            objective.history = json.dumps(history)

        if action == "save":
            objective.name = request.POST["name"]
            objective.period = int(request.POST["period"])
            objective.flexible = request.POST["flexible"] == "on"
            objective.archived = request.POST["archived"] == "on"

        objective.save()

        if is_ajax:
            return HttpResponse(status=204)

    return render(request, "orgapy/objective.html", {"objective": objective})


@permission_required("orgapy.view_tag")
@permission_required("orgapy.view_document")
@permission_required("orgapy.view_project")
def view_suggestions(request: HttpRequest) -> HttpResponse:
    stype = request.GET.get("t", "")
    limit = int(request.GET.get("l", 10))
    query = request.GET.get("q", "").strip()
    results: list[Tag | Document | Project] = []
    if query:
        if not stype:
            if query.startswith("#"):
                query = query[1:]
                stype = "tag"
            else:
                stype = "document"
        if stype == "document":
            qs = Document.objects.filter(user=request.user, deleted=False, hidden=False, title__istartswith=query)
        elif stype in ["note", "sheet", "map"]:
            qs = Document.objects.filter(user=request.user, deleted=False, hidden=False, type=stype, title__istartswith=query)
        elif stype == "tag":
            qs = Tag.objects.filter(user=request.user, name__istartswith=query)
        elif stype == "project":
            qs = Project.objects.filter(user=request.user).filter(Q(title__istartswith=query) | Q(document__title__istartswith=query))
        else:
            raise BadRequest("Invalid suggestion type")
        results = list(qs[:limit])
    return JsonResponse({
        "results": [
            {
                "ref": getattr(result, "name", getattr(result, "nonce", None)),
                "label": result.title if isinstance(result, Document) else (result.name if isinstance(result, Tag) else result.reference),
                "url": result.get_absolute_url(),
                "icon": result.type_icon if isinstance(result, Document) else ("ri-hashtag" if isinstance(result, Tag) else "ri-briefcase-line")
            }
            for result in results
        ]
    })


@permission_required("orgapy.view_calendar")
def view_calendars(request: HttpRequest) -> HttpResponse:

    if request.method == "POST":
        action = request.POST.get("action")

        if action == "add":
            if not request.user.has_perm("orgapy.add_calendar"):
                raise PermissionDenied()
            Calendar.objects.create(
                user=request.user,
                calendar_name=request.POST["name"],
                url=request.POST["url"],
                username=request.POST["username"],
                password=request.POST["password"],
                sync_period=int(request.POST["sync_period"]),
            )

        if action == "save":
            if not request.user.has_perm("orgapy.change_calendar"):
                raise PermissionDenied()
            calendar = _find_user_object(Calendar, "id", request.POST["id"], request.user)
            calendar.calendar_name = request.POST["name"]
            calendar.url = request.POST["url"]
            calendar.username = request.POST["username"]
            calendar.password = request.POST["password"]
            calendar.sync_period = int(request.POST["sync_period"])
            calendar.save()

        if action == "delete":
            if not request.user.has_perm("orgapy.delete_calendar"):
                raise PermissionDenied()
            calendar = _find_user_object(Calendar, "id", request.POST["id"], request.user)
            calendar.delete()

        if action == "refresh":
            if not request.user.has_perm("orgapy.change_calendar"):
                raise PermissionDenied()
            if "id" in request.POST:
                calendar = _find_user_object(Calendar, "id", request.POST["id"], request.user)
                calendar.fetch_events()
            else:
                for calendar in Calendar.objects.filter(user=request.user):
                    calendar.fetch_events()
        
        if "next" in request.POST:
            return redirect(request.POST["next"])

    calendars = Calendar.objects.filter(user=request.user)    
    return render(request, "orgapy/calendars.html", {"calendars": calendars})
