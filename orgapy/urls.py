from django.urls import path
from .views import base as views
from .views.api import api

app_name = "orgapy"

urlpatterns = [
    path("", views.view_landing, name="landing"),
    path("about", views.view_about, name="about"),
    path("home", views.view_home, name="home"),
    path("docs", views.view_documents, name="documents"),
    path("docs/snippet", views.view_document_snippet, name="document_snippet"), # TODO: merge with docs
    path("docs/<nonce>", views.view_document, name="document"),
    path("projects", views.view_projects, name="projects"),
    path("projects/<nonce>", views.view_project, name="project"),
    path("projects/<nonce>/delete", views.view_delete_project, name="delete_project"), # TODO: merge with projects
    path("categories", views.view_categories, name="categories"),
    path("categories/<name>", views.view_category, name="category"),
    path("progress", views.view_progress, name="progress"),
    path("progress/log/create", views.view_create_progress_log, name="create_progress_log"), # TODO: deprecated
    path("progress/log/save", views.view_save_progress_log, name="save_progress_log"), # TODO: deprecated
    path("progress/log/<object_id>", views.view_edit_progress_log, name="edit_progress_log"),
    path("progress/log/<object_id>/delete", views.view_delete_progress_log, name="delete_progress_log"), # TODO: deprecated
    path("settings", views.view_settings, name="settings"),
    path("settings/calendar", views.view_calendar_form, name="calendar_form"), # TODO: add custom view
    path("mood", views.view_mood, name="mood"),
    path("mood/<object_id>/delete", views.view_delete_mood_log, name="delete_mood_log"), # TODO: deprecated
    path("trash", views.view_trash, name="trash"),
    path("groceries", views.view_groceries, name="groceries"),
    path("tasks", views.view_tasks, name="tasks"),
    path("objectives", views.view_objectives, name="objectives"),
    path("suggestions", views.view_suggestions, name="suggestions"),
    path("api", api, name="api"), # TODO: deprecated
]
