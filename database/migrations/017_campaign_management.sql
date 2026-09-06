-- Production campaign management. Additive/idempotent; apply manually after review.
-- The final INSERT creates only the requested DRAFT campaign and never creates a project.
CREATE TABLE IF NOT EXISTS crm_campaigns (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('PRE_LAUNCH','LAUNCH','EOI_DRIVE','LEAD_GENERATION','OPEN_HOUSE','SITE_VISIT_DRIVE','ORGANIC','PAID_ADVERTISING','REFERRAL','WHATSAPP','OTHER')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ACTIVE','PAUSED','ARCHIVED')),
  starts_on DATE, ends_on DATE, owner_id UUID REFERENCES crm_users(id) ON DELETE SET NULL,
  target_leads INTEGER NOT NULL DEFAULT 0 CHECK (target_leads >= 0),
  target_qualified_leads INTEGER NOT NULL DEFAULT 0 CHECK (target_qualified_leads >= 0),
  target_meetings INTEGER NOT NULL DEFAULT 0 CHECK (target_meetings >= 0),
  target_site_visits INTEGER NOT NULL DEFAULT 0 CHECK (target_site_visits >= 0),
  target_eois INTEGER NOT NULL DEFAULT 0 CHECK (target_eois >= 0),
  target_bookings INTEGER NOT NULL DEFAULT 0 CHECK (target_bookings >= 0),
  target_revenue NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK (target_revenue >= 0),
  notes TEXT NOT NULL DEFAULT '', is_test BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES crm_users(id), updated_by UUID REFERENCES crm_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on),
  UNIQUE (name,is_test)
);
CREATE INDEX IF NOT EXISTS crm_campaigns_project_idx ON crm_campaigns(project_id,is_test,status);

CREATE TABLE IF NOT EXISTS crm_campaign_assignments (
  campaign_id UUID NOT NULL REFERENCES crm_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(campaign_id,user_id)
);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES crm_campaigns(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS medium TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_content TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_term TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_touch_attribution JSONB NOT NULL DEFAULT '{}';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS latest_touch_attribution JSONB NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS leads_campaign_production_idx ON leads(campaign_id,created_at DESC) WHERE is_test=FALSE;

CREATE TABLE IF NOT EXISTS crm_campaign_eois (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), campaign_id UUID NOT NULL REFERENCES crm_campaigns(id) ON DELETE RESTRICT,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT, lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE RESTRICT,
  owner_id UUID REFERENCES crm_users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','CANCELLED')),
  completed_at TIMESTAMPTZ, is_test BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id,lead_id)
);
CREATE INDEX IF NOT EXISTS crm_campaign_eois_metrics_idx ON crm_campaign_eois(campaign_id,is_test,status);

INSERT INTO crm_role_permissions(role,resource,action)
SELECT 'SUPER_ADMIN','campaigns',action FROM unnest(ARRAY['view','create','edit','delete','assign']) action
ON CONFLICT DO NOTHING;
INSERT INTO crm_role_permissions(role,resource,action) VALUES
 ('MANAGER','campaigns','view'),('BUSINESS_HEAD','campaigns','view'),('TEAM_LEADER','campaigns','view'),
 ('PROPERTY_ADVISOR','campaigns','view'),('MARKETING','campaigns','view') ON CONFLICT DO NOTHING;

-- Deliberately does nothing unless the single existing verified production record matches.
INSERT INTO crm_campaigns(project_id,name,campaign_type,status,target_eois,notes,is_test)
SELECT p.id,'Azizi Florence — Pre-Launch EOI Campaign','PRE_LAUNCH','DRAFT',50,'',FALSE
FROM projects p
WHERE p.developer='Azizi Developments' AND p.name='Azizi Florence'
  AND p.review_status='verified' AND p.active=TRUE AND p.is_test=FALSE
  AND (SELECT COUNT(*) FROM projects x WHERE x.developer='Azizi Developments' AND x.name='Azizi Florence' AND x.is_test=FALSE)=1
ON CONFLICT (name,is_test) DO NOTHING;
