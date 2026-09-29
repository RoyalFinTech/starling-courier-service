CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'admin',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users (LOWER(email));

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);

ALTER TABLE shipments ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(160);
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(40);
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS package_description TEXT;
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(10,2);
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS service_type VARCHAR(80);

CREATE INDEX IF NOT EXISTS idx_shipments_status_updated ON shipments (status, updated_at DESC);
