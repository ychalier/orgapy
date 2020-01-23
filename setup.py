import os
from setuptools import find_packages, setup

with open(os.path.join(os.path.dirname(__file__), 'README.rst')) as readme:
    README = readme.read()

# allow setup.py to be run from any path
os.chdir(os.path.normpath(os.path.join(os.path.abspath(__file__), os.pardir)))

setup(
    name='django-orgapy',
    version='0.6',
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
        'Framework :: Django :: 3.0.2',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Programming Language :: Python :: 3.7',
        'Topic :: Internet :: WWW/HTTP',
        'Topic :: Internet :: WWW/HTTP :: Dynamic Content',
    ],
    install_requires=[
        "urllib3==1.24.1",
        "Pygments==2.3.1",
        "mistune==2.0.0a2",
        "caldav==0.6.2",
        "Django==3.0.2",
        "icalendar==4.0.4",
        "python_dateutil==2.8.1",
        "xhtml2pdf==0.2.4",
    ]
)
