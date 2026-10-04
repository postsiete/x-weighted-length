/**
 * Build vectors/vectors.json.
 *
 *   node vectors/build.js
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS RATHER THAN A HAND-WRITTEN JSON
 * ---------------------------------------------------------------------------
 *
 * A conformance suite whose expected values were produced by running the
 * implementation it tests is not a suite, it is a snapshot with ambitions. It
 * would pass forever, including on the day the implementation became wrong.
 *
 * So every expectation below is written as ARITHMETIC, in the `why` field,
 * derived from the published rules — the weight ranges, the flat 23, where a
 * link starts and stops, the one-emoji-one-unit rule. The build then checks
 * this package's implementation against those numbers and REFUSES TO WRITE THE
 * FILE if they disagree. The expected value and the code that computes it come
 * from different places, and the build is where they have to meet.
 *
 * A second check lives in test/reference/reference.test.js: X's own library (twitter-text
 * with the last emoji table it published) must agree with every vector too. A
 * vector that this package passes and X's library fails is a mistake in the
 * vector, however good its arithmetic reads.
 *
 * When they disagree, exactly one of two things is true and the message says so:
 * either the implementation has a bug, or the stated arithmetic does. Both are
 * worth stopping for.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { weightedLength } from '../src/index.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/**
 * @typedef {object} Vector
 * @property {string} name       stable id, safe to reference in a bug report
 * @property {string} text       the input
 * @property {number} expected   weighted length
 * @property {string} category   see CATEGORIES below
 * @property {string} why        the arithmetic, in words
 */

const CATEGORIES = {
  basic: 'Plain text in the light ranges. If these fail, nothing else matters.',
  heavy:
    'Characters outside the light ranges, which cost 2. CJK is the common case and the reason a 200-character Japanese post does not fit.',
  emoji:
    'The one-emoji-one-unit rule: an emoji in X\'s table costs 2 however many code points build it. Weighting the code points one at a time is too high on every emoji built from more than one.',
  url: 'The flat 23, and where X finds a link: with or without a protocol, on any of the 1,574 endings in its list, stopping before the punctuation that ends a sentence.',
  'not-a-url':
    'Text that must NOT be charged 23: an email address, an ending that is not one, a domain glued to a "#". A spurious 23 sends an author rewriting copy that already fitted.',
  normalisation: 'The same visible string must cost the same however it was encoded.',
  boundary: 'The exact edges of the published ranges. Off-by-one lives here.',
  structural: 'Empty strings, whitespace, and the degenerate inputs that produce a crash rather than a wrong number.',
};

