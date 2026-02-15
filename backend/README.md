#+#+#+#+markdown
# Routed Backend

FastAPI backend for the Routed project. Provides REST endpoints, authentication, and persistence via PostgreSQL.

## Tech Stack

- FastAPI + Uvicorn
- SQLAlchemy + GeoAlchemy2
- Pydantic
- PostgreSQL
- Poetry
- Pytest

## Project Layout

```
backend/
├── src/
│   └── backend/
│       ├── main.py          # FastAPI application
│       ├── config/          # DB and env configuration
│       ├── models/          # SQLAlchemy models
│       └── routes/          # API routes
└── tests/                   # Pytest suite
```

## Setup

```bash
cd backend
poetry install
poetry run dev
```

The API runs at `http://localhost:8000` and OpenAPI docs are at `http://localhost:8000/docs`.

## Environment Variables

Create `env/.env` (not committed) with the database and app settings. Minimal example:

```bash
# Database
POSTGRES_USER=routed_user
POSTGRES_PASSWORD=routed_password
POSTGRES_DB=routed

# For backend running locally against a local DB
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432
```

If you run PostgreSQL via Docker Compose and run the backend locally, use `POSTGRES_PORT=5433` (compose maps `5433:5432`). If both backend and DB run in Docker Compose, set `POSTGRES_HOST=postgres` and `POSTGRES_PORT=5432`.

## Tests

Run the test suite with Poetry:

```bash
cd backend
poetry run test
```

Notes:

- Tests live under `backend/tests/` and use Pytest.
- [backend/tests/test_health.py](backend/tests/test_health.py) validates the `/health` endpoint and checks the DB connectivity flag returned by the API.
- [backend/tests/test_jwt_auth.py](backend/tests/test_jwt_auth.py) covers JWT creation/verification and login flows; it registers/login users against the real app and cleans up via `SessionLocal`.
- [backend/tests/test_models.py](backend/tests/test_models.py) asserts SQLAlchemy metadata (columns, nullability, uniqueness, FK constraints, and GeoAlchemy2 geometry setup).
- [backend/tests/test_user_routes.py](backend/tests/test_user_routes.py) tests user routes with a mocked DB session (dependency override) for success/failure paths, plus JWT-authenticated delete.
- If your tests touch the database (health or JWT/login), ensure your `env/.env` points to a test-safe instance.
