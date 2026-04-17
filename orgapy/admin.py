from django.contrib import admin
from . import models

admin.site.register(models.Settings)
admin.site.register(models.Category)
admin.site.register(models.Document)
admin.site.register(models.Project)
admin.site.register(models.Objective)
admin.site.register(models.Task)
admin.site.register(models.Calendar)
admin.site.register(models.ProgressLog)
admin.site.register(models.MoodLog)