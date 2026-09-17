import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {promisify} from 'node:util';
import {assertGeneratorOutputPath,assertGeneratorOwnsRoute,PAGE_OWNERSHIP} from '../platform/page-ownership.js';

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
});
