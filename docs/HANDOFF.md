# Hanz-Go AI workflow handoff

**Date:** 2026-11-02  
**Prepared by:** ChatGPT  
**Change type:** Documentation-only pilot (proposed PR)  
**Application code:** Unchanged; no deployments or database operations performed

## Current context
- Existing Laravel backend and static JavaScript frontend in `BackEnd/` and `FrontEnd/`.
- Frontend on Vercel: **reported by owner**, not verified by connected hosting account.
- Backend relocation to Hostinger: **future objective**, not approved or started.
- Current instructions: ChatGPT plans and verifies shared context; Codex builds and tests approved changes; GitHub is the handoff.
- Repository contains application source; this is **not** a thesis project.

## Evidence and limits
- ChatGPT inspected selected GitHub source files (architecture, route handlers, CORS, frontend configuration and PHPUnit setup).
- Local Codex audit was supplied by owner. Its command outputs and live environment have not been independently reproduced by ChatGPT.
- Tests executed by ChatGPT: **NONE**.
- GitHub branch and PR state must be checked before any code changes.
- No production database, live hosting console or credentials were accessed.

## Proposed next task
**SYS-001 (approval pending):** Add isolated automated regression tests and make customer-owned address operations enforce ownership consistently. Use a separate feature branch, synthetic accounts and a disposable test database; preserve the existing external API contract. A fresh Codex review must inspect behavior and test evidence. Do not begin editing application code until the owner approves.

## Future separate tasks
- Plan and execute a supported Laravel framework upgrade.
- Rehearse Hostinger migration, uploaded-file relocation and recovery.
- Prepare approved production cutover only after passing gates and human signoff.

## Next agent must read
`AGENTS.md`, `docs/CONTEXT_INDEX.md`, `docs/BACKLOG.md`, `docs/TESTING.md`, `docs/DEPLOYMENT.md`, and the actual relevant source code.
