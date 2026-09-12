import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,readFile,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sitemapHandler from '../api/_lib/acquisition-sitemap.js';
import robotsHandler from '../api/_lib/robots.js';
import { CANONICAL_ORIGIN,canonicalUrl,isPreviewDeployment,sitemapXml } from '../api/_lib/seo.js';
import { PUBLIC_PROJECTS } from '../api/_lib/project-registry.generated.js';
import { loadPublicProjects } from '../project-launch/registry.js';

function response(){return {statusCode:200,headers:{},body:'',setHeader(k,v){this.headers[k]=v;},end(value=''){this.body=value;}};}

test('canonical host is stable and cannot inherit a preview URL',()=>{
  assert.equal(CANONICAL_ORIGIN,'https://www.finding-stories.com');
  assert.equal(canonicalUrl('/azizi-florence/?utm=x'),'https://www.finding-stories.com/azizi-florence');
  assert.equal(isPreviewDeployment({VERCEL_ENV:'preview',VERCEL_URL:'branch.vercel.app'}),true);
});

test('generated sitemap includes homepage and every approved project without unsafe routes',async()=>{
  const xml=await readFile('public/sitemap.xml','utf8');
  assert.match(xml,/^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml,/<loc>https:\/\/www\.finding-stories\.com\/<\/loc>/);
  for(const project of PUBLIC_PROJECTS)assert.ok(xml.includes(`<loc>${canonicalUrl(project.path)}</loc>`));
  assert.ok(PUBLIC_PROJECTS.some(project=>project.path==='/azizi-florence'));
  for(const project of PUBLIC_PROJECTS)assert.equal(project.canonical_url,canonicalUrl(project.path));
  for(const location of [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]))assert.doesNotMatch(location,/\/api\/|vercel\.app|[?#]|\/admin|\/test/);
});

test('a future approved project manifest enters sitemap through the same registry',async()=>{
  const root=await mkdtemp(join(tmpdir(),'project-registry-'));await mkdir(join(root,'future'));
  const florence=JSON.parse(await readFile('projects/azizi-florence/manifest.json','utf8'));
  florence.project={...florence.project,slug:'future-project',name:'Future Project',path:'/projects/future-project'};
  florence.seo={...florence.seo,title:'Future Project | Verified Residences | Finding Stories'};
  await writeFile(join(root,'future','manifest.json'),JSON.stringify(florence));
  const projects=await loadPublicProjects(root);const xml=sitemapXml(['/',...projects.map(project=>project.path)]);
  assert.match(xml,/<loc>https:\/\/www\.finding-stories\.com\/projects\/future-project<\/loc>/);
});

test('production endpoints expose canonical sitemap while previews expose neither',async()=>{
  const previous={VERCEL_ENV:process.env.VERCEL_ENV,NODE_ENV:process.env.NODE_ENV};
  process.env.VERCEL_ENV='production';const sitemap=response();await sitemapHandler({method:'GET'},sitemap);assert.equal(sitemap.statusCode,200);assert.match(sitemap.body,/azizi-florence/);
  const robots=response();robotsHandler({method:'GET'},robots);assert.match(robots.body,/Sitemap: https:\/\/www\.finding-stories\.com\/sitemap\.xml/);
  process.env.VERCEL_ENV='preview';const previewMap=response();await sitemapHandler({method:'GET'},previewMap);assert.equal(previewMap.statusCode,404);assert.match(previewMap.headers['X-Robots-Tag'],/noindex/);
  const previewRobots=response();robotsHandler({method:'GET'},previewRobots);assert.equal(previewRobots.body,'User-agent: *\nDisallow: /\n');
  if(previous.VERCEL_ENV===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=previous.VERCEL_ENV;
  if(previous.NODE_ENV===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous.NODE_ENV;
});

test('Florence metadata is self-canonical, indexable, useful and internally linked',async()=>{
  const [template,home]=await Promise.all([readFile('api/_lib/azizi-florence.js','utf8'),readFile('index.html','utf8')]);
  assert.match(template,/meta name="description"/);assert.match(template,/meta name="robots" content="index,follow/);assert.match(template,/rel="canonical"/);assert.match(template,/property="og:url"/);assert.match(template,/application\/ld\+json/);
  assert.match(home,/href="\/azizi-florence"/);
});
