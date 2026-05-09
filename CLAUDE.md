# RefNet — Referral Platform Demo

## Stack
- Backend: Node.js + Express (v18+), raw SQL (pg driver), no ORM
- Database: PostgreSQL 15, migrations run via a simple SQL runner
- Frontend: React (Vite), minimal dependencies, JWT in localStorage
- Auth: JWT, stateless, simple middleware
- Async: node-cron inside a separate Docker service (cron runner)
- Webhooks: POST /webhooks/order, verify HMAC secret, idempotency via DB constraint
- Deployment: Docker Compose (api, worker, db, frontend)

## Architecture
- api/: Express routes, controllers, services, repos. Controllers call services, services call repos.
- worker/: standalone Node process with cron that processes payouts.
- db/: migrations/, seeds/
- frontend/: React dashboard

## Database schema (core)
tables: merchants, programs, referrals, payouts, webhook_events
... (list key columns and enums)

## Coding conventions
- Services handle business logic; repos handle raw SQL.
- All async errors propagate to Express error handler.
- Idempotency: use ON CONFLICT (event_id) DO NOTHING for webhooks.

## Critical rules
- NEVER generate code without a spec document first.
- Always use plan mode before implementing a feature.
- After each milestone, run /compact and commit.