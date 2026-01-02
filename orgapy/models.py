import datetime
import json
import re
from math import ceil

import caldav
from django.db import models
from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator

from .utils import generate_nonce, ravel


class Settings(models.Model):

    id = models.BigAutoField(primary_key=True)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    objective_start_hours = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(23)])
    calendar_lookahead = models.PositiveIntegerField(default=3)
    beach_mode = models.BooleanField(default=False)
    trash_period = models.PositiveIntegerField(default=30)
    mood_log_hours = models.PositiveIntegerField(default=19, validators=[MinValueValidator(0), MaxValueValidator(23)])
    mood_activities = models.TextField(default="Hiking 🥾\nRunning 🏃\nParty 🎉")

    class Meta:

        ordering = ["user"]

    def __str__(self):
        return f"Settings(user={self.user})"

    @property
    def mood_activities_list(self) -> list[tuple[str, str]]:
        activities = []
        for line in self.mood_activities.strip().split("\n"):
            label, emoji = line.strip().split(" ")
            activities.append((label, emoji))
        return activities


class Category(models.Model):
    """Represent a general category"""

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)

    class Meta:

        ordering = ["name"]

    def __str__(self):
        return f"{ self.user } - { self.name }"

    def get_absolute_url(self):
        return reverse("orgapy:category", kwargs={"name": self.name})

    @property
    def count(self) -> int:
        return self.notes.count() + self.sheets.count() + self.maps.count() # type: ignore

    @property
    def title(self) -> str:
        return "#" + self.name


class Document(models.Model):

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date_creation = models.DateTimeField(auto_now_add=True, auto_now=False)
    date_modification = models.DateTimeField(auto_now_add=True, auto_now=False)
    date_access = models.DateTimeField(auto_now_add=True, auto_now=False)
    title = models.CharField(max_length=255)
    public = models.BooleanField(default=False)
    pinned = models.BooleanField(default=False)
    hidden = models.BooleanField(default=False)
    nonce = models.TextField(max_length=12, unique=True, blank=True, default=generate_nonce)
    deleted = models.BooleanField(default=False)
    date_deletion = models.DateTimeField(auto_now_add=False, auto_now=False, blank=True, null=True)

    class Meta:
        abstract = True
        ordering = ["-date_modification"]

    def __str__(self):
        return f"{ self.user} - { self.id }. { self.title }"

    def save(self, *args, **kwargs):
        if self.nonce is None:
            self.nonce = generate_nonce()
        super(Document, self).save(*args, **kwargs)

    def date_modification_display(self):
        now = datetime.datetime.now()
        if now.date() == self.date_modification.date():
            return "Today"
        elif now.year == self.date_modification.year:
            return self.date_modification.strftime("%m-%d")
        return self.date_modification.strftime("%Y-%m-%d")

    def soft_delete(self):
        self.deleted = True
        self.date_deletion = timezone.now()
        self.save()

    def restore(self):
        self.deleted = False
        self.date_deletion = None
        self.save()


class Note(Document):

    content = models.TextField()
    note_refs = models.ManyToManyField("Note", related_name="referenced_in")
    sheet_refs = models.ManyToManyField("Sheet", related_name="referenced_in")
    map_refs = models.ManyToManyField("Map", related_name="referenced_in")
    categories = models.ManyToManyField("Category", blank=True, related_name="notes")
    active = "notes"

    def save(self, *args, **kwargs):
        super(Note, self).save(*args, **kwargs)
        objects = {"note": set(), "sheet": set(), "map": set()}
        pattern = re.compile(r"@(note|sheet|map)/(\d+)")
        for object_type, object_id in re.findall(pattern, self.content):
            objects[object_type].add(int(object_id))
        self.note_refs.set(Note.objects.filter(user=self.user, id__in=objects["note"]))
        self.sheet_refs.set(Sheet.objects.filter(user=self.user, id__in=objects["sheet"]))
        self.map_refs.set(Map.objects.filter(user=self.user, id__in=objects["map"]))

    def get_absolute_url(self):
        return reverse("orgapy:note", kwargs={"object_id": self.id})

    def ongoing_projects(self):
        return self.project_set.exclude(status=Project.ARCHIVED) # type: ignore


class SheetGroup(models.Model):

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)

    class Meta:

        ordering = ["title"]

    def __str__(self):
        return f"{ self.user} - { self.id }. { self.title }"


