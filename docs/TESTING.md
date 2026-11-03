# Hanz-Go testing and evidence

**Historical status (2026-11-02):** SYS-001 implementation and regression tests prepared by Codex; database tests **NOT RUN**. No test database was established or connected. Historical baseline observations below remain labeled separately from this session's evidence.

## SYS-001 fresh-review correction evidence (2026-11-03)

This entry supersedes earlier current-environment/status statements; the 2026-11-02 logs remain historical evidence. Owner authorized only the bounded correction and non-database checks on `feature/sys-001-address-ownership` for existing draft PR #3.

**Reported by a prior audit:** fresh review returned **CHANGES REQUIRED** because the owner-update test chained configured headers into low-level `call()`.

**Verified in code:** installed Laravel helpers `put()` and `post()` merge/transform configured bearer and Accept headers before calling the kernel; direct `call()` does not. The correction selects these form-parameter helpers by the existing method provider. Both verbs and nullable-zipcode cases remain; no assertion, validation check, payload or response expectation was weakened. Other requests in `BackEnd/tests` use header-aware helpers; no additional instance was found.

| Working directory | Exact command | Actual result |
|---|---|---|
| Repository root | `php -l BackEnd/tests/Feature/LocationAuthorizationTest.php` | PASS, exit 0: `No syntax errors detected in BackEnd/tests/Feature/LocationAuthorizationTest.php` |
| Repository root | `git diff --check` | PASS, exit 0, no output |
| Repository root | `git diff --cached --check` | PASS, exit 0, no output |
| Repository root | `php -v` | Exit 0: PHP CLI 8.4.8, NTS Visual C++ 2022 x64 |
| Repository root | `Test-Path BackEnd/.env`; `Test-Path BackEnd/vendor/autoload.php` | Both True; existence only, no contents displayed or application boot |

Separate same-session second-pass source/diff review checked form submission, header transformation, provider cases, preserved assertions and the documentation-only scope outside the test. This is not runtime verification or independent QA.

**NOT RUN:** PHPUnit, Laravel application commands, migrations, seeders, resets, database connections, browser tests or platform/dependency validation. Existing installed dependencies and `.env` do not establish safety. Effective database configuration, account isolation and schema remain **not verified**; owner authorization and disposable-environment verification are required before any database tests. No regression pass is claimed.

**Separate finding:** SYS-004 is PROPOSED in `docs/BACKLOG.md`. The fresh review reports that selecting an already-default address may clear its flag. Source inspection confirms the bulk reset followed by an update on a previously loaded model, including on `main`; stale model dirty tracking is an inferred cause. Runtime behavior is **unverified**. No controller fix or additional database test was implemented or executed here.

## Historical baseline source-level observations (before SYS-001)
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

## SYS-001 actual execution evidence (2026-11-02)

Owner: human project owner. Implementation: Codex on `feature/sys-001-address-ownership`, based on local `main` at `e7a9010ac9c24312f3ba847be078715979123acc`. Development and isolated regression testing are approved; database setup remains blocked at the owner's selected first option. Acceptance, merge, deployment, and production changes are not approved.

Environment **observed locally:** Windows PowerShell, PHP CLI `C:\xampp\php\php.exe` 8.2.12, Composer available, `pdo_mysql` and `pdo_sqlite` loaded, `ext-sodium` absent from the default CLI. `BackEnd/vendor/autoload.php` is absent. No dependencies or PHP configuration were installed or modified.

| Working directory | Exact command | Observed result |
|---|---|---|
| `BackEnd` | `php -l app/Http/Controllers/LocationController.php` | PASS, exit 0: `No syntax errors detected in app/Http/Controllers/LocationController.php` |
| `BackEnd` | `php -l tests/Feature/LocationAuthorizationTest.php` | PASS, exit 0: `No syntax errors detected in tests/Feature/LocationAuthorizationTest.php` |
| Repository root, after final test-file edit | `php -l BackEnd/tests/Feature/LocationAuthorizationTest.php` | PASS, exit 0: no syntax errors |
| `BackEnd` | `composer --no-plugins --no-scripts validate --no-check-publish --strict` | PASS, exit 0: `./composer.json is valid` |
| `BackEnd` | `composer --no-plugins --no-scripts check-platform-reqs --lock` | FAIL, exit 1: `ext-sodium` missing, required by `lcobucci/jwt`; other reported requirements succeeded |
| Repository root | `git diff --check` | PASS on final working-tree check, exit 0 with no output. An intermediate check found three Markdown hard-break trailing spaces in the new handoff; these were removed. |
| Repository root | `git diff --cached --check` | PASS, exit 0 with no output, including the newly staged test file |
| `BackEnd` | `php -v` and `php -m` | Exit 0: runtime version and extension inventory above; these are environment checks, not application tests |

