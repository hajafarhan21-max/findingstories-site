export const AZIZI_FLORENCE_PATH = '/azizi-florence';
export const AZIZI_FLORENCE_CAMPAIGN = 'Azizi Florence — Pre-Launch EOI Campaign';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=(value,currency='AED')=>new Intl.NumberFormat('en-AE',{style:'currency',currency,maximumFractionDigits:0}).format(Number(value));
const area=value=>`${new Intl.NumberFormat('en-AE',{maximumFractionDigits:0}).format(Number(value))} sq ft`;
const present=value=>value!==null&&value!==undefined&&value!=='';
const fact=(label,value)=>present(value)?`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`:'';
const label=value=>String(value||'').replaceAll('_',' ').replace(/\b\w/g,x=>x.toUpperCase());

export function formatHandover(value){
  if(!value)return '';
  const raw=value instanceof Date?value:new Date(String(value).length===10?`${value}T00:00:00Z`:value);
  return Number.isNaN(raw.getTime())?'':new Intl.DateTimeFormat('en-AE',{month:'long',year:'numeric',timeZone:'UTC'}).format(raw);
}

function verifiedList(attributes={},keys=[]){
  for(const key of keys){
    const value=attributes?.[key];
    if(Array.isArray(value))return value.map(String).map(x=>x.trim()).filter(Boolean);
    if(typeof value==='string')return value.split(/\r?\n|\s*[|;]\s*/).map(x=>x.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
  }
  return [];
}

function paymentMilestones(summary=''){
  const matches=[...String(summary).matchAll(/(\d{1,3})\s*%\s*(.*?)(?=(?:[+/|;,]\s*)?\d{1,3}\s*%|$)/g)].map(match=>({percentage:Number(match[1]),title:match[2].trim().replace(/^[-–—:+/|;,]\s*|[+/|;,]\s*$/g, '')}));
  return matches.length>=2?matches:[];
}

export const FLORENCE_MEDIA_CLASS=Object.freeze({HERO_CANDIDATE:'HERO_CANDIDATE',PROJECT_PHOTOGRAPHY:'PROJECT_PHOTOGRAPHY',LIFESTYLE_PHOTOGRAPHY:'LIFESTYLE_PHOTOGRAPHY',MASTERPLAN_OR_MAP:'MASTERPLAN_OR_MAP',FLOORPLAN:'FLOORPLAN',DOCUMENT_OR_TABLE:'DOCUMENT_OR_TABLE',LOGO:'LOGO',UNSUITABLE:'UNSUITABLE'});

/** Classify conservatively: an image needs positive photographic metadata before it can decorate the page. */
export function classifyFlorenceMedia(source={}){
  const text=`${source.filename||''} ${source.source_kind||''}`.toLowerCase().replace(/[_-]+/g,' ');
  if(/\b(logo|wordmark|brand mark)\b/.test(text))return FLORENCE_MEDIA_CLASS.LOGO;
  if(/\b(floor ?plan|floorplate|layout plan)\b/.test(text))return FLORENCE_MEDIA_CLASS.FLOORPLAN;
  if(/\b(map|location plan|master ?plan)\b/.test(text))return FLORENCE_MEDIA_CLASS.MASTERPLAN_OR_MAP;
  if(/\b(payment|price|pricing|comparison|table|schedule|inventory|stock|bifurcation|unit mix|matrix)\b/.test(text))return FLORENCE_MEDIA_CLASS.DOCUMENT_OR_TABLE;
  if(/\b(sales offer|offer sheet|sales sheet|quotation|fact ?sheet|sales presentation|brochure|document|spreadsheet|pdf)\b/.test(text))return FLORENCE_MEDIA_CLASS.DOCUMENT_OR_TABLE;
  if(/\b(lifestyle|amenit|park|garden|pool|gym|fitness|sport|play|retail|dining|landscape)\b/.test(text))return FLORENCE_MEDIA_CLASS.LIFESTYLE_PHOTOGRAPHY;
  if(/\b(hero|cover|aerial|signature view|main visual)\b/.test(text)&&/\b(florence|project|exterior|facade|community)\b/.test(text))return FLORENCE_MEDIA_CLASS.HERO_CANDIDATE;
  if(/\b(render|photograph|photo|exterior|interior|facade|arrival|residence|villa|townhouse|living|bedroom|kitchen|community)\b/.test(text))return FLORENCE_MEDIA_CLASS.PROJECT_PHOTOGRAPHY;
  return FLORENCE_MEDIA_CLASS.UNSUITABLE;
}

export const AZIZI_FLORENCE_ASSET_MANIFEST=Object.freeze({
  hero:null,
  overview_main:null,
  overview_thumb_1:null,
  overview_thumb_2:null,
  overview_thumb_3:null,
  overview_thumb_4:null,
  residence_3br_townhouse:null,
  residence_4br_townhouse:null,
  residence_4br_villa:null,
  residence_5br_villa:null,
  residence_6br_villa:null,
  payment_plan_visual:null,
  amenities_background:null,
  location_map:null
});

/** Resolve only exact, human-audited Florence manifest entries; never infer or recycle a source. */
export function resolveFlorenceAssets(sources=[],manifest=AZIZI_FLORENCE_ASSET_MANIFEST){
  const byExactReference=reference=>{
    if(!reference)return undefined;
    const source=sources.find(item=>item.id===reference.id&&item.filename===reference.filename);
    return source&&['image/jpeg','image/png'].includes(source.media_type)?source:undefined;
  };
  return Object.fromEntries(Object.entries(manifest).map(([slot,reference])=>[slot,byExactReference(reference)]));
}

const mediaUrl=source=>source?.id?`/api/acquisition?route=azizi-media&amp;id=${encodeURIComponent(source.id)}`:'';
function projectVisual(source,className,title,loading='lazy'){
  const image=mediaUrl(source);
  if(!image)return '';
  return `<figure class="${className} has-image" data-source-id="${esc(source.id)}" data-source-file="${esc(source.filename||'')}"><img src="${image}" alt="Azizi Florence — ${esc(title)}" loading="${loading}" decoding="async"><figcaption><span>${esc(title)}</span><small>Azizi Florence</small></figcaption></figure>`;
}

export function aziziStructuredData(project,units,origin){
  const url=`${origin.replace(/\/$/,'')}${AZIZI_FLORENCE_PATH}`;
  const offers=units.filter(x=>present(x.starting_price)).map(x=>({'@type':'Offer',price:Number(x.starting_price),priceCurrency:x.price_currency||'AED',name:x.unit_type}));
  return {'@context':'https://schema.org','@type':'RealEstateListing',name:project.name,url,description:project.description||undefined,address:project.area||project.emirate?{'@type':'PostalAddress',addressLocality:project.area||undefined,addressRegion:project.emirate||undefined,addressCountry:'AE'}:undefined,offers:offers.length?offers:undefined,brand:project.developer?{'@type':'Organization',name:project.developer}:undefined};
}

export function renderAziziFlorence({project,campaign,units=[],sources=[],origin='https://www.finding-stories.com',whatsappNumber=''}){
  const canonical=`${origin.replace(/\/$/,'')}${AZIZI_FLORENCE_PATH}`;
  const verifiedUnits=units.filter(x=>x.review_status==='verified'&&!x.is_test&&Number(x.bedrooms)>=3&&Number(x.bedrooms)<=6);
  const handover=formatHandover(project.handover);
  const amenities=verifiedList(project.attributes,['amenities','verified_amenities','lifestyle_amenities']);
  const connections=verifiedList(project.attributes,['connectivity','location_facts','nearby_destinations']);
  const communityFacts=verifiedList(project.attributes,['community_highlights','masterplan_facts','project_highlights']);
  const description=String(project.description||'');
  const derivedUsps=[
    /30\s*million/i.test(description)&&'30 Million sq.ft Master Community',
    /3\s*&\s*4 bedroom townhouses.*4, 5\s*&\s*6 bedroom villas/i.test(description)&&'3, 4, 5 & 6 Bed Townhouses & Villas',
    /25% green and open spaces/i.test(description)&&'~25% Green & Open Spaces',
    /direct (?:access|connectivity) to E311/i.test(description)&&'Direct Access to E311',
    communityFacts.find(x=>/family/i.test(x))
  ].filter(Boolean);
  const classifiedSources=sources.map(source=>({...source,mediaClass:classifyFlorenceMedia(source)}));
  const assetMap=resolveFlorenceAssets(classifiedSources);
  const heroImage=assetMap.hero;
  const projectImages=[assetMap.overview_thumb_1,assetMap.overview_thumb_2,assetMap.overview_thumb_3,assetMap.overview_thumb_4].filter(Boolean);
  const images=[heroImage,assetMap.overview_main,...projectImages].filter(Boolean);
  const locationAsset=assetMap.location_map;
  const logo=classifiedSources.find(x=>['image/jpeg','image/png'].includes(x.media_type)&&x.id&&x.mediaClass===FLORENCE_MEDIA_CLASS.LOGO);
  const milestones=paymentMilestones(project.payment_plan_summary);
  const prices=verifiedUnits.filter(x=>present(x.starting_price)).map(x=>Number(x.starting_price));
  const lowestPrice=prices.length?Math.min(...prices):null;
  const bedrooms=verifiedUnits.map(x=>Number(x.bedrooms)).filter(Number.isFinite);
  const bedroomRange=bedrooms.length?`${Math.min(...bedrooms)}–${Math.max(...bedrooms)} bedrooms`:'';
  const unitCards=verifiedUnits.map((x,index)=>`<article class="unit-card">${projectVisual([assetMap.residence_3br_townhouse,assetMap.residence_4br_townhouse,assetMap.residence_4br_villa,assetMap.residence_5br_villa,assetMap.residence_6br_villa][index],'unit-visual','Florence project lifestyle')}<div class="unit-body"><div class="unit-number">0${index+1}</div><p class="card-kicker">${esc(x.property_type||'Residence')}</p><h3>${esc(x.unit_type)}</h3><dl>${fact('Bedrooms',x.bedrooms)}${fact('Size',x.minimum_area!=null&&x.maximum_area!=null?`${area(x.minimum_area)} – ${area(x.maximum_area)}`:x.minimum_area!=null?`From ${area(x.minimum_area)}`:'')}${fact('Starting from',x.starting_price!=null?money(x.starting_price,x.price_currency||'AED'):'')}</dl><a href="#enquire" class="card-link" data-analytics="cta_click" data-unit="${esc(x.unit_type)}">Request current availability <span>↗</span></a></div></article>`).join('');
  const whatsApp=whatsappNumber?`<a class="button button-outline" data-analytics="whatsapp_click" target="_blank" rel="noopener noreferrer" href="https://wa.me/${esc(whatsappNumber)}?text=${encodeURIComponent('Hello Finding Stories, I would like to speak with an advisor about Azizi Florence.')}"><span>WhatsApp Advisor</span></a>`:'';
  const mobileWhatsApp=whatsappNumber?`<a data-analytics="whatsapp_click" target="_blank" rel="noopener noreferrer" href="https://wa.me/${esc(whatsappNumber)}?text=${encodeURIComponent('Hello Finding Stories, I would like to speak with an advisor about Azizi Florence.')}">WhatsApp</a>`:'';
  const sourceKinds=[...new Set(sources.map(x=>label(x.source_kind==='other'?'project source':x.source_kind)))];
  const sourceTrust=sources.length?`<details class="source-details"><summary><span class="verified-icon">✓</span><span><strong>Verified information</strong><small>${sources.length} reviewed ${sources.length===1?'source':'sources'} support the information on this page</small></span><span class="summary-action">View details</span></summary><div class="source-body"><p>Our advisory team has reviewed the project material used for the details shown here. Source documents are kept within our verification workflow rather than exposing technical filenames.</p><ul>${sourceKinds.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p class="fine-print">Pricing, terms and availability can change. Your advisor will reconfirm them before any commitment.</p></div></details>`:'';
  const schema=JSON.stringify(aziziStructuredData(project,verifiedUnits,origin)).replaceAll('<','\\u003c');
  const lifestyleImages=[assetMap.amenities_background].filter(Boolean);
  const amenitySection=(amenities.length||lifestyleImages.length)?`<section class="amenities section-pad"><div class="section-heading light"><p class="eyebrow">THE FLORENCE LIFESTYLE</p><h2>Everything for<br><em>everyday living.</em></h2><p>A thoughtfully selected collection of amenities for the Florence community.</p></div>${lifestyleImages.length?`<div class="lifestyle-gallery">${lifestyleImages.map((image,index)=>projectVisual(image,'lifestyle-photo',`Florence lifestyle ${index+1}`)).join('')}</div>`:''}${amenities.length?`<div class="amenity-grid">${amenities.map((item,index)=>`<article><span class="amenity-icon" aria-hidden="true">${['◇','○','△','＋','⌁','✦'][index%6]}</span><small>0${index+1}</small><h3>${esc(item)}</h3></article>`).join('')}</div>`:''}</section>`:'';
  const locationImage=locationAsset||projectImages.find(x=>x.mediaClass===FLORENCE_MEDIA_CLASS.LIFESTYLE_PHOTOGRAPHY)||projectImages[0]||heroImage;
  const locationSection=(project.area||project.emirate||connections.length)?`<section class="location-section section-pad"><div class="location-panel"><p class="eyebrow">LOCATION</p><h2>Prime location in Sharjah</h2><p>Review the verified Florence location, direct road access and connectivity details available for this release.</p>${connections.length?`<ul>${connections.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<a class="inline-link" href="#enquire" data-analytics="site_visit_request" data-intent="site_visit_request">Explore location <span>↗</span></a></div>${locationImage?projectVisual(locationImage,'location-visual',locationAsset?'Verified Florence location plan':'Florence community setting'):`<aside class="location-editorial"><span>Florence</span><p>${esc([project.area,project.emirate].filter(Boolean).join(', '))}</p><small>Location details are verified privately with your advisor.</small></aside>`}</section>`:'';
  const paymentSection=project.payment_plan_summary?`<section class="payment section-pad"><div class="section-heading"><p class="eyebrow">PAYMENT PLAN</p><h2>Designed around<br><em>your journey.</em></h2><p>${esc(project.payment_plan_summary)}</p></div>${milestones.length?`<div class="timeline">${milestones.map((m,index)=>`<article><div class="timeline-value">${m.percentage}<sup>%</sup></div><div class="timeline-line"><span>${String(index+1).padStart(2,'0')}</span></div><h3>${esc(m.title||`Milestone ${index+1}`)}</h3></article>`).join('')}</div>`:`<div class="plan-statement"><strong>${esc(project.payment_plan_summary)}</strong><p>Ask an advisor for the milestone schedule.</p></div>`}<div class="payment-action"><p class="fine-print payment-note">Terms are subject to reconfirmation before commitment.</p><a class="button button-gold" href="#enquire" data-analytics="cta_click">Request current availability</a></div></section>`:'';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Azizi Florence | Verified Pre-Launch Residences | Finding Stories</title><meta name="description" content="Explore verified Azizi Florence residences${project.area||project.emirate?` in ${esc([project.area,project.emirate].filter(Boolean).join(', '))}`:''} and register your interest with a Finding Stories property advisor."><link rel="canonical" href="${esc(canonical)}"><meta name="robots" content="index,follow,max-image-preview:large"><meta property="og:title" content="Azizi Florence | Finding Stories"><meta property="og:description" content="Verified pre-launch project information and private advisor support for Azizi Florence."><meta property="og:type" content="website"><meta property="og:url" content="${esc(canonical)}"><script type="application/ld+json">${schema}</script><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Italiana&display=swap" rel="stylesheet"><link rel="stylesheet" href="/public/azizi-florence.css"></head><body><header class="nav"><a href="/" class="brand" aria-label="Finding Stories home"><strong>FINDING STORIES</strong><small>REAL ESTATE WITH PERSPECTIVE</small></a><nav aria-label="Primary navigation"><a href="/#projects">Projects</a><a href="/#developers">Developers</a><a href="/#areas">Areas</a><a href="/#investment">Investment</a><a href="/#about">About Us</a><a href="/#insights">Insights</a><a href="/#contact">Contact</a><a href="#enquire" class="nav-cta">Enquire Now <span>→</span></a></nav></header><main><section class="hero${heroImage?' has-hero-image':' no-hero-image'}">${projectVisual(heroImage,'hero-art','signature project view','eager')}<div class="hero-content"><p class="eyebrow">A NEW LANDMARK IN SHARJAH</p><h1>Azizi<br>Florence</h1><p class="hero-tagline">Elegant living. A brighter tomorrow.</p>${logo?`<img class="developer-logo" src="${mediaUrl(logo)}" alt="Azizi Developments">`:``}<p class="hero-lede">${esc(project.description||'A private introduction to Azizi Florence, guided by verified information and personal property advisory.')}</p><div class="actions"><a class="button button-gold" data-analytics="cta_click" href="#enquire">Enquire Now</a>${whatsApp}</div><div class="hero-trust"><span>✓ Verified project information</span><span>◇ Direct advisory support</span><span>⌂ UAE market expertise</span><span>↗ End-to-end guidance</span></div><p class="hero-note">Pricing, terms and availability reconfirmed on enquiry</p></div><a href="#overview" class="scroll-cue" aria-label="Explore Azizi Florence"><span>Scroll to explore</span><i>↓</i></a></section><section class="highlights" aria-label="Project highlights">${derivedUsps.map((value,index)=>factCard(['Master community','Residences','Open spaces','Connectivity','Lifestyle'][index],value,['◇','⌂','♧','↗','○'][index])).join('')||`${factCard('Residence mix',bedroomRange,'⌂')}${factCard('Starting from',lowestPrice!=null?money(lowestPrice):'','↗')}${factCard('Expected handover',handover,'◷')}`}</section><section class="overview section-pad" id="overview"><div class="overview-copy"><p class="eyebrow">PROJECT OVERVIEW</p><h2>A Master-Planned<br>Community for a Better You</h2><p>${esc(project.description||'Speak privately with our advisory team to review the verified Florence project information against your requirements.')}</p>${derivedUsps.length?`<ul class="overview-features">${derivedUsps.slice(0,4).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}<a href="#residences" class="inline-link">Explore the residences <span>↓</span></a></div><div class="gallery${images.length?'':' gallery-empty'}">${projectVisual(assetMap.overview_main,'gallery-card gallery-1','The arrival')}${projectVisual(projectImages[1]||heroImage,'gallery-card gallery-2','The residences')}${projectVisual(projectImages[2]||projectImages[0]||heroImage,'gallery-card gallery-3','The details')}</div></section>${unitCards?`<section class="residences section-pad" id="residences"><div class="section-heading"><p class="eyebrow">THE COLLECTION</p><h2>Verified unit types<br>& starting prices.</h2><p>Explore the verified Florence collection. Request current release details and floor plans privately.</p></div><div class="unit-grid">${unitCards}</div></section>`:''}<div id="payment">${paymentSection}</div>${amenitySection}${locationSection}<section class="enquiry section-pad" id="enquire"><div class="enquiry-intro"><p class="eyebrow">PRIVATE ADVISORY</p><h2>Register your<br><em>interest.</em></h2><p>Tell us what you are looking for. A Finding Stories advisor will contact you to confirm verified details, discuss suitability and explain possible next steps.</p><div class="advisor-promise"><span>01</span><p><strong>Personal guidance</strong>One advisor, focused on your brief.</p><span>02</span><p><strong>Verified information</strong>Facts reviewed before they reach you.</p><span>03</span><p><strong>No-pressure process</strong>Clarity before any commitment.</p></div><p class="eoi-note">This is an enquiry to Finding Stories, not an official developer EOI.</p><a class="inline-link light-link" href="#enquire" data-analytics="brochure_request" data-intent="brochure_request">Request the brochure <span>↗</span></a></div><form id="azizi-lead-form"><input class="trap" name="website" tabindex="-1" autocomplete="off"><div class="form-title"><span>Private enquiry</span><small>Fields marked * are required</small></div><label>Full name *<input name="name" required minlength="2" autocomplete="name" placeholder="Your name"></label><label>Mobile number *<input name="phone" required minlength="7" inputmode="tel" autocomplete="tel" placeholder="+971 50 123 4567"></label><label>Email address *<input name="email" required type="email" autocomplete="email" placeholder="you@example.com"></label><label>Preferred residence *<select name="property_type" required><option value="">Please select</option>${verifiedUnits.map(x=>`<option>${esc(x.unit_type)}</option>`).join('')}<option value="Not sure">I would like guidance</option></select></label><label>Approximate budget *<input name="budget" required placeholder="AED"></label><label>Buying for *<select name="purpose" required><option value="">Please select</option><option value="Investment">Investment</option><option value="End use">End use</option></select></label><label>Purchase timeframe *<select name="purchase_timeline" required><option value="">Please select</option><option>Immediately</option><option>Within 3 months</option><option>3–6 months</option><option>6–12 months</option><option>Exploring</option></select></label><label>Preferred contact *<select name="preferred_contact_method" required><option value="">Please select</option><option>Phone</option><option>WhatsApp</option><option>Email</option></select></label><label class="wide">How can we help?<textarea name="additional_requirements" placeholder="Share any preferences or questions (optional)"></textarea></label><label class="consent wide"><input name="consent" type="checkbox" required><span>I agree to be contacted by Finding Stories about this enquiry. My details will be handled in line with the privacy policy.</span></label><input type="hidden" name="enquiry_type" value="register_interest"><div class="form-actions wide"><button class="button button-gold" type="submit">Register Interest</button><button class="text-button" type="button" data-form-intent="consultation_request">Book a consultation</button><button class="text-button" type="button" data-form-intent="site_visit_request">Request a site visit</button></div><p class="wide form-status" id="form-status" role="status" aria-live="polite"></p></form></section><section class="why section-pad"><div><p class="eyebrow">FINDING STORIES</p><h2>Why choose<br><em>Finding Stories?</em></h2></div><div class="why-grid"><article><span>01</span><h3>Verified information</h3><p>Clear project facts, carefully reviewed before they reach you.</p></article><article><span>02</span><h3>Personalised advisory</h3><p>Your goals, budget and timing shape every recommendation.</p></article><article><span>03</span><h3>UAE market expertise</h3><p>Local perspective to help you compare opportunities with confidence.</p></article><article><span>04</span><h3>End-to-end support</h3><p>Guidance from first enquiry through each appropriate next step.</p></article></div></section><section class="trust section-pad">${sourceTrust}</section></main><footer><div class="footer-brand"><span>FINDING</span><span>STORIES</span></div><p>UAE property advisory for decisions that deserve more care.</p><nav><a href="/">Home</a><a href="#enquire">Private enquiry</a><a href="/privacy">Privacy</a></nav><small>© ${new Date().getUTCFullYear()} Finding Stories. Project details are subject to confirmation.</small></footer><div class="mobile-cta"><a href="#enquire" data-analytics="cta_click">Enquire</a>${mobileWhatsApp}</div><script>window.__AZIZI_FUNNEL__=${JSON.stringify({page_url:AZIZI_FLORENCE_PATH,project_id:String(project.id),campaign_id:String(campaign.id),project:project.name,developer:project.developer,area:project.area||''}).replaceAll('<','\\u003c')}</script><script src="/public/azizi-florence.js" type="module"></script></body></html>`;
}

function factCard(title,value,icon='◇'){return present(value)?`<article><i aria-hidden="true">${icon}</i><span>${esc(title)}</span><strong>${esc(value)}</strong></article>`:'';}
