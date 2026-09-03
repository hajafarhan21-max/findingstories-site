-- Generic launch funnel foundation. Additive and empty by default: this migration
-- creates no campaigns, projects, leads, EOIs, payments, or analytics records.
CREATE TABLE IF NOT EXISTS launch_projects (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), name TEXT NOT NULL,
  developer TEXT, slug TEXT NOT NULL UNIQUE, active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}', is_test BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS launch_campaigns (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), project_id UUID REFERENCES launch_projects(id),
  name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','active','paused','completed','cancelled')),
  target_eois INTEGER NOT NULL DEFAULT 50 CHECK (target_eois > 0),
  starts_at TIMESTAMPTZ, launches_at TIMESTAMPTZ, ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES crm_users(id), is_test BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS launch_campaigns_status_idx ON launch_campaigns(status,is_test,launches_at);

CREATE TABLE IF NOT EXISTS launch_lead_attribution (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), lead_id UUID NOT NULL REFERENCES leads(id),
  campaign_id UUID NOT NULL REFERENCES launch_campaigns(id), source TEXT, landing_page TEXT,
  utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT,
  qualification_score INTEGER CHECK (qualification_score BETWEEN 0 AND 100),
  lead_priority TEXT CHECK (lead_priority IN ('HOT','WARM','COLD')),
  call_ready BOOLEAN NOT NULL DEFAULT FALSE, call_ready_at TIMESTAMPTZ,
  follow_up_state TEXT NOT NULL DEFAULT 'not_scheduled'
    CHECK (follow_up_state IN ('not_scheduled','queued','due','completed','snoozed','cancelled')),
  first_response_at TIMESTAMPTZ, duplicate_of_lead_id UUID REFERENCES leads(id),
  owner_id UUID REFERENCES crm_users(id), is_test BOOLEAN NOT NULL DEFAULT FALSE,
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lead_id,campaign_id)
);
CREATE INDEX IF NOT EXISTS launch_attribution_campaign_idx ON launch_lead_attribution(campaign_id,is_test,lead_priority,call_ready);

CREATE TABLE IF NOT EXISTS launch_eois (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), campaign_id UUID NOT NULL REFERENCES launch_campaigns(id),
  project_id UUID REFERENCES launch_projects(id), lead_id UUID NOT NULL REFERENCES leads(id),
  opportunity_id UUID REFERENCES crm_opportunities(id), owner_id UUID REFERENCES crm_users(id),
  status TEXT NOT NULL DEFAULT 'advisor_confirmation_pending'
    CHECK (status IN ('advisor_confirmation_pending','confirmed','payment_link_pending','payment_link_sent','payment_pending','payment_confirmed','completed','cancelled')),
  payment_link_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (payment_link_status IN ('not_requested','approval_required','sent','expired','cancelled')),
  payment_confirmation_status TEXT NOT NULL DEFAULT 'not_confirmed'
    CHECK (payment_confirmation_status IN ('not_confirmed','human_review_required','confirmed','rejected')),
  advisor_confirmed_at TIMESTAMPTZ, payment_link_sent_at TIMESTAMPTZ,
  payment_confirmed_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  is_test BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS launch_eois_campaign_idx ON launch_eois(campaign_id,is_test,status);

CREATE TABLE IF NOT EXISTS launch_funnel_history (
  id BIGSERIAL PRIMARY KEY, campaign_id UUID NOT NULL REFERENCES launch_campaigns(id),
  lead_id UUID REFERENCES leads(id), eoi_id UUID REFERENCES launch_eois(id),
  event_type TEXT NOT NULL, from_state TEXT, to_state TEXT, actor_id UUID REFERENCES crm_users(id),
  metadata JSONB NOT NULL DEFAULT '{}', is_test BOOLEAN NOT NULL DEFAULT FALSE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS launch_history_campaign_time_idx ON launch_funnel_history(campaign_id,is_test,occurred_at DESC);

