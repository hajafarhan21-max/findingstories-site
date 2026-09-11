import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { leadSchema } from '../api/_lib/validation.js';
import { buildProjectLeadPayload } from '../public/project-lead-payload.js';

const context={campaign_id:'0c629d92-514d-49e9-bbd4-a96d6fedbf35',project_id:'558fad74-6d5f-4709-b816-d8d17af1e33d',project:'Azizi Florence',developer:'Azizi Developments',area:'Um Fannain, Sharjah'};
const touch={source:'campaign',medium:'acceptance',landing_page:'/azizi-florence',referrer:'',utm_source:'qa',utm_medium:'acceptance',utm_campaign:'florence',utm_content:'',utm_term:''};
const base={name:'Real User',email:'buyer@example.com',property_type:'3 Bedroom Townhouse',budget:'AED 3,000,000',purpose:'Investment',purchase_timeline:'Within 3 months',preferred_contact_method:'WhatsApp',additional_requirements:'Please share details',consent:'on',website:''};

test('actual Florence browser FormData contract excludes UI-only enquiry_type',()=>{
  for(const [index,enquiry_type] of ['register_interest','consultation_request','site_visit_request'].entries()){
    const payload=buildProjectLeadPayload({values:{...base,phone:'+971 50 123 4567',enquiry_type},context,latest:touch,first:touch,submissionId:`00000000-0000-4000-8000-00000000000${index}`});
    assert.equal(Object.hasOwn(payload,'enquiry_type'),false);
    assert.equal(leadSchema.safeParse(payload).success,true,enquiry_type);
    assert.match(payload.additional_requirements,new RegExp(`^${enquiry_type}:`));
  }
});

test('Florence accepts legitimate UAE and international browser phone formats',()=>{
  for(const phone of ['+971 50 123 4567','050-123-4567','+44 (20) 7946 0958','+1 (415) 555-0123']){
    const payload=buildProjectLeadPayload({values:{...base,phone,enquiry_type:'register_interest'},context,latest:touch,first:touch,submissionId:'00000000-0000-4000-8000-000000000010'});
    assert.equal(leadSchema.safeParse(payload).success,true,phone);
  }
});

test('rendered form retains every visible required control and all three submit intents',async()=>{
  const template=await readFile('api/_lib/azizi-florence.js','utf8');
  for(const name of ['name','phone','email','property_type','budget','purpose','purchase_timeline','preferred_contact_method','consent'])assert.match(template,new RegExp(`name="${name}"[^>]*required|required[^>]*name="${name}"`));
  for(const intent of ['register_interest','consultation_request','site_visit_request'])assert.match(template,new RegExp(intent));
});
