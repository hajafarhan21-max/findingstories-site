import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createAdminLogin } from '../public/admin-login.js';
import { activateBinghattiInventory, binghattiActivationStatus } from '../api/_lib/binghatti-import.js';
import { inventoryFailureCategory } from '../api/_lib/activation-diagnostics.js';
import loginHandler from '../api/admin/login.js';

function loginFixture(fetchFn, onAuthenticated = () => {}) {
  const attrs = new Set();
  const button = { textContent:'Sign in', disabled:false, setAttribute:key=>attrs.add(key), removeAttribute:key=>attrs.delete(key) };
  const form = { querySelector:()=>button, reset(){ this.resetCalled = true; } };
  const errorBox = { textContent:'' };
  return { form, button, attrs, errorBox, submit:createAdminLogin({ form, errorBox, fetchFn, onAuthenticated, timeoutMs:100 }) };
}

test('one click creates one login request, disables duplicate clicks, and reveals the shell before secondary work', async () => {
  const OriginalFormData = globalThis.FormData;
  const OriginalWindow = globalThis.window;
  globalThis.window = { AbortController:globalThis.AbortController };
  globalThis.FormData = class { get(){ return 'valid-password-value'; } };
  let resolveRequest; let requests = 0; let authenticated = 0;
  const fixture = loginFixture(() => { requests++; return new Promise(resolve => { resolveRequest = resolve; }); }, () => { authenticated++; });
  const event = { preventDefault(){} };
  const first = fixture.submit(event); const duplicate = fixture.submit(event);
  assert.equal(fixture.button.disabled, true); assert.equal(fixture.button.textContent, 'Signing in…'); assert.equal(requests, 1);
  resolveRequest({ ok:true, json:async()=>({ ok:true }) });
  assert.equal(await first, true); assert.equal(await duplicate, false); assert.equal(authenticated, 1); assert.equal(fixture.button.disabled, false);
  globalThis.FormData = OriginalFormData;
  globalThis.window = OriginalWindow;
});

test('successful authentication creates the existing secure session cookie', () => {
  process.env.ADMIN_PASSWORD = 'valid-password-value'; process.env.SESSION_SECRET = 'session-secret-at-least-thirty-two-characters';
  const headers = {}; const req = { method:'POST', headers:{}, body:{ password:process.env.ADMIN_PASSWORD }, socket:{} };
  const res = { setHeader:(key,value)=>{ headers[key]=value; }, end(){} };
  loginHandler(req,res);
  assert.equal(res.statusCode, 200); assert.match(headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Strict/); assert.match(headers['Server-Timing'], /^auth;dur=/);
});

function inventorySql() {
  const rows = new Map(); let marked = false; const statements = [];
  const sql = async (parts, ...values) => {
    const query = parts.join('?').replace(/\s+/g, ' ').trim(); statements.push(query);
    if (query.startsWith('SELECT completed_at')) return marked ? [{ completed_at:new Date() }] : [];
    if (query.startsWith('SELECT unit,')) return [...rows.values()].sort((a,b)=>a.unit.localeCompare(b.unit));
    if (query.startsWith('INSERT INTO property_inventory')) {
      const [unit,developer,project,,area,property_type,bedrooms] = values;
      rows.set(unit,{ unit,developer,project,area,property_type,bedrooms,status:'active',data_quality:'verified',is_test:false }); return [];
    }
    if (query.startsWith('INSERT INTO production_activations')) { marked = true; return []; }
    return [];
  };
  return { sql, rows, statements, marked:()=>marked };
}

test('activation verifies only exact active, verified, non-test Amberhall units and is idempotent', async () => {
  const db = inventorySql(); const result = await activateBinghattiInventory(db.sql);
  assert.equal(result.verified, true); assert.equal(result.activated, true); assert.deepEqual([...db.rows.keys()], ['BAMH-1545','BAMH-634']); assert.equal(db.marked(), true);
  for (const unit of ['BAMH-1545','BAMH-634']) assert.deepEqual(Object.fromEntries(['status','data_quality','is_test'].map(k=>[k,db.rows.get(unit)[k]])), { status:'active',data_quality:'verified',is_test:false });
  const again = await activateBinghattiInventory(db.sql); assert.equal(again.already_activated, true);
  assert.ok(db.statements.some(query => query.includes('ON CONFLICT (unit) WHERE unit IS NOT NULL')));
});

test('failed verification never writes the permanent activation marker', async () => {
  const db = inventorySql(); const original = db.sql;
  db.sql = async (parts,...values) => parts.join('?').includes('INSERT INTO property_inventory') ? [] : original(parts,...values);
  await assert.rejects(activateBinghattiInventory(db.sql), /verification failed/); assert.equal(db.marked(), false);
});

test('database resolution and safe diagnostics remain production-consistent', async () => {
  const source = await readFile('api/_lib/inventory-activation-route.js','utf8');
  assert.match(source, /const sql = database\(\)/); assert.doesNotMatch(source, /PRODUCTION_DATABASE_URL|DATABASE_URL/);
  assert.equal(inventoryFailureCategory({ code:'42P10' }), 'index_mismatch'); assert.equal(inventoryFailureCategory({ code:'42501' }), 'database_permission');
  const importer = await readFile('api/_lib/binghatti-import.js','utf8'); assert.match(importer, /ON CONFLICT \(unit\) WHERE unit IS NOT NULL/);
  const leads = await readFile('api/admin/leads.js','utf8'); assert.doesNotMatch(leads, /ensureSchema/);
  const statusDb = inventorySql(); assert.equal((await binghattiActivationStatus(statusDb.sql)).activated, false);
});
