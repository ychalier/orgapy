# Generated by Django 5.0.7 on 2024-10-10 08:39

import orgapy.models
from django.db import migrations


def generate_nonces(apps, schema_editor):
    for row in apps.get_model("orgapy", "Note").objects.all():
        row.nonce = orgapy.models.generate_nonce()
        row.save(update_fields=["nonce"])
    for row in apps.get_model("orgapy", "Sheet").objects.all():
        row.nonce = orgapy.models.generate_nonce()
        row.save(update_fields=["nonce"])
    for row in apps.get_model("orgapy", "Map").objects.all():
        row.nonce = orgapy.models.generate_nonce()
        row.save(update_fields=["nonce"])


class Migration(migrations.Migration):

    dependencies = [
        ('orgapy', '0033_map_nonce_note_nonce_sheet_nonce'),
    ]

    operations = [
        migrations.RunPython(generate_nonces, reverse_code=migrations.RunPython.noop)
    ]
