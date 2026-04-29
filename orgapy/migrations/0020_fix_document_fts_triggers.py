from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('orgapy', '0019_remove_project_nonce_project_date_archived_and_more'),
    ]

    operations = [

        # --- Drop old triggers ---
        migrations.RunSQL(
            sql="""
                DROP TRIGGER IF EXISTS document_ai;
                DROP TRIGGER IF EXISTS document_ad;
                DROP TRIGGER IF EXISTS document_au;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),

        # --- Recreate INSERT trigger ---
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER document_ai
                AFTER INSERT ON orgapy_document
                BEGIN
                  INSERT INTO orgapy_document_fts(rowid, title, content)
                  VALUES (
                    new.id,
                    COALESCE(new.title, ''),
                    COALESCE(new.content, '')
                  );
                END;
            """,
            reverse_sql="DROP TRIGGER document_ai;",
        ),

        # --- Recreate DELETE trigger ---
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER document_ad
                AFTER DELETE ON orgapy_document
                BEGIN
                  INSERT INTO orgapy_document_fts(orgapy_document_fts, rowid)
                  VALUES ('delete', old.id);
                END;
            """,
            reverse_sql="DROP TRIGGER document_ad;",
        ),

        # --- Recreate UPDATE trigger (only when relevant fields change) ---
        migrations.RunSQL(
            sql="""
                CREATE TRIGGER document_au
                AFTER UPDATE OF title, content ON orgapy_document
                BEGIN
                  INSERT INTO orgapy_document_fts(orgapy_document_fts, rowid)
                  VALUES ('delete', old.id);

                  INSERT INTO orgapy_document_fts(rowid, title, content)
                  VALUES (
                    new.id,
                    COALESCE(new.title, ''),
                    COALESCE(new.content, '')
                  );
                END;
            """,
            reverse_sql="DROP TRIGGER document_au;",
        ),

        # --- Rebuild FTS index to fix existing corruption ---
        migrations.RunSQL(
            sql="""
                INSERT INTO orgapy_document_fts(orgapy_document_fts)
                VALUES ('rebuild');
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]