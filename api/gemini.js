// Serverless proxy for Gemini. The API key lives ONLY here, as a server
// environment variable (GEMINI_API_KEY) — it is never sent to the browser.

const MODEL = 'gemini-2.5-flash';

const SYS_PROMPT =
  'אתה מומחה תזונה שמעריך ערכים תזונתיים. עבור כל מאכל או מנה שתקבל — בטקסט או בתמונה — ' +
  'החזר הערכה מספרית מציאותית של חלבון, פחמימות ושומן בגרמים. ' +
  'תמיד תן הערכה לפי הידע התזונתי המקובל; לעולם אל תחזיר אפסים או "לא ידוע" עבור מאכל אמיתי. ' +
  'אם לא צוינה כמות — קבע את amount ל**מידה הכי פופולרית/סטנדרטית** של אותו מוצר בסופר ' +
  '(גודל האריזה או המנה הנפוצים ביותר בפועל), ולא 100 גרם כברירת מחדל. ' +
  'למשל: קוטג׳ 250 גרם, גביע יוגורט 150-200 גרם, פחית משקה 330 מ"ל, ביצה יחידה ~60 גרם, פרוסת לחם ~30 גרם. ' +
  'אם המשתמש ציין כמות מפורשת — כבד אותה במקום, והערכים חייבים להתאים בדיוק לכמות המלאה שצוינה ' +
  '(כמות של 3 יחידות = הערכים של שלוש היחידות יחד, לא של אחת). ' +
  'בשדה amount החזר את הכמות המשוערת של המנה (מספר), ובשדה unit את יחידת המידה. ' +
  'העדף תמיד יחידות משקל או נפח מדויקות — "גרם" למוצקים ו"מ"ל" לנוזלים. ' +
  'השתמש ב"יחידה" רק עבור מאכלים שנספרים באופן טבעי ביחידות (למשל ביצה, פרוסת לחם, תפוח, חזה עוף). ' +
  'כשאתה מחזיר unit שאינו גרם/מ"ל (כמו יחידה, כף, כוס, מנה), הוסף בשדה name את המשקל המשוער בגרמים בסוגריים, ' +
  'למשל "חזה עוף (יחידה ~170 ג׳)" או "כף שמן זית (~15 ג׳)". ' +
  'הערכים התזונתיים חייבים להתאים לכמות שבשדה amount. ' +
  'בשדה name החזר שם קצר וברור בעברית. החזר מספרים בלבד, ללא יחידות בשדות המספריים.';

const FOOD_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    protein_g: { type: 'NUMBER' },
    carbs_g: { type: 'NUMBER' },
    fat_g: { type: 'NUMBER' },
    amount: { type: 'NUMBER' },
    unit: { type: 'STRING' },
  },
  required: ['name', 'protein_g', 'carbs_g', 'fat_g'],
};

