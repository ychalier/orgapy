import json
import datetime
import urllib

import dateutil.relativedelta
from django.utils import timezone
from django.contrib.auth.decorators import login_required, permission_required
from django.shortcuts import redirect
from django.shortcuts import render
from django.utils.text import slugify
from django.core.paginator import Paginator
from django.db.models import Q
from django.db.models import F
from django.db.models import Max
from django.http import HttpResponse, Http404, JsonResponse
from django.core.exceptions import PermissionDenied, BadRequest

from . import models


# ----------------------------------------------- #
# UTILITIES                                       #
# ----------------------------------------------- #


def pretty_paginator(page, **attrs):
    to_show = sorted({
        1,
        max(1, page.number - 1),
        page.number,
        min(page.number + 1, page.paginator.num_pages),
        page.paginator.num_pages,
    })
    attr_string = urllib.parse.urlencode(attrs)
    if attr_string != "":
        attr_string = "&" + attr_string
    paginator = {
        "prev": None,
        "next": None,
        "pages": list(),
        "active": page.number,
        "attr_string": attr_string,
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


def get_note_from_nid(nid, required_user=None):
    if not models.Note.objects.filter(id=nid).exists():
        raise Http404("Note does not exist")
    note = models.Note.objects.get(id=nid)
    if required_user is not None and note.user != required_user:
        raise PermissionDenied
    return note


def save_note_core(request):
    """Edit note procedure: Note object"""
    original_note = None
    if ("id" in request.POST
            and models.Note.objects.filter(id=request.POST["id"]).exists()):
        original_note = models.Note.objects.get(id=request.POST["id"])
    if original_note is not None and original_note.user != request.user:
        raise PermissionDenied
    title = request.POST.get("title", "").strip()
    content = request.POST.get("content", "").strip()
    is_public = "public" in request.POST
    is_pinned = "pinned" in request.POST
    if original_note is None:
        note = models.Note.objects.create(
            user=request.user,
            title=title,
            content=content,
            public=is_public,
            pinned=is_pinned
        )
    else:
        note = original_note
        note.title = title
        note.content = content
        note.public = is_public
        note.pinned = is_pinned
        note.categories.clear()
    note.date_modification = timezone.now()
    note.save()
    return note


def save_note_categories(request, note):
    """Edit note procedure: Category objects"""
    name_list = request.POST.get("categories", "").split(";") + request.POST.get("extra", "").split(";")
    for dirty_name in name_list:
        name = dirty_name.lower().strip()
        if name == "":
            continue
        if not models.Category.objects.filter(name=name, user=request.user).exists():
            category = models.Category.objects.create(name=name, user=request.user)
        else:
            category = models.Category.objects.get(name=name, user=request.user)
        note.categories.add(category)
    note.save()


def add_quote(request, work_id, content):
    work = models.Work.objects.get(id=work_id)
    title = "%s - %s" % (work.author.name, work.title)
    quote = models.Quote.objects.create(
        user=request.user,
        from_work=work,
        title=title,
        content=content,
    )
    return quote


def parse_dt(date_string, time_string):
    dt_date = datetime.datetime.strptime(date_string, "%Y-%m-%d").date()
    dt_time = datetime.datetime.strptime(time_string, "%H:%M").time()
    return datetime.datetime.combine(dt_date, dt_time)


def parse_date(date_string):
    return datetime.datetime.strptime(date_string, "%Y-%m-%d").date()


def get_sheet_from_sid(sid, required_user=None):
    if not models.Sheet.objects.filter(id=sid).exists():
        raise Http404("Sheet does not exist")
    sheet = models.Sheet.objects.get(id=sid)
    if required_user is not None and sheet.user != required_user:
        raise PermissionDenied
    return sheet


def save_sheet_core(request):
    original_sheet = None
    if ("id" in request.POST
            and models.Sheet.objects.filter(id=request.POST["id"]).exists()):
        original_sheet = models.Sheet.objects.get(id=request.POST["id"])
    if original_sheet is not None and original_sheet.user != request.user:
        raise PermissionDenied
    title = request.POST.get("title", "").strip()
    description = request.POST.get("content", "").strip()
    is_public = "public" in request.POST
    group_id = request.POST.get("group", "")
    group = None
    if group_id != "":
        group = models.SheetGroup.objects.get(user=request.user, id=int(group_id))
    if original_sheet is None:
        sheet = models.Sheet.objects.create(
            user=request.user,
            title=title,
            description=description,
            public=is_public,
            group=group,
        )
    else:
        sheet = original_sheet
        sheet.title = title
        sheet.description = description
        sheet.public = is_public
        sheet.group = group
    sheet.date_modification = timezone.now()
    sheet.save()
    return sheet


def get_map_from_mid(mid, required_user=None):
    if not models.Map.objects.filter(id=mid).exists():
        raise Http404("Sheet does not exist")
    mmap = models.Map.objects.get(id=mid)
    if required_user is not None and mmap.user != required_user:
        raise PermissionDenied
    return mmap


def save_map_core(request):
    original_map = None
    if ("id" in request.POST
            and models.Map.objects.filter(id=request.POST["id"]).exists()):
        original_map = models.Map.objects.get(id=request.POST["id"])
    if original_map is not None and original_map.user != request.user:
        raise PermissionDenied
    title = request.POST.get("title", "").strip()
    is_public = "public" in request.POST
    if original_map is None:
        mmap = models.Map.objects.create(
            user=request.user,
            title=title,
            public=is_public,
        )
    else:
        mmap = original_map
        mmap.title = title
        mmap.public = is_public
    mmap.date_modification = timezone.now()
    mmap.save()
    return mmap


# ----------------------------------------------- #
# VIEWS                                           #
# ----------------------------------------------- #


def view_landing(request):
    if request.user.is_authenticated:
        return redirect("orgapy:projects")
    return redirect("orgapy:about")


def view_about(request):
    """View for the homepage, describing the application for a new user."""
    return render(request, "orgapy/about.html", {})


@permission_required("orgapy.view_project")
def view_projects(request):
    return render(request, "orgapy/projects.html", {
        "active": "projects"
    })


@permission_required("orgapy.view_note")
def view_notes(request):
    page_size = 25
    query = request.GET.get("query", "")
    category = request.GET.get("category", "")    
    if len(query) > 0 and query[0] == "#":
        category = query[1:]
    base_objects = models.Note.objects.filter(user=request.user)
    if "uncategorized" in request.GET:
        base_objects = base_objects.filter(categories__isnull=True)
    if len(category) > 0:
        objects = base_objects.filter(categories__name__exact=category)
    elif len(query) > 0:
        objects = base_objects.filter(Q(title__contains=query) | Q(content__contains=query))
    else:
        objects = base_objects
    if len(objects) == 1 and models.Note.objects.count() > 1:
        return redirect("orgapy:note", nid=objects[0].id)
    paginator = Paginator(objects.order_by(
        "-pinned",
        "-date_modification",
        "-date_access",
    ), page_size)
    page = request.GET.get("page")
    notes = paginator.get_page(page)
    return render(request, "orgapy/notes.html", {
        "notes": notes,
        "query": query,
        "category": category,
        "note_paginator": pretty_paginator(notes, query=query),
        "active": "notes",
        "categories": models.Category.objects.all().order_by("name"),
    })


@permission_required("orgapy.add_note")
def view_create_note(request):
    categories = models.Category.objects.filter(user=request.user)
    return render(request, "orgapy/create_note.html", {
        "categories": categories,
        "note_category_ids": {},
        "active": "notes",
    })


@permission_required("orgapy.change_note")
def view_save_note(request):
    if request.method == "POST":
        note = save_note_core(request)
        save_note_categories(request, note)
        return redirect("orgapy:note", nid=note.id)
    raise BadRequest


@permission_required("orgapy.view_category")
def view_categories(request):
    return render(request, "orgapy/categories.html", {
        "categories": models.Category.objects.filter(user=request.user),
        "uncategorized": models.Note.objects.filter(user=request.user, categories__isnull=True).count(),
        "active": "notes",
    })


@permission_required("orgapy.change_category")
def view_edit_category(request, cid):
    query = models.Category.objects.filter(id=cid)
    if query.exists():
        category = query.get()
        if category.user == request.user:
            if request.method == "POST":
                new_name = request.POST.get("name")
                if len(new_name) > 0:
                    category.name = new_name.lower()
                    category.save()
            return render(request, "orgapy/edit_category.html", {
                "category": category
            })
    return redirect("orgapy:categories")


@permission_required("orgapy.delete_category")
def view_delete_category(request, cid):
    query = models.Category.objects.filter(id=cid)
    if query.exists():
        category = query.get()
        if category.user == request.user:
            category.delete()
    return redirect("orgapy:categories")


def view_note(request, nid):
    note = get_note_from_nid(nid)
    if request.user is not None and note.user == request.user and request.user.has_perm("orgapy.view_note"):
        return render(request, "orgapy/note.html", { "note": note, "active": "notes" })
    elif note.public:
        return render(request, "orgapy/note_public.html", { "note": note, "active": "notes" })
    raise PermissionDenied


@permission_required("orgapy.change_note")
def view_edit_note(request, nid):
    note = get_note_from_nid(nid, request.user)
    categories = models.Category.objects.filter(user=request.user).order_by("name")
    note_category_ids = [category.id for category in note.categories.all()]
    return render(request, "orgapy/edit_note.html", {
        "note": note,
        "categories": categories,
        "note_category_ids": note_category_ids,
        "active": "notes",
    })


@permission_required("orgapy.view_note")
def view_export_note(request, nid):
    """View to export a note's content as Markdown"""
    note = get_note_from_nid(nid, request.user)
    markdown = note.title + "\n\n" + note.content
    response = HttpResponse(content=markdown, content_type="text/markdown")
    response["Content-Disposition"] = "inline; filename=\"{}.md\"".format(slugify(note.title))
    return response


@permission_required("orgapy.delete_note")
def view_delete_note(request, nid):
    """View to delete a note"""
    note = get_note_from_nid(nid, request.user)
    note.delete()
    return redirect("orgapy:notes")


@permission_required("orgapy.change_note")
def view_toggle_note_pin(request, nid):
    note = get_note_from_nid(nid, request.user)
    note.pinned = not note.pinned
    note.save()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect("orgapy:notes")


@permission_required("orgapy.change_note")
def view_toggle_note_public(request, nid):
    note = get_note_from_nid(nid, request.user)
    note.public = not note.public
    note.save()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect("orgapy:notes")


@permission_required("orgapy.view_quote")
def view_quotes(request, author=None, work=None):
    page_size = 10
    query = request.GET.get("query", "")
    objects = models.Quote.objects.filter(user=request.user)
    if author is not None:
        author = models.Author.objects.get(slug=author, user=request.user)
        objects = objects.filter(from_work__author=author)
    if work is not None:
        work = models.Work.objects.get(slug=work, user=request.user)
        objects = objects.filter(from_work=work)
    if len(query) > 0:
        objects = objects.filter(Q(title__contains=query) | Q(content__contains=query))
    paginator = Paginator(objects.order_by(
        "-date_creation",
    ), page_size)
    page = request.GET.get("page")
    quotes = paginator.get_page(page)
    authors = models.Author.objects.filter(user=request.user).order_by("name")
    return render(request, "orgapy/quotes.html", {
        "quotes": quotes,
        "query": query,
        "authors": authors,
        "author": author,
        "work": work,
        "quote_paginator": pretty_paginator(quotes, query=query),
        "active": "quotes",
    })


@permission_required("orgapy.add_quote")
def view_create_quote(request):
    if request.method == "POST":
        if "form_author" in request.POST:
            name = request.POST.get("author_name", "").strip()
            if len(name) > 0 and not models.Author.objects.filter(name=name, user=request.user).exists():
                models.Author.objects.create(name=name, user=request.user)
        elif "form_work" in request.POST:
            author_id = request.POST.get("work_author", "").strip()
            title = request.POST.get("work_title", "").strip()
            if len(title) > 0 and models.Author.objects.filter(id=author_id).exists():
                author = models.Author.objects.get(id=author_id, user=request.user)
                if not models.Work.objects.filter(author=author, title=title, user=request.user).exists():
                    models.Work.objects.create(author=author, title=title, user=request.user)
        elif "form_quote" or "form_quote_edit" in request.POST:
            work_id = request.POST.get("quote_work", "").strip()
            if models.Work.objects.filter(id=work_id, user=request.user).exists():
                add_quote(request, work_id, request.POST.get("quote_content").strip())
        if "form_quote" in request.POST:
            return redirect("orgapy:quotes")
    authors = models.Author.objects.filter(user=request.user).order_by("-date_creation")
    works = models.Work.objects.filter(user=request.user).order_by("-date_creation")
    return render(request, "orgapy/create_quote.html", {
        "authors": authors,
        "works": works,
        "active": "quotes",
    })


@permission_required("orgapy.view_sheet")
def view_sheets(request):
    query = request.GET.get("query", "")
    groups = None
    standalone_sheets = None
    if query:
        standalone_sheets = models.Sheet.objects.filter(user=request.user).filter(Q(title__contains=query) | Q(description__contains=query))
    else:
        groups = models.SheetGroup.objects.filter(user=request.user)
        standalone_sheets = models.Sheet.objects.filter(user=request.user, group__isnull=True)
    return render(request, "orgapy/sheets.html", {
        "groups": groups,
        "standalone_sheets": standalone_sheets,
        "query": query,
        "active": "sheets",
    })


@permission_required("orgapy.add_sheet")
def view_create_sheet(request):
    sheet_groups = models.SheetGroup.objects.filter(user=request.user)
    return render(request, "orgapy/create_sheet.html", {
        "active": "sheets",
        "sheet_groups": sheet_groups,
    })


@permission_required("orgapy.change_sheet")
def view_save_sheet(request):
    if request.method == "POST":
        sheet = save_sheet_core(request)
        return redirect("orgapy:sheet", sid=sheet.id)
    raise PermissionDenied


@permission_required("orgapy.add_sheetgroup")
def view_create_sheet_group(request):
    if "title" not in request.POST:
        raise BadRequest
    title = request.POST.get("title")
    models.SheetGroup.objects.create(user=request.user, title=title)
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect("orgapy:sheets")


@permission_required("orgapy.change_sheetgroup")
def view_save_sheet_group(request):
    sid = request.POST.get("id", "")
    if not sid:
        raise BadRequest
    if not models.SheetGroup.objects.filter(user=request.user, id=int(sid)).exists():
        raise Http404("Group not found")
    group = models.SheetGroup.objects.filter(user=request.user, id=int(sid)).get()
    title = request.POST.get("title", "")
    if not title:
        raise BadRequest
    group.title = title
    group.save()
    return redirect("orgapy:sheet_group", sid=group.id)


@permission_required("orgapy.view_sheetgroup")
def view_sheet_group(request, sid):
    if not models.SheetGroup.objects.filter(user=request.user, id=int(sid)).exists():
        raise Http404("Group not found")
    group = models.SheetGroup.objects.filter(user=request.user, id=int(sid)).get()
    return render(request, "orgapy/sheet_group.html", {
        "group": group,
        "active": "sheets",
    })


@permission_required("orgapy.change_sheetgroup")
def view_edit_sheet_group(request, sid):
    if not models.SheetGroup.objects.filter(user=request.user, id=int(sid)).exists():
        raise Http404("Group not found")
    group = models.SheetGroup.objects.filter(user=request.user, id=int(sid)).get()
    return render(request, "orgapy/edit_sheet_group.html", {
        "group": group,
        "active": "sheets",
    })


@permission_required("orgapy.delete_sheetgroup")
def view_delete_sheet_group(request, sid):
    if not models.SheetGroup.objects.filter(user=request.user, id=int(sid)).exists():
        raise Http404("Group not found")
    group = models.SheetGroup.objects.filter(user=request.user, id=int(sid)).get()
    group.delete()
    return redirect("orgapy:sheets")


def view_sheet(request, sid):
    sheet = get_sheet_from_sid(sid)
    if request.user is not None and sheet.user == request.user and request.user.has_perm("orgapy.view_sheet"):
        return render(request, "orgapy/sheet.html", { "sheet": sheet, "active": "sheets" })
    elif sheet.public:
        return render(request, "orgapy/sheet_public.html", { "sheet": sheet, "active": "sheets" })
    raise PermissionDenied


@permission_required("orgapy.change_sheet")
def view_edit_sheet(request, sid):
    sheet = get_sheet_from_sid(sid)
    sheet_groups = models.SheetGroup.objects.filter(user=request.user)
    return render(request, "orgapy/edit_sheet.html", {
        "sheet": sheet,
        "active": "sheets",
        "sheet_groups": sheet_groups,
    })


@permission_required("orgapy.view_sheet")
def view_export_sheet(request, sid):
    sheet = get_sheet_from_sid(sid)
    if request.user is not None and sheet.user == request.user and request.user.has_perm("orgapy.view_sheet") or sheet.public:
        response = HttpResponse(sheet.data, content_type="text/tab-separated-values")
        response['Content-Disposition'] = f'attachment; filename="{sheet.title}.tsv"'
        return response
    raise PermissionDenied


@permission_required("orgapy.delete_sheet")
def view_delete_sheet(request, sid):
    sheet = get_sheet_from_sid(sid, request.user)
    sheet.delete()
    return redirect("orgapy:sheets")


@permission_required("orgapy.change_sheet")
def view_toggle_sheet_public(request, sid):
    sheet = get_sheet_from_sid(sid, request.user)
    sheet.public = not sheet.public
    sheet.save()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect("orgapy:sheets")


@permission_required("orgapy.view_map")
def view_maps(request):
    query = request.GET.get("query", "")
    if query:
        maps = models.Map.objects.filter(user=request.user).filter(title__contains=query)
    else:
        maps = models.Map.objects.filter(user=request.user)
    return render(request, "orgapy/maps.html", {
        "maps": maps,
        "query": query,
        "active": "maps",
    })


@permission_required("orgapy.add_map")
def view_create_map(request):
    return render(request, "orgapy/create_map.html", {
        "active": "maps",
    })


@permission_required("orgapy.change_map")
def view_save_map(request):
    if request.method == "POST":
        mmap = save_map_core(request)
        return redirect("orgapy:map", mid=mmap.id)
    raise PermissionDenied


def view_map(request, mid):
    mmap = get_map_from_mid(mid)
    if request.user is not None and mmap.user == request.user and request.user.has_perm("orgapy.view_map"):
        return render(request, "orgapy/map.html", { "map": mmap, "active": "maps" })
    elif mmap.public:
        return render(request, "orgapy/map_public.html", { "map": mmap, "active": "maps" })
    raise PermissionDenied


@permission_required("orgapy.view_map")
def view_export_map(request, mid):
    mmap = get_map_from_mid(mid)
    if request.user is not None and mmap.user == request.user and request.user.has_perm("orgapy.view_map") or mmap.public:
        response = HttpResponse(mmap.geojson, content_type="application/geo+json")
        response['Content-Disposition'] = f'attachment; filename="{mmap.title}.geojson"'
        return response
    raise PermissionDenied


@permission_required("orgapy.delete_map")
def view_delete_map(request, mid):
    mmap = get_map_from_mid(mid, request.user)
    mmap.delete()
    return redirect("orgapy:maps")


@permission_required("orgapy.change_map")
def view_toggle_map_public(request, mid):
    mmap = get_map_from_mid(mid, request.user)
    mmap.public = not mmap.public
    mmap.save()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect("orgapy:maps")


# ----------------------------------------------- #
# API                                             #
# ----------------------------------------------- #


def api(request):
    action = request.GET.get("action")
    match action:
        case "list-projects":
            return api_list_projects(request)
        case "create-project":
            return api_create_project(request)
        case "edit-project":
            return api_edit_project(request)
        case "edit-project-ranks":
            return api_edit_project_ranks(request)
        case "delete-project":
            return api_delete_project(request)
        case "list-objectives":
            return api_list_objectives(request)
        case "add-objective":
            return api_add_objective(request)
        case "edit-objective":
            return api_edit_objective(request)
        case "edit-objective-history":
            return api_edit_objective_history(request)
        case "delete-objective":
            return api_delete_objective(request)
        case "list-calendars":
            return api_list_calendars(request)
        case "delete-calendar":
            return api_delete_calendar(request)
        case "add-event":
            return api_add_event(request)
        case "list-tasks":
            return api_list_tasks(request)
        case "add-task":
            return api_add_task(request)
        case "edit-task":
            return api_edit_task(request)
        case "delete-task":
            return api_delete_task(request)
        case "complete-task":
            return api_complete_task(request)
        case "note-title":
            return api_note_title(request)
        case "note-suggestions":
            return api_notes_suggestions(request)
        case "sheet":
            return api_sheet(request)
        case "save-sheet":
            return api_save_sheet(request)
        case "map":
            return api_map(request)
        case "save-map":
            return api_save_map(request)
        case _:
            raise BadRequest("Wrong action")


@permission_required("orgapy.view_project")
def api_list_projects(request):
    projects = []
    for project in models.Project.objects.filter(user=request.user):
        progress = None
        if project.progress_min is not None and project.progress_max is not None and project.progress_current is not None:
            progress = {
                "min": project.progress_min,
                "max": project.progress_max,
                "current": project.progress_current,
            }
        projects.append({
            "id": project.id,
            "creation": project.date_creation.timestamp(),
            "modification": project.date_modification.timestamp(),
            "title": project.title,
            "category": project.category,
            "limit_date": project.limit_date,
            "progress": progress,
            "description": project.description if project.description else None,
            "checklist": project.checklist if project.checklist else None,
            "rank": project.rank,
            "note": None if project.note is None else project.note.id
        })
    return JsonResponse({"projects": projects})


@permission_required("orgapy.add_project")
def api_create_project(request):
    if request.method != "POST":
        raise BadRequest("Wrong method")
    max_rank = models.Project.objects.filter(user=request.user).aggregate(Max("rank"))["rank__max"]
    if max_rank is None:
        max_rank = 1
    project = models.Project.objects.create(
        user=request.user,
        title="New Project",
        category="general",
        rank=int(max_rank) + 1
    )
    return JsonResponse({"success": True, "project": {
        "id": project.id,
        "title": project.title,
        "category": project.category,
        "limit_date": None,
        "progress": None,
        "description": None,
        "checklist": None,
        "creation": project.date_creation.timestamp(),
        "modification": project.date_modification.timestamp(),
        "rank": project.rank,
        "note": None,
    }})


@permission_required("orgapy.change_project")
def api_edit_project(request):
    if request.method != "POST":
        raise BadRequest("Wrong method")
    project_id = request.POST.get("project_id")
    project_data = request.POST.get("project_data")
    if project_id is None or project_data is None:
        raise BadRequest("Missing fields")
    try:
        project_id = int(project_id)
        project_data = json.loads(project_data)
    except:
        raise BadRequest("Invalid values")
    if not models.Project.objects.filter(id=project_id, user=request.user).exists():
        raise Http404("Project not found")
    project = models.Project.objects.get(id=project_id, user=request.user)
    project.title = project_data["title"]
    project.category = project_data["category"]
    project.rank = float(project_data["rank"])
    if project_data["limit_date"] is not None:
        project.limit_date = datetime.datetime.strptime(project_data["limit_date"], "%Y-%m-%d").date()
    else:
        project.limit_date = None
    if project_data["progress"] is not None:
        project.progress_min = project_data["progress"]["min"]
        project.progress_max = project_data["progress"]["max"]
        project.progress_current = project_data["progress"]["current"]
    else:
        project.progress_min = None
        project.progress_max = None
        project.progress_current = None
    if project_data["description"] is not None:
        project.description = project_data["description"]
    else:
        project.description = None
    if project_data["checklist"] is not None:
        project.checklist = project_data["checklist"]
    else:
        project.checklist = None
    if project_data["note"] is not None and models.Note.objects.filter(user=request.user, id=int(project_data["note"])).exists():
        project.note = models.Note.objects.get(user=request.user, id=int(project_data["note"]))
    else:
        project.note = None
    project.save()
    return JsonResponse({"success": True})


@permission_required("orgapy.change_project")
def api_edit_project_ranks(request):
    if request.method != "POST":
        raise BadRequest("Wrong method")
    ranks_data = request.POST.get("ranks")
    if ranks_data is None:
        raise BadRequest("Missing fields")
    try:
        ranks_data = json.loads(ranks_data)
    except:
        raise BadRequest("Invalid values")
    projects, ranks = [], []
    for project_id, rank in ranks_data.items():
        if not models.Project.objects.filter(id=int(project_id), user=request.user).exists():
            raise Http404("Project not found")
        project = models.Project.objects.get(id=int(project_id), user=request.user)
        projects.append(project)
        ranks.append(float(rank))
    for project, rank in zip(projects, ranks):
        project.rank = rank
        project.save()
    return JsonResponse({"success": True})


@permission_required("orgapy.delete_project")
def api_delete_project(request):
    if request.method != "POST":
        raise BadRequest("Wrong method")
    project_id = request.POST.get("project_id")
    if project_id is None:
        raise BadRequest("Missing field")
    try:
        project_id = int(project_id)
    except:
        raise BadRequest("Invalid value")
    if not models.Project.objects.filter(id=project_id, user=request.user).exists():
        raise Http404("Project not found")
    project = models.Project.objects.get(id=project_id, user=request.user)
    project.delete()
    return JsonResponse({"success": True})


@permission_required("orgapy.view_objective")
def api_list_objectives(request):
    objectives = []
    for objective in models.Objective.objects.filter(user=request.user, archived=False):
        objectives.append(objective.to_dict())
    return JsonResponse({"objectives": objectives})


@permission_required("orgapy.add_objective")
def api_add_objective(request):
    if request.method != "POST":
        raise BadRequest("Wrong method")
    objective_name = request.POST.get("name")
    objective_type = request.POST.get("type")
    objective_period = request.POST.get("period")
    objective_cooldown = request.POST.get("cooldown")
    if objective_name is None or objective_type is None or objective_period is None or objective_cooldown is None:
        raise BadRequest("Missing fields")
    try:
        objective_period = float(objective_period)
        objective_cooldown = float(objective_cooldown)
    except:
        raise BadRequest("Invalid values")
    models.Objective.objects.create(
        user=request.user,
        name=objective_name,
        rules = '{"type": "%s", "period": %f, "cooldown": %f}' % (
            objective_type, objective_period, objective_cooldown)
        )
    return JsonResponse({"success": True})


@permission_required("orgapy.change_objective")
def api_edit_objective(request):
    if request.method != "POST":
        raise BadRequest("Wrong method")
    print(request.POST)
    if "delete" in request.POST:
        return api_delete_objective(request)
    objective_id = request.POST.get("id")
    objective_name = request.POST.get("name")
    objective_type = request.POST.get("type")
    objective_period = request.POST.get("period")
    objective_cooldown = request.POST.get("cooldown")
    if objective_id is None or objective_name is None or objective_type is None or objective_period is None or objective_cooldown is None:
        raise BadRequest("Missing fields")
    try:
        objective_id = int(objective_id)
        objective_period = float(objective_period)
        objective_cooldown = float(objective_cooldown)
    except:
        raise BadRequest("Invalid values")
    if not models.Objective.objects.filter(id=objective_id, user=request.user).exists():
        raise Http404("Objective not found")
    objective = models.Objective.objects.get(id=objective_id, user=request.user)
    objective.name = objective_name
    objective.rules = '{"type": "%s", "period": %f, "cooldown": %f}' % (
        objective_type, objective_period, objective_cooldown)
    objective.save()
    return JsonResponse({"success": True})


@permission_required("orgapy.delete_objective")
def api_delete_objective(request):
    if request.method != "POST":
        raise BadRequest("Wrong method")
    objective_id = request.POST.get("id")
    if objective_id is None:
        raise BadRequest("Missing fields")
    try:
        objective_id = int(objective_id)
    except:
        raise BadRequest("Invalid values")
    if not models.Objective.objects.filter(id=objective_id, user=request.user).exists():
        raise Http404("Objective not found")
    models.Objective.objects.get(id=objective_id, user=request.user).delete()
    return JsonResponse({"success": True})


@permission_required("orgapy.change_objective")
def api_edit_objective_history(request):
    """Objective history must be a JSON string
    """
    if request.method != "POST":
        raise BadRequest("Wrong method")
    objective_id = request.POST.get("objective_id")
    objective_history = request.POST.get("objective_history")
    if objective_id is None or objective_history is None:
        raise BadRequest("Missing fields")
    try:
        objective_id = int(objective_id)
    except:
        raise BadRequest("Invalid values")
    if not models.Objective.objects.filter(id=objective_id, user=request.user).exists():
        raise Http404("Project not found")
    objective = models.Objective.objects.get(id=objective_id, user=request.user)
    objective.history = objective_history
    objective.save()
    return JsonResponse({"success": True})


@permission_required("orgapy.view_calendar")
def api_list_calendars(request):
    events = []
    calendars = []
    for calendar in models.Calendar.objects.filter(user=request.user):
        eventsd = calendar.get_events(force="force" in request.GET)
        for event in eventsd:
            event["calendar_id"] = calendar.id
            events.append(event)
        calendars.append({
            "name": calendar.calendar_name,
            "id": calendar.id,
        })
    return JsonResponse({
        "calendars": calendars,
        "events": events,
        "last_sync": calendar.last_sync if calendar else None
    })


@permission_required("orgapy.change_calendar")
def api_delete_calendar(request):
    if request.method != "POST":
        raise BadRequest("Wrong method")
    href = request.POST.get("href")
    calendarid = request.POST.get("calendarid")
    if href is None or calendarid is None:
        raise BadRequest("Missing fields")
    if not models.Calendar.objects.filter(user=request.user, id=int(calendarid)).exists():
        raise Http404("No calendar found for user")
    calendar = models.Calendar.objects.get(user=request.user, id=int(calendarid))
    success = calendar.delete_event(href)
    return JsonResponse({"success": success})


@permission_required("orgapy.change_calendar")
def api_add_event(request):
    if request.method != "POST":
        raise BadRequest("Wrong method")
    calendarid = request.POST.get("calendarid")
    title = request.POST.get("title")
    dtstart_date = request.POST.get("dtstart-date")
    dtstart_time = request.POST.get("dtstart-time")
    dtend_date = request.POST.get("dtend-date")
    dtend_time = request.POST.get("dtend-time")
    location = request.POST.get("location")
    allday = "allday" in request.POST
    if allday:
        dtstart_time = "00:00"
        dtend_time = "00:00"
    if title is None or dtstart_date is None or dtstart_time is None or dtend_date is None or dtend_time is None or calendarid is None:
        raise BadRequest("Missing fields")
    if not models.Calendar.objects.filter(user=request.user, id=int(calendarid)).exists():
        raise Http404("No calendar found for user")
    if location.strip() == "":
        location = None
    dtstart = parse_dt(dtstart_date, dtstart_time)
    dtend = parse_dt(dtend_date, dtend_time)
    calendar = models.Calendar.objects.get(user=request.user, id=int(calendarid))
    success = calendar.add_event(title, dtstart, dtend, location, allday)
    return JsonResponse({"success": success})


@permission_required("orgapy.view_task")
def api_list_tasks(request):
    tasks = []
    limit = int(request.GET.get("limit", 5))
    max_start_date = timezone.now() + datetime.timedelta(days=limit)
    for task in models.Task.objects.filter(user=request.user, completed=False, start_date__lte=max_start_date):
        tasks.append({
            "id": task.id,
            "title": task.title,
            "start_date": task.start_date.isoformat(),
            "due_date": task.due_date.isoformat() if task.due_date is not None else None,
            "recurring_mode": task.recurring_mode,
            "recurring_period": task.recurring_period,
        })
    tasks.sort(key=lambda x: x["due_date"] if x.get("due_date") is not None else "")
    return JsonResponse({"tasks": tasks})


@permission_required("orgapy.edit_task")
def api_edit_task(request):
    if request.method != "POST":
        raise BadRequest("Wrong method")
    task_id = request.POST.get("id")
    task_title = request.POST.get("title")
    task_start_date = request.POST.get("start_date")
    task_due_date = request.POST.get("due_date")
    if task_due_date.strip() == "":
        task_due_date = None
    task_recurring_mode = request.POST.get("recurring_mode")
    task_recurring_period = request.POST.get("recurring_period")
    if None in [task_id, task_title, task_start_date, task_recurring_mode, task_recurring_period]:
        raise BadRequest("Missing fields")
    try:
        task_id = int(task_id)
        task_start_date = parse_date(task_start_date)
        if task_due_date is not None:
            task_due_date = parse_date(task_due_date)
        task_recurring_period = None if task_recurring_period.strip() == "" else int(task_recurring_period)
    except:
        raise BadRequest("Invalid values")
    if not models.Task.objects.filter(id=task_id, user=request.user).exists():
        raise Http404("Task not found")
    task = models.Task.objects.get(id=task_id, user=request.user)
    task.title = task_title
    task.start_date = task_start_date
    task.due_date = task_due_date
    task.recurring_mode = task_recurring_mode
    task.recurring_period = task_recurring_period
    task.save()
    return JsonResponse({"success": True})


@permission_required("orgapy.add_task")
def api_add_task(request):
    if request.method != "POST":
        raise BadRequest("Wrong method")
    task_title = request.POST.get("title")
    task_start_date = request.POST.get("start_date")
    task_due_date = request.POST.get("due_date")
    if task_due_date.strip() == "":
        task_due_date = None
    task_recurring_mode = request.POST.get("recurring_mode")
    task_recurring_period = request.POST.get("recurring_period")
    if None in [task_title, task_start_date, task_recurring_mode, task_recurring_period]:
        raise BadRequest("Missing fields")
    try:
        task_start_date = parse_date(task_start_date)
        if task_due_date is not None:
            task_due_date = parse_date(task_due_date)
        task_recurring_period = None if task_recurring_period.strip() == "" else int(task_recurring_period)
    except:
        raise BadRequest("Invalid values")
    models.Task.objects.create(
        user=request.user,
        title=task_title,
        start_date=task_start_date,
        due_date=task_due_date,
        recurring_mode=task_recurring_mode,
        recurring_period=task_recurring_period,
    )
    return JsonResponse({"success": True})


@permission_required("orgapy.delete_task")
def api_delete_task(request):
    if request.method != "POST":
        raise BadRequest("Wrong method")
    task_id = request.POST.get("id")
    if task_id is None:
        raise BadRequest("Missing fields")
    try:
        task_id = int(task_id)
    except:
        raise BadRequest("Invalid values")
    if not models.Task.objects.filter(id=task_id, user=request.user).exists():
        raise Http404("Task not found")
    models.Task.objects.get(id=task_id, user=request.user).delete()
    return JsonResponse({"success": True})


@permission_required("orgapy.edit_task")
def api_complete_task(request):
    if request.method != "POST":
        raise BadRequest("Wrong method")
    task_id = request.POST.get("id")
    if task_id is None:
        raise BadRequest("Missing fields")
    try:
        task_id = int(task_id)
    except:
        raise BadRequest("Invalid values")
    if not models.Task.objects.filter(id=task_id, user=request.user).exists():
        raise Http404("Task not found")
    task = models.Task.objects.get(id=task_id, user=request.user)
    task.completed = True
    task.date_completion = timezone.now()
    task.save()
    if task.recurring_mode != models.Task.ONCE:
        due_date = None
        if task.recurring_mode == models.Task.DAILY:
            start_date = task.start_date + datetime.timedelta(days=task.recurring_period)
            if task.due_date is not None:
                due_date = task.due_date + datetime.timedelta(days=task.recurring_period)
        elif task.recurring_mode == models.Task.WEEKLY:
            start_date = task.start_date + datetime.timedelta(weeks=task.recurring_period)
            if task.due_date is not None:
                due_date = task.due_date + datetime.timedelta(weeks=task.recurring_period)
        elif task.recurring_mode == models.Task.MONTHLY:
            start_date = task.start_date + dateutil.relativedelta.relativedelta(months=task.recurring_period)
            if task.due_date is not None:
                due_date = task.due_date + dateutil.relativedelta.relativedelta(months=task.recurring_period)
        elif task.recurring_mode == models.Task.YEARLY:
            start_date = task.start_date + dateutil.relativedelta.relativedelta(years=task.recurring_period)
            if task.due_date is not None:
                due_date = task.due_date + dateutil.relativedelta.relativedelta(years=task.recurring_period)
        models.Task.objects.create(
            user=request.user,
            title=task.title,
            start_date=start_date,
            due_date=due_date,
            recurring_mode=task.recurring_mode,
            recurring_period=task.recurring_period,
            recurring_parent=task if task.recurring_parent is None else task.recurring_parent,
        )
    return JsonResponse({"success": True})


@permission_required("orgapy.view_note")
def api_note_title(request):
    nid = request.GET.get("nid")
    if nid is None:
        raise BadRequest()
    query = models.Note.objects.filter(user=request.user, id=int(nid))
    if not query.exists():
        raise Http404("Not found")
    return HttpResponse(query.get().title, content_type="text/plain")


@permission_required("orgapy.view_note")
def api_notes_suggestions(request):
    query = request.GET.get("q", "").strip()
    results = []
    if len(query) >= 1:
        results = models.Note.objects.filter(user=request.user, title__startswith=query)[:5]
    data = {
        "results": [
            {
                "id": result.id,
                "title": result.title,
                "url": result.get_absolute_url()
            }
            for result in results
        ]
    }
    return JsonResponse(data)


def api_sheet(request):
    sheet_id = request.GET.get("sid")
    sheet = get_sheet_from_sid(int(sheet_id))
    if request.user is not None and sheet.user == request.user and request.user.has_perm("orgapy.view_sheet") or sheet.public:
        return JsonResponse({
            "title": sheet.title,
            "data": sheet.data,
            "config": sheet.config,
            "url": sheet.get_absolute_url(),
        })
    raise PermissionDenied


@permission_required("orgapy.change_sheet")
def api_save_sheet(request):
    sheet_id = request.POST.get("sid")
    sheet_data = request.POST.get("data")
    sheet_config = request.POST.get("config")
    sheet = get_sheet_from_sid(int(sheet_id), request.user)
    sheet.data = sheet_data
    sheet.config = sheet_config
    sheet.date_modification = timezone.now()
    sheet.save()
    return JsonResponse({"success": True})


def api_map(request):
    map_id = request.GET.get("mid")
    mmap = get_map_from_mid(int(map_id))
    if request.user is not None and mmap.user == request.user and request.user.has_perm("orgapy.view_map") or mmap.public:
        return JsonResponse({
            "title": mmap.title,
            "geojson": mmap.geojson,
            "config": mmap.config,
            "url": mmap.get_absolute_url(),
        })
    raise PermissionDenied


@permission_required("orgapy.change_map")
def api_save_map(request):
    map_id = request.POST.get("mid")
    map_title = request.POST.get("title")
    if map_title is None:
        raise BadRequest("Missing title")
    map_geojson = request.POST.get("geojson")
    map_config = request.POST.get("config")
    mmap = get_map_from_mid(int(map_id), request.user)
    mmap.title = map_title
    mmap.geojson = map_geojson
    mmap.config = map_config
    mmap.date_modification = timezone.now()
    mmap.save()
    return JsonResponse({"success": True})
