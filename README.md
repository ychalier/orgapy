# Orgapy

It is a Django application, whose purpose is to act as a notebook, allowing to
keep **notes** and manage **tasks**. Here are some features:

- Markdown markup support (with checklists)
- Code syntax highlighting
- Share note publicly
- Export note as PDF
- Tasks tracking
- Habits tracking

## Getting Started

### Prerequisites

You'll need Python 3, and a [Django](https://www.djangoproject.com/) project.

### Installation

1. Install the release to the Python environment

    ```console
    pip install --extra-index-url="https://packages.chalier.fr" django-orgapy
    ```

2. Add `orgapy` to the `INSTALLED_APPS` variables in Django settings.py

    ```python
    INSTALLED_APPS = [
        '...',
        'orgapy',
        '...',
    ]
    ```  

3. Migrate the database

    ```console
    python manage.py migrate
    ```

4. Collect the new static files

    ```console
    python manage.py collectstatic
    ```

5. Setup the URLs

    ```python
    from django.urls import include
    import orgapy.urls
    urlpatterns = [
        ...,
        path("orgapy/", include("orgapy.urls")),
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

This project is licensed under the MIT License - see the [LICENSE](https://github.com/ychalier/rolepy/graphs/contributors) file for details.

