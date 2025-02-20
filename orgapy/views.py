import json
import datetime
import re
import urllib

import dateutil.relativedelta
from django.utils import timezone
from django.contrib.auth.decorators import permission_required
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils.text import slugify
from django.core.paginator import Paginator
from django.db.models import Q
from django.db.models import Max
from django.db.models import TextField
from django.db.models.functions import Concat
from django.http import HttpResponse, Http404, JsonResponse
from django.core.exceptions import PermissionDenied, BadRequest

from . import models


# ----------------------------------------------- #
# UTILITIES                                       #
# ----------------------------------------------- #


def pretty_paginator(page, **attrs):
    show_around = 2 # +- n
    to_show = sorted({
        1,
        *[
            max(1, min(page.paginator.num_pages, i))
            for i in range(page.number - show_around, page.number + show_around + 1)
        ],
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


def find_object(model, id_or_nonce, required_user=None):
    if isinstance(id_or_nonce, int):
        query = model.objects.filter(id=id_or_nonce)
    else:
        if len(id_or_nonce) == 12:
            query = model.objects.filter(nonce=id_or_nonce)
        else:
            query = model.objects.filter(id=int(id_or_nonce))
    if not query.exists():
        raise Http404("Note does not exist")
    note = query.first()
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
    # NOTE: categories should have been cleared (note.categories.clear())
    # by calling save_note_core
    name_list = request.POST.get("categories", "").split(";") + request.POST.get("extra", "").split(";")
    for dirty_name in name_list:
        name = dirty_name.lower().strip()
        if name == "":
            continue
        int_id = None
        try:
            int_id = int(name)
        except ValueError:
            pass
        if int_id is not None and models.Category.objects.filter(id=int_id, user=request.user).exists():
            category = models.Category.objects.get(id=int_id, user=request.user)
        elif models.Category.objects.filter(name=name, user=request.user).exists():
            category = models.Category.objects.get(name=name, user=request.user)
        else:
            category = models.Category.objects.create(name=name, user=request.user)
        note.categories.add(category)
    note.save()


def add_quote(request, reference, content):
    quote = models.Quote.objects.create(
        user=request.user,
        content=content,
        reference=reference
    )
    return quote


def parse_dt(date_string, time_string):
    dt_date = datetime.datetime.strptime(date_string, "%Y-%m-%d").date()
    dt_time = datetime.datetime.strptime(time_string, "%H:%M").time()
    return datetime.datetime.combine(dt_date, dt_time)


def parse_date(date_string):
    return datetime.datetime.strptime(date_string, "%Y-%m-%d").date()


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


def get_checked_items(checklist: str) -> list[str]:
    return re.findall(r"\[x\] (.*)", checklist)


def compare_checklists(user, title: str, before: str | None, after: str | None):
    if before is None or after is None:
        return
    checked_before = set(get_checked_items(before))
    checked_after = set(get_checked_items(after))
    for item in checked_after.difference(checked_before):
        models.ProgressLog.objects.create(
            user=user,
            type=models.ProgressLog.PROJECT_CHECKLIST_ITEM_CHECKED,
            description=f"{title} - {item}"
        )


def compare_objective_histories(user, name: str, before: str | None, after: str | None):
    if before is None or after is None:
        return
    history_before = json.loads(before)
    history_after = json.loads(after)
    for _ in range(len(history_after) - len(history_before)):
        models.ProgressLog.objects.create(
            user=user,
            type=models.ProgressLog.OBJECTIVE_COMPLETED,
            description=name
        )


def getenv(name):
    match name:
        case "projects":
            return {
                "active": "projects",
                "search_url": reverse("orgapy:search"),
                "suggestions_route": "suggestions",
            }
        case "general":
            return {
                "search_url": reverse("orgapy:search"),
                "suggestions_route": "suggestions",
            }
        case "notes":
            return {
                "active": "notes",
                "search_url": reverse("orgapy:notes"),
                "suggestions_route": "note-suggestions",
            }
        case "quotes":
            return {
                "active": "quotes",
                "search_url": reverse("orgapy:quotes_search"),
            }
        case "sheets":
            return {
                "active": "sheets",
                "search_url": reverse("orgapy:sheets"),
                "suggestions_route": "sheet-suggestions",
            }
        case "maps":
            return {
                "active": "maps",
                "search_url": reverse("orgapy:maps"),
                "suggestions_route": "map-suggestions",
            }
    return {}


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
        **getenv("projects"),
    })


