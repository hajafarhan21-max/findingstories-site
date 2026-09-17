import test from 'node:test';
import assert from 'node:assert/strict';
import {PROJECT_MEDIA} from '../platform/project-media.js';
import {approvedMedia} from '../platform/project-experience.js';

test('batch-one media is approved, project-specific, official and isolated',()=>{
  assert.deepEqual(Object.keys(PROJECT_MEDIA).sort(),['terra-gardens','the-serene-sobha-central']);
  for(const [slug,items] of Object.entries(PROJECT_MEDIA)){
    assert.equal(items.length,4);
    assert.equal(approvedMedia(items).length,items.length);
    assert.equal(items.filter(item=>item.kind==='hero').length,1);
    for(const item of items){
      assert.equal(item.projectSlug,slug);
      assert.match(item.id,new RegExp(`^${slug}-`));
      assert.match(item.path,new RegExp(`^/assets/projects/${slug}/`));
      assert.match(item.sha256,/^[a-f0-9]{64}$/);
      assert.ok(item.width>=744&&item.height>=548);
      assert.ok(item.sourceUrl.startsWith(slug==='terra-gardens'?'https://uae-cms.emaar.com/':'https://sobharealty.com/'));
    }
  }
});
