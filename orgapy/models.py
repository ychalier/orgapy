import datetime
import hashlib
import json
import random
import re
from math import ceil

import caldav
from dateutil.relativedelta import relativedelta
from django.db import models, OperationalError
from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator


NONCE_TOKENS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
NONCE_LENGTH = 4

def generate_nonce(model: 'type[Document] | type[Project]') -> str:
    while True:
        nonce = "".join(random.choices(NONCE_TOKENS, k=NONCE_LENGTH))
        try:
            model.objects.get(nonce=nonce)
        except model.DoesNotExist:
            return nonce
        except OperationalError:
            return nonce

def generate_document_nonce() -> str:
    return generate_nonce(Document)

def generate_project_nonce() -> str:
    return generate_nonce(Project)


class Settings(models.Model):

    id = models.BigAutoField(primary_key=True)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    objective_start_hours = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(23)])
    calendar_lookahead = models.PositiveIntegerField(default=3)
    beach_mode = models.BooleanField(default=False)
    trash_period = models.PositiveIntegerField(default=30)
    mood_log_hours = models.PositiveIntegerField(default=19, validators=[MinValueValidator(0), MaxValueValidator(23)])
    mood_activities = models.TextField(default="Hiking 🥾\nRunning 🏃\nParty 🎉")
    mood_log_lookback_days = models.PositiveIntegerField(default=2)
    groceries_data = models.TextField(blank=True, null=True)

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

    @property
    def groceries(self) -> dict:
        if self.groceries_data:
            return json.loads(self.groceries_data)
        return {}


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
        return self.documents.count() # type: ignore

    @property
    def title(self) -> str:
        return "#" + self.name


