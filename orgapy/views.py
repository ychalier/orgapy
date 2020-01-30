import re
import datetime
from dateutil.relativedelta import relativedelta
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect
from django.shortcuts import render
from django.utils.text import slugify
from django.core.paginator import Paginator
from django.db.models import Q
from django.db.models import F
from django.http import HttpResponse
from xhtml2pdf import pisa
import caldav
import icalendar
from visitors.monitor_visitors import monitor_visitors
from . import models


def find_title(base):
    """Smart title generator, that adds suffixes (1) (2) ... to avoid
       duplicates in the database.
    """
    candidate = base.strip()
    pattern = re.compile(r"\((\d+)\)$")
    if len(candidate) == 0:
        candidate = "Untitled"
    while models.Note.objects.filter(slug=slugify(candidate)).exists():
        suffix = pattern.search(candidate)
        if suffix is None:
            candidate += " (1)"
        else:
            candidate = pattern.sub(
                "(%d)" % (int(suffix.group(1)) + 1), candidate)
    return candidate


def parse_event(parsed):
    """Parse an Icalendar event"""
    event = dict()
    event["title"] = parsed.get("summary")
    event["location"] = parsed.get("location")
    event["dt_type"] = type(parsed.get("dtstart").dt) == datetime.datetime
    dtstart = parsed.get("dtstart").dt
    dtend = parsed.get("dtend").dt
    if not event["dt_type"]:
        dtstart = datetime.datetime.combine(
            dtstart, datetime.datetime.min.time())
        dtend = datetime.datetime.combine(dtend, datetime.datetime.min.time())
    if parsed.get("rrule") is not None:
        freq = parsed.get("rrule").get("freq")[0]
        delta = {
            "SECONDLY": datetime.timedelta(seconds=1),
            "MINUTELY": datetime.timedelta(minutes=1),
            "HOURLY": datetime.timedelta(hours=1),
            "DAILY": datetime.timedelta(days=1),
            "WEEKLY": datetime.timedelta(weeks=1),
            "MONTHLY": relativedelta(months=+1),
            "YEARLY": relativedelta(years=+1)
        }[freq]
        while dtend < datetime.datetime.now():
            dtstart += delta
            dtend += delta
    event["start_date"] = dtstart.date()
    event["start_time"] = dtstart.time()
    event["end_date"] = dtend.date()
    event["end_time"] = dtend.time()
    return event


def get_events():
    """Return upcoming events from CalDav server"""
    settings = models.CalDavSettings.load()
    if settings.host == "":
        return list()
    url = "%s://%s:%s@%s:%s" % (
        settings.protocol,
        settings.username,
        settings.password,
        settings.host,
        settings.port
    )
    event_list = list()
    client = caldav.DAVClient(url, ssl_verify_cert=False)
    principal = client.principal()
    calendars = principal.calendars()
    for calendar in calendars:
        for vevents in calendar.date_search(
                datetime.datetime.today(),
                datetime.datetime.today() + datetime.timedelta(days=7)
        ):
            for parsed in icalendar.Calendar.from_ical(vevents.data).walk("vevent"):
                event = parse_event(parsed)
                if event is not None:
                    event_list.append(event)
    events = dict()
    for event in event_list:
        events.setdefault(event["start_date"], list())
        events[event["start_date"]].append(event)
    for day in events:
        events[day].sort(key=lambda x: x["start_time"])
    return sorted(events.items(), key=lambda x: x[0])


@monitor_visitors
def about(request):
    """View for the homepage, describing the application for a new user."""
    return render(request, "orgapy/about.html", {})


@monitor_visitors
def blog(request):
    """View showing all published notes"""
    page_size = 50
    query = request.GET.get("query", "")
    category = request.GET.get("category", "")
    if len(query) > 0 and query[0] == "#":
        category = query[1:]
    base_objects = models.Publication.objects.all()
    if len(category) > 0:
        objects = base_objects.filter(categories__name__exact=category)
    elif len(query) > 0:
        objects = base_objects.filter(
            Q(note__title__contains=query)
            | Q(note__content__contains=query)
        )
    else:
        objects = base_objects
    paginator = Paginator(objects.order_by("-date_publication"), page_size)
    page = request.GET.get("page")
    publications = paginator.get_page(page)
    return render(request, "orgapy/blog.html", {
        "publications": publications,
    })


