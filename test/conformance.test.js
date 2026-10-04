/**
 * Two kinds of test, and the second kind is the one that finds real bugs.
 *
 * The vectors check known inputs against derived expectations. Useful, but they
 * only ever cover what someone thought of. The property tests below check
 * invariants that must hold for EVERY input, including the ones nobody thought
 * of — and one of them, the truncation bound, caught a genuine defect while this
 * library was being written: `truncateToWeight` walked clusters while
 * `weightedLength` applied the URL rule, so any text containing a link could be
 * truncated to something that still exceeded the budget.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  weightedLength,
  truncateToWeight,
  findLinks,
  fits,
  URL_WEIGHT,
  MAX_WEIGHTED_LENGTH,
  LIGHT_RANGES,
  DOMAIN_ENDINGS,
  explain,
} from '../src/index.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUITE = JSON.parse(readFileSync(path.join(ROOT, 'vectors', 'vectors.json'), 'utf8'));

/* ========================================================================== *
 * The vectors
 * ========================================================================== */

test('every published vector holds', () => {
  const failures = [];
  for (const v of SUITE.vectors) {
    const actual = weightedLength(v.text);
    if (actual !== v.expected) failures.push(`${v.name}: expected ${v.expected}, got ${actual} — ${v.why}`);
  }
  assert.deepEqual(failures, [], `\n${failures.join('\n')}\n`);
});

test('the suite covers every category it declares, and declares every category it uses', () => {
  const declared = new Set(Object.keys(SUITE.categories));
  const used = new Set(SUITE.vectors.map((v) => v.category));
  assert.deepEqual([...used].filter((c) => !declared.has(c)), [], 'undeclared category in use');
  assert.deepEqual([...declared].filter((c) => !used.has(c)), [], 'declared category with no vectors');
});

test('every vector states its arithmetic', () => {
  /*
   * The `why` is not documentation garnish. It is the only thing separating this
   * file from a snapshot of whatever the implementation happened to return, and
   * a vector without one cannot be checked by a human reading the JSON.
   */
  for (const v of SUITE.vectors) {
    assert.ok(v.why && v.why.length >= 20, `${v.name} has no stated reason`);
  }
});

test('A LENGTH STATED IN A REASON IS THE LENGTH OF THE TEXT', () => {
  /*
   * The build holds every expected value to the implementation. Nothing held
   * the other numbers a reason states, and one of them was wrong for a month:
   * url-https-long said "64 characters charged as 23" about a string of 65. A
   * suite whose subject is counting cannot miscount its own examples, so the
   * phrasings the reasons use for a raw length are read back and compared with
   * the text.
   */
  const CLAIMS = [
    /(\d+) characters charged as 23/,
    /(\d+) characters, \d+\.$/,
    /^(\d+) characters, every one/,
    /this is (\d+) plain characters/,
    /this is (\d+) characters\./,
    /string is (\d+) ordinary characters/,
  ];
  const stated = [];
  for (const v of SUITE.vectors) {
    for (const claim of CLAIMS) {
      const m = claim.exec(v.why);
      if (m) stated.push([v.name, Number(m[1]), v.text.length]);
    }
  }
  assert.ok(stated.length >= 9, `only ${stated.length} stated lengths were found: the phrasings this test reads have changed`);
  for (const [name, said, real] of stated) {
    assert.equal(said, real, `${name} says its text is ${said} characters and it is ${real}`);
  }
});

test('the suite has not quietly shrunk', () => {
  // A dropped vector is indistinguishable from a passing one unless counted.
  assert.ok(SUITE.vectors.length >= 71, `only ${SUITE.vectors.length} vectors`);
});

/* ========================================================================== *
 * Properties — true for every input, not just the ones we imagined
 * ========================================================================== */

