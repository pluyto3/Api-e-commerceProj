# Hanz-Go testing and evidence

**Status:** Historical baseline (2026-11-02), plus owner-reported manual authentication/registration evidence (2026-11-16) and Customer Profile and Account Management evidence (2026-11-17). Codex has not independently reproduced the manual tests; no automated tests were executed for these documentation tasks.

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

## Manual registration-validation testing — Home PC, 2026-11-16

**Provenance — reported manual evidence / reported by a prior audit:** The owner reports executing all seven cases below on the Home PC and reviewing browser screenshots with ChatGPT. Codex transcribed the supplied results, inspected relevant source, and did not rerun the cases or inspect the original screenshots. Every PASS below is an owner-reported manual result, not a Codex-executed or automated pass.

**Environment — owner-reported, not verified:** Home PC, Windows/XAMPP, local Laravel API and local MySQL database `ecommerce`; repository `pluyto3/Api-e-commerceProj`. The database was reported to be disposable, but isolation and active runtime configuration have not been independently verified. Database persistence was not independently inspected.

**Application revision tested — owner-reported:** `feature/auth-ui-improvements` at `bec8f9a` (`bec8f9ad0ead14358e8ba837b1d2705a237f422c`). Codex verified that local branch/HEAD at the start of documentation work, but not the revision active during each browser test. **Verified in Git/GitHub:** prior authentication documentation [PR #4](https://github.com/pluyto3/Api-e-commerceProj/pull/4) is merged into `main` at `59203f811727cf2b5a27800d3c1c6612e956bbe2`, the freshly fetched documentation baseline. The tested application revision is not an ancestor of that baseline; this update does not merge application changes.

| Test ID | Scenario | Expected result | Reported observed result |
|---|---|---|---|
| AUTH-REG-01 | Empty required fields | Browser blocks incomplete submission | PASS — browser blocked submission and focused Username |
| AUTH-REG-02 | Invalid email format | Browser displays an email-format warning | PASS — browser displayed email-format warning |
| AUTH-REG-03 | Password shorter than 8 characters | API rejects with HTTP 422 and minimum-length error | PASS — HTTP 422 and minimum-length message |
| AUTH-REG-04 | Password confirmation mismatch | API rejects with HTTP 422 and confirmation error | PASS — HTTP 422 and confirmation error |
| AUTH-REG-05 | Duplicate username | API rejects with HTTP 422 and username uniqueness error | PASS — HTTP 422 and username uniqueness error; isolated retest completed |
| AUTH-REG-06 | Duplicate email | API rejects with HTTP 422 and email uniqueness error | PASS — HTTP 422 and email uniqueness error |
| AUTH-REG-07 | Duplicate phone number | API rejects with HTTP 422 and phone-number uniqueness error | PASS — HTTP 422 and phone-number uniqueness error |

**Evidence boundaries:** AUTH-REG-01 and AUTH-REG-02 confirmed browser-side validation without a visible registration request; they do not establish backend required-field or email-format rejection. AUTH-REG-03 through AUTH-REG-07 showed backend HTTP 422 validation responses and relevant frontend messages according to the supplied report. The isolated username retest refers to that scenario only and does not verify database isolation. No automated tests were executed, no persistence check was independently performed, and full registration or authentication security coverage is not claimed. Screenshots and sensitive account values are excluded from this record.

**Verified in code at `bec8f9a` (source inspection only):**

- `FrontEnd/register.html` declares required form inputs and `type="email"` for the email input.
- `BackEnd/app/Http/Controllers/AuthController.php`, `register()`, declares required fields, email format, uniqueness for username/email/phone number, and `min:8|confirmed` for passwords; the validation-failure branch returns an `errors` object with HTTP 422.
- `FrontEnd/assets/js/registration.js` submits to `/api/register` and displays field errors for HTTP 422, including routing password-confirmation errors to the confirmation field. These source findings support the reported outcomes but do not independently verify runtime behavior or persistence.

**Proposed copy improvement — not a functional validation failure:** The duplicate-phone message contains a grammatical error, also verified in the registration source at `bec8f9a`: "This phone number is already been registered." Proposed wording: "This phone number is already registered." No copy or application fix is included; AUTH-REG-07 remains a reported PASS. BUG-AUTH-001 remains open and unchanged.

## Remaining authentication tests — not verified

- Backend required-field and email-format validation with browser checks bypassed; formats and boundaries beyond the seven reported cases. The reported browser checks do not close these server-side tests.
- Unverified account login rejection and invalid credentials.
- Resend verification negative cases.
- Server-side logout token invalidation.
- Reset token expiration after 60 minutes; invalid and replaced reset tokens.
- Five-password history boundary.
- Authorization and account ownership tests.
- Automated regression coverage.

**Next agent task after this documentation is merged:** Plan the remaining profile negative/security tests, then proceed to address-management testing, subject to approved requirements and test-environment safeguards. Confirm an explicitly isolated disposable local environment with synthetic records before runtime tests. Record sanitized expected/actual UI outcomes and HTTP statuses. Do not use the reported `ecommerce` database until its isolation and suitability are confirmed. This documentation request authorizes no runtime tests or fixes. Existing authorization work (including SYS-001), BUG-AUTH-001 and the remaining authentication-security tests stay open.

**Limits:** No PHPUnit, automated browser testing, full authentication security coverage or production verification is claimed. Codex executed no application tests, migrations, seeders or database-dependent tests for this handoff. The historical baseline above remains unchanged.

## Manual Customer Profile and Account Management testing — 2026-11-17

**Provenance — reported manual evidence / reported by a prior audit:** Owner-executed local browser tests reviewed by ChatGPT through screenshots, transcribed from the supplied handoff. Codex did not execute these tests or inspect the original screenshots. Every PASS below is a reported manual result, not an automated or Codex-executed pass.

**Environment — owner-reported, not verified:** Office PC, Windows/XAMPP, local Laravel API, local MySQL `ecommerce`; repository `pluyto3/Api-e-commerceProj`. Isolation and active runtime configuration were not independently verified. **Application revision tested — owner-reported:** `feature/auth-ui-improvements` at `bec8f9a` (`bec8f9ad0ead14358e8ba837b1d2705a237f422c`); the revision active during each browser test was not independently verified.

**Documentation baseline — verified in Git/GitHub:** [PR #5](https://github.com/pluyto3/Api-e-commerceProj/pull/5) is merged into `main` at `155c67a3b5b9f3f01d4b7ab986a7acc609e8ffd9`, matching freshly fetched `origin/main`. This update transfers evidence only and does not merge the tested application branch.

| Test ID | Scenario | Reported observed result |
|---|---|---|
| PROFILE-01 | Display customer profile | PASS — authenticated account-information request returned HTTP 200; account fields displayed |
| PROFILE-02 | Update full name | PASS — update HTTP 200; updated full name persisted after reload |
| PROFILE-03 | Duplicate username | PASS — HTTP 422 and correct field error; original username restored after reload |
| PROFILE-04 | Duplicate phone number | PASS — HTTP 422 and correct field error; original phone number restored after reload |
| PROFILE-05A | Incorrect current password | PASS — HTTP 422 and incorrect-current-password message |
| PROFILE-05B | Existing password after failed change | PASS — login HTTP 200 |
| PROFILE-05C | Successful password change | PASS — profile update HTTP 200 and success message |
| PROFILE-05D | Login using new password | PASS — login HTTP 200 |
| PROFILE-05E | Login using previous password | PASS — login HTTP 401 with "Wrong password." |
| PROFILE-06A | Upload JPG profile picture | PASS — "Profile Saved" message; image appeared and persisted after reload; navbar avatar updated |

**Evidence limitations:** The profile-picture upload HTTP status was not individually verified in the screenshots; none is assigned to PROFILE-06A. Database persistence is **inferred** from successful subsequent profile retrieval, not independently examined in MySQL. Reload observations do not constitute a direct database check. No screenshots, uploaded pictures, personal contact details, passwords, authentication tokens or secrets are included. Codex executed no manual application tests, PHPUnit, automated browser tests, migrations, seeders or database operations.

### Profile source-level observations — separate from manual results

**Verified in code at `bec8f9a` (source inspection only):**

- `FrontEnd/assets/js/account.js` loads account information, submits profile edits to `/api/account/profile`, displays HTTP 422 field errors, and reloads after successful updates. Its image-upload callback displays "Profile Saved"; this source branch does not establish the observed upload HTTP status.
- `BackEnd/app/Http/Controllers/AuthController.php`, `updateOwnAccount()`, validates username/phone uniqueness, checks the current password for password changes, and returns HTTP 422 for validation or incorrect-current-password errors. These source findings do not independently reproduce the manual results.
- **PROPOSED compatibility investigation — potential discrepancy:** `FrontEnd/account.html` advertises JPG, PNG and WEBP, while `updateImageAccount()` lists JPEG/JPG, PNG and GIF in backend image validation. A separate WEBP test is required; no WEBP failure was manually demonstrated.
- **PROPOSED authorization investigation:** Preserve the previously identified potential profile-read ownership concern in `getAccount_username()`. Ownership enforcement needs a separately approved review and isolated negative tests; this is not a confirmed exploit. No reproduction details or authorization fix are included.

### Remaining profile behavior — not verified

- WEBP compatibility and other image formats, invalid/oversized uploads and upload failure handling.
- Required fields, length/format boundaries and successful username/phone changes beyond the reported cases.
- Missing current password, password confirmation/minimum-length boundaries, password-history limits and session/token behavior after password changes.
- Missing/invalid authentication and account ownership across profile reads, edits and image uploads.
- Automated regression coverage and production behavior.

These are proposed coverage areas, not approved runtime tests or fixes. After documentation merge, plan the remaining profile negative/security cases and then address-management testing under approved requirements and disposable-environment safeguards. SYS-001, BUG-AUTH-001 and all outstanding authentication/security work remain open.

## November 18 profile-picture retests and responsive-layout regression - 2026-11-18

**Provenance - owner-observed manual evidence / reported by a prior audit:** The owner supplied local browser outcomes and screenshot-based observations reviewed by ChatGPT. Codex transcribed the supplied report; it did not inspect the original screenshots or rerun these tests. Every PASS in this section is a reported manual result, not an automated test result.

**Environment/revision - owner-reported, not verified:** Windows/XAMPP local Laravel API and dummy MySQL database named ecommerce. Application reference: fix/profile-image-validation at 45a5d60464a6004b8076993fcdfd48cf863c2fa8, containing IMP-PROFILE-002, IMP-PROFILE-003 and the mobile-width correction. The exact runtime revision for each case, effective server configuration and database target/isolation were not independently verified during this documentation phase. This documentation branch is based on origin/main at 47a16f78df40566007b1f2a8bcacb6dd48a35ccf; it does not bring the application changes or unrelated authentication commits into main.

### Profile-picture retests - reported manual outcomes

| Test ID | Scenario | Reported observed result and limits |
|---|---|---|
| PROFILE-07A-R1 | Unsupported TXT | PASS - blocked by frontend; no backend rejection is established by this case |
| PROFILE-07B-R1 | Empty file selection | PASS - empty selection blocked; does not establish rejection of a zero-byte uploaded file |
| PROFILE-07C-R1 | Invalid PNG content | PASS - HTTP 422; previous picture remained after refresh |
| PROFILE-07D-R1 | WEBP upload | PASS - HTTP 200; picture persisted |
| PROFILE-06A-R1 | JPG upload | PASS - HTTP 200; picture persisted |
| PROFILE-07E | Oversized PNG | PASS for frontend warning/blocking - 10 MB warning displayed; exact file size and backend size-limit enforcement not independently confirmed |
| No supplied ID | Small PNG upload | PASS - HTTP 200 |
| No supplied ID | 2.06 MB PNG upload and later similar-file retry | Initial HTTP 422 with an upload-error message; later similar-file retry succeeded. Original cause unresolved; exact later status not supplied |

**Upload limits and unresolved failure:** PHP CLI limits were reported as 40M; the effective API server limits were not independently verified. Do not attribute the initial 2.06 MB PNG failure to PHP limits, file corruption or another cause without evidence. A later successful similar-file retry does not explain the initial failure. Backend enforcement of the 10 MB size boundary remains unverified.

**Retest identity:** PROFILE-07C-R1 above concerns the owner's invalid-PNG manual test. The earlier Codex-proposed authenticated TXT API test was blocked at runtime-environment verification and sent zero HTTP requests; it supplies no HTTP 422 evidence. Do not conflate it with PROFILE-07A-R1 frontend blocking or the owner's invalid-PNG result.

### Responsive-layout regression - reported manual outcomes

| Test ID | Scenario | Reported observed result and limits |
|---|---|---|
| LAYOUT-01 | Desktop | PASS - visible layout |
| LAYOUT-02 | Narrow browser / docked DevTools | PASS - visible layout |
| LAYOUT-03 | Mobile 375px and 320px | PASS - visible layout |
| LAYOUT-04 | Password visibility controls | PASS - controls worked |
| LAYOUT-05 | Account update | PASS - update succeeded; full name persisted after refresh; no exact HTTP status assigned |
| LAYOUT-06 | Duplicate username | PASS - HTTP 422; original username persisted |
| LAYOUT-07 | Duplicate phone | PASS - HTTP 422; original phone persisted |
| LAYOUT-08 | Password confirmation mismatch | PASS for displayed mismatch error; absence of an API request not conclusively verified |
| LAYOUT-09 | Incorrect current password | PASS - HTTP 422; existing password subsequently authenticated successfully with HTTP 200 |
| LAYOUT-10 | JPG profile-picture upload | PASS - UI success; picture and navbar avatar persisted after refresh; exact upload HTTP status not independently visible |

Password placeholders and helper instructions were readable in the inspected views; the Profile Picture card was compact on desktop rather than stretched to match the Account Information form. These are screenshot-based visual observations, not automated viewport/overflow measurements or universal device coverage.

**Evidence boundaries:** Persistence is inferred from owner-observed refresh/retrieval behavior, not independently verified in the database. HTTP statuses are recorded only where supplied. PROFILE-06A-R1's HTTP 200 does not establish LAYOUT-10's upload status or retroactively assign a status to the November 17 PROFILE-06A case. No screenshots, account values, passwords, tokens or confidential responses are included. Codex executed no application tests, API requests, automated browser tests, PHPUnit, migrations, seeders or database operations in this documentation phase.

**Outstanding work:** Historical results and issues above remain unchanged. The WEBP and invalid-upload observations narrow earlier coverage gaps only for these local reported cases. Missing/invalid authentication, cross-account ownership on reads/edits/uploads, SYS-001, BUG-AUTH-001, outstanding authentication/security tests, backend size-boundary enforcement, the unresolved upload error, broader file/validation boundaries and automated regression coverage remain open. These reports do not establish production behavior or full security coverage. Further runtime work requires separately approved scope and verified disposable-environment safeguards.
