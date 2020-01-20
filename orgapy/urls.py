from django.urls import path
from . import views

app_name = "orgapy"

urlpatterns = [
    path("", views.about, name="about"),
    path("dashboard", views.dashboard, name="dashboard"),
    path("create-note", views.create_note, name="create_note"),
    path("save-note", views.save_note, name="save_note"),
    path("note/<slug>", views.view_note, name="view_note"),
    path("note/<slug>/edit", views.edit_note, name="edit_note"),
    path("note/<slug>/export", views.export_note, name="export_note"),
    path("note/<slug>/delete", views.delete_note, name="delete_note"),
    path("note/<slug>/publish", views.publish_note, name="publish_note"),
    path("notes", views.view_notes, name="notes"),
    path("public/<slug>", views.view_public_note, name="view_public_note"),
    path("tasks", views.view_tasks, name="tasks"),
    path("task/<note_id>/done", views.task_done, name="task_done"),
    path("blog", views.blog, name="blog"),
]