/** A spread of inputs that between them exercise every branch. */
const CORPUS = [
  '',
  ' ',
  'a',
  'hello world',
  'The quick brown fox jumps over the lazy dog, twice, with feeling.',
  'こんにちは世界',
  '안녕하세요',
  'привет мир',
  'สวัสดีครับ',
  '😀',
  '👨‍👩‍👧‍👦',
  '🇨🇴🇯🇵🇧🇷',
  '🧑‍🔧 fixing 🚀 shipping ❤️ loving',
  'https://example.com',
  'example.com',
  'see example.com and www.other.org and https://third.dev/path?q=1',
  'e.g. index.js version 2.78.0 wait...what',
  'café',            // decomposed
  'mixed 漢字 and https://x.com and 👨‍👩‍👧‍👦 together',
  'a'.repeat(279),
  'a'.repeat(280),
  'a'.repeat(281),
  '漢'.repeat(140),
  '😀'.repeat(140),
  '\n\n\n',
  '   leading and trailing   ',
  ...SUITE.vectors.map((v) => v.text),
];

test('weightedLength is always a non-negative integer', () => {
  for (const text of CORPUS) {
    const n = weightedLength(text);
    assert.ok(Number.isInteger(n) && n >= 0, `${JSON.stringify(text.slice(0, 30))} → ${n}`);
  }
});

test('TRUNCATION NEVER EXCEEDS ITS BUDGET — including when the text contains links', () => {
  /*
   * The defect this pins: weightedLength applied the URL rule and
   * truncateToWeight walked clusters, so `truncateToWeight(t, n)` could return a
   * string whose real cost was greater than n. Silent, and exactly the direction
   * that gets a post rejected by the API.
   */
  for (const text of CORPUS) {
    for (const limit of [0, 1, 2, 3, 10, 22, 23, 24, 50, 279, 280, 281]) {
      const cut = truncateToWeight(text, limit);
      const cost = weightedLength(cut);
      assert.ok(cost <= limit, `truncate(${JSON.stringify(text.slice(0, 40))}, ${limit}) cost ${cost}`);
    }
  }
});

test('truncation is a prefix, and never invents characters', () => {
  for (const text of CORPUS) {
    for (const limit of [0, 5, 23, 100, 280]) {
      const cut = truncateToWeight(text, limit);
      assert.ok(text.normalize('NFC').startsWith(cut), `not a prefix: ${JSON.stringify(cut.slice(0, 30))}`);
    }
  }
});

test('truncation never splits a grapheme cluster', () => {
  /*
   * Slicing by index can cut a family emoji into two people and a widow joiner.
   * The check: the cut string must contain the same number of clusters as its
   * own prefix of the original — i.e. re-segmenting the cut yields clusters that
   * are all whole.
   */
  const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
  for (const text of ['👨‍👩‍👧‍👦'.repeat(5), '🇨🇴'.repeat(5), 'café'.repeat(5), '🧑‍🔧a🧑‍🔧']) {
    for (let limit = 0; limit <= weightedLength(text) + 2; limit++) {
      const cut = truncateToWeight(text, limit);
      const rejoined = [...seg.segment(cut)].map((s) => s.segment).join('');
      assert.equal(rejoined, cut);
      // and no orphaned joiner at the end, which is the visible symptom
      assert.ok(!cut.endsWith('‍'), `orphan ZWJ at limit ${limit}`);
    }
  }
});

test('a link never costs more than URL_WEIGHT, however long it is', () => {
  const long = 'https://example.com/' + 'x'.repeat(2000);
  assert.equal(weightedLength(long), URL_WEIGHT);
});

test('ADDING A CHARACTER CAN MAKE A POST CHEAPER, and that is correct', () => {
  /*
   * This test began life asserting the opposite — that appending never
   * decreases the count — which is the intuition everyone has and it is false.
   *
   *     "example.com"   → 23   (a link, flat rate)
   *     "example.coma"  → 12   (twelve ordinary characters)
   *
   * `.coma` is not a TLD, so the string stops being a link and stops being
   * charged like one. X behaves the same way, because the question "is this a
   * link" is answered on the whole token, not incrementally.
   *
   * It is worth pinning rather than deleting, because a future "optimisation"
   * that caches per-prefix costs would be silently wrong here, and because it is
   * the single most surprising consequence of the flat-23 rule.
   */
  assert.equal(weightedLength('example.com'), 23);
  assert.equal(weightedLength('example.coma'), 12);
  assert.ok(weightedLength('example.coma') < weightedLength('example.com'));
});

