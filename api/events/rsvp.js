import { waitUntil } from '@vercel/functions';
import { randomUUID } from 'node:crypto';
import { database } from '../_lib/db.js';
import { clientIp, json, method, parseJson, rateLimit } from '../_lib/http.js';
import { normalizeUaePhone, rsvpSchema } from '../_lib/event.js';
import { qualifyEventRsvp } from '../_lib/event-qualify.js';
import { safeText } from '../_lib/validation.js';

const log = (level, fields) => console[level](JSON.stringify({ service:'event-rsvp', ...fields }));

export async function qualifyPersistedRsvp(sql, id, rsvp) {
  try {
    const q = await qualifyEventRsvp(rsvp, { timeoutMs:3000 });
    await sql`UPDATE event_rsvps SET lead_score=${q.lead_score},temperature=${q.temperature},
      qualification_summary=${safeText(q.qualification_summary)},next_action=${safeText(q.next_action)},
      suggested_call_opener=${safeText(q.suggested_call_opener)},personalised_whatsapp_invitation=${safeText(q.personalised_whatsapp_invitation)},
      appointment_confirmation_message=${safeText(q.appointment_confirmation_message)},reminder_message=${safeText(q.reminder_message)},
      no_show_follow_up_message=${safeText(q.no_show_follow_up_message)},qualification_status='completed',
      qualification_source=${q.qualification_source},updated_at=NOW() WHERE id=${id}`;
  } catch {
    // Qualification is optional. Leave the durable RSVP pending for a later retry.
    log('warn', { event:'qualification_deferred', rsvp_id:id });
  }
}

function scheduleQualification(sql, id, input) {
  const work=qualifyPersistedRsvp(sql,id,input);
  try { waitUntil(work); } catch { void work; }
}

export async function persistRsvp(sql, r, phone) {
  // One statement is one Neon transaction. The conditional slot update locks the
  // correct row, and every dependent insert rolls back together on DB failure.
  const rows=await sql`WITH selected AS (
      SELECT s.id slot_id,e.id event_id,e.name event_name,e.venue event_venue,e.is_test
      FROM event_slots s JOIN events e ON e.id=s.event_id
      WHERE s.id=${r.preferred_slot} AND e.id=${r.event_id} AND e.active AND e.status IN ('OPEN','TEST')
        AND e.ends_on >= (NOW() AT TIME ZONE e.timezone)::date
        AND (s.starts_at AT TIME ZONE e.timezone)::date=${r.preferred_event_date}
        AND s.active AND s.starts_at>NOW()
    ), retry AS (
      SELECT x.id,x.event_id,x.is_test FROM event_rsvps x JOIN selected s ON s.event_id=x.event_id
      WHERE x.idempotency_key=${r.idempotency_key} AND x.archived_at IS NULL LIMIT 1
    ), contact_duplicate AS (
      SELECT x.id FROM event_rsvps x JOIN selected s ON s.event_id=x.event_id
      WHERE x.archived_at IS NULL AND x.idempotency_key<>${r.idempotency_key}
        AND (x.phone=${phone} OR (${r.email||null} IS NOT NULL AND lower(x.email)=lower(${r.email||null}))) LIMIT 1
    ), reserved AS (
      UPDATE event_slots slot SET booked_count=slot.booked_count+1 FROM selected s
      WHERE slot.id=s.slot_id AND slot.event_id=s.event_id AND slot.booked_count<slot.capacity
        AND NOT EXISTS(SELECT 1 FROM retry) AND NOT EXISTS(SELECT 1 FROM contact_duplicate)
      RETURNING slot.id
    ), inserted AS (
      INSERT INTO event_rsvps(event_id,idempotency_key,full_name,phone,email,purpose,budget,property_type,preferred_area,
        purchase_timeline,owns_uae_property,payment_method,preferred_event_date,preferred_slot,confirmed_slot,
        additional_requirements,consent,status,source,utm_source,utm_medium,utm_campaign,referrer,is_test)
      SELECT s.event_id,${r.idempotency_key},${safeText(r.full_name,100)},${phone},${r.email||null},${r.purpose||null},
        ${r.budget||null},${r.property_type||null},${r.preferred_area||null},${r.purchase_timeline||null},
        ${r.owns_uae_property||null},${r.payment_method||null},${r.preferred_event_date},s.slot_id,s.slot_id,
        ${safeText(r.additional_requirements)||null},TRUE,'confirmed',${r.source||'open-house'},${r.utm_source||null},
        ${r.utm_medium||null},${r.utm_campaign||null},${r.referrer||null},s.is_test
      FROM selected s JOIN reserved capacity ON capacity.id=s.slot_id RETURNING id,event_id,is_test
    ), lead_created AS (
      INSERT INTO leads(submission_id,name,phone,email,purpose,budget,property_type,preferred_areas,payment_method,
        purchase_timeline,owns_uae_property,additional_requirements,consent,source,landing_page,referrer,
        utm_source,utm_medium,utm_campaign,qualification_status)
      SELECT i.id,${safeText(r.full_name,100)},${phone},${r.email||null},${r.purpose||null},${r.budget||null},
        ${r.property_type||null},${r.preferred_area||null},${r.payment_method||null},${r.purchase_timeline||null},
        ${r.owns_uae_property||null},${safeText(r.additional_requirements)||null},TRUE,'event-rsvp','/open-house',
        ${r.referrer||null},${r.utm_source||null},${r.utm_medium||null},${r.utm_campaign||null},'pending'
      FROM inserted i ON CONFLICT(submission_id) DO NOTHING RETURNING id
    ), activity AS (
      INSERT INTO event_rsvp_activity(rsvp_id,activity_type,details)
      SELECT i.id,'rsvp_submitted',jsonb_build_object('preferred_slot',${r.preferred_slot},'is_test',i.is_test)
      FROM inserted i RETURNING id
    )
    SELECT i.id,i.is_test,FALSE duplicate,'saved' result,s.event_name,s.event_venue FROM inserted i,selected s
    UNION ALL SELECT x.id,x.is_test,TRUE,'saved',s.event_name,s.event_venue FROM retry x,selected s
    UNION ALL SELECT NULL,s.is_test,FALSE,CASE WHEN EXISTS(SELECT 1 FROM contact_duplicate) THEN 'contact_duplicate'
      WHEN EXISTS(SELECT 1 FROM selected) THEN 'slot_unavailable' ELSE 'invalid_slot' END,s.event_name,s.event_venue
      FROM selected s WHERE NOT EXISTS(SELECT 1 FROM inserted) AND NOT EXISTS(SELECT 1 FROM retry)
    UNION ALL SELECT NULL,FALSE,FALSE,'invalid_slot',NULL,NULL WHERE NOT EXISTS(SELECT 1 FROM selected)`;
  return rows[0];
}

