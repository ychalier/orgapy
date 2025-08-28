import datetime
import json
import re
import urllib.parse
from typing import TypeVar

import dateutil.relativedelta
from django.contrib.auth.decorators import permission_required
from django.contrib.auth.models import AbstractBaseUser, AnonymousUser
from django.core.exceptions import PermissionDenied, BadRequest
from django.core.paginator import Paginator, Page
from django.db.models import Q, Max, TextField
from django.db.models.functions import Concat
from django.http import HttpRequest, HttpResponse, Http404, JsonResponse
from django.shortcuts import redirect, render
from django.utils import timezone
from django.utils.text import slugify
from django.urls import reverse

from .models import Settings, Category, Note, Quote, Sheet, SheetGroup, Map, ProgressCounter, ProgressLog, Calendar, Task, Project, Objective


UserObject = TypeVar("UserObject", Category, Note, Quote, Sheet, Map, ProgressLog)
CategorizedObject = TypeVar("CategorizedObject", Note, Sheet, Map)
LoggedUser = AbstractBaseUser


# ----------------------------------------------- #
# UTILITIES                                       #
# ----------------------------------------------- #


def pretty_paginator(page: Page, show_around: int = 2, **attrs) -> dict:
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


def find_object(
        model: type[UserObject],
        key: str | list[str],
        value: int | str,
        required_user: LoggedUser | AnonymousUser | None = None
        ) -> UserObject:
    fields = [key] if isinstance(key, str) else key
    nodes = Q(**{fields[0]: value})
    for field in fields[1:]:
        nodes |= Q(**{field: value})
    query = model.objects.filter(nodes)
    try:
        obj = query.get()
    except model.DoesNotExist:
        raise Http404()
    if required_user is not None and getattr(obj, "user", None) != required_user:
        raise PermissionDenied()
    return obj


class ConflictError(Exception):
    pass


def save_note_core(request: HttpRequest) -> Note:
    original_note = None
    if ("id" in request.POST
            and Note.objects.filter(id=request.POST["id"]).exists()):
        original_note = Note.objects.get(id=request.POST["id"])
        if original_note.date_modification.timestamp() > float(request.POST.get("modification", 0)):
            raise ConflictError()
    if original_note is not None and original_note.user != request.user:
        raise PermissionDenied()
    title = request.POST.get("title", "").strip()
    content = request.POST.get("content", "").strip()
    is_public = "public" in request.POST
    is_pinned = "pinned" in request.POST
    is_hidden = "hidden" in request.POST
    if original_note is None:
        note = Note.objects.create(
            user=request.user,
            title=title,
            content=content,
            public=is_public,
            pinned=is_pinned,
            hidden=is_hidden
        )
    else:
        note = original_note
        note.title = title
        note.content = content
        note.public = is_public
        note.pinned = is_pinned
        note.hidden = is_hidden
        
    note.date_modification = timezone.now()
    note.save()
    save_object_categories(request, note)
    return note


def save_object_categories(request: HttpRequest, obj: CategorizedObject):
    obj.categories.clear()
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
        if int_id is not None and Category.objects.filter(id=int_id, user=request.user).exists():
            category = Category.objects.get(id=int_id, user=request.user)
        elif Category.objects.filter(name=name, user=request.user).exists():
            category = Category.objects.get(name=name, user=request.user)
        else:
            category = Category.objects.create(name=name, user=request.user)
        obj.categories.add(category)


def add_quote(request: HttpRequest, reference: str, content: str) -> Quote:
    quote = Quote.objects.create(
        user=request.user,
        content=content,
        reference=reference
    )
    return quote


def parse_dt(date_string: str, time_string: str) -> datetime.datetime:
    dt_date = datetime.datetime.strptime(date_string, "%Y-%m-%d").date()
    dt_time = datetime.datetime.strptime(time_string, "%H:%M").time()
    return datetime.datetime.combine(dt_date, dt_time)


def parse_date(date_string: str) -> datetime.date:
    return datetime.datetime.strptime(date_string, "%Y-%m-%d").date()


def save_sheet_core(request: HttpRequest) -> Sheet:
    original_sheet = None
    if ("id" in request.POST
            and Sheet.objects.filter(id=request.POST["id"]).exists()):
        original_sheet = Sheet.objects.get(id=request.POST["id"])
    if original_sheet is not None and original_sheet.user != request.user:
        raise PermissionDenied()
    title = request.POST.get("title", "").strip()
    description = request.POST.get("content", "").strip()
    is_public = "public" in request.POST
    is_pinned = "pinned" in request.POST
    is_hidden = "hidden" in request.POST
    if original_sheet is None:
        sheet = Sheet.objects.create(
            user=request.user,
            title=title,
            description=description,
            public=is_public,
            pinned=is_pinned,
            hidden=is_hidden
        )
    else:
        sheet = original_sheet
        sheet.title = title
        sheet.description = description
        sheet.public = is_public
        sheet.pinned = is_pinned
        sheet.hidden = is_hidden
    sheet.date_modification = timezone.now()
    save_object_categories(request, sheet)
    sheet.save()
    return sheet


