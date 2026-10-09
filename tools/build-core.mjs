/**
 * Build src/core.js from the template, the packages X published, and what
 * x.com's composer actually runs.
 *
 *   npm install            (dev dependencies only: the package ships none)
 *   node tools/build-core.mjs
 *
 * ---------------------------------------------------------------------------
 * WHY THE CORE IS GENERATED
 * ---------------------------------------------------------------------------
 *
 * Two things in the core are long lists that nobody should retype: the 1,581
 * domain endings, and the emoji pattern. This script lifts both out of
 * published packages, twitter-text 3.1.0 and @twemoji/parser 15.0.0, and
 * makes the few edits that turn them into what x.com's composer runs. The
 * edits are listed here and in tools/x-live.json, and they are small: seven
 * endings added, one emoji moved from one group to another.
 *
 * Nothing is trusted to have come out right. tools/x-live.json holds the
 * SHA-256 of every pattern as the composer compiles it, recorded on x.com on
 * 9 October 2026, and this script refuses to write the core unless each
 * pattern it produces has exactly that fingerprint. So the core is not "like"
 * the composer's patterns: it has the same source text, character for
 * character, or there is no core.
 *
 * `--check` writes nothing and exits 1 if src/core.js is not what this script
 * would produce today. CI runs it, so a hand-edited core cannot be merged.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const require = createRequire(import.meta.url);
const BACKSLASH = String.fromCharCode(92);
const LIVE = JSON.parse(readFileSync(path.join(HERE, 'x-live.json'), 'utf8'));
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

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
    console.error(`${name} is ${pkg.version}, and the core is built from ${version}. Moving to another version is a decision, not a side effect: change it here on purpose.`);
    process.exit(2);
  }
  return path.dirname(require.resolve(`${name}/package.json`));
}

const ttDir = need('twitter-text', '3.1.0');
const twDir = need('@twemoji/parser', '15.0.0');

function fail(message) {
  console.error(`REFUSING TO WRITE src/core.js: ${message}`);
  process.exit(1);
}

/* ---------------------------------------------------------------------------
 * THE DOMAIN ENDINGS
 * ------------------------------------------------------------------------- */

/** The alternation inside twitter-text's validGTLD / validCCTLD: everything between the wrapper and the lookahead. */
function endings(name) {
  const mod = require(path.join(ttDir, 'dist', 'regexp', name));
  const source = (mod.default || mod).source;
  const m = /^\(\?:\(\?:(.*)\)\(\?=\[\^0-9a-zA-Z@\+-\]\|\$\)\)$/.exec(source);
  if (!m) throw new Error(`${name} no longer has the shape this script expects`);
  return m[1].split('|');
}

/*
 * The seven endings x.com knows and twitter-text 3.1.0 does not. Each goes
 * straight after the ending the composer's own list has before it, so the
 * alternation comes out with the same text as x.com's, which is checked.
 */
const cp = (...codes) => String.fromCodePoint(...codes);
const ADDED = {
  validGTLD: [
    ['americanexpress', 'amazon'],
    ['kim', 'kids'],
    ['mutual', 'music'],
    ['space', 'spa'],
    [cp(0x30af, 0x30e9, 0x30a6, 0x30c9), cp(0x30a2, 0x30de, 0x30be, 0x30f3)], // after "cloud" in katakana: "amazon" in katakana
    [cp(0x4f01, 0x4e1a), cp(0x4e9a, 0x9a6c, 0x900a)], // after "enterprise" in Chinese: "amazon" in Chinese
  ],
  validCCTLD: [
    [cp(0x627, 0x644, 0x627, 0x631, 0x62f, 0x646), cp(0x5d9, 0x5e9, 0x5e8, 0x5d0, 0x5dc)], // after Jordan in Arabic: Israel in Hebrew
  ],
};

function liveEndings(name, key) {
  const list = endings(name);
  for (const [after, item] of ADDED[name]) {
    const at = list.indexOf(after);
    if (at < 0) fail(`${name} no longer contains the ending ${JSON.stringify(after)} that ${JSON.stringify(item)} follows`);
    if (list.includes(item)) fail(`${name} already contains ${JSON.stringify(item)}: the published list moved, so the edit is stale`);
    list.splice(at + 1, 0, item);
  }
  const body = list.join('|');
  const want = LIVE.endings[key];
  if (list.length !== want.count || sha256(body) !== want.sha256) {
    fail(`the ${key} endings come to ${list.length} with SHA-256 ${sha256(body)}, and x.com's list is ${want.count} with ${want.sha256}`);
  }
  return body;
}

/** One long alternation as a JavaScript string expression, broken at "|" so no line is enormous. */
function asString(body, width = 110) {
  const lines = [];
  let line = '';
  for (const item of body.split('|')) {
    const piece = (line ? '|' : '') + ascii(item);
    if (line && line.length + piece.length > width) {
      lines.push(line + '|');
      line = ascii(item);
    } else line += piece;
  }
  lines.push(line);
  return lines.map((l) => `    '${l}'`).join(' +\n');
}

