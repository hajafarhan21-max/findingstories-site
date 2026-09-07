import { database } from './db.js';
import { method } from './http.js';
import { AZIZI_FLORENCE_CAMPAIGN,renderAziziFlorence } from './azizi-florence.js';
import { siteContact } from './site-config.js';

export default async function handler(req,res){
  if(!method(req,res,['GET']))return;
  try{
    const sql=database();
    const projects=await sql`SELECT p.* FROM projects p JOIN crm_campaigns c ON c.project_id=p.id WHERE p.developer='Azizi Developments' AND p.name='Azizi Florence' AND p.review_status='verified' AND p.active=TRUE AND p.is_test=FALSE AND c.name=${AZIZI_FLORENCE_CAMPAIGN} AND c.status='ACTIVE' AND c.is_test=FALSE`;
    if(projects.length!==1){res.statusCode=404;res.setHeader('X-Robots-Tag','noindex, nofollow');return res.end('Project unavailable.');}
    const project=projects[0];
    const [campaigns,units,sources]=await Promise.all([
      sql`SELECT id,name FROM crm_campaigns WHERE project_id=${project.id} AND name=${AZIZI_FLORENCE_CAMPAIGN} AND status='ACTIVE' AND is_test=FALSE`,
      sql`SELECT unit_type,bedrooms,property_type,minimum_area,maximum_area,starting_price,price_currency,review_status,is_test FROM project_unit_types WHERE project_id=${project.id} AND review_status='verified' AND is_test=FALSE ORDER BY starting_price NULLS LAST,unit_type`,
      sql`SELECT DISTINCT s.filename,s.source_kind FROM project_sources s JOIN project_ingestions i ON i.id=s.ingestion_id WHERE i.project_id=${project.id} AND i.status='verified' AND i.is_test=FALSE ORDER BY s.filename`
    ]);
    if(campaigns.length!==1){res.statusCode=404;res.setHeader('X-Robots-Tag','noindex, nofollow');return res.end('Campaign unavailable.');}
    const html=renderAziziFlorence({project,campaign:campaigns[0],units,sources,origin:process.env.PUBLIC_SITE_URL||'https://www.finding-stories.com',whatsappNumber:siteContact.whatsappNumber});
    res.statusCode=200;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=3600');return res.end(html);
  }catch(error){console.error('Azizi Florence page failed:',error instanceof Error?error.message:'unknown');res.statusCode=503;res.setHeader('X-Robots-Tag','noindex, nofollow');return res.end('Project data is temporarily unavailable.');}
}
