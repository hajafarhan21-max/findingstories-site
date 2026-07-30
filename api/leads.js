import { ensureSchema, database } from './_lib/db.js';
import { clientIp, json, method, parseJson, rateLimit } from './_lib/http.js';
import { leadSchema, safeText } from './_lib/validation.js';
import { qualifyLead, fallback } from './_lib/qualify.js';

export default async function handler(req, res) {
  if (!method(req, res, ['POST'])) return;
  if (!rateLimit(`lead:${clientIp(req)}`, 6, 10 * 60_000)) return json(res, 429, { error: 'Too many requests. Please try again later.' });
  try {
    const parsed = leadSchema.safeParse(parseJson(req));
    if (!parsed.success) return json(res, 400, { error: 'Please check the required contact details.', fields: parsed.error.flatten().fieldErrors });
    const lead = parsed.data;
    if (lead.website) return json(res, 202, { ok: true });
    if (!lead.consent) return json(res, 400, { error: 'Contact consent is required.' });
    let qualification;
    try { qualification = await qualifyLead(lead); } catch (error) { console.error('Qualification unavailable:', error instanceof Error ? error.message : 'unknown'); qualification = fallback(lead); }
    await ensureSchema();
    const sql = database();
    const rows = await sql`
      INSERT INTO leads (name, phone, email, country_of_residence, purpose, budget, property_type, bedrooms,
        preferred_areas, payment_method, purchase_timeline, owns_uae_property, additional_requirements, consent,
        source, landing_page, referrer, utm_source, utm_medium, utm_campaign, content_source, lead_score,
        temperature, qualification_summary, requirement_summary, missing_information, next_action,
        suggested_follow_up_date, whatsapp_follow_up_draft, call_opener)
      VALUES (${safeText(lead.name,100)}, ${lead.phone}, ${lead.email || null}, ${lead.country_of_residence || null},
        ${lead.purpose || null}, ${lead.budget || null}, ${lead.property_type || null}, ${lead.bedrooms || null},
        ${lead.preferred_areas || null}, ${lead.payment_method || null}, ${lead.purchase_timeline || null},
        ${lead.owns_uae_property || null}, ${safeText(lead.additional_requirements) || null}, ${lead.consent},
        ${lead.source || 'website'}, ${lead.landing_page || null}, ${lead.referrer || null}, ${lead.utm_source || null},
        ${lead.utm_medium || null}, ${lead.utm_campaign || null}, ${lead.content_source || null},
        ${qualification.lead_score}, ${qualification.temperature}, ${safeText(qualification.qualification_summary)},
        ${safeText(qualification.requirement_summary)}, ${JSON.stringify(qualification.missing_information)},
        ${safeText(qualification.next_action)}, ${qualification.suggested_follow_up_date || null},
        ${safeText(qualification.whatsapp_follow_up_draft)}, ${safeText(qualification.call_opener)}) RETURNING id`;
    json(res, 201, { ok: true, id: rows[0].id, message: 'Thank you. Haja and the Finding Stories team will review your requirement.' });
  } catch (error) {
    console.error('Lead capture failed:', error instanceof Error ? error.message : 'unknown');
    json(res, 500, { error: 'We could not save your enquiry. Please contact us on WhatsApp.' });
  }
}
