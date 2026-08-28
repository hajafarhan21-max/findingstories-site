import { neon } from '@neondatabase/serverless';

let initialized;
let eventInitialized;
let sqlClient;
let sqlClientUrl;

const RETRYABLE_DDL_CODES = new Set(['42P07', '42710']);

function schemaError(error, phase, statementId) {
  if (error && typeof error === 'object') {
    error.schemaPhase = phase;
    error.statementId = statementId;
  }
  return error;
}

async function runPhase(phase, statementId, operation, { tolerateConcurrentDdl = false } = {}) {
  try {
    return await operation();
  } catch (error) {
    if (tolerateConcurrentDdl && RETRYABLE_DDL_CODES.has(error?.code)) return undefined;
    throw schemaError(error, phase, statementId);
  }
}

export function databaseUrl(env = process.env) {
  const configured = env.VERCEL_ENV === 'production'
    ? env.PRODUCTION_DATABASE_URL || env.DATABASE_URL
    : env.DATABASE_URL || env.PRODUCTION_DATABASE_URL;
  return configured?.trim();
}

export function neonConnectionUrl(env = process.env) {
  const configured = databaseUrl(env);
  if (!configured) return undefined;

  let parsed;
  try { parsed = new URL(configured); }
  catch { throw Object.assign(new Error('Invalid database configuration'), { diagnostic: 'connection_failed' }); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || !parsed.username) {
    throw Object.assign(new Error('Invalid database configuration'), { diagnostic: 'connection_failed' });
  }

  // Neon supports both pooled and direct endpoints over its serverless driver.
  // Require TLS even when an accidentally incomplete URL was pasted into Vercel.
  parsed.searchParams.set('sslmode', 'require');
  return parsed.toString();
}

export function database() {
  const connectionString = neonConnectionUrl();
  if (!connectionString) throw new Error('Database is not configured');
  if (sqlClientUrl !== connectionString) {
    sqlClient = neon(connectionString);
    sqlClientUrl = connectionString;
  }
  return sqlClient;
}

