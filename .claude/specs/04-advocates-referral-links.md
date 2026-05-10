# Spec: Advocates Referral Links

## Overview
Manage advocates (referral link sharers) per program and generate shareable referral links. Merchants can add advocates to their programs, each advocate gets a unique referral code that forms a shareable link. When a customer clicks a referral link, the code identifies the advocate and creates a referral tracking record.

## Depends on
- Step 01: Project Scaffold + Database Schema (must be complete)
- Step 02: Auth (must be complete) — routes use JWT auth middleware
- Step 03: Programs CRUD (must be complete) — advocates belong to programs

## Routes

### Advocate management (scoped to program)
- `GET /api/programs/:programId/advocates` — List all advocates for a program — logged-in
- `POST /api/programs/:programId/advocates` — Add an advocate to a program — logged-in
- `GET /api/programs/:programId/advocates/:advocateId` — Get a single advocate — logged-in
- `DELETE /api/programs/:programId/advocates/:advocateId` — Remove an advocate — logged-in

### Referral link resolution (public)
- `GET /api/ref/:referralCode` — Resolve a referral code to advocate+program info — public

### Referral link construction
- `GET /api/programs/:programId/advocates/:advocateId/link` — Get the full referral share link for an advocate — logged-in

## Database changes
None. `advocates` table and `referrals` table already exist with all needed columns.

## Files to change
- `api/src/index.js` — mount `/api/programs/:programId/advocates` routes

## Files to create
- `api/src/routes/advocates.js` — advocate CRUD routes
- `api/src/controllers/advocatesController.js` — request/response handlers
- `api/src/services/advocatesService.js` — business logic (referral code generation, validation)
- `api/src/repos/advocatesRepo.js` — raw SQL queries for `advocates` table

## Rules for implementation
- Raw `pg` driver only, no ORM
- Parameterised queries only (no SQL string concatenation)
- All routes except `/api/ref/:referralCode` require valid JWT in `Authorization: Bearer <token>` header
- A merchant can only access advocates for programs they own (join through programs.merchant_id)
- `POST` body: `{ email }` — referral_code is auto-generated (12-char alphanumeric) if not provided
- `POST` on duplicate (program_id, email) returns 409 Conflict
- Referral code lookup is case-insensitive
- Referral link base URL is read from `REFERRAL_BASE_URL` env var (e.g. `http://localhost:5173/ref`)
- Services handle business logic; repos handle raw SQL

## Definition of done
- [ ] `GET /api/programs/:programId/advocates` returns all advocates for that program
- [ ] `GET /api/programs/:programId/advocates` returns 404 if program does not belong to merchant
- [ ] `POST /api/programs/:programId/advocates` with email creates an advocate and returns it with referral_code
- [ ] `POST /api/programs/:programId/advocates` with duplicate email in same program returns 409 Conflict
- [ ] `POST /api/programs/:programId/advocates` with explicit referral_code uses it instead of auto-generating
- [ ] `GET /api/programs/:programId/advocates/:advocateId` returns 404 if advocate does not belong to merchant's program
- [ ] `DELETE /api/programs/:programId/advocates/:advocateId` removes the advocate and returns 204
- [ ] `GET /api/programs/:programId/advocates/:advocateId/link` returns `{ referralLink: "http://..." }` with REFERRAL_BASE_URL + referral_code
- [ ] `GET /api/ref/:referralCode` returns advocate + program info for valid code (no auth)
- [ ] `GET /api/ref/:referralCode` returns 404 for non-existent code
- [ ] All SQL queries use parameterised statements
- [ ] Referral codes are 12-char alphanumeric (generated client-side or via crypto)