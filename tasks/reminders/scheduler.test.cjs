// Exhaustive test of the reminder scheduler, run before any of it touches live code.
const { nextFire, daysInMonth } = require('./scheduler.cjs');

// ---- the CURRENT live implementation, copied verbatim from the deployed edge function,
// ---- so backward compatibility is proved rather than assumed.
function hmToMin(hm){ const [h,m]=String(hm||'0:0').split(':').map(Number); return (h||0)*60+(m||0); }
function oldNextFire(r, nowMs) {
  const off = (r.tz_offset_min ?? 180) * 60000;
  const localNow = new Date(nowMs + off);
  if (r.kind === 'times' && Array.isArray(r.times) && r.times.length) {
    const dayStartLocal = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate());
    const cands = [];
    for (let d = 0; d < 2; d++) for (const t of r.times) {
      const ms = dayStartLocal + d * 86400000 + hmToMin(t) * 60000;
      if (ms > localNow.getTime() + 30000) cands.push(ms);
    }
    if (!cands.length) return null;
    return new Date(Math.min(...cands) - off);
  }
  if (r.kind === 'interval' && r.interval_min > 0) {
    const ws = hmToMin(r.window_start || '08:00'), we = hmToMin(r.window_end || '22:00');
    const dayStartLocal = Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate());
    const nowLocalMin = (localNow.getTime() - dayStartLocal) / 60000;
    let candLocalMs;
    if (nowLocalMin < ws) candLocalMs = dayStartLocal + ws * 60000;
    else {
      const cand = localNow.getTime() + r.interval_min * 60000;
      const candMin = (cand - dayStartLocal) / 60000;
      candLocalMs = candMin <= we ? cand : dayStartLocal + 86400000 + ws * 60000;
    }
    return new Date(candLocalMs - off);
  }
  return null;
}

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++; fails.push(name + (detail ? '  →  ' + detail : ''));
}
// Render a fire time back into the user's wall clock for readable assertions.
function local(dt, off) {
  if (!dt) return 'null';
  const d = new Date(dt.getTime() + off * 60000);
  const p = n => String(n).padStart(2, '0');
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()) + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
}
const TZ = 180;                                   // Israel summer time, the existing default
// A given wall-clock moment, expressed as the epoch ms the scheduler would receive.
function at(y, mo, d, h, mi) { return Date.UTC(y, mo - 1, d, h, mi) - TZ * 60000; }

// ============ 1. backward compatibility with the live scheduler ============
{
  const legacy = [
    { kind:'times', times:['08:00'], tz_offset_min:TZ },
    { kind:'times', times:['08:00','13:30','21:15'], tz_offset_min:TZ },
    { kind:'times', times:['00:05','23:55'], tz_offset_min:TZ },
    { kind:'interval', interval_min:120, window_start:'08:00', window_end:'22:00', tz_offset_min:TZ },
    { kind:'interval', interval_min:30,  window_start:'06:00', window_end:'12:00', tz_offset_min:TZ },
  ];
  let checked = 0, same = 0;
  const diffs = [];
  for (const r of legacy) {
    for (let d = 1; d <= 28; d++) {
      for (let h = 0; h < 24; h++) {
        for (const mi of [0, 17, 33, 59]) {
          const now = at(2026, 2, d, h, mi);       // February — includes a short month
          const a = oldNextFire(r, now), b = nextFire(r, now);
          checked++;
          const av = a ? a.getTime() : null, bv = b ? b.getTime() : null;
          if (av === bv) same++;
          else if (diffs.length < 5) diffs.push(JSON.stringify(r).slice(0,60) + ' @ ' + local(new Date(now), TZ) + ' old=' + local(a,TZ) + ' new=' + local(b,TZ));
        }
      }
    }
  }
  ok('1. תזכורות קיימות: התנהגות זהה למתזמן החי (' + same + '/' + checked + ')', same === checked, diffs.join(' | '));
}

// ============ 2. daily ============
{
  const r = { kind:'times', times:['08:00'], tz_offset_min:TZ, repeat_unit:'day', repeat_n:1 };
  ok('2a. יומי — לפני השעה, יורה היום', local(nextFire(r, at(2026,8,3,6,0)), TZ) === '2026-08-03 08:00');
  ok('2b. יומי — אחרי השעה, יורה מחר',  local(nextFire(r, at(2026,8,3,9,0)), TZ) === '2026-08-04 08:00');
}

// ============ 3. every N days, anchored ============
{
  const r = { kind:'times', times:['08:00'], tz_offset_min:TZ, repeat_unit:'day', repeat_n:2, anchor_day:'2026-08-03' };
  ok('3a. כל יומיים — יום העוגן פעיל',   local(nextFire(r, at(2026,8,3,6,0)), TZ) === '2026-08-03 08:00');
  ok('3b. כל יומיים — מדלג על 4.8',      local(nextFire(r, at(2026,8,3,9,0)), TZ) === '2026-08-05 08:00');
  ok('3c. כל יומיים — גם משעה מאוחרת ב-4.8', local(nextFire(r, at(2026,8,4,23,0)), TZ) === '2026-08-05 08:00');
  const r3 = { ...r, repeat_n:3 };
  ok('3d. כל 3 ימים', local(nextFire(r3, at(2026,8,3,9,0)), TZ) === '2026-08-06 08:00');
}

