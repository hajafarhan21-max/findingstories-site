import { randomUUID } from 'node:crypto';
import { isAdmin, isSameOrigin } from '../_lib/auth.js';
import { database, ensureEventSchema } from '../_lib/db.js';
import { json, method, parseJson } from '../_lib/http.js';
import { adminEventSchema, normalizeUaePhone } from '../_lib/event.js';
import { safeText } from '../_lib/validation.js';

const csv = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const eventId = req => safeText(req.query?.event_id, 36) || null;

async function selectedEvent(sql, requestedId) {
  const rows = requestedId
    ? await sql`SELECT * FROM events WHERE id=${requestedId}::uuid LIMIT 1`
    : await sql`SELECT * FROM events ORDER BY (active AND status IN ('OPEN','TEST') AND ends_on >= (NOW() AT TIME ZONE timezone)::date) DESC,is_test,starts_on DESC LIMIT 1`;
  return rows[0];
}

async function listEvent(sql, req, res) {
  const events = await sql`SELECT * FROM events ORDER BY starts_on DESC,created_at DESC`;
  const event = await selectedEvent(sql, eventId(req));
  if (!event) return json(res, 200, { events, event:null, rsvps:[], slots:[], counts:{} });
  const [rsvps, slots, counts] = await Promise.all([
    sql`SELECT r.*,ps.starts_at preferred_starts_at,cs.starts_at confirmed_starts_at
      FROM event_rsvps r LEFT JOIN event_slots ps ON ps.id=r.preferred_slot LEFT JOIN event_slots cs ON cs.id=r.confirmed_slot
      WHERE r.event_id=${event.id} AND r.archived_at IS NULL ORDER BY r.created_at DESC LIMIT 1000`,
    sql`SELECT s.id,s.starts_at,s.ends_at,s.capacity,s.booked_count,s.capacity-s.booked_count remaining,
      COUNT(r.id)::int requested_count FROM event_slots s LEFT JOIN event_rsvps r ON r.preferred_slot=s.id AND r.archived_at IS NULL
      WHERE s.event_id=${event.id} GROUP BY s.id ORDER BY s.starts_at`,
    sql`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE status='new')::int new,
      COUNT(*) FILTER(WHERE confirmed_slot IS NULL AND status NOT IN ('lost','booked'))::int pending_confirmation,
      COUNT(*) FILTER(WHERE temperature='Hot' OR lead_score>=75)::int qualified,
      COUNT(*) FILTER(WHERE status='confirmed')::int confirmed,COUNT(*) FILTER(WHERE status='confirmed' AND next_follow_up_at<=NOW())::int reminder_pending,
      COUNT(*) FILTER(WHERE status='attended')::int attended,COUNT(*) FILTER(WHERE status='no_show')::int no_show,
      COUNT(*) FILTER(WHERE status='booked')::int booked,COUNT(*) FILTER(WHERE is_test)::int test_records,
      ROUND(100.0*COUNT(*) FILTER(WHERE status='booked')/NULLIF(COUNT(*),0),1) conversion
      FROM event_rsvps WHERE event_id=${event.id} AND archived_at IS NULL`
  ]);
  return json(res, 200, { events,event,rsvps,slots,counts:counts[0] });
}

async function exportEvent(sql, req, res) {
  const event = await selectedEvent(sql, eventId(req));
  if (!event) return json(res, 404, { error:'Event not found.' });
  const rows = await sql`SELECT r.full_name,r.phone,r.email,r.purpose,r.budget,r.property_type,r.preferred_area,
    r.purchase_timeline,r.preferred_event_date,ps.starts_at requested_slot,cs.starts_at confirmed_meeting,r.status,
    r.assigned_to,r.lead_score,r.temperature,r.qualification_status,r.attendance_status,r.is_test,r.last_contacted_at,
    r.next_follow_up_at,r.source,r.utm_source,r.utm_medium,r.utm_campaign,r.created_at FROM event_rsvps r
    LEFT JOIN event_slots ps ON ps.id=r.preferred_slot LEFT JOIN event_slots cs ON cs.id=r.confirmed_slot
    WHERE r.event_id=${event.id} AND r.archived_at IS NULL ORDER BY r.created_at DESC`;
  const headers = ['full_name','phone','email','purpose','budget','property_type','preferred_area','purchase_timeline','preferred_event_date',
    'requested_slot','confirmed_meeting','status','assigned_to','lead_score','temperature','qualification_status','attendance_status','is_test',
    'last_contacted_at','next_follow_up_at','source','utm_source','utm_medium','utm_campaign','created_at'];
  res.statusCode=200;res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition',`attachment; filename="${event.slug}-rsvps.csv"`);
  res.end('\uFEFF'+headers.join(',')+'\n'+rows.map(row=>headers.map(header=>csv(row[header])).join(',')).join('\n'));
}

