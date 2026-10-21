# Remaining backend UI coverage

## Plan
1. Handle successful empty 204 responses in the shared API helper.
2. Add optional custom referral code to enrollment (blank means generated).
3. Add advocate removal with explicit confirmation about cascading deletion of
   referral/payout history; refresh advocate list and program statistics.
4. Add protected read-only account details using GET /api/auth/me and dashboard link.
5. Run focused/regression tests, build, browser smoke, and rebuild frontend.

## Acceptance
- Canceling removal makes no request; failed removal keeps the advocate visible.
- Successful deletion handles 204, removes stale links, and refreshes totals.
- Custom codes are URL-safe (letters/numbers/underscore/hyphen); blank omitted.
- Account page shows email, company, account ID, created date, with error/loading states.
- No new backend capability or program deletion change.
- Preserve existing edits to DemoOrderForm.jsx and ReferralPage.jsx and deleted verify command.
