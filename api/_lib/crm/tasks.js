import { z } from 'zod'; import { authorize,ownerVisible } from '../crm-access.js'; import { json,method,parseJson } from '../http.js';
const create=z.object({title:z.string().trim().min(2).max(300),task_type:z.string().trim().max(50).default('follow_up'),priority:z.enum(['low','normal','high','urgent']).default('normal'),due_at:z.string().datetime({offset:true}).nullable().optional(),reminder_at:z.string().datetime({offset:true}).nullable().optional(),assignee_id:z.string().uuid(),lead_id:z.string().uuid().nullable().optional(),opportunity_id:z.string().uuid().nullable().optional()}).strict();
export default async function handler(req,res){
 if(!method(req,res,['GET','POST']))return; const a=await authorize(req,res,'tasks',req.method==='GET'?'view':'create',{mutation:req.method!=='GET'});if(!a)return;
 if(req.method==='GET'){const rows=await a.sql`SELECT *,(completed_at IS NULL AND due_at<NOW()) overdue FROM crm_tasks WHERE is_test=FALSE ORDER BY completed_at NULLS FIRST,due_at NULLS LAST`;return json(res,200,{tasks:rows.filter(x=>ownerVisible(a,x.assignee_id))});}
 const p=create.safeParse(parseJson(req));if(!p.success)return json(res,400,{error:'Invalid task.',details:p.error.flatten().fieldErrors});
 if(!ownerVisible(a,p.data.assignee_id))return json(res,403,{error:'Assignee is outside your hierarchy.'}); const v=p.data;
 const rows=await a.sql`INSERT INTO crm_tasks(title,task_type,priority,due_at,reminder_at,assignee_id,created_by,lead_id,opportunity_id) VALUES(${v.title},${v.task_type},${v.priority},${v.due_at||null},${v.reminder_at||null},${v.assignee_id},${a.identity.id},${v.lead_id||null},${v.opportunity_id||null}) RETURNING *`;
 await a.sql`INSERT INTO crm_activities(lead_id,opportunity_id,activity_type,subject,metadata,actor_id) VALUES(${v.lead_id||null},${v.opportunity_id||null},'task',${v.title},${JSON.stringify({task_id:rows[0].id,assignee_id:v.assignee_id})}::jsonb,${a.identity.id})`;
 json(res,201,{task:rows[0]});
}
