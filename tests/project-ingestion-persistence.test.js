import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { ingestProject } from '../api/_lib/project-ingestion.js';

const unitTypes=[
  {unit_type:'1 Bedroom',bedrooms:'1',property_type:'Apartment',minimum_area:700,maximum_area:900,starting_price:1_000_000,price_currency:'AED'},
  {unit_type:'2 Bedroom',bedrooms:'2',property_type:'Apartment',minimum_area:1000,maximum_area:1300,starting_price:1_500_000,price_currency:'AED'}
];
const project={developer:'Test Developer',name:'FS Pre-Launch Acceptance Test',availability_mode:'PRE_LAUNCH',emirate:'Dubai',area:'Dubai Hills Estate',construction_status:'Pre-Launch',launch_date:'2026-09-15',handover:'2029-06-30',eoi_amount:'100000',eoi_type:'Refundable EOI',booking_amount:'200000',campaign_status:'Pre-Launch',payment_plan_summary:'20% Booking + 40% During Construction + 40% On Handover',description:'TEST ONLY — Pre-launch project acceptance test. Physical unit inventory is not released.',attributes:{}};
const pdf=name=>({filename:name,media_type:'application/pdf',source_kind:name.includes('master')?'master_plan':'brochure',base64:Buffer.from(`%PDF-1.4 integration fixture ${name}`).toString('base64')});

async function database() {
  const db=new PGlite();
  await db.exec(`CREATE TABLE crm_users(id uuid primary key default gen_random_uuid()); CREATE TABLE launch_projects(id uuid primary key default gen_random_uuid()); CREATE TABLE property_inventory(id uuid primary key default gen_random_uuid(),unit text,developer text,project text,emirate text,area text,property_type text,bedrooms text,minimum_price numeric,maximum_price numeric,minimum_size numeric,maximum_size numeric,price_per_sqft numeric,handover date,payment_plan_summary text,construction_status text,suitability text,status text,source text,data_quality text,last_updated timestamptz,is_test boolean,created_at timestamptz default now(),updated_at timestamptz default now());`);
  for(const migration of ['013_project_ingestion.sql','014_pre_launch_projects.sql'])await db.exec(await readFile(`database/migrations/${migration}`,'utf8'));
  const user=(await db.query('INSERT INTO crm_users DEFAULT VALUES RETURNING id')).rows[0];
  const sql=async(strings,...values)=>{let query=strings[0];for(let i=0;i<values.length;i++){query+=`$${i+1}${strings[i+1]}`;if(/^::jsonb/.test(strings[i+1])){assert.equal(typeof values[i],'string','JSONB parameters must not reach Neon as JavaScript arrays');assert.doesNotThrow(()=>JSON.parse(values[i]),'JSONB parameters must contain valid JSON before SQL execution');}}return (await db.query(query,values)).rows;};
  return {db,sql,user};
}

test('exact PRE_LAUNCH TEST acceptance payload persists in needs_review with no inventory or files',async()=>{
  const {db,sql,user}=await database();
  const before=(await db.query('SELECT count(*)::int AS count FROM property_inventory')).rows[0].count;
  const result=await ingestProject(sql,{project,inventory:[],unit_types:unitTypes,sources:[],is_test:true},user.id);
  assert.equal(result.success,true);assert.equal(result.ingestion.status,'needs_review');assert.equal(result.ingestion.is_test,true);assert.equal(result.ingestion.inventory_count,0);assert.equal(result.ingestion.unit_type_count,2);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM property_inventory')).rows[0].count,before);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM project_ingestions WHERE is_test=false')).rows[0].count,0);
  await db.close();
});

test('PRE_LAUNCH persists with brochure and with brochure plus master plan',async()=>{
  const {db,sql,user}=await database();
  for(const [index,sources] of [[1,[pdf('brochure.pdf')]],[2,[pdf('brochure.pdf'),pdf('master-plan.pdf')]]]){
    const result=await ingestProject(sql,{project:{...project,name:`Source test ${index}`},inventory:[],unit_types:unitTypes,sources,is_test:true},user.id);
    assert.equal(result.ingestion.inventory_count,0);assert.equal((await db.query('SELECT count(*)::int AS count FROM project_sources WHERE ingestion_id=$1',[result.ingestion.id])).rows[0].count,sources.length);
  }
  await db.close();
});
