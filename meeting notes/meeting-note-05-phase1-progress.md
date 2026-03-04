# Meeting Note 05 — Task Allocation, Sprint Flow, and Delivery Plan

## End-to-End Work Breakdown

### Stream A: Authentication and Account
- Backend tasks:
	- Maintain `/users/register` and `/users/login` behavior and validations.
	- Maintain `/users/me` get/update/delete and profile picture upload.
	- Ensure JWT creation/verification remains consistent.
- Frontend tasks:
	- Keep login/signup flows aligned to backend payloads.
	- Handle auth failures with actionable UI messages.
	- Ensure logout clears local token/state safely.

### Stream B: Trips and Locations
- Backend tasks:
	- Maintain trip CRUD and ownership constraints.
	- Enforce date validation and location existence checks.
	- Maintain location listing/detail endpoints.
- Frontend tasks:
	- Replace local-only trip form persistence with API persistence.
	- Build trip list, edit, and delete against backend.
	- Integrate location data into trip creation flow.

### Stream C: Matching Engine and Match UX
- Backend tasks:
	- Keep automatic match create/recalculate/delete behavior stable.
	- Maintain match status transition rules.
	- Extend scoring logic incrementally from baseline.
- Frontend tasks:
	- Integrate `/matches` and `/matches/me` in UI.
	- Add accept/reject flow and status visualization.
	- Display match details from “my perspective” contract.

## Sprint Execution Pattern
1. Plan endpoint contract and acceptance criteria.
2. Implement backend route/service/model updates.
3. Add/adjust backend tests.
4. Integrate frontend page/API flow.
5. Run joint verification on full user journey.

## Definition of Done
- API endpoint behavior validated by tests.
- Frontend flow uses live backend data (no local fallback for production path).
- Error handling implemented for invalid credentials, auth failures, and not-found cases.
- Documentation and notes updated for delivered changes.

## Immediate Next Iteration Priorities
1. Complete backend-connected trip creation/edit/list flow in dashboard/trips.
2. Complete backend-connected matches page and status actions.
3. Finalize profile editing including image upload.
4. Prepare integrated demo script for professor review.
