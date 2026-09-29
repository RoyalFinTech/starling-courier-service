# Starling Courier Service

Courier-service web application with customer shipment tracking, quote/contact intake, an authenticated operations dashboard, PostgreSQL persistence, transactional email notifications, and real-time Server-Sent Events (SSE).

> Internal application branding currently uses **Starling Courier Service**. The GitHub repository/project name is **Starling Courier Service**.

## Repository layout

```text
.
├── backend/
│   ├── migrations/          # PostgreSQL schema migrations
│   ├── public/              # Public website + admin dashboard + logo
│   ├── src/                 # Express API, auth, DB, security, email, migration runner
│   ├── .env.example
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── package.json
│   └── README.md
├── docs/
│   └── architecture.md
├── .github/
│   └── workflows/ci.yml
├── .dockerignore
├── .editorconfig
├── .gitignore
└── render.yaml
```

## Local development

Requirements: Node.js 20+, PostgreSQL 14+ (or Docker).

```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm run dev
```

The application is served at `http://localhost:4000` by default.

For Docker PostgreSQL:

```bash
cd backend
docker compose up -d postgres
npm install
npm run migrate
npm run dev
```

## Validation

```bash
cd backend
npm run check
```

## Production

Render configuration is included in `render.yaml`. It provisions a Node web service and PostgreSQL database and runs migrations before startup.

Required production secrets/configuration include `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `CORS_ORIGIN`, and the configured Resend email variables.

Never commit `.env` or production credentials. Use Render environment variables/secrets.

## Main capabilities

- Customer shipment tracking with event timeline
- Shareable tracking URLs
- Quote requests
- Contact messages
- JWT-protected admin operations
- Shipment creation/editing/status updates
- Shipment audit logging
- Quote/contact inbox management
- Transactional status and operations emails via Resend
- Real-time customer/admin updates via SSE
- PostgreSQL migrations
- API security headers and rate limiting
- Health endpoint for deployment monitoring

## Git workflow

- `main` is the production branch.
- Keep secrets out of Git.
- Use focused commits for future changes.
- Run `npm run check` in `backend` before committing backend changes.
