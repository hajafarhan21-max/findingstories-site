import assert from 'node:assert/strict';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { archiveTestRsvp, prepareTestFixture } from '../api/_lib/acceptance.js';
import { persistRsvp } from '../api/events/rsvp.js';

const ids={
  testEvent:'11111111-1111-4111-8111-111111111111', genuineEvent:'22222222-2222-4222-8222-222222222222',
  slot:'33333333-3333-4333-8333-333333333333', genuineSlot:'44444444-4444-4444-8444-444444444444'
};

async function fixture(){
  const db=new PGlite();
  await db.exec(`
    CREATE TABLE events(id uuid primary key,name text not null default 'Event',venue text not null default 'Venue',timezone text not null default 'UTC',ends_on date not null default current_date+2,status text not null default 'OPEN',active boolean not null default true,is_test boolean not null);
    CREATE TABLE event_slots(id uuid primary key,event_id uuid references events(id),starts_at timestamptz not null,ends_at timestamptz not null,capacity int not null,booked_count int not null default 0,active boolean not null default true);
    CREATE TABLE event_rsvps(id uuid primary key default gen_random_uuid(),event_id uuid references events(id),idempotency_key uuid not null,full_name text,phone text,email text,purpose text,budget text,property_type text,preferred_area text,purchase_timeline text,owns_uae_property text,payment_method text,preferred_event_date date,preferred_slot uuid,confirmed_slot uuid,additional_requirements text,consent boolean,status text,source text,utm_source text,utm_medium text,utm_campaign text,referrer text,is_test boolean not null,archived_at timestamptz,updated_at timestamptz default now(),unique(event_id,idempotency_key));
    CREATE TABLE leads(id uuid primary key default gen_random_uuid(),submission_id uuid unique,name text,phone text,email text,purpose text,budget text,property_type text,preferred_areas text,payment_method text,purchase_timeline text,owns_uae_property text,additional_requirements text,consent boolean,source text,landing_page text,referrer text,utm_source text,utm_medium text,utm_campaign text,qualification_status text,is_test boolean not null default false,status text default 'new',updated_at timestamptz default now());
    CREATE TABLE event_rsvp_activity(id uuid primary key default gen_random_uuid(),rsvp_id uuid references event_rsvps(id),activity_type text,details jsonb,created_by text default 'system',created_at timestamptz default now());
    INSERT INTO events(id,is_test) VALUES('${ids.testEvent}',true),('${ids.genuineEvent}',false);
    INSERT INTO event_slots(id,event_id,starts_at,ends_at,capacity) VALUES
      ('${ids.slot}','${ids.testEvent}',now()+interval '1 day',now()+interval '1 day 30 minutes',5),
      ('${ids.genuineSlot}','${ids.genuineEvent}',now()+interval '1 day',now()+interval '1 day 30 minutes',5);
  `);
  const sql=async(strings,...values)=>{let query=strings[0];for(let i=0;i<values.length;i++)query+=`$${i+1}${strings[i+1]}`;return (await db.query(query,values)).rows;};
  return {db,sql};
}

const payload=(index,key)=>({event_id:ids.testEvent,preferred_slot:ids.slot,preferred_event_date:new Date(Date.now()+86400000).toISOString().slice(0,10),idempotency_key:key,full_name:`Acceptance ${index}`,email:`acceptance-${index}@example.com`,source:'system-acceptance'});

test('complete TEST RSVP lifecycle is repeatable with exact capacity and no duplicates',async()=>{
  const {db,sql}=await fixture();
  for(let run=0;run<2;run++){
    await prepareTestFixture(sql);
    assert.equal((await db.query('SELECT booked_count FROM event_slots WHERE id=$1',[ids.slot])).rows[0].booked_count,0);
    const first=await persistRsvp(sql,payload(`${run}-1`,`${run+1}1111111-1111-4111-8111-111111111111`),`9715000000${run}1`);
    assert.equal(first.booked_count,1);assert.equal(first.is_test,true);
    const retry=await persistRsvp(sql,payload(`${run}-1`,`${run+1}1111111-1111-4111-8111-111111111111`),`9715000000${run}1`);
    assert.equal(retry.duplicate,true);assert.equal(retry.id,first.id);assert.equal(retry.booked_count,1);
    const second=await persistRsvp(sql,payload(`${run}-2`,`${run+3}1111111-1111-4111-8111-111111111111`),`9715000000${run}2`);
    assert.equal(second.booked_count,2);
    assert.equal((await db.query('SELECT count(*)::int count FROM leads WHERE submission_id IN ($1,$2)',[first.id,second.id])).rows[0].count,2);
    assert.equal((await db.query("SELECT count(*)::int count FROM event_rsvp_activity WHERE rsvp_id IN ($1,$2) AND activity_type='rsvp_submitted'",[first.id,second.id])).rows[0].count,2);
    await archiveTestRsvp(sql,first.id);assert.equal((await db.query('SELECT booked_count FROM event_slots WHERE id=$1',[ids.slot])).rows[0].booked_count,1);
    await archiveTestRsvp(sql,second.id);assert.equal((await db.query('SELECT booked_count FROM event_slots WHERE id=$1',[ids.slot])).rows[0].booked_count,0);
  }
  assert.equal((await db.query('SELECT count(*)::int count FROM event_rsvps WHERE archived_at IS NULL')).rows[0].count,0);
  assert.equal((await db.query('SELECT count(*)::int count FROM leads')).rows[0].count,4);
  assert.equal((await db.query('SELECT count(*)::int count FROM event_rsvp_activity')).rows[0].count,4);
  await db.close();
});

test('prepare recovers stale TEST state, repairs legacy lead isolation, and never mutates genuine records',async()=>{
  const {db,sql}=await fixture();
  const stale=await persistRsvp(sql,payload('stale','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),'971501234567');
  await db.query('UPDATE leads SET is_test=false WHERE submission_id=$1',[stale.id]);
  await db.query(`INSERT INTO event_rsvps(id,event_id,idempotency_key,full_name,phone,preferred_event_date,preferred_slot,confirmed_slot,consent,status,source,is_test) VALUES('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',$1,'cccccccc-cccc-4ccc-8ccc-cccccccccccc','Genuine','971509999999',current_date,$2,$2,true,'confirmed','website',false)`,[ids.genuineEvent,ids.genuineSlot]);
  await db.query('UPDATE event_slots SET booked_count=1 WHERE id=$1',[ids.genuineSlot]);
  const summary=(await prepareTestFixture(sql))[0];
  assert.equal(summary.archived_rsvps,1);assert.equal(summary.repaired_leads,1);
  assert.equal((await db.query('SELECT archived_at IS NOT NULL archived FROM event_rsvps WHERE id=$1',[stale.id])).rows[0].archived,true);
  assert.equal((await db.query('SELECT is_test FROM leads WHERE submission_id=$1',[stale.id])).rows[0].is_test,true);
  assert.deepEqual((await db.query('SELECT archived_at,full_name FROM event_rsvps WHERE id=$1',['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'])).rows[0],{archived_at:null,full_name:'Genuine'});
  assert.equal((await db.query('SELECT booked_count FROM event_slots WHERE id=$1',[ids.genuineSlot])).rows[0].booked_count,1);
  await prepareTestFixture(sql);assert.equal((await db.query('SELECT booked_count FROM event_slots WHERE id=$1',[ids.slot])).rows[0].booked_count,0);
  await db.close();
});
