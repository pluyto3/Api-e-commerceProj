# Hanz-Go AI workflow handoff

**Updated:** 2026-11-16

**Current owner:** Human repository owner (manual execution and acceptance); ChatGPT (screenshot review reported by owner); Codex (documentation/source inspection only).

**Documentation branch — verified:** `docs/auth-testing-handoff-20261116`, created from freshly fetched `origin/main` at `e7a9010ac9c24312f3ba847be078715979123acc`. Review destination: Draft PR targeting `main`; no merge or deployment authorized.

**Application revision manually tested — owner-reported:** `feature/auth-ui-improvements` at `bec8f9a` (`bec8f9ad0ead14358e8ba837b1d2705a237f422c`). Codex verified the local feature branch/HEAD before transfer, but did not reproduce the browser tests. Git ancestry check confirms this application revision is not merged into the fetched `origin/main` above. The documentation PR does not include or merge application changes.

**Current scope:** Owner-approved preparation, commit, push and Draft PR for `docs/TESTING.md` and `docs/HANDOFF.md` only. The earlier uncommitted edits were preserved with a path-scoped stash and applied without conflicts on the documentation branch; the stash backup is retained. Initial preparation began with a clean working tree before those two edits.

## Authentication documentation handoff — 2026-11-16

**Environment — owner-reported, not verified:** Office PC, Windows/XAMPP, Laravel 10.50.2, local MySQL database `ecommerce`. Database isolation and runtime configuration were not checked; `.env` was not read or modified.

**Completed manual testing — reported by a prior audit:** Owner-executed browser tests reviewed by ChatGPT screenshots covered registration, Resend/Gmail verification delivery, two-step verification and email confirmation, verified login and authenticated Home, logout and signed-out refresh, forgot/reset password, old-password rejection, new/latest-password login, consumed-token rejection, current/original-password history rejection, and another fresh-password reset. See `AUTH-MAN-20261116-01` through `-15` in `docs/TESTING.md` for expected results, observations and limits.

Reported HTTP evidence: 200 for login, logout, Forgot Password and initial Password Reset; 401 for old-password login. Not all rejection/reset screens included HTTP statuses. Codex has not independently reproduced the tests or inspected their original screenshots. No automated, comprehensive security or production verification is claimed.

**BUG-AUTH-001 — CONFIRMED FROM PRIOR MANUAL EVIDENCE, NOT FIXED:** Earlier Home PC registration returned HTTP 201 with backend account-created/verification-email-failed messaging, while the frontend showed "Successfully Registered" and instructed the user to check email. **Verified in code at application revision `bec8f9a`:** the backend failure branch returns 201 and the frontend success callback shows fixed success messaging. No approved fix was established; the failure path was not rerun. This observation does not assert that the feature revision is present in `main`.

**Remaining authentication tests — not verified:** required fields/invalid formats; duplicate username/email/phone; confirmation mismatch/minimum length; unverified login and invalid credentials; resend negative cases; server-side logout token invalidation; 60-minute reset expiration; invalid/replaced reset tokens; five-password history boundary; authorization/account ownership; automated regression coverage.

**Next bounded testing task (approval pending):** Manual registration validation covering required fields, formats, duplicates, confirmation mismatch and minimum length using synthetic accounts, after confirming a disposable local environment. Capture sanitized UI outcomes and HTTP statuses. This handoff authorizes no runtime tests or application fixes. SYS-001 remains a separate high-priority proposed task; this recommendation does not close or approve it.

### Documentation verification

- Original documentation preparation checks in local PowerShell: `git status --short` initially returned no changes; `git branch --show-current` and `git rev-parse HEAD` matched the application branch/revision `feature/auth-ui-improvements` at `bec8f9a`; `git log -1 --format='%h %s'` returned `bec8f9a fix(auth): strengthen password reset security and expiration`.
- Read `AGENTS.md`, context index, both target documents, architecture, deployment and backlog using `Get-Content`. Inspected backend/frontend registration source. `rg` found no existing date-scoped auth IDs in docs (no-match exit 1). An overly broad source search included bundled JavaScript and was truncated; targeted searches and source reads subsequently verified registration behavior.
- An attempted Python documentation edit failed because `python.exe` could not be accessed; it made no changes. Documentation was edited with `apply_patch`.
- Final checks: `git diff --check` initially flagged three new Markdown trailing-space line breaks; corrected. Rerun passed with no output. `git diff --stat`, `git diff -- docs/TESTING.md docs/HANDOFF.md`, and `git status --short` confirmed only the two approved documents changed. Same-session second-pass review checked evidence attribution, HTTP-status limits, test IDs, unresolved work and absence of sensitive values.
- Application test commands executed by Codex: **NONE**. No migrations, seeders, database-dependent tests, PHPUnit or automated browser tests. Second-pass review is a same-session documentation review, not independent QA. Human acceptance remains required.
- GitHub-review preparation checks: `git fetch origin main` succeeded after a sandbox permission retry; base is `e7a9010ac9c24312f3ba847be078715979123acc`. `git diff origin/main HEAD -- docs/TESTING.md docs/HANDOFF.md` was empty before transfer, confirming the committed target documents matched. `git merge-base --is-ancestor bec8f9a origin/main` returned 1 (application revision not merged). Path-scoped stash transfer applied without conflicts; backup retained.
- Review checks: `git diff --check` and `git diff --check origin/main` passed; exact `git diff origin/main -- docs/TESTING.md docs/HANDOFF.md` reviewed. `git diff --name-only origin/main` and status confirmed only those two documents changed. Same-session second-pass review found no application source, `.env`, credentials, password values, personal data, reset tokens or authentication hashes in the proposed diff. References to passwords/tokens describe test behavior only.
- Risks/next action: evidence is owner-reported, database isolation remains unverified, and unresolved historical work below remains open. Owner authorized committing/pushing this documentation branch and opening a Draft PR targeting `main`; independent review and human acceptance remain pending. No merge or deployment is authorized. The resulting commit SHA and Draft PR URL will be reported with the delivery rather than embedded in the commit itself.

