import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {promisify} from 'node:util';
import {assertGeneratorOutputPath,assertGeneratorOwnsRoute,PAGE_OWNERSHIP} from '../platform/page-ownership.js';
import {renderAziziFlorence} from '../api/_lib/azizi-florence.js';

const execFileAsync=promisify(execFile);
const digest=async path=>createHash('sha256').update(await readFile(path)).digest('hex');

test('Florence protected files match the reviewed production contract',async()=>{
  const contract=JSON.parse(await readFile('platform/protected-pages.json','utf8')).pages['/azizi-florence'];
  assert.equal(contract.restorationSource,'e24bf57');
  for(const [path,expected] of Object.entries(contract.files))assert.equal(await digest(path),expected,`${path} changed: authorize and review the bespoke Florence contract explicitly`);
});

test('generic generators are denied Florence routes, code, styles, scripts and media',()=>{
  assert.equal(PAGE_OWNERSHIP['/azizi-florence'].kind,'PROTECTED_BESPOKE');
  assert.throws(()=>assertGeneratorOwnsRoute('/azizi-florence'),/cannot write protected route/);
  for(const path of ['api/_lib/azizi-florence.js','api/_lib/azizi-florence-page.js','public/azizi-florence.css','public/azizi-florence.js','public/assets/azizi-florence/hero.webp'])assert.throws(()=>assertGeneratorOutputPath(path),/cannot write protected output/);
});

test('platform generation cannot mutate protected Florence output',async()=>{
  const contract=JSON.parse(await readFile('platform/protected-pages.json','utf8')).pages['/azizi-florence'];
  const before=Object.fromEntries(await Promise.all(Object.keys(contract.files).map(async path=>[path,await digest(path)])));
  await execFileAsync(process.execPath,['scripts/generate-platform.mjs']);
  for(const [path,expected] of Object.entries(before))assert.equal(await digest(path),expected,`${path} was mutated by platform generation`);
});

test('Florence structure retains the complete flagship journey and isolated stylesheet',async()=>{
  const template=await readFile('api/_lib/azizi-florence.js','utf8');
  for(const marker of ['class="hero','PROJECT OVERVIEW','id="residences"','id="payment"','buyer-guide','class="amenities','location-section','id="enquire"','<footer>'])assert.match(template,new RegExp(marker));
  assert.match(template,/href="\/azizi-florence\.css"/);
  assert.doesNotMatch(template,/platform\.css/);
});

test('standard project output has no empty media slots, pathological section heights or unconditional optional CTAs',async()=>{
  const [generator,css,chelsea,serene]=await Promise.all([
    readFile('scripts/generate-platform.mjs','utf8'),readFile('public/platform.css','utf8'),
    readFile('public/projects-chelsea-residences.html','utf8'),readFile('public/projects-the-serene-sobha-central.html','utf8')
  ]);
  assert.doesNotMatch(css,/\.project-experience[^}]*min-height:\s*(?:[1-9]\d{3,}px|1000px)/);
  assert.doesNotMatch(chelsea,/<(?:img|picture|figure)[^>]*(?:src=""|>\s*<\/figure>)/);
  assert.match(chelsea,/project-hero-fallback/);
  assert.match(serene,/data-project-cta="floor_plans"/);
  assert.doesNotMatch(chelsea,/data-project-cta="floor_plans"/);
  assert.match(generator,/p\.mediaGroups\.floorPlans\.length\?/);
  const {PUBLISHED_PROJECTS}=await import('../platform/catalog.js');
  for(const project of PUBLISHED_PROJECTS.filter(item=>item.slug!=='azizi-florence')){
    const html=await readFile(`public/projects-${project.slug}.html`,'utf8');
    for(const landmark of ['project-hero','project-snapshot','project-story','project-residences','project-location','buyer-considerations','provenance','project-conversion','site-footer'])assert.match(html,new RegExp(landmark),`${project.slug}: ${landmark}`);
    assert.doesNotMatch(html,/src=""|<figure>\s*<\/figure>|undefined|null null/,project.slug);
  }
  for(const breakpoint of ['@media(max-width:980px)','@media(max-width:620px)'])assert.ok(css.includes(breakpoint),breakpoint);
  assert.match(css,/\.project-experience\{overflow-x:clip\}/);
});


test('Florence rendered output and responsive dimensions match the approved visual contract',async()=>{
  const contract=JSON.parse(await readFile('platform/protected-pages.json','utf8')).pages['/azizi-florence'];
  const project={id:'florence-contract-project',name:'Azizi Florence',developer:'Azizi Developments',area:'Sharjah',emirate:'Sharjah',description:'Approved Florence contract description for deterministic output.',payment_plan_summary:'30% during construction / 70% on handover',handover:'2029-12-31',attributes:{amenities:'Private garden; Clubhouse',location_facts:'Direct road connectivity'}};
  const campaign={id:'florence-contract-campaign',name:'Florence contract'};
  const units=[{unit_type:'3 bedroom townhouse',property_type:'Townhouse',bedrooms:3,minimum_area:2700,maximum_area:3100,starting_price:1890000,price_currency:'AED',review_status:'verified',is_test:false}];
  const html=renderAziziFlorence({project,campaign,units,sources:[],origin:'https://www.finding-stories.com',whatsappNumber:'971505256750'}).replace(/© \d{4}/,'© YEAR');
  assert.equal(createHash('sha256').update(html).digest('hex'),contract.renderedOutputSha256);
  const css=await readFile('public/azizi-florence.css','utf8');
  for(const rule of contract.visualContract.requiredCss)assert.match(css,new RegExp(rule));
  for(const forbidden of contract.visualContract.forbiddenCss)assert.doesNotMatch(css,new RegExp(forbidden));
  for(const width of ['1440','1024','768','390'])assert.ok(contract.visualContract.viewports[width]);
});

test('homepage and every governed project card use only their own approved hero or branded state',async()=>{
  const home=await readFile('index.html','utf8');
  assert.match(home,/<a href="\/azizi-florence"><div class="project-image">[\s\S]*?<img src="\/assets\/azizi-florence\/hero\.webp"[^>]*alt="Azizi Florence townhouse and villa community exterior"/);
  assert.match(await readFile('public/platform.css','utf8'),/\.project-image>img\{position:absolute;inset:0/);
  for(const project of (await import('../platform/catalog.js')).PUBLISHED_PROJECTS){
    const cardPattern=new RegExp(`<a href="${project.path.replaceAll('/','\\/')}"><div class="project-image">([\\s\\S]*?)<span class="badge">`);
    const card=home.match(cardPattern)?.[1];
    assert.ok(card,`${project.slug} homepage card is missing`);
    const hero=project.mediaGroups.hero;
    if(hero)assert.match(card,new RegExp(`(?:src|srcset)="${hero.path.replaceAll('/','\\/')}`),`${project.slug} governed hero is missing`);
    else if(project.image)assert.match(card,new RegExp(`src="${project.image.replaceAll('/','\\/')}`),`${project.slug} approved hero is missing`);
    else assert.match(card,/project-image-placeholder/,`${project.slug} requires an intentional branded state`);
  }
});
