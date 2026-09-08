import { database } from './db.js';
import { method } from './http.js';
import { resolveStoredSource } from './project-source-files.js';
import { AZIZI_FLORENCE_CAMPAIGN } from './azizi-florence.js';

export default async function handler(req,res){
  if(!method(req,res,['GET']))return;
  const id=String(req.query?.id||'');
  if(!/^[0-9a-f-]{36}$/i.test(id)){res.statusCode=404;return res.end('Not found');}
  try{
    const sql=database();
    const rows=await sql`SELECT s.* FROM project_sources s JOIN project_ingestions i ON i.id=s.ingestion_id JOIN projects p ON p.id=i.project_id JOIN crm_campaigns c ON c.project_id=p.id WHERE s.id=${id} AND s.media_type IN ('image/jpeg','image/png') AND i.status='verified' AND i.is_test=FALSE AND p.name='Azizi Florence' AND p.developer='Azizi Developments' AND p.review_status='verified' AND p.active=TRUE AND p.is_test=FALSE AND c.name=${AZIZI_FLORENCE_CAMPAIGN} AND c.status='ACTIVE' AND c.is_test=FALSE LIMIT 1`;
    if(rows.length!==1){res.statusCode=404;return res.end('Not found');}
    const source=rows[0];
    const resolved=source.content?source:await resolveStoredSource(source);
    res.statusCode=200;
    res.setHeader('Content-Type',source.media_type);
    res.setHeader('Cache-Control','public, max-age=3600, s-maxage=86400, immutable');
    res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
    return res.end(resolved.content);
  }catch(error){console.error('Azizi Florence media failed:',error instanceof Error?error.message:'unknown');res.statusCode=404;return res.end('Not found');}
}