@login_required
def dashboard(request):
    """View containting the aggregation of notes and tasks."""
    notes = models.Note.objects\
        .filter(task=None)\
        .filter(~Q(categories__name__exact="quote"))\
        .order_by("-date_access", "-date_modification")[:6]
    tasks = models.Note.objects\
        .filter(
            task__isnull=False,
            task__done=False,
            task__date_due__isnull=False
        )\
        .order_by(
            F("task__date_due").asc(nulls_last=True),
            "-date_modification"
        )
    objectives = list()
    for objective in models.DailyObjective.objects.all().order_by("name"):
        if not objective.is_current_done():
            objective.freq = "daily"
            objectives.append(objective)
    for objective in models.WeeklyObjective.objects.all().order_by("name"):
        if not objective.is_current_done():
            objective.freq = "weekly"
            objectives.append(objective)
    return render(request, "orgapy/dashboard.html", {
        "notes": notes,
        "tasks": tasks,
        "events": get_events(),
        "objectives": objectives,
    })


@login_required
def view_notes(request):
    """View containing only the pure notes"""
    page_size = 50
    query = request.GET.get("query", "")
    category = request.GET.get("category", "")
    if len(query) > 0 and query[0] == "#":
        category = query[1:]
    base_objects = models.Note.objects.filter(task=None).filter(~Q(categories__name__exact="quote"))
    if len(category) > 0:
        objects = base_objects.filter(categories__name__exact=category)
    elif len(query) > 0:
        objects = base_objects.filter(
            Q(title__contains=query)
            | Q(content__contains=query)
        )
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
    })


@login_required
def view_tasks(request):
    """View containing only tasks"""
    notes = models.Note.objects\
        .filter(task__isnull=False)\
        .order_by(
            "task__date_done",
            F("task__date_due").asc(nulls_last=True),
            "date_creation"
        )
    daily_objectives = models.DailyObjective.objects.all().order_by("name")
    weekly_objectives = models.WeeklyObjective.objects.all().order_by("name")
    all_done = True
    for objective in daily_objectives:
        if not objective.is_current_done():
            all_done = False
            break
    for objective in weekly_objectives:
        if not objective.is_current_done():
            all_done = False
            break
    return render(request, "orgapy/tasks.html", {
        "tasks": notes,
        "daily_objectives": daily_objectives,
        "weekly_objectives": weekly_objectives,
        "all_done": all_done,
    })


@login_required
def view_note(request, slug):
    """View showing a note"""
    if not models.Note.objects.filter(slug=slug).exists():
        return redirect("orgapy:dashboard")
    note = models.Note.objects.get(slug=slug)
    return render(request, "orgapy/note.html", {
        "note": note,
    })


@login_required
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
        matches = re.finditer(r"^ ?- \[([xX ])\]", note.content, flags=re.MULTILINE)
        for index, match in enumerate(matches):
            if index != checkbox_id:
                continue
            note.content =\
                note.content[:match.start()]\
                + re.sub(r"\[[xX ]\]", replacement, match.group(0))\
                + note.content[match.end():]
            note.save()
            return redirect("orgapy:view_note", slug=note.slug)
    return redirect("orgapy:notes")


@monitor_visitors
def view_public_note(request, slug):
    """View showing a note to an anonymous user"""
    if not models.Note.objects.filter(slug=slug).exists():
        return redirect("orgapy:about")
    note = models.Note.objects.get(slug=slug)
    if not note.public:
        return redirect("orgapy:about")
    return render(request, "orgapy/note_public.html", {
        "note": note,
    })


@login_required
def create_note(request):
    """Create a new note"""
    categories_remain = models.Category.objects.all()
    return render(request, "orgapy/create_note.html", {
        "categories_remain": categories_remain,
    })


