-- Safe, atomic-per-lead CRM deletion. No rows are deleted by this migration.
-- Only records whose foreign keys directly reference the requested lead (or its
-- directly dependent opportunities/EOIs) are removed. Shared business records
-- such as users, inventory, campaigns, projects and Search Console data remain.
CREATE OR REPLACE FUNCTION delete_crm_leads(p_ids JSONB, p_actor UUID, p_ip TEXT DEFAULT NULL)
RETURNS TABLE(lead_id UUID, deleted BOOLEAN, reason TEXT)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE requested UUID; actor_role TEXT; affected INTEGER; requested_count INTEGER;
BEGIN
  SELECT role INTO actor_role FROM crm_users WHERE id=p_actor AND active=TRUE;
  IF actor_role IS DISTINCT FROM 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'SUPER_ADMIN role required' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_ids) IS DISTINCT FROM 'array' OR jsonb_array_length(p_ids) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION '1-500 lead ids required' USING ERRCODE='22023';
  END IF;
  requested_count := jsonb_array_length(p_ids);

  FOR requested IN SELECT DISTINCT value::uuid FROM jsonb_array_elements_text(p_ids)
  LOOP
    BEGIN
      PERFORM 1 FROM leads WHERE id=requested AND is_test=FALSE FOR UPDATE;
      IF NOT FOUND THEN
        lead_id:=requested; deleted:=FALSE; reason:='Production lead not found.'; RETURN NEXT; CONTINUE;
      END IF;

      -- Remove only dependent workflow rows, ordered from children to parents.
      DELETE FROM launch_funnel_history WHERE lead_id=requested OR eoi_id IN (SELECT id FROM launch_eois WHERE lead_id=requested);
      DELETE FROM crm_tasks WHERE lead_id=requested OR opportunity_id IN (SELECT id FROM crm_opportunities WHERE lead_id=requested);
      DELETE FROM crm_activities WHERE lead_id=requested OR opportunity_id IN (SELECT id FROM crm_opportunities WHERE lead_id=requested);
      DELETE FROM launch_eois WHERE lead_id=requested;
      DELETE FROM launch_lead_attribution WHERE lead_id=requested OR duplicate_of_lead_id=requested;
      DELETE FROM crm_opportunities WHERE lead_id=requested;
      DELETE FROM follow_up_executions WHERE lead_id=requested;
      DELETE FROM property_recommendations WHERE lead_id=requested;
      DELETE FROM leads WHERE id=requested AND is_test=FALSE;
      GET DIAGNOSTICS affected = ROW_COUNT;
      IF affected <> 1 THEN RAISE EXCEPTION 'Lead changed during deletion'; END IF;

      INSERT INTO crm_audit_logs(actor_id,action,entity_type,entity_id,before_value,after_value,ip_address,created_at)
      VALUES(p_actor,CASE WHEN requested_count=1 THEN 'lead.delete' ELSE 'lead.bulk_delete' END,'lead',requested::text,
        jsonb_build_object('deleted_lead_id',requested),
        jsonb_build_object('deleted_lead_ids',jsonb_build_array(requested),'count',1),p_ip,NOW());
      lead_id:=requested; deleted:=TRUE; reason:=NULL; RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      lead_id:=requested; deleted:=FALSE; reason:='Deletion blocked by a dependent record or database constraint.'; RETURN NEXT;
    END;
  END LOOP;
END $$;

