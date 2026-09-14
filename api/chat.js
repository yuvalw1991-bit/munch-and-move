// Serverless proxy for the live nutrition/fitness assistant (Gemini chat).
// The API key lives ONLY here, as a server env var (GEMINI_API_KEY).

const MODEL = 'gemini-2.5-flash';

// Tools the assistant can PROPOSE. The server never executes them — it returns the
// proposed call to the client, which asks the user to confirm before touching data.
const TOOLS = [{
  functionDeclarations: [
    {
      name: 'log_food',
      description: 'הצעת רישום של פריט מזון/ארוחה שהמשתמש/ת דיווח/ה שאכל/ה, ליומן האוכל של היום. יש להעריך ערכים תזונתיים אם לא צוינו.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'שם הפריט או תיאור הארוחה' },
          protein_g: { type: 'number', description: 'חלבון בגרמים' },
          carbs_g: { type: 'number', description: 'פחמימות בגרמים' },
          fat_g: { type: 'number', description: 'שומן בגרמים' },
          quantity: { type: 'number', description: 'כמות (אופציונלי)' },
          unit: { type: 'string', description: 'יחידה כגון גרם/יחידה/כוס (אופציונלי)' },
          meal_slot: { type: 'string', enum: ['breakfast','lunch','dinner','snack'], description: 'שיוך לארוחה: breakfast=בוקר, lunch=צהריים, dinner=ערב, snack=נשנוש. למלא רק כשזה נאמר במפורש ("בארוחת בוקר אכלתי"); אחרת להשמיט והאפליקציה תשייך לפי השעה.' },
        },
        required: ['name', 'protein_g', 'carbs_g', 'fat_g'],
      },
    },
    {
      name: 'log_meal',
      description: 'הצעת רישום של ארוחה שמורכבת מכמה מאכלים נפרדים (למשל "2 שניצלונים וחצי צלחת פסטה"). כל מאכל הוא רכיב נפרד עם הערכים שלו, כדי שהמשתמש/ת תוכל לפתוח את הארוחה ולראות/לערוך כל רכיב בנפרד.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'שם כללי לארוחה, למשל "שניצלונים ופסטה"' },
          components: {
            type: 'array',
            description: 'רשימת המרכיבים — רכיב לכל מאכל שהוזכר',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'שם המרכיב' },
                protein_g: { type: 'number' },
                carbs_g: { type: 'number' },
                fat_g: { type: 'number' },
                quantity: { type: 'number', description: 'כמות (אופציונלי)' },
                unit: { type: 'string', description: 'יחידה כגון גרם/יחידה (אופציונלי)' },
              },
              required: ['name', 'protein_g', 'carbs_g', 'fat_g'],
            },
          },
          meal_slot: { type: 'string', enum: ['breakfast','lunch','dinner','snack'], description: 'שיוך לארוחה: breakfast=בוקר, lunch=צהריים, dinner=ערב, snack=נשנוש. למלא רק כשנאמר במפורש; אחרת להשמיט.' },
        },
        required: ['name', 'components'],
      },
    },
    {
      name: 'delete_food',
      description: 'מחיקת פריט שכבר נרשם ביומן האוכל של היום. להשתמש כשמבקשים למחוק/להסיר/לבטל רישום ("תמחק את הפיצה", "טעיתי, לא אכלתי את זה").',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'שם הפריט למחיקה, כפי שמופיע ברשימת הפריטים שנאכלו היום' } },
        required: ['name'],
      },
    },
    {
      name: 'edit_food',
      description: 'תיקון פריט שכבר נרשם ביומן האוכל של היום ("זו הייתה חצי צלחת ולא צלחת שלמה", "זה היה 200 גרם"). יש להחזיר את הערכים המתוקנים המלאים לכמות החדשה.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'שם הפריט הקיים שצריך לתקן' },
          quantity: { type: 'number', description: 'הכמות המתוקנת' },
          unit: { type: 'string', description: 'יחידה' },
          protein_g: { type: 'number', description: 'חלבון מתוקן בגרמים, לכמות המלאה' },
          carbs_g: { type: 'number', description: 'פחמימות מתוקנות בגרמים' },
          fat_g: { type: 'number', description: 'שומן מתוקן בגרמים' },
        },
        required: ['name'],
      },
    },
    {
      name: 'log_saved_meal',
      description: 'הוספה של אחת מהארוחות ששמורות אצל המשתמש/ת ("הארוחות שלי") ליומן של היום. להשתמש רק כשהשם מופיע ברשימת הארוחות השמורות שבהקשר. אין צורך להעריך ערכים — הם שמורים באפליקציה.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'שם הארוחה השמורה, בדיוק כפי שמופיע ברשימה' },
          portion: { type: 'number', description: 'נמדד במנות: 1 = מנה אחת (ברירת מחדל), 0.5 = חצי מנה. אם הארוחה היא מתכון ל-N מנות והמשתמש/ת אכל/ה את כל התבנית — portion = N.' },
        },
        required: ['name'],
      },
    },
    {
      name: 'log_weight',
      description: 'הצעת רישום של משקל הגוף שהמשתמש/ת דיווח/ה עליו היום (בקילוגרמים).',
      parameters: {
        type: 'object',
        properties: { kg: { type: 'number', description: 'משקל בקילוגרמים' } },
        required: ['kg'],
      },
    },
    {
      name: 'log_water',
      description: 'הצעת רישום של שתיית מים ליומן המים של היום. כוס = 250 מ״ל, אז "חצי ליטר" = 2 כוסות ו"בקבוק של ליטר וחצי" = 6 כוסות.',
      parameters: {
        type: 'object',
        properties: { cups: { type: 'number', description: 'מספר כוסות של 250 מ״ל' } },
        required: ['cups'],
      },
    },
    {
      name: 'log_strength',
      description: 'הצעת רישום של אימון כוח עם פירוט סטים — למשל "עשיתי סקוואט 3 סטים של 10 עם 40 קילו ולחיצת חזה 4 על 8 עם 30". כל תרגיל עם הסטים שלו (חזרות ומשקל). להשתמש בזה במקום log_workout כשמפורטים סטים/חזרות/משקלים.',
      parameters: {
        type: 'object',
        properties: {
          exercises: {
            type: 'array',
            description: 'רשימת התרגילים שבוצעו',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'שם התרגיל בעברית' },
                sets: {
                  type: 'array',
                  description: 'סט לכל סדרה. אם נאמר "3 סטים של 10 עם 40" — שלושה סטים זהים.',
                  items: {
                    type: 'object',
                    properties: {
                      reps: { type: 'number', description: 'מספר חזרות' },
                      kg: { type: 'number', description: 'משקל בק״ג (0 אם משקל גוף)' },
                    },
                    required: ['reps'],
                  },
                },
              },
              required: ['name', 'sets'],
            },
          },
          minutes: { type: 'number', description: 'משך האימון בדקות (הערכה אם לא צוין)' },
        },
        required: ['exercises'],
      },
    },
    {
      name: 'log_workout',
      description: 'הצעת רישום של אימון שהמשתמש/ת דיווח/ה שביצע/ה, ליומן האימונים של היום.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'סוג האימון, למשל הליכה/ריצה/כוח/יוגה' },
          minutes: { type: 'number', description: 'משך בדקות' },
          calories: { type: 'number', description: 'הערכת קלוריות שנשרפו' },
          note: { type: 'string', description: 'הערה (אופציונלי)' },
        },
        required: ['type', 'minutes', 'calories'],
      },
    },
  ],
}];

