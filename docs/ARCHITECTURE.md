# Hanz-Go architecture baseline

**Status:** Existing application; partial repository inspection as of 2026-11-02. This is not proof of live production configuration.

## Components
- **Frontend:** static multipage HTML, CSS and JavaScript under `FrontEnd/`, including jQuery-based requests. The owner reports the frontend is deployed on Vercel.
- **Backend:** PHP Laravel 10 application under `BackEnd/`, with API routes in `BackEnd/routes/api.php`, custom controllers and middleware, and MySQL-oriented migrations.
- **API integration:** `FrontEnd/assets/js/config.js` selects `http://127.0.0.1:8000` locally and `https://api.hanzgo.me` on nonlocal hosts. A nonlocal staging hostname therefore also selects the production API unless deliberately configured.
- **Public frontend domain:** code references `https://hanzgo.me`. This is a configured URL, not a verified live deployment.
- **Backend cross-origin access:** `BackEnd/config/cors.php` includes `https://hanzgo.me` and `https://www.hanzgo.me`.

## Features and dependencies found by source audit
- Account roles, catalog and approvals, addresses, cart/checkout, orders, notifications and support tickets.
- MySQL persistence, Firebase Cloud Messaging, mail integrations including Resend configuration, and backend-hosted uploaded images.
- The installed framework runtime, actual secrets, mail transport, upload data, DNS, live payment behavior and current database state were **not verified**.

## Risks to evaluate separately
- Authentication and authorization consistency across accounts and customer-owned data.
- Legacy Laravel version and compatibility of current packages with a supported upgrade.
- Image storage and public URL stability during any backend move.
- Firebase service account, push-token behavior, email delivery and background jobs on the intended hosting plan.
- Existing browser API contract and CORS behavior after a hosting or domain change.

No production architecture or database access was used to prepare this baseline.
