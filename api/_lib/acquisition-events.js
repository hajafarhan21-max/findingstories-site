import { z } from 'zod';
import { database, ensureSchema } from '../_lib/db.js';
import { clientIp, json, method, parseJson, rateLimit } from '../_lib/http.js';

const schema=z.object({event_key:z.string().uuid(),visitor_id:z.string().uuid(),event_type:z.enum(['page_view','repeated_visit','property_comparison','payment_plan_interest','whatsapp_click','meeting_request','site_visit_request']),page_url:z.string().trim().startsWith('/').max(1000),page_type:z.string().trim().max(80).optional().default(''),area:z.string().trim().max(150).optional().default(''),project:z.string().trim().max(200).optional().default(''),developer:z.string().trim().max(200).optional().default(''),source:z.string().trim().max(120).optional().default('organic'),referrer:z.string().trim().max(1000).optional().default(''),utm_source:z.string().trim().max(200).optional().default(''),utm_medium:z.string().trim().max(200).optional().default(''),utm_campaign:z.string().trim().max(200).optional().default('')}).strict();

export default async function handler(req,res){
  if(!method(req,res,['POST']))return;if(!rateLimit(`acquisition:${clientIp(req)}`,60,60_000))return json(res,429,{error:'Too many events.'});
  const parsed=schema.safeParse(parseJson(req));if(!parsed.success)return json(res,400,{error:'Invalid acquisition event.'});
  try{await ensureSchema();const sql=database();const x=parsed.data;const rows=await sql`INSERT INTO acquisition_events(event_key,visitor_id,event_type,page_url,page_type,area,project,developer,source,referrer,utm_source,utm_medium,utm_campaign) VALUES(${x.event_key},${x.visitor_id},${x.event_type},${x.page_url},${x.page_type||null},${x.area||null},${x.project||null},${x.developer||null},${x.source||'organic'},${x.referrer||null},${x.utm_source||null},${x.utm_medium||null},${x.utm_campaign||null}) ON CONFLICT(event_key) DO NOTHING RETURNING id`;return json(res,rows[0]?201:200,{ok:true,duplicate:!rows[0]});}catch{return json(res,500,{error:'Event could not be recorded.'});}
}
