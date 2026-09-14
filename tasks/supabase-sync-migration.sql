-- Munch & Move — הפעלת סנכרון ענן לנתונים שהיו עד עכשיו מקומיים בלבד
-- ============================================================================
-- מה זה עושה: מוסיף 4 עמודות לטבלאות קיימות + טבלה אחת חדשה.
-- הכל ADDITIVE בלבד — אין DROP, אין ALTER על עמודה קיימת, אין מחיקה של שום נתון.
-- בטוח להרצה חוזרת (IF NOT EXISTS בכל שלב).
--
-- איך מריצים: Supabase → הפרויקט → SQL Editor → New query → להדביק → Run.
-- אחרי ההרצה: לרענן את האפליקציה. היא מזהה לבד שהסכימה קיימת ומתחילה לסנכרן.
-- ============================================================================

-- 1) תיוג ארוחה (בוקר/צהריים/ערב/נשנוש) + חותמת זמן, על פריטי היומן
alter table public.logs add column if not exists slot text;
alter table public.logs add column if not exists ts   bigint;

-- 2) סטים/חזרות/משקלים + קלוריות נטו, על האימונים
alter table public.workouts add column if not exists exercises jsonb;
alter table public.workouts add column if not exists kcal_net  integer;

-- 3) טבלה אחת לכל מה שאינו שורה-לפריט:
--    מים, שקילות, הארוחות השמורות, קטגוריות מועדפים, והעדפות תצוגה.
create table if not exists public.user_state (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  k          text        not null,
  v          jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, k)
);

alter table public.user_state enable row level security;

-- הרשאות: כל משתמש רואה ומעדכן אך ורק את השורות שלו.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_state' and policyname='user_state_select_own') then
    create policy user_state_select_own on public.user_state for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_state' and policyname='user_state_insert_own') then
    create policy user_state_insert_own on public.user_state for insert with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_state' and policyname='user_state_update_own') then
    create policy user_state_update_own on public.user_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_state' and policyname='user_state_delete_own') then
    create policy user_state_delete_own on public.user_state for delete using (auth.uid() = user_id);
  end if;
end $$;

-- בדיקה שהכל נוצר (אמור להחזיר 4 שורות + 4 מדיניויות)
select table_name, column_name from information_schema.columns
where table_schema='public'
  and ((table_name='logs' and column_name in ('slot','ts'))
    or (table_name='workouts' and column_name in ('exercises','kcal_net')))
order by table_name, column_name;

select policyname from pg_policies where schemaname='public' and tablename='user_state' order by policyname;
