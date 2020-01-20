import re
import datetime
import mistune
from django.db import models
from pygments import highlight
from pygments.lexers import get_lexer_by_name
from pygments.formatters import html
from pygments.util import ClassNotFound


class HighlightRenderer(mistune.HTMLRenderer):
    """Custom mistune renderder to handle syntax highlighting"""

    def block_code(self, code, lang=None):
        """Use pygments to highlight a markdown code block"""
        if lang:
            try:
                lexer = get_lexer_by_name(lang, stripall=True)
                formatter = html.HtmlFormatter()
                return highlight(code, lexer, formatter)
            except ClassNotFound:
                return "<pre><code>" + mistune.escape(code) + "</code></pre>"
        return "<pre><code>" + mistune.escape(code) + "</code></pre>"

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
        if prefix[1].lower() == "x":
            checked = True
        if checked:
            checkbox = "<input type=\"checkbox\" class=\"task-list-item-checkbox\" checked disabled/> "
        else:
            checkbox = "<input type=\"checkbox\" class=\"task-list-item-checkbox\" disabled /> "
        return new_list_item(self, checkbox + text[match.end():])


class Category(models.Model):
    """Represent a general note category"""

    name = models.CharField(max_length=255)

    def __str__(self):
        return "#" + self.name

    class Meta:
        order_with_respect_to = "name"


class Note(models.Model):
    """Represent a general note, ie. a title and a text"""

    date_creation = models.DateTimeField(auto_now_add=True, auto_now=False)
    date_modification = models.DateTimeField(auto_now_add=False, auto_now=True)
    date_access = models.DateTimeField(auto_now_add=False, auto_now=True)
    title = models.CharField(max_length=255)
    content = models.TextField()
    slug = models.SlugField(unique=True, max_length=255)
    public = models.BooleanField(default=False)
    categories = models.ManyToManyField("Category", blank=True)

    def __str__(self):
        return str(self.id) + ". " + self.title

    def markdown(self):
        """Produce html code from Markdown content"""
        self.date_access = datetime.datetime.now()
        self.save()
        factory = mistune.create_markdown(
            renderer=HighlightRenderer(),
            escape=False,
            plugins=[
                "strikethrough",
                "table",
                "footnotes"
            ]
        )
        return factory(self.content)


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


class Publication(models.Model):
    """Represent the blog-related information associated to a note"""

    note = models.OneToOneField(
        "Note",
        on_delete=models.CASCADE,
        primary_key=True
    )
    date_publication = models.DateTimeField(auto_now_add=True, auto_now=False)
    abstract = models.TextField(default="")
    author = models.CharField(max_length=255)

    def __str__(self):
        return "Publication<%s>" % self.note
