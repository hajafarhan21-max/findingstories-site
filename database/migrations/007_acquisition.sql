ALTER TABLE leads ADD COLUMN IF NOT EXISTS page_type TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS acquisition_area TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS acquisition_project TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS acquisition_developer TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS budget_intent TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS bedroom_intent TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS acquisition_signals JSONB NOT NULL DEFAULT '[]';
CREATE TABLE IF NOT EXISTS acquisition_events (
  id BIGSERIAL PRIMARY KEY, event_key UUID NOT NULL UNIQUE, visitor_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view','repeated_visit','property_comparison','payment_plan_interest','whatsapp_click','meeting_request','site_visit_request')),
  page_url TEXT NOT NULL, page_type TEXT, area TEXT, project TEXT, developer TEXT,
  source TEXT, referrer TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
  is_test BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS acquisition_events_page_idx ON acquisition_events(is_test,page_url,created_at DESC);
