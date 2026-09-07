-- Production funnel support only. This additive migration creates no projects,
-- campaigns, leads, activities, appointments, EOIs, bookings or analytics rows.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT;

ALTER TABLE acquisition_events DROP CONSTRAINT IF EXISTS acquisition_events_event_type_check;
ALTER TABLE acquisition_events ADD CONSTRAINT acquisition_events_event_type_check CHECK(event_type IN
 ('page_view','page_visit','cta_click','enquiry_started','enquiry_submitted','brochure_request','consultation_request',
  'repeated_visit','property_comparison','payment_plan_interest','whatsapp_click','meeting_request','site_visit_request'));