@login_required
def edit_note(request, slug):
    """View to edit a note"""
    if not models.Note.objects.filter(slug=slug).exists():
        return redirect("orgapy:dashboard")
    note = models.Note.objects.get(slug=slug)
    selection = set(category.id for category in note.categories.all())
    categories_remain = models.Category.objects.exclude(id__in=selection)
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
    new_title = request.POST.get("title", "").strip()
    if original_note is not None and original_note.title == new_title:
        title = original_note.title
    else:
        title = find_title(new_title)
    slug = slugify(title)
    content = request.POST.get("content", "").strip()
    is_public = "public" in request.POST
    if original_note is None:
        note = models.Note.objects.create(
            title=title,
            content=content,
            public=is_public,
            slug=slug,
        )
    else:
        note = original_note
        note.title = title
        note.content = content
        note.public = is_public
        note.slug = slug
        note.categories.clear()
    note.date_modification = datetime.datetime.now()
    note.save()
    return note


def save_note_categories(request, note):
    """Edit note procedure: Category objects"""
    for category_id in request.POST.getlist("categories"):
        category = models.Category.objects.get(id=int(category_id))
        note.categories.add(category)
    for dirty_name in request.POST.get("extra", "").split(";"):
        name = dirty_name.lower().strip()
        if name == "":
            continue
        if not models.Category.objects.filter(name=name).exists():
            category = models.Category.objects.create(name=name)
        else:
            category = models.Category.objects.get(name=name)
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


def save_note_publication(request, note):
    """Edit note procedure: Publication object"""
    is_published = "publication" in request.POST
    author = request.POST.get("author", "").strip()
    abstract = request.POST.get("abstract", "").strip()
    if is_published:
        note.public = True
        note.save()
        if hasattr(note, "publication"):
            publication = note.publication
            publication.author = author
            publication.abstract = abstract
        else:
            publication = models.Publication.objects.create(
                note=note,
                author=author,
                abstract=abstract
            )
        publication.save()
    elif hasattr(note, "publication"):
        note.publication.delete()


@login_required
def save_note(request):
    """Main procedure to edit a note"""
    if request.method == "POST":
        note = save_note_core(request)
        save_note_categories(request, note)
        save_note_task(request, note)
        save_note_publication(request, note)
        if "task" in request.POST:
            return redirect("orgapy:tasks")
        return redirect("orgapy:view_note", slug=note.slug)
    return redirect("orgapy:dashboard")


@login_required
def task_done(_, note_id):
    """View to indicate that a task has been done"""
    if models.Note.objects.filter(id=note_id).exists():
        task = models.Note.objects.get(id=note_id).task
        task.done = True
        task.date_done = datetime.datetime.now()
        task.save()
    return redirect("orgapy:tasks")


@login_required
def export_note(_, slug):
    """View to export a note's content as PDF"""
    if not models.Note.objects.filter(slug=slug).exists():
        return redirect("orgapy:notes")
    note = models.Note.objects.get(slug=slug)
    response = HttpResponse(content_type="application/pdf")
    response["Content-Disposition"] = "inline; filename=\"{}.pdf\"".format(
        slug)
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


@login_required
def delete_note(_, slug):
    """View to delete a note"""
    if models.Note.objects.filter(slug=slug).exists():
        note = models.Note.objects.get(slug=slug)
        had_task = hasattr(note, "task")
        note.delete()
        if had_task:
            return redirect("orgapy:tasks")
    return redirect("orgapy:notes")


@login_required
def publish_note(_, slug):
    """View to publish a note"""
    if models.Note.objects.filter(slug=slug).exists():
        note = models.Note.objects.get(slug=slug)
        if not hasattr(note, "publication"):
            models.Publication.objects.create(note=note)
    return redirect("orgapy:blog")


@login_required
def edit_objectives(request):
    """Edit daily and weekly objectives"""
    daily_objectives = models.DailyObjective.objects.all().order_by("name")
    weekly_objectives = models.WeeklyObjective.objects.all().order_by("name")
    return render(request, "orgapy/edit_objectives.html", {
        "daily_objectives": daily_objectives,
        "weekly_objectives": weekly_objectives
    })


