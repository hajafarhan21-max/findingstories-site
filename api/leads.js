import { waitUntil } from '@vercel/functions';
import { ensureSchema, database } from './_lib/db.js';
import { clientIp, json, method, parseJson, rateLimit } from './_lib/http.js';
import { leadSchema, safeText } from './_lib/validation.js';
import { qualifyLead, fallback } from './_lib/qualify.js';
import { persistAndSchedule, qualifySavedLead } from './_lib/workflow.js';

async function updateQualification(sql, id, result) {
  await sql`UPDATE leads SET lead_score=${result.lead_score}, temperature=${result.temperature},
    qualification_summary=${safeText(result.qualification_summary)}, requirement_summary=${safeText(result.requirement_summary)},
    missing_information=${JSON.stringify(result.missing_information || [])}, next_action=${safeText(result.next_action)},
    suggested_follow_up_date=${result.suggested_follow_up_date}, whatsapp_follow_up_draft=${safeText(result.whatsapp_follow_up_draft)},
    call_opener=${safeText(result.call_opener)}, qualification_status=${result.qualification_status} WHERE id=${id}`;
}

async function persistLead(sql, lead) {
  const rows = await sql`
    INSERT INTO leads (submission_id, name, phone, email, country_of_residence, purpose, budget, property_type,
      bedrooms, preferred_areas, payment_method, purchase_timeline, owns_uae_property, additional_requirements,
      consent, source, landing_page, referrer, utm_source, utm_medium, utm_campaign, content_source)
    VALUES (${lead.submission_id || null}, ${safeText(lead.name,100)}, ${lead.phone}, ${lead.email || null},
      ${lead.country_of_residence || null}, ${lead.purpose || null}, ${lead.budget || null},
      ${lead.property_type || null}, ${lead.bedrooms || null}, ${lead.preferred_areas || null},
      ${lead.payment_method || null}, ${lead.purchase_timeline || null}, ${lead.owns_uae_property || null},
      ${safeText(lead.additional_requirements) || null}, ${lead.consent}, ${lead.source || 'website'},
      ${lead.landing_page || null}, ${lead.referrer || null}, ${lead.utm_source || null}, ${lead.utm_medium || null},
      ${lead.utm_campaign || null}, ${lead.content_source || null})
    ON CONFLICT (submission_id) WHERE submission_id IS NOT NULL DO NOTHING
    RETURNING id, created_at`;
  if (rows[0]) return { ...rows[0], duplicate: false };
  const existing = await sql`SELECT id, created_at FROM leads WHERE submission_id=${lead.submission_id} LIMIT 1`;
  return { ...existing[0], duplicate: true };
}

function scheduleQualification(promise) {
  try {
    waitUntil(promise);
  } catch (error) {
    // The row is already durable. Never turn a background scheduling issue into a lost/failed visitor submission.
    console.error('Background scheduling unavailable:', error instanceof Error ? error.message : 'unknown');
  }
}

export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  if (!rateLimit(`lead:${clientIp(req)}`, 6, 10 * 60_000)) return json(res, 429, { error: 'Too many requests. Please try again later.' });
  try {
    const parsed = leadSchema.safeParse(parseJson(req));
    if (!parsed.success) return json(res, 400, { error: 'Please check the required contact details.', fields: parsed.error.flatten().fieldErrors });
    const lead = parsed.data;
    if (lead.website) return json(res, 202, { ok: true });
    if (!lead.consent) return json(res, 400, { error: 'Contact consent is required.' });

    await ensureSchema();
    const sql = database();
    const saved = await persistAndSchedule({
      lead,
      persist: value => persistLead(sql, value),
      schedule: scheduleQualification,
      background: value => qualifySavedLead({
        id: value.id, lead, capturedAt: value.created_at, qualify: qualifyLead, fallback,
        update: (id, result) => updateQualification(sql, id, result)
      }).catch(error => console.error('Background qualification update failed:', error instanceof Error ? error.message : 'unknown'))
    });

    json(res, saved.duplicate ? 200 : 201, { ok: true, id: saved.id, duplicate: saved.duplicate,
      message: 'Thank you. Haja and the Finding Stories team will review your requirement.' });
  } catch (error) {
    console.error('Lead capture failed:', error instanceof Error ? error.message : 'unknown');
    json(res, 500, { error: 'We could not save your enquiry. Please contact us on WhatsApp.' });
  }
}