def save_map_core(request: HttpRequest) -> Map:
    original_map = None
    if ("id" in request.POST
            and Map.objects.filter(id=request.POST["id"]).exists()):
        original_map = Map.objects.get(id=request.POST["id"])
    if original_map is not None and original_map.user != request.user:
        raise PermissionDenied()
    title = request.POST.get("title", "").strip()
    is_public = "public" in request.POST
    is_pinned = "pinned" in request.POST
    is_hidden = "hidden" in request.POST
    if original_map is None:
        mmap = Map.objects.create(
            user=request.user,
            title=title,
            public=is_public,
            pinned=is_pinned,
            hidden=is_hidden,
        )
    else:
        mmap = original_map
        mmap.title = title
        mmap.public = is_public
        mmap.pinned = is_pinned
        mmap.hidden = is_hidden
    mmap.date_modification = timezone.now()
    save_object_categories(request, mmap)
    mmap.save()
    return mmap


def get_checked_items(checklist: str) -> list[str]:
    return re.findall(r"\[x\] (.*)", checklist)


def compare_checklists(user: LoggedUser, title: str, before: str | None, after: str | None):
    if before is None or after is None:
        return
    checked_before = set(get_checked_items(before))
    checked_after = set(get_checked_items(after))
    for item in checked_after.difference(checked_before):
        ProgressLog.objects.create(
            user=user,
            type=ProgressLog.PROJECT_CHECKLIST_ITEM_CHECKED,
            description=f"{title} - {item}"
        )


def compare_objective_histories(user: LoggedUser, name: str, before: str | None, after: str | None):
    if before is None or after is None:
        return
    history_before = json.loads(before)
    history_after = json.loads(after)
    for _ in range(len(history_after) - len(history_before)):
        ProgressLog.objects.create(
            user=user,
            type=ProgressLog.OBJECTIVE_COMPLETED,
            description=name
        )


def getenv(name: str) -> dict[str, str]:
    match name:
        case "general":
            return {}
        case "projects":
            return {
                "active": "projects",
            }
        case "notes":
            return {
                "active": "notes",
            }
        case "quotes":
            return {
                "active": "quotes",
            }
        case "sheets":
            return {
                "active": "sheets",
            }
        case "maps":
            return {
                "active": "maps",
            }
    raise ValueError(f"Unknown env '{name}'")


def get_or_create_settings(user: LoggedUser) -> Settings:
    query = Settings.objects.filter(user=user)
    if query.exists():
        return query.get()
    return Settings.objects.create(user=user)


# ----------------------------------------------- #
# VIEWS                                           #
# ----------------------------------------------- #


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
        **getenv("projects"),
    })


def view_search(request: HttpRequest) -> HttpResponse:
    page_size = 24
    query = request.GET.get("query", "")
    if query == "public":
        objects = list(Note.objects.filter(user=request.user, public=True, hidden=False))\
            + list(Sheet.objects.filter(user=request.user, public=True))\
            + list(Map.objects.filter(user=request.user, public=True))
    else:
        objects = list(Note.objects.filter(user=request.user, hidden=False).filter(Q(title__contains=query) | Q(content__contains=query)))\
            + list(Quote.objects.filter(user=request.user).filter(Q(reference__contains=query) | Q(content__contains=query)))\
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
        **getenv("general"),
    })


@permission_required("orgapy.view_category")
def view_categories(request: HttpRequest) -> HttpResponse:
    return render(request, "orgapy/categories.html", {
        "categories": Category.objects.filter(user=request.user),
        "uncategorized": Note.objects.filter(user=request.user, categories__isnull=True).count(),
        **getenv("general"),
    })


@permission_required("orgapy.view_category")
def view_category(request: HttpRequest, name: str) -> HttpResponse:
    category = find_object(Category, "name", name, request.user)
    # TODO: how about uncategorized?
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
        **getenv("general"),
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
                **getenv("general"),
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


def view_objects(
        request: HttpRequest,
        model: type[UserObject],
        template_name: str,
        env_name: str,
        page_size: int = 24
        ) -> HttpResponse:
    query = request.GET.get("query", "")
    category = request.GET.get("category", "")
    if len(query) > 0 and query[0] == "#":
        category = query[1:]
    base_objects = model.objects.filter(user=request.user)
    show_hidden = request.GET.get("hidden") == "1"
    if show_hidden:
        base_objects = base_objects.filter(hidden=True)
    else:
        base_objects = base_objects.filter(hidden=False)
    if "uncategorized" in request.GET:
        base_objects = base_objects.filter(categories__isnull=True)
    if len(category) > 0:
        objects = base_objects.filter(categories__name__exact=category)
    elif len(query) > 0:
        if model == Note:
            objects = base_objects.filter(Q(title__contains=query) | Q(content__contains=query))
        else:
            objects = base_objects.filter(title__contains=query)
    else:
        objects = base_objects
    if len(objects) == 1 and model.objects.count() > 1 and not show_hidden:
        return redirect(objects[0].get_absolute_url())
    paginator = Paginator(objects.order_by(
        "-pinned",
        "-date_modification",
        "-date_access",
    ), page_size)
    page = request.GET.get("page")
    objects = paginator.get_page(page)
    return render(request, template_name, {
        "objects": objects,
        "query": query,
        "category": category,
        "paginator": pretty_paginator(objects, query=query, hidden=int(show_hidden)),
        "categories": Category.objects.filter(user=request.user).order_by("name"),
        **getenv(env_name),
    })


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
    if active == "notes":
        return view_toggle_note_pin(request, object_id)
    if active == "sheets":
        return view_toggle_sheet_pin(request, object_id)
    if active == "maps":
        return view_toggle_map_pin(request, object_id)
    raise BadRequest(f"Unknown environment '{active}'")


