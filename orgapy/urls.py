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
    path("projects/<project_id>", views.view_project, name="project"),
    path("categories", views.view_categories, name="categories"),
    path("categories/<name>", views.view_category, name="category"),
    path("progress", views.view_progress, name="progress"),
    path("progress/<log_id>", views.view_progress_log, name="progress_log"),
    path("settings", views.view_settings, name="settings"),
    path("settings/calendar", views.view_calendar_form, name="calendar_form"), # TODO: add custom view
    path("mood", views.view_mood, name="mood"),
    path("mood/<log_id>", views.view_mood_log, name="mood_log"),
    path("trash", views.view_trash, name="trash"),
    path("groceries", views.view_groceries, name="groceries"),
    path("tasks", views.view_tasks, name="tasks"),
    path("tasks/<task_id>", views.view_task, name="task"),
    path("objectives", views.view_objectives, name="objectives"),
    path("objectives/<objective_id>", views.view_objective, name="objective"),
    path("suggestions", views.view_suggestions, name="suggestions"),
    path("api", api, name="api"), # TODO: deprecated
]
