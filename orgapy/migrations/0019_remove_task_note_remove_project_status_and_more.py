# Generated by Django 4.1.7 on 2023-09-10 17:58

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('orgapy', '0018_quote'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='task',
            name='note',
        ),
        migrations.RemoveField(
            model_name='project',
            name='status',
        ),
        migrations.DeleteModel(
            name='OldQuote',
        ),
        migrations.DeleteModel(
            name='Task',
        ),
    ]
