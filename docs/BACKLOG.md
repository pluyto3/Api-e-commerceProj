# Hanz-Go system backlog

Tasks are **not approved automatically** because an AI listed them. Only the human owner can approve scope or merge/release.

| ID | Status | Purpose | Owner / next action |
|---|---|---|---|
| SYS-001 | **APPROVED for development — implementation prepared; NOT accepted or deployed** | Add isolated regression coverage and ownership-scoped customer address operations, preserving successful API behavior | Codex implementation on `feature/sys-001-address-ownership`; database tests blocked; separate Codex review and human acceptance pending |
| SYS-002 | PROPOSED | Plan upgrade from unsupported Laravel 10 to a supported version and review third-party package compatibility | ChatGPT architecture review + Codex compatibility assessment |
| SYS-003 | PROPOSED | Establish nonproduction Hostinger environment, test DB/file migration, email and FCM integration, rollback and cutover readiness | Confirm Hostinger plan; human approval before infrastructure work |

## Approved acceptance criteria for SYS-001
1. Address owner may read, update and delete their own record with valid authentication.
2. A different authenticated account cannot read, alter or delete an address it does not own.
3. Unauthenticated or invalid-token access is denied.
4. Denied operations do not alter the stored record.
5. Response shape and valid owner flows remain compatible with the current frontend.
6. Tests use an explicitly isolated disposable database; never actual customer records.
7. Codex records exact tests run and results and submits a small reviewable PR. Human approval is required.

### SYS-001 implementation status (2026-11-02)
- **Owner-approved scope:** bounded implementation and isolated regression testing, as explicitly authorized in the owner's SYS-001 request. No merge, deployment, production data, schema, authentication architecture, frontend, or hosting change is authorized.
- **Verified in code:** ownership-scoped address lookups, explicit update authentication denials, generic set-default denials, and synthetic regression tests are prepared on the feature branch. Successful response bodies and existing routes are preserved.
- **Executed:** PHP syntax checks and Composer manifest validation passed; the default CLI platform check failed because `ext-sodium` is unavailable. See `docs/TESTING.md` for commands and evidence.
- **Not verified:** runtime regression behavior and test database isolation. No database setup, connection, migrations, seeders, or database tests were executed. The owner selected the first offered option, keeping database setup blocked and proceeding with code, tests, and a draft PR.
- **Pending:** establish an owner-authorized disposable test environment, execute regression tests, fresh Codex review, and human acceptance. Development approval is not acceptance or release approval.

**Do not publish detailed vulnerability reproduction steps or customer data in a public issue.** Consider restricting repository visibility while reviewing security-sensitive defects.

## SYS-004 - Already-default address selection

**Status: PROPOSED; runtime unverified; implementation not approved.**

**Reported by a prior audit:** the fresh SYS-001 review identified a possible pre-existing `setDefaultAddress` defect: selecting an already-default address may clear its default flag.

**Verified in code:** the controller loads the selected model, bulk-clears the user's default flags, then updates the loaded model to `true`; the same sequence exists on baseline `main`. **Inferred:** if its original flag was already true, model dirty tracking may omit restoring the persisted flag after the bulk update. **Not verified:** runtime reproduction, database outcomes and impact.

Owner next action: approve separate investigation and a disposable isolated runtime environment. After approval, verify repeated selection preserves the chosen default and leaves other users unchanged, then scope any fix and regression coverage separately. No fix is included in the SYS-001 review correction.
