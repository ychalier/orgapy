import sqlite3
from django.core.management.base import BaseCommand
from django.utils.text import slugify
from orgapy import models


class Command(BaseCommand):
    """Load old database"""
    help = "Load old database"

    def add_arguments(self, parser):
        parser.add_argument(
            "filename",
            type=str,
            help="Path to the old database."
        )

    def handle(self, *args, **kwargs):
        filename = kwargs["filename"]
        connection = sqlite3.connect(filename)
        cursor = connection.cursor()
        print("Loading notes")
        categories = dict()
        for category_id, name in cursor.execute("SELECT id, name FROM notes_category"):
            if models.Category.objects.filter(name=name).exists():
                categories[category_id] = models.Category.objects.get(
                    name=name)
            else:
                categories[category_id] = models.Category.objects.create(
                    name=name)
        print("Loaded %d categories" % len(categories))
        notes = list(cursor.execute(
            "SELECT id, title, content, date_modification, public FROM notes_note"))
        for i, note in enumerate(notes):
            note_id, title, content, date_modification, public = note
            print("%d/%d: %s" % (i + 1, len(notes), title))
            if models.Note.objects.filter(title=title).exists():
                continue
            note = models.Note.objects.create(
                title=title,
                content=content,
                date_modification=date_modification,
                public=public,
                slug=slugify(title)
            )
            for category_id in cursor.execute(
                    "SELECT category_id FROM notes_note_categories WHERE note_id=?",
                    (note_id,)):
                note.categories.add(categories[category_id[0]])
        print("Done loading notes")
        connection.close()
