import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from orgapy import models


class Command(BaseCommand):
    """Print daily report."""
    help="Print daily report with today's tasks and incoming events."

    def handle(self, *args, **kwargs):
        today = timezone.now().date()
        for user_settings in models.Settings.objects.all():
            user = user_settings.user
            messages = []
            for task in models.Task.objects.filter(user=user, completed=False):
                if task.start_date == today or task.due_date == today:
                    messages.append(f"Task: {task.title}")
            for calendar in models.Calendar.objects.filter(user=user):
                for event in calendar.get_events(force=True):
                    event_start = datetime.datetime.strptime(event["dtstart"][:10], "%Y-%m-%d").date()
                    if event_start == today:
                        messages.append(f"Event: {event['title']}")
            if not messages:
                continue
            print("\n".join(messages))
