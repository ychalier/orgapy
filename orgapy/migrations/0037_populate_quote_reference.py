from django.db import migrations


def populate_reference(apps, schema_editor):
    for quote in apps.get_model("orgapy", "Quote").objects.all():
        quote.reference = f"{quote.from_work.author.name}, *{quote.from_work.title}*"
        quote.save(update_fields=["reference"])


class Migration(migrations.Migration):

    dependencies = [
        ('orgapy', '0036_quote_reference'),
    ]

    operations = [
        migrations.RunPython(populate_reference, reverse_code=migrations.RunPython.noop)
    ]
