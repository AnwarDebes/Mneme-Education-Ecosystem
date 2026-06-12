# Minimal shim so `pip install -e .` works on environments without
# the latest PEP 660 frontend. All real configuration lives in
# pyproject.toml.
from setuptools import setup

setup()