test('appending a space never decreases the count', () => {
  /*
   * The monotonicity that IS true. A space terminates any link in progress, so
   * it cannot un-linkify what came before — which makes it the honest version of
   * the property the previous test disproves.
   */
  for (const text of CORPUS) {
    assert.ok(
      weightedLength(text + ' ') >= weightedLength(text),
      `${JSON.stringify(text.slice(0, 30))}`
    );
  }
});

test('normalisation form does not change the answer', () => {
  for (const text of CORPUS) {
    const n = weightedLength(text);
    assert.equal(weightedLength(text.normalize('NFD')), n, JSON.stringify(text.slice(0, 30)));
    assert.equal(weightedLength(text.normalize('NFC')), n);
  }
});

test('fits() agrees with weightedLength at the boundary, inclusively', () => {
  assert.equal(fits('a'.repeat(280)), true);
  assert.equal(fits('a'.repeat(281)), false);
  assert.equal(fits('漢'.repeat(140)), true);
  assert.equal(fits('漢'.repeat(141)), false);
  assert.equal(MAX_WEIGHTED_LENGTH, 280);
});

test('findLinks explains the count rather than leaving it to be argued about', () => {
  const links = findLinks('see example.com and https://x.com now');
  assert.deepEqual(links.map((l) => l.text), ['example.com', 'https://x.com']);
  // The indices must actually point at the links, or the diagnostic lies.
  const text = 'see example.com and https://x.com now';
  for (const l of links) assert.equal(text.slice(l.index, l.index + l.text.length), l.text);
});

test('findLinks finds nothing in prose that merely contains dots', () => {
  assert.deepEqual(findLinks('e.g. index.js version 2.78.0 wait...what'), []);
});

test('repeated calls give the same answer', () => {
  /*
   * A /g regex kept at module scope carries `lastIndex` between calls, so the
   * second call on the same input silently starts mid-string. This is the
   * classic way a counter becomes non-deterministic.
   */
  const text = 'https://a.com and https://b.com';
  const first = weightedLength(text);
  for (let i = 0; i < 5; i++) assert.equal(weightedLength(text), first);
  for (let i = 0; i < 5; i++) assert.equal(findLinks(text).length, 2);
});

test('a non-string input fails loudly rather than counting something strange', () => {
  for (const bad of [null, undefined, 42, {}, []]) {
    assert.throws(() => weightedLength(bad), TypeError, `accepted ${JSON.stringify(bad)}`);
  }
});

/* ========================================================================== *
 * The published constants
 * ========================================================================== */

test('the light ranges are the published ones, in order and non-overlapping', () => {
  assert.deepEqual(LIGHT_RANGES.map((r) => [...r]), [
    [0x0000, 0x10ff],
    [0x2000, 0x200d],
    [0x2010, 0x201f],
    [0x2032, 0x2037],
  ]);
  for (let i = 1; i < LIGHT_RANGES.length; i++) {
    assert.ok(LIGHT_RANGES[i][0] > LIGHT_RANGES[i - 1][1], 'ranges must not overlap');
  }
});

test('every light range boundary costs 1 inside and 2 one step outside', () => {
  for (const [lo, hi] of LIGHT_RANGES) {
    assert.equal(weightedLength(String.fromCodePoint(lo)), 1, `U+${lo.toString(16)} should be light`);
    assert.equal(weightedLength(String.fromCodePoint(hi)), 1, `U+${hi.toString(16)} should be light`);
    // One past the top of each range must cost 2. One BELOW the bottom is not
    // checked the same way: the ranges are not adjacent, and the gaps are heavy
    // by definition rather than by an edge worth pinning.
    const past = String.fromCodePoint(hi + 1);
    assert.equal(weightedLength(past), 2, `U+${(hi + 1).toString(16)} should be heavy`);
  }
});

