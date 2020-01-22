from django.contrib import admin
from . import models

admin.site.register(models.Note)
admin.site.register(models.Category)
admin.site.register(models.Task)
admin.site.register(models.Publication)
admin.site.register(models.CalDavSettings)
admin.site.register(models.DailyObjective)
admin.site.register(models.WeeklyObjective)
