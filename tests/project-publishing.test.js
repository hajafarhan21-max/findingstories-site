import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PROJECT_LIFECYCLE,publicationDecision} from '../platform/project-publishing.js';
import {loadPublicProjects} from '../project-launch/registry.js';
import {PROJECT_COLLECTION_ROUTES,projectsFor} from '../platform/catalog.js';

const florence=()=>readFile('projects/azizi-florence/manifest.json','utf8').then(JSON.parse);
test('project publishing follows the controlled lifecycle and gates every non-published state',async()=>{
  assert.deepEqual(PROJECT_LIFECYCLE,['DRAFT','RESEARCHED','VERIFIED','APPROVED','PUBLISHED','ARCHIVED']);
  const record=await florence();
  assert.equal(publicationDecision(record).public,true);
  for(const state of PROJECT_LIFECYCLE.filter(value=>value!=='PUBLISHED')){
    const candidate=JSON.parse(JSON.stringify(record));candidate.platform.governance.publish_state=state;
    assert.equal(publicationDecision(candidate).public,false,state);
  }
});
test('source evidence and verified confidence are mandatory for publication',async()=>{
  const record=await florence();
  for(const mutate of [r=>r.platform.governance.source_references=[],r=>r.platform.governance.data_confidence='moderate',r=>r.platform.governance.verification_status='RESEARCHED']){
    const candidate=JSON.parse(JSON.stringify(record));mutate(candidate);assert.equal(publicationDecision(candidate).public,false);
  }
});
test('Florence remains in the strict manifest registry while project guides add discovery relationships',async()=>{
  const projects=await loadPublicProjects();assert.deepEqual(projects.map(x=>x.slug),['azizi-florence']);
  assert.equal(projectsFor({developer:'azizi-developments'}).length,1);
  assert.equal(projectsFor({area:'sharjah'}).length,2);
  assert.equal(projectsFor({propertyType:'townhouses'}).length,2);
});
test('required project collections are canonical and generated without invented inventory',async()=>{
  assert.deepEqual(PROJECT_COLLECTION_ROUTES,['/projects/new-launches','/projects/pre-launch','/projects/off-plan','/projects/under-construction','/projects/ready','/projects/resale']);
  const [xml,prelaunch,ready]=await Promise.all([readFile('public/sitemap.xml','utf8'),readFile('public/projects-pre-launch.html','utf8'),readFile('public/projects-ready.html','utf8')]);
  for(const route of PROJECT_COLLECTION_ROUTES)assert.match(xml,new RegExp(`<loc>https://www.finding-stories.com${route}</loc>`));
  assert.match(prelaunch,/Azizi Florence/);assert.doesNotMatch(ready,/data-project data-area=/);
});
test('inventory enquiry client preserves project, page and UTM attribution in protected lead API submissions',async()=>{
  const client=await readFile('public/platform.js','utf8');
  for(const token of ["fetch('/api/leads'",'utm_campaign','landing_page','acquisition_project','first_touch_attribution','latest_touch_attribution'])assert.ok(client.includes(token),token);
});
test('flagship exposes all buyer CTAs through the existing attributed funnel',async()=>{
  const page=await readFile('api/_lib/azizi-florence.js','utf8');
  for(const cta of ['Request Details','Get Payment Plan','Request Floor Plans','Book Private Consultation'])assert.ok(page.includes(cta),cta);
  assert.match(page,/data-conversion="payment_plan_request"/);assert.match(page,/data-conversion="brochure_request"/);assert.match(page,/data-conversion="consultation"/);
});
