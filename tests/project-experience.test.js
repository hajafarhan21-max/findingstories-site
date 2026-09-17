import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PUBLISHED_PROJECTS} from '../platform/catalog.js';
import {approvedMedia,enrichProject,projectPublicationDecision,projectTheme,publicReadyProjects} from '../platform/project-experience.js';

test('homepage discovery is a bounded responsive three/two/one card grid',async()=>{
  const css=await readFile('public/platform.css','utf8');
  assert.match(css,/\.featured-projects \.project-grid\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}/);
  assert.match(css,/\.featured-projects \.project-grid,.featured-discovery\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(css,/\.featured-projects \.project-grid,.featured-discovery\{grid-template-columns:1fr\}/);
  assert.match(css,/\.project-image\{aspect-ratio:4\/3/);
});

test('publication gate requires content, provenance and an approved visual or branded fallback',()=>{
  const project=PUBLISHED_PROJECTS.find(item=>item.slug==='yas-riva');
  assert.deepEqual(projectPublicationDecision(project),{public:true,reason:'PUBLIC_READY'});
  assert.equal(projectPublicationDecision({...project,qualityState:'draft'}).public,false);
  assert.equal(projectPublicationDecision({...project,media:[],visualFallback:'NONE'}).reason,'VISUAL_NOT_GOVERNED');
  assert.equal(projectPublicationDecision({...project,startingPrice:100}).reason,'UNVERIFIED_COMMERCIAL_VALUE');
});

test('media provenance is mandatory and unverified media is excluded',()=>{
  const media={sourceUrl:'https://example.com',sourceType:'OFFICIAL',reviewedAt:'2026-09-15',projectSlug:'example',usageState:'APPROVED',verificationState:'VERIFIED'};
  assert.equal(approvedMedia([media]).length,1);
  assert.equal(approvedMedia([{...media,usageState:'PENDING'},{}]).length,0);
});

test('themes are project-specific and enrichment never fabricates commercial values',()=>{
  assert.notDeepEqual(projectTheme('yas-riva'),projectTheme('terra-gardens'));
  const project=enrichProject({slug:'example',name:'Example',developer:'Developer',area:'Area',emirate:'Dubai',summary:'A sufficiently useful project overview for a governed record.',propertyTypes:['Apartments'],bedrooms:['1'],unitTypes:['1 bedroom apartments'],source:{url:'https://example.com',retrieved:'2026-09-15'},startingPrice:null,handover:null,paymentPlan:null});
  assert.deepEqual(project.commercial,{startingPrice:null,paymentPlan:null,booking:null,fees:null,handover:null,status:undefined,availability:'REQUIRES_CONFIRMATION',verifiedAt:'2026-09-15'});
});

test('only public-ready records feed canonical discovery and enquiry attribution',async()=>{
  assert.equal(publicReadyProjects(PUBLISHED_PROJECTS).length,PUBLISHED_PROJECTS.length);
  for(const project of PUBLISHED_PROJECTS)assert.match(project.path,/^\/(azizi-florence|projects\/[a-z0-9-]+)$/);
  const yas=await readFile('public/projects-yas-riva.html','utf8');
  assert.match(yas,/data-project-theme="waterside"/);
  assert.match(yas,/project_slug&quot;:|"project_slug":"yas-riva"/);
  assert.match(yas,/SOURCE &amp; CURRENTNESS/);
  assert.doesNotMatch(yas,/<strong>Starting price<\/strong>/);
});

test('Florence remains on its protected renderer and approved assets',async()=>{
  const [template,hero]=await Promise.all([readFile('api/_lib/azizi-florence.js','utf8'),readFile('public/assets/azizi-florence/hero.webp')]);
  assert.match(template,/renderAziziFlorence/);
  assert.ok(hero.length>1000);
});