// Must stay in sync with agentExecute() in index.html.
const KNOWN_TOOLS = new Set(TOOLS[0].functionDeclarations.map((d) => d.name));

const BASE_PROMPT =
  'את/ה עוזר/ת אישי/ת בנושאי תזונה וכושר, שמדבר/ת עברית בלבד. ' +
  'תפקידך לייעץ למשתמש/ת בזמן אמת: לענות על שאלות לגבי מזון, מאקרו-נוטריאנטים, ' +
  'תזונה, אימונים, ירידה/עלייה במשקל ובניית שריר. ' +
  'תן/י תשובות קצרות, מעשיות וברורות. השתמש/י במספרים מוחשיים כשרלוונטי. ' +
  'אל תאבחן/י מצבים רפואיים ואל תיתן/י ייעוץ רפואי — לעניינים רפואיים המלץ/י לפנות לרופא/ה או דיאטן/ית מוסמך/ת. ' +
  'התבסס/י על הידע התזונתי המקובל. אם חסר מידע, ציין/י זאת בקצרה. ' +
  'לפעמים המשתמש/ת יצרף/תצרף תמונה (מנה, מוצר או תווית ערכים תזונתיים), הקלטה קולית, או קובץ — ' +
  'התבונן/י בתוכן והתייחס/י אליו: זהה/י את המזון, אמוד/י מאקרו וקלוריות כשאפשר, וענה/י לפי מה שנראה בפועל. ' +
  'חשוב מאוד: בכל פעם שהמשתמש/ת מזכיר/ה שאכל/ה או שתה/תה משהו (גם בדרך אגב) — חובה לקרוא לכלי log_food עם הערכת הערכים התזונתיים, במקום לענות בטקסט בלבד. ' +
  'המר/י בעצמך כל תיאור חופשי לערכים — אל תבקש/י מהמשתמש/ת לחשב או להזין ידנית, זה התפקיד שלך. ' +
  'כשמדווח/ת על משקל גוף ("נשקלתי 68", "אני 72 קילו") — קרא/י ל-log_weight. ' +
  'כשמדווח/ת על שתיית מים ("שתיתי בקבוק", "חצי ליטר מים") — קרא/י ל-log_water. ' +
  'בחירה בין הכלים: מאכל אחד בלבד → log_food. תיאור שכולל כמה מאכלים נפרדים (למשל "2 שניצלונים וחצי צלחת פסטה", "טוסט וקפה", "עוף עם אורז וסלט") → חובה לקרוא ל-log_meal עם רכיב נפרד לכל מאכל, כדי שאפשר יהיה לפתוח את הארוחה ולערוך כל רכיב בנפרד. אל תאחד כמה מאכלים לפריט אחד. ' +
  'אם ההקשר כולל "ארוחות שמורות" והמשתמש/ת מבקש/ת אחת מהן ("תוסיף לי את ארוחת הבוקר הקבועה", "אכלתי את הסלט שלי", "חצי מהארוחה השמורה") — קרא/י ל-log_saved_meal עם השם מהרשימה ועם portion (1 או 0.5), ולא ל-log_food/log_meal; הערכים כבר שמורים ואין צורך להעריך מחדש. ' +
  'בכל פעם שמזכיר/ה שביצע/ה אימון או פעילות גופנית — חובה לקרוא ל-log_workout. ' +
  'אם האימון מתואר עם סטים/חזרות/משקלים ("3 על 10 עם 40 קילו") — קרא/י ל-log_strength עם רשימת התרגילים והסטים, ולא ל-log_workout. ' +
  'לתיקון או מחיקה של פריט שכבר נרשם היום — יש לך כלים ייעודיים: delete_food למחיקה ו-edit_food לתיקון. ' +
  'לעולם אל תציע/י רישום נוסף (log_food) כתחליף לתיקון — זה יוצר כפילות במקום לתקן. ' +
  'ב-edit_food חובה להחזיר את הערכים התזונתיים המתוקנים לכמות החדשה המלאה, לא את ההפרש. ' +
  'אם הפריט שמבקשים לתקן או למחוק אינו מופיע ברשימת הפריטים שנאכלו היום — אל תקרא/י לכלי; אמור/אמרי שלא מצאת אותו. ' +
  'אין לך אפשרות לרשום ליום אחר מהיום, ואינך יכול/ה לגעת ברישומים מימים קודמים. ' +
  'לעולם אל תגיד/י "תיקנתי" או "מחקתי" בלי שקראת לכלי המתאים — זו הטעיה. ' +
  'כשמדובר על אוכל/אימון מיום אחר ("אתמול אכלתי", "בשבת התאמנתי") — אל תקרא/י לכלי; הסבר/י שהרישום מכאן נכנס להיום, ושכדי לרשום ליום אחר צריך לעבור לאותו יום בחצים שליד התאריך במסך הראשי. ' +
  'אין צורך לבקש אישור בטקסט — פשוט קרא/י לכלי, והאפליקציה תציג למשתמש/ת אישור לפני ההוספה בפועל. אפשר להוסיף גם משפט קצר וידידותי לצד קריאת הכלי.';

