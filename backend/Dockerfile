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
COPY pyproject.toml poetry.lock ./
RUN poetry install --no-interaction --no-ansi --no-root

# Copy source code (also mounted as volume in dev via docker-compose)
COPY src/ ./src/
COPY data/ ./data/

# Make the backend package importable
ENV PYTHONPATH=/app/src
