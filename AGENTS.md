# Hanz-Go system: shared instructions for ChatGPT and Codex

## Current workflow
- **ChatGPT:** analyze existing code and requirements, draft architecture and safe implementation plans, review reported test evidence and prepare handoffs.
- **Codex:** inspect code, implement **approved** bounded changes on feature branches, execute appropriate tests, and perform a separate second-pass review.
- **GitHub:** committed files and reviewed pull requests are the shared record. Chats and uncommitted local changes do not sync automatically.
- **Human owner:** approves scope, merges, deployment, and live data/configuration changes.
- **Claude Code:** optional, not required.

**This is an existing e-commerce system, not a thesis project. Do not add academic chapters, methodology, study claims or thesis traceability files.**

## Start of every task
1. Read this file, `docs/CONTEXT_INDEX.md`, `docs/HANDOFF.md`, and the relevant architecture, testing and deployment documents.
2. Inspect actual `BackEnd/` and `FrontEnd/` code; do not infer implementation from plans.
3. Check the current Git branch, working tree, scope, task approval and known risks.
4. Label statements **verified in code**, **reported by a prior audit**, **inferred**, or **not verified**.
5. Work only from an approved issue or bounded request. If the only available task is marked PROPOSED, report what approval is missing before editing application code.

## Boundaries
- Never change production Hostinger, Vercel, DNS, cloud accounts, credentials, payments, databases, or customer records without explicit permission.
- Never run tests, migration commands, seeders, resets, or other potentially destructive operations against production or an unknown database. Use an isolated disposable environment and synthetic records.
- Do not expose `.env`, Firebase service account JSON, API keys, secrets, customer data, or confidential logs in Git, issues, PRs or AI messages.
- Preserve the live frontend's existing API contract and the `api.hanzgo.me` domain unless an approved migration changes them.
- Use small PRs. Do not combine an authorization fix, Laravel upgrade and Hostinger migration in one change.
- Record actual test commands, environment, pass/fail output, unavailable checks, risks and remaining work. No fabricated results.
- Use a fresh Codex session for review where possible; a second Codex session is not independent third-party QA. Require human acceptance.

## Tech map (verify before acting)
- `BackEnd/`: Laravel 10 PHP API, MySQL-oriented migrations, controllers, FCM and email integrations.
- `FrontEnd/`: static HTML/CSS/JavaScript; `FrontEnd/assets/js/config.js` selects backend and frontend URLs.
- Current user-reported goal: preserve Vercel-hosted frontend while evaluating a future backend move to Hostinger. Live hosting details are **not verified** by this repository.

## Handoff
At the end of each approved task, update `docs/HANDOFF.md` with owner, branch/revision, changed paths, tests actually executed, results, risks and next action. Obtain owner approval before deployment or merge.
