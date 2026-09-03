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
 const rows=await a.sql`SELECT id,name,phone,email,source,utm_source,utm_medium,utm_campaign,owner_id,stage,status,temperature,
  qualification_status,budget,bedrooms,preferred_areas,purpose,purchase_timeline,next_follow_up_at,meeting_at,site_visit_at,
  attributed_revenue,revenue_currency,created_at,updated_at FROM leads WHERE is_test=FALSE ORDER BY created_at DESC LIMIT 500`;
 json(res,200,{leads:rows.filter(row=>row.owner_id===null||ownerVisible(a,row.owner_id))});
}
