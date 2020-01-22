# Generated by Django 2.2.9 on 2020-01-22 12:57

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('orgapy', '0005_caldavsettings'),
    ]

    operations = [
        migrations.CreateModel(
            name='Objective',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('history', models.TextField(blank=True, default='')),
                ('date_start', models.DateField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='DailyObjective',
            fields=[
                ('objective_ptr', models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to='orgapy.Objective')),
            ],
            bases=('orgapy.objective',),
        ),
        migrations.CreateModel(
            name='WeeklyObjective',
            fields=[
                ('objective_ptr', models.OneToOneField(auto_created=True, on_delete=django.db.models.deletion.CASCADE, parent_link=True, primary_key=True, serialize=False, to='orgapy.Objective')),
            ],
            bases=('orgapy.objective',),
        ),
    ]
