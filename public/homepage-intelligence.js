const number=new Intl.NumberFormat('en-AE');
const money=new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED',maximumFractionDigits:0});
fetch('/generated/intelligence/dld/market-metrics.json').then(response=>{if(!response.ok)throw new Error('No manual snapshot');return response.json()}).then(data=>{
  const metric=data.status==='verified'&&data.metrics?.dubai;
  if(!metric)return;
  const card=document.querySelector('[data-home-pulse]');
  card.querySelector('h3').textContent=`${number.format(metric.transaction_count)} official transactions`;
  card.querySelector('h3 + p').textContent=metric.total_transaction_value_aed===null?'Validated records from the manually supplied official DLD dataset.':`${money.format(metric.total_transaction_value_aed)} in recorded transaction value.`;
  card.querySelector('[data-home-source]').innerHTML=`<strong>Dubai Land Department · manual official dataset</strong><span>Data period: ${data.period_start} – ${data.period_end}</span><span>Imported: ${String(data.updated).slice(0,10)}</span>`;
}).catch(()=>{});
