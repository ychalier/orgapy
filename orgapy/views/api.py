import json
import re

from django.contrib.auth.decorators import permission_required
from django.contrib.auth.models import AnonymousUser
from django.core.exceptions import BadRequest
from django.http import HttpRequest, HttpResponse, Http404, JsonResponse
from django.utils import timezone

from ..models import Category, Document


def api(request: HttpRequest) -> HttpResponse:
    action = request.GET.get("action")
    match action:
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
        case _:
            raise BadRequest(f"Unknown action '{action}'")


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
