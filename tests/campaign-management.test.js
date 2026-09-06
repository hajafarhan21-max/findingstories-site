import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { campaignMetrics } from '../api/_lib/campaign-metrics.js';
import { CRM_ROUTES,resolveCrmRoute } from '../public/crm-routing.js';

test('campaign funnel reports persisted actuals, targets and zero-safe conversions',()=>{
 const metrics=campaignMetrics({leads:10,qualified_leads:5,meetings:4,site_visits:2,eois:1,eois_pending:2,bookings:0,revenue:0,target_leads:20,target_qualified_leads:8,target_meetings:5,target_site_visits:4,target_eois:50,target_bookings:2,target_revenue:100});
 assert.deepEqual(metrics.actual,{leads:10,qualified_leads:5,meetings:4,site_visits:2,eois:1,bookings:0,revenue:0});
 assert.equal(metrics.conversion.qualified_leads,50);assert.equal(metrics.conversion.eois,50);
 assert.deepEqual(metrics.eoi_command,{target:50,completed:1,pending:2,conversion_percent:10,remaining:49});
 const empty=campaignMetrics({target_eois:50});assert.equal(empty.eoi_command.remaining,50);assert.equal(empty.conversion.qualified_leads,0);
});

test('campaign migration is additive, links existing verified project, and creates no fake outcomes',async()=>{
 const sql=await readFile('database/migrations/017_campaign_management.sql','utf8');
 assert.doesNotMatch(sql,/\b(?:DROP|TRUNCATE)\b/i);assert.doesNotMatch(sql,/INSERT INTO (?:projects|leads|crm_campaign_eois)/i);
 assert.match(sql,/project_id UUID NOT NULL REFERENCES projects/);assert.match(sql,/ALTER TABLE leads ADD COLUMN IF NOT EXISTS campaign_id/);
 assert.match(sql,/p\.review_status='verified'.*p\.active=TRUE.*p\.is_test=FALSE/s);
 assert.match(sql,/Azizi Florence — Pre-Launch EOI Campaign','PRE_LAUNCH','DRAFT',50/);
 assert.match(sql,/ON CONFLICT \(name,is_test\) DO NOTHING/);
});

test('campaign API enforces backend permissions, exact SUPER_ADMIN mutations and production isolation',async()=>{
 const source=await readFile('api/_lib/crm/campaigns.js','utf8');
 assert.match(source,/authorize\(req,res,'campaigns',action/);assert.match(source,/identity\.role==='SUPER_ADMIN'/);
 assert.match(source,/c\.is_test=FALSE AND p\.is_test=FALSE/);assert.match(source,/review_status='verified' AND active=TRUE AND is_test=FALSE/);
 assert.match(source,/l\.is_test=FALSE/g);assert.match(source,/e\.is_test=FALSE/g);
 for(const operation of ['INSERT INTO crm_campaigns','UPDATE crm_campaigns','DELETE FROM crm_campaign_assignments'])assert.match(source,new RegExp(operation));
});

test('campaign attribution uses the existing Leads database and captures both touches',async()=>{
 const [capture,migration]=await Promise.all([readFile('api/leads.js','utf8'),readFile('database/migrations/017_campaign_management.sql','utf8')]);
 for(const field of ['campaign_id','project_id','source','medium','utm_source','utm_medium','utm_campaign','utm_content','utm_term','landing_page','referrer','first_touch_attribution','latest_touch_attribution'])assert.match(capture,new RegExp(field));
 assert.match(capture,/Campaign attribution is not valid for this production project/);
 assert.equal((migration.match(/CREATE TABLE IF NOT EXISTS leads/g)||[]).length,0,'must not create a duplicate lead database');
});

test('Campaigns and Organic Acquisition are distinct canonical modules',async()=>{
 const html=await readFile('admin.html','utf8');assert.ok(CRM_ROUTES.includes('campaigns'));assert.ok(CRM_ROUTES.includes('organic-acquisition'));
 assert.equal(resolveCrmRoute('#acquisition-performance'),'organic-acquisition');
 assert.match(html,/href="#campaigns"[^>]*>Campaigns/);assert.match(html,/href="#organic-acquisition"[^>]*>Organic Acquisition/);
 assert.match(html,/data-crm-screen="campaigns" aria-labelledby="campaigns-title"/);assert.match(html,/data-crm-screen="organic-acquisition" aria-labelledby="acquisition-title"/);
});
