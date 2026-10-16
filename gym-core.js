// Munch & Move — gym engine: exercise library, history, double progression, rotation.
// Loaded before the main app script. Everything hangs off window.Gym and only touches
// the app through the bridge handed to Gym.init() (B), so the 10k-line main script
// stays untouched apart from a few hook calls.
(function(){
  'use strict';
  const G = window.Gym = window.Gym || {};
  let B = null;                                   // bridge to the main app (set in init)
  const GKEY = 'macro_gym';                       // synced (user_state key 'gym')
  const LIVEKEY = 'macro_gym_live';               // local only: an in-progress session

  // ---------- Weight steps ----------
  const lin = (a, b, s)=>{ const r=[]; for(let x=a; x<=b+1e-9; x=Math.round((x+s)*100)/100) r.push(x); return r; };
  const STACK = [9,14,18,23,27,32,36,41,45,50,54,59,64,68,73,77,82,86,91];
  const UPPER = [5,9,14,19,23,27,32,36,41,45,50];

  // ---------- Exercise library ----------
  // route = order along the gym loop (free area → leg press → hip thrust → hips →
  // kickback → upper body). slot = what the exercise replaces in rotation.
  const BASE_LIB = [
    { id:'bird_dog',      he:'בירד דוג',            en:'Bird Dog',       area:'core',      slot:'core2',     route:1,   kind:'reps', perSide:true, lo:10, hi:12, steps:[0,1.25,2,2.5,3,4], rest:60, icon:'🐕' },
    { id:'dead_bug',      he:'דד באג',              en:'Dead Bug',       area:'core',      slot:'core2',     route:1.5, kind:'reps', perSide:true, lo:10, hi:12, steps:[0,1.25,2,2.5,3],   rest:60, icon:'🪲' },
    { id:'box_squat',     he:'סקוואט לקופסה',       en:'Box Squat',      area:'legs',      slot:'quad',      route:2,   kind:'reps', lo:10, hi:12, steps:[0,4,6,8,10,12,14,16,18,20,22,24], rest:90, big:true, icon:'📦' },
    { id:'plank',         he:'פלאנק על הרצפה',      en:'Plank',          area:'core',      slot:'core1',     route:3,   kind:'time', lo:55, hi:60, rest:60, icon:'🧱' },
    { id:'plank_bench',   he:'פלאנק מוגבה (ספסל/קופסה)', en:'Plank (raised)', area:'core', slot:'core1',     route:3,   kind:'time', active:false, note:'מוצה — עברנו לפלאנק על הרצפה', icon:'🧱' },
    { id:'leg_press',     he:'לחיצת רגליים',        en:'Leg Press',      area:'legs',      slot:'quad',      route:4,   kind:'reps', lo:10, hi:15, steps:lin(5,120,2.5), rest:90, big:true, icon:'🦵' },
    { id:'leg_curl',      he:'כפיפת ברכיים',        en:'Leg Curl',       area:'legs',      slot:'post',      route:4.5, kind:'reps', lo:10, hi:15, steps:STACK, rest:75, icon:'🦵' },
    { id:'hip_thrust',    he:'הרמת אגן במכונה',     en:'Hip Thrust',     area:'glutes',    slot:'post',      route:5,   kind:'reps', lo:10, hi:12, steps:lin(0,120,2.5), rest:90, big:true, icon:'🍑' },
    { id:'hip_abductor',  he:'הרחקת ירך',           en:'Hip Abductor',   area:'glutes',    slot:'hips',      route:6,   kind:'reps', lo:10, hi:15, steps:STACK, rest:60, icon:'↔️' },
    { id:'hip_adductor',  he:'קירוב ירך',           en:'Hip Adductor',   area:'legs',      slot:'hips',      route:6.1, kind:'reps', lo:10, hi:15, steps:STACK, rest:60, icon:'↔️' },
    { id:'kickback',      he:'קיקבק במכונה',        en:'Kickback',       area:'glutes',    slot:'post',      route:7,   kind:'reps', lo:10, hi:15, steps:STACK, rest:60, icon:'🍑' },
    { id:'row',           he:'חתירה',               en:'Row',            area:'back',      slot:'back',      route:8,   kind:'reps', lo:10, hi:15, steps:STACK, rest:90, big:true, icon:'🚣' },
    { id:'selector_row',  he:'חתירה בסלקטור',       en:'Selector Row',   area:'back',      slot:'back',      route:8.1, kind:'reps', lo:10, hi:15, steps:STACK, rest:90, big:true, icon:'🚣' },
    { id:'machine_pull',  he:'משיכה במכונה',        en:'Machine Pull',   area:'back',      slot:'back',      route:8.15,kind:'reps', lo:10, hi:15, steps:STACK, rest:90, active:false, note:'מכונה נפרדת — לא להשוות משקלים לחתירה אחרת', icon:'🚣' },
    { id:'lat_pulldown',  he:'פולי עליון',          en:'Lat Pulldown',   area:'back',      slot:'back',      route:8.2, kind:'reps', lo:10, hi:15, steps:STACK, rest:90, big:true, icon:'⬇️' },
    { id:'chest_press',   he:'לחיצת חזה',           en:'Chest Press',    area:'chest',     slot:'chest',     route:8.3, kind:'reps', lo:10, hi:12, steps:UPPER, rest:90, big:true, icon:'💪' },
    { id:'pec_fly',       he:'פרפר',                en:'Pec Fly',        area:'chest',     slot:'chest',     route:8.4, kind:'reps', lo:10, hi:15, steps:UPPER, rest:75, icon:'🦋' },
    { id:'shoulder_press',he:'לחיצת כתפיים',        en:'Shoulder Press', area:'shoulders', slot:'shoulders', route:8.5, kind:'reps', lo:10, hi:12, steps:UPPER, rest:90, big:true, icon:'🙌' },
    { id:'biceps_curl',   he:'כפיפת מרפקים',        en:'Biceps Curl',    area:'arms',      slot:'arms',      route:8.6, kind:'reps', lo:10, hi:15, steps:UPPER, rest:60, active:false, note:'לא לשבץ עד שתימצא מכונה מתאימה', icon:'💪' },
  ];
  const ALIASES = {
    bird_dog:['bird dog','בירד דוג','birddog'], dead_bug:['dead bug','דד באג'],
    box_squat:['box squat','סקוואט','סקוואט לקופסה'], plank:['plank floor','פלאנק על הרצפה','פלאנק רצפה'],
    plank_bench:['plank','פלאנק','פלאנק על ספסל','פלאנק על קופסה','plank on platform'],
    leg_press:['leg press','לחיצת רגליים','לג פרס'], leg_curl:['leg curl','כפיפת ברכיים','כפיפת ברך'],
    hip_thrust:['hip thrust','הרמת אגן','היפ תראסט'], hip_abductor:['abductor','hip abductor','הרחקת ירך','הרחקה'],
    hip_adductor:['adductor','hip adductor','קירוב ירך','קירוב'], kickback:['kickback','קיקבק'],
    row:['row','חתירה'], selector_row:['selector row','חתירה בסלקטור'], machine_pull:['machine pull','משיכה במכונה'],
    lat_pulldown:['lat pulldown','פולי עליון','פולי'], chest_press:['chest press','לחיצת חזה'],
    pec_fly:['pec fly','פרפר','פק דק'], shoulder_press:['shoulder press','לחיצת כתפיים'], biceps_curl:['biceps','בייספס','כפיפת מרפקים'],
  };
  const AREAS = { legs:'רגליים', glutes:'ישבן', back:'גב', chest:'חזה', shoulders:'כתפיים', core:'ליבה', arms:'זרועות' };
  const EMPHASIS = { legs:1, glutes:1, core:1, arms:1 };
  const DEFAULT_TEMPLATES = {
    A:['bird_dog','plank','leg_press','hip_thrust','hip_abductor','row','pec_fly','shoulder_press'],
    B:['box_squat','plank','leg_curl','kickback','hip_adductor','lat_pulldown','chest_press','shoulder_press'],
  };

  // ---------- State ----------
  function defaultState(){
    return { v:1, lib:{}, custom:[], templates:JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
      sessions:{}, activities:{}, requests:[], seeded:0, prefsAt:0, templatesAt:0,
      prefs:{ minutes:55, max:60, strengthTarget:4, pilatesTarget:2, restDay:null, trainerDay:null } };
  }
  let S = defaultState();
  function loadState(){
    try{ const v = JSON.parse(localStorage.getItem(GKEY)); if(v && typeof v==='object') S = normalize(v); }catch(_){}
  }
  function normalize(v){
    const d = defaultState();
    const o = Object.assign(d, v || {});
    ['lib','sessions','activities'].forEach(k=>{ if(!o[k] || typeof o[k]!=='object' || Array.isArray(o[k])) o[k] = {}; });
    if(!Array.isArray(o.custom)) o.custom = [];
    if(!Array.isArray(o.requests)) o.requests = [];
    if(!o.templates || typeof o.templates!=='object') o.templates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
    o.prefs = Object.assign(defaultState().prefs, o.prefs || {});
    return o;
  }
  function saveState(){
    invalidate();
    try{ localStorage.setItem(GKEY, JSON.stringify(S)); }catch(_){}
    if(B) B.pushState('gym');
  }
  // Caches: the library and the derived history are rebuilt at most once per render.
  let _lib = null, _hist = null, _match = new Map();
  function invalidate(){ _lib = null; _hist = null; _match = new Map(); }
  G.invalidate = invalidate;
  G.touchPrefs = ()=>{ S.prefsAt = Date.now(); };
  G.touchTemplates = ()=>{ S.templatesAt = Date.now(); };
  G.state = ()=> S;
  G.save = saveState;
  // Cloud sync hooks (called by the main app's user_state machinery).
  G.stateValue = ()=> S;
  G.adopt = v=>{ if(v && typeof v==='object'){ S = normalize(v); invalidate(); try{ localStorage.setItem(GKEY, JSON.stringify(S)); }catch(_){} } };
  G.merge = v=>{
    if(!v || typeof v!=='object') return false;
    const c = normalize(v); let ch = false;
    ['sessions','activities'].forEach(k=> Object.keys(c[k]).forEach(id=>{ if(!S[k][id]){ S[k][id] = c[k][id]; ch = true; } }));
    Object.keys(c.lib).forEach(id=>{
      const a = S.lib[id], b = c.lib[id];
      if(!a || (+b.at||0) > (+a.at||0)){ S.lib[id] = b; ch = true; }
    });
    const have = new Set(S.custom.map(x=>x.id));
    c.custom.forEach(x=>{ if(x && x.id && !have.has(x.id)){ S.custom.push(x); ch = true; } });
    const rq = new Set(S.requests.map(x=>x.id));
    c.requests.forEach(x=>{ if(x && x.id && !rq.has(x.id)){ S.requests.push(x); ch = true; } });
    if((+c.seeded||0) > (+S.seeded||0)){ S.seeded = c.seeded; ch = true; }
    // Prefs and templates are whole values: the newer edit wins. A device that never
    // touched them (at = 0) always takes the other copy, so a fresh login can't push
    // defaults over the real settings.
    if((+c.prefsAt||0) > (+S.prefsAt||0)){ S.prefs = c.prefs; S.prefsAt = c.prefsAt; ch = true; }
    if((+c.templatesAt||0) > (+S.templatesAt||0)){ S.templates = c.templates; S.templatesAt = c.templatesAt; ch = true; }
    if(ch){ invalidate(); try{ localStorage.setItem(GKEY, JSON.stringify(S)); }catch(_){} }
    return ch;
  };

  // ---------- Library access ----------
  function libAll(){
    if(_lib) return _lib;
    const base = BASE_LIB.concat(S.custom || []);
    _lib = base.map(e=> Object.assign({}, e, (S.lib||{})[e.id] || {}))
      .map(e=> Object.assign(e, { active: e.active !== false }));
    return _lib;
  }
  function ex(id){ return libAll().find(e=> e.id === id) || null; }
  function exName(e){ return e ? (e.he + (e.en ? ' (' + e.en + ')' : '')) : ''; }
  function setLib(id, patch){
    S.lib[id] = Object.assign({}, S.lib[id] || {}, patch, { at: Date.now() });
    saveState();
  }
  G.lib = libAll; G.ex = ex; G.exName = exName; G.setLib = setLib; G.AREAS = AREAS;

  const norm = s=> String(s||'').toLowerCase().replace(/\(.*?\)/g, m=> ' ' + m.slice(1,-1) + ' ').replace(/[^֐-׿a-z0-9 .]/g,' ').replace(/\s+/g,' ').trim();
  // Map a free-text exercise name (manual log, assistant, old data) to a library id.
  // WHOLE-NAME matches only: "Narrow grip press" must never become "row", and
  // "Plank shoulder taps" must never become a timed plank. "שם (English)" matches on
  // either half.
  function matchId(name){
    const raw = String(name||'');
    if(_match.has(raw)) return _match.get(raw);
    const parts = new Set([norm(raw)]);
    const m = raw.match(/^(.*?)\((.*?)\)\s*$/);
    if(m){ parts.add(norm(m[1])); parts.add(norm(m[2])); }
    parts.delete('');
    let found = null;
    if(parts.size){
      for(const e of libAll()){
        const keys = [e.he, e.en, exName(e)].concat(ALIASES[e.id] || []).concat(e.aliases || []).map(norm).filter(Boolean);
        if(keys.some(k=> parts.has(k))){ found = e.id; break; }
      }
    }
    _match.set(raw, found);
    return found;
  }
  G.matchId = matchId;

  // ---------- History ----------
  // Every strength entry from every workout, newest first:
  // { day, woId, exId, name, sets:[{kg,reps,sec,rpe,note}], trainer }
  function history(){
    if(_hist) return _hist;
    const out = [];
    const all = B ? B.workouts() : {};
    Object.keys(all || {}).forEach(day=>{
      (Array.isArray(all[day]) ? all[day] : []).forEach(w=>{
        (Array.isArray(w && w.exercises) ? w.exercises : []).forEach((e, i)=>{
          if(!e || !Array.isArray(e.sets)) return;
          let id = e.exId || matchId(e.name);
          const sets = e.sets.filter(s=> s && ((+s.reps>0) || (+s.sec>0) || (+s.kg>0)));
          if(!sets.length) return;
          // A timed exercise logged with reps only (an old "Plank 2×12") isn't a time.
          const lx = id ? libAll().find(x=> x.id === id) : null;
          if(lx && lx.kind === 'time' && !sets.some(s=> +s.sec > 0)) id = null;
          const meta = S.sessions[w.id] || {};
          out.push({ day, woId:w.id, idx:i, exId:id, name:e.name, sets, trainer:!!meta.trainer, sore: meta.soreness });
        });
      });
    });
    out.sort((a,b)=> a.day < b.day ? 1 : a.day > b.day ? -1 : 0);
    _hist = out;
    return out;
  }
  function historyOf(id){ return history().filter(h=> h.exId === id); }
  G.history = history; G.historyOf = historyOf;

  // ---------- Entry math ----------
  function entryStats(entry){
    const sets = (entry && entry.sets) || [];
    const kgs = sets.map(s=> +s.kg || 0);
    const top = Math.max(0, ...kgs);
    const work = sets.filter(s=> (+s.kg||0) === top);
    // "Mixed" = a NEW weight tried on a single set (14 → 19). Lighter sets next to two
    // or more sets at the top weight are just warm-ups and don't freeze progression.
    const reps = work.map(s=> +s.reps || 0).filter(r=> r > 0);
    const rpes = work.map(s=> +s.rpe).filter(r=> r > 0);
    const secs = sets.map(s=> +s.sec || 0).filter(x=> x > 0);
    return {
      top, nSets: sets.length, mixed: new Set(kgs).size > 1 && work.length === 1,
      minReps: reps.length ? Math.min(...reps) : 0, maxReps: reps.length ? Math.max(...reps) : 0,
      rpe: rpes.length ? Math.max(...rpes) : null,
      bestSec: secs.length ? Math.max(...secs) : 0,
      volume: sets.reduce((a,s)=> a + (+s.kg||0)*(+s.reps||0), 0),
    };
  }
  G.entryStats = entryStats;
  const r1 = n=> Math.round(n*10)/10;
  const r2 = n=> Math.round(n*100)/100;
  const fmtKg = n=> (n===0 ? 'משקל גוף' : (r2(n) + ' ק״ג'));
  const fmtSec = s=>{ s = Math.round(+s||0); return Math.floor(s/60) + ':' + String(s%60).padStart(2,'0'); };
  function setsLine(entry, e){
    const sets = entry.sets || [];
    if(e && e.kind === 'time') return sets.map(s=> fmtSec(s.sec)).join(' + ');
    const st = entryStats(entry);
    if(st.mixed) return sets.map(s=> (s.kg? r2(s.kg) : 0) + '×' + (s.reps||'?')).join(', ') + ' ק״ג';
    const reps = sets.map(s=> +s.reps||0);
    const same = reps.every(r=> r === reps[0]);
    return fmtKg(st.top) + ' · ' + (same ? sets.length + '×' + (reps[0]||'?') : reps.join('/')) + (e && e.perSide ? ' לכל צד' : '');
  }
  G.fmtKg = fmtKg; G.fmtSec = fmtSec; G.setsLine = setsLine; G.r1 = r1;
  const rpeTxt = r=> (r==null ? '' : 'קושי ' + r1(r));
  G.rpeTxt = rpeTxt;

  function stepUp(e, kg){ const s = (e.steps||[]).filter(x=> x > kg + 1e-9); return s.length ? s[0] : r1(kg + (kg < 20 ? 2.5 : 5)); }
  function stepDown(e, kg){ const s = (e.steps||[]).filter(x=> x < kg - 1e-9); return s.length ? s[s.length-1] : Math.max(0, r1(kg - 2.5)); }
  G.stepUp = stepUp; G.stepDown = stepDown;

  // ---------- Double progression ----------
  // Returns today's target for an exercise from its last performance.
  //   action: 'increase' | 'reps' | 'maintain' | 'reduce' | 'new'
  function recommend(id, opts){
    const e = ex(id); if(!e) return null;
    const h = historyOf(id).filter(x=> !(opts && opts.exceptWo && x.woId === opts.exceptWo));
    const last = (opts && opts.last) || h[0] || null;
    const lo = +e.lo || 10, hi = +e.hi || 15;
    const ov = (S.lib[id] || {}).work;                 // manual working-weight override
    const ovFresh = ov && !(opts && opts.last) && (!last || (ov.day || '') >= last.day);
    if(e.kind === 'time'){
      const best = last ? entryStats(last).bestSec : 0;
      const rpe = last ? entryStats(last).rpe : null;
      if(ovFresh && ov.sec) return { kind:'time', sec:ov.sec, sets:2, lo:ov.sec, hi:ov.sec+5, action:'maintain', why:'יעד שנקבע ידנית', last };
      if(!best) return { kind:'time', sec:e.lo || 30, sets:2, lo:e.lo||30, hi:e.hi||45, action:'new', why:'פעם ראשונה — לאסוף נתון', last };
      if(rpe!=null && rpe >= 8) return { kind:'time', sec:best, sets:2, lo:Math.max(10,best-5), hi:best, action:'maintain', why:'היה קשה — לשמור על הזמן', last };
      if(rpe!=null && rpe >= 7.5) return { kind:'time', sec:best, sets:2, lo:best, hi:best+5, action:'maintain', why:'קשה אבל תקין — אותו זמן', last };
      return { kind:'time', sec:best+5, sets:2, lo:best+5, hi:best+10, action:'reps', why:'עוד 5–10 שניות', last };
    }
    if(ovFresh && ov.kg != null){
      const reps = ov.reps || lo;
      return { kind:'reps', kg:+ov.kg, reps, sets:2, lo, hi, action:'maintain', why:'משקל עבודה שנקבע ידנית', last };
    }
    if(!last) return { kind:'reps', kg:(e.steps && e.steps.length ? e.steps[0] : 0), reps:lo, sets:2, lo, hi, action:'new', why:'פעם ראשונה — לבחור משקל שמרגיש 6–7', last:null };
    const st = entryStats(last);
    const reps = st.minReps || lo;
    // No difficulty recorded: never raise the weight on a guess.
    if(st.rpe == null){
      if(reps >= hi) return { kind:'reps', kg:st.top, reps:hi, sets:2, lo, hi, action:'maintain', why:'לא נרשם קושי — לסמן קושי, ואם זה 6–7 עולים בפעם הבאה', last };
      return { kind:'reps', kg:st.top, reps:Math.min(hi, reps+1), sets:2, lo:Math.min(hi, reps+1), hi, action:'reps', why:'אותו משקל, עוד חזרה', last };
    }
    const rpe = st.rpe;
    if(st.mixed) return { kind:'reps', kg:st.top, reps:Math.min(Math.max(reps, lo), hi), sets:2, lo, hi:Math.min(hi, lo+2), action:'maintain', why:'משקל חדש בבדיקה — לבסס אותו', last };
    if(rpe >= 9.5 || (rpe >= 9 && reps < lo)) return { kind:'reps', kg:stepDown(e, st.top), reps:lo, sets:2, lo, hi, action:'reduce', why:'היה ממש בקצה — להוריד מדרגה', last };
    if(rpe >= 8.5) return { kind:'reps', kg:st.top, reps:lo, sets:2, lo, hi:Math.min(hi, lo+2), action:'reduce', why:'קרוב לקצה — אותו משקל, פחות חזרות, נקי', last };
    if(rpe >= 8) return { kind:'reps', kg:st.top, reps:Math.min(reps, hi), sets:2, lo, hi, action:'maintain', why:'קשה — לא להעלות', last };
    if(rpe >= 7.5) return { kind:'reps', kg:st.top, reps:Math.min(reps, hi), sets:2, lo, hi, action:'maintain', why:'קשה אבל תקין — לא למהר', last };
    if(reps >= hi) return { kind:'reps', kg:stepUp(e, st.top), reps:lo, sets:2, lo, hi:Math.min(hi, lo+2), action:'increase', why:'הגעת ל-' + hi + ' בקושי ' + r1(rpe) + ' — עולים מדרגה', last };
    const next = Math.min(hi, reps + (rpe <= 6.5 ? 2 : 1));
    return { kind:'reps', kg:st.top, reps:next, sets:2, lo:Math.min(hi, reps+1), hi, action:'reps', why:'אותו משקל, עוד חזרות (' + Math.min(hi,reps+1) + '–' + hi + ')', last };
  }
  G.recommend = recommend;
  G.recLine = function(rec, e){
    if(!rec) return '';
    if(rec.kind === 'time') return fmtSec(rec.sec) + ' × ' + rec.sets + ' · יעד ' + rec.lo + '–' + rec.hi + ' שנ׳';
    const rng = rec.lo === rec.hi ? rec.lo : rec.lo + '–' + rec.hi;
    return fmtKg(rec.kg) + ' · ' + rec.sets + '×' + rng + (e && e.perSide ? ' לכל צד' : '');
  };
  G.readiness = function(id){
    const rec = recommend(id); if(!rec || !rec.last) return null;
    const map = { increase:'הבא: מדרגת משקל', reps:'מוסיפים חזרות', maintain:'מבססים', reduce:'להקל', new:'' };
    return { rec, word: map[rec.action] || '' };
  };

  // Compare today's entry with the previous one → verdict line for the live screen.
  function evaluate(id, today, prev){
    const e = ex(id) || {};
    const a = entryStats(today);
    if(!prev) return { kind:'new', text:'נרשם בפעם הראשונה — מכאן מודדים התקדמות' };
    const b = entryStats(prev);
    if(e.kind === 'time'){
      if(a.bestSec > b.bestSec) return { kind:'up', text:'↑ שיפור: ' + fmtSec(a.bestSec) + ' לעומת ' + fmtSec(b.bestSec) };
      if(a.rpe!=null && b.rpe!=null && a.rpe <= b.rpe - 0.5 && a.bestSec >= b.bestSec) return { kind:'up', text:'↑ שיפור: אותו זמן בקושי נמוך יותר' };
      return { kind:'same', text:'= שמירה על הזמן' };
    }
    if(a.rpe != null && a.rpe >= 9) return { kind:'down', text:'↓ קרוב לקצה — בפעם הבאה להקל' };
    if(a.top > b.top) return { kind:'up', text:'↑ שיפור: משקל עלה מ-' + r1(b.top) + ' ל-' + r1(a.top) + ' ק״ג' };
    if(a.top < b.top) return { kind:'same', text:'משקל נמוך מהפעם הקודמת (' + r1(b.top) + ')' };
    if(a.minReps > b.minReps) return { kind:'up', text:'↑ שיפור: ' + (a.minReps - b.minReps) + ' חזרות יותר באותו משקל' };
    if(a.nSets > b.nSets && a.minReps >= b.minReps) return { kind:'up', text:'↑ שיפור: עוד סט' };
    if(a.minReps === b.minReps && a.rpe != null && b.rpe != null && a.rpe <= b.rpe - 0.5)
      return { kind:'up', text:'↑ שיפור: אותו ביצוע, הקושי ירד מ-' + r1(b.rpe) + ' ל-' + r1(a.rpe) };
    if(a.minReps < b.minReps) return { kind:'same', text:'פחות חזרות מהפעם הקודמת — זה קורה' };
    return { kind:'same', text:'= שמירה' };
  }
  G.evaluate = evaluate;

  // ---------- Time estimates ----------
  function estMin(e, sets){
    if(!e) return 4;
    const n = sets || 2;
    const work = e.kind === 'time' ? ((+e.hi||60)/60) : (e.perSide ? 1.4 : 0.8);
    return Math.round((1 + n*work + Math.max(0, n-1)*((+e.rest||75)/60) + (+e.rest||75)/120) * 10) / 10;
  }
  G.estMin = estMin;
  const WARM = 6, COOL = 4;
  G.WARM = WARM; G.COOL = COOL;

  // ---------- Rotation ----------
  function lastDoneDay(id, h){ const x = h.find(r=> r.exId === id); return x ? x.day : null; }
  function daysSince(day){ if(!day || !B) return 99; return Math.round((B.dateFromKey(B.todayKey()) - B.dateFromKey(day)) / 864e5); }
  function recentCount(id, h, days){ const cut = B.shiftKey(B.todayKey(), -days); return h.filter(r=> r.exId === id && r.day >= cut).length; }
  function selfSessions(){
    const all = B ? B.workouts() : {};
    const out = [];
    Object.keys(S.sessions).forEach(id=>{
      const m = S.sessions[id];
      if(!m || m.trainer || !m.label) return;
      const day = m.day || Object.keys(all).find(d=> (all[d]||[]).some(w=> w.id === id));
      if(day) out.push(Object.assign({ id, day }, m));
    });
    return out.sort((a,b)=> a.day < b.day ? -1 : a.day > b.day ? 1 : (a.at||0) - (b.at||0));
  }
  G.selfSessions = selfSessions;
  function nextLabel(){
    const ss = selfSessions();
    if(ss.length){ const l = ss[ss.length-1].label; return l === 'A' ? 'B' : l === 'B' ? 'C' : 'A'; }
    // First time: start from whichever template was done less recently.
    const h = history();
    const age = t=> (S.templates[t]||[]).reduce((a,id)=> a + Math.min(30, daysSince(lastDoneDay(id, h))), 0);
    return age('A') >= age('B') ? 'A' : 'B';
  }
  G.nextLabel = nextLabel;
  // Pick the best exercise for a slot: least recently done, least done lately.
  function bestForSlot(slot, used, h){
    const cands = libAll().filter(e=> e.active && e.slot === slot && !used.has(e.id) && !isPaused(e));
    if(!cands.length) return null;
    cands.sort((a,b)=> score(b, h) - score(a, h));
    return cands[0].id;
  }
  function score(e, h){ return Math.min(30, daysSince(lastDoneDay(e.id, h))) - 3*recentCount(e.id, h, 10) + (e.big ? 1 : 0); }
  function isPaused(e){ return !!(e.pausedUntil && B && e.pausedUntil > B.todayKey()); }
  G.isPaused = isPaused;

  // Build today's session. opts: { soreness, areas:{area:0-10}, minutes, label }
  function planSession(opts){
    opts = opts || {};
    const h = history();
    const label = opts.label || nextLabel();
    const lib = libAll();
    const byId = id=> lib.find(e=> e.id === id);
    let ids;
    if(label === 'C'){
      const used = new Set(); ids = [];
      ['core1','quad','post','hips','back','chest','shoulders'].forEach(sl=>{ const id = bestForSlot(sl, used, h); if(id){ ids.push(id); used.add(id); } });
      // flexible 8th: second glute/hamstring move or a core move — whichever waited longer
      const p2 = bestForSlot('post', used, h), c2 = bestForSlot('core2', used, h);
      const pick = (p2 && c2) ? (score(byId(p2), h) >= score(byId(c2), h) ? p2 : c2) : (p2 || c2);
      if(pick) ids.push(pick);
    } else {
      ids = (S.templates[label] || DEFAULT_TEMPLATES[label] || []).slice();
    }
    // inactive / paused → same-slot replacement
    const used = new Set();
    ids = ids.map(id=>{
      const e = byId(id);
      if(e && e.active && !isPaused(e) && !used.has(id)){ used.add(id); return id; }
      const rep = e ? bestForSlot(e.slot, used, h) : null;
      if(rep) used.add(rep);
      return rep;
    }).filter(Boolean);
    // Exercises skipped as "machine busy" last time get priority now — swapped in for
    // the same slot, never added on top.
    const prevS = selfSessions().slice(-1)[0];
    const pend = (prevS && Array.isArray(prevS.deferred)) ? prevS.deferred : [];
    pend.forEach(pid=>{
      const pe = byId(pid); if(!pe || !pe.active || used.has(pid) || isPaused(pe)) return;
      const i = ids.findIndex(id=> (byId(id)||{}).slot === pe.slot);
      if(i >= 0){ used.delete(ids[i]); ids[i] = pid; used.add(pid); }
    });
    // Soreness
    const areas = opts.areas || {};
    const sore = +opts.soreness || 0;
    const items = ids.map(id=>{
      const e = byId(id);
      const rec = recommend(id) || {};
      const aSore = Math.max(+areas[e.area]||0, Object.keys(areas).length ? 0 : sore);
      const it = { exId:id, sets:2, rec, light:false, note:'' };
      if(aSore >= 6 && !e.big && e.slot !== 'core1') it.drop = true;
      else if(aSore >= 4 && rec.kind === 'reps'){
        it.light = true;
        if(rec.action === 'increase'){ rec.kg = (rec.last ? entryStats(rec.last).top : rec.kg); rec.reps = rec.lo; rec.action = 'maintain'; }
        rec.why = 'אזור תפוס — בלי העלאה היום'; it.note = 'אזור תפוס';
        if(aSore >= 6){ rec.kg = stepDown(e, rec.kg); rec.why = 'אזור תפוס מאוד — מדרגה למטה, נקי'; }
      }
      return it;
    }).filter(it=> !it.drop);
    // Time budget (strength block only)
    const budget = Math.max(25, (+opts.minutes || S.prefs.minutes) - WARM - COOL);
    const total = ()=> items.reduce((a,it)=> a + estMin(byId(it.exId), it.sets), 0);
    const prio = it=>{ const e = byId(it.exId); return (e.big?3:0) + (EMPHASIS[e.area]?2:0) + (e.slot==='core1'?2:0); };
    while(total() > budget && items.length > 5){
      let k = 0; items.forEach((it,i)=>{ if(prio(it) < prio(items[k])) k = i; });
      items.splice(k, 1);
    }
    // One main lift may get a third set when the day is fresh and time allows.
    if(sore <= 3 && !Object.values(areas).some(v=> +v >= 4)){
      const main = items.find(it=> byId(it.exId).main);
      if(main && total() + estMin(byId(main.exId), 3) - estMin(byId(main.exId), 2) <= budget - 2) { main.sets = 3; main.rec.sets = 3; }
    }
    items.forEach(it=>{ it.rec.sets = it.sets; });
    items.sort((a,b)=> byId(a.exId).route - byId(b.exId).route);
    return { label, items, estMin: Math.round(WARM + COOL + total()) };
  }
  G.planSession = planSession;

  // ---------- Week / next workout ----------
  const DAYS = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  function weekStart(key){ const d = B.dateFromKey(key); const off = (d.getDay() + 6) % 7; return B.shiftKey(key, -off); }
  function isStrength(w){ return w && (w.type === 'gym' || (Array.isArray(w.exercises) && w.exercises.length && !(S.activities[w.id]))); }
  G.isStrength = isStrength;
  function weekStatus(){
    const today = B.todayKey(), ws = weekStart(today), all = B.workouts();
    let strength = 0, pilates = 0, salsa = false;
    for(let i=0;i<7;i++){
      const k = B.shiftKey(ws, i); if(k > today) break;
      (all[k] || []).forEach(w=>{
        const act = S.activities[w.id];
        if(act){ if(act.kind === 'pilates') pilates++; if(act.kind === 'salsa') salsa = true; }
        else if(w.type === 'pilates') pilates++;
        else if(isStrength(w)) strength++;
        if(w.type === 'dance' && /סלסה/.test(w.note||'')) salsa = true;
      });
    }
    return { strength, pilates, salsa, strengthTarget:S.prefs.strengthTarget, pilatesTarget:S.prefs.pilatesTarget };
  }
  G.weekStatus = weekStatus;
  function nextWorkout(){
    const today = B.todayKey(), all = B.workouts();
    const trainedToday = (all[today] || []).some(isStrength);
    for(let i = trainedToday ? 2 : 0; i < 9; i++){
      const k = B.shiftKey(today, i), dow = B.dateFromKey(k).getDay();
      if(S.prefs.restDay != null && dow === +S.prefs.restDay) continue;
      if(i > 0 && (all[B.shiftKey(k,-1)] || []).some(isStrength) && i === 1) continue;
      if(S.prefs.trainerDay != null && dow === +S.prefs.trainerDay) return { day:k, dow, trainer:true, text: (i===0?'היום':'יום ' + DAYS[dow]) + ' · אימון עם המאמנת' };
      return { day:k, dow, label: nextLabel(), text: (i===0?'היום':'יום ' + DAYS[dow]) + ' · ⁨Full Body ' + nextLabel() + '⁩' };
    }
    return null;
  }
  G.nextWorkout = nextWorkout; G.DAYS = DAYS; G.weekStart = weekStart;
  function streakWeeks(){
    let n = 0, k = weekStart(B.todayKey());
    const all = B.workouts();
    const countWeek = ws=>{ let c=0; for(let i=0;i<7;i++){ (all[B.shiftKey(ws,i)]||[]).forEach(w=>{ if(isStrength(w)) c++; }); } return c; };
    if(countWeek(k) < 3) k = B.shiftKey(k, -7);           // this week still in progress
    while(n < 104 && countWeek(k) >= 3){ n++; k = B.shiftKey(k, -7); }
    return n;
  }
  G.streakWeeks = streakWeeks;

  // ---------- Live session persistence ----------
  G.liveLoad = ()=>{ try{ return JSON.parse(localStorage.getItem(LIVEKEY)) || null; }catch(_){ return null; } };
  G.liveSave = v=>{ try{ if(v) localStorage.setItem(LIVEKEY, JSON.stringify(v)); else localStorage.removeItem(LIVEKEY); }catch(_){} };

  // ---------- Seed: training history 28.9–15.10.2026 ----------
  const s = (kg, reps, rpe, n, extra)=> Array.from({length:n||2}, ()=> Object.assign({ kg, reps, rpe:rpe==null?undefined:rpe }, extra||{}));
  const t = (sec, rpe)=> ({ kg:0, reps:0, sec, rpe:rpe==null?undefined:rpe });
  const SEED = [
    { day:'2026-09-28', trainer:true, label:'אימון אישי #1', ex:[
      ['leg_press', s(10,12)], ['leg_curl', s(32,12)], ['row', s(18,12)], ['chest_press', s(9,10)],
      ['bird_dog', s(0,10)], ['plank_bench', [t(63)], 'על קופסה 51 ס״מ'], ['hip_abductor', s(32,15), '+ 5 שניות סטטי'] ]},
    { day:'2026-09-29', ex:[
      ['leg_press', s(10,12,6)], ['hip_abductor', s(36,12,6)], ['hip_adductor', [{kg:36, reps:0, rpe:9}], 'כבד מדי'],
      ['row', s(18,12,6)], ['plank_bench', [t(90,6)], 'על קופסה'] ]},
    { day:'2026-10-04', ex:[
      ['leg_press', s(10,15,6)], ['leg_curl', s(32,15,7)], ['hip_abductor', s(36,15,6)], ['hip_adductor', s(27,12,7)],
      ['row', s(23,12,7)], ['chest_press', s(14,15,7)], ['plank_bench', [t(70,7)]] ]},
    { day:'2026-10-05', trainer:true, label:'אימון אישי #2', ex:[
      ['leg_press', s(15,15,7,3), 'קושי בערך 7'], ['leg_curl', s(32,15)], ['kickback', s(32,12,7), 'קושי בערך 7'],
      ['hip_abductor', s(36,15,7), 'קושי בערך 7'], ['hip_adductor', s(23,12)], ['machine_pull', s(27,12)], ['pec_fly', s(9,12)],
      ['bird_dog', s(0,10)], ['plank_bench', [t(93), t(85)], 'קובייה, ואז ספסל'] ]},
    { day:'2026-10-06', ex:[
      ['leg_press', s(17.5,12,7,3)], ['hip_abductor', s(32,15,6), 'בוצע בטעות על משקל נמוך'], ['hip_adductor', s(27,12,8)],
      ['row', s(23,12,7.5)], ['lat_pulldown', s(32,12,7)], ['plank_bench', [t(103,6), t(110,6)], 'על ספסל'] ]},
    { day:'2026-10-08', ex:[
      ['leg_press', s(17.5,15,7,3)], ['leg_curl', s(36,15,7)], ['kickback', s(32,15,7)], ['row', s(23,15,7)],
      ['lat_pulldown', s(32,15,6.5)], ['chest_press', s(14,15,8)], ['plank_bench', [t(122,6), t(107,6)], 'על ספסל'] ]},
    { day:'2026-10-11', ex:[
      ['leg_press', s(20,12,6.5,3)], ['leg_curl', s(36,15,6.5)], ['hip_abductor', s(41,15,6.5)], ['kickback', s(36,10,6.5)],
      ['row', s(27,12,7.5)], ['lat_pulldown', s(36,10,7)], ['pec_fly', s(14,15,6.5)], ['plank_bench', [t(166,6), t(137,6)], 'על ספסל'] ]},
    { day:'2026-10-12', trainer:true, label:'אימון אישי #3', ex:[
      ['box_squat', s(8,12,7,3), 'קושי בערך 7'], ['hip_thrust', s(5,10,7), 'קושי בערך 7'], ['hip_abductor', s(41,15,7), 'סופרסט עם קירוב'],
      ['hip_adductor', s(27,12,7), 'סופרסט · קושי בערך 7'], ['selector_row', s(23,12,7,3), 'קושי בערך 7'], ['chest_press', s(9,12,7)],
      ['shoulder_press', s(14,12,7)], ['bird_dog', s(1.25,10,7)], ['plank_bench', [t(107,7)], 'על פלטפורמה'] ]},
    { day:'2026-10-13', ex:[
      ['bird_dog', s(1.25,10,7)], ['box_squat', s(8,12,7.5)], ['plank_bench', [t(153)], 'על ספסל'], ['leg_press', s(20,15,7.5)],
      ['hip_abductor', s(41,12,6.5), 'בוצע בזמן תפיסות'], ['hip_adductor', s(27,12,7.5)], ['kickback', s(36,12,7)],
      ['row', s(27,12,8)], ['lat_pulldown', s(36,15,6.5)], ['chest_press', s(9,12,6.5)], ['pec_fly', s(14,15,7.5)], ['shoulder_press', s(14,12,7)] ]},
    { day:'2026-10-15', ex:[
      ['bird_dog', s(1.25,10,6.5)], ['plank', [t(50,6.5), t(50,6.5)], 'על הרצפה'], ['leg_press', s(20,15,6.5)], ['leg_curl', s(41,12,6)],
      ['hip_thrust', s(5,12,6.5)], ['lat_pulldown', s(41,12,6.5)],
      ['chest_press', [{kg:9,reps:12,rpe:7},{kg:9,reps:12,rpe:9}], 'סט 2: כמעט כשל בחזרה 9, עוד 3 בקושי גבוה'],
      ['shoulder_press', [{kg:14,reps:12,rpe:6},{kg:19,reps:12,rpe:7}], 'סט 2 על 19 ק״ג'] ]},
  ];
  // Deterministic ids so a second device (or a second run) never duplicates the import.
  const seedId = day=> 'a11ce000-0000-4000-8000-0000' + day.replace(/-/g,'');
  // Personal data: only for the owner's account. The app has other users, and their
  // gyms, weights and weekly routine are not these.
  const OWNER = 'yuvalw1991@gmail.com';
  G.isOwner = ()=> !!B && String(B.userEmail() || '').toLowerCase() === OWNER;
  function seedHistory(){
    if((+S.seeded||0) >= 1 || !B) return 0;
    if(!G.isOwner()) return 0;
    if(!(+S.prefsAt > 0)){ S.prefs.restDay = 5; S.prefs.trainerDay = 1; S.prefsAt = Date.now(); }
    const all = B.workouts();
    let added = 0;
    SEED.forEach(sd=>{
      const dayList = all[sd.day] || [];
      const have = new Set();
      dayList.forEach(w=> (w.exercises||[]).forEach(e=>{ const id = e.exId || matchId(e.name); if(id) have.add(id); }));
      const exs = sd.ex.filter(([id])=> !have.has(id)).map(([id, sets, note])=>{
        const e = ex(id);
        return { name: exName(e), exId:id, sets: sets.map(x=> Object.assign({}, x)), note: note || '' };
      });
      if(!exs.length) return;
      // Attach to a strength workout already logged that day (it has the real minutes),
      // otherwise create a history-only record with no calories so past energy
      // balances don't shift.
      let w = dayList.find(x=> x.id === seedId(sd.day)) || dayList.find(x=> (x.type === 'gym' || x.type === 'other' || x.type === 'bodyweight') && !S.activities[x.id]);
      if(w){
        w.exercises = (Array.isArray(w.exercises) ? w.exercises : []).concat(exs);
        B.updateWorkout(w, sd.day, true);
      } else {
        w = { id: seedId(sd.day), type:'gym', level:'mid', minutes:0, kcal:0, kcalNet:0,
              note: (sd.trainer ? sd.label + ' עם המאמנת' : 'Full Body') + ' · היסטוריה', exercises: exs };
        B.addWorkout(w, sd.day, true);
      }
      S.sessions[w.id] = Object.assign(S.sessions[w.id] || {}, { day:sd.day, trainer:!!sd.trainer, title: sd.trainer ? sd.label : 'Full Body', imported:true });
      added += exs.length;
    });
    S.seeded = 1;
    saveState();
    return added;
  }
  G.seedHistory = seedHistory;

  // ---------- Init ----------
  G.init = function(bridge){
    B = bridge; G.B = B;
    loadState();
    G.maybeSeed();
  };
  // Called at boot and again once the cloud data has loaded (the account is known then).
  G.maybeSeed = function(){
    try{ const n = seedHistory(); if(n){ console.info('gym: imported', n, 'history entries'); B.renderAll(); } }
    catch(e){ console.warn('gym seed', e); }
  };
  G.reload = ()=>{ S = defaultState(); loadState(); };
  // A workout moved to another day gets a new id; its session/activity notes follow it.
  G.rekey = (oldId, newId, day)=>{
    ['sessions','activities'].forEach(k=>{ if(S[k][oldId]){ S[k][newId] = Object.assign({}, S[k][oldId], { day }); delete S[k][oldId]; } });
    saveState();
  };
})();
