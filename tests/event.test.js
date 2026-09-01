import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adminEventSchema, fallbackEvent, normalizeUaePhone, rsvpSchema } from '../api/_lib/event.js';
import { persistRsvp } from '../api/events/rsvp.js';

test('UAE phone numbers are normalized and invalid values rejected',()=>{
  assert.equal(normalizeUaePhone('050 123 4567'),'971501234567');
  assert.equal(normalizeUaePhone('+971-50-123-4567'),'971501234567');
  assert.throws(()=>normalizeUaePhone('1234'));
});
test('RSVP validation requires consent, event date, slot and idempotency key',()=>{
  const base={full_name:'Test Guest',phone:'0501234567',event_id:'0d9aa2cc-4ced-4be9-b4e2-f17fc17d1ad7',preferred_event_date:'2026-08-08',preferred_slot:'9f0fef46-c1e1-4eca-b8f7-47e5593b0732',idempotency_key:'6a1d02ac-1f96-4f69-90cc-a16a30c3a4f7',consent:true};
  assert.equal(rsvpSchema.safeParse(base).success,true);
  assert.equal(rsvpSchema.safeParse({...base,consent:false}).success,false);
  assert.equal(rsvpSchema.safeParse({...base,preferred_event_date:'not-a-date'}).success,false);
});
test('deterministic event qualification is bounded and produces every message',()=>{
 const q=fallbackEvent({full_name:'Guest',preferred_slot:'x',purchase_timeline:'Immediate / ready',budget:'AED 2M',payment_method:'Cash',purpose:'Investment',property_type:'Villa',owns_uae_property:'yes',preferred_event_date:'2026-08-08'});
 assert.ok(q.lead_score>=0&&q.lead_score<=100);assert.equal(q.temperature,'Hot');
 for(const key of ['suggested_call_opener','personalised_whatsapp_invitation','appointment_confirmation_message','reminder_message','no_show_follow_up_message'])assert.ok(q[key]);
});
test('admin mutation allowlist rejects arbitrary stages and fields',()=>{
 assert.equal(adminEventSchema.safeParse({action:'status',id:'9f0fef46-c1e1-4eca-b8f7-47e5593b0732',status:'booked',lost_reason:''}).success,true);
 assert.equal(adminEventSchema.safeParse({action:'status',id:'9f0fef46-c1e1-4eca-b8f7-47e5593b0732',status:'hacked',lost_reason:''}).success,false);
});
test('migration uses a locked transactional capacity function and idempotent DDL',async()=>{
 const sql=await readFile('database/migrations/003_event_rsvp.sql','utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS event_slots/);assert.match(sql,/FOR UPDATE/);assert.match(sql,/booked_count < capacity/);assert.match(sql,/CREATE OR REPLACE FUNCTION confirm_event_slot/);assert.match(sql,/ON CONFLICT\(event_id,starts_at\) DO NOTHING/);
});
test('public form and admin event routes are present',async()=>{
 const page=await readFile('open-house.html','utf8'),admin=await readFile('event-admin.html','utf8');assert.match(page,/Event date/);assert.match(page,/Contacting me|contacting me/i);assert.match(admin,/Associate performance/);assert.match(admin,/CSV import/);
});

test('event admin operations share one Hobby-plan-compatible function',async()=>{
 const source=await readFile('api/admin/events.js','utf8');
 assert.match(source,/\['GET','PATCH','POST'\]/);
 assert.match(source,/action==='export'/);
 assert.match(source,/isSameOrigin/);
 const frontend=await readFile('public/event-admin.js','utf8');
 assert.doesNotMatch(frontend,/api\/admin\/events\/(update|import|export)/);
});

test('RSVP capture checks normalized contact duplicates and idempotency before reserving',async()=>{
 const source=await readFile('api/events/rsvp.js','utf8');
 assert.match(source,/contact_duplicate AS/);
 assert.match(source,/NOT EXISTS\(SELECT 1 FROM retry\)/);
 assert.match(source,/x\.phone=\$\{phone\}/);
});

test('RSVP persistence is one Neon-compatible statement and does not await AI',async()=>{
 const source=await readFile('api/events/rsvp.js','utf8');
 assert.match(source,/WITH selected AS/);
 assert.match(source,/UPDATE event_slots slot SET booked_count=slot\.booked_count\+1/);
 assert.match(source,/INSERT INTO leads\(submission_id/);
 assert.match(source,/ON CONFLICT \(submission_id\) WHERE submission_id IS NOT NULL DO NOTHING/);
 assert.match(source,/if\(!saved\.duplicate\)scheduleQualification/);
 assert.doesNotMatch(source,/await scheduleQualification/);
 assert.doesNotMatch(source,/ensureEventSchema/);
});

test('RSVP transaction explicitly types nullable email and schema-bound parameters',async()=>{
 let query='';
 const sql=async(strings,...values)=>{
  query=strings.reduce((text,part,index)=>text+part+(index<values.length?`$${index+1}`:''),'');
  return [{result:'saved'}];
 };
 await persistRsvp(sql,{
  event_id:'0d9aa2cc-4ced-4be9-b4e2-f17fc17d1ad7',
  preferred_slot:'9f0fef46-c1e1-4eca-b8f7-47e5593b0732',
  preferred_event_date:'2026-08-21',
  idempotency_key:'6a1d02ac-1f96-4f69-90cc-a16a30c3a4f7',
  full_name:'Synthetic Guest',email:null
 },'971501234567');

 // PostgreSQL raises 42P18 for an untyped bind used only as `$n IS NOT NULL`.
 // This mirrors the production no-email request while also guarding UUID/date/JSON inputs.
 assert.doesNotMatch(query,/\$\d+ IS NOT NULL/);
 assert.match(query,/\(\$\d+::text IS NOT NULL AND lower\(x\.email\)=lower\(\$\d+::text\)\)/);
 assert.match(query,/s\.id=\$\d+::uuid AND e\.id=\$\d+::uuid/);
 assert.match(query,/::date/);
 assert.match(query,/jsonb_build_object\('preferred_slot',\$\d+::uuid/);
});

test('production workflow performs write-path RSVP acceptance through the deployed API',async()=>{
 const workflow=await readFile('.github/workflows/production.yml','utf8');
 const acceptance=await readFile('scripts/acceptance-rsvp.mjs','utf8');
 assert.match(workflow,/npm run acceptance:production/);
 assert.doesNotMatch(workflow,/DATABASE_URL/);
 for(const check of ['rsvp_persisted','lead_associated','activity_persisted','booked_count','duplicate'])assert.match(acceptance,new RegExp(check));
 assert.match(acceptance,/slots\?test=true/);
 assert.match(acceptance,/checks\?\.api/);assert.match(acceptance,/checks\?\.database/);
});

test('RSVP failures have safe codes and browser/server timeouts',async()=>{
 const api=await readFile('api/events/rsvp.js','utf8'),frontend=await readFile('public/open-house.js','utf8'),ai=await readFile('api/_lib/event-qualify.js','utf8');
 for(const code of ['VALIDATION_ERROR','INVALID_PHONE','SLOT_UNAVAILABLE','CONTACT_DUPLICATE','PERSISTENCE_UNAVAILABLE'])assert.match(api,new RegExp(code));
 assert.match(frontend,/AbortController/);assert.match(frontend,/12000/);assert.match(ai,/AbortSignal\.timeout\(timeoutMs\)/);
 assert.doesNotMatch(api,/request body|full_name.*console|phone.*console|email.*console/i);
});

test('meeting confirmation cannot consume capacity from another event',async()=>{
 for(const file of ['api/_lib/db.js','database/migrations/003_event_rsvp.sql']){
  const source=await readFile(file,'utf8');
  assert.match(source,/SELECT confirmed_slot,event_id INTO old_slot,rsvp_event/);
  assert.match(source,/id=p_slot AND event_id=rsvp_event AND active/);
 }
});

test('event dashboard exposes operational counts, requested demand and CSV meeting fields',async()=>{
 const api=await readFile('api/admin/events.js','utf8');
 for(const field of ['test_records','pending_confirmation','qualified','requested_count','confirmed_meeting']) assert.match(api,new RegExp(field));
 const frontend=await readFile('public/event-admin.js','utf8');
 assert.match(frontend,/High-intent \/ qualified/);
 assert.match(frontend,/capacity remaining/);
 assert.match(frontend,/function csvCells/);
});

test('reusable event migration is additive and seeds an isolated idempotent test event',async()=>{
 const sql=await readFile('database/migrations/004_reusable_events.sql','utf8');
 for(const field of ['address','opening_time','closing_time','slot_duration_minutes','developers_projects','public_description','is_test','archived_at']) assert.match(sql,new RegExp(`ADD COLUMN IF NOT EXISTS ${field}`));
 assert.match(sql,/Finding Stories System Test Event/);assert.match(sql,/dubai_today \+ 1/);assert.match(sql,/dubai_today \+ 2/);
 assert.match(sql,/WHERE NOT EXISTS \(SELECT 1 FROM events WHERE is_test/);assert.doesNotMatch(sql,/DROP|TRUNCATE|DELETE FROM/i);
 assert.match(sql,/finding-stories-system-test-' \|\| to_char\(dubai_today,'YYYYMMDD'\)/);
 assert.match(sql,/ends_on >= dubai_today/);assert.match(sql,/s\.starts_at>NOW\(\)/);
});

test('public event endpoints select active database events and reject past slots',async()=>{
 const slots=await readFile('api/events/slots.js','utf8'),rsvp=await readFile('api/events/rsvp.js','utf8');
 assert.match(slots,/status IN \('OPEN','TEST'\)/);assert.match(slots,/No upcoming event is currently open for RSVP/);
 assert.doesNotMatch(slots,/ensureEventSchema|ensureTestEvent/);
 assert.match(rsvp,/e\.id=\$\{r\.event_id\}/);assert.match(rsvp,/s\.starts_at>NOW\(\)/);assert.match(rsvp,/is_test/);
 for(const source of [slots,rsvp])assert.doesNotMatch(source,/dubai-open-house-august-2026/);
});
