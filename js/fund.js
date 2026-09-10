(async()=>{
  const A=App,E=id=>document.getElementById(id),P=new URLSearchParams(location.search),id=P.get('id');
  if(!id){E('err').innerHTML='<div class="error">Hiányzik a fund id.</div>';return}
  const short={ACWI_IMI:'ACWI IMI',SP500:'S&P 500',STOXX600:'STOXX 600',BUX:'BUX'};
  const S={code:P.get('benchmark')||'ACWI_IMI',h:+P.get('h')||3,wr:P.get('wr')||'5y',customFrom:P.get('from')||'',customTo:P.get('to')||'',f:null,m:null,status:null,b:[],sum:[],paths:[],fundRoll:[],relRoll:[],common:[],inflationSum:[],cpi:[],inflationLoaded:false,inflationError:false,dailyCache:{},charts:{}};
  if(!['ytd','1y','3y','5y','max','custom'].includes(S.wr))S.wr='5y';
  const bench=()=>S.b.find(x=>x.benchmark_code===S.code);
  const summary=(code,h)=>{const b=S.b.find(x=>x.benchmark_code===code);return S.sum.find(x=>String(x.benchmark_id)===String(b?.benchmark_id)&&+x.horizon_years===+h)};
  const path=code=>{const b=S.b.find(x=>x.benchmark_code===code);return S.paths.find(x=>String(x.benchmark_id)===String(b?.benchmark_id))};
  const inflationSummary=h=>S.inflationSum.find(x=>+x.horizon_years===+h);
  const destroy=k=>S.charts[k]?.destroy();

  function tabs(){E('benchTabs').innerHTML=S.b.map(x=>`<button data-c="${x.benchmark_code}" class="${x.benchmark_code===S.code?'active':''}" title="${A.esc(x.name)}">${short[x.benchmark_code]||A.esc(x.benchmark_code)}</button>`).join('');document.querySelectorAll('#hTabs button').forEach(x=>x.classList.toggle('active',+x.dataset.h===S.h))}
  function excess(value,compact=false){
    if(value===null||value===undefined||!Number.isFinite(+value))return '—';
    const n=+value*100,sign=n>0?'+':'';
    return `${sign}${n.toLocaleString('hu-HU',{minimumFractionDigits:1,maximumFractionDigits:1})} ${compact?'pp':'százalékpont'}`;
  }
  function metric(label,value,sub,type='pct'){
    const fmt=['pct','neutralPct'].includes(type)?A.pct(value):type==='excess'?excess(value):type==='days'?A.days(value):type==='huf'?A.huf(value):type==='num'?A.num(value):A.esc(value??'—');
    return `<div class="metric"><span>${label}</span><strong class="${['pct','excess'].includes(type)?A.cls(value):''}">${fmt}</strong><small>${sub||''}</small></div>`;
  }
  function riskText(v){
    const z=String(v??'').trim();
    if(!z)return null;
    return /^[1-7]$/.test(z)?`Kockázat: ${z}/7`:`Kockázat: ${z}`;
  }
  function signedHuf(v){
    if(v===null||v===undefined||!Number.isFinite(+v))return '—';
    return `${+v>0?'+':''}${A.huf(v)}`;
  }
  function durationLabel(start,end){
    if(!start||!end)return '—';
    const a=new Date(`${start}T12:00:00Z`),b=new Date(`${end}T12:00:00Z`);
    if(Number.isNaN(+a)||Number.isNaN(+b)||b<a)return '—';
    let months=(b.getUTCFullYear()-a.getUTCFullYear())*12+(b.getUTCMonth()-a.getUTCMonth());
    if(b.getUTCDate()<a.getUTCDate())months=Math.max(0,months-1);
    const years=Math.floor(months/12),rem=months%12,parts=[];
    if(years)parts.push(`${years} év`);if(rem)parts.push(`${rem} hó`);
    if(!parts.length){const days=Math.max(0,Math.round((b-a)/86400000));parts.push(`${days} nap`)}
    return parts.join(' ');
  }
  function heading(){
    const f=S.f,m=S.m,st=S.status?.screen_status||'active',meta=[f.series_name,f.isin,f.manager,f.category,f.currency?`${f.currency} → HUF`:null,riskText(f.risk_class)].filter(Boolean);
    E('heading').innerHTML=`<div class="eyebrow">ALAP ADATLAP</div><h1>${A.esc(f.fund_name||f.series_name||f.isin)}</h1><div class="meta-line">${meta.map(x=>`<span>${A.esc(x)}</span>`).join('')}<span class="${A.statusClass(st)}">${A.statusLabel(st)}</span></div>`;
    const returns=[['1 éves hozam',m?.return_1y],['3 éves évesített hozam',m?.cagr_3y],['5 éves évesített hozam',m?.cagr_5y],['10 éves évesített hozam',m?.cagr_10y]];
    E('returns').innerHTML=returns.map(x=>`<div class="kpi"><span>${x[0]}</span><strong class="${A.cls(x[1])}">${A.pct(x[1])}</strong><small>HUF-ban</small></div>`).join('');
    E('liveNote').textContent=`Legutóbbi alapadat: ${A.date(m?.obs_date||S.status?.last_obs_date)} · az összehasonlító statisztikák havonta frissülnek`;
  }
  function cards(){
    const s=summary(S.code,S.h),p=path(S.code),label=short[S.code]||S.code;
    E('relTitle').textContent=`${label} · ${S.h} éves tartási idő · HUF-ban`;
    E('relCards').innerHTML=
      metric('Felülteljesítési arány',s?.beat_rate,`${s?.observations??0} vizsgált ${S.h} éves időszak`)+
      metric('Átlagos éves többlethozam',s?.mean_excess_return,'az évesített hozamok különbsége','excess')+
      metric('Medián éves többlethozam',s?.median_excess_return,'az évesített hozamok különbsége','excess')+
      metric('Jelenlegi időszak többlethozama',s?.current_excess_return,`aktuális ${S.h} éves időszak · ${A.date(s?.current_end_date)} végdátummal`,'excess')+
      metric('Legnagyobb relatív lemaradás',p?.max_passive_regret,`relatív vagyonpálya korábbi csúcsától · ${A.date(p?.max_passive_regret_date)}`)+
      metric('Leghosszabb relatív lemaradási idő',p?.longest_relative_underperformance_days,'korábbi relatív csúcs alatt','days');
    E('risk').innerHTML=
      metric('Évesített volatilitás',S.m?.annualized_volatility_1y,'utolsó 1 év')+
      metric('Maximális visszaesés',S.m?.maximum_drawdown,'teljes napi HUF-történet')+
      metric('Leghosszabb idő új csúcs nélkül',S.m?.maximum_drawdown_duration_days,'teljes napi HUF-történet','days')+
      metric('Sharpe-mutató',S.m?.sharpe_1y_zero_rf,'utolsó 1 év · 0% kockázatmentes hozam','num')+
      metric('Sortino-mutató',S.m?.sortino_1y_zero_mar,'utolsó 1 év · 0% minimum hozam','num')+
      metric('Aktuális AUM',S.m?.net_assets_huf,'HUF','huf');
  }
  function monthKey(iso){return `${String(iso||'').slice(0,7)}-01`}
  function monthLabel(iso){
    if(!iso)return '—';
    const d=new Date(`${String(iso).slice(0,10)}T12:00:00Z`);
    return Number.isNaN(+d)?'—':d.toLocaleDateString('hu-HU',{year:'numeric',month:'long',timeZone:'UTC'});
  }
  function renderInflation(){
    const box=E('inflationCards'),note=E('inflationNote'),subtitle=E('inflationSubtitle');
    if(!S.inflationLoaded){subtitle.textContent='Eurostat HICP adatok betöltése…';return}
    const z=inflationSummary(S.h);
    if(!z){
      subtitle.textContent=`Eurostat magyar HICP · az alap saját története`;
      box.innerHTML=`<div class="empty inflation-empty">${S.inflationError?'Az inflációs adatforrás jelenleg nem érhető el.':'Ehhez az alaphoz és tartási időhöz még nincs elegendő HICP-történet.'}</div>`;
      note.textContent=S.inflationError?'Az inflációs modul átmeneti hibája nem érinti az alap és a passzív alternatívák többi elemzését.':'A mutató az alap saját történetéből készül, attól a ponttól, ahol a teljes vizsgált időszakhoz Eurostat HICP-adat is rendelkezésre áll.';
      return;
    }
    subtitle.textContent=`Eurostat magyar HICP · az alap saját története · ${S.h} éves, havi léptetésű időszakok`;
    box.innerHTML=
      metric('Inflációt megverő időszakok aránya',z.inflation_beat_rate,`${Number(z.observations||0).toLocaleString('hu-HU')} vizsgált ${S.h} éves időszak`,'neutralPct')+
      metric('Medián éves reálhozam',z.median_real_return,'nominális hozam vásárlóerő-változással korrigálva')+
      metric('Jelenlegi időszak évesített reálhozama',z.current_real_return,`aktuális ${S.h} éves időszak · ${monthLabel(z.current_end_month)} végponttal`)+
      metric('Jelenlegi időszak évesített inflációja',z.current_inflation_return,`${S.h} éves HICP-változás évesítve`,'neutralPct');
    const first=z.first_end_month?monthLabel(z.first_end_month):'—',last=z.last_end_month?monthLabel(z.last_end_month):'—';
    note.textContent=`Reálhozam-megfigyelések végpontjai: ${first} – ${last}. Az elemzés az alap saját történetét használja; passzív alternatíva váltásakor nem változik. A HICP havi adat, napi inflációs értékeket nem interpolálunk.`;
  }
  async function loadInflation(){
    try{
      const [sums,cpi]=await Promise.all([
        A.all('fund_inflation_summary',{filters:{fund_id:`eq.${id}`},order:'horizon_years.asc'}),
        A.all('inflation_monthly',{select:'period_month,price_index,mom_index,yoy_index,source',order:'period_month.asc'})
      ]);
      S.inflationSum=sums;S.cpi=cpi;
    }catch(e){console.warn('Inflation module unavailable',e);S.inflationError=true;S.inflationSum=[];S.cpi=[]}
    S.inflationLoaded=true;renderInflation();if(S.common.length)renderWealthChart();
  }
  function purchasingPowerInfo(rebased){
    if(!S.cpi.length||rebased.length<2)return null;
    const startMonth=monthKey(rebased[0].date),endMonth=monthKey(rebased.at(-1).date);
    const start=S.cpi.find(x=>x.period_month===startMonth&&Number.isFinite(+x.price_index)&&+x.price_index>0);
    if(!start)return null;
    const months=new Set(rebased.map(x=>monthKey(x.date)));
    const eligible=S.cpi.filter(x=>x.period_month>startMonth&&x.period_month<=endMonth&&months.has(x.period_month)&&Number.isFinite(+x.price_index)&&+x.price_index>0);
    const end=eligible.at(-1);if(!end)return null;
    let idx=-1;for(let i=rebased.length-1;i>=0;i--){if(monthKey(rebased[i].date)===end.period_month){idx=i;break}}
    if(idx<0)return null;
    const required=1e6*(+end.price_index)/(+start.price_index),fundValue=rebased[idx].fund,real=fundValue/required-1;
    return {required,fundValue,real,cpiEnd:end.period_month,fundEnd:rebased[idx].date,selectedEndMonth:endMonth};
  }

  function matrix(){
    const rows=[];for(const b of S.b)for(const h of[1,3,5]){const s=summary(b.benchmark_code,h),p=path(b.benchmark_code);rows.push(`<tr><td><b>${short[b.benchmark_code]||A.esc(b.benchmark_code)}</b><div class="sub">${A.esc(b.isin)}</div></td><td>${h} év</td><td class="num">${A.pct(s?.beat_rate)}</td><td class="num ${A.cls(s?.mean_excess_return)}">${excess(s?.mean_excess_return,true)}</td><td class="num ${A.cls(s?.median_excess_return)}">${excess(s?.median_excess_return,true)}</td><td class="num ${A.cls(s?.current_excess_return)}">${excess(s?.current_excess_return,true)}</td><td class="num">${s?.observations??'—'}</td><td class="num ${A.cls(p?.max_passive_regret)}">${A.pct(p?.max_passive_regret)}</td><td class="num">${A.days(p?.longest_relative_underperformance_days)}</td></tr>`)}E('matrix').innerHTML=rows.join('');
  }
  function meta(){
    const f=S.f,st=S.status,rc=riskText(f.risk_class)?.replace('Kockázat: ','')||'—',items=[['ISIN',f.isin],['Alapkezelő',f.manager],['BAMOSZ-kategória',f.category],['Eredeti deviza',f.currency],['Indulás',f.launch_date],['Földrajzi kitettség',f.geographic_exposure],['Devizális kitettség',f.currency_exposure],['Kockázati osztály',rc],['Forgalmazási mód',f.distribution_mode],['Jogi forma',f.legal_form],['Letétkezelő',f.custodian],['Aktivitási arány (180 nap)',st?.active_flow_ratio_180==null?'—':A.pct(st.active_flow_ratio_180)]];
    E('meta').innerHTML=`<div class="head"><h2>Alapadatok</h2>${f.source_url?`<a class="textlink" href="${A.esc(f.source_url)}" target="_blank" rel="noopener">BAMOSZ-forrás ↗</a>`:''}</div><div class="metagrid">${items.map(x=>`<div><span>${x[0]}</span><strong>${A.esc(x[1]||'—')}</strong></div>`).join('')}</div>`;
  }
  function niceStep(raw){
    if(!Number.isFinite(raw)||raw<=0)return 1;
    const p=10**Math.floor(Math.log10(raw)),f=raw/p;
    const n=f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10;
    return n*p;
  }
  function binNumber(v,step){
    const clean=Math.abs(v)<step/1000?0:v;
    const decimals=step<1?Math.min(2,Math.ceil(-Math.log10(step))):Number.isInteger(step)?0:1;
    return clean.toLocaleString('hu-HU',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).replace('-', '−');
  }
  function histogram(vals,targetBins=12,unit='pct'){
    const z=vals.filter(Number.isFinite).map(v=>v*100);
    if(!z.length)return {labels:[],counts:[]};
    let lo=Math.min(...z),hi=Math.max(...z),span=hi-lo;
    let step=niceStep(span>0?span/targetBins:Math.max(Math.abs(lo)*.1,1));
    let start=Math.floor(lo/step)*step,end=Math.ceil(hi/step)*step;
    if(end<=start)end=start+step;
    let bins=Math.max(1,Math.round((end-start)/step));
    while(bins>18){step=niceStep(step*1.5);start=Math.floor(lo/step)*step;end=Math.ceil(hi/step)*step;if(end<=start)end=start+step;bins=Math.max(1,Math.round((end-start)/step));}
    const counts=Array(bins).fill(0),labels=[];
    z.forEach(v=>{const i=Math.max(0,Math.min(bins-1,Math.floor((v-start)/step)));counts[i]++});
    for(let i=0;i<bins;i++){
      const a=start+i*step,b=a+step,suffix=unit==='pct'?'%':'';
      labels.push(`${binNumber(a,step)}–${binNumber(b,step)}${suffix}`);
    }
    return {labels,counts};
  }
  async function loadRolling(){
    const b=bench();const [fr,rr]=await Promise.all([
      A.page('fund_rolling_series',{filters:{fund_id:`eq.${id}`,horizon_years:`eq.${S.h}`},limit:1}),
      A.page('relative_rolling_series',{filters:{fund_id:`eq.${id}`,benchmark_id:`eq.${b.benchmark_id}`,horizon_years:`eq.${S.h}`},limit:1})
    ]);
    S.fundRoll=A.safePoints(fr[0]?.points);S.relRoll=A.safePoints(rr[0]?.points);
  }
  async function fxRows(currencies,start,end){
    const unique=[...new Set(currencies.map(x=>String(x||'HUF').toUpperCase()).filter(x=>x!=='HUF'))];
    const chunks=await Promise.all(unique.map(c=>A.all('fx_daily',{select:'currency,obs_date,huf_per_unit',filters:{currency:`eq.${c}`,obs_date:`gte.${A.addDays(start,-14)}`},order:'obs_date.asc'})));
    return chunks.flat().filter(x=>x.obs_date<=end);
  }
  async function rawPaths(){
    if(S.dailyCache[S.code])return {common:S.dailyCache[S.code]};
    const b=bench();
    const fundRows=await A.all('fund_daily',{select:'obs_date,unit_price_local,payout_local',filters:{fund_id:`eq.${id}`},order:'obs_date.asc'});
    if(!fundRows.length)return {common:[]};
    let benchRows=[],benchCurrency=b.currency||'HUF',benchPerRow=true;
    if(b.source_kind==='bamosz_fund'&&b.bamosz_isin){
      const bf=await A.page('funds',{select:'fund_id,currency',filters:{isin:`eq.${b.bamosz_isin}`},limit:1});
      if(bf[0]){benchRows=await A.all('fund_daily',{select:'obs_date,unit_price_local,payout_local',filters:{fund_id:`eq.${bf[0].fund_id}`},order:'obs_date.asc'});benchCurrency=bf[0].currency||'HUF';benchPerRow=false}
    }else{
      benchRows=await A.all('benchmark_daily',{select:'obs_date,adjusted_close_local,currency',filters:{benchmark_id:`eq.${b.benchmark_id}`},order:'obs_date.asc'});
    }
    if(!benchRows.length)return {common:[]};
    const start=[fundRows[0].obs_date,benchRows[0].obs_date].sort().at(-1),end=[fundRows.at(-1).obs_date,benchRows.at(-1).obs_date].sort()[0];
    const fx=A.fxBook(await fxRows([S.f.currency,benchCurrency,...benchRows.map(x=>x.currency)],start,end));
    const fp=A.wealthPath(fundRows,{currency:S.f.currency,fx,payout:true,currencyPerRow:false});
    const bp=b.source_kind==='bamosz_fund'?A.wealthPath(benchRows,{currency:benchCurrency,fx,payout:true,currencyPerRow:false}):A.wealthPath(benchRows,{currency:benchCurrency,fx,payout:false,currencyPerRow:benchPerRow});
    const common=A.commonWealth(fp,bp);S.dailyCache[S.code]=common;return {common};
  }
  function renderRollingCharts(){
    destroy('rf');destroy('re');destroy('t');
    E('rollFundTitle').textContent=`${S.h} éves évesített hozamok eloszlása`;
    E('rollExTitle').textContent=`${S.h} éves évesített többlethozamok eloszlása`;
    E('timelineTitle').textContent=`${S.h} éves évesített többlethozam alakulása az időben`;
    const fundHist=histogram(S.fundRoll.map(x=>x[1]),12,'pct'),exHist=histogram(S.relRoll.map(x=>x[1]),12,'excess');
    S.charts.rf=new Chart(E('rollFund'),{type:'bar',data:{labels:fundHist.labels,datasets:[{data:fundHist.counts,backgroundColor:'rgba(23,60,52,.55)'}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{title:c=>`Évesített hozam: ${c[0]?.label||''}`,label:c=>`${c.parsed.y} vizsgált időszak`}}},scales:{x:{title:{display:true,text:'Évesített hozam tartománya'},ticks:{maxRotation:0,minRotation:0,autoSkip:true}},y:{beginAtZero:true,ticks:{precision:0},title:{display:true,text:'Vizsgált időszakok száma'}}}}});
    S.charts.re=new Chart(E('rollEx'),{type:'bar',data:{labels:exHist.labels,datasets:[{data:exHist.counts,backgroundColor:'rgba(105,115,134,.55)'}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{title:c=>`Évesített többlethozam: ${c[0]?.label||''} százalékpont`,label:c=>`${c.parsed.y} vizsgált időszak`}}},scales:{x:{title:{display:true,text:'Évesített többlethozam tartománya (pp)'},ticks:{maxRotation:0,minRotation:0,autoSkip:true}},y:{beginAtZero:true,ticks:{precision:0},title:{display:true,text:'Vizsgált időszakok száma'}}}}});
    S.charts.t=new Chart(E('timeline'),{type:'line',data:{labels:S.relRoll.map(x=>x[0]),datasets:[{data:S.relRoll.map(x=>x[1]*100),borderColor:'rgba(23,60,52,.9)',pointRadius:0,fill:true,backgroundColor:'rgba(23,60,52,.07)',borderWidth:1.5}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.parsed.y.toLocaleString('hu-HU',{minimumFractionDigits:1,maximumFractionDigits:1})} százalékpont`}}},scales:{y:{title:{display:true,text:'Évesített többlethozam (pp)'}}}}});
  }
  function renderHistoryContext(common){
    const s=summary(S.code,S.h);
    E('obsLabel').textContent=`Vizsgált ${S.h} éves időszakok`;
    E('obsCount').textContent=s?.observations==null?'—':Number(s.observations).toLocaleString('hu-HU');
    if(!common.length){E('commonPeriod').textContent='Nincs elegendő közös adat';return}
    const start=common[0].date,end=common.at(-1).date;
    E('commonPeriod').innerHTML=`${A.esc(A.date(start))} – ${A.esc(A.date(end))}<em> · ${A.esc(durationLabel(start,end))}</em>`;
  }
  function pad2(n){return String(n).padStart(2,'0')}
  function minusYears(iso,n){
    const [y,m,d]=String(iso).slice(0,10).split('-').map(Number),yy=y-n,last=new Date(Date.UTC(yy,m,0)).getUTCDate();
    return `${yy}-${pad2(m)}-${pad2(Math.min(d,last))}`;
  }
  function rangeTarget(range,end){
    if(range==='ytd')return `${String(end).slice(0,4)}-01-01`;
    if(range==='1y')return minusYears(end,1);
    if(range==='3y')return minusYears(end,3);
    if(range==='5y')return minusYears(end,5);
    return null;
  }
  function quickAvailable(common,range){
    if(!common.length||['max','custom'].includes(range))return true;
    const target=rangeTarget(range,common.at(-1).date);return !!target&&common[0].date<=target;
  }
  function wealthSelection(common){
    if(common.length<2)return {rows:[],requestedFrom:null,requestedTo:null};
    const first=common[0].date,last=common.at(-1).date;
    if(S.wr==='max')return {rows:common,requestedFrom:first,requestedTo:last};
    let from,to=last;
    if(S.wr==='custom'){
      from=S.customFrom||first;to=S.customTo||last;
      if(from>to||from<first||to>last)return {rows:[],requestedFrom:from,requestedTo:to,error:`Az egyéni időszak ${A.date(first)} és ${A.date(last)} közé essen.`};
    }else from=rangeTarget(S.wr,last);
    const i=common.findIndex(x=>x.date>=from);let j=-1;for(let k=common.length-1;k>=0;k--){if(common[k].date<=to){j=k;break}}
    if(i<0||j<0||j<=i)return {rows:[],requestedFrom:from,requestedTo:to,error:'A kiválasztott időszakhoz nincs legalább két közös napi megfigyelés.'};
    return {rows:common.slice(i,j+1),requestedFrom:from,requestedTo:to};
  }
  function updateWealthControls(common){
    const buttons=[...document.querySelectorAll('#wealthRangeTabs button')],first=common[0]?.date,last=common.at(-1)?.date;
    if(common.length&&S.wr!=='custom'&&!quickAvailable(common,S.wr))S.wr='max';
    buttons.forEach(b=>{const r=b.dataset.wr;b.disabled=!['max','custom'].includes(r)&&!quickAvailable(common,r);b.classList.toggle('active',r===S.wr)});
    const box=E('wealthCustom');box.hidden=S.wr!=='custom';
    if(first&&last){
      for(const el of [E('wealthFrom'),E('wealthTo')]){el.min=first;el.max=last}
      if(!S.customFrom||S.customFrom<first)S.customFrom=first;if(!S.customTo||S.customTo>last)S.customTo=last;if(S.customFrom>S.customTo){S.customFrom=first;S.customTo=last}
      E('wealthFrom').value=S.customFrom;E('wealthTo').value=S.customTo
    }
    E('wealthRangeMsg').textContent='';
  }
  function wealthRangeName(){return ({ytd:'Év eleje óta','1y':'1 év','3y':'3 év','5y':'5 év',max:'MAX',custom:'Egyéni időszak'})[S.wr]||'Időszak'}
  function updateUrl(){
    const u=new URL(location);u.searchParams.set('benchmark',S.code);u.searchParams.set('h',S.h);u.searchParams.set('wr',S.wr);
    if(S.wr==='custom'){u.searchParams.set('from',S.customFrom);u.searchParams.set('to',S.customTo)}else{u.searchParams.delete('from');u.searchParams.delete('to')}
    history.replaceState(null,'',u);
  }
  function renderWealthChart(){
    destroy('w');const sel=wealthSelection(S.common),msg=E('wealthRangeMsg');msg.textContent='';
    if(sel.error){E('wealthSummary').classList.remove('has-inflation');E('wealthSummary').innerHTML='';E('wealthInflationNote').textContent='';E('chartLoading').textContent=sel.error;msg.textContent=sel.error;return}
    const rows=sel.rows;if(!rows.length){E('wealthSummary').classList.remove('has-inflation');E('wealthSummary').innerHTML='';E('wealthInflationNote').textContent='';E('chartLoading').textContent='Nincs elegendő közös napi adat.';return}
    const base=rows[0],rebased=rows.map(x=>({date:x.date,fund:x.fund/base.fund*1e6,bench:x.bench/base.bench*1e6})),ds=A.down(rebased,1400),last=rebased.at(-1),fundEnd=last.fund,benchEnd=last.bench,diff=fundEnd-benchEnd,fundRet=fundEnd/1e6-1,benchRet=benchEnd/1e6-1,label=short[S.code]||S.code,pp=purchasingPowerInfo(rebased);
    const ppCard=pp?`<div class="wealth-stat"><span>Vásárlóerő megőrzéséhez</span><strong>${A.huf(pp.required)}</strong><small>Eurostat HICP · ${monthLabel(pp.cpiEnd)} · alap reálhozama ${A.pct(pp.real)}</small></div>`:'';
    const ws=E('wealthSummary');ws.classList.toggle('has-inflation',!!pp);
    ws.innerHTML=`<div class="wealth-stat"><span>${A.esc(S.f.fund_name||S.f.isin)}</span><strong>${A.huf(fundEnd)}</strong><small>${A.pct(fundRet)} teljes hozam</small></div><div class="wealth-stat"><span>${A.esc(label)}</span><strong>${A.huf(benchEnd)}</strong><small>${A.pct(benchRet)} teljes hozam</small></div><div class="wealth-stat"><span>Különbség</span><strong class="${A.cls(diff)}">${signedHuf(diff)}</strong><small>alap mínusz passzív alternatíva</small></div>${ppCard}`;
    const win=E('wealthInflationNote');
    if(pp&&pp.cpiEnd<pp.selectedEndMonth)win.textContent=`A vásárlóerő-küszöb a legutóbb publikált, a kiválasztott időtávba eső HICP-hónapig (${monthLabel(pp.cpiEnd)}) értendő; a későbbi napokra nem becsülünk inflációt.`;
    else if(!pp&&S.inflationLoaded&&S.cpi.length&&monthKey(rows[0].date)<S.cpi[0].period_month)win.textContent=`Ehhez a teljes időtávhoz nem mutatunk részleges vásárlóerő-küszöböt: az Eurostat HICP-idősor ${monthLabel(S.cpi[0].period_month)} hónaptól érhető el.`;
    else win.textContent='';
    S.charts.w=new Chart(E('wealth'),{type:'line',data:{labels:ds.map(x=>x.date),datasets:[{label:S.f.fund_name||S.f.isin,data:ds.map(x=>x.fund),borderColor:'rgba(23,60,52,.95)',pointRadius:0,borderWidth:1.7},{label,data:ds.map(x=>x.bench),borderColor:'rgba(105,115,134,.85)',pointRadius:0,borderWidth:1.4}]},options:{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${A.huf(c.parsed.y)}`}}},scales:{y:{title:{display:true,text:'Befektetés értéke (Ft)'},ticks:{callback:v=>A.huf(v)}}}}});
    const adjusted=S.wr==='custom'&&(rows[0].date!==sel.requestedFrom||rows.at(-1).date!==sel.requestedTo);
    E('chartLoading').textContent=`${wealthRangeName()} · ${A.date(rows[0].date)} – ${A.date(rows.at(-1).date)} · ${rows.length.toLocaleString('hu-HU')} közös napi megfigyelés`;
    if(adjusted)msg.textContent=`A megadott dátumokhoz a következő/előző tényleges közös megfigyelést használjuk: ${A.date(rows[0].date)} – ${A.date(rows.at(-1).date)}.`;
    updateUrl();
  }
  function renderRegretChart(){
    destroy('r');if(!S.common.length)return;const ds=A.down(S.common,1400);
    S.charts.r=new Chart(E('regret'),{type:'line',data:{labels:ds.map(x=>x.date),datasets:[{data:ds.map(x=>x.relativeDrawdown*100),borderColor:'rgba(179,62,72,.9)',pointRadius:0,borderWidth:1.5,fill:true,backgroundColor:'rgba(179,62,72,.07)'}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.parsed.y.toFixed(1)}% relatív lemaradás`}}},scales:{y:{max:0,title:{display:true,text:'Relatív lemaradás (%)'}}}}});
  }
  async function renderDailyCharts(){
    E('chartLoading').textContent='Napi HUF idősor összeállítása…';const {common}=await rawPaths();S.common=common;renderHistoryContext(common);destroy('w');destroy('r');
    if(!common.length){E('wealthSummary').innerHTML='';E('chartLoading').textContent='Nincs elegendő közös napi adat.';return}
    updateWealthControls(common);renderWealthChart();renderRegretChart();
  }
  async function refresh(){
    tabs();await loadRolling();cards();renderInflation();renderRollingCharts();await renderDailyCharts();
    updateUrl();
  }
  function bind(){
    E('benchTabs').onclick=async e=>{const z=e.target.closest('button');if(!z)return;S.code=z.dataset.c;await refresh()};
    document.querySelectorAll('#hTabs button').forEach(z=>z.onclick=async()=>{S.h=+z.dataset.h;await refresh()});
    E('wealthRangeTabs').onclick=e=>{const z=e.target.closest('button');if(!z||z.disabled)return;const next=z.dataset.wr;if(next==='custom'&&S.wr!=='custom'){const cur=wealthSelection(S.common).rows;S.customFrom=cur[0]?.date||S.common[0]?.date||'';S.customTo=cur.at(-1)?.date||S.common.at(-1)?.date||''}S.wr=next;updateWealthControls(S.common);renderWealthChart()};
    E('wealthApply').onclick=()=>{S.customFrom=E('wealthFrom').value;S.customTo=E('wealthTo').value;const sel=wealthSelection(S.common);if(sel.error){E('wealthRangeMsg').textContent=sel.error;return}renderWealthChart()};
  }

  try{
    const [f,m,st,b,s,p]=await Promise.all([
      A.page('funds',{filters:{fund_id:`eq.${id}`},limit:1}),A.page('fund_metrics',{filters:{fund_id:`eq.${id}`},limit:1}),A.page('fund_screen_status',{filters:{fund_id:`eq.${id}`},limit:1}),A.all('benchmarks',{filters:{enabled:'eq.true'},order:'benchmark_id.asc'}),A.all('relative_summary',{filters:{fund_id:`eq.${id}`}}),A.all('relative_path_summary',{filters:{fund_id:`eq.${id}`}})
    ]);
    S.f=f[0];S.m=m[0]||{};S.status=st[0]||{};S.b=b;S.sum=s;S.paths=p;if(!S.f)throw new Error('Alap nem található.');if(!S.b.some(x=>x.benchmark_code===S.code))S.code='ACWI_IMI';
    heading();matrix();meta();bind();await refresh();await loadInflation();
  }catch(e){console.error(e);E('err').innerHTML=`<div class="error"><b>Adatbetöltési hiba.</b><br>${A.esc(e.message)}</div>`}
})();
