import test from 'node:test';
import assert from 'node:assert/strict';
import { matchProperties, needsPropertyRecommendation, normalizeRequirements, propertyFingerprint } from '../api/_lib/property-matching.js';

const lead=(overrides={})=>({id:'lead-test',is_test:true,status:'qualified',budget:'AED 1m - 1.5m',property_type:'Apartment',bedrooms:'2',preferred_areas:'Dubai Marina',emirate:'Dubai',purpose:'Investment',construction_status:'Off-plan',purchase_timeline:'1–3 months',...overrides});
const unit=(overrides={})=>({id:'inventory-test',is_test:true,status:'active',developer:'TEST Developer',project:'TEST Project',emirate:'Dubai',area:'Dubai Marina',property_type:'Apartment',bedrooms:'2',minimum_price:1100000,maximum_price:1400000,construction_status:'Off-plan',handover:'2028-01-01',payment_plan_summary:'60/40',suitability:'Investment',data_quality:'verified',last_updated:new Date().toISOString(),updated_at:'2026-01-01',...overrides});

test('exact budget and preferred area produce a ranked match',()=>{const result=matchProperties(lead(),[unit()]);assert.equal(result.matches.length,1);assert.ok(result.matches[0].why.includes('Budget range overlaps'));assert.ok(result.matches[0].why.includes('Preferred area'));});
test('budget mismatch is a hard rejection',()=>assert.deepEqual(matchProperties(lead(),[unit({minimum_price:2e6})]).flags,['NO_SUITABLE_MATCH']));
test('bedroom mismatch is a hard rejection',()=>assert.equal(matchProperties(lead(),[unit({bedrooms:'3'})]).matches.length,0));
test('ready/off-plan mismatch is a hard rejection',()=>assert.equal(matchProperties(lead(),[unit({construction_status:'Ready'})]).matches.length,0));
test('handover after constraint is rejected',()=>assert.equal(matchProperties(lead({preferred_handover:'2027-01-01'}),[unit()]).matches.length,0));
test('payment-plan match is signalled',()=>assert.ok(matchProperties(lead({payment_plan_preference:'60/40'}),[unit()]).flags.includes('PAYMENT_PLAN_MATCH')));
test('multiple matches are ranked deterministically',()=>{const result=matchProperties(lead(),[unit({id:'b',project:'B',area:'JVC'}),unit({id:'a',project:'A'})]);assert.deepEqual(result.matches.map(x=>x.project),['A','B']);});
test('missing requirements are separate and never fabricated',()=>{const profile=normalizeRequirements(lead({budget:'',property_type:'',bedrooms:'',emirate:'',purchase_timeline:''}));assert.deepEqual(profile.missing_critical,['budget','property type','bedrooms','emirate','purchase timeline']);assert.equal(profile.budget_max,null);});
test('no suitable match is explicitly flagged',()=>assert.ok(matchProperties(lead(),[]).flags.includes('NO_SUITABLE_MATCH')));
test('stale inventory warning lowers score',()=>{const result=matchProperties(lead(),[unit({last_updated:'2020-01-01'})],new Date('2026-01-01'));assert.ok(result.flags.includes('INVENTORY_STALE'));assert.match(result.matches[0].does_not_match.join(' '),/stale/);});
test('converted leads are suppressed',()=>assert.equal(matchProperties(lead({status:'booked'}),[unit()]).matches.length,0));
test('TEST isolation rejects mixed datasets',()=>assert.throws(()=>matchProperties(lead(),[unit({is_test:false})]),/cannot be mixed/));
test('fingerprint prevents duplicate recommendations',()=>{const l=lead(),i=[unit()];l.property_recommendation_fingerprint=propertyFingerprint(l,i);assert.equal(needsPropertyRecommendation(l,i),false);});
test('lead requirement changes invalidate cache',()=>{const i=[unit()],l=lead();l.property_recommendation_fingerprint=propertyFingerprint(l,i);assert.equal(needsPropertyRecommendation({...l,bedrooms:'3'},i),true);});
test('inventory changes invalidate cache',()=>{const i=[unit()],l=lead();l.property_recommendation_fingerprint=propertyFingerprint(l,i);assert.equal(needsPropertyRecommendation(l,[unit({updated_at:'2026-02-01'})]),true);});
test('inventory content changes invalidate cache even when timestamps do not',()=>{const i=[unit()],l=lead();l.property_recommendation_fingerprint=propertyFingerprint(l,i);assert.equal(needsPropertyRecommendation(l,[unit({minimum_price:1200000})]),true);});
test('developer exclusions are enforced before ranking',()=>{const result=matchProperties(lead({requirements:{developer_exclusions:['TEST Developer']}}),[unit()]);assert.equal(result.matches.length,0);assert.ok(result.flags.includes('NO_SUITABLE_MATCH'));});
test('inventory provenance is explicit in every recommendation',()=>{assert.equal(matchProperties(lead(),[unit()]).matches[0].data_quality,'VERIFIED INVENTORY');assert.equal(matchProperties(lead(),[unit({data_quality:'advisory'})]).matches[0].data_quality,'ADVISORY / GENERIC PROJECT DATA');});
test('size and return objectives remain advisory and never infer ROI',()=>{const result=matchProperties(lead({requirements:{size_requirement:'minimum 1,500 sqft',expected_roi:'8%'}}),[unit({minimum_size:900,maximum_size:1200})]);assert.match(result.matches[0].does_not_match.join(' '),/minimum size/);assert.match(result.matches[0].does_not_match.join(' '),/no ROI is inferred/);});
