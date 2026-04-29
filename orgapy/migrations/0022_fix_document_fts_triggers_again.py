from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('orgapy', '0021_rename_category_tag_rename_categories_document_tags_and_more'),
    ]

    operations = [

        # --- Drop triggers individually ---
        migrations.RunSQL("DROP TRIGGER IF EXISTS document_ai;", reverse_sql=migrations.RunSQL.noop),
        migrations.RunSQL("DROP TRIGGER IF EXISTS document_ad;", reverse_sql=migrations.RunSQL.noop),
        migrations.RunSQL("DROP TRIGGER IF EXISTS document_au;", reverse_sql=migrations.RunSQL.noop),

        # --- INSERT trigger ---
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

        # --- DELETE trigger ---
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

        # --- UPDATE trigger ---
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

        # --- Rebuild index ---
        migrations.RunSQL(
            sql="INSERT INTO orgapy_document_fts(orgapy_document_fts) VALUES ('rebuild');",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]