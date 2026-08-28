ALTER TABLE property_inventory ADD COLUMN IF NOT EXISTS unit TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS property_inventory_unit_unique ON property_inventory(unit) WHERE unit IS NOT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS attributed_revenue NUMERIC CHECK (attributed_revenue IS NULL OR attributed_revenue >= 0);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS revenue_currency TEXT CHECK (revenue_currency IS NULL OR revenue_currency = 'AED');
