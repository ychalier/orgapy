from django.db import migrations


def copy_data(apps, schema_editor):
    Document = apps.get_model("orgapy", "Document")

    db_alias = schema_editor.connection.alias

    Note = apps.get_model("orgapy", "Note")
    for note in Note.objects.using(db_alias).all().order_by("id"):
        doc = Document.objects.using(db_alias).create(
            #id=,
            user=note.user,
            type="note",
            nonce=note.nonce,
            date_creation=note.date_creation,
            date_modification=note.date_modification,
            date_access=note.date_access,
            date_deletion=note.date_deletion,
            public=note.public,
            pinned=note.pinned,
            hidden=note.hidden,
            deleted=note.deleted,
            #references=,
            #categories=,
            title=note.title,
            #subtitle=,
            content=note.content,
            #config=,
            source_type="note",
            source_id=note.id
        )
        if note.categories:
            doc.categories.set(note.categories.all())

    Sheet = apps.get_model("orgapy", "Sheet")
    for sheet in Sheet.objects.using(db_alias).all().order_by("id"):
        doc = Document.objects.using(db_alias).create(
            #id=,
            user=sheet.user,
            type="sheet",
            nonce=sheet.nonce,
            date_creation=sheet.date_creation,
            date_modification=sheet.date_modification,
            date_access=sheet.date_access,
            date_deletion=sheet.date_deletion,
            public=sheet.public,
            pinned=sheet.pinned,
            hidden=sheet.hidden,
            deleted=sheet.deleted,
            #references=,
            #categories=,
            title=sheet.title,
            subtitle=sheet.description,
            content=sheet.data,
            config=sheet.config,
            source_type="sheet",
            source_id=sheet.id
        )
        if sheet.categories:
            doc.categories.set(sheet.categories.all())

    Map = apps.get_model("orgapy", "Map")
    for map_ in Map.objects.using(db_alias).all().order_by("id"):
        doc = Document.objects.using(db_alias).create(
            #id=,
            user=map_.user,
            type="map",
            nonce=map_.nonce,
            date_creation=map_.date_creation,
            date_modification=map_.date_modification,
            date_access=map_.date_access,
            date_deletion=map_.date_deletion,
            public=map_.public,
            pinned=map_.pinned,
            hidden=map_.hidden,
            deleted=map_.deleted,
            #references=,
            #categories=,
            title=map_.title,
            #subtitle=,
            content=map_.geojson,
            config=map_.config,
            source_type="map",
            source_id=map_.id
        )
        if map_.categories:
            doc.categories.set(map_.categories.all())


def reverse_copy(apps, schema_editor):
    Document = apps.get_model("orgapy", "Document")
    db_alias = schema_editor.connection.alias
    Document.objects.using(db_alias).all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("orgapy", "0008_document_project_document"),
    ]

    operations = [
        migrations.RunPython(copy_data, reverse_copy),
    ]
