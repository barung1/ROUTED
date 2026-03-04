# Meeting Note 04 — Team Splitting and Responsibility Matrix

## Team Split Model

### Backend Team
- Own API contracts, data model integrity, and business rules.
- Maintain authentication, authorization, and secure data access.
- Deliver stable endpoints for frontend consumption.
- Maintain test reliability and seed data consistency.

### Frontend Team
- Own user journey, route flow, and component implementation.
- Integrate APIs and map backend errors to usable UI states.
- Manage token lifecycle in client storage and request headers.
- Deliver UX consistency across login, trips, explore, matches, and profile.

### Shared Responsibilities
- Align on API schemas before implementation.
- Validate integration with joint test sessions.
- Maintain shared backlog and clear acceptance criteria.
- Keep docs synchronized with implementation changes.

## Ownership by Module
- Backend `user` routes: registration, login, profile CRUD.
- Backend `trip` routes: create/list/update/delete with ownership checks.
- Backend `match` routes: match listing, detail, status transitions.
- Backend `location` routes: location retrieval and protection.
- Frontend auth pages: login and signup to backend endpoints.
- Frontend app routes: dashboard, trips, explore, suggestions, matches, profile.
- Frontend API client: centralized base URL and auth header injection.

## Working Agreement
- Backend publishes API changes before frontend implementation starts.
- Frontend flags contract mismatches within the same work cycle.
- No feature is marked done without minimal backend test coverage and frontend integration validation.
- Cross-team blockers are escalated in the same day to avoid sprint spillover.

## Risks and Mitigation
- Risk: drift between frontend payloads and backend models.
	- Mitigation: maintain contract checklist per endpoint.
- Risk: matching logic changes break existing UI assumptions.
	- Mitigation: version and document score/status semantics.
- Risk: auth handling inconsistency across pages.
	- Mitigation: single token handling path in API client + route guards.
