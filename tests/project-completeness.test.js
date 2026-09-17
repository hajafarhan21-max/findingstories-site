import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PUBLISHED_PROJECTS,projectsFor} from '../platform/catalog.js';
import {STATES,auditProject} from '../scripts/audit-project-completeness.mjs';

test('every published project has a complete, enumerated evidence audit',()=>{
  assert.equal(PUBLISHED_PROJECTS.length,9);
  for(const project of PUBLISHED_PROJECTS){
    const row=auditProject(project);
    for(const [key,value] of Object.entries(row))if(!['slug','name','officialSources','unresolved'].includes(key))assert.ok(STATES.includes(value),`${project.slug}.${key}`);
    assert.ok(row.officialSources.length);
  }
});
test('project media schema exposes governed categories and complete provenance',()=>{
  for(const project of PUBLISHED_PROJECTS){
    for(const key of ['hero','exteriors','interiors','amenities','lifestyle','masterplan','floorPlans','locationMap'])assert.ok(key in project.mediaGroups);
    for(const asset of project.media.filter(x=>x.sha256))for(const key of ['projectSlug','sourceUrl','originalFilename','sha256','width','height','mediaRole','assetType','approvalState','retrievedAt'])assert.ok(asset[key],`${asset.id}.${key}`);
  }
});
test('unknown optional fields do not exclude discovery records',()=>{
  assert.equal(projectsFor({}).length,9);
  assert.equal(projectsFor({price:5000000}).length,9);
  assert.equal(projectsFor({size:1000}).length,9);
  assert.ok(projectsFor({bedrooms:'2'}).length>0);
});
test('default Buy UI retains all cards and only shows empty state for a genuine zero result',async()=>{
  const html=await readFile('public/projects.html','utf8');
  assert.equal((html.match(/data-project data-intent="Buy"/g)||[]).length,9);
  assert.match(html,/<option>Buy<\/option>/);
  assert.match(html,/data-empty hidden/);
  const js=await readFile('public/platform.js','utf8');
  assert.match(js,/if\(!value\)return true/);
  assert.match(js,/\(key==='price'\|\|key==='size'\)&&!raw/);
});
test('project pages do not render empty media placeholders',async()=>{
  for(const project of PUBLISHED_PROJECTS.filter(p=>p.slug!=='azizi-florence')){
    const html=await readFile(`public/projects-${project.slug}.html`,'utf8');
    assert.doesNotMatch(html,/A useful starting point|<div class="unit-plans"><\/div>/);
    assert.match(html,/LOCATION EVIDENCE STATUS|Official project location map/);
  }
});
