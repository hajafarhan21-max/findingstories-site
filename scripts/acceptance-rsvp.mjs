import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base=(process.env.ACCEPTANCE_BASE_URL||'https://www.finding-stories.com').replace(/\/$/,'');
const created=[];
const request=async(path,options={},timeout=8000)=>{
  const response=await fetch(base+path,{...options,signal:globalThis.AbortSignal.timeout(timeout)});
  const data=await response.json();return{response,data};
};
const submit=async(payload)=>request('/api/events/rsvp',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':payload.idempotency_key},body:JSON.stringify(payload)});
const synthetic=(event,slot,index,key=randomUUID())=>({full_name:`FS SYSTEM ACCEPTANCE ${Date.now()} ${index}`,phone:`050${String(Date.now()+index).slice(-7)}`,email:`fs-acceptance-${Date.now()}-${index}@example.com`,purpose:'Investment',budget:'Under AED 1M',property_type:'Apartment',preferred_area:'Dubai',purchase_timeline:'Immediate / ready',payment_method:'Cash',owns_uae_property:'No',event_id:event.id,preferred_event_date:new Intl.DateTimeFormat('en-CA',{timeZone:event.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(slot.starts_at)),preferred_slot:slot.id,consent:true,idempotency_key:key,source:'system-acceptance'});

const {response:healthResponse,data:health}=await request('/api/health');
assert.equal(healthResponse.ok,true,'health endpoint failed');
assert.equal(health?.checks?.api,'ok','production API health check failed');
assert.equal(health?.checks?.database,'ok','production database health check failed');
const {response:slotsResponse,data}=await request('/api/events/slots?test=true');
assert.equal(slotsResponse.ok,true,'slots endpoint failed');
assert.equal(data.event?.is_test,true,'acceptance is restricted to the active TEST event');
const slot=data.slots?.find(value=>Number(value.remaining)>=2);
assert.ok(slot,'a future TEST slot with capacity for two RSVPs is required');
const before=Number(slot.booked_count);
assert.ok(Number.isInteger(before),'TEST slot must expose its initial booked count');

const first=synthetic(data.event,slot,1);const started=Date.now(),one=await submit(first);
assert.equal(one.response.status,201,JSON.stringify(one.data));assert.ok(Date.now()-started<8000,'first RSVP exceeded 8 seconds');created.push(one.data.id);
assert.deepEqual(one.data.verification,{rsvp_persisted:true,lead_associated:true,activity_persisted:true,booked_count:before+1});

const retry=await submit(first);assert.equal(retry.response.status,200,JSON.stringify(retry.data));assert.equal(retry.data.duplicate,true);assert.equal(retry.data.id,one.data.id);
assert.deepEqual(retry.data.verification,{rsvp_persisted:true,lead_associated:true,activity_persisted:true,booked_count:before+1});

const secondPayload=synthetic(data.event,slot,2),two=await submit(secondPayload);assert.equal(two.response.status,201,JSON.stringify(two.data));created.push(two.data.id);
assert.deepEqual(two.data.verification,{rsvp_persisted:true,lead_associated:true,activity_persisted:true,booked_count:before+2});

// The existing CRM archival action archives every TEST RSVP for an event, not
// only this run. Deliberately retain these clearly labelled synthetic rows rather
// than risking unrelated TEST data; they can be archived through normal CRM policy.
console.log(JSON.stringify({ok:true,event_id:data.event.id,slot_id:slot.id,rsvp_ids:created,response_ms:Date.now()-started}));
