// PostToolUse hook (Edit|Write|MultiEdit): marks that a deployable file changed, so
// the Stop hook deploys ONCE per turn no matter how many edits happened.
//
// Allow-list, not deny-list: the previous deny-list flagged a scratch file written to
// %TEMP% — a file with no connection to the app — which queued a pointless deploy and
// revoked a valid QA sign-off. Only files inside the project that actually ship count.
//
// Revoking the sign-off here is a convenience, not the guarantee: deploy.mjs verifies
// a hash of the tree, so a change made by any other means is caught regardless.
import { writeFileSync, rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(join(here, '..', '..'));
const DEPLOYABLE = /\.(html|js|mjs|css|json|webmanifest)$/i;
// Kept in step with app-hash.mjs: these carry no code but decide what ships.
const GATED_EXTRAS = new Set(['.vercelignore', 'vercel.json']);

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  try {
    const j = JSON.parse(input || '{}');
    const raw = (j.tool_input && j.tool_input.file_path) || '';
    if (!raw) process.exit(0);
    const f = resolve(raw);
    if (f !== projectRoot && !f.startsWith(projectRoot + sep)) process.exit(0);   // outside the app
    const rel = f.slice(projectRoot.length + 1).split(sep).join('/');
    if (rel.startsWith('.claude/') || rel.startsWith('tasks/')) process.exit(0);  // config / notes
    if (!GATED_EXTRAS.has(rel) && !DEPLOYABLE.test(rel)) process.exit(0);         // docs, images, etc.
    if (rel === 'build.txt') process.exit(0);                                     // written by the deploy itself
  } catch {
    process.exit(0);   // unparseable input is not evidence that app code changed
  }
  try {
    writeFileSync(new URL('../.needs-deploy', import.meta.url), String(Date.now()));
    rmSync(new URL('../.qa-passed', import.meta.url), { force: true });
  } catch {}
  process.exit(0);
});
