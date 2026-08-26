import { createHash } from 'node:crypto';

export const OPPORTUNITY_CATEGORIES = Object.freeze({
  TRANSACTIONAL: ['property for sale','apartments for sale','villas for sale','townhouses for sale','ready property','property under budget'],
  COMMERCIAL_INVESTIGATION: ['property investment','off-plan property','property near metro','payment-plan properties'],
  AREA_RESEARCH: ['areas for investment','area property guide'],
  PROJECT_RESEARCH: ['developer projects','project prices','project payment plan'],
  INVESTOR_EDUCATION: ['property ROI','buyer costs','investment guide']
});

const clean = value => String(value ?? '').trim();
const slug = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const verified = item => item.status === 'active' && item.data_quality === 'verified' && !item.is_test && item.project && item.developer && item.area && item.property_type && item.last_updated;
const fresh = (item, now) => now - new Date(item.last_updated) <= 14 * 864e5;

export function discoverOpportunities(inventory, now = new Date()) {
  const usable = inventory.filter(item => verified(item) && fresh(item, now));
  const candidates = [];
  const add = (category, intent, path, items, context = {}) => {
    if (items.length < 2) return;
    candidates.push({ id:createHash('sha256').update(path).digest('hex').slice(0,16), category, intent, path, inventory_ids:[...new Set(items.map(x=>x.id))].sort(), ...context });
  };
  for (const area of [...new Set(usable.map(x=>x.area))].sort()) {
    const items=usable.filter(x=>x.area===area); add('TRANSACTIONAL',`${area} property for sale`,`/dubai/property-for-sale/${slug(area)}`,items,{area});
    add('COMMERCIAL_INVESTIGATION',`${area} off-plan property`,`/dubai/off-plan/${slug(area)}`,items.filter(x=>/off.?plan/i.test(x.construction_status)),{area,construction_status:'off-plan'});
    for (const bedrooms of [...new Set(items.map(x=>x.bedrooms).filter(Boolean))]) add('TRANSACTIONAL',`${bedrooms} bedroom apartments in ${area}`,`/dubai/${slug(bedrooms)}-bedroom-apartments/${slug(area)}`,items.filter(x=>x.bedrooms===bedrooms&&/apartment/i.test(x.property_type)),{area,bedrooms});
  }
  for (const developer of [...new Set(usable.map(x=>x.developer))].sort()) for (const project of [...new Set(usable.filter(x=>x.developer===developer).map(x=>x.project))]) add('PROJECT_RESEARCH',`${project} by ${developer}`,`/projects/${slug(developer)}/${slug(project)}`,usable.filter(x=>x.developer===developer&&x.project===project),{developer,project});
  return [...new Map(candidates.map(x=>[x.path,x])).values()].sort((a,b)=>a.path.localeCompare(b.path));
}

export function eligiblePage(path, inventory, now = new Date()) { return discoverOpportunities(inventory,now).find(x=>x.path===path) || null; }
export function canonicalUrl(path, origin='https://finding-stories.com') { const cleanPath=`/${String(path||'').split('?')[0].split('#')[0].replace(/^\/+|\/+$/g,'')}`; return `${origin.replace(/\/$/,'')}${cleanPath==='/'?'':cleanPath}`; }

export function safeProperty(item) {
  if (!verified(item)) return null;
  const result={ id:item.id,project:clean(item.project),developer:clean(item.developer),area:clean(item.area),property_type:clean(item.property_type),bedrooms:clean(item.bedrooms),construction_status:clean(item.construction_status) };
  for (const key of ['minimum_price','maximum_price','handover','payment_plan_summary']) if (item[key] !== null && item[key] !== undefined && clean(item[key])) result[key]=item[key];
  return result;
}

export function pageSchema(page, items, origin) {
  const url=canonicalUrl(page.path,origin); const offers=items.map(safeProperty).filter(Boolean).map(item=>({ '@type':'Offer',name:item.project,url, ...(item.minimum_price?{price:item.minimum_price,priceCurrency:'AED'}:{}) }));
  return { '@context':'https://schema.org','@type':'CollectionPage',name:page.intent,url,breadcrumb:{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:canonicalUrl('/',origin)},{'@type':'ListItem',position:2,name:page.intent,item:url}]},mainEntity:{'@type':'ItemList',numberOfItems:offers.length,itemListElement:offers} };
}

export const INTENT_WEIGHTS=Object.freeze({ project_page_enquiry:20,price_page_enquiry:18,repeated_visit:8,property_comparison:12,payment_plan_interest:12,whatsapp_click:15,meeting_request:22,site_visit_request:25 });
export function acquisitionIntent(signals=[]) { const unique=[...new Set(signals.filter(x=>INTENT_WEIGHTS[x]))]; return { signals:unique,score:Math.min(100,unique.reduce((sum,x)=>sum+INTENT_WEIGHTS[x],0)),factors:unique.map(x=>({signal:x,points:INTENT_WEIGHTS[x]})) }; }

export function acquisitionMetrics(leads, events=[]) {
  const production=leads.filter(x=>!x.is_test&&x.source==='organic'); const grouped=key=>Object.values(production.reduce((out,x)=>{const name=x[key]||'Unknown';out[name]??={name,enquiries:0,qualified:0,meetings:0,site_visits:0,bookings:0};const row=out[name];row.enquiries++;if(x.status==='qualified'||x.qualified_at)row.qualified++;if(x.meeting_at)row.meetings++;if(x.site_visit_at)row.site_visits++;if(x.status==='booked')row.bookings++;return out;},{})).map(x=>({...x,qualified_rate:x.enquiries?Math.round(x.qualified*100/x.enquiries):0,meeting_rate:x.enquiries?Math.round(x.meetings*100/x.enquiries):0,site_visit_rate:x.enquiries?Math.round(x.site_visits*100/x.enquiries):0,booking_rate:x.enquiries?Math.round(x.bookings*100/x.enquiries):0})).sort((a,b)=>b.enquiries-a.enquiries||a.name.localeCompare(b.name));
  const pages=grouped('landing_page'); const visited=new Map(); for(const event of events.filter(x=>!x.is_test&&x.event_type==='page_view')) visited.set(event.page_url,(visited.get(event.page_url)||0)+1);
  return { totals:{enquiries:production.length},by_page:pages,by_area:grouped('acquisition_area'),by_project:grouped('acquisition_project'),by_developer:grouped('acquisition_developer'),top_converting_pages:[...pages].sort((a,b)=>b.booking_rate-a.booking_rate||b.enquiries-a.enquiries).slice(0,10),traffic_without_enquiries:[...visited].filter(([url])=>!pages.some(x=>x.name===url)).map(([name,traffic])=>({name,traffic})).sort((a,b)=>b.traffic-a.traffic).slice(0,20)};
}
