import test from 'node:test'; import assert from 'node:assert/strict'; import { readFile } from 'node:fs/promises';
import { hasPermission,visibleUserIds,canAccessOwner,ROLES } from '../api/_lib/rbac.js';

test('CRM migration is additive, isolated and models the end-to-end real-estate workflow',async()=>{
 const sql=await readFile('database/migrations/010_crm_foundation.sql','utf8');
 assert.doesNotMatch(sql,/\b(DROP|TRUNCATE)\b|^\s*DELETE\s/mgi);
 for(const table of ['crm_users','crm_sessions','crm_teams','crm_role_permissions','crm_opportunities','crm_tasks','crm_activities','crm_audit_logs','crm_password_reset_tokens','crm_login_audit','crm_saved_views','crm_assignment_rules'])assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
 assert.match(sql,/ALTER TABLE leads ADD COLUMN IF NOT EXISTS owner_id/);
 assert.match(sql,/is_test BOOLEAN NOT NULL DEFAULT FALSE/g);
});

test('all required roles exist and permissions are explicit database lookups',async()=>{
 assert.deepEqual(ROLES,['SUPER_ADMIN','ADMIN','BUSINESS_HEAD','MANAGER','TEAM_LEADER','PROPERTY_ADVISOR','MARKETING','OPERATIONS']);
 const allow=async(parts,...values)=>parts.join('?').startsWith('SELECT EXISTS')?[{allowed:values[2]==='view'}]:[];
 assert.equal(await hasPermission(allow,{id:'u',role:'PROPERTY_ADVISOR'},'leads','view'),true);
 assert.equal(await hasPermission(allow,{id:'u',role:'PROPERTY_ADVISOR'},'leads','delete'),false);
 assert.equal(await hasPermission(allow,{id:'u',role:'UNKNOWN'},'leads','view'),false);
});

test('hierarchy scope supports deep reports and rejects cross-team ownership',async()=>{
 const sql=async()=>[{id:'manager'},{id:'leader'},{id:'advisor'}]; const identity={id:'manager',role:'MANAGER'};
 const scope=await visibleUserIds(sql,identity);
 assert.equal(canAccessOwner(identity,scope,'advisor'),true);
 assert.equal(canAccessOwner(identity,scope,'other-team-advisor'),false);
 assert.equal(canAccessOwner({id:'root',role:'SUPER_ADMIN'},null,'other-team-advisor'),true);
});

test('task and opportunity APIs enforce auth, permission, hierarchy and production isolation',async()=>{
 const [tasks,opportunities,access]=await Promise.all(['api/_lib/crm/tasks.js','api/_lib/crm/opportunities.js','api/_lib/crm-access.js'].map(x=>readFile(x,'utf8')));
 for(const source of [tasks,opportunities]){assert.match(source,/authorize\(/);assert.match(source,/ownerVisible\(/);assert.match(source,/is_test=FALSE/);}
 assert.match(access,/authenticate\(/);assert.match(access,/hasPermission\(/);assert.match(tasks,/crm_activities/);assert.match(opportunities,/crm_audit_logs/);
});

test('read-only CRM requests contain no schema or data mutations',async()=>{
 for(const file of ['api/_lib/crm/me.js','api/_lib/crm/leads.js']){const source=await readFile(file,'utf8');assert.doesNotMatch(source,/ensureSchema|\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE TABLE)\b/i);}
});
