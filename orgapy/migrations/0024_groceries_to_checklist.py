from django.db import migrations


def create_checklist_from_groceries(apps, schema_editor):
    Settings = apps.get_model("orgapy", "Settings")
    Checklist = apps.get_model("orgapy", "Checklist")
    db_alias = schema_editor.connection.alias
        
    for settings in Settings.objects.using(db_alias).all():
        if not settings.groceries_data:
            continue
        Checklist.objects.create(
            user=settings.user,
            title="Shopping list",
            json=settings.groceries_data
        )


class Migration(migrations.Migration):

    dependencies = [
        ("orgapy", "0023_checklist"),
    ]

    operations = [
        migrations.RunPython(create_checklist_from_groceries),
    ]
