const number=new Intl.NumberFormat('en-AE');
const money=new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED',maximumFractionDigits:0});
const value=(label,amount,format=number.format)=>amount===null||amount===undefined?'':`<article class="link-card"><p class="eyebrow">${label}</p><h3>${format(amount)}</h3></article>`;
const safe=value=>String(value).replace(/[&<>"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char]));
fetch('/generated/intelligence/dld/market-metrics.json').then(response=>{if(!response.ok)throw new Error('No snapshot');return response.json()}).then(data=>{
  const metric=data.metrics?.dubai;if(data.status!=='verified'||!metric)return;
  document.querySelector('[data-dld-metrics]').hidden=false;
  document.querySelector('.pulse-card h3').textContent='Verified DLD snapshot available';
  document.querySelector('.pulse-card h3 + p').textContent='All figures below are calculated from validated official transaction records.';
  document.querySelector('[data-dld-period]').textContent=`Coverage: ${data.period_start} – ${data.period_end}`;
  document.querySelector('[data-dld-updated]').textContent=`Finding Stories retrieval: ${data.updated.slice(0,10)}`;
  document.querySelector('[data-dld-snapshot]').innerHTML=[value('Transactions',metric.transaction_count),value('Transaction value',metric.total_transaction_value_aed,money.format),value('Median transaction',metric.median_transaction_value_aed,money.format),value('Median AED / sq ft',metric.median_aed_per_sqft,money.format),value('Off-plan records',metric.off_plan_count),value('Ready records',metric.ready_count)].filter(Boolean).join('');
  const areas=Object.entries(data.metrics.areas??{}).sort((a,b)=>b[1].transaction_count-a[1].transaction_count).slice(0,12);
  document.querySelector('[data-dld-area-cards]').innerHTML=areas.map(([slug,item])=>`<article class="link-card"><p class="eyebrow">VERIFIED AREA</p><h3>${safe(item.community_activity&&Object.keys(item.community_activity).find(name=>name!=='Unavailable')||slug)}</h3><p>${number.format(item.transaction_count)} transactions${item.total_transaction_value_aed!==null?` · ${money.format(item.total_transaction_value_aed)}`:''}${item.median_aed_per_sqft!==null?` · median ${money.format(item.median_aed_per_sqft)}/sq ft`:''}</p><p>${Object.entries(item.apartment_villa_activity??{}).map(([name,count])=>`${safe(name)}: ${number.format(count)}`).join(' · ')||'Property-type breakdown unavailable'}</p><a href="/areas-${encodeURIComponent(slug)}">Explore area</a></article>`).join('');
  document.querySelector('[data-dld-trend-cards]').innerHTML=Object.entries(metric.monthly_trend??{}).slice(-12).map(([month,item])=>`<article class="link-card"><p class="eyebrow">${safe(month)}</p><h3>${number.format(item.transaction_count)} transactions</h3>${item.transaction_value_aed===null?'':`<p>${money.format(item.transaction_value_aed)}</p>`}</article>`).join('');
}).catch(()=>{});
