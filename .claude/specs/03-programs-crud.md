# Spec: Programs CRUD

## Overview
Full CRUD operations for referral programs. A merchant can create, read, update, and deactivate referral programs. Each program belongs to a merchant and defines a reward amount (in cents) and optional description. This is the core resource — all referral tracking flows from a program.

## Depends on
- Step 01: Project Scaffold + Database Schema (must be complete)
- Step 02: Auth (must be complete) — this feature uses JWT auth middleware

## Routes
- `GET /api/programs` — List all programs for the authenticated merchant — logged-in
- `POST /api/programs` — Create a new program for the authenticated merchant — logged-in
- `GET /api/programs/:id` — Get a single program by ID (must belong to authenticated merchant) — logged-in
- `PUT /api/programs/:id` — Update a program (name, reward_description, reward_amount_cents, is_active) — logged-in
- `DELETE /api/programs/:id` — Soft-delete: sets `is_active = false` — logged-in

## Database changes
None. All columns already exist on the `programs` table from Step 01.

## Files to change
- `api/src/index.js` — mount `/api/programs` routes

## Files to create
- `api/src/routes/programs.js` — `/programs` CRUD routes
- `api/src/controllers/programsController.js` — request/response handlers
- `api/src/services/programsService.js` — business logic
- `api/src/repos/programsRepo.js` — raw SQL queries for `programs` table

## Rules for implementation
- Raw `pg` driver only, no ORM
- Parameterised queries only (no SQL string concatenation)
- All routes require valid JWT in `Authorization: Bearer <token>` header
- A merchant can only access their own programs (filter by `merchant_id` from JWT)
- `DELETE` soft-deletes by setting `is_active = false`, not removing the row
- `updated_at` is updated via `SET updated_at = now()` on every write
- Services handle business logic; repos handle raw SQL

## Definition of done
- [ ] `POST /api/programs` with valid JWT creates a program and returns it with ID
- [ ] `POST /api/programs` without JWT returns 401 Unauthorized
- [ ] `GET /api/programs` returns only programs belonging to the authenticated merchant
- [ ] `GET /api/programs/:id` returns 404 if program does not belong to merchant
- [ ] `GET /api/programs/:id` returns 404 if program does not exist
- [ ] `PUT /api/programs/:id` updates only the provided fields
- [ ] `PUT /api/programs/:id` returns 404 if program does not belong to merchant
- [ ] `DELETE /api/programs/:id` sets `is_active = false` and returns 204
- [ ] All timestamps (`created_at`, `updated_at`) are set correctly
- [ ] All SQL queries use parameterised statements