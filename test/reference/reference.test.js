/**
 * This package against X's own library, on input nobody chose.
 *
 *   npm install
 *   npm run test:reference
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS PROVES, AND WHY IT IS A SEPARATE RUN
 * ---------------------------------------------------------------------------
 *
 * `npm test` needs nothing installed and proves the package agrees with the
 * cases somebody wrote down: its own vectors and twitter-text's conformance
 * suite. This file needs twitter-text and twemoji-parser installed (they are
 * dev dependencies; the package itself still depends on nothing), and proves
 * the stronger thing: on a million and a half strings generated at random, the
 * count and the links are the same as the ones X's own code produces.
 *
 * Three claims are pinned here, and the README makes all three:
 *
 *   1. The link patterns in src/core.js have the same source text as
 *      twitter-text 3.1.0's, and the emoji pattern is twemoji-parser 14.0.0's.
 *   2. The core gives the same weighted length, and finds the same links at the
 *      same positions, as twitter-text's algorithm run with that emoji table.
 *   3. twitter-text as npm installs it today is NOT that: it pins an emoji table
 *      from October 2018 (twemoji-parser 11.0.2), and so it fails exactly one of
 *      the 71 vectors: the mechanic, twitter-text issue #369.
 *
 * Claim 3 needs both emoji tables at once, which is why twemoji-parser 14.0.0
 * is a dev dependency in its own right: npm then keeps 11.0.2 nested under
 * twitter-text, exactly where it lands for everybody else, and puts 14.0.0 at
 * the top. `walk` below is twitter-text's `parseTweet` loop with the table
 * passed in, and the first test checks that it IS that loop before anything
 * else relies on it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { XCount } from '../../src/core.js';
import { weightedLength } from '../../src/index.js';
import { check } from '../../src/conformance.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(import.meta.url);

function load(name) {
  try {
    return require(name);
  } catch {
    throw new Error(`${name} is not installed. Run "npm install" first: this run compares against X's own library and cannot pass without it.`);
  }
}
const twitterText = load('twitter-text');
const table14 = load('twemoji-parser');
const table11 = require(require.resolve('twemoji-parser', { paths: [path.dirname(require.resolve('twitter-text/package.json'))] }));
const version = (id, from) => JSON.parse(readFileSync(require.resolve(`${id}/package.json`, from ? { paths: [from] } : undefined), 'utf8')).version;

const LIGHT = [[0x0000, 0x10ff], [0x2000, 0x200d], [0x2010, 0x201f], [0x2032, 0x2037]];

/** twitter-text's parseTweet loop (config v3), with the emoji table as a parameter. */
function walk(text, table) {
  const s = text.normalize();
  const urls = new Map(twitterText.extractUrlsWithIndices(s).map((u) => [u.indices[0], u]));
  const emoji = new Map(table.parse(s).map((e) => [e.indices[0], e]));
  let weight = 0;
  for (let i = 0; i < s.length; i++) {
    if (urls.has(i)) {
      weight += 2300;
      i += urls.get(i).url.length - 1;
    } else if (emoji.has(i)) {
      weight += 200;
      i += emoji.get(i).text.length - 1;
    } else {
      const c = s.charCodeAt(i);
      if (i < s.length - 1 && c >= 0xd800 && c <= 0xdbff && s.charCodeAt(i + 1) >= 0xdc00 && s.charCodeAt(i + 1) <= 0xdfff) i += 1;
      const unit = s.charCodeAt(i);
      weight += LIGHT.some(([lo, hi]) => unit >= lo && unit <= hi) ? 100 : 200;
    }
  }
  return weight / 100;
}
const xCounts = (text) => walk(text, table14);
const xLinks = (text) => twitterText.extractUrlsWithIndices(text.normalize()).map((u) => `${u.indices[0]}:${u.indices[0] + u.url.length}`).join(',');
const ourLinks = (text) => XCount.links(text).map((l) => `${l.start}:${l.end}`).join(',');

/* ---- input nobody chose: seeded, so a failure can be run again ---- */

function generator(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, pick: (list) => list[Math.floor(next() * list.length)] };
}
const U = (...cps) => String.fromCodePoint(...cps);

