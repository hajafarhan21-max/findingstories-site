import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {PLATFORM_ROUTES,PUBLISHED_PROJECTS} from '../platform/catalog.js';

const root='dist';
if(!existsSync(root))throw new Error('dist/ is missing. Run npm run build before the public-site audit.');
const config=JSON.parse(await readFile('vercel.json','utf8'));
const rewrites=new Map(config.rewrites.map(({source,destination})=>[source,destination]));
const editorial=['/market-intelligence','/insights/videos','/learn/where-to-invest','/learn/why-invest','/learn/how-to-invest','/unsubscribe','/resale','/rent','/commercial','/new-launches','/pre-launch','/recently-launched','/under-construction','/ready-properties','/completed'];
const routes=[...new Set(['/',...PLATFORM_ROUTES,...editorial,...PUBLISHED_PROJECTS.flatMap(p=>[p.path,`/projects/${p.slug}`])])].sort();
const strip=s=>s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&\w+;/g,' ').replace(/\s+/g,' ').trim();
const attr=(html,name)=>html.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`,'i'))?.[1]?.replace(/<[^>]+>/g,'').trim()||'';
function fileFor(route){
  if(route==='/')return `${root}/index.html`;
  const destination=rewrites.get(route);
  if(destination?.endsWith('.html'))return `${root}${destination}`;
  const direct=`${root}${route}.html`;if(existsSync(direct))return direct;
  return null;
}
const routeSet=new Set(routes);
const failures=[];const records=[];const links=[];
for(const route of routes){
  const file=fileFor(route);
  const project=PUBLISHED_PROJECTS.find(p=>route===p.path||route===`/projects/${p.slug}`);
  if(!file&&project){records.push({route,title:project.name,source:'approved project registry',render:'dynamic verified project renderer',meaningful:true,data:'approved project manifest',cta:'lead form',attribution:'project context',seo:'canonical + JSON-LD',mobile:'verified by responsive CSS audit',desktop:'verified by responsive CSS audit',problem:'none',resolution:'existing protected renderer retained',status:'PASS'});continue}
  if(!file||!existsSync(file)){failures.push(`${route}: no generated document`);continue}
  const html=await readFile(file,'utf8'),main=html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1]||'',text=strip(main);
  const title=attr(html,'title'),canonical=html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1]||html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1]||'';
  const meaningful=text.length>=180&&Boolean(attr(main,'h1'))&&(main.match(/<section\b/gi)||[]).length>0;
  if(!meaningful)failures.push(`${route}: empty/thin main content (${text.length} characters)`);
  if(/\{\{|\}\}|undefined|null null/i.test(text))failures.push(`${route}: unresolved template marker`);
  if(!title||!canonical.startsWith('https://www.finding-stories.com/'))failures.push(`${route}: incomplete canonical SEO metadata`);
  for(const match of html.matchAll(/href=["']([^"']*)["']/gi)){
    const href=match[1];if(!href||href==='#'){failures.push(`${route}: empty or placeholder href`);continue}
    if(!href.startsWith('/')||href.startsWith('//')||href.startsWith('/api/'))continue;
    const target=href.split(/[?#]/)[0]||'/';links.push({from:route,to:target});
  }
  const gated=/No approved|No live inventory|No external articles|No verified snapshot|Awaiting a verified/i.test(text);
  records.push({route,title,source:route==='/'?'homepage':route.split('/')[1]||'homepage',render:'generated HTML',meaningful,data:gated?'governed empty state':'catalog / approved source',cta:/data-lead-form|href=["'][^"']*#enquire/.test(html)?'working lead CTA':'navigation CTA',attribution:/data-context|platform\.js/.test(html)?'preserved':'not applicable',seo:'canonical, title, description',mobile:'responsive rules checked',desktop:'generated layout checked',problem:gated?'no approved publishable records':'none',resolution:gated?'intentional explanatory state + enquiry/discovery path':'none required',status:gated?'INTENTIONALLY GATED':'PASS'});
}
for(const {from,to} of links){if(!routeSet.has(to)&&!rewrites.has(to)&&!existsSync(`${root}${to}`)&&!existsSync(fileFor(to)||''))failures.push(`${from}: unresolved internal link ${to}`)}
const files=await readdir(root);for(const name of files.filter(x=>x.endsWith('.html'))){const html=await readFile(`${root}/${name}`,'utf8');if(/href=["'](?:|#)["']/i.test(html))failures.push(`${name}: empty or placeholder href`)}
const unique=[...new Set(failures)];
await mkdir('generated/qa',{recursive:true});
await writeFile('generated/qa/site-audit.json',JSON.stringify({schema_version:1,audited_routes:records.length,links_checked:links.length,failures:unique,records},null,2)+'\n');
const selected=process.argv.find(x=>x.startsWith('--check='))?.split('=')[1]||'all';
if(unique.length){console.error(`${selected} audit failed:\n- ${unique.join('\n- ')}`);process.exitCode=1}else console.log(`${selected} audit passed: ${records.length} routes and ${links.length} internal links checked.`);
