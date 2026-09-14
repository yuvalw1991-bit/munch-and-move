// One definition of "what is deployed", shared by the QA gate and the deploy hook.
//
// The gate used to be a flag file that only Edit/Write/MultiEdit revoked — so a fix
// applied through Bash (`node -e "fs.writeFileSync('index.html', …)"`, which this
// project's own conventions encourage) left a stale sign-off standing and shipped
// unreviewed code. A gate you can step around by accident is not a gate, so the
// sign-off now records a hash of the tree and the deploy verifies it.
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const DEPLOYABLE = /\.(html|js|mjs|css|json|webmanifest)$/i;
// `.vercelignore` has no code extension but decides WHICH files ship, so a change to it
// is a change to the deploy. It was outside the gate until 2026-08-04, and that is exactly
// how an over-broad `*.mp4` rule — which erased all 12 exercise videos from the deploy —
// kept a four-hour-old sign-off looking valid.
const GATED_EXTRAS = new Set(['.vercelignore', 'vercel.json']);
const isGated = (rel) => GATED_EXTRAS.has(rel) || DEPLOYABLE.test(rel);
const SKIP_DIRS = new Set(['.claude', 'tasks', 'node_modules', '.git', '.vercel', '.playwright-mcp']);

function walk(dir, root, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, root, out);
    else {
      const rel = relative(root, full).split(sep).join('/');
      if (isGated(rel)) out.push(rel);
    }
  }
}

export function appHash(root) {
  const files = [];
  walk(root, root, files);
  files.sort();
  const h = createHash('sha256');
  for (const rel of files) {
    // The build stamp is written by the deploy itself, after the gate has already
    // passed. Including it would invalidate every sign-off the moment we deploy.
    if (rel === 'build.txt') continue;
    let body = readFileSync(join(root, rel), 'utf8');
    if (rel === 'index.html') body = body.replace(/(<meta name="mm-build" content=")[^"]*(">)/, '$1$2');
    h.update(rel).update('\0').update(body).update('\0');
  }
  return { hash: h.digest('hex'), count: files.length };
}

export function readSignoff(claudeDir) {
  const p = join(claudeDir, '.qa-passed');
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}
