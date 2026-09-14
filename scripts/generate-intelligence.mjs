import {mkdir,writeFile} from 'node:fs/promises';
import {fetchDldSnapshot} from '../data-sources/dld/adapter.js';
import {aggregateDldTransactions} from '../data-sources/dld/aggregate.js';
import {generateDldMappingReview} from '../data-sources/dld/mapping-review.js';
const date=new Date().toISOString().slice(0,10),dir=`generated/intelligence/${date}`;await mkdir(dir,{recursive:true});
const snapshot=await fetchDldSnapshot();
await generateDldMappingReview(snapshot.records);
const aggregation=snapshot.status==='verified'?aggregateDldTransactions(snapshot.records):null;
const empty=(type,extra={})=>({generatedAt:new Date().toISOString(),type,...extra,items:[]});
const files={
  'market-summary.json':aggregation?{status:'verified',...aggregation}:{status:'unavailable',reason:snapshot.status==='verified'?'insufficient_sample':snapshot.error},'top-area-movements.json':aggregation?{type:'CALCULATED_METRIC',status:'verified',...aggregation}:empty('CALCULATED_METRIC',{status:'unavailable'}),'notable-transactions.json':empty('FACT',{status:'unavailable'}),
  'project-updates.json':empty('SOURCE_SUMMARY'),'developer-updates.json':empty('SOURCE_SUMMARY'),'video-picks.json':empty('SOURCE_SUMMARY',{publicationState:'REVIEW_REQUIRED'}),
  'news-candidates.json':empty('SOURCE_SUMMARY',{publicationState:'REVIEW_REQUIRED'}),'newsletter-draft.json':aggregation?{generatedAt:new Date().toISOString(),type:'FACT',status:'DRAFT_NOT_APPROVED',publicationState:'REVIEW_REQUIRED',items:[aggregation]}:empty('EDITORIAL_INTERPRETATION',{status:'DRAFT_NOT_APPROVED'}),
  'homepage-intelligence.json':{generatedAt:new Date().toISOString(),status:aggregation?'verified':'unavailable',market:aggregation}
};
for(const [name,value] of Object.entries(files))await writeFile(`${dir}/${name}`,`${JSON.stringify(value,null,2)}\n`);
await mkdir('generated/data-health',{recursive:true});await writeFile('generated/data-health/dld.json',`${JSON.stringify(snapshot.health,null,2)}\n`);await writeFile('generated/data-health/source-health.json',`${JSON.stringify({generatedAt:new Date().toISOString(),sources:[{id:'dld',...snapshot.health}]},null,2)}\n`);
await mkdir('generated/news',{recursive:true});await writeFile('generated/news/latest-news.json',`${JSON.stringify(empty('SOURCE_SUMMARY',{publicationState:'REVIEW_REQUIRED'}),null,2)}\n`);
await mkdir('generated/videos',{recursive:true});await writeFile('generated/videos/latest-videos.json',`${JSON.stringify(empty('SOURCE_SUMMARY',{publicationState:'REVIEW_REQUIRED'}),null,2)}\n`);
await mkdir('generated/newsletter',{recursive:true});await writeFile('generated/newsletter/newsletter-draft.json',`${JSON.stringify(files['newsletter-draft.json'],null,2)}\n`);
await writeFile('generated/intelligence/homepage-intelligence.json',`${JSON.stringify(files['homepage-intelligence.json'],null,2)}\n`);
await writeFile('generated/intelligence/data-provenance.json',`${JSON.stringify({generatedAt:new Date().toISOString(),source:'Dubai Land Department / Dubai Pulse open data',sourceUrl:'https://www.dubaipulse.gov.ae/',status:snapshot.status,official:true},null,2)}\n`);
console.log(`Generated governed intelligence draft in ${dir}; DLD status: ${snapshot.status}.`);
