import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from orgapy import models


class Command(BaseCommand):
    """Print daily report."""
    help="Print daily report with today's tasks and incoming events."

    def add_arguments(self, parser):
        parser.add_argument("user", type=str, help="Username of concerned user")

    def handle(self, *args, **kwargs):
        today = timezone.now().date()
        messages = []
        for user_settings in models.Settings.objects.filter(user__username=kwargs["user"]):
            user = user_settings.user
            for task in models.Task.objects.filter(user=user, completed=False):
                if task.start_date == today or task.due_date == today:
                    messages.append(f"[TSK] {task.title}")
            for calendar in models.Calendar.objects.filter(user=user):
                for event in calendar.get_events(force=True):
                    event_start = datetime.datetime.strptime(event["dtstart"][:10], "%Y-%m-%d").date()
                    if event_start == today:
                        messages.append(f"[EVT] {event['title']}")
        if messages:
            print("\n".join(messages))
        else:
            print("Nothing to do.")
