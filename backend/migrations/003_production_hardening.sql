CREATE INDEX IF NOT EXISTS idx_shipments_tracking_number ON shipments (tracking_number);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users (active);

ALTER TABLE quote_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS quote_requests_updated_at ON quote_requests;
CREATE TRIGGER quote_requests_updated_at BEFORE UPDATE ON quote_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS contact_messages_updated_at ON contact_messages;
CREATE TRIGGER contact_messages_updated_at BEFORE UPDATE ON contact_messages
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
