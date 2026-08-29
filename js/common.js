(()=>{
  const cfg=window.APP_CONFIG||{};
  const base=(cfg.SUPABASE_URL||'').replace(/\/$/,'');
  const key=cfg.SUPABASE_KEY||cfg.SUPABASE_PUBLISHABLE_KEY||cfg.SUPABASE_ANON_KEY||'';

  function assertConfig(){
    if(!base||!key) throw new Error('Supabase konfiguráció hiányzik. Ellenőrizd a GitHub Actions SUPABASE_URL változót és SUPABASE_PUBLISHABLE_KEY secretet.');
  }

  function headers(){
    const h={apikey:key};
    // Legacy anon JWT keys need Authorization. New sb_publishable_* keys use apikey.
    if(key.startsWith('eyJ')) h.Authorization=`Bearer ${key}`;
    return h;
  }

  async function page(table,{select='*',filters={},order='',limit=1000,offset=0}={}){
    assertConfig();
    const url=new URL(`${base}/rest/v1/${table}`);
    url.searchParams.set('select',select);
    url.searchParams.set('limit',String(limit));
    url.searchParams.set('offset',String(offset));
    if(order) url.searchParams.set('order',order);
    Object.entries(filters).forEach(([k,v])=>{
      if(v!==''&&v!==null&&v!==undefined) url.searchParams.set(k,String(v));
    });
    const r=await fetch(url,{headers:headers()});
    if(!r.ok){
      let detail='';
      try{detail=await r.text()}catch(_){/* ignore */}
      throw new Error(`${table}: HTTP ${r.status}${detail?` – ${detail.slice(0,240)}`:''}`);
    }
    return r.json();
  }

  async function all(table,opts={}){
    const out=[];
    for(let offset=0;;offset+=1000){
      const batch=await page(table,{...opts,limit:1000,offset});
      out.push(...batch);
      if(batch.length<1000) return out;
    }
  }

  const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const pct=(v,d=1)=>v===null||v===undefined||Number.isNaN(+v)?'—':`${(+v*100).toFixed(d)}%`;
  const pp=(v,d=1)=>v===null||v===undefined||Number.isNaN(+v)?'—':`${(+v*100).toFixed(d)} pp`;
  const num=(v,d=2)=>v===null||v===undefined||Number.isNaN(+v)?'—':(+v).toLocaleString('hu-HU',{maximumFractionDigits:d});
  const huf=v=>{
    if(v===null||v===undefined||Number.isNaN(+v)) return '—';
    const n=+v,a=Math.abs(n);
    if(a>=1e12) return `${(n/1e12).toFixed(2)} ezermrd Ft`;
    if(a>=1e9) return `${(n/1e9).toFixed(1)} mrd Ft`;
    if(a>=1e6) return `${(n/1e6).toFixed(1)} M Ft`;
    return `${Math.round(n).toLocaleString('hu-HU')} Ft`;
  };
  const days=v=>{
    if(v===null||v===undefined||Number.isNaN(+v)) return '—';
    const n=+v;
    if(n>=730) return `${(n/365.2425).toFixed(1)} év`;
    if(n>=60) return `${(n/30.4375).toFixed(1)} hó`;
    return `${Math.round(n)} nap`;
  };
  const date=v=>{
    if(!v) return '—';
    const d=new Date(`${String(v).slice(0,10)}T12:00:00Z`);
    return Number.isNaN(+d)?String(v).slice(0,10):d.toLocaleDateString('hu-HU');
  };
  const cls=v=>v===null||v===undefined||Number.isNaN(+v)?'':+v>0.00005?'pos':+v<-.00005?'neg':'';
  const median=a=>{
    const z=a.filter(Number.isFinite).sort((x,y)=>x-y);
    if(!z.length) return null;
    const m=Math.floor(z.length/2);
    return z.length%2?z[m]:(z[m-1]+z[m])/2;
  };
  const down=(a,n=1200)=>a.length<=n?a:Array.from({length:n},(_,i)=>a[Math.round(i*(a.length-1)/(n-1))]);
  const statusLabel=s=>({active:'Aktív',stale_30d:'30+ napja nem friss',low_activity:'Alacsony forgalmi aktivitás',listed_no_history:'Nincs historikus idősor',unlisted:'Már nem listázott',terminated:'Megszűnt'})[s]||s||'—';
  const statusClass=s=>`status status-${esc(s||'unknown')}`;
  const safePoints=p=>Array.isArray(p)?p.filter(x=>Array.isArray(x)&&x.length>=2&&x[0]&&x[1]!==null&&Number.isFinite(+x[1])).map(x=>[String(x[0]),+x[1]]):[];

  function addDays(iso,n){
    const d=new Date(`${iso}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);
  }

  function fxBook(rows){
    const grouped=new Map();
    rows.forEach(r=>{
      const c=String(r.currency||'').toUpperCase();
      if(!grouped.has(c)) grouped.set(c,[]);
      grouped.get(c).push([r.obs_date,+r.huf_per_unit]);
    });
    for(const arr of grouped.values()) arr.sort((a,b)=>a[0].localeCompare(b[0]));
    function rate(currency,day){
      const c=String(currency||'HUF').toUpperCase();
      if(c==='HUF') return 1;
      const arr=grouped.get(c);if(!arr?.length) return null;
      let lo=0,hi=arr.length-1,ans=-1;
      while(lo<=hi){const mid=(lo+hi)>>1;if(arr[mid][0]<=day){ans=mid;lo=mid+1}else hi=mid-1}
      return ans>=0?arr[ans][1]:null;
    }
    return {rate};
  }

  function wealthPath(rows,{currency='HUF',fx,payout=true,currencyPerRow=false}={}){
    const z=[...rows].filter(r=>r.obs_date).sort((a,b)=>a.obs_date.localeCompare(b.obs_date));
    const out=[];let prev=null,wealth=100;
    for(const r of z){
      const raw=r.unit_price_local??r.adjusted_close_local;
      const price=+raw;
      if(!Number.isFinite(price)||price<=0) continue;
      const c=currencyPerRow?(r.currency||currency):currency;
      const rate=fx.rate(c,r.obs_date);
      if(rate===null||!Number.isFinite(rate)) continue;
      const ph=price*rate;
      const pay=payout&&r.payout_local!==null&&r.payout_local!==undefined?+r.payout_local*rate:0;
      let ret=null;
      if(prev!==null&&prev>0){ret=(ph+pay)/prev-1;if(!Number.isFinite(ret)||ret<=-1)ret=null}
      if(ret!==null) wealth*=1+ret;
      if(!out.length) wealth=100;
      out.push({date:r.obs_date,wealth,priceHuf:ph,ret});
      prev=ph;
    }
    return out;
  }

  function commonWealth(fund,bench){
    const fm=new Map(fund.map(x=>[x.date,x.wealth])),bm=new Map(bench.map(x=>[x.date,x.wealth]));
    const dates=[...fm.keys()].filter(d=>bm.has(d)).sort();
    if(!dates.length) return [];
    const f0=fm.get(dates[0]),b0=bm.get(dates[0]);let peak=1;
    return dates.map(d=>{
      const f=fm.get(d)/f0*100,b=bm.get(d)/b0*100,ratio=f/b;
      peak=Math.max(peak,ratio);
      return {date:d,fund:f,bench:b,relativeDrawdown:ratio/peak-1};
    });
  }

  window.App={page,all,esc,pct,pp,num,huf,days,date,cls,median,down,statusLabel,statusClass,safePoints,addDays,fxBook,wealthPath,commonWealth};
})();
