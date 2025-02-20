# Generated by Django 5.1.6 on 2025-02-20 17:11

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orgapy', '0041_progresslog_progresscounter'),
    ]

    operations = [
        migrations.AddField(
            model_name='objective',
            name='flexible',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='objective',
            name='period',
            field=models.PositiveIntegerField(default=1, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(365)]),
        ),
    ]
