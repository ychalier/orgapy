import json

from django.core.management.base import BaseCommand
from django.conf import settings
from pywebpush import WebPushException, webpush

from orgapy import models


class Command(BaseCommand):
    """Send push notifications."""
    help="Send push notifications"

    def add_arguments(self, parser):
        parser.add_argument("-d", "--dry-run", action="store_true", help="Print notifications instead of actually sending them")

    def handle(self, *args, **kwargs):
        for user_settings in models.Settings.objects.all():
            user = user_settings.user
            payload = {
                "title": "Orgapy",
                "body": "This is a test notification!"
            }
            for sub in models.PushSubscription.objects.filter(user=user):
                try:
                    if kwargs["dry_run"]:
                        print(sub, payload)
                    else:
                        webpush(
                            subscription_info=json.loads(sub.subscription),
                            data=json.dumps(payload),
                            vapid_private_key=settings.VAPID_PRIVATE_KEY,
                            vapid_claims={"sub": settings.VAPID_SUB},
                        )
                except WebPushException as err:
                    self.stdout.write(self.style.ERROR(f"PUSH failed: {err}"))
