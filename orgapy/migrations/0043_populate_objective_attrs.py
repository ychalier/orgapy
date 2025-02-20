import json
import math

from django.db import migrations


def populate_attributes(apps, schema_editor):
    for objective in apps.get_model("orgapy", "Objective").objects.all():
        rules = json.loads(objective.rules)
        objective.flexible = rules["type"] == "flexible"
        objective.period = math.ceil(rules["period"])
        objective.save(update_fields=["flexible", "period"])


class Migration(migrations.Migration):

    dependencies = [
        ('orgapy', '0042_objective_flexible_objective_period'),
    ]

    operations = [
        migrations.RunPython(populate_attributes, reverse_code=migrations.RunPython.noop)
    ]
