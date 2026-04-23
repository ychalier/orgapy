import datetime
import json
import re

from django.contrib.auth.decorators import permission_required
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import PermissionDenied, BadRequest
from django.http import HttpRequest, HttpResponse, Http404, JsonResponse
from django.utils import timezone
from django.urls import reverse

from ..models import Category, Document, Calendar, Objective, MoodLog
from ..utils import parse_dt, parse_date
from .utils import compare_objective_histories, get_or_create_settings


def api(request: HttpRequest) -> HttpResponse:
    action = request.GET.get("action")
    match action:
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
        case "reference":
            return api_reference(request)
        case "edit-widgets":
            return api_edit_widgets(request)
        case "suggestions":
            return api_suggestions_documents(request)
        case "suggestions-notes":
            return api_suggestions_notes(request)
        case "suggestions-sheets":
            return api_suggestions_sheets(request)
        case "suggestions-maps":
            return api_suggestions_maps(request)
        case "suggestions-categories":
            return api_suggestions_categories(request)
        case "list-groceries":
            return api_list_groceries(request)
        case "save-groceries":
            return api_save_groceries(request)
        case "create-groceries-list":
            return api_create_groceries_list(request)
        case _:
            raise BadRequest(f"Unknown action '{action}'")


#TODO DEPRECATED
@permission_required("orgapy.view_objective")
def api_list_objectives(request: HttpRequest) -> JsonResponse:
    show_archived = request.GET.get("archived", "0") == "1"
    objectives = []
    for objective in Objective.objects.filter(user=request.user):
        if not show_archived and objective.archived:
            continue
        objectives.append(objective.to_dict())
    return JsonResponse({"objectives": objectives})