/** Fragments chosen to land on every rule: boundaries of the ranges, pieces of links, pieces of emoji. */
const FRAGMENTS = [
  'a', 'b', 'Z', '0', '9', ' ', ' ', '  ', '\n', '\t', '.', '.', '..', ',', '!', '?', ':', ';', '-', '_', '/', '//', '\\', '(', ')', '[', ']', '{', '}', '<', '>', '"', "'", '`', '~', '^', '|', '+', '=', '&', '%', '*',
  '@', '#', '$', U(0xff20), U(0xff03), 'http://', 'https://', 'HTTP://', 'Https://', 'ftp://', 'www.', 'mailto:', 'http:/', 'https:',
  'example', 'twitter', 't', 'co', 'foo', 'bar-baz', 'a_b', 'x1', 'README', 'index', 'localhost', 'xn--', 'xn--p1ai', 'xn--80ak6aa92e',
  '.com', '.net', '.org', '.io', '.co', '.uk', '.co.uk', '.md', '.rs', '.py', '.js', '.ts', '.gov', '.edu', '.zip', '.mov', '.next', '.app', '.dev', '.ai', '.me', '.it', '.in', '.one', '.xyz', '.invalid', '.c', '.coma', '.comx', '.online', '.museum',
  '.' + U(0x440, 0x444), '.' + U(0xd55c, 0xad6d), '.' + U(0x4e2d, 0x56fd), U(0x43f, 0x440, 0x438, 0x43c, 0x435, 0x440), U(0x4f8b, 0x3048), U(0x6f22), U(0x3042),
  't.co/', 't.co/abc', 't.co/' + 'a'.repeat(41), '/path', '/a/b', '/a.b', '/a_(b)', '/(a)', '/((a))', '/a(b(c)d)e', '/@user/', '/@', '?q=1', '?a=b&c=d', '?', '?x', '#frag', '#', ':8080', ':80/', ':', 'a'.repeat(63), 'a'.repeat(64), 'b'.repeat(30),
  U(0x1f600), U(0x1f468), U(0x1f469), U(0x1f467), U(0x1f466), U(0x200d), U(0x200d), U(0xfe0f), U(0xfe0e), U(0x1f3fb), U(0x1f3fd), U(0x1f1e8), U(0x1f1f4), U(0x1f1fa), U(0x20e3), '1', '#', '*',
  U(0x2764), U(0x2764, 0xfe0f), U(0x267e), U(0x267e, 0xfe0f), U(0xa9), U(0xae), U(0x2122), U(0x1f441), U(0x1f5e8), U(0x1f9d1), U(0x1f527), U(0x2640), U(0x2642), U(0x1f3f3, 0xfe0f), U(0x1f308), U(0x26a7), U(0x1f3f4), U(0xe0067), U(0xe007f),
  U(0x1faf7), U(0x1faf8), U(0x1f426), U(0x2b1b), U(0x1f642), U(0x2194), U(0x1f6b6), U(0x27a1), U(0x1f46f),
  U(0x301), U(0x308), 'e', U(0xe9), U(0x202a), U(0x202c), U(0x2066), U(0x2069), U(0x200e), U(0x200f), U(0x61c), U(0xfeff), U(0xfffe), U(0xffff), U(0xa0), U(0x3000), U(0x2028), U(0x3002), U(0xff0e), U(0xff61),
  U(0x10ff), U(0x1100), U(0x2000), U(0x200b), U(0x200c), U(0x200e), U(0x2010), U(0x201f), U(0x2020), U(0x2032), U(0x2037), U(0x2038), U(0x2013),
  String.fromCharCode(0xd800), String.fromCharCode(0xdc00), String.fromCharCode(0xdbff), String.fromCharCode(0xdfff),
  U(0x400), U(0x4ff), U(0xc0), U(0xd7), U(0xf7), U(0x24f), U(0x250), U(0x1e00), U(0x1eff), U(0x36f), U(0x370),
];
/** Long runs with no spaces, dots and underscores everywhere: where the fast scan in the core has to be exactly right. */
const DENSE = ['a', 'b', 'c', 'x', '1', '.', '.', '.', '_', '_', '-', '-', U(0x3042), U(0x6f22), U(0x3002), 'com', 'co', 'md', 'uk', 'io', 'xn--', 'xn--p1ai', U(0x440, 0x444), 'http://', 'https://', 'www', '/', '/p', '?q=1', ':', '@', '#', '$', ' ', U(0x1f600), U(0x200d), U(0xfe0f), 'e' + U(0x301), 'comx', 'com-', 'com+', 'com@', '"', U(0xff0e), '..', '._', '_.', '-.', '.-', 'a'.repeat(62), 'a'.repeat(63)];
/** Links assembled from parts: what comes before, protocol, host, ending, port, path, query, what comes after. */
const SHAPE = {
  before: ['', ' ', 'a', '9', '@', '#', '$', '-', '_', '.', '/', '(', '"', U(0x3042), ':', U(0xff20), U(0x202a), '\n', 'x ', '=', '+'],
  protocol: ['', 'http://', 'https://', 'HTTPS://', 'ftp://', 'www.', 'http://www.'],
  host: ['example', 'sub.example', 'a-b', 'a_b', 'sub_x.example', '-a', 'a-', 'a..b', '', 'EXAMPLE', U(0x4f8b, 0x3048), 'x.' + U(0x4f8b), 'a'.repeat(63), 'a'.repeat(64), 't', '1', '1.2.3', 'xn--abc', U(0xe9) + 'cole', 'a' + U(0x1f600)],
  ending: ['.com', '.co', '.COM', '.md', '.gov', '.next', '.coma', '.c', '.invalid', '.co.uk', '.' + U(0x440, 0x444), '.xn--p1ai', '.com.', '.com-', '.com+', '.com@', '.com_', ''],
  port: ['', ':80', ':'],
  path: ['', '/', '/a', '/a.', '/a.b', '/a,b', '/a_(b)', '/a(b', '/a)', '/@u/', '/@u', '/' + U(0x3042), '/a!', '/a-', '/a+', '/a~', '/%20', '/a:b', "/a'b", '/a*', '/a;', '/' + U(0x444)],
  query: ['', '?', '?a', '?a=b', '?a=b&', '?a=b.', '?a=(b)', '?a=' + U(0x3042), '#f', '#', '?a#b!'],
  after: ['', '.', ',', '!', '?', ')', ':', ';', '"', "'", U(0x2026), 'x', ' y', '/', '@z', U(0x3002), U(0x202c)],
};

