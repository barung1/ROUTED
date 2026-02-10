FROM python:3.14-slim

# System deps
RUN apt-get update && \
	apt-get install -y --no-install-recommends \
	postgresql-client \
	curl && \
	rm -rf /var/lib/apt/lists/*

# Python tooling
RUN pip install --no-cache-dir poetry

# Prevent Poetry from creating venvs
ENV POETRY_VIRTUALENVS_CREATE=false

WORKDIR /app
