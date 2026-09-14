// Stop hook: if a deployable file changed this turn (flag present), run a single
// `vercel --prod` deploy, then clear the flag. On failure the flag is kept so the
// next turn retries. Emits a JSON systemMessage so the result shows in the UI.
import { existsSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { appHash, readSignoff } from './app-hash.mjs';
import { syncDeployCopy, DEPLOY_DIR } from './deploy-copy.mjs';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // .claude/hooks
const flagPath = join(here, '..', '.needs-deploy');
const projectRoot = join(here, '..', '..');

if (!existsSync(flagPath)) process.exit(0); // nothing changed → no deploy

function out(msg) {
  process.stdout.write(JSON.stringify({ systemMessage: msg, suppressOutput: true }));
}

// The QA gate. Nothing ships without a sign-off recorded for THIS exact tree. It
// exists because a broken build reached real users for ~40 minutes on 2026-08-02:
// the QA agent was still running when this hook deployed. Verifying the hash — not
// merely the presence of a flag — is what makes it hold: an earlier version checked
// only for the file, and a fix applied through Bash left the sign-off standing.
{
  const signoff = readSignoff(join(here, '..'));
  const { hash } = appHash(projectRoot);
  if (!signoff) {
    out('⏸️ לא נפרס — השינויים ממתינים ל-QA.\nאחרי שסוכן ה-QA עבר והממצאים תוקנו ואומתו:\n`node .claude/hooks/qa-pass.mjs "מה נבדק"`');
    process.exit(0);
  }
  if (signoff.hash !== hash) {
    out(`⏸️ לא נפרס — הקוד השתנה אחרי אישור ה-QA ("${signoff.note}").\nצריך בדיקה חוזרת ואז:\n\`node .claude/hooks/qa-pass.mjs "מה נבדק"\``);
    process.exit(0);
  }
}

// Stamp the build id the in-app "new version" notice compares against. Doing this
// here rather than by hand is the whole point: a stamp that depends on remembering
// would go stale, and a stale stamp means the notice silently never fires.
try {
  const indexPath = join(projectRoot, 'index.html');
  const html = readFileSync(indexPath, 'utf8');
  const stamp = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const next = html.replace(
    /(<meta name="mm-build" content=")[^"]*(">)/,
    (_m, a, b) => a + stamp + b,
  );
  if (next !== html) writeFileSync(indexPath, next);
  // The same stamp as a standalone file. The in-app check polls this, not index.html,
  // so a foreground return costs ~20 bytes instead of half a megabyte.
  writeFileSync(join(projectRoot, 'build.txt'), stamp + '\n');
} catch {
  /* stamping is best-effort — never block a deploy on it */
}

// The deploy runs from an ASCII-path copy, not from here: the Hebrew hostname and source
// path make the Vercel CLI throw "Cannot convert argument to a ByteString". Until 2026-08-03
// this block shelled out to a bare `vercel`, which is not on PATH and never was — so every
// automatic deploy failed. Syncing first is what keeps the copy from serving stale code.
try {
  const { copied, deleted } = syncDeployCopy(projectRoot, DEPLOY_DIR);
  const res = execSync('node vercel-wrap.cjs --prod --yes', {
    cwd: DEPLOY_DIR,
    encoding: 'utf8',
    stdio: 'pipe',
    // The Stop hook is capped at 180s and syncDeployCopy runs before this clock starts,
    // pulling ~20MB off Google Drive (files may be dehydrated and need a cloud fetch).
    // 140s leaves that headroom; at 170s a slow sync would kill the hook mid-deploy.
    timeout: 140000,
  });
  rmSync(flagPath, { force: true });
  const url = (String(res).match(/https:\/\/[^\s]+\.vercel\.app/g) || []).pop();
  out(`🚀 נפרס ל-Vercel${url ? ': ' + url : ''}\n(סונכרנו ${copied} קבצים, נמחקו ${deleted})`);
} catch (e) {
  const err = String((e && (e.stderr || e.stdout || e.message)) || e).slice(0, 400);
  const hint = /token is not valid|not authenticated|credentials/i.test(err)
    ? '\n\nהטוקן פג. להתחבר מחדש:\n`cd ' + DEPLOY_DIR + ' && node vercel-wrap.cjs login`'
    : '';
  out(`❌ פריסת Vercel נכשלה — הדגל נשמר לניסיון הבא.\n${err}${hint}`);
}
process.exit(0);
