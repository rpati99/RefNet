# Spec: Program Cron

## Overview
A standalone worker service that runs on a cron schedule to process referral payouts. The worker queries for eligible referrals that have completed an order (i.e., have an `order_id` set), creates corresponding payout records, and updates referral status to `paid`. This is the automated payout processing engine for RefNet.

## Depends on
- Step 01: Project Scaffold + Database Schema (must be complete)
- Step 02: Auth (must be complete)
- Step 03: Programs CRUD (must be complete)
- Step 04: Advocates Referral Links (must be complete)
- Step 05: Webhook Handler (must be complete) — webhooks set referral `order_id` and `signup_ts`, making referrals eligible for payout

## Routes
No new routes.

## Database changes
None. All columns already exist on the `referrals` and `payouts` tables from Step 01.

## Files to change
- `docker-compose.yml` — add the `worker` service definition
- `api/src/db/pool.js` — export pool for use by worker (currently only imported by api)

## Files to create
- `worker/Dockerfile` — Docker build for the worker service
- `worker/src/index.js` — entry point that sets up node-cron and runs the payout job
- `worker/src/db/pool.js` — PostgreSQL connection pool for the worker
- `worker/src/repos/payoutsRepo.js` — raw SQL queries for `payouts` table
- `worker/src/repos/referralsRepo.js` — raw SQL queries for `referrals` table (copy relevant queries from api)
- `worker/src/services/payoutService.js` — business logic for processing payouts
- `worker/package.json` — worker dependencies (pg, node-cron, dotenv)
- `db/migrations/002_add_payout_processed_at.sql` — add `processed_at` column to `payouts` table for audit trail

## New dependencies
- `worker/package.json`: `pg`, `node-cron`, `dotenv`

## Cron schedule
- Configured via `PAYOUT_CRON_SCHEDULE` env var (default: `"0 * * * *"` — top of every hour)
- Uses `node-cron` library

## Payout processing logic
1. Query all referrals with `status = 'eligible'` and `order_id IS NOT NULL` that do not already have a payout record (left join payouts on referral_id WHERE payouts.id IS NULL)
2. For each eligible referral:
   a. Fetch the program's `reward_amount_cents`
   b. Insert a new payout record with `status = 'pending'` and `amount_cents` from program
   c. Update referral status to `'paid'`
3. Log count of processed referrals per run

## Rules for implementation
- Raw `pg` driver only, no ORM
- Parameterised queries only (no SQL string concatenation)
- Worker runs as a separate Docker service (not in the API container)
- Cron schedule configured via environment variable
- Services handle business logic; repos handle raw SQL
- Use `ON CONFLICT` for idempotent payout creation (guard against duplicate runs)

## Definition of done
- [ ] Worker container starts and connects to the database
- [ ] Cron job runs on the configured schedule
- [ ] Eligible referrals (status='eligible', order_id set) get a payout record created
- [ ] Referral status updated to 'paid' after payout record is created
- [ ] No duplicate payout records created for the same referral (idempotent)
- [ ] `payouts.processed_at` set to current timestamp
- [ ] Worker logs the number of payouts processed per run
- [ ] All SQL queries use parameterised statements