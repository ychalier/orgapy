# Generated by Django 4.1.7 on 2023-11-19 09:43

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orgapy', '0026_sheetgroup_sheet'),
    ]

    operations = [
        migrations.AddField(
            model_name='objective',
            name='archived',
            field=models.BooleanField(default=False),
        ),
    ]