export default async function handler(req,res){
  const requestId=randomUUID(),started=Date.now();
  if(!method(req,res,['POST']))return;
  if(!rateLimit(`rsvp:${clientIp(req)}`,5,600000))return json(res,429,{ok:false,code:'RATE_LIMITED',error:'Too many requests. Please try again later.'});
  const parsed=rsvpSchema.safeParse(parseJson(req));
  if(!parsed.success)return json(res,400,{ok:false,code:'VALIDATION_ERROR',error:'Please check the RSVP details.',fields:parsed.error.flatten().fieldErrors});
  if(parsed.data.website)return json(res,202,{ok:true});
  let phone;try{phone=normalizeUaePhone(parsed.data.phone);}catch{return json(res,400,{ok:false,code:'INVALID_PHONE',error:'Enter a valid UAE phone number.'});}
  try{
    const sql=database(),r=parsed.data,saved=await persistRsvp(sql,r,phone);
    if(saved.result!=='saved'){
      const duplicate=saved.result==='contact_duplicate';
      log('warn',{event:'rejected',request_id:requestId,code:duplicate?'CONTACT_DUPLICATE':'SLOT_UNAVAILABLE',duration_ms:Date.now()-started});
      return json(res,409,{ok:false,code:duplicate?'CONTACT_DUPLICATE':'SLOT_UNAVAILABLE',error:duplicate?'An RSVP for this contact already exists.':'That slot is no longer available. Please select another.'});
    }
    if(!saved.duplicate)scheduleQualification(sql,saved.id,{...r,phone,event_name:saved.event_name,event_venue:saved.event_venue});
    log('info',{event:'persisted',request_id:requestId,rsvp_id:saved.id,duplicate:saved.duplicate,is_test:saved.is_test,duration_ms:Date.now()-started});
    return json(res,saved.duplicate?200:201,{ok:true,id:saved.id,duplicate:saved.duplicate,is_test:saved.is_test,code:saved.duplicate?'RSVP_ALREADY_SAVED':'RSVP_SAVED',message:saved.duplicate?'Your RSVP is already recorded.':`${saved.is_test?'TEST RSVP saved. ':''}Thank you. Your appointment is reserved.`});
  }catch(error){
    log('error',{event:'persistence_failed',request_id:requestId,code:error?.code||'unknown',duration_ms:Date.now()-started});
    return json(res,503,{ok:false,code:'PERSISTENCE_UNAVAILABLE',error:'RSVP saving is temporarily unavailable. Please try again.'});
  }
}
