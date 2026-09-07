import { z } from 'zod';
import { authorize } from '../crm-access.js';
import { json,method,parseJson } from '../http.js';
import { campaignMetrics } from '../campaign-metrics.js';

const uuid=z.string().uuid();
const types=['PRE_LAUNCH','LAUNCH','EOI_DRIVE','LEAD_GENERATION','OPEN_HOUSE','SITE_VISIT_DRIVE','ORGANIC','PAID_ADVERTISING','REFERRAL','WHATSAPP','OTHER'];
const optionalDate=z.union([z.string().date(),z.null()]).optional();
const payload=z.object({id:uuid.optional(),name:z.string().trim().min(2).max(200).optional(),project_id:uuid.optional(),campaign_type:z.enum(types).optional(),status:z.enum(['DRAFT','ACTIVE','PAUSED','ARCHIVED']).optional(),starts_on:optionalDate,ends_on:optionalDate,owner_id:z.union([uuid,z.null()]).optional(),agent_ids:z.array(uuid).max(100).optional(),target_leads:z.number().int().nonnegative().optional(),target_qualified_leads:z.number().int().nonnegative().optional(),target_meetings:z.number().int().nonnegative().optional(),target_site_visits:z.number().int().nonnegative().optional(),target_eois:z.number().int().nonnegative().optional(),target_bookings:z.number().int().nonnegative().optional(),target_revenue:z.number().nonnegative().optional(),notes:z.string().trim().max(10000).optional()}).strict();
const mutationAllowed=identity=>identity.role==='SUPER_ADMIN';
const visible=(access,row)=>access.visibleIds===null||access.visibleIds.includes(row.owner_id)||row.agent_ids?.some(id=>access.visibleIds.includes(id));

