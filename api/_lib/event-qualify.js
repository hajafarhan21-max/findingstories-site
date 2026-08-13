import { fallbackEvent } from './event.js';
const fields=['lead_score','temperature','qualification_summary','next_action','suggested_call_opener','personalised_whatsapp_invitation','appointment_confirmation_message','reminder_message','no_show_follow_up_message'];
export async function qualifyEventRsvp(rsvp,{timeoutMs=3000}={}){
  if(!process.env.OPENAI_API_KEY) return {...fallbackEvent(rsvp),qualification_source:'deterministic_fallback'};
  const properties=Object.fromEntries(fields.map(key=>[key,key==='lead_score'?{type:'integer',minimum:0,maximum:100}:key==='temperature'?{type:'string',enum:['Hot','Warm','Cold']}:{type:'string'}]));
  try{
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',signal:globalThis.AbortSignal.timeout(timeoutMs),headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',instructions:'Qualify this consented Dubai property event RSVP. Use only supplied facts. Score readiness, budget, timeline, finance, clarity, ownership, preferences and attendance intent. Do not allocate or promise slots, returns, prices, inventory, or send messages. Temperature: Hot 75-100, Warm 45-74, Cold 0-44. Produce concise WhatsApp-ready drafts.',input:JSON.stringify(rsvp),text:{format:{type:'json_schema',name:'event_rsvp_qualification',strict:true,schema:{type:'object',additionalProperties:false,properties,required:fields}}}})});
    if(!response.ok)throw new Error(`OpenAI ${response.status}`);const data=await response.json();
    const output=data.output_text||data.output?.flatMap(x=>x.content||[]).find(x=>x.type==='output_text')?.text;
    return {...JSON.parse(output),qualification_source:'openai'};
  }catch{return {...fallbackEvent(rsvp),qualification_source:'deterministic_fallback'};}
}
