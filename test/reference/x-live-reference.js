/**
 * x.com's counting, rebuilt for testing, with each of its differences from
 * twitter-text on a switch.
 *
 * This is twitter-text 3.1.0's own code, in its own shape. With every switch
 * on, it is what x.com runs: seven more domain endings, U+FEFF taken out of
 * the invalid characters, bare .md domains skipped, and @twemoji/parser
 * 15.0.0's emoji pattern with U+1FAF0 moved. With every switch off and the
 * 2022 emoji table, it is twitter-text 3.1.0 as it runs in Node with the last
 * emoji table X published. The tests use both ends: the first is checked
 * against x.com's own answers, the second against twitter-text itself, and
 * together they show that those four changes are the whole difference.
 *
 * It is not shipped, and it is independent of the package on purpose: it
 * never imports src/, and it is assembled by editing the compiled patterns of
 * the published packages rather than from the template.
 *
 * Domain labels are measured by punycode.js 2.3.1, which counts control
 * characters as ASCII. So do x.com's punycode and the one built into Node,
 * which is the one twitter-text gets when it asks for "punycode" there.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const LIVE = JSON.parse(readFileSync(path.join(ROOT, 'tools', 'x-live.json'), 'utf8'));
export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const B = String.fromCharCode(92);
const cp = (...codes) => String.fromCodePoint(...codes);

// Loaded by path, so Node's built-in punycode, which shadows the package name, is not the one used.
const punycode = require('punycode/');

/* ---- the patterns ---- */

const tt = (name) => {
  const m = require(`twitter-text/dist/regexp/${name}`);
  return (m.default || m).source;
};
const body = (name) => /^\(\?:\(\?:(.*)\)\(\?=\[\^0-9a-zA-Z@\+-\]\|\$\)\)$/s.exec(tt(name))[1];

function withAdded(name, pairs) {
  const list = body(name).split('|');
  for (const [after, item] of pairs) {
    const at = list.indexOf(after);
    if (at < 0 || list.includes(item)) throw new Error(`cannot place ${item} after ${after}`);
    list.splice(at + 1, 0, item);
  }
  return list.join('|');
}
const GENERIC = withAdded('validGTLD', [
  ['americanexpress', 'amazon'],
  ['kim', 'kids'],
  ['mutual', 'music'],
  ['space', 'spa'],
  [cp(0x30af, 0x30e9, 0x30a6, 0x30c9), cp(0x30a2, 0x30de, 0x30be, 0x30f3)],
  [cp(0x4f01, 0x4e1a), cp(0x4e9a, 0x9a6c, 0x900a)],
]);
const COUNTRY = withAdded('validCCTLD', [[cp(0x627, 0x644, 0x627, 0x631, 0x62f, 0x646), cp(0x5d9, 0x5e9, 0x5e8, 0x5d0, 0x5dc)]]);

const PUBLISHED_INVALID = B + 'uFFFE' + B + 'uFEFF' + B + 'uFFFF';
const LIVE_INVALID = B + 'uFFFE' + B + 'uFFFF';

function edit(source, { endings, invalid }) {
  let s = source;
  if (endings) s = s.split(body('validGTLD')).join(GENERIC).split(body('validCCTLD')).join(COUNTRY);
  if (invalid) s = s.split(PUBLISHED_INVALID).join(LIVE_INVALID);
  return s;
}

function patternIn(file) {
  const text = readFileSync(file, 'utf8');
  const open = 'exports.default = /';
  return text.slice(text.indexOf(open) + open.length, text.lastIndexOf('/g;'));
}
function liveEmoji() {
  const u = (hex) => B + 'u' + hex;
  return patternIn(require.resolve('@twemoji/parser/dist/lib/regex.js'))
    .split(u('d83e') + u('def0') + '|')
    .join('')
    .split(u('dec5') + u('def1') + '-')
    .join(u('dec5') + u('def0') + '-');
}
const EMOJI = {
  live: liveEmoji(),
  2022: patternIn(require.resolve('twemoji-parser/dist/lib/regex.js')),
};

/** Every switch on: the patterns x.com compiles, each checked against its fingerprint. */
export const SOURCES = {
  link: edit(tt('extractUrl'), { endings: true, invalid: true }),
  asciiDomain: edit(tt('validAsciiDomain'), { endings: true, invalid: true }),
  tco: tt('validTcoUrl'),
  emoji: EMOJI.live,
  invalid: '[' + LIVE_INVALID + ']',
  bareMarkdown: B + '.md$',
  punycodeNonAscii: '[^' + B + '0-' + B + 'x7F]',
};
for (const [name, source] of Object.entries(SOURCES)) {
  const want = LIVE.patterns[name];
  if (source.length !== want.length || sha256(source) !== want.sha256) {
    throw new Error(`the rebuilt ${name} pattern is not x.com's: ${sha256(source)} against ${want.sha256}`);
  }
}
if (sha256(GENERIC) !== LIVE.endings.generic.sha256 || sha256(COUNTRY) !== LIVE.endings.country.sha256) {
  throw new Error("the rebuilt domain endings are not x.com's");
}
if (punycode.toASCII('a' + String.fromCharCode(1) + 'b').length !== 3 || punycode.toASCII('a' + String.fromCharCode(127) + 'b').length !== 3) {
  throw new Error('the punycode in use encodes control characters, and x.com does not');
}

/* ---- twitter-text's functions, with x.com's changes on switches ---- */

const ALL = { endings: true, invalid: true, markdown: true, emoji: 'live' };
const NONE = { endings: false, invalid: false, markdown: false, emoji: '2022' };
export const SWITCHES = { ALL, NONE };