export async function initializeSchema(sql) {
  await runPhase('leads', 'create_leads_table', () => sql`
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
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
        is_test BOOLEAN NOT NULL DEFAULT FALSE, ai_recommendation JSONB, ai_recommendation_fingerprint TEXT,
        ai_recommended_at TIMESTAMPTZ, ai_reviewed_at TIMESTAMPTZ, ai_dismissed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`, { tolerateConcurrentDdl: true });
  await runPhase('leads', 'alter_leads_columns', async () => {
    // A legacy table may predate any of the current capture fields. Keep every
    // addition nullable or give it a population-safe default.
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS id UUID DEFAULT pg_catalog.gen_random_uuid()`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS name TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS email TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS country_of_residence TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS purpose TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS budget TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_type TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS bedrooms TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_areas TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS payment_method TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS purchase_timeline TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS owns_uae_property TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS additional_requirements TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS consent BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'website'`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS landing_page TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS referrer TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_medium TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_campaign TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS content_source TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS temperature TEXT DEFAULT 'Cold'`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification_summary TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS requirement_summary TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS missing_information JSONB DEFAULT '[]'`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_action TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS suggested_follow_up_date DATE`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_follow_up_draft TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_opener TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new'`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`;
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
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_recommendation JSONB`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_recommendation_fingerprint TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_recommended_at TIMESTAMPTZ`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_reviewed_at TIMESTAMPTZ`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_dismissed_at TIMESTAMPTZ`;
    await sql`UPDATE leads SET next_follow_up_at=suggested_follow_up_date::timestamp AT TIME ZONE 'Asia/Dubai' WHERE next_follow_up_at IS NULL AND suggested_follow_up_date IS NOT NULL`;
    await sql`UPDATE leads SET captured_at=COALESCE(created_at, NOW()) WHERE captured_at IS NULL`;
    await sql`ALTER TABLE leads ALTER COLUMN captured_at SET DEFAULT NOW()`;
    await sql`ALTER TABLE leads ALTER COLUMN captured_at SET NOT NULL`;
    await sql`UPDATE leads SET qualification_status='completed', qualification_source=COALESCE(qualification_source, 'legacy'), qualified_at=COALESCE(qualified_at, created_at) WHERE qualification_summary IS NOT NULL AND qualification_status='pending'`;
  });
  await runPhase('leads', 'create_leads_indexes', async () => {
    await sql`CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS leads_temperature_idx ON leads (temperature)`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS leads_submission_id_idx ON leads (submission_id) WHERE submission_id IS NOT NULL`;
    await sql`CREATE INDEX IF NOT EXISTS leads_qualification_status_idx ON leads (qualification_status)`;
    await sql`CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status)`;
    await sql`CREATE INDEX IF NOT EXISTS leads_assigned_to_idx ON leads (assigned_to)`;
    await sql`CREATE INDEX IF NOT EXISTS leads_next_follow_up_at_idx ON leads (next_follow_up_at)`;
  }, { tolerateConcurrentDdl: true });
  await runPhase('revenue', 'create_follow_up_executions', async () => {
    await sql`CREATE TABLE IF NOT EXISTS follow_up_executions (
      id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), lead_id UUID NOT NULL REFERENCES leads(id),
      recommendation_id TEXT NOT NULL, advisor TEXT NOT NULL DEFAULT '', action_type TEXT NOT NULL,
      original_ai_draft TEXT NOT NULL DEFAULT '', advisor_edited_draft TEXT NOT NULL DEFAULT '',
      approval_status TEXT NOT NULL DEFAULT 'pending', approved_at TIMESTAMPTZ,
      execution_status TEXT NOT NULL DEFAULT 'pending', completed_at TIMESTAMPTZ, outcome TEXT NOT NULL DEFAULT '',
      next_follow_up TIMESTAMPTZ, snoozed_until TIMESTAMPTZ, dismissal_reason TEXT NOT NULL DEFAULT '',
      is_test BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS follow_up_execution_active_unique ON follow_up_executions (lead_id,recommendation_id,action_type)
      WHERE execution_status NOT IN ('dismissed','completed')`;
    await sql`CREATE INDEX IF NOT EXISTS follow_up_execution_due_idx ON follow_up_executions(next_follow_up)`;
  }, { tolerateConcurrentDdl: true });
  await runPhase('revenue', 'create_property_matching', async () => {
    await sql`CREATE TABLE IF NOT EXISTS property_inventory (
      id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), unit TEXT, developer TEXT NOT NULL, project TEXT NOT NULL,
      emirate TEXT NOT NULL, area TEXT NOT NULL, property_type TEXT NOT NULL, bedrooms TEXT NOT NULL,
      minimum_price NUMERIC, maximum_price NUMERIC, minimum_size NUMERIC, maximum_size NUMERIC, price_per_sqft NUMERIC,
      handover DATE, payment_plan_summary TEXT, construction_status TEXT NOT NULL, suitability TEXT,
      status TEXT NOT NULL DEFAULT 'active', source TEXT NOT NULL, data_quality TEXT NOT NULL CHECK (data_quality IN ('verified','advisory')),
      last_updated TIMESTAMPTZ NOT NULL, is_test BOOLEAN NOT NULL DEFAULT FALSE, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await sql`ALTER TABLE property_inventory ADD COLUMN IF NOT EXISTS unit TEXT`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS property_inventory_unit_unique ON property_inventory(unit) WHERE unit IS NOT NULL`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS attributed_revenue NUMERIC CHECK (attributed_revenue IS NULL OR attributed_revenue >= 0)`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS revenue_currency TEXT CHECK (revenue_currency IS NULL OR revenue_currency = 'AED')`;
    await sql`CREATE TABLE IF NOT EXISTS property_recommendations (
      id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), lead_id UUID NOT NULL REFERENCES leads(id), fingerprint TEXT NOT NULL,
      requirement_profile JSONB NOT NULL, ranked_matches JSONB NOT NULL, opportunity_flags JSONB NOT NULL DEFAULT '[]',
      advisor_status TEXT NOT NULL DEFAULT 'pending', outcome TEXT NOT NULL DEFAULT '', reviewed_at TIMESTAMPTZ,
      is_test BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(lead_id,fingerprint))`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS property_recommendation_fingerprint TEXT`;
    await sql`CREATE INDEX IF NOT EXISTS property_inventory_match_idx ON property_inventory(status,is_test,emirate,property_type,bedrooms)`;
    await sql`CREATE INDEX IF NOT EXISTS property_recommendations_lead_idx ON property_recommendations(lead_id,created_at DESC)`;
  }, { tolerateConcurrentDdl: true });
  await runPhase('acquisition', 'create_acquisition', async () => {
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS page_type TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS acquisition_area TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS acquisition_project TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS acquisition_developer TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS budget_intent TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS bedroom_intent TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS acquisition_signals JSONB NOT NULL DEFAULT '[]'`;
    await sql`CREATE TABLE IF NOT EXISTS acquisition_events (id BIGSERIAL PRIMARY KEY,event_key UUID NOT NULL UNIQUE,visitor_id UUID NOT NULL,event_type TEXT NOT NULL CHECK(event_type IN ('page_view','repeated_visit','property_comparison','payment_plan_interest','whatsapp_click','meeting_request','site_visit_request')),page_url TEXT NOT NULL,page_type TEXT,area TEXT,project TEXT,developer TEXT,source TEXT,referrer TEXT,utm_source TEXT,utm_medium TEXT,utm_campaign TEXT,is_test BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
    await sql`CREATE INDEX IF NOT EXISTS acquisition_events_page_idx ON acquisition_events(is_test,page_url,created_at DESC)`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS search_query TEXT`;
    await sql`CREATE TABLE IF NOT EXISTS search_console_snapshots (id BIGSERIAL PRIMARY KEY,fingerprint TEXT NOT NULL UNIQUE,query TEXT NOT NULL,page TEXT NOT NULL,clicks INTEGER NOT NULL CHECK(clicks>=0),impressions INTEGER NOT NULL CHECK(impressions>=clicks),ctr NUMERIC NOT NULL CHECK(ctr BETWEEN 0 AND 1),average_position NUMERIC NOT NULL CHECK(average_position>=0),metric_date DATE NOT NULL,device TEXT,country TEXT,report_start DATE NOT NULL,report_end DATE NOT NULL,source TEXT NOT NULL CHECK(source='google_search_console'),environment TEXT NOT NULL,is_test BOOLEAN NOT NULL DEFAULT FALSE,ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CHECK(is_test=(environment='test')))`;
    await sql`CREATE INDEX IF NOT EXISTS search_console_reporting_idx ON search_console_snapshots(is_test,metric_date DESC,page)`;
    await sql`CREATE TABLE IF NOT EXISTS seo_growth_actions (id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),recommendation_id TEXT NOT NULL,opportunity_type TEXT NOT NULL,query TEXT NOT NULL,target_page TEXT NOT NULL,action_type TEXT NOT NULL,recommendation JSONB NOT NULL,status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','dismissed','snoozed','reviewed')),snoozed_until TIMESTAMPTZ,reviewed_by TEXT NOT NULL DEFAULT 'admin',reviewed_at TIMESTAMPTZ,is_test BOOLEAN NOT NULL DEFAULT FALSE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(recommendation_id,is_test))`;
  }, { tolerateConcurrentDdl: true });
}