def get_objective(freq, oid):
    """Search for a corresponding objective in the database"""
    if freq == "daily":
        if models.DailyObjective.objects.filter(id=oid).exists():
            return models.DailyObjective.objects.get(id=oid)
    elif freq == "weekly":
        if models.WeeklyObjective.objects.filter(id=oid).exists():
            return models.WeeklyObjective.objects.get(id=oid)
    return None


@login_required
def check_objective(_, freq, oid):
    """Set current objective to checked"""
    objective = get_objective(freq, oid)
    if objective is not None:
        objective.check_current()
    return redirect("orgapy:tasks")


@login_required
def uncheck_objective(_, freq, oid):
    """Set current objective to unchecked"""
    objective = get_objective(freq, oid)
    if objective is not None:
        objective.uncheck_current()
    return redirect("orgapy:tasks")


@login_required
def save_objective(request, freq, oid):
    """Change an objective's name"""
    if request.method == "POST":
        objective = get_objective(freq, oid)
        if objective is not None:
            objective.name = request.POST["name"].strip()
            objective.save()
    return redirect("orgapy:edit_objectives")


@login_required
def delete_objective(_, freq, oid):
    """Delete an objective"""
    objective = get_objective(freq, oid)
    if objective is not None:
        objective.delete()
    return redirect("orgapy:edit_objectives")


@login_required
def create_objective(request):
    """Create a new objective"""
    if request.method == "POST":
        name = request.POST["name"].strip()
        if request.POST["freq"] == "1":
            models.DailyObjective.objects.create(name=name)
        elif request.POST["freq"] == "2":
            models.WeeklyObjective.objects.create(name=name)
    return redirect("orgapy:edit_objectives")


@login_required
def view_quotes(request, author=None, work=None):
    page_size = 5
    query = request.GET.get("query", "")
    objects = models.Quote.objects.all()
    if author is not None:
        author = models.Author.objects.get(slug=author)
        objects = objects.filter(work__author=author)
    if work is not None:
        work = models.Work.objects.get(slug=work)
        objects = objects.filter(work=work)
    if len(query) > 0:
        objects = objects.filter(
            Q(title__contains=query)
            | Q(content__contains=query)
        )
    paginator = Paginator(objects.order_by(
        "-date_creation",
    ), page_size)
    page = request.GET.get("page")
    quotes = paginator.get_page(page)
    authors = models.Author.objects.all().order_by("name")
    return render(request, "orgapy/quotes.html", {
        "quotes": quotes,
        "query": query,
        "authors": authors,
        "author": author,
        "work": work,
    })


def add_note(work_id, content):
    work = models.Work.objects.get(id=work_id)
    title = find_title("%s - %s" % (work.author.name, work.title))
    slug = slugify(title)
    quote = models.Quote.objects.create(
        work=work,
        title=title,
        content=content,
        public=False,
        slug=slug,
    )
    if models.Category.objects.filter(name="quote").exists():
        category = models.Category.objects.get(name="quote")
    else:
        category = models.Category.objects.create(name="quote")
    quote.categories.add(category)
    quote.save()
    return quote


@login_required
def create_quote(request):
    if request.method == "POST":
        if "form_author" in request.POST:
            name = request.POST.get("author_name", "").strip()
            if len(name) > 0 and not models.Author.objects.filter(name=name).exists():
                models.Author.objects.create(name=name)
        elif "form_work" in request.POST:
            author_id = request.POST.get("work_author", "").strip()
            title = request.POST.get("work_title", "").strip()
            if len(title) > 0 and models.Author.objects.filter(id=author_id).exists():
                author = models.Author.objects.get(id=author_id)
                if not models.Work.objects.filter(author=author, title=title).exists():
                    models.Work.objects.create(author=author, title=title)
        elif "form_quote" or "form_quote_edit" in request.POST:
            work_id = request.POST.get("quote_work", "").strip()
            if models.Work.objects.filter(id=work_id).exists():
                add_note(work_id, request.POST.get("quote_content").strip())
        if "form_quote" in request.POST:
            return redirect("orgapy:quotes")
    authors = models.Author.objects.all().order_by("-date_creation")
    works = models.Work.objects.all().order_by("-date_creation")
    return render(request, "orgapy/create_quote.html", {
        "authors": authors,
        "works": works,
    })
