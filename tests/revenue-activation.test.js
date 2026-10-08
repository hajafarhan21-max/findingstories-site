import test from 'node:test';
import assert from 'node:assert/strict';
import { revenueQueue, revenueFunnel } from '../platform/revenue-activation.js';
test('queue excludes non-consenting and test leads and prioritizes overdue Hot prospects',()=>{
 const leads=[{id:1,consent:true,phone:'123',temperature:'Warm',lead_score:60,status:'new'}, {id:2,consent:true,email:'a@b.com',temperature:'Hot',lead_score:89,status:'new',next_follow_up_at:'2026-01-01'}, {id:3,consent:false,phone:'123',temperature:'Hot'}, {id:4,is_test:true,consent:true,phone:'123',temperature:'Hot'}, {id:5,consent:true,phone:'123',status:'won',temperature:'Hot'}];
 assert.deepEqual(revenueQueue(leads,new Date('2026-10-08')).map(l=>l.id),[2,1]);
});
test('funnel excludes tests and reports actual won revenue only',()=>{
 const f=revenueFunnel([{status:'won',temperature:'Hot',attributed_revenue:1500,revenue_currency:'AED'}, {status:'new',temperature:'Warm',attributed_revenue:9000}, {is_test:true,status:'won',attributed_revenue:5000}]);
 assert.equal(f.captured,2);assert.equal(f.won,1);assert.equal(f.attributed_revenue,1500);assert.deepEqual(f.revenue_currency,['AED']);
});
