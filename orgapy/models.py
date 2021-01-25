import re
import datetime
import mistune
from piweb.utils import MarkdownRenderer
from django.db import models
from django.utils.text import slugify
from django.conf import settings


class CheckableMarkdownRenderer(MarkdownRenderer):

    def __init__(self, *args, **kwargs):
        MarkdownRenderer.__init__(self, *args, **kwargs)
        self.checkboxes_index = 0

    def list_item(self, text, level):
        """Render list item with task list support"""
        old_list_item = mistune.HTMLRenderer.list_item
        new_list_item = lambda _, text: "<li class=\"task-list-item\">%s</li>\n" % text
        task_list_re = re.compile(r"\[[xX ]\] ")
        match = task_list_re.match(text)
        if match is None:
            return old_list_item(self, text, level)
        prefix = match.group()
        checked = False
        checkbox_id = self.checkboxes_index
        self.checkboxes_index += 1
        if prefix[1].lower() == "x":
            checked = True
        checked_txt = ""
        if checked:
            checked_txt = "checked"
        return new_list_item(self, "<input type=\"checkbox\" class=\"task-list-item-checkbox\" id=\"cb%s\" %s/> <label for=\"cb%s\">%s</label>" % (
            checkbox_id,
            checked_txt,
            checkbox_id,
            text[match.end():]
        ))


class Category(models.Model):
    """Represent a general note category"""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)

    def __str__(self):
        return "#" + self.name

    class Meta:
        order_with_respect_to = "name"


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

    def __str__(self):
        return str(self.id) + ". " + self.title

    def _content_preprocess(self):
        return self.content

    def markdown(self):
        """Produce html code from Markdown content"""
        self.date_access = datetime.datetime.now()
        self.save()
        factory = mistune.create_markdown(
            renderer=CheckableMarkdownRenderer(),
            escape=False,
            plugins=[
                "strikethrough",
                "table",
                "footnotes"
            ]
        )
        return factory(self._content_preprocess())


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

    def __str__(self):
        return "Task<%s>" % self.note

    def urgent(self):
        """Return whether the task has not been done in time"""
        if self.date_due is None:
            return False
        return (datetime.datetime.now().strftime("%Y-%m-%d")
                > self.date_due.strftime("%Y-%m-%d"))

    def today(self):
        """Rerturn wether the task should be done today"""
        if self.date_due is None:
            return False
        return (datetime.datetime.now().strftime("%Y-%m-%d")
                == self.date_due.strftime("%Y-%m-%d"))


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
    date_start = models.DateField(auto_now_add=True, auto_now=False)

    def __str__(self):
        return self.name

    def _cast(self, _):
        raise NotImplementedError

    def _step(self):
        raise NotImplementedError

    def to_array(self, date_start=None, date_end=None):
        """Convert text history to an array format"""
        array = list()
        if date_start is None:
            date_start = self.date_start
        if date_end is None:
            date_end = datetime.datetime.today()
        date_start = self._cast(date_start)
        date_end = self._cast(date_end)
        current = self._cast(datetime.datetime.today())
        offset = (date_start - self._cast(self.date_start)).days // self._step()
        for i, date in enumerate(daterange(date_start, date_end, self._step())):
            j = i + offset
            if 0 <= j < len(self.history):
                array.append({
                    "date": date,
                    "checked": str(self.history)[j] == "1",
                    "overflow": (self._cast(date) > current
                                 or self._cast(date) < self._cast(self.date_start)),
                    "current": self._cast(date) == current,
                })
            else:
                array.append({
                    "date": date,
                    "checked": False,
                    "overflow": (self._cast(date) > current
                                 or self._cast(date) < self._cast(self.date_start)),
                    "current": self._cast(date) == current,
                })
        return array

    def from_array(self, array):
        """Write history from the array"""
        self.history = "".join(map(
            lambda x: {True: "1", False: "0"}[x["checked"]],
            array
        ))
        self.save()

    def check_current(self):
        """Check current index"""
        array = self.to_array()
        array[-1]["checked"] = True
        self.from_array(array)

    def uncheck_current(self):
        """Uncheck current index"""
        array = self.to_array()
        array[-1]["checked"] = False
        self.from_array(array)

    def is_current_done(self):
        """Return if current index is checked"""
        return self.to_array(date_start=datetime.datetime.today())[0]["checked"]
    
    def current_year(self):
        """Check array for the current year"""
        epoch_year = datetime.date.today().year
        date_start = datetime.date(epoch_year, 1, 1)
        date_end = datetime.date(epoch_year, 12, 31)
        while date_start.weekday() != 0:
            date_start += datetime.timedelta(days=1)
        while date_end.weekday() != 6:
            date_end += datetime.timedelta(days=1)
        return self.to_array(
            date_start=date_start,
            date_end=date_end
        )


class DailyObjective(Objective):

    def _cast(self, date):
        if type(date) == datetime.date:
            return date
        return date.date()

    def _step(self):
        return 1

    def current_month(self):
        """Check array for the current month"""
        return self.to_array(
            date_start=datetime.datetime.today().date().replace(day=1),
            date_end=last_day_of_month(datetime.datetime.today().date())
        )
    
    def freq(self):
        return "daily"


class WeeklyObjective(Objective):

    def _cast(self, date):
        if type(date) == datetime.date:
            return date - datetime.timedelta(days=date.weekday())
        return date.date() - datetime.timedelta(days=date.weekday())

    def _step(self):
        return 7
    
    def freq(self):
        return "weekly"


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
