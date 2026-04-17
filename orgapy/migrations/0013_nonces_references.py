import re
from django.db import migrations


def uses_nonces_in_references(apps, schema_editor):
    Document = apps.get_model("orgapy", "Document")
    db_alias = schema_editor.connection.alias

    pattern = re.compile(r"@(note|sheet|map|embedsheet|embedmap)/(\d+)")

    def replace(m):
        docid = int(m.group(2))
        try:
            ref_doc = Document.objects.using(db_alias).get(id=docid)
            return f"@{m.group(1)}/{ref_doc.nonce}"
        except Document.DoesNotExist:
            return m.group(0)  # leave unchanged if missing
        
    for doc in Document.objects.using(db_alias).all():
        if not doc.content:
            continue
        doc.content = pattern.sub(replace, doc.content)
        doc.save(update_fields=["content"])


class Migration(migrations.Migration):

    dependencies = [
        ("orgapy", "0012_reduce_nonces"),
    ]

    operations = [
        migrations.RunPython(uses_nonces_in_references),
    ]
