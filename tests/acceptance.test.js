import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAcceptance } from '../api/_lib/auth.js';
import { acceptanceQuerySchema, acceptanceUpdateSchema } from '../api/_lib/acceptance.js';
import { requestWithTimeout } from '../scripts/acceptance-http.mjs';

const request = token => ({ headers:{ authorization:token ? `Bearer ${token}` : '' } });

test('acceptance authentication requires a separate strong exact bearer credential',()=>{
  const secret='acceptance-only-secret-with-32-plus-characters';
  assert.equal(isAcceptance(request(secret),{ACCEPTANCE_TEST_SECRET:secret}),true);
  assert.equal(isAcceptance(request('wrong-secret-with-32-plus-characters'),{ACCEPTANCE_TEST_SECRET:secret}),false);
  assert.equal(isAcceptance(request(secret),{}),false);
  assert.equal(isAcceptance(request('short'),{ACCEPTANCE_TEST_SECRET:'short'}),false);
});

test('acceptance input permits only the narrow synthetic workflow',()=>{
  const id='11111111-1111-4111-8111-111111111111';
  for(const value of [
    {action:'assign',rsvp_id:id,assigned_to:'Test RM'},
    {action:'status',rsvp_id:id,status:'contacted'},
    {action:'meeting',rsvp_id:id,slot_id:id},
    {action:'site_visit',rsvp_id:id,scheduled_at:'2026-08-22T10:00:00.000Z'},
    {action:'activity',rsvp_id:id,activity_type:'note',details:'test'},
    {action:'archive',rsvp_id:id}
  ])assert.equal(acceptanceUpdateSchema.safeParse(value).success,true);
  for(const action of ['save_event','import','delete','admin_session'])assert.equal(acceptanceUpdateSchema.safeParse({action,rsvp_id:id}).success,false);
  assert.equal(acceptanceQuerySchema.safeParse({event_id:id,action:'export'}).success,true);
  assert.equal(acceptanceQuerySchema.safeParse({action:'inspect'}).success,false);
});

test('every acceptance data path is rooted in both TEST event and TEST RSVP predicates',async()=>{
  const source=await readFile('api/acceptance/events.js','utf8');
  assert.doesNotMatch(source,/isAdmin|createSession|ADMIN_PASSWORD|fs_admin/);
  assert.match(source,/if\(!isAcceptance\(req\)\)return denied/);
  assert.doesNotMatch(source,/FROM event_rsvps r(?![\s\S]{0,180}r\.is_test=TRUE)/);
  assert.doesNotMatch(source,/UPDATE event_rsvps r(?![\s\S]{0,500}r\.is_test=TRUE)/);
  assert.doesNotMatch(source,/FROM events WHERE id=\$\{eventId\}::uuid(?! AND is_test=TRUE)/);
  assert.doesNotMatch(source,/ensureSchema|ensureEventSchema/);
  for(const operation of ['assign','status','meeting','site_visit','activity','archive'])assert.match(source,new RegExp(`value\\.action==='${operation}'`));
});

test('production acceptance uses no human admin credential and archives its one synthetic row',async()=>{
  const [script,workflow]=await Promise.all([readFile('scripts/acceptance-production.mjs','utf8'),readFile('.github/workflows/production.yml','utf8')]);
  assert.doesNotMatch(script,/ADMIN_PASSWORD|\/api\/admin\/login|Cookie/);
  assert.match(script,/Authorization:`Bearer \$\{secret\}`/);
  assert.match(script,/action:'archive',rsvp_id:created\.data\.id/);
  assert.match(script,/try\{[\s\S]+\}finally\{/);
  assert.match(workflow,/secrets\.ACCEPTANCE_TEST_SECRET/);
  assert.match(workflow,/npm run acceptance:production/);
  assert.match(workflow,/ACCEPTANCE_BASE_URL: https:\/\/www\.finding-stories\.com/);
  assert.match(script,/https:\/\/www\.finding-stories\.com/);
  assert.match(script,/timeoutMs:60000/);
  assert.match(script,/retries:options\.method\?0:2/);
});

test('acceptance requests tolerate cold starts and retry safe inspection failures',async()=>{
  const calls=[];
  const response={ok:true};
  const result=await requestWithTimeout('https://test.invalid/inspect',{}, {
    timeoutMs:60000,retries:2,backoffMs:10,sleep:async ms=>calls.push(['sleep',ms]),
    fetchImpl:async (_url,options)=>{calls.push(['fetch',options.signal]);if(calls.filter(x=>x[0]==='fetch').length===1)throw new Error('cold start');return response;}
  });
  assert.equal(result,response);
  assert.equal(calls.filter(x=>x[0]==='fetch').length,2);
  assert.deepEqual(calls.find(x=>x[0]==='sleep'),['sleep',10]);
});

test('acceptance request reports timeout after exhausting its retry budget',async()=>{
  let attempts=0;
  await assert.rejects(requestWithTimeout('https://test.invalid/inspect',{}, {
    timeoutMs:60000,retries:1,backoffMs:1,sleep:async()=>{},
    fetchImpl:async()=>{attempts++;const error=new Error('timed out');error.name='TimeoutError';throw error;}
  }),/GET request failed.*TimeoutError: timed out/);
  assert.equal(attempts,2);
});