class Document(models.Model):

    NOTE = "note"
    SHEET = "sheet"
    MAP = "map"
    TYPE_CHOICES = [
        (NOTE, "Note"),
        (SHEET, "Sheet"),
        (MAP, "Map")
    ]

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    type = models.CharField(max_length=5, choices=TYPE_CHOICES, default=NOTE)
    nonce = models.CharField(max_length=12, unique=True, blank=True, default=generate_document_nonce)
    date_creation = models.DateTimeField(default=timezone.now)
    date_modification = models.DateTimeField(default=timezone.now)
    date_access = models.DateTimeField(default=timezone.now)
    date_deletion = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(default=timezone.now)
    public = models.BooleanField(default=False)
    pinned = models.BooleanField(default=False)
    hidden = models.BooleanField(default=False)
    deleted = models.BooleanField(default=False)
    references = models.ManyToManyField("Document", blank=True, related_name="referenced_in")
    categories = models.ManyToManyField("Category", blank=True, related_name="documents")
    title = models.CharField(max_length=255, blank=True, null=True)
    subtitle = models.TextField(blank=True, null=True)
    content = models.TextField(blank=True, null=True)
    config = models.TextField(blank=True, null=True)

    class Meta:
        ordering = ["-date_modification"]

    def __str__(self):
        return f"[{self.user}] {self.id}. {self.title}"

    def get_absolute_url(self):
        return reverse(f"orgapy:document", args=[self.nonce])

    @property
    def type_icon(self) -> str:
        return {
            "note": "ri-sticky-note-line",
            "sheet": "ri-table-line",
            "map": "ri-map-2-line"
        }[self.type]

    def date_modification_display(self):
        now = datetime.datetime.now()
        if now.date() == self.date_modification.date():
            return "TODAY"
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

    def get_ongoing_projects(self):
        return self.project_set.exclude(status=Project.ARCHIVED).order_by("date_creation") # type: ignore

    def get_archived_projects(self):
        return self.project_set.filter(status=Project.ARCHIVED) # type: ignore
    
    @property
    def etag(self) -> str:
        return hashlib.sha256(f"{self.nonce}:{self.updated_at.timestamp()}".encode()).hexdigest()


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

    TODAY = 0
    TOMORROW = 1
    THISWEEK = 2
    NEXTWEEK = 3
    THISMONTH = 4
    NEXTMONTH = 5
    LATER = 6
    NODATE = 7

    GROUP_LABELS = [
        "Today",
        "Tomorrow",
        "This Week",
        "Next Week",
        "This Month",
        "Next Month",
        "Later",
        "No Date",
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

    @property
    def overdue(self) -> bool:
        if self.due_date is None:
            return False
        return timezone.now().date() > self.due_date
    
    def get_group(self, today: datetime.date) -> int:
        if self.due_date is None:
            return self.NODATE
        limit_today = today + datetime.timedelta(days=1)
        if self.due_date < limit_today:
            return self.TODAY
        limit_tomorrow = limit_today + datetime.timedelta(days=1)
        if self.due_date < limit_tomorrow:
            return self.TOMORROW
        limit_thisweek = limit_today + datetime.timedelta(days=6 - today.weekday())
        if self.due_date < limit_thisweek:
            return self.THISWEEK
        limit_nextweek = limit_thisweek + datetime.timedelta(days=7)
        if self.due_date < limit_nextweek:
            return self.NEXTWEEK
        dt = today + relativedelta(months=1)
        limit_thismonth = datetime.date(dt.year, dt.month, 1)
        if self.due_date < limit_thismonth:
            return self.THISMONTH
        limit_nextmonth = limit_thismonth + relativedelta(months=1)
        if self.due_date < limit_nextmonth:
            return self.NEXTMONTH
        return self.LATER

    def create_recurring_child(self):
        if self.recurring_mode == Task.ONCE or self.recurring_period is None:
            return
        delta = None
        if self.recurring_mode == Task.DAILY:
            delta = datetime.timedelta(days=self.recurring_period)
        elif self.recurring_mode == Task.WEEKLY:
            delta = datetime.timedelta(weeks=self.recurring_period)
        elif self.recurring_mode == Task.MONTHLY:
            delta = relativedelta(months=self.recurring_period)
        elif self.recurring_mode == Task.YEARLY:
            delta = relativedelta(years=self.recurring_period)
        else:
            return
        print("Delta:", delta)
        due_date = self.due_date
        start_date = self.start_date
        today = datetime.datetime.now().date()
        while self.recurring_period: # avoid infinite loop if recurring period is zero
            start_date += delta
            if due_date is not None:
                due_date += delta
            if start_date >= today:
                break
        print("Start date:", start_date)
        print("Due date:", due_date)
        child = Task.objects.create(
            user=self.user,
            title=self.title,
            start_date=start_date,
            due_date=due_date,
            recurring_mode=self.recurring_mode,
            recurring_period=self.recurring_period,
            recurring_parent=self if self.recurring_parent is None else self.recurring_parent,
        )
        print("Child:", child)
    
    def get_absolute_url(self):
        return reverse("orgapy:task", args=[self.id])
        

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
    date_creation = models.DateTimeField(default=timezone.now)
    date_modification = models.DateTimeField(default=timezone.now)
    date_archived = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    title = models.CharField(max_length=255, blank=True, null=True)
    checklist = models.TextField(blank=True, null=True)
    document = models.ForeignKey("Document", on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=2, choices=STATUS_CHOICES, default=ACTIVE)

    class Meta:

        ordering = ["-date_creation"]

    def __str__(self):
        return f"{ self.user} - { self.id }. { self.title }"

    def get_absolute_url(self):
        return reverse("orgapy:project", args=[self.id])
    
    @property
    def etag(self) -> str:
        return hashlib.sha256(f"{self.id}:{self.updated_at.timestamp()}".encode()).hexdigest()

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
        if self.document is None and self.title is not None:
            return self.title
        if self.document is not None and self.title is None:
            return self.document.title
        if self.document is not None and self.title is not None:
            return f"{self.document.title} - {self.title}"
        return "Untitled"

    def to_json_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "checklist": self.checklist if self.checklist else None,
            "document": None if self.document is None else {
                "nonce": self.document.nonce,
                "title": self.document.title,
                "url": self.document.get_absolute_url(),
            },
            "status": self.status,
            "url": self.get_absolute_url(),
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
        now = datetime.datetime.now()
        this_morning = datetime.datetime(now.year, now.month, now.day, 0, 0, 0, 0, now.tzinfo)
        with caldav.DAVClient(url=self.url, username=self.username, password=self.password) as client:
            principal = client.principal()
            for calendar in principal.calendars():
                if calendar.name != self.calendar_name:
                    continue
                events = calendar.search(
                    start=this_morning,
                    end=this_morning + datetime.timedelta(days=lookahead),
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
                assert isinstance(calendar, caldav.Calendar) # type: ignore
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

    def get_absolute_url(self):
        return reverse("orgapy:progress_log", args=[self.id])

    @property
    def dt_html(self) -> str:
        return f"{self.dt.year}-{self.dt.month:02d}-{self.dt.day:02d}T{self.dt.hour:02d}:{self.dt.minute:02d}"
    
    def get_icon_class(self) -> str:
        if self.type == self.PROJECT_CHECKLIST_ITEM_CHECKED:
            return "ri-briefcase-line"
        elif self.type == self.TASK_COMPLETED:
            return "ri-task-line"
        elif self.type == self.OBJECTIVE_COMPLETED:
            return "ri-focus-2-line"
        else:
            return "ri-bar-chart-2-line"


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

    @property
    def overall(self) -> int:
        return self.mood + self.energy + self.health + self.stress - 4

    @property
    def label(self) -> str:
        return ["-", "Devastated", "Very bad", "Bad", "Not Great", "Neutral", "Good", "Very good", "Excellent"][self.overall]
