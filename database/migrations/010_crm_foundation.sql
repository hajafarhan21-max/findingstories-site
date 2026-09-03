-- Finding Stories CRM Foundation V1. Additive only: all production rows are preserved
-- and legacy lead/inventory/event columns remain available to existing modules.
CREATE TABLE IF NOT EXISTS crm_users (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), email TEXT NOT NULL,
  display_name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN','ADMIN','BUSINESS_HEAD','MANAGER','TEAM_LEADER','PROPERTY_ADVISOR','MARKETING','OPERATIONS')),
  password_hash TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
  reports_to UUID REFERENCES crm_users(id), password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_users_email_idx ON crm_users(lower(email));
CREATE INDEX IF NOT EXISTS crm_users_reports_to_idx ON crm_users(reports_to) WHERE active;
CREATE TABLE IF NOT EXISTS crm_sessions (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), user_id UUID NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ,
  ip_address TEXT, user_agent TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS crm_sessions_user_active_idx ON crm_sessions(user_id,expires_at) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS crm_teams (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), name TEXT NOT NULL UNIQUE,
  manager_id UUID REFERENCES crm_users(id), active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS crm_team_members (
  team_id UUID NOT NULL REFERENCES crm_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(team_id,user_id)
);
CREATE INDEX IF NOT EXISTS crm_team_members_user_idx ON crm_team_members(user_id);

CREATE TABLE IF NOT EXISTS crm_role_permissions (
  role TEXT NOT NULL, resource TEXT NOT NULL, action TEXT NOT NULL,
  PRIMARY KEY(role,resource,action)
);
-- Explicit, reviewable defaults. Deployments may narrow these rows; application
-- authorization never infers access merely from a role name.
INSERT INTO crm_role_permissions(role,resource,action)
SELECT role, resource, action FROM
  unnest(ARRAY['SUPER_ADMIN']) role,
  unnest(ARRAY['leads','opportunities','inventory','tasks','meetings','site_visits','eois','bookings','reports','users','settings','imports','exports','assignments','audit_logs']) resource,
  unnest(ARRAY['view','create','edit','delete','assign','export']) action
ON CONFLICT DO NOTHING;
INSERT INTO crm_role_permissions(role,resource,action) VALUES
 ('ADMIN','leads','view'),('ADMIN','leads','create'),('ADMIN','leads','edit'),('ADMIN','leads','assign'),('ADMIN','opportunities','view'),('ADMIN','opportunities','create'),('ADMIN','opportunities','edit'),('ADMIN','tasks','view'),('ADMIN','tasks','create'),('ADMIN','tasks','edit'),('ADMIN','meetings','view'),('ADMIN','site_visits','view'),('ADMIN','inventory','view'),('ADMIN','reports','view'),('ADMIN','users','view'),('ADMIN','audit_logs','view'),
 ('BUSINESS_HEAD','leads','view'),('BUSINESS_HEAD','leads','assign'),('BUSINESS_HEAD','opportunities','view'),('BUSINESS_HEAD','tasks','view'),('BUSINESS_HEAD','meetings','view'),('BUSINESS_HEAD','site_visits','view'),('BUSINESS_HEAD','inventory','view'),('BUSINESS_HEAD','reports','view'),
 ('MANAGER','leads','view'),('MANAGER','leads','assign'),('MANAGER','opportunities','view'),('MANAGER','opportunities','edit'),('MANAGER','tasks','view'),('MANAGER','tasks','create'),('MANAGER','tasks','edit'),('MANAGER','meetings','view'),('MANAGER','site_visits','view'),('MANAGER','inventory','view'),('MANAGER','reports','view'),
 ('TEAM_LEADER','leads','view'),('TEAM_LEADER','leads','assign'),('TEAM_LEADER','opportunities','view'),('TEAM_LEADER','opportunities','create'),('TEAM_LEADER','opportunities','edit'),('TEAM_LEADER','tasks','view'),('TEAM_LEADER','tasks','create'),('TEAM_LEADER','tasks','edit'),('TEAM_LEADER','meetings','view'),('TEAM_LEADER','site_visits','view'),('TEAM_LEADER','inventory','view'),
 ('PROPERTY_ADVISOR','leads','view'),('PROPERTY_ADVISOR','leads','edit'),('PROPERTY_ADVISOR','opportunities','view'),('PROPERTY_ADVISOR','opportunities','create'),('PROPERTY_ADVISOR','opportunities','edit'),('PROPERTY_ADVISOR','tasks','view'),('PROPERTY_ADVISOR','tasks','create'),('PROPERTY_ADVISOR','tasks','edit'),('PROPERTY_ADVISOR','meetings','view'),('PROPERTY_ADVISOR','meetings','create'),('PROPERTY_ADVISOR','site_visits','view'),('PROPERTY_ADVISOR','site_visits','create'),('PROPERTY_ADVISOR','inventory','view'),
 ('MARKETING','leads','view'),('MARKETING','reports','view'),('MARKETING','imports','create'),('MARKETING','campaigns','view'),
 ('OPERATIONS','leads','view'),('OPERATIONS','inventory','view'),('OPERATIONS','inventory','edit'),('OPERATIONS','eois','view'),('OPERATIONS','eois','edit'),('OPERATIONS','bookings','view')
