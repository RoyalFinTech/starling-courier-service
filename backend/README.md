# Starling Courier Backend

Node.js + Express + PostgreSQL API for the Starling Courier website and admin operations.

## Development

1. Copy `.env.example` to `.env` and set local values.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Run migrations: `npm run migrate`.
4. Start the API: `npm run dev`.

The API and public website are served together on port `4000`.

## Production

Required environment variables:
- `DATABASE_URL`
- `JWT_SECRET` (minimum 32 characters)
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD` (minimum 12 characters; used only to bootstrap the first admin)
- `CORS_ORIGIN` (comma-separated allowed browser origins; use the deployed site origin)

The production start command runs pending migrations before starting the API.

## API

Public:
- `GET /api/health`
- `GET /api/shipments/:trackingNumber`
- `POST /api/quotes`
- `POST /api/contact`
- `POST /api/auth/login`

Admin routes require `Authorization: Bearer <token>` and are documented by the admin dashboard.

## Transactional email notifications

The API can send transactional notifications through Resend when `RESEND_API_KEY` and `EMAIL_FROM` are configured. `NOTIFICATION_EMAIL` receives new quote/contact alerts. Shipment recipients receive status-change emails when a shipment has `recipient_email` set. Notification sends are idempotent via `email_notifications.event_key` and use bounded retries.

Before production sending, authenticate the sending domain with SPF/DKIM/DMARC in Resend. These messages are transactional; do not use this path for marketing mail without adding consent, unsubscribe, and suppression handling.

## Customer tracking experience (v6)

The public tracking interface now renders the real `shipment_events` history returned by `GET /api/shipments/:trackingNumber`.

Public tracking intentionally excludes recipient contact information and package-description fields. It exposes operational shipment data only: route, current status, service type, ETA, timestamps, and event history.

Direct tracking links are supported with a query parameter, for example:

```text
/?tracking=YOUR-TRACKING-NUMBER
```

The page automatically submits that number to the API and renders the current shipment timeline.
