/**
 * X's own test cases, run against this package.
 *
 * ---------------------------------------------------------------------------
 * WHY THESE ARE HERE WHEN THE PACKAGE HAS ITS OWN VECTORS
 * ---------------------------------------------------------------------------
 *
 * The 71 vectors in vectors/ were written by the same person who wrote the
 * counter, so they share that person's blind spots. For weeks they shared one
 * in particular: every one of the first 49 passed against a counter that took a
 * sentence's full stop into the link before it, charged an email address 23 for
 * its domain, and had never heard of `.gov`. Vectors you wrote yourself cannot
 * tell you about a rule you do not know exists.
 *
 * twitter-text ships a conformance suite written by the people who wrote the
 * rules. `test/fixtures/twitter-text-conformance.json` is the part of it that
 * concerns this package: the weighted-length cases for the current
 * configuration, and every link-extraction case including one per domain
 * ending. 1,706 cases, converted from YAML to JSON and otherwise untouched
 * (Apache-2.0, Copyright Twitter, Inc.; see NOTICE).
 *
 * If one of these fails, this package is wrong. There is no second reading.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { weightedLength, findLinks, explain, DOMAIN_ENDINGS } from '../src/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OFFICIAL = JSON.parse(readFileSync(path.join(HERE, 'fixtures', 'twitter-text-conformance.json'), 'utf8'));

const show = (s) => JSON.stringify(s.length > 80 ? `${s.slice(0, 80)}...` : s);

function run(cases, got) {
  const failures = [];
  for (const c of cases) {
    const actual = got(c);
    if (JSON.stringify(actual) !== JSON.stringify(c.expected)) {
      failures.push(`${c.description}\n    text     ${show(c.text)}\n    expected ${JSON.stringify(c.expected)}\n    got      ${JSON.stringify(actual)}`);
    }
  }
  assert.deepEqual(failures, [], `\n${failures.length} of ${cases.length} failed:\n\n${failures.slice(0, 20).join('\n\n')}\n`);
}

test('the fixture is the size it was when it was taken, so a truncated copy cannot pass quietly', () => {
  const sizes = Object.fromEntries(Object.entries(OFFICIAL).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length]));
  // The README states the total, so the total is checked against the README too.
  const total = Object.values(sizes).reduce((a, b) => a + b, 0);
  assert.equal(total, 1706);
  assert.ok(readFileSync(path.join(HERE, '..', 'README.md'), 'utf8').includes('1,706 cases'), 'the README no longer states the number of official cases');
  assert.deepEqual(sizes, {
    weighted: 22,
    directional: 2,
    urls: 91,
    urls_with_indices: 10,
    urls_with_directional_markers: 2,
    tco_urls_with_params: 5,
    tlds_country: 315,
    tlds_generic: 1259,
  });
});

test("WEIGHTED LENGTH: every case in twitter-text's own suite for the current configuration", () => {
  // validate.yml, WeightedTweetsWithDiscountedEmojiCounterTest: config v3, where an emoji is one unit.
  run(OFFICIAL.weighted, (c) => weightedLength(c.text));
});

test('weighted length around directional marks', () => {
  run(OFFICIAL.directional, (c) => weightedLength(c.text));
});

test("LINKS: every extraction case in twitter-text's own suite", () => {
  run(OFFICIAL.urls, (c) => findLinks(c.text).map((l) => l.text));
});

test('links, with their positions', () => {
  // The suite states positions in code points; findLinks gives UTF-16 offsets into the NFC text.
  const inCodePoints = (s, i) => Array.from(s.slice(0, i)).length;
  const withIndices = (c) => {
    const s = c.text.normalize('NFC');
    return findLinks(c.text).map((l) => ({ url: l.text, indices: [inCodePoints(s, l.index), inCodePoints(s, l.index + l.text.length)] }));
  };
  run(OFFICIAL.urls_with_indices, withIndices);
  run(OFFICIAL.urls_with_directional_markers, withIndices);
});

test('t.co links end at their slug', () => {
  run(OFFICIAL.tco_urls_with_params, (c) => findLinks(c.text).map((l) => l.text));
});

test('EVERY DOMAIN ENDING IN THE LIST IS RECOGNISED: one case each, country and generic', () => {
  run(OFFICIAL.tlds_country, (c) => findLinks(c.text).map((l) => l.text));
  run(OFFICIAL.tlds_generic, (c) => findLinks(c.text).map((l) => l.text));
  // and the list in the core is the same length as the list the suite walks
  assert.deepEqual({ ...DOMAIN_ENDINGS }, { generic: OFFICIAL.tlds_generic.length, country: OFFICIAL.tlds_country.length });
});

test('explain() accounts for every unit: its pieces rebuild the text and add up to the count', () => {
  const texts = OFFICIAL.weighted.map((c) => c.text).concat(OFFICIAL.urls.map((c) => c.text));
  for (const text of texts) {
    const pieces = explain(text);
    assert.equal(pieces.map((p) => p.text).join(''), text.normalize('NFC'), show(text));
    assert.equal(pieces.reduce((n, p) => n + p.weight, 0), weightedLength(text), show(text));
    for (const p of pieces) {
      assert.ok(['link', 'emoji', 'char'].includes(p.kind));
      if (p.kind === 'link') assert.equal(p.weight, 23);
      if (p.kind === 'emoji') assert.equal(p.weight, 2);
    }
  }
});