export async function ensureSchema() {
  if (!initialized) {
    const sql = database();
    initialized = initializeSchema(sql).catch(error => { initialized = undefined; throw error; });
    // One shared promise prevents duplicate work inside a warm serverless instance.
  }
  return initialized;
}

export async function ensureTestEvent(sql = database()) {
  await sql`INSERT INTO events(slug,name,venue,address,timezone,starts_on,ends_on,opening_time,closing_time,
        slot_duration_minutes,default_slot_capacity,status,active,is_test,developers_projects,public_description)
        SELECT 'finding-stories-system-test-'||to_char(dubai_today,'YYYYMMDD'),'Finding Stories System Test Event','Finding Stories Test Venue','Dubai, UAE',
        'Asia/Dubai',dubai_today+1,dubai_today+2,TIME '10:00',TIME '19:00',30,5,'TEST',TRUE,TRUE,
        'Test developer / test project','TEST MODE — synthetic RSVP workflow validation only.'
        FROM (SELECT (NOW() AT TIME ZONE 'Asia/Dubai')::date dubai_today) clock
        WHERE NOT EXISTS (SELECT 1 FROM events WHERE is_test AND active AND status='TEST'
          AND ends_on>=dubai_today AND EXISTS (SELECT 1 FROM event_slots s WHERE s.event_id=events.id AND s.active
            AND s.starts_at>NOW() AND s.booked_count<s.capacity))
        ON CONFLICT(slug) DO NOTHING`;
  await sql`INSERT INTO event_slots(event_id,starts_at,ends_at,capacity)
        SELECT e.id,(e.starts_on+day_number+e.opening_time+n*make_interval(mins=>e.slot_duration_minutes))::timestamp AT TIME ZONE e.timezone,
        (e.starts_on+day_number+e.opening_time+(n+1)*make_interval(mins=>e.slot_duration_minutes))::timestamp AT TIME ZONE e.timezone,e.default_slot_capacity
        FROM events e CROSS JOIN LATERAL generate_series(0,e.ends_on-e.starts_on) event_days(day_number)
        CROSS JOIN LATERAL generate_series(0,GREATEST(0,FLOOR(EXTRACT(EPOCH FROM (e.closing_time-e.opening_time))/60/e.slot_duration_minutes)::int-1)) numbers(n)
        WHERE e.is_test AND e.active AND e.status='TEST'
          AND e.ends_on >= (NOW() AT TIME ZONE e.timezone)::date
        ON CONFLICT(event_id,starts_at) DO NOTHING`;
}

