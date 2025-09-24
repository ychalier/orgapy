from django.core.management.base import BaseCommand

from orgapy import models


class Command(BaseCommand):
    """Force refresh of all calendars."""
    help="Force refresh of all calendars"

    def add_arguments(self, parser):
        pass

    def handle(self, *args, **kwargs):
        for calendar in models.Calendar.objects.all():
            calendar.fetch_events()
