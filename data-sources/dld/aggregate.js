import {DLD_SOURCE} from './provenance.js';

const median=values=>{const a=[...values].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
const average=values=>values.reduce((sum,value)=>sum+value,0)/values.length;
const group=(records,key)=>Object.fromEntries([...Map.groupBy(records,r=>r[key]??'Unavailable')].map(([name,items])=>[name,items.length]));
export function aggregateDldTransactions(records,{generatedAt=new Date().toISOString(),minimumSampleSize=5}={}){
  if(records.length<minimumSampleSize)return null;
  const amounts=records.flatMap(r=>r.amountAed===null?[]:[r.amountAed]);
  const prices=records.flatMap(r=>{const size=r.propertySizeSqm??r.transactionSizeSqm;return r.amountAed!==null&&size>0?[r.amountAed/(size*10.7639)]:[]});
  const months=Object.groupBy(records,r=>r.transactionDate.slice(0,7));
  const period={from:records.map(r=>r.transactionDate).sort()[0],to:records.map(r=>r.transactionDate).sort().at(-1)};
  const source={...DLD_SOURCE,name:'Dubai Land Department'};
  return {source,period,period_start:period.from,period_end:period.to,generated_at:generatedAt,sample_size:records.length,methodology:`Deterministic aggregation of validated, deduplicated official transactions; monetary statistics exclude null values; AED/sqft uses 10.7639 sqft per sqm; suppressed below ${minimumSampleSize} records.`,freshness:{retrieved_at:records.map(r=>r.retrievedAt).filter(Boolean).sort().at(-1)??null},provenance:{source_url:DLD_SOURCE.url,publisher_url:DLD_SOURCE.publisherUrl,official:true},transaction_count:records.length,total_value_aed:amounts.length?amounts.reduce((a,b)=>a+b,0):null,total_transaction_value_aed:amounts.length?amounts.reduce((a,b)=>a+b,0):null,median_transaction_value_aed:amounts.length?median(amounts):null,average_transaction_value_aed:amounts.length?average(amounts):null,median_aed_per_sqft:prices.length?median(prices):null,average_aed_per_sqft:prices.length?average(prices):null,average_aed_sqft:prices.length?average(prices):null,median_aed_sqft:prices.length?median(prices):null,average_size_sqft:records.some(r=>r.propertySizeSqft??r.transactionSizeSqft)?average(records.flatMap(r=>r.propertySizeSqft??r.transactionSizeSqft?[r.propertySizeSqft??r.transactionSizeSqft]:[])):null,sales_count:records.filter(r=>/sale/i.test(r.transactionType??'')).length,mortgage_count:records.filter(r=>/mortgage/i.test(r.transactionType??'')).length,off_plan_count:records.filter(r=>/off.?plan/i.test(r.registrationType??'')).length,ready_count:records.filter(r=>/ready|existing/i.test(r.registrationType??'')).length,community_activity:group(records,'canonicalAreaName'),property_type_activity:group(records,'propertyType'),property_subtype_activity:group(records,'propertySubtype'),registration_type_activity:group(records,'registrationType'),freehold_activity:group(records,'freehold'),bedroom_activity:group(records,'rooms'),apartment_villa_activity:Object.fromEntries(Object.entries(group(records,'propertyType')).filter(([key])=>/apartment|villa/i.test(key))),monthly_trend:Object.fromEntries(Object.entries(months).sort().map(([month,items])=>[month,{transaction_count:items.length,transaction_value_aed:items.some(r=>r.amountAed!==null)?items.reduce((sum,r)=>sum+(r.amountAed??0),0):null}]))};
}

export function aggregateDldDimensions(records,options={}){
  const dimensions={areas:'canonicalAreaSlug',master_projects:'masterProject',projects:'canonicalProjectSlug',property_types:'propertyType',property_subtypes:'propertySubtype',transaction_types:'transactionType',registration_types:'registrationType',freehold:'freehold',bedrooms:'rooms'};
  const output={dubai:aggregateDldTransactions(records,options)};
  for(const [name,key] of Object.entries(dimensions))output[name]=Object.fromEntries([...Map.groupBy(records,r=>r[key]).entries()].filter(([value])=>value).map(([value,items])=>[value,aggregateDldTransactions(items,options)]).filter(([,metric])=>metric));
  return output;
}
