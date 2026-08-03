import { randomUUID } from 'node:crypto';
import { isAdmin, isSameOrigin } from '../_lib/auth.js';
import { database } from '../_lib/db.js';
import { json, method, parseJson } from '../_lib/http.js';
import { adminEventSchema, normalizeUaePhone } from '../_lib/event.js';
import { safeText } from '../_lib/validation.js';

const eventSlug = 'dubai-open-house-august-2026';
const csv = value => `"${String(value ?? '').replaceAll('"', '""')}"`;

async function listEvent(sql, res) {
  const [rsvps, slots, counts] = await Promise.all([
    sql`SELECT r.*, ps.starts_at preferred_starts_at, cs.starts_at confirmed_starts_at
      FROM event_rsvps r
      LEFT JOIN event_slots ps ON ps.id=r.preferred_slot
      LEFT JOIN event_slots cs ON cs.id=r.confirmed_slot
      JOIN events e ON e.id=r.event_id WHERE e.slug=${eventSlug}
      ORDER BY r.created_at DESC LIMIT 1000`,
    sql`SELECT s.id,s.starts_at,s.ends_at,s.capacity,s.booked_count,s.capacity-s.booked_count remaining
      FROM event_slots s JOIN events e ON e.id=s.event_id WHERE e.slug=${eventSlug} ORDER BY s.starts_at`,
    sql`SELECT COUNT(*)::int total, COUNT(*) FILTER(WHERE r.status='new')::int new,
      COUNT(*) FILTER(WHERE r.status='contact_pending')::int contact_pending,
      COUNT(*) FILTER(WHERE r.status='confirmed')::int confirmed,
      COUNT(*) FILTER(WHERE r.status='confirmed' AND (s.starts_at AT TIME ZONE 'Asia/Dubai')::date='2026-08-08')::int confirmed_8,
      COUNT(*) FILTER(WHERE r.status='confirmed' AND (s.starts_at AT TIME ZONE 'Asia/Dubai')::date='2026-08-09')::int confirmed_9,
      COUNT(*) FILTER(WHERE r.status='confirmed' AND r.next_follow_up_at<=NOW())::int reminder_pending,
      COUNT(*) FILTER(WHERE r.status='attended')::int attended,
      COUNT(*) FILTER(WHERE r.status='no_show')::int no_show,
      COUNT(*) FILTER(WHERE r.status='booked')::int booked,
      ROUND(100.0*COUNT(*) FILTER(WHERE r.status='booked')/NULLIF(COUNT(*),0),1) conversion
      FROM event_rsvps r JOIN events e ON e.id=r.event_id
      LEFT JOIN event_slots s ON s.id=r.confirmed_slot WHERE e.slug=${eventSlug}`
  ]);
  json(res, 200, { rsvps, slots, counts: counts[0] });
}

async function exportEvent(sql, res) {
  const rows = await sql`SELECT full_name,phone,email,purpose,budget,property_type,preferred_area,
    purchase_timeline,preferred_event_date,status,assigned_to,lead_score,temperature,source,
    utm_source,utm_medium,utm_campaign,created_at FROM event_rsvps r JOIN events e ON e.id=r.event_id
    WHERE e.slug=${eventSlug} ORDER BY r.created_at DESC`;
  const headers = ['full_name','phone','email','purpose','budget','property_type','preferred_area','purchase_timeline',
    'preferred_event_date','status','assigned_to','lead_score','temperature','source','utm_source','utm_medium','utm_campaign','created_at'];
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="finding-stories-open-house-rsvps.csv"');
  res.end('\uFEFF' + headers.join(',') + '\n' + rows.map(row => headers.map(header => csv(row[header])).join(',')).join('\n'));
}

