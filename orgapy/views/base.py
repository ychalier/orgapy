import datetime
import json

from django.contrib.auth.decorators import permission_required
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import PermissionDenied, BadRequest
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import HttpRequest, HttpResponse, Http404
from django.shortcuts import redirect, render
from django.utils.text import slugify
from django.urls import reverse

from ..models import Category, Note, Sheet, Map, ProgressCounter, ProgressLog, Calendar
from .utils import ConflictError, find_object, pretty_paginator, save_object_core, get_or_create_settings, view_objects, toggle_object_attribute


# GENERAL ######################################################################


def view_landing(request: HttpRequest) -> HttpResponse:
    if request.user.is_authenticated:
        return redirect("orgapy:projects")
    return redirect("orgapy:about")


def view_about(request: HttpRequest) -> HttpResponse:
    """View for the homepage, describing the application for a new user."""
    return render(request, "orgapy/about.html", {})


@permission_required("orgapy.view_project")
def view_projects(request: HttpRequest) -> HttpResponse:
    if isinstance(request.user, AnonymousUser):
        raise PermissionDenied()
    return render(request, "orgapy/projects.html", {
        "settings": get_or_create_settings(request.user),
        "active": "projects",
    })


# OBJECTS AND CATEGORIES #######################################################


@permission_required("orgapy.view_note")
@permission_required("orgapy.view_sheet")
@permission_required("orgapy.view_map")
def view_search(request: HttpRequest) -> HttpResponse:
    page_size = 24
    query = request.GET.get("query", "")
    if query == "public":
        objects = list(Note.objects.filter(user=request.user, public=True, hidden=False))\
            + list(Sheet.objects.filter(user=request.user, public=True))\
            + list(Map.objects.filter(user=request.user, public=True))
    else:
        objects = list(Note.objects.filter(user=request.user, hidden=False).filter(Q(title__contains=query) | Q(content__contains=query)))\
            + list(Sheet.objects.filter(user=request.user, title__contains=query))\
            + list(Map.objects.filter(user=request.user, title__contains=query))
    if len(objects) == 1:
        return redirect(objects[0].get_absolute_url())
    objects.sort(key=lambda o: o.date_creation, reverse=True)
    paginator = Paginator(objects, page_size)
    page = request.GET.get("page")
    objects = paginator.get_page(page)
    return render(request, "orgapy/search.html", {
        "mixed": True,
        "objects": objects,
        "query": query,
        "paginator": pretty_paginator(objects, query=query),
    })


@permission_required("orgapy.view_category")
def view_categories(request: HttpRequest) -> HttpResponse:
    return render(request, "orgapy/categories.html", {
        "categories": Category.objects.filter(user=request.user),
        "uncategorized": Note.objects.filter(user=request.user, categories__isnull=True).count(),
    })


@permission_required("orgapy.view_category")
def view_category(request: HttpRequest, name: str) -> HttpResponse:
    if name == "journal":
        return render(request, "orgapy/specials/journal.html", {})
    if name == "uncategorized":
        objects = list(Note.objects.filter(user=request.user, categories__isnull=True))\
            + list(Sheet.objects.filter(user=request.user, categories__isnull=True))\
            + list(Map.objects.filter(user=request.user, categories__isnull=True))
        category = {
            "name": "uncategorized",
            "get_absolute_url": reverse("orgapy:category", kwargs={"name": "uncategorized"}),
            "count": len(objects)
        }
    else:
        category = find_object(Category, "name", name, request.user)
        objects = list(category.notes.filter(user=request.user)) + list(category.sheets.filter(user=request.user)) + list(category.maps.filter(user=request.user)) # type: ignore[attr-defined]
    objects.sort(key=lambda x: [x.pinned, x.date_modification, x.date_access], reverse=True)
    page_size = 24
    paginator = Paginator(objects, page_size)
    page = request.GET.get("page")
    objects = paginator.get_page(page)
    return render(request, "orgapy/category.html", {
        "mixed": True,
        "objects": objects,
        "category": category,
        "paginator": pretty_paginator(objects),
    })


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


@permission_required("orgapy.change_note")
@permission_required("orgapy.change_sheet")
@permission_required("orgapy.change_map")
def view_edit(request: HttpRequest, active: str, object_id: str) -> HttpResponse:
    if active == "notes":
        return view_edit_note(request, object_id)
    if active == "sheets":
        return view_edit_sheet(request, object_id)
    if active == "maps":
        return view_edit_map(request, object_id)
    raise BadRequest(f"Unknown environment '{active}'")


@permission_required("orgapy.change_note")
@permission_required("orgapy.change_sheet")
@permission_required("orgapy.change_map")
def view_toggle_pin(request: HttpRequest, active: str, object_id: str) -> HttpResponse:
    return toggle_object_attribute(request, active, object_id, "pinned")


