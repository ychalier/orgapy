import random
from django.db import migrations


def generate_project_nonces(apps, schema_editor):
    Project = apps.get_model("orgapy", "Project")
    db_alias = schema_editor.connection.alias

    NONCE_TOKENS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    NONCE_LENGTH = 4
    def generate_nonce() -> str:
        while True:
            nonce = "".join(random.choices(NONCE_TOKENS, k=NONCE_LENGTH))
            try:
                Project.objects.using(db_alias).get(nonce=nonce)
            except Project.DoesNotExist:
                return nonce
        
    for project in Project.objects.using(db_alias).all():
        project.nonce = generate_nonce()
        project.save(update_fields=["nonce"])


class Migration(migrations.Migration):

    dependencies = [
        ("orgapy", "0014_project_nonce_alter_document_nonce"),
    ]

    operations = [
        migrations.RunPython(generate_project_nonces),
    ]
