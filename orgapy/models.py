import re
import datetime
from django.db import models
from django.utils.text import slugify
from django.conf import settings
from django.urls import reverse


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


class Task(models.Model):
    """Represent the task-related information associated to a note"""

    note = models.OneToOneField(
        "Note",
        on_delete=models.CASCADE,
        primary_key=True
    )
    date_due = models.DateField(blank=True, null=True)
    date_done = models.DateTimeField(blank=True, null=True)
    done = models.BooleanField(default=False)

    class Meta:

        ordering = ["date_due"]

    def __str__(self):
        return "Task<%s>" % self.note
    
    def get_absolute_url(self):
        return reverse("orgapy:view_note", kwargs={"nid": self.note.id})

    def urgent(self):
        """Return whether the task has not been done in time"""
        if self.date_due is None:
            return False
        return (datetime.datetime.now().strftime("%Y-%m-%d") > self.date_due.strftime("%Y-%m-%d"))

    def today(self):
        """Rerturn wether the task should be done today"""
        if self.date_due is None:
            return False
        return (datetime.datetime.now().strftime("%Y-%m-%d") == self.date_due.strftime("%Y-%m-%d"))


def daterange(start_date, end_date, step):
    """Iterate over datetime.date objects"""
    for i in range(0, int((end_date - start_date).days) + 1, step):
        yield start_date + datetime.timedelta(days=i)


def last_day_of_month(any_day):
    """Return a datetime for the month end of a given day"""
    next_month = any_day.replace(day=28) + datetime.timedelta(days=4)
    return next_month - datetime.timedelta(days=next_month.day)


class Objective(models.Model):

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    history = models.TextField(default="", blank=True)
    date_start = models.DateField()
    period = models.PositiveIntegerField(default=1)
    goal = models.PositiveIntegerField(default=1)

    class Meta:

        ordering = ["name"]

    def __str__(self):
        return self.name


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


class Quote(Note):

    work = models.ForeignKey("Work", on_delete=models.CASCADE)

    def _content_preprocess(self):
        return re.sub("^ ?- ", "&mdash; ", self.content.replace("\n", "\n\n"), flags=re.MULTILINE)


class Project(models.Model):

    IDEA = "ID"
    ONGOING = "ON"
    PAUSED = "PA"
    FINISHED = "FI"
    STATUS_CHOICES = (
        (IDEA, "Idea"),
        (ONGOING, "Ongoing"),
        (PAUSED, "Paused"),
        (FINISHED, "Finished"),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date_creation = models.DateTimeField(auto_now_add=True, auto_now=False)
    date_modification = models.DateTimeField(auto_now_add=False, auto_now=True)
    title = models.CharField(max_length=255)
    category = models.CharField(max_length=255, default="general")
    status = models.CharField(max_length=2, choices=STATUS_CHOICES, default=IDEA)
    limit_date = models.DateField(blank=True, null=True)
    progress_min = models.PositiveIntegerField(blank=True, null=True)
    progress_max = models.PositiveIntegerField(blank=True, null=True)
    progress_current = models.PositiveIntegerField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    checklist = models.TextField(blank=True, null=True)
    rank = models.FloatField()

    class Meta:

        ordering = ["-date_creation"]

    def __str__(self):
        return f"{ self.user} - { self.id }. { self.title }"
