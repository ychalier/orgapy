from django.core.management.base import BaseCommand

from orgapy import models

class Command(BaseCommand):
    """Set map categories without updating dates."""
    help="Set map categories without updating dates"

    def add_arguments(self, parser):
        parser.add_argument("-i", "--input", type=str, default=None)

    def handle(self, *args, **kwargs):
        if kwargs["input"] is None:
            print("To proceed, you must provide a TSV file with at least 2 columns: id, categories for each entry.")
            print("Categories can be separated by commas.")
            print("This script will generate a sample for you.")
            data = []
            for doc in models.Map.objects.all():
                categories = ",".join(c.name for c in doc.categories.all())
                group_name = ""
                data.append((doc.id, categories, doc.title, group_name))
            with open("maps.tsv", "w", encoding="utf8") as file:
                file.write("id\tcategories\ttitle\n")
                file.write("\n".join("\t".join(map(str, row)) for row in data))
            return
        data = {}
        with open(kwargs["input"], "r", encoding="utf8") as file:
            for line in file.read().split("\n")[1:]:
                doc_id, names, *_ = line.split("\t")
                data[int(doc_id)] = names.strip().split(",")
        for doc_id, names in data.items():
            doc = models.Map.objects.get(id=doc_id)
            dates = (doc.date_creation, doc.date_modification, doc.date_access)
            doc.categories.clear()
            for name in names:
                if not name:
                    continue
                category, _ = models.Category.objects.get_or_create(user=doc.user, name=name)
                doc.categories.add(category)
            models.Map.objects.filter(id=doc_id).update(
                date_creation=dates[0],
                date_modification=dates[1],
                date_access=dates[2])
