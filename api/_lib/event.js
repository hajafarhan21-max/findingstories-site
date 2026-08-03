import { z } from 'zod';
import { safeText } from './validation.js';

const clean = max => z.string().trim().max(max).optional().default('');
export const rsvpSchema = z.object({
  full_name:z.string().trim().min(2).max(100), phone:z.string().trim().min(7).max(30),
  email:z.union([z.string().trim().email().max(254),z.literal('')]).optional().default(''), purpose:clean(80), budget:clean(100),
  property_type:clean(100), preferred_area:clean(200), purchase_timeline:clean(100), owns_uae_property:clean(30), payment_method:clean(40),
  preferred_event_date:z.enum(['2026-08-08','2026-08-09']), preferred_slot:z.string().uuid(), additional_requirements:clean(1500),
  consent:z.literal(true), utm_source:clean(200),utm_medium:clean(200),utm_campaign:clean(200),referrer:clean(1000),source:clean(120),
  idempotency_key:z.string().uuid(), website:clean(100)
}).strict();
export const statuses=['new','contact_pending','contacted','interested','appointment_proposed','confirmed','reminder_sent','attended','no_show','follow_up','booked','lost'];
export const adminEventSchema=z.discriminatedUnion('action',[
  z.object({action:z.literal('slot'),id:z.string().uuid(),slot_id:z.string().uuid()}).strict(),
  z.object({action:z.literal('status'),id:z.string().uuid(),status:z.enum(statuses),lost_reason:clean(500)}).strict(),
  z.object({action:z.literal('assign'),id:z.string().uuid(),assigned_to:z.string().trim().max(100)}).strict(),
  z.object({action:z.literal('activity'),id:z.string().uuid(),activity_type:z.enum(['note','call','whatsapp']),details:z.string().trim().min(1).max(3000)}).strict()
]);
export function normalizeUaePhone(value){
  let digits=String(value||'').replace(/\D/g,'');
  if(digits.startsWith('00971')) digits=digits.slice(2);
  else if(digits.startsWith('0')) digits=`971${digits.slice(1)}`;
  else if(digits.length===9) digits=`971${digits}`;
  if(!/^971\d{9}$/.test(digits)) throw new Error('Enter a valid UAE phone number.');
  return digits;
}
export function fallbackEvent(r){
  let score=20; if(/immediate|0.?3 month|ready/i.test(r.purchase_timeline))score+=25;if(r.budget)score+=15;if(r.payment_method)score+=10;
  if(r.purpose)score+=10;if(r.property_type)score+=5;if(r.owns_uae_property==='yes')score+=5;if(r.preferred_slot)score+=10;score=Math.min(100,score);
  const temperature=score>=75?'Hot':score>=45?'Warm':'Cold'; const name=safeText(r.full_name,100);
  return {lead_score:score,temperature,qualification_summary:`${temperature} event prospect seeking ${r.property_type||'Dubai property'} for ${r.purpose||'consultation'}.`,next_action:'Call to verify requirements and confirm the requested appointment.',suggested_call_opener:`Hello ${name}, this is Finding Stories regarding your Dubai Open House RSVP.`,personalised_whatsapp_invitation:`Hello ${name}, thank you for your interest in the Finding Stories Dubai Open House at Shangri-La Hotel on ${r.preferred_event_date}. We will contact you to confirm your limited appointment slot.`,appointment_confirmation_message:`Hello ${name}, your Finding Stories Open House appointment is confirmed. Please reply if your plans change.`,reminder_message:`Hello ${name}, a friendly reminder about your Finding Stories Open House appointment at Shangri-La Hotel, Dubai. We look forward to welcoming you.`,no_show_follow_up_message:`Hello ${name}, we missed you at the Finding Stories Open House. May we arrange a private follow-up consultation?`};
}
