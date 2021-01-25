import re
import datetime
import pytz
from dateutil.relativedelta import relativedelta
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect
from django.shortcuts import render
from django.utils.text import slugify
from django.core.paginator import Paginator
from django.db.models import Q
from django.db.models import F
from django.http import HttpResponse
from django.core.exceptions import PermissionDenied
from piweb.decorators import require_app_access
from piweb.utils import pretty_paginator
from xhtml2pdf import pisa
from . import models


def get_note_from_nid(nid, required_user=None):
    if not models.Note.objects.filter(id=nid).exists():
        raise Http404("Note does not exist")
    note = models.Note.objects.get(id=nid)
    if required_user is not None and note.user != required_user:
        raise PermissionDenied
    return note


def about(request):
    """View for the homepage, describing the application for a new user."""
    return render(request, "orgapy/about.html", {})


@require_app_access("orgapy")
def view_notes(request):
    """View containing only the pure notes"""
    page_size = 25
    query = request.GET.get("query", "")
    category = request.GET.get("category", "")
    if len(query) > 0 and query[0] == "#":
        category = query[1:]
    base_objects = models.Note.objects.filter(~Q(categories__name__exact="quote"), task=None, user=request.user)
    if len(category) > 0:
        objects = base_objects.filter(categories__name__exact=category)
    elif len(query) > 0:
        objects = base_objects.filter(Q(title__contains=query) | Q(content__contains=query))
    else:
        objects = base_objects
    paginator = Paginator(objects.order_by(
        "-date_access",
        "-date_modification"
    ), page_size)
    page = request.GET.get("page")
    notes = paginator.get_page(page)
    return render(request, "orgapy/notes.html", {
        "notes": notes,
        "query": query,
        "category": category,
        "note_paginator": pretty_paginator(notes, query=query),
        "active": "notes",
    })


@require_app_access("orgapy")
def view_tasks(request):
    """View containing only tasks"""
    notes = models.Note.objects\
        .filter(task__isnull=False, user=request.user)\
        .order_by("task__date_done", F("task__date_due").asc(nulls_last=True), "date_creation")
    daily_objectives = models.DailyObjective.objects\
        .filter(user=request.user)\
        .order_by("name")
    weekly_objectives = models.WeeklyObjective.objects\
        .filter(user=request.user)\
        .order_by("name")
    all_done = True
    for objective in daily_objectives:  
        if not objective.is_current_done():
            all_done = False
            break
    for objective in weekly_objectives:
        if not objective.is_current_done():
            all_done = False
            break

    objective_grid_offset = max(0, int(datetime.datetime.now().date().strftime("%V")) - 2) * 236 + 1
    return render(request, "orgapy/tasks.html", {
        "tasks": notes,
        "daily_objectives": daily_objectives,
        "weekly_objectives": weekly_objectives,
        "objectives": list(weekly_objectives) + list(daily_objectives),
        "all_done": all_done,
        "active": "tasks",
        "objective_grid_offset": objective_grid_offset,
    })


@require_app_access("orgapy")
def view_note(request, nid):
    """View showing a note"""
    note = get_note_from_nid(nid, request.user)
    return render(request, "orgapy/note.html", {
        "note": note,
    })


@require_app_access("orgapy")
def checkbox(request):
    if request.method == "POST":
        note_id = request.POST["note_id"]
        checkbox_id = int(request.POST["checkbox_id"])
        checkbox_state = request.POST["checkbox_state"]
        replacement = {
            "true": "[x]",
            "false": "[ ]",
        }[checkbox_state]
        note = models.Note.objects.get(id=note_id)
        if note.user != request.user:
            raise PermissionDenied
        matches = re.finditer(r"^ ?- \[([xX ])\]", note.content, flags=re.MULTILINE)
        for index, match in enumerate(matches):
            if index != checkbox_id:
                continue
            note.content =\
                note.content[:match.start()]\
                + re.sub(r"\[[xX ]\]", replacement, match.group(0))\
                + note.content[match.end():]
            note.save()
            return redirect("orgapy:view_note", nid=note.id)
    return redirect("orgapy:notes")


