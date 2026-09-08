import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AZIZI_FLORENCE_CAMPAIGN,AZIZI_FLORENCE_PATH,FLORENCE_MEDIA_CLASS,aziziStructuredData,classifyFlorenceMedia,formatHandover,renderAziziFlorence } from '../api/_lib/azizi-florence.js';

const project={id:'11111111-1111-4111-8111-111111111111',name:'Azizi Florence',developer:'Azizi Developments',area:'Verified Area',emirate:'Dubai',description:'Verified description.',availability_mode:'PRE_LAUNCH',payment_plan_summary:null,handover:null};
const campaign={id:'22222222-2222-4222-8222-222222222222',name:AZIZI_FLORENCE_CAMPAIGN};
const unit={unit_type:'Verified three bedroom',property_type:'Villa',bedrooms:'3',minimum_area:2700,maximum_area:3100,starting_price:1234567,price_currency:'AED',review_status:'verified',is_test:false};

test('Azizi page renders only supplied verified production facts and honest EOI language',()=>{const html=renderAziziFlorence({project,campaign,units:[unit,{...unit,unit_type:'TEST',is_test:true}],sources:[{filename:'reviewed.pdf',source_kind:'brochure'}],whatsappNumber:'971500000000'});assert.match(html,/Verified description/);assert.match(html,/Verified three bedroom/);assert.match(html,/AED[^<]*1,234,567/);assert.doesNotMatch(html,/TEST/);assert.doesNotMatch(html,/reviewed\.pdf/);assert.doesNotMatch(html,/guaranteed|official developer EOI completed/i);assert.match(html,/not an official developer EOI/i);assert.match(html,new RegExp(`project_id.*${project.id}`));assert.match(html,new RegExp(`campaign_id.*${campaign.id}`));});
test('luxury presentation formats dates, parses verified plan milestones, and conditionally renders verified lifestyle facts',()=>{const supplied={...project,handover:'2029-12-31T00:00:00.000Z',payment_plan_summary:'30% during construction / 70% on handover',attributes:{amenities:'Private garden; Clubhouse',location_facts:'Um Fannain, Sharjah'}};const html=renderAziziFlorence({project:supplied,campaign,units:[unit],sources:[]});assert.equal(formatHandover(supplied.handover),'December 2029');assert.match(html,/Expected handover<\/span><strong>December 2029/);assert.match(html,/30<sup>%<\/sup>/);assert.match(html,/70<sup>%<\/sup>/);assert.match(html,/Private garden/);assert.match(html,/Um Fannain, Sharjah/);});
test('unverified bedroom types and absent amenity/location attributes are not promoted',()=>{const html=renderAziziFlorence({project:{...project,attributes:{}},campaign,units:[{...unit,bedrooms:'2',unit_type:'Unverified collection'}],sources:[]});assert.doesNotMatch(html,/Unverified collection|THE FLORENCE LIFESTYLE/);assert.doesNotMatch(html,/\d+ minutes/i);});
test('missing facts remain absent from page and structured data',()=>{const html=renderAziziFlorence({project:{...project,description:null,area:null,emirate:null},campaign,units:[],sources:[],whatsappNumber:''});assert.doesNotMatch(html,/<span>Starting price<\/span>|<span>Expected handover<\/span>|class="payment section-pad"/);const schema=aziziStructuredData({...project,description:null,area:null,emirate:null},[],'https://www.finding-stories.com');assert.equal(schema.description,undefined);assert.equal(schema.offers,undefined);assert.equal(schema.address,undefined);});
test('production route is active-campaign, verified-project, and TEST isolated with read-only GET',async()=>{const source=await readFile('api/_lib/azizi-florence-page.js','utf8');assert.match(source,/c\.status='ACTIVE'/);assert.match(source,/review_status='verified'/);assert.ok((source.match(/is_test=FALSE/g)||[]).length>=4);assert.doesNotMatch(source,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i);assert.match(source,/AZIZI_FLORENCE_CAMPAIGN/);});
test('lead capture preserves attribution and protects duplicate production submissions',async()=>{const source=await readFile('api/leads.js','utf8');assert.match(source,/ON CONFLICT \(submission_id\)[\s\S]*DO NOTHING[\s\S]*UPDATE leads SET latest_touch_attribution/);assert.match(source,/first_touch_attribution/);assert.match(source,/status='ACTIVE'/);assert.match(source,/is_test=FALSE/);assert.match(source,/TRUE duplicate/);assert.match(source,/if \(lead\.website\) return json\(res, 202/);});
test('funnel captures qualification and UTM fields and sitemap is activation-gated',async()=>{const [client,template,sitemap,migration]=await Promise.all([readFile('public/azizi-florence.js','utf8'),readFile('api/_lib/azizi-florence.js','utf8'),readFile('api/_lib/acquisition-sitemap.js','utf8'),readFile('database/migrations/018_azizi_florence_funnel.sql','utf8')]);for(const field of ['campaign_id','project_id','utm_source','utm_medium','utm_campaign','utm_content','utm_term','first_touch_attribution','latest_touch_attribution'])assert.match(client,new RegExp(field));for(const field of ['property_type','budget','purpose','purchase_timeline','preferred_contact_method'])assert.match(template,new RegExp(field));for(const event of ['page_view','cta_click','enquiry_started','enquiry_submitted','brochure_request','consultation_request','site_visit_request'])assert.match(client,new RegExp(event));assert.match(template,/whatsapp_click/);assert.match(sitemap,/status='ACTIVE'/);assert.match(sitemap,/AZIZI_FLORENCE_PATH/);assert.doesNotMatch(migration,/INSERT INTO/i);});
test('clean public URL resolves to the funnel function in Vercel',async()=>{const config=JSON.parse(await readFile('vercel.json','utf8'));const route=config.rewrites.find(rewrite=>rewrite.source==='/azizi-florence');assert.deepEqual(route,{source:'/azizi-florence',destination:'/api/acquisition?route=azizi-florence'});const destination=new URL(route.destination,'https://www.finding-stories.com');assert.equal(destination.pathname,'/api/acquisition');assert.equal(destination.searchParams.get('route'),'azizi-florence');await readFile(`.${destination.pathname}.js`,'utf8');});
test('funnel public assets and API endpoints are present in the production build structure',async()=>{const [template,client,style,handler,leads]=await Promise.all([readFile('api/_lib/azizi-florence.js','utf8'),readFile('public/azizi-florence.js','utf8'),readFile('public/azizi-florence.css','utf8'),readFile('api/acquisition.js','utf8'),readFile('api/leads.js','utf8')]);assert.match(template,/href="\/public\/azizi-florence\.css"/);assert.match(template,/src="\/public\/azizi-florence\.js"/);assert.match(style,/\.hero/);assert.match(client,/fetch\('\/api\/acquisition\?route=events'/);assert.match(client,/fetch\('\/api\/leads'/);assert.match(handler,/route==='azizi-florence'/);assert.match(handler,/route==='events'/);assert.match(leads,/export default async function handler/);});
test('Azizi canonical and activation-gated sitemap use the clean public URL',async()=>{const config=JSON.parse(await readFile('vercel.json','utf8'));const sitemapRoute=config.rewrites.find(rewrite=>rewrite.source==='/sitemap.xml');assert.equal(sitemapRoute?.destination,'/api/acquisition?route=sitemap');assert.equal(AZIZI_FLORENCE_PATH,'/azizi-florence');const html=renderAziziFlorence({project,campaign,units:[unit],sources:[],origin:'https://www.finding-stories.com',whatsappNumber:''});assert.match(html,/rel="canonical" href="https:\/\/www\.finding-stories\.com\/azizi-florence"/);});

test('document tables and sales sheets can never render as decorative Florence photography',()=>{
  const sources=[
    {id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',filename:'unit-bifurcation-table.png',source_kind:'inventory',media_type:'image/png'},
    {id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',filename:'payment-plan-sales-sheet.jpg',source_kind:'brochure',media_type:'image/jpeg'},
    {id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',filename:'florence-exterior-render.jpg',source_kind:'project photography',media_type:'image/jpeg'}
  ];
  assert.equal(classifyFlorenceMedia(sources[0]),FLORENCE_MEDIA_CLASS.DOCUMENT_TABLE);
  assert.equal(classifyFlorenceMedia(sources[1]),FLORENCE_MEDIA_CLASS.DOCUMENT_TABLE);
  assert.equal(classifyFlorenceMedia(sources[2]),FLORENCE_MEDIA_CLASS.PROJECT_PHOTOGRAPHY);
  const html=renderAziziFlorence({project,campaign,units:[unit],sources});
  assert.doesNotMatch(html,/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa|bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/);
  assert.match(html,/cccccccc-cccc-4ccc-8ccc-cccccccccccc/);
});

test('maps, floor plans, logos, and unclassified images are excluded from photographic placements',()=>{
  for(const [filename,classification] of [['location-map.png','MAP'],['three-bedroom-floor-plan.png','FLOOR_PLAN'],['azizi-logo.png','LOGO'],['page-12.png','UNCLASSIFIED']])assert.equal(classifyFlorenceMedia({filename}),classification);
  const html=renderAziziFlorence({project,campaign,units:[unit],sources:[{id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',filename:'location-map.png',media_type:'image/png'}]});
  assert.doesNotMatch(html,/dddddddd-dddd-4ddd-8ddd-dddddddddddd/);
  assert.match(html,/unit-visual[^>]* role="img"/);
});

test('adjacent verified payment percentages remain separate milestones',()=>{
  const html=renderAziziFlorence({project:{...project,payment_plan_summary:'4% SLD + 10% immediate / 70% on completion'},campaign,units:[],sources:[]});
  assert.match(html,/4<sup>%<\/sup>[\s\S]*SLD/);
  assert.match(html,/10<sup>%<\/sup>[\s\S]*immediate/);
  assert.match(html,/70<sup>%<\/sup>[\s\S]*on completion/);
});
