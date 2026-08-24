import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base=(process.env.ACCEPTANCE_BASE_URL||'https://finding-stories.com').replace(/\/$/,'');
const secret=process.env.ACCEPTANCE_TEST_SECRET;
assert.ok(secret?.length>=32,'ACCEPTANCE_TEST_SECRET must be configured for production acceptance');
const api=async(path,options={})=>{
  const response=await fetch(base+path,{...options,headers:{Authorization:`Bearer ${secret}`,...options.headers},signal:globalThis.AbortSignal.timeout(12000)});
  const contentType=response.headers.get('content-type')||'';
  return {response,data:contentType.includes('json')?await response.json():await response.text()};
};
const patch=(body)=>api('/api/acceptance/events',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const publicRequest=async(path,options={})=>{const response=await fetch(base+path,{...options,signal:globalThis.AbortSignal.timeout(12000)});return{response,data:await response.json()};};

const health=await publicRequest('/api/health');assert.equal(health.response.ok,true);assert.equal(health.data.checks?.database,'ok');
const available=await publicRequest('/api/events/slots?test=true');assert.equal(available.data.event?.is_test,true);
const event=available.data.event,slots=available.data.slots.filter(slot=>Number(slot.remaining)>0);assert.ok(slots.length>=1);
const slot=slots[0],key=randomUUID(),stamp=Date.now();
const payload={full_name:`FS ACCEPTANCE ${stamp}`,phone:`050${String(stamp).slice(-7)}`,email:`fs-acceptance-${stamp}@example.com`,purpose:'Investment',budget:'Under AED 1M',property_type:'Apartment',preferred_area:'Dubai',purchase_timeline:'Immediate / ready',owns_uae_property:'No',payment_method:'Cash',event_id:event.id,preferred_event_date:new Intl.DateTimeFormat('en-CA',{timeZone:event.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(slot.starts_at)),preferred_slot:slot.id,additional_requirements:'Synthetic production acceptance only',consent:true,idempotency_key:key,source:'system-acceptance'};
const submit=()=>publicRequest('/api/events/rsvp',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(payload)});
const created=await submit();assert.equal(created.response.status,201,JSON.stringify(created.data));assert.equal(created.data.is_test,true);
const retry=await submit();assert.equal(retry.response.status,200);assert.equal(retry.data.id,created.data.id);assert.equal(retry.data.duplicate,true);

let inspection;
for(let attempt=0;attempt<12;attempt++){
  inspection=await api(`/api/acceptance/events?event_id=${event.id}`);assert.equal(inspection.response.ok,true);
  const row=inspection.data.rsvps.find(item=>item.id===created.data.id);
  if(row?.qualification_status==='completed'&&row.crm_lead_id)break;
  await new Promise(resolve=>setTimeout(resolve,2500));
}
let row=inspection.data.rsvps.find(item=>item.id===created.data.id);assert.equal(row?.is_test,true);assert.ok(row?.crm_lead_id);assert.equal(row?.qualification_status,'completed');
for(const operation of [
  {action:'assign',rsvp_id:row.id,assigned_to:'Acceptance Test RM'},
  {action:'meeting',rsvp_id:row.id,slot_id:slot.id},
  {action:'site_visit',rsvp_id:row.id,scheduled_at:new Date(Date.now()+86400000).toISOString(),details:'Synthetic site visit'},
  {action:'status',rsvp_id:row.id,status:'attended'},
  {action:'activity',rsvp_id:row.id,activity_type:'note',details:'Synthetic acceptance activity'},
  {action:'status',rsvp_id:row.id,status:'booked'}
]){const result=await patch(operation);assert.equal(result.response.ok,true,JSON.stringify(result.data));}
const report=await api(`/api/acceptance/events?event_id=${event.id}&action=report`);assert.equal(report.response.ok,true);assert.equal(report.data.is_test,true);assert.ok(Number(report.data.counts.total)>=1);
const exported=await api(`/api/acceptance/events?event_id=${event.id}&action=export`);assert.equal(exported.response.ok,true);assert.match(exported.data,/is_test/);assert.match(exported.data,new RegExp(created.data.id));
const archived=await patch({action:'archive',rsvp_id:created.data.id});assert.equal(archived.response.ok,true);assert.equal(archived.data.result.is_test,true);
inspection=await api(`/api/acceptance/events?event_id=${event.id}`);row=inspection.data.rsvps.find(item=>item.id===created.data.id);assert.ok(row.archived_at);
console.log(JSON.stringify({ok:true,event_id:event.id,rsvp_id:created.data.id,checks:['qualification','crm_lead','meeting','site_visit','assignment','status','activity','report','export','archive']}));
