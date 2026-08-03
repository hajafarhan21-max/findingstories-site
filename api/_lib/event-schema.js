// Event DDL is kept server-side and executed in one advisory-locked transaction.
// The lock serializes cold starts across Vercel instances; IF NOT EXISTS and
// conflict-safe seeds make every later invocation harmless.
export function eventSchemaQueries(sql) {
  return [
    sql`SELECT pg_advisory_xact_lock(748392601)`,
    sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`,
    sql`CREATE TABLE IF NOT EXISTS events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      venue TEXT NOT NULL, timezone TEXT NOT NULL DEFAULT 'Asia/Dubai', starts_on DATE NOT NULL,
      ends_on DATE NOT NULL, default_slot_capacity INTEGER NOT NULL DEFAULT 4 CHECK(default_slot_capacity > 0),
      active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE TABLE IF NOT EXISTS event_slots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), event_id UUID NOT NULL REFERENCES events(id),
      starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 4 CHECK(capacity > 0),
      booked_count INTEGER NOT NULL DEFAULT 0 CHECK(booked_count >= 0 AND booked_count <= capacity),
      active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(event_id, starts_at)
    )`,
    sql`CREATE TABLE IF NOT EXISTS event_rsvps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), event_id UUID NOT NULL REFERENCES events(id),
      idempotency_key UUID NOT NULL, full_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT,
      purpose TEXT, budget TEXT, property_type TEXT, preferred_area TEXT, purchase_timeline TEXT,
      owns_uae_property TEXT, payment_method TEXT, preferred_event_date DATE NOT NULL,
      preferred_slot UUID REFERENCES event_slots(id), confirmed_slot UUID REFERENCES event_slots(id),
      additional_requirements TEXT, consent BOOLEAN NOT NULL,
      status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contact_pending','contacted','interested',
        'appointment_proposed','confirmed','reminder_sent','attended','no_show','follow_up','booked','lost')),
      assigned_to TEXT NOT NULL DEFAULT '', lead_score INTEGER NOT NULL DEFAULT 0 CHECK(lead_score BETWEEN 0 AND 100),
      temperature TEXT NOT NULL DEFAULT 'Cold' CHECK(temperature IN ('Hot','Warm','Cold')),
      qualification_summary TEXT, next_action TEXT, suggested_call_opener TEXT,
      personalised_whatsapp_invitation TEXT, appointment_confirmation_message TEXT,
      reminder_message TEXT, no_show_follow_up_message TEXT, qualification_status TEXT NOT NULL DEFAULT 'pending',
      qualification_source TEXT, source TEXT NOT NULL DEFAULT 'open-house', utm_source TEXT,
      utm_medium TEXT, utm_campaign TEXT, referrer TEXT, attendance_status TEXT, lost_reason TEXT,
      last_contacted_at TIMESTAMPTZ, next_follow_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(event_id,idempotency_key)
    )`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS event_rsvps_phone_unique ON event_rsvps(event_id, phone)`,
    sql`CREATE UNIQUE INDEX IF NOT EXISTS event_rsvps_email_unique ON event_rsvps(event_id, lower(email))
      WHERE email IS NOT NULL AND email <> ''`,
    sql`CREATE INDEX IF NOT EXISTS event_rsvps_pipeline_idx ON event_rsvps(event_id,status,created_at DESC)`,
    sql`CREATE INDEX IF NOT EXISTS event_rsvps_followup_idx ON event_rsvps(next_follow_up_at)`,
    sql`CREATE TABLE IF NOT EXISTS event_rsvp_activity (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), rsvp_id UUID NOT NULL REFERENCES event_rsvps(id) ON DELETE CASCADE,
      activity_type TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}', created_by TEXT NOT NULL DEFAULT 'system',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`CREATE TABLE IF NOT EXISTS event_analytics (
      id BIGSERIAL PRIMARY KEY, event_id UUID REFERENCES events(id), metric TEXT NOT NULL,
      rsvp_id UUID REFERENCES event_rsvps(id), source TEXT, utm_source TEXT, utm_medium TEXT,
      utm_campaign TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    sql`INSERT INTO events(slug,name,venue,starts_on,ends_on,default_slot_capacity)
      VALUES('dubai-open-house-august-2026','Finding Stories Dubai Open House',
        'Shangri-La Hotel, near Financial Centre Metro Station, Dubai','2026-08-08','2026-08-09',4)
      ON CONFLICT(slug) DO NOTHING`,
    sql`INSERT INTO event_slots(event_id,starts_at,ends_at,capacity)
      SELECT e.id, (d + t)::timestamp AT TIME ZONE 'Asia/Dubai',
        (d + t + interval '30 minutes')::timestamp AT TIME ZONE 'Asia/Dubai', e.default_slot_capacity
      FROM events e CROSS JOIN (VALUES(DATE '2026-08-08'),(DATE '2026-08-09')) dates(d)
      CROSS JOIN generate_series(TIME '10:00',TIME '18:30',INTERVAL '30 minutes') times(t)
      WHERE e.slug='dubai-open-house-august-2026' ON CONFLICT(event_id,starts_at) DO NOTHING`,
    sql`CREATE OR REPLACE FUNCTION confirm_event_slot(p_rsvp UUID,p_slot UUID,p_actor TEXT DEFAULT 'admin')
      RETURNS BOOLEAN LANGUAGE plpgsql AS $$
      DECLARE old_slot UUID; available BOOLEAN;
      BEGIN
        SELECT confirmed_slot INTO old_slot FROM event_rsvps WHERE id=p_rsvp FOR UPDATE;
        IF NOT FOUND THEN RETURN FALSE; END IF;
        IF old_slot=p_slot THEN RETURN TRUE; END IF;
        UPDATE event_slots SET booked_count=booked_count+1
          WHERE id=p_slot AND active AND booked_count<capacity RETURNING TRUE INTO available;
        IF NOT COALESCE(available,FALSE) THEN RETURN FALSE; END IF;
        IF old_slot IS NOT NULL THEN
          UPDATE event_slots SET booked_count=GREATEST(0,booked_count-1) WHERE id=old_slot;
        END IF;
        UPDATE event_rsvps SET confirmed_slot=p_slot,status='confirmed',updated_at=NOW(),
          next_follow_up_at=(SELECT starts_at-INTERVAL '24 hours' FROM event_slots WHERE id=p_slot)
          WHERE id=p_rsvp;
        INSERT INTO event_rsvp_activity(rsvp_id,activity_type,details,created_by)
          VALUES(p_rsvp,CASE WHEN old_slot IS NULL THEN 'appointment_confirmed' ELSE 'appointment_rescheduled' END,
            jsonb_build_object('from_slot',old_slot,'to_slot',p_slot),p_actor);
        INSERT INTO event_analytics(event_id,metric,rsvp_id,source,utm_source,utm_medium,utm_campaign)
          SELECT event_id,'appointment_confirmation',id,source,utm_source,utm_medium,utm_campaign
          FROM event_rsvps WHERE id=p_rsvp;
        RETURN TRUE;
      END $$`
  ];
}

export function createEventSchemaInitializer(run) {
  let pending;
  return async () => {
    if (!pending) pending = Promise.resolve().then(run).catch(error => { pending = undefined; throw error; });
    return pending;
  };
}
