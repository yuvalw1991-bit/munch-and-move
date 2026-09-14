// UserPromptSubmit hook — Munch & Move.
// יובל's standing rule (2.8.2026): every feature/fix gets a dedicated QA agent, and
// the agent must also cover whatever the change touched. A rule that lives only in
// CLAUDE.md gets skipped when the session is long, so it is injected at the exact
// moment feature work is requested.
//
// Deliberately NON-blocking: this project's deploy runs from a Stop hook, and a
// blocking hook once swallowed two deploys. This only adds context, never stops.
import { readFileSync } from 'node:fs';

let input = '';
try { input = readFileSync(0, 'utf8'); } catch { }

let prompt = '';
try { prompt = String(JSON.parse(input || '{}').prompt || ''); } catch { prompt = input || ''; }

// Feature / fix work — Hebrew and English phrasings actually used in this project.
const FEATURE = /(פיצ['׳]?ר|פיצר|תבנ[יה]|בנ[יה] לי|תוסיפ?[יה]?|להוסיף|תיישמ?[יה]?|ליישם|תתקנ?[יה]?|לתקן|תשנ[יה]|לשנות|תממש|refactor|implement|feature|build|fix)/i;
// Pure conversation / reporting — no code is produced, so no QA is due.
const NOT_WORK = /^(מה |למה |איך |האם |כמה |מתי |תסבירי?|תראי לי|תציגי|status|מצב)/i;

if (FEATURE.test(prompt) && !NOT_WORK.test(prompt.trim())) {
  const reminder = [
    '[כלל קבוע של יובל — QA בסוכן אחרי כל פיצ׳ר]',
    'בסיום הפיצ׳ר/התיקון הזה, לפני שמדווחים שהוא הושלם:',
    '1. להפעיל סוכן QA ייעודי (Agent tool) שבודק את הפיצ׳ר מכל הבחינות — זרימה תקינה, מקרי קצה, קלט לא תקין, מצב ריק ומצב מלא, RTL, מובייל ודסקטופ, שגיאות קונסול.',
    '2. הסוכן חייב לבדוק גם את מה שהשינוי נגע בו או עלול היה להשפיע עליו: כל פונקציה משותפת שנערכה וכל הקוראים לה, כל מסך שמציג את אותם נתונים, וכל מסלול שמירה/טעינה/סנכרון שנגע בו.',
    '3. אם השינוי נגע במחיקה, בדריסה או בסנכרון — בדיקת אובדן נתונים מפורשת, כולל undo ומצב אופליין. האפליקציה חיה עם משתמשים אמיתיים.',
    'הסוכן מדווח בלבד ואינו עורך קוד. לתקן לפי הדוח, לאמת כל תיקון, ורק אז לדווח שהפיצ׳ר הושלם.',
  ].join('\n');

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: reminder },
  }));
}
process.exit(0);
