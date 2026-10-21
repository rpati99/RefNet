# Local demo order simulator

## Plan and scope
1. Add an explicitly enabled demo endpoint, authenticated and restricted to the
   program owner; reject inactive programs and invalid customer email/request UUID.
2. In one DB transaction, create a pending referral and pass a server-signed
   order.completed event through the existing webhook handler. Retry with the same
   request ID must not create another referral or reset its state.
3. Add an owner-only form to the public referral page. No HMAC secret in browser.
4. Test authorization, validation, retry behavior, rollback, and browser totals.

## Safety and acceptance
- ENABLE_DEMO_ORDERS defaults false; explicitly enable only in local .env.
- Public referral endpoint exposes only whether the demo feature is enabled and
  the program ID (needed to check ownership via the protected program endpoint).
- Transaction includes referral creation, webhook dedup and eligibility update.
- UUID request key scoped to merchant/advocate; first order wins on retry.
- Customer email is required; clearly label simulated orders as demo data.
- Successful submission links to dashboard; worker retains payout responsibility.
- Preserve user changes and keep work on existing feature branch with browser forms.

## Verification results
- 142 tests passed across auth, programs, webhooks, dashboard, forms, simulator,
  and transaction handling. Worker suite remains blocked by missing local node-cron.
- Docker API/frontend builds passed and local containers were restarted.
- Browser form created an eligible referral and program totals showed 1 eligible.
- Live retry check: initial 201, retry 200/duplicate, identical referral ID;
  unauthenticated request returned 401. Checks used the separate smoke account.
- Local .env explicitly enables demo orders; it is not committed.
