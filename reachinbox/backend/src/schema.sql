-- Run this once to set up your tables (see migrate.ts, or run with `npm run migrate`)

CREATE TABLE IF NOT EXISTS senders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  smtp_user TEXT NOT NULL,
  smtp_pass TEXT NOT NULL,
  max_emails_per_hour INT NOT NULL DEFAULT 200,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES senders(id),
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  sent_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | sent | failed
  job_id TEXT UNIQUE,                       -- BullMQ job id, same as emails.id (used for idempotency)
  owner_email TEXT,                         -- the logged-in user who scheduled it (tenant)
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_owner ON emails(owner_email);

CREATE TABLE IF NOT EXISTS slack_connections (
  owner_email TEXT PRIMARY KEY,
  webhook_url TEXT NOT NULL,
  team_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