const MEAL_SYS =
  'אתה מומחה תזונה שמפרק ארוחות למרכיבים. עבור ארוחה שתקבל — בטקסט או בתמונה — ' +
  'פרק אותה לרכיבים הבודדים שמרכיבים אותה (למשל: אורז, חזה עוף, סלט, רוטב). ' +
  'עבור כל רכיב החזר שם קצר וברור בעברית, את הכמות שלו בארוחה (amount + unit), ' +
  'ואת ערכיו התזונתיים (חלבון, פחמימות, שומן בגרמים) שמתאימים בדיוק לאותה כמות. ' +
  'תמיד תן הערכה מספרית מציאותית לפי הידע התזונתי המקובל; לעולם אל תחזיר אפסים או "לא ידוע" עבור רכיב אמיתי. ' +
  'חוק קריטי — הערכים הם תמיד לכמות המלאה שבשדה amount, לא ליחידה בודדת. ' +
  'אם amount=3 ו-unit="יחידה", חלבון/פחמימות/שומן חייבים להיות הסכום של כל שלוש היחידות יחד. ' +
  'אם המשתמש ציין מספר של פריטים נספרים — שמור את המספר המדויק ב-amount ואל תמיר אותו לגרמים. ' +
  'למשל "שני שניצלונים" → amount=2, unit="יחידה" (ולא 100 גרם), והערכים הם של שני השניצלונים יחד. ' +
  'עבור מאכל שנמדד במשקל ולא נספר (אורז, פסטה, סלט, גבינה) — העדף "גרם" למוצקים ו"מ"ל" לנוזלים. ' +
  'כשאתה מחזיר unit שאינו גרם/מ"ל, הוסף בשדה name את המשקל הכולל המשוער בגרמים בסוגריים — ' +
  'למשל "3 ביצים (~180 ג׳ סה״כ)", "שני שניצלונים (~120 ג׳ סה״כ)". אל תכתוב את משקל היחידה הבודדת. ' +
  'בשדה meal_name החזר שם קצר וברור לכלל הארוחה בעברית. ' +
  'פרק את הארוחה ל-1 עד 8 רכיבים משמעותיים. ' +
  'אם קיבלת מאכל בודד אחד (למשל "שווארמה", "תפוח", "חזה עוף") — החזר רכיב יחיד אחד בלבד. ' +
  'פרק לכמה רכיבים רק כשמדובר בארוחה מורכבת מכמה מאכלים. ' +
  'כאשר מדובר במוצר בודד ולא צוינה כמות — קבע את amount ל**מידה הכי פופולרית/סטנדרטית** של אותו מוצר בסופר ' +
  '(גודל האריזה או המנה הנפוצים ביותר שאנשים קונים בפועל), ולא 100 גרם כברירת מחדל. ' +
  'למשל: קוטג׳ 250 גרם, גביע יוגורט 150-200 גרם, פחית משקה 330 מ"ל, ביצה יחידה ~60 גרם, תפוח יחידה ~150 גרם, פרוסת לחם ~30 גרם. ' +
  'הערכים התזונתיים חייבים להתאים בדיוק למידה הזו. אם המשתמש ציין כמות מפורשת — כבד אותה במקום. ' +
  'בתמונה: פרק כל מאכל שנראה בצלחת לרכיב נפרד משלו. אם רואים כמה מאכלים — אסור להחזיר רכיב אחד. ' +
  'הערך את הכמות של כל מאכל לפי מה שנראה בפועל בתמונה (גודל ביחס לצלחת/כלים). ' +
  'החזר מספרים בלבד בשדות המספריים, ללא יחידות.';

// The model sometimes writes the weight note into `unit` ("יחידה (~100 ג׳ סה״כ)")
// and uses plural forms the app's unit list doesn't have. Normalize both so the
// unit survives the editor's <select> instead of being dropped.
const UNIT_ALIASES = {
  'יחידות': 'יחידה', 'פרוסה': 'יחידה', 'פרוסות': 'יחידה',
  'כפות': 'כף', 'כפיות': 'כפית', 'כוסות': 'כוס', 'מנות': 'מנה',
  'גר': 'גרם', 'ג': 'גרם', 'גרמים': 'גרם', 'מל': 'מ"ל', 'מיליליטר': 'מ"ל',
};
function cleanUnit(u) {
  let s = String(u || '').replace(/\([^)]*\)/g, '').replace(/[~׳']/g, '').trim();
  return UNIT_ALIASES[s] || s;
}

const MEAL_SCHEMA = {
  type: 'OBJECT',
  properties: {
    meal_name: { type: 'STRING' },
    components: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          protein_g: { type: 'NUMBER' },
          carbs_g: { type: 'NUMBER' },
          fat_g: { type: 'NUMBER' },
          amount: { type: 'NUMBER' },
          unit: { type: 'STRING' },
        },
        required: ['name', 'protein_g', 'carbs_g', 'fat_g'],
      },
    },
  },
  required: ['meal_name', 'components'],
};

const WORKOUT_SYS =
  'אתה מאמן כושר ופיזיולוג של מאמץ שמנתח אימונים מתיאור חופשי. עבור תיאור אימון חופשי בעברית שתקבל — ' +
  'נתח אותו לעומק והחזר: שם קצר וברור לאימון (name); ' +
  'הוצאה קלורית מציאותית שנשרפה (kcal); משך בדקות (minutes); ' +
  'רמת עצימות (level) באחת מהמילים בלבד: קל / בינוני / גבוה; ' +
  'muscles — מערך של קבוצות השריר העיקריות שעבדו בעברית (למשל חזה, גב, רגליים, כתפיים, ידיים, ליבה, ישבן); ' +
  'focus — מילה אחת או שתיים שמתארות את הגירוי העיקרי: "בניית שריר" / "כוח" / "סיבולת אירובית" / "ניידות וגמישות"; ' +
  'muscle_score — ציון 0–100 כמה האימון מקדם בניית שריר/היפרטרופיה; ' +
  'strength_score — ציון 0–100 כמה הוא מפתח כוח מרבי; ' +
  'cardio_score — ציון 0–100 כמה הוא אימון אירובי/קרדיו; ' +
  'protein_g — כמה גרם חלבון מומלץ לצרוך אחרי האימון כדי לתמוך בהתאוששות ובניית שריר; ' +
  'tip — משפט טיפ קצר ומעשי אחד של מאמן לאימון הזה. ' +
  'אם צוין משקל גוף בק״ג — השתמש בו לחישוב הקלוריות (קלוריות = MET × משקל × שעות). ' +
  'התאם את הציונים לאופי האימון: אימון התנגדות כבד → muscle_score ו-strength_score גבוהים, cardio_score נמוך; ' +
  'ריצה/אופניים → cardio_score גבוה, muscle_score נמוך. ' +
  'תמיד תן הערכה מספרית מציאותית; לעולם אל תחזיר אפס עבור אימון אמיתי. ' +
  'כל הטקסט בעברית. החזר מספרים בלבד בשדות המספריים, ללא יחידות.';

