(()=>{
  const NativeChart=window.Chart;
  if(typeof NativeChart!=='function')return;
  const GAP_DAYS=35;
  const TARGETS=new Set(['wealth','regret']);
  const dayMs=86400000;
  function parseDay(v){
    if(v instanceof Date)return +v;
    const s=String(v??'').slice(0,10),t=Date.parse(`${s}T12:00:00Z`);
    return Number.isFinite(t)?t:null;
  }
  function iso(t){return new Date(t).toISOString().slice(0,10)}
  function breakLongGaps(config){
    const labels=config?.data?.labels;
    const sets=config?.data?.datasets;
    if(!Array.isArray(labels)||labels.length<2||!Array.isArray(sets)||!sets.length)return [];
    const gaps=[];
    for(let i=1;i<labels.length;i++){
      const a=parseDay(labels[i-1]),b=parseDay(labels[i]);
      if(a!==null&&b!==null&&(b-a)/dayMs>GAP_DAYS)gaps.push({index:i,from:iso(a),to:iso(b),days:Math.round((b-a)/dayMs)});
    }
    if(!gaps.length)return [];
    const byIndex=new Map(gaps.map(g=>[g.index,g]));
    const newLabels=[];
    const newData=sets.map(()=>[]);
    for(let i=0;i<labels.length;i++){
      const g=byIndex.get(i);
      if(g){
        const a=parseDay(labels[i-1]),b=parseDay(labels[i]);
        const left=Math.min(a+dayMs,b-dayMs),right=Math.max(a+dayMs,b-dayMs);
        newLabels.push(iso(left));sets.forEach((_,j)=>newData[j].push(null));
        if(right>left){newLabels.push(iso(right));sets.forEach((_,j)=>newData[j].push(null));}
      }
      newLabels.push(labels[i]);
      sets.forEach((ds,j)=>newData[j].push(Array.isArray(ds.data)?ds.data[i]:null));
    }
    config.data.labels=newLabels;
    sets.forEach((ds,j)=>{ds.data=newData[j];ds.spanGaps=false});
    return gaps;
  }
  function note(canvasId,gaps){
    if(!gaps.length)return;
    const canvas=document.getElementById(canvasId);if(!canvas)return;
    const id=`${canvasId}GapNote`;let el=document.getElementById(id);
    if(!el){el=document.createElement('p');el.id=id;el.className='table-unit-note';canvas.closest('.chart')?.insertAdjacentElement('beforebegin',el)}
    if(!el)return;
    const ranges=gaps.slice(0,3).map(g=>`${g.from} – ${g.to}`).join('; ');
    const more=gaps.length>3?` (+${gaps.length-3} további)`:'';
    el.textContent=`Adathiány az idősorban: ${ranges}${more}. A hiányzó NAV-ot nem interpoláljuk és nem rajzolunk mesterséges 0%-os hozamot; a vonal ezért megszakad.`;
  }
  const Wrapped=new Proxy(NativeChart,{
    construct(Target,args,newTarget){
      const item=args[0],config=args[1],canvas=item?.canvas||item;
      const id=canvas?.id;
      if(TARGETS.has(id)&&config?.type==='line'){
        const gaps=breakLongGaps(config);
        if(gaps.length)queueMicrotask(()=>note(id,gaps));
      }
      return Reflect.construct(Target,args,newTarget===Wrapped?Target:newTarget);
    }
  });
  window.Chart=Wrapped;
  window.BefalapGapChart={breakLongGaps,GAP_DAYS};
})();