// ============ 4. weekly ============
{
  // 2026-08-03 is a Monday.
  ok('sanity: 3.8.2026 הוא יום שני', new Date(Date.UTC(2026,7,3)).getUTCDay() === 1);
  const r = { kind:'times', times:['09:00'], tz_offset_min:TZ, repeat_unit:'week', repeat_n:1, weekdays:[1,3], anchor_day:'2026-08-03' };
  ok('4a. שבועי ב-ב׳/ד׳ — היום (שני)',   local(nextFire(r, at(2026,8,3,7,0)), TZ) === '2026-08-03 09:00');
  ok('4b. שבועי — הבא הוא רביעי',        local(nextFire(r, at(2026,8,3,10,0)), TZ) === '2026-08-05 09:00');
  ok('4c. שבועי — מרביעי בערב לשני הבא', local(nextFire(r, at(2026,8,5,10,0)), TZ) === '2026-08-10 09:00');
}

// ============ 5. bi-weekly ============
{
  const r = { kind:'times', times:['09:00'], tz_offset_min:TZ, repeat_unit:'week', repeat_n:2, weekdays:[1], anchor_day:'2026-08-03' };
  ok('5a. דו-שבועי — שבוע העוגן',        local(nextFire(r, at(2026,8,3,7,0)), TZ) === '2026-08-03 09:00');
  ok('5b. דו-שבועי — מדלג על 10.8',      local(nextFire(r, at(2026,8,3,10,0)), TZ) === '2026-08-17 09:00');
  ok('5c. דו-שבועי — גם באמצע השבוע המדולג', local(nextFire(r, at(2026,8,12,10,0)), TZ) === '2026-08-17 09:00');
}

// ============ 6. monthly + clamping ============
{
  const r = { kind:'times', times:['10:00'], tz_offset_min:TZ, repeat_unit:'month', repeat_n:1, month_day:15, anchor_day:'2026-01-15' };
  ok('6a. חודשי ב-15',                   local(nextFire(r, at(2026,8,3,10,0)), TZ) === '2026-08-15 10:00');
  ok('6b. חודשי — אחרי ה-15 עובר לחודש הבא', local(nextFire(r, at(2026,8,15,11,0)), TZ) === '2026-09-15 10:00');
  const r31 = { ...r, month_day:31, anchor_day:'2026-01-31' };
  ok('6c. ה-31 בפברואר נצמד ל-28',       local(nextFire(r31, at(2026,2,1,0,0)), TZ) === '2026-02-28 10:00', local(nextFire(r31, at(2026,2,1,0,0)), TZ));
  ok('6d. ה-31 באפריל נצמד ל-30',        local(nextFire(r31, at(2026,4,1,0,0)), TZ) === '2026-04-30 10:00');
  ok('6e. ה-31 במאי נשאר 31',            local(nextFire(r31, at(2026,5,1,0,0)), TZ) === '2026-05-31 10:00');
  ok('6f. שנה מעוברת — 29.2.2028',       daysInMonth(2028,1) === 29);
}

// ============ 7. every N months / half-yearly / yearly ============
{
  const r6 = { kind:'times', times:['08:00'], tz_offset_min:TZ, repeat_unit:'month', repeat_n:6, month_day:10, anchor_day:'2026-02-10' };
  ok('7a. חצי-שנתי — מפברואר לאוגוסט',   local(nextFire(r6, at(2026,3,1,0,0)), TZ) === '2026-08-10 08:00', local(nextFire(r6, at(2026,3,1,0,0)), TZ));
  ok('7b. חצי-שנתי — אחרי אוגוסט לפברואר הבא', local(nextFire(r6, at(2026,8,11,0,0)), TZ) === '2027-02-10 08:00', local(nextFire(r6, at(2026,8,11,0,0)), TZ));
  const r12 = { ...r6, repeat_n:12 };
  ok('7c. שנתי', local(nextFire(r12, at(2026,3,1,0,0)), TZ) === '2027-02-10 08:00', local(nextFire(r12, at(2026,3,1,0,0)), TZ));
  const r2 = { ...r6, repeat_n:2 };
  ok('7d. דו-חודשי — פברואר→אפריל', local(nextFire(r2, at(2026,3,1,0,0)), TZ) === '2026-04-10 08:00');
}

