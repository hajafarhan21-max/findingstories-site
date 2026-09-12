-- Add first-class conversion attribution without changing or fabricating legacy leads.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS conversion_type TEXT;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_conversion_type_check;
ALTER TABLE leads ADD CONSTRAINT leads_conversion_type_check CHECK (
  conversion_type IS NULL OR conversion_type IN
    ('enquiry','brochure_request','availability_request','consultation','site_visit','whatsapp')
);

ALTER TABLE acquisition_events ADD COLUMN IF NOT EXISTS conversion_type TEXT;
ALTER TABLE acquisition_events ADD COLUMN IF NOT EXISTS utm_content TEXT;
ALTER TABLE acquisition_events ADD COLUMN IF NOT EXISTS utm_term TEXT;
ALTER TABLE acquisition_events DROP CONSTRAINT IF EXISTS acquisition_events_conversion_type_check;
ALTER TABLE acquisition_events ADD CONSTRAINT acquisition_events_conversion_type_check CHECK (
  conversion_type IS NULL OR conversion_type IN
    ('enquiry','brochure_request','availability_request','consultation','site_visit','whatsapp')
);
ALTER TABLE acquisition_events DROP CONSTRAINT IF EXISTS acquisition_events_event_type_check;
ALTER TABLE acquisition_events ADD CONSTRAINT acquisition_events_event_type_check CHECK(event_type IN
 ('page_view','page_visit','cta_click','location_explore','enquiry_started','enquiry','brochure_request',
  'availability_request','consultation','site_visit','whatsapp','repeated_visit','property_comparison',
  'payment_plan_interest','meeting_request','site_visit_request'));

CREATE INDEX IF NOT EXISTS leads_conversion_type_idx
  ON leads (conversion_type, captured_at DESC) WHERE is_test=FALSE;
CREATE INDEX IF NOT EXISTS acquisition_events_conversion_idx
  ON acquisition_events (conversion_type, created_at DESC) WHERE is_test=FALSE;
