import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { loadPublicProjects } from '../project-launch/registry.js';

const forbiddenHost=/(?:localhost|vercel\.app|preview)/i;
const unsafeClaims=/\b(?:guaranteed\s+(?:roi|returns?|appreciation)|last chance|act now|limited units? left)\b/i;
const internalId=/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const requiredFiles=['priority-targets.json','submission-queue.json','outreach-queue.json','citation-log.json','publishing-plan.json','weekly-execution.json','social-pack.json','editorial-pack.json','directory-submission-data.json','outreach-templates.json','dashboard-metrics.json'];

test('every approved public project receives the reusable authority package',async()=>{
  for(const project of await loadPublicProjects()){
    const files=await readdir(`generated/authority/${project.slug}`);
    for(const expected of requiredFiles)assert.ok(files.includes(expected),`${project.slug}: ${expected}`);
  }
});

test('authority outputs are review-first, production-only and safely attributed',async()=>{
  const project=(await loadPublicProjects())[0];
  for(const file of requiredFiles){
    const output=JSON.parse(await readFile(`generated/authority/${project.slug}/${file}`,'utf8'));
    const text=JSON.stringify(output);
    assert.doesNotMatch(text,forbiddenHost,file);
    assert.doesNotMatch(text,unsafeClaims,file);
    assert.doesNotMatch(text,internalId,file);
    if(output.review_required)assert.equal(output.canonical_url,`https://www.finding-stories.com${project.path}`);
  }
  const social=JSON.parse(await readFile(`generated/authority/${project.slug}/social-pack.json`,'utf8'));
  for(const [channel,asset] of Object.entries(social.channels)){
    const url=new URL(asset.tracked_url);
    assert.equal(url.origin,'https://www.finding-stories.com');
    assert.equal(url.searchParams.get('utm_campaign'),`${project.slug}-project-launch`);
    for(const key of ['utm_source','utm_medium','utm_campaign','utm_content'])assert.ok(url.searchParams.get(key),`${channel}: ${key}`);
  }
});

test('registry separates opportunities, verified targets and live citations',async()=>{
  const registry=JSON.parse(await readFile('authority/targets.json','utf8'));
  assert.equal(new Set(registry.targets.map(target=>target.target_name)).size,registry.targets.length);
  for(const target of registry.targets){
    assert.equal(target.verification_status,'needs_verification');
    assert.notEqual(target.status,'submitted'); assert.notEqual(target.status,'published');
    assert.equal(target.live_url,null);
    if(target.verification_status==='verified')for(const field of ['domain','submission_url','last_verified_at'])assert.ok(target[field]);
  }
  const citations=JSON.parse(await readFile('generated/authority/azizi-florence/citation-log.json','utf8'));
  assert.deepEqual(citations.records,[]);
  assert.equal(citations.external_action_performed,false);
});

test('business and social identity facts are never invented',async()=>{
  const business=JSON.parse(await readFile('generated/authority/azizi-florence/directory-submission-data.json','utf8'));
  for(const field of ['contact_details','social_profiles','office_address','legal_entity','opening_hours'])assert.equal(business[field],'MISSING');
  const social=JSON.parse(await readFile('generated/authority/azizi-florence/social-pack.json','utf8'));
  assert.doesNotMatch(JSON.stringify(social),/linkedin\.com\/company|instagram\.com\//i);
  assert.equal(social.published,false);
});

test('project claims and campaign remain manifest-driven',async()=>{
  const project=(await loadPublicProjects())[0];
  const editorial=JSON.parse(await readFile(`generated/authority/${project.slug}/editorial-pack.json`,'utf8'));
  assert.equal(editorial.key_verified_facts.developer,project.distribution.verified_developer_name);
  assert.equal(editorial.key_verified_facts.location,project.distribution.verified_location_name);
  assert.deepEqual(editorial.key_verified_facts.residence_mix,project.distribution.property_types);
  assert.equal(editorial.campaign,`${project.slug}-project-launch`);
  assert.match(editorial.source_notes.manifest,new RegExp(`projects/${project.slug}/manifest\\.json`));
});
