import { buildProjectLeadPayload } from './project-lead-payload.js';

const context=window.__AZIZI_FUNNEL__;
const form=document.querySelector('#azizi-lead-form');
const params=new URLSearchParams(location.search);
const clickEvents=new Set(['cta_click','whatsapp_click','brochure_request','consultation_request','site_visit_request']);
const firstKey=`fs_first_touch:${context.campaign_id}`;
const visitorKey='fs_acquisition_visitor';
let visitor=window.localStorage.getItem(visitorKey);
if(!visitor){visitor=crypto.randomUUID();window.localStorage.setItem(visitorKey,visitor);}
function currentTouch(){const utm_source=params.get('utm_source')||'';return {source:utm_source?'campaign':document.referrer?'referral':'direct',medium:params.get('utm_medium')||(utm_source?'unknown':'none'),landing_page:context.page_url,referrer:document.referrer,utm_source,utm_medium:params.get('utm_medium')||'',utm_campaign:params.get('utm_campaign')||'',utm_content:params.get('utm_content')||'',utm_term:params.get('utm_term')||''};}
const latest=currentTouch();
if(!window.localStorage.getItem(firstKey))window.localStorage.setItem(firstKey,JSON.stringify(latest));
let first=latest;try{first=JSON.parse(window.localStorage.getItem(firstKey))||latest;}catch{window.localStorage.setItem(firstKey,JSON.stringify(latest));}
async function analytics(event_type){try{await fetch('/api/acquisition?route=events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event_key:crypto.randomUUID(),visitor_id:visitor,event_type,page_url:context.page_url,page_type:'project',area:context.area,project:context.project,developer:context.developer,source:latest.source,referrer:latest.referrer,utm_source:latest.utm_source,utm_medium:latest.utm_medium,utm_campaign:latest.utm_campaign}),keepalive:true});}catch{/* Analytics failure must never block an enquiry. */}}
analytics('page_view');
document.addEventListener('click',event=>{const target=event.target.closest('[data-analytics],[data-intent],[data-unit]');if(!target)return;const eventType=target.dataset.analytics;if(clickEvents.has(eventType))analytics(eventType);const intent=target.dataset.intent;if(intent)form.elements.enquiry_type.value=intent;if(target.dataset.unit)form.elements.property_type.value=target.dataset.unit;});
let started=false;form.addEventListener('input',()=>{if(!started){started=true;analytics('enquiry_started');}},{once:true});
for(const button of form.querySelectorAll('[data-form-intent]'))button.addEventListener('click',()=>{const intent=button.dataset.formIntent;form.elements.enquiry_type.value=intent;analytics(intent);form.requestSubmit();});
form.addEventListener('submit',async event=>{event.preventDefault();const status=form.querySelector('#form-status');const values=Object.fromEntries(new FormData(form));const submissionKey=`fs_submission:${context.campaign_id}`;let submission_id=sessionStorage.getItem(submissionKey);if(!submission_id){submission_id=crypto.randomUUID();sessionStorage.setItem(submissionKey,submission_id);}const intent=values.enquiry_type||'register_interest';const payload=buildProjectLeadPayload({values,context,latest,first,submissionId:submission_id});status.textContent='Securely submitting your enquiry…';for(const control of form.elements)control.disabled=true;try{const response=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();status.textContent=response.ok?data.message:data.error||'Please check your details and try again.';if(response.ok){analytics('enquiry_submitted');if(intent==='brochure_request')analytics('brochure_request');if(!data.duplicate){form.reset();sessionStorage.removeItem(submissionKey);}}}catch{status.textContent='We could not submit your enquiry. Please try again.';}finally{for(const control of form.elements)control.disabled=false;}});

const mapViewer=document.querySelector('[data-map-viewer]');
if(mapViewer){
  const opener=document.querySelector('[data-map-open]');
  const stage=mapViewer.querySelector('[data-map-stage]');
  const image=stage.querySelector('img');
  const pointers=new Map();
  let scale=1;
  let x=0;
  let y=0;
  let dragOrigin=null;
  let pinchOrigin=null;
  let tapStart=null;
  let lastTap=0;
  const render=()=>{image.style.transform=`translate3d(${x}px,${y}px,0) scale(${scale})`;};
  const fit=()=>{scale=1;x=0;y=0;render();};
  const zoom=(next,clientX=window.innerWidth/2,clientY=window.innerHeight/2)=>{
    const bounded=Math.min(5,Math.max(1,next));
    const ratio=bounded/scale;
    const bounds=stage.getBoundingClientRect();
    const px=clientX-(bounds.left+bounds.width/2);
    const py=clientY-(bounds.top+bounds.height/2);
    x=px-(px-x)*ratio;
    y=py-(py-y)*ratio;
    scale=bounded;
    if(scale===1){x=0;y=0;}
    render();
  };
  const close=()=>{
    mapViewer.classList.remove('is-open');
    mapViewer.setAttribute('aria-hidden','true');
    document.body.classList.remove('map-viewer-open');
    pointers.clear();fit();opener.focus();
  };
  const open=()=>{
    mapViewer.classList.add('is-open');
    mapViewer.setAttribute('aria-hidden','false');
    document.body.classList.add('map-viewer-open');
    fit();mapViewer.querySelector('[data-map-close]').focus();
  };
  opener.addEventListener('click',open);
  mapViewer.querySelector('[data-map-close]').addEventListener('click',close);
  mapViewer.querySelector('[data-map-fit]').addEventListener('click',fit);
  mapViewer.querySelector('[data-map-zoom-in]').addEventListener('click',()=>zoom(scale+.5));
  mapViewer.querySelector('[data-map-zoom-out]').addEventListener('click',()=>zoom(scale-.5));
  stage.addEventListener('wheel',event=>{event.preventDefault();zoom(scale*Math.exp(-event.deltaY*.002),event.clientX,event.clientY);},{passive:false});
  stage.addEventListener('dblclick',event=>{event.preventDefault();zoom(scale>=5?1:Math.min(5,scale*2),event.clientX,event.clientY);});
  stage.addEventListener('pointerdown',event=>{
    stage.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===1){dragOrigin={clientX:event.clientX,clientY:event.clientY,x,y};tapStart={x:event.clientX,y:event.clientY,time:Date.now(),type:event.pointerType};}
    if(pointers.size===2){const [a,b]=[...pointers.values()];pinchOrigin={distance:Math.hypot(a.x-b.x,a.y-b.y),scale,x,y,centerX:(a.x+b.x)/2,centerY:(a.y+b.y)/2};}
    stage.classList.add('is-panning');
  });
  stage.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId))return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===2&&pinchOrigin){
      const [a,b]=[...pointers.values()];
      const centerX=(a.x+b.x)/2,centerY=(a.y+b.y)/2;
      const bounds=stage.getBoundingClientRect();
      const originX=pinchOrigin.centerX-(bounds.left+bounds.width/2);
      const originY=pinchOrigin.centerY-(bounds.top+bounds.height/2);
      const pointX=centerX-(bounds.left+bounds.width/2);
      const pointY=centerY-(bounds.top+bounds.height/2);
      scale=Math.min(5,Math.max(1,pinchOrigin.scale*Math.hypot(a.x-b.x,a.y-b.y)/pinchOrigin.distance));
      const ratio=scale/pinchOrigin.scale;
      x=pointX-(originX-pinchOrigin.x)*ratio;y=pointY-(originY-pinchOrigin.y)*ratio;
      if(scale===1){x=0;y=0;}render();
    }else if(pointers.size===1&&dragOrigin&&scale>1){x=dragOrigin.x+event.clientX-dragOrigin.clientX;y=dragOrigin.y+event.clientY-dragOrigin.clientY;render();}
  });
  const release=event=>{const doubleTap=tapStart&&tapStart.type==='touch'&&Date.now()-tapStart.time<300&&Math.hypot(event.clientX-tapStart.x,event.clientY-tapStart.y)<12&&Date.now()-lastTap<350;pointers.delete(event.pointerId);dragOrigin=null;pinchOrigin=null;if(doubleTap){zoom(scale>=5?1:Math.min(5,scale*2),event.clientX,event.clientY);lastTap=0;}else if(tapStart?.type==='touch')lastTap=Date.now();tapStart=null;if(pointers.size===1){const point=[...pointers.values()][0];dragOrigin={clientX:point.x,clientY:point.y,x,y};}if(!pointers.size)stage.classList.remove('is-panning');};
  stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',release);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&mapViewer.classList.contains('is-open'))close();});
}
