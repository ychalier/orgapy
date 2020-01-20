Orgapy
======

Current version: **v0.3.2**

It is a Django application, whose purpose is to act as a notebook, allowing to
keep **notes** and manage **tasks**. Notes can be arranged into a **blog** for
anyone to see. It currently has the following features:

- Single note sharing
- Markdown markup support
- Code syntax highlighting
- Checklist Markdown support
- Export note to PDF

Getting Started
---------------

Prerequisites
~~~~~~~~~~~~~

Download the `latest release`_ available on the GitHub repository.

Installation
~~~~~~~~~~~~~

1. Install the release to the Python environment

    .. code-block:: bash

        pip install django-orgapy-v0.3.2.tar.gz

2. Add ``orgapy`` to the ``INSTALLED_APPS`` variables in Django settings

    .. code-block:: python

        INSTALLED_APPS = [
            ...,
            'orgapy'
        ]

3. Migrate the database

    .. code-block:: bash

        python manage.py migrate

4. Collect the new static files

    .. code-block:: bash

        python manage.py collectstatic

5. Setup the URLs

    .. code-block:: python

        from django.urls import include
        import orgapy.urls
        urlpatterns = [
            ...,
            path("orgapy/", include("orgapy.urls")),
        ]

Built With
----------

-  `Django`_ - Web application framework for Python.
-  `Mistune`_ - A fast yet powerful Python Markdown parser with renderers and plugins.
-  `xhtml2pdf`_ - A library for converting HTML into PDFs using ReportLab.

Contributing
------------

Contributions are welcomed. Push your branch and create a pull request
detailling your changes.

Authors
-------

Project is maintained by `Yohan Chalier`_. See the list of
`contributors`_ who participated.

License
-------

This project is licensed under the MIT License - see the
`LICENSE`_ file for details.


.. _Django: https://www.djangoproject.com/
.. _Mistune: https://github.com/lepture/mistune
.. _xhtml2pdf: https://github.com/xhtml2pdf/xhtml2pdf
.. _Yohan Chalier: https://github.com/ychalier/
.. _contributors: https://github.com/ychalier/rolepy/graphs/contributors
.. _LICENSE: LICENSE
.. _latest release: https://github.com/ychalier/orgapy/releases
