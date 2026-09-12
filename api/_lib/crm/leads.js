import { authorize,ownerVisible } from '../crm-access.js';
import { clientIp,json,method,parseJson } from '../http.js';
import { deletionResult,hasStrictDeleteRole,parseLeadDeletion } from './lead-deletion.js';
export default async function handler(req,res){
 if(!method(req,res,['GET','DELETE']))return;
 if(req.method==='DELETE'){
  const a=await authorize(req,res,'leads','delete',{mutation:true});if(!a)return;
  // This exact role check is intentionally in addition to the permission lookup:
  // a mistakenly granted delete permission must never authorize another role.
  if(!hasStrictDeleteRole(a.identity))return json(res,403,{error:'SUPER_ADMIN role required.'});
  let ids;try{ids=parseLeadDeletion(parseJson(req));}catch{ids=null;}
  if(!ids)return json(res,400,{error:'Explicit confirmation and 1–500 valid lead IDs are required.'});
  try {
   const rows=await a.sql`SELECT lead_id::text,deleted,reason FROM delete_crm_leads(${JSON.stringify(ids)}::jsonb,${a.identity.id},${clientIp(req)})`;
   return json(res,200,deletionResult(rows,ids));
  } catch(error){console.error('Lead deletion failed safely:',error instanceof Error?error.message:'unknown');return json(res,500,{error:'No leads were deleted. Verify the deletion migration and dependent records.'});}
 }
 const a=await authorize(req,res,'leads','view');if(!a)return;
 const rows=await a.sql`SELECT id,name,phone,email,campaign_id,project_id,conversion_type,source,medium,utm_source,utm_medium,utm_campaign,utm_content,utm_term,landing_page,referrer,first_touch_attribution,latest_touch_attribution,page_type,acquisition_area,acquisition_project,acquisition_developer,acquisition_signals,owner_id,stage,status,temperature,lead_score,assigned_to,
  qualification_status,qualification_summary,requirement_summary,next_action,property_type,budget,bedrooms,preferred_areas,purpose,purchase_timeline,preferred_contact_method,additional_requirements,last_contacted_at,next_follow_up_at,meeting_at,site_visit_at,agent_notes,lost_reason,
  attributed_revenue,revenue_currency,captured_at,created_at,updated_at FROM leads WHERE is_test=FALSE ORDER BY created_at DESC LIMIT 500`;
 json(res,200,{leads:rows.filter(row=>row.owner_id===null||ownerVisible(a,row.owner_id))});
}
