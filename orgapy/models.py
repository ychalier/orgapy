import datetime
import json
import random
import re

from django.db import models
from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator

import caldav


def generate_nonce() -> str:
    tokens = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-"
    choices = random.choices(tokens, k=12)
    return "".join(choices)


class Settings(models.Model):
    
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    objective_start_hours = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(23)])
    
    class Meta:

        ordering = ["user"]
    
    def __str__(self):
        return f"{ self.user }"


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
    nonce = models.TextField(max_length=12, unique=True, blank=True, default=generate_nonce)

    class Meta:

        ordering = ["-date_modification"]

    def __str__(self):
        return f"{ self.user} - { self.id }. { self.title }"

    def save(self, *args, **kwargs):
        if self.nonce is None:
            self.nonce = generate_nonce()
        return super(Note, self).save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse("orgapy:note", kwargs={"nid": self.id})
    
    def _content_preprocess(self):
        return self.content

    def get_modification_date_display(self):
        now = datetime.datetime.now()
        if self.date_modification.date() == now.date():
            return self.date_modification.strftime("%H:%M")
        return self.date_modification.strftime("%Y-%m-%d")
    
    @staticmethod
    def get_class():
        return "note"


class Objective(models.Model):

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    history = models.TextField(blank=True, null=True)
    period = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1), MaxValueValidator(365)])
    flexible = models.BooleanField(default=False)
    archived = models.BooleanField(default=False)

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
        return {
            "id": self.id,
            "name": self.name,
            "history": history_dict,
            "period": self.period,
            "flexible": self.flexible,
            "archived": self.archived
        }


class Task(models.Model):

    ONCE = "ON"
    DAILY = "DY"
    WEEKLY = "WK"
    MONTHLY = "MN"
    YEARLY = "YR"
    RECURRING_MODE_CHOICES = [
        (ONCE, "Once"),
        (DAILY, "Daily"),
        (WEEKLY, "Weekly"),
        (MONTHLY, "Monthly"),
        (YEARLY, "Yearly")
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    start_date = models.DateField()
    due_date = models.DateField(null=True, blank=True)
    recurring_mode = models.CharField(max_length=2, choices=RECURRING_MODE_CHOICES, default=ONCE)
    recurring_period = models.PositiveIntegerField(blank=True, null=True)
    recurring_parent = models.ForeignKey("self", blank=True, null=True, on_delete=models.CASCADE)
    completed = models.BooleanField(default=False)
    date_completion = models.DateTimeField(blank=True, null=True)

    class Meta:

        ordering = ["-start_date"]

    def __str__(self):
        return f"{ self.user} - { self.id }. { self.title }"


class Quote(models.Model):

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date_creation = models.DateTimeField(auto_now_add=True, auto_now=False)
    date_modification = models.DateTimeField(auto_now_add=True, auto_now=False)
    content = models.TextField()
    reference = models.CharField(max_length=255, default="", blank=True)

    class Meta:

        ordering = ["-date_creation"]

    def __str__(self):
        return f"{ self.user} - { self.id }. { self.reference_nomarkup }"

    def get_modification_date_display(self):
        now = datetime.datetime.now()
        if self.date_modification.date() == now.date():
            return self.date_modification.strftime("%H:%M")
        return self.date_modification.strftime("%Y-%m-%d")
    
    def get_absolute_url(self):
        return reverse("orgapy:quote", kwargs={"qid": self.id})
    
    @staticmethod
    def get_class():
        return "quote"
    
    @property
    def reference_html(self) -> str:
        return re.sub(r"\*([^\*]*)\*", r"<i>\1</i>", self.reference)
    
    @property
    def reference_nomarkup(self) -> str:
        return re.sub(r"\*", r"", self.reference)


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
    archived = models.BooleanField(default=False)

    class Meta:

        ordering = ["-date_creation"]

    def __str__(self):
        return f"{ self.user} - { self.id }. { self.title }"
    
    def get_absolute_url(self):
        return reverse("orgapy:projects") + f"#project-{self.id}"


class Calendar(models.Model):

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    url = models.URLField(max_length=255)
    username = models.CharField(max_length=255)
    password = models.CharField(max_length=255)
    calendar_name = models.CharField(max_length=255)
    lookahead = models.PositiveIntegerField(default=14)
    last_sync = models.DateTimeField(blank=True, null=True)
    sync_period = models.PositiveIntegerField(default=86400)
    events = models.TextField(blank=True, null=True)

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
        events_data = []
        for event in events:
            for subcomponent in event.icalendar_instance.subcomponents:
                if "SUMMARY" not in subcomponent:
                    continue
                location = subcomponent.get("LOCATION")
                events_data.append({
                    "url": event.url,
                    "title": str(subcomponent["SUMMARY"]),
                    "dtstart": subcomponent["DTSTART"].dt.isoformat(),
                    "dtend": subcomponent["DTEND"].dt.isoformat(),
                    "location": None if location is None else str(location)
                })
        self.events = json.dumps(events_data, default=str)
        self.save()

    def get_events(self, force=False):
        now = timezone.now()
        if force or self.last_sync is None or (now - self.last_sync).total_seconds() > self.sync_period:
            self.fetch_events()
        return json.loads(self.events) if self.events else []
    
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


class SheetGroup(models.Model):

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)

    class Meta:

        ordering = ["title"]
    
    def __str__(self):
        return f"{ self.user} - { self.id }. { self.title }"

    def get_absolute_url(self):
        return reverse("orgapy:sheet_group", kwargs={"sid": self.id})


