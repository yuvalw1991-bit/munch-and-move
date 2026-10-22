# הקשר פעיל — FoodApp

> נוצר אוטומטית ב-2026-06-28

## 🔒 חוק ברזל — האפליקציה חיה עם משתמשים אמיתיים (2026-06-28)
**אסור בשום אופן למחוק/לאפס/להעלים נתוני משתמשים.** Supabase: רק שינויים מוסיפים (בלי DROP/DELETE/TRUNCATE/הסרת עמודה). לקוח: לא לשחרר קוד שמוחק מפתחות נתונים (macro_logs/favs/favcats/workouts/program/profile/targets/targethist) אלא בפעולת משתמש מפורשת עם undo. מטמונים מתכלים (macro_eximg/exvid/SW) מותר לפנות. כל עריכה נפרסת מיד לפרודקשן — לאמת לפני סוף תור. ראה memory/never-delete-user-data.md.

## משימה נוכחית
שדרוגים מדורגים + deploy אוטומטי. עוברים שלב-שלב על punch-list.

## Deploy אוטומטי (מוקם ✅)
- `.claude/settings.local.json`: PostToolUse(Edit|Write|MultiEdit)→flag, Stop→deploy.
- `.claude/hooks/flag-deploy.mjs` (מסמן דגל, מדלג על .claude/ ו-tasks/), `.claude/hooks/deploy.mjs` (vercel --prod יחיד ב-Stop).
- אם לא פורס אוטומטית — לפתוח `/hooks` פעם אחת או לאתחל.

## בקשות המשתמשת (פיצ'רים חדשים)
1. מועדפים בקטגוריות **משלי בלבד** (custom) + חיפוש.
2. צילום טבלת ערכים → מסך אישור → ל-100ג' × משקל = חישוב אוטומטי (mode חדש בשרת).
3. גישה נוחה לימים קודמים. ✅
4. ייצוא מאקרו מלא (אימונים+תוכנית) ✅ + ייצוא טווח ימים כ-CSV.
5. "כמו אתמול" (שכפול יום) ✅.