**NOT RUN:** PHPUnit (unit, feature, or full suite), migration commands, seeders, resets, database setup, database connections, production smoke checks, and browser tests. The planned focused command is `php vendor/bin/phpunit --filter LocationAuthorizationTest` from `BackEnd`; it must wait for the requirements below. No regression case is claimed as passed. The existing example feature test's `/` response mismatch remains **verified in code, not an executed failure**.

### Isolation preflight and current blocker

**Verified in files/process state:**
- Only `.env.example` exists among `BackEnd/.env*`; no `.env` or `.env.testing` was found. Contents containing credentials were not displayed.
- No process variables matching `DB_*`, `DATABASE_URL`, `APP_ENV`, `APP_CONFIG_CACHE`, or `APP_BASE_PATH` were set during inspection.
- `BackEnd/bootstrap/cache` contains only `.gitignore`; no cached application configuration was found.
- `BackEnd/phpunit.xml` sets `APP_ENV=testing` and array cache/mail/session drivers, but database overrides are commented out. `config/database.php` defaults to MySQL and permits `DATABASE_URL` overrides.

**Not verified:** an effective connected test database, its grants, its schema state, and its separation from application/production data. No Laravel application was bootstrapped to inspect a connection. An absent `.env` or an empty configuration cache does not prove isolation. No existing application database was queried.

Before database work, obtain explicit owner authorization for setup and verify a dedicated disposable **local MySQL** database and account whose permissions cannot access application databases. Use a database name such as `hanzgo_sys001_test_<unique_suffix>` and a dedicated username beginning `hanzgo_sys001_test`. Record host, port, database, connection driver, account scope, configuration-cache status, and URL-override status without passwords/tokens. Keep credentials outside Git and public descriptions. Review both process variables and the chosen environment file; do not copy production credentials. Configure a local test-only application key and array mail/cache/session plus synchronous queue, without changing production configuration.

Set `SYS001_TEST_DATABASE` to the exact verified disposable database name only after authorization and external isolation verification. A name prefix or this marker alone is **not proof** of isolation. Inspect effective Laravel configuration without printing secrets before approving migrations; `DATABASE_URL` must be absent/empty, configuration uncached, default connection MySQL on a loopback address, and no socket, replica, or table-prefix overrides. Apply reviewed repository migrations only to that approved connection; no migration command was run in this task. MySQL is required because existing location migrations contain MySQL-specific `ALTER TABLE ... CHANGE` statements. No SQLite schema substitute or production migration change was introduced.

### Added regression coverage and cleanup design

`BackEnd/tests/Feature/LocationAuthorizationTest.php` contains 32 intended cases after provider expansion (**source count; discovery/execution not verified**):
- Owner read, PUT/POST form updates (including nullable zipcode), deletion, and setting a default address.
- Denial of other-user and missing-address operations with identical per-operation response bodies, including set-default and both update routes.
- Full address-table snapshots after each denial, including timestamps, ownership, and default flags; denial also precedes update-field validation.
- Missing/invalid tokens across list, create, read, PUT/POST update, delete, and set-default, preserving existing HTTP 400 authentication conventions.
- Owner validation failures, unchanged ownership despite submitted `user_id`, list envelope/contact fields, and the existing `msg`/`category` creation response.

**Verified in code:** fixture fields were derived from the actual user/location models and migration chain, including `user_id` and `location_id`; the incompatible default `UserFactory` is not used. Users, tokens, contact fields, and addresses are synthetic. The class rejects cached configuration and unsafe connection/environment settings before providers boot. After those checks it verifies `SELECT DATABASE()`, requires InnoDB fixture tables and empty user/address tables, then opens a transaction and registers rollback/disconnect. It does not run migrations, `RefreshDatabase`, seeders, or table resets. The guards and cleanup have **not been runtime-tested**; human environment verification remains necessary. No fixtures were inserted and no cleanup was needed in this session.

### Review and remaining work

- A second source pass in the implementation session checked all routed address methods, validation order, custom primary keys, POST compatibility, and unchanged success responses against `FrontEnd/assets/js/account.js` and `checkout.js`. This is **not** a fresh-session review or independent QA.
- Supply an owner-authorized isolated test database, resolve the CLI `ext-sodium` dependency, install the locked dependencies, then run and record the focused regression command. Do not bypass platform requirements or run the whole feature suite against an unverified connection.
- Fresh Codex session: read the required context, inspect `git diff main...feature/sys-001-address-ownership`, review the test safety guard and fixtures, reproduce permitted checks, and report findings. Human acceptance is required before merge/deployment.
- **Inferred from source:** successful frontend requests remain compatible. **Not verified:** browser/runtime integration. Error behavior intentionally changes for unauthenticated updates (explicit HTTP 400) and denied set-default requests (generic HTTP 404 JSON); foreign/missing updates are denied before field validation. Default-address concurrency and unrelated authentication/authorization paths remain outside this bounded change.

Never treat a documented plan as proof of passing tests or deployment readiness.
