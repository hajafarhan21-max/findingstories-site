import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PUBLISHED_PROJECTS} from '../platform/catalog.js';

test('verified project records remain useful project guides when availability is unknown',async()=>{
  assert.equal(PUBLISHED_PROJECTS.length,18);
  assert.equal(PUBLISHED_PROJECTS.filter(project=>project.currentAvailability!=='UNVERIFIED').length,PUBLISHED_PROJECTS.filter(project=>project.slug!=='azizi-florence').length);
  for(const project of PUBLISHED_PROJECTS.filter(project=>project.slug!=='azizi-florence')){
    const html=await readFile(`public/projects-${project.slug}.html`,'utf8');
    assert.match(html,/PROJECT GUIDE/);
    assert.match(html,/Current availability requires confirmation/);
    assert.doesNotMatch(html,/SOURCE_NOT_FOUND|SOURCE_NOT_PUBLISHED|VERIFIED_AND_PUBLISHED|Confirm privately|Floor plan not published/);
    assert.doesNotMatch(html,/No approved match yet|records that have cleared publication controls/);
  }
});

test('homepage conversations provides useful navigation instead of a blank video state',async()=>{
  const html=await readFile('index.html','utf8');
  const section=html.match(/UAE PROPERTY CONVERSATIONS[\s\S]*?learn-preview/)?.[0]??'';
  assert.match(section,/UAE market insights/);
  assert.match(section,/Where to invest/);
  assert.match(section,/How to invest/);
  assert.doesNotMatch(section,/No editorially approved videos|<div class="empty">/);
});

test('manual DLD snapshot is materialized for the production intelligence client',async()=>{
  const build=await readFile('scripts/build.mjs','utf8');
  const importer=await readFile('scripts/import-dld-csv.mjs','utf8');
  assert.match(build,/generated\/intelligence\/dld/);
  assert.match(importer,/dld-dataset-coverage\.json/);
  assert.match(importer,/sourceFilename/);
  assert.match(importer,/rejection_reasons/);
});
