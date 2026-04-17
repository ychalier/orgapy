import datetime

from django.contrib.auth.decorators import permission_required
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import PermissionDenied, BadRequest
from django.core.paginator import Paginator
from django.http import HttpRequest, HttpResponse, Http404
from django.shortcuts import redirect, render
from django.utils.text import slugify

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
    save_document_core,
    get_or_create_settings,
    toggle_document_attribute,
    view_document_list,
    get_pending_mood_logs,
    retrieve_document)


# GENERAL ######################################################################


def view_landing(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("orgapy:home")
    return redirect("orgapy:about")


def view_about(request: HttpRequest) -> HttpResponse:
    """View for the homepage, describing the application for a new user."""
    return render(request, "orgapy/about.html", {})


# PROJECTS #####################################################################


@permission_required("orgapy.view_project")
def view_home(request: HttpRequest) -> HttpResponse:
    if isinstance(request.user, AnonymousUser):
        raise PermissionDenied()
    settings = get_or_create_settings(request.user)
    pending_mood_logs = get_pending_mood_logs(request.user, settings.mood_log_hours, settings.mood_log_lookback_days)
    return render(request, "orgapy/home.html", {
        "settings": settings,
        "pending_mood_logs": pending_mood_logs,
        "active": "home",
    })


@permission_required("orgapy.view_project")
def view_projects(request: HttpRequest) -> HttpResponse:
    note_filter = request.GET.get("note")
    status_filter = request.GET.get("status")
    query = Project.objects.filter(user=request.user)
    if note_filter is not None:
        try:
            query = query.filter(note__id=int(note_filter))
        except:
            raise BadRequest()
    if status_filter is not None:
        query = query.filter(status=status_filter)
    query = query.order_by("-date_modification")
    page_size = 25
    paginator = Paginator(query, page_size)
    page = request.GET.get("page")
    projects = paginator.get_page(page)
    return render(request, "orgapy/projects.html", {
        "projects": projects,
        "paginator": pretty_paginator(projects),
        "active": "projects",
    })


@permission_required("orgapy.view_project")
def view_project(request: HttpRequest, object_id: str) -> HttpResponse:
    if isinstance(request.user, AnonymousUser):
        raise PermissionDenied()
    project = find_user_object(Project, "id", object_id, request.user)
    return render(request, "orgapy/project.html", {
        "project": project,
        "active": "projects",
    })


@permission_required("orgapy.delete_project")
def view_delete_project(request: HttpRequest, object_id: str) -> HttpResponse:
    project = find_user_object(Project, "id", object_id, request.user)
    project.delete()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect("orgapy:home")


# DOCUMENTS ####################################################################


@permission_required("orgapy.view_document")
def view_documents(request: HttpRequest) -> HttpResponse:
    return view_document_list(request, "orgapy/documents.html", sort_key=None)


@permission_required("orgapy.add_document")
def view_create_document(request: HttpRequest) -> HttpResponse:
    doctype = request.GET.get("type", "note")
    if doctype not in ["note", "sheet", "map"]:
        raise BadRequest()
    return render(request, f"orgapy/create_{doctype}.html", {
        "active": "documents"
    })


def view_document(request: HttpRequest, docid: str) -> HttpResponse:
    doc, readonly = retrieve_document(request, docid)
    response = render(request, f"orgapy/{doc.type}.html", {
        "document": doc,
        "readonly": readonly,
        "active": "documents",
    })
    response["X-Frame-Options"] = "SAMEORIGIN"
    return response


def view_document_raw(request: HttpRequest, docid: str) -> HttpResponse:
    doc, _ = retrieve_document(request, docid)

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
    return response


def view_note_fullscreen(request, docid: str):
    note, readonly = retrieve_document(request, docid)
    if note.type != "note":
        raise PermissionDenied()
    response = render(request, f"orgapy/note_fullscreen.html", {
        "note": note,
        "readonly": readonly,
        "active": "documents",
    })
    response["X-Frame-Options"] = "SAMEORIGIN"
    return response


@permission_required("orgapy.view_document")
def view_edit_document(request: HttpRequest, docid: str) -> HttpResponse:
    doc = find_user_object(Document, "id", docid, request.user)
    return render(request, f"orgapy/edit_{doc.type}.html", {
        "document": doc,
        "active": "documents",
    })


@permission_required("orgapy.change_document")
def view_save_document(request: HttpRequest) -> HttpResponse:
    if not request.method == "POST":
        raise BadRequest()

    original = None
    if "id" in request.POST and Document.objects.filter(id=request.POST["id"]).exists():
        original = Document.objects.get(id=request.POST["id"])
        if original.date_modification.timestamp() > float(request.POST.get("modification", 0)):
            return HttpResponse(content="Newer changes were made", content_type="text/plain", status=409)
    if original is not None and original.user != request.user:
        raise PermissionDenied()

    if original is None:
        doc = Document.objects.create(
            user=request.user,
            type=request.POST.get("type", "note").strip(),
            public="public" in request.POST,
            pinned="pinned" in request.POST,
            hidden="hidden" in request.POST,
            title=request.POST.get("title"),
            subtitle=request.POST.get("subtitle"),
            content=request.POST.get("content"),
            config=request.POST.get("config"),
        )
    else:
        doc = original
        doc.public = "public" in request.POST
        doc.pinned = "pinned" in request.POST
        doc.hidden = "hidden" in request.POST
        doc.title = request.POST.get("title")
        doc.subtitle = request.POST.get("subtitle")
        doc.content = request.POST.get("content")
        doc.config = request.POST.get("config")

    doc.categories.clear()
    name_list = request.POST.get("categories", "").split(";")
    for dirty_name in name_list:
        name = dirty_name.lower().strip()
        if name == "":
            continue
        int_id = None
        try:
            int_id = int(name)
        except ValueError:
            pass
        if int_id is not None and Category.objects.filter(id=int_id, user=request.user).exists():
            category = Category.objects.get(id=int_id, user=request.user)
        elif Category.objects.filter(name=name, user=request.user).exists():
            category = Category.objects.get(name=name, user=request.user)
        elif name == "uncategorized":
            raise BadRequest()
        else:
            category = Category.objects.create(name=name, user=request.user)
        doc.categories.add(category)
    save_document_core(doc)
    return redirect(doc)


@permission_required("orgapy.change_document")
def view_toggle_document_hidden(request: HttpRequest, docid: str) -> HttpResponse:
    return toggle_document_attribute(request, docid, "hidden")


@permission_required("orgapy.change_document")
def view_toggle_document_pin(request: HttpRequest, docid: str) -> HttpResponse:
    return toggle_document_attribute(request, docid, "pinned")


@permission_required("orgapy.change_document")
def view_toggle_document_public(request: HttpRequest, docid: str) -> HttpResponse:
    return toggle_document_attribute(request, docid, "public")


@permission_required("orgapy.delete_document")
def view_delete_document(request: HttpRequest, docid: str) -> HttpResponse:
    doc = find_user_object(Document, "id", docid, request.user)
    doc.soft_delete()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect("orgapy:documents")


@permission_required("orgapy.add_document")
def view_restore_document(request: HttpRequest, docid: str) -> HttpResponse:
    doc = find_user_object(Document, "id", docid, request.user, allow_deleted=True)
    doc.restore()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect(doc.get_absolute_url())


@permission_required("orgapy.delete_document")
def view_destroy_document(request: HttpRequest, docid: str) -> HttpResponse:
    doc = find_user_object(Document, "id", docid, request.user, allow_deleted=True)
    doc.delete()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect(f"orgapy:documents")


@permission_required("orgapy.delete_document")
def view_trash(request: HttpRequest) -> HttpResponse:
    return view_document_list(request, "orgapy/trash.html", status_filter="deleted", sort_key="deletion")


@permission_required("orgapy.add_document")
def view_restore_all_documents(request: HttpRequest) -> HttpResponse:
    Document.objects.filter(user=request.user, deleted=True).update(deleted=False, date_deletion=None)
    return redirect(f"orgapy:trash")


@permission_required("orgapy.delete_document")
def view_destroy_all_documents(request: HttpRequest) -> HttpResponse:
    Document.objects.filter(user=request.user, deleted=True).delete()
    return redirect(f"orgapy:trash")


@permission_required("orgapy.view_document")
def view_notes(request: HttpRequest) -> HttpResponse:
    return view_document_list(request, "orgapy/documents.html", type_filter="note", sort_key=None)


@permission_required("orgapy.view_sheet")
def view_sheets(request: HttpRequest) -> HttpResponse:
    return view_document_list(request, "orgapy/documents.html", type_filter="sheet", sort_key=None)


@permission_required("orgapy.view_document")
def view_maps(request: HttpRequest) -> HttpResponse:
    return view_document_list(request, "orgapy/documents.html", type_filter="map", sort_key=None)


# CATEGORIES ###################################################################


@permission_required("orgapy.view_category")
def view_categories(request: HttpRequest) -> HttpResponse:
    uncategorized = Document.objects.filter(user=request.user, categories__isnull=True).count()
    return render(request, "orgapy/categories.html", {
        "categories": Category.objects.filter(user=request.user),
        "specials": {
            "uncategorized": uncategorized
        },
    })


@permission_required("orgapy.view_category")
def view_category(request: HttpRequest, name: str) -> HttpResponse:
    if name in ["journal", "org"]:
        return render(request, f"orgapy/specials/journal.html", {"category": name})
    if name == "quote":
        return render(request, f"orgapy/specials/quote.html", {})
    if name == "all":
        return render(request, f"orgapy/specials/all.html", {})
    if name == "uncategorized":
        category = {"id": -1, "name": "uncategorized"}
    else:
        category = find_user_object(Category, "name", name, request.user)
    return view_document_list(request,
        "orgapy/category.html",
        category_filters=name,
        kwargs={"category": category})


@permission_required("orgapy.change_category")
def view_edit_category(request: HttpRequest, object_id: str) -> HttpResponse:
    query = Category.objects.filter(id=object_id)
    if query.exists():
        category = query.get()
        if category.user == request.user:
            if request.method == "POST":
                new_name = request.POST.get("name")
                if new_name is None:
                    raise BadRequest()
                if len(new_name) > 0:
                    category.name = new_name.lower()
                    category.save()
                return redirect("orgapy:category", name=category.name)
            return render(request, "orgapy/edit_category.html", {
                "category": category,
            })
    return redirect("orgapy:categories")


@permission_required("orgapy.delete_category")
def view_delete_category(request: HttpRequest, object_id: str) -> HttpResponse:
    query = Category.objects.filter(id=object_id)
    if query.exists():
        category = query.get()
        if category.user == request.user:
            category.delete()
    return redirect("orgapy:categories")


# PROGRESS #####################################################################


@permission_required("orgapy.view_progress_log")
def view_progress(request: HttpRequest, year: int | str | None = None) -> HttpResponse:
    if year is None:
        year = datetime.datetime.now().year
    else:
        year = int(year)

    dt_start = datetime.datetime(year, 1, 1, 0, 0, 0, 0)
    dt_end = datetime.datetime(year, 12, 31, 0, 0, 0, 0)
    dt_filter = False
    try:
        if "start" in request.GET:
            dt_filter = True
            dt_start = datetime.datetime.strptime(request.GET["start"], "%Y-%m-%d")
        if "end" in request.GET:
            dt_filter = True
            dt_end = datetime.datetime.strptime(request.GET["end"], "%Y-%m-%d")
        if "date" in request.GET:
            dt_filter = True
            dt = datetime.datetime.strptime(request.GET["date"], "%Y-%m-%d")
            dt_start = dt
            dt_end = dt
    except ValueError:
        raise BadRequest()

    page_size = 25
    objects = ProgressLog.objects.filter(user=request.user).filter(dt__range=[dt_start, dt_end + datetime.timedelta(days=1)]).order_by("-dt")
    paginator = Paginator(objects, page_size)
    page = request.GET.get("page")
    logs = paginator.get_page(page)
   
    return render(request, "orgapy/progress.html", {
        "logs": logs,
        "year": year,
        "paginator": pretty_paginator(logs),
        "dt_filter": dt_filter,
        "dt_start": dt_start,
        "dt_end": dt_end,
    })


@permission_required("orgapy.view_progress")
def view_progress_export(request: HttpRequest, year: int | str | None = None) -> HttpResponse:
    if year is None:
        year = datetime.datetime.now().year
    else:
        year = int(year)
    lines = ["id\ttype\tdt\tdescription"]
    for log in ProgressLog.objects.filter(user=request.user, dt__year=year):
        lines.append("\t".join([
            str(log.id),
            log.type,
            log.dt.isoformat(),
            str(log.description)
        ]))
    response = HttpResponse("\n".join(lines), content_type="text/tab-separated-values; charset=utf-8")
    response["Content-Disposition"] = f'inline; filename="progress-{year}.tsv"'
    return response


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
        raise BadRequest()
    original_log = None
    if ("id" in request.POST
        and ProgressLog.objects.filter(id=request.POST["id"]).exists()):
        original_log = ProgressLog.objects.get(id=request.POST["id"])
    if original_log is not None and original_log.user != request.user:
        raise PermissionDenied()
    dt_string = request.POST.get("dt")
    if dt_string is None:
        raise BadRequest()
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
        raise BadRequest()
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
            raise BadRequest()
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
def view_mood(request: HttpRequest) -> HttpResponse:
    if isinstance(request.user, AnonymousUser):
        raise PermissionDenied()
    settings = get_or_create_settings(request.user)
    pending_mood_logs = get_pending_mood_logs(request.user, settings.mood_log_hours, settings.mood_log_lookback_days)
    logs = MoodLog.objects.filter(user=request.user).order_by("-date")
    return render(request, "orgapy/mood.html", {
        "settings": settings,
        "pending_mood_logs": pending_mood_logs,
        "logs": logs,
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

    page_size = 23
    objects = Task.objects.filter(user=request.user).order_by("completed", "-date_completion", "-due_date")
    paginator = Paginator(objects, page_size)
    page = request.GET.get("page")
    tasks = paginator.get_page(page)

    return render(request, "orgapy/tasks.html", {
        "tasks": tasks,
        "paginator": pretty_paginator(tasks)
    })


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
