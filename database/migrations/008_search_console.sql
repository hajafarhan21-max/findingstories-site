ALTER TABLE leads ADD COLUMN IF NOT EXISTS search_query TEXT;
CREATE TABLE IF NOT EXISTS search_console_snapshots (
 id BIGSERIAL PRIMARY KEY, fingerprint TEXT NOT NULL UNIQUE, query TEXT NOT NULL, page TEXT NOT NULL,
 clicks INTEGER NOT NULL CHECK(clicks>=0), impressions INTEGER NOT NULL CHECK(impressions>=clicks), ctr NUMERIC NOT NULL CHECK(ctr BETWEEN 0 AND 1), average_position NUMERIC NOT NULL CHECK(average_position>=0),
 metric_date DATE NOT NULL, device TEXT, country TEXT, report_start DATE NOT NULL, report_end DATE NOT NULL,
 source TEXT NOT NULL CHECK(source='google_search_console'), environment TEXT NOT NULL, is_test BOOLEAN NOT NULL DEFAULT FALSE, ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CHECK(is_test=(environment='test'))
);
CREATE INDEX IF NOT EXISTS search_console_reporting_idx ON search_console_snapshots(is_test,metric_date DESC,page);
CREATE TABLE IF NOT EXISTS seo_growth_actions (
 id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), recommendation_id TEXT NOT NULL, opportunity_type TEXT NOT NULL, query TEXT NOT NULL, target_page TEXT NOT NULL,
 action_type TEXT NOT NULL, recommendation JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','dismissed','snoozed','reviewed')),
 snoozed_until TIMESTAMPTZ, reviewed_by TEXT NOT NULL DEFAULT 'admin', reviewed_at TIMESTAMPTZ, is_test BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(recommendation_id,is_test)
);
