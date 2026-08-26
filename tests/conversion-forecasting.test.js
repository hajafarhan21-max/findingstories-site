import test from 'node:test';
import assert from 'node:assert/strict';
import { attributionForLead, buildOpportunity, conversionProbability, determineFunnelStage, forecastWindow, pipelineAnalytics } from '../api/_lib/conversion-forecasting.js';

const now=new Date('2026-08-26T12:00:00Z');
const lead=(overrides={})=>({id:'TEST-lead',name:'TEST Lead',is_test:true,status:'new',temperature:'Warm',assigned_to:'TEST Advisor',captured_at:'2026-08-25T12:00:00Z',qualification_status:'pending',missing_information:[],...overrides});
const rec=(overrides={})=>({id:'TEST-rec',lead_id:'TEST-lead',is_test:true,created_at:'2026-08-25T13:00:00Z',ranked_matches:[{project:'TEST Project',developer:'TEST Developer',area:'TEST Area',tier:'STRONG'}],advisor_status:'pending',...overrides});
const execution=(overrides={})=>({id:'TEST-action',lead_id:'TEST-lead',is_test:true,action_type:'follow_up',approval_status:'approved',execution_status:'completed',approved_at:'2026-08-25T14:00:00Z',created_at:'2026-08-25T13:30:00Z',...overrides});

test('funnel stage uses canonical status',()=>assert.equal(determineFunnelStage(lead({status:'contacted'}),null,[],now),'CONTACTED'));
test('funnel stage progresses through existing activity',()=>assert.equal(determineFunnelStage(lead({status:'qualified',meeting_at:'2026-08-27T12:00:00Z'}),rec(),[],now),'MEETING SCHEDULED'));
test('first-touch attribution preserves captured campaign fields',()=>assert.equal(attributionForLead(lead({utm_source:'google'}),null).first_touch.utm_source,'google'));
test('latest-touch attribution does not fabricate a later touch',()=>assert.equal(attributionForLead(lead({source:'Website'}),null).latest_touch.source,'Website'));
test('unknown attribution is explicit',()=>assert.equal(attributionForLead(lead(),null).first_touch.utm_campaign,'UNKNOWN'));
test('weighted pipeline uses only an explicit transaction value',()=>assert.equal(buildOpportunity(lead({expected_gross_transaction_value:1000000}),null,[],now).weighted_pipeline_value,120000));
test('missing transaction value remains unknown',()=>assert.equal(buildOpportunity(lead(),null,[],now).weighted_pipeline_value,'VALUE UNKNOWN'));
test('converted leads are suppressed from active pipeline',()=>assert.equal(pipelineAnalytics([lead({status:'converted'})],[],[],now).overview.total_active_leads,0));
test('lost leads are suppressed and never weighted',()=>{const x=pipelineAnalytics([lead({status:'lost',transaction_value:1e6})],[],[],now);assert.equal(x.overview.total_active_leads,0);assert.equal(x.priority_queue.length,0);});
test('meeting signal increases probability',()=>{const base=conversionProbability(lead(),'NEW LEAD',null,[],now).probability;assert.ok(conversionProbability(lead({meeting_at:'2026-08-27'}),'NEW LEAD',null,[],now).probability>base);});
test('site-visit signal increases probability',()=>{const base=conversionProbability(lead(),'NEW LEAD',null,[],now).probability;assert.ok(conversionProbability(lead({site_visit_at:'2026-08-27'}),'NEW LEAD',null,[],now).probability>base);});
test('overdue follow-up applies a transparent penalty',()=>{const fresh=conversionProbability(lead(),'NEW LEAD',null,[],now).probability;assert.equal(conversionProbability(lead({next_follow_up_at:'2026-08-25'}),'NEW LEAD',null,[],now).probability,fresh-10);});
test('property match provides an uplift',()=>assert.ok(conversionProbability(lead(),'NEW LEAD',rec(),[],now).probability>conversionProbability(lead(),'NEW LEAD',null,[],now).probability));
test('stale lead applies a transparent penalty',()=>assert.ok(conversionProbability(lead({captured_at:'2026-07-01'}),'NEW LEAD',null,[],now).signals.some(x=>x.includes('Stale'))));
test('forecast windows respect explicit close date',()=>assert.equal(forecastWindow(lead({projected_close_at:'2026-08-30'}),50,now),'NEXT 7 DAYS'));
test('advisor metrics are transparent operational counts',()=>{const x=pipelineAnalytics([lead({status:'qualified',qualification_status:'completed'})],[rec()],[execution()],now);assert.equal(x.advisor_metrics[0].qualified,1);assert.equal(x.advisor_metrics[0].active_pipeline_count,1);});
test('project/developer/area metrics use existing recommendation data',()=>{const x=pipelineAnalytics([lead({status:'converted',meeting_at:'2026-08-25',site_visit_at:'2026-08-25'})],[rec({advisor_status:'interested'})],[],now);assert.equal(x.project_metrics.project[0].name,'TEST Project');assert.equal(x.project_metrics.project[0].conversions,1);});
test('analytics rejects mixed TEST and genuine records',()=>assert.throws(()=>pipelineAnalytics([lead(),lead({id:'real',is_test:false})],[],[],now),/cannot be mixed/));
