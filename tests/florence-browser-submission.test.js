import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { leadSchema,missingFlorenceQualification,normalizeLeadPhone } from '../api/_lib/validation.js';
import { buildProjectLeadPayload } from '../public/project-lead-payload.js';

const context={campaign_id:'0c629d92-514d-49e9-bbd4-a96d6fedbf35',project_id:'558fad74-6d5f-4709-b816-d8d17af1e33d',project:'Azizi Florence',developer:'Azizi Developments',area:'Um Fannain, Sharjah'};
const touch={source:'campaign',medium:'acceptance',landing_page:'/azizi-florence',referrer:'',utm_source:'qa',utm_medium:'acceptance',utm_campaign:'florence',utm_content:'',utm_term:''};
const base={name:'Real User',email:'buyer@example.com',property_type:'3 Bedroom Townhouse',budget:'AED 3,000,000',purpose:'Investment',purchase_timeline:'Within 3 months',preferred_contact_method:'WhatsApp',conversion_type:'enquiry',additional_requirements:'Please share details',consent:'on',website:''};

test('actual Florence browser FormData contract preserves every form conversion as first-class data',()=>{
  for(const [index,conversion_type] of ['enquiry','brochure_request','availability_request','consultation','site_visit'].entries()){
    const payload=buildProjectLeadPayload({values:{...base,phone:'+971 50 123 4567',conversion_type},context,latest:touch,first:touch,submissionId:`00000000-0000-4000-8000-00000000000${index}`});
    assert.equal(payload.conversion_type,conversion_type);
    assert.equal(leadSchema.safeParse(payload).success,true,conversion_type);
    assert.equal(payload.additional_requirements,base.additional_requirements);
  }
});

test('Florence accepts legitimate UAE and international browser phone formats',()=>{
  for(const phone of ['+971 50 123 4567','050-123-4567','+44 (20) 7946 0958','+1 (415) 555-0123']){
    const payload=buildProjectLeadPayload({values:{...base,phone},context,latest:touch,first:touch,submissionId:'00000000-0000-4000-8000-000000000010'});
    const parsed=leadSchema.safeParse(payload);assert.equal(parsed.success,true,phone);assert.match(parsed.data.phone,/^\+[1-9]\d{7,14}$/);
  }
});

test('phone normalization rejects ambiguous and implausible values without blocking valid prospects',()=>{
  assert.equal(normalizeLeadPhone('050-123-4567'),'+971501234567');
  assert.equal(normalizeLeadPhone('0044 20 7946 0958'),'+442079460958');
  for(const phone of ['1234567','+00000000','+971-abc'])assert.throws(()=>normalizeLeadPhone(phone));
});

test('Florence server qualification identifies every missing revenue field',()=>{
  assert.deepEqual(missingFlorenceQualification(base),[]);
  for(const field of ['email','property_type','budget','purpose','purchase_timeline','preferred_contact_method','conversion_type'])assert.ok(missingFlorenceQualification({...base,[field]:''}).includes(field));
});

test('rendered form retains every visible required control and all three submit intents',async()=>{
  const template=await readFile('api/_lib/azizi-florence.js','utf8');
  for(const name of ['name','phone','email','property_type','budget','purpose','purchase_timeline','preferred_contact_method','consent'])assert.match(template,new RegExp(`name="${name}"[^>]*required|required[^>]*name="${name}"`));
  for(const intent of ['enquiry','brochure_request','availability_request','consultation','site_visit','whatsapp'])assert.match(template,new RegExp(`data-conversion="${intent}"`));
  assert.match(template,/data-engagement="location_explore"/);
  assert.doesNotMatch(template,/Explore location[^<]*[\s\S]{0,100}data-conversion="site_visit"/);
});

test('browser analytics separates attempts from non-duplicate completed conversions and preserves all UTMs',async()=>{
  const client=await readFile('public/azizi-florence.js','utf8');
  assert.match(client,/analytics\('cta_click',conversion\)/);
  assert.match(client,/response\.ok&&!data\.duplicate/);
  assert.doesNotMatch(client,/enquiry_submitted|whatsapp_click|consultation_request/);
  for(const field of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'])assert.match(client,new RegExp(field));
});
