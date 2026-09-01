import { createHash } from 'node:crypto';

export const FRESHNESS_DAYS=14;
export const OPPORTUNITY_CATEGORIES=Object.freeze({TRANSACTIONAL:['property for sale','apartments for sale','villas for sale','ready property','property under budget'],COMMERCIAL_INVESTIGATION:['off-plan property'],PROJECT_RESEARCH:['developer projects','project details'],INVESTOR_EDUCATION:['buyer costs','investment guide']});
const DAY=864e5;
const clean=value=>String(value??'').trim();
const slug=value=>clean(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const identity=item=>Boolean(clean(item.id)&&clean(item.developer)&&clean(item.project)&&clean(item.area)&&clean(item.property_type));
const verified=item=>Boolean(item.status==='active'&&item.data_quality==='verified'&&!item.is_test&&identity(item)&&clean(item.source)&&item.last_updated&&!Number.isNaN(new Date(item.last_updated).getTime()));
const fresh=(item,now)=>verified(item)&&now-new Date(item.last_updated)<=FRESHNESS_DAYS*DAY&&new Date(item.last_updated)<=now;
const unique=(items,key)=>[...new Set(items.map(x=>x[key]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b)));
const id=path=>createHash('sha256').update(path).digest('hex').slice(0,16);
const budgetBands=[1000000,1500000,2000000,3000000,5000000,10000000];

export function inventoryFreshness(item,now=new Date()) { return {verified:verified(item),fresh:fresh(item,now),age_days:item.last_updated?Math.floor((now-new Date(item.last_updated))/DAY):null,provenance:clean(item.source)||null,last_verified_at:item.last_updated||null}; }

export function discoverOpportunities(inventory,now=new Date()) {
  const usable=inventory.filter(x=>fresh(x,now)); const candidates=[];
  const add=(category,intent,path,items,context={})=>{
    const records=[...new Map(items.map(x=>[x.id,x])).values()];
    if(records.length<2||unique(records,'project').length<1||!intent||!slug(intent))return;
    candidates.push({id:id(path),category,intent,path,priority:category==='PROJECT_RESEARCH'?100:category==='TRANSACTIONAL'?80:60,inventory_ids:records.map(x=>x.id).sort(),verified_count:records.length,...context});
  };
  for(const area of unique(usable,'area')) {
    const areaItems=usable.filter(x=>x.area===area);
    add('TRANSACTIONAL',`${area} property for sale`,`/dubai/property-for-sale/${slug(area)}`,areaItems,{area});
    add('COMMERCIAL_INVESTIGATION',`${area} off-plan property`,`/dubai/off-plan/${slug(area)}`,areaItems.filter(x=>/off.?plan/i.test(x.construction_status)),{area,construction_status:'off-plan'});
    for(const [type,segment] of [['Apartment','apartments-for-sale'],['Villa','villas-for-sale']]) add('TRANSACTIONAL',`${type}s for sale in ${area}`,`/dubai/${segment}/${slug(area)}`,areaItems.filter(x=>clean(x.property_type).toLowerCase()===type.toLowerCase()),{area,property_type:type});
    for(const bedrooms of unique(areaItems,'bedrooms')) add('TRANSACTIONAL',`${bedrooms} bedroom apartments in ${area}`,`/dubai/${slug(bedrooms)}-bedroom-apartments/${slug(area)}`,areaItems.filter(x=>x.bedrooms===bedrooms&&/apartment/i.test(x.property_type)),{area,bedrooms});
  }
  for(const developer of unique(usable,'developer')) {
    const developerItems=usable.filter(x=>x.developer===developer); add('PROJECT_RESEARCH',`${developer} projects`,`/developers/${slug(developer)}`,developerItems,{developer});
    for(const project of unique(developerItems,'project')) add('PROJECT_RESEARCH',`${project} by ${developer}`,`/projects/${slug(developer)}/${slug(project)}`,developerItems.filter(x=>x.project===project),{developer,project,area:developerItems.find(x=>x.project===project)?.area});
  }
  for(const ceiling of budgetBands) add('TRANSACTIONAL',`Dubai property under AED ${ceiling.toLocaleString('en-US')}`,`/dubai/property-under-${ceiling}`,usable.filter(x=>Number.isFinite(Number(x.minimum_price))&&Number(x.minimum_price)<=ceiling),{budget_ceiling:ceiling});
  return [...new Map(candidates.map(x=>[x.path,x])).values()].sort((a,b)=>b.priority-a.priority||a.path.localeCompare(b.path));
}

export function eligiblePage(path,inventory,now=new Date()){return discoverOpportunities(inventory,now).find(x=>x.path===path)||null;}
export function canonicalUrl(path,origin='https://www.finding-stories.com'){const parsed=String(path||'').split('?')[0].split('#')[0];const cleanPath=`/${parsed.replace(/^\/+|\/+$/g,'')}`;return `${origin.replace(/\/$/,'')}${cleanPath==='/'?'':cleanPath}`;}

export function safeProperty(item,now=new Date()) {
  if(!verified(item))return null;
  const isFresh=fresh(item,now); const result={id:item.id,project:clean(item.project),developer:clean(item.developer),area:clean(item.area),property_type:clean(item.property_type),bedrooms:clean(item.bedrooms),construction_status:clean(item.construction_status),status:isFresh?'verified_available':'inventory_stale',inventory_provenance:clean(item.source),last_verified_at:item.last_updated};
  if(isFresh) for(const key of ['minimum_price','maximum_price','handover','payment_plan_summary']) if(item[key]!==null&&item[key]!==undefined&&clean(item[key]))result[key]=item[key];
  return result;
}

export function internalLinks(page,pages){return pages.filter(x=>x.path!==page.path&&(x.area&&x.area===page.area||x.developer&&x.developer===page.developer||x.project&&x.project===page.project)).sort((a,b)=>b.priority-a.priority||a.path.localeCompare(b.path)).slice(0,8).map(x=>({path:x.path,label:x.intent}));}

export function classifyAcquisition({utmSource='',utmMedium='',referrer='',origin='https://www.finding-stories.com'}={}) {
  const campaignSource=clean(utmSource); const campaignMedium=clean(utmMedium);
  if(campaignSource)return {source:'campaign',medium:campaignMedium||'unknown'};
  if(!clean(referrer))return {source:'direct',medium:'none'};
  try {
    const referring=new URL(referrer); const site=new URL(origin);
    if(referring.hostname===site.hostname||referring.hostname.endsWith(`.${site.hostname}`))return {source:'internal',medium:'referral'};
    if(/(^|\.)(google|bing|yahoo|duckduckgo|ecosia)\./i.test(referring.hostname))return {source:'organic',medium:'organic'};
    return {source:'referral',medium:'referral'};
  } catch { return {source:'unknown',medium:'unknown'}; }
}

export function coverageAudit(inventory,existingPages,now=new Date()) {
  const opportunities=discoverOpportunities(inventory,now);
  // Eligible opportunities are the publication source for the dynamic page
  // renderer.  Treating an omitted, legacy "pages" table as the publication
  // source made every live dynamic route appear to be missing in the admin.
  const publishedPages=existingPages??opportunities.map(page=>({path:page.path,intent:page.intent,canonical_url:canonicalUrl(page.path),internal_links:internalLinks(page,opportunities)}));
  const existing=new Map(publishedPages.map(x=>[x.path,x]));const freshInventory=inventory.filter(x=>fresh(x,now));const verifiedInventory=inventory.filter(verified);const staleInventory=verifiedInventory.filter(x=>!fresh(x,now));
  const queue=opportunities.map(page=>{const current=existing.get(page.path);const links=internalLinks(page,opportunities);const reasons=[];if(!current)reasons.push('missing_page');if(current?.updated_at&&now-new Date(current.updated_at)>90*DAY)reasons.push('stale_metadata');if(current&&Number(current.word_count||0)<250)reasons.push('low_content');if(current&&!current.canonical_url)reasons.push('invalid_canonical');if(current&&(!current.internal_links||current.internal_links.length===0))reasons.push('missing_internal_links');return {...page,state:current?'published':'eligible',indexable:true,reasons,internal_links:links};});
  for(const page of publishedPages.filter(x=>!opportunities.some(y=>y.path===x.path))){const linked=verifiedInventory.filter(x=>(!page.area||x.area===page.area)&&(!page.project||x.project===page.project));queue.push({id:id(page.path),path:page.path,intent:page.intent||page.path,state:linked.length?'stale':'awaiting_inventory',indexable:false,priority:linked.length?70:40,reasons:[linked.length?'outdated_inventory_claims':'insufficient_verified_inventory'],internal_links:[],inventory_ids:[]});}
  const duplicateGroups=Object.values(queue.reduce((out,x)=>{const key=slug(x.intent);(out[key]??=[]).push(x);return out;},{})).filter(x=>x.length>1);for(const group of duplicateGroups)for(const page of group.slice(1)){page.state='suppressed';page.indexable=false;page.reasons.push('duplicate_intent');}
  queue.sort((a,b)=>b.priority-a.priority||({stale:0,eligible:1,awaiting_inventory:2,suppressed:3}[a.state]??4)-({stale:0,eligible:1,awaiting_inventory:2,suppressed:3}[b.state]??4)||a.path.localeCompare(b.path));
  const coverage=key=>({covered:unique(freshInventory,key).length,total:unique(verifiedInventory,key).length,percentage:unique(verifiedInventory,key).length?Math.round(unique(freshInventory,key).length*100/unique(verifiedInventory,key).length):0});
  return {generated_at:now.toISOString(),autopublish:false,verified_inventory_coverage_percentage:verifiedInventory.length?Math.round(freshInventory.length*100/verifiedInventory.length):0,inventory:{total:inventory.filter(x=>!x.is_test).length,verified:verifiedInventory.length,fresh:freshInventory.length,stale:staleInventory.length},pages:{eligible:queue.filter(x=>x.state==='eligible').length,published:queue.filter(x=>x.state==='published').length,suppressed:queue.filter(x=>x.state==='suppressed').length,stale:queue.filter(x=>x.state==='stale').length,awaiting_inventory:queue.filter(x=>x.state==='awaiting_inventory').length},coverage:{area:coverage('area'),developer:coverage('developer'),project:coverage('project'),bedroom:coverage('bedrooms'),budget_band:{covered:new Set(opportunities.filter(x=>x.budget_ceiling).map(x=>x.budget_ceiling)).size,total:budgetBands.length}},queue};
}

export function pageSchema(page,items,origin){const url=canonicalUrl(page.path,origin);const offers=items.map(x=>safeProperty(x)).filter(Boolean).map(item=>({'@type':'Offer',name:item.project,url,...(item.minimum_price?{price:item.minimum_price,priceCurrency:'AED'}:{})}));return {'@context':'https://schema.org','@type':'CollectionPage',name:page.intent,url,breadcrumb:{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:canonicalUrl('/',origin)},{'@type':'ListItem',position:2,name:page.intent,item:url}]},mainEntity:{'@type':'ItemList',numberOfItems:offers.length,itemListElement:offers}};}

