import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deletionResult,hasStrictDeleteRole,parseLeadDeletion } from '../api/_lib/crm/lead-deletion.js';
import { canDeleteLeads,selectedListedIds,toggleAllListed } from '../public/crm-lead-selection.js';

const TEST_IDS=[
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003'
];

test('SUPER_ADMIN can submit an explicitly confirmed single TEST fixture deletion',()=>{
 assert.deepEqual(parseLeadDeletion({ids:[TEST_IDS[0]],confirm:true}),[TEST_IDS[0]]);
 assert.equal(hasStrictDeleteRole({role:'SUPER_ADMIN'}),true);
 assert.deepEqual(deletionResult([{lead_id:TEST_IDS[0],deleted:true,reason:null}],[TEST_IDS[0]]),{deletedCount:1,deletedIds:[TEST_IDS[0]],notDeleted:[]});
});

test('SUPER_ADMIN bulk deletion reports the exact deleted TEST fixture count and failures',()=>{
 const result=deletionResult([{lead_id:TEST_IDS[0],deleted:true},{lead_id:TEST_IDS[1],deleted:false,reason:'TEST constraint'}],TEST_IDS.slice(0,2));
 assert.equal(result.deletedCount,1); assert.deepEqual(result.deletedIds,[TEST_IDS[0]]);
 assert.deepEqual(result.notDeleted,[{id:TEST_IDS[1],reason:'TEST constraint'}]);
});

test('select all affects every currently listed/filtered TEST fixture and no hidden lead',()=>{
 const selected=toggleAllListed(new Set([TEST_IDS[2]]),TEST_IDS.slice(0,2),true);
 assert.deepEqual([...selected],[TEST_IDS[2],TEST_IDS[0],TEST_IDS[1]]);
 assert.deepEqual([...selectedListedIds(selected,TEST_IDS.slice(0,2))],TEST_IDS.slice(0,2));
 assert.deepEqual([...toggleAllListed(selected,TEST_IDS.slice(0,2),false)],[TEST_IDS[2]]);
});

test('every non-SUPER_ADMIN role is denied and has no delete controls',()=>{
 for(const role of ['ADMIN','TEAM_LEAD','TEAM_LEADER','AGENT','PROPERTY_ADVISOR',null]){
  assert.equal(hasStrictDeleteRole({role}),false); assert.equal(canDeleteLeads(role),false);
 }
 assert.equal(parseLeadDeletion({ids:[TEST_IDS[0]],confirm:false}),null);
});

test('database deletion handles only lead-dependent records and writes an audit per deleted lead',async()=>{
 const sql=await readFile('database/migrations/012_super_admin_lead_deletion.sql','utf8');
 for(const table of ['launch_funnel_history','crm_tasks','crm_activities','launch_eois','launch_lead_attribution','crm_opportunities','follow_up_executions','property_recommendations','leads'])
  assert.match(sql,new RegExp(`DELETE FROM ${table}`));
 assert.match(sql,/INSERT INTO crm_audit_logs/); assert.match(sql,/p_actor/); assert.match(sql,/deleted_lead_ids/); assert.match(sql,/'count',1/); assert.match(sql,/NOW\(\)/);
});

test('unrelated production business records remain untouched and TEST leads are isolated',async()=>{
 const sql=await readFile('database/migrations/012_super_admin_lead_deletion.sql','utf8');
 for(const table of ['property_inventory','launch_campaigns','launch_projects','search_console_snapshots','seo_growth_actions','crm_users'])
  assert.doesNotMatch(sql,new RegExp(`DELETE FROM ${table}`));
 assert.match(sql,/WHERE id=requested AND is_test=FALSE FOR UPDATE/);
 assert.match(sql,/DELETE FROM leads WHERE id=requested AND is_test=FALSE/);
});
