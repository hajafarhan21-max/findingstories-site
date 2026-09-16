import { mkdir,writeFile } from 'node:fs/promises';
import { loadPublicProjects } from '../project-launch/registry.js';
import { CANONICAL_ORIGIN,sitemapXml } from '../api/_lib/seo.js';
import { PLATFORM_ROUTES } from '../platform/catalog.js';

const projects=await loadPublicProjects();
const serialized=JSON.stringify(projects.map(project=>({...project,canonical_url:`${CANONICAL_ORIGIN}${project.path}`})),null,2);
await writeFile('api/_lib/project-registry.generated.js',`// Generated from approved projects/*/manifest.json. Do not edit.\nexport const PUBLIC_PROJECTS=Object.freeze(${serialized});\n`);

await mkdir('public',{recursive:true});
await writeFile('public/sitemap.xml',sitemapXml([...PLATFORM_ROUTES,...projects.map(project=>project.path),'/market-intelligence','/insights/videos','/learn/where-to-invest','/learn/why-invest','/learn/how-to-invest']));
await writeFile('public/robots.txt',`User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${CANONICAL_ORIGIN}/sitemap.xml\n`);
console.log(`Generated SEO discovery for ${projects.length} approved project(s).`);
