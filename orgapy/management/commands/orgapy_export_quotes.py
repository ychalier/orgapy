import json

from django.core.management.base import BaseCommand

from orgapy import models


class Command(BaseCommand):
    """Export quotes to JSON"""
    help = "Export quotes to JSON"

    def add_arguments(self, parser):
        parser.add_argument("path", type=str)

    def handle(self, *args, **kwargs):
        data = []
        for quote in models.Quote.objects.all():
            data.append({
                "user_id": quote.user.id,
                "date_creation": quote.date_creation,
                "date_modification": quote.date_modification,
                "title": quote.title,
                "content": quote.content,
                "work_id": quote.work.id
            })
        with open(kwargs["path"], "w", encoding="utf8") as file:
            json.dump(data, file, indent=4, default=str)
