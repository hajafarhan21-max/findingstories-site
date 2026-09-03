import { authorize } from '../crm-access.js';
import { json,method } from '../http.js';

const number=value=>Number(value||0);
export default async function launch(req,res){
 if(!method(req,res,['GET']))return;
 const access=await authorize(req,res,'reports','view');if(!access)return;
 const campaignId=String(req.query?.campaign_id||'').trim();
 const campaigns=await access.sql`SELECT c.id,c.name,c.status,c.target_eois,c.starts_at,c.launches_at,c.ends_at,p.name project_name
   FROM launch_campaigns c LEFT JOIN launch_projects p ON p.id=c.project_id
   WHERE c.is_test=FALSE AND (${campaignId}='' OR c.id::text=${campaignId})
   ORDER BY (c.status='active') DESC,c.launches_at ASC NULLS LAST,c.created_at DESC LIMIT 25`;
 if(!campaigns.length)return json(res,200,{campaigns:[],selected:null,metrics:null,source_performance:[],landing_page_performance:[],notice:'No production launch campaign exists. No values have been fabricated.'});
 const selected=campaigns[0];
 const scope=access.visibleIds;
 const ownerIds=scope===null?[]:scope;
 const rows=await access.sql`WITH attributed AS (
   SELECT a.*,l.captured_at,l.qualified_at,l.meeting_at,l.source lead_source,l.landing_page lead_landing_page
   FROM launch_lead_attribution a JOIN leads l ON l.id=a.lead_id
   WHERE a.campaign_id=${selected.id} AND a.is_test=FALSE AND l.is_test=FALSE
     AND (${scope===null} OR a.owner_id=ANY(${ownerIds}::uuid[]) OR a.owner_id IS NULL)
 ), eois AS (
   SELECT e.* FROM launch_eois e JOIN leads l ON l.id=e.lead_id
   WHERE e.campaign_id=${selected.id} AND e.is_test=FALSE AND l.is_test=FALSE
     AND (${scope===null} OR e.owner_id=ANY(${ownerIds}::uuid[]) OR e.owner_id IS NULL)
 ) SELECT
   (SELECT COUNT(*) FROM attributed WHERE COALESCE(source,lead_source)='organic')::int organic_enquiries,
   (SELECT COUNT(*) FROM attributed WHERE lead_priority='HOT')::int qualified_hot_leads,
   (SELECT COUNT(*) FROM attributed WHERE call_ready)::int call_ready_leads,
   (SELECT COUNT(*) FROM attributed WHERE owner_id IS NULL AND lead_priority='HOT')::int unassigned_hot_leads,
   (SELECT COUNT(*) FROM attributed WHERE follow_up_state='due')::int advisor_follow_ups_due,
   (SELECT COUNT(*) FROM eois WHERE status='completed')::int eois_completed,
   (SELECT COUNT(*) FROM eois WHERE status IN ('payment_link_sent','payment_pending'))::int eois_pending_payment,
   (SELECT COUNT(*) FROM eois WHERE payment_link_status='sent')::int payment_links_sent,
   (SELECT AVG(EXTRACT(EPOCH FROM(first_response_at-captured_at))/60) FROM attributed WHERE first_response_at IS NOT NULL)::float lead_response_minutes,
   (SELECT COUNT(*) FROM attributed WHERE qualified_at IS NOT NULL)::int qualified,
   (SELECT COUNT(*) FROM attributed WHERE qualified_at IS NOT NULL AND COALESCE(source,lead_source)='organic')::int organic_qualified,
   (SELECT COUNT(DISTINCT h.lead_id) FROM launch_funnel_history h JOIN attributed a ON a.lead_id=h.lead_id
      WHERE h.campaign_id=${selected.id} AND h.is_test=FALSE AND h.event_type='advisor_call_completed')::int calls,
   (SELECT COUNT(*) FROM eois)::int total_eois`;
 const m=rows[0];const now=Date.now(),launchAt=selected.launches_at?new Date(selected.launches_at).getTime():null;
 const remaining=Math.max(0,number(selected.target_eois)-number(m.eois_completed));
 const hours=launchAt===null?null:Math.max(0,(launchAt-now)/36e5);const days=hours===null?null:Math.max(1,Math.ceil(hours/24));
 const sourcePerformance=await access.sql`SELECT COALESCE(a.source,'unknown') name,COUNT(DISTINCT a.id)::int enquiries,
   COUNT(DISTINCT a.id) FILTER(WHERE a.qualified_at IS NOT NULL)::int qualified,COUNT(DISTINCT e.id)::int eois
   FROM (SELECT x.*,l.qualified_at FROM launch_lead_attribution x JOIN leads l ON l.id=x.lead_id WHERE x.campaign_id=${selected.id} AND x.is_test=FALSE AND l.is_test=FALSE
     AND (${scope===null} OR x.owner_id=ANY(${ownerIds}::uuid[]) OR x.owner_id IS NULL)) a
   LEFT JOIN launch_eois e ON e.lead_id=a.lead_id AND e.campaign_id=a.campaign_id AND e.is_test=FALSE
     AND (${scope===null} OR e.owner_id=ANY(${ownerIds}::uuid[]) OR e.owner_id IS NULL) GROUP BY 1 ORDER BY enquiries DESC`;
 const landingPerformance=await access.sql`SELECT COALESCE(a.landing_page,'unknown') name,COUNT(DISTINCT a.id)::int enquiries,
   COUNT(DISTINCT a.id) FILTER(WHERE a.qualified_at IS NOT NULL)::int qualified,COUNT(DISTINCT e.id)::int eois
   FROM (SELECT x.*,l.qualified_at FROM launch_lead_attribution x JOIN leads l ON l.id=x.lead_id WHERE x.campaign_id=${selected.id} AND x.is_test=FALSE AND l.is_test=FALSE
     AND (${scope===null} OR x.owner_id=ANY(${ownerIds}::uuid[]) OR x.owner_id IS NULL)) a
   LEFT JOIN launch_eois e ON e.lead_id=a.lead_id AND e.campaign_id=a.campaign_id AND e.is_test=FALSE
     AND (${scope===null} OR e.owner_id=ANY(${ownerIds}::uuid[]) OR e.owner_id IS NULL) GROUP BY 1 ORDER BY enquiries DESC`;
 return json(res,200,{campaigns,selected,metrics:{target_eois:number(selected.target_eois),...m,remaining_eois:remaining,hours_to_launch:hours,daily_pace_required:days?remaining/days:null,organic_to_qualified_conversion:number(m.organic_enquiries)?number(m.organic_qualified)/number(m.organic_enquiries):null,qualified_to_call_conversion:number(m.qualified)?number(m.calls)/number(m.qualified):null,call_to_eoi_conversion:number(m.calls)?number(m.total_eois)/number(m.calls):null},source_performance:sourcePerformance,landing_page_performance:landingPerformance});
}
