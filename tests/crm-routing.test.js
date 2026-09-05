import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { applyCrmRoute, CRM_ROUTES, resolveCrmRoute } from '../public/crm-routing.js';

function element(dataset={}) {
  const attributes=new Set();
  return {dataset,classList:{hidden:false,toggle(name,on){if(name==='hidden')this.hidden=on;}},toggleAttribute(name,on){on?attributes.add(name):attributes.delete(name);},hasAttribute:name=>attributes.has(name)};
}
function shell() {
  const screens=CRM_ROUTES.map(route=>element({crmScreen:route}));
  const links=CRM_ROUTES.map(route=>element({crmRoute:route}));
  return {crm:{dataset:{},querySelectorAll(selector){return selector==='[data-crm-screen]'?screens:links;}},screens,links};
}

test('every CRM module has a unique canonical navigation target and screen',async()=>{
 const html=await readFile('admin.html','utf8');
 for(const route of CRM_ROUTES){
  assert.match(html,new RegExp(`href="#${route}" data-crm-route="${route}"`));
  assert.match(html,new RegExp(`data-crm-screen="[^"]*${route}`));
 }
 assert.equal((html.match(/id="stats"/g)||[]).length,1,'duplicate IDs regress deterministic routing');
});

test('direct hashes, aliases and browser-style changes render exactly one module',()=>{
 const {crm,screens,links}=shell();
 for(const route of CRM_ROUTES){
  assert.equal(applyCrmRoute(crm,`#${route}`,'SUPER_ADMIN'),route);
  assert.deepEqual(screens.map(x=>!x.classList.hidden).filter(Boolean).length,1);
  assert.equal(links.find(x=>x.dataset.crmRoute===route).hasAttribute('aria-current'),true);
  assert.equal(crm.dataset.activeRoute,route);
 }
 assert.equal(resolveCrmRoute('#property-opportunities'),'opportunities');
 assert.equal(resolveCrmRoute('#does-not-exist'),'dashboard');
 applyCrmRoute(crm,'#leads','SUPER_ADMIN'); // forward
 applyCrmRoute(crm,'#inventory','SUPER_ADMIN'); // forward
 applyCrmRoute(crm,'#leads','SUPER_ADMIN'); // browser back
 assert.equal(crm.dataset.activeRoute,'leads');
});

test('Projects content remains SUPER_ADMIN guarded while its active route stays truthful',()=>{
 const {crm,screens,links}=shell(); applyCrmRoute(crm,'#projects','ADMIN');
 assert.equal(screens.find(x=>x.dataset.crmScreen==='projects').classList.hidden,true);
 assert.equal(links.find(x=>x.dataset.crmRoute==='projects').hasAttribute('aria-current'),true);
});
