CREATE TABLE IF NOT EXISTS follow_up_executions (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(), lead_id UUID NOT NULL REFERENCES leads(id),
  recommendation_id TEXT NOT NULL, advisor TEXT NOT NULL DEFAULT '', action_type TEXT NOT NULL,
  original_ai_draft TEXT NOT NULL DEFAULT '', advisor_edited_draft TEXT NOT NULL DEFAULT '',
  approval_status TEXT NOT NULL DEFAULT 'pending', approved_at TIMESTAMPTZ,
  execution_status TEXT NOT NULL DEFAULT 'pending', completed_at TIMESTAMPTZ, outcome TEXT NOT NULL DEFAULT '',
  next_follow_up TIMESTAMPTZ, snoozed_until TIMESTAMPTZ, dismissal_reason TEXT NOT NULL DEFAULT '',
  is_test BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS follow_up_execution_active_unique ON follow_up_executions (lead_id,recommendation_id,action_type)
  WHERE execution_status NOT IN ('dismissed','completed');
CREATE INDEX IF NOT EXISTS follow_up_execution_due_idx ON follow_up_executions(next_follow_up);
