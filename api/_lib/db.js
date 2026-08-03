import { neon } from '@neondatabase/serverless';

let initialized;

export function databaseUrl(env = process.env) {
  return env.DATABASE_URL || env.PRODUCTION_DATABASE_URL;
}

export function database() {
  const connectionString = databaseUrl();
  if (!connectionString) throw new Error('Database is not configured');
  return neon(connectionString);
}

export async function ensureSchema() {
  if (!initialized) {
    const sql = database();
    initialized = (async () => {
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
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS submission_id UUID`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification_status TEXT NOT NULL DEFAULT 'pending'`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification_source TEXT`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualification_started_at TIMESTAMPTZ`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ`;
      await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ`;
      await sql`UPDATE leads SET captured_at=created_at WHERE captured_at IS NULL`;
      await sql`ALTER TABLE leads ALTER COLUMN captured_at SET DEFAULT NOW()`;
      await sql`ALTER TABLE leads ALTER COLUMN captured_at SET NOT NULL`;
      await sql`UPDATE leads SET qualification_status='completed', qualification_source=COALESCE(qualification_source, 'legacy'),
        qualified_at=COALESCE(qualified_at, created_at) WHERE qualification_summary IS NOT NULL AND qualification_status='pending'`;
      await sql`CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS leads_temperature_idx ON leads (temperature)`;
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS leads_submission_id_idx ON leads (submission_id) WHERE submission_id IS NOT NULL`;
      await sql`CREATE INDEX IF NOT EXISTS leads_qualification_status_idx ON leads (qualification_status)`;
    })();
  }
  return initialized;
}
