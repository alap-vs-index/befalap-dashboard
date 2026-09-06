(async()=>{
  const A=App,E=id=>document.getElementById(id),P=new URLSearchParams(location.search);
  const short={ACWI_IMI:'ACWI IMI',SP500:'S&P 500',STOXX600:'STOXX 600',BUX:'BUX'};
  const S={code:P.get('benchmark')||'ACWI_IMI',h:+P.get('h')||3,sort:'beat_rate',dir:-1,base:[],sum:[],path:[],bench:[],chart:null};

  const currentBench=()=>S.bench.find(x=>x.benchmark_code===S.code);
  function excess(value){
    if(value===null||value===undefined||!Number.isFinite(+value))return '—';
    const n=+value*100,sign=n>0?'+':'';
    return `${sign}${n.toLocaleString('hu-HU',{minimumFractionDigits:1,maximumFractionDigits:1})} százalékpont`;
  }
  function fillOptions(el,values){[...new Set(values.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'hu')).forEach(x=>el.insertAdjacentHTML('beforeend',`<option value="${A.esc(x)}">${A.esc(x)}</option>`))}
  function tabs(){
    E('benchTabs').innerHTML=S.bench.map(x=>`<button data-c="${x.benchmark_code}" class="${x.benchmark_code===S.code?'active':''}" title="${A.esc(x.name)}">${short[x.benchmark_code]||A.esc(x.benchmark_code)}</button>`).join('');
    document.querySelectorAll('#hTabs button').forEach(x=>x.classList.toggle('active',+x.dataset.h===S.h));
  }
  async function loadRelative(){
    const b=currentBench();
    if(!b) throw new Error('A kiválasztott passzív alternatíva nem található.');
    [S.sum,S.path]=await Promise.all([
      A.all('relative_summary',{filters:{benchmark_id:`eq.${b.benchmark_id}`,horizon_years:`eq.${S.h}`}}),
      A.all('relative_path_summary',{filters:{benchmark_id:`eq.${b.benchmark_id}`}})
    ]);
  }
  function mergedRows(){
    const sm=new Map(S.sum.map(x=>[String(x.fund_id),x]));
    const pm=new Map(S.path.map(x=>[String(x.fund_id),x]));
    const q=E('search').value.trim().toLowerCase(),minObs=+E('obs').value,showAll=E('showInactive').checked;
    let rows=S.base.map(x=>({...x,...sm.get(String(x.fund_id)),...pm.get(String(x.fund_id))}));
    rows=rows.filter(x=>showAll||x.screen_status==='active');
    rows=rows.filter(x=>(x.observations||0)>=minObs);
    if(q) rows=rows.filter(x=>[x.fund_name,x.series_name,x.isin,x.manager,x.category,x.currency,x.risk_class].some(v=>String(v||'').toLowerCase().includes(q)));
    for(const [id,key] of [['manager','manager'],['category','category'],['currency','currency'],['risk','risk_class']]) if(E(id).value) rows=rows.filter(x=>String(x[key]??'')===E(id).value);
    rows.sort((a,b)=>{
      const x=a[S.sort],y=b[S.sort];
      if(x===null||x===undefined)return 1;if(y===null||y===undefined)return-1;
      if(typeof x==='string') return S.dir*x.localeCompare(y,'hu');
      return S.dir*(+x-+y);
    });
    return rows;
  }
  function renderStatusSummary(){
    const counts={};S.base.forEach(x=>counts[x.screen_status]=(counts[x.screen_status]||0)+1);
    E('statusSummary').innerHTML=['active','low_activity','stale_30d','listed_no_history','unlisted','terminated'].filter(k=>counts[k]).map(k=>`<span class="statusline"><b>${counts[k]}</b> ${A.statusLabel(k)}</span>`).join('');
    const latest=S.base.map(x=>x.last_obs_date||x.obs_date).filter(Boolean).sort().at(-1);
    E('dataAsOf').textContent=latest?`Legfrissebb BAMOSZ megfigyelés: ${A.date(latest)}`:'Adatdátum nem elérhető';
  }
  function rowHtml(x){
    const status=x.screen_status||'active';
    const sub=[x.series_name,x.isin,x.manager].filter(Boolean).join(' · ');
    return `<tr class="${status==='active'?'':'inactive-row'}">
      <td><a class="fund" href="fund.html?id=${x.fund_id}&benchmark=${S.code}&h=${S.h}">${A.esc(x.fund_name||x.series_name||x.isin)}</a><div class="sub">${A.esc(sub||x.isin||'—')}</div><span class="${A.statusClass(status)}">${A.statusLabel(status)}</span></td>
      <td><span class="pill">${A.esc(x.category||'—')}</span></td>
      <td class="num">${A.huf(x.net_assets_huf)}</td>
      <td class="num ${A.cls(x.beat_rate==null?null:+x.beat_rate-.5)}">${A.pct(x.beat_rate)}</td>
      <td class="num ${A.cls(x.mean_excess_return)}">${excess(x.mean_excess_return)}</td>
      <td class="num ${A.cls(x.median_excess_return)}">${excess(x.median_excess_return)}</td>
      <td class="num ${A.cls(x.current_excess_return)}">${excess(x.current_excess_return)}</td>
      <td class="num">${A.days(x.longest_relative_underperformance_days)}</td>
      <td class="num ${A.cls(x.max_passive_regret)}">${A.pct(x.max_passive_regret)}</td>
      <td class="num ${A.cls(x.maximum_drawdown)}">${A.pct(x.maximum_drawdown)}</td>
      <td class="num">${A.days(x.maximum_drawdown_duration_days)}</td>
      <td class="num">${A.num(x.sharpe_1y_zero_rf)}</td>
      <td class="num">${A.num(x.sortino_1y_zero_mar)}</td>
      <td class="num">${x.observations??'—'}</td>
    </tr>`;
  }
  function render(){
    const r=mergedRows(),label=short[S.code]||S.code;
    E('caption').textContent=`${label} · ${S.h} éves vizsgált időszakok · HUF-ban · összehasonlító statisztikák havi frissítéssel`;
    E('kFunds').textContent=r.length.toLocaleString('hu-HU');
    E('kBeat').textContent=A.pct(A.median(r.map(x=>+x.beat_rate).filter(Number.isFinite)));
    E('kEx').textContent=excess(A.median(r.map(x=>+x.median_excess_return).filter(Number.isFinite)));
    const leader=r.filter(x=>x.beat_rate!=null).sort((a,b)=>+b.beat_rate-+a.beat_rate)[0];
    E('kLead').textContent=leader?A.pct(leader.beat_rate):'—';E('kLeadName').textContent=leader?.fund_name||'—';
    E('tableBody').innerHTML=r.map(rowHtml).join('')||'<tr><td colspan="14" class="empty">Nincs a szűrésnek megfelelő alap.</td></tr>';
    E('foot').textContent=`${r.length.toLocaleString('hu-HU')} alap · ${label} · ${S.h} éves tartási idő`;
    scatter(r);
    const u=new URL(location);u.searchParams.set('benchmark',S.code);u.searchParams.set('h',S.h);history.replaceState(null,'',u);
  }
  function scatter(rows){
    S.chart?.destroy();
    const points=rows.filter(x=>x.beat_rate!=null&&x.median_excess_return!=null).map(x=>({
      x:+x.beat_rate*100,y:+x.median_excess_return*100,
      r:Math.max(4,Math.min(18,4+Math.log10(Math.max(1,+x.net_assets_huf||1e7)/1e7)*2.4)),
      name:x.fund_name||x.isin,id:x.fund_id,status:x.screen_status
    }));
    S.chart=new Chart(E('scatter'),{type:'bubble',data:{datasets:[{data:points,backgroundColor:'rgba(23,60,52,.42)',borderColor:'rgba(23,60,52,.82)',borderWidth:1}]},options:{maintainAspectRatio:false,onClick:(e,a)=>{if(a.length){const p=points[a[0].index];location.href=`fund.html?id=${p.id}&benchmark=${S.code}&h=${S.h}`}},plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.raw.name}: ${c.raw.x.toFixed(1)}% felülteljesítési arány · ${c.raw.y.toLocaleString('hu-HU',{minimumFractionDigits:1,maximumFractionDigits:1})} százalékpont medián éves többlethozam`}}},scales:{x:{min:0,max:100,title:{display:true,text:'Felülteljesítési arány (%)'},grid:{color:'rgba(0,0,0,.05)'}},y:{title:{display:true,text:'Medián éves többlethozam (százalékpont)'},grid:{color:'rgba(0,0,0,.05)'}}}}});
  }
  function bind(){
    E('benchTabs').onclick=async e=>{const z=e.target.closest('button');if(!z)return;S.code=z.dataset.c;tabs();await loadRelative();render()};
    document.querySelectorAll('#hTabs button').forEach(z=>z.onclick=async()=>{S.h=+z.dataset.h;tabs();await loadRelative();render()});
    ['search','manager','category','currency','risk','obs','showInactive'].forEach(id=>E(id).addEventListener(id==='search'?'input':'change',render));
    document.querySelectorAll('th[data-s]').forEach(th=>th.onclick=()=>{S.sort===th.dataset.s?S.dir*=-1:(S.sort=th.dataset.s,S.dir=['fund_name','category'].includes(S.sort)?1:-1);render()});
  }

  try{
    [S.bench,S.base]=await Promise.all([
      A.all('benchmarks',{filters:{enabled:'eq.true'},order:'benchmark_id.asc'}),
      A.all('v_screener_base',{order:'fund_id.asc'})
    ]);
    if(!S.bench.some(x=>x.benchmark_code===S.code))S.code='ACWI_IMI';
    fillOptions(E('manager'),S.base.map(x=>x.manager));fillOptions(E('category'),S.base.map(x=>x.category));fillOptions(E('currency'),S.base.map(x=>x.currency));fillOptions(E('risk'),S.base.map(x=>x.risk_class));
    renderStatusSummary();tabs();await loadRelative();render();bind();
  }catch(e){console.error(e);E('err').innerHTML=`<div class="error"><b>Adatbetöltési hiba.</b><br>${A.esc(e.message)}</div>`}
})();
