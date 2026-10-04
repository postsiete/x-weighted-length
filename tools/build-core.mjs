/**
 * Build src/core.js from the template and X's own published packages.
 *
 *   npm install            (twitter-text and twemoji-parser, dev only)
 *   node tools/build-core.mjs
 *
 * ---------------------------------------------------------------------------
 * WHY THE CORE IS GENERATED
 * ---------------------------------------------------------------------------
 *
 * Two things in the core are long lists that X maintains and nobody should
 * retype: the 1,574 domain endings, and the emoji pattern. This script lifts
 * both out of the packages X published and writes them into the template, so
 * the only hand-written part is the part a person can read and check.
 *
 * `--check` writes nothing and exits 1 if src/core.js is not what this script
 * would produce today. CI runs it, so a hand-edited core cannot be merged.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const require = createRequire(import.meta.url);
const BACKSLASH = String.fromCharCode(92);

/** Write anything outside printable ASCII as an escape, so the core is plain ASCII in every file that carries it. */
const ascii = (s) => s.replace(/[^\x20-\x7e]/g, (c) => BACKSLASH + 'u' + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0'));

function need(name, version) {
  let pkg;
  try {
    pkg = require(`${name}/package.json`);
  } catch {
    console.error(`${name} is not installed. Run "npm install" first; it is a dev dependency, not something this package ships.`);
    process.exit(2);
  }
  if (pkg.version !== version) {
    console.error(`${name} is ${pkg.version}, and the core is a port of ${version}. Moving to another version is a decision, not a side effect: change it here on purpose.`);
    process.exit(2);
  }
  return path.dirname(require.resolve(`${name}/package.json`));
}

const ttDir = need('twitter-text', '3.1.0');
const twDir = need('twemoji-parser', '14.0.0');

/** The alternation inside twitter-text's validGTLD / validCCTLD: everything between the wrapper and the lookahead. */
function endings(name) {
  const mod = require(path.join(ttDir, 'dist', 'regexp', name));
  const source = (mod.default || mod).source;
  const m = /^\(\?:\(\?:(.*)\)\(\?=\[\^0-9a-zA-Z@\+-\]\|\$\)\)$/.exec(source);
  if (!m) throw new Error(`${name} no longer has the shape this script expects`);
  return m[1];
}

/** One long alternation as a JavaScript string expression, broken at "|" so no line is enormous. */
function asString(list, width = 110) {
  const lines = [];
  let line = '';
  for (const item of list.split('|')) {
    const piece = (line ? '|' : '') + ascii(item);
    if (line && line.length + piece.length > width) {
      lines.push(line + '|');
      line = ascii(item);
    } else line += piece;
  }
  lines.push(line);
  return lines.map((l) => `    '${l}'`).join(' +\n');
}

/** twemoji-parser's pattern, as String.raw pieces. It is copied, never rewritten. */
function emojiPattern() {
  const file = readFileSync(path.join(twDir, 'dist', 'lib', 'regex.js'), 'utf8');
  const open = 'exports.default = /';
  const from = file.indexOf(open);
  const to = file.lastIndexOf('/g;');
  if (from < 0 || to < 0) throw new Error('twemoji-parser/dist/lib/regex.js no longer has the shape this script expects');
  const pattern = ascii(file.slice(from + open.length, to));
  if (pattern.includes('`') || pattern.includes('${')) throw new Error('the emoji pattern would need escaping inside a template literal');
  const lines = [];
  let line = '';
  for (const part of pattern.split('|')) {
    const piece = (line ? '|' : '') + part;
    if (line && line.length + piece.length > 150) {
      lines.push(line + '|');
      line = part;
    } else line += piece;
  }
  lines.push(line);
  return lines.map((l) => '    String.raw`' + l + '`').join(' +\n');
}

let core = readFileSync(path.join(HERE, 'core.template.js'), 'utf8');
core = core.replace('/*@GTLDS@*/', () => asString(endings('validGTLD')));
core = core.replace('/*@CCTLDS@*/', () => asString(endings('validCCTLD')));
core = core.replace('/*@EMOJI@*/', () => emojiPattern());
if (/[^\x00-\x7f]/.test(core)) throw new Error('the core must be plain ASCII');
if (/\/\*@[A-Z]+@\*\//.test(core)) throw new Error('a placeholder was left unfilled');

const out = core + '\nexport { XCount };\n';
const target = path.join(ROOT, 'src', 'core.js');

if (process.argv.includes('--check')) {
  const current = readFileSync(target, 'utf8');
  if (current !== out) {
    console.error('src/core.js is not what tools/build-core.mjs produces. Rebuild it; do not edit it by hand.');
    process.exit(1);
  }
  console.log('src/core.js is in step with the template, twitter-text 3.1.0 and twemoji-parser 14.0.0.');
} else {
  writeFileSync(target, out);
  console.log(`wrote src/core.js: ${out.length} bytes`);
}
