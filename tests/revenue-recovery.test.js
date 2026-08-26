import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRecoveryLead, recoveryAnalytics, recoveryEligibility } from '../api/_lib/revenue-recovery.js';

const now=new Date('2026-08-26T12:00:00Z');
const lead=(overrides={})=>({id:'TEST-lead',name:'TEST Recovery Lead',is_test:true,consent:true,status:'qualified',temperature:'Warm',qualification_status:'completed',missing_information:[],assigned_to:'TEST Advisor',captured_at:'2026-08-01T12:00:00Z',updated_at:'2026-08-20T12:00:00Z',...overrides});
const match=(overrides={})=>({id:'TEST-match',lead_id:'TEST-lead',is_test:true,created_at:'2026-08-20T12:00:00Z',ranked_matches:[{project:'TEST Project',tier:'STRONG',data_quality:'VERIFIED INVENTORY'}],...overrides});
const execution=(overrides={})=>({id:'TEST-action',lead_id:'TEST-lead',is_test:true,created_at:'2026-08-25T12:00:00Z',action_type:'follow_up',approval_status:'approved',execution_status:'approved',recommendation_id:'recovery-v1:TEST-lead',...overrides});

test('overdue qualified lead is detected',()=>assert.equal(analyzeRecoveryLead(lead({next_follow_up_at:'2026-08-25T12:00:00Z'}),null,[],now).recoverable,true));
test('stale HOT lead receives positive transparent HOT factor',()=>assert.ok(analyzeRecoveryLead(lead({temperature:'Hot',updated_at:'2026-07-01'}),null,[],now).score_factors.includes('HOT lead +24')));
test('property-match leakage has its recovery band',()=>assert.equal(analyzeRecoveryLead(lead({updated_at:'2026-08-10'}),match(),[],now).recovery_band,'PROPERTY MATCH RECOVERY'));
test('past incomplete meeting is meeting recovery',()=>assert.equal(analyzeRecoveryLead(lead({meeting_at:'2026-08-20'}),null,[],now).recovery_band,'MEETING RECOVERY'));
test('past incomplete site visit is site-visit recovery',()=>assert.equal(analyzeRecoveryLead(lead({site_visit_at:'2026-08-20'}),null,[],now).recovery_band,'SITE VISIT RECOVERY'));
test('unassigned qualified opportunity is detected',()=>assert.match(analyzeRecoveryLead(lead({assigned_to:''}),null,[],now).why,/unassigned/i));
test('explicit do-not-contact is suppressed',()=>assert.equal(recoveryEligibility(lead({do_not_contact:true})).eligible,false));
test('converted lead is suppressed',()=>assert.equal(recoveryEligibility(lead({status:'converted'})).eligible,false));
test('recent active recovery execution suppresses a duplicate recommendation',()=>assert.equal(recoveryAnalytics([lead({next_follow_up_at:'2026-08-25'})],[],[execution()],now).queue.length,0));
test('timing lost reason is advisor-reviewable',()=>assert.equal(recoveryEligibility(lead({status:'lost',lost_reason:'Timing was not right'})).eligible,true));
test('spam lost reason is not recoverable',()=>assert.equal(recoveryEligibility(lead({status:'lost',lost_reason:'Spam submission'})).eligible,false));
test('queue uses deterministic recovery-priority ordering',()=>{const low=lead({id:'TEST-low',name:'TEST Low',temperature:'Cold',next_follow_up_at:'2026-08-25'});const high=lead({id:'TEST-high',name:'TEST High',temperature:'Hot',next_follow_up_at:'2026-08-25'});assert.equal(recoveryAnalytics([low,high],[],[],now).queue[0].id,'TEST-high');});
test('drafts are suggestions and explicitly require advisor approval',()=>{const result=analyzeRecoveryLead(lead({next_follow_up_at:'2026-08-25'}),null,[],now);assert.equal(result.approval_required,true);assert.equal(result.autonomous_contact,false);assert.match(result.whatsapp_draft,/ADVISOR APPROVAL REQUIRED/);});
test('TEST and genuine recovery analytics cannot be mixed',()=>assert.throws(()=>recoveryAnalytics([lead(),lead({id:'real',is_test:false})],[],[],now),/cannot be mixed/));
test('unknown transaction values never create fabricated pipeline',()=>assert.equal(recoveryAnalytics([lead({next_follow_up_at:'2026-08-25'})],[],[],now).metrics.estimated_recoverable_pipeline,'VALUE UNKNOWN'));
