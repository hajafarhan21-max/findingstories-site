CREATE TABLE IF NOT EXISTS property_inventory (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), unit TEXT, developer TEXT NOT NULL, project TEXT NOT NULL,
  emirate TEXT NOT NULL, area TEXT NOT NULL, property_type TEXT NOT NULL, bedrooms TEXT NOT NULL,
  minimum_price NUMERIC, maximum_price NUMERIC, minimum_size NUMERIC, maximum_size NUMERIC, price_per_sqft NUMERIC,
  handover DATE, payment_plan_summary TEXT, construction_status TEXT NOT NULL,
  suitability TEXT, status TEXT NOT NULL DEFAULT 'active', source TEXT NOT NULL,
  data_quality TEXT NOT NULL CHECK (data_quality IN ('verified','advisory')),
  last_updated TIMESTAMPTZ NOT NULL, is_test BOOLEAN NOT NULL DEFAULT FALSE, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS property_inventory_match_idx ON property_inventory(status,is_test,emirate,property_type,bedrooms);
CREATE UNIQUE INDEX IF NOT EXISTS property_inventory_unit_unique ON property_inventory(unit) WHERE unit IS NOT NULL;
CREATE TABLE IF NOT EXISTS property_recommendations (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), lead_id UUID NOT NULL REFERENCES leads(id), fingerprint TEXT NOT NULL,
  requirement_profile JSONB NOT NULL, ranked_matches JSONB NOT NULL, opportunity_flags JSONB NOT NULL DEFAULT '[]',
  advisor_status TEXT NOT NULL DEFAULT 'pending', outcome TEXT NOT NULL DEFAULT '', reviewed_at TIMESTAMPTZ,
  is_test BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lead_id,fingerprint)
);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_recommendation_fingerprint TEXT;
CREATE INDEX IF NOT EXISTS property_recommendations_lead_idx ON property_recommendations(lead_id,created_at DESC);
