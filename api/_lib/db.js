import { neon } from '@neondatabase/serverless';

let initialized;
let eventInitialized;
let sqlClient;
let sqlClientUrl;

export function databaseUrl(env = process.env) {
  const configured = env.VERCEL_ENV === 'production'
    ? env.PRODUCTION_DATABASE_URL || env.DATABASE_URL
    : env.DATABASE_URL || env.PRODUCTION_DATABASE_URL;
  return configured?.trim();
}

export function database() {
  const connectionString = databaseUrl();
  if (!connectionString) throw new Error('Database is not configured');
  if (sqlClientUrl !== connectionString) {
    sqlClient = neon(connectionString);
    sqlClientUrl = connectionString;
  }
  return sqlClient;
}

export async function ensureSchema() {
  if (!initialized) {
    const sql = database();
    initialized = (async () => {
      // gen_random_uuid() is used by the first table definition, so the
      // extension must exist before that definition runs on a new database.
      await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
      await sql`
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        submission_id UUID,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        country_of_residence TEXT,
        purpose TEXT,
        budget TEXT,
        property_type TEXT,
        bedrooms TEXT,
        preferred_areas TEXT,
        payment_method TEXT,
        purchase_timeline TEXT,
        owns_uae_property TEXT,
        additional_requirements TEXT,
        consent BOOLEAN NOT NULL DEFAULT FALSE,
        source TEXT NOT NULL DEFAULT 'website',
        landing_page TEXT,
        referrer TEXT,
        utm_source TEXT,
        utm_medium TEXT,
        utm_campaign TEXT,
        content_source TEXT,
        lead_score INTEGER NOT NULL DEFAULT 0 CHECK (lead_score BETWEEN 0 AND 100),
        temperature TEXT NOT NULL DEFAULT 'Cold' CHECK (temperature IN ('Hot','Warm','Cold')),
        qualification_summary TEXT,
        requirement_summary TEXT,
        missing_information JSONB NOT NULL DEFAULT '[]',
        next_action TEXT,
        suggested_follow_up_date DATE,
        whatsapp_follow_up_draft TEXT,
        call_opener TEXT,
        qualification_status TEXT NOT NULL DEFAULT 'pending',
        qualification_source TEXT,
        qualification_started_at TIMESTAMPTZ,
        qualified_at TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'new',
        assigned_to TEXT NOT NULL DEFAULT '', agent_notes TEXT NOT NULL DEFAULT '',
        last_contacted_at TIMESTAMPTZ, next_follow_up_at TIMESTAMPTZ, meeting_at TIMESTAMPTZ,
        site_visit_at TIMESTAMPTZ, lost_reason TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS submission_id UUID`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification_status TEXT NOT NULL DEFAULT 'pending'`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification_source TEXT`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification_started_at TIMESTAMPTZ`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS agent_notes TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS meeting_at TIMESTAMPTZ`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS site_visit_at TIMESTAMPTZ`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
      await sql`UPDATE leads SET next_follow_up_at=suggested_follow_up_date::timestamp AT TIME ZONE 'Asia/Dubai' WHERE next_follow_up_at IS NULL AND suggested_follow_up_date IS NOT NULL`;
      await sql`UPDATE leads SET captured_at=created_at WHERE captured_at IS NULL`;
      await sql`ALTER TABLE leads ALTER COLUMN captured_at SET DEFAULT NOW()`;
      await sql`ALTER TABLE leads ALTER COLUMN captured_at SET NOT NULL`;
      await sql`UPDATE leads SET qualification_status='completed', qualification_source=COALESCE(qualification_source, 'legacy'),
        qualified_at=COALESCE(qualified_at, created_at) WHERE qualification_summary IS NOT NULL AND qualification_status='pending'`;
      await sql`CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS leads_temperature_idx ON leads (temperature)`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS leads_submission_id_idx ON leads (submission_id) WHERE submission_id IS NOT NULL`;
      await sql`CREATE INDEX IF NOT EXISTS leads_qualification_status_idx ON leads (qualification_status)`;
      await sql`CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status)`;
      await sql`CREATE INDEX IF NOT EXISTS leads_assigned_to_idx ON leads (assigned_to)`;
      await sql`CREATE INDEX IF NOT EXISTS leads_next_follow_up_at_idx ON leads (next_follow_up_at)`;
    })();
  }
  return initialized;
}

