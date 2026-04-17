import random
from django.db import migrations


def reduce_nonces(apps, schema_editor):
    Document = apps.get_model("orgapy", "Document")
    db_alias = schema_editor.connection.alias

    DOCUMENT_NONCE_TOKENS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    DOCUMENT_NONCE_LENGTH = 4
    def generate_document_nonce() -> str:
        while True:
            nonce = "".join(random.choices(DOCUMENT_NONCE_TOKENS, k=DOCUMENT_NONCE_LENGTH))
            try:
                Document.objects.using(db_alias).get(nonce=nonce)
            except Document.DoesNotExist:
                return nonce
        
    for doc in Document.objects.using(db_alias).all():
        doc.nonce = generate_document_nonce()
        doc.save(update_fields=["nonce"])


class Migration(migrations.Migration):

    dependencies = [
        ("orgapy", "0011_remove_note_map_refs_remove_note_categories_and_more"),
    ]

    operations = [
        migrations.RunPython(reduce_nonces),
    ]
