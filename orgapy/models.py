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


class Quote(models.Model):

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    date_creation = models.DateTimeField(auto_now_add=True, auto_now=False)
    date_modification = models.DateTimeField(auto_now_add=True, auto_now=False)
    title = models.CharField(max_length=255)
    content = models.TextField()
    from_work = models.ForeignKey("Work", on_delete=models.CASCADE)

    class Meta:

        ordering = ["-date_modification"]

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

    class Meta:

        ordering = ["-date_creation"]

    def __str__(self):
        return f"{ self.user} - { self.id }. { self.title }"
