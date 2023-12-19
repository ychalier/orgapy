# Orgapy

A web application for storing **notes** and keeping track of **tasks** and **habits**.

## Getting Started

### Prerequisites

You'll need Python 3, and a [Django](https://www.djangoproject.com/) project.

### Installation

1. Install the latest release of `django-orgapy`
2. Add `orgapy` to the `INSTALLED_APPS` variables in Django settings.py
3. Migrate the database
4. Collect new static files
5. Setup URLs

    ```python
    from django.urls import include
    import orgapy.urls
    urlpatterns = [
        path("orgapy/", include("orgapy.urls", namespace="orgapy")),
    ]
    ```
6. Reload your server, and it should be up.

### Permissions

The app uses Django built-in authentication framework, meaning that users need a Django account to created and edit notes. They also need to be granted Orgapy's permissions, such as `orgapy.add_note` or `orgapy.view_note`. On my server, I use a Django group for that matter.

## Built With

-  [Django](https://www.djangoproject.com/) - Web application framework for Python.
-  [showdownjs](https://github.com/showdownjs/showdown) - A JavaScript library for parsing Markdown

## Contributing

Contributions are welcomed. Push your branch and create a pull request detailling your changes.

## Authors

Project is maintained by [Yohan Chalier](https://chalier.fr).

## License

This project is licensed under the [GNU GPLv3](LICENSE) license.

