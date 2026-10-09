/**
 * Where x.com and the library X published disagree, case by case.
 *
 * X publishes twitter-text and its emoji table as the way to count a post, and
 * x.com's composer runs something slightly different. Four differences, read
 * from the code x.com served on 9 October 2026 and listed in tools/x-live.json:
 *
 *   1. seven domain endings the published list does not have;
 *   2. U+FEFF is no longer an invalid character;
 *   3. a bare domain ending in .md is not a link;
 *   4. a newer emoji table, Emoji 15.0, with one entry moved.
 *
 * Every expected value below is x.com's own answer. The strings were run
 * through the composer's counting functions in the page, and the reference
 * suite (test/reference/) checks the same rules on 1.7 million more. This file
 * needs nothing installed, so `npm test` keeps them pinned everywhere.
 *
 * And one correction to this package rather than a difference in x.com:
 * control characters in a domain are measured as ASCII, as x.com's punycode
 * and Node's do. The first version encoded them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { weightedLength, findLinks } from '../src/index.js';

const U = (...codes) => String.fromCodePoint(...codes);
const C = (...codes) => String.fromCharCode(...codes);
const links = (text) => findLinks(text).map((l) => l.text);

test('1. SEVEN ENDINGS x.com KNOWS AND THE PUBLISHED LIST DOES NOT, in the suite\'s own shape', () => {
  for (const ending of ['amazon', 'kids', 'music', 'spa', U(0x30a2, 0x30de, 0x30be, 0x30f3), U(0x4e9a, 0x9a6c, 0x900a), U(0x5d9, 0x5e9, 0x5e8, 0x5d0, 0x5dc)]) {
    const text = `https://twitter.${ending}`;
    assert.deepEqual(links(text), [text], `${ending} is a valid ending on x.com`);
    assert.equal(weightedLength(text), 23);
  }
  // and without a protocol, where the published list makes them plain text
  for (const text of ['twitter.music', 'twitter.kids', 'twitter.SPA', 'twitter.' + U(0x4e9a, 0x9a6c, 0x900a), 'twitter.' + U(0x5d9, 0x5e9, 0x5e8, 0x5d0, 0x5dc)]) {
    assert.deepEqual(links(text), [text]);
    assert.equal(weightedLength(text), 23, text);
  }
});

test('2. U+FEFF MAY STAND BEFORE A LINK AND INSIDE A DOMAIN', () => {
  const bom = C(0xfeff);
  // Before a bare domain: 2 for the mark and 23 for the link. The published rule makes it 13.
  assert.deepEqual(links(bom + 'example.com'), ['example.com']);
  assert.equal(weightedLength(bom + 'example.com'), 25);
  // Inside a bare domain, only the ASCII part after it is linked: 3 + 2 + 23.
  assert.deepEqual(links('exa' + bom + 'mple.com'), ['mple.com']);
  assert.equal(weightedLength('exa' + bom + 'mple.com'), 28);
  // With a protocol the whole thing is one link.
  assert.deepEqual(links('https://exa' + bom + 'mple.com'), ['https://exa' + bom + 'mple.com']);
  assert.equal(weightedLength('https://exa' + bom + 'mple.com'), 23);
});

test('3. A BARE DOMAIN ENDING IN .md IS A FILE NAME, NOT A LINK', () => {
  const plain = {
    'README.md': 9,
    'README.MD': 9,
    'I updated README.md': 19,
    'www.example.md': 14,
    'example.md/path': 15,
    'see notes.md.': 13,
  };
  for (const [text, cost] of Object.entries(plain)) {
    assert.deepEqual(links(text), [], `${text} must not be a link`);
    assert.equal(weightedLength(text), cost, text);
  }
  // A protocol makes it a link again, and .md in the middle of a domain is just a label.
  for (const text of ['https://README.md', 'http://example.md/x', 'example.md.com']) {
    assert.deepEqual(links(text), [text]);
    assert.equal(weightedLength(text), 23, text);
  }
});

test('4. THE EMOJI TABLE IS NEWER THAN THE LAST ONE X PUBLISHED, AND NO NEWER THAN EMOJI 15.0', () => {
  const cases = [
    [U(0x1f426, 0x200d, 0x2b1b), 2, 'black bird, Emoji 15.0: one emoji (the 2022 table: 5)'],
    [U(0x1faf8, 0x1f3fd), 2, 'rightwards pushing hand with a skin tone, Emoji 15.0 (the 2022 table: 4)'],
    [U(0x1faf0, 0x1f3fd), 2, 'crossed fingers with a skin tone'],
    [U(0x1faf0, 0xfe0f), 4, 'crossed fingers with U+FE0F: x.com charges the selector too, where @twemoji/parser 15.0.0 would not'],
    [U(0x1f426, 0x200d, 0x1f525), 5, 'phoenix, Emoji 15.1: unknown to x.com, so 2 + 1 + 2'],
    [U(0x1f1e8, 0x1f1f6), 4, 'the flag of Sark, Emoji 16.0: unknown to x.com, so two letters at 2'],
  ];
  for (const [text, cost, why] of cases) assert.equal(weightedLength(text), cost, why);
});

test('AND ONE CORRECTION: a control character in a domain is measured as ASCII', () => {
  // 62 letters and a control character make a 63-character label, which is the most a label may have.
  for (const control of [C(1), C(127)]) {
    const text = 'https://' + 'a'.repeat(62) + control + '.com';
    assert.deepEqual(links(text), [text]);
    assert.equal(weightedLength(text), 23);
  }
  // One more letter and the label is 64: no link, 76 ordinary characters.
  const long = 'https://' + 'a'.repeat(63) + C(1) + '.com';
  assert.deepEqual(links(long), []);
  assert.equal(weightedLength(long), 76);
});
