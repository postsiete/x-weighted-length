#!/usr/bin/env node
/**
 * x-conformance ./my-counter.js [exportName]
 *
 * Ships inside x-weighted-length under two bin names: `x-conformance` is what
 * the command does, `x-weighted-length` is what the package is called, and
 * people reach for whichever they remember.
 *
 * Without installing anything:
 *
 *   npx -p github:postsiete/x-weighted-length x-conformance ./my-counter.js
 *
 * Never `npx x-conformance` on its own. That asks the npm registry for a
 * package of that name, which is not this one: today it is an error, and on the
 * day somebody registers the name it runs their code.
 *
 * Loads a module, finds a counter function in it, and runs the suite.
 *
 * The export-resolution order below is deliberate and deliberately LOUD when it
 * cannot decide. Guessing which of several exported functions is the counter
 * produces a report about the wrong function, and a green report about the
 * wrong function is worse than an error — it is the exact failure mode this
 * whole package exists to prevent, committed by the tool doing the checking.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { check, format, vectors, categories } from '../src/conformance.js';

const USAGE = `x-conformance — check a weighted-length counter against ${vectors().length} published vectors

  x-conformance <module> [exportName] [--json] [--only cat,cat] [--skip cat,cat]

  Not installed? Run it straight from the repository:
  npx -p github:postsiete/x-weighted-length x-conformance <module> [exportName] ...

  <module>      path to a JS module exporting your counter, or the name of a
                package installed in the directory you run this from
  [exportName]  which export to test; omit when the module has a default export
                or exactly one exported function

  --json        machine-readable report on stdout, for CI
  --only        run only these categories (comma separated)
  --skip        skip these categories

Exit code: 0 every vector passed, 1 at least one failed, 2 it could not run.

Categories: ${Object.keys(categories()).join(', ')}
Vectors and arithmetic: https://postsiete.com/tools/x-character-counter/conformance
`;

function die(msg) {
  process.stderr.write(`${msg}\n`);
  process.exit(2); // 2 = could not run. 1 is reserved for "ran, and vectors failed".
}

const argv = process.argv.slice(2);
if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write(USAGE);
  process.exit(argv.length === 0 ? 2 : 0);
}

const flags = { json: false, only: null, skip: null };
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--json') flags.json = true;
  else if (a === '--only' || a === '--skip') {
    const v = argv[++i];
    if (!v) die(`${a} needs a comma-separated list of categories`);
    flags[a.slice(2)] = v.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (a.startsWith('-')) die(`unknown flag: ${a}`);
  else positional.push(a);
}

const [target, exportName] = positional;
if (!target) die('no module given\n\n' + USAGE);

/*
 * WHERE THE MODULE IS LOOKED FOR: the directory you are standing in.
 *
 * A path is resolved against it. Anything else is a package name, and it is
 * looked up from that same directory, not from wherever this file lives. The
 * difference is the whole reason `x-conformance twitter-text getTweetLength`
 * works: run through npx, this file sits in npm's cache, and a plain
 * `import('twitter-text')` from there finds nothing however many times the
 * package is installed in your project. That was the first thing anyone
 * checking this suite would try, and it failed with "cannot find package".
 */
function entryOf(name, subpath, here) {
  // The ESM half of package resolution, for packages `require` cannot load:
  // walk up from `here` looking for node_modules/<name> and read its entry.
  const pick = (e) => (typeof e === 'string' ? e : e && typeof e === 'object' ? pick(e.import ?? e.node ?? e.default) : undefined);
  for (let dir = here; ; dir = path.dirname(dir)) {
    const root = path.join(dir, 'node_modules', name);
    try {
      const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
      let entry;
      if (pkg.exports !== undefined) {
        const map = typeof pkg.exports === 'string' || !Object.keys(pkg.exports).some((k) => k.startsWith('.')) ? { '.': pkg.exports } : pkg.exports;
        entry = pick(map[subpath]);
      } else {
        entry = subpath === '.' ? pkg.module || pkg.main || 'index.js' : subpath;
      }
      if (entry) return pathToFileURL(path.join(root, entry)).href;
    } catch {
      /* not in this directory; look one up */
    }
    if (path.dirname(dir) === dir) return null;
  }
}

function locate(wanted) {
  const here = process.cwd();
  if (/^[./]|^[a-zA-Z]:[\\/]/.test(wanted)) return pathToFileURL(path.resolve(here, wanted)).href;
  try {
    return pathToFileURL(createRequire(path.join(here, 'x-conformance.cjs')).resolve(wanted)).href;
  } catch {
    const parts = wanted.split('/');
    const name = wanted.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
    // Failing that, hand the name to Node as it is and report whatever it says.
    return entryOf(name, `.${wanted.slice(name.length)}`, here) ?? wanted;
  }
}

const specifier = locate(target);

let mod;
try {
  mod = await import(specifier);
} catch (err) {
  die(`could not import ${target}\n  ${err && err.message ? err.message : err}`);
}

function resolveCounter(m, name) {
  if (name) {
    const picked = m[name] ?? (typeof m.default === 'object' && m.default ? m.default[name] : undefined);
    if (typeof picked !== 'function') die(`export "${name}" is not a function`);
    return picked;
  }
  if (typeof m.default === 'function') return m.default;

  /* A CommonJS module with `module.exports = { a, b }` arrives as a default
   * OBJECT, so look inside it before giving up — otherwise every CJS counter
   * would need a wrapper. */
  const pool = typeof m.default === 'object' && m.default ? { ...m, ...m.default } : m;
  const fns = Object.keys(pool).filter((k) => typeof pool[k] === 'function' && k !== 'default');
  if (fns.length === 1) return pool[fns[0]];
  if (fns.length === 0) die(`${target} exports no function. Pass an export name, or export your counter.`);
  die(
    `${target} exports ${fns.length} functions and no default: ${fns.join(', ')}\n` +
      `Say which one, e.g.  x-conformance ${target} ${fns[0]}`,
  );
}

const counter = resolveCounter(mod, exportName);
const report = check(counter, { only: flags.only, skip: flags.skip });

if (flags.json) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write(`${format(report, { color: process.stdout.isTTY === true })}\n`);
}
process.exit(report.ok ? 0 : 1);
