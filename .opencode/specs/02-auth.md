# Spec: Auth

## Overview
Authentication system for merchants using JWT. Merchants can register with email/password, login to receive a JWT, and access protected routes. The `merchants` table already exists with `email` and `password_hash` columns — this feature wires it up with auth routes and middleware.

## Depends on
- Step 01: Project Scaffold + Database Schema (must be complete)

## Routes
- `POST /api/auth/register` — Register a new merchant account — public
- `POST /api/auth/login` — Login and receive a JWT — public
- `POST /api/auth/logout` — Invalidate JWT (client discards) — logged-in
- `GET /api/auth/me` — Get current merchant profile — logged-in

## Database changes
None. The `merchants` table with `email` and `password_hash` already exists.

## Templates
No new templates (React frontend comes later).

## Files to change
- `api/src/index.js` — mount auth routes under `/api/auth`

## Files to create
- `api/src/routes/auth.js` — `/auth` routes
- `api/src/controllers/authController.js` — request/response handlers
- `api/src/services/authService.js` — business logic (hash, verify, sign)
- `api/src/repos/merchantRepo.js` — SQL queries for merchants table
- `api/src/middleware/auth.js` — JWT verification middleware

## New dependencies
- `bcryptjs` — password hashing
- `jsonwebtoken` — JWT sign/verify

## Rules for implementation
- Raw `pg` driver only, no ORM
- Parameterised queries only (no SQL string concatenation)
- Passwords hashed with `bcryptjs` (min 10 rounds)
- JWTs signed with `JWT_SECRET` env var, expires in 7 days
- Authorization header: `Bearer <token>`
- Routes prefixed with `/api/auth`
- Services handle business logic; repos handle raw SQL

## Definition of done
- [ ] `POST /api/auth/register` with valid email/password creates a merchant and returns JWT
- [ ] `POST /api/auth/register` with existing email returns 409 Conflict
- [ ] `POST /api/auth/login` with correct credentials returns JWT
- [ ] `POST /api/auth/login` with wrong password returns 401 Unauthorized
- [ ] `POST /api/auth/login` with non-existent email returns 401 Unauthorized
- [ ] `GET /api/auth/me` with valid JWT returns merchant profile (no password_hash)
- [ ] `GET /api/auth/me` without JWT returns 401 Unauthorized
- [ ] `GET /api/auth/me` with invalid/expired JWT returns 401 Unauthorized
- [ ] Passwords stored as bcrypt hashes, never plaintext
- [ ] All SQL queries use parameterised statements