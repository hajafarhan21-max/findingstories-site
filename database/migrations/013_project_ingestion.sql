-- Safe, additive project/source ingestion foundation. Apply before enabling the
-- project-ingestion admin control. This migration does not alter existing rows.
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  project_key TEXT NOT NULL, developer TEXT NOT NULL, name TEXT NOT NULL,
  emirate TEXT, area TEXT, description TEXT, construction_status TEXT,
  handover DATE, payment_plan_summary TEXT, attributes JSONB NOT NULL DEFAULT '{}',
  review_status TEXT NOT NULL DEFAULT 'needs_review' CHECK (review_status IN ('needs_review','verified','rejected')),
  active BOOLEAN NOT NULL DEFAULT FALSE, is_test BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by UUID REFERENCES crm_users(id), verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_key,is_test), CHECK (NOT active OR review_status='verified')
);

CREATE TABLE IF NOT EXISTS project_ingestions (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), project_id UUID REFERENCES projects(id),
  status TEXT NOT NULL DEFAULT 'needs_review' CHECK (status IN ('needs_review','verified','rejected','error')),
  import_kind TEXT NOT NULL DEFAULT 'create' CHECK (import_kind IN ('create','update','duplicate')),
  submitted_by UUID NOT NULL REFERENCES crm_users(id), is_test BOOLEAN NOT NULL DEFAULT FALSE,
  payload JSONB NOT NULL, issues JSONB NOT NULL DEFAULT '[]',
  reviewed_by UUID REFERENCES crm_users(id), reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_sources (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), ingestion_id UUID NOT NULL REFERENCES project_ingestions(id) ON DELETE CASCADE,
  filename TEXT NOT NULL, media_type TEXT NOT NULL, byte_size INTEGER NOT NULL CHECK (byte_size BETWEEN 1 AND 10485760),
  sha256 TEXT NOT NULL, content BYTEA NOT NULL, uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ingestion_id,sha256)
);

ALTER TABLE property_inventory ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id);
ALTER TABLE property_inventory ADD COLUMN IF NOT EXISTS ingestion_id UUID REFERENCES project_ingestions(id);
ALTER TABLE property_inventory ADD COLUMN IF NOT EXISTS source_row INTEGER;
ALTER TABLE property_inventory ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'verified'
  CHECK (review_status IN ('needs_review','verified','rejected'));
-- The legacy global unit index prevented an identically named TEST fixture and
-- production unit from coexisting. Project-scoped identity is deterministic and
-- preserves every existing row.
DROP INDEX IF EXISTS property_inventory_unit_unique;
CREATE UNIQUE INDEX IF NOT EXISTS property_inventory_import_identity_unique
  ON property_inventory(project_id,unit,is_test) WHERE project_id IS NOT NULL AND unit IS NOT NULL;
CREATE INDEX IF NOT EXISTS project_ingestions_review_idx ON project_ingestions(status,is_test,created_at DESC);
