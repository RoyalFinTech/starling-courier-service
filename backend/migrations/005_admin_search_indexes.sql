CREATE INDEX IF NOT EXISTS idx_shipments_origin_city_lower ON shipments (LOWER(origin_city));
CREATE INDEX IF NOT EXISTS idx_shipments_destination_city_lower ON shipments (LOWER(destination_city));
CREATE INDEX IF NOT EXISTS idx_shipments_recipient_name_lower ON shipments (LOWER(recipient_name));
CREATE INDEX IF NOT EXISTS idx_shipments_status_created ON shipments (status, created_at DESC);