async function updateEvent(sql, req, res) {
  const parsed = adminEventSchema.safeParse(parseJson(req));
  if (!parsed.success) return json(res, 400, { error: 'Invalid event update.', fields: parsed.error.flatten().fieldErrors });
  const value = parsed.data;
  let rows;
  if (value.action === 'slot') {
    const result = await sql`SELECT confirm_event_slot(${value.id},${value.slot_id},'admin') ok`;
    if (!result[0]?.ok) return json(res, 409, { error: 'Slot is full or RSVP was not found.' });
  }
  if (value.action === 'status') rows = await sql`UPDATE event_rsvps SET status=${value.status},
    attendance_status=CASE WHEN ${value.status} IN ('attended','no_show') THEN ${value.status} ELSE attendance_status END,
    lost_reason=CASE WHEN ${value.status}='lost' THEN ${value.lost_reason} ELSE NULL END,
    last_contacted_at=CASE WHEN ${value.status}='contacted' THEN NOW() ELSE last_contacted_at END,
    updated_at=NOW() WHERE id=${value.id} RETURNING *`;
  if (value.action === 'assign') rows = await sql`UPDATE event_rsvps SET assigned_to=${value.assigned_to},updated_at=NOW()
    WHERE id=${value.id} RETURNING *`;
  if (value.action === 'activity') {
    await sql`INSERT INTO event_rsvp_activity(rsvp_id,activity_type,details,created_by)
      VALUES(${value.id},${value.activity_type},jsonb_build_object('text',${value.details}),'admin')`;
    rows = await sql`UPDATE event_rsvps SET
      last_contacted_at=CASE WHEN ${value.activity_type} IN ('call','whatsapp') THEN NOW() ELSE last_contacted_at END,
      updated_at=NOW() WHERE id=${value.id} RETURNING *`;
  }
  if (value.action === 'slot') rows = await sql`SELECT * FROM event_rsvps WHERE id=${value.id}`;
  if (!rows?.length) return json(res, 404, { error: 'RSVP not found.' });
  return json(res, 200, { rsvp: rows[0] });
}

function prepareImport(body) {
  const input = Array.isArray(body.rows) ? body.rows.slice(0, 1000) : [];
  const seen = new Set(), accepted = [], rejected = [];
  input.forEach((row, index) => {
    try {
      const phone = normalizeUaePhone(row.phone), email = safeText(row.email, 254).toLowerCase();
      if (!safeText(row.full_name, 100)) throw new Error('Full name required');
      const key = `${phone}|${email}`;
      if (seen.has(key)) throw new Error('Duplicate in file');
      seen.add(key);
      accepted.push({ ...row, full_name: safeText(row.full_name, 100), phone, email,
        source: safeText(row.source || body.source || 'csv-import', 120),
        utm_campaign: safeText(row.utm_campaign || body.campaign, 200) });
    } catch (error) { rejected.push({ row: index + 2, reason: error.message }); }
  });
  return { accepted, rejected };
}

async function importEvent(sql, req, res) {
  const body = parseJson(req), { accepted, rejected } = prepareImport(body);
  if (body.preview !== false) return json(res, 200, { accepted, rejected });
  const created = [], duplicates = [];
  for (const row of accepted) {
    const existing = await sql`SELECT x.id FROM event_rsvps x JOIN events e ON e.id=x.event_id
      WHERE e.slug=${eventSlug} AND (x.phone=${row.phone} OR (${row.email || null} IS NOT NULL
      AND lower(x.email)=lower(${row.email || null}))) LIMIT 1`;
    if (existing.length) { duplicates.push({ phone: row.phone, reason: 'Already exists; not overwritten' }); continue; }
    const rows = await sql`INSERT INTO event_rsvps(event_id,idempotency_key,full_name,phone,email,
      preferred_event_date,consent,source,utm_campaign,status) SELECT id,${randomUUID()},${row.full_name},${row.phone},
      ${row.email || null},${row.preferred_event_date === '2026-08-09' ? '2026-08-09' : '2026-08-08'},TRUE,
      ${row.source},${row.utm_campaign || null},'contact_pending' FROM events WHERE slug=${eventSlug} RETURNING id`;
    created.push(rows[0]);
  }
  return json(res, 201, { imported: created.length, rejected: [...rejected, ...duplicates] });
}

export default async function handler(req, res) {
  if (!method(req, res, ['GET', 'PATCH', 'POST'])) return;
  if (!isAdmin(req)) return json(res, 401, { error: 'Authentication required.' });
  if (req.method !== 'GET' && !isSameOrigin(req)) return json(res, 403, { error: 'Same-origin request required.' });
  try {
    const sql = database();
    if (req.method === 'GET' && req.query?.action === 'export') return await exportEvent(sql, res);
    if (req.method === 'GET') return await listEvent(sql, res);
    if (req.method === 'PATCH') return await updateEvent(sql, req, res);
    return await importEvent(sql, req, res);
  } catch (error) {
    console.error('Event CRM request failed:', error instanceof Error ? error.message : 'unknown');
    return json(res, 500, { error: 'Could not process the event CRM request.' });
  }
}
