# Generated by Django 5.0.7 on 2025-06-11 14:59

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orgapy', '0047_note_hidden'),
    ]

    operations = [
        migrations.AddField(
            model_name='note',
            name='map_refs',
            field=models.ManyToManyField(related_name='referenced_in', to='orgapy.map'),
        ),
        migrations.AddField(
            model_name='note',
            name='note_refs',
            field=models.ManyToManyField(related_name='referenced_in', to='orgapy.note'),
        ),
        migrations.AddField(
            model_name='note',
            name='sheet_refs',
            field=models.ManyToManyField(related_name='referenced_in', to='orgapy.sheet'),
        ),
    ]
