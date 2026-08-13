import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { neonConnectionUrl } from '../api/_lib/db.js';

const base=(process.env.ACCEPTANCE_BASE_URL||'https://finding-stories.com').replace(/\/$/,'');
const connection=neonConnectionUrl();
if(!connection)throw new Error('DATABASE_URL or PRODUCTION_DATABASE_URL is required for persistence verification.');
const sql=neon(connection),created=[];
const request=async(path,options={},timeout=8000)=>{
  const response=await fetch(base+path,{...options,signal:globalThis.AbortSignal.timeout(timeout)});
  const data=await response.json();return{response,data};
};
const submit=async(payload)=>request('/api/events/rsvp',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':payload.idempotency_key},body:JSON.stringify(payload)});
const synthetic=(event,slot,index,key=randomUUID())=>({full_name:`FS SYSTEM ACCEPTANCE ${Date.now()} ${index}`,phone:`050${String(Date.now()+index).slice(-7)}`,email:`fs-acceptance-${Date.now()}-${index}@example.com`,purpose:'Investment',budget:'Under AED 1M',property_type:'Apartment',preferred_area:'Dubai',purchase_timeline:'Immediate / ready',payment_method:'Cash',owns_uae_property:'No',event_id:event.id,preferred_event_date:new Intl.DateTimeFormat('en-CA',{timeZone:event.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(slot.starts_at)),preferred_slot:slot.id,consent:true,idempotency_key:key,source:'system-acceptance'});

const {response:slotsResponse,data}=await request('/api/events/slots');
assert.equal(slotsResponse.ok,true,'slots endpoint failed');
assert.equal(data.event?.is_test,true,'acceptance is restricted to the active TEST event');
const slot=data.slots?.find(value=>Number(value.remaining)>=2);
assert.ok(slot,'a future TEST slot with capacity for two RSVPs is required');
const before=await sql`SELECT booked_count FROM event_slots WHERE id=${slot.id} AND event_id=${data.event.id} AND active AND starts_at>NOW()`;
assert.equal(before.length,1,'selected slot/event pair is not active and future');

const first=synthetic(data.event,slot,1);const started=Date.now(),one=await submit(first);
assert.equal(one.response.status,201,JSON.stringify(one.data));assert.ok(Date.now()-started<8000,'first RSVP exceeded 8 seconds');created.push(one.data.id);
const persisted=await sql`SELECT r.id,r.event_id,r.confirmed_slot,r.qualification_status,l.id lead_id FROM event_rsvps r LEFT JOIN leads l ON l.submission_id=r.id WHERE r.id=${one.data.id} AND r.is_test AND r.archived_at IS NULL`;
assert.equal(persisted.length,1,'RSVP is not visible to Event CRM');assert.ok(persisted[0].lead_id,'associated lead was not persisted');assert.equal(persisted[0].confirmed_slot,slot.id);
const afterFirst=await sql`SELECT booked_count FROM event_slots WHERE id=${slot.id}`;assert.equal(Number(afterFirst[0].booked_count),Number(before[0].booked_count)+1,'capacity did not decrement exactly once');

const retry=await submit(first);assert.equal(retry.response.status,200,JSON.stringify(retry.data));assert.equal(retry.data.duplicate,true);assert.equal(retry.data.id,one.data.id);
const afterRetry=await sql`SELECT booked_count FROM event_slots WHERE id=${slot.id}`;assert.equal(Number(afterRetry[0].booked_count),Number(afterFirst[0].booked_count),'idempotent retry changed capacity');

const secondPayload=synthetic(data.event,slot,2),two=await submit(secondPayload);assert.equal(two.response.status,201,JSON.stringify(two.data));created.push(two.data.id);
const final=await sql`SELECT booked_count FROM event_slots WHERE id=${slot.id}`;assert.equal(Number(final[0].booked_count),Number(before[0].booked_count)+2,'second unique RSVP capacity mismatch');
const durable=await sql`SELECT COUNT(*)::int count FROM event_rsvps WHERE id=ANY(${created}::uuid[]) AND is_test AND archived_at IS NULL`;assert.equal(durable[0].count,2,'optional qualification affected RSVP durability');

// The existing CRM archival action archives every TEST RSVP for an event, not
// only this run. Deliberately retain these clearly labelled synthetic rows rather
// than risking unrelated TEST data; they can be archived through normal CRM policy.
console.log(JSON.stringify({ok:true,event_id:data.event.id,slot_id:slot.id,rsvp_ids:created,response_ms:Date.now()-started}));
