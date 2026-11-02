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

**Source-of-truth order:** human-approved scope and decisions; latest committed requirements/docs; verified code and executed tests; prior AI audit; chat notes. GitHub files, local files and separate AI chats do not automatically synchronize.
