import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { projectManifestSchema } from '../project-launch/schema.js';
import { loadPublicProjects } from '../project-launch/registry.js';
import { renderAziziFlorence } from '../api/_lib/azizi-florence.js';

const unsafe=/\b(guaranteed returns?|guaranteed roi|last chance|act now|official azizi representative|limited units? left)\b/i;

test('approved projects provide safe, reusable distribution inputs',async()=>{
  const raw=JSON.parse(await readFile('projects/azizi-florence/manifest.json','utf8'));
  const manifest=projectManifestSchema.parse(raw);
  assert.ok(manifest.distribution);
  assert.equal(manifest.distribution.verified_developer_name,manifest.project.developer);
  assert.equal(manifest.distribution.verified_location_name,manifest.seo.location);
  assert.doesNotMatch(JSON.stringify(manifest.distribution),unsafe);
  for(const field of ['social_copy_short','social_copy_medium','social_copy_long','linkedin_copy','instagram_caption','facebook_copy','x_copy','directory_summary','citation_summary','outreach_summary','press_summary'])assert.ok(manifest.distribution[field].length>20,field);
});

test('generated kit uses canonical direct links and valid attribution without identifiers',async()=>{
  const output=JSON.parse(await readFile('generated/distribution/azizi-florence.json','utf8'));
  assert.equal(output.review_required,true);assert.equal(output.auto_publish,false);
  for(const [name,url] of Object.entries(output.urls)){
    assert.match(url,/^https:\/\/www\.finding-stories\.com\/azizi-florence/);
    assert.doesNotMatch(url,/vercel\.app|localhost|[0-9a-f]{8}-[0-9a-f-]{27}/i);
    if(name!=='canonical')for(const key of ['utm_source','utm_medium','utm_campaign','utm_content'])assert.ok(new URL(url).searchParams.get(key),`${name}: ${key}`);
  }
  assert.doesNotMatch(JSON.stringify(output),unsafe);
});

test('Florence emits complete social metadata and crawlable sharing controls',async()=>{
  const [project]=await loadPublicProjects();
  const html=renderAziziFlorence({project:{id:'test-project',name:project.name,developer:project.developer,description:project.description},campaign:{id:'test-campaign'},seo:project,origin:'https://www.finding-stories.com'});
  for(const marker of ['og:title','og:description','og:image:width','og:image:height','twitter:card','twitter:title','twitter:description','twitter:image','data-copy-project-link','utm_campaign%3Dazizi-florence-project-launch'])assert.match(html,new RegExp(marker));
  assert.match(html,/rel="canonical" href="https:\/\/www\.finding-stories\.com\/azizi-florence"/);
  assert.doesNotMatch(html,/vercel\.app|localhost/);
});

test('homepage keeps a descriptive project discovery link',async()=>{
  const home=await readFile('index.html','utf8');
  assert.match(home,/href="\/azizi-florence"[^>]*>Review Azizi Florence details/);
});