class Sheet(Document):

    description = models.TextField(blank=True, null=True)
    data = models.TextField(blank=True, null=True)
    config = models.TextField(blank=True, null=True)
    group = models.ForeignKey("SheetGroup", on_delete=models.SET_NULL, null=True, blank=True)
    categories = models.ManyToManyField("Category", blank=True, related_name="sheets")
    active = "sheets"

    def get_absolute_url(self):
        return reverse("orgapy:sheet", kwargs={"object_id": self.id})


class Map(Document):

    geojson = models.TextField(blank=True, null=True)
    config = models.TextField(blank=True, null=True)
    categories = models.ManyToManyField("Category", blank=True, related_name="maps")
    active = "maps"

    def get_absolute_url(self):
        return reverse("orgapy:map", kwargs={"object_id": self.id})


class Objective(models.Model):

    id = models.BigAutoField(primary_key=True)
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

    id = models.BigAutoField(primary_key=True)
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

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date_creation = models.DateTimeField(auto_now_add=True, auto_now=False)
    date_modification = models.DateTimeField(auto_now_add=True, auto_now=False)
    content = models.TextField()
    reference = models.CharField(max_length=255, default="", blank=True)
    active = "quotes"

    class Meta:

        ordering = ["-date_creation"]

    def __str__(self):
        return f"{ self.user} - { self.id }. { self.reference_nomarkup }"

    def date_modification_display(self):
        now = datetime.datetime.now()
        if now.date() == self.date_modification.date():
            return "Today"
        elif now.year == self.date_modification.year:
            return self.date_modification.strftime("%m-%d")
        return self.date_modification.strftime("%Y-%m-%d")

    def get_absolute_url(self):
        return reverse("orgapy:quote", kwargs={"object_id": self.id})

    @property
    def reference_html(self) -> str:
        return re.sub(r"\*([^\*]*)\*", r"<i>\1</i>", self.reference)

    @property
    def reference_nomarkup(self) -> str:
        return re.sub(r"\*", r"", self.reference)

    @property
    def title(self) -> str:
        return ravel(self.content)


class Project(models.Model):

    ACTIVE = "AC"
    INACTIVE = "IN"
    ARCHIVED = "AR"
    FUTURE = "FU"
    STATUS_CHOICES = [
        (ACTIVE, "Active"),
        (INACTIVE, "Inactive"),
        (ARCHIVED, "Archived"),
        (FUTURE, "Future"),
    ]

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date_creation = models.DateTimeField(auto_now_add=True, auto_now=False)
    date_modification = models.DateTimeField(auto_now_add=False, auto_now=True)
    title = models.CharField(max_length=255, blank=True, null=True)
    category = models.CharField(max_length=255, default="general")        # Deprecated
    limit_date = models.DateField(blank=True, null=True)                  # Deprecated
    progress_min = models.PositiveIntegerField(blank=True, null=True)     # Deprecated
    progress_max = models.PositiveIntegerField(blank=True, null=True)     # Deprecated
    progress_current = models.PositiveIntegerField(blank=True, null=True) # Deprecated
    description = models.TextField(blank=True, null=True)                 # Deprecated
    checklist = models.TextField(blank=True, null=True)
    rank = models.FloatField()                                            # Deprecated
    note = models.ForeignKey("Note", on_delete=models.SET_NULL, null=True, blank=True)
    archived = models.BooleanField(default=False)                         # Deprecated
    status = models.CharField(max_length=2, choices=STATUS_CHOICES, default=ACTIVE)

    class Meta:

        ordering = ["-date_creation"]

    def __str__(self):
        return f"{ self.user} - { self.id }. { self.title }"

    def get_absolute_url(self):
        return reverse("orgapy:project", kwargs={"object_id": self.id})

    @property
    def items_count(self) -> int:
        if self.checklist is None:
            return 0
        return len(re.findall(r"^\[[ x]\]", self.checklist, re.MULTILINE))

    @property
    def completed_items_count(self) -> int:
        if self.checklist is None:
            return 0
        return len(re.findall(r"^\[x\]", self.checklist, re.MULTILINE))

    @property
    def all_completed(self) -> bool:
        return self.completed_items_count == self.items_count

    @property
    def reference(self) -> str:
        if self.note is None and self.title is not None:
            return self.title
        if self.note is not None and self.title is None:
            return self.note.title
        if self.note is not None and self.title is not None:
            return f"{self.note.title} - {self.title}"
        return "Untitled"

    def to_json_dict(self) -> dict:
        return {
            "id": self.id,
            "creation": self.date_creation.timestamp(),
            "modification": self.date_modification.timestamp(),
            "title": self.title,
            "checklist": self.checklist if self.checklist else None,
            "note": None if self.note is None else {
                "id": self.note.id,
                "title": self.note.title,
                "url": self.note.get_absolute_url(),
            },
            "status": self.status,
        }
    
    @property
    def progress(self) -> int:
        q = self.items_count
        if q == 0:
            return 0
        p = self.completed_items_count
        return ceil(100 * p / q)


