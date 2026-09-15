(()=>{
  const A=window.App,P=new URLSearchParams(location.search),fundId=P.get('id');
  if(!A||typeof A.all!=='function'||!fundId)return;
  const nativeAll=A.all.bind(A);
  let metaPromise=null;
  function isCurrentFundDaily(table,opts){
    if(table!=='fund_daily')return false;
    const f=opts?.filters?.fund_id;
    return !f||String(f)===`eq.${fundId}`;
  }
  async function getTrack(){
    if(!metaPromise){
      metaPromise=nativeAll('fund_track_record',{
        select:'fund_id,status,current_segment_start,current_segment_end,current_segment_months,default_screener_excluded,reason',
        filters:{fund_id:`eq.${fundId}`}
      }).then(rows=>rows?.[0]||null).catch(err=>{console.warn('Current-track metadata unavailable; detail history remains uncut.',err);return null});
    }
    return metaPromise;
  }
  A.all=async function(table,opts={}){
    if(!isCurrentFundDaily(table,opts))return nativeAll(table,opts);
    const [rows,track]=await Promise.all([nativeAll(table,opts),getTrack()]);
    // Only a confirmed reactivation resets the canonical investable history.
    // Automatic data-gap review and special-market history are not silently cut.
    if(!track||track.status!=='reactivated'||!track.current_segment_start)return rows;
    const cut=String(track.current_segment_start).slice(0,10);
    const filtered=(rows||[]).filter(r=>String(r.obs_date||'').slice(0,10)>=cut);
    window.dispatchEvent(new CustomEvent('befalap:current-track',{detail:{track,originalRows:rows?.length||0,filteredRows:filtered.length}}));
    return filtered;
  };
  window.BefalapCurrentTrack={get:getTrack};
})();
