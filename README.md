# Orgapy

A personnal notebook webapp.

## Getting Started

### Prerequisites

You'll need Python 3, and a [Django](https://www.djangoproject.com/) project.

### Installation

1. Install the [latest release](https://github.com/ychalier/orgapy/releases/latest)
    ```console
    pip install django-orgapy-X.X.X.tar.gz
    ```
2. Add `"orgapy"` to the `INSTALLED_APPS` variables in Django settings
3. Migrate the database
    ```console
    python manage.py migrate
    ```
4. Collect new static files
    ```console
    python manage.py collectstatic
    ```
5. Setup URLs

    ```python
    from django.urls import include
    import orgapy.urls
    urlpatterns = [
        path("orgapy/", include("orgapy.urls", namespace="orgapy")),
    ]
    ```
6. Restart the server

## Description

### Main Features

- Write notes in Markdown
- Track current projects
- Track current tasks
- Track regular habits
- Integrate events from a CalDAV server
- Store quotes
- Edit spreadsheets (stored as TSV)
- Edit maps (stored as GeoJSON)

### Permissions

The app uses Django built-in authentication framework, meaning that users need a Django account to created and edit notes. They also need to be granted Orgapy's permissions, such as `orgapy.add_note` or `orgapy.view_note`.

## Built With

- [caldav](https://pypi.org/project/caldav/) - A CalDAV client library for Python.
- [dateutil](https://pypi.org/project/python-dateutil/) - Useful extensions to the standard Python datetime features.
- [Django](https://www.djangoproject.com/) - Web application framework for Python.
- [Fira Code](https://docs.xz.style/fonts/fira/fira-code) - Monospace font.
- [Fira Sans](https://docs.xz.style/fonts/fira/fira-sans) - Sans serif font.
- [highlight.js](https://highlightjs.org/) - Syntax highlighter.
- [Leaflet](https://leafletjs.com/) - An open-source JavaScript library for mobile-friendly interactive maps.
- [Remix Icon](https://remixicon.com/) - An open source icon library.
- [Showdown](https://showdownjs.com/) - A JavaScript library for parsing Markdown.
- [Showdown KaTeX](https://obedm503.github.io/showdown-katex/) - Showdown extension to render math.
- [SimpleMDE](https://simplemde.com/) - A simple, embeddable, and beautiful JS markdown editor.
- [sql.js](https://github.com/sql-js/sql.js/) -  A JavaScript library to run SQLite on the web.
- [zip.js](https://gildas-lormeau.github.io/zip.js/) -  A JavaScript library to zip and unzip files.

## Contributing

Contributions are welcomed. Push your branch and create a pull request detailling your changes.

## Authors

Project is maintained by [Yohan Chalier](https://chalier.fr).

## License

This project is licensed under the [GNU GPLv3](LICENSE) license.

