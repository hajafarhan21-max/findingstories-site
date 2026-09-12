import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { loadPublicProjects } from '../project-launch/registry.js';
import { CANONICAL_ORIGIN,sitemapXml } from '../api/_lib/seo.js';

const projects=await loadPublicProjects();
const serialized=JSON.stringify(projects.map(project=>({...project,canonical_url:`${CANONICAL_ORIGIN}${project.path}`})),null,2);
await writeFile('api/_lib/project-registry.generated.js',`// Generated from approved projects/*/manifest.json. Do not edit.\nexport const PUBLIC_PROJECTS=Object.freeze(${serialized});\n`);

const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const projectCards=projects.map(project=>`          <article class="project">
            <a href="${escapeHtml(project.path)}" aria-label="Explore ${escapeHtml(project.name)}"><div class="project-img" role="img" aria-label="${escapeHtml(project.hero_alt||project.name)}"${project.hero_image?` style="background-image:url('${escapeHtml(project.hero_image)}')"`:''}><div class="tag">${escapeHtml(project.launch_status||'Verified opportunity')}</div></div></a>
            <div class="project-body"><h3>${escapeHtml(project.name)}</h3><p>${escapeHtml(project.description)}</p><div class="project-meta"><div class="meta"><strong>Developer</strong>${escapeHtml(project.developer)}</div><div class="meta"><strong>Location</strong>${escapeHtml(project.location||'UAE')}</div></div><a class="btn btn-ghost" href="${escapeHtml(project.path)}">Review ${escapeHtml(project.name)} details</a></div>
          </article>`).join('\n');
const homePath='index.html';
const home=await readFile(homePath,'utf8');
const discovery=`<!-- PROJECT_DISCOVERY_START: generated from approved project manifests -->\n        <div class="project-grid">\n${projectCards}\n        </div>\n        <!-- PROJECT_DISCOVERY_END -->`;
const updatedHome=home.replace(/<!-- PROJECT_DISCOVERY_START:[\s\S]*?<!-- PROJECT_DISCOVERY_END -->/,discovery);
if(updatedHome===home&&!home.includes('PROJECT_DISCOVERY_START'))throw new Error('Homepage project discovery markers are missing');
await writeFile(homePath,updatedHome);

await mkdir('public',{recursive:true});
await writeFile('public/sitemap.xml',sitemapXml(['/',...projects.map(project=>project.path)]));
await writeFile('public/robots.txt',`User-agent: *\nAllow: /\nDisallow: /admin.html\nDisallow: /admin/\nDisallow: /api/\nSitemap: ${CANONICAL_ORIGIN}/sitemap.xml\n`);
console.log(`Generated SEO discovery for ${projects.length} approved project(s).`);