def view_public_note(request, nid):
    """View showing a note to an anonymous user"""
    note = get_note_from_nid(nid)
    if not note.public:
        raise PermissionDenied
    return render(request, "orgapy/note_public.html", {
        "note": note,
    })


@require_app_access("orgapy")
def create_note(request):
    """Create a new note"""
    categories_remain = models.Category.objects.filter(user=request.user)
    return render(request, "orgapy/create_note.html", {
        "categories_remain": categories_remain,
    })


@require_app_access("orgapy")
def edit_note(request, nid):
    """View to edit a note"""
    note = get_note_from_nid(nid, request.user)
    selection = set(category.id for category in note.categories.all())
    categories_remain = models.Category.objects.exclude(user=request.user, id__in=selection)
    return render(request, "orgapy/edit_note.html", {
        "note": note,
        "categories_selection": note.categories.all().order_by("name"),
        "categories_remain": categories_remain.order_by("name"),
    })


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
    if original_note is None:
        note = models.Note.objects.create(
            user=request.user,
            title=title,
            content=content,
            public=is_public,
        )
    else:
        note = original_note
        note.title = title
        note.content = content
        note.public = is_public
        note.categories.clear()
    note.date_modification = datetime.datetime.now()
    note.save()
    return note


def save_note_categories(request, note):
    """Edit note procedure: Category objects"""
    for category_id in request.POST.getlist("categories"):
        category = models.Category.objects.get(id=int(category_id), user=request.user)
        note.categories.add(category)
    for dirty_name in request.POST.get("extra", "").split(";"):
        name = dirty_name.lower().strip()
        if name == "":
            continue
        if not models.Category.objects.filter(name=name, user=request.user).exists():
            category = models.Category.objects.create(name=name, user=request.user)
        else:
            category = models.Category.objects.get(name=name, user=request.user)
        note.categories.add(category)
    note.save()


def save_note_task(request, note):
    """Edit note procedure: Task object"""
    is_task = "task" in request.POST
    is_done = "done" in request.POST
    date_due = request.POST.get("due", "")
    if is_task:
        if len(date_due) == 10:
            date_due = datetime.datetime.strptime(date_due, "%Y-%m-%d").date()
        else:
            date_due = None
        if hasattr(note, "task"):
            task = note.task
            task.date_due = date_due
            if is_done and not task.done:
                task.date_done = datetime.datetime.now()
            task.done = is_done
            if not is_done:
                task.date_done = None
        else:
            task = models.Task.objects.create(
                date_due=date_due,
                note=note,
                done=is_done,
            )
            if is_done:
                task.date_done = datetime.datetime.now()
        task.save()
    elif hasattr(note, "task"):
        note.task.delete()


@require_app_access("orgapy")
def save_note(request):
    """Main procedure to edit a note"""
    if request.method == "POST":
        note = save_note_core(request)
        save_note_categories(request, note)
        save_note_task(request, note)
        if "task" in request.POST:
            return redirect("orgapy:tasks")
        return redirect("orgapy:view_note", nid=note.id)
    raise PermissionDenied


@require_app_access("orgapy")
def task_done(request, note_id):
    """View to indicate that a task has been done"""
    task = get_note_from_nid(note_id, request.user).task
    task.done = True
    task.date_done = datetime.datetime.now()
    task.save()
    return redirect("orgapy:tasks")


@require_app_access("orgapy")
def export_note(request, nid):
    """View to export a note's content as PDF"""
    # TODO: move this to a Markdown tool package for Piweb
    note = get_note_from_nid(nid, request.user)
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = "inline; filename=\"{}.pdf\"".format(slugify(note.title))
    html = """
    <html>
        <head>
            <style>
                @page {
                    margin: 2.5cm;
                }
            </style>
            <title>%s</title>
        </head>
        <body>
            <h1>%s</h1>
            %s
        </body>
    </html>
    """ % (note.title, note.title, note.markdown())
    pisa_status = pisa.CreatePDF(html, dest=response)
    if pisa_status.err:
        return HttpResponse(
            "We had some errors with code {} <pre>{}</pre>"
            .format(pisa_status.err, html)
        )
    return response