/** @type {Vector[]} */
const VECTORS = [
  // ---------------------------------------------------------------- basic
  { name: 'empty', text: '', expected: 0, category: 'structural', why: 'Nothing costs nothing.' },
  { name: 'single-space', text: ' ', expected: 1, category: 'structural', why: 'U+0020 is inside 0x0000–0x10FF, so 1.' },
  { name: 'ascii-hello', text: 'hello', expected: 5, category: 'basic', why: 'Five Latin letters, all weight 1.' },
  {
    name: 'ascii-sentence',
    text: 'The quick brown fox jumps over the lazy dog.',
    expected: 44,
    category: 'basic',
    why: '44 characters, every one inside the first light range.',
  },
  {
    name: 'newlines-count',
    text: 'one\ntwo\nthree',
    expected: 13,
    category: 'basic',
    why: 'Line feeds are U+000A — inside the light range, and they are charged, not ignored.',
  },
  {
    name: 'latin-accents-precomposed',
    text: 'café',
    expected: 4,
    category: 'basic',
    why: 'U+00E9 is a single code point below 0x1100, so 1 like the rest.',
  },
  {
    name: 'cyrillic',
    text: 'привет',
    expected: 6,
    category: 'basic',
    why: 'Cyrillic sits at U+0400–U+04FF, inside the first light range. Weight 1, which surprises people who assume "non-Latin means 2".',
  },
  {
    name: 'hebrew',
    text: 'שלום',
    expected: 4,
    category: 'basic',
    why: 'U+05D0–U+05EA, inside the first light range.',
  },
  {
    name: 'thai',
    text: 'สวัสดี',
    expected: 6,
    category: 'basic',
    why: 'Thai is U+0E00–U+0E7F, inside the light range. Six code points, six units — note this is more than the four grapheme clusters a reader sees.',
  },

  // ---------------------------------------------------------------- heavy
  {
    name: 'japanese',
    text: 'こんにちは',
    expected: 10,
    category: 'heavy',
    why: 'Five kana at U+3053 upward, all above 0x10FF, so 2 each.',
  },
  {
    name: 'chinese',
    text: '你好世界',
    expected: 8,
    category: 'heavy',
    why: 'Four CJK ideographs, 2 each.',
  },
  {
    name: 'korean',
    text: '안녕하세요',
    expected: 10,
    category: 'heavy',
    why: 'Five precomposed Hangul syllables at U+AC00 upward, 2 each.',
  },
  {
    name: 'mixed-latin-cjk',
    text: 'hello こんにちは',
    expected: 16,
    category: 'heavy',
    why: '5 Latin (5) + 1 space (1) + 5 kana at 2 (10) = 16.',
  },

  // ---------------------------------------------------------------- emoji
  {
    name: 'emoji-simple',
    text: '😀',
    expected: 2,
    category: 'emoji',
    why: 'One emoji, weight 2. Also the case everyone already passes.',
  },
  {
    name: 'emoji-with-variation-selector',
    text: '❤️',
    expected: 2,
    category: 'emoji',
    why: 'U+2764 plus U+FE0F. Two code points, ONE emoji, so 2. Weighted one code point at a time it is 2 + 2 = 4.',
  },
  {
    name: 'emoji-skin-tone',
    text: '👍🏽',
    expected: 2,
    category: 'emoji',
    why: 'Thumbs up plus a skin-tone modifier is one emoji at 2, not two emoji at 4.',
  },
  {
    name: 'emoji-flag',
    text: '🇨🇴',
    expected: 2,
    category: 'emoji',
    why: 'Two regional indicators forming one flag: 2, not 4. A per-code-point counter reports 4.',
  },
  {
    name: 'emoji-zwj-mechanic',
    text: '🧑‍🔧',
    expected: 2,
    category: 'emoji',
    why: 'Person + ZWJ + wrench = one emoji at 2. Per code point it is 200+100+200 = 5 after dividing by scale, and 5 is the number reported in twitter-text#369.',
  },
  {
    name: 'emoji-zwj-family',
    text: '👨‍👩‍👧‍👦',
    expected: 2,
    category: 'emoji',
    why: 'Four people joined by three ZWJs — seven code points, one emoji, 2. Per code point it is (200*4 + 100*3)/100 = 11. If you get 11, you fell through to the per-code-point path. If you get 7, you counted code points and forgot the weights. If you get 11 in Python, `len()` gave you 7 and something else went wrong too.',
  },
  {
    name: 'emoji-two-adjacent',
    text: '😀😀',
    expected: 4,
    category: 'emoji',
    why: 'Two separate emoji, 2 each. Guards against a cluster walker that swallows neighbours.',
  },
  {
    name: 'emoji-in-prose',
    text: 'ship it 🚀',
    expected: 10,
    category: 'emoji',
    why: '"ship it " is 8 at weight 1, plus one emoji at 2.',
  },
  {
    name: 'emoji-keycap',
    text: '1️⃣',
    expected: 2,
    category: 'emoji',
    why: 'Digit + U+FE0F + U+20E3 is one keycap emoji at 2, not three units.',
  },
  {
    name: 'emoji-keycap-without-selector',
    text: '1' + String.fromCodePoint(0x20e3),
    expected: 2,
    category: 'emoji',
    why: 'Digit + U+20E3 with no U+FE0F between them is still the keycap emoji at 2. Counted apart they are 1 + 2 = 3.',
  },
  {
    name: 'emoji-joined-but-not-a-sequence',
    text: String.fromCodePoint(0x1f600, 0x200d, 0x1f600),
    expected: 5,
    category: 'emoji',
    why: 'A joiner between two emoji that do not form a known sequence joins nothing: 2 + 1 + 2 = 5. One unit at 2 is only for sequences in the emoji table.',
  },

  // ---------------------------------------------------------------- url
  {
    name: 'url-https-short',
    text: 'https://x.com',
    expected: 23,
    category: 'url',
    why: 'Flat 23 regardless of length — 13 characters charged as 23. Links can cost MORE than they are long.',
  },
  {
    name: 'url-https-long',
    text: 'https://example.com/a/very/long/path?with=query&and=more#fragment',
    expected: 23,
    category: 'url',
    why: 'Same flat 23. 65 characters charged as 23.',
  },
  {
    name: 'url-www-no-scheme',
    text: 'www.example.com',
    expected: 23,
    category: 'url',
    why: 'A www. host with no scheme is still linkified.',
  },
  {
    name: 'url-bare-domain',
    text: 'example.com',
    expected: 23,
    category: 'url',
    why: 'THE ONE THAT UNDERCOUNTS. No scheme, no www., still a link, still 23. A matcher requiring http(s):// or www. reports 11 and tells the author a post fits that the API will reject.',
  },
  {
    name: 'url-bare-domain-with-path',
    text: 'example.com/pricing',
    expected: 23,
    category: 'url',
    why: 'The path is part of the link, so still one 23 rather than 23 plus the path.',
  },
  {
    name: 'url-in-prose',
    text: 'read this: https://example.com now',
    expected: 38,
    category: 'url',
    why: '"read this: " is 11 characters at weight 1, the link is a flat 23, and " now" is 4. 11 + 23 + 4 = 38. The text either side of a link must keep its own weighting.',
  },
  {
    name: 'url-two-links',
    text: 'https://a.com https://b.com',
    expected: 47,
    category: 'url',
    why: '23 + 1 space + 23 = 47.',
  },
  {
    name: 'url-adjacent-to-cjk',
    text: 'こんにちは https://example.com',
    expected: 34,
    category: 'url',
    why: '5 kana at 2 (10) + 1 space + 23 = 34. Checks that the link split does not lose the weighting of the text around it.',
  },
  {
    name: 'url-then-full-stop',
    text: 'Read more: https://example.com/post.',
    expected: 35,
    category: 'url',
    why: '"Read more: " is 11, the link is a flat 23, and the full stop is 1: 35. A path may not END on a full stop, so the stop belongs to the sentence. A matcher that runs to the next space takes it into the link and reports 34: one short, whenever a sentence ends with a link.',
  },
  {
    name: 'url-then-comma',
    text: 'See https://example.com, then reply',
    expected: 39,
    category: 'url',
    why: '"See " is 4, the link is 23, and ", then reply" is 12: 39. The comma is not part of the link.',
  },
  {
    name: 'url-in-brackets',
    text: '(https://example.com)',
    expected: 25,
    category: 'url',
    why: '1 + 23 + 1 = 25. The closing bracket has no opening one inside the link, so it stays outside.',
  },
  {
    name: 'url-then-question-mark',
    text: 'Is it https://example.com/pricing?',
    expected: 30,
    category: 'url',
    why: '"Is it " is 6, the link is 23, the question mark is 1: 30. A query needs something after its "?", so a bare one ends the sentence, not the link.',
  },
  {
    name: 'url-brackets-inside-the-path',
    text: 'https://en.wikipedia.org/wiki/Primer_(film)',
    expected: 23,
    category: 'url',
    why: 'Brackets that open and close inside the path are part of it, which is what keeps a Wikipedia link whole. One link, 23.',
  },
  {
    name: 'url-full-stop-is-the-281st',
    text: 'a'.repeat(256) + ' https://example.com.',
    expected: 281,
    category: 'url',
    why: '256 + 1 space + 23 + 1 full stop = 281, one over the limit. A counter that takes the stop into the link says 280 and calls this postable. This is the vector that costs somebody a rejected post.',
  },
  {
    name: 'url-filename-that-is-a-domain',
    text: 'I updated README.md',
    expected: 33,
    category: 'url',
    why: '"I updated " is 10 and README.md is a link at 23, because .md is the country ending of Moldova: 33. A counter that sees nine ordinary characters reports 19.',
  },
  {
    name: 'url-government-ending',
    text: 'whitehouse.gov',
    expected: 23,
    category: 'url',
    why: 'A bare domain on an ending outside the handful everyone remembers. The list has 1,574 of them; a counter with a short list of its own reports 14.',
  },
  {
    name: 'url-missing-space-makes-a-link',
    text: 'the end.Next sentence',
    expected: 36,
    category: 'url',
    why: '"the " is 4, "end.Next" is a link at 23 because .next is a generic ending and case does not matter, and " sentence" is 9: 36. A missing space after a full stop can manufacture a link.',
  },
  {
    name: 'url-upper-case',
    text: 'EXAMPLE.COM',
    expected: 23,
    category: 'url',
    why: 'Link matching ignores case, so capitals change nothing: 23.',
  },
  {
    name: 'url-non-latin-with-protocol',
    text: 'http://пример.рф',
    expected: 23,
    category: 'url',
    why: 'With a protocol, a domain in any script is a link: .рф is the Cyrillic country ending of Russia. 23. Compare not-a-url-non-latin-bare.',
  },
  {
    name: 'url-bare-domain-query-left-out',
    text: 'example.com?q=1',
    expected: 27,
    category: 'url',
    why: 'Without a protocol a query is only kept when a path comes before it. Here the link is example.com at 23 and "?q=1" is 4 more: 27. With https:// in front the whole string is one link at 23.',
  },

  // ------------------------------------------------------------ not-a-url
  {
    name: 'not-a-url-eg',
    text: 'e.g. this is prose',
    expected: 18,
    category: 'not-a-url',
    why: '"e.g." is not a link. Charging it 23 would report 37 for an 18-unit sentence and send an author rewriting copy that fits.',
  },
  {
    name: 'not-a-url-filename',
    text: 'see index.js for details',
    expected: 24,
    category: 'not-a-url',
    why: '.js is not a domain ending, so this is 24 plain characters. A counter matching any dotted token charges 23 for the filename. Compare url-filename-that-is-a-domain, where .md is an ending.',
  },
  {
    name: 'not-a-url-version',
    text: 'version 2.78.0 shipped',
    expected: 22,
    category: 'not-a-url',
    why: 'Neither "78" nor "0" is a domain ending, so a version string is 22 ordinary characters.',
  },
  {
    name: 'not-a-url-sentence-end',
    text: 'It is done.Then we ship.',
    expected: 24,
    category: 'not-a-url',
    why: '"then" is not a domain ending, so the missing space manufactures nothing and this is 24 characters. That is luck rather than a rule: see url-missing-space-makes-a-link.',
  },
  {
    name: 'not-a-url-almost-tld',
    text: 'example.coma',
    expected: 12,
    category: 'not-a-url',
    why: '.coma is not a domain ending, so this is twelve ordinary characters — which means "example.com" costs 23 and "example.coma" costs 12, and ADDING a character made the post cheaper. Surprising, correct, and the clearest demonstration that link detection is decided on the whole token rather than incrementally.',
  },
  {
    name: 'not-a-url-ellipsis',
    text: 'wait...what',
    expected: 11,
    category: 'not-a-url',
    why: 'Consecutive dots are not a hostname.',
  },
  {
    name: 'not-a-url-email',
    text: 'mail jane@example.com today',
    expected: 27,
    category: 'not-a-url',
    why: 'A domain straight after "@" is not a link, so the address is 16 ordinary characters: 5 + 16 + 6 = 27. Charging the domain 23 reports 39 and tells an author a post that fits is too long.',
  },
  {
    name: 'not-a-url-after-hash',
    text: '#example.com',
    expected: 12,
    category: 'not-a-url',
    why: 'A domain straight after "#" is not a link. The same goes for "$", "@", a letter or a digit. Twelve characters, 12.',
  },
  {
    name: 'not-a-url-no-ending',
    text: 'http://localhost:3000',
    expected: 21,
    category: 'not-a-url',
    why: 'A protocol is not enough: the host must finish with a recognised ending, and localhost has none. 21 characters, 21.',
  },
  {
    name: 'not-a-url-other-scheme',
    text: 'ftp://example.com',
    expected: 17,
    category: 'not-a-url',
    why: 'Only http and https start a link, and a bare domain may not directly follow a slash, so nothing here is one. 17 characters, 17.',
  },
  {
    name: 'not-a-url-www-without-ending',
    text: 'www.example',
    expected: 11,
    category: 'not-a-url',
    why: '"www." does not make a link; a recognised ending does, and "example" is not one. Eleven characters, 11.',
  },
  {
    name: 'not-a-url-label-too-long',
    text: 'a'.repeat(64) + '.com',
    expected: 68,
    category: 'not-a-url',
    why: 'One part of a domain may be at most 63 characters. This one is 64, so the whole string is 68 ordinary characters. At 63 it would be a link at 23.',
  },
  {
    name: 'not-a-url-underscore-in-the-name',
    text: 'my_site.io',
    expected: 10,
    category: 'not-a-url',
    why: 'An underscore is allowed in a subdomain but not in the name next to the ending, and a bare domain may not start straight after one, so neither "my_site.io" nor "site.io" is a link. Ten characters, 10.',
  },
  {
    name: 'not-a-url-non-latin-bare',
    text: 'пример.рф',
    expected: 9,
    category: 'not-a-url',
    why: 'Without a protocol only an ASCII domain is linked. Eight Cyrillic letters and a dot, all at weight 1: 9. Compare url-non-latin-with-protocol.',
  },

  // -------------------------------------------------------- normalisation
  {
    name: 'nfc-decomposed-accent',
    text: 'café',
    expected: 4,
    category: 'normalisation',
    why: '"cafe" + U+0301 combining acute normalises under NFC to "café", four code points at weight 1. Without normalisation this is 5, so the same visible word costs differently depending on which editor produced it.',
  },
  {
    name: 'nfc-korean-decomposed',
    text: '가',
    expected: 2,
    category: 'normalisation',
    why: 'Two conjoining jamo normalise under NFC to the single syllable 가 (U+AC00), which is above 0x10FF and so costs 2. Unnormalised, the jamo are also above 0x10FF and would cost 4.',
  },

  // ------------------------------------------------------------- boundary
  {
    name: 'boundary-last-light-char',
    text: 'ჿ',
    expected: 1,
    category: 'boundary',
    why: 'U+10FF is the last code point of the first light range. Inclusive, so 1.',
  },
  {
    name: 'boundary-first-heavy-char',
    text: 'ᄀ',
    expected: 2,
    category: 'boundary',
    why: 'U+1100 is one past the range. 2. Together with the previous case this pins the edge in both directions.',
  },
  {
    name: 'boundary-general-punctuation-start',
    text: ' ',
    expected: 1,
    category: 'boundary',
    why: 'U+2000 opens the second light range.',
  },
  {
    name: 'boundary-zwj-alone',
    text: '‍',
    expected: 1,
    category: 'boundary',
    why: 'A bare ZWJ is the last code point of the second range, weight 1. This is the value that makes the family emoji 11 rather than 14 when counted wrongly, so it is worth pinning on its own.',
  },
  {
    name: 'boundary-just-past-second-range',
    text: '‎',
    expected: 2,
    category: 'boundary',
    why: 'U+200E, the left-to-right mark, is one past the second range and costs 2. Invisible and expensive.',
  },
  {
    name: 'boundary-en-dash',
    text: '–',
    expected: 1,
    category: 'boundary',
    why: 'U+2013 is inside 0x2010–0x201F. Dashes and smart quotes are cheap; that is the point of the third range.',
  },
  {
    name: 'boundary-prime',
    text: '′',
    expected: 1,
    category: 'boundary',
    why: 'U+2032 opens the fourth range, 0x2032–0x2037.',
  },
  {
    name: 'boundary-just-past-fourth-range',
    text: '‸',
    expected: 2,
    category: 'boundary',
    why: 'One past the last light range.',
  },

  // ----------------------------------------------------------- structural
  {
    name: 'exactly-280-ascii',
    text: 'a'.repeat(280),
    expected: 280,
    category: 'structural',
    why: 'The limit itself. Fits — the comparison is <=, not <.',
  },
  {
    name: 'over-by-one',
    text: 'a'.repeat(281),
    expected: 281,
    category: 'structural',
    why: 'One over. The two cases together pin which way the boundary falls.',
  },
  {
    name: 'cjk-140-fills-280',
    text: '漢'.repeat(140),
    expected: 280,
    category: 'structural',
    why: '140 ideographs at 2 each is exactly the limit — the arithmetic behind "a Japanese post gets half as many characters".',
  },
];

