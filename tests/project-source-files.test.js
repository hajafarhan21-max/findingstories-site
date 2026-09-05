import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import projectSourceUploadHandler from '../api/_lib/project-source-upload-route.js';
import { createSession } from '../api/_lib/auth.js';
import { PROJECT_SOURCE_LIMITS, detectedMediaType, sourceUploadConfig, validateSourceMetadata } from '../api/_lib/project-source-files.js';

const MB=1024*1024;
const source=(filename,media_type,byte_size)=>({filename,media_type,byte_size});
test('PDF below 100 MB is accepted and PDF above 100 MB is rejected',()=>{
  assert.equal(validateSourceMetadata(source('brochure.pdf','application/pdf',100*MB)),null);
  assert.match(validateSourceMetadata(source('large.pdf','application/pdf',100*MB+1)),/exceeds the 100 MB/);
});
test('spreadsheet below 100 MB is accepted',()=>{
  for(const type of ['text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])assert.equal(validateSourceMetadata(source('inventory',type,99*MB)),null);
});
test('oversized image and unsupported executable are rejected',()=>{
  assert.match(validateSourceMetadata(source('masterplan.png','image/png',50*MB+1)),/exceeds the 50 MB/);
  assert.match(validateSourceMetadata(source('malware.exe','application/x-msdownload',10)),/Unsupported file type/);
});
test('server-side signatures reject extension-only spoofing',()=>{
  assert.equal(detectedMediaType(Buffer.from('%PDF-1.7 fixture')),'application/pdf');
  assert.equal(detectedMediaType(Buffer.from('MZ executable payload')),null);
});
test('configuration exposes one authoritative multi-file policy',()=>{
  const config=sourceUploadConfig();assert.equal(config.max_files,20);assert.equal(config.limits['application/pdf'].mb,100);assert.equal(PROJECT_SOURCE_LIMITS['image/jpeg'],50*MB);
});
test('browser uploads every file independently and preserves partial successes',async()=>{
  const script=await readFile('public/admin.js','utf8');assert.match(script,/Promise\.allSettled\(items\.map\(uploadSourceItem\)\)/);assert.match(script,/filter\(x=>x\.status==='success'\)/);assert.match(script,/data-source-retry/);assert.match(script,/data-source-remove/);
});
test('direct private multipart storage avoids the serverless request body',async()=>{
  const [client,route]=await Promise.all([readFile('client/project-source-upload-client.js','utf8'),readFile('api/_lib/project-source-upload-route.js','utf8')]);assert.match(client,/access:'private'/);assert.match(client,/multipart:true/);assert.match(client,/crypto\.randomUUID/);assert.match(route,/SUPER_ADMIN/);assert.match(route,/Same-origin/);assert.match(route,/addRandomSuffix:true/);
});
test('migration permanently associates private object references without publishing',async()=>{
  const [migration,ingestion]=await Promise.all([readFile('database/migrations/015_large_project_sources.sql','utf8'),readFile('api/_lib/project-ingestion.js','utf8')]);assert.match(migration,/storage_path/);assert.match(migration,/content DROP NOT NULL/);assert.match(ingestion,/review_status='needs_review',active=FALSE/);assert.match(ingestion,/project_sources\(ingestion_id/);
});

test('upload configuration requires authentication and SUPER_ADMIN authorization',async()=>{
  process.env.SESSION_SECRET='u'.repeat(32);
  const run=async(role)=>{const res={headers:{},setHeader(key,value){this.headers[key]=value;},end(body){this.body=JSON.parse(body);}};const cookie=role?`fs_admin=${createSession({id:'test-user',role,display_name:'TEST'})}`:'';await projectSourceUploadHandler({method:'GET',headers:{cookie}},res);return res;};
  assert.equal((await run()).statusCode,401);assert.equal((await run('ADMIN')).statusCode,403);const allowed=await run('SUPER_ADMIN');assert.equal(allowed.statusCode,200);assert.equal(allowed.body.limits['application/pdf'].mb,100);
});
