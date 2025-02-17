from django.urls import path
from . import views

app_name = "orgapy"

urlpatterns = [
    path("", views.view_landing, name="landing"),
    path("about", views.view_about, name="about"),
    path("projects", views.view_projects, name="projects"),
    path("search", views.view_search, name="search"),
    path("notes", views.view_notes, name="notes"),
    path("notes/create", views.view_create_note, name="create_note"),
    path("notes/save", views.view_save_note, name="save_note"),
    path("notes/categories", views.view_categories, name="categories"),
    path("notes/categories/<cid>/edit", views.view_edit_category, name="edit_category"),
    path("notes/categories/<cid>/delete", views.view_delete_category, name="delete_category"),
    path("notes/<nid>", views.view_note, name="note"),
    path("notes/<nid>/edit", views.view_edit_note, name="edit_note"),
    path("notes/<nid>/export", views.view_export_note, name="export_note"),
    path("notes/<nid>/delete", views.view_delete_note, name="delete_note"),
    path("notes/<nid>/pin", views.view_toggle_note_pin, name="toggle_note_pin"),
    path("notes/<nid>/public", views.view_toggle_note_public, name="toggle_note_public"),
    path("quotes", views.view_quotes, name="quotes"),
    path("quotes/create", views.view_create_quote, name="create_quote"),
    path("quotes/search", views.view_quotes_search, name="quotes_search"),
    path("quotes/<qid>", views.view_quote, name="quote"),
    path("sheets", views.view_sheets, name="sheets"),
    path("sheets/create", views.view_create_sheet, name="create_sheet"),
    path("sheets/save", views.view_save_sheet, name="save_sheet"),
    path("sheets/group/create", views.view_create_sheet_group, name="create_sheet_group"),
    path("sheets/group/save", views.view_save_sheet_group, name="save_sheet_group"),
    path("sheets/group/<sid>", views.view_sheet_group, name="sheet_group"),
    path("sheets/group/<sid>/edit", views.view_edit_sheet_group, name="edit_sheet_group"),
    path("sheets/group/<sid>/delete", views.view_delete_sheet_group, name="delete_sheet_group"),
    path("sheets/<sid>", views.view_sheet, name="sheet"),
    path("sheets/<sid>/edit", views.view_edit_sheet, name="edit_sheet"),
    path("sheets/<sid>/export", views.view_export_sheet, name="export_sheet"),
    path("sheets/<sid>/delete", views.view_delete_sheet, name="delete_sheet"),
    path("sheets/<sid>/public", views.view_toggle_sheet_public, name="toggle_sheet_public"),
    path("maps", views.view_maps, name="maps"),
    path("maps/create", views.view_create_map, name="create_map"),
    path("maps/save", views.view_save_map, name="save_map"),
    path("maps/<mid>", views.view_map, name="map"),
    path("maps/<mid>/export", views.view_export_map, name="export_map"),
    path("maps/<mid>/delete", views.view_delete_map, name="delete_map"),
    path("maps/<mid>/public", views.view_toggle_map_public, name="toggle_map_public"),
    path("api", views.api, name="api"),
]