// Trainer's session plan (pasted WhatsApp text and/or a screenshot) → structured sets.
const TRAINER_SCHEMA = {
  type: 'object',
  properties: {
    date: { type: 'string', description: 'YYYY-MM-DD if a date appears, otherwise empty' },
    title: { type: 'string' },
    notes: { type: 'string' },
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          en: { type: 'string' },
          match: { type: 'string', description: 'id from the library list, or empty when it is a new exercise' },
          area: { type: 'string', enum: ['legs', 'glutes', 'back', 'chest', 'shoulders', 'core', 'arms'] },
          kind: { type: 'string', enum: ['reps', 'time'] },
          perSide: { type: 'boolean' },
          note: { type: 'string' },
          sets: {
            type: 'array',
            items: {
              type: 'object',
              properties: { kg: { type: 'number' }, reps: { type: 'number' }, seconds: { type: 'number' } },
            },
          },
        },
        required: ['name', 'sets'],
      },
    },
  },
  required: ['exercises'],
};

const WORKOUT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    kcal: { type: 'NUMBER' },
    minutes: { type: 'NUMBER' },
    level: { type: 'STRING' },
    muscles: { type: 'ARRAY', items: { type: 'STRING' } },
    focus: { type: 'STRING' },
    muscle_score: { type: 'NUMBER' },
    strength_score: { type: 'NUMBER' },
    cardio_score: { type: 'NUMBER' },
    protein_g: { type: 'NUMBER' },
    tip: { type: 'STRING' },
  },
  required: ['name', 'kcal'],
};

const PROGRAM_SYS =
  'אתה מאמן כושר אישי מנוסה שבונה תוכניות אימון מותאמות אישית. ' +
  'תקבל רמת מתאמן, סביבת אימון, מטרה, זמן פנוי בדקות ומשקל גוף. ' +
  'בנה אימון יחיד מפורט שמתאים בדיוק לרמה ולסביבה — מקליל מאוד (הליכה, מתיחות, משקל-גוף קל למתחילים בבית/פארק) ' +
  'ועד עצים וכבד (פונקציונלי, חדר כושר, מתקדמים). התאם את בחירת התרגילים והעומס לרמה ולמטרה. ' +
  'החזר: title (שם קצר לאימון), summary (משפט הסבר קצר), ' +
  'exercises (מערך של 3 עד 8 תרגילים; לכל תרגיל: name=שם התרגיל, dose=מינון כמו "3 סטים × 12 חזרות" או "5 דקות", how=הסבר ביצוע קצר ובטיחותי במשפט אחד), ' +
  'minutes (משך כולל משוער בדקות), kcal (הוצאה קלורית משוערת לכל האימון לפי משקל הגוף). ' +
  'כל הטקסט בעברית. החזר מספרים בלבד בשדות המספריים, ללא יחידות.';

const PROGRAM_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    summary: { type: 'STRING' },
    minutes: { type: 'NUMBER' },
    kcal: { type: 'NUMBER' },
    exercises: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          dose: { type: 'STRING' },
          how: { type: 'STRING' },
        },
        required: ['name'],
      },
    },
  },
  required: ['title', 'exercises'],
};

