CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), submission_id UUID, name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT,
  country_of_residence TEXT, purpose TEXT, budget TEXT, property_type TEXT, bedrooms TEXT,
  preferred_areas TEXT, payment_method TEXT, purchase_timeline TEXT, owns_uae_property TEXT,
  additional_requirements TEXT, consent BOOLEAN NOT NULL DEFAULT FALSE, source TEXT NOT NULL DEFAULT 'website',
  landing_page TEXT, referrer TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, content_source TEXT,
  lead_score INTEGER NOT NULL DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
  temperature TEXT NOT NULL DEFAULT 'Cold' CHECK (temperature IN ('Hot','Warm','Cold')),
  qualification_summary TEXT, requirement_summary TEXT, missing_information JSONB NOT NULL DEFAULT '[]',
  next_action TEXT, suggested_follow_up_date DATE, whatsapp_follow_up_draft TEXT, call_opener TEXT,
  qualification_status TEXT NOT NULL DEFAULT 'pending', qualification_source TEXT,
  qualification_started_at TIMESTAMPTZ, qualified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'new', assigned_to TEXT NOT NULL DEFAULT '', agent_notes TEXT NOT NULL DEFAULT '',
  last_contacted_at TIMESTAMPTZ, next_follow_up_at TIMESTAMPTZ, meeting_at TIMESTAMPTZ, site_visit_at TIMESTAMPTZ,
  lost_reason TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_test BOOLEAN NOT NULL DEFAULT FALSE, ai_recommendation JSONB, ai_recommendation_fingerprint TEXT,
  ai_recommended_at TIMESTAMPTZ, ai_reviewed_at TIMESTAMPTZ, ai_dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS submission_id UUID;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification_source TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification_started_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS agent_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS meeting_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS site_visit_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_recommendation JSONB;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_recommendation_fingerprint TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_recommended_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_reviewed_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_dismissed_at TIMESTAMPTZ;
UPDATE leads SET next_follow_up_at=suggested_follow_up_date::timestamp AT TIME ZONE 'Asia/Dubai'
  WHERE next_follow_up_at IS NULL AND suggested_follow_up_date IS NOT NULL;
UPDATE leads SET captured_at=created_at WHERE captured_at IS NULL;
ALTER TABLE leads ALTER COLUMN captured_at SET DEFAULT NOW();
ALTER TABLE leads ALTER COLUMN captured_at SET NOT NULL;
UPDATE leads SET qualification_status='completed', qualification_source=COALESCE(qualification_source, 'legacy'),
  qualified_at=COALESCE(qualified_at, created_at) WHERE qualification_summary IS NOT NULL AND qualification_status='pending';
CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS leads_temperature_idx ON leads (temperature);
CREATE UNIQUE INDEX IF NOT EXISTS leads_submission_id_idx ON leads (submission_id) WHERE submission_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_qualification_status_idx ON leads (qualification_status);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);
CREATE INDEX IF NOT EXISTS leads_assigned_to_idx ON leads (assigned_to);
CREATE INDEX IF NOT EXISTS leads_next_follow_up_at_idx ON leads (next_follow_up_at);

-- Event RSVP schema is maintained by the non-destructive migration below.
\ir migrations/003_event_rsvp.sql
\ir migrations/004_reusable_events.sql
\ir migrations/005_revenue_execution.sql
\ir migrations/006_property_matching.sql
\ir migrations/007_acquisition.sql
\ir migrations/008_search_console.sql
\ir migrations/009_binghatti_inventory_revenue.sql
\ir migrations/010_crm_foundation.sql
