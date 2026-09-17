import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PROJECT_MEDIA} from '../platform/project-media.js';
import {approvedMedia} from '../platform/project-experience.js';

test('portfolio media is approved, project-specific, official and isolated',()=>{
  assert.deepEqual(Object.keys(PROJECT_MEDIA).sort(),['mar-casa','olfah','sparklz-by-danube','terra-gardens','the-serene-sobha-central','w-residences-dubai-harbour','yas-riva']);
  for(const [slug,items] of Object.entries(PROJECT_MEDIA)){
    assert.ok(items.length>=1);
    assert.equal(approvedMedia(items).length,items.length);
    assert.equal(items.filter(item=>item.kind==='hero').length,1);
    for(const item of items){
      assert.equal(item.projectSlug,slug);
      assert.match(item.id,new RegExp(`^${slug}-`));
      assert.match(item.path,new RegExp(`^/assets/projects/${slug}/`));
      assert.match(item.sha256,/^[a-f0-9]{64}$/);
      assert.ok(item.width>=744&&item.height>=400);
      assert.match(item.sourceType,/^OFFICIAL_DEVELOPER_(PROJECT_PAGE|BROCHURE)$/);
    }
  }
});

test('pinned Olfah source bytes match the approved upstream checksum',async()=>{
  const asset=PROJECT_MEDIA.olfah.find(item=>item.id==='olfah-exterior-1');
  const encoded=await readFile(asset.localSource,'utf8');
  const bytes=Buffer.from(encoded.replace(/\s/g,''),'base64');
  assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);
  assert.equal(asset.sourceUrl,'https://www.alefgroup.ae/wp-content/uploads/2026/05/Community-3.jpg');
});
