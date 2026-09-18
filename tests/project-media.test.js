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
    // A published project's remote hero may be temporarily quarantined when the developer changes
    // integrity-pinned bytes upstream. Keep the registry fail-closed rather than accepting unreviewed media.
    const heroes=items.filter(item=>item.kind==='hero');
    if(slug==='the-serene-sobha-central')assert.ok(heroes.length<=1);
    else assert.equal(heroes.length,1);
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

test('every approved Olfah source is locally pinned with its reviewed checksum',async()=>{
  const expected={
    'olfah-hero':['Group-72743-scaled.jpg',2560,978],
    'olfah-exterior-1':['Community-3.jpg',972,603],
    'olfah-interior-1':['Property-1.jpg',1296,804],
    'olfah-amenity-1':['Community-4.jpg',972,603],
    'olfah-lifestyle-1':['Community-5-2x.jpg',972,603]
  };
  for(const asset of PROJECT_MEDIA.olfah){
    const encoded=await readFile(asset.localSource,'utf8');
    const bytes=Buffer.from(encoded.replace(/\s/g,''),'base64');
    assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,asset.id);
    const [filename,width,height]=expected[asset.id];
    assert.equal(new URL(asset.sourceUrl).pathname.split('/').at(-1),filename);
    assert.deepEqual([asset.width,asset.height],[width,height]);
    assert.match(asset.localSource,new RegExp(`/${asset.id}\\.jpg\\.base64$`));
  }
});
