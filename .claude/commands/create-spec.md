# Spec: Project Scaffold + Database Schema

## Problem statement
RefNet currently has no code, no database, and no runnable environment. We need a minimal scaffold that:
- Sets up the Node.js/Express project structure with clear separation of concerns (routes, controllers, services, repos).
- Creates a PostgreSQL database with all tables needed for the entire referral platform.
- Provides a migration runner so schema changes can be versioned.
- Wraps everything in Docker Compose so the API, database, and future services can be started with one command.
- Verifies that the stack can connect, run a migration, and respond to a health check.

This is the foundation. Every other feature (auth, referrals, webhooks, payouts, dashboard) will be built on top of this scaffold, and the schema must be designed up-front to avoid expensive migrations later.

## Functional requirements
- [ ] **Project initialization**: `api/` directory with a working Express server on port 3000. `db/` directory for migrations and seeds. `worker/` directory placeholder with a simple Node.js script that logs "worker started" and exits (to be replaced later). `frontend/` directory placeholder (created by Vite, but scaffolded later).
- [ ] **Docker Compose**: Single `docker-compose.yml` at project root that defines `db` (Postgres 15) and `api` services. The `api` service depends on `db`, passes environment variables for DB connection, and runs the Express server. No frontend or worker yet – those come after they're built.
- [ ] **Database connection**: A `db/pool.js` module that creates a `pg.Pool` using environment variables. The pool is exported and used by repos.
- [ ] **Migration runner**: A script `db/migrate.js` that reads SQL files from `db/migrations/` in order and executes them against the database. It uses a `_migrations` tracking table to record which migrations have been applied.
- [ ] **Initial migration** (`db/migrations/001_initial_schema.sql`): Creates all core tables with correct constraints, indexes, and enums. The full schema is defined in the next section.
- [ ] **Health check endpoint**: `GET /health` returns 200 and JSON `{ status: "ok", db: "connected" }` after verifying the database pool can execute a simple query.
- [ ] **Environment files**: `.env.example` with all required variables and dummy values. Actual `.env` is gitignored.
- [ ] **Git setup**: `.gitignore` includes `node_modules`, `.env`, `dist`, Docker volumes. CLAUDE.md already exists.

## Data model changes
The initial migration creates the following tables. This schema is designed to support the entire referral flow – from merchant program creation to payout processing – so we don't need to revisit core structures later.

### Enums
```sql
CREATE TYPE referral_status AS ENUM ('pending', 'eligible', 'paid', 'failed');
CREATE TYPE payout_status AS ENUM ('pending', 'processed', 'failed');
CREATE TYPE webhook_event_status AS ENUM ('received', 'processed', 'ignored');
```

### Tables
```sql
-- Merchants who create referral programs
CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    company_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Referral programs created by merchants
CREATE TABLE programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    reward_description TEXT,
    reward_amount_cents INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Referral links/advocates (one per program per advocate, identified by email)
CREATE TABLE advocates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    referral_code TEXT UNIQUE NOT NULL,   -- unique code used in links
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(program_id, email)
);

-- Individual referral events (when someone clicks a link and later signs up)
CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advocate_id UUID NOT NULL REFERENCES advocates(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    customer_email TEXT,                    -- the referred person (may be null if only click)
    status referral_status DEFAULT 'pending',
    click_ts TIMESTAMPTZ DEFAULT now(),
    signup_ts TIMESTAMPTZ,
    order_id TEXT,                          -- linked external order ID from webhook
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Payouts owed to advocates
CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    advocate_id UUID NOT NULL REFERENCES advocates(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL,
    status payout_status DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Audit log for incoming webhooks (idempotency enforced by unique event_id)
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,               -- e.g., 'order.completed'
    payload JSONB,
    status webhook_event_status DEFAULT 'received',
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Migration tracking table (used by the migration runner)
CREATE TABLE _migrations (
    id SERIAL PRIMARY KEY,
    filename TEXT UNIQUE NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT now()
);
```

### Indexes (beyond primary keys and unique constraints)
```sql
CREATE INDEX idx_referrals_advocate_id ON referrals(advocate_id);
CREATE INDEX idx_referrals_program_id ON referrals(program_id);
CREATE INDEX idx_referrals_customer_email ON referrals(customer_email);
CREATE INDEX idx_payouts_advocate_id ON payouts(advocate_id);
CREATE INDEX idx_payouts_status ON payouts(status);
CREATE INDEX idx_programs_merchant_id ON programs(merchant_id);
```

No foreign key indexes? The unique constraints and primary keys already create indexes on the referencing columns, but FK columns that are not already part of a unique or primary key (like `referral_id` in `payouts`) benefit from explicit indexes. We'll add:
```sql
CREATE INDEX idx_payouts_referral_id ON payouts(referral_id);
```

### Migration file naming
Files must be prefixed with a zero-padded number and an underscore: `001_initial_schema.sql`, `002_some_future_migration.sql`.

## API contracts
This feature exposes only a health check endpoint. Full contracts for business endpoints come later.

### `GET /health`
- **Response 200**: `{ "status": "ok", "db": "connected" }`
- **Response 503**: `{ "status": "error", "db": "disconnected" }` if DB is unreachable.

## Constraints
- The tech stack is fixed as per CLAUDE.md: Node/Express, raw SQL (pg driver), PostgreSQL, Docker Compose. No ORM, no TypeScript at this stage (keep surface area small).
- Secrets (DB password, etc.) must be provided via environment variables, never hardcoded.
- The migration runner must be idempotent: running `migrate.js` multiple times does nothing if no new files exist.
- This scaffold must work on any machine with Docker installed – no global Node.js required (all runs inside containers).

## Edge cases and error handling
- **Database not available at startup**: The API service should retry the health check on boot (or in the health endpoint) and not crash. Docker Compose `depends_on` with a health check on the `db` service ensures ordering.
- **Empty migrations folder**: Migration runner should handle gracefully (no-op).
- **Out-of-order migration files**: If a file with a number lower than an already-applied migration is added, the runner should detect it and abort, warning the developer.
- **Concurrent migration runs**: The runner must use a transaction and the `_migrations` table to prevent multiple instances from applying the same migration. The insert into `_migrations` within the transaction acts as a lock.
- **.env file missing**: The app should refuse to start and log a clear error message.

## Acceptance criteria
- [ ] Running `docker compose up` starts a PostgreSQL container and an API container. The API container's logs show "Server running on port 3000".
- [ ] Executing `curl http://localhost:3000/health` returns `{"status":"ok","db":"connected"}`.
- [ ] Running `docker compose exec api node db/migrate.js` applies `001_initial_schema.sql` and creates all tables. Second run outputs "No new migrations".
- [ ] All tables can be inspected via `docker compose exec db psql -U refnet -d refnet -c "\dt"` and show the expected list.
- [ ] The `.env.example` file exists and lists `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `WEBHOOK_HMAC_SECRET`.
- [ ] A clone of the repository on a fresh machine with Docker can follow a single command to get a working API and database (after copying `.env.example` to `.env`).
