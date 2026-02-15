# Routed

**A Travel Partner Recommendation System**

**ECE 651 - Foundations of Software Engineering**

## Overview

Routed is a travel partner recommendation system designed to connect travelers with compatible companions based on personal preferences, trip details, and location. The focus is on meaningful travel connections through precise matching and consent-driven matchmaking.

## Problem Statement

Many individuals plan trips at random dates due to hybrid work and academic schedules. While they seek compatible companions for social interaction and enjoyable trips, existing platforms do not adequately account for personal preferences, resulting in non-compatible matches.

## Key Features (Most are yet to be implemented)

- **User Authentication** - Secure login and registration system
- **Profile Management** - Customize travel preferences and interests
- **Trip Management** - Create and manage trip details with structured data
- **Smart Recommendations** - Algorithm-driven matching based on preferences, dates, locations, and interests
- **Consent-Driven Matching** - Privacy-focused matchmaking with user control
- **Enhanced Privacy** - Data is protected and shared only with consent

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy, Pydantic, Uvicorn, PostgreSQL
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Tooling**: Poetry, Pytest, ESLint

## Architecture

```
Routed/
├── backend/          # FastAPI backend server
│   ├── src/
│   │   └── backend/
│   │       ├── main.py           # FastAPI application
│   │       ├── config/           # DB configuration
│   │       └── models/           # SQLAlchemy models
│   └── tests/        # Backend tests
├── frontend/         # React + TypeScript frontend
│   └── src/
├── env/              # Local .env (not committed)
├── UML/              # UML diagrams
└── project docs/     # Project documentation
```

## Getting Started

### Prerequisites

- Python 3.14+
- Node.js 18+
- Poetry (for Python dependency management)

### Environment Variables

Create `env/.env` (not committed) from the template in `env/env.template.txt`.

Use a helper script:

- PowerShell (Windows): `./env/create-env.ps1` (add `-Force` to overwrite)
- Bash (macOS/Linux): `./env/create-env.sh`

Or create it manually. Minimal example:

```bash
# Database
POSTGRES_USER=routed_user
POSTGRES_PASSWORD=routed_password
POSTGRES_DB=routed

# For backend running locally against a local DB
POSTGRES_HOST=127.0.0.1
POSTGRES_PORT=5432

# Frontend
VITE_API_URL=http://localhost:8000
```

If you run PostgreSQL via Docker Compose and run the backend locally, use `POSTGRES_PORT=5433` (compose maps `5433:5432`). If both backend and DB run in Docker Compose, set `POSTGRES_HOST=postgres` and `POSTGRES_PORT=5432`.

Backend-only runs require the database settings and `JWT_SECRET_KEY` (see `env/env.template.txt`). Full Docker Compose uses the same `env/.env` file for backend + frontend.

### Backend Setup

```bash
cd backend
poetry install
poetry run dev
```

The backend server starts at `http://localhost:8000`. OpenAPI docs are at `http://localhost:8000/docs`.

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend starts at `http://localhost:5173`.

### Docker Compose (Full Stack)

```bash
docker compose up --build
```

This starts PostgreSQL, the backend, and the frontend using `env/.env`.

## Testing

### Backend Tests

```bash
cd backend
poetry run test
```

## Development Approach

- **Modular Design** - Each component developed independently
- **Agile Methodology** - Iterative development with sprint planning
- **Backlog Planning** - Structured task management
- **Team Collaboration** - Task allocation and milestone tracking

## Project Goals

- Test effectiveness of the matching algorithm
- Measure user satisfaction and engagement
- Demonstrate improved discoverability of compatible travel companions
- Achieve higher confidence in partner selection

## Privacy & Security

- Consent-based information sharing
- Secure authentication
- Controlled visibility of trip details
- User-managed privacy settings

## License

This project is developed as part of ECE 651 coursework.

## Contributing

This is an academic project. For questions or suggestions, please contact the development team.

