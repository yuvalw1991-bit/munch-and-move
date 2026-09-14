// Records a QA sign-off for the exact tree that was reviewed, which is what lets the
// Stop hook deploy (see deploy.mjs). Run ONLY after a QA agent has reviewed the change
// and every finding it raised has been fixed and verified.
//
//   node .claude/hooks/qa-pass.mjs "פיצ'ר 12 — התראת גרסה חדשה"
//   node .claude/hooks/qa-pass.mjs --revoke
//   node .claude/hooks/qa-pass.mjs --status
//
// The sign-off stores a hash of every deployable file. Any later change — through
// Edit, through Bash, through anything — makes the hash disagree and the deploy is
// refused. Nothing here depends on remembering to revoke it.
import { writeFileSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { appHash, readSignoff } from './app-hash.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const claudeDir = join(here, '..');
const projectRoot = join(here, '..', '..');
const target = join(claudeDir, '.qa-passed');

const arg = process.argv.slice(2).join(' ').trim();

if (arg === '--revoke') {
  rmSync(target, { force: true });
  console.log('אישור ה-QA בוטל. הפריסה תיחסם עד לאישור חדש.');
  process.exit(0);
}

const { hash, count } = appHash(projectRoot);

if (arg === '--status') {
  const s = readSignoff(claudeDir);
  if (!s) console.log('אין אישור QA. הפריסה חסומה.');
  else if (s.hash !== hash) console.log(`האישור אינו תואם לקוד הנוכחי (הקוד השתנה מאז "${s.note}"). הפריסה חסומה.`);
  else console.log(`✅ אישור תקף: ${s.note} (${s.at})`);
  console.log(`ממתין לפריסה: ${existsSync(join(claudeDir, '.needs-deploy')) ? 'כן' : 'לא'}`);
  process.exit(0);
}

if (!arg) {
  console.error('חסר תיאור. שימוש: node .claude/hooks/qa-pass.mjs "מה נבדק"');
  process.exit(1);
}

writeFileSync(target, JSON.stringify({ at: new Date().toISOString(), note: arg, hash, files: count }, null, 2));
console.log(`✅ אישור QA נרשם עבור ${count} קבצים: ${arg}`);
console.log(existsSync(join(claudeDir, '.needs-deploy'))
  ? 'יש שינויים ממתינים — הפריסה תרוץ בסוף התור.'
  : 'אין שינויים ממתינים לפריסה.');
