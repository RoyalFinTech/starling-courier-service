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
