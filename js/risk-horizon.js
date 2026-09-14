(async()=>{
const A=window.App,E=id=>document.getElementById(id),P=new URLSearchParams(location.search),id=P.get('id');
if(!A||!id)return;
const risk=E('risk');
if(!risk)return;
const section=risk.closest('section');
const head=section?.querySelector('.head');
const labels={"1Y":"1 év","3Y":"3 év","5Y":"5 év","MAX":"MAX"};
const allowed=new Set(Object.keys(labels));
const state={rows:new Map(),metrics:null,selected:null,error:null,rendering:false};

function metric(label,value,sub,type='pct'){
  const fmt=['pct','neutralPct'].includes(type)?A.pct(value):type==='days'?A.days(value):type==='huf'?A.huf(value):type==='num'?A.num(value):A.esc(value??'—');
  return `<div class="metric" data-risk-horizon-render="1"><span>${A.esc(label)}</span><strong class="${type==='pct'?A.cls(value):''}">${fmt}</strong><small>${sub||''}</small></div>`;
}
function durationLabel(start,end){
  if(!start||!end)return null;
  const a=new Date(`${start}T12:00:00Z`),b=new Date(`${end}T12:00:00Z`);
  if(Number.isNaN(+a)||Number.isNaN(+b)||b<a)return null;
  let months=(b.getUTCFullYear()-a.getUTCFullYear())*12+(b.getUTCMonth()-a.getUTCMonth());
  if(b.getUTCDate()<a.getUTCDate())months=Math.max(0,months-1);
  const years=Math.floor(months/12),rem=months%12,parts=[];
  if(years)parts.push(`${years} év`);if(rem)parts.push(`${rem} hó`);
  return parts.length?parts.join(' '):`${Math.max(0,Math.round((b-a)/86400000))} nap`;
}
function rowLabel(row){
  if(!row)return '—';
  if(row.horizon_code!=='MAX')return labels[row.horizon_code]||row.horizon_code;
  const d=durationLabel(row.start_date,row.end_date);
  return d?`MAX · ${d}`:'MAX';
}
function chooseDefault(){
  const requested=String(P.get('rh')||'').toUpperCase();
  if(allowed.has(requested)&&state.rows.has(requested))return requested;
  for(const code of ['3Y','1Y','MAX','5Y'])if(state.rows.has(code))return code;
  return null;
}
function installHeader(){
  if(!head)return;
  const left=head.firstElementChild;
  if(left&&!E('riskMethodNote')){
    const p=document.createElement('p');p.id='riskMethodNote';
    p.textContent='A kockázati mutatók HUF-ban számított hozamsorokra épülnek. A volatilitás, Sharpe és Sortino lezárt havi hozamokból készül.';
    left.appendChild(p);
  }
  let control=E('riskHorizonControl');
  if(!control){
    control=document.createElement('div');control.id='riskHorizonControl';control.className='group';
    control.innerHTML='<label>Kockázati időtáv</label><div id="riskHorizonTabs" class="seg"><button data-rh="1Y">1 év</button><button data-rh="3Y">3 év</button><button data-rh="5Y">5 év</button><button data-rh="MAX">MAX</button></div>';
    head.appendChild(control);
    control.addEventListener('click',e=>{
      const b=e.target.closest('button[data-rh]');if(!b||b.disabled)return;
      state.selected=b.dataset.rh;renderTabs();renderCards();
      const u=new URL(location);u.searchParams.set('rh',state.selected);history.replaceState(null,'',u);
    });
  }
}
function renderTabs(){
  document.querySelectorAll('#riskHorizonTabs button[data-rh]').forEach(b=>{
    const available=state.rows.has(b.dataset.rh);
    b.disabled=!available;
    b.classList.toggle('active',available&&b.dataset.rh===state.selected);
    b.setAttribute('aria-pressed',String(available&&b.dataset.rh===state.selected));
    b.style.opacity=available?'':'0.45';
    b.style.cursor=available?'':'not-allowed';
    const row=state.rows.get(b.dataset.rh);
    b.title=available?(b.dataset.rh==='MAX'?`MAX: ${A.date(row?.start_date)} – ${A.date(row?.end_date)}`:''):`${labels[b.dataset.rh]}: nincs elegendő teljes havi történet`;
  });
}
function renderCards(){
  if(state.rendering)return;
  state.rendering=true;
  try{
    if(state.error){risk.innerHTML=`<div class="empty" data-risk-horizon-render="1">A havi kockázati mutatók jelenleg nem érhetők el.</div>`;return}
    const row=state.rows.get(state.selected),m=state.metrics;
    if(!row){risk.innerHTML='<div class="empty" data-risk-horizon-render="1">Nincs elegendő teljes havi történet a kockázati mutatókhoz.</div>';return}
    const h=rowLabel(row);
    risk.innerHTML=
      metric('Évesített volatilitás',row.annualized_volatility,`${h} · havi hozamok`)+
      metric('Maximális visszaesés',m?.maximum_drawdown,'teljes elérhető időszak')+
      metric('Leghosszabb idő új csúcs nélkül',m?.maximum_drawdown_duration_days,'teljes elérhető időszak','days')+
      metric('Sharpe-mutató',row.sharpe_3m_dkj,`${h} · kockázatmentes referencia: 3M DKJ`,'num')+
      metric('Sortino-mutató',row.sortino_3m_dkj,`${h} · minimum elvárt hozam: 3M DKJ`,'num')+
      metric('Aktuális AUM',m?.net_assets_huf,'HUF','huf');
  }finally{state.rendering=false}
}

installHeader();
const observer=new MutationObserver(()=>{
  if(state.rendering)return;
  if(!risk.querySelector('[data-risk-horizon-render]'))renderCards();
});
observer.observe(risk,{childList:true});

try{
  const [rows,metrics]=await Promise.all([
    A.all('fund_risk_horizon',{select:'fund_id,horizon_code,start_date,end_date,observations,annualized_volatility,sharpe_3m_dkj,sortino_3m_dkj,risk_free_return,risk_free_coverage',filters:{fund_id:`eq.${id}`}}),
    A.all('fund_metrics',{select:'fund_id,maximum_drawdown,maximum_drawdown_duration_days,net_assets_huf',filters:{fund_id:`eq.${id}`}})
  ]);
  state.rows=new Map(rows.map(x=>[x.horizon_code,x]));
  state.metrics=metrics[0]||null;
  state.selected=chooseDefault();
  renderTabs();renderCards();
}catch(e){
  console.error('Monthly risk module unavailable',e);
  state.error=e;renderTabs();renderCards();
}
})();
