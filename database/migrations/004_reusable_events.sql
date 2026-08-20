-- Additive reusable event configuration and explicit synthetic-data isolation.
ALTER TABLE events ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS opening_time TIME NOT NULL DEFAULT TIME '10:00';
ALTER TABLE events ADD COLUMN IF NOT EXISTS closing_time TIME NOT NULL DEFAULT TIME '19:00';
ALTER TABLE events ADD COLUMN IF NOT EXISTS slot_duration_minutes INTEGER NOT NULL DEFAULT 30;
ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'OPEN';
ALTER TABLE events ADD COLUMN IF NOT EXISTS developers_projects TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS public_description TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS events_public_lookup_idx ON events(active,ends_on,status);
CREATE INDEX IF NOT EXISTS event_rsvps_test_lookup_idx ON event_rsvps(event_id,is_test,archived_at);

-- Deployment-safe test fixture. A pre-existing test event and all of its records are retained.
INSERT INTO events(slug,name,venue,address,timezone,starts_on,ends_on,opening_time,closing_time,
  slot_duration_minutes,default_slot_capacity,status,active,is_test,developers_projects,public_description)
SELECT 'finding-stories-system-test-' || to_char(dubai_today,'YYYYMMDD'),'Finding Stories System Test Event','Finding Stories Test Venue',
  'Dubai, UAE','Asia/Dubai',dubai_today + 1,dubai_today + 2,TIME '10:00',TIME '19:00',30,5,'TEST',TRUE,TRUE,
  'Test developer / test project','TEST MODE — synthetic RSVP workflow validation only.'
FROM (SELECT (NOW() AT TIME ZONE 'Asia/Dubai')::date dubai_today) clock
WHERE NOT EXISTS (SELECT 1 FROM events WHERE is_test AND active AND status='TEST'
  AND ends_on >= dubai_today AND EXISTS (SELECT 1 FROM event_slots s WHERE s.event_id=events.id AND s.active
    AND s.starts_at>NOW() AND s.booked_count<s.capacity))
ON CONFLICT(slug) DO NOTHING;

INSERT INTO event_slots(event_id,starts_at,ends_at,capacity)
SELECT e.id,(e.starts_on + day_number + e.opening_time + n * make_interval(mins=>e.slot_duration_minutes))::timestamp AT TIME ZONE e.timezone,
  (e.starts_on + day_number + e.opening_time + (n+1) * make_interval(mins=>e.slot_duration_minutes))::timestamp AT TIME ZONE e.timezone,
  e.default_slot_capacity
FROM events e
CROSS JOIN LATERAL generate_series(0,e.ends_on-e.starts_on) event_days(day_number)
CROSS JOIN LATERAL generate_series(0,GREATEST(0,FLOOR(EXTRACT(EPOCH FROM (e.closing_time-e.opening_time))/60/e.slot_duration_minutes)::int-1)) numbers(n)
WHERE e.is_test AND e.active AND e.status='TEST'
  AND e.ends_on >= (NOW() AT TIME ZONE e.timezone)::date
ON CONFLICT(event_id,starts_at) DO NOTHING;

-- Confirmation/rescheduling is capacity-safe, event-scoped, and cannot use an expired appointment.
CREATE OR REPLACE FUNCTION confirm_event_slot(p_rsvp UUID, p_slot UUID, p_actor TEXT DEFAULT 'admin') RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE old_slot UUID; rsvp_event UUID; available BOOLEAN;
BEGIN
  SELECT confirmed_slot,event_id INTO old_slot,rsvp_event FROM event_rsvps WHERE id=p_rsvp AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  IF old_slot=p_slot THEN RETURN TRUE; END IF;
  UPDATE event_slots SET booked_count=booked_count+1 WHERE id=p_slot AND event_id=rsvp_event AND active
    AND starts_at>NOW() AND booked_count<capacity RETURNING TRUE INTO available;
  IF NOT COALESCE(available,FALSE) THEN RETURN FALSE; END IF;
  IF old_slot IS NOT NULL THEN UPDATE event_slots SET booked_count=GREATEST(0,booked_count-1) WHERE id=old_slot; END IF;
  UPDATE event_rsvps SET confirmed_slot=p_slot,status='confirmed',updated_at=NOW(),
    next_follow_up_at=(SELECT starts_at-INTERVAL '24 hours' FROM event_slots WHERE id=p_slot) WHERE id=p_rsvp;
  INSERT INTO event_rsvp_activity(rsvp_id,activity_type,details,created_by) VALUES
    (p_rsvp,CASE WHEN old_slot IS NULL THEN 'appointment_confirmed' ELSE 'appointment_rescheduled' END,
     jsonb_build_object('from_slot',old_slot,'to_slot',p_slot),p_actor);
  INSERT INTO event_analytics(event_id,metric,rsvp_id,source,utm_source,utm_medium,utm_campaign)
    SELECT event_id,'appointment_confirmation',id,source,utm_source,utm_medium,utm_campaign FROM event_rsvps WHERE id=p_rsvp;
  RETURN TRUE;
END $$;
