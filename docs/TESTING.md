# Hanz-Go testing and evidence

**Status:** Baseline; no application tests were run by ChatGPT while preparing this file (2026-11-02).

## Source-level observations
- The repository has PHPUnit test scaffolding, with `BackEnd/tests/Unit/ExampleTest.php` and `BackEnd/tests/Feature/ExampleTest.php` only in the inspected test folders.
- The example feature test expects `GET /` to return 200, while `BackEnd/routes/web.php` aborts with 404. This is an apparent mismatch **not an executed failure**.
- `BackEnd/phpunit.xml` has database test overrides commented out. **Do not run DB-dependent tests until isolation is proved.**
- A local Codex audit **reported** passing PHP syntax checks and Composer manifest validation, but could not run PHPUnit because `vendor/` was absent and reported a local `ext-sodium` platform issue. These results have not been reproduced by ChatGPT.
- No comprehensive authentication, authorization, cart, checkout, upload, email or push integration test suite was found in that audit.

## Required preflight before database tests
1. Confirm explicit owner approval for the test change and obtain a separate disposable MySQL database with synthetic users/data.
2. Show which `DB_*` connection is active for the test runner **without printing secrets**. Verify it cannot connect to production.
3. Run migrations only on that disposable database, if appropriate and separately approved.
4. Review the application's custom user and related table schemas; do not assume Laravel default factories apply.
5. After tests, document exact commands, environment, outputs and cleanup.

## Minimum first regression coverage (after approval)
- An authenticated owner can access and manage their own address.
- A different account cannot read, update or delete another account's address.
- Missing/invalid authentication is denied.
- Denied operations leave data unchanged.
- Normal accepted workflows continue to work.

Additional testing later: authentication and reset, inventory and checkout consistency, file uploads, API CORS, mail, FCM and release smoke checks.

## Evidence log
| Date | Source | Command/tests | Outcome |
|---|---|---|---|
| 2026-11-02 | ChatGPT repository inspection | Read selected committed source files | Source observations only; application tests **NOT RUN** |
| 2026-11-02 | Codex report shared by owner | PHP lint, Composer validation, platform check | Reported results only; see owner's local Codex report; PHPUnit **NOT RUN** |

Never treat a documented plan as proof of passing tests or deployment readiness.

## Manual authentication testing — 2026-11-16

**Provenance — reported by a prior audit:** Owner-executed local browser tests reviewed by ChatGPT through screenshots, transcribed from the owner's handoff. Codex has not independently reproduced these tests or inspected the original screenshots. No screenshots or sensitive account details are attached.

**Environment — owner-reported, not verified:** Office PC, Windows/XAMPP, Laravel 10.50.2, local MySQL database `ecommerce`; repository `pluyto3/Api-e-commerceProj`. **Application revision manually tested — owner-reported:** `feature/auth-ui-improvements` at `bec8f9a` (`bec8f9ad0ead14358e8ba837b1d2705a237f422c`). Codex verified that local branch/HEAD before the documentation transfer, but did not independently verify the revision active during each browser test. This application revision is not merged into the fetched `origin/main` at `e7a9010ac9c24312f3ba847be078715979123acc` (verified by Git ancestry check). This documentation PR does not merge the application branch.

These date-scoped IDs do not overlap existing IDs found in `docs/`. All observed outcomes below are **reported manual evidence**, not Codex-executed passes. Expected results describe the behavior being checked.

| Test ID | Test / expected result | Observed outcome | Unverified aspects |
|---|---|---|---|
| AUTH-MAN-20261116-01 | Customer registration succeeds with confirmation | Submitted; success popup displayed | Office PC registration HTTP status not supplied; failure messaging remains open |
| AUTH-MAN-20261116-02 | Verification email arrives | Delivered to Gmail through Resend | Provider logs and delivery reliability not independently checked |
| AUTH-MAN-20261116-03 | Verification link opens confirmation flow | Two-step verification page opened | HTTP status and link boundaries not supplied |
| AUTH-MAN-20261116-04 | Email confirmation succeeds | "Email Verified!" displayed | HTTP status and persisted state not independently checked |
| AUTH-MAN-20261116-05 | Verified login succeeds and shows authenticated Home | Login HTTP 200; Home displayed test account | Other roles and session security not covered |
| AUTH-MAN-20261116-06 | Logout succeeds and returns browser to signed-out state | Logout HTTP 200; success popup; Sign In after refresh | Server-side token invalidation not tested |
| AUTH-MAN-20261116-07 | Forgot Password accepts request and delivers email | API HTTP 200; reset email arrived through Resend | Negative cases and provider logs not checked |
| AUTH-MAN-20261116-08 | Valid password reset succeeds | Password Reset API HTTP 200 | Expiration and other token boundaries not covered |
| AUTH-MAN-20261116-09 | Old password fails after reset | Login rejected with HTTP 401 | Other sessions/tokens not checked |
| AUTH-MAN-20261116-10 | New password permits login | Login HTTP 200 | Broader session security not checked |
| AUTH-MAN-20261116-11 | Consumed reset link cannot be reused | "Invalid or expired reset token" displayed | HTTP status not supplied; expiration itself not established |
| AUTH-MAN-20261116-12 | Current password cannot be reused in reset | Password-history rejection message displayed | HTTP status not supplied |
| AUTH-MAN-20261116-13 | Original registration password cannot be reused | Password-history rejection message displayed | HTTP status not supplied; five-password boundary not established |
| AUTH-MAN-20261116-14 | Another reset with a fresh password succeeds | Reset succeeded in browser | Reset HTTP status not supplied |
| AUTH-MAN-20261116-15 | Latest password permits login | Login HTTP 200 | Other authentication/authorization cases remain open |

### BUG-AUTH-001 — Misleading registration success message

**CONFIRMED FROM PRIOR MANUAL EVIDENCE, NOT FIXED.** Earlier Home PC observation (reported by a prior audit): registration returned HTTP 201; the backend reported account creation but verification-email delivery failure; the frontend nevertheless displayed "Successfully Registered" and told the user to check email. This is separate from the successful Office PC delivery test.

**Verified in code at `bec8f9a`:** `BackEnd/app/Http/Controllers/AuthController.php`, `register()`, still returns 201 with an account-created/email-failure message when sending throws. `FrontEnd/assets/js/registration.js`, AJAX success callback, ignores that message and always displays fixed success/check-email text. No approved fix was established. No code was changed and the failure path was not rerun. Expected behavior: accurately communicate account creation and delivery failure with the resend action.

### Remaining authentication tests — not verified

- Required-field and invalid-format registration validation.
- Duplicate username, email and phone number.
- Password confirmation mismatch and minimum-length rules.
- Unverified account login rejection and invalid credentials.
- Resend verification negative cases.
- Server-side logout token invalidation.
- Reset token expiration after 60 minutes; invalid and replaced reset tokens.
- Five-password history boundary.
- Authorization and account ownership tests.
- Automated regression coverage.

**Next recommended bounded task (approval pending):** Manual registration validation only: required fields, formats, duplicates, confirmation mismatch and minimum length. Use synthetic accounts after confirming an explicitly disposable local environment; record sanitized expected/actual UI outcomes and HTTP statuses. Do not use the reported `ecommerce` database until its isolation and suitability are confirmed. This documentation request authorizes no runtime tests or fixes.

**Limits:** No PHPUnit, automated browser testing, full authentication security coverage or production verification is claimed. Codex executed no application tests, migrations, seeders or database-dependent tests for this handoff. The historical baseline above remains unchanged.
