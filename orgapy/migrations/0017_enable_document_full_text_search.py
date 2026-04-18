from django.db import migrations

class Migration(migrations.Migration):

    dependencies = [
        ('orgapy', '0016_alter_project_nonce'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                CREATE VIRTUAL TABLE orgapy_document_fts USING fts5(
                    title,
                    content,
                    content='orgapy_document',
                    content_rowid='id'
                );
            """,
            reverse_sql="DROP TABLE orgapy_document_fts;",
        ),

        migrations.RunSQL(
            sql="""
                CREATE TRIGGER document_ai AFTER INSERT ON orgapy_document BEGIN
                  INSERT INTO orgapy_document_fts(rowid, title, content)
                  VALUES (new.id, new.title, new.content);
                END;
            """,
            reverse_sql="DROP TRIGGER document_ai;",
        ),

        migrations.RunSQL(
            sql="""
                CREATE TRIGGER document_ad AFTER DELETE ON orgapy_document BEGIN
                  INSERT INTO orgapy_document_fts(orgapy_document_fts, rowid, title, content)
                  VALUES ('delete', old.id, old.title, old.content);
                END;
            """,
            reverse_sql="DROP TRIGGER document_ad;",
        ),

        migrations.RunSQL(
            sql="""
                CREATE TRIGGER document_au AFTER UPDATE ON orgapy_document BEGIN
                  INSERT INTO orgapy_document_fts(orgapy_document_fts, rowid, title, content)
                  VALUES ('delete', old.id, old.title, old.content);
                  INSERT INTO orgapy_document_fts(rowid, title, content)
                  VALUES (new.id, new.title, new.content);
                END;
            """,
            reverse_sql="DROP TRIGGER document_au;",
        ),

        migrations.RunSQL(
            sql="""
                INSERT INTO orgapy_document_fts(rowid, title, content)
                SELECT id, title, content FROM orgapy_document;
            """,
            reverse_sql="DELETE FROM orgapy_document_fts;",
        ),
    ]