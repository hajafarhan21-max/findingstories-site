-- Operational lead numbers are separate from immutable UUID identifiers. PostgreSQL's
-- sequence is atomic across connections, so concurrent captures cannot share a number.
CREATE SEQUENCE IF NOT EXISTS lead_number_seq START WITH 100001;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_number BIGINT;
ALTER TABLE leads ALTER COLUMN lead_number SET DEFAULT nextval('lead_number_seq');
SELECT setval('lead_number_seq', GREATEST(COALESCE(MAX(lead_number), 100000), 100001), MAX(lead_number) IS NOT NULL) FROM leads;
UPDATE leads SET lead_number=nextval('lead_number_seq') WHERE lead_number IS NULL;
ALTER TABLE leads ALTER COLUMN lead_number SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS leads_lead_number_idx ON leads(lead_number);
