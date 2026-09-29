# Engineering Log — Starling Courier Service

## 2026-09-29 — Supabase / Operations Phase
- Confirmed Supabase project: `starling courier services` (ref `hthmunktcmesdvfnjeqm`).
- Applied the application schema for shipments, shipment events, quotes, contact messages, admin users, audit logs, and email notifications.
- Verified all seven application tables exist and have Row Level Security enabled.
- Removed anonymous/authenticated table privileges because production application access is through the authenticated Express API and PostgreSQL connection.
- Locked down the public `rls_auto_enable()` SECURITY DEFINER helper.
- Hardened the `set_updated_at()` function search path and added an audit-log foreign-key index.
- Added a staff-only reporting API and admin dashboard charts/summary.
- Added shield restriction notice: “STAFF ONLY — OUT OF BOUNDS TO UNAUTHORIZED USERS.”
- Supabase REST/Data API remains available at project level, but raw application tables are intentionally not exposed to anonymous/authenticated browser clients.

## Pending production inputs
- Render production `DATABASE_URL` must point to the chosen Supabase database.
- Admin email/password must be supplied through Render secrets.
- Resend API key, verified sender address, and notification recipient must be supplied through Render secrets.
- Official phone, WhatsApp, social links, and support/contact URLs remain owner-provided inputs.


## 2026-09-29 — Premium booking + backend wiring pass
- Upgraded the public booking experience into a structured three-stage shipment request flow covering contact, pickup/destination, and shipment details.
- Rewired GitHub Pages customer tracking and booking requests to use the live Render backend origin instead of the GitHub Pages origin.
- Added the staff Admin Portal entry to the public footer and kept the portal URL backend-hosted.
- Moved customer/admin inline JavaScript into dedicated external assets so the backend Content Security Policy can enforce same-origin scripts.
- Hardened backend Helmet CSP while preserving the existing inline visual styles and Google Fonts.
- Updated Render Blueprint to use the production Supabase PostgreSQL connection via `DATABASE_URL` sync rather than provisioning a duplicate Render Postgres database.
