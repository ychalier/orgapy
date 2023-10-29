from django.contrib import admin
from . import models

admin.site.register(models.Note)
admin.site.register(models.Category)
admin.site.register(models.Objective)
admin.site.register(models.Author)
admin.site.register(models.Work)
admin.site.register(models.Quote)
admin.site.register(models.Project)
admin.site.register(models.Calendar)
admin.site.register(models.SheetGroup)
admin.site.register(models.Sheet)