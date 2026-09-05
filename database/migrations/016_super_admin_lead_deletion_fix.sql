-- Supersedes 012. Idempotent and non-destructive: installing this migration deletes no data.
-- Repository FK audit (direct): follow_up_executions, property_recommendations,
-- crm_opportunities, crm_tasks, crm_activities, launch_lead_attribution,
-- launch_eois and launch_funnel_history. Indirect opportunity/EOI children are
-- removed first. Shared projects, campaigns, inventory and users are never deleted.
CREATE OR REPLACE FUNCTION delete_crm_leads(p_ids JSONB, p_actor UUID, p_ip TEXT DEFAULT NULL)
RETURNS TABLE(lead_id UUID, deleted BOOLEAN, reason TEXT)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  requested UUID; actor_role TEXT; affected INTEGER; requested_count INTEGER;
  blocker_table TEXT; blocker_constraint TEXT;
  lead_before JSONB;
BEGIN
  SELECT role INTO actor_role FROM crm_users WHERE id=p_actor AND active=TRUE;
  IF actor_role IS DISTINCT FROM 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'SUPER_ADMIN role required' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_ids) IS DISTINCT FROM 'array' OR jsonb_array_length(p_ids) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION '1-500 lead ids required' USING ERRCODE='22023';
  END IF;
  requested_count := jsonb_array_length(p_ids);

  -- Any unreviewed FK is left intact; PostgreSQL identifies its exact table and
  -- constraint in the per-lead foreign_key_violation handler below.

  FOR requested IN SELECT DISTINCT value::uuid FROM jsonb_array_elements_text(p_ids)
  LOOP
    BEGIN
      SELECT to_jsonb(l) INTO lead_before FROM leads l WHERE l.id=requested FOR UPDATE;
      IF NOT FOUND THEN
        lead_id:=requested; deleted:=FALSE; reason:='Lead not found.'; RETURN NEXT; CONTINUE;
      END IF;


      DELETE FROM launch_funnel_history h WHERE h.lead_id=requested OR h.eoi_id IN (SELECT e.id FROM launch_eois e WHERE e.lead_id=requested);
      DELETE FROM crm_tasks t WHERE t.lead_id=requested OR t.opportunity_id IN (SELECT o.id FROM crm_opportunities o WHERE o.lead_id=requested);
      DELETE FROM crm_activities a WHERE a.lead_id=requested OR a.opportunity_id IN (SELECT o.id FROM crm_opportunities o WHERE o.lead_id=requested);
      DELETE FROM launch_eois e WHERE e.lead_id=requested;
      DELETE FROM launch_lead_attribution a WHERE a.lead_id=requested OR a.duplicate_of_lead_id=requested;
      DELETE FROM crm_opportunities o WHERE o.lead_id=requested;
      DELETE FROM follow_up_executions f WHERE f.lead_id=requested;
      DELETE FROM property_recommendations p WHERE p.lead_id=requested;

      -- Audit has a textual entity_id, deliberately not an FK to leads. Store the
      -- immutable audit record before deletion; this statement and the deletion
      -- remain in the same per-lead subtransaction.
      INSERT INTO crm_audit_logs(actor_id,action,entity_type,entity_id,before_value,after_value,ip_address,created_at)
      VALUES(p_actor,CASE WHEN requested_count=1 THEN 'lead.delete' ELSE 'lead.bulk_delete' END,'lead',requested::text,
        lead_before - ARRAY['phone','email','agent_notes','whatsapp_follow_up_draft','call_opener'],
        jsonb_build_object('deleted_lead_id',requested,'was_test',COALESCE((lead_before->>'is_test')::boolean,FALSE)),p_ip,NOW());

      -- Explicitly selected TEST leads are intentionally eligible. Automated jobs
      -- do not call this exact-role, confirm-required function.
      DELETE FROM leads l WHERE l.id=requested;
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF affected <> 1 THEN RAISE EXCEPTION 'Lead changed during deletion'; END IF;
      lead_id:=requested; deleted:=TRUE; reason:=NULL; RETURN NEXT;
    EXCEPTION WHEN foreign_key_violation THEN
      GET STACKED DIAGNOSTICS blocker_table=TABLE_NAME, blocker_constraint=CONSTRAINT_NAME;
      lead_id:=requested; deleted:=FALSE;
      reason:=format('Deletion blocked by shared relation %s (constraint %s).',
        COALESCE(NULLIF(blocker_table,''),'unknown'),COALESCE(NULLIF(blocker_constraint,''),'unknown'));
      RETURN NEXT;
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS blocker_table=TABLE_NAME, blocker_constraint=CONSTRAINT_NAME;
      lead_id:=requested; deleted:=FALSE;
      reason:=format('Deletion failed safely%s%s.',
        CASE WHEN NULLIF(blocker_table,'') IS NULL THEN '' ELSE ' in relation '||blocker_table END,
        CASE WHEN NULLIF(blocker_constraint,'') IS NULL THEN '' ELSE ' ('||blocker_constraint||')' END);
      RETURN NEXT;
    END;
  END LOOP;
END $$;
