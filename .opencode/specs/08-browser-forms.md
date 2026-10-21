# Browser forms

## Goal
Let merchants register, manage programs, and enroll advocates without Postman.

## Plan
1. Add signup and navigation from login, using the existing registration API.
2. Add reusable program form for creation and editing (USD converted to integer cents).
3. Add advocate enrollment/list and referral links to program details.
4. Add a public referral landing page using the existing resolver API.
5. Run regression tests, production build, and browser smoke checks; rebuild the frontend container.

## Acceptance criteria
- Signup saves the JWT and navigates to the dashboard; errors remain visible.
- Dashboard has a create-program action; creation navigates to the new program.
- Program details allow editing name, description, reward, and active status.
- Advocate enrollment refreshes list and statistics; duplicate errors are visible.
- Referral links resolve to a public program page, not a blank route.
- All forms have labels, native validation, submit-in-progress protection, and API error feedback.
- Existing merchant authorization stays enforced by the API; no secrets enter browser code.
- No order simulator: signed order webhooks remain a server-to-server integration.

## Verification
Run Vitest and Vite build, then check signup, program creation/edit, advocate enrollment,
duplicate handling, referral navigation, and existing login in the browser.
The repository's /verify command is locally deleted; preserve that user change.

## Results
- Production build passed; frontend Docker container rebuilt and running.
- 134 tests passed, including 5 new form tests. Worker suite cannot load because
  node-cron is not installed in the root test environment (existing dependency issue).
- Browser smoke passed: signup, create program ($12.34), edit program, enroll
  advocate, duplicate rejection, and public referral link with updated program data.
- Smoke data was created in a separate browser-smoke account, not the user's account.
