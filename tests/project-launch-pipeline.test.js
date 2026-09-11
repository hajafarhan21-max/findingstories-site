import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { inspectImage } from '../project-launch/assets.js';
import { auditManifest } from '../project-launch/qa.js';
import { projectManifestSchema } from '../project-launch/schema.js';

test('Florence manifest records explicit content approvals without bundling replacement binaries',async()=>{
  const manifest=projectManifestSchema.parse(JSON.parse(await readFile('projects/azizi-florence/manifest.json','utf8')));
  assert.equal(manifest.status,'approved');
  assert.deepEqual(manifest.assets.map(x=>x.slot),['amenities','location_map']);
  assert.ok(manifest.assets.every(x=>x.sha256&&x.width>0&&x.height>0&&x.visual_review.confidence===1));
});

test('manifest QA validates bytes and rejects duplicate semantic assignments',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'project-launch-')); const image=join(dir,'map.png');
  await sharp({create:{width:100,height:100,channels:3,background:'#123456'}}).png().toFile(image); const metadata=await inspectImage(image);
  const asset={path:image,slot:'location_map',...metadata,visual_review:{classification:'location_map',confidence:.99,evidence:'Road network, labelled plots and map legend were visually reviewed.',reviewer:'human:qa'}};
  const manifest={schema_version:1,status:'ready_for_preview',project:{slug:'sample',name:'Sample',developer:'Emaar',path:'/projects/emaar/sample'},facts:{},assets:[asset,{...asset,slot:'hero',visual_review:{...asset.visual_review,classification:'hero'}}],rejected_assets:[],lead:{endpoint:'/api/leads',campaign_id:'campaign',project_id:'project'}};
  const file=join(dir,'manifest.json');await writeFile(file,JSON.stringify(manifest));const report=await auditManifest(file);
  assert.ok(report.errors.some(x=>x.code==='DUPLICATE_ASSET_ASSIGNMENT')); assert.ok(report.errors.some(x=>x.code==='PERCEPTUAL_DUPLICATE_ASSIGNMENT'));
});

test('truncated and extension-spoofed images fail byte-level inspection',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'project-launch-'));const fake=join(dir,'location-map.png');await writeFile(fake,'not an image');
  await assert.rejects(inspectImage(fake),/INVALID_IMAGE_MIME/);
});

test('reusable production acceptance is wired and Florence primary enquiry has analytics',async()=>{
  const [runner,template,pkg]=await Promise.all([readFile('project-launch/production-acceptance.js','utf8'),readFile('api/_lib/azizi-florence.js','utf8'),readFile('package.json','utf8')]);
  assert.match(runner,/ASSET_APPROVAL_MISMATCH/);assert.match(runner,/LEAD_PERSISTENCE_OR_IDEMPOTENCY_FAILED/);assert.match(runner,/same_record/);assert.match(runner,/whatsapp_safe/);
  assert.match(template,/class="nav-cta" data-analytics="cta_click"/);assert.equal(JSON.parse(pkg).scripts['acceptance:project'],'node scripts/production-project-acceptance.mjs');
});
