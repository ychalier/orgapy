import sqlite3
from django.core.management.base import BaseCommand
from orgapy import models
from orgapy import views


class Command(BaseCommand):
    """Load quotes"""
    help = "Load quotes"

    def add_arguments(self, parser):
        parser.add_argument(
            "filename",
            type=str,
            help="Path to the quote database."
        )

    def handle(self, *args, **kwargs):
        filename = kwargs["filename"]
        connection = sqlite3.connect(filename)
        cursor = connection.cursor()
        print("Loading authors")
        authors = dict()
        for author_id, name in cursor.execute("SELECT id, name FROM private_author"):
            print(name)
            if models.Author.objects.filter(name=name).exists():
                author = models.Author.objects.get(name=name)
            else:
                author = models.Author.objects.create(name=name)
            authors[author_id] = author
        print("Loading works")
        works = dict()
        for work_id, author_id, title in cursor.execute("SELECT id, author_id, title FROM private_work"):
            author = authors[author_id]
            print(author.name, "-", title)
            if models.Work.objects.filter(author=author, title=title).exists():
                work = models.Work.objects.get(author=author, title=title)
            else:
                work = models.Work.objects.create(author=author, title=title)
            works[work_id] = work
        print("Loading quotes")
        for work_id, date_creation, content in cursor.execute("SELECT work_id, date_creation, text FROM private_quote"):
            quote = views.add_note(works[work_id].id, content)
            quote.date_creation = date_creation
            quote.save()
        print("Done loading quotes")
        connection.close()
