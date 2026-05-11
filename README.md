# RefNet — Referral Platform Demo

A full-stack referral platform with JWT auth, webhook-driven payouts, and a React dashboard.

## Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js 18 + Express, raw SQL (pg driver), no ORM |
| Database | PostgreSQL 15 (Alpine) |
| Frontend | React 19 + Vite 5, minimal deps, JWT in localStorage |
| Auth | JWT, stateless middleware |
| Async Jobs | node-cron in a separate worker container |
| Webhooks | POST `/webhooks/order`, HMAC verification, idempotency via DB constraint |
| Deployment | Docker Compose (api, worker, db, frontend) |

## Architecture

```
api/          Express routes → controllers → services → repos (raw SQL)
worker/       Standalone Node process with cron that processes payouts
db/           migrations/, seeds/
frontend/     React dashboard (Vite)
```

### Database Schema (core tables)

- **merchants** — merchant accounts and auth
- **programs** — referral programs per merchant
- **referrals** — advocate-referred prospect records with status tracking
- **payouts** — payout records with state machine (pending → eligible → paid/failed)
- **webhook_events** — idempotency log for webhook deduplication

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local dev without Docker)

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 2. Start the stack

```bash
docker compose up -d --build
```

Services will be available at:

| Service | URL |
|---------|-----|
| API | http://localhost:3000 |
| Frontend | http://localhost:5173 |
| PostgreSQL | localhost:5432 |

### 3. Run migrations

```bash
docker compose exec api node /app/db/migrate.js
```

### 4. Seed demo data

```bash
docker compose exec api node /app/db/seed.js
```

## API Reference

### Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register a new merchant |
| POST | `/api/auth/login` | Login, returns JWT |

### Dashboard (protected)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard` | Overview stats (programs, referrals, payouts) |
| GET | `/api/dashboard/programs/:programId` | Program detail with referral breakdown |

### Programs (protected)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/programs` | List all programs for the merchant |
| POST | `/api/programs` | Create a new program |
| GET | `/api/programs/:id` | Get program details |
| PUT | `/api/programs/:id` | Update a program |
| DELETE | `/api/programs/:id` | Deactivate a program |

### Advocates & Referral Links

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/advocates` | List advocates |
| POST | `/api/advocates` | Enroll a new advocate |
| GET | `/api/ref/:programId` | Get/generate referral link for a program |

### Webhooks

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhooks/order` | Order event webhook (HMAC verified) |

## Webhook Integration

Send order events to `POST /webhooks/order`:

```json
{
  "event_id": "evt_unique_123",
  "event_type": "order.completed",
  "program_id": "prg_abc123",
  "advocate_id": "adv_xyz",
  "customer_email": "customer@example.com",
  "order_amount": 9900,
  "currency": "USD",
  "timestamp": "2026-05-10T12:00:00Z"
}
```

Headers:
- `X-Webhook-Signature`: HMAC-SHA256 of the raw body using `WEBHOOK_HMAC_SECRET`
- `X-Event-Id`: Idempotency key (duplicate events are ignored)

## Development

### Local (without Docker)

```bash
# API
cd api && npm install && npm start

# Frontend
cd frontend && npm install && npm run dev

# Run migrations
cd api && node db/migrate.js
```

### Testing

```bash
npm test        # vitest unit tests
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `refnet` |
| `DB_USER` | Database user | `refnet` |
| `DB_PASSWORD` | Database password | `change_me_in_production` |
| `JWT_SECRET` | JWT signing secret | `change_me_use_strong_random_value` |
| `WEBHOOK_HMAC_SECRET` | Webhook HMAC secret | `change_me_use_strong_random_value` |
| `PORT` | API listen port | `3000` |
| `PAYOUT_CRON_SCHEDULE` | Worker cron expression | `0 * * * *` |