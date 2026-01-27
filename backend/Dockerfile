# Backend Dockerfile
FROM python:3.14-slim

WORKDIR /app

# Install poetry
RUN pip install --no-cache-dir poetry==2.1.1

# Copy dependency file
COPY pyproject.toml ./
RUN poetry config virtualenvs.create false \
	&& poetry install --no-interaction --no-ansi --no-root --only main

# Copy application code
COPY src/ ./src/

# Create logs directory
RUN mkdir -p logs

# Expose FastAPI port
EXPOSE 8000

# Set PYTHONPATH for src
ENV PYTHONPATH=/app/src

# Default command
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
