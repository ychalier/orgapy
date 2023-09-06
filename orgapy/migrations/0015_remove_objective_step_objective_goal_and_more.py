# Generated by Django 4.1.7 on 2023-09-06 12:17

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orgapy', '0014_project'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='objective',
            name='step',
        ),
        migrations.AddField(
            model_name='objective',
            name='goal',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='objective',
            name='period',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AlterField(
            model_name='objective',
            name='date_start',
            field=models.DateField(),
        ),
    ]
