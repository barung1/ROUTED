# Info regarding .env files

<mark>This should be the only file in this folder on remote</mark>

! TODO: Make script to automate making .env

If not on remote then make a .env file and fill it with these keys and whatever values you want for said keys, some sample valus have been provided for reference:

# Database Configuration

POSTGRES_USER=xyz

POSTGRES_PASSWORD=xyz

POSTGRES_DB=xyz

DATABASE_URL=postgresql://username:secure_pass@postgres:5432/routed_db

# Backend

LOG_LEVEL=INFO

PYTHONUNBUFFERED=1

# Frontend

VITE_API_URL=<http://localhost:8000>
