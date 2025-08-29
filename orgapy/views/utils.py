import json
import re
import urllib.parse
from typing import TypeVar

from django.contrib.auth.models import AbstractBaseUser, AnonymousUser
from django.core.exceptions import PermissionDenied, BadRequest
from django.core.paginator import Page, Paginator
from django.db.models import Q
from django.http import HttpRequest, Http404, HttpResponse
from django.shortcuts import redirect, render
from django.utils import timezone

from ..models import Settings, Category, Note, Quote, Sheet, Map, ProgressLog


UserObject = TypeVar("UserObject", Category, Note, Quote, Sheet, Map, ProgressLog)
CategorizedObject = TypeVar("CategorizedObject", Note, Sheet, Map)
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


class ConflictError(Exception):
    pass


def save_object_core(
        request: HttpRequest,
        model: type[CategorizedObject],
        specific_fields: list[str] = []) -> CategorizedObject:
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
        "active": env_name
    })


def toggle_object_attribute(request: HttpRequest, active: str, object_id: str, attrname: str) -> HttpResponse:
    try:
        model = {"notes": Note, "sheets": Sheet, "maps": Map}[active]
    except KeyError:
        raise BadRequest()
    obj: Note | Sheet | Map = find_object(model, "id", object_id, request.user)
    setattr(obj, attrname, not getattr(obj, attrname, False))
    obj.save()
    if "next" in request.GET:
        return redirect(request.GET["next"])
    return redirect(obj.get_absolute_url())
