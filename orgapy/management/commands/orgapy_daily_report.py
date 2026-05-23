import datetime
import json

from django.core.management.base import BaseCommand
from django.utils import timezone

from orgapy import models


class Command(BaseCommand):
    """Print daily report."""
    help="Print daily report with today's tasks and incoming events."

    def add_arguments(self, parser):
        parser.add_argument("user", type=str, help="Username of concerned user")
        parser.add_argument("--format", type=str, choices=["text", "json"], default="text")
        parser.add_argument("--update-events", action="store_true", help="Force calendar updates when fetching events")

    def handle(self, *args, **kwargs):
        today = timezone.now().date()
        items = []
        for user_settings in models.Settings.objects.filter(user__username=kwargs["user"]):
            user = user_settings.user
            if not user_settings.beach_mode:
                for task in models.Task.objects.filter(user=user, completed=False):
                    if task.start_date == today or task.due_date == today:
                        items.append({
                            "type": "task",
                            "label": task.title,
                            "start": str(task.start_date),
                            "due": None if not task.due_date else str(task.due_date)
                        })
            for calendar in models.Calendar.objects.filter(user=user):
                for event in calendar.get_events(force=kwargs["update_events"]):
                    event_start = datetime.datetime.strptime(event["dtstart"][:10], "%Y-%m-%d").date()
                    if event_start == today:
                        items.append({
                            "type": "event",
                            "label": event["title"],
                            "start": event.get("dtstart"),
                            "end": event.get("dtend"),
                            "location": event.get("location")
                        })
        if kwargs["format"] == "json":
            print(json.dumps({"items": items, "count": len(items)}))
            return
        if items:
            for item in items:
                short = {"task": "TSK", "event": "EVT"}[item["type"]]
                print(f"[{short}] {item["label"]}")
        else:
            print("Nothing to do.")
