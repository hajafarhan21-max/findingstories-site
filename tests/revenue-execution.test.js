import test from 'node:test';
import assert from 'node:assert/strict';
import { applyExecutionAction, canCreateAction, commandCenter, recommendationEscalations } from '../api/_lib/revenue-execution.js';

const now=new Date('2026-08-25T12:00:00Z');
const execution=(overrides={})=>({ id:'TEST-execution',is_test:true,recommendation_id:'TEST-rec',action_type:'whatsapp',original_ai_draft:'TEST original',advisor_edited_draft:'',approval_status:'pending',execution_status:'pending',...overrides });
const lead=(overrides={})=>({ id:'TEST-lead',name:'TEST Lead',is_test:false,status:'qualified',updated_at:'2026-08-24T00:00:00Z',ai_recommended_at:'2026-08-24T00:00:00Z',ai_recommendation:{priority:'HOT',meeting_ready:true,next_action:'Book a meeting'},...overrides });

test('advisor approval persists the original draft',()=>{ const result=applyExecutionAction(execution(),{type:'approve'},now); assert.equal(result.approval_status,'approved'); assert.equal(result.advisor_edited_draft,'TEST original'); });
test('advisor can edit a draft before approval',()=>{ const result=applyExecutionAction(execution(),{type:'approve',draft:'TEST advisor edit'},now); assert.equal(result.advisor_edited_draft,'TEST advisor edit'); });
test('advisor can snooze a recommendation',()=>{ const until='2026-08-26T12:00:00.000Z'; assert.equal(applyExecutionAction(execution(),{type:'snooze',until},now).snoozed_until,until); });
test('dismissal records a reason',()=>{ const result=applyExecutionAction(execution(),{type:'dismiss',reason:'TEST duplicate enquiry'},now); assert.equal(result.dismissal_reason,'TEST duplicate enquiry'); assert.equal(result.approval_status,'rejected'); });
test('overdue advisor action escalates deterministically',()=>assert.ok(recommendationEscalations(lead({next_follow_up_at:'2026-08-25T11:00:00Z'}),now).includes('OVERDUE_ADVISOR_ACTION')));
test('meeting-ready opportunity without booking escalates',()=>assert.ok(recommendationEscalations(lead(),now).includes('MEETING_READY_NO_MEETING')));
test('duplicate active action is prevented',()=>assert.equal(canCreateAction([execution({is_test:false})],'TEST-rec','whatsapp'),false));
test('already-completed follow-up cannot complete twice',()=>assert.throws(()=>applyExecutionAction(execution({approval_status:'approved',execution_status:'completed'}),{type:'complete',outcome:'TEST done'},now),/already completed/));
test('execution mutation helper enforces TEST isolation',()=>assert.throws(()=>applyExecutionAction(execution({is_test:false}),{type:'approve'},now),/isolation/));
test('converted lead is suppressed from escalations and command center',()=>{ const converted=lead({status:'booked'}); assert.deepEqual(recommendationEscalations(converted,now),[]); assert.equal(commandCenter([converted],[],now).hot_now,0); });
