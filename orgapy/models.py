import datetime
from django.db import models
from django.utils.text import slugify
from django.conf import settings
from django.urls import reverse
from django.utils import timezone

import caldav
import json


class Category(models.Model):
    """Represent a general note category"""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)

    class Meta:

        ordering = ["name"]
    
    def __str__(self):
        return f"{ self.user } - { self.name }"



class Note(models.Model):
    """Represent a general note, ie. a title and a text"""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date_creation = models.DateTimeField(auto_now_add=True, auto_now=False)
    date_modification = models.DateTimeField(auto_now_add=True, auto_now=False)
    date_access = models.DateTimeField(auto_now_add=True, auto_now=False)
    title = models.CharField(max_length=255)
    content = models.TextField()
    public = models.BooleanField(default=False)
    categories = models.ManyToManyField("Category", blank=True)
    pinned = models.BooleanField(default=False)

    class Meta:

        ordering = ["-date_modification"]

    def __str__(self):
        return f"{ self.user} - { self.id }. { self.title }"

    def get_absolute_url(self):
        return reverse("orgapy:view_note", kwargs={"nid": self.id})
    
    def _content_preprocess(self):
        return self.content

    def get_modification_date_display(self):
        now = datetime.datetime.now()
        if self.date_modification.date() == now.date():
            return self.date_modification.strftime("%H:%M")
        return self.date_modification.strftime("%Y-%m-%d")


class Objective(models.Model):

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    history = models.TextField(blank=True, null=True)
    rules = models.TextField(blank=True, null=True)

    class Meta:

        ordering = ["name"]

    def __str__(self):
        return self.name
    
    def to_dict(self):
        history_dict = None
        if self.history is not None:
            try:
                history_dict = json.loads(self.history)
            except:
                history_dict = None
        rules_dict = None
        if self.rules is not None:
            try:
                rules_dict = json.loads(self.rules)
            except:
                rules_dict = None
        return {
            "id": self.id,
            "name": self.name,
            "history": history_dict,
            "rules": rules_dict,
        }


class Author(models.Model):

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    slug = models.SlugField(blank=True, max_length=255)
    date_creation = models.DateTimeField(auto_now_add=True, auto_now=False)

    def __str__(self):
        return str(self.name)

    def save(self, *args, **kwargs):
        self.slug = slugify(self.name)
        models.Model.save(self, *args, **kwargs)


class Work(models.Model):

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    slug = models.SlugField(blank=True, max_length=255)
    author = models.ForeignKey("Author", on_delete=models.CASCADE)
    date_creation = models.DateTimeField(auto_now_add=True, auto_now=False)

    def __str__(self):
        return "{} - {}".format(self.author, self.title)

    def save(self, *args, **kwargs):
        self.slug = slugify(self.title)
        models.Model.save(self, *args, **kwargs)


class Quote(models.Model):

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date_creation = models.DateTimeField(auto_now_add=True, auto_now=False)
    date_modification = models.DateTimeField(auto_now_add=True, auto_now=False)
    title = models.CharField(max_length=255)
    content = models.TextField()
    from_work = models.ForeignKey("Work", on_delete=models.CASCADE)

    class Meta:

        ordering = ["-date_creation"]

    def __str__(self):
        return f"{ self.user} - { self.id }. { self.title }"

    def get_modification_date_display(self):
        now = datetime.datetime.now()
        if self.date_modification.date() == now.date():
            return self.date_modification.strftime("%H:%M")
        return self.date_modification.strftime("%Y-%m-%d")