function corpus() {
  const out = [];
  const g = generator(20261003);
  for (let n = 0; n < 500000; n++) {
    let s = '';
    for (let k = 1 + Math.floor(g.next() * (g.next() < 0.2 ? 24 : 9)); k > 0; k--) s += g.pick(FRAGMENTS);
    out.push(s);
  }
  for (let n = 0; n < 300000; n++) {
    let s = '';
    for (let k = 2 + Math.floor(g.next() * (g.next() < 0.15 ? 60 : 14)); k > 0; k--) s += g.pick(DENSE);
    out.push(s);
  }
  const link = () => g.pick(SHAPE.before) + g.pick(SHAPE.protocol) + g.pick(SHAPE.host) + g.pick(SHAPE.ending) + g.pick(SHAPE.port) + g.pick(SHAPE.path) + g.pick(SHAPE.query) + g.pick(SHAPE.after);
  for (let n = 0; n < 600000; n++) out.push(g.next() < 0.25 ? `${link()} ${link()}` : link());
  for (let cp = 0; cp <= 0x1ffff; cp++) out.push(cp >= 0xd800 && cp <= 0xdfff ? String.fromCharCode(cp) : String.fromCodePoint(cp));
  return out;
}
const CORPUS = corpus();
const README = readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const codes = (s) => [...s].map((c) => c.codePointAt(0).toString(16)).join(' ');

/* ========================================================================== */

test('the versions compared against are the ones the README names', () => {
  assert.equal(version('twitter-text'), '3.1.0');
  assert.equal(version('twemoji-parser'), '14.0.0');
  // What npm installs under twitter-text today, with no help from us.
  assert.equal(version('twemoji-parser', path.dirname(require.resolve('twitter-text/package.json'))), '11.0.2');
});

