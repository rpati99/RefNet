# In-app records viewer

## Plan
1. Add a protected read-only records endpoint, scoped by authenticated merchant.
2. List referrals with order ID, customer, advocate, program, status, timestamps,
   and any payout ID/status/amount. Orders are fields on referrals, not a separate table.
3. Add a Records page accessible from dashboard and program detail, with optional
   program filter, 20-row pagination, manual refresh, loading/error/empty states.
4. Test SQL tenant scoping, validation, pagination and UI; build/restart containers
   and verify existing records through Playwright without modifying user data.

## Acceptance
- Every SQL query joins programs and filters merchant_id; never expose other accounts.
- SQL parameters validate page and optional program UUID; no arbitrary SQL browser.
- Read only: no editing/deleting records and no password/token/webhook secret fields.
- Deterministic newest-first pagination; retrieve 21 rows to determine hasMore.
- Status and amount of a missing payout show Not created and a dash, not zero paid.
- Links to programs and full record IDs visible; horizontal table scroll on mobile.
- No schema changes; existing forms and worker remain unchanged.

## Verification results
- 156 tests passed across 9 suites, including 8 new records tests.
- Existing worker suite excluded due to previously missing root node-cron dependency.
- API and frontend Docker builds passed; containers rebuilt and running.
- Playwright verified record fields, per-program/all-program views, refresh and
  mobile containment; unauthenticated API returned 401, another merchant's program
  returned no records. A new smoke order was created only in the test account.
