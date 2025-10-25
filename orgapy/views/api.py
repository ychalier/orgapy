import datetime
import json
import re

import dateutil.relativedelta
from django.contrib.auth.decorators import permission_required
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import PermissionDenied, BadRequest
from django.db.models import Max
from django.http import HttpRequest, HttpResponse, Http404, JsonResponse
from django.utils import timezone

from ..models import Category, Note, Sheet, Map, ProgressCounter, ProgressLog, Calendar, Task, Project, Objective, PushSubscription
from ..utils import parse_dt, parse_date
from .utils import find_user_object, compare_checklists, compare_objective_histories


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
        case "search":
            return api_search(request)
        case "save-subscription":
            return api_save_subscription(request)
        case "rename-subscription":
            return api_rename_subscription(request)
        case _:
            raise BadRequest()


@permission_required("orgapy.view_project")
def api_list_projects(request: HttpRequest) -> JsonResponse:
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
def api_create_project(request: HttpRequest) -> JsonResponse:
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
def api_edit_project(request: HttpRequest) -> JsonResponse:
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
def api_edit_project_ranks(request: HttpRequest) -> JsonResponse:
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
def api_archive_project(request: HttpRequest) -> JsonResponse:
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
def api_unarchive_project(request: HttpRequest) -> JsonResponse:
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
def api_delete_project(request: HttpRequest) -> JsonResponse:
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
def api_list_objectives(request: HttpRequest) -> JsonResponse:
    show_archived = request.GET.get("archived", "0") == "1"
    objectives = []
    for objective in Objective.objects.filter(user=request.user):
        if not show_archived and objective.archived:
            continue
        objectives.append(objective.to_dict())
    return JsonResponse({"objectives": objectives})


@permission_required("orgapy.add_objective")
def api_add_objective(request: HttpRequest) -> JsonResponse:
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
def api_edit_objective(request: HttpRequest) -> JsonResponse:
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
def api_archive_objective(request: HttpRequest) -> JsonResponse:
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
def api_unarchive_objective(request: HttpRequest) -> JsonResponse:
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
def api_delete_objective(request: HttpRequest) -> JsonResponse:
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
def api_edit_objective_history(request: HttpRequest) -> JsonResponse:
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
def api_list_calendars(request: HttpRequest) -> JsonResponse:
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
def api_delete_calendar(request: HttpRequest) -> JsonResponse:
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
def api_add_event(request: HttpRequest) -> JsonResponse:
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
def api_list_tasks(request: HttpRequest) -> JsonResponse:
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
def api_edit_task(request: HttpRequest) -> JsonResponse:
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
def api_add_task(request: HttpRequest) -> JsonResponse:
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
def api_delete_task(request: HttpRequest) -> JsonResponse:
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
def api_complete_task(request: HttpRequest) -> JsonResponse:
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
    object_ids = request.GET.get("objectIds")        
    if object_id is not None:
        query = Note.objects.filter(user=request.user, id=int(object_id))
        if not query.exists():
            raise Http404()    
        return HttpResponse(query.get().title, content_type="text/plain")
    if object_ids is not None:
        titles: list[str | None] = []
        for object_id in object_ids.split(","):
            query = Note.objects.filter(user=request.user, id=int(object_id))
            if query.exists():
                titles.append(query.get().title)
            else:
                titles.append(None)
        return JsonResponse({"success": True, "titles": titles})
    raise BadRequest()


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
def api_edit_widgets(request: HttpRequest) -> JsonResponse:
    object_id = request.POST.get("objectId")
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


def api_sheet(request: HttpRequest) -> JsonResponse:
    sheet_id = request.GET.get("objectId")
    if sheet_id is None:
        raise BadRequest()
    sheet = find_user_object(Sheet, ["id", "nonce"], sheet_id)
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
def api_save_sheet(request: HttpRequest) -> JsonResponse:
    sheet_id = request.POST.get("objectId")
    if sheet_id is None:
        raise BadRequest()
    sheet_data = request.POST.get("data")
    sheet_config = request.POST.get("config")
    modification = float(request.POST.get("modification", 0))
    sheet = find_user_object(Sheet, "id", sheet_id, request.user)
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


