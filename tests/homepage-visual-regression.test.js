import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('featured opportunity keeps discovery links outside the project grid', async () => {
  const home = await read('index.html');
  const featured = home.match(/<div class="featured-layout">([\s\S]+?)<\/div><\/div><\/section><section class="section dark moment">/)?.[1] ?? '';
  assert.match(featured, /<div class="featured-projects">/);
  assert.match(featured, /<aside class="featured-discovery"/);
  assert.ok(featured.indexOf('<!-- PROJECT_DISCOVERY_END -->') < featured.indexOf('<aside class="featured-discovery"'));
  assert.doesNotMatch(featured.match(/<div class="project-grid">([\s\S]+?)<\/div><!-- PROJECT_DISCOVERY_END -->/)?.[1] ?? '', /editorial-card/);
});

test('homepage references managed official branding and keeps banner registered only', async () => {
  const [home, assets] = await Promise.all([read('index.html'), read('public/assets/brand/assets.json')]);
  assert.match(home, /\/assets\/brand\/finding-stories-master-logo\.png/);
  assert.doesNotMatch(home, /finding-stories-logo\.svg/);
  const registry = JSON.parse(assets);
  assert.equal(registry.homepage_usage.header, 'master_logo');
  assert.equal(registry.homepage_usage.premium_banner, 'registered_only');
});

test('protected homepage lead form contract remains present', async () => {
  const [home, client] = await Promise.all([read('index.html'), read('public/platform.js')]);
  assert.match(home, /<form class="form-card" data-lead-form/);
  assert.match(home, /name="consent" type="checkbox" required/);
  assert.match(client, /fetch\('\/api\/leads'/);
});

test('approved brand binaries materialize byte-for-byte from tracked text sources', async () => {
  const {createHash} = await import('node:crypto');
  const {readFile,rm,access} = await import('node:fs/promises');
  const {execFile} = await import('node:child_process');
  const {promisify} = await import('node:util');
  const {MATERIALIZED_BRAND_ASSETS} = await import('../scripts/materialize-brand-assets.mjs');
  const hash = value => createHash('sha256').update(value).digest('hex');
  for(const asset of MATERIALIZED_BRAND_ASSETS)await rm(asset.output,{force:true});
  await promisify(execFile)(process.execPath,['scripts/materialize-brand-assets.mjs']);
  for(const asset of MATERIALIZED_BRAND_ASSETS){
    const encoded = (await readFile(asset.source,'utf8')).replace(/\s/g,'');
    const expected = Buffer.from(encoded,'base64');
    const materialized = await readFile(asset.output);
    assert.equal(hash(materialized),hash(expected));
    await rm(asset.output,{force:true});
  }
  await promisify(execFile)(process.execPath,['scripts/materialize-brand-assets.mjs']);
  for(const asset of MATERIALIZED_BRAND_ASSETS)await access(asset.output);
});
