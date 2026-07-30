import { neon } from '@neondatabase/serverless';

let initialized;

export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  return neon(process.env.DATABASE_URL);
}

export async function ensureSchema() {
  if (!initialized) {
    const sql = database();
    initialized = (async () => {
      await sql`
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        status TEXT NOT NULL DEFAULT 'new',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads (created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS leads_temperature_idx ON leads (temperature)`;
    })();
  }
  return initialized;
}
