CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE shipment_status AS ENUM (
  'created',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'cancelled'
);

CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number VARCHAR(40) UNIQUE NOT NULL,
  origin_city VARCHAR(120) NOT NULL,
  origin_country VARCHAR(120) NOT NULL,
  destination_city VARCHAR(120) NOT NULL,
  destination_country VARCHAR(120) NOT NULL,
  status shipment_status NOT NULL DEFAULT 'created',
  estimated_delivery_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status shipment_status NOT NULL,
  location VARCHAR(180),
  note TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment_time
  ON shipment_events (shipment_id, occurred_at);

CREATE TABLE IF NOT EXISTS quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  email VARCHAR(320) NOT NULL,
  phone VARCHAR(40),
  origin VARCHAR(180) NOT NULL,
  destination VARCHAR(180) NOT NULL,
  service_type VARCHAR(80) NOT NULL,
  package_description TEXT,
  weight_kg NUMERIC(10,2),
  status VARCHAR(30) NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_requests_status_created
  ON quote_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  email VARCHAR(320) NOT NULL,
  phone VARCHAR(40),
  message TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_status_created
  ON contact_messages (status, created_at DESC);
