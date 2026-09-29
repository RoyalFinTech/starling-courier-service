ALTER TABLE shipments ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(320);

CREATE TABLE IF NOT EXISTS email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key VARCHAR(255) UNIQUE NOT NULL,
  recipient_email VARCHAR(320) NOT NULL,
  notification_type VARCHAR(80) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  provider_id VARCHAR(255),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_email_notifications_status_created ON email_notifications(status, created_at DESC);
