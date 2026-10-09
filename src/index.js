/**
 * x-weighted-length: what X charges for a post, in the units the 280 limit uses.
 *
 * Zero dependencies. ESM. Node 18+ and every current browser.
 *
 * The rule is X's own, as x.com's composer runs it, and all of it lives in
 * `core.js`. That is generated from the packages X published and the changes
 * x.com has made to them since (see tools/build-core.mjs and tools/x-live.json):
 *
 *   1. Normalise the text to NFC.
 *   2. Find the links, the way x.com finds them. Each costs a flat 23.
 *   3. Find the emoji, with x.com's emoji pattern. Each costs 2, however many
 *      code points built it.
 *   4. Every other UTF-16 unit costs 1 inside four published ranges and 2
 *      outside; a surrogate pair is one unit of 2.
 *
 * This file is the public surface: small functions over that core, each of
 * which says what it promises. See README.md for the sources and for how to
 * prove any of it wrong.
 */
import { XCount } from './core.js';

/**
 * UTF-16 code units that cost 1. Everything else costs 2.
 *
 * These are the `ranges` block of twitter-text's `config/v3.json`, where `scale`
 * is 100 and `defaultWeight` is 200: a "weight 100" range is a cost of 1.
 *
 * The second range is the one people are surprised by. It is general
 * punctuation, and it includes U+200D, the zero-width joiner, which is why a
 * family emoji counted piece by piece comes to 11 rather than 14. Both numbers
 * are wrong; the emoji costs 2.
 */
export const LIGHT_RANGES = Object.freeze(XCount.LIGHT_RANGES.map((r) => Object.freeze([...r])));

/** What one link costs, however long it is. `transformedURLLength` in the config. */
export const URL_WEIGHT = XCount.LINK_WEIGHT;

/** The published ceiling for a single post. */
export const MAX_WEIGHTED_LENGTH = XCount.LIMIT;

/** How many domain endings the link pattern knows: x.com's list, generic and country. */
export const DOMAIN_ENDINGS = Object.freeze({ generic: XCount.counts.gtlds, country: XCount.counts.cctlds });

/**
 * What X will charge for this text, in the same units as the 280 limit.
 *
 * @param {string} text
 * @returns {number}
 */
export function weightedLength(text) {
  if (typeof text !== 'string') throw new TypeError('weightedLength expects a string');
  return XCount.weightedLength(text);
}

/**
 * Whether this text fits in one post.
 *
 * @param {string} text
 * @param {number} [limit]
 * @returns {boolean}
 */
export function fits(text, limit = MAX_WEIGHTED_LENGTH) {
  return weightedLength(text) <= limit;
}

/**
 * The links X will find, so a disagreement can be diagnosed rather than argued
 * about.
 *
 * Most reports of "your count is wrong" are really "we disagree about what is a
 * link", and that is a short conversation once both sides can see the
 * substrings. `index` is a position in the NFC-normalised text.
 *
 * @param {string} text
 * @returns {{ text: string, index: number }[]}
 */
export function findLinks(text) {
  return XCount.links(String(text)).map((l) => ({ text: l.text, index: l.start }));
}

/**
 * The text as the pieces X prices, in order: every link, every emoji and every
 * other character with what it costs. The costs add up to `weightedLength`.
 *
 * This is the function to reach for when two counters disagree: print both
 * lists and the first row that differs is the rule one of them has wrong.
 *
 * @param {string} text
 * @returns {{ text: string, weight: number, kind: 'link' | 'emoji' | 'char' }[]}
 */
export function explain(text) {
  const s = XCount.normalize(String(text));
  const KINDS = ['char', 'link', 'emoji'];
  return XCount.pieces(s).map((p) => ({ text: s.slice(p.start, p.end), weight: p.weight, kind: KINDS[p.kind] }));
}

/**
 * Truncate to a weighted budget without cutting through a link, an emoji, or a
 * letter and its accent.
 *
 * Guaranteed: `weightedLength(truncateToWeight(t, n)) <= n` for every input.
 * That is a test, not a hope (test/conformance.test.js), and it is not trivial:
 * cutting can CREATE a link. `example.coma` is twelve ordinary characters; its
 * first ten are `example.co`, which is a link and costs 23. So the result is
 * measured again and shortened until what it says is true.
 *
 * @param {string} text
 * @param {number} [limit]
 * @returns {string}
 */
export function truncateToWeight(text, limit = MAX_WEIGHTED_LENGTH) {
  return XCount.truncate(String(text), limit);
}