export async function initializeEventSchema(sql) {
  await runPhase('events', 'create_event_tables', async () => {
      await sql`CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
        venue TEXT NOT NULL, timezone TEXT NOT NULL DEFAULT 'Asia/Dubai', starts_on DATE NOT NULL,
        ends_on DATE NOT NULL, default_slot_capacity INTEGER NOT NULL DEFAULT 4 CHECK(default_slot_capacity > 0),
        active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS event_slots (
        id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), event_id UUID NOT NULL REFERENCES events(id),
        starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL, capacity INTEGER NOT NULL DEFAULT 4 CHECK(capacity > 0),
        booked_count INTEGER NOT NULL DEFAULT 0 CHECK(booked_count >= 0 AND booked_count <= capacity), active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(event_id, starts_at)
      )`;
      await sql`CREATE TABLE IF NOT EXISTS event_rsvps (
        id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), event_id UUID NOT NULL REFERENCES events(id), idempotency_key UUID NOT NULL,
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
  });
  await runPhase('events', 'alter_event_columns', async () => {
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS slug TEXT`;
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS name TEXT`;
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS venue TEXT`;
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Dubai'`;
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS starts_on DATE`;
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS ends_on DATE`;
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS default_slot_capacity INTEGER DEFAULT 4`;
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE`;
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`;
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS address TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS opening_time TIME NOT NULL DEFAULT TIME '10:00'`;
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS closing_time TIME NOT NULL DEFAULT TIME '19:00'`;
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS slot_duration_minutes INTEGER NOT NULL DEFAULT 30`;
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'OPEN'`;
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS developers_projects TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS public_description TEXT NOT NULL DEFAULT ''`;
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE`;
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;
      await sql`ALTER TABLE event_slots ADD COLUMN IF NOT EXISTS event_id UUID`;
      await sql`ALTER TABLE event_slots ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ`;
      await sql`ALTER TABLE event_slots ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ`;
      await sql`ALTER TABLE event_slots ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 4`;
      await sql`ALTER TABLE event_slots ADD COLUMN IF NOT EXISTS booked_count INTEGER DEFAULT 0`;
      await sql`ALTER TABLE event_slots ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE`;
      await sql`ALTER TABLE event_slots ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS event_id UUID`;
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
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE`;
      await sql`ALTER TABLE event_rsvps ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`;
      // Historical imports can legitimately contain duplicate contact details.
      // Lookup indexes preserve every row and avoid making startup depend on
      // retroactively enforcing uniqueness. New submissions deduplicate in the
      // application using the event/idempotency key.
  });
  await runPhase('events', 'create_event_indexes', async () => {
      await sql`CREATE INDEX IF NOT EXISTS event_rsvps_phone_lookup_idx ON event_rsvps(event_id, phone)`;
      await sql`CREATE INDEX IF NOT EXISTS event_rsvps_email_lookup_idx ON event_rsvps(event_id, lower(email)) WHERE email IS NOT NULL AND email <> ''`;
      await sql`CREATE INDEX IF NOT EXISTS event_rsvps_pipeline_idx ON event_rsvps(event_id,status,created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS event_rsvps_followup_idx ON event_rsvps(next_follow_up_at)`;
      await sql`CREATE INDEX IF NOT EXISTS events_public_lookup_idx ON events(active,ends_on,status)`;
      await sql`CREATE INDEX IF NOT EXISTS event_rsvps_test_lookup_idx ON event_rsvps(event_id,is_test,archived_at)`;
  }, { tolerateConcurrentDdl: true });
  await runPhase('events', 'create_event_tables', async () => {
      await sql`CREATE TABLE IF NOT EXISTS event_rsvp_activity (
        id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), rsvp_id UUID NOT NULL REFERENCES event_rsvps(id) ON DELETE CASCADE,
        activity_type TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}', created_by TEXT NOT NULL DEFAULT 'system',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS event_analytics (
        id BIGSERIAL PRIMARY KEY, event_id UUID REFERENCES events(id), metric TEXT NOT NULL,
        rsvp_id UUID REFERENCES event_rsvps(id), source TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
  });
  await runPhase('events', 'seed_event_data', () => ensureTestEvent(sql));
      await runPhase('events', 'create_confirm_event_slot_function', () => sql`CREATE OR REPLACE FUNCTION confirm_event_slot(p_rsvp UUID, p_slot UUID, p_actor TEXT DEFAULT 'admin') RETURNS BOOLEAN
        LANGUAGE plpgsql AS $$
        DECLARE old_slot UUID; rsvp_event UUID; available BOOLEAN;
        BEGIN
          SELECT confirmed_slot,event_id INTO old_slot,rsvp_event FROM event_rsvps WHERE id=p_rsvp FOR UPDATE;
          IF NOT FOUND THEN RETURN FALSE; END IF;
          IF old_slot=p_slot THEN RETURN TRUE; END IF;
          UPDATE event_slots SET booked_count=booked_count+1 WHERE id=p_slot AND event_id=rsvp_event AND active AND starts_at>NOW() AND booked_count < capacity RETURNING TRUE INTO available;
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
        END $$`);
}

export async function ensureEventSchema() {
  if (!eventInitialized) {
    eventInitialized = initializeEventSchema(database()).catch(error => { eventInitialized = undefined; throw error; });
  }
  return eventInitialized;
}
