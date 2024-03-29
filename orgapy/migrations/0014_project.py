# Generated by Django 4.1.7 on 2023-09-03 06:31

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('orgapy', '0013_note_pinned'),
    ]

    operations = [
        migrations.CreateModel(
            name='Project',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('date_creation', models.DateTimeField(auto_now_add=True)),
                ('date_modification', models.DateTimeField(auto_now=True)),
                ('title', models.CharField(max_length=255)),
                ('category', models.CharField(default='general', max_length=255)),
                ('status', models.CharField(choices=[('ID', 'Idea'), ('ON', 'Ongoing'), ('PA', 'Paused'), ('FI', 'Finished')], default='ID', max_length=2)),
                ('limit_date', models.DateField(blank=True, null=True)),
                ('progress_min', models.PositiveIntegerField(blank=True, null=True)),
                ('progress_max', models.PositiveIntegerField(blank=True, null=True)),
                ('progress_current', models.PositiveIntegerField(blank=True, null=True)),
                ('description', models.TextField(blank=True, null=True)),
                ('checklist', models.TextField(blank=True, null=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-date_creation'],
            },
        ),
    ]