@require_app_access("orgapy")
def delete_note(request, nid):
    """View to delete a note"""
    note = get_note_from_nid(nid, request.user)
    had_task = hasattr(note, "task")
    note.delete()
    if had_task:
        return redirect("orgapy:tasks")
    return redirect("orgapy:notes")


@require_app_access("orgapy")
def edit_objectives(request):
    """Edit daily and weekly objectives"""
    daily_objectives = models.DailyObjective.objects.filter(user=request.user).order_by("name")
    weekly_objectives = models.WeeklyObjective.objects.filter(user=request.user).order_by("name")
    return render(request, "orgapy/edit_objectives.html", {
        "daily_objectives": daily_objectives,
        "weekly_objectives": weekly_objectives
    })


def get_objective(request, freq, oid):
    """Search for a corresponding objective in the database"""
    if freq == "daily":
        if models.DailyObjective.objects.filter(id=oid, user=request.user).exists():
            return models.DailyObjective.objects.get(id=oid, user=request.user)
    elif freq == "weekly":
        if models.WeeklyObjective.objects.filter(id=oid, user=request.user).exists():
            return models.WeeklyObjective.objects.get(id=oid, user=request.user)
    return None


@require_app_access("orgapy")
def check_objective(request, freq, oid):
    """Set current objective to checked"""
    objective = get_objective(request, freq, oid)
    if objective is not None:
        objective.check_current()
    return redirect("orgapy:tasks")


@require_app_access("orgapy")
def uncheck_objective(request, freq, oid):
    """Set current objective to unchecked"""
    objective = get_objective(request, freq, oid)
    if objective is not None:
        objective.uncheck_current()
    return redirect("orgapy:tasks")


@require_app_access("orgapy")
def save_objective(request, freq, oid):
    """Change an objective's name"""
    if request.method == "POST":
        objective = get_objective(request, freq, oid)
        if objective is not None:
            objective.name = request.POST["name"].strip()
            objective.save()
    return redirect("orgapy:edit_objectives")


@require_app_access("orgapy")
def delete_objective(request, freq, oid):
    """Delete an objective"""
    objective = get_objective(request, freq, oid)
    if objective is not None:
        objective.delete()
    return redirect("orgapy:edit_objectives")


@require_app_access("orgapy")
def create_objective(request):
    """Create a new objective"""
    if request.method == "POST":
        name = request.POST["name"].strip()
        if request.POST["freq"] == "1":
            models.DailyObjective.objects.create(name=name, user=request.user)
        elif request.POST["freq"] == "2":
            models.WeeklyObjective.objects.create(name=name, user=request.user)
    return redirect("orgapy:edit_objectives")


@require_app_access("orgapy")
def view_quotes(request, author=None, work=None):
    page_size = 10
    query = request.GET.get("query", "")
    objects = models.Quote.objects.filter(user=request.user)
    if author is not None:
        author = models.Author.objects.get(slug=author, user=request.user)
        objects = objects.filter(work__author=author)
    if work is not None:
        work = models.Work.objects.get(slug=work, user=request.user)
        objects = objects.filter(work=work)
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


def add_note(request, work_id, content):
    work = models.Work.objects.get(id=work_id)
    title = "%s - %s" % (work.author.name, work.title)
    quote = models.Quote.objects.create(
        user=request.user,
        work=work,
        title=title,
        content=content,
        public=False,
    )
    if models.Category.objects.filter(name="quote").exists():
        category = models.Category.objects.get(name="quote", user=request.user)
    else:
        category = models.Category.objects.create(name="quote", user=request.user)
    quote.categories.add(category)
    quote.save()
    return quote


@require_app_access("orgapy")
def create_quote(request):
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
                add_note(request, work_id, request.POST.get("quote_content").strip())
        if "form_quote" in request.POST:
            return redirect("orgapy:quotes")
    authors = models.Author.objects.filter(user=request.user).order_by("-date_creation")
    works = models.Work.objects.filter(user=request.user).order_by("-date_creation")
    return render(request, "orgapy/create_quote.html", {
        "authors": authors,
        "works": works,
    })