## Historical handoff — 2026-11-02

The metadata and entries below describe the earlier pilot, not the current branch state. Earlier pending merge status has not been rechecked; unresolved work is preserved.

**Agent/person:** ChatGPT (documentation); Codex (read-only verification reported by owner)  
**Task:** Level 1 shared-context pilot and documentation consistency follow-up  
**Baseline branch/revision:** `main` at `2ba6c0f7c270928f6927f1d7b6c8d815c47afaf6`  
**Documentation follow-up branch:** `docs/level1-handoff-consistency-20261102` (merge pending)  
**Application code:** Unchanged; no deployments, application tests, migrations or database operations were performed by ChatGPT

## Current system and workflow
- Existing Laravel backend and static JavaScript frontend live in `BackEnd/` and `FrontEnd/`. This is **not** a thesis project.
- Vercel frontend hosting is **owner-reported** and was not independently verified from a hosting account.
- Hostinger backend migration remains a **planned future goal**, with no approved deployment or production change.
- ChatGPT handles project analysis, architecture and handoff; Codex builds and tests approved bounded tasks; GitHub commits/PRs are the shared record; the human owner approves changes.

## What changed

### Completed: shared-context pilot (merged into `main`)
- A documentation-only PR was merged, adding: `AGENTS.md`, `docs/CONTEXT_INDEX.md`, `docs/ARCHITECTURE.md`, `docs/TESTING.md`, `docs/DEPLOYMENT.md`, `docs/HANDOFF.md`, and `docs/BACKLOG.md`.
- Codex subsequently reported reading all seven files, confirming the roles and repository structure, and verifying its local `main` and live GitHub `main` match at `2ba6c0f7c270928f6927f1d7b6c8d815c47afaf6`.
- Codex's final assessment was **PASS for Level 1 shared-context verification**, with two documentation housekeeping gaps.

### Proposed in this follow-up PR (not yet merged)
- `docs/HANDOFF.md`: record the completed merge, baseline revision, changed paths and verification limits; replace outdated proposed-PR language.
- `docs/CONTEXT_INDEX.md`: distinguish approved intended requirements from actual implemented behavior evidenced by source code and tests.

## Verification evidence and limits
- **Codex read-only context check (owner-provided report):** seven requested context files accessed; branch `main` clean, ahead/behind 0/0; remote `main` reported matching the baseline revision.
- **GitHub read:** ChatGPT read relevant committed files and inspected the original code during the audit; the two housekeeping files were read again before this proposed change.
- **Application test commands executed by ChatGPT:** NONE. Codex's separate earlier audit reported source checks, but those execution results were not independently reproduced here.
- **Current branch HEAD, production settings, hosting configuration and backend migration:** no live deployments or runtime tests verified.

## Risks / approvals outstanding
- High-priority customer-owned address authorization gap identified during source inspection; fix is proposed, not authorized.
- Test database isolation must be established before running DB-dependent tests. Do not use real customer data or production credentials.
- Existing Laravel framework version requires an upgrade plan; Hostinger compatibility, database/files backup and rollback remain unverified.
- The repository is public; avoid publishing vulnerability reproduction detail or customer information in public discussions.

## Next task (human approval required)
**SYS-001 — PROPOSED:** Implement ownership-scoped address access and isolated regression tests with synthetic data. Codex should first confirm the exact test DB is disposable, work on a separate feature branch, record commands/results, and submit a reviewable PR. No application edit is authorized solely by this handoff.

## Next agent must read
`AGENTS.md`, `docs/CONTEXT_INDEX.md`, `docs/BACKLOG.md`, `docs/TESTING.md`, `docs/DEPLOYMENT.md`, this handoff, and the relevant current application code.