ON CONFLICT DO NOTHING;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES crm_users(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stage TEXT;
CREATE INDEX IF NOT EXISTS leads_owner_id_idx ON leads(owner_id);

CREATE TABLE IF NOT EXISTS crm_opportunities (
 id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), lead_id UUID NOT NULL REFERENCES leads(id), project_id UUID,
 developer TEXT, inventory_id UUID, owner_id UUID REFERENCES crm_users(id), expected_value NUMERIC(16,2),
 stage TEXT NOT NULL DEFAULT 'discovery', probability INTEGER NOT NULL DEFAULT 10 CHECK(probability BETWEEN 0 AND 100),
 expected_close_date DATE, outcome TEXT, loss_reason TEXT, is_test BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS crm_opportunities_lead_idx ON crm_opportunities(lead_id);
CREATE INDEX IF NOT EXISTS crm_opportunities_owner_idx ON crm_opportunities(owner_id);

CREATE TABLE IF NOT EXISTS crm_tasks (
 id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), title TEXT NOT NULL, task_type TEXT NOT NULL DEFAULT 'follow_up',
 priority TEXT NOT NULL DEFAULT 'normal', due_at TIMESTAMPTZ, reminder_at TIMESTAMPTZ,
 assignee_id UUID NOT NULL REFERENCES crm_users(id), created_by UUID REFERENCES crm_users(id),
 lead_id UUID REFERENCES leads(id), opportunity_id UUID REFERENCES crm_opportunities(id), completed_at TIMESTAMPTZ,
 is_test BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS crm_tasks_assignee_due_idx ON crm_tasks(assignee_id,due_at);

CREATE TABLE IF NOT EXISTS crm_activities (
 id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), lead_id UUID REFERENCES leads(id), opportunity_id UUID REFERENCES crm_opportunities(id),
 activity_type TEXT NOT NULL, direction TEXT, subject TEXT, body TEXT, metadata JSONB NOT NULL DEFAULT '{}',
 actor_id UUID REFERENCES crm_users(id), occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), is_test BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS crm_activities_lead_time_idx ON crm_activities(lead_id,occurred_at DESC);

CREATE TABLE IF NOT EXISTS crm_audit_logs (
 id BIGSERIAL PRIMARY KEY, actor_id UUID REFERENCES crm_users(id), action TEXT NOT NULL, entity_type TEXT NOT NULL,
 entity_id TEXT, before_value JSONB, after_value JSONB, ip_address TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS crm_audit_entity_idx ON crm_audit_logs(entity_type,entity_id,created_at DESC);

CREATE TABLE IF NOT EXISTS crm_password_reset_tokens (
 id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), user_id UUID NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS crm_login_audit (
 id BIGSERIAL PRIMARY KEY, user_id UUID REFERENCES crm_users(id), email TEXT, succeeded BOOLEAN NOT NULL,
 ip_address TEXT, user_agent TEXT, occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS crm_saved_views (
 id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), name TEXT NOT NULL, resource TEXT NOT NULL DEFAULT 'leads',
 filters JSONB NOT NULL DEFAULT '{}', owner_id UUID REFERENCES crm_users(id), shared BOOLEAN NOT NULL DEFAULT FALSE,
 system_key TEXT UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO crm_saved_views(name,filters,shared,system_key) VALUES
 ('My New Leads','{"scope":"mine","status":"new"}',TRUE,'my-new-leads'),('Uncontacted Leads','{"uncontacted":true}',TRUE,'uncontacted'),
 ('HOT Leads','{"temperature":"Hot"}',TRUE,'hot-leads'),('Follow-up Today','{"follow_up":"today"}',TRUE,'follow-up-today'),
 ('Overdue Follow-ups','{"follow_up":"overdue"}',TRUE,'overdue-follow-ups'),('Meetings Today','{"meeting":"today"}',TRUE,'meetings-today'),
 ('Site Visits Today','{"site_visit":"today"}',TRUE,'site-visits-today'),('EOI Pending','{"eoi":"pending"}',TRUE,'eoi-pending'),
 ('Payment Pending','{"payment":"pending"}',TRUE,'payment-pending'),('Unassigned','{"owner":"unassigned"}',TRUE,'unassigned'),
 ('Team Leads','{"scope":"team"}',TRUE,'team-leads') ON CONFLICT(system_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS crm_assignment_rules (
 id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), name TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 100,
 strategy TEXT NOT NULL CHECK(strategy IN ('round_robin','team','manual')), criteria JSONB NOT NULL DEFAULT '{}',
 team_id UUID REFERENCES crm_teams(id), active BOOLEAN NOT NULL DEFAULT FALSE, created_by UUID REFERENCES crm_users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
