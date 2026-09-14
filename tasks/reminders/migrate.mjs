// Additive-only migration for the reminders table, applied through the Supabase
// Management API. Every column is nullable or defaulted so that rows which already
// exist keep behaving exactly as they do today (repeat_unit='day', repeat_n=1 is the
// current "every day" semantics).
// Token is read from the environment and never written anywhere.
const REF = 'suifyxxjvritdqthbivm';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN missing'); process.exit(1); }

const SQL = `
alter table public.reminders add column if not exists repeat_unit text not null default 'day';
alter table public.reminders add column if not exists repeat_n    int  not null default 1;
alter table public.reminders add column if not exists weekdays    int[];
alter table public.reminders add column if not exists month_day   int;
alter table public.reminders add column if not exists anchor_day  date;
alter table public.reminders add column if not exists goal        text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reminders_repeat_unit_chk') then
    alter table public.reminders add constraint reminders_repeat_unit_chk
      check (repeat_unit in ('day','week','month'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reminders_repeat_n_chk') then
    alter table public.reminders add constraint reminders_repeat_n_chk
      check (repeat_n between 1 and 60);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reminders_month_day_chk') then
    alter table public.reminders add constraint reminders_month_day_chk
      check (month_day is null or month_day between 1 and 31);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'reminders_goal_chk') then
    alter table public.reminders add constraint reminders_goal_chk
      check (goal is null or goal in ('water','protein','workout'));
  end if;
end $$;

-- Backfill the anchor for rows that predate it, so "every N" has a stable origin.
update public.reminders set anchor_day = (created_at at time zone 'utc')::date
  where anchor_day is null;
`;

const run = async (sql) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const txt = await r.text();
  return { status: r.status, body: txt.slice(0, 900) };
};

const arg = process.argv[2];
if (arg === '--inspect') {
  const out = await run(`select column_name, data_type, column_default, is_nullable
    from information_schema.columns where table_schema='public' and table_name='reminders'
    order by ordinal_position;`);
  console.log(out.status, out.body);
} else if (arg === '--apply') {
  const out = await run(SQL);
  console.log(out.status, out.body);
} else {
  console.log('usage: node migrate.mjs --inspect | --apply');
}
