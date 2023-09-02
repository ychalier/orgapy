from django.urls import path
from . import views

app_name = "orgapy"

urlpatterns = [
    path("about", views.about, name="about"),
    path("create-note", views.create_note, name="create_note"),
    path("save-note", views.save_note, name="save_note"),
    path("note/<nid>", views.view_note, name="view_note"),
    path("note/<nid>/edit", views.edit_note, name="edit_note"),
    path("note/<nid>/export", views.export_note, name="export_note"),
    path("note/<nid>/delete", views.delete_note, name="delete_note"),
    path("note/<nid>/pin", views.toggle_pin, name="toggle_pin"),
    path("note/<nid>/public", views.toggle_public, name="toggle_public"),
    path("", views.view_notes, name="notes"),
    path("notes", views.view_notes, name="notes_2"),
    path("public/<nid>", views.view_public_note, name="view_public_note"),
    path("tasks", views.view_tasks, name="tasks"),
    path("task/<note_id>/done", views.task_done, name="task_done"),
    path("objectives", views.view_objectives, name="objectives"),
    path("objective/<oid>/check", views.check_objective, name="check_objective"),
    path("objective/<oid>/uncheck", views.uncheck_objective, name="uncheck_objective"),
    path("objective/<oid>/save", views.save_objective, name="save_objective"),
    path("objective/<oid>/delete", views.delete_objective, name="delete_objective"),
    path("objective/create", views.create_objective, name="create_objective"),
    path("objective/edit", views.edit_objectives, name="edit_objectives"),
    path("quotes", views.view_quotes, name="quotes"),
    path("quotes/<author>", views.view_quotes, name="quotes_author"),
    path("quotes/<author>/<work>", views.view_quotes, name="quotes_work"),
    path("create-quote", views.create_quote, name="create_quote"),
    path("checkbox", views.checkbox, name="checkbox"),
    path("categories", views.view_categories, name="categories"),
    path("categories/<cid>/edit", views.edit_category, name="edit_category"),
    path("categories/<cid>/delete", views.delete_category, name="delete_category"),
    path("api/suggestions", views.api_suggestions, name="api_suggestions"),
]
