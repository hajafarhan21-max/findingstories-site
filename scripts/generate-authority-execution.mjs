import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { canonicalUrl } from '../api/_lib/seo.js';
import { loadPublicProjects } from '../project-launch/registry.js';

const campaignFor = project => `${project.slug}-project-launch`;
const tracked = (project, source, medium, content) => `${canonicalUrl(project.path)}?${new URLSearchParams({
  utm_source: source,
  utm_medium: medium,
  utm_campaign: campaignFor(project),
  utm_content: content
})}`;
const forbidden = /(?:localhost|vercel\.app|https?:\/\/[^"?]*preview|guaranteed\s+(?:roi|returns?|appreciation)|last chance|act now|limited units? left)/i;
const writeJson = async (path, value) => {
  const text = JSON.stringify(value, null, 2);
  if (forbidden.test(text)) throw new Error(`Unsafe execution output: ${path}`);
  await writeFile(path, `${text}\n`);
};

const registry = JSON.parse(await readFile('authority/targets.json', 'utf8'));
for (const project of (await loadPublicProjects()).filter(item => item.distribution)) {
  const d = project.distribution;
  const dir = `generated/authority/${project.slug}`;
  const destination = canonicalUrl(project.path);
  const campaign = campaignFor(project);
  const disclaimer = d.availability_disclaimer;
  await mkdir(dir, { recursive: true });

  const urls = {
    linkedin: tracked(project, 'linkedin', 'organic_social', 'project_post'),
    instagram: tracked(project, 'instagram', 'organic_social', 'bio_link'),
    facebook: tracked(project, 'facebook', 'organic_social', 'project_post'),
    x: tracked(project, 'x', 'organic_social', 'project_post'),
    whatsapp: tracked(project, 'whatsapp', 'whatsapp_share', 'direct_share'),
    editorial: tracked(project, 'publication_domain', 'editorial', 'project_reference'),
    directory: tracked(project, 'directory_name', 'directory', 'project_profile'),
    partner: tracked(project, 'partner_name', 'partner', 'project_reference'),
    referral: tracked(project, 'partner_name', 'referral', 'project_referral')
  };
  const common = { project: project.name, project_slug: project.slug, campaign, canonical_url: destination, generated_status: 'prepared', external_action_performed: false };
  const facts = [`Developer: ${d.verified_developer_name}`, `Location: ${d.verified_location_name}`, `Residence types: ${d.property_types.join(' and ')}`, d.payment_plan_summary, disclaimer];
  const visual = { reference: d.share_image, requirement: 'Use this existing approved project asset only after confirming rights for the selected account.', alt_text: project.hero_alt };

  const linkedinTopics = [
    ['introduction', `Considering ${project.name}? Finding Stories has brought the key buyer questions into one guide: the ${d.property_types.join(' and ').toLowerCase()} mix, ${d.verified_location_name} context, payment-plan guidance and a route to request current availability.\n\nThis is an advisory starting point, not a prompt to rush. We reconfirm release-specific details before commitment.\n\nReview the guide, then speak privately with an advisor about fit.`, 'Review the buyer guide and ask an advisor to confirm current information.'],
    ['price_residence_mix', `${project.name} includes ${project.unit_types.join(' and ')}. Rather than relying on a headline price, compare the exact residence, layout, current price, fees and intended use.\n\n${d.starting_price_summary} ${disclaimer}\n\nUse our guide to frame a current, unit-specific conversation.`, 'Request current availability and residence-specific pricing.'],
    ['payment_plan', `A payment-plan headline is only the start of the decision. For ${project.name}, buyers should confirm the current milestone schedule, dates, fees and how the cash-flow profile fits their circumstances.\n\n${d.payment_plan_summary} An enquiry is not an official EOI, reservation or booking.\n\nFinding Stories can help you request and review the current information.`, 'Discuss the current payment plan privately with an advisor.'],
    ['buyer_suitability', `Who may find ${project.name} worth reviewing? Buyers considering a ${d.verified_location_name} ${d.property_types.join(' or ').toLowerCase()} can use the project guide as a due-diligence starting point.\n\nSuitability still depends on budget, household needs, intended use, time horizon and confirmed contractual terms. Verify the exact unit, dimensions, price, fees, payment milestones and documents before deciding.\n\nAsk Finding Stories for buyer-focused context—not a one-size-fits-all answer.`, 'Review the guide and ask for a suitability conversation.'],
    ['location_connectivity', `Location should be tested against the journeys that matter to you. ${project.name} is presented in ${d.verified_location_name}; the buyer guide includes the approved location map so you can review the surrounding road and city context.\n\nWe avoid unsupported travel-time promises. Confirm current routes against your own work, school and lifestyle priorities before deciding.`, 'Open the location guide and ask an advisor about your priorities.']
  ];
  const linkedinPosts = linkedinTopics.map(([topic, copy, cta], index) => {
    const trackedUrl = tracked(project, 'linkedin', 'organic_social', `linkedin_${topic}`);
    return { order: index + 1, topic, exact_post_copy: `${copy}\n\n${trackedUrl}`, cta, destination_url: destination, tracked_url: trackedUrl, suggested_visual: visual, alt_text: visual.alt_text, factual_claims_used: facts, disclaimer, buyer_intent: project.primary_intent, expected_conversion_action: 'Project-page visit followed by WhatsApp click or enquiry form submission.', approval_type: 'HUMAN_LOGIN_REQUIRED', status: 'needs_login' };
  });
  const channel = (copy, url, conversion) => ({ exact_post_copy: `${copy}\n\n${url}`, cta: 'Review the buyer guide and request current information privately.', destination_url: destination, tracked_url: url, suggested_visual: visual, alt_text: visual.alt_text, factual_claims_used: facts, disclaimer, buyer_intent: project.primary_intent, expected_conversion_action: conversion, approval_type: 'HUMAN_LOGIN_REQUIRED', status: 'needs_login' });
  const instagram = {
    feed_captions: [
      channel(`${d.instagram_caption}\n\nFinding Stories offers buyer-focused advisory context; it does not represent the developer.`, tracked(project, 'instagram', 'organic_social', 'feed_residence_mix'), 'Bio-link project visit, WhatsApp click or enquiry.'),
      channel(`${project.name}: a considered starting point for comparing ${d.property_types.join(' and ').toLowerCase()} in ${d.verified_location_name}. Review the exact residence, current price, fees, payment milestones and intended use before deciding. ${disclaimer}`, tracked(project, 'instagram', 'organic_social', 'feed_buyer_checklist'), 'Bio-link visit and current-information request.'),
      channel(`Location fit is personal. Use the approved ${project.name} map to compare the routes and places that matter to you, without relying on unsupported travel-time claims. Ask Finding Stories for current project context.`, tracked(project, 'instagram', 'organic_social', 'feed_location'), 'Bio-link visit and advisor conversation.')
    ],
    story_frames: [
      { frame: 1, copy: `${project.name}: buyer guide`, cta: 'Open the guide', tracked_url: tracked(project, 'instagram', 'organic_social', 'story_intro') },
      { frame: 2, copy: `${d.property_types.join(' + ')} in ${d.verified_location_name}`, cta: 'Compare residences', tracked_url: tracked(project, 'instagram', 'organic_social', 'story_residences') },
      { frame: 3, copy: 'Payment plan? Confirm milestones, dates and fees.', cta: 'Request current details', tracked_url: tracked(project, 'instagram', 'organic_social', 'story_payment_plan') },
      { frame: 4, copy: 'Check location against the journeys that matter to you.', cta: 'Review the map', tracked_url: tracked(project, 'instagram', 'organic_social', 'story_location') },
      { frame: 5, copy: 'Need unit-specific context?', cta: 'Ask a Finding Stories advisor', tracked_url: tracked(project, 'instagram', 'organic_social', 'story_advisor') }
    ],
    reel_caption_concepts: [
      { concept: 'Residence-mix walkthrough using approved page imagery', caption: `A concise look at the ${project.name} residence mix—and the questions to ask before choosing. ${disclaimer}`, tracked_url: tracked(project, 'instagram', 'organic_social', 'reel_residence_mix') },
      { concept: 'Payment-plan questions, presented as text overlays', caption: `Do not stop at the headline: confirm milestones, dates, fees and current terms for ${project.name}.`, tracked_url: tracked(project, 'instagram', 'organic_social', 'reel_payment_questions') },
      { concept: 'Approved location-map review', caption: `Test ${project.name}'s location against your own priorities, without unsupported journey-time promises.`, tracked_url: tracked(project, 'instagram', 'organic_social', 'reel_location') }
    ],
    cta_variants: ['Review the buyer guide.', 'Request current availability privately.', 'Ask an advisor to help assess fit.'],
    approval_type: 'HUMAN_LOGIN_REQUIRED', status: 'needs_login'
  };
  const whatsappMessages = {
    short_share: `A useful buyer guide to ${project.name}: ${urls.whatsapp}`,
    investor_focused: `If you are assessing ${project.name}, this Finding Stories guide covers the verified residence mix, location and payment-plan context. Investment suitability depends on your objectives and confirmed terms; outcomes are not guaranteed. ${tracked(project, 'whatsapp', 'whatsapp_share', 'investor_share')}`,
    end_user_focused: `Considering ${project.name} as a home? Review the residence choices and location context, then ask us to confirm current unit details and terms. ${tracked(project, 'whatsapp', 'whatsapp_share', 'end_user_share')}`,
    send_to_referral: `Sharing a buyer-focused Finding Stories guide that may be relevant to someone comparing ${d.property_types.join(' and ').toLowerCase()} in ${d.verified_location_name}. No obligation—current details are confirmed on request. ${urls.referral}`,
    follow_up: `Following up with the ${project.name} guide in case it is useful. If you share your preferred residence type and priorities, a Finding Stories advisor can help confirm current information. ${tracked(project, 'whatsapp', 'whatsapp_share', 'follow_up')}`
  };
  const socialPack = { ...common, account_ownership_verified: false, publication_performed: false, recommended_linkedin_order: linkedinPosts.map(post => post.topic), linkedin_posts: linkedinPosts, instagram, channels: { linkedin: linkedinPosts[0], instagram: instagram.feed_captions[0], facebook: channel(d.facebook_copy, urls.facebook, 'Project-page visit, WhatsApp click or enquiry.'), x: channel(d.x_copy, urls.x, 'Project-page visit, WhatsApp click or enquiry.'), whatsapp: { ...channel(whatsappMessages.short_share, urls.whatsapp, 'Direct project-page visit, WhatsApp continuation or enquiry.'), exact_post_copy: whatsappMessages.short_share } }, whatsapp_messages: whatsappMessages };

  const pitchAngles = [
    ['A buyer checklist for evaluating a Sharjah townhouse or villa project', 'a practical due-diligence checklist'],
    [`How to compare ${project.name}'s residence mix`, 'a household-fit and residence comparison'],
    [`What a payment-plan headline does not tell a buyer`, 'questions buyers should ask about milestones, dates and fees'],
    [`Testing location and connectivity claims against real buyer needs`, 'a map-led method that avoids unsupported travel-time claims'],
    [`From enquiry to EOI: distinctions buyers should understand`, 'a plain-language explanation of project enquiry and next-step verification']
  ];
  const editorialPitches = pitchAngles.map(([subject, readerAngle], index) => ({
    subject, opening: `Hello [editor name] — I am proposing ${readerAngle} for your verified [section/audience].`,
    why_relevant: `It gives UAE property readers a decision framework rather than promotional urgency.`, useful_reader_angle: readerAngle,
    florence_facts: facts, finding_stories_role: 'Finding Stories provides buyer-focused project context and private advisory support; it does not claim official developer representation or independent publisher status.',
    canonical_project_link: destination, tracked_url: tracked(project, 'publication_domain', 'editorial', `pitch_${index + 1}`),
    asset_source_offer: `We can provide the approved project image reference, map and source-noted fact summary for your own editorial review; rights and credits must be confirmed before use.`,
    no_pressure_close: 'If this is not useful for your audience, no response or placement is expected. If it is, I can tailor the source notes to your editorial requirements.',
    approval_type: 'RELATIONSHIP_REQUIRED', status: 'needs_relationship', sent: false
  }));
  const partnerRoles = ['broker', 'property advisor', 'investor community', 'relocation professional', 'mortgage advisor'];
  const partnerOutreach = partnerRoles.map(role => ({ role, template: `Hello [name] — I am sharing a buyer-focused ${project.name} guide only because it may help your ${role} audience assess the residence mix, location and questions around current terms. Finding Stories can provide private advisory context; no partnership or endorsement is implied. If relevant to a buyer you already support, please use this tracked resource: ${urls.partner}`, destination_url: destination, tracked_url: urls.partner, status: 'needs_relationship', sent: false }));

  const board = [
    { id: 'social-linkedin-introduction', priority: 1, channel: 'linkedin', target_name: 'Finding Stories LinkedIn account', action: 'Verify account ownership, approve and publish the project-introduction post.', action_type: 'HUMAN_LOGIN_REQUIRED', objective: 'Reach advisory-led buyers with a fact-safe project introduction.', buyer_intent: project.primary_intent, why_now: 'Highest-fit professional channel for Finding Stories advisory positioning.', destination_url: destination, tracked_url: linkedinPosts[0].tracked_url, content_asset: 'social-revenue-pack.json#/linkedin_posts/0', approval_requirement: 'Authorized account owner and content approver.', evidence_required: 'Owned account URL, public post URL, screenshot and publication time.', status: 'needs_login', next_action: 'Operator verifies the account URL and records approval before publishing.', success_definition: 'A public approved post generates attributable project sessions or an enquiry.', success_metric: 'Referral sessions, WhatsApp clicks, lead_form_start and lead_success.', revenue_connection: 'Professional discovery to buyer guide to advisor enquiry.' },
    { id: 'whatsapp-qualified-share', priority: 2, channel: 'whatsapp', target_name: 'Known consented buyer or referrer', action: 'Send the audience-matched message to one relevant existing contact.', action_type: 'HUMAN_APPROVAL_REQUIRED', objective: 'Create a qualified one-to-one project visit.', buyer_intent: project.primary_intent, why_now: 'Direct, contextual sharing has a short path to advisor conversation.', destination_url: destination, tracked_url: urls.whatsapp, content_asset: 'social-revenue-pack.json#/whatsapp_messages', approval_requirement: 'Authorized advisor selects a consented, contextually relevant recipient.', evidence_required: 'Internal send record without exposing personal data in repository; attributed session or response when available.', status: 'needs_approval', next_action: 'Choose the correct prepared message for a known relevant recipient.', success_definition: 'Recipient visits the guide and starts a relevant conversation or enquiry.', success_metric: 'WhatsApp clicks, referral sessions and qualified leads.', revenue_connection: 'Trusted share to direct advisor conversation.' },
    { id: 'social-instagram-guide', priority: 3, channel: 'instagram', target_name: 'Finding Stories Instagram account', action: 'Verify ownership and publish the residence-mix feed asset with an approved visual.', action_type: 'HUMAN_LOGIN_REQUIRED', objective: 'Support visual project discovery and buyer comparison.', buyer_intent: project.primary_intent, why_now: 'Existing approved image reference and complete caption are ready.', destination_url: destination, tracked_url: instagram.feed_captions[0].tracked_url, content_asset: 'social-revenue-pack.json#/instagram/feed_captions/0', approval_requirement: 'Authorized account owner, copy approval and image-rights confirmation.', evidence_required: 'Owned account URL, rights confirmation, live post URL and screenshot.', status: 'needs_login', next_action: 'Verify account and visual rights; then publish exactly the approved asset.', success_definition: 'A verified public post sends attributable buyer visits to Florence.', success_metric: 'Instagram referral sessions, WhatsApp clicks and lead_success.', revenue_connection: 'Visual discovery to project consideration and enquiry.' },
    { id: 'editorial-target-verification', priority: 4, channel: 'editorial', target_name: 'Relevant UAE property editorial opportunity', action: 'Identify and verify one real publication whose current audience fits one prepared angle.', action_type: 'EVIDENCE_REQUIRED', objective: 'Create a legitimate editorial path for buyer education.', buyer_intent: 'Due diligence and project comparison.', why_now: 'Five source-aware pitches are ready, but no recipient is asserted.', destination_url: destination, tracked_url: urls.editorial, content_asset: 'editorial-pitches.json', approval_requirement: 'Human verifies publication, current section, contact route and approves outreach.', evidence_required: 'Publication domain, relevant recent coverage URL, public contact route and review date.', status: 'needs_verification', next_action: 'Research one publication and record evidence; do not send until approved.', success_definition: 'A tailored pitch is approved and sent to a verified relevant editor.', success_metric: 'Verified target, outreach sent, response, live citation and referral sessions.', revenue_connection: 'Trusted editorial discovery to buyer guide and enquiry.' },
    { id: 'partner-first-referral', priority: 5, channel: 'partner', target_name: 'Existing relevant professional relationship', action: 'Select one documented relationship and tailor the matching partner template.', action_type: 'RELATIONSHIP_REQUIRED', objective: 'Enable a useful project referral in an existing professional context.', buyer_intent: 'Project comparison and advisory referral.', why_now: 'Relationship-first distribution can qualify context before the visit.', destination_url: destination, tracked_url: urls.partner, content_asset: 'partner-outreach-pack.json', approval_requirement: 'Relationship owner confirms context and approves the one-to-one message.', evidence_required: 'Internal relationship basis, approved copy and send outcome; no personal data in generated files.', status: 'needs_relationship', next_action: 'Relationship owner selects a role template and adds truthful context.', success_definition: 'A relevant partner shares the guide with an eligible buyer or requests more information.', success_metric: 'Partner/referral sessions and qualified enquiries.', revenue_connection: 'Professional referral to advisory conversation.' },
    { id: 'directory-opportunity-verification', priority: 6, channel: 'directory', target_name: 'Legitimate UAE business or property directory opportunity', action: 'Verify a moderated, relevant directory and its business eligibility requirements.', action_type: 'EVIDENCE_REQUIRED', objective: 'Establish accurate entity discovery without bulk listing.', buyer_intent: 'Find and validate a UAE property advisory resource.', why_now: 'Business copy exists, but identity and eligibility fields remain missing.', destination_url: destination, tracked_url: urls.directory, content_asset: 'profile-execution.json', approval_requirement: 'Human verifies target, entitlement and business identity fields.', evidence_required: 'Exact domain, submission policy, category fit, required fields and review date.', status: 'needs_verification', next_action: 'Name and verify one directory; reject unmoderated or irrelevant candidates.', success_definition: 'One eligible profile is ready for truthful human submission.', success_metric: 'Verified profile target, submitted profile, live citation and referral sessions.', revenue_connection: 'Entity discovery to project guide and enquiry.' }
  ];
  const tierA = { ...common, qualification: 'High relevance, legitimacy, buyer intent, realistic path, low spam risk and measurable referral potential.', actions: board.slice(0, 3) };
  const profile = { ...common, opportunities: registry.targets.filter(target => target.target_type === 'directory').map(target => ({ target_name: target.target_name, exact_business_name: 'Finding Stories', target_website: target.domain ? `https://${target.domain}` : null, business_website: 'https://www.finding-stories.com', category: 'Real estate advisory', description: 'Finding Stories publishes factual, buyer-focused guides to approved UAE property projects and provides private advisory support.', project_url: destination, homepage_url: 'https://www.finding-stories.com', tracked_url: urls.directory, missing_required_fields: ['Exact eligible directory domain', 'Current submission policy and URL', 'Verified contact details', 'Verified legal entity', 'Verified office address if required', 'Verified opening hours if required'], human_verification_required: true, submission_readiness: 'blocked_pending_target_and_identity_verification', submitted: false })) };
  const gbp = { ...common, create_or_claim_automatically: false, readiness: 'blocked', checklist: [
    { missing_information: 'Verified public business name and legal operating basis', used_for: 'Business identity and eligibility', evidence_needed: 'Current official registration or equivalent ownership evidence.' },
    { missing_information: 'Real customer-facing location or truthful service-area eligibility', used_for: 'Address/service-area configuration', evidence_needed: 'Operational evidence meeting current Google eligibility rules; do not use a virtual or fabricated office.' },
    { missing_information: 'Verified business phone and authorized owner', used_for: 'Customer contact and profile verification', evidence_needed: 'Business-controlled phone and owner authorization.' },
    { missing_information: 'Accurate operating hours', used_for: 'Public profile hours', evidence_needed: 'Documented hours during which customers can receive service.' }
  ], schema_instruction: 'Do not add LocalBusiness schema unless these facts are truthfully supported and approved.' };
  const humanQueue = board.map(item => ({ id: item.id, action: item.action, platform: item.channel, reason_human_required: item.approval_requirement, exact_content_ready_to_use: item.content_asset, exact_destination_url: item.destination_url, exact_tracked_url: item.tracked_url, exact_evidence_to_capture: item.evidence_required, completion_checklist: ['Confirm the target and entitlement.', 'Approve facts, copy and any asset rights.', 'Perform the action through an authorized account only.', 'Capture the real public URL or private completion evidence.', 'Update status without inferring publication, traffic or leads.'] })).concat([{ id: 'google-business-profile-readiness', action: 'Verify GBP eligibility and missing business identity information only if the business chooses to pursue a profile.', platform: 'google_business_profile', reason_human_required: 'Repository data cannot prove real-world eligibility, location, phone or ownership.', exact_content_ready_to_use: 'google-business-profile-readiness.json', exact_destination_url: 'https://www.finding-stories.com', exact_tracked_url: urls.directory, exact_evidence_to_capture: 'Eligibility evidence and each verified business field; do not create a profile during this campaign.', completion_checklist: ['Review the four missing-information items.', 'Collect documentary evidence.', 'Obtain business-owner approval.', 'Do not use a fake address, office or service area.'] }]);
  const today = { ...common, operator_capacity: 'one operator', actions: [
    { order: 1, category: 'social publish', action_id: board[0].id, action: board[0].action, status: board[0].status },
    { order: 2, category: 'authority verification', action_id: board[3].id, action: board[3].next_action, status: board[3].status },
    { order: 3, category: 'outreach', action_id: board[4].id, action: board[4].next_action, status: board[4].status },
    { order: 4, category: 'profile', action_id: board[5].id, action: board[5].next_action, status: board[5].status },
    { order: 5, category: 'performance review', action: 'Record only available Search Console, referral and conversion metrics; retain null for unavailable values and do not request indexing again.', status: 'needs_login' }
  ] };
  const weekly = { ...common, volume_guardrail: 'Maximum three social posts, two profile/authority actions, two relationship actions, one editorial asset, one citation pass and one Search Console review.', days: [
    { day: 1, actions: ['Verify the Finding Stories LinkedIn account and approve the introduction post.', 'Record the Search Console Florence status and available impressions, clicks, queries, CTR and position; do not request indexing.'] },
    { day: 2, actions: ['Publish the approved LinkedIn introduction through the authorized account, or retain needs_login.', 'Verify one relevant editorial publication and contact route.'] },
    { day: 3, actions: ['Tailor one relationship-first partner message to a documented contact; obtain approval before sending.'] },
    { day: 4, actions: ['Verify one moderated directory and its eligibility requirements.', 'Prepare the location/connectivity LinkedIn post for approval.'] },
    { day: 5, actions: ['Send at most one approved editorial pitch to the verified recipient.', 'Publish one approved Instagram or LinkedIn asset; do not exceed three social posts this week.'] },
    { day: 6, actions: ['Perform citation verification: only public URLs with complete evidence may be live.'] },
    { day: 7, actions: ['Review attributable sessions, WhatsApp clicks, lead starts/success and qualified enquiries; leave unavailable data null.'] }
  ] };
  const metrics = { ...common, reporting_period: null, authority_actions_prepared: board.length, authority_actions_completed: 0, targets_verified: 0, submissions_made: 0, live_citations: 0, referral_sessions: null, organic_sessions: null, organic_impressions: null, project_search_queries: null, whatsapp_clicks: null, lead_form_start: null, lead_success: null, qualified_leads: null, meetings: null, note: 'Prepared counts come from repository outputs. Analytics, Search Console, CRM and meeting metrics remain null until imported from an authorized source.' };
  const citation = { ...common, allowed_statuses: ['pending', 'live', 'removed', 'changed', 'unreachable'], live_gate: { required_fields: ['source_domain', 'live_url', 'destination_url', 'date_verified', 'anchor_or_context', 'status', 'evidence_reference', 'last_checked'], rule: 'Never set live unless an operator independently opens the public URL, verifies every required field and records evidence.' }, records: [] };
  const audit = { ...common, findings: [
    { severity: 'P0', finding: 'No defect found in protected lead, attribution or technical SEO systems; they were not changed.', resolution: 'none_required' },
    { severity: 'P1', finding: 'Authority outputs stopped at review-first preparation and lacked a prioritized revenue execution board.', resolution: 'Added deterministic execution generator and operational outputs.' },
    { severity: 'P1', finding: 'Existing targets are opportunity categories, not verified owned accounts, publishers, contacts or submission routes.', resolution: 'Retained needs_verification gates; platform domains do not establish account ownership.' },
    { severity: 'P1', finding: 'Social, editorial, partner, profile, daily and human-ready execution copy was incomplete.', resolution: 'Added publication-ready and relationship-first assets with authorization gates.' },
    { severity: 'P2', finding: 'Analytics could be integrated into static reporting in a future authorized workflow.', resolution: 'Deferred; unavailable metrics remain null.' }
  ], verification: { reviewed_at: '2026-09-13', environment_result: 'linkedin.com and instagram.com returned HTTP 200 during public domain checks; this verifies only platform-domain availability, not Finding Stories account existence or ownership.', targets: registry.targets.map(target => ({ target_name: target.target_name, exact_domain: target.domain, platform_or_category: target.domain ? 'platform' : 'candidate_category', legitimacy: target.domain ? 'public_platform_domain_reachable' : 'not_verifiable_without_named_target', relevance: target.project_relevance, finding_stories_account_owned: false, usable_now: false, verification_status: 'needs_verification', reason: target.domain ? 'No exact Finding Stories profile URL or ownership evidence exists.' : 'No exact domain, contact or submission URL exists.' })) }, ai_search_citability: { concise: true, factual: true, attributable: true, entity_consistent: true, source_aware: true, source: `projects/${project.slug}/manifest.json`, note: 'All public-facing summaries identify Finding Stories role, qualify mutable facts and avoid hidden or AI-only content.' } };

  const files = {
    'revenue-execution-board.json': { ...common, sort: 'highest-value legitimate action first', actions: board },
    'tier-a-actions.json': tierA,
    'social-revenue-pack.json': socialPack,
    'editorial-pitches.json': { ...common, pitches: editorialPitches },
    'partner-outreach-pack.json': { ...common, automatic_sending: false, templates: partnerOutreach },
    'profile-execution.json': profile,
    'google-business-profile-readiness.json': gbp,
    'human-action-queue.json': { ...common, actions: humanQueue },
    'today.json': today,
    'weekly-execution.json': weekly,
    'execution-dashboard-metrics.json': metrics,
    'citation-log.json': citation,
    'authority-execution-audit.json': audit
  };
  for (const [name, value] of Object.entries(files)) await writeJson(`${dir}/${name}`, value);
}
console.log('Generated authority revenue execution packages for approved public projects.');
