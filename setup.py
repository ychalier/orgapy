import os
from setuptools import find_packages, setup

with open(os.path.join(os.path.dirname(__file__), 'README.md')) as readme:
    README = readme.read()

# allow setup.py to be run from any path
os.chdir(os.path.normpath(os.path.join(os.path.abspath(__file__), os.pardir)))

setup(
    name='django-orgapy',
    version='4.6.2',
    packages=["orgapy"],
    include_package_data=True,
    license='GNU GPLv3',
    description='A personnal notebook webapp.',
    long_description=README,
    url='https://chalier.fr/orgapy',
    author='Yohan Chalier',
    author_email='yohan@chalier.fr',
    classifiers=[
        'Environment :: Web Environment',
        'Framework :: Django',
        'Operating System :: OS Independent',
        'Programming Language :: Python',
        'Topic :: Internet :: WWW/HTTP',
        'Topic :: Internet :: WWW/HTTP :: Dynamic Content',
    ],
    install_requires=[
        "Django",
        "caldav",
        "python-dateutil"
    ],
)