class Calendar(models.Model):

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    url = models.URLField(max_length=255)
    username = models.CharField(max_length=255)
    password = models.CharField(max_length=255)
    calendar_name = models.CharField(max_length=255)
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
        lookahead = self.user.settings.calendar_lookahead
        with caldav.DAVClient(url=self.url, username=self.username, password=self.password) as client:
            principal = client.principal()
            for calendar in principal.calendars():
                if calendar.name != self.calendar_name:
                    continue
                events = calendar.search(
                    start=datetime.datetime.now().date(),
                    end=datetime.datetime.now().date() + datetime.timedelta(days=lookahead),
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

    def get_events(self, force: bool = False) -> list[dict]:
        now = timezone.now()
        if force or self.last_sync is None or (now - self.last_sync).total_seconds() > self.sync_period:
            self.fetch_events()
        return json.loads(self.events) if self.events else []

    def delete_event(self, href: str):
        success = False
        with caldav.DAVClient(url=self.url, username=self.username, password=self.password) as client:
            principal = client.principal()
            for calendar in principal.calendars():
                assert isinstance(calendar, caldav.Calendar)
                if calendar.name != self.calendar_name:
                    continue
                event = calendar.event_by_url(href)
                if event is None:
                    return False
                if event is not None:
                    event.delete()
                events_data = [] if self.events is None else json.loads(self.events)
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
                events_data = [] if self.events is None else json.loads(self.events)
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


class ProgressCounter(models.Model):

    id = models.BigAutoField(primary_key=True)
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
    def json(self) -> dict:
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

    def recompute(self):
        data = {}
        for log in ProgressLog.objects.filter(user=self.user, dt__year=self.year):
            key = log.dt.strftime(r"%Y-%m-%d")
            data.setdefault(key, 0)
            data[key] += 1
        self.data = json.dumps(data)
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

    id = models.BigAutoField(primary_key=True)
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

    @property
    def dt_html(self) -> str:
        return f"{self.dt.year}-{self.dt.month:02d}-{self.dt.day:02d}T{self.dt.hour:02d}:{self.dt.minute:02d}"


class PushSubscription(models.Model):

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    subscription = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    name = models.CharField(max_length=255, blank=True, null=True)

    class Meta:

        ordering = ["user"]

    def __str__(self):
        return f"PushSubscription(user={self.user}, name={self.name})"


class MoodLog(models.Model):

    UNSET = 0
    BAD = 1
    NEUTRAL = 2
    GOOD = 3

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    date = models.DateField()
    mood = models.PositiveIntegerField()
    energy = models.PositiveIntegerField()
    health = models.PositiveIntegerField()
    stress = models.PositiveIntegerField()
    activities = models.TextField(default="")

    class Meta:

        ordering = ["user", "created_at"]

    def __str__(self):
        return f"MoodLog(user={self.user}, date={self.date})"

    @staticmethod
    def tracker_classname(value) -> str:
        if value == 1:
            return "mood-bad"
        elif value == 2:
            return "mood-neutral"
        elif value == 3:
            return "mood-good"
        return ""

    @property
    def mood_classname(self) -> str:
        return self.tracker_classname(self.mood)

    @property
    def energy_classname(self) -> str:
        return self.tracker_classname(self.energy)

    @property
    def health_classname(self) -> str:
        return self.tracker_classname(self.health)

    @property
    def stress_classname(self) -> str:
        return self.tracker_classname(self.stress)

    @property
    def activities_display(self) -> str:
        return self.activities.replace(",", " ")
