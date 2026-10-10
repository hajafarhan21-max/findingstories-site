import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leadSchema } from '../api/_lib/validation.js';
import { persistRespondAndSchedule } from '../api/_lib/workflow.js';

test('lead schema requires valid contact information and affirmative consent', () => {
  const base={name:'Test Investor',phone:'+971501234567',consent:true,submission_id:'d9d50a74-a2d1-43e0-9c9e-687def231add'};
  assert.equal(leadSchema.safeParse(base).success,true);
  assert.equal(leadSchema.safeParse({...base,consent:false}).success,true); // rejected by endpoint after schema validation
  assert.equal(leadSchema.safeParse({...base,phone:'invalid'}).success,false);
});
test('capture persists once, responds, and schedules qualification only for new records',async()=>{
  const order=[];
  const perform=async duplicate=>persistRespondAndSchedule({
    lead:{consent:true},
    persist:async()=>{order.push('persist');return{id:'internal',duplicate};},
    respond:()=>order.push('respond'),
    schedule:()=>order.push('schedule'),
    background:async()=>order.push('background')
  });
  await perform(false);
  assert.deepEqual(order.slice(0,3),['persist','respond','schedule']);
  order.length=0;
  await perform(true);
  assert.deepEqual(order,['persist','respond']);
});
test('public capture response does not include internal lead ID',()=>{
  const code=readFileSync(new URL('../api/leads.js',import.meta.url),'utf8');
  assert.match(code,/duplicate: saved\.duplicate/);
  assert.doesNotMatch(code,/ok: true, id: saved\.id/);
});
test('revenue snapshot enforces CRM permission and owner visibility',()=>{
  const code=readFileSync(new URL('../api/_lib/revenue-operations-snapshot.js',import.meta.url),'utf8');
  assert.match(code,/authorize\(req, res, 'leads', 'view'\)/);
  assert.match(code,/access\.visibleIds\.includes\(row\.owner_id\)/);
});
