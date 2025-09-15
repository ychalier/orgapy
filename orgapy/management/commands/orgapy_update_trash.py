import datetime

from django.core.management.base import BaseCommand
from django.utils import timezone

from orgapy import models


class Command(BaseCommand):
    """Check all items in trash, and delete old ones."""
    help="Check all items in trash, and delete old ones"

    def add_arguments(self, parser):
        parser.add_argument("-d", "--dry-run", action="store_true", help="Print items to delete instead of actually deleting them")

    def handle(self, *args, **kwargs):
        for settings in models.Settings.objects.all():
            limit = timezone.now() - datetime.timedelta(days=settings.trash_period)
            if kwargs["dry_run"]:
                print("Limit date:", limit)
            for model in [models.Note, models.Sheet, models.Map]:
                objects = model.objects.filter(user=settings.user, deleted=True, date_deletion__lt=limit)
                if kwargs["dry_run"]:
                    print(model, objects)
                else:
                    objects.delete()
