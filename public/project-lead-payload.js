const FORM_FIELDS=['name','phone','email','country_of_residence','purpose','budget','property_type','bedrooms','preferred_areas','payment_method','purchase_timeline','owns_uae_property','preferred_contact_method','website'];

/** Convert browser FormData values to the strict /api/leads contract. UI-only
 * fields such as enquiry_type must never leak into the Zod-strict API body. */
export function buildProjectLeadPayload({values,context,latest,first,submissionId}){
  const payload=Object.fromEntries(FORM_FIELDS.filter(key=>values[key]!==undefined).map(key=>[key,values[key]]));
  const intent=values.enquiry_type||'register_interest';
  const signals=['project_page_enquiry'];
  if(intent==='consultation_request')signals.push('meeting_request');
  if(intent==='site_visit_request')signals.push('site_visit_request');
  return {...payload,consent:Boolean(values.consent),submission_id:submissionId,campaign_id:context.campaign_id,project_id:context.project_id,source:latest.source,medium:latest.medium,landing_page:latest.landing_page,referrer:latest.referrer,utm_source:latest.utm_source,utm_medium:latest.utm_medium,utm_campaign:latest.utm_campaign,utm_content:latest.utm_content,utm_term:latest.utm_term,first_touch_attribution:first,latest_touch_attribution:latest,page_type:'project',acquisition_project:context.project,acquisition_developer:context.developer,acquisition_area:context.area,acquisition_signals:signals,additional_requirements:`${intent}${values.additional_requirements?`: ${values.additional_requirements}`:''}`};
}
