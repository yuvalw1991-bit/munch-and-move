// Munch & Move — history by day, workout editor, per-exercise trend, coach report,
// activity log, report hooks and the assistant's gym powers.
(function(){
  'use strict';
  const G = window.Gym;
  const B = ()=> G.B;
  const esc = s=> String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const r1 = n=> Math.round(n*10)/10;
  const DAYS = ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
  const dlong = k=>{ const d = B().dateFromKey(k); return 'יום ' + DAYS[d.getDay()] + ' · ' + d.getDate() + '.' + (d.getMonth()+1) + '.' + String(d.getFullYear()).slice(2); };
  const dshort = k=>{ const [y,m,d] = k.split('-'); return (+d) + '.' + (+m); };
  const S = ()=> G.state();

  // ---------- sheet helper ----------
  function sheet(title, html, bindFn, id){
    if(G.injectCss) G.injectCss();            // styles exist even if the workouts tab was never opened
    id = id || ('gys' + Math.random().toString(36).slice(2,7));
    let m = document.getElementById(id);
    if(!m){ m = document.createElement('div'); m.id = id; m.className = 'gy-modal'; document.body.appendChild(m); }
    m.innerHTML = '<div class="gy-sheet"><div class="gy-row mb-3" style="justify-content:space-between;position:sticky;top:-16px;background:#0d0f19;padding:6px 0;z-index:1"><div class="font-black text-gray-100" style="font-size:16px">' + title + '</div><button class="gy-btn gy-chip" data-close>סגירה</button></div>' + html + '</div>';
    const close = ()=> m.remove();
    m.onclick = ev=>{ if(ev.target === m) close(); };
    m.querySelector('[data-close]').onclick = close;
    if(bindFn) bindFn(m, close);
    return m;
  }
  G.sheet = sheet;

  // ---------- helpers over the workout store ----------
  function relevant(w){ return !!(w && ((Array.isArray(w.exercises) && w.exercises.length) || w.type === 'gym' || S().activities[w.id] || w.type === 'pilates' || w.type === 'dance')); }
  function daysWithTraining(){
    const all = B().workouts();
    return Object.keys(all).filter(d=> (all[d]||[]).some(relevant)).sort().reverse();
  }
  function woTitle(w){
    const m = S().sessions[w.id] || {}, a = S().activities[w.id];
    if(a) return ACT_LABEL[a.kind] || 'פעילות';
    if(m.trainer) return '👩‍🏫 ' + (w.note || m.title || 'אימון עם ' + coachWord());
    if(m.label) return '⁨' + (/^[ABC]$/.test(m.label) ? 'Full Body ' + m.label : m.label) + '⁩';
    return (w.note || 'אימון').split(' · ')[0];
  }
  function exLine(e){
    const id = e.exId || G.matchId(e.name), x = G.ex(id);
    const st = G.entryStats(e);
    return { id, name: x ? x.he : e.name, sets: G.setsLine(e, x), rpe: st.rpe, note: e.note || '' };
  }
  const coachWord = ()=> G.isOwner && G.isOwner() ? 'המאמנת' : 'המאמן/ת';
  function woMeta(w){
    const m = S().sessions[w.id] || {}, a = S().activities[w.id];
    const p = [];
    if(+w.minutes) p.push(w.minutes + ' דק׳');
    if(m.soreness != null) p.push('תפיסות לפני ' + m.soreness);
    if(m.overall != null) p.push('קושי כללי ' + m.overall);
    if(m.energy != null) p.push('אנרגיה ' + m.energy);
    if(m.after != null) p.push('תפיסות אחרי ' + m.after);
    if(a){ if(a.instructor) p.push('מדריך/ה: ' + a.instructor); if(a.classType) p.push(a.classType); if(a.rpe) p.push('קושי ' + a.rpe); if(a.enjoy) p.push('הנאה ' + a.enjoy); if(a.repeat != null) p.push(a.repeat ? 'לחזור: כן' : 'לחזור: לא'); }
    return p.join(' · ');
  }

  // ---------- text / csv exports ----------
  function dayText(day){
    const all = B().workouts(); const L = [dlong(day)];
    (all[day]||[]).filter(relevant).forEach(w=>{
      L.push(''); L.push(woTitle(w) + (woMeta(w) ? ' — ' + woMeta(w) : ''));
      (w.exercises||[]).forEach(e=>{ const x = exLine(e); L.push('• ' + x.name + ': ' + x.sets + (x.rpe!=null ? ' · קושי ' + r1(x.rpe) : '') + (x.note ? ' (' + x.note + ')' : '')); });
      const m = S().sessions[w.id] || {};
      if(m.deferred && m.deferred.length) L.push('נדחה (מכשיר תפוס): ' + m.deferred.map(id=> (G.ex(id)||{}).he).join(', '));
      if(m.flags && m.flags.length) L.push('⚠️ דווח: ' + m.flags.join(', '));
    });
    return L.join('\n');
  }
  function csvRows(from, to){
    const all = B().workouts();
    const rows = [['תאריך','אימון','תרגיל','סט','ק״ג','חזרות','שניות','קושי','הערה']];
    Object.keys(all).filter(d=> d >= from && d <= to).sort().forEach(d=>{
      (all[d]||[]).filter(relevant).forEach(w=>{
        const t = woTitle(w).replace(/^👩‍🏫 /,'');
        if(!(w.exercises||[]).length) rows.push([d, t, '', '', '', '', '', (S().activities[w.id]||{}).rpe || '', woMeta(w)]);
        (w.exercises||[]).forEach(e=>{
          const x = exLine(e);
          (e.sets||[]).forEach((s,i)=> rows.push([d, t, x.name, i+1, s.kg ?? '', s.reps || '', s.sec || '', s.rpe ?? '', i===0 ? x.note : '']));
        });
      });
    });
    return '﻿' + rows.map(r=> r.map(v=>{ const s = String(v==null?'':v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s; }).join(',')).join('\r\n');
  }
  function copy(txt){ B().copyText(txt); }

  // ---------- history ----------
  G.openHistory = function(){
    const days = daysWithTraining();
    const all = B().workouts();
    let h = '<div class="gy-grid2 mb-3"><button class="gy-btn gy-pri" style="height:44px;font-size:13px" id="hyAdd">+ אימון בדיעבד</button><button class="gy-btn" style="height:44px;font-size:13px" id="hyCsv">ייצוא הכל (CSV)</button></div>';
    if(!days.length) h += '<div class="gy-mut text-center py-6">עוד אין אימונים רשומים</div>';
    let month = '';
    days.forEach(d=>{
      const m = d.slice(0,7);
      if(m !== month){ month = m; const dt = B().dateFromKey(d); h += '<div class="gy-lbl mt-3 mb-1">' + dt.toLocaleDateString('he-IL', { month:'long', year:'numeric' }) + '</div>'; }
      const ws = (all[d]||[]).filter(relevant);
      const nEx = ws.reduce((a,w)=> a + (w.exercises||[]).length, 0);
      h += '<button class="gy-card w-full mb-2" style="text-align:right;display:block;padding:12px 14px;width:100%" data-day="' + d + '"><div class="gy-row" style="justify-content:space-between"><span class="font-black text-gray-100">' + dlong(d) + '</span><span class="gy-mut text-[12px]">' + (nEx ? nEx + ' תרגילים' : '') + '</span></div>' +
        '<div class="text-[12px] gy-mut mt-1">' + ws.map(w=> esc(woTitle(w))).join(' · ') + '</div></button>';
    });
    sheet('📅 היסטוריית אימונים', h, (m)=>{
      m.querySelectorAll('[data-day]').forEach(b=> b.onclick = ()=> G.openDay(b.dataset.day));
      m.querySelector('#hyAdd').onclick = ()=> G.openEditor(B().todayKey(), null);
      m.querySelector('#hyCsv').onclick = ()=>{ B().downloadFile('munch-move-workouts-' + B().todayKey() + '.csv', csvRows('0000', '9999'), 'text/csv'); };
    }, 'gyHist');
  };
  G.openDay = function(day){
    const all = B().workouts();
    const ws = (all[day]||[]).filter(relevant);
    let h = '';
    if(!ws.length) h += '<div class="gy-mut text-center py-6">אין אימון ביום הזה</div>';
    ws.forEach(w=>{
      h += '<div class="gy-card mb-3"><div class="gy-row" style="justify-content:space-between"><div class="font-black text-gray-100">' + esc(woTitle(w)) + '</div>' +
        '<span class="gy-row"><button class="gy-btn gy-chip" data-edit="' + w.id + '">עריכה</button><button class="gy-btn gy-chip gy-danger" data-del="' + w.id + '">מחיקה</button></span></div>' +
        (woMeta(w) ? '<div class="text-[12px] gy-mut mt-1">' + esc(woMeta(w)) + '</div>' : '');
      if((w.exercises||[]).length){
        h += '<table class="gy-tbl mt-2">' + w.exercises.map(e=>{ const x = exLine(e); return '<tr data-ex="' + (x.id||'') + '" style="cursor:pointer"><td class="text-gray-100 font-bold">' + esc(x.name) + '</td><td>' + esc(x.sets) + '</td><td class="gy-mut">' + (x.rpe!=null ? r1(x.rpe) : '') + '</td></tr>' + (x.note ? '<tr><td colspan="3" class="gy-mut text-[11px]" style="padding-top:0">' + esc(x.note) + '</td></tr>' : ''); }).join('') + '</table>';
      }
      const m = S().sessions[w.id] || {};
      if(m.deferred && m.deferred.length) h += '<div class="text-[11px] gy-mut mt-2">🚧 נדחה: ' + m.deferred.map(id=> esc((G.ex(id)||{}).he)).join(', ') + '</div>';
      if(m.cut && m.cut.length) h += '<div class="text-[11px] gy-mut">✂️ קוצר בגלל זמן: ' + m.cut.map(id=> esc((G.ex(id)||{}).he)).join(', ') + '</div>';
      if(m.flags && m.flags.length) h += '<div class="text-[11px] txt-amber">⚠️ ' + esc(m.flags.join(', ')) + '</div>';
      h += '</div>';
    });
    h += '<div class="gy-grid2"><button class="gy-btn" style="height:44px;font-size:13px" id="dyCopy">העתקה כטקסט</button><button class="gy-btn" style="height:44px;font-size:13px" id="dyCsv">CSV</button>' +
      '<button class="gy-btn" style="height:44px;font-size:13px" id="dyPrint">הדפסה / PDF</button><button class="gy-btn" style="height:44px;font-size:13px" id="dyAdd">+ אימון ליום הזה</button></div>';
    sheet(dlong(day), h, (m, close)=>{
      m.querySelectorAll('[data-edit]').forEach(b=> b.onclick = ()=>{ close(); G.openEditor(day, b.dataset.edit); });
      m.querySelectorAll('[data-del]').forEach(b=> b.onclick = ()=>{
        if(b.dataset.armed !== '1'){ b.dataset.armed = '1'; b.textContent = 'לחיצה נוספת מוחקת'; return; }
        B().deleteWorkout(b.dataset.del, day); close(); G.openDay(day); refreshHist();
      });
      m.querySelectorAll('[data-ex]').forEach(tr=> tr.onclick = ()=>{ if(tr.dataset.ex) G.openExercise(tr.dataset.ex); });
      m.querySelector('#dyCopy').onclick = ()=> copy(dayText(day));
      m.querySelector('#dyCsv').onclick = ()=> B().downloadFile('munch-move-' + day + '.csv', csvRows(day, day), 'text/csv');
      m.querySelector('#dyPrint').onclick = ()=> B().printHTML(printWrap('אימון · ' + dlong(day), '<pre style="white-space:pre-wrap;font-family:inherit;font-size:13px">' + esc(dayText(day)) + '</pre>'));
      m.querySelector('#dyAdd').onclick = ()=>{ close(); G.openEditor(day, null); };
    }, 'gyDay');
  };
  function refreshHist(){ if(document.getElementById('gyHist')) G.openHistory(); }
  function printWrap(title, body){
    return '<div dir="rtl" style="font-family:Polin,system-ui,sans-serif;color:#111;padding:8px"><h1 style="font-size:20px;margin:0 0 4px">' + esc(title) + '</h1>' + body +
      '<p style="font-size:10px;color:#666;margin-top:16px">הופק מ-Munch & Move · ' + new Date().toLocaleDateString('he-IL') + '</p></div>';
  }

  // ---------- editor ----------
  G.openEditor = function(day, woId, eopts){
    eopts = eopts || {};
    const all = B().workouts();
    const orig = woId ? (all[day]||[]).find(w=> w.id === woId) : null;
    const lib = G.lib();
    const pre = eopts.prefill || null;
    const isTrainer = !!(eopts.trainer || (orig && (S().sessions[orig.id] || {}).trainer));
    const TOK = 'e' + Math.random().toString(36).slice(2);   // this editor instance
    const draft = pre ? { day: pre.day || day, minutes: pre.minutes || 60, note: pre.note || 'אימון עם ' + coachWord(), ex: pre.ex } : {
      day, minutes: orig ? (orig.minutes || 0) : 55, note: orig ? (orig.note || '') : 'Full Body',
      // Keep each entry's own name and id; the library match is only a default for the
      // picker, and an entry is renamed only when the picker is actually changed.
      ex: orig ? (orig.exercises||[]).map(e=> ({ exId: e.exId || G.matchId(e.name) || '', orig: e, name: e.name, note: e.note || '', sets: (e.sets||[]).map(s=> Object.assign({}, s)) })) : [],
    };
    const opts = sel=> '<option value="">— אחר —</option>' + lib.map(x=> '<option value="' + x.id + '"' + (x.id===sel?' selected':'') + '>' + esc(x.he) + (x.active?'':' (לא פעיל)') + '</option>').join('');
    const sp = { open: !orig && !pre, text:'', img:null, busy:false, err:'' };
    function smartBox(){
      if(!sp.open) return '<button class="gy-btn gy-chip mb-3" id="spOpen">🧠 פירוק חכם: הדבקת אימון שלם</button>';
      return '<div class="gy-card mb-3" style="padding:12px"><div class="font-black text-gray-100 mb-1">🧠 פירוק חכם</div>' +
        '<div class="text-[11px] gy-mut mb-2">מדביקים כאן את כל האימון, מעלים קובץ טקסט או צילום מסך, והמערכת מחלקת אותו לתרגילים, סטים, משקלים וקושי.</div>' +
        '<textarea id="spText" class="gy-in" style="min-height:120px;line-height:1.6" placeholder="למשל:\nלחיצת רגליים 20 ק״ג 2×15 קושי 6.5\nפולי עליון 41 ק״ג 2×12 קושי 6.5\nפלאנק 50 שנ׳ + 50 שנ׳">' + esc(sp.text) + '</textarea>' +
        '<div class="gy-row mt-2"><label class="gy-btn gy-chip" style="cursor:pointer">📄 קובץ טקסט / צילום<input id="spFile" type="file" accept=".txt,.md,text/plain,image/*" style="display:none"></label>' +
          (sp.img ? '<span class="text-[11px] gy-mut">✓ תמונה צורפה</span><button class="gy-btn gy-chip" id="spImgX">✕</button>' : '') + '</div>' +
        (sp.err ? '<div class="gy-card gy-danger mt-2" style="padding:8px;font-size:12px">' + esc(sp.err) + '</div>' : '') +
        '<button id="spGo" class="gy-btn gy-pri mt-3" style="height:46px;width:100%"' + (sp.busy ? ' disabled' : '') + '>' + (sp.busy ? '⏳ מפרקים את האימון…' : 'לפרק לתרגילים') + '</button></div>';
    }
    function html(){
      let h = smartBox() + '<div class="gy-grid2"><label><div class="gy-lbl mb-1">תאריך</div><input class="gy-in" type="date" id="edDay" value="' + draft.day + '" max="' + B().todayKey() + '"></label>' +
        '<label><div class="gy-lbl mb-1">דקות</div><input class="gy-in" type="number" inputmode="numeric" id="edMin" value="' + draft.minutes + '"></label></div>' +
        '<label class="block mt-2"><div class="gy-lbl mb-1">כותרת / הערה</div><input class="gy-in" id="edNote" value="' + esc(draft.note) + '"></label>';
      draft.ex.forEach((e, i)=>{
        const x = G.ex(e.exId); const time = x ? x.kind === 'time' : e.kind === 'time';
        h += '<div class="gy-card mt-3" style="padding:12px"><div class="gy-row"><select class="gy-in" data-exsel="' + i + '">' + opts(e.exId) + '</select><button class="gy-btn gy-chip gy-danger" data-rmex="' + i + '">✕</button></div>' +
          (!e.exId ? '<input class="gy-in mt-2" placeholder="שם התרגיל" data-exname="' + i + '" value="' + esc(e.name||'') + '">' +
            (e.isNew ? '<div class="gy-row mt-2"><span class="text-[11px] txt-amber font-bold">🆕 תרגיל חדש — יתווסף למעקב</span><select class="gy-in" style="width:auto" data-exarea="' + i + '">' + Object.entries(G.AREAS).map(([k,l])=> '<option value="' + k + '"' + (k===e.area?' selected':'') + '>' + l + '</option>').join('') + '</select></div>' +
              '<label class="gy-row mt-1 text-[11px] gy-mut"><input type="checkbox" data-exrot="' + i + '"' + (e.rotation?' checked':'') + '> להכניס אותו גם לאימונים העצמאיים שלי</label>' : '') : '') +
          '<table class="gy-tbl mt-2"><tr><th>סט</th>' + (time ? '<th>שניות</th>' : '<th>ק״ג</th><th>חזרות</th>') + '<th>קושי</th><th></th></tr>' +
          e.sets.map((s,j)=> '<tr><td>' + (j+1) + '</td>' + (time ? '<td><input class="gy-in" type="number" inputmode="numeric" data-s="' + i + ':' + j + ':sec" value="' + (s.sec||'') + '"></td>'
            : '<td><input class="gy-in" type="number" inputmode="decimal" step="0.5" data-s="' + i + ':' + j + ':kg" value="' + (s.kg ?? '') + '"></td><td><input class="gy-in" type="number" inputmode="numeric" data-s="' + i + ':' + j + ':reps" value="' + (s.reps||'') + '"></td>') +
            '<td><input class="gy-in" type="number" inputmode="decimal" step="0.5" min="1" max="10" data-s="' + i + ':' + j + ':rpe" value="' + (s.rpe ?? '') + '"></td><td><button class="gy-btn gy-chip" data-rmset="' + i + ':' + j + '">−</button></td></tr>').join('') +
          '</table><div class="gy-row mt-2"><button class="gy-btn gy-chip" style="flex:none;white-space:nowrap" data-addset="' + i + '">+ סט</button><input class="gy-in" style="flex:1" placeholder="הערה לתרגיל" data-exnote="' + i + '" value="' + esc(e.note||'') + '"></div></div>';
      });
      h += '<button class="gy-btn mt-3" style="height:44px;width:100%" id="edAddEx">+ הוספת תרגיל</button>';
      h += '<button class="gy-btn gy-pri mt-4" style="height:56px;width:100%;font-size:17px" id="edSave">שמירה</button>';
      return h;
    }
    function collect(m){
      draft.day = m.querySelector('#edDay').value || draft.day;
      draft.minutes = Math.max(0, Math.round(+m.querySelector('#edMin').value || 0));
      draft.note = m.querySelector('#edNote').value;
      m.querySelectorAll('[data-s]').forEach(inp=>{ const [i,j,k] = inp.dataset.s.split(':'); const v = inp.value === '' ? undefined : parseFloat(inp.value); draft.ex[+i].sets[+j][k] = v; });
      m.querySelectorAll('[data-exname]').forEach(inp=>{ draft.ex[+inp.dataset.exname].name = inp.value; });
      m.querySelectorAll('[data-exnote]').forEach(inp=>{ draft.ex[+inp.dataset.exnote].note = inp.value; });
      m.querySelectorAll('[data-exarea]').forEach(sel=>{ draft.ex[+sel.dataset.exarea].area = sel.value; });
      m.querySelectorAll('[data-exrot]').forEach(cb=>{ draft.ex[+cb.dataset.exrot].rotation = cb.checked; });
      const spT = m.querySelector('#spText'); if(spT) sp.text = spT.value;
    }
    function bind(m, close){
      const rerender = ()=>{ m.querySelector('.gy-sheet').lastElementChild && null; m.remove(); open(); };
      m.querySelectorAll('[data-exsel]').forEach(s=> s.onchange = ()=>{ collect(m); const i = +s.dataset.exsel; draft.ex[i].exId = s.value; draft.ex[i].picked = true; if(s.value) draft.ex[i].name = G.exName(G.ex(s.value)); rerender(); });
      m.querySelectorAll('[data-rmex]').forEach(b=> b.onclick = ()=>{ collect(m); draft.ex.splice(+b.dataset.rmex, 1); rerender(); });
      m.querySelectorAll('[data-addset]').forEach(b=> b.onclick = ()=>{ collect(m); const e = draft.ex[+b.dataset.addset]; const last = e.sets[e.sets.length-1]; e.sets.push(last ? Object.assign({}, last) : { kg:0, reps:10 }); rerender(); });
      m.querySelectorAll('[data-rmset]').forEach(b=> b.onclick = ()=>{ collect(m); const [i,j] = b.dataset.rmset.split(':').map(Number); draft.ex[i].sets.splice(j, 1); rerender(); });
      m.querySelector('#edAddEx').onclick = ()=>{ collect(m); draft.ex.push({ exId:'', name:'', note:'', sets:[{ kg:0, reps:10 }, { kg:0, reps:10 }] }); rerender(); };
      const mine = ()=>{ const el = document.getElementById('gyEdit'); return el && el.dataset.tok === TOK ? el : null; };
      const so = m.querySelector('#spOpen'); if(so) so.onclick = ()=>{ collect(m); sp.open = true; rerender(); };
      const sx = m.querySelector('#spImgX'); if(sx) sx.onclick = ()=>{ collect(m); sp.text = m.querySelector('#spText').value; sp.img = null; rerender(); };
      const sf = m.querySelector('#spFile');
      if(sf) sf.onchange = async ev=>{
        const f = ev.target.files && ev.target.files[0]; if(!f) return;
        collect(m); sp.text = m.querySelector('#spText').value; sp.err = '';
        try{
          if(/^image\//.test(f.type)) sp.img = { mimeType:'image/jpeg', data: await shotB64(f) };
          else {
            if(f.size > 1000000) throw new Error('big');
            const t = (await f.text()).trim();
            if(!t) throw new Error('empty');
            if(/[\u0000-\u0008\uFFFD]/.test(t)) throw new Error('bin');
            if(t.length > 200000) throw new Error('big');
            sp.text = (sp.text ? sp.text + '\n' : '') + t;
          }
        }catch(e){
          const k = String(e && e.message);
          sp.err = k === 'big' ? 'הקובץ ארוך מדי. אפשר להדביק רק את האימון עצמו' : k === 'empty' ? 'הקובץ ריק' : k === 'bin' ? 'זה לא נראה כמו קובץ טקסט' : 'לא הצלחתי לקרוא את הקובץ';
        }
        const el = mine(); if(!el) return;
        collect(el); rerender();
      };
      const sg = m.querySelector('#spGo');
      if(sg) sg.onclick = async ()=>{
        collect(m); sp.text = m.querySelector('#spText').value;
        if(!sp.text.trim() && !sp.img){ sp.err = 'צריך להדביק טקסט או לצרף קובץ'; rerender(); return; }
        sp.busy = true; sp.err = ''; rerender();
        let r = null, err = null;
        try{ r = await parsePlan(sp.text, sp.img); }catch(e){ err = e; }
        sp.busy = false;
        // Closed, or another editor took its place, while waiting: drop the result.
        const el = mine(); if(!el) return;
        collect(el);                                      // keep anything typed during the wait
        if(err){ sp.err = parseErr(err); rerender(); return; }
        const sig = e=> (e.exId || e.name) + '|' + JSON.stringify((e.sets||[]).map(s=> [+s.kg||0, +s.reps||0, +s.sec||0]));
        const have = new Set(draft.ex.map(sig));
        const fresh = r.ex.filter(e=> !have.has(sig(e))).map(e=> Object.assign(e, { rotation: !isTrainer }));   // own workout: new machines join the rotation by default
        draft.ex = draft.ex.filter(e=> (e.sets||[]).some(s=> +s.reps > 0 || +s.sec > 0 || +s.kg > 0)).concat(fresh);
        if(!orig){
          if(r.date && r.date <= B().todayKey()) draft.day = r.date;
          if(!draft.note || draft.note === 'Full Body') draft.note = (r.title || draft.note || 'Full Body') + (r.notes ? ' · ' + r.notes : '');
        }
        sp.open = false; sp.text = ''; sp.img = null; sp.used = true;
        const n = fresh.length;
        B().showToast(n === 0 ? 'כל התרגילים כבר מופיעים באימון' : (n === 1 ? 'פורק לתרגיל אחד' : 'פורק ל-' + n + ' תרגילים') + ' ✓ אפשר לבדוק ולתקן לפני שמירה');
        rerender();
      };
      m.querySelector('#edSave').onclick = ()=>{
        collect(m);
        if(sp.open && !sp.busy && (String(sp.text||'').trim() || sp.img)){
          B().showToast('קודם מפרקים את מה שהודבק. אחרי הבדיקה לוחצים שוב על שמירה');
          const go = m.querySelector('#spGo'); if(go) go.click();
          return;
        }
        // New exercises from a trainer's plan join the library (and so the tracking and
        // the rotation) before the workout is saved, so their sets count from day one.
        const filled = e=> (e.sets||[]).some(s=> +s.reps > 0 || +s.sec > 0 || +s.kg > 0);
        draft.ex.forEach(e=>{
          if(e.exId || !e.isNew || !String(e.name||'').trim() || !filled(e)) return;
          const known = G.matchId(e.name) || (e.en ? G.matchId(e.en) : null);
          // Tracked from now on; joins the self-made workouts only when asked (a machine
          // or cable station may exist only at the trainer's studio).
          e.exId = known || G.addCustom({ he:String(e.name).trim(), en:e.en || '', area:e.area || 'legs', kind:e.kind === 'time' ? 'time' : 'reps', perSide:!!e.perSide, active: !!e.rotation });
          e.picked = true;
        });
        if(eopts.trainer && draft.day !== (eopts.prefill || {}).day && (B().workouts()[draft.day] || []).some(w=> (S().sessions[w.id] || {}).trainer))
          B().showToast('שימו לב: כבר יש אימון עם ' + coachWord() + ' ביום הזה — זה יישמר כאימון נוסף');
        const exercises = draft.ex.map(e=>{
          const x = G.ex(e.exId);
          // Every field a set had is kept (a timed set keeps its reps, a rep set keeps its
          // seconds); only rows left completely empty are dropped.
          const sets = e.sets.map(s=>{
            const o = { kg: s.kg === undefined || s.kg === '' ? 0 : (+s.kg||0), reps: Math.round(+s.reps||0) };
            if(+s.sec > 0) o.sec = Math.round(+s.sec);
            if(s.rpe != null && s.rpe !== '' && !isNaN(+s.rpe)) o.rpe = +s.rpe;
            if(s.note) o.note = s.note;
            return o;
          }).filter(s=> s.reps > 0 || s.sec > 0 || s.kg > 0);
          const keepName = e.orig && !e.picked;
          const name = keepName ? e.orig.name : (x ? G.exName(x) : String(e.name||'').trim());
          const exId = keepName ? (e.orig.exId || undefined) : (e.exId || undefined);
          return Object.assign({}, keepName ? e.orig : {}, { name, exId, sets, note: e.note || undefined });
        }).filter(e=> e.name && e.sets.length);
        if(!exercises.length && !orig){ B().showToast('אין מה לשמור — יש להוסיף תרגיל'); return; }
        const b = B();
        if(orig){
          orig.exercises = exercises; orig.note = draft.note;
          if(+orig.minutes !== draft.minutes){ orig.minutes = draft.minutes; orig.kcal = draft.minutes ? b.estKcal(orig.type, orig.level||'mid', draft.minutes) : 0; orig.kcalNet = draft.minutes ? b.estKcalNet(orig.type, orig.level||'mid', draft.minutes) : 0; }
          if(draft.day !== day) b.moveWorkout(orig, day, draft.day); else b.updateWorkout(orig, day);
        } else {
          const w = { id: b.uid(), type:'gym', level:'mid', minutes: draft.minutes, kcal: draft.minutes ? b.estKcal('gym','mid',draft.minutes) : 0, kcalNet: draft.minutes ? b.estKcalNet('gym','mid',draft.minutes) : 0, note: draft.note || 'Full Body', exercises };
          b.addWorkout(w, draft.day);
          S().sessions[w.id] = eopts.trainer ? { day: draft.day, trainer:true, title: draft.note || 'אימון עם ' + coachWord(), source: eopts.source || '', at: Date.now() }
                                             : Object.assign({ day: draft.day, manual:true, at: Date.now() }, sp.used ? { smart:true } : {});
          G.save();
        }
        const added = draft.ex.filter(e=> e.isNew && e.exId).length;
        b.showToast(eopts.trainer ? 'האימון עם ' + coachWord() + ' נשמר ✓' + (added ? ' · ' + added + ' תרגילים חדשים נוספו למעקב' : '') : 'נשמר ✓');
        close(); refreshHist(); G.openDay(draft.day); b.renderAll();
      };
    }
    function open(){ const el = sheet(orig ? 'עריכת אימון' : (eopts.trainer ? '👩‍🏫 בדיקה לפני שמירה' : 'אימון בדיעבד'), (eopts.trainer ? '<div class="text-[12px] gy-mut mb-3" style="margin-top:-6px">כך הבנתי את התוכנית. אפשר לתקן כל מספר, ואז לשמור.</div>' : '') + html(), bind, 'gyEdit'); el.dataset.tok = TOK; }
    open();
  };

  // ---------- trainer session import (WhatsApp text and/or screenshot) ----------
  const STEPS_DEFAULT = [0,2.5,5,7.5,9,10,12.5,14,15,17.5,18,19,20,22.5,23,25,27,30,32,35,36,40,41,45,50,54,55,59,60];
  G.addCustom = function(def){
    const id = 'c_' + B().uid().replace(/-/g,'').slice(0, 8);
    const AREA_SLOT_ = { legs:'quad', glutes:'post', back:'back', chest:'chest', shoulders:'shoulders', core:'core2', arms:'arms' };
    S().custom.push({ id, he:def.he, en:def.en || '', area: G.AREAS[def.area] ? def.area : 'legs', slot: AREA_SLOT_[def.area] || 'quad', route: 9, kind: def.kind === 'time' ? 'time' : 'reps',
      lo: def.kind === 'time' ? 30 : 10, hi: def.kind === 'time' ? 60 : 15, steps: STEPS_DEFAULT, rest: 75, icon:'🆕', perSide: !!def.perSide, addedAt: B().todayKey(),
      active: def.active === undefined ? true : !!def.active });
    G.save();
    return id;
  };
  // Width-limited, not longest-side-limited: a long WhatsApp scroll capture (1080×5400)
  // would otherwise shrink to ~320px wide and the text would be unreadable.
  function shotB64(file){
    return new Promise((resolve, reject)=>{
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = ()=>{
        const k = Math.min(1, 1200 / img.width, 4000 / img.height);
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
      img.onerror = ()=>{ URL.revokeObjectURL(url); reject(new Error('img')); };
      img.src = url;
    });
  }
  // One parser for every pasted workout: a trainer's plan, a .txt file, free notes.
  // Any length: a long paste is cut into parts on line breaks, the parts are read in
  // parallel, and the exercises come back joined in their original order.
  async function parsePlan(text, img){
    text = String(text || '');
    const MAX = 2500;
    if(img || text.length <= MAX) return parsePart(text, img);
    const parts = []; let cur = '';
    text.split(/\r?\n/).forEach(line=>{
      while(line.length > MAX){ if(cur){ parts.push(cur); cur = ''; } parts.push(line.slice(0, MAX)); line = line.slice(MAX); }
      if(cur.length + line.length + 1 > MAX){ parts.push(cur); cur = ''; }
      cur += (cur ? '\n' : '') + line;
    });
    if(cur.trim()) parts.push(cur);
    const out = new Array(parts.length); let firstErr = null;
    // at most 4 requests at a time, so a very long paste doesn't flood the connection
    for(let i = 0; i < parts.length; i += 4){
      await Promise.all(parts.slice(i, i + 4).map((p, k)=> parsePart(p, null).then(r=>{ out[i + k] = r; }).catch(e=>{ if(String(e && e.message) !== 'empty' && !firstErr) firstErr = e; })));
    }
    const got = out.filter(Boolean);
    if(!got.length) throw firstErr || new Error('empty');
    return { date: (got.find(r=> r.date) || {}).date || '', title: (got.find(r=> r.title) || {}).title || '', notes: got.map(r=> r.notes).filter(Boolean).join(' · '),
      ex: [].concat(...got.map(r=> r.ex)), partsFailed: parts.length - got.length };
  }
  async function parsePart(text, img){
    const lib = G.lib().map(e=> ({ id:e.id, he:e.he, en:e.en || '' }));
    // A request that never answers (a stalled phone connection) used to leave the button on
    // "מפענחים…" forever. After 45s it gives up with a clear message and the text stays.
    const ac = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(()=>{ if(ac) ac.abort(); }, 45000);
    let r, j;
    try{
      r = await fetch('/api/gemini', { method:'POST', headers:{ 'Content-Type':'application/json' }, signal: ac ? ac.signal : undefined,
        body: JSON.stringify({ mode:'trainerPlan', desc: text || '', mimeType: img && img.mimeType, data: img && img.data, lib, today: B().todayKey() }) });
      j = await r.json().catch(()=> ({}));
    }catch(e){ throw new Error(e && e.name === 'AbortError' ? 'timeout' : 'net'); }
    finally{ clearTimeout(timer); }
    if(!r.ok || !Array.isArray(j.exercises)) throw new Error(r.status ? 'server:' + r.status : 'net');
    if(!j.exercises.length) throw new Error('empty');
    const ex = j.exercises.map(e=>{
      const known = e.match && G.ex(e.match) ? e.match : (G.matchId(e.name) || (e.en ? G.matchId(e.en) : null));
      const kx = known ? G.ex(known) : null;
      const time = kx ? kx.kind === 'time' : e.kind === 'time';
      return { exId: known || '', isNew: !known, name: kx ? G.exName(kx) : e.name, en: e.en, area: e.area, kind: e.kind, perSide: e.perSide, note: e.note || '', picked: true,
        sets: e.sets.map(s=> Object.assign(time ? { kg:0, reps: s.reps || 0, sec: s.seconds || 0 } : { kg: s.kg || 0, reps: s.reps || 0, sec: s.seconds || 0 }, s.rpe ? { rpe: s.rpe } : {})) };
    });
    return { date: j.date || '', title: j.title || '', notes: j.notes || '', ex };
  }
  const parseErr = e=>{
    const m = String(e && e.message);
    if(m === 'timeout') return 'הפענוח לקח יותר מדי זמן, כנראה בגלל החיבור. הטקסט נשמר כאן, ואפשר ללחוץ שוב.';
    if(m === 'empty') return 'לא מצאתי תרגילים בטקסט. אפשר לנסות שוב, או להוסיף ידנית.';
    if(m.indexOf('server') === 0) return 'שירות הפענוח לא הצליח כרגע (קוד ' + (m.split(':')[1] || '?') + '). אפשר לנסות שוב בעוד רגע.';
    return 'הפענוח נכשל. כדאי לבדוק את החיבור לאינטרנט ולנסות שוב.';
  };
  G.parsePlan = parsePlan;
  G.openTrainerImport = function(){
    const st = { text:'', img:null, imgUrl:'', day: B().todayKey(), minutes: 60, busy:false, err:'' };
    function html(){
      return '<div class="text-[12px] gy-mut leading-relaxed" style="margin-top:-6px">אפשר להדביק כאן את התוכנית של ' + coachWord() + ' כמו שהגיעה בוואטסאפ, או להעלות צילום מסך שלה. המערכת תפענח אותה ותציג לבדיקה לפני שמירה.</div>' +
        '<textarea id="tiText" class="gy-in mt-3" style="min-height:160px;line-height:1.6" placeholder="למשל:\nלחיצת רגליים במכונה\n15 ק״ג 15 חז 3 סטים\n...">' + esc(st.text) + '</textarea>' +
        '<div class="gy-row mt-2"><label class="gy-btn gy-chip" style="cursor:pointer">📷 צילום מסך<input id="tiImg" type="file" accept="image/*" style="display:none"></label>' +
          (st.imgUrl ? '<img src="' + st.imgUrl + '" style="height:56px;border-radius:10px;border:1px solid rgba(255,255,255,.15)"><button class="gy-btn gy-chip" id="tiImgX">✕</button>' : '') + '</div>' +
        '<div class="gy-grid2 mt-3"><label><div class="gy-lbl mb-1">תאריך האימון</div><input class="gy-in" type="date" id="tiDay" value="' + st.day + '" max="' + B().todayKey() + '"></label>' +
          '<label><div class="gy-lbl mb-1">דקות</div><input class="gy-in" type="number" inputmode="numeric" id="tiMin" value="' + st.minutes + '"></label></div>' +
        '<div class="text-[11px] gy-mut mt-1">אם יש תאריך בתוכנית עצמה, הוא ייבחר אוטומטית.</div>' +
        (st.err ? '<div class="gy-card gy-danger mt-3" style="padding:10px;font-size:12px">' + esc(st.err) + '</div>' : '') +
        '<button id="tiGo" class="gy-btn gy-pri mt-4" style="height:56px;width:100%;font-size:17px"' + (st.busy ? ' disabled' : '') + '>' + (st.busy ? '⏳ מפענחים את התוכנית…' : 'פענוח התוכנית') + '</button>';
    }
    function grab(m){ st.text = m.querySelector('#tiText').value; st.day = m.querySelector('#tiDay').value || st.day; st.minutes = Math.max(10, Math.round(+m.querySelector('#tiMin').value || 60)); }
    function open(){
      sheet('👩‍🏫 אימון עם ' + coachWord().replace(/^ה/, ''), html(), (m, close)=>{
        const re = ()=>{ grab(m); m.remove(); open(); };
        m.querySelector('#tiImg').onchange = async ev=>{
          const f = ev.target.files && ev.target.files[0]; if(!f) return;
          grab(m);
          try{ st.img = { mimeType:'image/jpeg', data: await shotB64(f) }; st.imgUrl = 'data:image/jpeg;base64,' + st.img.data; st.err = ''; }
          catch(e){ st.err = 'לא הצלחתי לקרוא את התמונה'; }
          m.remove(); open();
        };
        const x = m.querySelector('#tiImgX'); if(x) x.onclick = ()=>{ st.img = null; st.imgUrl = ''; re(); };
        m.querySelector('#tiGo').onclick = async ()=>{
          grab(m);
          if(!st.text.trim() && !st.img){ st.err = 'צריך להדביק את התוכנית או להעלות צילום מסך'; re(); return; }
          st.busy = true; st.err = ''; m.remove(); open();
          try{
            const j = await parsePlan(st.text, st.img);
            const day = (j.date && j.date <= B().todayKey()) ? j.date : st.day;
            const ex = j.ex;
            const dupe = (B().workouts()[day] || []).some(w=> (S().sessions[w.id] || {}).trainer);
            st.busy = false;
            const sheetEl = document.getElementById('gyTrainer');
            if(!sheetEl) return;                         // closed while waiting — don't pop anything up
            sheetEl.remove();
            if(dupe) B().showToast('שימו לב: כבר יש אימון עם ' + coachWord() + ' ביום הזה — זה יישמר כאימון נוסף');
            else if(j.date && j.date !== st.day && j.date <= B().todayKey()) B().showToast('התאריך נלקח מהתוכנית: ' + dshort(j.date));
            G.openEditor(day, null, { trainer:true, source: st.img ? 'screenshot' : 'text',
              prefill: { day, minutes: st.minutes, note: (j.title || 'אימון עם ' + coachWord()) + (j.notes ? ' · ' + j.notes : ''), ex } });
          }catch(e){
            st.busy = false;
            st.err = parseErr(e);
            const mm = document.getElementById('gyTrainer'); if(!mm) return; mm.remove(); open();
          }
        };
      }, 'gyTrainer');
    }
    open();
  };

  // ---------- per-exercise tracking ----------
  function trend(id){
    const h = G.historyOf(id).slice(0, 4);
    if(h.length < 2) return { word:'מעט נתונים', cls:'gy-mut' };
    const a = G.entryStats(h[0]), b = G.entryStats(h[Math.min(2, h.length-1)]);
    const x = G.ex(id) || {};
    if(x.kind === 'time') return a.bestSec > b.bestSec ? { word:'עולה 📈', cls:'txt-green' } : a.bestSec < b.bestSec ? { word:'ירד', cls:'txt-amber' } : { word:'יציב', cls:'txt-sky' };
    if(a.top > b.top) return { word:'עולה במשקל 📈', cls:'txt-green' };
    if(a.top < b.top) return { word:'ירד במשקל', cls:'txt-amber' };
    if(a.minReps > b.minReps) return { word:'מתקדם בחזרות', cls:'txt-green' };
    if(a.rpe != null && b.rpe != null && a.rpe <= b.rpe - 1) return { word:'נהיה קל יותר', cls:'txt-green' };
    if(h.length >= 3) return { word:'יציב — אפשר לשקול שינוי', cls:'txt-sky' };
    return { word:'יציב', cls:'txt-sky' };
  }
  G.trend = trend;
  G.openTracking = function(){
    const lib = G.lib();
    const row = x=>{
      const h = G.historyOf(x.id); const last = h[0]; const tr = trend(x.id);
      const v = !last ? '—' : x.kind === 'time' ? G.fmtSec(G.entryStats(last).bestSec) : (G.fmtKg(G.entryStats(last).top) + ' ×' + G.entryStats(last).minReps);
      return '<li data-ex="' + x.id + '" style="cursor:pointer"><span>' + (x.icon||'🏋️') + '</span><span class="flex-1"><b class="text-gray-100">' + esc(x.he) + '</b>' + (G.isPaused(x)?' <span class="gy-mut text-[11px]">(מושהה)</span>':'') + '<div class="text-[11px] gy-mut">' + h.length + ' ביצועים' + (last ? ' · אחרון ' + dshort(last.day) : '') + '</div></span><span class="text-left"><div class="text-gray-100 font-bold">' + v + '</div><div class="text-[11px] ' + tr.cls + '">' + tr.word + '</div></span></li>';
    };
    let h = '';
    Object.entries(G.AREAS).forEach(([k, lbl])=>{
      const xs = lib.filter(x=> x.area === k && x.active);
      if(xs.length) h += '<div class="gy-lbl mt-3">' + lbl + '</div><ul class="gy-list">' + xs.map(row).join('') + '</ul>';
    });
    const off = lib.filter(x=> !x.active);
    if(off.length) h += '<details class="mt-4"><summary class="gy-lbl" style="cursor:pointer">לא פעילים (' + off.length + ')</summary><ul class="gy-list">' + off.map(row).join('') + '</ul></details>';
    sheet('📈 מעקב לפי תרגיל', h, m=>{ m.querySelectorAll('[data-ex]').forEach(li=> li.onclick = ()=> G.openExercise(li.dataset.ex)); }, 'gyTrack');
  };
  // Single-series line chart (one axis). Points are tappable; a caption shows the value.
  function lineChart(pts, opts){
    if(pts.length < 2) return '';
    const W = 320, H = opts.h || 140, P = { l:34, r:14, t:14, b:22 };
    const ys = pts.map(p=> p.y);
    let lo = opts.min != null ? opts.min : Math.min(...ys), hi = opts.max != null ? opts.max : Math.max(...ys);
    if(hi === lo){ hi += 1; lo = Math.max(0, lo - 1); }
    const pad = (hi - lo) * 0.12; if(opts.min == null) lo = Math.max(0, lo - pad); if(opts.max == null) hi += pad;
    const X = i=> P.l + (pts.length === 1 ? 0 : i * (W - P.l - P.r) / (pts.length - 1));
    const Y = v=> P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
    const grid = [lo, (lo+hi)/2, hi].map(v=> '<line x1="' + P.l + '" x2="' + (W-P.r) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="rgba(255,255,255,.07)"/><text x="' + (P.l-6) + '" y="' + (Y(v)+3) + '" fill="#8b90a3" font-size="9" text-anchor="end">' + r1(v) + '</text>').join('');
    const path = pts.map((p,i)=> (i?'L':'M') + X(i).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
    const dots = pts.map((p,i)=> '<g data-pt="' + i + '" style="cursor:pointer"><circle cx="' + X(i) + '" cy="' + Y(p.y) + '" r="12" fill="transparent"/><circle cx="' + X(i) + '" cy="' + Y(p.y) + '" r="4.5" fill="' + opts.color + '" stroke="#0d0f19" stroke-width="2"/></g>').join('');
    const last = pts[pts.length-1];
    const xl = '<text x="' + X(0) + '" y="' + (H-6) + '" fill="#8b90a3" font-size="9" text-anchor="middle">' + dshort(pts[0].day) + '</text><text x="' + X(pts.length-1) + '" y="' + (H-6) + '" fill="#8b90a3" font-size="9" text-anchor="middle">' + dshort(last.day) + '</text>';
    return '<div class="gy-card mt-3" style="padding:10px"><div class="gy-lbl mb-1">' + opts.title + '</div><svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;direction:ltr" data-chart="' + opts.key + '">' + grid +
      '<path d="' + path + '" fill="none" stroke="' + opts.color + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' + dots + xl +
      '<text x="' + Math.min(W-P.r, X(pts.length-1)) + '" y="' + (Y(last.y) - 9) + '" fill="#e5e7eb" font-size="10" font-weight="700" text-anchor="end">' + (opts.fmt ? opts.fmt(last.y) : r1(last.y)) + '</text></svg>' +
      '<div class="text-[11px] gy-mut mt-1 text-center" data-cap="' + opts.key + '">נגיעה בנקודה מציגה את הפרטים</div></div>';
  }
  G.openExercise = function(id){
    const x = G.ex(id); if(!x) return;
    const h = G.historyOf(id).slice().reverse();          // oldest → newest
    const time = x.kind === 'time';
    const pts = h.map(e=>{ const st = G.entryStats(e); return { day:e.day, y: time ? st.bestSec : st.top, e, st }; });
    const rp = h.map(e=> ({ day:e.day, y: G.entryStats(e).rpe, e })).filter(p=> p.y != null);
    const rec = G.recommend(id);
    const tr = trend(id);
    const prKg = Math.max(0, ...pts.map(p=> time ? 0 : p.st.top));
    const prVol = Math.max(0, ...h.map(e=> G.entryStats(e).volume));
    const prSec = Math.max(0, ...h.map(e=> G.entryStats(e).bestSec));
    const prReps = Math.max(0, ...pts.filter(p=> p.st.top === prKg).map(p=> p.st.maxReps));
    const o = S().lib[id] || {};
    let html = '<div class="gy-mut font-bold" style="margin-top:-8px">' + esc(x.en||'') + ' · ' + (G.AREAS[x.area]||'') + (x.note ? ' · ' + esc(x.note) : '') + '</div>';
    html += '<div class="gy-card mt-3" style="font-size:13px;line-height:1.7"><div><span class="gy-lbl">מגמה: </span><b class="' + tr.cls + '">' + tr.word + '</b></div>' +
      (rec ? '<div><span class="gy-lbl">בפעם הבאה: </span><b class="text-gray-100">' + esc(G.recLine(rec, x)) + '</b></div><div class="text-[11px] gy-mut">' + esc(rec.why||'') + '</div>' : '') + '</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px" class="mt-3">' +
      (time ? '<div class="gy-card" style="padding:10px;text-align:center"><div class="gy-lbl">שיא זמן</div><div class="gy-mid txt-green">' + (prSec? G.fmtSec(prSec) : '—') + '</div></div>'
            : '<div class="gy-card" style="padding:10px;text-align:center"><div class="gy-lbl">משקל שיא</div><div class="gy-mid txt-green">' + (prKg||'—') + '</div></div><div class="gy-card" style="padding:10px;text-align:center"><div class="gy-lbl">חזרות בשיא</div><div class="gy-mid txt-sky">' + (prReps||'—') + '</div></div><div class="gy-card" style="padding:10px;text-align:center"><div class="gy-lbl">נפח שיא</div><div class="gy-mid" style="font-size:18px">' + (prVol ? Math.round(prVol) : '—') + '</div></div>') + '</div>';
    html += lineChart(pts, { key:'w', title: time ? 'זמן (שניות) לאורך זמן' : 'משקל עבודה (ק״ג) לאורך זמן', color:'#00ffa3', fmt: time ? (v=> G.fmtSec(v)) : null });
    html += lineChart(rp, { key:'r', title:'קושי (1 עד 10)', color:'#27d3ff', min:1, max:10, h:110 });
    if(!time) html += '<div class="text-[10px] gy-mut mt-1">נפח (משקל × חזרות × סטים) מוצג בטבלה ובשיא, אבל ההתקדמות נמדדת לפי משקל, חזרות וקושי.</div>';
    html += '<div class="gy-lbl mt-4 mb-1">כל הביצועים</div><table class="gy-tbl"><tr><th>תאריך</th><th>ביצוע</th><th>קושי</th>' + (time?'':'<th>נפח</th>') + '</tr>' +
      h.slice().reverse().map(e=>{ const st = G.entryStats(e); return '<tr data-day="' + e.day + '" style="cursor:pointer"><td>' + dshort(e.day) + (e.trainer?' 👩‍🏫':'') + '</td><td class="text-gray-100">' + esc(G.setsLine(e, x)) + '</td><td>' + (st.rpe!=null? r1(st.rpe):'') + '</td>' + (time?'':'<td class="gy-mut">' + Math.round(st.volume) + '</td>') + '</tr>'; }).join('') + '</table>';
    // settings
    const work = o.work || {};
    html += '<details class="mt-4"><summary class="font-black text-gray-100" style="cursor:pointer">⚙️ הגדרות לתרגיל</summary><div class="mt-3" style="display:grid;gap:10px">' +
      '<label class="gy-row"><input type="checkbox" id="xsActive"' + (x.active?' checked':'') + '> <span>פעיל ברוטציה</span></label>' +
      '<label><div class="gy-lbl mb-1">מושהה עד (ריק = לא מושהה)</div><input class="gy-in" type="date" id="xsPause" value="' + (x.pausedUntil||'') + '"></label>' +
      (time ? '<label><div class="gy-lbl mb-1">יעד זמן לפעם הבאה (שניות, ריק = אוטומטי)</div><input class="gy-in" type="number" id="xsSec" value="' + (work.sec||'') + '"></label>'
        : '<div class="gy-grid2"><label><div class="gy-lbl mb-1">טווח חזרות: מ-</div><input class="gy-in" type="number" id="xsLo" value="' + (x.lo||10) + '"></label><label><div class="gy-lbl mb-1">עד</div><input class="gy-in" type="number" id="xsHi" value="' + (x.hi||15) + '"></label></div>' +
          '<div class="gy-grid2"><label><div class="gy-lbl mb-1">משקל עבודה ידני (ריק = אוטומטי)</div><input class="gy-in" type="number" step="0.5" id="xsKg" value="' + (work.kg ?? '') + '"></label><label><div class="gy-lbl mb-1">חזרות</div><input class="gy-in" type="number" id="xsReps" value="' + (work.reps||'') + '"></label></div>' +
          '<label><div class="gy-lbl mb-1">מדרגות משקל במכשיר (מופרדות בפסיק)</div><input class="gy-in" id="xsSteps" value="' + esc((x.steps||[]).join(', ')) + '"></label>') +
      '<label><div class="gy-lbl mb-1">הערה</div><input class="gy-in" id="xsNote" value="' + esc(x.note||'') + '"></label>' +
      '<button class="gy-btn gy-pri" style="height:48px" id="xsSave">שמירת הגדרות</button></div></details>';
    sheet((x.icon||'') + ' ' + esc(x.he), html, (m, close)=>{
      const cap = (key, list, f)=> m.querySelectorAll('[data-chart="' + key + '"] [data-pt]').forEach(g=> g.onclick = ()=>{ const p = list[+g.dataset.pt]; m.querySelector('[data-cap="' + key + '"]').textContent = f(p); });
      cap('w', pts, p=> dshort(p.day) + ' · ' + G.setsLine(p.e, x) + (p.st.rpe!=null ? ' · קושי ' + r1(p.st.rpe) : ''));
      cap('r', rp, p=> dshort(p.day) + ' · קושי ' + r1(p.y) + ' · ' + G.setsLine(p.e, x));
      m.querySelectorAll('tr[data-day]').forEach(tr=> tr.onclick = ()=> G.openDay(tr.dataset.day));
      m.querySelector('#xsSave').onclick = ()=>{
        const patch = { active: m.querySelector('#xsActive').checked, pausedUntil: m.querySelector('#xsPause').value || null, note: m.querySelector('#xsNote').value || undefined };
        if(time){ const sec = +m.querySelector('#xsSec').value; patch.work = sec > 0 ? { sec, day: B().todayKey() } : null; }
        else {
          const lo = Math.round(+m.querySelector('#xsLo').value), hi = Math.round(+m.querySelector('#xsHi').value);
          if(lo > 0 && hi >= lo){ patch.lo = lo; patch.hi = hi; }
          const kgV = m.querySelector('#xsKg').value;
          patch.work = kgV === '' ? null : { kg: +kgV, reps: Math.round(+m.querySelector('#xsReps').value) || undefined, day: B().todayKey() };
          const steps = m.querySelector('#xsSteps').value.split(/[,\s]+/).map(Number).filter(n=> n >= 0 && isFinite(n));
          if(steps.length >= 2) patch.steps = Array.from(new Set(steps)).sort((a,b)=> a-b);
        }
        G.setLib(id, patch); B().showToast('ההגדרות נשמרו ✓'); close(); G.openExercise(id); B().renderAll();
      };
    }, 'gyEx');
  };

  // ---------- activity log ----------
  const ACT_LABEL = { pilates:'🌀 פילאטיס מכשירים', salsa:'💃 סלסה', zumba:'💃 זומבה', walk:'🚶 הליכה', other:'✨ פעילות אחרת' };
  const ACT_TYPE = { pilates:'pilates', salsa:'dance', zumba:'dance', walk:'walk', other:'other' };
  G.ACT_LABEL = ACT_LABEL;
  function dislikedNote(classType){
    const ct = String(classType||'').trim();
    if(!ct) return '';
    if(/מודרני|modern/i.test(ct)) return 'סומן בעבר כלא אהוב (פילאטיס מכשירים מודרני)';
    const prev = Object.values(S().activities).find(a=> a && a.repeat === false && String(a.classType||'').trim() === ct);
    return prev ? 'סומן בעבר כ"לא לחזור"' : '';
  }
  G.dislikedNote = dislikedNote;
  // How a burn is counted: a number typed by hand wins, then the estimate from the free
  // text, then the table estimate from type × intensity × minutes. Everything is the NET
  // burn (above resting), the same number the app shows on a workout card.
  function actLevel(rpe){ rpe = +rpe || 0; return !rpe ? 'mid' : rpe <= 4 ? 'low' : rpe <= 7 ? 'mid' : 'high'; }
  function actBurn(d){
    const b = B(), type = ACT_TYPE[d.kind] || 'other', level = actLevel(d.rpe);
    const minutes = Math.max(1, Math.round(+d.minutes || 50));
    const rest = b.restKcal ? b.restKcal(minutes) : 0;
    if(d.kcalManual != null && d.kcalManual !== '' && +d.kcalManual >= 0){
      const net = Math.round(+d.kcalManual);
      return { net, gross: net + rest, src:'manual' };
    }
    if(d.ai && +d.ai.minutes > 0 && +d.ai.kcal > 0){
      const gross = Math.round(+d.ai.kcal * minutes / +d.ai.minutes);   // same pace, new duration
      return { net: Math.max(0, gross - rest), gross, src:'ai' };
    }
    return { net: b.estKcalNet(type, level, minutes), gross: b.estKcal(type, level, minutes), src:'table' };
  }
  // What this activity does to the day, in plain words. Read only: the food-budget setting
  // is shown, never changed from here.
  function actImpact(d, net, saved){
    const b = B(), L = [];
    const p = b.kcalPrefs ? b.kcalPrefs() : { on:false, eatBack:false };
    const dayWord = d.day === b.todayKey() ? 'של היום' : 'של אותו יום';
    if(!p.on) L.push({ t:'📊 נספר בשריפה היומית ובסיכומים. תקציב קלוריות לא מוצג אצלך, אז שום יעד אכילה לא משתנה.' });
    else if(p.eatBack) L.push({ t:'➕ ' + net + ' קלוריות ' + (saved ? 'נוספו' : 'יתווספו') + ' לתקציב האכילה ' + dayWord + '.' });
    else L.push({ t:'🍽️ תקציב האכילה ' + dayWord + ' לא משתנה: האפשרות להוסיף קלוריות מאימון כבויה אצלך.', link:true });
    const kind = d.kind;
    if(kind === 'pilates'){
      const ws = G.weekStatus ? G.weekStatus() : null;
      if(ws && +ws.pilatesTarget > 0) L.push({ t:'🌀 נספר ביעד הפילאטיס השבועי' + (saved ? ' (' + ws.pilates + ' מתוך ' + ws.pilatesTarget + ' השבוע)' : '') + '.' });
      else L.push({ t:'🌀 נספר כאימון פילאטיס.' });
    } else if(kind === 'salsa' || kind === 'zumba') L.push({ t:'💃 נספר כריקוד, גם בהישגים של ריקוד.' });
    L.push({ t:'🤸 נספר באימונים, בנקודות ובהישגים.' });
    const wkCount = ((b.workouts() || {})[d.day] || []).length;
    if(b.hasFood && b.hasFood(d.day) && wkCount === (saved ? 1 : 0)) L.push({ t:'🔗 יחד עם האוכל שנרשם, זה יום פעיל: עוד 10 נקודות.' });
    return L;
  }
  function impactHTML(L, form){
    return L.map(x=> '<div style="font-size:13px;line-height:1.55;margin-top:4px">' + esc(x.t) +
      (x.link && form ? '<div class="gy-mut" style="font-size:11px;margin-top:2px">משנים את זה בתפריט, ב"יעדים ופרופיל", באפשרות "להוסיף קלוריות מאימון".</div>' : '') +
      (x.link && !form ? ' <button class="gy-btn gy-chip" data-kset style="height:28px;font-size:11px;padding:0 10px;margin-top:4px">איפה משנים את זה</button>' : '') + '</div>').join('');
  }
  function saveActivity(d){
    const b = B();
    const kind = ACT_TYPE[d.kind] ? d.kind : 'other';
    const type = ACT_TYPE[kind];
    const rpe = +d.rpe || 0;
    const level = actLevel(rpe);
    const minutes = Math.max(1, Math.round(+d.minutes || 50));
    const text = String(d.text || '').trim();                 // any length; the full text is kept
    const short = text.length > 140 ? text.slice(0, 140) + '…' : text;   // the one-line title only
    const burn = actBurn(Object.assign({}, d, { kind, minutes }));
    const base = kind === 'other' ? (short || 'פעילות אחרת') : (ACT_LABEL[kind]||'').replace(/^\S+ /,'') + (d.classType ? ' · ' + d.classType : '') + (short ? ' · ' + short : '');
    const w = { id: b.uid(), type, level, minutes, kcal: burn.gross, kcalNet: burn.net, note: base };
    const day = d.day || b.todayKey();
    b.addWorkout(w, day);
    S().activities[w.id] = { kind, day, text, kcalSource: burn.src, instructor: d.instructor || '', classType: d.classType || '', rpe: rpe || null, enjoy: +d.enjoy || null, repeat: d.repeat == null ? null : !!d.repeat, at: Date.now() };
    G.save(); b.renderAll();
    return w;
  }
  G.saveActivity = saveActivity;
  // Free-text activities typed before, most recent first, as one-tap chips.
  function recentFree(){
    const seen = new Set(), out = [];
    Object.values(S().activities || {}).filter(a=> a && a.kind === 'other' && String(a.text||'').trim())
      .sort((a,b)=> (+b.at||0) - (+a.at||0))
      .forEach(a=>{ const t = String(a.text).trim(); const k = t.toLowerCase(); if(!seen.has(k) && out.length < 6){ seen.add(k); out.push(t); } });
    return out;
  }
  G.openActivity = function(){
    const tok = Math.random().toString(36).slice(2);
    const d = { kind:'pilates', minutes:50, instructor:'', classType:'', text:'', rpe:null, enjoy:null, repeat:null, day: B().todayKey(), ai:null, kcalManual:null, err:'' };
    function html(){
      const grid = (key, from)=> '<div class="gy-rpe">' + Array.from({length: 11-from}, (_,i)=> i+from).map(i=> '<button class="gy-btn' + (d[key]===i?' on':'') + '" data-g="' + key + '" data-v="' + i + '">' + i + '</button>').join('') + '</div>';
      const warn = d.kind === 'pilates' ? dislikedNote(d.classType) : '';
      const recent = recentFree();
      const burn = actBurn(d);
      const ph = d.kind === 'other' ? 'למשל: טניס, גינון, טיול עם הכלב, שיעור ריקוד' : 'פרטים, אם רוצים (לא חובה)';
      return '<div class="flex flex-wrap gap-2">' + Object.entries(ACT_LABEL).map(([k,l])=> '<button class="gy-btn gy-chip' + (d.kind===k?' on':'') + '" data-kind="' + k + '">' + l + '</button>').join('') + '</div>' +
        (recent.length ? '<div class="gy-lbl mt-3 mb-1">ממה שרשמת בעבר</div><div class="flex flex-wrap gap-2">' + recent.map((t,i)=> '<button class="gy-btn gy-chip' + (d.kind==='other' && d.text===t ? ' on' : '') + '" data-recent="' + i + '">✨ ' + esc(t.length > 40 ? t.slice(0, 40) + '…' : t) + '</button>').join('') + '</div>' : '') +
        '<label class="block mt-3"><div class="gy-lbl mb-1">' + (d.kind === 'other' ? 'מה עשית?' : 'מה עשית? (טקסט חופשי)') + '</div><textarea class="gy-in" id="acText" rows="3" style="resize:vertical;min-height:72px;line-height:1.5" placeholder="' + ph + '">' + esc(d.text) + '</textarea></label>' +
        '<div class="gy-grid2 mt-3"><label><div class="gy-lbl mb-1">תאריך</div><input class="gy-in" type="date" id="acDay" value="' + d.day + '" max="' + B().todayKey() + '"></label><label><div class="gy-lbl mb-1">דקות</div><input class="gy-in" type="number" inputmode="numeric" id="acMin" value="' + d.minutes + '"></label></div>' +
        (d.kind === 'pilates' ? '<div class="gy-grid2 mt-2"><label><div class="gy-lbl mb-1">שם המדריך או המדריכה</div><input class="gy-in" id="acIns" value="' + esc(d.instructor) + '"></label><label><div class="gy-lbl mb-1">סוג השיעור</div><input class="gy-in" id="acCls" list="acClsList" value="' + esc(d.classType) + '"><datalist id="acClsList"><option value="פילאטיס מכשירים"><option value="פילאטיס מכשירים מודרני"><option value="פילאטיס מזרן"></datalist></label></div>' : '') +
        (warn ? '<div class="gy-card gy-warn mt-2" style="padding:10px;font-size:12px">⚠️ ' + esc(warn) + '</div>' : '') +
        '<div class="font-black text-gray-100 mt-3 mb-1">קושי</div>' + grid('rpe', 1) +
        // The burn and what it does to the day, visible before saving.
        '<div class="gy-card mt-4" style="padding:14px">' +
          '<div id="acBurnTop">' + burnTop() + '</div>' +
          '<div class="gy-row mt-2" style="flex-wrap:wrap">' +
            '<button class="gy-btn gy-chip" id="acAi" style="height:34px;font-size:12px"' + (d.busy || !String(d.text||'').trim() ? ' disabled' : '') + '>' + (d.busy ? '⏳ מחשבים…' : '✨ הערכה לפי התיאור') + '</button>' +
            '<label class="gy-row" style="gap:6px;font-size:12px"><span class="gy-mut">תיקון ידני:</span><input class="gy-in" type="number" inputmode="numeric" id="acKcal" placeholder="' + burn.net + '" value="' + (d.kcalManual != null ? esc(d.kcalManual) : '') + '" style="width:90px;height:34px;padding:4px 8px"></label>' +
          '</div>' +
          '<div id="acBurnImpact">' + burnImpact() + '</div>' +
        '</div>' +
        '<div class="font-black text-gray-100 mt-3 mb-1">הנאה</div>' + grid('enjoy', 1) +
        '<div class="font-black text-gray-100 mt-3 mb-1">לחזור על זה?</div><div class="flex gap-2"><button class="gy-btn gy-chip' + (d.repeat===true?' on':'') + '" data-rep="1">כן</button><button class="gy-btn gy-chip' + (d.repeat===false?' on':'') + '" data-rep="0">לא</button></div>' +
        '<button class="gy-btn gy-pri mt-5" style="height:56px;width:100%;font-size:17px" id="acSave">שמירה</button>';
    }
    // The burn card is redrawn in place while typing, so the fields keep focus and a tap on
    // "שמירה" right after typing is never swallowed by a re-render.
    function burnTop(){
      const burn = actBurn(d);
      const srcTxt = burn.src === 'manual' ? 'המספר שהזנת' : burn.src === 'ai' ? 'הערכה לפי התיאור שלך' : 'הערכה לפי הסוג, המשך והקושי';
      return '<div class="font-black text-gray-100" style="font-size:16px">🔥 בערך ' + burn.net + ' קלוריות</div>' +
        '<div class="gy-mut" style="font-size:11px;margin-top:2px">' + srcTxt + ' · מעבר למה שהגוף שורף במנוחה</div>';
    }
    function burnImpact(){
      return (d.err ? '<div class="gy-card gy-danger mt-2" style="padding:8px;font-size:12px">' + esc(d.err) + '</div>' : '') +
        '<div class="font-black text-gray-100 mt-3" style="font-size:13px">מה זה עושה ליום שלך</div>' + impactHTML(actImpact(d, actBurn(d).net, false), true);
    }
    function grab(m){
      const v = id=> (m.querySelector(id)||{}).value;
      d.day = v('#acDay') || d.day;
      const mins = Math.round(+v('#acMin') || 0); if(mins > 0) d.minutes = Math.min(600, mins);
      const tx = m.querySelector('#acText'); if(tx){ if(tx.value !== d.text) d.ai = null; d.text = tx.value; }
      const kc = m.querySelector('#acKcal'); if(kc) d.kcalManual = kc.value === '' ? null : Math.max(0, Math.min(5000, Math.round(+kc.value || 0)));
      if(m.querySelector('#acIns')){ d.instructor = v('#acIns'); d.classType = v('#acCls'); }
    }
    function bindKset(m, close){ m.querySelectorAll('[data-kset]').forEach(x=> x.onclick = ()=>{ close(); B().openKcalSettings && B().openKcalSettings(); }); }
    function done(w){
      const burn = { net: Math.round(+w.kcalNet || 0) };
      sheet('✓ הפעילות נרשמה', '<div class="gy-card" style="padding:14px"><div class="font-black text-gray-100" style="font-size:16px">🔥 ' + burn.net + ' קלוריות · ' + esc(w.note) + ' · ' + w.minutes + ' דק׳</div>' +
        '<div class="font-black text-gray-100 mt-3" style="font-size:13px">מה זה עשה ליום שלך</div>' + impactHTML(actImpact(d, burn.net, true)) + '</div>' +
        '<button class="gy-btn gy-pri mt-4" data-close style="height:52px;width:100%;font-size:16px">מעולה</button>', (m, close)=>{ bindKset(m, close); m.querySelectorAll('[data-close]').forEach(x=> x.onclick = close); }, 'gyActDone');
    }
    function open(){
      sheet('רישום פעילות', html(), (m, close)=>{
        const re = ()=>{ grab(m); if(!m.isConnected) return; m.remove(); open(); };
        const refresh = ()=>{
          grab(m);
          const top = m.querySelector('#acBurnTop'), imp = m.querySelector('#acBurnImpact'), ab = m.querySelector('#acAi');
          if(top) top.innerHTML = burnTop();
          if(imp){ imp.innerHTML = burnImpact(); bindKset(m, close); }
          if(ab) ab.disabled = !!d.busy || !String(d.text||'').trim();
          const kc = m.querySelector('#acKcal'); if(kc) kc.placeholder = String(actBurn(Object.assign({}, d, { kcalManual:null })).net);
        };
        m.querySelectorAll('[data-kind]').forEach(b=> b.onclick = ()=>{ grab(m); d.kind = b.dataset.kind; d.ai = null; d.err = ''; d.minutes = d.kind === 'walk' ? 30 : d.kind === 'salsa' ? 90 : d.kind === 'other' ? 45 : 50; m.remove(); open(); });
        const rec = recentFree();
        m.querySelectorAll('[data-recent]').forEach(b=> b.onclick = ()=>{ grab(m); d.kind = 'other'; d.text = rec[+b.dataset.recent] || ''; d.ai = null; m.remove(); open(); });
        m.querySelectorAll('[data-g]').forEach(b=> b.onclick = ()=>{ d[b.dataset.g] = +b.dataset.v; if(b.dataset.g === 'rpe') d.ai = null; re(); });
        m.querySelectorAll('[data-rep]').forEach(b=> b.onclick = ()=>{ d.repeat = b.dataset.rep === '1'; re(); });
        // Live numbers: minutes, a hand-typed burn or a new description redraw the estimate.
        ['#acMin','#acKcal','#acText'].forEach(s=>{ const el = m.querySelector(s); if(el) el.oninput = refresh; });
        const dayEl = m.querySelector('#acDay'); if(dayEl) dayEl.onchange = refresh;   // a date picker has no input stream
        const cls = m.querySelector('#acCls'); if(cls) cls.onchange = re;
        bindKset(m, close);
        const ai = m.querySelector('#acAi');
        if(ai) ai.onclick = async ()=>{
          grab(m); d.busy = true; d.err = ''; re();
          const desc = String(d.text).trim().slice(0, 800) + ' · ' + d.minutes + ' דקות' + (d.rpe ? ' · קושי ' + d.rpe + ' מתוך 10' : '');
          try{
            const r = await B().aiActivity(desc);
            if(r && +r.kcal > 0){ d.ai = { kcal: Math.round(+r.kcal), minutes: Math.max(1, Math.round(+d.minutes || 50)) }; d.kcalManual = null; d.err = ''; }
            else d.err = 'לא התקבלה הערכה. אפשר להזין מספר ידנית או להשאיר את ההערכה לפי הסוג.';
          }catch(e){ d.err = 'ההערכה לא הצליחה כרגע. אפשר להזין מספר ידנית או לנסות שוב.'; }
          d.busy = false;
          const el = document.getElementById('gyAct'); if(el && el.dataset.tok === tok){ el.remove(); open(); }
        };
        m.querySelector('#acSave').onclick = ()=>{
          grab(m);
          if(d.kind === 'other' && !String(d.text).trim()){ d.err = ''; const t = m.querySelector('#acText'); if(t){ t.focus(); t.style.borderColor = '#ff5d73'; } B().showToast('כדאי לכתוב מה עשית'); return; }
          const w = saveActivity(d); close(); done(w);
        };
      }, 'gyAct').dataset.tok = tok;
    }
    open();
  };

  // ---------- coach report ----------
  function coachData(from, to){
    const all = B().workouts();
    const days = Object.keys(all).filter(d=> d >= from && d <= to).sort();
    const sessions = [];
    days.forEach(d=> (all[d]||[]).filter(relevant).forEach(w=> sessions.push({ day:d, w, m: S().sessions[w.id] || {}, a: S().activities[w.id] })));
    const strength = sessions.filter(s=> !s.a && (s.w.exercises||[]).length);
    const per = {};
    G.history().filter(h=> h.day >= from && h.day <= to && h.exId).forEach(h=>{ (per[h.exId] = per[h.exId] || []).push(h); });
    const exRows = Object.keys(per).map(id=>{
      const list = per[id].slice().sort((a,b)=> a.day < b.day ? -1 : 1);
      const x = G.ex(id) || { he:id };
      const first = list[0], last = list[list.length-1];
      const fa = G.entryStats(first), la = G.entryStats(last);
      let change;
      if(x.kind === 'time') change = la.bestSec > fa.bestSec ? '+' + (la.bestSec - fa.bestSec) + ' שנ׳' : la.bestSec < fa.bestSec ? (la.bestSec - fa.bestSec) + ' שנ׳' : 'ללא שינוי';
      else change = la.top !== fa.top ? (la.top > fa.top ? 'משקל עלה ב-' : 'משקל ירד ב-') + (Math.round(Math.abs(la.top - fa.top)*100)/100) + ' ק״ג' : la.minReps !== fa.minReps ? (la.minReps > fa.minReps ? '+' : '') + (la.minReps - fa.minReps) + ' חזרות' : (fa.rpe!=null && la.rpe!=null && la.rpe < fa.rpe ? 'אותו ביצוע, קל יותר' : 'ללא שינוי');
      const rec = x.active === false ? null : G.recommend(id);
      return { id, x, n:list.length, first, last, fa, la, change, rec };
    }).sort((a,b)=> (a.x.route||99) - (b.x.route||99));
    const avg = arr=>{ const v = arr.filter(n=> n!=null && !isNaN(n)); return v.length ? r1(v.reduce((a,b)=> a+b, 0)/v.length) : null; };
    return {
      from, to, sessions, strength,
      trainerN: strength.filter(s=> s.m.trainer).length,
      acts: sessions.filter(s=> s.a),
      avgMin: avg(strength.map(s=> +s.w.minutes || null)),
      avgOverall: avg(strength.map(s=> s.m.overall)), avgSore: avg(strength.map(s=> s.m.soreness)), avgEnergy: avg(strength.map(s=> s.m.energy)),
      flags: strength.filter(s=> s.m.flags && s.m.flags.length).map(s=> dshort(s.day) + ': ' + s.m.flags.join(', ')),
      exRows, next: G.nextWorkout(),
    };
  }
  function coachText(c){
    const L = ['דוח אימונים למאמנת', 'תקופה: ' + dshort(c.from) + ' – ' + dshort(c.to), ''];
    L.push('אימוני כוח: ' + c.strength.length + (c.trainerN ? ' (מתוכם ' + c.trainerN + ' איתך)' : '') + (c.avgMin ? ' · משך ממוצע ' + c.avgMin + ' דק׳' : ''));
    const actCount = {}; c.acts.forEach(s=>{ const l = (ACT_LABEL[s.a.kind]||'').replace(/^\S+ /,''); actCount[l] = (actCount[l]||0) + 1; });
    if(c.acts.length) L.push('פעילויות נוספות: ' + Object.entries(actCount).map(([k,v])=> k + ' ×' + v).join(', '));
    const q = [c.avgOverall!=null ? 'קושי כללי ' + c.avgOverall : '', c.avgSore!=null ? 'תפיסות לפני ' + c.avgSore : '', c.avgEnergy!=null ? 'אנרגיה ' + c.avgEnergy : ''].filter(Boolean);
    if(q.length) L.push('ממוצעים: ' + q.join(' · '));
    if(c.flags.length) L.push('⚠️ דיווחים חריגים: ' + c.flags.join(' | '));
    L.push(''); L.push('התקדמות לפי תרגיל:');
    c.exRows.forEach(r=> L.push('• ' + r.x.he + ' (' + r.n + '×): ' + G.setsLine(r.first, r.x) + ' ← ' + G.setsLine(r.last, r.x) + (r.la.rpe!=null ? ' · קושי ' + r1(r.la.rpe) : '') + ' · ' + r.change + (r.rec ? ' · הבא: ' + G.recLine(r.rec, r.x) : '')));
    L.push(''); L.push('פירוט אימונים:');
    c.sessions.forEach(s=>{
      L.push(dlong(s.day) + ' — ' + woTitle(s.w).replace(/^👩‍🏫 /,'') + (woMeta(s.w) ? ' (' + woMeta(s.w) + ')' : ''));
      (s.w.exercises||[]).forEach(e=>{ const x = exLine(e); L.push('   ' + x.name + ': ' + x.sets + (x.rpe!=null ? ' · ' + r1(x.rpe) : '') + (x.note ? ' (' + x.note + ')' : '')); });
    });
    if(c.next) L.push('', 'האימון הבא המתוכנן: ' + c.next.text);
    return L.join('\n');
  }
  function coachHTML(c){
    const td = v=> '<td style="padding:5px 6px;border-bottom:1px solid #ddd;font-size:11px">' + v + '</td>';
    let h = '<p style="font-size:12px;margin:0 0 10px">תקופה: ' + dshort(c.from) + ' – ' + dshort(c.to) + ' · אימוני כוח: <b>' + c.strength.length + '</b>' + (c.trainerN ? ' (מתוכם ' + c.trainerN + ' עם המאמנת)' : '') +
      (c.avgMin ? ' · משך ממוצע ' + c.avgMin + ' דק׳' : '') + (c.avgOverall!=null ? ' · קושי ממוצע ' + c.avgOverall : '') + (c.avgSore!=null ? ' · תפיסות ממוצעות ' + c.avgSore : '') + '</p>';
    if(c.flags.length) h += '<p style="font-size:12px;color:#b45309">⚠️ ' + esc(c.flags.join(' | ')) + '</p>';
    h += '<h2 style="font-size:14px;margin:12px 0 4px">התקדמות לפי תרגיל</h2><table style="width:100%;border-collapse:collapse"><tr>' + ['תרגיל','פעמים','בתחילת התקופה','בסוף התקופה','קושי אחרון','שינוי','לפעם הבאה'].map(t=> '<th style="text-align:right;font-size:11px;border-bottom:2px solid #333;padding:5px 6px">' + t + '</th>').join('') + '</tr>' +
      c.exRows.map(r=> '<tr>' + td('<b>' + esc(r.x.he) + '</b>') + td(r.n) + td(esc(G.setsLine(r.first, r.x))) + td(esc(G.setsLine(r.last, r.x))) + td(r.la.rpe!=null ? r1(r.la.rpe) : '') + td(esc(r.change)) + td(r.rec ? esc(G.recLine(r.rec, r.x)) : '') + '</tr>').join('') + '</table>';
    h += '<h2 style="font-size:14px;margin:14px 0 4px">פירוט אימונים</h2>';
    c.sessions.forEach(s=>{
      h += '<div style="margin:6px 0;font-size:11px"><b>' + dlong(s.day) + ' — ' + esc(woTitle(s.w).replace(/^👩‍🏫 /,'')) + '</b>' + (woMeta(s.w) ? ' <span style="color:#555">(' + esc(woMeta(s.w)) + ')</span>' : '') +
        ((s.w.exercises||[]).length ? '<div style="color:#333">' + s.w.exercises.map(e=>{ const x = exLine(e); return esc(x.name) + ': ' + esc(x.sets) + (x.rpe!=null ? ' · ' + r1(x.rpe) : ''); }).join(' · ') + '</div>' : '') + '</div>';
    });
    if(c.next) h += '<p style="font-size:12px;margin-top:10px"><b>האימון הבא המתוכנן:</b> ' + esc(c.next.text) + '</p>';
    return h;
  }
  G.openCoachReport = function(){
    let mode = '14', from = '', to = '';
    function range(){
      const t = B().todayKey();
      if(mode === 'custom' && from && to) return { from: from <= to ? from : to, to: from <= to ? to : from };
      return { from: B().shiftKey(t, -(+mode - 1)), to: t };
    }
    function open(){
      const r = range(); const c = coachData(r.from, r.to);
      let h = '<div class="flex gap-2 flex-wrap">' + [['7','שבוע'],['14','שבועיים'],['30','חודש'],['custom','טווח אחר']].map(([k,l])=> '<button class="gy-btn gy-chip' + (mode===k?' on':'') + '" data-mode="' + k + '">' + l + '</button>').join('') + '</div>';
      if(mode === 'custom') h += '<div class="gy-grid2 mt-2"><input class="gy-in" type="date" id="crFrom" value="' + r.from + '"><input class="gy-in" type="date" id="crTo" value="' + r.to + '"></div>';
      h += '<div class="gy-card mt-3" style="font-size:12px;line-height:1.7;white-space:pre-wrap;max-height:46vh;overflow:auto">' + esc(coachText(c)) + '</div>';
      h += '<div class="gy-grid2 mt-3"><button class="gy-btn gy-pri" style="height:46px" id="crPrint">🖨️ הדפסה / PDF</button><button class="gy-btn" style="height:46px" id="crCopy">העתקה כטקסט</button>' +
        '<button class="gy-btn" style="height:46px" id="crShare">שיתוף</button><button class="gy-btn" style="height:46px" id="crCsv">טבלה (CSV)</button></div>';
      sheet('📋 דוח למאמנת', h, (m)=>{
        m.querySelectorAll('[data-mode]').forEach(b=> b.onclick = ()=>{ const rr = range(); mode = b.dataset.mode; if(mode === 'custom'){ from = rr.from; to = rr.to; } open(); });   // range of the CURRENT mode, before switching
        ['#crFrom','#crTo'].forEach(s=>{ const i = m.querySelector(s); if(i) i.onchange = ()=>{ from = m.querySelector('#crFrom').value; to = m.querySelector('#crTo').value; open(); }; });
        m.querySelector('#crPrint').onclick = ()=>{ G.markReport && G.markReport(); B().printHTML(printWrap('דוח אימונים למאמנת', coachHTML(c))); };
        m.querySelector('#crCopy').onclick = ()=>{ G.markReport && G.markReport(); copy(coachText(c)); };
        m.querySelector('#crCsv').onclick = ()=>{ G.markReport && G.markReport(); B().downloadFile('munch-move-coach-' + r.from + '_' + r.to + '.csv', csvRows(r.from, r.to), 'text/csv'); };
        m.querySelector('#crShare').onclick = ()=>{ G.markReport && G.markReport(); const txt = coachText(c); if(navigator.share) navigator.share({ title:'דוח אימונים', text: txt }).catch(()=>{}); else copy(txt); };
      }, 'gyCoach');
    }
    open();
  };

  // ---------- dietitian report hooks ----------
  G.reportLines = function(from, to){
    const c = coachData(from, to);
    if(!c.sessions.length) return [];
    const L = [];
    const acts = {}; c.acts.forEach(s=>{ const l = (ACT_LABEL[s.a.kind]||'').replace(/^\S+ /,''); acts[l] = (acts[l]||0) + 1; });
    L.push('אימוני כוח: ' + c.strength.length + (c.trainerN ? ' (' + c.trainerN + ' עם מאמנת)' : '') + (Object.keys(acts).length ? ' · ' + Object.entries(acts).map(([k,v])=> k + ' ×' + v).join(', ') : ''));
    const ups = c.exRows.filter(r=> /עלה|\+/.test(r.change)).slice(0, 6).map(r=> r.x.he + ' (' + r.change + ')');
    if(ups.length) L.push('התקדמות בכוח: ' + ups.join(', '));
    return L;
  };
  G.reportHTMLBlock = function(from, to){
    const L = G.reportLines(from, to);
    return L.length ? '<div style="margin-top:8px;font-size:12px">' + L.map(l=> '<div>' + esc(l) + '</div>').join('') + '</div>' : '';
  };

  // ---------- assistant ----------
  G.chatContext = function(){
    try{
      G.invalidate();
      const b = B(), today = b.todayKey();
      const lines = ['היום ' + today + ' (' + DAYS[b.dateFromKey(today).getDay()] + ').'];
      lines.push('מאגר התרגילים (מזהה | שם | אזור | מצב | ביצוע אחרון | המלצה לפעם הבאה):');
      G.lib().forEach(x=>{
        const h = G.historyOf(x.id)[0]; const rec = x.active ? G.recommend(x.id) : null;
        lines.push(x.id + ' | ' + x.he + ' (' + (x.en||'') + ') | ' + (G.AREAS[x.area]||x.area) + ' | ' + (x.active ? (G.isPaused(x) ? 'מושהה עד ' + x.pausedUntil : 'פעיל') : 'לא פעיל') +
          ' | ' + (h ? h.day + ': ' + G.setsLine(h, x) + (G.entryStats(h).rpe!=null ? ' @' + G.entryStats(h).rpe : '') : '—') + ' | ' + (rec ? G.recLine(rec, x) : '—'));
      });
      lines.push('בניית אימון: האפליקציה מרכיבה כל אימון עצמאי מכל המאגר, בחלוקה שווה בין אזורי הגוף, או עם מיקוד באזור (כ-70% מהתרגילים). אין תבניות קבועות. אורך האימון נבחר בכל פעם.');
      lines.push('העדפות: ' + JSON.stringify(S().prefs));
      const all = b.workouts();
      const ds = Object.keys(all).filter(d=> (all[d]||[]).some(relevant)).sort().reverse().slice(0, 8);
      lines.push('אימונים אחרונים:');
      ds.forEach(d=> (all[d]||[]).filter(relevant).forEach(w=> lines.push(d + ' · ' + woTitle(w).replace(/^👩‍🏫 /,'') + ': ' + (w.exercises||[]).map(e=>{ const x = exLine(e); return x.name + ' ' + x.sets + (x.rpe!=null?' @'+x.rpe:''); }).join('; '))));
      const L = G.live();
      if(L && L.phase === 'ex'){ const it = L.items[L.cur]; lines.push('אימון חי פתוח עכשיו. התרגיל הנוכחי: ' + (it ? it.exId : '—') + '. נשארו: ' + L.items.filter(i=> i.status==='todo').map(i=> i.exId).join(',')); }
      return lines.join('\n').slice(0, 7000);
    }catch(e){ return ''; }
  };
  const GYM_TOOLS = new Set(['gym_edit','log_activity','feature_request']);
  G.handles = name=> GYM_TOOLS.has(name);
  function idOf(name){ return G.ex(name) ? name : G.matchId(name); }
  function setsFrom(c, x){
    if(Array.isArray(c.sets) && c.sets.length && typeof c.sets[0] === 'object')
      return c.sets.map(s=> x && x.kind === 'time' ? { kg:0, reps:0, sec:Math.round(+s.seconds || +s.sec || 0), rpe: s.rpe!=null ? +s.rpe : undefined } : { kg:+s.kg||0, reps:Math.round(+s.reps||0), rpe: s.rpe!=null ? +s.rpe : undefined });
    const n = Math.max(1, Math.round(+c.sets_count || +c.sets || 2));
    return Array.from({length:n}, ()=> x && x.kind === 'time' ? { kg:0, reps:0, sec:Math.round(+c.seconds||0), rpe: c.rpe!=null ? +c.rpe : undefined } : { kg:+c.kg||0, reps:Math.round(+c.reps||0), rpe: c.rpe!=null ? +c.rpe : undefined });
  }
  const AREA_SLOT = { legs:'quad', glutes:'post', back:'back', chest:'chest', shoulders:'shoulders', core:'core2', arms:'arms' };
  function describe(c){
    const x = c.exercise ? G.ex(idOf(c.exercise)) : null, nm = x ? x.he : (c.exercise || '');
    const day = c.day ? ' (' + dshort(c.day) + ')' : '';
    switch(c.action){
      case 'edit_entry': { const ss = setsFrom(c, x); return '✏️ ' + nm + day + ': ' + G.setsLine({ sets:ss }, x) + (ss[0] && ss[0].rpe!=null ? ' · קושי ' + ss[0].rpe : ''); }
      case 'delete_entry': return '🗑️ מחיקת ' + nm + ' מהאימון' + day;
      case 'delete_workout': { const w = lastStrength(c.day || B().todayKey()); return w ? '🗑️ מחיקת האימון "' + woTitle(w) + '"' + day + ' (' + (w.exercises||[]).length + ' תרגילים)' : '🗑️ אין אימון כוח למחיקה' + day; }
      case 'set_working_weight': return '⚖️ ' + nm + ': משקל עבודה ' + (x && x.kind==='time' ? (c.seconds + ' שנ׳') : (c.kg + ' ק״ג' + (c.reps ? ' × ' + c.reps : '')));
      case 'set_rep_range': return '🔢 ' + nm + ': טווח חזרות ' + c.lo + '–' + c.hi;
      case 'set_weight_steps': return '🪜 ' + nm + ': מדרגות ' + (c.values||[]).join(', ');
      case 'set_active': return (c.active === false ? '⏸️ הוצאת ' : '▶️ החזרת ') + nm + (c.active === false ? ' מהרוטציה' : ' לרוטציה');
      case 'pause': return '⏸️ השהיית ' + nm + (c.until ? ' עד ' + dshort(c.until) : ' ל-' + (c.days || 14) + ' ימים');
      case 'add_exercise': return '➕ תרגיל חדש: ' + (c.name||'') + (c.en ? ' (' + c.en + ')' : '') + ' · ' + (G.AREAS[c.area]||c.area||'') + (c.after ? ' · אחרי ' + ((G.ex(idOf(c.after))||{}).he||c.after) : '');
      case 'move_in_route': return '↪️ ' + nm + ' יעבור במסלול לאחר ' + ((G.ex(idOf(c.after))||{}).he || c.after);
      case 'set_template': return '📋 תבנית ' + c.template + ': ' + (c.exercises||[]).map(e=> (G.ex(idOf(e))||{}).he || e).join(', ');
      case 'set_preference': return '⚙️ ' + c.key + ' = ' + c.value;
      case 'set_note': return '📝 הערה ל' + nm + ': ' + (c.text||'');
      case 'live_swap': return '🔁 באימון הפתוח: החלפת התרגיל הנוכחי ב' + nm;
      case 'live_skip': return '🚧 באימון הפתוח: המכשיר תפוס, עוברים לתרגיל הבא';
      default: return '❓ ' + c.action;
    }
  }
  G.agentCard = function(action){
    const a = action.args || {};
    if(action.name === 'log_activity') return { icon:'💃', title:'לרשום פעילות?', line: (a.kind === 'other' && a.text ? a.text : (ACT_LABEL[a.kind]||a.kind)) + ' · ' + (a.minutes||50) + ' דק׳' + (a.class_type ? ' · ' + a.class_type : '') + (a.difficulty ? ' · קושי ' + a.difficulty : '') + (a.day ? ' · ' + dshort(a.day) : '') };
    if(action.name === 'feature_request') return { icon:'📝', title:'לשמור בקשה לשינוי באפליקציה?', line: String(a.text||''), confirm:'כן, לשמור ✓' };
    const ch = Array.isArray(a.changes) ? a.changes : [];
    return { icon:'🏋️', title: ch.length > 1 ? 'לבצע ' + ch.length + ' שינויים?' : 'לבצע את השינוי?', line: ch.map(describe).join('\n'), confirm:'כן, לבצע ✓' };
  };
  function lastStrength(day){ const ws = (B().workouts()[day] || []).filter(w=> G.isStrength(w)); return ws[ws.length-1] || null; }
  function findWo(day, id){
    const ws = (B().workouts()[day] || []);
    for(let k = ws.length-1; k >= 0; k--){ const w = ws[k]; const i = (w.exercises||[]).findIndex(e=> (e.exId || G.matchId(e.name)) === id); if(i >= 0) return { w, i }; }
    return null;
  }
  function apply(c){
    const b = B(), today = b.todayKey();
    const day = /^\d{4}-\d{2}-\d{2}$/.test(c.day||'') ? c.day : today;
    if(day > today) return 'אי אפשר לרשום ליום עתידי';
    const id = c.exercise ? idOf(c.exercise) : null, x = id ? G.ex(id) : null;
    const need = ()=>{ if(!x) throw new Error('לא מצאתי את התרגיל "' + (c.exercise||'') + '"'); };
    switch(c.action){
      case 'edit_entry': {
        need(); const sets = setsFrom(c, x).filter(s=> s.reps > 0 || s.sec > 0 || s.kg > 0);
        if(!sets.length) throw new Error('חסרים סטים');
        const f = findWo(day, id);
        if(f){ f.w.exercises[f.i].sets = sets; f.w.exercises[f.i].exId = id; b.updateWorkout(f.w, day, true); return x.he + ' עודכן'; }
        const ws = (b.workouts()[day] || []); let w = ws.find(w=> G.isStrength(w));
        if(w){ w.exercises = (w.exercises||[]).concat({ name:G.exName(x), exId:id, sets }); b.updateWorkout(w, day, true); }
        else { w = { id:b.uid(), type:'gym', level:'mid', minutes:0, kcal:0, kcalNet:0, note:'Full Body · מהעוזר', exercises:[{ name:G.exName(x), exId:id, sets }] }; b.addWorkout(w, day, true); S().sessions[w.id] = { day, manual:true, at:Date.now() }; }
        return x.he + ' נוסף';
      }
      case 'delete_entry': {
        need(); const f = findWo(day, id); if(!f) throw new Error('לא מצאתי את ' + x.he + ' ביום הזה');
        f.w.exercises.splice(f.i, 1);
        if(!f.w.exercises.length && !+f.w.minutes) b.deleteWorkout(f.w.id, day, true); else b.updateWorkout(f.w, day, true);
        return x.he + ' נמחק';
      }
      case 'delete_workout': {
        // One workout (the latest that day), with the app's undo toast.
        const w = lastStrength(day);
        if(!w) throw new Error('אין אימון כוח ביום הזה');
        b.deleteWorkout(w.id, day, false); return 'האימון נמחק (אפשר לבטל מההודעה למטה)';
      }
      case 'set_working_weight': need(); G.setLib(id, { work: x.kind === 'time' ? { sec:Math.round(+c.seconds||0), day:today } : { kg:+c.kg||0, reps: c.reps ? Math.round(+c.reps) : undefined, day:today } }); return 'משקל העבודה עודכן';
      case 'set_rep_range': need(); if(!(+c.lo > 0 && +c.hi >= +c.lo)) throw new Error('טווח לא תקין'); G.setLib(id, { lo:Math.round(+c.lo), hi:Math.round(+c.hi) }); return 'טווח החזרות עודכן';
      case 'set_weight_steps': { need(); const v = (c.values||[]).map(Number).filter(n=> n >= 0 && isFinite(n)); if(v.length < 2) throw new Error('צריך לפחות שתי מדרגות'); G.setLib(id, { steps: Array.from(new Set(v)).sort((a,b)=> a-b) }); return 'המדרגות עודכנו'; }
      case 'set_active': need(); G.setLib(id, { active: c.active !== false }); return 'עודכן';
      case 'pause': { need(); const until = /^\d{4}-\d{2}-\d{2}$/.test(c.until||'') ? c.until : b.shiftKey(today, Math.max(1, Math.round(+c.days||14))); G.setLib(id, { pausedUntil: until }); return 'הושהה עד ' + dshort(until); }
      case 'add_exercise': {
        const name = String(c.name||'').trim(); if(!name) throw new Error('חסר שם');
        const area = G.AREAS[c.area] ? c.area : 'legs';
        const after = c.after ? G.ex(idOf(c.after)) : null;
        const nid = 'c_' + b.uid().replace(/-/g,'').slice(0, 8);
        S().custom.push({ id:nid, he:name, en:String(c.en||''), area, slot: c.slot || AREA_SLOT[area], route: after ? (after.route + 0.05) : 9, kind: c.kind === 'time' ? 'time' : 'reps', lo:10, hi:15,
          steps: [5,9,14,18,23,27,32,36,41,45,50,54,59], rest:75, icon:'🆕', perSide: !!c.per_side });
        G.save(); return 'נוסף למאגר: ' + name;
      }
      case 'move_in_route': { need(); const after = G.ex(idOf(c.after)); if(!after) throw new Error('לא מצאתי את התרגיל שאחריו'); G.setLib(id, { route: after.route + 0.05 }); return 'המסלול עודכן'; }
      case 'set_template': {
        throw new Error('אין יותר תבניות קבועות — כל אימון נבנה אוטומטית מכל המאגר. אפשר להשהות תרגיל או לבחור מיקוד');
        const t = String(c.template||'').toUpperCase();
        const ids = (c.exercises||[]).map(idOf).filter(Boolean); if(ids.length < 4) throw new Error('תבנית צריכה לפחות 4 תרגילים');
        S().templates[t] = ids; G.touchTemplates(); G.save(); return 'תבנית ' + t + ' עודכנה';
      }
      case 'set_preference': {
        const allowed = { minutes:[15,240], max:[15,240], strengthTarget:[1,7], pilatesTarget:[0,7], restDay:[0,6], trainerDay:[0,6] };
        const r = allowed[c.key]; if(!r) throw new Error('הגדרה לא מוכרת');
        const v = c.value === null || c.value === 'none' ? null : Math.round(+c.value);
        if(v != null && !(v >= r[0] && v <= r[1])) throw new Error('ערך לא תקין');
        S().prefs[c.key] = v; G.touchPrefs(); G.save(); return 'ההגדרה עודכנה';
      }
      case 'set_note': need(); G.setLib(id, { note: String(c.text||'') }); return 'ההערה נשמרה';
      case 'live_swap': case 'live_skip': {
        const L = G.liveLoad(); if(!L || L.phase !== 'ex') throw new Error('אין אימון חי פתוח');
        const it = L.items[L.cur];
        if(c.action === 'live_skip'){ it.status = 'busy'; L.cur = Math.max(-1, L.cur); }
        else { need(); it.exId = id; it.rec = G.recommend(id) || {}; it.rec.sets = it.sets; }
        L.draft = null; G.liveSave(L); return 'האימון הפתוח עודכן';
      }
      default: throw new Error('פעולה לא מוכרת: ' + c.action);
    }
  }
  G.agentExecute = function(action){
    const a = action.args || {}, b = B();
    try{
      if(action.name === 'log_activity'){
        saveActivity({ kind: ACT_TYPE[a.kind] ? a.kind : 'other', text: a.text || '', minutes: a.minutes, instructor: a.instructor, classType: a.class_type, rpe: a.difficulty, enjoy: a.enjoyment, repeat: a.would_repeat, day: /^\d{4}-\d{2}-\d{2}$/.test(a.day||'') && a.day <= b.todayKey() ? a.day : null });
        const warn = a.kind === 'pilates' ? dislikedNote(a.class_type) : '';
        return 'הפעילות נרשמה ✓' + (warn ? '\n⚠️ ' + warn : '');
      }
      if(action.name === 'feature_request'){
        S().requests.push({ id: b.uid(), text: String(a.text||'').slice(0, 1000), at: Date.now(), day: b.todayKey() });
        G.save(); b.renderAll();
        return 'שמרתי את הבקשה ברשימת "בקשות לשינוי". שינוי במסכים או בעיצוב נבנה מחוץ לאפליקציה, ולכן הוא לא מתבצע מכאן.';
      }
      const ch = Array.isArray(a.changes) ? a.changes : [];
      if(!ch.length) return 'לא התקבל שינוי לביצוע.';
      const out = [];
      ch.forEach(c=>{ try{ out.push('✓ ' + apply(c)); }catch(e){ out.push('✗ ' + (e && e.message || 'נכשל')); } });
      G.save(); b.renderAll();
      if(G.reloadLive) G.reloadLive();
      return out.join('\n');
    }catch(e){ return 'לא הצלחתי לבצע: ' + (e && e.message || ''); }
  };
})();