def view_search(request):
    page_size = 24
    query = request.GET.get("query", "")
    if query == "public":
        objects = list(models.Note.objects.filter(user=request.user, public=True))\
            + list(models.Sheet.objects.filter(user=request.user, public=True))\
            + list(models.Map.objects.filter(user=request.user, public=True))
    else:
        objects = list(models.Note.objects.filter(user=request.user).filter(Q(title__contains=query) | Q(content__contains=query)))\
            + list(models.Quote.objects.filter(user=request.user).filter(Q(reference__contains=query) | Q(content__contains=query)))\
            + list(models.Sheet.objects.filter(user=request.user, title__contains=query))\
            + list(models.Map.objects.filter(user=request.user, title__contains=query))
    if len(objects) == 1:
        return redirect(objects[0].get_absolute_url())
    objects.sort(key=lambda o: o.date_creation, reverse=True)
    paginator = Paginator(objects, page_size)
    page = request.GET.get("page")
    objects = paginator.get_page(page)
    return render(request, "orgapy/search.html", {
        "objects": objects,
        "query": query,
        "paginator": pretty_paginator(objects, query=query),
        **getenv("general"),
    })


@permission_required("orgapy.view_note")
def view_notes(request):
    page_size = 24
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
        "categories": models.Category.objects.all().order_by("name"),
        **getenv("notes"),
    })


