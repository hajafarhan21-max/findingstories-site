import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { requestWithTimeout } from './acceptance-http.mjs';

const base=(process.env.ACCEPTANCE_BASE_URL||'https://www.finding-stories.com').replace(/\/$/,'');
const secret=process.env.ACCEPTANCE_TEST_SECRET;
assert.ok(secret?.length>=32,'ACCEPTANCE_TEST_SECRET must be configured for production acceptance');
const api=async(path,options={})=>{
  // The isolated acceptance function may need to establish both a serverless
  // runtime and database connection on its first request. GETs are safe to
  // retry; mutations are deliberately never retried here.
  const response=await requestWithTimeout(base+path,{...options,headers:{Authorization:`Bearer ${secret}`,...options.headers}},{timeoutMs:60000,retries:options.method?0:2,backoffMs:1500});
  const contentType=response.headers.get('content-type')||'';
  return {response,data:contentType.includes('json')?await response.json():await response.text()};
};
const patch=(body)=>api('/api/acceptance/events',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
const publicRequest=async(path,options={})=>{const response=await requestWithTimeout(base+path,options,{timeoutMs:30000,retries:options.method?0:1,backoffMs:1000});return{response,data:await response.json()};};

const health=await publicRequest('/api/health');assert.equal(health.response.ok,true);assert.equal(health.data.checks?.database,'ok');
const prepared=await patch({action:'prepare'});assert.equal(prepared.response.ok,true,JSON.stringify(prepared.data));assert.equal(prepared.data.is_test,true);
const available=await api(`/api/acceptance/events?event_id=${prepared.data.event_id}`);assert.equal(available.response.ok,true,JSON.stringify(available.data));assert.equal(available.data.event?.is_test,true);
assert.equal(available.data.rsvps.filter(row=>!row.archived_at).length,0,'prepare must archive stale synthetic TEST RSVPs');
const event=available.data.event,slots=available.data.slots.filter(slot=>new Date(slot.starts_at)>new Date()&&Number(slot.remaining)>=2);assert.ok(slots.length>=1,'a future TEST slot with capacity for two RSVPs is required');
const slot=slots[0],before=Number(slot.booked_count),stamp=Date.now();assert.ok(Number.isInteger(before),'TEST slot must expose its initial booked count');
const payload=(index,key=randomUUID())=>({full_name:`FS ACCEPTANCE ${stamp} ${index}`,phone:`050${String(stamp+index).slice(-7)}`,email:`fs-acceptance-${stamp}-${index}@example.com`,purpose:'Investment',budget:'Under AED 1M',property_type:'Apartment',preferred_area:'Dubai',purchase_timeline:'Immediate / ready',owns_uae_property:'No',payment_method:'Cash',event_id:event.id,preferred_event_date:new Intl.DateTimeFormat('en-CA',{timeZone:event.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(slot.starts_at)),preferred_slot:slot.id,additional_requirements:'Synthetic production acceptance only',consent:true,idempotency_key:key,source:'system-acceptance'});
const submit=(body)=>publicRequest('/api/events/rsvp',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':body.idempotency_key},body:JSON.stringify(body)});
const created=[];
let completed=false;
try{
  const firstPayload=payload(1),first=await submit(firstPayload);assert.equal(first.response.status,201,JSON.stringify(first.data));assert.equal(first.data.is_test,true);created.push(first.data);
  assert.deepEqual(first.data.verification,{rsvp_persisted:true,lead_associated:true,activity_persisted:true,booked_count:before+1});
  const retry=await submit(firstPayload);assert.equal(retry.response.status,200);assert.equal(retry.data.id,first.data.id);assert.equal(retry.data.duplicate,true);
  assert.deepEqual(retry.data.verification,{rsvp_persisted:true,lead_associated:true,activity_persisted:true,booked_count:before+1});
  const second=await submit(payload(2));assert.equal(second.response.status,201,JSON.stringify(second.data));assert.equal(second.data.is_test,true);created.push(second.data);
  assert.deepEqual(second.data.verification,{rsvp_persisted:true,lead_associated:true,activity_persisted:true,booked_count:before+2});

  let inspection;
  for(let attempt=0;attempt<12;attempt++){
    inspection=await api(`/api/acceptance/events?event_id=${event.id}`);assert.equal(inspection.response.ok,true,JSON.stringify(inspection.data));
    const candidates=created.map(item=>inspection.data.rsvps.find(row=>row.id===item.id));
    if(candidates.every(candidate=>candidate?.qualification_status==='completed'&&candidate.crm_lead_id))break;
    await new Promise(resolve=>setTimeout(resolve,2500));
  }
  const rows=created.map(item=>inspection.data.rsvps.find(row=>row.id===item.id));
  for(const row of rows){assert.equal(row?.is_test,true);assert.ok(row?.crm_lead_id);assert.equal(row?.crm_lead_is_test,true);assert.equal(row?.qualification_status,'completed');assert.equal(inspection.data.activities.filter(activity=>activity.rsvp_id===row.id&&activity.activity_type==='rsvp_submitted').length,1,'each RSVP must have exactly one submission activity');}
  const row=rows[0];
  for(const operation of [
    {action:'assign',rsvp_id:row.id,assigned_to:'Acceptance Test RM'},
    {action:'meeting',rsvp_id:row.id,slot_id:slot.id},
    {action:'site_visit',rsvp_id:row.id,scheduled_at:new Date(Date.now()+86400000).toISOString(),details:'Synthetic site visit'},
    {action:'status',rsvp_id:row.id,status:'attended'},
    {action:'activity',rsvp_id:row.id,activity_type:'note',details:'Synthetic acceptance activity'},
    {action:'status',rsvp_id:row.id,status:'booked'}
  ]){const result=await patch(operation);assert.equal(result.response.ok,true,JSON.stringify(result.data));}
  const report=await api(`/api/acceptance/events?event_id=${event.id}&action=report`);assert.equal(report.response.ok,true);assert.equal(report.data.is_test,true);assert.equal(Number(report.data.counts.active),2);assert.ok(Number(report.data.counts.qualified)>=2);
  const exported=await api(`/api/acceptance/events?event_id=${event.id}&action=export`);assert.equal(exported.response.ok,true);assert.match(exported.data,/is_test/);for(const item of created)assert.match(exported.data,new RegExp(item.id));
  completed=true;
}finally{
  let remaining=created.length;
  for(const item of created.toReversed()){
    const archived=await patch({action:'archive',rsvp_id:item.id});assert.equal(archived.response.ok,true,JSON.stringify(archived.data));assert.equal(archived.data.result.is_test,true);
    const inspection=await api(`/api/acceptance/events?event_id=${event.id}`);assert.equal(inspection.response.ok,true,JSON.stringify(inspection.data));
    const row=inspection.data.rsvps.find(row=>row.id===item.id);assert.equal(row?.is_test,true);assert.ok(row?.archived_at,'synthetic TEST RSVP cleanup was not persisted');
    remaining--;const currentSlot=inspection.data.slots.find(candidate=>candidate.id===slot.id);assert.equal(Number(currentSlot?.booked_count),before+remaining,'each archive must restore exactly one unit of capacity');
  }
  if(created.length){const inspection=await api(`/api/acceptance/events?event_id=${event.id}`);const finalSlot=inspection.data.slots.find(item=>item.id===slot.id);assert.equal(Number(finalSlot?.booked_count),before,'archival must restore exact initial capacity');
    const rerun=await patch({action:'prepare'});assert.equal(rerun.response.ok,true,JSON.stringify(rerun.data));const verified=await api(`/api/acceptance/events?event_id=${event.id}`);const verifiedSlot=verified.data.slots.find(item=>item.id===slot.id);assert.equal(Number(verifiedSlot?.booked_count),before,'repeated preparation must not cause capacity drift');assert.equal(verified.data.rsvps.filter(row=>!row.archived_at).length,0,'repeated preparation must leave no active TEST RSVPs');}
}
if(completed)console.log(JSON.stringify({ok:true,event_id:event.id,rsvp_ids:created.map(item=>item.id),checks:['two_isolated_rsvps','persistence','qualification','crm_lead','meeting','site_visit','assignment','status','activity','report','export','idempotent_capacity','archive']}));
