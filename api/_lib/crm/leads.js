import { authorize,ownerVisible } from '../crm-access.js';
import { json,method } from '../http.js';
export default async function handler(req,res){
 if(!method(req,res,['GET']))return; const a=await authorize(req,res,'leads','view');if(!a)return;
 const rows=await a.sql`SELECT id,name,phone,email,source,utm_source,utm_medium,utm_campaign,owner_id,stage,status,temperature,
  qualification_status,budget,bedrooms,preferred_areas,purpose,purchase_timeline,next_follow_up_at,meeting_at,site_visit_at,
  attributed_revenue,revenue_currency,created_at,updated_at FROM leads WHERE is_test=FALSE ORDER BY created_at DESC LIMIT 500`;
 json(res,200,{leads:rows.filter(row=>row.owner_id===null||ownerVisible(a,row.owner_id))});
}
