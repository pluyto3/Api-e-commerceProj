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