class Project(models.Model):

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date_creation = models.DateTimeField(auto_now_add=True, auto_now=False)
    date_modification = models.DateTimeField(auto_now_add=False, auto_now=True)
    title = models.CharField(max_length=255)
    category = models.CharField(max_length=255, default="general")
    limit_date = models.DateField(blank=True, null=True)
    progress_min = models.PositiveIntegerField(blank=True, null=True)
    progress_max = models.PositiveIntegerField(blank=True, null=True)
    progress_current = models.PositiveIntegerField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    checklist = models.TextField(blank=True, null=True)
    rank = models.FloatField()
    note = models.ForeignKey("Note", on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:

        ordering = ["-date_creation"]

    def __str__(self):
        return f"{ self.user} - { self.id }. { self.title }"
    
    def get_absolute_url(self):
        return reverse("orgapy:projects") + f"#project-{self.id}"


class Calendar(models.Model):

    CALENDAR = "CD"
    TASKS = "TK"
    TYPE_CHOICES = [
        (CALENDAR, "Calendar"),
        (TASKS, "Tasks"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    url = models.URLField(max_length=255)
    username = models.CharField(max_length=255)
    password = models.CharField(max_length=255)
    calendar_name = models.CharField(max_length=255)
    lookahead = models.PositiveIntegerField(default=14)
    last_sync = models.DateTimeField(blank=True, null=True)
    sync_period = models.PositiveIntegerField(default=86400)
    events = models.TextField(blank=True, null=True)
    type = models.CharField(max_length=2, choices=TYPE_CHOICES, default=CALENDAR)

    class Meta:

        ordering = ["user"]

    def __str__(self):
        return f"{ self.user } - { self.id }. { self.calendar_name }"
    
    def fetch_events(self):
        self.last_sync = timezone.now()
        events = []
        with caldav.DAVClient(url=self.url, username=self.username, password=self.password) as client:
            principal = client.principal()
            for calendar in principal.calendars():
                if calendar.name != self.calendar_name:
                    continue
                events = calendar.search(
                    start=datetime.datetime.now().date(),
                    end=datetime.datetime.now().date() + datetime.timedelta(days=self.lookahead),
                    event=True,
                    expand=True)
        data = []
        for event in events:
            for subcomponent in event.icalendar_instance.subcomponents:
                if "SUMMARY" not in subcomponent:
                    continue
                location = subcomponent.get("LOCATION")
                data.append({
                    "url": event.url,
                    "title": str(subcomponent["SUMMARY"]),
                    "dtstart": subcomponent["DTSTART"].dt.isoformat(),
                    "dtend": subcomponent["DTEND"].dt.isoformat(),
                    "location": None if location is None else str(location)
                })
        self.events = json.dumps(data, default=str)
        self.save()

    def get_events(self, force=False):
        now = timezone.now()
        if force or self.last_sync is None or (now - self.last_sync).total_seconds() > self.sync_period:
            self.fetch_events()
        if self.events is None:
            return []
        return json.loads(self.events)
    
    def delete_event(self, href):
        success = False
        with caldav.DAVClient(url=self.url, username=self.username, password=self.password) as client:
            principal = client.principal()
            for calendar in principal.calendars():
                if calendar.name != self.calendar_name:
                    continue
                calendar.event_by_url(href).delete()
                events_data = json.loads(self.events)
                self.events = json.dumps(list(filter(lambda e: e["url"] != href, events_data)))
                self.save()
                success = True
                break
        return success
    
    def add_event(self, title, dtstart, dtend, location, allday):
        success = False
        with caldav.DAVClient(url=self.url, username=self.username, password=self.password) as client:
            principal = client.principal()
            for calendar in principal.calendars():
                if calendar.name != self.calendar_name:
                    continue
                if allday:
                    dtstart = dtstart.date()
                    dtend = dtend.date()
                event = calendar.save_event(
                    dtstart=dtstart,
                    dtend=dtend,
                    summary=title,
                    location=location)
                events_data = json.loads(self.events)
                events_data.append({
                    "url": event.url,
                    "title": title,
                    "dtstart": dtstart.isoformat(),
                    "dtend": dtend.isoformat(),
                    "location": location
                })
                self.events = json.dumps(events_data, default=str)
                self.save()
                success = True
                break
        return success

