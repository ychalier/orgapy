# Generated by Django 4.1.7 on 2023-09-10 17:26

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('orgapy', '0016_project_rank'),
    ]

    operations = [
        migrations.RenameModel(
            old_name='Quote',
            new_name='OldQuote',
        ),
    ]
