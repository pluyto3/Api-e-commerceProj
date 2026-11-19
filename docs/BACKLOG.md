# Hanz-Go system backlog

Tasks are **not approved automatically** because an AI listed them. Only the human owner can approve scope or merge/release.

| ID | Status | Purpose | Owner / next action |
|---|---|---|---|
| SYS-001 | **APPROVED local implementation/review; implemented uncommitted** | Address ownership correction and isolated regression coverage, preserving API behavior | ChatGPT and owner review; isolated runtime execution pending; no commit/push yet |
| SYS-002 | PROPOSED | Plan upgrade from unsupported Laravel 10 to a supported version and review third-party package compatibility | ChatGPT architecture review + Codex compatibility assessment |
| SYS-003 | PROPOSED | Establish nonproduction Hostinger environment, test DB/file migration, email and FCM integration, rollback and cutover readiness | Confirm Hostinger plan; human approval before infrastructure work |

## Approved SYS-001 local integration - 2026-11-19

**Latest owner authorization:** Commit the six approved files and push the existing fix/auth-ui-main-20261118 branch. This supersedes the earlier uncommitted/no-push state below. PHPUnit and conclusive cross-account testing remain pending; the observed 404 does not verify foreign ownership. Merge, deployment and database operations remain unauthorized.

The owner explicitly approved local implementation and review on the existing fix/auth-ui-main-20261118 branch. This supersedes the PROPOSED status above for this bounded integration. Controller corrections and guarded tests from PR #3 are implemented locally, uncommitted. Source checks passed; isolated database execution, ChatGPT review and owner acceptance remain pending. No commit, push, merge or deployment is authorized.

## Suggested acceptance criteria for SYS-001
1. Address owner may read, update and delete their own record with valid authentication.
2. A different authenticated account cannot read, alter or delete an address it does not own.
3. Unauthenticated or invalid-token access is denied.
4. Denied operations do not alter the stored record.
5. Response shape and valid owner flows remain compatible with the current frontend.
6. Tests use an explicitly isolated disposable database; never actual customer records.
7. Codex records exact tests run and results and submits a small reviewable PR. Human approval is required.

**Do not publish detailed vulnerability reproduction steps or customer data in a public issue.** Consider restricting repository visibility while reviewing security-sensitive defects.