export const INTENT_WEIGHTS=Object.freeze({project_page_enquiry:20,price_page_enquiry:18,repeated_visit:8,property_comparison:12,payment_plan_interest:12,whatsapp_click:15,meeting_request:22,site_visit_request:25});
export function acquisitionIntent(signals=[]){const uniqueSignals=[...new Set(signals.filter(x=>INTENT_WEIGHTS[x]))];return {signals:uniqueSignals,score:Math.min(100,uniqueSignals.reduce((sum,x)=>sum+INTENT_WEIGHTS[x],0)),factors:uniqueSignals.map(x=>({signal:x,points:INTENT_WEIGHTS[x]}))};}
export function acquisitionMetrics(leads,events=[]){const production=leads.filter(x=>!x.is_test&&x.source==='organic');const grouped=key=>Object.values(production.reduce((out,x)=>{const name=x[key]||'Unknown';out[name]??={name,enquiries:0,qualified:0,meetings:0,site_visits:0,bookings:0};const row=out[name];row.enquiries++;if(x.status==='qualified'||x.qualified_at)row.qualified++;if(x.meeting_at)row.meetings++;if(x.site_visit_at)row.site_visits++;if(x.status==='booked')row.bookings++;return out;},{})).map(x=>({...x,qualified_rate:x.enquiries?Math.round(x.qualified*100/x.enquiries):0,meeting_rate:x.enquiries?Math.round(x.meetings*100/x.enquiries):0,site_visit_rate:x.enquiries?Math.round(x.site_visits*100/x.enquiries):0,booking_rate:x.enquiries?Math.round(x.bookings*100/x.enquiries):0})).sort((a,b)=>b.enquiries-a.enquiries||a.name.localeCompare(b.name));const pages=grouped('landing_page');const visited=new Map();for(const event of events.filter(x=>!x.is_test&&x.event_type==='page_view'))visited.set(event.page_url,(visited.get(event.page_url)||0)+1);return {totals:{enquiries:production.length,qualified:production.filter(x=>x.qualified_at||x.status==='qualified').length,meetings:production.filter(x=>x.meeting_at).length,site_visits:production.filter(x=>x.site_visit_at).length},by_page:pages,by_area:grouped('acquisition_area'),by_project:grouped('acquisition_project'),by_developer:grouped('acquisition_developer'),top_converting_pages:[...pages].sort((a,b)=>b.booking_rate-a.booking_rate||b.enquiries-a.enquiries).slice(0,10),traffic_without_enquiries:[...visited].filter(([url])=>!pages.some(x=>x.name===url)).map(([name,traffic])=>({name,traffic})).sort((a,b)=>b.traffic-a.traffic).slice(0,20)};}
