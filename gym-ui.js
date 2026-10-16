// Munch & Move — workouts tab home + live workout mode (one exercise at a time).
(function(){
  'use strict';
  const G = window.Gym;
  const B = ()=> G.B;
  const esc = s=> String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const r1 = n=> Math.round(n*10)/10;
  const pad = n=> String(n).padStart(2,'0');
  const clock = ms=>{ const s = Math.max(0, Math.floor(ms/1000)); return pad(Math.floor(s/3600)) + ':' + pad(Math.floor(s/60)%60) + ':' + pad(s%60); };
  const mmss = ms=>{ const s = Math.max(0, Math.floor(ms/1000)); return pad(Math.floor(s/60)) + ':' + pad(s%60); };
  const dshort = k=>{ const [y,m,d] = k.split('-'); return (+d) + '.' + (+m); };

  // ---------- Styles (own classes; tailwind.css is precompiled and has none of these) ----------
  const css = `
  .gy-btn{display:inline-flex;align-items:center;justify-content:center;gap:.35rem;border-radius:14px;font-weight:900;border:1px solid rgba(255,255,255,.1);background:rgba(8,9,16,.7);color:#e5e7eb;transition:transform .1s;-webkit-tap-highlight-color:transparent}
  .gy-btn:active{transform:scale(.96)}
  .gy-btn[disabled]{opacity:.35}
  .gy-pri{background:linear-gradient(90deg,#00ffa3,#27d3ff);color:#04110c;border-color:transparent;box-shadow:0 0 22px -6px rgba(0,255,163,.8)}
  .gy-warn{background:rgba(255,194,75,.12);border-color:rgba(255,194,75,.45);color:#ffc24b}
  .gy-danger{background:rgba(255,93,115,.12);border-color:rgba(255,93,115,.5);color:#ff8b9b}
  .gy-chip{padding:.45rem .8rem;border-radius:999px;font-size:12px;font-weight:800}
  .gy-chip.on{background:rgba(0,255,163,.15);border-color:rgba(0,255,163,.6);color:#00ffa3}
  .gy-card{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:16px}
  .gy-mut{color:#8b90a3}
  .gy-big{font-size:44px;font-weight:900;line-height:1;color:#fff;letter-spacing:-.5px}
  .gy-mid{font-size:24px;font-weight:900;color:#fff}
  .gy-lbl{font-size:11px;font-weight:800;color:#8b90a3}
  .gy-step{width:58px;height:58px;font-size:26px}
  .gy-num{width:100%;background:transparent;border:0;text-align:center;font-size:34px;font-weight:900;color:#fff;outline:none;-moz-appearance:textfield}
  .gy-grid2 .gy-step{width:42px;height:52px;font-size:22px;flex:none}
  .gy-num{min-width:0}
  .gy-grid2 .gy-num{font-size:30px}
  .gy-num::-webkit-outer-spin-button,.gy-num::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
  .gy-rpe{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
  .gy-rpe button{height:46px;font-size:17px}
  .gy-rpe button.on{background:linear-gradient(90deg,#00ffa3,#27d3ff);color:#04110c;border-color:transparent}
  .gy-rpe button.hot.on{background:linear-gradient(90deg,#ffc24b,#ff8b5c)}
  .gy-rpe button.red.on{background:linear-gradient(90deg,#ff5d73,#ff8b5c)}
  #gymLive{position:fixed;inset:0;z-index:70;background:#07080d;overflow-y:auto;-webkit-overflow-scrolling:touch;direction:rtl}
  #gymLive .gy-wrap{max-width:520px;margin:0 auto;padding:12px 14px 120px}
  .gy-top{position:sticky;top:0;z-index:2;background:rgba(7,8,13,.92);backdrop-filter:blur(8px);padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.06)}
  .gy-bar{height:6px;border-radius:9px;background:rgba(255,255,255,.08);overflow:hidden}
  .gy-bar>i{display:block;height:100%;background:linear-gradient(90deg,#00ffa3,#27d3ff)}
  .gy-fb{border-radius:16px;padding:12px 14px;margin-bottom:12px;font-size:13px;line-height:1.55}
  .gy-fb.up{background:rgba(0,255,163,.08);border:1px solid rgba(0,255,163,.35)}
  .gy-fb.same{background:rgba(39,211,255,.06);border:1px solid rgba(39,211,255,.3)}
  .gy-fb.down,.gy-fb.new{background:rgba(255,194,75,.07);border:1px solid rgba(255,194,75,.35)}
  .gy-rest{position:fixed;left:12px;right:12px;bottom:16px;z-index:75;max-width:496px;margin:0 auto;border-radius:18px;padding:12px 16px;background:#11131f;border:1px solid rgba(39,211,255,.5);box-shadow:0 10px 40px rgba(0,0,0,.6)}
  .gy-row{display:flex;align-items:center;gap:8px}
  .gy-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .gy-list li{display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px}
  .gy-slider{width:100%;accent-color:#00ffa3;height:34px}
  .gy-modal{position:fixed;inset:0;z-index:72;background:rgba(0,0,0,.7);display:flex;align-items:flex-end;justify-content:center;direction:rtl}
  .gy-sheet{background:#0d0f19;border:1px solid rgba(255,255,255,.08);border-radius:22px 22px 0 0;width:100%;max-width:560px;max-height:92vh;overflow-y:auto;padding:16px 16px 28px}
  @media (min-width:700px){ .gy-modal{align-items:center} .gy-sheet{border-radius:22px} }
  .gy-in{background:rgba(8,9,16,.7);border:1px solid rgba(255,255,255,.1);border-radius:12px;color:#f3f4f6;padding:8px 10px;font-weight:700;font-size:14px;width:100%;outline:none}
  .gy-in:focus{border-color:rgba(0,255,163,.7)}
  .gy-tbl{width:100%;border-collapse:collapse;font-size:12px}
  .gy-tbl td,.gy-tbl th{padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.06);text-align:right}
  .gy-tbl th{color:#8b90a3;font-weight:800}
  `;
  function injectCss(){ if(document.getElementById('gyCss')) return; const st = document.createElement('style'); st.id = 'gyCss'; st.textContent = css; document.head.appendChild(st); }
  G.esc = esc; G.clock = clock; G.dshort = dshort;

  // ---------- Workouts tab: home ----------
  // Rendered only while the workouts tab is on screen; a hidden tab is redrawn the
  // moment it opens (the history scan is the expensive part on a long log).
  let homeDirty = false, homeObs = null;
  G.renderHome = function(){
    const box = document.getElementById('gymHome'); if(!box || !B()) return;
    const tab = document.getElementById('tab-workouts');
    if(tab && !homeObs && window.MutationObserver){
      homeObs = new MutationObserver(()=>{ if(homeDirty && !tab.classList.contains('hidden')){ homeDirty = false; G.invalidate(); G.renderHome(); } });
      homeObs.observe(tab, { attributes:true, attributeFilter:['class'] });
    }
    if(tab && tab.classList.contains('hidden')){ homeDirty = true; return; }
    injectCss();
    const L = G.liveLoad();
    const ws = G.weekStatus();
    const nx = G.nextWorkout();
    const prev = G.planSession({});
    const recent = ['leg_press','lat_pulldown','shoulder_press','leg_curl','hip_thrust','row','chest_press','kickback']
      .map(id=>{ const e = G.ex(id); if(!e || !e.active) return null; const r = G.readiness(id); return r ? { e, r } : null; })
      .filter(Boolean).slice(0,4);
    const streak = G.streakWeeks();
    const chip = (txt, ok)=> '<span class="gy-chip gy-btn' + (ok?' on':'') + '" style="pointer-events:none">' + txt + '</span>';
    let h = '<section class="glass-hl rounded-2xl p-4 mb-5">';
    if(L && L.phase && L.phase !== 'saved'){
      h += '<button id="gyResume" class="gy-btn gy-warn w-full" style="height:64px;font-size:17px;width:100%">↩ חזרה לאימון הפתוח · ' + clock(Date.now() - L.startedAt) + '</button>';
    } else {
      h += '<button id="gyStart" class="gy-btn gy-pri" style="height:72px;font-size:21px;width:100%">🏋️ התחלת אימון</button>';
      h += '<div class="text-center mt-2 text-[12px] font-bold gy-mut">האימון הבא: <bdi>Full Body ' + prev.label + '</bdi> · ~' + prev.estMin + ' דק׳' + (nx && nx.trainer ? ' · ' + esc(nx.text) : '') + '</div>';
    }
    const acts = Object.values(G.state().activities || {});
    const showPil = G.isOwner() || acts.some(a=> a && a.kind === 'pilates');
    const showSalsa = G.isOwner() || acts.some(a=> a && a.kind === 'salsa');
    h += '<div class="flex flex-wrap gap-2 justify-center mt-3">' +
      chip('כוח ' + ws.strength + '/' + ws.strengthTarget, ws.strength >= 3) +
      (showPil ? chip('פילאטיס ' + ws.pilates + '/' + ws.pilatesTarget, ws.pilates >= 1) : '') +
      (showSalsa ? chip('סלסה ' + (ws.salsa ? '✓' : '—'), ws.salsa) : '') +
      (streak ? chip('🔥 ' + streak + ' שבועות ברצף', true) : '') + '</div>';
    if(recent.length){
      h += '<div class="mt-4"><div class="gy-lbl mb-1">התקדמות אחרונה</div><ul class="gy-list">' + recent.map(({e, r})=>{
        const st = G.entryStats(r.rec.last);
        const now = e.kind === 'time' ? G.fmtSec(st.bestSec) : (G.fmtKg(st.top) + ' ×' + st.minReps);
        return '<li data-gyex="' + e.id + '" style="cursor:pointer"><span>' + e.icon + '</span><span class="flex-1 font-bold text-gray-100">' + esc(e.he) + '</span><span class="gy-mut">' + now + '</span>' +
          (r.word ? '<span class="text-[11px] font-black ' + (r.rec.action==='increase'?'txt-green':'txt-sky') + '">' + r.word + '</span>' : '') + '</li>';
      }).join('') + '</ul></div>';
    }
    h += '<div class="gy-grid2 mt-4">' +
      '<button id="gyActBtn" class="gy-btn" style="height:46px;font-size:13px">💃 רישום פעילות</button>' +
      '<button id="gyHistBtn" class="gy-btn" style="height:46px;font-size:13px">📅 היסטוריה</button>' +
      '<button id="gyTrackBtn" class="gy-btn" style="height:46px;font-size:13px">📈 מעקב תרגילים</button>' +
      '<button id="gyCoachBtn" class="gy-btn" style="height:46px;font-size:13px">📋 ' + (G.isOwner() ? 'דוח למאמנת' : 'דוח למאמן/ת') + '</button></div>';
    const reqs = (G.state().requests || []).filter(r=> !r.done);
    if(reqs.length) h += '<div class="text-[11px] gy-mut mt-3">📝 ' + reqs.length + ' בקשות לשינוי באפליקציה נשמרו מהעוזר</div>';
    h += '</section>';
    box.innerHTML = h;
    const on = (id, fn)=>{ const el = document.getElementById(id); if(el) el.onclick = fn; };
    on('gyStart', ()=> G.startLive());
    on('gyResume', ()=> G.openLive());
    on('gyActBtn', ()=> G.openActivity && G.openActivity());
    on('gyHistBtn', ()=> G.openHistory && G.openHistory());
    on('gyTrackBtn', ()=> G.openTracking && G.openTracking());
    on('gyCoachBtn', ()=> G.openCoachReport && G.openCoachReport());
    box.querySelectorAll('[data-gyex]').forEach(li=> li.onclick = ()=> G.openExercise && G.openExercise(li.dataset.gyex));
  };

  // ---------- Live workout ----------
  let L = null, tickT = null, wake = null, restT = null;
  function persist(){ G.liveSave(L); }
  async function keepAwake(){
    try{ if('wakeLock' in navigator && !wake && document.visibilityState === 'visible') { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', ()=>{ wake = null; }); } }catch(_){}
  }
  document.addEventListener('visibilitychange', ()=>{ if(L && document.getElementById('gymLive')) keepAwake(); });

  G.startLive = function(){
    L = { v:1, startedAt:Date.now(), phase:'pre', soreness:0, areas:{}, flags:[], minutes:G.state().prefs.minutes || 55, label:null, items:[], cur:-1 };
    persist(); G.openLive();
  };
  const STALE = 6 * 3600 * 1000;
  G.openLive = function(){
    injectCss();
    if(!L) L = G.liveLoad();
    if(!L) return;
    // Left open for hours (forgot to finish): straight to the summary, saved with an
    // estimated duration rather than the wall-clock gap.
    if(Date.now() - L.startedAt > STALE && !['pre','plan','sum','saved'].includes(L.phase)){ L.stale = true; L.phase = 'sum'; L.showPlan = false; persist(); }
    if(L.phase === 'ex' && L.items[L.cur] && L.items[L.cur].status !== 'todo'){ setTimeout(()=> advance(), 0); }
    let el = document.getElementById('gymLive');
    if(!el){ el = document.createElement('div'); el.id = 'gymLive'; document.body.appendChild(el); }
    document.documentElement.style.overflow = 'hidden';
    keepAwake();
    render();
    clearInterval(tickT); tickT = setInterval(tick, 1000);
  };
  function closeLive(){
    clearInterval(tickT); tickT = null;
    const el = document.getElementById('gymLive'); if(el) el.remove();
    const rs = document.getElementById('gyRest'); if(rs) rs.remove();
    document.documentElement.style.overflow = '';
    try{ wake && wake.release(); }catch(_){} wake = null;
    B().renderAll();
  }
  G.closeLive = closeLive;
  // Re-read the open session after an outside change (the assistant).
  G.reloadLive = function(){
    L = G.liveLoad(); if(!L || !document.getElementById('gymLive')) return;
    const it = L.items[L.cur];
    if(L.phase === 'ex' && it && it.status !== 'todo') advance(); else render();
  };
  G.live = ()=> L || G.liveLoad();

  const elapsed = ()=> Date.now() - L.startedAt;
  const limitMin = ()=> Math.min(+G.state().prefs.max || 60, Math.max(+L.minutes || 55, 30) + 5);
  const todo = ()=> L.items.map((it,i)=> ({ it, i })).filter(x=> x.it.status === 'todo');
  const remainEst = ()=> todo().reduce((a,{it})=> a + G.estMin(G.ex(it.exId), it.sets), 0);
  function tick(){
    if(!L) return;
    document.querySelectorAll('[data-tick="el"]').forEach(n=> n.textContent = clock(elapsed()));
    document.querySelectorAll('[data-tick="warm"]').forEach(n=> n.textContent = mmss(Date.now() - (L.warmAt||Date.now())));
    if(L.timing) document.querySelectorAll('[data-tick="plank"]').forEach(n=> n.textContent = mmss(Date.now() - L.timing));
    const rs = document.getElementById('gyRestLeft');
    if(rs && L.restEnd){
      const left = L.restEnd - Date.now();
      rs.textContent = mmss(left + 999);
      if(left <= 0){ L.restEnd = null; persist(); try{ navigator.vibrate && navigator.vibrate([200,100,200]); }catch(_){} renderRest(); }
    }
  }

  function header(){
    const done = L.items.filter(it=> it.status === 'done').length;
    const total = L.items.filter(it=> it.status !== 'cut').length;
    const curN = L.items.slice(0, L.cur+1).filter(it=> it.status !== 'cut').length;
    const left = todo().length;
    const pct = Math.min(100, Math.round(elapsed() / 60000 / limitMin() * 100));
    return '<div class="gy-top"><div class="gy-row" style="justify-content:space-between">' +
      '<span class="text-[13px] font-black text-gray-100">⏱ <span data-tick="el">' + clock(elapsed()) + '</span> <span class="gy-mut">/ ' + limitMin() + ' דק׳</span></span>' +
      '<span class="gy-row"><button id="gyPlanT" class="gy-btn gy-chip">☰ תוכנית</button><button id="gyEnd" class="gy-btn gy-chip">סיום</button></span></div>' +
      (L.phase === 'ex' ? '<div class="text-[12px] font-bold gy-mut mt-1">תרגיל ' + curN + ' מתוך ' + total + ' · נשארו ' + left + ' · ~' + Math.round(remainEst() + G.COOL) + ' דק׳</div>' : '') +
      '<div class="gy-bar mt-2"><i style="width:' + (L.phase==='ex' ? Math.round(done/Math.max(1,total)*100) : pct) + '%"></i></div></div>';
  }

  function render(){
    const el = document.getElementById('gymLive'); if(!el || !L) return;
    let body = '';
    if(L.phase === 'pre') body = renderPre();
    else if(L.phase === 'plan') body = renderPlan();
    else if(L.phase === 'warm') body = renderWarm();
    else if(L.phase === 'ex') body = renderEx();
    else if(L.phase === 'busy') body = renderBusy();
    else if(L.phase === 'cool') body = renderCool();
    else if(L.phase === 'sum') body = renderSum();
    else if(L.phase === 'saved') body = renderSaved();
    el.innerHTML = (['pre','saved'].includes(L.phase) ? '' : header()) + '<div class="gy-wrap">' + body + '</div>' + (L.showPlan ? planSheet() : '');
    bind(el);
    renderRest();
  }

  // --- pre: soreness + time
  const FLAGS = ['כאב חד או כאב במפרק','נפיחות חריגה','חולשה','נימול חריג','סחרחורת'];
  function renderPre(){
    const v = +L.soreness || 0;
    let h = '<div class="gy-row mt-2 mb-3" style="justify-content:space-between"><div class="gy-mid">לפני שמתחילים</div><button id="gyCancel" class="gy-btn gy-chip">ביטול</button></div>';
    h += '<div class="gy-card mb-3"><div class="font-black text-gray-100 mb-2">כמה הגוף תפוס או כואב היום?</div>' +
      '<div class="gy-row"><input id="gySore" type="range" min="0" max="10" step="1" value="' + v + '" class="gy-slider"><span class="gy-mid" style="min-width:40px;text-align:center">' + v + '</span></div>' +
      '<button id="gyNoSore" class="gy-btn gy-chip mt-1' + (v===0?' on':'') + '">לא תפוס בכלל</button>';
    if(v > 0){
      h += '<div class="gy-lbl mt-3 mb-1">איפה? (אפשר כמה)</div><div class="flex flex-wrap gap-2">' +
        Object.entries(G.AREAS).map(([k,lbl])=> '<button class="gy-btn gy-chip' + (L.areas[k]?' on':'') + '" data-area="' + k + '">' + lbl + '</button>').join('') + '</div>';
      h += '<div class="text-[11px] gy-mut mt-2">' + (v <= 3 ? 'רגיל — אימון כרגיל.' : v <= 5 ? 'מותר Full Body, עם פחות עומס באזור התפוס.' : 'נשקול החלפה או הפחתה משמעותית באזור התפוס.') + '</div>';
    }
    h += '<div class="gy-lbl mt-3 mb-1">יש משהו מאלה?</div><div class="flex flex-wrap gap-2">' +
      FLAGS.map((f,i)=> '<button class="gy-btn gy-chip' + (L.flags.includes(i)?' on':'') + '" data-flag="' + i + '">' + f + '</button>').join('') + '</div>';
    if(L.flags.length){
      h += '<div class="gy-card gy-danger mt-3" style="border-radius:16px"><div class="font-black mb-1">⚠️ זה לא נשמע כמו כאב שרירים רגיל</div>' +
        '<div class="text-[12px] leading-relaxed">על כאב חד, נפיחות, חולשה, נימול או סחרחורת לא מתאמנים "דרך" זה. עדיף לעצור היום ולהתייעץ עם רופא/ה או פיזיותרפיסט/ית.</div>' +
        '<div class="gy-grid2 mt-3"><button id="gyStopToday" class="gy-btn gy-danger" style="height:44px">לעצור להיום</button><button id="gyCareful" class="gy-btn" style="height:44px">להמשיך בזהירות</button></div></div>';
    }
    h += '</div>';
    h += '<div class="gy-card mb-4"><div class="font-black text-gray-100 mb-2">כמה זמן יש?</div><div class="flex gap-2">' +
      [45,55,60].map(m=> '<button class="gy-btn gy-chip' + (+L.minutes===m?' on':'') + '" data-min="' + m + '">' + m + ' דק׳</button>').join('') + '</div></div>';
    h += '<button id="gyBuild" class="gy-btn gy-pri" style="height:64px;font-size:19px;width:100%"' + (L.flags.length && !L.careful ? ' disabled' : '') + '>בניית האימון ←</button>';
    return h;
  }
  // --- plan summary (focus mode: details hidden behind "הצג תוכנית")
  function renderPlan(){
    const n = L.items.length;
    let h = '<div class="text-center mt-4"><div class="gy-lbl">האימון של היום</div><div class="gy-big mt-1" dir="ltr">Full Body ' + L.label + '</div>' +
      '<div class="gy-mut font-bold mt-2">' + n + ' תרגילים · ~' + L.estMin + ' דק׳ כולל חימום ושחרור</div></div>';
    h += '<div class="flex gap-2 justify-center mt-4">' + ['A','B','C'].map(l=> '<button class="gy-btn gy-chip' + (L.label===l?' on':'') + '" data-label="' + l + '">' + l + '</button>').join('') + '</div>';
    if(L.planNote) h += '<div class="text-[12px] text-center gy-mut mt-3">' + esc(L.planNote) + '</div>';
    h += '<button id="gyShowPlan" class="gy-btn gy-chip mt-4" style="margin-inline:auto;display:flex">הצג תוכנית</button>';
    h += '<button id="gyGoWarm" class="gy-btn gy-pri mt-6" style="height:68px;font-size:20px;width:100%">▶ לחימום</button>';
    h += '<button id="gySkipWarm" class="gy-btn mt-3" style="height:44px;width:100%;font-size:13px">דילוג על החימום</button>';
    return h;
  }
  function renderWarm(){
    return '<div class="gy-card mt-3 text-center"><div style="font-size:42px">🚶</div><div class="gy-mid mt-1">חימום · הליכון</div>' +
      '<div class="gy-mut font-bold mt-2">5–7 דקות · 5–5.5 קמ״ש · שיפוע 3 · קושי 5–6</div>' +
      '<div class="gy-big mt-5" data-tick="warm">' + mmss(Date.now() - (L.warmAt||Date.now())) + '</div></div>' +
      '<button id="gyWarmDone" class="gy-btn gy-pri mt-5" style="height:68px;font-size:20px;width:100%">✓ סיימתי חימום</button>';
  }

  // --- exercise card
  function draftFor(it){
    const e = G.ex(it.exId), rec = it.rec || {};
    if(e.kind === 'time') return { kind:'time', sets:[], rpe:null };
    return { kind:'reps', kg: rec.kg != null ? rec.kg : 0, sets: it.sets || rec.sets || 2, reps: rec.reps || e.lo || 10, rpe: null, perSet: null };
  }
  function prevLine(it){
    const e = G.ex(it.exId), last = it.rec && it.rec.last;
    if(!last) return '<span class="gy-mut">אין ביצוע קודם</span>';
    const st = G.entryStats(last);
    return G.setsLine(last, e) + (st.rpe!=null ? ' · ' + G.rpeTxt(st.rpe) : '') + ' <span class="gy-mut">(' + dshort(last.day) + (last.trainer?' · מאמנת':'') + ')</span>';
  }
  function rpeGrid(val, id){
    let h = '<div class="gy-rpe" data-rpegrid="' + id + '">';
    for(let i=1;i<=10;i++){
      const on = val != null && Math.floor(val) === i;
      h += '<button class="gy-btn' + (on?' on':'') + (i>=9?' red':i>=8?' hot':'') + '" data-rpe="' + i + '">' + (on && val % 1 ? i + '.5' : i) + '</button>';
    }
    return h + '</div><div class="text-[10px] gy-mut mt-1 text-center">לחיצה שנייה על אותו מספר מוסיפה חצי · 6–7 זה האזור הרצוי</div>';
  }
  function stepper(label, key, val, unit){
    return '<div class="gy-card" style="padding:10px 12px"><div class="gy-lbl text-center">' + label + '</div>' +
      '<div class="gy-row mt-1"><button class="gy-btn gy-step" data-step="' + key + '" data-dir="1">+</button>' +
      '<div style="flex:1;text-align:center"><input class="gy-num" type="number" inputmode="decimal" step="0.5" data-field="' + key + '" value="' + val + '">' + (unit?'<div class="text-[11px] gy-mut font-bold">' + unit + '</div>':'') + '</div>' +
      '<button class="gy-btn gy-step" data-step="' + key + '" data-dir="-1">−</button></div></div>';
  }
  function renderEx(){
    const it = L.items[L.cur]; if(!it) return '';
    const e = G.ex(it.exId); const rec = it.rec || {};
    if(!L.draft || L.draft.exId !== it.exId){ L.draft = Object.assign(draftFor(it), { exId: it.exId }); persist(); }
    const d = L.draft;
    let h = '';
    if(L.fb) h += '<div class="gy-fb ' + L.fb.kind + '" id="gyFb"><div class="font-black text-gray-100">נרשם: ' + esc(L.fb.name) + '</div><div>' + esc(L.fb.line) + '</div>' +
      '<div class="font-black mt-1 ' + (L.fb.kind==='up'?'txt-green':L.fb.kind==='down'?'txt-amber':'txt-sky') + '">' + esc(L.fb.verdict) + '</div>' +
      '<div class="text-[12px] gy-mut mt-1">בפעם הבאה: ' + esc(L.fb.next) + '</div>' + (L.fb.cut ? '<div class="text-[12px] txt-amber mt-1">' + esc(L.fb.cut) + '</div>' : '') + '</div>';
    h += '<div class="text-center mt-1"><div style="font-size:34px">' + (e.icon||'🏋️') + '</div><div class="gy-big" style="font-size:34px">' + esc(e.he) + '</div><div class="gy-mut font-bold">' + esc(e.en||'') + (it.light?' · <span class="txt-amber">יום קל לאזור</span>':'') + '</div></div>';
    h += '<div class="gy-card mt-3" style="padding:12px 14px;font-size:13px;line-height:1.7">' +
      '<div><span class="gy-lbl">בפעם הקודמת: </span>' + prevLine(it) + '</div>' +
      '<div><span class="gy-lbl">היום: </span><b class="text-gray-100">' + esc(G.recLine(Object.assign({}, rec, { sets: it.sets }), e)) + '</b> · קושי 6–7</div>' +
      '<div class="text-[11px] gy-mut">' + esc(rec.why || '') + '</div></div>';
    if(e.kind === 'time'){
      const best = d.sets.length ? Math.max(...d.sets.map(s=> s.sec)) : 0;
      const prevBest = Math.max(0, ...G.historyOf(e.id).map(x=> G.entryStats(x).bestSec));
      h += '<div class="gy-card mt-3 text-center"><div class="gy-big" style="font-size:64px" data-tick="plank">' + (L.timing ? mmss(Date.now()-L.timing) : '00:00') + '</div>' +
        (L.timing ? '<button id="gyStop" class="gy-btn gy-danger mt-4" style="height:76px;font-size:24px;width:100%">■ STOP</button>'
                  : '<button id="gyGo" class="gy-btn gy-pri mt-4" style="height:76px;font-size:24px;width:100%">▶ ' + (d.sets.length ? 'סט ' + (d.sets.length+1) : 'START') + '</button>') +
        '<div class="gy-row mt-3" style="justify-content:space-around;font-size:12px"><span>הכי טוב היום: <b class="txt-green">' + (best? G.fmtSec(best) : '—') + '</b></span><span>שיא קודם: <b class="txt-sky">' + (prevBest? G.fmtSec(prevBest) : '—') + '</b></span></div></div>';
      if(d.sets.length){
        const lastS = d.sets[d.sets.length-1];
        h += '<div class="gy-card mt-3"><div class="gy-lbl mb-2">סטים: ' + d.sets.map((s,i)=> (i+1) + ') ' + G.fmtSec(s.sec) + (s.rpe? ' · ' + r1(s.rpe):'')).join(' · ') + '</div>' +
          '<div class="font-black text-gray-100 mb-1">קושי לסט ' + d.sets.length + '</div>' + rpeGrid(lastS.rpe, 'time') + '</div>';
      }
      h += '<button id="gyDone" class="gy-btn gy-pri mt-4" style="height:64px;font-size:19px;width:100%"' + (d.sets.length && !L.timing ? '' : ' disabled') + '>✓ סיום תרגיל</button>';
    } else {
      h += '<div class="mt-3" style="display:grid;gap:8px">' + stepper('משקל', 'kg', d.kg, 'ק״ג') +
        '<div class="gy-grid2">' + stepper('סטים', 'sets', d.sets) + stepper('חזרות' + (e.perSide?' (לכל צד)':''), 'reps', d.reps) + '</div></div>';
      h += '<div class="gy-card mt-3"><div class="font-black text-gray-100 mb-2">קושי' + (d.rpe!=null?' · <span class="txt-green">' + r1(d.rpe) + '</span>':'') + '</div>' + rpeGrid(d.rpe, 'main') + '</div>';
      h += '<button id="gyPerSet" class="gy-btn gy-chip mt-2">' + (d.perSet ? 'הסתרת פירוט לפי סט' : 'סטים שונים? פירוט לפי סט') + '</button>';
      if(d.perSet){
        h += '<div class="gy-card mt-2"><table class="gy-tbl"><tr><th>סט</th><th>ק״ג</th><th>חזרות</th><th>קושי</th></tr>' +
          d.perSet.map((s,i)=> '<tr><td>' + (i+1) + '</td><td><input class="gy-in" type="number" inputmode="decimal" step="0.5" data-ps="' + i + '" data-k="kg" value="' + s.kg + '"></td>' +
            '<td><input class="gy-in" type="number" inputmode="numeric" data-ps="' + i + '" data-k="reps" value="' + s.reps + '"></td>' +
            '<td><input class="gy-in" type="number" inputmode="decimal" step="0.5" min="1" max="10" data-ps="' + i + '" data-k="rpe" value="' + (s.rpe==null?'':s.rpe) + '"></td></tr>').join('') + '</table></div>';
      }
      h += '<button id="gyDone" class="gy-btn gy-pri mt-4" style="height:68px;font-size:21px;width:100%">✓ בוצע</button>';
    }
    h += '<div class="gy-grid2 mt-3"><button id="gyRestBtn" class="gy-btn" style="height:48px;font-size:13px">⏱ מנוחה ' + (e.rest||75) + 'ש׳</button>' +
      '<button id="gyBusy" class="gy-btn gy-warn" style="height:48px;font-size:13px">🚧 מכשיר תפוס</button>' +
      '<button id="gySwap" class="gy-btn" style="height:44px;font-size:12px">🔁 החלפת תרגיל</button>' +
      '<button id="gySkip" class="gy-btn" style="height:44px;font-size:12px">דילוג</button></div>';
    if(L.swapOpen){
      const alts = G.lib().filter(x=> x.active && x.slot === e.slot && x.id !== e.id && !L.items.some(y=> y.exId === x.id && y.status !== 'cut'));
      h += '<div class="gy-card mt-3"><div class="gy-lbl mb-2">להחליף ב:</div>' + (alts.length ? alts.map(x=> '<button class="gy-btn gy-chip m-1" data-swap="' + x.id + '">' + esc(x.he) + '</button>').join('') : '<div class="gy-mut text-[12px]">אין תרגיל חלופי פעיל לאותו אזור</div>') + '</div>';
    }
    return h;
  }
  function renderBusy(){
    const it = L.items[L.busyIdx]; const e = G.ex(it.exId);
    return '<div class="gy-card mt-4 text-center"><div style="font-size:36px">🚧</div><div class="gy-mid mt-1">' + esc(e.he) + '</div>' +
      '<div class="gy-mut font-bold mt-2">דילגת עליו כי המכשיר היה תפוס. הוא עדיין חסר לאיזון, ויש זמן.</div>' +
      '<div class="font-black text-gray-100 mt-4">המכשיר התפנה?</div></div>' +
      '<button id="gyBusyYes" class="gy-btn gy-pri mt-4" style="height:64px;font-size:19px;width:100%">כן, לבצע עכשיו</button>' +
      '<button id="gyBusyNo" class="gy-btn mt-3" style="height:52px;width:100%">עדיין תפוס · לדחות לאימון הבא</button>';
  }
  function renderCool(){
    const leftMin = Math.max(0, limitMin() - elapsed()/60000);
    return '<div class="gy-card mt-4 text-center"><div style="font-size:40px">🧘</div><div class="gy-mid mt-1">שחרור</div>' +
      '<div class="gy-mut font-bold mt-2">' + (leftMin >= 3 ? '3–5 דקות הליכה רגועה' : 'נגמר הזמן — אפשר לדלג על השחרור היום') + '</div></div>' +
      '<button id="gyCoolDone" class="gy-btn gy-pri mt-5" style="height:64px;font-size:19px;width:100%">✓ סיימתי</button>' +
      '<button id="gyCoolSkip" class="gy-btn mt-3" style="height:46px;width:100%">דילוג</button>';
  }
  function renderSum(){
    const done = L.items.filter(it=> it.status === 'done');
    const sets = done.reduce((a,it)=> a + (it.result.sets||[]).length, 0);
    const cnt = k=> done.filter(it=> it.verdict && it.verdict.kind === k).length;
    const row = (lbl, v, cls)=> '<div class="gy-card" style="padding:10px;text-align:center"><div class="gy-lbl">' + lbl + '</div><div class="gy-mid ' + (cls||'') + '">' + v + '</div></div>';
    const q = (lbl, key, max)=> '<div class="gy-card mt-3"><div class="font-black text-gray-100 mb-2">' + lbl + (L.sum[key]!=null?' · <span class="txt-green">' + L.sum[key] + '</span>':'') + '</div>' +
      '<div class="gy-rpe">' + Array.from({length:max+1}, (_,i)=> i).filter(i=> max===10 && key==='after' ? true : i>=1).map(i=> '<button class="gy-btn' + (L.sum[key]===i?' on':'') + '" data-q="' + key + '" data-v="' + i + '">' + i + '</button>').join('') + '</div></div>';
    L.sum = L.sum || {};
    let h = '<div class="gy-mid mt-3 mb-3">סיכום האימון</div>' + (L.stale ? '<div class="gy-card gy-warn mb-3" style="padding:10px;font-size:12px">האימון נשאר פתוח הרבה זמן, ולכן משך האימון נרשם לפי הערכה (' + sessionMinutes() + ' דק׳), בתאריך שבו התחיל.</div>' : '') + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' +
      row('משך', sessionMinutes() + ' דק׳') + row('תרגילים', done.length) + row('סטים', sets) +
      row('התקדמויות', cnt('up'), 'txt-green') + row('שמירה', cnt('same') + cnt('new'), 'txt-sky') + row('לבדיקה', cnt('down'), 'txt-amber') + '</div>';
    const deferred = L.items.filter(it=> it.status === 'busy' || it.status === 'deferred');
    const cut = L.items.filter(it=> it.status === 'cut');
    if(deferred.length || cut.length) h += '<div class="text-[12px] gy-mut mt-2">' + (deferred.length ? 'נדחה לאימון הבא: ' + deferred.map(it=> G.ex(it.exId).he).join(', ') + '. ' : '') + (cut.length ? 'קוצר בגלל זמן: ' + cut.map(it=> G.ex(it.exId).he).join(', ') + '.' : '') + '</div>';
    h += q('קושי כללי (1 עד 10)', 'overall', 10) + q('אנרגיה (1 עד 10)', 'energy', 10) + q('תפיסות אחרי האימון (0 עד 10)', 'after', 10);
    h += '<button id="gySave" class="gy-btn gy-pri mt-5" style="height:64px;font-size:19px;width:100%"' + (done.length?'':' disabled') + '>שמירת האימון</button>';
    if(!L.stale) h += '<button id="gyBack" class="gy-btn mt-3" style="height:44px;width:100%">חזרה לאימון</button>';
    if(!done.length) h += '<button id="gyDiscard" class="gy-btn gy-danger mt-3" style="height:44px;width:100%">יציאה בלי לשמור</button>';
    return h;
  }
  function renderSaved(){
    const nx = G.nextWorkout();
    return '<div class="text-center" style="margin-top:22vh"><div style="font-size:56px">✅</div><div class="gy-mid mt-2">האימון נשמר</div>' +
      (nx ? '<div class="gy-mut font-bold mt-3">אימון הכוח הבא:</div><div class="text-gray-100 font-black mt-1" style="font-size:18px">' + esc(nx.text) + '</div>' : '') +
      '</div><button id="gyClose" class="gy-btn gy-pri mt-8" style="height:60px;font-size:18px;width:100%">סגירה</button>';
  }
  function planSheet(){
    const icon = s=> ({ done:'✅', busy:'🚧', deferred:'⏭', cut:'✂️', skip:'⤼', todo:'○' })[s] || '○';
    return '<div class="gy-modal" id="gyPlanSheet"><div class="gy-sheet"><div class="gy-row mb-2" style="justify-content:space-between"><div class="font-black text-gray-100">התוכנית של היום · <bdi>Full Body ' + L.label + '</bdi></div><button class="gy-btn gy-chip" id="gyPlanClose">סגירה</button></div>' +
      '<ul class="gy-list">' + L.items.map((it,i)=>{
        const e = G.ex(it.exId);
        return '<li><span>' + icon(it.status) + '</span><span class="flex-1 ' + (i===L.cur?'txt-green font-black':'text-gray-100') + '">' + esc(e.he) + (it.sets===3?' · 3 סטים':'') + '</span><span class="gy-mut text-[11px]">' + esc(G.recLine(Object.assign({}, it.rec, {sets:it.sets}), e)) + '</span>' +
          ((it.status === 'todo' || it.status === 'busy' || it.status === 'deferred') && L.phase === 'ex' && i !== L.cur ? '<button class="gy-btn gy-chip" data-jump="' + i + '">לעבור</button>' : '') + '</li>';
      }).join('') + '</ul></div></div>';
  }
  function renderRest(){
    let rs = document.getElementById('gyRest');
    if(!L || !L.restEnd || !document.getElementById('gymLive')){ if(rs) rs.remove(); return; }
    if(!rs){ rs = document.createElement('div'); rs.id = 'gyRest'; rs.className = 'gy-rest'; document.body.appendChild(rs); }
    rs.innerHTML = '<div class="gy-row" style="justify-content:space-between"><span class="font-black text-gray-100">מנוחה</span><span class="gy-big" style="font-size:34px" id="gyRestLeft">' + mmss(L.restEnd - Date.now() + 999) + '</span>' +
      '<span class="gy-row"><button class="gy-btn gy-chip" id="gyRestPlus">+15</button><button class="gy-btn gy-chip" id="gyRestSkip">דילוג</button></span></div>';
    document.getElementById('gyRestPlus').onclick = ()=>{ L.restEnd += 15000; persist(); };
    document.getElementById('gyRestSkip').onclick = ()=>{ L.restEnd = null; persist(); renderRest(); };
  }

  // ---------- flow ----------
  function build(label){
    const plan = G.planSession({ soreness:L.soreness, areas: Object.keys(L.areas).length ? Object.fromEntries(Object.keys(L.areas).map(k=> [k, L.careful ? 10 : L.soreness])) : (L.careful ? {} : {}), minutes:L.minutes, label });
    L.label = plan.label; L.estMin = plan.estMin;
    L.items = plan.items.map(it=> Object.assign(it, { status:'todo', result:null, verdict:null }));
    L.planNote = (L.soreness >= 4 ? 'התאמה לתפיסות: בלי העלאות משקל באזור התפוס' : '');
  }
  function nextTodo(from){
    for(let i = from + 1; i < L.items.length; i++) if(L.items[i].status === 'todo') return i;
    for(let i = 0; i <= from && i < L.items.length; i++) if(L.items[i].status === 'todo') return i;
    return -1;
  }
  // Cut secondary exercises when the remaining plan no longer fits the time limit.
  function timeGuard(){
    const prio = it=>{ const e = G.ex(it.exId); return (e.big?3:0) + (e.slot==='core1'?2:0) + ({legs:2,glutes:2,core:1}[e.area]||0); };
    const cut = [];
    while(elapsed()/60000 + remainEst() + G.COOL > limitMin()){
      const cand = todo().filter(({it})=> !G.ex(it.exId).big && G.ex(it.exId).slot !== 'core1');
      if(!cand.length) break;
      cand.sort((a,b)=> prio(a.it) - prio(b.it));
      cand[0].it.status = 'cut'; cut.push(G.ex(cand[0].it.exId).he);
    }
    return cut.length ? 'כדי לסיים בזמן, ויתרנו היום על: ' + cut.join(', ') : '';
  }
  function advance(){
    L.draft = null; L.timing = null; L.swapOpen = false;
    const cutMsg = timeGuard();
    if(cutMsg && L.fb) L.fb.cut = cutMsg; else if(cutMsg) L.fb = { kind:'same', name:'זמן', line:'', verdict:cutMsg, next:'' };
    const n = nextTodo(L.cur);
    if(n >= 0){ L.cur = n; L.phase = 'ex'; }
    else {
      // Busy machines: offer them back only if still needed for balance and time allows.
      const bi = L.items.findIndex(it=> it.status === 'busy');
      if(bi >= 0){
        const it = L.items[bi], e = G.ex(it.exId);
        const covered = L.items.some(x=> x.status === 'done' && G.ex(x.exId).area === e.area);
        const fits = elapsed()/60000 + G.estMin(e, it.sets) + G.COOL <= limitMin();
        if(!covered && fits){ L.busyIdx = bi; L.phase = 'busy'; }
        else { it.status = 'deferred'; return advance(); }
      } else { L.phase = 'cool'; L.coolAt = Date.now(); }
    }
    persist(); render(); window.scrollTo && document.getElementById('gymLive') && (document.getElementById('gymLive').scrollTop = 0);
  }
  function completeCurrent(){
    const it = L.items[L.cur], e = G.ex(it.exId), d = L.draft;
    let sets;
    if(d.kind === 'time') sets = d.sets.map(s=> ({ kg:0, reps:0, sec:s.sec, rpe:s.rpe==null?undefined:s.rpe }));
    else if(d.perSet) sets = d.perSet.map(s=> ({ kg:+s.kg||0, reps:Math.max(0, Math.round(+s.reps||0)), rpe: (+s.rpe>0 ? +s.rpe : (d.rpe==null?undefined:d.rpe)) }));
    else sets = Array.from({length: Math.max(1, Math.round(+d.sets||1))}, ()=> ({ kg:+d.kg||0, reps:Math.max(0, Math.round(+d.reps||0)), rpe:d.rpe==null?undefined:d.rpe }));
    if(d.kind !== 'time' && !sets.some(s=> s.reps > 0)){ B().showToast('יש להזין חזרות'); return; }
    if(d.kind !== 'time' && d.rpe == null && !sets.some(s=> s.rpe)){ B().showToast('מה הקושי? לחיצה על מספר 1–10'); return; }
    const entry = { day: startDay(), sets };
    it.result = entry; it.status = 'done';
    it.verdict = G.evaluate(it.exId, entry, it.rec && it.rec.last);
    const nxt = G.recommend(it.exId, { last: entry });
    const st = G.entryStats(entry);
    L.fb = { kind: it.verdict.kind, name: e.he, line: G.setsLine(entry, e) + (st.rpe!=null?' · ' + G.rpeTxt(st.rpe):''), verdict: it.verdict.text, next: G.recLine(nxt, e) };
    advance();
  }

  function bind(el){
    const $q = s=> el.querySelector(s), on = (s, fn)=>{ const n = $q(s); if(n) n.onclick = fn; };
    // pre
    const sl = $q('#gySore');
    if(sl) sl.oninput = ()=>{ L.soreness = +sl.value; if(!L.soreness) L.areas = {}; persist(); render(); };
    on('#gyNoSore', ()=>{ L.soreness = 0; L.areas = {}; persist(); render(); });
    el.querySelectorAll('[data-area]').forEach(b=> b.onclick = ()=>{ const k = b.dataset.area; if(L.areas[k]) delete L.areas[k]; else L.areas[k] = 1; persist(); render(); });
    el.querySelectorAll('[data-flag]').forEach(b=> b.onclick = ()=>{ const i = +b.dataset.flag; L.flags = L.flags.includes(i) ? L.flags.filter(x=> x!==i) : L.flags.concat(i); L.careful = false; persist(); render(); });
    el.querySelectorAll('[data-min]').forEach(b=> b.onclick = ()=>{ L.minutes = +b.dataset.min; persist(); render(); });
    on('#gyCancel', ()=>{ G.liveSave(null); L = null; closeLive(); });
    on('#gyStopToday', ()=>{ G.liveSave(null); L = null; closeLive(); B().showToast('מנוחה זו גם החלטה טובה 💚'); });
    on('#gyCareful', ()=>{ L.careful = true; if(!Object.keys(L.areas).length && L.soreness < 6) L.soreness = 6; persist(); render(); });
    on('#gyBuild', ()=>{ build(null); L.phase = 'plan'; persist(); render(); });
    // plan
    el.querySelectorAll('[data-label]').forEach(b=> b.onclick = ()=>{ build(b.dataset.label); persist(); render(); });
    on('#gyShowPlan', ()=>{ L.showPlan = true; render(); });
    on('#gyPlanT', ()=>{ L.showPlan = true; render(); });
    on('#gyPlanClose', ()=>{ L.showPlan = false; render(); });
    const ps = $q('#gyPlanSheet'); if(ps) ps.onclick = ev=>{ if(ev.target === ps){ L.showPlan = false; render(); } };
    el.querySelectorAll('[data-jump]').forEach(b=> b.onclick = ()=>{ const i = +b.dataset.jump; if(L.items[i].status !== 'todo') L.items[i].status = 'todo'; L.cur = i; L.draft = null; L.showPlan = false; persist(); render(); });
    on('#gyGoWarm', ()=>{ L.phase = 'warm'; L.warmAt = Date.now(); persist(); render(); });
    on('#gySkipWarm', ()=>{ L.cur = -1; L.fb = null; advance(); });
    on('#gyWarmDone', ()=>{ L.warmMin = Math.round((Date.now() - L.warmAt)/60000); L.cur = -1; L.fb = null; advance(); });
    on('#gyEnd', ()=>{ L.phase = 'sum'; L.showPlan = false; persist(); render(); });
    // exercise
    el.querySelectorAll('[data-step]').forEach(b=> b.onclick = ()=>{
      const k = b.dataset.step, dir = +b.dataset.dir, d = L.draft, e = G.ex(L.items[L.cur].exId);
      if(k === 'kg') d.kg = dir > 0 ? G.stepUp(e, +d.kg||0) : G.stepDown(e, +d.kg||0);
      if(k === 'sets') d.sets = Math.max(1, Math.min(6, (+d.sets||0) + dir));
      if(k === 'reps') d.reps = Math.max(1, Math.min(50, (+d.reps||0) + dir));
      if(d.perSet) syncPerSet();
      persist(); render();
    });
    el.querySelectorAll('[data-field]').forEach(inp=> inp.onchange = ()=>{ const d = L.draft; const v = parseFloat(inp.value); if(!(v>=0)) return; d[inp.dataset.field] = inp.dataset.field==='kg' ? v : Math.round(v); if(d.perSet) syncPerSet(); persist(); render(); });
    el.querySelectorAll('[data-rpegrid] [data-rpe]').forEach(b=> b.onclick = ()=>{
      const i = +b.dataset.rpe, grid = b.parentElement.dataset.rpegrid, d = L.draft;
      const cur = grid === 'time' ? d.sets[d.sets.length-1].rpe : d.rpe;
      const v = (cur != null && Math.floor(cur) === i && cur % 1 === 0 && i < 10) ? i + 0.5 : i;
      if(grid === 'time') d.sets[d.sets.length-1].rpe = v; else { d.rpe = v; if(d.perSet) d.perSet.forEach(s=>{ if(s.rpe==null||s.rpe==='') s.rpe = v; }); }
      persist(); render();
    });
    on('#gyPerSet', ()=>{ const d = L.draft; d.perSet = d.perSet ? null : Array.from({length:+d.sets||2}, ()=> ({ kg:d.kg, reps:d.reps, rpe:d.rpe })); persist(); render(); });
    el.querySelectorAll('[data-ps]').forEach(inp=> inp.onchange = ()=>{ const s = L.draft.perSet[+inp.dataset.ps]; const v = inp.value === '' ? null : parseFloat(inp.value); s[inp.dataset.k] = v; persist(); });
    on('#gyDone', ()=> completeCurrent());
    on('#gyGo', ()=>{ L.timing = Date.now(); persist(); render(); });
    on('#gyStop', ()=>{ const sec = Math.round((Date.now() - L.timing)/1000); L.timing = null; if(sec >= 3) L.draft.sets.push({ sec, rpe:null }); try{ navigator.vibrate && navigator.vibrate(80); }catch(_){} persist(); render(); });
    on('#gyRestBtn', ()=>{ const e = G.ex(L.items[L.cur].exId); L.restEnd = Date.now() + (e.rest||75)*1000; persist(); renderRest(); });
    on('#gyBusy', ()=>{ L.items[L.cur].status = 'busy'; L.fb = null; advance(); });
    on('#gySkip', ()=>{ L.items[L.cur].status = 'skip'; L.fb = null; advance(); });
    on('#gySwap', ()=>{ L.swapOpen = !L.swapOpen; render(); });
    el.querySelectorAll('[data-swap]').forEach(b=> b.onclick = ()=>{
      const it = L.items[L.cur]; const id = b.dataset.swap;
      it.exId = id; it.rec = G.recommend(id) || {}; it.rec.sets = it.sets; L.draft = null; L.swapOpen = false; persist(); render();
    });
    const fb = $q('#gyFb'); if(fb) fb.onclick = ()=>{ L.fb = null; persist(); render(); };
    // busy return
    on('#gyBusyYes', ()=>{ const i = L.busyIdx; L.items[i].status = 'todo'; L.cur = i; L.phase = 'ex'; L.draft = null; L.fb = null; persist(); render(); });
    on('#gyBusyNo', ()=>{ L.items[L.busyIdx].status = 'deferred'; advance(); });
    // cool + summary
    on('#gyCoolDone', ()=>{ L.phase = 'sum'; persist(); render(); });
    on('#gyCoolSkip', ()=>{ L.phase = 'sum'; persist(); render(); });
    el.querySelectorAll('[data-q]').forEach(b=> b.onclick = ()=>{ L.sum[b.dataset.q] = +b.dataset.v; persist(); render(); });
    on('#gyBack', ()=>{ const n = nextTodo(-1); if(n >= 0){ L.cur = n; L.phase = 'ex'; } else L.phase = 'cool'; persist(); render(); });
    on('#gyDiscard', ()=>{ G.liveSave(null); L = null; closeLive(); });
    on('#gySave', ()=> saveSession());
    on('#gyClose', ()=>{ G.liveSave(null); L = null; closeLive(); });
  }
  function syncPerSet(){
    const d = L.draft; const n = Math.max(1, +d.sets||1);
    d.perSet = Array.from({length:n}, (_,i)=> d.perSet[i] ? Object.assign(d.perSet[i], { kg:d.kg, reps:d.reps }) : { kg:d.kg, reps:d.reps, rpe:d.rpe });
  }

  // Duration: the clock, capped at the session limit + 15; for a session left open
  // for hours, the sum of what was actually done.
  function sessionMinutes(){
    const est = Math.round((L.warmMin || 0) + L.items.filter(it=> it.status === 'done').reduce((a,it)=> a + G.estMin(G.ex(it.exId), (it.result && it.result.sets || []).length || it.sets), 0) + G.COOL);
    if(L.stale) return Math.max(1, est);
    return Math.max(1, Math.min(Math.round(elapsed()/60000), limitMin() + 15));
  }
  function startDay(){ const d = new Date(L.startedAt); return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
  function saveSession(){
    if(!L || L.phase === 'saved' || L.saving) return;
    const b = B(); const today = startDay();
    const done = L.items.filter(it=> it.status === 'done');
    if(!done.length) return;
    L.saving = true;
    const minutes = sessionMinutes();
    const ov = L.sum.overall;
    const level = ov == null ? 'mid' : ov <= 5 ? 'low' : ov <= 7.5 ? 'mid' : 'high';
    const id = b.uid();
    const w = { id, type:'gym', level, minutes, kcal: b.estKcal('gym', level, minutes), kcalNet: b.estKcalNet('gym', level, minutes),
      note: 'Full Body ' + L.label + ' · ' + done.length + ' תרגילים',
      exercises: done.map(it=> ({ name: G.exName(G.ex(it.exId)), exId: it.exId, sets: it.result.sets })) };
    const S = G.state();
    S.sessions[id] = { day: today, label: L.label, soreness: L.soreness, areas: Object.keys(L.areas), flags: L.flags.map(i=> FLAGS[i]),
      overall: L.sum.overall, energy: L.sum.energy, after: L.sum.after, durationMin: minutes, warmMin: L.warmMin || 0,
      deferred: L.items.filter(it=> it.status === 'busy' || it.status === 'deferred').map(it=> it.exId),
      cut: L.items.filter(it=> it.status === 'cut').map(it=> it.exId),
      skipped: L.items.filter(it=> it.status === 'skip').map(it=> it.exId),
      verdicts: Object.fromEntries(done.map(it=> [it.exId, it.verdict && it.verdict.kind])), at: Date.now() };
    G.save();
    b.addWorkout(w, today);
    L.phase = 'saved'; persist(); render();
  }
})();
