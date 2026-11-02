# Hanz-Go deployment plan — Vercel frontend + proposed Hostinger backend

**Status: PLANNING ONLY. No deployment authorized.** The owner reports that the frontend is on Vercel and intends to move the Laravel backend to Hostinger. The exact Hostinger plan and current runtime are not yet known.

## Proposed target
- Keep the static frontend on Vercel using its existing production domain.
- Prefer retaining the configured API hostname `api.hanzgo.me`, subject to DNS, certificate and server validation.
- Deploy the Laravel backend on a compatible Hostinger environment, exposing only `BackEnd/public` as the web root.
- Choose database location, writable storage layout, PHP runtime, scheduler/queues and backups based on the actual Hostinger plan.

## Release gates (all must be checked before production cutover)
- [ ] Confirm Hosting type (Web Hosting / Cloud / VPS), SSH access, PHP version/extensions, process limits, cron/queue and storage capabilities.
- [ ] Assess a supported Laravel upgrade and audit package compatibility separately; Laravel 10 security support ended 2025-02-04.
- [ ] Confirm environment variable names/config cache behavior, secure secrets and Firebase credentials handling.
- [ ] Build and test a **non-production** Hostinger/staging instance with an isolated database and synthetic records.
- [ ] Back up the existing production database and uploaded files; verify restoration on a disposable copy.
- [ ] Verify migrations/backfills, preserved IDs, foreign keys and application-specific data behavior on a disposable copy.
- [ ] Confirm the public web root, HTTPS, authorization headers, CORS and domain/DNS configuration.
- [ ] Confirm backend-hosted uploaded files will remain available at expected public URLs and cannot execute uploaded scripts.
- [ ] Check account login/roles, product views and approvals, cart/checkout, email delivery, FCM notifications and static frontend API calls.
- [ ] Prepare approved maintenance/cutover, health checks and rollback to the previous backend and database state.
- [ ] Receive explicit human signoff before redirecting live traffic, migrating real data, or changing infrastructure.

**Important:** `FrontEnd/assets/js/config.js` points every nonlocal hostname to `https://api.hanzgo.me`. Do not use a staging frontend with real production customer accounts by accident.

This checklist is a planning artifact, not evidence that Hostinger compatibility or security is confirmed.