def api_map(request: HttpRequest) -> JsonResponse:
    map_id = request.GET.get("objectId")
    if map_id is None:
        raise BadRequest()
    mmap = find_user_object(Map, ["id", "nonce"], map_id)
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
def api_save_map(request: HttpRequest) -> JsonResponse:
    map_id = request.POST.get("objectId")
    if map_id is None:
        raise BadRequest()
    map_title = request.POST.get("title")
    if map_title is None:
        raise BadRequest()
    map_geojson = request.POST.get("geojson")
    map_config = request.POST.get("config")
    modification = float(request.POST.get("modification", 0))
    mmap = find_user_object(Map, "id", map_id, request.user)
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


@permission_required("orgapy.view_note")
@permission_required("orgapy.view_sheet")
@permission_required("orgapy.view_map")
def api_suggestions(request: HttpRequest) -> JsonResponse:
    query = request.GET.get("q", "").strip()
    object_type = request.GET.get("t")
    results = []
    if len(query) >= 1:
        if query.startswith("#"):
            results += Category.objects.filter(user=request.user, name__startswith=query[1:])[:5]
        else:
            if (object_type is None or object_type == "note") and request.user.has_perm("orgapy.view_note"):
                results += Note.objects.filter(user=request.user, deleted=False, hidden=False, title__startswith=query)[:5]
            if (object_type is None or object_type == "sheet") and request.user.has_perm("orgapy.view_sheet"):
                results += Sheet.objects.filter(user=request.user, deleted=False, hidden=False, title__startswith=query)[:5]
            if (object_type is None or object_type == "map") and request.user.has_perm("orgapy.view_map"):
                results += Map.objects.filter(user=request.user, deleted=False, hidden=False, title__startswith=query)[:5]
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


@permission_required("orgapy.view_note")
@permission_required("orgapy.view_sheet")
@permission_required("orgapy.view_map")
def api_search(request: HttpRequest) -> JsonResponse:
    search_type = request.GET.get("type")
    if search_type is None:
        models = [Note, Sheet, Map]
    elif search_type == "notes":
        models = [Note]
    elif search_type == "sheets":
        models = [Sheet]
    elif search_type == "maps":
        models = [Map]
    else:
        raise BadRequest()
    search_query = request.GET.get("query")
    search_category = request.GET.get("category")
    objects = []
    for model in models:
        query = model.objects.filter(user=request.user, deleted=False, hidden=False)
        if search_query is not None:
            query = query.filter(title__contains=search_query)
        if search_category is not None:
            query = query.filter(categories__name__exact=search_category)
        for obj in query:
            objects.append({
                "id": obj.id,
                "dateCreation": int(1000 * obj.date_creation.timestamp()),
                "dateModification": int(1000 * obj.date_modification.timestamp()),
                "title": obj.title,
                "href": obj.get_absolute_url(),
                "active": obj.active,
            })
    return JsonResponse({"objects": objects, "success": True})


@permission_required("orgapy.create_push_subscription")
def api_save_subscription(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        raise BadRequest()
    PushSubscription.objects.create(
        user=request.user,
        subscription=request.POST.get("subscription", ""))
    return JsonResponse({"success": True})


@permission_required("orgapy.change_push_subscription")
def api_rename_subscription(request: HttpRequest) -> JsonResponse:
    if request.method != "POST" or "id" not in request.POST:
        raise BadRequest()
    object_id = int(request.POST["id"])
    sub = find_user_object(PushSubscription, "id", object_id, request.user)
    new_name = request.POST.get("value")
    if new_name is not None:
        sub.name = new_name.strip()
        sub.save()
    return JsonResponse({"success": True})