#TODO DEPRECATED
@permission_required("orgapy.add_objective")
def api_add_objective(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        raise BadRequest("Wrong method")
    objective_name = request.POST.get("name")
    objective_period = request.POST.get("period")
    if objective_name is None or objective_period is None:
        raise BadRequest("Missing objective name or period")
    try:
        objective_period = float(objective_period)
    except:
        raise BadRequest("Wrong period")
    Objective.objects.create(
        user=request.user,
        name=objective_name,
        period=objective_period,
        flexible=request.POST.get("flexible", "") == "on",
        )
    return JsonResponse({"success": True})


#TODO DEPRECATED
@permission_required("orgapy.change_objective")
def api_edit_objective(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        raise BadRequest("Wrong method")
    if "delete" in request.POST:
        return api_delete_objective(request)
    objective_id = request.POST.get("id")
    objective_name = request.POST.get("name")
    objective_period = request.POST.get("period")
    objective_flexible = request.POST.get("flexible", "") == "on"
    if objective_id is None or objective_name is None or objective_period is None:
        raise BadRequest("Missing objective id, name or period")
    try:
        objective_id = int(objective_id)
        objective_period = int(objective_period)
    except:
        raise BadRequest("Wrong objective id or period")
    if not Objective.objects.filter(id=objective_id, user=request.user).exists():
        raise Http404()
    objective = Objective.objects.get(id=objective_id, user=request.user)
    objective.name = objective_name
    objective.period = objective_period
    objective.flexible = objective_flexible
    objective.save()
    return JsonResponse({"success": True})


def get_objective_from_post(request: HttpRequest) -> Objective:
    if request.method != "POST":
        raise BadRequest("Wrong method")
    objective_id = request.POST.get("objective_id")
    if objective_id is None:
        raise BadRequest("Missing objective id")
    try:
        objective_id = int(objective_id)
    except:
        raise BadRequest("Wrong objective id")
    if not Objective.objects.filter(id=objective_id, user=request.user).exists():
        raise Http404()
    return Objective.objects.get(id=objective_id, user=request.user)


#TODO DEPRECATED
@permission_required("orgapy.change_objective")
def api_archive_objective(request: HttpRequest) -> JsonResponse:
    objective = get_objective_from_post(request)
    objective.archived = True
    objective.save()
    return JsonResponse({"success": True})


#TODO DEPRECATED
@permission_required("orgapy.change_objective")
def api_unarchive_objective(request: HttpRequest) -> JsonResponse:
    objective = get_objective_from_post(request)
    objective.archived = False
    objective.save()
    return JsonResponse({"success": True})


#TODO DEPRECATED
@permission_required("orgapy.delete_objective")
def api_delete_objective(request: HttpRequest) -> JsonResponse:
    objective = get_objective_from_post(request)
    objective.delete()
    return JsonResponse({"success": True})


#TODO DEPRECATED
@permission_required("orgapy.change_objective")
def api_edit_objective_history(request: HttpRequest) -> JsonResponse:
    """Objective history must be a JSON string
    """
    objective = get_objective_from_post(request)
    objective_history = request.POST.get("objective_history")
    if  objective_history is None:
        raise BadRequest("Missing objective history")
    if isinstance(request.user, AnonymousUser):
        raise PermissionDenied()
    compare_objective_histories(request.user, objective.name, objective.history, objective_history)
    objective.history = objective_history
    objective.save()
    return JsonResponse({"success": True})


#TODO DEPRECATED
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


#TODO DEPRECATED
@permission_required("orgapy.change_calendar")
def api_delete_calendar(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        raise BadRequest("Wrong method")
    href = request.POST.get("href")
    calendarid = request.POST.get("calendarid")
    if href is None or calendarid is None:
        raise BadRequest("Missing href or calendarid")
    if not Calendar.objects.filter(user=request.user, id=int(calendarid)).exists():
        raise Http404()
    calendar = Calendar.objects.get(user=request.user, id=int(calendarid))
    success = calendar.delete_event(href)
    return JsonResponse({"success": success})


#TODO DEPRECATED
@permission_required("orgapy.change_calendar")
def api_add_event(request: HttpRequest) -> JsonResponse:
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
        raise BadRequest("Missing title or some date")
    if not Calendar.objects.filter(user=request.user, id=int(calendarid)).exists():
        raise Http404()
    if location is not None and location.strip() == "":
        location = None
    dtstart = parse_dt(dtstart_date, dtstart_time)
    dtend = parse_dt(dtend_date, dtend_time)
    calendar = Calendar.objects.get(user=request.user, id=int(calendarid))
    success = calendar.add_event(title, dtstart, dtend, location, allday)
    return JsonResponse({"success": success})


def api_reference(request: HttpRequest) -> HttpResponse:
    note_nonces = request.GET.getlist("note")
    sheet_nonces = request.GET.getlist("sheet")
    map_nonces = request.GET.getlist("map")
    results = []
    for nonces, doctype in ((note_nonces, "note"), (sheet_nonces, "sheet"), (map_nonces, "map")):
        for nonce in nonces:
            result = {"type": doctype, "nonce": nonce, "title": None, "href": None, "error": None}
            if isinstance(request.user, AnonymousUser):
                result["error"] = "Forbidden"
            else:
                try:
                    doc = Document.objects.get(user=request.user, nonce=nonce)
                    result["title"] = doc.title
                    result["href"] = doc.get_absolute_url()
                except ValueError:
                    result["error"] = "Invalid ID"
                except Document.DoesNotExist:
                    result["error"] = "Not Found"
                except Exception:
                    result["error"] = "Error"
            results.append(result)
    return JsonResponse({"success": True, "results": results})


@permission_required("orgapy.change_document")
def api_edit_widgets(request: HttpRequest) -> JsonResponse:
    nonce = request.POST.get("nonce")
    updates = json.loads(request.POST.get("updates", "[]"))
    if nonce is None:
        raise BadRequest("Missing nonce")
    query = Document.objects.filter(user=request.user, nonce=nonce)
    if not query.exists():
        raise Http404()
    doc = query.get()
    if doc.content is None:
        return JsonResponse({"success": False, "reason": "Document has no content"})
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
            for i, widget_match in enumerate(re.finditer(regex, doc.content)):
                if i != widget_index:
                    continue
                start, end = widget_match.span(0)
                text = doc.content
                doc.content = text[:start] + widget_value + text[end:]
                break
        elif widget_type == "checkbox":
            for i, widget_match in enumerate(re.finditer(r"^ *- \[(x| )\]", doc.content, re.MULTILINE)):
                if i != widget_index:
                    continue
                start, end = widget_match.span(1)
                text = doc.content
                if widget_value:
                    widget_value = "x"
                else:
                    widget_value = " "
                doc.content = text[:start] + widget_value + text[end:]
                break
    doc.date_modification = timezone.now()
    doc.save()
    return JsonResponse({"success": True})


#TODO DEPRECATED
@permission_required("orgapy.view_document")
def api_suggestions_documents(request: HttpRequest, doctype: str | None = None) -> JsonResponse:
    query = request.GET.get("q", "").strip()
    if doctype is None:
        doctype = request.GET.get("t")
    results: list[Category | Document] = []
    if len(query) >= 1:
        if query.startswith("#"):
            results = list(Category.objects.filter(user=request.user, name__startswith=query[1:])[:5])
        elif doctype:
            results = list(Document.objects.filter(user=request.user, deleted=False, hidden=False, type=doctype, title__startswith=query)[:5])
        else:
            results = list(Document.objects.filter(user=request.user, deleted=False, hidden=False, title__startswith=query)[:5])
    return JsonResponse({
        "results": [
            {
                "nonce": result.nonce if isinstance(result, Document) else result.name,
                "title": result.title,
                "url": result.get_absolute_url(),
                "type": getattr(result, "type", None)
            }
            for result in results
        ]
    })

#TODO DEPRECATED
@permission_required("orgapy.view_document")
def api_suggestions_notes(request: HttpRequest) -> JsonResponse:
    return api_suggestions_documents(request, "note")

#TODO DEPRECATED
@permission_required("orgapy.view_document")
def api_suggestions_sheets(request: HttpRequest) -> JsonResponse:
    return api_suggestions_documents(request, "sheet")

#TODO DEPRECATED
@permission_required("orgapy.view_document")
def api_suggestions_maps(request: HttpRequest) -> JsonResponse:
    return api_suggestions_documents(request, "map")

#TODO DEPRECATED
@permission_required("orgapy.view_category")
def api_suggestions_categories(request: HttpRequest) -> JsonResponse:
    query = request.GET.get("q", "").strip()
    results = Category.objects.filter(user=request.user, name__startswith=query)[:5]
    return JsonResponse({
        "results": [
            {
                "nonce": result.name,
                "title": result.title,
                "url": result.get_absolute_url(),
                "type": getattr(result, "type", None)
            }
            for result in results
        ]
    })


#TODO DEPRECATED, GET TO GROCERIES
@permission_required("orgapy.view_settings")
def api_list_groceries(request: HttpRequest) -> JsonResponse:
    if isinstance(request.user, AnonymousUser):
        raise PermissionDenied()
    settings = get_or_create_settings(request.user)
    return JsonResponse(settings.groceries)


#TODO DEPRECATED, POST TO GROCERIES
@permission_required("orgapy.change_settings")
def api_save_groceries(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        raise BadRequest("Wrong method")
    if isinstance(request.user, AnonymousUser):
        raise PermissionDenied()
    settings = get_or_create_settings(request.user)
    settings.groceries_data = request.POST.get("groceries")
    settings.save()
    return JsonResponse({"success": True})


#TODO DEPRECATED, POST TO GROCERIES
@permission_required("orgapy.change_settings")
def api_create_groceries_list(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        raise BadRequest("Wrong method")
    if isinstance(request.user, AnonymousUser):
        raise PermissionDenied()
    groceries_data = json.loads(request.POST.get("groceries", "{}"))
    items: list[tuple[str, str]] = []
    for section_data in groceries_data.get("sections", []):
        for item_data in section_data.get("items", []):
            if item_data.get("checked"):
                items.append((section_data.get("label", "Unnamed section"), item_data.get("label", "Unnamed item")))
            item_data["checked"] = False

    settings = get_or_create_settings(request.user)
    settings.groceries_data = json.dumps(groceries_data)
    settings.save()

    try:
        cat = Category.objects.get(user=request.user, name="groceries")
    except Category.DoesNotExist:
        cat = Category.objects.create(user=request.user, name="groceries")
    old_section = None
    note_content = ""
    for section_label, item_label in items:
        if section_label != old_section:
            note_content += f"\n**{section_label}**\n\n"
            old_section = section_label
        note_content += f"- [ ] {item_label}\n"
    note = Document.objects.create(
        user=request.user,
        title=f"Shopping list {datetime.datetime.now().strftime("%b, %d")}",
        content=note_content.strip(),
        type="note"
    )
    note.date_creation = datetime.datetime.now()
    note.save()
    note.categories.add(cat)
    return JsonResponse({
        "success": True,
        "next": reverse("orgapy:note", args=[note.id])
    })
