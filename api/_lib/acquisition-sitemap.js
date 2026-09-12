import { database } from './db.js';
import { method } from './http.js';
import { discoverOpportunities } from './acquisition.js';
import { PUBLIC_PROJECTS } from './project-registry.generated.js';
import { isPreviewDeployment,sitemapXml } from './seo.js';

export default async function handler(req,res){
  if(!method(req,res,['GET']))return;
  if(isPreviewDeployment()){
    res.statusCode=404;res.setHeader('X-Robots-Tag','noindex, nofollow');return res.end('Not found');
  }
  let inventory=[];
  try{
    const sql=database();
    inventory=await sql`SELECT * FROM property_inventory WHERE status='active' AND is_test=FALSE AND data_quality='verified'`;
  }catch(error){
    // Approved project discovery must not disappear during a database incident.
    console.error('Optional inventory sitemap expansion failed:',error instanceof Error?error.message:'unknown');
  }
  const paths=['/',...PUBLIC_PROJECTS.map(project=>project.path),...discoverOpportunities(inventory).filter(page=>page.indexable).map(page=>page.path)];
  res.statusCode=200;res.setHeader('Content-Type','application/xml; charset=utf-8');res.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=3600');res.end(sitemapXml(paths));
}