export async function ensureEventSchema() {
  if (!eventInitialized) {
    const sql = database();
    eventInitialized = (async () => {
      await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
      await sql`CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
        venue TEXT NOT NULL, timezone TEXT NOT NULL DEFAULT 'Asia/Dubai', starts_on DATE NOT NULL,
        ends_on DATE NOT NULL, default_slot_capacity INTEGER NOT NULL DEFAULT 4 CHECK(default_slot_capacity > 0),
        active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS event_slots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), event_id UUID NOT NULL REFERENCES events(id),
        starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL, capacity INTEGER NOT NULL DEFAULT 4 CHECK(capacity > 0),
        booked_count INTEGER NOT NULL DEFAULT 0 CHECK(booked_count >= 0 AND booked_count <= capacity), active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(event_id, starts_at)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS event_rsvps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), event_id UUID NOT NULL REFERENCES events(id), idempotency_key UUID NOT NULL,
        full_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT, purpose TEXT, budget TEXT, property_type TEXT,
        preferred_area TEXT, purchase_timeline TEXT, owns_uae_property TEXT, payment_method TEXT,
        preferred_event_date DATE NOT NULL, preferred_slot UUID REFERENCES event_slots(id), confirmed_slot UUID REFERENCES event_slots(id),
        additional_requirements TEXT, consent BOOLEAN NOT NULL, status TEXT NOT NULL DEFAULT 'new',
        assigned_to TEXT NOT NULL DEFAULT '', lead_score INTEGER NOT NULL DEFAULT 0 CHECK(lead_score BETWEEN 0 AND 100),
        temperature TEXT NOT NULL DEFAULT 'Cold', qualification_summary TEXT, next_action TEXT, suggested_call_opener TEXT,
        personalised_whatsapp_invitation TEXT, appointment_confirmation_message TEXT, reminder_message TEXT,
        no_show_follow_up_message TEXT, qualification_status TEXT NOT NULL DEFAULT 'pending', qualification_source TEXT,
        source TEXT NOT NULL DEFAULT 'open-house', utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, referrer TEXT,
        attendance_status TEXT, lost_reason TEXT, last_contacted_at TIMESTAMPTZ, next_follow_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(event_id,idempotency_key)
      )`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS idempotency_key UUID`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS full_name TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS phone TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS email TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS purpose TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS budget TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS property_type TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS preferred_area TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS purchase_timeline TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS owns_uae_property TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS payment_method TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS preferred_event_date DATE`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS preferred_slot UUID REFERENCES event_slots(id)`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS confirmed_slot UUID REFERENCES event_slots(id)`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS additional_requirements TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS consent BOOLEAN`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new'`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS assigned_to TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS lead_score INTEGER NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS temperature TEXT NOT NULL DEFAULT 'Cold'`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS qualification_summary TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS next_action TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS suggested_call_opener TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS personalised_whatsapp_invitation TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS appointment_confirmation_message TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS reminder_message TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS no_show_follow_up_message TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS qualification_status TEXT NOT NULL DEFAULT 'pending'`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS qualification_source TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'open-house'`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS utm_source TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS utm_medium TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS utm_campaign TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS referrer TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS attendance_status TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS lost_reason TEXT`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS event_rsvps_phone_unique ON event_rsvps(event_id, phone)`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS event_rsvps_email_unique ON event_rsvps(event_id, lower(email)) WHERE email IS NOT NULL AND email <> ''`;
      await sql`CREATE INDEX IF NOT EXISTS event_rsvps_pipeline_idx ON event_rsvps(event_id,status,created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS event_rsvps_followup_idx ON event_rsvps(next_follow_up_at)`;
      await sql`CREATE TABLE IF NOT EXISTS event_rsvp_activity (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(), rsvp_id UUID NOT NULL REFERENCES event_rsvps(id) ON DELETE CASCADE,
        activity_type TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}', created_by TEXT NOT NULL DEFAULT 'system',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS event_analytics (
        id BIGSERIAL PRIMARY KEY, event_id UUID REFERENCES events(id), metric TEXT NOT NULL,
        rsvp_id UUID REFERENCES event_rsvps(id), source TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`INSERT INTO events(slug,name,venue,starts_on,ends_on,default_slot_capacity)
        VALUES('dubai-open-house-august-2026','Finding Stories Dubai Open House','Shangri-La Hotel, near Financial Centre Metro Station, Dubai','2026-08-08','2026-08-09',4)
        ON CONFLICT(slug) DO UPDATE SET name=EXCLUDED.name, venue=EXCLUDED.venue`;
      await sql`INSERT INTO event_slots(event_id,starts_at,ends_at,capacity)
        SELECT e.id, (d + t)::timestamp AT TIME ZONE 'Asia/Dubai', (d + t + interval '30 minutes')::timestamp AT TIME ZONE 'Asia/Dubai', e.default_slot_capacity
        FROM events e CROSS JOIN (VALUES(DATE '2026-08-08'),(DATE '2026-08-09')) dates(d)
        CROSS JOIN generate_series(TIME '10:00', TIME '18:30', INTERVAL '30 minutes') times(t)
        WHERE e.slug='dubai-open-house-august-2026' ON CONFLICT(event_id,starts_at) DO NOTHING`;
      await sql`CREATE OR REPLACE FUNCTION confirm_event_slot(p_rsvp UUID, p_slot UUID, p_actor TEXT DEFAULT 'admin') RETURNS BOOLEAN
        LANGUAGE plpgsql AS $$
        DECLARE old_slot UUID; available BOOLEAN;
        BEGIN
          SELECT confirmed_slot INTO old_slot FROM event_rsvps WHERE id=p_rsvp FOR UPDATE;
          IF NOT FOUND THEN RETURN FALSE; END IF;
          IF old_slot=p_slot THEN RETURN TRUE; END IF;
          UPDATE event_slots SET booked_count=booked_count+1 WHERE id=p_slot AND active AND booked_count < capacity RETURNING TRUE INTO available;
          IF NOT COALESCE(available,FALSE) THEN RETURN FALSE; END IF;
          IF old_slot IS NOT NULL THEN UPDATE event_slots SET booked_count=GREATEST(0,booked_count-1) WHERE id=old_slot; END IF;
          UPDATE event_rsvps SET confirmed_slot=p_slot,status='confirmed',updated_at=NOW(),
            next_follow_up_at=(SELECT starts_at-INTERVAL '24 hours' FROM event_slots WHERE id=p_slot) WHERE id=p_rsvp;
          INSERT INTO event_rsvp_activity(rsvp_id,activity_type,details,created_by)
            VALUES(p_rsvp,CASE WHEN old_slot IS NULL THEN 'appointment_confirmed' ELSE 'appointment_rescheduled' END,
            jsonb_build_object('from_slot',old_slot,'to_slot',p_slot),p_actor);
          INSERT INTO event_analytics(event_id,metric,rsvp_id,source,utm_source,utm_medium,utm_campaign)
            SELECT event_id,'appointment_confirmation',id,source,utm_source,utm_medium,utm_campaign FROM event_rsvps WHERE id=p_rsvp;
          RETURN TRUE;
        END $$`;
    })();
  }
  return eventInitialized;
}
