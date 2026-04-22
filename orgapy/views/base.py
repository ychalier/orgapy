import datetime
import re
import time
from urllib.parse import urlencode

from django.contrib.auth.decorators import permission_required
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import PermissionDenied, BadRequest
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import HttpRequest, HttpResponse, Http404, JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.utils.text import slugify
from django.urls import reverse
from django.views.decorators.http import condition

from ..models import (
    Category,
    Document,
    ProgressLog,
    Calendar,
    Project,
    MoodLog,
    Task,
    Objective)

from .utils import (
    find_user_object,
    pretty_paginator,
    get_or_create_settings,
    view_document_list,
    get_pending_mood_logs,
    view_calendar,
    compare_checklists)


# GENERAL ######################################################################


def view_landing(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("orgapy:home")
    return redirect("orgapy:about")


def view_about(request: HttpRequest) -> HttpResponse:
    return render(request, "orgapy/about.html", {})


@permission_required("orgapy.view_project")
def view_home(request: HttpRequest) -> HttpResponse:
    if isinstance(request.user, AnonymousUser):
        raise PermissionDenied()
    settings = get_or_create_settings(request.user)
    pending_mood_logs = get_pending_mood_logs(request.user, settings.mood_log_hours, settings.mood_log_lookback_days)
    active_projects = Project.objects.filter(user=request.user, status=Project.ACTIVE).order_by("date_creation")

    now = timezone.now()
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

    # for task in :
    #     tasks.append({
    #         "id": task.id,
    #         "title": task.title,
    #         "start_date": task.start_date.isoformat(),
    #         "due_date": task.due_date.isoformat() if task.due_date is not None else None,
    #         "recurring_mode": task.recurring_mode,
    #         "recurring_period": task.recurring_period,
    #     })
    # tasks.sort(key=lambda x: x["due_date"] if x.get("due_date") is not None else "")
    # return JsonResponse({"tasks": tasks})

    return render(request, "orgapy/home.html", {
        "settings": settings,
        "pending_mood_logs": pending_mood_logs,
        "projects": active_projects,
        "task_groups": task_groups,
        "active": "home",
    })


# PROJECTS #####################################################################


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

    page_size = int(request.GET.get("size", 25))
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
    sort_key = s if s in ["creation", "modification"] else None
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

    paginator = Paginator(qs, page_size)
    page = request.GET.get("page")
    projects = paginator.get_page(page)
    return render(request, "orgapy/projects.html", {
        "projects": projects,
        "paginator": pretty_paginator(projects),
        "active": "projects",
        "attrs": attrs,
        "active": "projects",
    })


def project_etag_func(request: HttpRequest, project_id: str) -> str | None:
    try:
        project = Project.objects.get(user=request.user, id=project_id)
    except Project.DoesNotExist:
        return None
    return project.etag


def project_last_modified_func(request: HttpRequest, project_id: str) -> datetime.datetime | None:
    try:
        project = Project.objects.get(user=request.user, id=project_id)
    except Project.DoesNotExist:
        return None
    return project.updated_at


@permission_required("orgapy.view_project")
@condition(project_etag_func, project_last_modified_func)
def view_project(request: HttpRequest, project_id: str) -> HttpResponse:
    if isinstance(request.user, AnonymousUser):
        raise PermissionDenied()
    project = find_user_object(Project, "id", project_id, request.user)

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
            compare_checklists(request.user, project.reference, project.checklist, new_checklist)
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


# DOCUMENTS ####################################################################


@permission_required("orgapy.view_document")
def view_documents(request: HttpRequest) -> HttpResponse:

    if request.method == "POST":
        doctype = request.POST.get("type", "note")
        if doctype not in ["note", "sheet", "map"]:
            raise BadRequest("Incorrect document type")
        doc = Document.objects.create(user=request.user, type=doctype)
        return redirect(doc.get_absolute_url() + "?edit=1")

    template_name = "orgapy/" + ("documents_calendar.html" if request.GET.get("calendar") else "documents_list.html")
    return view_document_list(request, template_name)


def document_etag_func(request: HttpRequest, nonce: str) -> str | None:
    try:
        doc = Document.objects.get(nonce=nonce)
    except Document.DoesNotExist:
        return None
    return doc.etag


def document_last_modified_func(request: HttpRequest, nonce: str) -> datetime.datetime | None:
    try:
        doc = Document.objects.get(nonce=nonce)
    except Document.DoesNotExist:
        return None
    return doc.updated_at


@condition(document_etag_func, document_last_modified_func)
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

        if "content" in request.POST:
            new_content = request.POST["content"]
            if new_content:
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

        if "categories" in request.POST:
            doc.categories.clear()
            name_list = request.POST.get("categories", "").split(";")
            for dirty_name in name_list:
                name = dirty_name.lower().strip()
                if name == "" or name == "uncategorized":
                    continue
                try:
                    category = Category.objects.get(name=name, user=request.user)
                except Category.DoesNotExist:
                    category = Category.objects.create(name=name, user=request.user)
                doc.categories.add(category)

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
            content = doc.title if doc.title else "Untitled"
            if doc.content:
                content += "\n\n" + doc.content
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
    return view_document_list(request, "orgapy/trash.html", status_filter="deleted", sort_key="deletion")


@permission_required("orgapy.view_category")
def view_categories(request: HttpRequest) -> HttpResponse:
    uncategorized = Document.objects.filter(user=request.user, categories__isnull=True).count()
    return render(request, "orgapy/categories.html", {
        "categories": Category.objects.filter(user=request.user),
        "active": "documents",
        "uncategorized": uncategorized
    })


@permission_required("orgapy.view_category")
def view_category(request: HttpRequest, name: str) -> HttpResponse:
    if name == "uncategorized":
        category = {"id": -1, "name": "uncategorized"}
    else:
        category = find_user_object(Category, "name", name, request.user)

    if request.method == "POST":
        if isinstance(category, dict):
            raise Http404()

        if request.POST.get("delete"):
            category.delete()
            return redirect("orgapy:categories")
        if "name" in request.POST:
            new_name = request.POST.get("name")
            if new_name is None:
                raise BadRequest("Missing name")
            if len(new_name) > 0:
                category.name = new_name.lower()
                category.save()
            return redirect("orgapy:category", name=category.name)

    if request.GET.get("edit"):
        return render(request, "orgapy/edit_category.html", {"category": category})

    return view_document_list(request,
        "orgapy/category.html",
        category_filters=name,
        kwargs={"category": category})


# PROGRESS #####################################################################


@permission_required("orgapy.view_progress_log")
def view_progress(request: HttpRequest) -> HttpResponse:
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
    return view_calendar(request,
        ProgressLog,
        "dt",
        json_generator,
        "id\ttype\tdt\tdescription",
        tsv_generator,
        "orgapy/progress.html",
        "progress")


@permission_required("orgapy.add_progress_log")
def view_create_progress_log(request: HttpRequest) -> HttpResponse:
    return render(request, "orgapy/create_progress_log.html", {})


@permission_required("orgapy.change_progress_log")
def view_edit_progress_log(request: HttpRequest, object_id: str) -> HttpResponse:
    log = find_user_object(ProgressLog, "id", object_id, request.user)
    return render(request, "orgapy/edit_progress_log.html", {
        "log": log,
    })


@permission_required("orgapy.delete_progress_log")
def view_delete_progress_log(request: HttpRequest, object_id: str) -> HttpResponse:
    log = find_user_object(ProgressLog, "id", object_id, request.user)
    log.delete()
    return redirect("orgapy:progress")


@permission_required("orgapy.view_save_progress_log")
def view_save_progress_log(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequest("Wrong method")
    original_log = None
    if ("id" in request.POST
        and ProgressLog.objects.filter(id=request.POST["id"]).exists()):
        original_log = ProgressLog.objects.get(id=request.POST["id"])
    if original_log is not None and original_log.user != request.user:
        raise PermissionDenied()
    dt_string = request.POST.get("dt")
    if dt_string is None:
        raise BadRequest("Missing dt")
    dt = datetime.datetime.strptime(dt_string, f"%Y-%m-%dT%H:%M")
    log_type = request.POST.get("type", ProgressLog.OTHER)
    description = request.POST.get("description")
    if original_log is None:
        ProgressLog.objects.create(
            user=request.user,
            dt=dt,
            type=log_type,
            description=description
        )
    else:
        original_log.dt = dt
        original_log.type = log_type
        original_log.description = description
        original_log.save()
    return redirect("orgapy:progress")


# SETTINGS #####################################################################


@permission_required("orgapy.change_settings")
def view_settings(request: HttpRequest) -> HttpResponse:
    if isinstance(request.user, AnonymousUser):
        raise PermissionDenied()
    user_settings = get_or_create_settings(request.user)
    if request.method == "POST":
        user_settings.objective_start_hours = int(request.POST.get("objective_start_hours", 0))
        user_settings.calendar_lookahead = int(request.POST.get("calendar_lookahead", 3))
        user_settings.trash_period = int(request.POST.get("trash_period", 30))
        user_settings.mood_log_hours = int(request.POST.get("mood_log_hours", 19))
        user_settings.mood_log_lookback_days = int(request.POST.get("mood_log_lookback_days", 2))
        user_settings.mood_activities = request.POST.get("mood_activities", "").strip()
        user_settings.groceries_data = request.POST.get("groceries_data")
        user_settings.beach_mode = bool(request.POST.get("beach_mode", False))
        user_settings.save()
        if "ref" in request.POST and request.POST["ref"]:
            return redirect(request.POST["ref"])
    calendars = Calendar.objects.filter(user=request.user).order_by("calendar_name")
    return render(request, "orgapy/settings.html", {
        "settings": user_settings,
        "calendars": calendars,
    })


@permission_required("orgapy.change_calendar")
def view_calendar_form(request: HttpRequest) -> HttpResponse:
    if not request.method == "POST":
        raise BadRequest("Wrong method")
    if "id" in request.POST:
        query = Calendar.objects.filter(user=request.user, id=request.POST["id"])
        if not query.exists():
            raise Http404()
        calendar = query.get()
        if "save" in request.POST:
            calendar.url = request.POST["url"]
            calendar.username = request.POST["username"]
            calendar.password = request.POST["password"]
            calendar.calendar_name = request.POST["name"]
            calendar.sync_period = int(request.POST["sync_period"])
            calendar.save()
        elif "delete" in request.POST:
            calendar.delete()
        else:
            raise BadRequest("Missing action")
    else:
        calendar = Calendar.objects.create(
            user=request.user,
            url=request.POST["url"],
            username=request.POST["username"],
            password=request.POST["password"],
            calendar_name=request.POST["name"],
            sync_period=int(request.POST["sync_period"]),
        )
    return redirect("orgapy:settings")


# MOOD #########################################################################


@permission_required("orgapy.view_mood_log")
def view_mood(request: HttpRequest, year: int | str | None = None) -> HttpResponse:

    if isinstance(request.user, AnonymousUser):
        raise PermissionDenied()
    settings = get_or_create_settings(request.user)
    pending_mood_logs = get_pending_mood_logs(request.user, settings.mood_log_hours, settings.mood_log_lookback_days)

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
            "href": reverse("admin:orgapy_moodlog_change", args=[log.id])
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

    return view_calendar(
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


@permission_required("orgapy.delete_mood_log")
def view_delete_mood_log(request: HttpRequest, object_id: str) -> HttpResponse:
    mood_log = find_user_object(MoodLog, "id", object_id, request.user)
    mood_log.delete()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect("orgapy:mood")


# GROCERIES ####################################################################


@permission_required("orgapy.view_settings")
def view_groceries(request: HttpRequest) -> HttpResponse:
    return render(request, "orgapy/groceries.html", {})


# TASKS ########################################################################


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
        "paginator": pretty_paginator(tasks)
    })


@permission_required("orgapy.view_task")
def view_task(request: HttpRequest, task_id: str) -> HttpResponse:
    task = find_user_object(Task, "id", task_id, request.user)

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


# OBJECTIVES ###################################################################

@permission_required("orgapy.view_objective")
def view_objectives(request: HttpRequest) -> HttpResponse:
    if isinstance(request.user, AnonymousUser):
        raise PermissionDenied()
    objectives = Objective.objects.filter(user=request.user)
    return render(request, "orgapy/objectives.html", {
        "objectives": objectives,
        "settings": get_or_create_settings(request.user),
    })


# SUGGESTIONS ##################################################################
@permission_required("orgapy.view_category")
@permission_required("orgapy.view_document")
@permission_required("orgapy.view_project")
def view_suggestions(request: HttpRequest) -> HttpResponse:
    stype = request.GET.get("t", "")
    limit = int(request.GET.get("l", 10))
    query = request.GET.get("q", "").strip()
    results: list[Category | Document | Project] = []
    if query:
        if not stype:
            if query.startswith("#"):
                query = query[1:]
                stype = "category"
            else:
                stype = "document"
        if stype == "document":
            qs = Document.objects.filter(user=request.user, deleted=False, hidden=False, title__istartswith=query)
        elif stype in ["note", "sheet", "map"]:
            qs = Document.objects.filter(user=request.user, deleted=False, hidden=False, type=stype, title__istartswith=query)
        elif stype == "category":
            qs = Category.objects.filter(user=request.user, name__istartswith=query)
        elif stype == "project":
            qs = Project.objects.filter(user=request.user).filter(Q(title__istartswith=query) | Q(document__title__istartswith=query))
        else:
            raise BadRequest("Invalid suggestion type")
        results = list(qs[:limit])
    return JsonResponse({
        "results": [
            {
                "ref": getattr(result, "name", getattr(result, "nonce", None)),
                "label": result.reference if isinstance(result, Project) else result.title,
                "url": result.get_absolute_url(),
                "type": result.type if isinstance(result, Document) else ("project" if isinstance(result, Project) else "category")
            }
            for result in results
        ]
    })


def view_document_snippet(request: HttpRequest) -> HttpResponse:
    nonces = request.GET.getlist("nonce")
    results = []
    for nonce in nonces:
        result = {"nonce": nonce, "title": None, "href": None, "icon": None, "error": None}
        if isinstance(request.user, AnonymousUser):
            result["error"] = "Forbidden"
        else:
            try:
                doc = Document.objects.get(user=request.user, nonce=nonce)
                result["title"] = doc.title
                result["href"] = doc.get_absolute_url()
                result["icon"] = doc.type_icon
            except ValueError | Document.DoesNotExist:
                result["error"] = "Invalid reference"
            except Exception:
                result["error"] = "Error"
        results.append(result)
    return JsonResponse({"results": results})
