# Meeting Note 02 — System Architecture Planning

## Architecture Overview
Routed follows a layered full-stack architecture:
- Frontend SPA (React + TypeScript) for user flows and API consumption.
- Backend API (FastAPI) for authentication, domain rules, and data access.
- PostgreSQL as system of record.
- Docker Compose for local full-stack orchestration.

## Backend Module Planning
- `routes/`: HTTP contract layer (`user`, `trip`, `match`, `location`).
- `api_models/`: request/response schemas and validation contracts.
- `models/`: database entities (`User`, `Trip`, `Match`, `Location`, `Tag`).
- `auth/`: JWT generation and verification utilities.
- `services/`: reusable business logic (`MatchService` as first service module).
- `scripts/`: seeding and operational scripts.

## Core Domain Flow
1. User registers/logs in and receives JWT.
2. User creates a trip tied to a location.
3. Backend triggers match calculation after trip create/update when status is `PLANNED`.
4. Match lifecycle proceeds through statuses (pending/accepted/rejected variants).
5. User views match details from their own perspective (`/matches/me`).

## Frontend Architecture Planning
- Route shell with sidebar navigation and page-level modules.
- API client wrapper with automatic Bearer token injection from local storage.
- Auth entry points: login/signup.
- Product pages aligned to backend features: dashboard, trips, explore, matches, profile.

## Non-Functional Planning
- Security: auth on protected routes and ownership checks.
- Maintainability: isolate matching rules in service layer for extension.
- Testability: backend endpoint tests and model/auth tests required before feature signoff.
- Observability: health endpoint plus backend logging.

## Architecture Decisions
1. Keep matching logic centralized in `MatchService` (not embedded in route handlers).
2. Keep frontend-to-backend integration API-first, driven by response models.
3. Use modular route grouping to support phased feature growth.