class Sheet(models.Model):

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date_creation = models.DateTimeField(auto_now_add=True, auto_now=False)
    date_modification = models.DateTimeField(auto_now_add=True, auto_now=False)
    date_access = models.DateTimeField(auto_now_add=True, auto_now=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    data = models.TextField(blank=True, null=True)
    config = models.TextField(blank=True, null=True)
    public = models.BooleanField(default=False)
    group = models.ForeignKey("SheetGroup", on_delete=models.SET_NULL, null=True, blank=True)
    nonce = models.TextField(max_length=12, unique=True, blank=True, default=generate_nonce)

    class Meta:

        ordering = ["title"]

    def __str__(self):
        return f"{ self.user} - { self.id }. { self.title }"

    def save(self, *args, **kwargs):
        if self.nonce is None:
            self.nonce = generate_nonce()
        return super(Sheet, self).save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse("orgapy:sheet", kwargs={"sid": self.id})
    
    def get_modification_date_display(self):
        now = datetime.datetime.now()
        if self.date_modification.date() == now.date():
            return self.date_modification.strftime("%H:%M")
        return self.date_modification.strftime("%Y-%m-%d")
    
    @staticmethod
    def get_class():
        return "sheet"


class Map(models.Model):

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date_creation = models.DateTimeField(auto_now_add=True, auto_now=False)
    date_modification = models.DateTimeField(auto_now_add=True, auto_now=False)
    date_access = models.DateTimeField(auto_now_add=True, auto_now=False)
    title = models.CharField(max_length=255)
    geojson = models.TextField(blank=True, null=True)
    config = models.TextField(blank=True, null=True)
    public = models.BooleanField(default=False)
    nonce = models.TextField(max_length=12, unique=True, blank=True, default=generate_nonce)

    class Meta:

        ordering = ["title"]

    def __str__(self):
        return f"{ self.user} - { self.id }. { self.title }"

    def save(self, *args, **kwargs):
        if self.nonce is None:
            self.nonce = generate_nonce()
        return super(Map, self).save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse("orgapy:map", kwargs={"mid": self.id})
    
    @staticmethod
    def get_class():
        return "map"


class ProgressCounter(models.Model):
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    year = models.PositiveIntegerField()
    data = models.TextField(default="{}")
    
    class Meta:

        ordering = ["user", "-year"]
        constraints = [
            models.UniqueConstraint(fields=["user", "year"], name="unique_user_year")
        ]
    
    def __str__(self):
        return f"{ self.user } - { self.year }"
    
    @property
    def json(self) -> str:
        return json.loads(self.data)
    
    def increment(self, dt: datetime.date):
        key = dt.strftime(r"%Y-%m-%d")
        json_data = self.json
        json_data.setdefault(key, 0)
        json_data[key] += 1
        self.data = json.dumps(json_data)
        self.save()
    
    def decrement(self, dt: datetime.date):
        key = dt.strftime(r"%Y-%m-%d")
        json_data = self.json
        value = json_data.get(key, 0)
        value -= 1
        if value > 0:
            json_data[key] = value
        else:
            del json_data[key]
        self.data = json.dumps(json_data)
        self.save()


class ProgressLog(models.Model):
    
    OTHER = "OT"
    PROJECT_CHECKLIST_ITEM_CHECKED = "PR"
    TASK_COMPLETED = "TA"
    OBJECTIVE_COMPLETED = "OB"
    TYPE_CHOICES = [
        (OTHER, "Other"),
        (PROJECT_CHECKLIST_ITEM_CHECKED, "Project checklist item checked"),
        (TASK_COMPLETED, "Task completed"),
        (OBJECTIVE_COMPLETED, "Objective completed")
    ]
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    dt = models.DateTimeField(auto_now_add=True, auto_now=False)
    type = models.CharField(max_length=2, choices=TYPE_CHOICES, default=OTHER)
    description = models.CharField(max_length=255, blank=True, null=True)
    
    class Meta:

        ordering = ["-dt"]
    
    def __str__(self):
        return f"{ self.user } [{ self.type }] { self.description }"
    
    def save(self, *args, **kwargs):
        if self.id is None:
            now = datetime.datetime.now().date()
            query = ProgressCounter.objects.filter(user=self.user, year=now.year)
            if query.exists():
                counter = query.get()
            else:
                counter = ProgressCounter.objects.create(user=self.user, year=now.year)
            counter.increment(now)
        return super(ProgressLog, self).save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        query = ProgressCounter.objects.filter(user=self.user, year=self.dt.year)
        if query.exists():
            query.get().decrement(self.dt.date())
        return super(ProgressLog, self).delete(*args, **kwargs)

    def get_absolute_url(self):
        dfs = self.dt.strftime(r"%Y-%m-%d")
        return reverse("orgapy:progress") + f"?date={dfs}"