@permission_required("orgapy.add_note")
def view_create_note(request):
    categories = models.Category.objects.filter(user=request.user)
    return render(request, "orgapy/create_note.html", {
        "categories": categories,
        "note_category_ids": {},
        **getenv("notes"),
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
        **getenv("notes"),
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
                "category": category,
                **getenv("notes"),
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
    note = find_object(models.Note, nid)
    has_permission = False
    readonly = True
    if request.user is not None and note.user == request.user and request.user.has_perm("orgapy.view_note"):
        readonly =  False
        has_permission = True
    elif note.public and isinstance(nid, str) and len(nid) == 12:
        has_permission = True
    if not has_permission:
        raise PermissionDenied
    return render(request, "orgapy/note.html", {
        "note": note,
        "readonly": readonly,
        **getenv("notes"),
    })


@permission_required("orgapy.change_note")
def view_edit_note(request, nid):
    note = find_object(models.Note, nid, request.user)
    categories = models.Category.objects.filter(user=request.user).order_by("name")
    note_category_ids = [category.id for category in note.categories.all()]
    return render(request, "orgapy/edit_note.html", {
        "note": note,
        "categories": categories,
        "note_category_ids": note_category_ids,
        **getenv("notes"),
    })


@permission_required("orgapy.view_note")
def view_export_note(request, nid):
    """View to export a note's content as Markdown"""
    note = find_object(models.Note, nid, request.user)
    markdown = note.title + "\n\n" + note.content
    response = HttpResponse(content=markdown, content_type="text/markdown")
    response["Content-Disposition"] = "inline; filename=\"{}.md\"".format(slugify(note.title))
    return response


@permission_required("orgapy.delete_note")
def view_delete_note(request, nid):
    """View to delete a note"""
    note = find_object(models.Note, nid, request.user)
    note.delete()
    return redirect("orgapy:notes")


@permission_required("orgapy.change_note")
def view_toggle_note_pin(request, nid):
    note = find_object(models.Note, nid, request.user)
    note.pinned = not note.pinned
    note.save()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect("orgapy:notes")


@permission_required("orgapy.change_note")
def view_toggle_note_public(request, nid):
    note = find_object(models.Note, nid, request.user)
    note.public = not note.public
    note.save()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect("orgapy:notes")


@permission_required("orgapy.view_quote")
def view_quotes(request):
    recent_quotes = models.Quote.objects.filter(user=request.user).order_by("-date_creation")[:3]
    random_quotes = models.Quote.objects.filter(user=request.user).exclude(id__in=[q.id for q in recent_quotes]).order_by("?")[:3]
    return render(request, "orgapy/quotes.html", {
        "recent_quotes": recent_quotes,
        "random_quotes": random_quotes,
        **getenv("quotes"),
    })


@permission_required("orgapy.view_quote")
def view_quotes_search(request):
    page_size = 10
    query = request.GET.get("query", "")
    objects = models.Quote.objects.filter(user=request.user)
    if len(query) > 0:
        filters = None
        for token in query.split(" "):
            if filters is None:
                filters = Q(search_text__contains=token)
            else:
                filters &= Q(search_text__contains=token)
        objects = objects.annotate(search_text=Concat("reference", "content", output_field=TextField())).filter(filters)
    paginator = Paginator(objects.order_by(
        "-date_creation",
    ), page_size)
    page = request.GET.get("page")
    quotes = paginator.get_page(page)
    return render(request, "orgapy/quotes_search.html", {
        "quotes": quotes,
        "query": query,
        "quote_paginator": pretty_paginator(quotes, query=query),
        **getenv("quotes"),
    })


@permission_required("orgapy.view_quote")
def view_quote(request, qid):
    q = models.Quote.objects.filter(user=request.user, id=int(qid))
    if not q.exists():
        raise Http404("Not Found")
    quote = q.get()
    return render(request, "orgapy/quotes_search.html", {
        "quotes": [quote],
        **getenv("quotes"),
    })


@permission_required("orgapy.add_quote")
def view_create_quote(request):
    if request.method == "POST":
        add_quote(request, request.POST.get("reference").strip(), request.POST.get("content").strip())
        if "form_quote" in request.POST:
            return redirect("orgapy:quotes_search")
    prefill_reference = None
    q = models.Quote.objects.order_by("-date_creation")
    if q.exists():
        prefill_reference = q[0].reference
    return render(request, "orgapy/create_quote.html", {
        "prefill_reference": prefill_reference,
        **getenv("quotes"),
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
        **getenv("sheets"),
    })


@permission_required("orgapy.add_sheet")
def view_create_sheet(request):
    sheet_groups = models.SheetGroup.objects.filter(user=request.user)
    return render(request, "orgapy/create_sheet.html", {
        "sheet_groups": sheet_groups,
        **getenv("sheets"),
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
        **getenv("sheets"),
    })


@permission_required("orgapy.change_sheetgroup")
def view_edit_sheet_group(request, sid):
    if not models.SheetGroup.objects.filter(user=request.user, id=int(sid)).exists():
        raise Http404("Group not found")
    group = models.SheetGroup.objects.filter(user=request.user, id=int(sid)).get()
    return render(request, "orgapy/edit_sheet_group.html", {
        "group": group,
        **getenv("sheets"),
    })


@permission_required("orgapy.delete_sheetgroup")
def view_delete_sheet_group(request, sid):
    if not models.SheetGroup.objects.filter(user=request.user, id=int(sid)).exists():
        raise Http404("Group not found")
    group = models.SheetGroup.objects.filter(user=request.user, id=int(sid)).get()
    group.delete()
    return redirect("orgapy:sheets")


def view_sheet(request, sid):
    sheet = find_object(models.Sheet, sid)
    has_permission = False
    read_only = False
    if request.GET.get("embed"):
        read_only = True
    if request.user is not None and sheet.user == request.user and request.user.has_perm("orgapy.view_sheet"):
        has_permission = True
    elif sheet.public and isinstance(sid, str) and len(sid) == 12:
        has_permission = True
        read_only = True
    if not has_permission:
        raise PermissionDenied()
    response = render(request, "orgapy/sheet.html", {
        "sheet": sheet,
        "readonly": read_only,
        **getenv("sheets"),
    })
    response["X-Frame-Options"] = "SAMEORIGIN"
    return response


@permission_required("orgapy.change_sheet")
def view_edit_sheet(request, sid):
    sheet = find_object(models.Sheet, sid)
    sheet_groups = models.SheetGroup.objects.filter(user=request.user)
    return render(request, "orgapy/edit_sheet.html", {
        "sheet": sheet,
        "sheet_groups": sheet_groups,
        **getenv("sheets"),
    })


@permission_required("orgapy.view_sheet")
def view_export_sheet(request, sid):
    sheet = find_object(models.Sheet, sid)
    if request.user is not None and sheet.user == request.user and request.user.has_perm("orgapy.view_sheet") or sheet.public:
        response = HttpResponse(sheet.data, content_type="text/tab-separated-values")
        response['Content-Disposition'] = f'attachment; filename="{sheet.title}.tsv"'
        return response
    raise PermissionDenied


@permission_required("orgapy.delete_sheet")
def view_delete_sheet(request, sid):
    sheet = find_object(models.Sheet, sid, request.user)
    sheet.delete()
    return redirect("orgapy:sheets")


@permission_required("orgapy.change_sheet")
def view_toggle_sheet_public(request, sid):
    sheet = find_object(models.Sheet, sid, request.user)
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
        **getenv("maps"),
    })


