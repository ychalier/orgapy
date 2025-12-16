import json
import re
import urllib.parse
from typing import Literal, TypeVar

from django.contrib.auth.models import AbstractBaseUser, AnonymousUser
from django.core.exceptions import PermissionDenied, BadRequest
from django.core.paginator import Page, Paginator
from django.db.models import QuerySet, Q
from django.http import HttpRequest, Http404, HttpResponse
from django.shortcuts import redirect, render
from django.utils import timezone

from ..models import Settings, Category, Note, Sheet, Map, ProgressLog, Document, PushSubscription


UserObject = TypeVar("UserObject", Category, Note, Sheet, Map, ProgressLog, PushSubscription)
DocumentT = TypeVar("DocumentT", Note, Sheet, Map)
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


def find_user_object(
        model: type[UserObject],
        key: str | list[str],
        value: int | str,
        required_user: LoggedUser | AnonymousUser | None = None,
        allow_deleted: bool = False,
        ) -> UserObject:
    fields = [key] if isinstance(key, str) else key
    try:
        int(value)
    except ValueError:
        fields.remove("id")
    if not fields:
        raise BadRequest()
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
    history_before = json.loads(before)
    history_after = json.loads(after)
    for _ in range(len(history_after) - len(history_before)):
        ProgressLog.objects.create(
            user=user,
            type=ProgressLog.OBJECTIVE_COMPLETED,
            description=name
        )


class ConflictError(Exception):
    pass


def save_document_core(
        request: HttpRequest,
        model: type[DocumentT],
        specific_fields: list[str] = []) -> DocumentT:
    original = None
    if "id" in request.POST and model.objects.filter(id=request.POST["id"]).exists():
        original = model.objects.get(id=request.POST["id"])
        if original.date_modification.timestamp() > float(request.POST.get("modification", 0)):
            raise ConflictError()
    if original is not None and original.user != request.user:
        raise PermissionDenied()
    title = request.POST.get("title", "").strip()
    kwargs = {}
    for field in specific_fields:
        kwargs[field] = request.POST.get(field, "").strip()
    is_public = "public" in request.POST
    is_pinned = "pinned" in request.POST
    is_hidden = "hidden" in request.POST
    if original is None:
        obj = model.objects.create(
            user=request.user,
            title=title,
            public=is_public,
            pinned=is_pinned,
            hidden=is_hidden,
            **kwargs
        )
    else:
        obj = original
        obj.title = title
        obj.public = is_public
        obj.pinned = is_pinned
        obj.hidden = is_hidden
        for field, value in kwargs.items():
            setattr(obj, field, value)
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
        elif name == "uncategorized":
            raise BadRequest()
        else:
            category = Category.objects.create(name=name, user=request.user)
        obj.categories.add(category)
    obj.date_modification = timezone.now()
    obj.save()
    return obj


def get_or_create_settings(user: LoggedUser) -> Settings:
    query = Settings.objects.filter(user=user)
    if query.exists():
        return query.get()
    return Settings.objects.create(user=user)


