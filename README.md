# Munch & Move

אפליקציית PWA לניהול תזונה וכושר בעברית (RTL). חיה בפרודקשן:
**https://foodapp-macro.vercel.app**

## מבנה

| נתיב | מה זה |
|---|---|
| `index.html` | כל האפליקציה בקובץ אחד — vanilla JS, בלי פריימוורק |
| `tailwind.css` | Tailwind **מקומפל מראש** (לא CDN). נבנה מ-`tasks/tailwind-build/` |
| `sw.js` | Service Worker. שינוי בנכסי ה-shell מחייב העלאת `CACHE` |
| `api/gemini.js` | ניתוח מזון, תמונות ואימונים |
| `api/chat.js` | העוזר — function calling |
| `api/food.js` | מאגר התזונה |
| `exercises/` | סרטוני התרגילים שהאפליקציה מגישה ישירות |
| `vendor/zxing.min.js` | מפענח ברקודים (decoder-only) |
| `tasks/` | תיעוד פנימי, דוחות QA וכלי בנייה |

נתונים: Supabase (`user_state`) עם Row Level Security. מפתח ה-publishable שבקוד
ציבורי בכוונה — ה-RLS הוא מה שמגן על הנתונים. מפתחות ה-API האמיתיים
(`GEMINI_API_KEY` וכו') יושבים ב-Environment Variables של Vercel בלבד.

## בנייה ופריסה

```bash
# בניית ה-CSS אחרי הוספת מחלקות Tailwind חדשות
cd tasks/tailwind-build && npx -y tailwindcss@3.4.17 -c ./tailwind.config.cjs \
  -i ./input.css -o ../../tailwind.css --minify

# פריסה
vercel --prod --yes
```

## כללי עבודה

- **האפליקציה חיה עם משתמשים אמיתיים.** לא מוחקים ולא מאפסים נתוני משתמש.
- שינויים בסכמת Supabase — **אדיטיביים בלבד**.
- כל פיצ'ר עובר QA בסוכן ייעודי לפני פריסה. השער אכוף בקוד דרך
  `.claude/hooks/` (`flag-deploy` → `qa-pass` → `deploy`), לא בזכירה.
- אימות מול הסביבה החיה, לא מול הקובץ המקומי.

פירוט מלא: [`CLAUDE.md`](CLAUDE.md) · [`AGENTS.md`](AGENTS.md)
