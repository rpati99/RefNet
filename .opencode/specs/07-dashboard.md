# Spec: Dashboard

## Overview
A React-based merchant dashboard that gives merchants a real-time overview of their referral program performance. Merchants can see aggregated stats across all their programs (total referrals, eligibility breakdown, payout summary) and drill into individual programs for detailed stats. This is the primary UI for merchants to monitor their referral programs after setup.

## Depends on
- Step 01: Project Scaffold + Database Schema (must be complete)
- Step 02: Auth (must be complete) — JWT auth protects all dashboard routes
- Step 03: Programs CRUD (must be complete) — dashboard reads programs
- Step 04: Advocates Referral Links (must be complete) — dashboard reads advocate and referral data
- Step 05: Webhook Handler (must be complete) — webhooks populate referral order data
- Step 06: Program Cron (must be complete) — cron creates payouts and updates referral status

## Routes

### Backend API (new)
- `GET /api/dashboard` — Aggregated stats for all merchant programs (referral counts by status, payout totals by status) — logged-in
- `GET /api/dashboard/programs/:programId` — Detailed stats for a single program (advocate count, referral breakdown by status, payout breakdown) — logged-in

### Frontend (new)
- `GET /` — Redirect to `/dashboard` for authenticated merchants
- `GET /dashboard` — Main dashboard page with program overview stats
- `GET /dashboard/programs/:programId` — Program detail page with full stats breakdown

## Database changes
None. All needed columns (`referrals.status`, `payouts.status`, `payouts.amount_cents`, `referrals.created_at`, etc.) already exist.

## Files to change
- `api/src/index.js` — mount `/api/dashboard` router
- `frontend/src/main.jsx` — React app entry with router (create file)
- `frontend/index.html` — HTML entry point (create file)

## Files to create

### Backend
- `api/src/routes/dashboard.js` — dashboard API routes
- `api/src/controllers/dashboardController.js` — request handlers
- `api/src/services/dashboardService.js` — business logic (aggregation queries)
- `api/src/repos/dashboardRepo.js` — raw SQL aggregation queries

### Frontend
- `frontend/index.html` — Vite HTML entry point
- `frontend/src/main.jsx` — React app bootstrap with React Router
- `frontend/src/App.jsx` — root component with routing
- `frontend/src/index.css` — global CSS with CSS variables
- `frontend/src/pages/DashboardPage.jsx` — main dashboard with program overview
- `frontend/src/pages/ProgramDetailPage.jsx` — single program detail view
- `frontend/src/components/StatCard.jsx` — reusable stat display card
- `frontend/src/components/ProgramRow.jsx` — program summary row with inline stats
- `frontend/src/lib/api.js` — JWT-authenticated fetch helper
- `frontend/package.json` — Vite + React + React Router dependencies
- `frontend/vite.config.js` — Vite configuration
- `frontend/.env` — `VITE_API_URL` environment variable

### Docker
- `docker-compose.yml` — add `frontend` service with volume mount and `VITE_API_URL` env var

## New dependencies

### Frontend
- `react`, `react-dom`, `react-router-dom` (via npm)

### Docker
- Node.js 18+ based frontend service in docker-compose

## Rules for implementation
- No ORMs — raw `pg` driver for all backend queries
- Parameterized queries only (no SQL string concatenation)
- Services handle business logic; repos handle raw SQL
- Async errors propagate to the Express error handler
- JWT auth remains stateless; token stored in localStorage and sent as `Authorization: Bearer <token>`
- Use CSS variables for all colors/spacing — never hardcode hex values in components
- Frontend uses Vite for dev server and build
- API base URL configured via `VITE_API_URL` env var (e.g. `http://localhost:3000`)
- Dashboard API returns aggregated counts — do NOT fetch individual referral/payout records for overview (use pagination for detail views if needed later)

## Definition of done
- [ ] `GET /api/dashboard` returns `{ programs: [...], totalReferrals, referralsByStatus, totalPayoutsCents, payoutsByStatus }` for the authenticated merchant
- [ ] `GET /api/dashboard` returns only data for programs owned by the authenticated merchant
- [ ] `GET /api/dashboard/programs/:programId` returns 404 if program does not belong to merchant
- [ ] `GET /api/dashboard/programs/:programId` returns advocate count, referral breakdown by status, payout breakdown by status
- [ ] All SQL queries use parameterised statements
- [ ] Frontend redirects unauthenticated users to login
- [ ] Dashboard page displays program overview with StatCards
- [ ] Program detail page shows full breakdown for a single program
- [ ] All frontend colors use CSS variables
- [ ] Frontend service runs in Docker Compose alongside API