@permission_required("orgapy.change_note")
@permission_required("orgapy.change_sheet")
@permission_required("orgapy.change_map")
def view_toggle_public(request: HttpRequest, active: str, object_id: str) -> HttpResponse:
    return toggle_object_attribute(request, active, object_id, "public")


@permission_required("orgapy.view_note")
@permission_required("orgapy.view_sheet")
@permission_required("orgapy.view_map")
def view_export(request: HttpRequest, active: str, object_id: str) -> HttpResponse:
    if active == "notes":
        return view_export_note(request, object_id)
    if active == "sheets":
        return view_export_sheet(request, object_id)
    if active == "maps":
        return view_export_map(request, object_id)
    raise BadRequest(f"Unknown environment '{active}'")


@permission_required("orgapy.delete_note")
@permission_required("orgapy.delete_sheet")
@permission_required("orgapy.delete_map")
def view_delete(request: HttpRequest, active: str, object_id: str) -> HttpResponse:
    if active == "notes":
        return view_delete_note(request, object_id)
    if active == "sheets":
        return view_delete_sheet(request, object_id)
    if active == "maps":
        return view_delete_map(request, object_id)
    raise BadRequest(f"Unknown environment '{active}'")


def view_share(request: HttpRequest, active: str, nonce: str) -> HttpResponse:
    if active == "notes":
        return view_note(request, nonce)
    if active == "sheets":
        return view_sheet(request, nonce)
    if active == "maps":
        return view_map(request, nonce)
    raise BadRequest(f"Unknown environment '{active}'")


# NOTES ########################################################################


@permission_required("orgapy.view_note")
def view_notes(request: HttpRequest) -> HttpResponse:
    return view_objects(request, Note, "orgapy/notes.html", "notes")


@permission_required("orgapy.add_note")
def view_create_note(request: HttpRequest) -> HttpResponse:
    categories = Category.objects.filter(user=request.user)
    return render(request, "orgapy/create_note.html", {
        "categories": categories,
        "note_category_ids": {},
        "active": "notes",
    })


