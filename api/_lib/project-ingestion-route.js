import { randomUUID } from 'node:crypto';
import { sessionIdentity, isSameOrigin } from './auth.js';
import { database } from './db.js';
import { json, method, parseJson } from './http.js';
import { ingestProject, reviewIngestion } from './project-ingestion.js';

const validationCodes=new Set(['22P02','22003','22007','22008','23502','23503','23505','23514']);
export function ingestionErrorCategory(error) {
  if(error?.name==='ZodError')return 'INVALID_JSON';
  if(validationCodes.has(error?.code))return 'DATA_VALIDATION';
  if(error?.code==='42P01'||error?.code==='42703')return 'SCHEMA_MISMATCH';
  if(String(error?.message||'').includes('Database is not configured'))return 'DATABASE_CONFIGURATION';
  return 'PERSISTENCE_FAILURE';
}

export default async function projectIngestionHandler(req,res) {
  if(!method(req,res,['GET','POST','PATCH']))return;
  const identity=sessionIdentity(req);
  if(!identity)return json(res,401,{error:'Authentication required.'});
  if(identity.role!=='SUPER_ADMIN')return json(res,403,{error:'SUPER_ADMIN permission required.'});
  if(req.method!=='GET'&&!isSameOrigin(req))return json(res,403,{error:'Same-origin request required.'});
  try {
    const sql=database();
    if(req.method==='GET') {
      const rows=await sql`SELECT i.id,i.status,i.import_kind,i.is_test,i.issues,i.created_at,i.reviewed_at,p.developer,p.name AS project,p.availability_mode,p.emirate,p.area,p.construction_status,p.launch_date,p.handover,p.payment_plan_summary,p.eoi_amount,p.eoi_type,p.booking_amount,p.campaign_status,p.active,
        (SELECT COUNT(*)::int FROM property_inventory x WHERE x.ingestion_id=i.id) AS inventory_count,
        (SELECT COUNT(*)::int FROM project_unit_types u WHERE u.ingestion_id=i.id) AS unit_type_count,
        (SELECT COUNT(*)::int FROM project_sources s WHERE s.ingestion_id=i.id) AS source_count,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('filename',s.filename,'media_type',s.media_type,'source_kind',s.source_kind,'byte_size',s.byte_size) ORDER BY s.filename) FROM project_sources s WHERE s.ingestion_id=i.id),'[]'::jsonb) AS sources,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('unit_type',u.unit_type,'bedrooms',u.bedrooms,'property_type',u.property_type,'minimum_area',u.minimum_area,'maximum_area',u.maximum_area,'starting_price',u.starting_price,'price_currency',u.price_currency,'availability_status',u.availability_status,'review_status',u.review_status,'source_reference',u.source_reference) ORDER BY u.unit_type) FROM project_unit_types u WHERE u.ingestion_id=i.id),'[]'::jsonb) AS unit_types,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('unit',x.unit,'property_type',x.property_type,'bedrooms',x.bedrooms,'minimum_price',x.minimum_price,'review_status',x.review_status) ORDER BY x.source_row) FROM property_inventory x WHERE x.ingestion_id=i.id),'[]'::jsonb) AS inventory
        FROM project_ingestions i JOIN projects p ON p.id=i.project_id ORDER BY i.created_at DESC LIMIT 100`;
      return json(res,200,{ingestions:rows});
    }
    const body=parseJson(req);
    if(req.method==='POST') {
      const result=await ingestProject(sql,body,identity.sub);
      if(!result.success)return json(res,422,{error:'Project import validation failed.',category:'VALIDATION',request_id:randomUUID(),issues:result.issues,action:'Correct the listed fields and submit again.'});
      return json(res,201,result);
    }
    if(!body||typeof body.id!=='string'||!['approve','reject'].includes(body.decision))return json(res,400,{error:'A valid ingestion id and decision are required.'});
    const result=await reviewIngestion(sql,body.id,body.decision,identity.sub);
    if(!result)return json(res,404,{error:'Ingestion not found.'});
    if(result.conflict)return json(res,409,{error:'Ingestion has already been reviewed.',ingestion:result.ingestion});
    if(result.invalid)return json(res,422,{error:'Resolve validation issues before approval.',ingestion:result.ingestion});
    return json(res,200,result);
  } catch(error) {
    const requestId=randomUUID(),category=ingestionErrorCategory(error);
    console.error('Project ingestion failed safely',{request_id:requestId,category,code:error?.code,message:error instanceof Error?error.message:'unknown'});
    return json(res,500,{error:'Project ingestion could not be completed. No import was created.',category,request_id:requestId,action:'Verify the submitted values and retry. If it fails again, give this request ID to an administrator.'});
  }
}
