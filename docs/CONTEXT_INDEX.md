# Hanz-Go context index

This is the **existing system** pilot for ChatGPT + Codex + GitHub. This project does not require a thesis.

| Question | Source | Status |
|---|---|---|
| Who does what and what is prohibited? | `AGENTS.md` | Active project rules |
| What is currently known about the code? | `docs/ARCHITECTURE.md` and actual `BackEnd/`, `FrontEnd/` | Code takes precedence for implemented facts |
| What should be done next? | `docs/BACKLOG.md` | Approval state must be checked |
| What testing evidence exists? | `docs/TESTING.md` plus actual command results | Distinguish audited vs executed |
| What is required before Hostinger? | `docs/DEPLOYMENT.md` | A plan, not a deployment |
| What changed recently? | `docs/HANDOFF.md` and Git history | Update each meaningful approved task |

**How to resolve documentation versus code:** Human-approved requirements and decisions govern **what the application is supposed to do**. Inspected source code and actual executed tests show **what it currently implements and demonstrably does**. If actual behavior differs from approved intent, record the discrepancy; neither rewrite approved requirements to match an accidental implementation nor claim the requested behavior is already implemented.

**Source-of-truth order by question:** intended behavior → human-approved requirements and decisions; current implementation → inspected code and actual observed test results; current work status → reviewed GitHub commits/PRs and handoff. Earlier AI audits and chats are supporting context, not independently verified evidence. GitHub files, local changes and separate AI chats do not automatically synchronize.