async function list(access,id=''){
 const rows=await access.sql`SELECT c.*,p.name project_name,p.developer,p.area,p.emirate,owner.display_name owner_name,
  COALESCE((SELECT json_agg(a.user_id) FROM crm_campaign_assignments a WHERE a.campaign_id=c.id),'[]') agent_ids,
  (SELECT COUNT(*) FROM leads l WHERE l.campaign_id=c.id AND l.is_test=FALSE)::int leads,
  (SELECT COUNT(*) FROM leads l WHERE l.campaign_id=c.id AND l.is_test=FALSE AND (l.status='qualified' OR (l.qualification_status='completed' AND l.lead_score>=45)))::int qualified_leads,
  (SELECT COUNT(*) FROM leads l WHERE l.campaign_id=c.id AND l.is_test=FALSE AND l.meeting_at IS NOT NULL)::int meetings,
  (SELECT COUNT(*) FROM leads l WHERE l.campaign_id=c.id AND l.is_test=FALSE AND l.site_visit_at IS NOT NULL)::int site_visits,
  (SELECT COUNT(*) FROM crm_campaign_eois e WHERE e.campaign_id=c.id AND e.is_test=FALSE AND e.status='COMPLETED')::int eois,
  (SELECT COUNT(*) FROM crm_campaign_eois e WHERE e.campaign_id=c.id AND e.is_test=FALSE AND e.status='PENDING')::int eois_pending,
  (SELECT COUNT(*) FROM leads l WHERE l.campaign_id=c.id AND l.is_test=FALSE AND l.status IN ('booked','converted'))::int bookings,
  COALESCE((SELECT SUM(l.attributed_revenue) FROM leads l WHERE l.campaign_id=c.id AND l.is_test=FALSE AND l.status IN ('booked','converted')),0) revenue
 FROM crm_campaigns c JOIN projects p ON p.id=c.project_id LEFT JOIN crm_users owner ON owner.id=c.owner_id
 WHERE c.is_test=FALSE AND p.is_test=FALSE AND (${id}='' OR c.id::text=${id}) ORDER BY c.created_at DESC`;
 return rows.filter(row=>visible(access,row)).map(row=>({...row,metrics:campaignMetrics(row)}));
}
export default async function handler(req,res){
 if(!method(req,res,['GET','POST','PATCH']))return;
 const action=req.method==='GET'?'view':req.method==='POST'?'create':'edit';
 const access=await authorize(req,res,'campaigns',action,{mutation:req.method!=='GET'});if(!access)return;
 if(req.method==='GET'){
  const id=String(req.query?.id||'');const campaigns=await list(access,id);
  if(id&&!campaigns.length)return json(res,404,{error:'Campaign not found.'});
  if(!id){const projects=access.identity.role==='SUPER_ADMIN'?await access.sql`SELECT id,name,developer,area,emirate,availability_mode FROM projects WHERE review_status='verified' AND active=TRUE AND is_test=FALSE ORDER BY developer,name`:[];const users=access.identity.role==='SUPER_ADMIN'?await access.sql`SELECT id,display_name,role FROM crm_users WHERE active=TRUE ORDER BY display_name`:[];return json(res,200,{campaigns,projects,users});}
  const campaign=campaigns[0];
  const [recentLeads,tasks,sourcePerformance,agentPerformance,eoiPipeline]=await Promise.all([
   access.sql`SELECT id,name,temperature,status,owner_id,source,medium,created_at FROM leads WHERE campaign_id=${campaign.id} AND is_test=FALSE ORDER BY created_at DESC LIMIT 10`,
   access.sql`SELECT t.id,t.title,t.due_at,t.completed_at,t.assignee_id,l.name lead_name FROM crm_tasks t JOIN leads l ON l.id=t.lead_id WHERE l.campaign_id=${campaign.id} AND t.is_test=FALSE AND l.is_test=FALSE AND t.completed_at IS NULL ORDER BY t.due_at LIMIT 10`,
   access.sql`SELECT COALESCE(NULLIF(source,''),'Unknown') name,COUNT(*)::int leads,COUNT(*) FILTER(WHERE status='qualified' OR (qualification_status='completed' AND lead_score>=45))::int qualified,COUNT(*) FILTER(WHERE status IN ('booked','converted'))::int bookings FROM leads WHERE campaign_id=${campaign.id} AND is_test=FALSE GROUP BY 1 ORDER BY leads DESC`,
   access.sql`SELECT u.id,u.display_name name,COUNT(l.id)::int leads,COUNT(l.id) FILTER(WHERE l.status='qualified' OR (l.qualification_status='completed' AND l.lead_score>=45))::int qualified,COUNT(l.id) FILTER(WHERE l.status IN ('booked','converted'))::int bookings,COALESCE(SUM(l.attributed_revenue) FILTER(WHERE l.status IN ('booked','converted')),0) revenue FROM crm_campaign_assignments a JOIN crm_users u ON u.id=a.user_id LEFT JOIN leads l ON l.owner_id=u.id AND l.campaign_id=a.campaign_id AND l.is_test=FALSE WHERE a.campaign_id=${campaign.id} GROUP BY u.id,u.display_name ORDER BY leads DESC`,
   access.sql`SELECT e.id,e.status,e.created_at,e.completed_at,l.name lead_name,e.owner_id FROM crm_campaign_eois e JOIN leads l ON l.id=e.lead_id WHERE e.campaign_id=${campaign.id} AND e.is_test=FALSE AND l.is_test=FALSE ORDER BY e.created_at DESC LIMIT 25`
  ]);
  return json(res,200,{campaign,recent_leads:recentLeads.filter(x=>access.visibleIds===null||!x.owner_id||access.visibleIds.includes(x.owner_id)),upcoming_follow_ups:tasks.filter(x=>access.visibleIds===null||access.visibleIds.includes(x.assignee_id)),source_performance:sourcePerformance,agent_performance:agentPerformance.filter(x=>access.visibleIds===null||access.visibleIds.includes(x.id)),eoi_pipeline:eoiPipeline.filter(x=>access.visibleIds===null||!x.owner_id||access.visibleIds.includes(x.owner_id))});
 }
 if(!mutationAllowed(access.identity))return json(res,403,{error:'SUPER_ADMIN role required.'});
 const parsed=payload.safeParse(parseJson(req));if(!parsed.success)return json(res,400,{error:'Invalid campaign.',details:parsed.error.flatten().fieldErrors});
 const x=parsed.data;
 if(req.method==='POST'&&(!x.name||!x.project_id||!x.campaign_type))return json(res,400,{error:'Name, verified project and campaign type are required.'});
 if(x.starts_on&&x.ends_on&&x.ends_on<x.starts_on)return json(res,400,{error:'End date cannot precede start date.'});
 try{
  if(x.project_id){const projects=await access.sql`SELECT id FROM projects WHERE id=${x.project_id} AND review_status='verified' AND active=TRUE AND is_test=FALSE`;if(!projects.length)return json(res,400,{error:'Select an existing verified, active production project.'});}
  let rows;
  if(req.method==='POST')rows=await access.sql`INSERT INTO crm_campaigns(project_id,name,campaign_type,status,starts_on,ends_on,owner_id,target_leads,target_qualified_leads,target_meetings,target_site_visits,target_eois,target_bookings,target_revenue,notes,is_test,created_by,updated_by) VALUES(${x.project_id},${x.name},${x.campaign_type},${x.status||'DRAFT'},${x.starts_on||null},${x.ends_on||null},${x.owner_id||null},${x.target_leads||0},${x.target_qualified_leads||0},${x.target_meetings||0},${x.target_site_visits||0},${x.target_eois||0},${x.target_bookings||0},${x.target_revenue||0},${x.notes||''},FALSE,${access.identity.id},${access.identity.id}) RETURNING id`;
  else {if(!x.id)return json(res,400,{error:'Campaign id is required.'});rows=await access.sql`UPDATE crm_campaigns SET name=COALESCE(${x.name||null},name),project_id=COALESCE(${x.project_id||null},project_id),campaign_type=COALESCE(${x.campaign_type||null},campaign_type),status=COALESCE(${x.status||null},status),starts_on=CASE WHEN ${x.starts_on!==undefined} THEN ${x.starts_on||null}::date ELSE starts_on END,ends_on=CASE WHEN ${x.ends_on!==undefined} THEN ${x.ends_on||null}::date ELSE ends_on END,owner_id=CASE WHEN ${x.owner_id!==undefined} THEN ${x.owner_id||null}::uuid ELSE owner_id END,target_leads=COALESCE(${x.target_leads??null},target_leads),target_qualified_leads=COALESCE(${x.target_qualified_leads??null},target_qualified_leads),target_meetings=COALESCE(${x.target_meetings??null},target_meetings),target_site_visits=COALESCE(${x.target_site_visits??null},target_site_visits),target_eois=COALESCE(${x.target_eois??null},target_eois),target_bookings=COALESCE(${x.target_bookings??null},target_bookings),target_revenue=COALESCE(${x.target_revenue??null},target_revenue),notes=COALESCE(${x.notes??null},notes),updated_by=${access.identity.id},updated_at=NOW() WHERE id=${x.id} AND is_test=FALSE RETURNING id`;}
  if(!rows.length)return json(res,404,{error:'Campaign not found.'});const id=rows[0].id;
  if(x.agent_ids){await access.sql`DELETE FROM crm_campaign_assignments WHERE campaign_id=${id}`;for(const userId of x.agent_ids)await access.sql`INSERT INTO crm_campaign_assignments(campaign_id,user_id) SELECT ${id},id FROM crm_users WHERE id=${userId} AND active=TRUE ON CONFLICT DO NOTHING`;}
  const campaigns=await list(access,String(id));return json(res,req.method==='POST'?201:200,{campaign:campaigns[0]});
 }catch(error){console.error('Campaign mutation failed:',error instanceof Error?error.message:'unknown');return json(res,409,{error:'Campaign could not be saved. Check that its name and project are valid.'});}
}
