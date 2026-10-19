import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page=readFileSync(new URL('../public/damac-lagoons-sorento.html',import.meta.url),'utf8');
const routes=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));

test('Sorento organic landing route is configured',()=>{
  assert.ok(routes.rewrites.some(route=>route.source==='/damac-lagoons-sorento'&&route.destination==='/damac-lagoons-sorento.html'));
});

test('Sorento enquiry captures qualification fields and affirmative consent',()=>{
  for(const field of ['name','email','phone','budget','bedrooms','view','timeframe','consent'])assert.match(page,new RegExp('name="'+field+'"|id="fs-'+field+'"'));
  assert.match(page,/required/);
  assert.match(page,/may contact me about this enquiry/);
});

test('Sorento enquiry uses existing lead capture API and keeps response private',()=>{
  assert.match(page,/fetch\('\/api\/leads'/);
  assert.match(page,/acquisition_project:'DAMAC Lagoons Sorento'/);
  assert.match(page,/page_type:'project-landing'/);
  assert.match(page,/submission_id:crypto\.randomUUID\(\)/);
  assert.doesNotMatch(page,/console\.log\(payload|alert\(JSON\.stringify/);
  assert.match(page,/not be displayed publicly/i);
});

test('Sorento landing page avoids unverified promises and clarifies that enquiry is not an EOI',()=>{
  assert.match(page,/Availability, prices, payment plans, launch\/EOI status/);
  assert.match(page,/not an Expression of Interest/);
});