export function counter(changes = ALL) {
  const c = { ...ALL, ...changes };
  const extractUrl = new RegExp(edit(tt('extractUrl'), c), 'gi');
  const validAsciiDomain = new RegExp(edit(tt('validAsciiDomain'), c), 'gi');
  const validTcoUrl = new RegExp(tt('validTcoUrl'), 'i');
  const emojiPattern = new RegExp(EMOJI[c.emoji], 'g');
  const invalidPattern = new RegExp('[' + (c.invalid ? LIVE_INVALID : PUBLISHED_INVALID) + ']');
  const bareMarkdown = /\.md$/i;
  const invalidBeforeBareDomain = /[-_.\/]$/;

  function toAscii(domain) {
    if (domain.substring(0, 4) === 'xn--' && !domain.match(validAsciiDomain)) return undefined;
    const labels = domain.split('.');
    for (const label of labels) {
      const encoded = punycode.toASCII(label);
      if (encoded.length < 1 || encoded.length > 63) return undefined;
    }
    return labels.join('.');
  }

  function isValidUrl(url, protocol, domain) {
    const ascii = toAscii(domain);
    if (!ascii || !ascii.length) return false;
    return protocol.length + url.length + ascii.length - domain.length <= 4096;
  }

  function extractUrlsWithIndices(text) {
    if (!text || !text.match(/\./)) return [];
    const urls = [];
    extractUrl.lastIndex = 0;
    while (extractUrl.exec(text)) {
      const before = RegExp.$2;
      let url = RegExp.$3;
      const protocol = RegExp.$4;
      const domain = RegExp.$5;
      const pathPart = RegExp.$7;
      let end = extractUrl.lastIndex;
      const start = end - url.length;
      if (!isValidUrl(url, protocol || 'https://', domain)) continue;
      if (!protocol) {
        if (before.match(invalidBeforeBareDomain)) continue;
        let last = null;
        let asciiEnd = 0;
        domain.replace(validAsciiDomain, (asciiDomain) => {
          if (c.markdown && bareMarkdown.test(asciiDomain)) return; // x.com's addition
          const asciiStart = domain.indexOf(asciiDomain, asciiEnd);
          asciiEnd = asciiStart + asciiDomain.length;
          last = { url: asciiDomain, indices: [start + asciiStart, start + asciiEnd] };
          urls.push(last);
        });
        if (last == null) continue;
        if (pathPart) {
          last.url = url.replace(domain, last.url);
          last.indices[1] = end;
        }
      } else {
        if (url.match(validTcoUrl)) {
          const slug = RegExp.$1;
          if (slug && slug.length > 40) continue;
          url = RegExp.lastMatch;
          end = start + url.length;
        }
        urls.push({ url, indices: [start, end] });
      }
    }
    return urls;
  }

  function parseEmoji(text) {
    const out = [];
    emojiPattern.lastIndex = 0;
    for (let m = emojiPattern.exec(text); m; m = emojiPattern.exec(text)) out.push({ text: m[0], indices: [m.index, emojiPattern.lastIndex] });
    return out;
  }

  const RANGES = [[0, 4351], [8192, 8205], [8208, 8223], [8242, 8247]];
  const weightOf = (unit) => (RANGES.some(([lo, hi]) => unit >= lo && unit <= hi) ? 100 : 200);

  /** parseTweet with config v3. */
  function parseTweet(text = '') {
    const s = text.normalize();
    const urls = new Map(extractUrlsWithIndices(s).map((u) => [u.indices[0], u]));
    const emoji = new Map(parseEmoji(s).map((e) => [e.indices[0], e]));
    let weight = 0;
    let valid = true;
    let validEnd = 0;
    for (let i = 0; i < s.length; i++) {
      if (urls.has(i)) {
        weight += 2300;
        i += urls.get(i).url.length - 1;
      } else if (emoji.has(i)) {
        weight += 200;
        i += emoji.get(i).text.length - 1;
      } else {
        const unit = s.charCodeAt(i);
        if (i < s.length - 1 && unit >= 0xd800 && unit <= 0xdbff && s.charCodeAt(i + 1) >= 0xdc00 && s.charCodeAt(i + 1) <= 0xdfff) i++;
        weight += weightOf(s.charCodeAt(i));
      }
      if (valid) valid = !invalidPattern.test(s.substring(i, i + 1));
      if (valid && weight <= 28000) validEnd = i;
    }
    weight /= 100;
    return { weightedLength: weight, valid: valid && weight > 0 && weight <= 280, validRangeEnd: validEnd + (text.length - s.length) };
  }

  /** One line per string, in the format the digests in tools/x-live.json were taken in. */
  function answerLine(text) {
    const p = parseTweet(text);
    const links = extractUrlsWithIndices(text.normalize()).map((u) => `${u.indices[0]}:${u.indices[1]}:${u.url.length}`).join(',');
    return `${p.weightedLength},${p.valid ? 1 : 0},${p.validRangeEnd}|${links}\n`;
  }

  /** Links as start:end pairs in the NFC text, the shape the package's findLinks can be compared in. */
  function linkSpans(text) {
    return extractUrlsWithIndices(text.normalize())
      .map((u) => `${u.indices[0]}:${u.indices[0] + u.url.length}`)
      .join(',');
  }

  return { parseTweet, extractUrlsWithIndices, parseEmoji, answerLine, linkSpans };
}

/** x.com, as rebuilt. */
export const xcom = counter(ALL);

/** The pieces the published library and x.com differ in, for tests that undo the edits. */
export const EDITS = {
  generic: { published: body('validGTLD'), live: GENERIC },
  country: { published: body('validCCTLD'), live: COUNTRY },
  invalid: { published: PUBLISHED_INVALID, live: LIVE_INVALID },
  emoji: { published15: patternIn(require.resolve('@twemoji/parser/dist/lib/regex.js')), live: EMOJI.live, published2022: EMOJI[2022] },
};
