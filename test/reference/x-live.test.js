/**
 * This package against x.com.
 *
 *   npm install
 *   npm run test:reference
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS PROVES
 * ---------------------------------------------------------------------------
 *
 * On 9 October 2026 the composer at x.com/compose/post was asked about the
 * 1,731,072 strings that corpus.js generates. Its own counting functions
 * answered in the page, and the digests of the answers are in
 * tools/x-live.json. This file proves, in order:
 *
 *   1. these are the strings x.com was asked about: the generator's text is
 *      pinned by hash, because the digests mean nothing for any other text;
 *   2. x-live-reference.js, rebuilt from the published packages and four
 *      differences, gives x.com's answers on every one of them;
 *   3. the package gives the reference's answers on every one of them: the
 *      same count, and the same links at the same positions;
 *   4. each of the four differences is real: switch any one off and the
 *      answers stop being x.com's;
 *   5. x.com's rules pass every vector.
 *
 * Together: on input nobody chose, this package counts what x.com counts. The
 * other half, that the four differences are the WHOLE difference from X's
 * published library, is in reference.test.js.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { XCount } from '../../src/core.js';
import { check } from '../../src/conformance.js';
import { makeCorpus } from './corpus.js';
import { LIVE, SOURCES, xcom, counter, sha256 } from './x-live-reference.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const README = readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const PARTS = [0, 1, 2, 3].map((part) => makeCorpus(part));
const codes = (s) => [...s].map((c) => c.codePointAt(0).toString(16)).join(' ');

test('the strings are the ones x.com was asked about', () => {
  assert.equal(sha256(makeCorpus.toString()), LIVE.generator.sha256, 'corpus.js has changed, so the digests recorded from x.com no longer apply to it');
  assert.equal(PARTS.reduce((n, strings) => n + strings.length, 0), LIVE.generator.strings);
});

test("THE REBUILT REFERENCE GIVES x.com'S OWN ANSWERS, digest for digest", () => {
  PARTS.forEach((strings, part) => {
    const got = [];
    for (let i = 0; i < strings.length; i += 50000) {
      const h = createHash('sha256');
      for (let j = i; j < Math.min(i + 50000, strings.length); j++) h.update(xcom.answerLine(strings[j]));
      got.push(h.digest('hex').slice(0, 8));
    }
    assert.deepEqual(got, LIVE.digests[part], `part ${part}: the reference no longer answers as x.com did`);
  });
});

test("THE PACKAGE'S PATTERNS HAVE x.com'S FINGERPRINTS", () => {
  const ours = XCount.patterns();
  for (const [name, key] of [['link', 'link'], ['asciiDomain', 'asciiDomain'], ['tco', 'tco'], ['bareMarkdown', 'bareMarkdown'], ['nonAscii', 'punycodeNonAscii']]) {
    assert.equal(sha256(ours[name].source), LIVE.patterns[key].sha256, `${name} is not the pattern x.com compiles`);
  }
  for (const name of ['asciiDomain', 'tco', 'bareMarkdown', 'nonAscii']) {
    assert.equal(ours[name].flags, LIVE.patterns[name === 'nonAscii' ? 'punycodeNonAscii' : name].flags, `${name} flags`);
  }
  // One difference, and it is deliberate: x.com scans with the link pattern ("gi");
  // the core tries it one position at a time ("iy"), behind a pre-check that the
  // comparison below proves changes nothing.
  assert.equal(LIVE.patterns.link.flags, 'gi');
  assert.equal(ours.link.flags, 'iy');
  // The core writes the emoji pattern's non-ASCII characters as escapes, so compare both spelled that way.
  const B = String.fromCharCode(92);
  const spell = (s) =>
    s
      .replace(/[^\x20-\x7e]/g, (c) => `${B}u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
      .replace(new RegExp(`${B}${B}u([0-9a-fA-F]{4})`, 'g'), (m, h) => `${B}u${h.toLowerCase()}`);
  assert.equal(spell(ours.emoji.source), spell(SOURCES.emoji));
  assert.equal(ours.emoji.flags, LIVE.patterns.emoji.flags);
  assert.deepEqual({ ...XCount.counts }, { gtlds: LIVE.endings.generic.count, cctlds: LIVE.endings.country.count });
});

test(`THE PACKAGE COUNTS WHAT x.com COUNTS, on all ${LIVE.generator.strings.toLocaleString('en')} strings`, () => {
  let differ = 0;
  const first = [];
  for (const strings of PARTS) {
    for (const s of strings) {
      const ours = XCount.weightedLength(s);
      const theirs = xcom.parseTweet(s).weightedLength;
      const ourLinks = XCount.links(s).map((l) => `${l.start}:${l.end}`).join(',');
      const theirLinks = xcom.linkSpans(s);
      if (ours !== theirs || ourLinks !== theirLinks) {
        differ++;
        if (first.length < 10) first.push(`  ours ${ours} [${ourLinks}], x.com ${theirs} [${theirLinks}]: ${JSON.stringify(s)} [${codes(s)}]`);
      }
    }
  }
  assert.equal(differ, 0, `\n${differ} strings counted differently. The first few:\n${first.join('\n')}\n`);
});

test('EACH OF THE FOUR DIFFERENCES IS REAL: switch any one off and the answers stop being x.com\'s', () => {
  const OFF = { endings: { endings: false }, invalid: { invalid: false }, markdown: { markdown: false }, emoji: { emoji: '2022' } };
  for (const [name, change] of Object.entries(OFF)) {
    const without = counter(change);
    let found = null;
    search: for (const strings of PARTS) {
      for (const s of strings) {
        if (without.answerLine(s) !== xcom.answerLine(s)) {
          found = s;
          break search;
        }
      }
    }
    assert.ok(found !== null, `switching off "${name}" changed no answer, so it is not a difference at all`);
  }
});

test("x.com'S RULES PASS EVERY VECTOR", () => {
  const r = check((t) => xcom.parseTweet(t).weightedLength);
  assert.deepEqual(
    r.failures.map((f) => `${f.name}: expected ${f.expected}, x.com's rules say ${f.actual}`),
    [],
  );
  assert.equal(r.total, 74);
  assert.ok(README.includes("| x.com's composer, read on 9 October 2026 | 74 / 74 |"), 'the README row for x.com is stale');
});
