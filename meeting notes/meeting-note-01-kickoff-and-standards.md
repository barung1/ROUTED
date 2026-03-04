# Meeting Note 01 — Project Kickoff, Scope, and Standards

## Project Context
Routed is a travel partner recommendation system that matches users based on destination overlap, time overlap, and evolving compatibility rules.

## Problem Statement Alignment
- Users can travel at irregular times and need compatible partners.
- Existing solutions do not strongly align personal preferences with trip compatibility.
- Routed focuses on consent-driven and privacy-aware matching.

## Initial Scope (MVP Foundation)
- Authentication: user registration and login with JWT.
- User profile: editable account data and profile picture support.
- Trip management: create, list, update, delete trips.
- Matching: automatic trip-to-trip matching with status workflow.
- Location discovery: destination list for trip creation and exploration.
- Frontend journey: landing, login/signup, dashboard, trips, explore, matches, profile.

## Technical Standards
- Backend stack: FastAPI, SQLAlchemy, Pydantic, PostgreSQL, Pytest.
- Frontend stack: React, TypeScript, Vite, Tailwind.
- API-first workflow: OpenAPI docs exposed via `/docs`.
- Test-first expectation for critical APIs (`/health`, auth, trips, users, matches).
- Environment consistency via `env/.env` template and Docker Compose.

## Engineering Rules Agreed
- Keep route handlers thin; put business logic in services.
- Require JWT for protected endpoints (`/matches`, `/locations`, profile/trip ownership operations).
- Enforce ownership checks for user and trip data.
- Use explicit response models for stable frontend/backend integration.

## Deliverables from Kickoff
1. Baseline architecture and module boundaries.
2. Team split for backend/frontend with shared integration checkpoints.
3. Implementation roadmap with MVP priorities.
4. Test coverage targets for core API behavior.
