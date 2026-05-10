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

## Git workflow (SDD Flow)
- Every feature starts from an up-to-date main branch.
- Create a feature branch: `git checkout -b feature/<slug>`.
- Commit after each milestone within the feature.
- Push and open a PR only after verification passes (/verify).
- Merge PR, then delete the feature branch and switch back to main.
- Never commit directly to main.

## Skills
- Skills load on demand via YAML frontmatter in `.opencode/skills/`.
- Use `refnet-domain` skill for referral-specific patterns (idempotency, payout state machines, webhook dedup).
- Keep skill bodies under 100 lines; reference external docs via @ imports for deeper detail.