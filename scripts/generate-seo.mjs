import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { loadPublicProjects } from '../project-launch/registry.js';
import { CANONICAL_ORIGIN,sitemapXml } from '../api/_lib/seo.js';
import { PLATFORM_ROUTES } from '../platform/catalog.js';

const projects=await loadPublicProjects();
const serialized=JSON.stringify(projects.map(project=>({...project,canonical_url:`${CANONICAL_ORIGIN}${project.path}`})),null,2);
await writeFile('api/_lib/project-registry.generated.js',`// Generated from approved projects/*/manifest.json. Do not edit.\nexport const PUBLIC_PROJECTS=Object.freeze(${serialized});\n`);

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const projectCards=projects.map(project=>`<article class="project-card reveal" data-project><a href="${escapeHtml(project.path)}"><div class="project-image">${project.hero_image?`<img src="${escapeHtml(project.hero_image)}" alt="${escapeHtml(project.hero_alt||project.name)}" width="1600" height="900" loading="lazy">`:''}<span class="badge">${escapeHtml(project.launch_status||'Verified opportunity')}</span></div><div class="project-body"><span class="verified">● Published verification record</span><h3>${escapeHtml(project.name)}</h3><p>${escapeHtml(project.description)}</p><div class="project-meta"><div><strong>Developer</strong>${escapeHtml(project.developer)}</div><div><strong>Location</strong>${escapeHtml(project.location||'UAE')}</div></div><span class="button">Explore project →</span></div></a><a class="sr-only" href="${escapeHtml(project.path)}">Review ${escapeHtml(project.name)} details</a></article>`).join('\n');
const homePath='index.html';
const home=await readFile(homePath,'utf8');
const discovery=`<!-- PROJECT_DISCOVERY_START: generated from approved project manifests -->\n        <div class="project-grid" data-project-list>\n${projectCards}\n        </div>\n        <!-- PROJECT_DISCOVERY_END -->`;
const updatedHome=home.replace(/<!-- PROJECT_DISCOVERY_START:[\s\S]*?<!-- PROJECT_DISCOVERY_END -->/,discovery);
if(updatedHome===home&&!home.includes('PROJECT_DISCOVERY_START'))throw new Error('Homepage project discovery markers are missing');
await writeFile(homePath,updatedHome);

await mkdir('public',{recursive:true});
await writeFile('public/sitemap.xml',sitemapXml([...PLATFORM_ROUTES,...projects.map(project=>project.path),'/market-intelligence','/insights/videos','/learn/where-to-invest','/learn/why-invest','/learn/how-to-invest']));
await writeFile('public/robots.txt',`User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${CANONICAL_ORIGIN}/sitemap.xml\n`);
console.log(`Generated SEO discovery for ${projects.length} approved project(s).`);
