const tracking = (() => {
  const query = new URLSearchParams(location.search);
  return { landing_page: location.href, referrer: document.referrer, utm_source: query.get('utm_source') || '', utm_medium: query.get('utm_medium') || '', utm_campaign: query.get('utm_campaign') || '', content_source: document.querySelector('meta[name="content-source"]')?.content || query.get('content') || '' };
})();

const fields = [
  ['name','What should I call you?','text',true], ['phone','What is your mobile or WhatsApp number?','tel',true],
  ['email','What email address can we use?','email',false], ['country_of_residence','Which country do you currently live in?','text',false],
  ['purpose','Is this for investment or your own use?','select',['Investment','End use','Not sure']],
  ['budget','What budget range are you considering? (Any currency is fine.)','text',false],
  ['property_type','Which property type interests you?','select',['Apartment','Townhouse','Villa','Branded residence','Not sure']],
  ['bedrooms','How many bedrooms would suit you?','text',false], ['preferred_areas','Any preferred UAE areas or communities?','text',false],
  ['payment_method','Would this be cash or mortgage?','select',['Cash','Mortgage','Not sure']],
  ['purchase_timeline','When would you ideally purchase?','select',['Immediately','Within 30 days','1–3 months','3–6 months','Just exploring']],
  ['owns_uae_property','Do you already own property in the UAE?','select',['Yes','No']],
  ['additional_requirements','Anything else Haja should consider when researching options for you?','textarea',false]
];
const state = {}; let step = 0;

function message(text, who='bot') { const item=document.createElement('div'); item.className=`ai-message ai-${who}`; item.textContent=text; document.querySelector('.ai-messages').append(item); item.scrollIntoView({behavior:'smooth'}); }
function ask() {
  const [key, question, type, config] = fields[step]; message(question); const area=document.querySelector('.ai-form'); area.replaceChildren();
  let input;
  if(type==='select'){ input=document.createElement('select'); input.innerHTML='<option value="">Select an option</option>'+config.map(v=>`<option>${v}</option>`).join(''); }
  else if(type==='textarea') input=document.createElement('textarea'); else { input=document.createElement('input'); input.type=type; }
  input.id='ai-answer'; input.autocomplete=key==='phone'?'tel':key; area.append(input);
  const actions=document.createElement('div'); actions.className='ai-actions';
  if(config!==true){ const skip=document.createElement('button'); skip.type='button'; skip.className='ai-skip'; skip.textContent='Skip'; skip.onclick=()=>advance(key,''); actions.append(skip); }
  const next=document.createElement('button'); next.type='button'; next.textContent=step===fields.length-1?'Continue':'Next'; next.onclick=()=>{if(config===true&&!input.value.trim()){input.focus();return;} advance(key,input.value.trim());}; actions.append(next); area.append(actions); input.addEventListener('keydown',e=>{if(e.key==='Enter'&&type!=='textarea')next.click();}); input.focus();
}
function advance(key,value){ state[key]=value; if(value) message(value,'user'); step++; step<fields.length?ask():consent(); }
function consent(){ message('Finally, may Finding Stories contact you about this enquiry?'); const area=document.querySelector('.ai-form'); area.innerHTML='<label class="ai-consent"><input id="ai-consent" type="checkbox"> I consent to Finding Stories storing my details and contacting me by phone, WhatsApp or email about this property enquiry.</label><div class="ai-actions"><button id="ai-send" type="button">Send requirement</button></div>'; document.querySelector('#ai-send').onclick=submitAdvisor; }
async function submitAdvisor(){ if(!document.querySelector('#ai-consent').checked){message('Please confirm consent before sending.');return;} const button=document.querySelector('#ai-send');button.disabled=true;button.textContent='Securely saving…'; try{const response=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...state,...tracking,source:'AI Property Advisor',consent:true,website:''})});const result=await response.json();if(!response.ok)throw new Error(result.error);document.querySelector('.ai-form').innerHTML='';message(result.message || 'Thank you. We will be in touch.');sessionStorage.setItem('fs_lead_sent','1');}catch(error){button.disabled=false;button.textContent='Try again';message(error.message || 'Something went wrong. Please try again.');}}

document.body.insertAdjacentHTML('beforeend','<button class="ai-launcher" aria-label="Open AI property advisor">✦ Ask our AI Advisor</button><aside class="ai-panel" aria-label="AI property advisor" aria-hidden="true"><div class="ai-head"><div><strong>Finding Stories AI</strong><small>Independent UAE property guidance</small></div><button class="ai-close" aria-label="Close">×</button></div><div class="ai-messages"></div><div class="ai-form"></div></aside>');
const panel=document.querySelector('.ai-panel'); document.querySelector('.ai-launcher').onclick=()=>{panel.classList.add('open');panel.setAttribute('aria-hidden','false');if(!step&&!document.querySelector('.ai-message')){message('Hello — I’ll ask one short question at a time so our team can research suitable options across developers.');ask();}}; document.querySelector('.ai-close').onclick=()=>{panel.classList.remove('open');panel.setAttribute('aria-hidden','true');};

document.querySelectorAll('form[action*="web3forms"]').forEach(form=>{
  form.insertAdjacentHTML('beforeend','<input class="hp-field" name="website" tabindex="-1" autocomplete="off"><label class="crm-consent"><input name="consent" type="checkbox" required> I consent to Finding Stories storing my details and contacting me by phone, WhatsApp or email about this enquiry.</label><div class="form-status" role="status"></div>');
  form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('[type="submit"]');const status=form.querySelector('.form-status');button.disabled=true;status.textContent='Securely submitting…';const fd=new FormData(form);const source=String(fd.get('source')||'Website form');const payload={name:String(fd.get('name')||''),phone:String(fd.get('phone')||''),email:String(fd.get('email')||''),purpose:String(fd.get('purpose')||fd.get('buyer_type')||''),budget:String(fd.get('budget')||''),property_type:String(fd.get('property_type')||''),purchase_timeline:String(fd.get('timeline')||''),additional_requirements:String(fd.get('message')||''),consent:fd.get('consent')==='on',website:String(fd.get('website')||''),source,...tracking};try{const crm=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const result=await crm.json();if(!crm.ok)throw new Error(result.error);fd.delete('website');fd.delete('consent');const delivery=await fetch(form.action,{method:'POST',body:fd});if(!delivery.ok)throw new Error('Unable to deliver the notification. Please use WhatsApp.');form.reset();status.textContent='Thank you. Your requirement has been received.';}catch(error){fd.delete('website');fd.delete('consent');try{const delivery=await fetch(form.action,{method:'POST',body:fd});if(delivery.ok){form.reset();status.textContent='Thank you. Your requirement was delivered; CRM sync will be retried by our team.';}else throw new Error();}catch{status.textContent=error.message||'Unable to submit. Please use WhatsApp.';}}finally{button.disabled=false;}});
});
