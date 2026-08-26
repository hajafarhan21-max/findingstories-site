import { createHash } from 'node:crypto';

export const PROPERTY_MATCH_VERSION = 'property-match-v1';
export const INVENTORY_STALE_DAYS = 14;
const critical = ['budget', 'property_type', 'bedrooms', 'emirate', 'purchase_timeline'];
const terminal = new Set(['booked', 'lost']);
const clean = value => String(value ?? '').trim();
const lower = value => clean(value).toLowerCase();
const list = value => Array.isArray(value) ? value.map(clean).filter(Boolean) : clean(value).split(/[,;/|]/).map(x => x.trim()).filter(Boolean);
const number = value => { const parsed = Number(String(value ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(parsed) && parsed > 0 ? parsed : null; };

export function parseBudget(value) {
  if (value && typeof value === 'object') return { min:number(value.min), max:number(value.max) };
  const text = lower(value).replaceAll(',', '');
  const values = [...text.matchAll(/\d+(?:\.\d+)?\s*[mk]?/g)].map(match => { const token=match[0]; const n=Number.parseFloat(token); return /m/.test(token)?n*1e6:/k/.test(token)?n*1e3:n; }).filter(Boolean);
  if (!values.length) return { min:null,max:null };
  if (/under|up to|max/.test(text)) return { min:null,max:values[0] };
  if (/above|from|min/.test(text) && values.length === 1) return { min:values[0],max:null };
  return values.length > 1 ? { min:Math.min(...values),max:Math.max(...values) } : { min:null,max:values[0] };
}

export function normalizeRequirements(lead) {
  const budget = parseBudget(lead.budget ?? { min:lead.budget_min, max:lead.budget_max });
  const extra = lead.requirements && typeof lead.requirements === 'object' ? lead.requirements : {};
  const profile = { budget_min:budget.min, budget_max:budget.max, property_type:clean(lead.property_type), bedrooms:clean(lead.bedrooms),
    preferred_areas:list(lead.preferred_areas), emirate:clean(lead.emirate || extra.emirate), objective:clean(lead.purpose || extra.objective),
    construction_status:clean(lead.construction_status || extra.construction_status), preferred_handover:clean(lead.preferred_handover || extra.preferred_handover),
    payment_plan_preference:clean(lead.payment_plan_preference || extra.payment_plan_preference), payment_method:clean(lead.payment_method),
    liquidity:clean(lead.liquidity || extra.liquidity), expected_roi:clean(lead.expected_roi || extra.expected_roi), rental_income:clean(extra.rental_income),
    capital_appreciation:clean(extra.capital_appreciation), developer_preferences:list(extra.developer_preferences), developer_exclusions:list(extra.developer_exclusions),
    size_requirement:clean(extra.size_requirement), view_preference:clean(extra.view_preference), vastu_preference:clean(extra.vastu_preference),
    family_requirements:clean(extra.family_requirements), urgency:clean(lead.purchase_timeline) };
  const missing = critical.filter(key => key === 'budget' ? !profile.budget_min && !profile.budget_max : key === 'purchase_timeline' ? !profile.urgency : !profile[key]).map(key => key.replaceAll('_',' '));
  return { ...profile, missing_critical:missing };
}

function knownMismatch(wanted, actual) { return clean(wanted) && clean(actual) && lower(wanted) !== lower(actual); }
function includesText(haystack, needle) { return lower(haystack).includes(lower(needle)) || lower(needle).includes(lower(haystack)); }
function handoverMismatch(wanted, actual) { if (!wanted || !actual) return false; const w=Date.parse(wanted), a=Date.parse(actual); return Number.isFinite(w)&&Number.isFinite(a) ? a>w : knownMismatch(wanted,actual); }
export function inventoryIsStale(item, now=new Date()) { return !item.last_updated || now-new Date(item.last_updated) > INVENTORY_STALE_DAYS*864e5; }

export function matchProperties(lead, inventory, now = new Date()) {
  if (inventory.some(item => Boolean(item.is_test) !== Boolean(lead.is_test))) throw new Error('TEST and production matching data cannot be mixed');
  if (terminal.has(lead.status)) return { profile:normalizeRequirements(lead), matches:[], flags:[] };
  const profile=normalizeRequirements(lead); const rejected=[]; const matches=[];
  for (const item of inventory.filter(x => x.status === 'active')) {
    const failures=[];
    if (profile.budget_max && item.minimum_price && Number(item.minimum_price)>profile.budget_max) failures.push('budget');
    if (profile.budget_min && item.maximum_price && Number(item.maximum_price)<profile.budget_min) failures.push('budget');
    if (knownMismatch(profile.property_type,item.property_type)) failures.push('property type');
    if (knownMismatch(profile.bedrooms,item.bedrooms)) failures.push('bedrooms');
    if (knownMismatch(profile.emirate,item.emirate)) failures.push('emirate');
    if (knownMismatch(profile.construction_status,item.construction_status)) failures.push('ready/off-plan');
    if (handoverMismatch(profile.preferred_handover,item.handover)) failures.push('handover');
    if (failures.length) { rejected.push({item,failures}); continue; }
    let score=60; const why=[]; const misses=[]; const signals=[];
    if (profile.budget_max && item.minimum_price) { score+=8; why.push('Budget range overlaps'); signals.push('BUDGET_MATCH'); }
    if (profile.preferred_areas.length && profile.preferred_areas.some(x=>includesText(item.area,x))) { score+=10; why.push('Preferred area'); }
    else if (profile.preferred_areas.length) misses.push('Preferred area');
    if (profile.developer_preferences.some(x=>includesText(item.developer,x))) { score+=6; why.push('Preferred developer'); }
    if (profile.payment_plan_preference && item.payment_plan_summary && includesText(item.payment_plan_summary,profile.payment_plan_preference)) { score+=6; why.push('Payment-plan preference'); signals.push('PAYMENT_PLAN_MATCH'); }
    if (profile.objective && item.suitability && includesText(item.suitability,profile.objective)) { score+=5; why.push(`${profile.objective} suitability`); }
    if (profile.construction_status && /ready/i.test(profile.construction_status)) signals.push('READY_PROPERTY_MATCH');
    if (profile.preferred_handover && item.handover) signals.push('HANDOVER_MATCH');
    if (inventoryIsStale(item,now)) { score-=12; misses.push('Inventory is stale and must be re-verified'); signals.push('INVENTORY_STALE'); }
    score=Math.max(0,Math.min(100,score)); const tier=score>=80?'STRONG':score>=65?'GOOD':score>=50?'POSSIBLE':'WEAK';
    matches.push({ inventory_id:item.id, project:item.project, developer:item.developer, data_quality:item.data_quality, score,tier,
      why:why.length?why:['Passes known hard requirements'], does_not_match:misses, missing_information:profile.missing_critical,
      advisor_talking_points:[`${item.project} passes the known hard requirements.`, item.data_quality==='verified'?'Confirm current unit availability before presenting.':'Advisory project data only; verify price and availability.'],
      recommended_next_action:tier==='STRONG'?'Human advisor to review and propose a shortlist meeting.':'Validate missing requirements before presenting.', signals });
  }
  matches.sort((a,b)=>b.score-a.score || a.project.localeCompare(b.project));
  const flags=[...new Set(matches.flatMap(x=>x.signals))];
  if (matches[0]?.tier==='STRONG') flags.push('STRONG_PROPERTY_MATCH');
  if (matches[0]?.tier==='STRONG' && !lead.meeting_at) flags.push('MEETING_OPPORTUNITY');
  if (matches[0]?.tier==='STRONG' && !lead.site_visit_at) flags.push('SITE_VISIT_OPPORTUNITY');
  if (profile.missing_critical.length) flags.push('MISSING_CRITICAL_REQUIREMENT');
  if (!matches.length) flags.push('NO_SUITABLE_MATCH');
  return { profile,matches,flags:[...new Set(flags)], rejected_count:rejected.length };
}

export function propertyFingerprint(lead, inventory) {
  const profile=normalizeRequirements(lead); const state=inventory.map(item=>[item.id,item.updated_at||item.last_updated,item.status]).sort();
  return createHash('sha256').update(JSON.stringify([PROPERTY_MATCH_VERSION,profile,state])).digest('hex');
}
export function needsPropertyRecommendation(lead, inventory) { return !terminal.has(lead.status) && propertyFingerprint(lead,inventory)!==lead.property_recommendation_fingerprint; }
