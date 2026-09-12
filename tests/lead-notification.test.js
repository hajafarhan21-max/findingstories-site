import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { formatAedBudget, formatUaeTime, leadNotification, sendLeadNotification } from '../api/_lib/lead-notification.js';
import { persistRespondAndSchedule } from '../api/_lib/workflow.js';

const saved = { id: '91d5698d-b109-4c4f-a2e8-752b61387a0f', lead_number: 100001, captured_at: '2026-09-12T15:12:00.000Z' };
const lead = { name: 'Real Buyer', phone: '+971501234567', email: 'buyer@example.com', property_type: 'Villa', bedrooms: '5', preferred_areas: 'Umm Al Fanain, Sharjah', budget: '1234567', purpose: 'Investment', purchase_timeline: 'Within 3 months', preferred_contact_method: 'WhatsApp', additional_requirements: 'Please call & confirm', source: 'google', medium: 'cpc', utm_source: 'google', utm_campaign: 'florence-launch' };
const project = { project_name: 'Azizi Florence', developer: 'Azizi Developments' };
const env = { GMAIL_SMTP_USER: 'findingstories@gmail.com', GMAIL_SMTP_APP_PASSWORD: 'test-app-password' };

function smtp() { const messages=[]; return { messages, createTransport: () => ({ sendMail: async message => { messages.push(message); } }) }; }

test('UAE time and AED values are formatted for sales', () => {
  assert.equal(formatUaeTime(saved.captured_at), '12 Sep 2026, 7:12 PM UAE Time');
  assert.equal(formatAedBudget('AED 1,234,567'), 'AED 1,234,567');
  assert.equal(formatAedBudget('1234567', true), 'AED 1.23M');
});

test('Florence notification has concise subject plus HTML and text bodies', () => {
  const result=leadNotification({saved,lead:{...lead,conversion_type:'site_visit'},project});
  assert.equal(result.subject, '🔥 New Lead | Azizi Florence | 5BR Villa | AED 1.23M');
  for (const body of [result.text,result.html]) for (const value of ['Lead #100001','12 Sep 2026, 7:12 PM UAE Time','Azizi Florence','Site Visit','AED 1,234,567']) assert.match(body,new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(result.html,/Please call &amp; confirm/);
  assert.match(result.text,/Internal reference: 91d5698d/);
});

test('homepage consultation falls back gracefully and empty placeholders are omitted', () => {
  const result=leadNotification({saved,lead:{name:'Homepage Buyer',phone:'+971501111111',source:'Direct',conversion_type:'consultation',email:'Not provided',budget:'',additional_requirements:null}});
  assert.equal(result.subject,'🔥 New Lead | Finding Stories | Consultation');
  for (const body of [result.text,result.html]) { assert.doesNotMatch(body,/Not provided|null|undefined/); assert.match(body,/Homepage Buyer/); assert.match(body,/Consultation/); }
});

test('Gmail SMTP receives both body formats without changing its configuration', async () => {
  const mock=smtp(); await sendLeadNotification({saved,lead,project,env,createTransport:mock.createTransport});
  assert.ok(mock.messages[0].text); assert.ok(mock.messages[0].html); assert.equal(mock.messages[0].from,env.GMAIL_SMTP_USER); assert.equal(mock.messages[0].to,'hajafarhan21@gmail.com');
});

test('duplicate suppression and SMTP remain strictly post-response', async () => {
  const events=[]; let scheduled;
  await persistRespondAndSchedule({lead,persist:async()=>saved,respond:()=>events.push('response'),schedule:p=>{events.push('scheduled');scheduled=p;},background:async()=>events.push('smtp')});
  assert.deepEqual(events.slice(0,2),['response','scheduled']); await scheduled; assert.deepEqual(events,['response','scheduled','smtp']);
  await persistRespondAndSchedule({lead,persist:async()=>({...saved,duplicate:true}),respond:()=>events.push('duplicate-response'),schedule:()=>events.push('bad-schedule'),background:async()=>events.push('bad-smtp')});
  assert.deepEqual(events.slice(-1),['duplicate-response']);
});

test('lead-number migration preserves UUIDs and assigns unique numbers under concurrency', async () => {
  const db=new PGlite();
  await db.exec('CREATE TABLE leads(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), captured_at TIMESTAMPTZ DEFAULT NOW()); INSERT INTO leads DEFAULT VALUES;');
  const original=(await db.query('SELECT id FROM leads')).rows[0].id;
  await db.exec(await readFile('database/migrations/020_lead_numbers.sql','utf8'));
  await Promise.all(Array.from({length:20},()=>db.query('INSERT INTO leads DEFAULT VALUES')));
  const rows=(await db.query('SELECT id,lead_number FROM leads ORDER BY lead_number')).rows;
  assert.equal(rows.length,21); assert.equal(new Set(rows.map(row=>Number(row.lead_number))).size,21); assert.equal(Number(rows[0].lead_number),100001); assert.ok(rows.some(row=>row.id===original));
  await db.close();
});
