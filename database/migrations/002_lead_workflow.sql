-- Phase 2A: additive and safe to run repeatedly. Existing rows are never removed.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_to TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS agent_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS meeting_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS site_visit_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE leads SET next_follow_up_at=suggested_follow_up_date::timestamp AT TIME ZONE 'Asia/Dubai'
WHERE next_follow_up_at IS NULL AND suggested_follow_up_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);
CREATE INDEX IF NOT EXISTS leads_assigned_to_idx ON leads (assigned_to);
CREATE INDEX IF NOT EXISTS leads_next_follow_up_at_idx ON leads (next_follow_up_at);
