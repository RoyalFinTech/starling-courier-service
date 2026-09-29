# Architecture

## Runtime

```text
Browser
  │
  ├── Public tracking / quote / contact
  │
  ├── Admin dashboard
  │
  └── SSE connections
  │
  ▼
Express API
  ├── Authentication / authorization
  ├── Validation / rate limiting / security headers
  ├── Shipment operations
  ├── Quote + contact intake
  ├── Transactional email service
  └── Real-time event broadcaster
  │
  ▼
PostgreSQL
  ├── shipments
  ├── shipment_events
  ├── quote_requests
  ├── contact_messages
  ├── admin_users
  ├── audit_logs
  └── email_notifications
```

## Data boundaries

Public tracking responses intentionally exclude recipient contact details and package-description fields. Administrative endpoints require a bearer JWT.

## Real-time model

REST endpoints remain the source of truth. SSE is used only to push changes to connected browsers; clients can reconnect and re-fetch authoritative state from REST.
