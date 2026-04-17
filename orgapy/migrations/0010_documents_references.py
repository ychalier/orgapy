import re
from django.db import migrations


def update_references(apps, schema_editor):
    Document = apps.get_model("orgapy", "Document")
    db_alias = schema_editor.connection.alias
    pattern = re.compile(r"@(note|sheet|map|embedsheet|embedmap)/(\d+)")

    def replace(m):
        source_type = m.group(1)
        if source_type == "embedsheet":
            source_type = "sheet"
        if source_type == "embedmap":
            source_type = "map"
        source_id = int(m.group(2))
        try:
            ref_doc = Document.objects.using(db_alias).get(source_type=source_type, source_id=source_id)
            return f"@{m.group(1)}/{ref_doc.id}"
        except Document.DoesNotExist:
            return m.group(0)  # leave unchanged if missing

    for doc in Document.objects.using(db_alias).all():
        if not doc.content:
            continue

        doc.content = pattern.sub(replace, doc.content)
        doc.save(update_fields=["content"])

        referenced_document_ids = set()
        for _, document_id in re.findall(pattern, doc.content):
            referenced_document_ids.add(int(document_id))
        doc.references.set(Document.objects.using(db_alias).filter(user=doc.user, id__in=referenced_document_ids))
    
    Project = apps.get_model("orgapy", "Project")
    for project in Project.objects.using(db_alias).all():
        if project.note:
            try:
                project.document = Document.objects.using(db_alias).get(source_type="note", source_id=project.note.id)
                project.save(update_fields=["document"])
            except Document.DoesNotExist:
                continue


class Migration(migrations.Migration):

    dependencies = [
        ("orgapy", "0009_create_documents"),
    ]

    operations = [
        migrations.RunPython(update_references),
    ]
