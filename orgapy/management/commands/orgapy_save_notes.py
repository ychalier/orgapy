from django.core.management.base import BaseCommand

from orgapy import models

class Command(BaseCommand):
    """Manually (re)save all notes."""
    help="Manually call all notes save function."
    
    def add_arguments(self, parser):
        pass
    
    def handle(self, *args, **kwargs):
        notes = list(models.Note.objects.all())
        n = len(notes)
        for i, note in enumerate(notes):
            print(f"[{i+1}/{n}] {note.title}")
            note.save()
    