// ============ 8. interval honours the recurrence ============
{
  const r = { kind:'interval', interval_min:120, window_start:'08:00', window_end:'20:00', tz_offset_min:TZ,
              repeat_unit:'week', repeat_n:1, weekdays:[1], anchor_day:'2026-08-03' };
  ok('8a. אינטרוול ביום פעיל — now+interval כמו היום', local(nextFire(r, at(2026,8,3,9,0)), TZ) === '2026-08-03 11:00', local(nextFire(r, at(2026,8,3,9,0)), TZ));
  ok('8b. אינטרוול לפני פתיחת החלון',    local(nextFire(r, at(2026,8,3,6,0)), TZ) === '2026-08-03 08:00');
  ok('8c. אחרי סגירת החלון → יום פעיל הבא', local(nextFire(r, at(2026,8,3,21,0)), TZ) === '2026-08-10 08:00', local(nextFire(r, at(2026,8,3,21,0)), TZ));
  ok('8d. ביום לא פעיל → היום הפעיל הבא', local(nextFire(r, at(2026,8,5,9,0)), TZ) === '2026-08-10 08:00');
}

// ============ 9. malformed input must never throw or return a past time ============
{
  const bad = [
    { kind:'times', times:[], tz_offset_min:TZ },
    { kind:'times', times:null, tz_offset_min:TZ },
    { kind:'times', times:['08:00'], repeat_unit:'week', weekdays:[], tz_offset_min:TZ },
    { kind:'times', times:['08:00'], repeat_unit:'month', month_day:99, tz_offset_min:TZ },
    { kind:'times', times:['08:00'], repeat_unit:'month', month_day:0, tz_offset_min:TZ },
    { kind:'times', times:['08:00'], repeat_unit:'day', repeat_n:0, tz_offset_min:TZ },
    { kind:'times', times:['08:00'], repeat_unit:'day', repeat_n:-5, tz_offset_min:TZ },
    { kind:'times', times:['08:00'], repeat_unit:'nonsense', tz_offset_min:TZ },
    { kind:'times', times:['08:00'], anchor_day:'not-a-date', tz_offset_min:TZ },
    { kind:'interval', interval_min:0, tz_offset_min:TZ },
    { kind:'interval', interval_min:60, window_start:'22:00', window_end:'08:00', tz_offset_min:TZ },
    { kind:'weird', tz_offset_min:TZ },
    {},
  ];
  const now = at(2026,8,3,9,0);
  let threw = 0, past = 0;
  for (const r of bad) {
    try {
      const v = nextFire(r, now);
      if (v && v.getTime() <= now) past++;
    } catch (e) { threw++; fails.push('threw on ' + JSON.stringify(r) + ': ' + e.message); }
  }
  ok('9a. קלט פגום לא זורק', threw === 0);
  ok('9b. קלט פגום לא מחזיר זמן בעבר', past === 0);
}

// ============ 10. never returns a past time, across a full year of "now" values ============
{
  const shapes = [
    { kind:'times', times:['08:00','20:00'], repeat_unit:'day', repeat_n:1 },
    { kind:'times', times:['07:30'], repeat_unit:'day', repeat_n:3, anchor_day:'2026-01-01' },
    { kind:'times', times:['09:00'], repeat_unit:'week', repeat_n:2, weekdays:[0,4], anchor_day:'2026-01-04' },
    { kind:'times', times:['10:00'], repeat_unit:'month', repeat_n:6, month_day:31, anchor_day:'2026-01-31' },
    { kind:'interval', interval_min:90, window_start:'08:00', window_end:'22:00', repeat_unit:'week', repeat_n:1, weekdays:[2] },
  ];
  let checks = 0, bad = 0, nulls = 0;
  const sample = [];
  for (const s of shapes) {
    const r = { ...s, tz_offset_min:TZ };
    for (let d = 0; d < 365; d++) {
      const now = at(2026,1,1,0,0) + d * 86400000 + ((d * 37) % 24) * 3600000;
      const v = nextFire(r, now);
      checks++;
      if (v === null) { nulls++; continue; }
      if (v.getTime() <= now) { bad++; if (sample.length < 3) sample.push(JSON.stringify(s).slice(0,50) + ' now=' + local(new Date(now),TZ) + ' → ' + local(v,TZ)); }
    }
  }
  ok('10a. אף פעם לא זמן בעבר (' + checks + ' בדיקות)', bad === 0, sample.join(' | '));
  ok('10b. תמיד נמצא מועד עתידי', nulls === 0, nulls + ' nulls');
}

// ============ 11. timezone offsets other than the default ============
{
  for (const tz of [0, -300, 330, 720, -720]) {
    const r = { kind:'times', times:['08:00'], tz_offset_min:tz, repeat_unit:'day', repeat_n:1 };
    const now = Date.UTC(2026,7,3,6,0) - tz*60000;      // 06:00 local
    const v = nextFire(r, now);
    ok('11. tz ' + tz + ' → 08:00 מקומי', local(v, tz) === '2026-08-03 08:00', local(v, tz));
  }
}

console.log('\n' + (fail === 0 ? '✅' : '❌') + '  ' + pass + ' עברו, ' + fail + ' נכשלו');
if (fails.length) { console.log('\nכשלים:'); fails.forEach(f => console.log('  ✗ ' + f)); }
process.exit(fail ? 1 : 0);
