from django.urls import path
from . import views

app_name = "orgapy"

urlpatterns = [
    path("", views.home, name="home"),
]
