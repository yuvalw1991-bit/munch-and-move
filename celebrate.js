// Munch & Move — achievement celebrations: a full-screen moment with a popping badge,
// confetti from both sides, a short soft chime and a light buzz. Several unlocks queue
// one after another instead of swallowing each other. Everything is local to this file:
// the main app only calls Celebrate.show([...]).
(function(){
  'use strict';
  const C = window.Celebrate = window.Celebrate || {};
  const SKEY = 'macro_achsound';                 // 'off' → no chime and no buzz (device-local)
  const TIERS = {
    b:{ name:'ברונזה', c1:'#e0a46a', c2:'#9a5b2a', n:60,  notes:[784,1047] },
    s:{ name:'כסף',    c1:'#e8eef8', c2:'#8a96ab', n:90,  notes:[659,880,1175] },
    g:{ name:'זהב',    c1:'#ffd56b', c2:'#ff9500', n:140, notes:[523,659,784,1047] },
    l:{ name:'אגדי',   c1:'#c6ff00', c2:'#00e5ff', n:220, notes:[523,659,784,1047,1319] },
  };
  const CHEERS = ['כל הכבוד!','איזה יופי!','ממשיכים ככה 💪','זה שלך, הרווחת את זה','עוד צעד קדימה ✨','מגיע לך רגע של גאווה'];
  const COLORS = ['#c6ff00','#00e5ff','#ff9500','#00ffa3','#ff4d6d','#2f6bff','#ffc24b'];
  const reduced = ()=>{ try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(_){ return false; } };

  C.soundOn = ()=>{ try{ return localStorage.getItem(SKEY) !== 'off'; }catch(_){ return true; } };
  C.setSound = on=>{ try{ if(on) localStorage.removeItem(SKEY); else localStorage.setItem(SKEY, 'off'); }catch(_){} };
  C.tierName = t=> (TIERS[t] || TIERS.b).name;

  // ---------- styles (injected once, so no CSS build step is needed) ----------
  function css(){
    if(document.getElementById('celCss')) return;
    const s = document.createElement('style'); s.id = 'celCss';
    s.textContent = `
#celOv{position:fixed;inset:0;z-index:9990;display:flex;align-items:safe center;overflow-y:auto;justify-content:center;padding:24px 16px;
  padding-top:max(24px,env(safe-area-inset-top));padding-bottom:max(24px,env(safe-area-inset-bottom));
  background:rgba(4,5,10,.82);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);animation:celFade .25s ease-out both}
#celOv.out{animation:celFadeOut .22s ease-in both}
#celCv{position:fixed;inset:0;pointer-events:none;z-index:9991}
.cel-card{position:relative;z-index:9992;width:100%;max-width:340px;text-align:center;border-radius:28px;padding:30px 22px 22px;
  background:linear-gradient(180deg,rgba(28,31,44,.98),rgba(14,16,24,.98));border:1px solid rgba(255,255,255,.08);
  box-shadow:0 0 0 1px var(--c2),0 20px 60px rgba(0,0,0,.6),0 0 80px -10px var(--c1);animation:celRise .5s cubic-bezier(.2,1.4,.4,1) both}
.cel-halo{position:relative;width:132px;height:132px;margin:-74px auto 8px;display:flex;align-items:center;justify-content:center}
.cel-rays{position:absolute;inset:-22px;border-radius:50%;opacity:.55;
  background:repeating-conic-gradient(from 0deg,var(--c1) 0 8deg,transparent 8deg 24deg);
  -webkit-mask:radial-gradient(circle,#000 30%,transparent 70%);mask:radial-gradient(circle,#000 30%,transparent 70%);animation:celSpin 9s linear infinite}
.cel-disc{position:relative;width:112px;height:112px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:58px;
  background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.35),transparent 45%),linear-gradient(145deg,var(--c1),var(--c2));
  box-shadow:inset 0 -6px 14px rgba(0,0,0,.25),0 8px 30px -6px var(--c1);animation:celPop .7s cubic-bezier(.3,1.6,.5,1) .12s both}
.cel-disc span{filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))}
.cel-tier{display:inline-block;font-size:11px;font-weight:900;letter-spacing:.02em;padding:4px 12px;border-radius:999px;margin-bottom:10px;
  color:#0b0d14;background:linear-gradient(90deg,var(--c1),var(--c2))}
.cel-title{font-size:23px;font-weight:900;color:#f3f5fa;line-height:1.25;margin-bottom:6px;animation:celUp .45s ease-out .25s both}
.cel-desc{font-size:14px;color:#aeb4c4;line-height:1.5;animation:celUp .45s ease-out .32s both}
.cel-cheer{font-size:15px;font-weight:800;margin-top:12px;color:var(--c1);animation:celUp .45s ease-out .4s both}
.cel-icons{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:12px;font-size:24px;max-height:120px;overflow:auto}
.cel-icons span{animation:celPop .5s cubic-bezier(.3,1.6,.5,1) both}
.cel-btn{margin-top:20px;width:100%;height:50px;border:0;border-radius:16px;font-size:16px;font-weight:900;color:#0b0d14;cursor:pointer;
  background:linear-gradient(90deg,var(--c1),var(--c2));box-shadow:0 8px 24px -8px var(--c1)}
.cel-btn:active{transform:scale(.97)}
.cel-count{font-size:11px;color:#6f7689;margin-top:8px;font-weight:700}
@keyframes celFade{from{opacity:0}to{opacity:1}}
@keyframes celFadeOut{to{opacity:0}}
@keyframes celRise{from{opacity:0;transform:translateY(40px) scale(.9)}to{opacity:1;transform:none}}
@keyframes celPop{0%{opacity:0;transform:scale(0) rotate(-25deg)}70%{opacity:1;transform:scale(1.15) rotate(6deg)}100%{transform:scale(1) rotate(0)}}
@keyframes celUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes celSpin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion: reduce){#celOv,.cel-card,.cel-disc,.cel-title,.cel-desc,.cel-cheer,.cel-icons span{animation:none!important}.cel-rays{animation:none}}`;
    document.head.appendChild(s);
  }

  // ---------- sound: a short soft chime, synthesized (no audio files) ----------
  let ac = null;
  function chime(tier){
    if(!C.soundOn()) return;
    try{
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if(ac.state === 'suspended') ac.resume();
      const t0 = ac.currentTime + 0.02, notes = (TIERS[tier] || TIERS.b).notes;
      const master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
      notes.forEach((f, i)=>{
        const t = t0 + i * 0.09;
        [['sine', 1, 0.07], ['triangle', 2, 0.015]].forEach(([type, mul, peak])=>{
          const o = ac.createOscillator(), g = ac.createGain();
          o.type = type; o.frequency.value = f * mul;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(peak, t + 0.015);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
          o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.6);
        });
      });
    }catch(_){}
  }
  function buzz(tier){
    if(!C.soundOn()) return;
    try{ if(navigator.vibrate) navigator.vibrate(tier === 'l' || tier === 'g' ? [25,50,25,50,40] : [25,40,25]); }catch(_){}
  }

  // ---------- confetti on a canvas: two cannons from the bottom corners ----------
  let raf = 0, run = null;
  function confetti(tier){
    if(reduced()) return;
    let cv = document.getElementById('celCv');
    if(!cv){ cv = document.createElement('canvas'); cv.id = 'celCv'; document.body.appendChild(cv); }
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const T = TIERS[tier] || TIERS.b, parts = [];
    const fire = (n, delay)=>{
      for(let i=0;i<n;i++){
        const left = i % 2 === 0, ang = (left ? -60 : -120) + (Math.random()*36 - 18), sp = 9 + Math.random()*9;
        parts.push({ x: left ? -10 : W + 10, y: H * 0.78, vx: Math.cos(ang*Math.PI/180)*sp, vy: Math.sin(ang*Math.PI/180)*sp,
          w: 5 + Math.random()*6, h: 8 + Math.random()*8, r: Math.random()*6, vr: Math.random()*0.3 - 0.15,
          c: i % 5 === 0 ? T.c1 : COLORS[i % COLORS.length], born: delay, life: 0 });
      }
    };
    fire(T.n, 0);
    if(tier === 'g' || tier === 'l') fire(Math.round(T.n * 0.6), 28);
    let frame = 0;
    cancelAnimationFrame(raf);
    if(run) run.stop = true;
    const me = run = { stop:false };
    const step = ()=>{
      if(me.stop) return;
      frame++; ctx.clearRect(0, 0, W, H);
      let alive = 0;
      parts.forEach(p=>{
        if(frame < p.born) { alive++; return; }
        p.life++; p.vy += 0.28; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        if(p.y > H + 30 || p.life > 240) return;
        alive++;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.globalAlpha = Math.max(0, 1 - p.life / 240);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w/2, -p.h/2 * Math.abs(Math.cos(p.life * 0.15)), p.w, p.h * Math.abs(Math.cos(p.life * 0.15)) + 1);
        ctx.restore();
      });
      if(alive) raf = requestAnimationFrame(step); else cv.remove();
    };
    raf = requestAnimationFrame(step);
  }
  C.burst = tier=> confetti(tier || 'b');
  // Closing the last screen fades the confetti out instead of letting it rain on the app.
  function fadeConfetti(){
    const cv = document.getElementById('celCv'); if(!cv) return;
    cv.id = '';                                       // a new celebration gets a fresh canvas
    const me = run;
    cv.style.transition = 'opacity .35s'; cv.style.opacity = '0';
    setTimeout(()=>{ if(me) me.stop = true; cv.remove(); }, 380);   // stops only this run, never a newer one
  }

  // ---------- the queue + overlay ----------
  const queue = [];
  let open = false, total = 0, shown = 0;
  const esc = s=> String(s == null ? '' : s).replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

  C.show = function(items){
    (Array.isArray(items) ? items : [items]).forEach(it=>{ if(it) queue.push(it); });
    total = shown + queue.length;
    if(!open) next();
  };
  C.isOpen = ()=> open;

  function next(){
    const it = queue.shift();
    if(!it){ open = false; total = shown = 0; return; }
    open = true; shown++;
    css();
    const T = TIERS[it.tier] || TIERS.b;
    let ov = document.getElementById('celOv');
    if(ov) ov.remove();
    ov = document.createElement('div'); ov.id = 'celOv'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('dir', 'rtl');
    ov.style.setProperty('--c1', T.c1); ov.style.setProperty('--c2', T.c2);
    const more = queue.length;
    const cheer = it.cheer || CHEERS[Math.floor(Math.random() * CHEERS.length)];
    ov.innerHTML =
      '<div class="cel-card">' +
        '<div class="cel-halo"><div class="cel-rays"></div><div class="cel-disc"><span>' + esc(it.icon || '🏆') + '</span></div></div>' +
        '<div class="cel-tier">' + esc(it.label || ('הישג חדש · ' + T.name)) + '</div>' +
        '<div class="cel-title" id="celTitle">' + esc(it.title) + '</div>' +
        (it.desc ? '<div class="cel-desc">' + esc(it.desc) + '</div>' : '') +
        (Array.isArray(it.icons) && it.icons.length ? '<div class="cel-icons">' + it.icons.map((x, i)=> '<span style="animation-delay:' + (0.3 + i*0.04).toFixed(2) + 's">' + esc(x) + '</span>').join('') + '</div>' : '') +
        '<div class="cel-cheer">' + esc(cheer) + '</div>' +
        '<button class="cel-btn" id="celBtn">' + (more ? 'להישג הבא ←' : 'יאללה 🎉') + '</button>' +
        (total > 1 ? '<div class="cel-count">' + shown + ' מתוך ' + total + '</div>' : '') +
      '</div>';
    ov.setAttribute('aria-labelledby', 'celTitle');
    document.body.appendChild(ov);
    const openedAt = Date.now();
    let closing = false;
    const close = ()=>{
      if(closing || Date.now() - openedAt < 450) return;   // a tap already on its way, or a double tap, never skips a screen
      closing = true;
      document.removeEventListener('keydown', onKey);
      ov.removeEventListener('click', close);
      ov.classList.add('out');
      if(!queue.length) fadeConfetti();
      setTimeout(()=>{ ov.remove(); next(); }, 200);
    };
    // Enter is left to the focused button (a click), so one key press is one close.
    const onKey = e=>{ if(e.key === 'Escape'){ e.stopImmediatePropagation(); close(); } };
    ov.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    try{ ov.querySelector('#celBtn').focus({ preventScroll:true }); }catch(_){}
    confetti(it.tier);
    chime(it.tier);
    buzz(it.tier);
  }
})();
