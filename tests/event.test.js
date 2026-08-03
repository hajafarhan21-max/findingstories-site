import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { adminEventSchema, fallbackEvent, normalizeUaePhone, rsvpSchema } from '../api/_lib/event.js';

test('UAE phone numbers are normalized and invalid values rejected',()=>{
  assert.equal(normalizeUaePhone('050 123 4567'),'971501234567');
  assert.equal(normalizeUaePhone('+971-50-123-4567'),'971501234567');
  assert.throws(()=>normalizeUaePhone('1234'));
});
test('RSVP validation requires consent, event date, slot and idempotency key',()=>{
  const base={full_name:'Test Guest',phone:'0501234567',preferred_event_date:'2026-08-08',preferred_slot:'9f0fef46-c1e1-4eca-b8f7-47e5593b0732',idempotency_key:'6a1d02ac-1f96-4f69-90cc-a16a30c3a4f7',consent:true};
  assert.equal(rsvpSchema.safeParse(base).success,true);
  assert.equal(rsvpSchema.safeParse({...base,consent:false}).success,false);
  assert.equal(rsvpSchema.safeParse({...base,preferred_event_date:'2026-08-10'}).success,false);
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
 assert.match(source,/\['GET', 'PATCH', 'POST'\]/);
 assert.match(source,/action === 'export'/);
 assert.match(source,/isSameOrigin/);
 const frontend=await readFile('public/event-admin.js','utf8');
 assert.doesNotMatch(frontend,/api\/admin\/events\/(update|import|export)/);
});