## punch-list — סטטוס
- [x] תשתית 1 — `fmt()` מגן NaN; `save()` מגן חריגת מכסה.
- [x] תשתית 2 — Service Worker (`sw.js`, cache `macro-v1`). אומת: activated, 14 נכסי shell.
- [x] פיצ'ר A — ייצוא מלא (shareText + אימונים/מאזן/תוכנית) + "כמו אתמול" (copyPrevBtn) + גישת היסטוריה (📅 todayLabel). אומת חי ב-playwright.
- [x] פיצ'ר B — מועדפים בקטגוריות custom + חיפוש. מבנה: `favMeta={list,map}` ב-`macro_favcats` (local-only, keyed by favId). UI: חיפוש (favSearch) + **אקורדיון מתקפל סגור כברירת מחדל** (favOpen Set, data-favgroup, מונה פר-קטגוריה) שמצמצם גלילה במובייל; חיפוש→רשימה שטוחה; favCatModal (assign+manage), 🏷️ פר-מועדף, תקרה 100. אומת חי 390px: מקופל=0 כרטיסים גלויים, הקשה פותחת, חיפוש שטוח.
- [x] פיצ'ר C — צילום טבלת ערכים. שרת: mode `label` ב-api/gemini.js (LABEL_SYS+LABEL_SCHEMA → p100/c100/f100/kcal100/basis). לקוח: labelCameraBtn + labelModal (ערכים ל-100ג' ניתנים לעריכה + משקל → חישוב חי → מילוי הרישום). אומת: לקוח חי (32ג'→ח8/פ6.4/ש16); שרת חי (no_image 400). תמונת-תווית אמיתית — לבדיקת המשתמשת.
- [x] שיפור (בקשת משתמשת) — שמירת מועדף: מודל קטגוריה אופציונלי נפתח בשמירה (favCatSub + כפתור "דלג"), יצירת קטגוריה במקום, empty-state hint. כל מועדף עם תווית "📁 קטגוריה/+קטגוריה" לחיצה (שיוך/העברה/יצירה). אומת חי 390px.
- [x] פיצ'ר "מידה הכי פופולרית" — שרת: MEAL_SYS מוצר-בודד-ללא-כמות→גודל אריזה סטנדרטי בסופר (לא 100ג'); LABEL +popular_g. לקוח: זיהוי פריט→hint #popularHint; מודל טבלה→מילוי משקל אוטומטי לפי popularG + חישוב ×(pop/100) + #lblPopHint. אומת: טבלה 250ג' ×2.5 ✓. דיוק המידה תלוי-AI — לבדיקת המשתמשת על מוצרים אמיתיים.
- [x] בקשת משתמשת (3 שינויים): (1) ניתוח אימון בלי תיאור חופשי — woComputeBtn בונה desc מ-סוג/עצימות/דקות אם אין note; (2) ייצוא יומי כולל ניתוח אימון מלא (focus/muscles/scores/protein) + תוכנית; (3) תפריט תחתון מקובע — bg-ink אטום (הוסר backdrop-blur), translateZ(0), safe-area, viewport-fit=cover. SW→macro-v2. אומת חי.
- הערה: renderPlan (~3122) קורא program.weights[...] בלי גארד — קורס רק אם תוכנית חסרת weights (לא קורה בתוכנית אמיתית). הקשחה עתידית אפשרית.
- [x] באג (בקשת משתמשת): שינוי שם מוצר וניתוח חוזר השאיר כמות ישנה שמולאה ע"י AI (שוקולד 50→קוטג' נשאר 50). תיקון: דגל `qtyUserSet` — כמות נחשבת "של המשתמשת" רק אם הוקלדה ידנית (fQty input listener); ב-computeBtn userQty=null אם לא; מתאפס ב-clearForm/lblFill. אומת על פרודקשן עם AI אמיתי: שוקולד50→קוטג'250 ✓, אורז ידני 300 מכובד ✓.
- [x] באג "ניתוח אימון נתקע": שורש = aiOverlay עם מונה `_overlayCount`; אם קריאה נתקעת (רשת/cold-start/מובייל-ברקע) ה-finally לא רץ והמונה נתקע → overlay תקוע לנצח. השרת תקין (workout 200 ב-~4ש'). תיקון: (1) callProxy +AbortController timeout 60ש' (פרמ' 3) → בקשה תמיד נסגרת; (2) הקשה על aiOverlay = forceHideOverlay (מאפס מונה) + רמז "הקישי כדי לבטל". אומת על פרודקשן: ניתוח מהשדות עובד, escape-hatch סוגר overlay תקוע. (לא שוחזר hang קבוע — תוקן השורש.)
- [ ] פיצ'ר D — ייצוא טווח ימים כ-CSV (כפתור במודל שיתוף).
- [ ] תשתית 3 — Tailwind CDN → CSS בנוי (אזהרת production היחידה בקונסול).
- [x] תשתית 4+5 (חלקי): Undo למחיקת מועדף (משחזר fav+קטגוריה ב-bindFavButtons delfav) + Escape סוגר מודל עליון/overlay (keydown גלובלי). אומת חי על פרודקשן.
- [ ] תשתית 5 שאריות — מצב ריק (CTA כשאין יעדים) ועוד polish.
- [x] QA סבב 1 (צי 10 סוכנים read-only, 78 ממצאים: 3C/17H/29M/27L). תוקנו כל ה-3 קריטיים + חמורים מסכני-נתונים/קריסות: cloudLoadAll guard+merge (לא מוחק בשגיאה/מיזוג מקומי), renderPlan/adaptProgram/adjustKcal הגנות+throttle, undo wrong-day (deleteLog/deleteWorkout/copyPrev לוכדים viewKey), saveFav מנה מלאה (portionBase), callProxy overlay drift (showed flag), SW bypass ל-Supabase (cache v3), saveProgram/Profile→save(). אומת: סימולציית merge 4/4, renderPlan פגום לא קורס, undo ליום נכון, fav מלא. דוח: tasks/qa-report-2026-06-28.md.
- [ ] QA סבב 2 (אחרי פיצ'ר D): נותרו חמורי-UX (aria מודלים, Tailwind CDN, צ'אט FAB ב-RTL, double-submit) + בינוניים (analysis לא נשמר בענן→צריך עמודה מוסיפה, קטגוריות local-only, lbl100k, alert/confirm).

- [x] (22.10.2026) חימום באימון האישי: ספירה לאחור (דקות +/-), הגדרות מכשיר (הליכון מהירות+שיפוע, אופניים התנגדות+סל״ד, אליפטיקל התנגדות+שיפוע, מדרגות דרגה), נשמר לכל מכשיר ב-`S.warm.set` (חותמת זמן לכל מכשיר, לא בתוך prefs), צפצופי 3-2-1 + צליל ארוך בסוף + זמן חריגה ירוק, נשמר ב-`sessions[id].warm` ומוצג בהיסטוריה/דוח. קונפטי (`G.celebrateEnd`) בסיום אימון חי, ברישום ידני ובאימון בדיעבד; זז הצידה כשנפתח מסך הישג. תכנון אימון: מינימום 2 תרגילי ליבה, 1 באימון מתחת ל-30 דק׳ (`coreMin`). QA בסוכן עבר, כל הממצאים תוקנו. **iPhone: אין רטט בדפדפן, רק צליל; מתג שקט משתיק — לבדוק על מכשיר.** ענף claude/warmup-countdown-core, נפרס לפרודקשן 22.10.2026 (dpl_D71NxXdkBeupjwH9FGBLNbzWjAir, אומת מול קבצי הפריסה).

## דיפלוי/בדיקה
- `.vercelignore` + `.gitignore` מוציאים .claude/, tasks/, .playwright-mcp/, *-verify.png.
- בדיקה חיה: python http.server על פורט פנוי + playwright. מצב מקומי: `localStorage.macro_localmode='true'`. מפתחות: macro_logs, macro_workouts, macro_targethist.

## הערות
- index.html ב-CRLF, ~3150 שורות, כל ה-UI+JS inline.
- אימות תחביר: לחלץ inline scripts ל-`node --check` (preview configs ב-launch.json ישנים — נתיב G:).

## פעולות אחרונות (אוטומטי — עד 10 אחרונות)
<!-- AUTO-LOG-START -->
- [2026-08-03 18:56] Edit: 2026-08-03.md
- [2026-08-03 18:56] Edit: 2026-08-03.md
- [2026-08-03 18:56] Edit: 2026-08-03.md
- [2026-08-03 18:56] Bash: cd "C:/Users/yuval/My Drive/Claude/obsidian-vault/01-periodic/daily/2026" && nod
- [2026-08-03 18:55] Edit: 2026-08-03.md
- [2026-08-03 18:55] Edit: 2026-08-03.md
- [2026-08-03 18:54] Bash: cd "C:/Users/yuval/My Drive/Claude/obsidian-vault/01-periodic/daily/2026" && nod
- [2026-08-03 18:52] Bash: cd "C:/Users/yuval/My Drive/Claude/FoodApp" && node tasks/reminders/scheduler.te
- [2026-08-03 18:52] Edit: MEMORY.md
- [2026-08-03 18:52] Edit: push-reminders-infra.md
<!-- AUTO-LOG-END -->
