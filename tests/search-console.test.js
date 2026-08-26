import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpportunities,connectionState,fingerprint,importSchema,validateSeoAction } from '../api/_lib/search-console.js';
const base={query:'Marina apartments',page:'https://finding-stories.com/dubai/marina',clicks:1,impressions:200,ctr:.005,position:12,date:'2026-08-20',device:'mobile',country:'ARE'};
const batch={report_start:'2026-08-20',report_end:'2026-08-20',source:'google_search_console',environment:'test',is_test:true,rows:[base]};
test('validates GSC ingestion and deterministic duplicate fingerprint',()=>{assert.equal(importSchema.safeParse(batch).success,true);assert.equal(fingerprint(base,batch),fingerprint(base,batch));assert.notEqual(fingerprint({...base,date:'2026-08-21'},batch),fingerprint(base,batch));});
test('enforces TEST isolation',()=>assert.equal(importSchema.safeParse({...batch,environment:'production'}).success,false));
test('detects low CTR, near page one, zero lead, inventory gap, and missing page',()=>{const rows=[{...base,is_test:false}];const types=new Set(buildOpportunities(rows).map(x=>x.type));for(const type of ['high_impressions_low_ctr','near_page_one','traffic_zero_leads','inventory_gap','missing_page'])assert(types.has(type));});
test('detects stale pages and query-to-lead attribution without inference',()=>{const lead={is_test:false,source:'organic',search_query:base.query,landing_page:base.page,status:'booked',qualified_at:'x',meeting_at:'x',site_visit_at:'x'};const result=buildOpportunities([{...base,is_test:false}],{pages:[{url:base.page,updated_at:'2025-01-01'}],inventory:[{is_test:false,status:'active',data_quality:'verified',area:'Marina'}],leads:[lead],now:new Date('2026-08-26')});assert(result.some(x=>x.type==='stale_page'));assert.deepEqual(result[0].metrics,{enquiries:1,qualified_leads:1,meetings:1,site_visits:1,bookings:1});});
test('test metrics never enter production opportunities',()=>assert.equal(buildOpportunities([{...base,is_test:true}]).length,0));
test('missing credentials are explicit and expose names, not secrets',()=>{const state=connectionState({});assert.equal(state.status,'NOT CONNECTED');assert(state.missing.includes('GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY'));});

test('approval gating accepts only auditable non-publishing actions',()=>{assert.equal(validateSeoAction({recommendation_id:'abc',status:'approved',action_type:'improve_cta'}),true);assert.equal(validateSeoAction({recommendation_id:'abc',status:'published',action_type:'publish_page'}),false);});