// Nutrition-label reader: extract the per-100g macros from a product's nutrition table photo.
const LABEL_SYS =
  'אתה קורא טבלאות "ערך תזונתי" מתמונה של אריזת מוצר מזון. ' +
  'חלץ מהטבלה את הערכים התזונתיים ל-100 גרם (או ל-100 מ"ל לנוזלים): ' +
  'חלבון (protein_100g), פחמימות (carbs_100g), שומן (fat_100g), וקלוריות (kcal_100g) — הכל ל-100 גרם. ' +
  'חשוב: אם הטבלה נותנת ערכים למנה/יחידה אחרת (למשל "ל-30 גרם" או "למנה"), המר אותם ל-100 גרם ' +
  '(ערך ל-100 = ערך-למנה × 100 / גודל-המנה-בגרמים). ' +
  'בשדה basis החזר טקסט קצר שמתאר על איזה בסיס הופיעה הטבלה במקור (למשל "ל-100 גרם" או "למנה 30 גרם"). ' +
  'בשדה name החזר שם מוצר קצר בעברית אם מזוהה, אחרת מחרוזת ריקה. ' +
  'בשדה popular_g החזר את המשקל בגרמים של ה**מידה הכי פופולרית/סטנדרטית** של המוצר הזה בסופר ' +
  '(גודל האריזה או המנה הנפוצים ביותר שאנשים קונים בפועל; למשל קוטג׳ 250, גביע יוגורט 150, פחית 330). ' +
  'אם המשקל הכולל של האריזה מופיע על התווית — העדף אותו. אם לא ידוע, החזר 100. ' +
  'אם ערך מסוים לא מופיע בטבלה החזר 0. החזר מספרים בלבד בשדות המספריים, ללא יחידות.';