@permission_required("orgapy.add_map")
def view_create_map(request):
    return render(request, "orgapy/create_map.html", {
        **getenv("maps"),
    })


@permission_required("orgapy.change_map")
def view_save_map(request):
    if request.method == "POST":
        mmap = save_map_core(request)
        return redirect("orgapy:map", mid=mmap.id)
    raise PermissionDenied


def view_map(request, mid):
    mmap = find_object(models.Map, mid)
    has_permission = False
    read_only = True
    if not request.GET.get("embed"):
        read_only = False
    if request.user is not None and mmap.user == request.user and request.user.has_perm("orgapy.view_map"):
        has_permission = True
    elif mmap.public and isinstance(mid, str) and len(mid) == 12:
        has_permission = True
        read_only = True
    if not has_permission:
        raise PermissionDenied
    response = render(request, "orgapy/map.html", {
        "map": mmap,
        "readonly": read_only,
        **getenv("maps"),
    })
    response["X-Frame-Options"] = "SAMEORIGIN"
    return response


@permission_required("orgapy.view_map")
def view_export_map(request, mid):
    mmap = find_object(models.Map, mid)
    if request.user is not None and mmap.user == request.user and request.user.has_perm("orgapy.view_map") or mmap.public:
        response = HttpResponse(mmap.geojson, content_type="application/geo+json")
        response['Content-Disposition'] = f'attachment; filename="{mmap.title}.geojson"'
        return response
    raise PermissionDenied


@permission_required("orgapy.delete_map")
def view_delete_map(request, mid):
    mmap = find_object(models.Map, mid, request.user)
    mmap.delete()
    return redirect("orgapy:maps")


@permission_required("orgapy.change_map")
def view_toggle_map_public(request, mid):
    mmap = find_object(models.Map, mid, request.user)
    mmap.public = not mmap.public
    mmap.save()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect("orgapy:maps")


@permission_required("orgapy.view_progress_log")
def view_progress(request, year: str | None = None):
    
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
        raise BadRequest("Wrong date arg")

    page_size = 24
    objects = models.ProgressLog.objects.filter(user=request.user).filter(dt__range=[dt_start, dt_end + datetime.timedelta(days=1)]).order_by("-dt")
    paginator = Paginator(objects, page_size)
    page = request.GET.get("page")
    logs = paginator.get_page(page)

    counter_query = models.ProgressCounter.objects.filter(user=request.user, year=year)
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
        **getenv("general"),
    })


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
        case "archive-project":
            return api_archive_project(request)
        case "unarchive-project":
            return api_unarchive_project(request)
        case "delete-project":
            return api_delete_project(request)
        case "list-objectives":
            return api_list_objectives(request)
        case "add-objective":
            return api_add_objective(request)
        case "edit-objective":
            return api_edit_objective(request)
        case "archive-objective":
            return api_archive_objective(request)
        case "unarchive-objective":
            return api_unarchive_objective(request)
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
        case "edit-widgets":
            return api_edit_widgets(request)
        case "sheet":
            return api_sheet(request)
        case "save-sheet":
            return api_save_sheet(request)
        case "sheet-suggestions":
            return api_sheet_suggestions(request)
        case "map":
            return api_map(request)
        case "save-map":
            return api_save_map(request)
        case "map-suggestions":
            return api_map_suggestions(request)
        case "suggestions":
            return api_suggestions(request)
        case "progress":
            return api_progress(request)
        case _:
            raise BadRequest("Wrong action")


