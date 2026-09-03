import { createHash } from 'node:crypto';
import AdmZip from 'adm-zip';
import { z } from 'zod';

const text = max => z.string().trim().min(1).max(max);
const optionalText = max => z.preprocess(v => v === '' ? undefined : v, text(max).optional());
const number = z.preprocess(v => v === '' || v == null ? undefined : Number(v), z.number().nonnegative().optional());
export const inventoryRowSchema = z.object({
  unit: optionalText(120), property_type: text(100), bedrooms: text(40),
  minimum_price: number, maximum_price: number, minimum_size: number, maximum_size: number,
  price_per_sqft: number, handover: optionalText(10), payment_plan_summary: optionalText(2000),
  construction_status: optionalText(100), suitability: optionalText(1000)
}).strict().superRefine((v,ctx)=>{
  if (!v.unit) ctx.addIssue({code:'custom',path:['unit'],message:'A developer unit/reference is required for deterministic inventory upsert.'});
  if (v.minimum_price != null && v.maximum_price != null && v.minimum_price > v.maximum_price) ctx.addIssue({code:'custom',path:['maximum_price'],message:'Maximum price must not be below minimum price.'});
  if (v.minimum_size != null && v.maximum_size != null && v.minimum_size > v.maximum_size) ctx.addIssue({code:'custom',path:['maximum_size'],message:'Maximum area must not be below minimum area.'});
});
export const projectPayloadSchema = z.object({
  project: z.object({developer:text(200),name:text(200),emirate:optionalText(100),area:optionalText(200),description:optionalText(10000),construction_status:optionalText(100),handover:optionalText(10),payment_plan_summary:optionalText(3000),attributes:z.record(z.string(),z.union([z.string(),z.number(),z.boolean(),z.null()])).default({})}).strict(),
  inventory:z.array(inventoryRowSchema).max(5000).default([]), is_test:z.boolean().default(false),
  sources:z.array(z.object({filename:text(255),media_type:z.enum(['application/pdf','text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),base64:text(14_000_000)}).strict()).max(8).default([])
}).strict();

const normalized = value => value.trim().toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const projectKey = project => `${normalized(project.developer)}:${normalized(project.name)}`;
const headers = {unit:['unit','unit number','unit no','reference'],property_type:['property type','unit type','type'],bedrooms:['bedrooms','beds','bedroom'],minimum_price:['minimum price','price','price from'],maximum_price:['maximum price','price to'],minimum_size:['minimum size','area','size','sqft'],maximum_size:['maximum size','area to','size to'],price_per_sqft:['price per sqft','price/sqft','psf'],handover:['handover'],payment_plan_summary:['payment plan','payment plan summary'],construction_status:['construction status','status'],suitability:['suitability']};
const mapRow = row => Object.fromEntries(Object.entries(headers).map(([field,names])=>[field,row[Object.keys(row).find(k=>names.includes(k.trim().toLowerCase()))]]).filter(([,v])=>v!==undefined&&v!==null&&v!==''));
const entities=value=>String(value||'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
function csvRows(value) { let row=[],field='',quoted=false,rows=[]; for(let i=0;i<=value.length;i++){const c=value[i]??'\n';if(c==='"'&&quoted&&value[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=!quoted;else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&value[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}else field+=c;} const keys=(rows.shift()||[]).map(x=>x.trim());return rows.map(values=>Object.fromEntries(keys.map((key,i)=>[key,values[i]?.trim()||null]))); }
function xlsxRows(content) {
  const zip=new AdmZip(content), entries=zip.getEntries(); if(entries.length>1000||entries.reduce((n,x)=>n+x.header.size,0)>50*1024*1024)throw new Error('XLSX expands beyond safe limits.');
  const read=name=>zip.getEntry(name)?.getData().toString('utf8')||'';
  const shared=[...read('xl/sharedStrings.xml').matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map(m=>entities([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join('')));
  const sheetEntry=entries.find(x=>/^xl\/worksheets\/sheet\d+\.xml$/.test(x.entryName)); if(!sheetEntry)throw new Error('XLSX has no worksheet.');
  const grid=[]; for(const match of sheetEntry.getData().toString('utf8').matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){const ref=/\br="([A-Z]+)(\d+)"/.exec(match[1]);if(!ref)continue;let col=0;for(const c of ref[1])col=col*26+c.charCodeAt(0)-64;const raw=/<v>([\s\S]*?)<\/v>/.exec(match[2])?.[1]??/<t[^>]*>([\s\S]*?)<\/t>/.exec(match[2])?.[1]??'';grid[Number(ref[2])-1]??=[];grid[Number(ref[2])-1][col-1]=/\bt="s"/.test(match[1])?shared[Number(raw)]:entities(raw);}
  const keys=(grid.shift()||[]).map(String); return grid.filter(Boolean).map(values=>Object.fromEntries(keys.map((key,i)=>[key,values[i]??null])));
}

export function decodeSources(sources) {
  return sources.map(source=>{
    const content=Buffer.from(source.base64,'base64');
    if (!content.length || content.length>10*1024*1024) throw new Error(`Invalid source size: ${source.filename}`);
    if (source.media_type==='application/pdf' && content.subarray(0,5).toString()!=='%PDF-') throw new Error(`Malformed PDF: ${source.filename}`);
    if (source.media_type.includes('spreadsheet') && content.subarray(0,2).toString()!=='PK') throw new Error(`Malformed XLSX: ${source.filename}`);
    return {...source,content,sha256:createHash('sha256').update(content).digest('hex')};
  });
}
export function rowsFromSources(decoded) {
  const rows=[];
  for (const source of decoded) {
    if (source.media_type==='text/csv') rows.push(...csvRows(source.content.toString('utf8')).map(mapRow));
    if (source.media_type.includes('spreadsheet')) rows.push(...xlsxRows(source.content).map(mapRow));
  }
  return rows;
}
export function validateImport(input) {
  const parsed=projectPayloadSchema.safeParse(input); if(!parsed.success)return {success:false,issues:parsed.error.issues};
  let sources; try { sources=decodeSources(parsed.data.sources); } catch(error){return {success:false,issues:[{path:['sources'],message:error.message}]};}
  const fileRows=rowsFromSources(sources), candidates=[...parsed.data.inventory,...fileRows], inventory=[], issues=[];
  for (const field of ['emirate','area','construction_status']) if (!parsed.data.project[field]) issues.push({path:['project',field],message:`${field.replace('_',' ')} is missing and must be verified before production approval.`});
  candidates.forEach((row,index)=>{const checked=inventoryRowSchema.safeParse(row);if(checked.success)inventory.push(checked.data);else issues.push(...checked.error.issues.map(x=>({...x,path:['inventory',index,...x.path]})));});
  const units=new Set(); inventory.forEach((row,index)=>{const key=normalized(row.unit);if(units.has(key))issues.push({path:['inventory',index,'unit'],message:'Duplicate unit in this upload.'});units.add(key);});
  return {success:true,data:{...parsed.data,inventory,sources},issues};
}

export async function reviewIngestion(sql,id,decision,userId) {
  const status=decision==='approve'?'verified':'rejected';
  const rows=await sql`WITH target AS (SELECT * FROM project_ingestions WHERE id=${id} FOR UPDATE),
    reviewed AS (UPDATE project_ingestions i SET status=${status},reviewed_by=${userId},reviewed_at=NOW(),updated_at=NOW() FROM target t WHERE i.id=t.id AND t.status='needs_review' AND (${decision}='reject' OR jsonb_array_length(t.issues)=0) RETURNING i.*),
    project_update AS (UPDATE projects p SET review_status=${status},active=${decision==='approve'},verified_by=CASE WHEN ${decision}='approve' THEN ${userId}::uuid ELSE p.verified_by END,verified_at=CASE WHEN ${decision}='approve' THEN NOW() ELSE p.verified_at END,updated_at=NOW() WHERE p.id IN (SELECT project_id FROM reviewed) RETURNING p.id),
    inventory_update AS (UPDATE property_inventory x SET review_status=${status},status=CASE WHEN ${decision}='approve' THEN 'active' ELSE 'inactive' END,data_quality=CASE WHEN ${decision}='approve' THEN 'verified' ELSE 'advisory' END,last_updated=CASE WHEN ${decision}='approve' THEN NOW() ELSE x.last_updated END,updated_at=NOW() WHERE x.ingestion_id IN (SELECT id FROM reviewed) RETURNING x.id)
    SELECT row_to_json(target.*) AS original,(SELECT row_to_json(reviewed.*) FROM reviewed) AS ingestion FROM target`;
  if(!rows.length)return null; if(rows[0].ingestion)return {ingestion:rows[0].ingestion};
  if(rows[0].original.status!=='needs_review')return {conflict:true,ingestion:rows[0].original};
  return {invalid:true,ingestion:rows[0].original};
}

export async function ingestProject(sql,input,userId) {
  const checked=validateImport(input); if(!checked.success)return checked;
  const {project,is_test}=checked.data, key=projectKey(project);
  const rows=await sql`WITH existing AS (SELECT id FROM projects WHERE project_key=${key} AND is_test=${is_test}),
    saved_project AS (INSERT INTO projects (project_key,developer,name,emirate,area,description,construction_status,handover,payment_plan_summary,attributes,is_test)
      VALUES (${key},${project.developer},${project.name},${project.emirate||null},${project.area||null},${project.description||null},${project.construction_status||null},${project.handover||null},${project.payment_plan_summary||null},${project.attributes},${is_test})
      ON CONFLICT (project_key,is_test) DO UPDATE SET emirate=COALESCE(EXCLUDED.emirate,projects.emirate),area=COALESCE(EXCLUDED.area,projects.area),description=COALESCE(EXCLUDED.description,projects.description),construction_status=COALESCE(EXCLUDED.construction_status,projects.construction_status),handover=COALESCE(EXCLUDED.handover,projects.handover),payment_plan_summary=COALESCE(EXCLUDED.payment_plan_summary,projects.payment_plan_summary),attributes=projects.attributes||EXCLUDED.attributes,review_status='needs_review',active=FALSE,updated_at=NOW() RETURNING *),
    batch AS (INSERT INTO project_ingestions(project_id,import_kind,submitted_by,is_test,payload,issues) SELECT id,CASE WHEN EXISTS(SELECT 1 FROM existing) THEN 'update' ELSE 'create' END,${userId},${is_test},${{project,inventory_count:checked.data.inventory.length}},${checked.issues} FROM saved_project RETURNING *),
    saved_sources AS (INSERT INTO project_sources(ingestion_id,filename,media_type,byte_size,sha256,content) SELECT batch.id,s.filename,s.media_type,s.byte_size,s.sha256,decode(s.base64,'base64') FROM batch,jsonb_to_recordset(${checked.data.sources.map(s=>({filename:s.filename,media_type:s.media_type,byte_size:s.content.length,sha256:s.sha256,base64:s.content.toString('base64')}))}::jsonb) AS s(filename text,media_type text,byte_size int,sha256 text,base64 text) ON CONFLICT DO NOTHING RETURNING id),
    saved_inventory AS (INSERT INTO property_inventory(project_id,ingestion_id,source_row,unit,developer,project,emirate,area,property_type,bedrooms,minimum_price,maximum_price,minimum_size,maximum_size,price_per_sqft,handover,payment_plan_summary,construction_status,suitability,status,source,data_quality,last_updated,is_test,review_status)
      SELECT p.id,b.id,r.ordinality,r.unit,${project.developer},${project.name},${project.emirate||'Unverified'},${project.area||'Unverified'},r.property_type,r.bedrooms,r.minimum_price,r.maximum_price,r.minimum_size,r.maximum_size,r.price_per_sqft,COALESCE(r.handover,${project.handover||null}),COALESCE(r.payment_plan_summary,${project.payment_plan_summary||null}),COALESCE(r.construction_status,${project.construction_status||'Unverified'}),r.suitability,'inactive','project_ingestion:'||b.id,'advisory',NOW(),${is_test},'needs_review' FROM saved_project p CROSS JOIN batch b CROSS JOIN LATERAL jsonb_to_recordset(${checked.data.inventory.map((r,i)=>({...r,ordinality:i+1}))}::jsonb) AS r(ordinality int,unit text,property_type text,bedrooms text,minimum_price numeric,maximum_price numeric,minimum_size numeric,maximum_size numeric,price_per_sqft numeric,handover date,payment_plan_summary text,construction_status text,suitability text)
      ON CONFLICT (project_id,unit,is_test) WHERE project_id IS NOT NULL AND unit IS NOT NULL DO UPDATE SET ingestion_id=EXCLUDED.ingestion_id,source_row=EXCLUDED.source_row,property_type=EXCLUDED.property_type,bedrooms=EXCLUDED.bedrooms,minimum_price=EXCLUDED.minimum_price,maximum_price=EXCLUDED.maximum_price,minimum_size=EXCLUDED.minimum_size,maximum_size=EXCLUDED.maximum_size,price_per_sqft=EXCLUDED.price_per_sqft,handover=EXCLUDED.handover,payment_plan_summary=EXCLUDED.payment_plan_summary,construction_status=EXCLUDED.construction_status,suitability=EXCLUDED.suitability,status='inactive',data_quality='advisory',review_status='needs_review',updated_at=NOW() RETURNING id)
    SELECT row_to_json(batch.*) AS ingestion,row_to_json(saved_project.*) AS project,(SELECT COUNT(*)::int FROM saved_inventory) AS inventory_count FROM batch CROSS JOIN saved_project`;
  return {success:true,ingestion:{...rows[0].ingestion,project:rows[0].project,inventory_count:rows[0].inventory_count,issues:checked.issues}};
}