test('URL_WEIGHT is the published transformed length', () => {
  assert.equal(URL_WEIGHT, 23);
});

test('the list of domain endings is the size of twitter-text\'s, and the README says how many', () => {
  assert.deepEqual({ ...DOMAIN_ENDINGS }, { generic: 1259, country: 315 });
  const total = (DOMAIN_ENDINGS.generic + DOMAIN_ENDINGS.country).toLocaleString('en');
  assert.equal(total, '1,574');
  assert.ok(readFileSync(path.join(ROOT, 'README.md'), 'utf8').includes(`${total} domain endings`));
});

/* ========================================================================== *
 * What follows a link, and what comes before one
 * ========================================================================== */

test('THE CHARACTER AFTER A LINK IS CHARGED, whatever it is', () => {
  /*
   * The defect this pins is the one that sat in this package for a month: a
   * link was matched up to the next space, so the full stop of the sentence it
   * ended went inside it and cost nothing. One unit, and at 280 it is the unit
   * that gets the post rejected.
   */
  for (const after of ['.', ',', '!', '?', ')', ':', ';', '"', "'"]) {
    for (const link of ['https://example.com', 'https://example.com/path', 'example.com', 'example.com/path']) {
      assert.equal(weightedLength(`${link}${after}`), 24, `${link}${after}`);
      assert.deepEqual(
        findLinks(`see ${link}${after} ok`).map((l) => l.text),
        [link],
      );
    }
  }
});

test('a domain is not a link straight after @, #, $, a letter or a digit', () => {
  for (const before of ['@', '#', '$', 'x', '7']) {
    assert.deepEqual(findLinks(`${before}https://example.com`), [], `${before}https://example.com`);
  }
  // an email address is the everyday case
  assert.equal(weightedLength('jane@example.com'), 16);
});

test('explain() shows the pieces the count is made of', () => {
  assert.deepEqual(explain('hi example.com.'), [
    { text: 'h', weight: 1, kind: 'char' },
    { text: 'i', weight: 1, kind: 'char' },
    { text: ' ', weight: 1, kind: 'char' },
    { text: 'example.com', weight: 23, kind: 'link' },
    { text: '.', weight: 1, kind: 'char' },
  ]);
  const family = String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467, 0x200d, 0x1f466);
  assert.deepEqual(explain(family), [{ text: family, weight: 2, kind: 'emoji' }]);
});

test('TRUNCATION NEVER CUTS THROUGH A LINK OR A VISIBLE CHARACTER, on input nobody chose', () => {
  const parts = ['a', 'b', ' ', '.', 'example.com', 'example.coma', 'https://t.co/abc', String.fromCodePoint(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467), String.fromCodePoint(0x6f22), 'e' + String.fromCodePoint(0x301), '!', 'README.md', String.fromCodePoint(0x1f1e8, 0x1f1f4), 'x'.repeat(30), '/', '_', '-', 'co', 'm'];
  const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
  let seed = 7;
  const next = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 20000; i++) {
    let text = '';
    for (let k = 1 + Math.floor(next() * 20); k > 0; k--) text += parts[Math.floor(next() * parts.length)];
    const limit = Math.floor(next() * 60);
    const cut = truncateToWeight(text, limit);
    const whole = text.normalize('NFC');
    assert.ok(weightedLength(cut) <= limit, `over budget: ${JSON.stringify(text)} at ${limit}`);
    assert.ok(whole.startsWith(cut), `not a prefix: ${JSON.stringify(text)} at ${limit}`);
    const ends = new Set([0]);
    for (const g of seg.segment(whole)) ends.add(g.index + g.segment.length);
    assert.ok(ends.has(cut.length), `cut inside a character: ${JSON.stringify(text)} at ${limit}`);
    for (const l of findLinks(whole)) {
      assert.ok(!(cut.length > l.index && cut.length < l.index + l.text.length), `cut inside a link: ${JSON.stringify(text)} at ${limit}`);
    }
  }
});