@permission_required("orgapy.view_project")
def api_list_projects(request):
    show_archived = request.GET.get("archived", "0") == "1"
    projects = []
    for project in models.Project.objects.filter(user=request.user):
        if project.archived and not show_archived:
            continue
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
            "limitDate": project.limit_date,
            "progress": progress,
            "description": project.description if project.description else None,
            "checklist": project.checklist if project.checklist else None,
            "rank": project.rank,
            "note": None if project.note is None else project.note.id,
            "archived": project.archived,
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
        "limitDate": None,
        "progress": None,
        "description": None,
        "checklist": None,
        "creation": project.date_creation.timestamp(),
        "modification": project.date_modification.timestamp(),
        "rank": project.rank,
        "note": None,
        "archived": False,
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
    if project.date_modification.timestamp() > project_data["modification"]:
        return JsonResponse({"success": False, "reason": "Project has newer modifications"})
    project.title = project_data["title"]
    project.category = project_data["category"]
    project.rank = float(project_data["rank"])
    if project_data["limitDate"] is not None:
        project.limit_date = datetime.datetime.strptime(project_data["limitDate"], "%Y-%m-%d").date()
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
    compare_checklists(request.user, project.title, project.checklist, project_data["checklist"])
    if project_data["checklist"] is not None:
        project.checklist = project_data["checklist"]
    else:
        project.checklist = None
    if project_data["note"] is not None and models.Note.objects.filter(user=request.user, id=int(project_data["note"])).exists():
        project.note = models.Note.objects.get(user=request.user, id=int(project_data["note"]))
    else:
        project.note = None
    project.save()
    return JsonResponse({
        "success": True,
        "modification": project.date_modification.timestamp()
    })


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


@permission_required("orgapy.change_project")
def api_archive_project(request):
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
    project.archived = True
    project.save()
    return JsonResponse({
        "success": True,
        "modification": project.date_modification.timestamp(),
    })


@permission_required("orgapy.change_project")
def api_unarchive_project(request):
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
    project.archived = False
    project.save()
    return JsonResponse({
        "success": True,
        "modification": project.date_modification.timestamp(),
    })


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
    show_archived = request.GET.get("archived", "0") == "1"
    objectives = []
    for objective in models.Objective.objects.filter(user=request.user):
        if not show_archived and objective.archived:
            continue
        objectives.append(objective.to_dict())
    return JsonResponse({"objectives": objectives})


