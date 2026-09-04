-- Additive pre-launch project support. This migration never updates or deletes
-- existing projects, inventory, campaigns, leads, users, or analytics records.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS availability_mode TEXT NOT NULL DEFAULT 'LIVE_INVENTORY'
  CHECK (availability_mode IN ('PRE_LAUNCH','LIVE_INVENTORY','SOLD_OUT','ARCHIVED'));
ALTER TABLE projects ADD COLUMN IF NOT EXISTS launch_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS eoi_amount NUMERIC CHECK (eoi_amount >= 0);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS eoi_type TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS booking_amount NUMERIC CHECK (booking_amount >= 0);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS campaign_status TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS launch_project_id UUID REFERENCES launch_projects(id);

ALTER TABLE project_sources ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'other'
  CHECK (source_kind IN ('brochure','master_plan','floor_plan','price_list','payment_plan','inventory','other'));

CREATE TABLE IF NOT EXISTS project_unit_types (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  ingestion_id UUID NOT NULL REFERENCES project_ingestions(id),
  unit_type TEXT NOT NULL, bedrooms TEXT, property_type TEXT NOT NULL,
  minimum_area NUMERIC CHECK (minimum_area >= 0), maximum_area NUMERIC CHECK (maximum_area >= 0),
  starting_price NUMERIC CHECK (starting_price >= 0), price_currency TEXT NOT NULL DEFAULT 'AED',
  approximate_psf NUMERIC CHECK (approximate_psf >= 0), floor_plan_reference TEXT,
  availability_status TEXT NOT NULL DEFAULT 'not_released'
    CHECK (availability_status IN ('not_released','registering_interest','released','sold_out')),
  review_status TEXT NOT NULL DEFAULT 'needs_review'
    CHECK (review_status IN ('needs_review','verified','rejected')),
  source_reference TEXT, notes TEXT, is_test BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (maximum_area IS NULL OR minimum_area IS NULL OR maximum_area >= minimum_area),
  UNIQUE(project_id,unit_type,property_type,is_test)
);
CREATE INDEX IF NOT EXISTS project_unit_types_match_idx
  ON project_unit_types(is_test,review_status,bedrooms,starting_price);
