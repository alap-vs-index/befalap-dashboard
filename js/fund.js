(async()=>{
  const A=App,E=id=>document.getElementById(id),P=new URLSearchParams(location.search),id=P.get('id');
  if(!id){E('err').innerHTML='<div class="error">Hiányzik a fund id.</div>';return}
  const short={ACWI_IMI:'ACWI IMI',SP500:'S&P 500',STOXX600:'STOXX 600',BUX:'BUX'};
  const S={code:P.get('benchmark')||'ACWI_IMI',h:+P.get('h')||3,f:null,m:null,status:null,b:[],sum:[],paths:[],fundRoll:[],relRoll:[],charts:{}};
  const bench=()=>S.b.find(x=>x.benchmark_code===S.code);
  const summary=(code,h)=>{const b=S.b.find(x=>x.benchmark_code===code);return S.sum.find(x=>String(x.benchmark_id)===String(b?.benchmark_id)&&+x.horizon_years===+h)};
  const path=code=>{const b=S.b.find(x=>x.benchmark_code===code);return S.paths.find(x=>String(x.benchmark_id)===String(b?.benchmark_id))};
  const destroy=k=>S.charts[k]?.destroy();

  function tabs(){E('benchTabs').innerHTML=S.b.map(x=>`<button data-c="${x.benchmark_code}" class="${x.benchmark_code===S.code?'active':''}">${short[x.benchmark_code]||A.esc(x.benchmark_code)}</button>`).join('');document.querySelectorAll('#hTabs button').forEach(x=>x.classList.toggle('active',+x.dataset.h===S.h))}
  function metric(label,value,sub,type='pct'){
    const fmt=type==='pct'?A.pct(value):type==='days'?A.days(value):type==='huf'?A.huf(value):type==='num'?A.num(value):A.esc(value??'—');
    return `<div class="metric"><span>${label}</span><strong class="${type==='pct'?A.cls(value):''}">${fmt}</strong><small>${sub||''}</small></div>`;
  }
  function heading(){
    const f=S.f,m=S.m,st=S.status?.screen_status||'active';
    E('heading').innerHTML=`<div class="eyebrow">ALAP ADATLAP</div><h1>${A.esc(f.fund_name||f.series_name||f.isin)}</h1><div class="meta-line"><span>${A.esc(f.manager||'—')}</span><span>${A.esc(f.category||'—')}</span><span>${A.esc(f.currency||'—')} → HUF</span><span>${A.esc(f.isin)}</span><span class="${A.statusClass(st)}">${A.statusLabel(st)}</span></div>`;
    E('returns').innerHTML=[['1Y',m?.return_1y],['3Y CAGR',m?.cagr_3y],['5Y CAGR',m?.cagr_5y],['10Y CAGR',m?.cagr_10y]].map(x=>`<div class="kpi"><span>${x[0]}</span><strong class="${A.cls(x[1])}">${A.pct(x[1])}</strong><small>HUF total return</small></div>`).join('');
    E('liveNote').textContent=`Legutóbbi alapadat: ${A.date(m?.obs_date||S.status?.last_obs_date)} · rolling analytics havi frissítéssel`;
  }
  function cards(){
    const s=summary(S.code,S.h),p=path(S.code);E('relTitle').textContent=`${S.h}Y vs. ${short[S.code]||S.code}`;
    E('relCards').innerHTML=metric('Beat Rate',s?.beat_rate,`${s?.observations??0} havi rolling ablak`)+metric('Mean Excess',s?.mean_excess_return,'évesített hozamkülönbség')+metric('Median Excess',s?.median_excess_return,'évesített hozamkülönbség')+metric('Aktuális excess',s?.current_excess_return,A.date(s?.current_end_date))+metric('Max Passive Regret',p?.max_passive_regret,A.date(p?.max_passive_regret_date))+metric('Relatív lemaradás',p?.longest_relative_underperformance_days,'korábbi relatív csúcs alatt','days');
    E('risk').innerHTML=metric('Volatilitás',S.m?.annualized_volatility_1y,'trailing 1Y')+metric('Maximum Drawdown',S.m?.maximum_drawdown,'teljes napi HUF történet')+metric('DD duration',S.m?.maximum_drawdown_duration_days,'leghosszabb új csúcs nélküli idő','days')+metric('Sharpe (0% rf)',S.m?.sharpe_1y_zero_rf,'trailing 1Y','num')+metric('Sortino (0% MAR)',S.m?.sortino_1y_zero_mar,'trailing 1Y','num')+metric('Aktuális AUM',S.m?.net_assets_huf,'HUF','huf');
  }
  function matrix(){
    const rows=[];for(const b of S.b)for(const h of[1,3,5]){const s=summary(b.benchmark_code,h),p=path(b.benchmark_code);rows.push(`<tr><td><b>${short[b.benchmark_code]||A.esc(b.benchmark_code)}</b><div class="sub">${A.esc(b.isin)}</div></td><td>${h} év</td><td class="num">${A.pct(s?.beat_rate)}</td><td class="num ${A.cls(s?.mean_excess_return)}">${A.pct(s?.mean_excess_return)}</td><td class="num ${A.cls(s?.median_excess_return)}">${A.pct(s?.median_excess_return)}</td><td class="num ${A.cls(s?.current_excess_return)}">${A.pct(s?.current_excess_return)}</td><td class="num">${s?.observations??'—'}</td><td class="num ${A.cls(p?.max_passive_regret)}">${A.pct(p?.max_passive_regret)}</td><td class="num">${A.days(p?.longest_relative_underperformance_days)}</td></tr>`)}E('matrix').innerHTML=rows.join('');
  }
  function meta(){
    const f=S.f,st=S.status,items=[['ISIN',f.isin],['Alapkezelő',f.manager],['BAMOSZ-kategória',f.category],['Eredeti deviza',f.currency],['Indulás',f.launch_date],['Földrajzi kitettség',f.geographic_exposure],['Devizális kitettség',f.currency_exposure],['Kockázati osztály',f.risk_class],['Forgalmazási mód',f.distribution_mode],['Jogi forma',f.legal_form],['Letétkezelő',f.custodian],['Aktivitási arány (180 nap)',st?.active_flow_ratio_180==null?'—':A.pct(st.active_flow_ratio_180)]];
    E('meta').innerHTML=`<div class="head"><h2>Alapadatok</h2>${f.source_url?`<a class="textlink" href="${A.esc(f.source_url)}" target="_blank" rel="noopener">BAMOSZ-forrás ↗</a>`:''}</div><div class="metagrid">${items.map(x=>`<div><span>${x[0]}</span><strong>${A.esc(x[1]||'—')}</strong></div>`).join('')}</div>`;
  }
  function histogram(vals,bins=20){
    const z=vals.filter(Number.isFinite);if(!z.length)return[];let lo=Math.min(...z),hi=Math.max(...z);if(lo===hi){lo-=.001;hi+=.001}const w=(hi-lo)/bins,c=Array(bins).fill(0);z.forEach(v=>c[Math.min(bins-1,Math.floor((v-lo)/w))]++);return c.map((y,i)=>({x:(lo+(i+.5)*w)*100,y}));
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
    const fx= A.fxBook(await fxRows([S.f.currency,benchCurrency,...benchRows.map(x=>x.currency)],start,end));
    const fp=A.wealthPath(fundRows,{currency:S.f.currency,fx,payout:true,currencyPerRow:false});
    const bp=b.source_kind==='bamosz_fund'?A.wealthPath(benchRows,{currency:benchCurrency,fx,payout:true,currencyPerRow:false}):A.wealthPath(benchRows,{currency:benchCurrency,fx,payout:false,currencyPerRow:benchPerRow});
    return {common:A.commonWealth(fp,bp)};
  }
  function renderRollingCharts(){
    destroy('rf');destroy('re');destroy('t');
    S.charts.rf=new Chart(E('rollFund'),{type:'bar',data:{datasets:[{data:histogram(S.fundRoll.map(x=>x[1])),backgroundColor:'rgba(23,60,52,.55)'}]},options:{maintainAspectRatio:false,parsing:false,plugins:{legend:{display:false}},scales:{x:{type:'linear',title:{display:true,text:'CAGR (%)'}},y:{beginAtZero:true}}}});
    S.charts.re=new Chart(E('rollEx'),{type:'bar',data:{datasets:[{data:histogram(S.relRoll.map(x=>x[1])),backgroundColor:'rgba(105,115,134,.55)'}]},options:{maintainAspectRatio:false,parsing:false,plugins:{legend:{display:false}},scales:{x:{type:'linear',title:{display:true,text:'Excess CAGR (százalékpont/év)'}},y:{beginAtZero:true}}}});
    S.charts.t=new Chart(E('timeline'),{type:'line',data:{labels:S.relRoll.map(x=>x[0]),datasets:[{data:S.relRoll.map(x=>x[1]*100),borderColor:'rgba(23,60,52,.9)',pointRadius:0,fill:true,backgroundColor:'rgba(23,60,52,.07)',borderWidth:1.5}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{title:{display:true,text:'Excess CAGR (pp/év)'}}}}});
  }
  async function renderDailyCharts(){
    E('chartLoading').textContent='Napi HUF idősor összeállítása…';
    const {common}=await rawPaths();const ds=A.down(common,1400);
    destroy('w');destroy('r');
    S.charts.w=new Chart(E('wealth'),{type:'line',data:{labels:ds.map(x=>x.date),datasets:[{label:S.f.fund_name||S.f.isin,data:ds.map(x=>x.fund),borderColor:'rgba(23,60,52,.95)',pointRadius:0,borderWidth:1.7},{label:short[S.code]||S.code,data:ds.map(x=>x.bench),borderColor:'rgba(105,115,134,.85)',pointRadius:0,borderWidth:1.4}]},options:{maintainAspectRatio:false,interaction:{mode:'index',intersect:false},scales:{y:{title:{display:true,text:'Kezdőérték = 100'}}}}});
    S.charts.r=new Chart(E('regret'),{type:'line',data:{labels:ds.map(x=>x.date),datasets:[{data:ds.map(x=>x.relativeDrawdown*100),borderColor:'rgba(179,62,72,.9)',pointRadius:0,borderWidth:1.5,fill:true,backgroundColor:'rgba(179,62,72,.07)'}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{max:0,title:{display:true,text:'Relatív drawdown (%)'}}}}});
    E('chartLoading').textContent=common.length?`${common.length.toLocaleString('hu-HU')} közös napi megfigyelés`:'Nincs elegendő közös napi adat.';
  }
  async function refresh(){
    tabs();cards();await loadRolling();renderRollingCharts();await renderDailyCharts();
    const u=new URL(location);u.searchParams.set('benchmark',S.code);u.searchParams.set('h',S.h);history.replaceState(null,'',u);
  }
  function bind(){
    E('benchTabs').onclick=async e=>{const z=e.target.closest('button');if(!z)return;S.code=z.dataset.c;await refresh()};
    document.querySelectorAll('#hTabs button').forEach(z=>z.onclick=async()=>{S.h=+z.dataset.h;await refresh()});
  }

  try{
    const [f,m,st,b,s,p]=await Promise.all([
      A.page('funds',{filters:{fund_id:`eq.${id}`},limit:1}),A.page('fund_metrics',{filters:{fund_id:`eq.${id}`},limit:1}),A.page('fund_screen_status',{filters:{fund_id:`eq.${id}`},limit:1}),A.all('benchmarks',{filters:{enabled:'eq.true'},order:'benchmark_id.asc'}),A.all('relative_summary',{filters:{fund_id:`eq.${id}`}}),A.all('relative_path_summary',{filters:{fund_id:`eq.${id}`}})
    ]);
    S.f=f[0];S.m=m[0]||{};S.status=st[0]||{};S.b=b;S.sum=s;S.paths=p;if(!S.f)throw new Error('Alap nem található.');if(!S.b.some(x=>x.benchmark_code===S.code))S.code='ACWI_IMI';
    heading();matrix();meta();bind();await refresh();
  }catch(e){console.error(e);E('err').innerHTML=`<div class="error"><b>Adatbetöltési hiba.</b><br>${A.esc(e.message)}</div>`}
})();