test('src/core.js is exactly what the generator produces from those packages', () => {
  const out = execFileSync(process.execPath, ['tools/build-core.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /in step/);
});

test("THE LINK PATTERNS HAVE THE SAME SOURCE TEXT AS X'S, CHARACTER FOR CHARACTER", () => {
  const theirs = (name) => {
    const mod = require(`twitter-text/dist/regexp/${name}`);
    return mod.default || mod;
  };
  const ours = XCount.patterns();
  assert.equal(ours.link.source, theirs('extractUrl').source);
  assert.equal(ours.asciiDomain.source, theirs('validAsciiDomain').source);
  assert.equal(ours.tco.source, theirs('validTcoUrl').source);
  // One difference, and it is deliberate: X scans with the link pattern ("g");
  // the core tries it one position at a time ("y"), behind a pre-check that the
  // comparison further down proves changes nothing.
  assert.equal(theirs('extractUrl').flags, 'gi');
  assert.equal(ours.link.flags, 'iy');
});

test("the emoji pattern is twemoji-parser 14.0.0's, verbatim", () => {
  const theirs = require('twemoji-parser/dist/lib/regex.js').default;
  // Same pattern; the core writes non-ASCII characters as escapes, so compare with both spelled that way.
  const B = String.fromCharCode(92);
  const spell = (s) =>
    s
      .replace(/[^\x20-\x7e]/g, (c) => `${B}u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
      .replace(new RegExp(`${B}${B}u([0-9a-fA-F]{4})`, 'g'), (m, h) => `${B}u${h.toLowerCase()}`);
  assert.equal(spell(XCount.patterns().emoji.source), spell(theirs.source));
  assert.equal(XCount.patterns().emoji.flags, theirs.flags);
});

test("the walk used below IS twitter-text's own loop", () => {
  // With the table twitter-text ships, the walk must give what parseTweet gives. Everywhere.
  let n = 0;
  for (const s of CORPUS) {
    if (n++ % 3) continue; // a third of the corpus is plenty to pin a 20-line loop
    const a = walk(s, table11);
    const b = twitterText.parseTweet(s).weightedLength;
    if (a !== b) assert.fail(`walk ${a}, parseTweet ${b} for ${JSON.stringify(s)} [${codes(s)}]`);
  }
});

test(`THE SAME COUNT AS X'S LIBRARY ON ${CORPUS.length.toLocaleString('en')} GENERATED STRINGS`, () => {
  let differ = 0;
  const first = [];
  for (const s of CORPUS) {
    const ours = XCount.weightedLength(s);
    const theirs = xCounts(s);
    if (ours !== theirs) {
      differ++;
      if (first.length < 10) first.push(`  ours ${ours}, X's ${theirs}: ${JSON.stringify(s)} [${codes(s)}]`);
    }
  }
  assert.equal(differ, 0, `\n${differ} strings counted differently. The first few:\n${first.join('\n')}\n`);
});

test('THE SAME LINKS AT THE SAME POSITIONS', () => {
  let differ = 0;
  const first = [];
  for (const s of CORPUS) {
    if (s.indexOf('.') === -1) continue; // neither side can find a link without a dot
    const ours = ourLinks(s);
    const theirs = xLinks(s);
    if (ours !== theirs) {
      differ++;
      if (first.length < 10) first.push(`  ours [${ours}], X's [${theirs}]: ${JSON.stringify(s)}`);
    }
  }
  assert.equal(differ, 0, `\n${differ} strings had different links. The first few:\n${first.join('\n')}\n`);
});

test("X'S LIBRARY AGREES WITH EVERY VECTOR, given the last emoji table X published", () => {
  const r = check(xCounts);
  assert.deepEqual(
    r.failures.map((f) => `${f.name}: expected ${f.expected}, X's library says ${f.actual}`),
    [],
  );
  assert.equal(r.total, 71);
  assert.ok(README.includes('| `twitter-text` 3.1.0 with the last emoji table X published | 71 / 71 |'), 'the README row is stale');
});

test('TWITTER-TEXT AS NPM INSTALLS IT FAILS ONE VECTOR: the mechanic, its own issue #369', () => {
  /*
   * The README says this in as many words, so it is pinned. twitter-text 3.1.0
   * depends on twemoji-parser ^11.0.2, whose table is from October 2018 and has
   * never heard of the person-with-wrench sequence added a year later. Everything else
   * in the suite it gets right, which is the point: these vectors and X's
   * library disagree in exactly one place, and that place is a bug filed
   * against X's library itself.
   */
  const r = check((t) => twitterText.parseTweet(t).weightedLength);
  assert.deepEqual(
    r.failures.map((f) => [f.name, f.expected, f.actual]),
    [['emoji-zwj-mechanic', 2, 5]],
  );
  assert.equal(r.passed, 70);
  assert.ok(README.includes('| `twitter-text` 3.1.0, as npm installs it today | 70 / 71 |'), 'the README row is stale');
  // and through the function most people call
  assert.equal(twitterText.getTweetLength(String.fromCodePoint(0x1f9d1, 0x200d, 0x1f527)), 5);
});

test('the public function is the core, with nothing in between', () => {
  for (let i = 0; i < CORPUS.length; i += 997) assert.equal(weightedLength(CORPUS[i]), XCount.weightedLength(CORPUS[i]));
});