async function generateSlots(sql, id) {
  await sql`INSERT INTO event_slots(event_id,starts_at,ends_at,capacity)
    SELECT e.id,(e.starts_on+day_number+e.opening_time+n*make_interval(mins=>e.slot_duration_minutes))::timestamp AT TIME ZONE e.timezone,
    (e.starts_on+day_number+e.opening_time+(n+1)*make_interval(mins=>e.slot_duration_minutes))::timestamp AT TIME ZONE e.timezone,e.default_slot_capacity
    FROM events e CROSS JOIN LATERAL generate_series(0,e.ends_on-e.starts_on) event_days(day_number)
    CROSS JOIN LATERAL generate_series(0,GREATEST(0,FLOOR(EXTRACT(EPOCH FROM (e.closing_time-e.opening_time))/60/e.slot_duration_minutes)::int-1)) numbers(n)
    WHERE e.id=${id} ON CONFLICT(event_id,starts_at) DO NOTHING`;
}

async function updateEvent(sql, req, res) {
  const parsed=adminEventSchema.safeParse(parseJson(req));
  if(!parsed.success)return json(res,400,{error:'Invalid event update.',fields:parsed.error.flatten().fieldErrors});
  const value=parsed.data;let rows;
  if(value.action==='save_event'){
    if(value.ends_on<value.starts_on||value.closing_time<=value.opening_time)return json(res,400,{error:'Event dates or opening hours are invalid.'});
    if(value.id) rows=await sql`UPDATE events SET name=${value.name},venue=${value.venue},address=${value.address},starts_on=${value.starts_on},ends_on=${value.ends_on},opening_time=${value.opening_time},closing_time=${value.closing_time},slot_duration_minutes=${value.slot_duration_minutes},default_slot_capacity=${value.default_slot_capacity},status=${value.status},active=${value.active},developers_projects=${value.developers_projects},public_description=${value.public_description},is_test=${value.is_test},updated_at=NOW() WHERE id=${value.id} RETURNING *`;
    else rows=await sql`INSERT INTO events(slug,name,venue,address,starts_on,ends_on,opening_time,closing_time,slot_duration_minutes,default_slot_capacity,status,active,developers_projects,public_description,is_test) VALUES(${'event-'+randomUUID()},${value.name},${value.venue},${value.address},${value.starts_on},${value.ends_on},${value.opening_time},${value.closing_time},${value.slot_duration_minutes},${value.default_slot_capacity},${value.status},${value.active},${value.developers_projects},${value.public_description},${value.is_test}) RETURNING *`;
    if(!rows.length)return json(res,404,{error:'Event not found.'});await generateSlots(sql,rows[0].id);return json(res,200,{event:rows[0]});
  }
  if(value.action==='archive_test_records'){
    const event=await sql`SELECT id FROM events WHERE id=${value.event_id} AND is_test`;
    if(!event.length)return json(res,403,{error:'Only records belonging to a TEST event can be archived.'});
    await sql`UPDATE event_rsvps SET archived_at=NOW(),updated_at=NOW() WHERE event_id=${value.event_id} AND is_test AND archived_at IS NULL`;
    await sql`UPDATE event_slots s SET booked_count=(SELECT COUNT(*)::int FROM event_rsvps r WHERE r.confirmed_slot=s.id AND r.archived_at IS NULL) WHERE s.event_id=${value.event_id}`;
    return json(res,200,{ok:true});
  }
  if(value.action==='slot'){const result=await sql`SELECT confirm_event_slot(${value.id},${value.slot_id},'admin') ok`;if(!result[0]?.ok)return json(res,409,{error:'Slot is full, expired, belongs to another event, or RSVP was not found.'});}
  if(value.action==='status')rows=await sql`UPDATE event_rsvps SET status=${value.status},attendance_status=CASE WHEN ${value.status} IN ('attended','no_show') THEN ${value.status} ELSE attendance_status END,lost_reason=CASE WHEN ${value.status}='lost' THEN ${value.lost_reason} ELSE NULL END,last_contacted_at=CASE WHEN ${value.status}='contacted' THEN NOW() ELSE last_contacted_at END,updated_at=NOW() WHERE id=${value.id} AND archived_at IS NULL RETURNING *`;
  if(value.action==='assign')rows=await sql`UPDATE event_rsvps SET assigned_to=${value.assigned_to},updated_at=NOW() WHERE id=${value.id} AND archived_at IS NULL RETURNING *`;
  if(value.action==='activity'){await sql`INSERT INTO event_rsvp_activity(rsvp_id,activity_type,details,created_by) SELECT ${value.id},${value.activity_type},jsonb_build_object('text',${value.details}),'admin' FROM event_rsvps WHERE id=${value.id} AND archived_at IS NULL`;rows=await sql`UPDATE event_rsvps SET last_contacted_at=CASE WHEN ${value.activity_type} IN ('call','whatsapp') THEN NOW() ELSE last_contacted_at END,updated_at=NOW() WHERE id=${value.id} AND archived_at IS NULL RETURNING *`;}
  if(value.action==='slot')rows=await sql`SELECT * FROM event_rsvps WHERE id=${value.id} AND archived_at IS NULL`;
  if(!rows?.length)return json(res,404,{error:'RSVP not found.'});return json(res,200,{rsvp:rows[0]});
}

