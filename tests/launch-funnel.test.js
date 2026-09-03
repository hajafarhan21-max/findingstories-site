import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('generic launch migration is additive, empty by default, and models the gated funnel',async()=>{
 const sql=await readFile('database/migrations/011_launch_command_center.sql','utf8');
 assert.doesNotMatch(sql,/\b(DROP|TRUNCATE)\b|^\s*(?:DELETE|UPDATE)\s/mgi);
 for(const table of ['launch_projects','launch_campaigns','launch_lead_attribution','launch_eois','launch_funnel_history'])assert.match(sql,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
 for(const field of ['target_eois','qualification_score','lead_priority','call_ready','follow_up_state','payment_link_status','payment_confirmation_status','duplicate_of_lead_id'])assert.match(sql,new RegExp(field));
 assert.match(sql,/human_review_required/);
 assert.doesNotMatch(sql,/INSERT INTO/);
});

test('launch command center is authenticated, hierarchy scoped, production-only, and read-only',async()=>{
 const source=await readFile('api/_lib/crm/launch.js','utf8');
 assert.match(source,/authorize\(req,res,'reports','view'\)/);
 assert.match(source,/visibleIds/);
 assert.ok((source.match(/is_test=FALSE/g)||[]).length>=8);
 assert.doesNotMatch(source,/\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i);
 assert.match(source,/No production launch campaign exists\. No values have been fabricated\./);
});

test('command center exposes required persisted launch metrics without fallback values',async()=>{
 const [route,client,html]=await Promise.all(['api/_lib/crm/launch.js','public/admin.js','admin.html'].map(file=>readFile(file,'utf8')));
 for(const metric of ['target_eois','eois_completed','eois_pending_payment','payment_links_sent','qualified_hot_leads','call_ready_leads','advisor_follow_ups_due','organic_enquiries','daily_pace_required','remaining_eois','unassigned_hot_leads'])assert.match(route,new RegExp(metric));
 assert.match(client,/Unavailable/);
 assert.match(html,/50-EOI Launch Command Center/);
});

test('launch conversion and performance metrics do not inflate or misclassify funnel events',async()=>{
 const route=await readFile('api/_lib/crm/launch.js','utf8');
 assert.match(route,/COUNT\(DISTINCT a\.id\)::int enquiries/);
 assert.match(route,/event_type='advisor_call_completed'/);
 assert.match(route,/m\.organic_qualified.*m\.organic_enquiries/);
 assert.doesNotMatch(route,/meeting_at IS NOT NULL\)::int calls/);
});
