# Spec: Webhook Handler

## Overview
Handle incoming order webhook events from external systems (e.g., Shopify, Stripe). Webhooks contain order completion events that link referral records to external order IDs, enabling payout processing. The system verifies HMAC signatures, stores events idempotently, and updates referral records.

## Depends on
- Step 01: Project Scaffold + Database Schema (must be complete)
- Step 02: Auth (must be complete) — webhook handler uses merchant context from JWT
- Step 03: Programs CRUD (must be complete) — webhooks link to programs
- Step 04: Advocates Referral Links (must be complete) — webhooks link referrals to advocates

## Routes
- `POST /webhooks/order` — Receive order completion webhook — public (HMAC verified)

## Database changes
None. `webhook_events` and `referrals` tables already exist from Step 01.

## Files to change
- `api/src/index.js` — mount webhook routes at `/webhooks`

## Files to create
- `api/src/routes/webhooks.js` — webhook route handler
- `api/src/controllers/webhooksController.js` — request/response handlers
- `api/src/services/webhooksService.js` — business logic (HMAC verify, event processing)
- `api/src/repos/webhooksRepo.js` — raw SQL queries for `webhook_events` table
- `api/src/repos/referralsRepo.js` — raw SQL queries for `referrals` table (if not exists)

## New dependencies
None.

## Rules for implementation
- Raw `pg` driver only, no ORM
- Parameterised queries only (no SQL string concatenation)
- HMAC signature verified using `WEBHOOK_HMAC_SECRET` env var
- Request body expected as raw JSON (not form-encoded)
- Idempotency via `event_id` unique constraint with `ON CONFLICT (event_id) DO NOTHING`
- `webhook_events.status` updated to 'processed' after successful handling
- Referral record updated with `order_id` and `signup_ts` when order event received
- All webhook payloads logged to `webhook_events.payload` for audit
- Services handle business logic; repos handle raw SQL

## Webhook payload schema
```json
{
  "event_id": "evt_unique_123",
  "event_type": "order.completed",
  "program_id": "uuid",
  "advocate_id": "uuid",
  "referral_id": "uuid",
  "order_id": "SHOP-456",
  "customer_email": "customer@example.com",
  "timestamp": "2026-05-10T12:00:00Z"
}
```

## HMAC verification
- Header: `X-Webhook-Signature`
- Signature: `HMAC-SHA256(raw_body, WEBHOOK_HMAC_SECRET)`
- Compare using `crypto.timingSafeEqual` to prevent timing attacks
- Return 401 Unauthorized if signature invalid

## Definition of done
- [ ] `POST /webhooks/order` with valid HMAC and new event_id creates webhook_events record and returns 200
- [ ] `POST /webhooks/order` with valid HMAC but duplicate event_id returns 200 (idempotent, no duplicate processing)
- [ ] `POST /webhooks/order` with invalid/missing HMAC returns 401 Unauthorized
- [ ] `POST /webhooks/order` updates referral record with order_id and customer_email
- [ ] `POST /webhooks/order` with non-existent referral_id returns 404
- [ ] `POST /webhooks/order` with non-existent program_id returns 404
- [ ] `webhook_events.payload` stores the full request body
- [ ] All SQL queries use parameterised statements
- [ ] HMAC verification uses timing-safe comparison
