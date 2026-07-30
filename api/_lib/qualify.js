const schema = {
  type: 'object', additionalProperties: false,
  properties: {
    lead_score: { type: 'integer', minimum: 0, maximum: 100 },
    temperature: { type: 'string', enum: ['Hot', 'Warm', 'Cold'] },
    qualification_summary: { type: 'string' }, requirement_summary: { type: 'string' },
    missing_information: { type: 'array', items: { type: 'string' } }, next_action: { type: 'string' },
    suggested_follow_up_date: { type: 'string' }, whatsapp_follow_up_draft: { type: 'string' }, call_opener: { type: 'string' }
  }, required: ['lead_score','temperature','qualification_summary','requirement_summary','missing_information','next_action','suggested_follow_up_date','whatsapp_follow_up_draft','call_opener']
};

export async function qualifyLead(lead) {
  if (!process.env.OPENAI_API_KEY) return fallback(lead);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      instructions: `You qualify UAE real-estate advisory leads. Base every statement only on supplied lead data. Never invent prices, inventory, discounts or availability; never guarantee ROI or appreciation. Score intent, completeness, budget readiness and timeline. Temperature must exactly follow score: Hot 75-100, Warm 45-74, Cold 0-44. suggested_follow_up_date must be YYYY-MM-DD. Draft concise, respectful follow-up with no unverified claims.`,
      input: JSON.stringify(lead), text: { format: { type: 'json_schema', name: 'lead_qualification', strict: true, schema } }
    })
  });
  if (!response.ok) throw new Error(`OpenAI qualification failed (${response.status})`);
  const data = await response.json();
  const output = data.output_text || data.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text;
  const result = JSON.parse(output);
  result.temperature = result.lead_score >= 75 ? 'Hot' : result.lead_score >= 45 ? 'Warm' : 'Cold';
  return result;
}

export function fallback(lead) {
  const filled = ['country_of_residence','purpose','budget','property_type','bedrooms','preferred_areas','payment_method','purchase_timeline','owns_uae_property'].filter(k => lead[k]);
  const score = Math.min(70, 15 + filled.length * 5 + (/immediate|30 day/i.test(lead.purchase_timeline || '') ? 10 : 0));
  const missing = ['email','country_of_residence','budget','preferred_areas','payment_method','purchase_timeline'].filter(k => !lead[k]);
  return { lead_score: score, temperature: score >= 45 ? 'Warm' : 'Cold', qualification_summary: 'Lead captured; AI qualification is pending configuration.', requirement_summary: [lead.purpose, lead.property_type, lead.budget].filter(Boolean).join(' · ') || 'Initial enquiry', missing_information: missing, next_action: 'Review the requirement and contact the lead with consent.', suggested_follow_up_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), whatsapp_follow_up_draft: `Hello ${lead.name}, thank you for contacting Finding Stories. May we arrange a brief call to understand your UAE property requirement?`, call_opener: `Hello ${lead.name}, this is Finding Stories following up on your property enquiry.` };
}