def select_documents(
        request: HttpRequest,
        model: type[DocumentT],
        base: QuerySet[DocumentT] | None = None,
        **boolattrs: bool,
        ) -> tuple[QuerySet[DocumentT], dict]:
    if base is None:
        documents = model.objects.filter(user=request.user)
    else:
        documents = base.filter(user=request.user)
    attrs = {}
    query = request.GET.get("query", "")
    attrs["query"] = query
    hidden_is_set = False
    deleted_is_set = False
    for boolattr in ["hidden", "public", "pinned", "deleted"]:
        if boolattr in request.GET or boolattr in boolattrs:
            if boolattr == "hidden":
                hidden_is_set = True
            elif boolattr == "deleted":
                deleted_is_set = True
            if boolattr in request.GET:
                filter_value = bool(int(request.GET[boolattr]))
                query_value = request.GET[boolattr]
            else:
                filter_value = boolattrs[boolattr]
                query_value = str(int(boolattrs[boolattr]))
            documents = documents.filter(**{boolattr: filter_value})
            attrs[boolattr] = query_value
        elif boolattr == query:
            if boolattr == "hidden":
                hidden_is_set = True
            query = query.replace(boolattr, "")
            documents = documents.filter(**{boolattr: True})
    if not hidden_is_set:
        documents = documents.exclude(hidden=True)
    if not deleted_is_set:
        documents = documents.exclude(deleted=True)
    if query:
        category_pattern = re.compile(r"#([a-zA-Z0-9]+)")
        spaces_pattern = re.compile(r" +")
        for name in category_pattern.findall(query):
            if name == "uncategorized":
                documents = documents.filter(categories__isnull=True)
            else:
                documents = documents.filter(categories__name__exact=name)
        query = spaces_pattern.sub(" ", category_pattern.sub("", query)).strip()
        if query:
            if model == Note:
                documents = documents.filter(Q(title__icontains=query) | Q(content__icontains=query))
            elif model == Sheet:
                documents = documents.filter(Q(title__icontains=query) | Q(data__icontains=query))
            else:
                documents = documents.filter(title__icontains=query)
    return documents, attrs


def render_documents(
        request: HttpRequest,
        documents: QuerySet[DocumentT] | list[Note | Sheet | Map],
        template_name: str,
        attrs: dict,
        page_size: int = 24,
        **kwargs):
    mixed = isinstance(documents, list)
    paginator = Paginator(documents, page_size)
    page = request.GET.get("page")
    objects = paginator.get_page(page)
    return render(request, template_name, {
        "mixed": mixed,
        "objects": objects,
        "query": attrs.get("query", ""),
        "paginator": pretty_paginator(objects, **attrs),
        **kwargs
    })


def view_documents_single(
        request: HttpRequest,
        model: type[DocumentT],
        template_name: str,
        active: str,
        ) -> HttpResponse:
    documents, attrs = select_documents(request, model)
    documents = documents.order_by(
        "-pinned",
        "-date_modification",
        "-date_access",
    )
    return render_documents(request, documents, template_name, attrs, active=active)


def view_documents_mixed(request: HttpRequest, template_name: str, category: Category | Literal["uncategorized"] | None = None, **boolargs: bool) -> HttpResponse:
    base_notes = base_sheets = base_maps = None
    if isinstance(category, Category):
        base_notes = category.notes.all() # type: ignore
        base_sheets = category.sheets.all() # type: ignore
        base_maps = category.maps.all() # type: ignore
        category_arg = category
    elif category == "uncategorized":
        base_notes = Note.objects.filter(categories__isnull=True)
        base_sheets = Sheet.objects.filter(categories__isnull=True)
        base_maps = Map.objects.filter(categories__isnull=True)
        category_arg = {
            "name": "uncategorized",
            "id": -1
        }
    else:
        category_arg = category
    notes, attrs = select_documents(request, Note, base_notes, **boolargs)
    sheets, _ = select_documents(request, Sheet, base_sheets, **boolargs)
    maps, _ = select_documents(request, Map, base_maps, **boolargs)
    documents = list(notes) + list(sheets) + list(maps)
    documents.sort(key=lambda document: (document.pinned, document.date_modification, document.date_access), reverse=True)
    return render_documents(request, documents, template_name, attrs, category=category_arg)


def toggle_object_attribute(request: HttpRequest, active: str, object_id: str, attrname: str) -> HttpResponse:
    try:
        model = {"notes": Note, "sheets": Sheet, "maps": Map}[active]
    except KeyError:
        raise BadRequest()
    obj: Note | Sheet | Map = find_user_object(model, "id", object_id, request.user)
    setattr(obj, attrname, not getattr(obj, attrname, False))
    obj.save()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect(obj.get_absolute_url())