@permission_required("orgapy.add_objective")
def api_add_objective(request):
    if request.method != "POST":
        raise BadRequest("Wrong method")
    objective_name = request.POST.get("name")
    objective_period = request.POST.get("period")
    if objective_name is None or objective_period is None:
        raise BadRequest("Missing fields")
    try:
        objective_period = float(objective_period)
    except:
        raise BadRequest("Invalid values")
    models.Objective.objects.create(
        user=request.user,
        name=objective_name,
        period=objective_period,
        flexible=request.POST.get("flexible", "") == "on",
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
    objective_period = request.POST.get("period")
    objective_flexible = request.POST.get("flexible", "") == "on"
    if objective_id is None or objective_name is None or objective_period is None:
        raise BadRequest("Missing fields")
    try:
        objective_id = int(objective_id)
        objective_period = float(objective_period)
    except:
        raise BadRequest("Invalid values")
    if not models.Objective.objects.filter(id=objective_id, user=request.user).exists():
        raise Http404("Objective not found")
    objective = models.Objective.objects.get(id=objective_id, user=request.user)
    objective.name = objective_name
    objective.period = objective_period
    objective.flexible = objective_flexible
    objective.save()
    return JsonResponse({"success": True})


@permission_required("orgapy.change_objective")
def api_archive_objective(request):
    if request.method != "POST":
        raise BadRequest("Wrong method")
    objective_id = request.POST.get("objective_id")
    if objective_id is None:
        raise BadRequest("Missing field")
    try:
        objective_id = int(objective_id)
    except:
        raise BadRequest("Invalid value")
    if not models.Objective.objects.filter(id=objective_id, user=request.user).exists():
        raise Http404("Objective not found")
    objective = models.Objective.objects.get(id=objective_id, user=request.user)
    objective.archived = True
    objective.save()
    return JsonResponse({"success": True})


@permission_required("orgapy.change_objective")
def api_unarchive_objective(request):
    if request.method != "POST":
        raise BadRequest("Wrong method")
    objective_id = request.POST.get("objective_id")
    if objective_id is None:
        raise BadRequest("Missing field")
    try:
        objective_id = int(objective_id)
    except:
        raise BadRequest("Invalid value")
    if not models.Objective.objects.filter(id=objective_id, user=request.user).exists():
        raise Http404("Objective not found")
    objective = models.Objective.objects.get(id=objective_id, user=request.user)
    objective.archived = False
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
    compare_objective_histories(request.user, objective.name, objective.history, objective_history)
    objective.history = objective_history
    objective.save()
    return JsonResponse({"success": True})


@permission_required("orgapy.view_calendar")
def api_list_calendars(request):
    events = []
    calendars = []
    calendar = None
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
    if task_due_date is not None and task_due_date.strip() == "":
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
    models.ProgressLog.objects.create(
        user=request.user,
        type=models.ProgressLog.TASK_COMPLETED,
        description=task.title
    )
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


@permission_required("orgapy.change_note")
def api_edit_widgets(request):
    nid = request.POST.get("nid")
    updates = json.loads(request.POST.get("updates", "[]"))
    if nid is None:
        raise BadRequest()
    query = models.Note.objects.filter(user=request.user, id=int(nid))
    if not query.exists():
        raise Http404("Not found")
    note = query.get()
    for update in updates:
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
            for i, widget_match in enumerate(re.finditer(regex, note.content)):
                if i != widget_index:
                    continue
                start, end = widget_match.span(0)
                text = note.content
                note.content = text[:start] + widget_value + text[end:]
                break
        elif widget_type == "checkbox":
            for i, widget_match in enumerate(re.finditer(r"^ *- \[(x| )\]", note.content, re.MULTILINE)):
                if i != widget_index:
                    continue
                start, end = widget_match.span(1)
                text = note.content
                if widget_value:
                    widget_value = "x"
                else:
                    widget_value = " "
                note.content = text[:start] + widget_value + text[end:]
                break
    note.save()
    return JsonResponse({"success": True})


def api_sheet(request):
    sheet_id = request.GET.get("sid")
    sheet = find_object(models.Sheet, int(sheet_id))
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
    sheet = find_object(models.Sheet, int(sheet_id), request.user)
    sheet.data = sheet_data
    sheet.config = sheet_config
    sheet.date_modification = timezone.now()
    sheet.save()
    return JsonResponse({"success": True})


@permission_required("orgapy.view_sheet")
def api_sheet_suggestions(request):
    query = request.GET.get("q", "").strip()
    results = []
    if len(query) >= 1:
        results = models.Sheet.objects.filter(user=request.user, title__startswith=query)[:5]
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


def api_map(request):
    map_id = request.GET.get("mid")
    mmap = find_object(models.Map, int(map_id))
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
    mmap = find_object(models.Map, int(map_id), request.user)
    mmap.title = map_title
    mmap.geojson = map_geojson
    mmap.config = map_config
    mmap.date_modification = timezone.now()
    mmap.save()
    return JsonResponse({"success": True})


@permission_required("orgapy.view_map")
def api_map_suggestions(request):
    query = request.GET.get("q", "").strip()
    results = []
    if len(query) >= 1:
        results = models.Map.objects.filter(user=request.user, title__startswith=query)[:5]
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


def api_suggestions(request):
    query = request.GET.get("q", "").strip()
    results = []
    if len(query) >= 1:
        if request.user.has_perm("orgapy.view_note"):
            results += models.Note.objects.filter(user=request.user, title__startswith=query)[:5]
        if request.user.has_perm("orgapy.view_sheet"):
            results += models.Sheet.objects.filter(user=request.user, title__startswith=query)[:5]
        if request.user.has_perm("orgapy.view_map"):
            results += models.Map.objects.filter(user=request.user, title__startswith=query)[:5]
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


@permission_required("orgapy.view_progress_counter")
def api_progress(request):
    year = request.GET.get("year", datetime.datetime.now().year).strip()
    query = models.ProgressCounter.objects.filter(user=request.user, year=int(year))
    if not query.exists():
        raise Http404("Progress counter does not exist")
    counter = query.first()
    return HttpResponse(counter.data, content_type="application/json")