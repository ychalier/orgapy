import os
from setuptools import find_packages, setup

with open(os.path.join(os.path.dirname(__file__), 'README.rst')) as readme:
    README = readme.read()

# allow setup.py to be run from any path
os.chdir(os.path.normpath(os.path.join(os.path.abspath(__file__), os.pardir)))

setup(
    name='django-orgapy',
    version='1.2.0',
    packages=find_packages(),
    include_package_data=True,
    license='MIT License',
    description='A Django app to handles notes, tasks, and events.',
    long_description=README,
    url='https://yohan.chalier.fr/',
    author='Yohan Chalier',
    author_email='yohan@chalier.fr',
    classifiers=[
        'Environment :: Web Environment',
        'Framework :: Django',
        'Framework :: Django :: 3.1.5',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Programming Language :: Python :: 3.7',
        'Topic :: Internet :: WWW/HTTP',
        'Topic :: Internet :: WWW/HTTP :: Dynamic Content',
    ],
    install_requires=[
        "urllib3",
        "Pygments",
        "mistune",
        "Django>=3.1.5",
        "python_dateutil",
        "xhtml2pdf",
    ],
    dependency_links=[
        "https://packages.chalier.fr/"
    ]
)
