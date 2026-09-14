// Reference implementation of the reminder scheduler, written once and tested here
// before it is copied into BOTH the client (remNextFire) and the edge function
// (nextFire). Those two must stay byte-identical in behaviour or a reminder fires at a
// different time than the one the app promised when it was created.
//
// Convention inherited from the existing code: "local" time is represented by shifting
// the epoch by tz_offset_min and then reading the UTC fields. So `localNow` is a Date
// whose getUTC* accessors spell out the user's wall clock.

const MIN = 60000, DAY = 86400000;

function hmToMin(hm) {
  const [h, m] = String(hm || '0:0').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Midnight-of-day, in the shifted representation.
function dayStart(local) {
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
}
function ymd(ms) {
  const d = new Date(ms);
  return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()];
}
// Whole days between two midnights. Both are UTC-midnights so this is exact.
function daysBetween(a, b) { return Math.round((b - a) / DAY); }
// Sunday-based week start, matching getUTCDay() 0=Sun.
function weekStart(ms) { return ms - new Date(ms).getUTCDay() * DAY; }
function monthsBetween(aMs, bMs) {
  const [ay, am] = ymd(aMs), [by, bm] = ymd(bMs);
  return (by - ay) * 12 + (bm - am);
}
function daysInMonth(y, m) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }

// The anchor is what stops "every 6 months" from drifting. Falls back to the day the
// reminder was created, and finally to the day being tested (which makes every day active).
function anchorMs(r, fallbackMs) {
  const a = r.anchor_day;
  if (a && /^\d{4}-\d{2}-\d{2}$/.test(a)) {
    const [y, m, d] = a.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }
  return fallbackMs;
}

// Is this local calendar day one the reminder runs on?
function isActiveDay(r, dayMs, anchor) {
  const unit = r.repeat_unit || 'day';
  const n = Math.max(1, +r.repeat_n || 1);
  if (unit === 'day') {
    if (n === 1) return true;
    const diff = daysBetween(anchor, dayMs);
    return diff >= 0 && diff % n === 0;
  }
  if (unit === 'week') {
    const wd = new Date(dayMs).getUTCDay();
    const list = Array.isArray(r.weekdays) && r.weekdays.length ? r.weekdays.map(Number) : [new Date(anchor).getUTCDay()];
    if (!list.includes(wd)) return false;
    if (n === 1) return true;
    const diff = Math.round((weekStart(dayMs) - weekStart(anchor)) / (7 * DAY));
    return diff >= 0 && diff % n === 0;
  }
  if (unit === 'month') {
    const [y, m, d] = ymd(dayMs);
    // Clamp: "the 31st" on a 30-day month means the 30th, not "skip this month".
    const want = Math.min(Math.max(1, +r.month_day || new Date(anchor).getUTCDate()), daysInMonth(y, m));
    if (d !== want) return false;
    if (n === 1) return true;
    const diff = monthsBetween(anchor, dayMs);
    return diff >= 0 && diff % n === 0;
  }
  return true;
}

// How far ahead we are willing to look. 400 days covers a yearly reminder plus a leap year.
const HORIZON_DAYS = 400;

function nextFire(r, nowMs) {
  const off = (r.tz_offset_min ?? 180) * MIN;
  const localNow = new Date(nowMs + off);
  const today = dayStart(localNow);
  const anchor = anchorMs(r, today);
  const guard = localNow.getTime() + 30000;      // don't fire something 5 seconds from now

  if (r.kind === 'times') {
    const times = Array.isArray(r.times) ? r.times.filter(Boolean) : [];
    if (!times.length) return null;
    for (let i = 0; i <= HORIZON_DAYS; i++) {
      const day = today + i * DAY;
      if (!isActiveDay(r, day, anchor)) continue;
      const cands = times.map(t => day + hmToMin(t) * MIN).filter(ms => ms > guard).sort((a, b) => a - b);
      if (cands.length) return new Date(cands[0] - off);
    }
    return null;
  }

  if (r.kind === 'interval' && r.interval_min > 0) {
    const ws = hmToMin(r.window_start || '08:00'), we = hmToMin(r.window_end || '22:00');
    for (let i = 0; i <= HORIZON_DAYS; i++) {
      const day = today + i * DAY;
      if (!isActiveDay(r, day, anchor)) continue;
      const openAt = day + ws * MIN, closeAt = day + we * MIN;
      if (localNow.getTime() < openAt) return new Date(openAt - off);   // window hasn't opened yet
      if (localNow.getTime() >= closeAt) continue;                       // window already closed
      // "now + interval", exactly as the live scheduler does it. A grid anchored to the
      // window start would be steadier — the current form drifts by however late the cron
      // ran — but changing it would silently move the fire times of reminders that already
      // exist, which is not what was asked for. Left alone on purpose.
      const cand = localNow.getTime() + r.interval_min * MIN;
      if (cand <= closeAt) return new Date(cand - off);
      // Past the last slot of today — fall through to the next active day.
    }
    return null;
  }
  return null;
}

module.exports = { nextFire, isActiveDay, hmToMin, daysInMonth };
