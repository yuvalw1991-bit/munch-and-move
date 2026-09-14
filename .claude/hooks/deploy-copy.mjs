// Mirrors the project into an ASCII-path copy that the Vercel CLI can actually run from.
//
// Why this exists: the machine's hostname is Hebrew (`לפטופ-יובל`) and the source path is
// Hebrew too. The Vercel CLI puts the hostname into an HTTP header (Latin-1 only) and dies
// with "Cannot convert argument to a ByteString". So deploys run from `DEPLOY_DIR` through
// `vercel-wrap.cjs`, which ASCII-izes the hostname.
//
// The copy is the thing that gets uploaded, so it MUST match source before every deploy.
// On 2026-08-03 it had drifted five weeks (index.html 227KB vs 631KB, sw.js v2 vs v18);
// deploying from it would have rolled real users back. Hence: sync is not optional and not
// manual — it runs as part of the deploy, and the deploy refuses to proceed if it fails.

import {
  existsSync, readFileSync, writeFileSync, mkdirSync,
  readdirSync, statSync, copyFileSync, rmSync,
} from 'node:fs';
import { join, relative, sep } from 'node:path';

export const DEPLOY_DIR = 'C:\\Users\\yuval\\AppData\\Local\\Temp\\FoodApp-deploy';

// Files the copy owns and source must never clobber: the Vercel link, the installed CLI,
// the wrapper, and the copy's own package.json/lockfile (they pin the CLI install).
// Enforced on BOTH sides of the sync — skipped when copying in and when pruning out.
const COPY_OWNED = new Set([
  '.vercel', 'node_modules', 'package.json', 'package-lock.json',
  'vercel-wrap.cjs', 'vercel-wrap.js', 'serve.cjs', 'render-icons.cjs',
]);

// Never mirrored regardless of .vercelignore.
const ALWAYS_SKIP = new Set(['.git', '.vercel', 'node_modules', '.playwright-mcp']);

/** Parse .vercelignore into matcher predicates. Supports `dir/`, `*.ext` and literal names. */
function loadIgnore(root) {
  const f = join(root, '.vercelignore');
  if (!existsSync(f)) return [];
  return readFileSync(f, 'utf8')
    .replace(/\r/g, '') // CRLF: `.` in JS regex does not match \r, and neither does a trim-less compare
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((pat) => {
      const dirOnly = pat.endsWith('/');
      const body = dirOnly ? pat.slice(0, -1) : pat;
      const rx = new RegExp(
        '^' + body.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
      );
      return { rx, dirOnly };
    });
}

const isIgnored = (rules, name, isDir) =>
  rules.some((r) => (r.dirOnly ? isDir && r.rx.test(name) : r.rx.test(name)));

/** Every path under `root` that Vercel would actually upload, relative to root. */
function deployableSet(root, rules, rel = '', acc = new Set()) {
  for (const entry of readdirSync(join(root, rel), { withFileTypes: true })) {
    const name = entry.name;
    if (ALWAYS_SKIP.has(name)) continue;
    const isDir = entry.isDirectory();
    if (isIgnored(rules, name, isDir)) continue;
    const r = rel ? rel + sep + name : name;
    if (isDir) {
      acc.add(r + sep);
      deployableSet(root, rules, r, acc);
    } else {
      acc.add(r);
    }
  }
  return acc;
}

/** Files currently in the copy, excluding the copy's own infrastructure. */
function copyContents(dir, rel = '', acc = new Set()) {
  for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
    const name = entry.name;
    if (!rel && COPY_OWNED.has(name)) continue;
    if (ALWAYS_SKIP.has(name)) continue;
    const r = rel ? rel + sep + name : name;
    if (entry.isDirectory()) {
      acc.add(r + sep);
      copyContents(dir, r, acc);
    } else {
      acc.add(r);
    }
  }
  return acc;
}

/**
 * Make DEPLOY_DIR byte-identical to the deployable subset of `source`.
 * Returns { copied, deleted, total }. Throws if the copy is missing its Vercel link
 * or the CLI — recreating those needs an interactive login, so failing loudly beats
 * silently deploying from a half-built directory.
 */
export function syncDeployCopy(source, deployDir = DEPLOY_DIR) {
  if (!existsSync(deployDir)) {
    throw new Error(
      `עותק הפריסה חסר: ${deployDir}\n` +
        'צריך לבנות אותו מחדש (העתקה + npm install vercel + התחברות).',
    );
  }
  for (const need of ['.vercel/project.json', 'vercel-wrap.cjs', 'node_modules/vercel']) {
    if (!existsSync(join(deployDir, need))) {
      throw new Error(`עותק הפריסה פגום — חסר ${need} ב-${deployDir}`);
    }
  }

  const rules = loadIgnore(source);
  const want = deployableSet(source, rules);
  let copied = 0;

  for (const r of want) {
    if (COPY_OWNED.has(r.replace(new RegExp(sep === '\\' ? '\\\\$' : '/$'), ''))) continue;
    const from = join(source, r);
    const to = join(deployDir, r);
    if (r.endsWith(sep)) {
      if (!existsSync(to)) mkdirSync(to, { recursive: true });
      continue;
    }
    const s = statSync(from);
    // mtime alone is unreliable across filesystems (G: vs C:), so compare size too.
    if (existsSync(to)) {
      const d = statSync(to);
      if (d.size === s.size && Math.abs(d.mtimeMs - s.mtimeMs) < 2000) continue;
    }
    mkdirSync(join(to, '..'), { recursive: true });
    copyFileSync(from, to);
    copied++;
  }

  // Drop anything the copy still holds that source no longer deploys — otherwise a file
  // deleted from the project keeps being served.
  let deleted = 0;
  for (const r of copyContents(deployDir)) {
    if (want.has(r)) continue;
    const p = join(deployDir, r);
    if (!existsSync(p)) continue;
    rmSync(p, { recursive: true, force: true });
    deleted++;
  }

  return { copied, deleted, total: want.size };
}

// CLI use: `node deploy-copy.mjs` syncs and prints a summary.
if (process.argv[1] && process.argv[1].endsWith('deploy-copy.mjs')) {
  const root = join(import.meta.dirname, '..', '..');
  const r = syncDeployCopy(root);
  console.log(`סונכרן: ${r.copied} קבצים הועתקו, ${r.deleted} נמחקו, ${r.total} בסך הכל.`);
}
