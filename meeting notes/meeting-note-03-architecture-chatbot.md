# Meeting Note 03 — Implementation Planning from Project Start

## Phase 0: Foundation Setup
- Create repository structure for backend/frontend/env/docs.
- Configure local environments and Docker Compose pipeline.
- Establish coding conventions, lint/test commands, and PR workflow.

## Phase 1: Core Platform (Current Baseline)
- Backend completed/in progress:
	- `/health` service verification.
	- User registration/login and profile operations.
	- Trip CRUD with ownership and date validation.
	- Match APIs with filtering, pagination, and status transitions.
	- Location APIs protected by JWT.
- Frontend completed/in progress:
	- App route skeleton and sidebar navigation.
	- Login/signup screens connected to backend auth.
	- Dashboard/trips/explore/matches/profile pages scaffolded.
	- API client with token injection interceptor.

## Phase 2: Product Completion Priorities
- Replace local-storage trip placeholders with backend-driven trip data.
- Connect explore and matches pages to real APIs end-to-end.
- Complete profile editing and file upload UX around `/users/me/profile-picture`.
- Finalize auth edge cases (invalid token, expired token handling, logout behavior).

## Phase 3: Matching Quality and Experience
- Extend scoring beyond fixed baseline score.
- Add compatibility signals (interests, budget, travel mode).
- Improve explainability of why two trips matched.
- Add integration tests for matching recalculation on trip updates.

## Feature Deferral Decision
- Chatbot remains a lightweight backend-adjacent feature (if needed later), not a separate microservice/module in MVP.
- Priority remains core matching flow reliability over new auxiliary modules.

## Exit Criteria per Phase
- API contract stable.
- Frontend integrated for all MVP routes.
- Passing tests for health/auth/users/trips/matches.
- Demo-ready end-to-end journey: signup → create trip → receive and manage matches.
