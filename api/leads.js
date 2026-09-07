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
    call_opener=${safeText(result.call_opener)}, qualification_status=${result.qualification_status},
    qualification_source=${result.qualification_source}, qualified_at=NOW() WHERE id=${id}`;
}

async function markQualificationStarted(sql, id) {
  await sql`UPDATE leads SET qualification_status='processing', qualification_started_at=NOW() WHERE id=${id} AND qualification_status='pending'`;
}

async function persistLead(sql, lead) {
  const touch={source:lead.source||'website',medium:lead.medium||'',utm_source:lead.utm_source||'',utm_medium:lead.utm_medium||'',utm_campaign:lead.utm_campaign||'',utm_content:lead.utm_content||'',utm_term:lead.utm_term||'',landing_page:lead.landing_page||'',referrer:lead.referrer||''};
  const firstTouch=lead.first_touch_attribution||touch;
  const latestTouch=lead.latest_touch_attribution||touch;
  const rows = await sql`WITH attempted AS (
    INSERT INTO leads (submission_id, name, phone, email, country_of_residence, purpose, budget, property_type,
      bedrooms, preferred_areas, payment_method, purchase_timeline, owns_uae_property, additional_requirements,
      consent, source, medium, landing_page, referrer, utm_source, utm_medium, utm_campaign, utm_content, utm_term, content_source,
      campaign_id, project_id, first_touch_attribution, latest_touch_attribution, preferred_contact_method,
      page_type, acquisition_area, acquisition_project, acquisition_developer, budget_intent, bedroom_intent, acquisition_signals)
    VALUES (${lead.submission_id || null}, ${safeText(lead.name,100)}, ${lead.phone}, ${lead.email || null},
      ${lead.country_of_residence || null}, ${lead.purpose || null}, ${lead.budget || null},
      ${lead.property_type || null}, ${lead.bedrooms || null}, ${lead.preferred_areas || null},
      ${lead.payment_method || null}, ${lead.purchase_timeline || null}, ${lead.owns_uae_property || null},
      ${safeText(lead.additional_requirements) || null}, ${lead.consent}, ${lead.source || 'website'},${lead.medium||null},
      ${lead.landing_page || null}, ${lead.referrer || null}, ${lead.utm_source || null}, ${lead.utm_medium || null},
      ${lead.utm_campaign || null},${lead.utm_content||null},${lead.utm_term||null}, ${lead.content_source || null},
      ${lead.campaign_id||null},${lead.project_id||null},${JSON.stringify(firstTouch)}::jsonb,${JSON.stringify(latestTouch)}::jsonb,${lead.preferred_contact_method||null},
      ${lead.page_type||null},${lead.acquisition_area||null},
      ${lead.acquisition_project||null},${lead.acquisition_developer||null},${lead.budget_intent||null},${lead.bedroom_intent||null},${JSON.stringify(lead.acquisition_signals||[])})
    ON CONFLICT (submission_id) WHERE submission_id IS NOT NULL DO NOTHING
    RETURNING id,captured_at,FALSE duplicate
    ), duplicate AS (
      UPDATE leads SET latest_touch_attribution=${JSON.stringify(latestTouch)}::jsonb,updated_at=NOW()
      WHERE submission_id=${lead.submission_id||null} AND NOT EXISTS (SELECT 1 FROM attempted)
      RETURNING id,captured_at,TRUE duplicate
    ) SELECT * FROM attempted UNION ALL SELECT * FROM duplicate`;
  if (rows[0]) return rows[0];
  return {};
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
    let attributedLead=lead;
    if(lead.campaign_id){
      const campaigns=await sql`SELECT id,project_id FROM crm_campaigns WHERE id=${lead.campaign_id} AND is_test=FALSE AND status='ACTIVE'`;
      if(!campaigns.length||lead.project_id&&String(campaigns[0].project_id)!==lead.project_id)return json(res,400,{error:'Campaign attribution is not valid for this production project.'});
      attributedLead={...lead,project_id:String(campaigns[0].project_id)};
    } else if(lead.project_id){
      const projects=await sql`SELECT id FROM projects WHERE id=${lead.project_id} AND is_test=FALSE AND active=TRUE AND review_status='verified'`;
      if(!projects.length)return json(res,400,{error:'Project attribution is not valid.'});
    }
    const saved = await persistAndSchedule({
      lead:attributedLead,
      persist: value => persistLead(sql, value),
      schedule: scheduleQualification,
      background: value => qualifySavedLead({
        id: value.id, lead:attributedLead, capturedAt: value.captured_at, qualify: qualifyLead, fallback,
        start: id => markQualificationStarted(sql, id),
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