@permission_required("orgapy.change_note")
@permission_required("orgapy.change_sheet")
@permission_required("orgapy.change_map")
def view_toggle_public(request: HttpRequest, active: str, object_id: str) -> HttpResponse:
    if active == "notes":
        return view_toggle_note_public(request, object_id)
    if active == "sheets":
        return view_toggle_sheet_public(request, object_id)
    if active == "maps":
        return view_toggle_map_public(request, object_id)
    raise BadRequest(f"Unknown environment '{active}'")


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


@permission_required("orgapy.view_note")
def view_notes(request: HttpRequest) -> HttpResponse:
    return view_objects(request, Note, "orgapy/notes.html", "notes")


@permission_required("orgapy.add_note")
def view_create_note(request: HttpRequest) -> HttpResponse:
    categories = Category.objects.filter(user=request.user)
    return render(request, "orgapy/create_note.html", {
        "categories": categories,
        "note_category_ids": {},
        **getenv("notes"),
    })


@permission_required("orgapy.change_note")
def view_save_note(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        try:
            note = save_note_core(request)
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
        **getenv("notes"),
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
        **getenv("notes"),
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
    note = find_object(Note, "id", object_id, request.user)
    note.pinned = not note.pinned
    note.save()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect("orgapy:notes")


@permission_required("orgapy.change_sheet")
def view_toggle_sheet_pin(request: HttpRequest, object_id: str) -> HttpResponse:
    sheet = find_object(Sheet, "id", object_id, request.user)
    sheet.pinned = not sheet.pinned
    sheet.save()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect("orgapy:sheets")


@permission_required("orgapy.change_map")
def view_toggle_map_pin(request: HttpRequest, object_id: str) -> HttpResponse:
    mmap = find_object(Map, "id", object_id, request.user)
    mmap.pinned = not mmap.pinned
    mmap.save()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect("orgapy:maps")


@permission_required("orgapy.change_note")
def view_toggle_note_public(request: HttpRequest, object_id: str) -> HttpResponse:
    note = find_object(Note, "id", object_id, request.user)
    note.public = not note.public
    note.save()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect("orgapy:notes")


@permission_required("orgapy.view_quote")
def view_quotes(request: HttpRequest) -> HttpResponse:
    recent_quotes = Quote.objects.filter(user=request.user).order_by("-date_creation")[:3]
    random_quotes = Quote.objects.filter(user=request.user).exclude(id__in=[q.id for q in recent_quotes]).order_by("?")[:3]
    return render(request, "orgapy/quotes.html", {
        "recent_quotes": recent_quotes,
        "random_quotes": random_quotes,
        **getenv("quotes"),
    })


@permission_required("orgapy.view_quote")
def view_quotes_search(request: HttpRequest) -> HttpResponse:
    page_size = 10
    query = request.GET.get("query", "")
    objects = Quote.objects.filter(user=request.user)
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
def view_quote(request: HttpRequest, object_id: str) -> HttpResponse:
    q = Quote.objects.filter(user=request.user, id=int(object_id))
    if not q.exists():
        raise Http404()
    quote = q.get()
    return render(request, "orgapy/quotes_search.html", {
        "quotes": [quote],
        **getenv("quotes"),
    })


@permission_required("orgapy.add_quote")
def view_create_quote(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        add_quote(request, request.POST.get("reference", "").strip(), request.POST.get("content", "").strip())
        if "form_quote" in request.POST:
            return redirect("orgapy:quotes_search")
    prefill_reference = None
    q = Quote.objects.order_by("-date_creation")
    if q.exists():
        prefill_reference = q[0].reference
    return render(request, "orgapy/create_quote.html", {
        "prefill_reference": prefill_reference,
        **getenv("quotes"),
    })


@permission_required("orgapy.change_quote")
def view_save_quote(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequest()
    object_id = request.POST["id"]
    query = Quote.objects.filter(user=request.user, id=int(object_id))
    try:
        quote = query.get()
    except Quote.DoesNotExist:
        raise Http404()
    reference = request.POST["reference"]
    content = request.POST["content"]
    quote.reference = reference
    quote.content = content
    quote.save()
    return redirect("orgapy:quote", object_id=quote.id)


@permission_required("orgapy.change_quote")
def view_edit_quote(request: HttpRequest, object_id: str) -> HttpResponse:
    q = Quote.objects.filter(user=request.user, id=int(object_id))
    if not q.exists():
        raise Http404()
    quote = q.get()
    return render(request, "orgapy/edit_quote.html", {
        "quote": quote,
        **getenv("quotes"),
    })


@permission_required("orgapy.view_sheet")
def view_sheets(request: HttpRequest) -> HttpResponse:
    return view_objects(request, Sheet, "orgapy/sheets.html", "sheets")


@permission_required("orgapy.add_sheet")
def view_create_sheet(request: HttpRequest) -> HttpResponse:
    sheet_groups = SheetGroup.objects.filter(user=request.user)
    return render(request, "orgapy/create_sheet.html", {
        "sheet_groups": sheet_groups,
        **getenv("sheets"),
    })


@permission_required("orgapy.change_sheet")
def view_save_sheet(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        sheet = save_sheet_core(request)
        return redirect("orgapy:sheet", object_id=sheet.id)
    raise PermissionDenied()


@permission_required("orgapy.add_sheetgroup")
def view_create_sheet_group(request: HttpRequest) -> HttpResponse:
    if "title" not in request.POST:
        raise BadRequest()
    title = request.POST.get("title")
    SheetGroup.objects.create(user=request.user, title=title)
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect("orgapy:sheets")


@permission_required("orgapy.change_sheetgroup")
def view_save_sheet_group(request: HttpRequest) -> HttpResponse:
    object_id = request.POST.get("id", "")
    if not object_id:
        raise BadRequest()
    if not SheetGroup.objects.filter(user=request.user, id=int(object_id)).exists():
        raise Http404()
    group = SheetGroup.objects.filter(user=request.user, id=int(object_id)).get()
    title = request.POST.get("title", "")
    if not title:
        raise BadRequest()
    group.title = title
    group.save()
    return redirect("orgapy:sheet_group", object_id=group.id)


@permission_required("orgapy.view_sheetgroup")
def view_sheet_group(request: HttpRequest, object_id: str) -> HttpResponse:
    if not SheetGroup.objects.filter(user=request.user, id=int(object_id)).exists():
        raise Http404()
    group = SheetGroup.objects.filter(user=request.user, id=int(object_id)).get()
    return render(request, "orgapy/sheet_group.html", {
        "group": group,
        **getenv("sheets"),
    })


@permission_required("orgapy.change_sheetgroup")
def view_edit_sheet_group(request: HttpRequest, object_id: str) -> HttpResponse:
    if not SheetGroup.objects.filter(user=request.user, id=int(object_id)).exists():
        raise Http404()
    group = SheetGroup.objects.filter(user=request.user, id=int(object_id)).get()
    return render(request, "orgapy/edit_sheet_group.html", {
        "group": group,
        **getenv("sheets"),
    })


@permission_required("orgapy.delete_sheetgroup")
def view_delete_sheet_group(request: HttpRequest, object_id: str) -> HttpResponse:
    if not SheetGroup.objects.filter(user=request.user, id=int(object_id)).exists():
        raise Http404()
    group = SheetGroup.objects.filter(user=request.user, id=int(object_id)).get()
    group.delete()
    return redirect("orgapy:sheets")


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
        **getenv("sheets"),
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
        **getenv("sheets"),
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
def view_toggle_sheet_public(request: HttpRequest, object_id: str) -> HttpResponse:
    sheet = find_object(Sheet, "id", object_id, request.user)
    sheet.public = not sheet.public
    sheet.save()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect("orgapy:sheets")


@permission_required("orgapy.view_map")
def view_maps(request: HttpRequest) -> HttpResponse:
    return view_objects(request, Map, "orgapy/maps.html", "maps")


@permission_required("orgapy.add_map")
def view_create_map(request: HttpRequest) -> HttpResponse:
    return render(request, "orgapy/create_map.html", {
        **getenv("maps"),
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
        **getenv("maps"),
    })


@permission_required("orgapy.change_map")
def view_save_map(request: HttpRequest) -> HttpResponse:
    if request.method == "POST":
        mmap = save_map_core(request)
        return redirect("orgapy:map", object_id=mmap.id)
    raise PermissionDenied()


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
        **getenv("maps"),
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
def view_toggle_map_public(request: HttpRequest, object_id: str) -> HttpResponse:
    mmap = find_object(Map, "id", object_id, request.user)
    mmap.public = not mmap.public
    mmap.save()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect("orgapy:maps")


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
        **getenv("general"),
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
    return render(request, "orgapy/create_progress_log.html", {
        **getenv("general"),
    })


@permission_required("orgapy.change_progress_log")
def view_edit_progress_log(request: HttpRequest, object_id: str) -> HttpResponse:
    log = find_object(ProgressLog, "id", object_id, request.user)
    return render(request, "orgapy/edit_progress_log.html", {
        "log": log,
        **getenv("general"),
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
        **getenv("general"),
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
        **getenv("notes"),
    })


# ----------------------------------------------- #
# API                                             #
# ----------------------------------------------- #


def api(request: HttpRequest) -> HttpResponse:
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
        case "edit-widgets":
            return api_edit_widgets(request)
        case "sheet":
            return api_sheet(request)
        case "save-sheet":
            return api_save_sheet(request)
        case "map":
            return api_map(request)
        case "save-map":
            return api_save_map(request)
        case "suggestions":
            return api_suggestions(request)
        case "progress":
            return api_progress(request)
        case "title":
            return api_title(request)
        case _:
            raise BadRequest()


@permission_required("orgapy.view_project")
def api_list_projects(request: HttpRequest) -> HttpResponse:
    show_archived = request.GET.get("archived", "0") == "1"
    projects = []
    for project in Project.objects.filter(user=request.user):
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
def api_create_project(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequest()
    max_rank = Project.objects.filter(user=request.user).aggregate(Max("rank"))["rank__max"]
    if max_rank is None:
        max_rank = 1
    project = Project.objects.create(
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
def api_edit_project(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequest()
    project_id = request.POST.get("project_id")
    project_data = request.POST.get("project_data")
    if project_id is None or project_data is None:
        raise BadRequest()
    try:
        project_id = int(project_id)
        project_data = json.loads(project_data)
    except:
        raise BadRequest()
    if not Project.objects.filter(id=project_id, user=request.user).exists():
        raise Http404()
    project = Project.objects.get(id=project_id, user=request.user)
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
    if isinstance(request.user, AnonymousUser):
        raise PermissionDenied()
    compare_checklists(request.user, project.title, project.checklist, project_data["checklist"])
    if project_data["checklist"] is not None:
        project.checklist = project_data["checklist"]
    else:
        project.checklist = None

    note = None
    if project_data["note"] is not None:
        try:
            note = Note.objects.get(user=request.user, id=int(project_data["note"]))
        except Note.DoesNotExist:
            pass
    project.note = note # type: ignore

    project.save()
    return JsonResponse({
        "success": True,
        "modification": project.date_modification.timestamp()
    })


@permission_required("orgapy.change_project")
def api_edit_project_ranks(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequest()
    ranks_data = request.POST.get("ranks")
    if ranks_data is None:
        raise BadRequest()
    try:
        ranks_data = json.loads(ranks_data)
    except:
        raise BadRequest()
    projects, ranks = [], []
    for project_id, rank in ranks_data.items():
        if not Project.objects.filter(id=int(project_id), user=request.user).exists():
            raise Http404()
        project = Project.objects.get(id=int(project_id), user=request.user)
        projects.append(project)
        ranks.append(float(rank))
    for project, rank in zip(projects, ranks):
        project.rank = rank
        project.save()
    return JsonResponse({"success": True})


@permission_required("orgapy.change_project")
def api_archive_project(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequest()
    project_id = request.POST.get("project_id")
    if project_id is None:
        raise BadRequest()
    try:
        project_id = int(project_id)
    except:
        raise BadRequest()
    if not Project.objects.filter(id=project_id, user=request.user).exists():
        raise Http404()
    project = Project.objects.get(id=project_id, user=request.user)
    project.archived = True
    project.save()
    return JsonResponse({
        "success": True,
        "modification": project.date_modification.timestamp(),
    })


@permission_required("orgapy.change_project")
def api_unarchive_project(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequest()
    project_id = request.POST.get("project_id")
    if project_id is None:
        raise BadRequest()
    try:
        project_id = int(project_id)
    except:
        raise BadRequest()
    if not Project.objects.filter(id=project_id, user=request.user).exists():
        raise Http404()
    project = Project.objects.get(id=project_id, user=request.user)
    project.archived = False
    project.save()
    return JsonResponse({
        "success": True,
        "modification": project.date_modification.timestamp(),
    })


@permission_required("orgapy.delete_project")
def api_delete_project(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequest()
    project_id = request.POST.get("project_id")
    if project_id is None:
        raise BadRequest()
    try:
        project_id = int(project_id)
    except:
        raise BadRequest()
    if not Project.objects.filter(id=project_id, user=request.user).exists():
        raise Http404()
    project = Project.objects.get(id=project_id, user=request.user)
    project.delete()
    return JsonResponse({"success": True})


@permission_required("orgapy.view_objective")
def api_list_objectives(request: HttpRequest) -> HttpResponse:
    show_archived = request.GET.get("archived", "0") == "1"
    objectives = []
    for objective in Objective.objects.filter(user=request.user):
        if not show_archived and objective.archived:
            continue
        objectives.append(objective.to_dict())
    return JsonResponse({"objectives": objectives})


@permission_required("orgapy.add_objective")
def api_add_objective(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequest()
    objective_name = request.POST.get("name")
    objective_period = request.POST.get("period")
    if objective_name is None or objective_period is None:
        raise BadRequest()
    try:
        objective_period = float(objective_period)
    except:
        raise BadRequest()
    Objective.objects.create(
        user=request.user,
        name=objective_name,
        period=objective_period,
        flexible=request.POST.get("flexible", "") == "on",
        )
    return JsonResponse({"success": True})


@permission_required("orgapy.change_objective")
def api_edit_objective(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequest()
    print(request.POST)
    if "delete" in request.POST:
        return api_delete_objective(request)
    objective_id = request.POST.get("id")
    objective_name = request.POST.get("name")
    objective_period = request.POST.get("period")
    objective_flexible = request.POST.get("flexible", "") == "on"
    if objective_id is None or objective_name is None or objective_period is None:
        raise BadRequest()
    try:
        objective_id = int(objective_id)
        objective_period = int(objective_period)
    except:
        raise BadRequest()
    if not Objective.objects.filter(id=objective_id, user=request.user).exists():
        raise Http404()
    objective = Objective.objects.get(id=objective_id, user=request.user)
    objective.name = objective_name
    objective.period = objective_period
    objective.flexible = objective_flexible
    objective.save()
    return JsonResponse({"success": True})


@permission_required("orgapy.change_objective")
def api_archive_objective(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequest()
    objective_id = request.POST.get("objective_id")
    if objective_id is None:
        raise BadRequest()
    try:
        objective_id = int(objective_id)
    except:
        raise BadRequest()
    if not Objective.objects.filter(id=objective_id, user=request.user).exists():
        raise Http404()
    objective = Objective.objects.get(id=objective_id, user=request.user)
    objective.archived = True
    objective.save()
    return JsonResponse({"success": True})


@permission_required("orgapy.change_objective")
def api_unarchive_objective(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequest()
    objective_id = request.POST.get("objective_id")
    if objective_id is None:
        raise BadRequest()
    try:
        objective_id = int(objective_id)
    except:
        raise BadRequest()
    if not Objective.objects.filter(id=objective_id, user=request.user).exists():
        raise Http404()
    objective = Objective.objects.get(id=objective_id, user=request.user)
    objective.archived = False
    objective.save()
    return JsonResponse({"success": True})


@permission_required("orgapy.delete_objective")
def api_delete_objective(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequest()
    objective_id = request.POST.get("id")
    if objective_id is None:
        raise BadRequest()
    try:
        objective_id = int(objective_id)
    except:
        raise BadRequest()
    if not Objective.objects.filter(id=objective_id, user=request.user).exists():
        raise Http404()
    Objective.objects.get(id=objective_id, user=request.user).delete()
    return JsonResponse({"success": True})


@permission_required("orgapy.change_objective")
def api_edit_objective_history(request: HttpRequest) -> HttpResponse:
    """Objective history must be a JSON string
    """
    if request.method != "POST":
        raise BadRequest()
    objective_id = request.POST.get("objective_id")
    objective_history = request.POST.get("objective_history")
    if objective_id is None or objective_history is None:
        raise BadRequest()
    try:
        objective_id = int(objective_id)
    except:
        raise BadRequest()
    if not Objective.objects.filter(id=objective_id, user=request.user).exists():
        raise Http404()

    objective = Objective.objects.get(id=objective_id, user=request.user)
    if isinstance(request.user, AnonymousUser):
        raise PermissionDenied()
    compare_objective_histories(request.user, objective.name, objective.history, objective_history)
    objective.history = objective_history
    objective.save()
    return JsonResponse({"success": True})


@permission_required("orgapy.view_calendar")
def api_list_calendars(request: HttpRequest) -> HttpResponse:
    events = []
    calendars = []
    calendar = None
    for calendar in Calendar.objects.filter(user=request.user):
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
def api_delete_calendar(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequest()
    href = request.POST.get("href")
    calendarid = request.POST.get("calendarid")
    if href is None or calendarid is None:
        raise BadRequest()
    if not Calendar.objects.filter(user=request.user, id=int(calendarid)).exists():
        raise Http404()
    calendar = Calendar.objects.get(user=request.user, id=int(calendarid))
    success = calendar.delete_event(href)
    return JsonResponse({"success": success})


@permission_required("orgapy.change_calendar")
def api_add_event(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequest()
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
        raise BadRequest()
    if not Calendar.objects.filter(user=request.user, id=int(calendarid)).exists():
        raise Http404()
    if location is not None and location.strip() == "":
        location = None
    dtstart = parse_dt(dtstart_date, dtstart_time)
    dtend = parse_dt(dtend_date, dtend_time)
    calendar = Calendar.objects.get(user=request.user, id=int(calendarid))
    success = calendar.add_event(title, dtstart, dtend, location, allday)
    return JsonResponse({"success": success})


@permission_required("orgapy.view_task")
def api_list_tasks(request: HttpRequest) -> HttpResponse:
    tasks = []
    limit = int(request.GET.get("limit", 5))
    max_start_date = timezone.now() + datetime.timedelta(days=limit)
    for task in Task.objects.filter(user=request.user, completed=False, start_date__lte=max_start_date):
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
def api_edit_task(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequest()
    task_id = request.POST.get("id")
    if task_id is None:
        raise BadRequest()
    task_title = request.POST.get("title")
    if task_title is None:
        raise BadRequest()
    task_start_date = request.POST.get("start_date")
    if task_start_date is None:
        raise BadRequest()
    task_due_date = request.POST.get("due_date")
    if task_due_date is not None and task_due_date.strip() == "":
        task_due_date = None
    task_recurring_mode = request.POST.get("recurring_mode")
    if task_recurring_mode is None:
        raise BadRequest()
    task_recurring_period = request.POST.get("recurring_period")
    if task_recurring_period is None:
        raise BadRequest()
    try:
        task_id = int(task_id)
        task_start_date = parse_date(task_start_date)
        if task_due_date is not None:
            task_due_date = parse_date(task_due_date)
        task_recurring_period = None if task_recurring_period.strip() == "" else int(task_recurring_period)
    except:
        raise BadRequest()
    if not Task.objects.filter(id=task_id, user=request.user).exists():
        raise Http404()
    task = Task.objects.get(id=task_id, user=request.user)
    task.title = task_title
    task.start_date = task_start_date
    task.due_date = task_due_date
    task.recurring_mode = task_recurring_mode
    task.recurring_period = task_recurring_period
    task.save()
    return JsonResponse({"success": True})


@permission_required("orgapy.add_task")
def api_add_task(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequest()
    task_title = request.POST.get("title")
    if task_title is None:
        raise BadRequest()
    task_start_date = request.POST.get("start_date")
    if task_start_date is None:
        raise BadRequest()
    task_due_date = request.POST.get("due_date")
    if task_due_date is not None and task_due_date.strip() == "":
        task_due_date = None
    task_recurring_mode = request.POST.get("recurring_mode")
    if task_recurring_mode is None:
        raise BadRequest()
    task_recurring_period = request.POST.get("recurring_period")
    if task_recurring_period is None:
        raise BadRequest()
    try:
        task_start_date = parse_date(task_start_date)
        if task_due_date is not None:
            task_due_date = parse_date(task_due_date)
        task_recurring_period = None if task_recurring_period.strip() == "" else int(task_recurring_period)
    except:
        raise BadRequest()
    Task.objects.create(
        user=request.user,
        title=task_title,
        start_date=task_start_date,
        due_date=task_due_date,
        recurring_mode=task_recurring_mode,
        recurring_period=task_recurring_period,
    )
    return JsonResponse({"success": True})


@permission_required("orgapy.delete_task")
def api_delete_task(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequest()
    task_id = request.POST.get("id")
    if task_id is None:
        raise BadRequest()
    try:
        task_id = int(task_id)
    except:
        raise BadRequest()
    if not Task.objects.filter(id=task_id, user=request.user).exists():
        raise Http404()
    Task.objects.get(id=task_id, user=request.user).delete()
    return JsonResponse({"success": True})


@permission_required("orgapy.edit_task")
def api_complete_task(request: HttpRequest) -> HttpResponse:
    if request.method != "POST":
        raise BadRequest()
    task_id = request.POST.get("id")
    if task_id is None:
        raise BadRequest()
    try:
        task_id = int(task_id)
    except:
        raise BadRequest()
    if not Task.objects.filter(id=task_id, user=request.user).exists():
        raise Http404()
    task = Task.objects.get(id=task_id, user=request.user)
    task.completed = True
    task.date_completion = timezone.now()
    task.save()
    ProgressLog.objects.create(
        user=request.user,
        type=ProgressLog.TASK_COMPLETED,
        description=task.title
    )
    if task.recurring_mode != Task.ONCE and task.recurring_period is not None:
        delta = None
        if task.recurring_mode == Task.DAILY:
            delta = datetime.timedelta(days=task.recurring_period)
        elif task.recurring_mode == Task.WEEKLY:
            delta = datetime.timedelta(weeks=task.recurring_period)
        elif task.recurring_mode == Task.MONTHLY:
            delta = dateutil.relativedelta.relativedelta(months=task.recurring_period)
        elif task.recurring_mode == Task.YEARLY:
            delta = dateutil.relativedelta.relativedelta(years=task.recurring_period)
        else:
            raise BadRequest()
        due_date = task.due_date
        start_date = task.start_date
        today = datetime.datetime.now().date()
        while task.recurring_period: # avoid infinite loop if recurring period is zero
            start_date += delta
            if due_date is not None:
                due_date += delta
            if start_date >= today:
                break
        Task.objects.create(
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
def api_note_title(request: HttpRequest) -> HttpResponse:
    object_id = request.GET.get("objectId")
    if object_id is None:
        raise BadRequest()
    query = Note.objects.filter(user=request.user, id=int(object_id))
    if not query.exists():
        raise Http404()
    return HttpResponse(query.get().title, content_type="text/plain")


@permission_required("orgapy.view_note")
def api_title(request: HttpRequest) -> HttpResponse:
    object_type = request.GET.get("type")
    object_id = request.GET.get("id")
    if object_type is None or object_id is None:
        raise BadRequest()
    query = None
    if object_type == "note":
        query = Note.objects.filter(user=request.user, id=int(object_id))
    elif object_type == "sheet":
        query = Sheet.objects.filter(user=request.user, id=int(object_id))
    elif object_type == "map":
        query = Map.objects.filter(user=request.user, id=int(object_id))
    else:
        raise BadRequest()
    if not query.exists():
        raise Http404()
    return HttpResponse(query.get().title, content_type="text/plain")


@permission_required("orgapy.change_note")
def api_edit_widgets(request: HttpRequest) -> HttpResponse:
    object_id = request.POST.get("object_id")
    updates = json.loads(request.POST.get("updates", "[]"))
    if object_id is None:
        raise BadRequest()
    query = Note.objects.filter(user=request.user, id=int(object_id))
    if not query.exists():
        raise Http404()
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
    note.date_modification = timezone.now()
    note.save()
    return JsonResponse({"success": True})


def api_sheet(request: HttpRequest) -> HttpResponse:
    sheet_id = request.GET.get("objectId")
    if sheet_id is None:
        raise BadRequest()
    sheet = find_object(Sheet, ["id", "nonce"], sheet_id)
    if request.user is not None and sheet.user == request.user and request.user.has_perm("orgapy.view_sheet") or sheet.public:
        return JsonResponse({
            "title": sheet.title,
            "data": sheet.data,
            "config": sheet.config,
            "modification": sheet.date_modification.timestamp(),
            "url": sheet.get_absolute_url(),
        })
    raise PermissionDenied()


@permission_required("orgapy.change_sheet")
def api_save_sheet(request: HttpRequest) -> HttpResponse:
    sheet_id = request.POST.get("object_id")
    if sheet_id is None:
        raise BadRequest()
    sheet_data = request.POST.get("data")
    sheet_config = request.POST.get("config")
    modification = float(request.POST.get("modification", 0))
    sheet = find_object(Sheet, "id", sheet_id, request.user)
    if sheet.date_modification.timestamp() > modification:
        return JsonResponse({"success": False, "reason": "Sheet has newer modifications"})
    sheet.data = sheet_data
    sheet.config = sheet_config
    sheet.date_modification = timezone.now()
    sheet.save()
    return JsonResponse({
        "success": True,
        "modification": sheet.date_modification.timestamp()
    })


def api_map(request: HttpRequest) -> HttpResponse:
    map_id = request.GET.get("objectId")
    if map_id is None:
        raise BadRequest()
    mmap = find_object(Map, ["id", "nonce"], map_id)
    if request.user is not None and mmap.user == request.user and request.user.has_perm("orgapy.view_map") or mmap.public:
        return JsonResponse({
            "title": mmap.title,
            "geojson": mmap.geojson,
            "config": mmap.config,
            "modification": mmap.date_modification.timestamp(),
            "url": mmap.get_absolute_url(),
        })
    raise PermissionDenied()


@permission_required("orgapy.change_map")
def api_save_map(request: HttpRequest) -> HttpResponse:
    map_id = request.POST.get("object_id")
    if map_id is None:
        raise BadRequest()
    map_title = request.POST.get("title")
    if map_title is None:
        raise BadRequest()
    map_geojson = request.POST.get("geojson")
    map_config = request.POST.get("config")
    modification = float(request.POST.get("modification", 0))
    mmap = find_object(Map, "id", map_id, request.user)
    if mmap.date_modification.timestamp() > modification:
        return JsonResponse({"success": False, "reason": "Map has newer modifications"})
    mmap.title = map_title
    mmap.geojson = map_geojson
    mmap.config = map_config
    mmap.date_modification = timezone.now()
    mmap.save()
    return JsonResponse({
        "success": True,
        "modification": mmap.date_modification.timestamp()
    })


def api_suggestions(request: HttpRequest) -> HttpResponse:
    query = request.GET.get("q", "").strip()
    results = []
    if len(query) >= 1:
        if request.user.has_perm("orgapy.view_note"):
            results += Note.objects.filter(user=request.user, title__startswith=query)[:5]
        if request.user.has_perm("orgapy.view_sheet"):
            results += Sheet.objects.filter(user=request.user, title__startswith=query)[:5]
        if request.user.has_perm("orgapy.view_map"):
            results += Map.objects.filter(user=request.user, title__startswith=query)[:5]
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
def api_progress(request: HttpRequest) -> HttpResponse:
    year = request.GET.get("year", str(datetime.datetime.now().year)).strip()
    query = ProgressCounter.objects.filter(user=request.user, year=int(year))
    try:
        counter = query.get()
    except ProgressCounter.DoesNotExist:
        raise Http404()
    return HttpResponse(counter.data, content_type="application/json")
