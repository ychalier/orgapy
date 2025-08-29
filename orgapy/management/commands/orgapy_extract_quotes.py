import re

from django.core.management.base import BaseCommand

from orgapy import models

class Command(BaseCommand):
    """Convert quotes to notes and delete quotes. Parses the quote reference to group quotes."""
    help="Convert quotes to notes and delete quotes. Parses the quote reference to group quotes."

    def add_arguments(self, parser):
        parser.add_argument("-i", "--input", type=str, default=None)

    def handle(self, *args, **kwargs):
        if kwargs["input"] is None:
            print("To proceed, you must provide a TSV file with 4 columns: id,author,work,location for each quote.")
            print("This script will generate a sample for you, at 'quotes.tsv'")
            quotes = models.Quote.objects.all()
            pattern_author = re.compile(r"^([A-Za-z'éêëç0-9 \-,&]+?\.|[A-Za-z'éêëç0-9 \-&]+?,)")
            page_pattern = re.compile(r" p\.? [A-Z\d]+\.?$")
            data = []
            for quote in quotes:
                ref = quote.reference
                author = ""
                m = pattern_author.search(ref)
                if m is not None:
                    author = m.group(0)[:-1]
                    ref = ref[len(author)+2:].strip()
                page = ""
                m = page_pattern.search(ref)
                if m is not None:
                    page = m.group(0)
                    ref = ref[:-len(m.group(0))]
                work = re.sub(r"\*(.*)\*", r"\1", ref)
                data.append((quote.id, author.strip(" ,."), work.strip(" ,."), page.strip(" ,.")))
            with open("quotes.tsv", "w", encoding="utf8") as file:
                file.write("id\tauthor\twork\tlocation\n")
                file.write("\n".join("\t".join(map(str, row)) for row in data))
            return
        data = {}
        with open(kwargs["input"], "r", encoding="utf8") as file:
            for line in file.read().split("\n")[1:]:
                quote_id, author, work, *location = line.split("\t")
                location = None if len(location) == 0 else location[0].strip()
                quote_id = int(quote_id)
                title = f"{author} - {work}"
                data.setdefault(title, [])
                data[title].append((quote_id, location))
        for title, quote_list in data.items():
            print(title)
            quotes = []
            for quote_id, location in quote_list:
                quote = models.Quote.objects.get(id=quote_id)
                quotes.append((quote, location))
            date_creation = min([q[0].date_creation for q in quotes])
            user = quotes[0][0].user
            quote_category, _ = models.Category.objects.get_or_create(user=user, name="quote")
            content = ""
            for quote, location in sorted(quotes, key=lambda x: x[0].date_creation):
                if location is not None:
                    content += f"*{location}*\n"
                content += "> " + re.sub("\n", "\n> ", quote.content)
                content += "\n\n"
            content = content.strip()
            note = models.Note(
                user=user,
                date_creation=date_creation,
                date_modification=date_creation,
                date_access=date_creation,
                title=title,
                content=content,
                public=False,
                pinned=False,
                hidden=False,
            )
            note.save()
            note.categories.add(quote_category)
            models.Note.objects.filter(id=note.id).update(
                date_creation=date_creation,
                date_modification=date_creation,
                date_access=date_creation)