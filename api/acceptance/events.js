import { isAcceptance } from '../_lib/auth.js';
import { acceptanceQuerySchema, acceptanceUpdateSchema } from '../_lib/acceptance.js';
import { database, ensureEventSchema, ensureSchema } from '../_lib/db.js';
import { json, method, parseJson } from '../_lib/http.js';

const csv = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const denied = res => json(res, 401, { error:'Acceptance credential required.' });

async function inspect(sql,eventId,res){
  const events=await sql`SELECT id,slug,name,timezone,starts_on,ends_on,status,is_test FROM events WHERE id=${eventId}::uuid AND is_test=TRUE LIMIT 1`;
  if(!events.length)return json(res,404,{error:'TEST event not found.'});
  const [rsvps,slots,activities]=await Promise.all([
    sql`SELECT r.id,r.event_id,r.full_name,r.phone,r.email,r.purpose,r.budget,r.property_type,r.preferred_area,
      r.purchase_timeline,r.preferred_slot,r.confirmed_slot,r.status,r.assigned_to,r.lead_score,r.temperature,
      r.qualification_summary,r.next_action,r.qualification_status,r.qualification_source,r.attendance_status,
      r.next_follow_up_at,r.created_at,r.updated_at,r.is_test,r.archived_at,l.id crm_lead_id,l.qualification_status crm_qualification_status
      FROM event_rsvps r JOIN events e ON e.id=r.event_id AND e.is_test=TRUE
      LEFT JOIN leads l ON l.submission_id=r.id WHERE r.event_id=${eventId}::uuid AND r.is_test=TRUE ORDER BY r.created_at DESC LIMIT 250`,
    sql`SELECT s.id,s.starts_at,s.ends_at,s.capacity,s.booked_count,s.capacity-s.booked_count remaining
      FROM event_slots s JOIN events e ON e.id=s.event_id AND e.is_test=TRUE WHERE s.event_id=${eventId}::uuid ORDER BY s.starts_at`,
    sql`SELECT a.id,a.rsvp_id,a.activity_type,a.details,a.created_by,a.created_at FROM event_rsvp_activity a
      JOIN event_rsvps r ON r.id=a.rsvp_id AND r.is_test=TRUE JOIN events e ON e.id=r.event_id AND e.is_test=TRUE
      WHERE r.event_id=${eventId}::uuid ORDER BY a.created_at DESC LIMIT 1000`
  ]);
  return json(res,200,{event:events[0],rsvps,slots,activities});
}

async function report(sql,eventId,res){
  const rows=await sql`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE r.archived_at IS NULL)::int active,
    COUNT(*) FILTER(WHERE r.qualification_status='completed')::int qualified,
    COUNT(*) FILTER(WHERE r.confirmed_slot IS NOT NULL AND r.archived_at IS NULL)::int meetings,
    COUNT(*) FILTER(WHERE r.status='booked' AND r.archived_at IS NULL)::int booked,
    COUNT(DISTINCT r.assigned_to) FILTER(WHERE r.assigned_to<>'')::int assignees
    FROM event_rsvps r JOIN events e ON e.id=r.event_id AND e.is_test=TRUE
    WHERE r.event_id=${eventId}::uuid AND r.is_test=TRUE`;
  return json(res,200,{event_id:eventId,is_test:true,counts:rows[0]});
}

async function exportTest(sql,eventId,res){
  const event=await sql`SELECT slug FROM events WHERE id=${eventId}::uuid AND is_test=TRUE LIMIT 1`;
  if(!event.length)return json(res,404,{error:'TEST event not found.'});
  const rows=await sql`SELECT r.id,r.full_name,r.phone,r.email,r.status,r.assigned_to,r.lead_score,r.temperature,
    r.qualification_status,r.confirmed_slot,r.attendance_status,r.is_test,r.archived_at,r.created_at
    FROM event_rsvps r JOIN events e ON e.id=r.event_id AND e.is_test=TRUE
    WHERE r.event_id=${eventId}::uuid AND r.is_test=TRUE ORDER BY r.created_at DESC`;
  const headers=['id','full_name','phone','email','status','assigned_to','lead_score','temperature','qualification_status','confirmed_slot','attendance_status','is_test','archived_at','created_at'];
  res.statusCode=200;res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Disposition',`attachment; filename="${event[0].slug}-acceptance-test.csv"`);
  return res.end('\uFEFF'+headers.join(',')+'\n'+rows.map(row=>headers.map(key=>csv(row[key])).join(',')).join('\n'));
}

