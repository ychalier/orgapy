from django.contrib import admin
from . import models

admin.site.register(models.Note)
admin.site.register(models.Category)
admin.site.register(models.Objective)
admin.site.register(models.Task)
admin.site.register(models.Quote)
admin.site.register(models.Project)
admin.site.register(models.Calendar)
admin.site.register(models.SheetGroup)
admin.site.register(models.Sheet)
admin.site.register(models.Map)
admin.site.register(models.ProgressCounter)
admin.site.register(models.ProgressLog)
admin.site.register(models.Settings)