const LABEL_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING' },
    protein_100g: { type: 'NUMBER' },
    carbs_100g: { type: 'NUMBER' },
    fat_100g: { type: 'NUMBER' },
    kcal_100g: { type: 'NUMBER' },
    popular_g: { type: 'NUMBER' },
    basis: { type: 'STRING' },
  },
  required: ['protein_100g', 'carbs_100g', 'fat_100g'],
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'missing_key' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { mode, name, desc, mimeType, data, qty, unit, weight, level, env, goal, minutes } = body || {};

  // 'image' (single-item photo) also goes through the MEAL schema: a photo of a full
  // plate used to be forced into ONE row by FOOD_SCHEMA and everything else was
  // silently dropped. MEAL_SYS returns a single component for a single food, so the
  // one-item case is unaffected — but a plate now comes back complete.
  const isMeal = mode === 'meal' || mode === 'mealImage' || mode === 'image';
  const isWorkout = mode === 'workout';
  const isProgram = mode === 'program';
  const isLabel = mode === 'label';

  // ----- Exercise illustration (image generation) — separate model + flow -----
  // `phase` ('start' | 'end') lets the client request the two keyframes of one rep,
  // then cross-fade them into a looping "animation" of the movement (cheap, instant).
  if (mode === 'exerciseImage') {
    if (!name) return res.status(400).json({ error: 'no_name' });
    const IMG_MODEL = 'gemini-2.5-flash-image';
    const phase = body && body.phase;
    const phaseTxt = phase === 'start'
      ? ' Capture the STARTING position of the movement (muscles lengthened / rep not yet begun).'
      : phase === 'end'
        ? ' Capture the END / fully-contracted position of the movement (top of the rep, muscles working hardest).'
        : '';
    const prompt =
      'A clean, simple instructional fitness illustration of a single person correctly performing the exercise: "' +
      name + '".' + phaseTxt +
      ' Side or three-quarter view, full body visible, clear posture and form, identical character, framing, camera angle and background across phases, ' +
      'neutral light studio background, flat modern vector style, no text, no labels, no watermark.';
    const imgUrl =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      IMG_MODEL + ':generateContent?key=' + encodeURIComponent(key);
    try {
      const iRes = await fetch(imgUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      });
      if (!iRes.ok) {
        let detail = '';
        try { detail = (await iRes.json())?.error?.message || ''; } catch {}
        return res.status(502).json({ error: 'gemini_error', status: iRes.status, detail });
      }
      const iData = await iRes.json();
      const ps = iData?.candidates?.[0]?.content?.parts || [];
      const img = ps.find((p) => p.inlineData && p.inlineData.data);
      if (!img) return res.status(502).json({ error: 'no_image_out' });
      return res.status(200).json({
        image: img.inlineData.data,
        mimeType: img.inlineData.mimeType || 'image/png',
      });
    } catch (e) {
      return res.status(500).json({ error: 'server_error', detail: String(e).slice(0, 300) });
    }
  }

  // ----- Exercise motion VIDEO (Veo) — real short clip of the movement -----
  // Two-step async flow (Veo is long-running):
  //   exerciseVideoStart -> POST :predictLongRunning, returns { op: '<operation name>' }
  //   exerciseVideoPoll   -> POST { op }, polls the operation; when done returns base64 mp4.
  const VEO_MODEL = 'veo-3.1-generate-preview';
  if (mode === 'exerciseVideoStart') {
    if (!name) return res.status(400).json({ error: 'no_name' });
    // Realism is driven by three things together: the model (Veo 3.1, Google's most
    // advanced), a photorealistic + anatomically-accurate prompt, and a negativePrompt
    // that suppresses cartoon/illustration/deformed output. We want the movement to
    // match real, correct exercise execution as closely as possible.
    const prompt =
      'Photorealistic instructional fitness video of a single fit adult athlete performing the exercise "' +
      name + '" with correct, textbook form and technique. ' +
      'One full, controlled repetition through the complete range of motion (start position to full contraction and back to start) ' +
      'at a steady, natural tempo, with anatomically correct posture, joint alignment and muscle engagement. ' +
      'Real human body with realistic proportions, athletic wear, modern gym or clean studio with soft natural lighting. ' +
      'Side or three-quarter camera angle, full body in frame, stable tripod shot, sharp focus, high detail, true-to-life motion. ' +
      'No text, no captions, no on-screen graphics, no logo, no watermark.';
    const negativePrompt =
      'cartoon, illustration, drawing, anime, sketch, painting, 3d render, cgi, video game, ' +
      'distorted anatomy, extra limbs, extra fingers, deformed joints, unnatural or jerky motion, ' +
      'morphing body, floating weights, wrong exercise form, blurry, low quality, ' +
      'text, captions, subtitles, watermark, logo';
    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/' +
      VEO_MODEL + ':predictLongRunning?key=' + encodeURIComponent(key);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: { aspectRatio: '9:16', negativePrompt },
        }),
      });
      if (!r.ok) {
        let detail = '';
        try { detail = (await r.json())?.error?.message || ''; } catch {}
        return res.status(502).json({ error: 'veo_error', status: r.status, detail });
      }
      const j = await r.json();
      if (!j.name) return res.status(502).json({ error: 'no_operation', detail: JSON.stringify(j).slice(0, 300) });
      return res.status(200).json({ op: j.name });
    } catch (e) {
      return res.status(500).json({ error: 'server_error', detail: String(e).slice(0, 300) });
    }
  }
  if (mode === 'exerciseVideoPoll') {
    const op = body && body.op;
    if (!op) return res.status(400).json({ error: 'no_op' });
    try {
      const opUrl =
        'https://generativelanguage.googleapis.com/v1beta/' +
        op + '?key=' + encodeURIComponent(key);
      const r = await fetch(opUrl);
      if (!r.ok) {
        let detail = '';
        try { detail = (await r.json())?.error?.message || ''; } catch {}
        return res.status(502).json({ error: 'veo_error', status: r.status, detail });
      }
      const j = await r.json();
      if (!j.done) return res.status(200).json({ done: false });
      if (j.error) return res.status(502).json({ error: 'veo_failed', detail: String(j.error?.message || '').slice(0, 300) });
      // Locate the generated video URI across known response shapes.
      const resp = j.response || {};
      const sample =
        resp?.generateVideoResponse?.generatedSamples?.[0] ||
        resp?.generatedSamples?.[0] ||
        resp?.videos?.[0] || null;
      const uri =
        sample?.video?.uri || sample?.video?.fileUri ||
        sample?.uri || resp?.generatedVideos?.[0]?.video?.uri || null;
      const inlineB64 =
        sample?.video?.videoBytes || sample?.bytesBase64Encoded || null;
      if (inlineB64) {
        return res.status(200).json({ done: true, video: inlineB64, mimeType: 'video/mp4' });
      }
      if (!uri) return res.status(502).json({ error: 'no_video_out', detail: JSON.stringify(j).slice(0, 400) });
      // Download the bytes server-side (the file endpoint needs the key) and return base64.
      const dl = await fetch(uri + (uri.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(key));
      if (!dl.ok) return res.status(502).json({ error: 'download_failed', status: dl.status });
      const buf = Buffer.from(await dl.arrayBuffer());
      return res.status(200).json({
        done: true,
        video: buf.toString('base64'),
        mimeType: dl.headers.get('content-type') || 'video/mp4',
      });
    } catch (e) {
      return res.status(500).json({ error: 'server_error', detail: String(e).slice(0, 300) });
    }
  }

  if (mode === 'trainerPlan') {
    const text = String(desc || '').slice(0, 8000);
    if (!text && !data) return res.status(400).json({ error: 'no_input' });
    const lib = (Array.isArray(body && body.lib) ? body.lib : []).filter((e) => e && typeof e === 'object').slice(0, 120);
    const today = /^\d{4}-\d{2}-\d{2}$/.test(String((body && body.today) || '')) ? body.today : '';
    const libTxt = lib.map((e) => String(e.id || '').slice(0, 40) + ' = ' + String(e.he || '').slice(0, 60) + (e.en ? ' / ' + String(e.en).slice(0, 60) : '')).join('\n');
    const prompt =
      'לפניך תוכנית של אימון כוח שמאמנת שלחה (טקסט מוואטסאפ ו/או צילום מסך). חלץ כל תרגיל עם הסטים שלו.\n' +
      'כללים: "12 חז 2 סטים" = שני סטים של 12 חזרות. "15 ק״ג" = kg 15. זמן כמו "1:33" או "1.03" בפלאנק = שניות (93, 63) ו-kind=time. ' +
      'כשסטים שונים זה מזה — סט נפרד לכל אחד. "10 חז כל צד" = perSide true. בלי משקל = kg 0. ' +
      'חימום, הליכה ושחרור אינם תרגילים — אל תכלול אותם. סופר סט: כל תרגיל בנפרד, והערה "סופר סט". ' +
      'הערות כמו מכשיר, תנוחה, מנוחה או "5 שניות סטטי" — לשדה note. ' +
      'match: המזהה מרשימת המאגר כשמדובר באותו תרגיל (גם בניסוח אחר, למשל "לחיצות רגליים במכונה" = leg_press, "היפטראס" = hip_thrust, "משיכה/חתירה במכונה סלקטור" = selector_row). ' +
      'תרגיל שלא ברשימה — match ריק, name בעברית, en באנגלית, ו-area לפי השריר העיקרי. ' +
      'date: התאריך שמופיע בתוכנית בפורמט YYYY-MM-DD' + (today ? ' (היום ' + today + '; שנה בשתי ספרות היא 20XX)' : '') + ', ריק אם אין. ' +
      'title: כותרת קצרה (למשל "אימון אישי #4"). notes: הערה כללית אם יש (למשל טווח קושי).\n\n' +
      'המאגר:\n' + libTxt + (text ? '\n\nהתוכנית:\n' + text : '');
    const tParts = [{ text: prompt }];
    if (data) tParts.push({ inlineData: { mimeType: mimeType || 'image/jpeg', data } });
    try {
      const gRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent?key=' + encodeURIComponent(key), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: tParts }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: TRAINER_SCHEMA, temperature: 0.1, thinkingConfig: { thinkingBudget: 512 } },
        }),
      });
      if (!gRes.ok) {
        let detail = '';
        try { detail = (await gRes.json())?.error?.message || ''; } catch {}
        return res.status(502).json({ error: 'gemini_error', status: gRes.status, detail });
      }
      const gData = await gRes.json();
      const txt = gData?.candidates?.[0]?.content?.parts?.find((x) => typeof x.text === 'string')?.text;
      if (!txt) return res.status(502).json({ error: 'empty_response' });
      const parsed = JSON.parse(txt);
      const ids = new Set(lib.map((e) => String(e.id)));
      const AREAS = ['legs', 'glutes', 'back', 'chest', 'shoulders', 'core', 'arms'];
      const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v) * 100) / 100 : 0);
      const exercises = (Array.isArray(parsed.exercises) ? parsed.exercises : []).map((e) => ({
        name: String(e.name || '').trim().slice(0, 80),
        en: String(e.en || '').trim().slice(0, 60),
        match: ids.has(String(e.match || '')) ? String(e.match) : '',
        area: AREAS.includes(e.area) ? e.area : 'legs',
        kind: e.kind === 'time' ? 'time' : 'reps',
        perSide: !!e.perSide,
        note: String(e.note || '').trim().slice(0, 160),
        sets: (Array.isArray(e.sets) ? e.sets : []).slice(0, 10).map((x) => ({ kg: num(x.kg), reps: Math.round(num(x.reps)), seconds: Math.round(num(x.seconds)) }))
          .filter((x) => x.reps > 0 || x.seconds > 0 || x.kg > 0),
      })).filter((e) => e.name && e.sets.length).slice(0, 25);
      return res.status(200).json({
        date: /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date || '')) ? parsed.date : '',
        title: String(parsed.title || '').trim().slice(0, 60),
        notes: String(parsed.notes || '').trim().slice(0, 200),
        exercises,
      });
    } catch (e) {
      return res.status(500).json({ error: 'server_error', detail: String(e).slice(0, 300) });
    }
  }

  let parts;
  if (isProgram) {
    const wTxt = (weight && Number(weight) > 0) ? Number(weight) + ' ק״ג' : 'לא צוין';
    parts = [{ text:
      'בנה אימון מותאם. רמת מתאמן: ' + (level || 'מתחיל') +
      '. סביבה: ' + (env || 'פארק') +
      '. מטרה: ' + (goal || 'כושר כללי') +
      '. זמן פנוי: ' + (Number(minutes) > 0 ? Number(minutes) + ' דקות' : '30 דקות') +
      '. משקל גוף: ' + wTxt + '.' }];
  } else if (isWorkout) {
    if (!desc) return res.status(400).json({ error: 'no_desc' });
    const wTxt = (weight && Number(weight) > 0)
      ? ' (משקל גוף: ' + Number(weight) + ' ק״ג)'
      : '';
    parts = [{ text: 'הערך את ההוצאה הקלורית, המשך בדקות, רמת העצימות ושם קצר עבור האימון הבא' + wTxt + ': ' + desc }];
  } else if (mode === 'mealImage') {
    if (!data) return res.status(400).json({ error: 'no_image' });
    parts = [
      { text: 'נתח את הארוחה בתמונה: פרק אותה לרכיבים הבודדים, הערך לכל רכיב את הכמות שנראית (amount + unit) ואת ערכיו התזונתיים לפי אותה כמות.' },
      { inlineData: { mimeType: mimeType || 'image/jpeg', data } },
    ];
  } else if (mode === 'meal') {
    const mealDesc = desc || name;
    if (!mealDesc) return res.status(400).json({ error: 'no_desc' });
    parts = [{ text: 'פרק את הארוחה הבאה לרכיביה והערך לכל רכיב כמות וערכים תזונתיים: ' + mealDesc }];
  } else if (mode === 'image') {
    if (!data) return res.status(400).json({ error: 'no_image' });
    parts = [
      { text: 'זהה מה נמצא בתמונה. אם רואים מאכל אחד — החזר רכיב אחד. אם רואים כמה מאכלים (למשל צלחת עם כמה דברים) — פרק אותם לרכיבים נפרדים. לכל רכיב הערך את הכמות שנראית בפועל (amount + unit) ואת ערכיו התזונתיים לפי אותה כמות.' },
      { inlineData: { mimeType: mimeType || 'image/jpeg', data } },
    ];
  } else if (isLabel) {
    if (!data) return res.status(400).json({ error: 'no_image' });
    parts = [
      { text: 'קרא את טבלת הערך התזונתי בתמונה והחזר את הערכים ל-100 גרם (חלבון, פחמימות, שומן, קלוריות).' },
      { inlineData: { mimeType: mimeType || 'image/jpeg', data } },
    ];
  } else {
    if (!name) return res.status(400).json({ error: 'no_name' });
    const qNum = Number(qty);
    const hasQty = qty != null && !isNaN(qNum) && qNum > 0;
    const txt = hasQty
      ? 'חשב את הערכים התזונתיים עבור ' + name + ' בכמות מדויקת של ' +
        qNum + (unit ? ' ' + unit : '') +
        '. החזר את אותה כמות בשדות amount ו-unit, והערכים חייבים להתאים בדיוק לכמות הזו.'
      : 'הערך את הכמות (amount + unit) ואת הערכים התזונתיים עבור המאכל הבא: ' + name;
    parts = [{ text: txt }];
  }

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    MODEL + ':generateContent?key=' + encodeURIComponent(key);

  try {
    const gRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        systemInstruction: { parts: [{ text: isProgram ? PROGRAM_SYS : (isWorkout ? WORKOUT_SYS : (isMeal ? MEAL_SYS : (isLabel ? LABEL_SYS : SYS_PROMPT))) }] },
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: isProgram ? PROGRAM_SCHEMA : (isWorkout ? WORKOUT_SCHEMA : (isMeal ? MEAL_SCHEMA : (isLabel ? LABEL_SCHEMA : FOOD_SCHEMA))),
          temperature: 0.2,
          // Reasoning budget where it changes the answer: workout analysis, and any
          // food task that has to judge portions from a photo or multiply a count by
          // a per-unit value (at 0 the model intermittently reported per-unit macros
          // for a multi-unit amount). Plain single lookups stay at 0 for speed.
          thinkingConfig: { thinkingBudget: isWorkout ? 512 : (isMeal ? 384 : 0) },
        },
      }),
    });

    if (!gRes.ok) {
      let detail = '';
      try { detail = (await gRes.json())?.error?.message || ''; } catch {}
      return res.status(502).json({ error: 'gemini_error', status: gRes.status, detail });
    }

    const gData = await gRes.json();
    const txt = gData?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!txt) return res.status(502).json({ error: 'empty_response' });

    const parsed = JSON.parse(txt);

    if (isProgram) {
      const exercises = (Array.isArray(parsed.exercises) ? parsed.exercises : [])
        .map((e) => ({
          name: String(e.name || '').trim(),
          dose: String(e.dose || '').trim(),
          how: String(e.how || '').trim(),
        }))
        .filter((e) => e.name);
      return res.status(200).json({
        title: String(parsed.title || '').trim() || 'אימון מותאם',
        summary: String(parsed.summary || '').trim(),
        minutes: Number(parsed.minutes) > 0 ? Math.round(Number(parsed.minutes)) : null,
        kcal: Number(parsed.kcal) > 0 ? Math.round(Number(parsed.kcal)) : null,
        exercises,
      });
    }

    if (isWorkout) {
      const lvls = { 'קל': 'קל', 'בינוני': 'בינוני', 'גבוה': 'גבוה' };
      const clamp = (v) => {
        const n = Math.round(Number(v) || 0);
        return Math.max(0, Math.min(100, n));
      };
      const muscles = (Array.isArray(parsed.muscles) ? parsed.muscles : [])
        .map((m) => String(m || '').trim())
        .filter(Boolean)
        .slice(0, 8);
      return res.status(200).json({
        name: String(parsed.name || '').trim() || 'אימון',
        kcal: Math.max(0, Math.round(Number(parsed.kcal) || 0)),
        minutes: Number(parsed.minutes) > 0 ? Math.round(Number(parsed.minutes)) : null,
        level: lvls[String(parsed.level || '').trim()] || '',
        muscles,
        focus: String(parsed.focus || '').trim(),
        muscleScore: clamp(parsed.muscle_score),
        strengthScore: clamp(parsed.strength_score),
        cardioScore: clamp(parsed.cardio_score),
        protein: Number(parsed.protein_g) > 0 ? Math.round(Number(parsed.protein_g)) : null,
        tip: String(parsed.tip || '').trim(),
      });
    }

    if (isMeal) {
      const comps = Array.isArray(parsed.components) ? parsed.components : [];
      const components = comps.map((co) => {
        const a = Number(co.amount);
        return {
          name: String(co.name || '').trim(),
          p: Number(co.protein_g) || 0,
          c: Number(co.carbs_g) || 0,
          f: Number(co.fat_g) || 0,
          qty: isNaN(a) || a <= 0 ? null : a,
          unit: cleanUnit(co.unit),
        };
      }).filter((co) => co.name);
      const out = {
        name: String(parsed.meal_name || '').trim() || 'ארוחה',
        components,
      };
      // A single recognized food is ALSO returned in the flat single-item shape, so
      // callers that expect {name,p,c,f,qty,unit} (the photo button) keep working
      // without having to know whether the answer came back as a meal.
      if (components.length === 1) {
        const co = components[0];
        out.name = co.name || out.name;
        out.p = co.p; out.c = co.c; out.f = co.f;
        out.qty = co.qty; out.unit = co.unit;
      }
      return res.status(200).json(out);
    }

    if (isLabel) {
      const pos = (v) => Math.max(0, Number(v) || 0);
      const popular = pos(parsed.popular_g);
      return res.status(200).json({
        name: String(parsed.name || '').trim(),
        p100: pos(parsed.protein_100g),
        c100: pos(parsed.carbs_100g),
        f100: pos(parsed.fat_100g),
        kcal100: pos(parsed.kcal_100g),
        popularG: popular > 0 ? popular : 100,
        basis: String(parsed.basis || '').trim(),
      });
    }

    const amt = Number(parsed.amount);
    return res.status(200).json({
      name: String(parsed.name || '').trim(),
      p: Number(parsed.protein_g) || 0,
      c: Number(parsed.carbs_g) || 0,
      f: Number(parsed.fat_g) || 0,
      qty: isNaN(amt) || amt <= 0 ? null : amt,
      unit: cleanUnit(parsed.unit),
    });
  } catch (e) {
    return res.status(500).json({ error: 'server_error', detail: String(e).slice(0, 300) });
  }
}