async function update(sql,value,res){
  let rows;
  if(value.action==='meeting'){
    rows=await sql`SELECT confirm_event_slot(r.id,${value.slot_id}::uuid,'acceptance-test') ok FROM event_rsvps r
      JOIN events e ON e.id=r.event_id AND e.is_test=TRUE JOIN event_slots s ON s.id=${value.slot_id}::uuid AND s.event_id=e.id
      WHERE r.id=${value.rsvp_id}::uuid AND r.is_test=TRUE AND r.archived_at IS NULL`;
    if(!rows[0]?.ok)return json(res,409,{error:'TEST meeting could not be scheduled.'});
  } else if(value.action==='assign') rows=await sql`UPDATE event_rsvps r SET assigned_to=${value.assigned_to},updated_at=NOW() FROM events e
    WHERE r.id=${value.rsvp_id}::uuid AND r.is_test=TRUE AND r.archived_at IS NULL AND e.id=r.event_id AND e.is_test=TRUE RETURNING r.id,r.status,r.assigned_to,r.is_test`;
  else if(value.action==='status') rows=await sql`UPDATE event_rsvps r SET status=${value.status},lost_reason=CASE WHEN ${value.status}='lost' THEN ${value.lost_reason} ELSE NULL END,
    attendance_status=CASE WHEN ${value.status} IN ('attended','no_show') THEN ${value.status} ELSE r.attendance_status END,updated_at=NOW() FROM events e
    WHERE r.id=${value.rsvp_id}::uuid AND r.is_test=TRUE AND r.archived_at IS NULL AND e.id=r.event_id AND e.is_test=TRUE RETURNING r.id,r.status,r.assigned_to,r.is_test`;
  else if(value.action==='activity'||value.action==='site_visit'){
    const type=value.action==='site_visit'?'site_visit_scheduled':value.activity_type;
    const details=value.action==='site_visit'?JSON.stringify({scheduled_at:value.scheduled_at,text:value.details}):JSON.stringify({text:value.details});
    rows=await sql`INSERT INTO event_rsvp_activity(rsvp_id,activity_type,details,created_by)
      SELECT r.id,${type},${details}::jsonb,'acceptance-test' FROM event_rsvps r JOIN events e ON e.id=r.event_id AND e.is_test=TRUE
      WHERE r.id=${value.rsvp_id}::uuid AND r.is_test=TRUE AND r.archived_at IS NULL RETURNING id,rsvp_id,activity_type,details,created_by,created_at`;
  } else if(value.action==='archive') rows=await sql`WITH archived AS (
      UPDATE event_rsvps r SET archived_at=NOW(),updated_at=NOW() FROM events e
      WHERE r.id=${value.rsvp_id}::uuid AND r.is_test=TRUE AND r.archived_at IS NULL AND e.id=r.event_id AND e.is_test=TRUE
      RETURNING r.id,r.event_id,r.confirmed_slot,r.is_test,r.archived_at
    ), occupancy AS (
      UPDATE event_slots s SET booked_count=(SELECT COUNT(*)::int FROM event_rsvps active
        WHERE active.confirmed_slot=s.id AND active.archived_at IS NULL)
      FROM archived a WHERE s.event_id=a.event_id RETURNING s.id
    ) SELECT id,is_test,archived_at,(SELECT COUNT(*)::int FROM occupancy) recalculated_slots FROM archived`;
  if(!rows?.length)return json(res,404,{error:'Synthetic TEST RSVP not found.'});
  return json(res,200,{ok:true,result:rows[0]});
}

export default async function handler(req,res){
  if(!method(req,res,['GET','PATCH']))return;
  if(!isAcceptance(req))return denied(res);
  try{
    await ensureSchema();await ensureEventSchema();const sql=database();
    if(req.method==='PATCH'){
      const parsed=acceptanceUpdateSchema.safeParse(parseJson(req));
      if(!parsed.success)return json(res,400,{error:'Invalid acceptance operation.'});
      return update(sql,parsed.data,res);
    }
    const parsed=acceptanceQuerySchema.safeParse(req.query||{});
    if(!parsed.success)return json(res,400,{error:'A valid TEST event_id is required.'});
    if(parsed.data.action==='report')return report(sql,parsed.data.event_id,res);
    if(parsed.data.action==='export')return exportTest(sql,parsed.data.event_id,res);
    return inspect(sql,parsed.data.event_id,res);
  }catch(error){console.error('Acceptance request failed:',error?.code||'unknown');return json(res,500,{error:'Acceptance operation failed.'});}
}
