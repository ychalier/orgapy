import datetime
import json

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

from orgapy import models


class Command(BaseCommand):
    """Export quotes to JSON"""
    help = "Export quotes to JSON"

    def add_arguments(self, parser):
        parser.add_argument("path", type=str)

    def handle(self, *args, **kwargs):
        with open(kwargs["path"], "r", encoding="utf8") as file:
            data = json.load(file) 
        models.Quote.objects.all().delete()
        for entry_data in data:
            user = User.objects.get(id=entry_data["user_id"])
            work = models.Work.objects.get(id=entry_data["work_id"])
            date_creation = datetime.datetime.fromisoformat(entry_data["date_creation"])
            date_modification = datetime.datetime.fromisoformat(entry_data["date_modification"])
            models.Quote.objects.create(
                user=user,
                from_work=work,
                date_creation=date_creation,
                date_modification=date_modification,
                title=entry_data["title"],
                content=entry_data["content"],
            )
        
