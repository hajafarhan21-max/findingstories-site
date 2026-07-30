CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), submission_id UUID, name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT,
  country_of_residence TEXT, purpose TEXT, budget TEXT, property_type TEXT, bedrooms TEXT,
  preferred_areas TEXT, payment_method TEXT, purchase_timeline TEXT, owns_uae_property TEXT,
  additional_requirements TEXT, consent BOOLEAN NOT NULL DEFAULT FALSE, source TEXT NOT NULL DEFAULT 'website',
  landing_page TEXT, referrer TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, content_source TEXT,
  lead_score INTEGER NOT NULL DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  temperature TEXT NOT NULL DEFAULT 'Cold' CHECK (temperature IN ('Hot','Warm','Cold')),
  qualification_summary TEXT, requirement_summary TEXT, missing_information JSONB NOT NULL DEFAULT '[]',
  next_action TEXT, suggested_follow_up_date DATE, whatsapp_follow_up_draft TEXT, call_opener TEXT,
  qualification_status TEXT NOT NULL DEFAULT 'pending', status TEXT NOT NULL DEFAULT 'new', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS submission_id UUID;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification_status TEXT NOT NULL DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS leads_temperature_idx ON leads (temperature);
CREATE UNIQUE INDEX IF NOT EXISTS leads_submission_id_idx ON leads (submission_id) WHERE submission_id IS NOT NULL;