@permission_required("orgapy.change_note")
def view_save_note(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        try:
            note = save_object_core(request, Note, ["content"])
        except ConflictError:
            return HttpResponse(content="Newer changes were made", content_type="text/plain", status=409)
        return redirect("orgapy:note", object_id=note.id)
    raise BadRequest()


def view_note(request: HttpRequest, object_id: str) -> HttpResponse:
    note = find_object(Note, ["id", "nonce"], object_id)
    has_permission = False
    readonly = True
    if request.user is not None and note.user == request.user and request.user.has_perm("orgapy.view_note"):
        readonly =  False
        has_permission = True
    elif note.public and isinstance(object_id, str) and len(object_id) == 12:
        has_permission = True
    if not has_permission:
        raise PermissionDenied()
    return render(request, "orgapy/note.html", {
        "note": note,
        "readonly": readonly,
        "active": "notes",
    })


@permission_required("orgapy.change_note")
def view_edit_note(request: HttpRequest, object_id: str) -> HttpResponse:
    note = find_object(Note, "id", object_id, request.user)
    categories = Category.objects.filter(user=request.user).order_by("name")
    selected_category_ids = [category.id for category in note.categories.all()]
    return render(request, "orgapy/edit_note.html", {
        "note": note,
        "categories": categories,
        "selected_category_ids": selected_category_ids,
        "active": "notes",
    })


@permission_required("orgapy.view_note")
def view_export_note(request: HttpRequest, object_id: str) -> HttpResponse:
    """View to export a note's content as Markdown"""
    note = find_object(Note, "id", object_id, request.user)
    markdown = note.title + "\n\n" + note.content
    response = HttpResponse(content=markdown, content_type="text/markdown")
    response["Content-Disposition"] = "inline; filename=\"{}.md\"".format(slugify(note.title))
    return response


@permission_required("orgapy.delete_note")
def view_delete_note(request: HttpRequest, object_id: str) -> HttpResponse:
    """View to delete a note"""
    note = find_object(Note, "id", object_id, request.user)
    note.delete()
    return redirect("orgapy:notes")


@permission_required("orgapy.change_note")
def view_toggle_note_pin(request: HttpRequest, object_id: str) -> HttpResponse:
    return view_toggle_pin(request, "notes", object_id)


@permission_required("orgapy.change_note")
def view_toggle_note_public(request: HttpRequest, object_id: str) -> HttpResponse:
    return view_toggle_public(request, "notes", object_id)


@permission_required("orgapy.add_note")
def view_notally(request: HttpRequest) -> HttpResponse:
    created_notes = None
    if request.method == "POST":
        data = json.loads(request.POST.get("data", "[]"))
        notally_cat_query = Category.objects.filter(user=request.user, name="notally")
        notally_cat = None
        if notally_cat_query.exists():
            notally_cat = notally_cat_query.get()
        else:
            notally_cat = Category.objects.create(user=request.user, name="notally")
        created_notes = []
        for note_data in data:
            title = note_data["title"].strip()
            if not title:
                title = "Untitled Notally Note"
            note = Note.objects.create(
                user=request.user,
                title=title,
                content=note_data["content"],
            )
            note.date_creation = datetime.datetime.fromtimestamp(note_data["dateCreation"])
            note.save()
            note.categories.add(notally_cat)
            created_notes.append(note)
    return render(request, "orgapy/notally.html", {
        "notes": created_notes,
        "active": "notes",
    })


# SHEETS #######################################################################


@permission_required("orgapy.view_sheet")
def view_sheets(request: HttpRequest) -> HttpResponse:
    return view_objects(request, Sheet, "orgapy/sheets.html", "sheets")


@permission_required("orgapy.add_sheet")
def view_create_sheet(request: HttpRequest) -> HttpResponse:
    return render(request, "orgapy/create_sheet.html", {
        "active": "sheets",
    })


@permission_required("orgapy.change_sheet")
def view_save_sheet(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        sheet = save_object_core(request, Sheet, ["description"])
        if "next" in request.POST:
            return redirect(request.POST["next"])
        return redirect("orgapy:sheet", object_id=sheet.id)
    raise BadRequest()


def view_sheet(request: HttpRequest, object_id: str) -> HttpResponse:
    sheet = find_object(Sheet, ["id", "nonce"], object_id)
    has_permission = False
    read_only = False
    if request.GET.get("embed"):
        read_only = True
    if request.user is not None and sheet.user == request.user and request.user.has_perm("orgapy.view_sheet"):
        has_permission = True
    elif sheet.public and isinstance(object_id, str) and len(object_id) == 12:
        has_permission = True
        read_only = True
    if not has_permission:
        raise PermissionDenied()
    response = render(request, "orgapy/sheet.html", {
        "sheet": sheet,
        "readonly": read_only,
        "active": "sheets",
    })
    response["X-Frame-Options"] = "SAMEORIGIN"
    return response


@permission_required("orgapy.change_sheet")
def view_edit_sheet(request: HttpRequest, object_id: str) -> HttpResponse:
    sheet = find_object(Sheet, "id", object_id, request.user)
    categories = Category.objects.filter(user=request.user).order_by("name")
    selected_category_ids = [category.id for category in sheet.categories.all()]
    return render(request, "orgapy/edit_sheet.html", {
        "sheet": sheet,
        "categories": categories,
        "selected_category_ids": selected_category_ids,
        "active": "sheets",
    })


@permission_required("orgapy.view_sheet")
def view_export_sheet(request: HttpRequest, object_id: str) -> HttpResponse:
    sheet = find_object(Sheet, ["id", "nonce"], object_id)
    if request.user is not None and sheet.user == request.user and request.user.has_perm("orgapy.view_sheet") or sheet.public:
        response = HttpResponse(sheet.data, content_type="text/tab-separated-values")
        response['Content-Disposition'] = f'attachment; filename="{sheet.title}.tsv"'
        return response
    raise PermissionDenied()


@permission_required("orgapy.delete_sheet")
def view_delete_sheet(request: HttpRequest, object_id: str) -> HttpResponse:
    sheet = find_object(Sheet, "id", object_id, request.user)
    sheet.delete()
    return redirect("orgapy:sheets")


@permission_required("orgapy.change_sheet")
def view_toggle_sheet_pin(request: HttpRequest, object_id: str) -> HttpResponse:
    return view_toggle_pin(request, "sheets", object_id)


@permission_required("orgapy.change_sheet")
def view_toggle_sheet_public(request: HttpRequest, object_id: str) -> HttpResponse:
    return view_toggle_public(request, "sheets", object_id)


# MAPS #########################################################################


@permission_required("orgapy.view_map")
def view_maps(request: HttpRequest) -> HttpResponse:
    return view_objects(request, Map, "orgapy/maps.html", "maps")


@permission_required("orgapy.add_map")
def view_create_map(request: HttpRequest) -> HttpResponse:
    return render(request, "orgapy/create_map.html", {
        "active": "maps",
    })


@permission_required("orgapy.change_map")
def view_edit_map(request: HttpRequest, object_id: str) -> HttpResponse:
    mmap = find_object(Map, "id", object_id, request.user)
    categories = Category.objects.filter(user=request.user).order_by("name")
    selected_category_ids = [category.id for category in mmap.categories.all()]
    return render(request, "orgapy/edit_map.html", {
        "map": mmap,
        "categories": categories,
        "selected_category_ids": selected_category_ids,
        "active": "maps",
    })


@permission_required("orgapy.change_map")
def view_save_map(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        mmap = save_object_core(request, Map)
        if "next" in request.POST:
            return redirect(request.POST["next"])
        return redirect("orgapy:map", object_id=mmap.id)
    raise BadRequest()


def view_map(request: HttpRequest, object_id: str) -> HttpResponse:
    mmap = find_object(Map, ["id", "nonce"], object_id)
    has_permission = False
    read_only = True
    if not request.GET.get("embed"):
        read_only = False
    if request.user is not None and mmap.user == request.user and request.user.has_perm("orgapy.view_map"):
        has_permission = True
    elif mmap.public and isinstance(object_id, str) and len(object_id) == 12:
        has_permission = True
        read_only = True
    if not has_permission:
        raise PermissionDenied()
    response = render(request, "orgapy/map.html", {
        "map": mmap,
        "readonly": read_only,
        "active": "maps",
    })
    response["X-Frame-Options"] = "SAMEORIGIN"
    return response


@permission_required("orgapy.view_map")
def view_export_map(request: HttpRequest, object_id: str) -> HttpResponse:
    mmap = find_object(Map, ["id", "nonce"], object_id)
    if request.user is not None and mmap.user == request.user and request.user.has_perm("orgapy.view_map") or mmap.public:
        response = HttpResponse(mmap.geojson, content_type="application/geo+json")
        response['Content-Disposition'] = f'attachment; filename="{mmap.title}.geojson"'
        return response
    raise PermissionDenied()


@permission_required("orgapy.delete_map")
def view_delete_map(request: HttpRequest, object_id: str) -> HttpResponse:
    mmap = find_object(Map, "id", object_id, request.user)
    mmap.delete()
    return redirect("orgapy:maps")


@permission_required("orgapy.change_map")
def view_toggle_map_pin(request: HttpRequest, object_id: str) -> HttpResponse:
    return view_toggle_pin(request, "maps", object_id)


@permission_required("orgapy.change_map")
def view_toggle_map_public(request: HttpRequest, object_id: str) -> HttpResponse:
    return view_toggle_public(request, "maps", object_id)


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

    page_size = 24
    objects = ProgressLog.objects.filter(user=request.user).filter(dt__range=[dt_start, dt_end + datetime.timedelta(days=1)]).order_by("-dt")
    paginator = Paginator(objects, page_size)
    page = request.GET.get("page")
    logs = paginator.get_page(page)

    counter_query = ProgressCounter.objects.filter(user=request.user, year=year)
    counter = None
    if counter_query.exists():
        counter = counter_query.get()

    return render(request, "orgapy/progress.html", {
        "logs": logs,
        "year": year,
        "paginator": pretty_paginator(logs),
        "counter": counter,
        "dt_filter": dt_filter,
        "dt_start": dt_start,
        "dt_end": dt_end,
    })


@permission_required("orgapy.change_progress")
def view_progress_compute(request: HttpRequest, year: int | str | None = None) -> HttpResponse:
    if year is None:
        year = datetime.datetime.now().year
    else:
        year = int(year)
    counter_query = ProgressCounter.objects.filter(user=request.user, year=year)
    if not counter_query.exists():
        raise Http404()
    counter = counter_query.get()
    counter.recompute()
    return redirect("orgapy:progress_year", year=counter.year)


@permission_required("orgapy.add_progress_log")
def view_create_progress_log(request: HttpRequest) -> HttpResponse:
    return render(request, "orgapy/create_progress_log.html", {})


@permission_required("orgapy.change_progress_log")
def view_edit_progress_log(request: HttpRequest, object_id: str) -> HttpResponse:
    log = find_object(ProgressLog, "id", object_id, request.user)
    return render(request, "orgapy/edit_progress_log.html", {
        "log": log,
    })


@permission_required("orgapy.delete_progress_log")
def view_delete_progress_log(request: HttpRequest, object_id: str) -> HttpResponse:
    log = find_object(ProgressLog, "id", object_id, request.user)
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
    settings = get_or_create_settings(request.user)
    if request.method == "POST":
        settings.objective_start_hours = int(request.POST.get("objective_start_hours", 0))
        settings.calendar_lookahead = int(request.POST.get("calendar_lookahead", 3))
        settings.beach_mode = bool(request.POST.get("beach_mode", False))
        settings.save()
        if "ref" in request.POST and request.POST["ref"]:
            return redirect(request.POST["ref"])
    calendars = Calendar.objects.filter(user=request.user).order_by("calendar_name")
    return render(request, "orgapy/settings.html", {
        "settings": settings,
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