function main() {
  const seen = new Set();
  const mismatches = [];

  for (const v of VECTORS) {
    if (seen.has(v.name)) throw new Error(`duplicate vector name: ${v.name}`);
    seen.add(v.name);
    if (!(v.category in CATEGORIES)) throw new Error(`${v.name}: unknown category ${v.category}`);
    if (!v.why || v.why.length < 20) throw new Error(`${v.name}: every expectation needs its arithmetic written out`);

    const actual = weightedLength(v.text);
    if (actual !== v.expected) mismatches.push({ name: v.name, expected: v.expected, actual, why: v.why });
  }

  if (mismatches.length) {
    console.error(
      `\nREFUSING TO WRITE. ${mismatches.length} vector(s) disagree with this package's implementation.\n\n` +
        `Exactly one of two things is true for each, and both are worth stopping for:\n` +
        `  - the implementation is wrong, or\n` +
        `  - the arithmetic in the "why" is wrong.\n\n` +
        `Work out which by hand. Do NOT paste the actual value into expected.\n`
    );
    for (const m of mismatches) {
      console.error(`  ${m.name}\n    expected ${m.expected}, got ${m.actual}\n    stated reason: ${m.why}\n`);
    }
    process.exit(1);
  }

  const out = {
    $comment:
      'Conformance vectors for X/Twitter weighted character counting. Expected values are derived from the published rules and stated as arithmetic in each `why`; they are not snapshots of any implementation. See README.md, including how to falsify them.',
    version: 2,
    generated: null, // filled in below
    categories: CATEGORIES,
    vectors: VECTORS.map((v) => ({
      name: v.name,
      category: v.category,
      text: v.text,
      expected: v.expected,
      why: v.why,
    })),
  };

  /*
   * `generated` IS THE DATE THE VECTORS LAST CHANGED, NOT THE DATE THE BUILD
   * LAST RAN — and the difference is the whole reason for the code below.
   *
   * It used to be `new Date()`, unconditionally. That makes the output of this
   * script depend on the calendar, and CI runs:
   *
   *     node vectors/build.js
   *     git diff --exit-code vectors/vectors.json
   *
   * So on the day after the last commit, the rebuild would stamp a new date,
   * the diff would be non-empty, and CI would go red. Every day. Forever. On a
   * repository whose entire argument is that it checks things rather than
   * trusting them — and the failure says "the committed vectors drifted from
   * what build.js derives", which is a genuinely alarming message to see for a
   * reason that is purely a clock.
   *
   * It also made the field a lie. Nobody reading `"generated": "2026-09-14"`
   * wants to know when a script ran. They want to know how old these
   * expectations are.
   *
   * So: reuse the existing date whenever nothing else changed. The file becomes
   * a pure function of the vectors, the diff is empty unless the content moved,
   * and the date finally means what a reader already assumed it meant.
   */
  const target = path.join(HERE, 'vectors.json');
  const today = new Date().toISOString().slice(0, 10);
  let previous = null;
  try {
    previous = JSON.parse(readFileSync(target, 'utf8'));
  } catch {
    // No previous file, or an unreadable one. Either way, today is the answer.
  }
  const unchanged =
    previous !== null &&
    JSON.stringify({ ...previous, generated: null }) === JSON.stringify(out);
  out.generated = unchanged ? previous.generated : today;

  writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
  console.log(
    `wrote vectors.json — ${VECTORS.length} vectors, all agreeing with this package's implementation` +
      (unchanged ? ` (unchanged since ${out.generated})` : ` (content changed; dated ${out.generated})`),
  );
}

main();
