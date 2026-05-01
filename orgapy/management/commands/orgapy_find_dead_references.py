import re

from django.core.management.base import BaseCommand

from orgapy import models


class Command(BaseCommand):
    """Find dead references in documents."""
    help="Find dead references in documents"

    def handle(self, *args, **kwargs):
        valid_nonces = set((doc.type, doc.nonce) for doc in models.Document.objects.all())
        pattern = re.compile(r"@(?:embed)?(note|sheep|map)/([a-zA-Z0-9]+)")
        for doc in models.Document.objects.filter(content__isnull=False):
            assert doc.content is not None
            for ref_type, ref_nonce in pattern.findall(doc.content):
                if (ref_type, ref_nonce) not in valid_nonces:
                    print(f"Broken reference: @{ref_type}/{ref_nonce} in {doc}")
