# Hanz-Go system backlog

Tasks are **not approved automatically** because an AI listed them. Only the human owner can approve scope or merge/release.

| ID | Status | Purpose | Owner / next action |
|---|---|---|---|
| SYS-001 | **PROPOSED — approval pending** | Add isolated regression coverage and correct missing ownership checks for customer-owned addresses, preserving API behavior | Human approval; then Codex build and fresh Codex QA session |
| SYS-002 | PROPOSED | Plan upgrade from unsupported Laravel 10 to a supported version and review third-party package compatibility | ChatGPT architecture review + Codex compatibility assessment |
| SYS-003 | PROPOSED | Establish nonproduction Hostinger environment, test DB/file migration, email and FCM integration, rollback and cutover readiness | Confirm Hostinger plan; human approval before infrastructure work |

## Suggested acceptance criteria for SYS-001
1. Address owner may read, update and delete their own record with valid authentication.
2. A different authenticated account cannot read, alter or delete an address it does not own.
3. Unauthenticated or invalid-token access is denied.
4. Denied operations do not alter the stored record.
5. Response shape and valid owner flows remain compatible with the current frontend.
6. Tests use an explicitly isolated disposable database; never actual customer records.
7. Codex records exact tests run and results and submits a small reviewable PR. Human approval is required.

**Do not publish detailed vulnerability reproduction steps or customer data in a public issue.** Consider restricting repository visibility while reviewing security-sensitive defects.