function prepareImport(body){const input=Array.isArray(body.rows)?body.rows.slice(0,1000):[],seen=new Set(),accepted=[],rejected=[];input.forEach((row,index)=>{try{const phone=normalizeUaePhone(row.phone),email=safeText(row.email,254).toLowerCase();if(!safeText(row.full_name,100))throw new Error('Full name required');const key=`${phone}|${email}`;if(seen.has(key))throw new Error('Duplicate in file');seen.add(key);accepted.push({...row,full_name:safeText(row.full_name,100),phone,email,source:safeText(row.source||body.source||'csv-import',120),utm_campaign:safeText(row.utm_campaign||body.campaign,200)});}catch(error){rejected.push({row:index+2,reason:error.message});}});return{accepted,rejected};}
async function importEvent(sql,req,res){const body=parseJson(req),{accepted,rejected}=prepareImport(body),event=await selectedEvent(sql,safeText(body.event_id,36));if(!event)return json(res,404,{error:'Event not found.'});if(body.preview!==false)return json(res,200,{accepted,rejected});const created=[],duplicates=[];for(const row of accepted){const existing=await sql`SELECT id FROM event_rsvps WHERE event_id=${event.id}::uuid AND archived_at IS NULL AND (phone=${row.phone}::text OR (${row.email||null}::text IS NOT NULL AND lower(email)=lower(${row.email||null}::text))) LIMIT 1`;if(existing.length){duplicates.push({phone:row.phone,reason:'Already exists; not overwritten'});continue;}const date=row.preferred_event_date>=String(event.starts_on).slice(0,10)&&row.preferred_event_date<=String(event.ends_on).slice(0,10)?row.preferred_event_date:String(event.starts_on).slice(0,10);const rows=await sql`INSERT INTO event_rsvps(event_id,idempotency_key,full_name,phone,email,preferred_event_date,consent,source,utm_campaign,status,is_test) VALUES(${event.id},${randomUUID()},${row.full_name},${row.phone},${row.email||null},${date},TRUE,${row.source},${row.utm_campaign||null},'contact_pending',${event.is_test}) RETURNING id`;created.push(rows[0]);}return json(res,201,{imported:created.length,rejected:[...rejected,...duplicates]});}

export default async function handler(req,res){if(!method(req,res,['GET','PATCH','POST']))return;if(!isAdmin(req))return json(res,401,{error:'Authentication required.'});if(req.method!=='GET'&&!isSameOrigin(req))return json(res,403,{error:'Same-origin request required.'});try{const sql=database();if(req.method==='GET'&&req.query?.action==='export')return exportEvent(sql,req,res);if(req.method==='GET')return listEvent(sql,req,res);await ensureEventSchema();if(req.method==='PATCH')return updateEvent(sql,req,res);return importEvent(sql,req,res);}catch(error){console.error('Event CRM request failed:',error instanceof Error?error.message:'unknown');return json(res,500,{error:'Could not process the event CRM request.'});}}