function contextBlock(ctx) {
  if (!ctx) return '';
  const t = ctx.targets || {};
  const e = ctx.totals || {};
  const r = ctx.remaining || {};
  const n = (v) => (v == null ? '?' : Math.round(v));
  let s =
    '\n\nהקשר אישי של המשתמש/ת להיום (השתמש/י בו כדי להתאים את העצה):\n' +
    'יעדים יומיים — חלבון ' + n(t.p) + ' ג׳, פחמימות ' + n(t.c) + ' ג׳, שומן ' + n(t.f) + ' ג׳.\n' +
    'נאכל עד כה היום — חלבון ' + n(e.p) + ' ג׳, פחמימות ' + n(e.c) + ' ג׳, שומן ' + n(e.f) + ' ג׳.\n' +
    'נשאר להיום — חלבון ' + n(r.p) + ' ג׳, פחמימות ' + n(r.c) + ' ג׳, שומן ' + n(r.f) + ' ג׳.';
  if (Array.isArray(ctx.items) && ctx.items.length) {
    s += '\nפריטים שנאכלו היום: ' +
      ctx.items.slice(0, 30).map((i) => String(i)).join(', ') + '.';
  }
  if (Array.isArray(ctx.workouts) && ctx.workouts.length) {
    s += '\nאימונים שבוצעו היום: ' +
      ctx.workouts.slice(0, 20).map((w) => String(w)).join('; ') + '.';
  } else {
    s += '\nלא בוצעו אימונים היום עדיין.';
  }
  if (ctx.caloriesBurned != null || ctx.energyBalance != null) {
    s += '\nמאזן אנרגיה היום — נכנס מהמזון ' + n(ctx.caloriesIn) + ' קל׳, ' +
      'נשרף באימון ' + n(ctx.caloriesBurned) + ' קל׳ (התוספת מעבר לשריפה במנוחה' +
      (ctx.caloriesBurnedGross ? '; סה״כ ההוצאה באימון ' + n(ctx.caloriesBurnedGross) + ' קל׳' : '') + '), ' +
      'מאזן נטו ' + n(ctx.energyBalance) + ' קל׳.';
  }
  if (ctx.calorieMode && ctx.calorieMode.enabled) {
    s += '\n\nהמשתמש/ת עוקב/ת גם אחרי קלוריות: תקציב יומי ' + n(ctx.calorieMode.dailyBudget) +
      ' קל׳, נאכלו ' + n(ctx.calorieMode.eaten) + ' קל׳, נשארו ' + n(ctx.calorieMode.remaining) + ' קל׳' +
      (ctx.calorieMode.addsWorkoutBurn ? ' (כולל תוספת ממה שנשרף באימון)' : '') +
      '. ציין/י קלוריות בתשובות, לא רק מאקרו.';
  }
  if (ctx.water) {
    s += '\nמים היום: ' + n(ctx.water.cups) + ' מתוך ' + n(ctx.water.targetCups) +
      ' כוסות (כוס = ' + n(ctx.water.cupMl) + ' מ״ל).';
  }
  if (Array.isArray(ctx.savedMeals) && ctx.savedMeals.length) {
    s += '\nארוחות שמורות של המשתמש/ת ("הארוחות שלי") — אפשר להוסיף אותן עם log_saved_meal: ' +
      ctx.savedMeals.map((m) => '"' + m.name + '" (' + m.components + ' מרכיבים · ח' +
        n(m.protein_g) + '/פ' + n(m.carbs_g) + '/ש' + n(m.fat_g) +
        // Without this the model sees a per-serving figure with no hint that the meal is
        // a tray, so "אכלתי את כל התבנית" came back as portion:1 — a twelfth of the food.
        (m.servings > 1 ? ' — מתכון ל-' + m.servings + ' מנות, והערכים האלה הם למנה אחת' : '') +
        ')').join(', ') + '.';
  }
  if (ctx.mealSlots && ctx.mealSlots.length) {
    s += '\nחלוקת היום לארוחות: ' +
      ctx.mealSlots.map((m) => m.label + ' — ' + n(m.kcal) + ' קל׳ (ח' + n(m.p) + '/פ' + n(m.c) + '/ש' + n(m.f) + ')').join(', ') +
      '. כשנשאל/ת "מה אכלתי בארוחת בוקר" או על חלוקת היום — ענה/י מכאן.';
  }
  if (ctx.week) {
    const w = ctx.week;
    s += '\n\nשבעת הימים האחרונים: ' + n(w.daysLogged) + '/7 ימי מעקב' +
      (w.daysOnTarget ? ' (' + n(w.daysOnTarget) + ' בול על היעדים)' : '') +
      '; ממוצע יומי — חלבון ' + n(w.avgProtein_g) + ' ג׳, פחמימות ' + n(w.avgCarbs_g) +
      ' ג׳, שומן ' + n(w.avgFat_g) + ' ג׳' + (w.avgKcal ? ' (' + n(w.avgKcal) + ' קל׳)' : '') +
      '; מים ' + n(w.waterAvgCups) + ' כוסות ב-' + n(w.waterDays) + ' ימים' +
      '; אימונים ' + n(w.workouts) + ' (' + n(w.workoutMinutes) + ' דק׳, ' + n(w.workoutKcal) + ' קל׳)' +
      (w.strengthVolumeKg ? ', נפח כוח ' + n(w.strengthVolumeKg) + ' ק״ג' : '') +
      (w.weightDeltaKg != null ? '; שינוי משקל ' + (w.weightDeltaKg > 0 ? '+' : '') + w.weightDeltaKg + ' ק״ג' : '') +
      '. כשנשאל/ת על השבוע — ענה/י מהנתונים האלה, בטון מעודד: מציינים מה עבד, ומציעים צעד אחד קטן קדימה, בלי להאשים על ימים שפוספסו.';
  }
  if (Array.isArray(ctx.strengthPRs) && ctx.strengthPRs.length) {
    s += '\nשיאים אישיים בכוח: ' +
      ctx.strengthPRs.map((p) => p.name + ' ' + p.bestKg + ' ק״ג' +
        (p.lastSummary ? ' (בפעם האחרונה: ' + p.lastSummary + ')' : '')).join(', ') + '.';
  }
  if (ctx.weight) {
    s += '\nמשקל: נוכחי ' + n(ctx.weight.current) + ' ק״ג, התחלתי ' + n(ctx.weight.startWeight) +
      ' ק״ג, שינוי ' + (ctx.weight.totalDelta > 0 ? '+' : '') + ctx.weight.totalDelta + ' ק״ג' +
      (ctx.weight.goal != null ? ', יעד ' + n(ctx.weight.goal) + ' ק״ג' : '') + '.';
  }
  if (ctx.todaySession) {
    s += ctx.todaySession.rest
      ? '\nלפי התוכנית היום הוא יום מנוחה.'
      : '\nהאימון המתוכנן להיום: ' + (ctx.todaySession.focus || 'אימון') + ' · ' +
        n(ctx.todaySession.minutes) + ' דק׳' + (ctx.todaySession.done ? ' (כבר בוצע ונרשם).' : ' (טרם נרשם).');
  }
  if (ctx.program) {
    const p = ctx.program;
    s += '\n\nתוכנית פעילה של המשתמש/ת:\n' +
      'מטרה: ' + (p.goal || '?') + '. ' +
      'יעד קלורי יומי: ' + n(p.dailyKcalTarget) + ' קל׳. ' +
      (p.difficulty ? 'רמת קושי: ' + p.difficulty + '. ' : '') +
      'אימונים מתוכננים בשבוע: ' + n(p.weeklyWorkouts) + '. ' +
      (p.currentWeight != null ? 'משקל נוכחי: ' + p.currentWeight + ' ק״ג.' : '') +
      '\nהתאם/י את העצה לתוכנית הזו — עזור/י למשתמש/ת לעמוד ביעד הקלורי, ' +
      'בכמות החלבון, ובמספר האימונים השבועי.';
  }
  return s;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'missing_key' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { messages, context } = body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'no_messages' });
  }

  const contents = messages
    .filter((m) => m && ((typeof m.text === 'string' && m.text.trim()) ||
                         (Array.isArray(m.attachments) && m.attachments.length)))
    .slice(-16)
    .map((m) => {
      const parts = [];
      if (typeof m.text === 'string' && m.text.trim()) parts.push({ text: m.text });
      if (Array.isArray(m.attachments)) {
        for (const a of m.attachments) {
          if (a && a.mimeType && a.data) parts.push({ inlineData: { mimeType: a.mimeType, data: a.data } });
        }
      }
      if (!parts.length) parts.push({ text: ' ' });
      return { role: m.role === 'model' ? 'model' : 'user', parts };
    });

  const sysText = BASE_PROMPT + contextBlock(context);

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    MODEL + ':generateContent?key=' + encodeURIComponent(key);

  try {
    const gRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        tools: TOOLS,
        toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
        systemInstruction: { parts: [{ text: sysText }] },
        // Generous output budget so Hebrew replies never truncate mid-sentence
        // (the old 800 cap did); thinking off keeps replies coherent + fast.
        generationConfig: { temperature: 0.7, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });

    if (!gRes.ok) {
      let detail = '';
      try { detail = (await gRes.json())?.error?.message || ''; } catch {}
      return res.status(502).json({ error: 'gemini_error', status: gRes.status, detail });
    }

    const gData = await gRes.json();
    const parts = gData?.candidates?.[0]?.content?.parts || [];
    let txt = '';
    let action = null;
    for (const p of parts) {
      if (p && typeof p.text === 'string') txt += p.text;
      // Only tools the client can actually execute. An unknown name used to reach the
      // user as an empty approval card that silently did nothing when confirmed.
      if (p && p.functionCall && KNOWN_TOOLS.has(p.functionCall.name)) {
        action = { name: p.functionCall.name, args: p.functionCall.args || {} };
      }
    }
    txt = String(txt).trim();
    if (!txt && !action) return res.status(502).json({ error: 'empty_response' });

    return res.status(200).json({ reply: txt, action });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', detail: String(e).slice(0, 300) });
  }
}
