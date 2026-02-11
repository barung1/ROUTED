# Info regarding .env files

This folder is meant to keep the local env/.env out of git. Use the template and scripts below to create it.

Use one of the scripts below to create env/.env from the template file:

- PowerShell (Windows):
	- Run: ./env/create-env.ps1
	- Overwrite: ./env/create-env.ps1 -Force
- Bash (macOS/Linux):
	- Run: ./env/create-env.sh

If you prefer to do it manually, create env/.env and fill it with these keys (sample values provided in env/env.template.txt):

# Database Configuration

POSTGRES_USER=routed_user

POSTGRES_PASSWORD=routed_password

POSTGRES_DB=routed

POSTGRES_HOST=127.0.0.1

POSTGRES_PORT=5432

DATABASE_URL=

# Backend

LOG_LEVEL=INFO

PYTHONUNBUFFERED=1

# Frontend

VITE_API_URL=http://localhost:8000
