CREATE TABLE IF NOT EXISTS newsletter_subscribers (
 id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), email TEXT NOT NULL UNIQUE, name TEXT NOT NULL DEFAULT '', interest TEXT NOT NULL DEFAULT '', preferred_area TEXT NOT NULL DEFAULT '', audience TEXT NOT NULL DEFAULT '', consent BOOLEAN NOT NULL CHECK(consent), source TEXT NOT NULL, landing_page TEXT NOT NULL DEFAULT '/', utm JSONB NOT NULL DEFAULT '{}'::jsonb,
 status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK(status IN ('CONFIRMED','SUPPRESSED')), unsubscribe_token_hash TEXT NOT NULL UNIQUE, subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), unsubscribed_at TIMESTAMPTZ, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS newsletter_subscribers_status_idx ON newsletter_subscribers(status);