/* ---------------------------------------------------------------------------
 * THE EMOJI PATTERN
 * ------------------------------------------------------------------------- */

/*
 * @twemoji/parser 15.0.0's pattern with the one change x.com made to it.
 *
 * U+1FAF0, the hand with index finger and thumb crossed, sits in 15.0.0 in the
 * group of emoji that may be followed by U+FE0F, and in the group that may take
 * a skin tone. x.com has it only in the second. In practice: with U+FE0F after
 * it, 15.0.0 charges one emoji at 2 and x.com charges the hand 2 and the
 * selector 2 more. The edit removes the first entry and widens the second
 * group's range by one, and the result is checked against x.com's fingerprint.
 */
function emojiPattern() {
  const file = readFileSync(path.join(twDir, 'dist', 'lib', 'regex.js'), 'utf8');
  const open = 'exports.default = /';
  const from = file.indexOf(open);
  const to = file.lastIndexOf('/g;');
  if (from < 0 || to < 0) throw new Error('@twemoji/parser/dist/lib/regex.js no longer has the shape this script expects');
  let pattern = file.slice(from + open.length, to);

  const u = (hex) => BACKSLASH + 'u' + hex;
  const EDITS = [
    [u('d83e') + u('def0') + '|', ''],
    [u('dec3') + '-' + u('dec5') + u('def1') + '-' + u('def8') + ']', u('dec3') + '-' + u('dec5') + u('def0') + '-' + u('def8') + ']'],
  ];
  for (const [was, now] of EDITS) {
    const times = pattern.split(was).length - 1;
    if (times !== 1) fail(`the emoji edit expects ${JSON.stringify(was)} once in @twemoji/parser 15.0.0 and found it ${times} times`);
    pattern = pattern.split(was).join(now);
  }
  const want = LIVE.patterns.emoji;
  if (pattern.length !== want.length || sha256(pattern) !== want.sha256) {
    fail(`the emoji pattern comes to ${pattern.length} characters with SHA-256 ${sha256(pattern)}, and x.com's is ${want.length} with ${want.sha256}`);
  }

  const escaped = ascii(pattern);
  if (escaped.includes('`') || escaped.includes('${')) throw new Error('the emoji pattern would need escaping inside a template literal');
  const lines = [];
  let line = '';
  for (const part of escaped.split('|')) {
    const piece = (line ? '|' : '') + part;
    if (line && line.length + piece.length > 150) {
      lines.push(line + '|');
      line = part;
    } else line += piece;
  }
  lines.push(line);
  return lines.map((l) => '    String.raw`' + l + '`').join(' +\n');
}

/* ---------------------------------------------------------------------------
 * ASSEMBLE, THEN PROVE IT
 * ------------------------------------------------------------------------- */

let core = readFileSync(path.join(HERE, 'core.template.js'), 'utf8');
core = core.replace('/*@GTLDS@*/', () => asString(liveEndings('validGTLD', 'generic')));
core = core.replace('/*@CCTLDS@*/', () => asString(liveEndings('validCCTLD', 'country')));
core = core.replace('/*@EMOJI@*/', () => emojiPattern());
if (/[^\x00-\x7f]/.test(core)) throw new Error('the core must be plain ASCII');
if (/\/\*@[A-Z]+@\*\//.test(core)) throw new Error('a placeholder was left unfilled');

const out = core + '\nexport { XCount };\n';

// The assembled patterns, compiled the way the core compiles them, must have
// the fingerprints the composer's have. The emoji pattern was checked before it
// was escaped; these are checked after assembly, which is where a mistake in
// the template would show.
const { XCount } = await import('data:text/javascript;base64,' + Buffer.from(out).toString('base64'));
const compiled = XCount.patterns();
for (const name of ['link', 'asciiDomain', 'tco', 'bareMarkdown', 'nonAscii']) {
  const key = name === 'nonAscii' ? 'punycodeNonAscii' : name;
  const want = LIVE.patterns[key];
  const re = compiled[name];
  if (re.source.length !== want.length || sha256(re.source) !== want.sha256) {
    fail(`the ${name} pattern has SHA-256 ${sha256(re.source)} (${re.source.length} characters), and x.com's is ${want.sha256} (${want.length})`);
  }
}
if (XCount.counts.gtlds !== LIVE.endings.generic.count || XCount.counts.cctlds !== LIVE.endings.country.count) {
  fail('the core counts a different number of endings from the list it was given');
}

const target = path.join(ROOT, 'src', 'core.js');

if (process.argv.includes('--check')) {
  const current = readFileSync(target, 'utf8');
  if (current !== out) {
    console.error('src/core.js is not what tools/build-core.mjs produces. Rebuild it; do not edit it by hand.');
    process.exit(1);
  }
  console.log("src/core.js is in step with the template, twitter-text 3.1.0, @twemoji/parser 15.0.0 and x.com's fingerprints.");
} else {
  writeFileSync(target, out);
  console.log(`wrote src/core.js: ${out.length} bytes, every pattern matching x.com's fingerprint`);
}
