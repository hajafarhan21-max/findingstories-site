import { method } from './http.js';
import { CANONICAL_ORIGIN,isPreviewDeployment } from './seo.js';

export default function handler(req,res){
  if(!method(req,res,['GET']))return;
  res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Cache-Control','public, s-maxage=900');
  if(isPreviewDeployment()){
    res.setHeader('X-Robots-Tag','noindex, nofollow');return res.end('User-agent: *\nDisallow: /\n');
  }
  return res.end(`User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${CANONICAL_ORIGIN}/sitemap.xml\n`);
}
