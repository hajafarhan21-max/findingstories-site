import test from 'node:test';
import assert from 'node:assert/strict';
import { planRevenueFollowUps, summarizeRevenueOperations } from '../platform/revenue-operations.js';
test('only consented and contactable active leads enter the queue', () => {
 const leads = [{id:1,consent:true,phone:'123',temperature:'Hot',lead_score:85},{id:2,consent:false,phone:'123'}, {id:3,consent:true,email:'a@example.com',status:'won'}, {id:4,consent:true}];
 assert.deepEqual(planRevenueFollowUps(leads).map(l=>l.lead_id),['1']);
 assert.equal(planRevenueFollowUps(leads)[0].requires_human_approval,true);
});
test('sorts overdue leads first and deduplicates by lead id',()=>{
 const leads=[{id:2,consent:true,email:'a@b.co',temperature:'Hot',lead_score:90},{id:1,consent:true,phone:'123',temperature:'Warm',next_follow_up_at:'2025-01-01'},{id:1,consent:true,phone:'123'}];
 assert.deepEqual(planRevenueFollowUps(leads,new Date('2026-10-08')).map(l=>l.lead_id),['1','2']);
});
test('reports attributed revenue separately by currency and excludes test leads',()=>{
 const leads=[{id:1,status:'won',attributed_revenue:500,revenue_currency:'AED'}, {id:2,status:'won',attributed_revenue:100,revenue_currency:'USD'}, {id:3,status:'won',attributed_revenue:1000,revenue_currency:'AED',is_test:true}];
 assert.deepEqual(summarizeRevenueOperations(leads).revenue_by_currency,{AED:500,USD:100});
});
