# x-weighted-length

**What X actually charges for a post, and 74 conformance vectors so you can check any implementation, including this one.**

```bash
npm install github:postsiete/x-weighted-length
```

Already have a counter? Don't install anything. Point the runner at it:

```bash
npx -p github:postsiete/x-weighted-length x-conformance ./your-counter.js
```

A plain code-point counter scores **36 out of 74**. [Why that number is the
argument](#check-your-own-counter).

```js
import { weightedLength, fits, findLinks, explain, truncateToWeight } from 'x-weighted-length';

weightedLength('hello');                                 // 5
weightedLength('こんにちは');                               // 10  outside the light ranges, so 2 each
weightedLength('👨‍👩‍👧‍👦');                                     // 2   one emoji is one unit, not 7 code points
weightedLength('example.com');                           // 23  a bare domain is still a link
weightedLength('Read more: https://example.com/post.');  // 35  and the full stop is not part of it
fits('a'.repeat(281));                                   // false
```

It counts what x.com's composer counts, which is not quite what X's own published library counts: [four differences](#the-library-and-the-site), each read from the code x.com runs and checked against it.

Zero dependencies. ESM. Node 18+ and every current browser.

---

## Six counters, one suite

| Counter | Score | What it gets wrong |
|---|---|---|
| `[...text].length` | 36 / 74 | every link, every CJK character, most emoji |
| The counter this package first shipped with | 59 / 74 | the full stop after a link, `.gov`, an email address |
| `twitter-text` 3.1.0, as npm installs it today | 70 / 74 | `README.md`, `.music`, and two emoji: its emoji table is from 2018 |
| `twitter-text` 3.1.0 with the last emoji table X published | 71 / 74 | `README.md`, `.music`, and the black bird |
| x.com's composer, read on 9 October 2026 | 74 / 74 | |
| This package | 74 / 74 | |

Every row is a test in this repository, not a claim, and the x.com row was also run through the composer's own code on x.com.
The third and fourth rows are X's own library, and where it parts from X's own site is [the section below](#the-library-and-the-site).
The second row is the uncomfortable one, and it is [explained at the end](#provenance).

---

## The rule

It is X's own, in X's own order, and everything else is detail.

**1. Normalise to NFC**, so `é` typed as one character and as `e` plus an accent cost the same.

**2. A link costs a flat 23**, however long it is, because X replaces it with a `t.co` URL. A thirteen-character link costs 23. A four-hundred-character link costs 23. Where a link starts and stops is most of the work, and most of what follows.

**3. An emoji costs 2**, however many code points built it. This is the rule that produces the bug reports.

**4. Every other character costs 1 or 2.** The cheap ones are four published ranges: `0x0000–0x10FF`, `0x2000–0x200D`, `0x2010–0x201F`, `0x2032–0x2037`. Everything outside them costs 2, which is why 140 Japanese characters fill a 280 limit exactly.

Note what that means for scripts people assume are expensive: Cyrillic, Hebrew, Greek, Arabic and Thai all sit inside the first range and cost **1**. "Non-Latin" is not the rule; the ranges are.

---

## The one that gets a post rejected

```js
weightedLength('a'.repeat(256) + ' https://example.com.');   // 281
```

256 characters, a space, a link at 23, a full stop: 281, one over. A counter that matches a link as "`https://`, then everything up to the next space" takes the full stop into the link, reports 280, and tells the author the post fits. X rejects it.

A link does not end at the next space. Its path may not end on `.` `,` `!` `?` `:` `;` or a quote, and a closing bracket belongs to it only when the opening one is inside it too. So the punctuation that ends a sentence is charged, every time:

| Text | A run-to-the-space matcher | X |
|---|---|---|
| `Read more: https://example.com/post.` | 34 | **35** |
| `(https://example.com)` | 24 | **25** |
| `Is it https://example.com/pricing?` | 29 | **30** |
| `https://en.wikipedia.org/wiki/Primer_(film)` | 23 | **23** |

Undercounting is the direction that hurts. It tells an author their post fits, and then the API refuses it. Overcounting merely annoys.

---

## The ones nobody expects

**`main.rs` is a link.** So are `app.py` and `archive.zip`: `.rs`, `.py` and `.zip` are all domain endings, so each costs 23. `index.js` is not, because `.js` is not an ending. x.com knows 1,581 domain endings and a counter that keeps a short list of its own is wrong about most of them: `whitehouse.gov` is 23, not 14.

**`README.md` is not a link, though X's own library says it is.** `.md` is Moldova's country ending, and `twitter-text` charges `I updated README.md` 33. x.com does not: its composer passes over a bare domain ending in `.md`, so the sentence costs 19, and a post that mentions `CLAUDE.md` shows it as plain text. With a protocol, `https://example.md`, it is a link again. More on that [below](#the-library-and-the-site).

**A missing space can manufacture one.** `the end.Next sentence` contains the link `end.Next`, because `.next` is an ending and case does not matter. 36, not 21.

**An email address is not a link.** A domain straight after `@` is left alone, so `jane@example.com` is 16 ordinary characters. The same goes for `#example.com` and `$example.com`. A counter that charges 23 for the domain tells an author a post that fits is too long.

**A protocol is not enough.** `http://localhost:3000` is 21 ordinary characters: no recognised ending, no link. Nor is `ftp://example.com`, nor `www.example`.

**A bare domain drops its query.** `example.com?q=1` is a link and four more characters, 27. `https://example.com?q=1` is one link, 23.

**Adding a character can make a post cheaper.**

```js
weightedLength('example.com');   // 23
weightedLength('example.coma');  // 12
```

`.coma` is not an ending, so the string stops being a link and stops being charged like one. Cost is not monotonic in length, because "is this a link" is decided on the whole token rather than incrementally.

**Truncating can make a post more expensive.** This is the same fact in disguise, and it is a live bug in a lot of thread-splitters:

```js
'example.coma'.slice(0, 10);   // 'example.co'  costs 23, from a budget of 10
```

Cutting created a link that the input did not contain. No amount of care while accumulating characters prevents it, because the character that ends the string is exactly the character that decides. The cost of a truncation has to be **checked after the fact and shortened until it is true**, which is what `truncateToWeight` does, and it is guaranteed by a property test rather than by intention:

```js
weightedLength(truncateToWeight(anyText, n)) <= n   // for all inputs
```

If you split threads, try this on your splitter before assuming you are fine.

---

## The library and the site

X's developer documentation sends you to `twitter-text` to count a post, and `twitter-text` was last released in March 2020, with an emoji table from 2018. x.com has moved on since, without publishing the changes. Its composer differs from the library in four ways:

| | `twitter-text` 3.1.0 | x.com |
|---|---|---|
| `I updated README.md` | 33: `.md` is Moldova's ending | **19**: a bare domain ending in `.md` is a file name, not a link |
| `example.music` | 13: not an ending it knows | **23**: x.com knows seven more endings, among them `.music`, `.kids`, `.spa` and `.amazon` |
| `🐦‍⬛` black bird | 5 with the 2018 table, 5 with the last table X published | **2**: x.com's emoji table is Emoji 15.0 |
| `U+FEFF` then `example.com` | 13: a link may not follow that mark | **25**: the mark costs 2 and the link 23 |

These are not guesses about the site. The first came out of a check before this package was announced: five strings pasted into the composer, which shows a number once 20 or fewer characters are left. Four came back as the library predicts. `README.md` did not.

So the counting code x.com serves to its own composer was read. It is `twitter-text`'s, with four changes: seven domain endings added, `U+FEFF` taken out of the characters that make a post invalid, bare `.md` domains skipped, and the emoji table of `@twemoji/parser` 15.0.0 with one entry moved. `tools/x-live.json` records what was read, on 9 October 2026, with the SHA-256 of every pattern the composer compiles, and `npm run build:core` will not produce a core whose patterns have any other fingerprint.

Then the composer's own counting functions were run in the page on 1,731,072 generated strings, and the digests of their answers recorded. `npm run test:reference` rebuilds those answers from the published packages plus the four changes, gets the same digests, and holds this package to them string by string. With the four changes switched off, the same rebuild gives `twitter-text`'s own answers on every one of those strings and 1.5 million more. So the four are the whole difference, not a sample of it.

You can see the first one in a minute, signed in to X. Start a new post, which you will not send, and paste 246 letters, a space and `I updated README.md`. The library says that is exactly 280 and the counter should read 0. It reads 14.

---

## The one that breaks implementations

The four-person family emoji is four people joined by three zero-width joiners: seven code points. X charges **2**.

Count its code points with the weights above and you get **11**: four people at 2, three joiners at 1, because U+200D sits inside the second light range. Count them in a language whose string length is UTF-16 units and you get 11 characters. Count graphemes without the emoji rule and you get 1.

| Input | Naive per-code-point | Correct |
|---|---|---|
| `👨‍👩‍👧‍👦` family | 11 | **2** |
| `🧑‍🔧` mechanic | 5 | **2** |
| `🇨🇴` flag | 4 | **2** |
| `❤️` heart + VS16 | 4 | **2** |
| `1️⃣` keycap | 5 | **2** |

If your counter reports 5 for the mechanic, it fell through to a per-code-point path. That exact number is the one reported in [twitter-text#369](https://github.com/twitter/twitter-text/issues/369), and it is one of the vectors `twitter-text` itself fails when installed from npm: version 3.1.0 pins an emoji table from October 2018 (`twemoji-parser` 11.0.2), and the mechanic arrived a year later.

One unit is only for sequences x.com's emoji table knows. Two grinning faces with a joiner between them are not a sequence, so they cost 2 + 1 + 2. Nor is anything newer than Emoji 15.0: the phoenix, a bird and fire joined, is 5 on x.com today.

---

## The vectors

The point of this package.

```js
import vectors from 'x-weighted-length/vectors' with { type: 'json' };
// or just: node_modules/x-weighted-length/vectors/vectors.json
```

```json
{
  "name": "url-then-full-stop",
  "category": "url",
  "text": "Read more: https://example.com/post.",
  "expected": 35,
  "why": "\"Read more: \" is 11, the link is a flat 23, and the full stop is 1: 35. A path may not END on a full stop, so the stop belongs to the sentence. A matcher that runs to the next space takes it into the link and reports 34: one short, whenever a sentence ends with a link."
}
```

Seventy-four cases across eight categories: `basic`, `heavy`, `emoji`, `url`, `not-a-url`, `normalisation`, `boundary`, `structural`. Language-agnostic: it is a JSON file, so a Python, Go, Rust or Swift implementation can consume it as easily as a JavaScript one.

**Every expected value is written as arithmetic, in the `why` field, derived from the rules x.com applies.** None of them is a snapshot of what this library returns. `vectors/build.js` checks the two against each other and **refuses to write the file** when they disagree, with a message saying that either the implementation or the stated reasoning is wrong and that both are worth stopping for.

**And x.com has to agree with every one.** Arithmetic that reads well can still be about a rule that does not exist, so `npm run test:reference` runs x.com's rules, rebuilt and checked against the site, over the same file and fails if they disagree with a single vector. It also pins exactly which vectors X's published library fails, and why.

The `not-a-url` category is the half that is usually missing. Everybody eventually charges 23 for `example.com`. Far fewer keep charging 1 per character for `e.g.`, `index.js`, `2.78.0`, `wait...what` and `jane@example.com`, and a spurious 23 in the middle of a sentence sends an author rewriting copy that already fitted.

---

## Check your own counter

You do not have to adopt this library to get the value out of it. Point the runner at whatever you already use, straight from this repository:

```bash
npx -p github:postsiete/x-weighted-length x-conformance ./counter.js
```

After that command comes a module, and optionally which export to test:

| Arguments | What is checked |
|---|---|
| `./counter.js` | the default export, or the only function it exports |
| `./counter.js weightedLength` | a named export |
| `twitter-text getTweetLength` | a package installed in the folder you run it from |
| `./counter.js --only url` | one category while you fix it |
| `./counter.js --json` | the same report, machine-readable, for CI |

Exit code is `0` when everything passes, `1` when a vector fails, and `2` when it could not run at all, so a broken import never reads as a clean bill of health.

Do not shorten the command to `npx x-conformance`. That asks the npm registry for a package of that name, which is not this one.

Or from code:

```js
import { check, format } from 'x-weighted-length/conformance';
import { myCounter } from './my-counter.js';

const report = check(myCounter);
if (!report.ok) { console.error(format(report)); process.exit(1); }
```

### Why 36 out of 74 is the whole argument

A plain code-point counter, `[...text].length`, which is what a wrong counter usually *is*, scores this:

```
structural 4/5   basic 7/7   heavy 0/4   emoji 4/12
url 0/21   not-a-url 15/15   normalisation 1/2   boundary 5/8

FAIL  38 of 74 vectors
```

Read the shape rather than the total. It passes **every** plain-text case, and it never produces a false positive on a string that merely looks like a link. It fails **every** link vector and **every** CJK one.

That is exactly why this class of bug survives code review and ships: it is correct on everything you would think to type into it by hand, and wrong on everything that costs you a rejected post.

Every failure prints the arithmetic, not just the two numbers, because "expected 2, got 7" tells you that you are wrong, and the `why` tells you which rule you missed:

```
FAIL  url-bare-domain  [url]
      text      "example.com"
      expected  23, got 11
      why       THE ONE THAT UNDERCOUNTS. No scheme, no www., still a link,
                still 23. A matcher requiring http(s):// or www. reports 11
                and tells the author a post fits that the API will reject.
```

A counter that **throws** is recorded as a failure with its message rather than crashing the run. Real implementations throw on lone surrogates and on empty input, and losing the other 73 results to one exception is the least useful moment to give up.

When two counters disagree and you cannot see why, `explain` lists the pieces the count is made of. The first row that differs from yours is the rule one of you has wrong:

```js
explain('hi example.com.');
// [ { text: 'h', weight: 1, kind: 'char' }, { text: 'i', weight: 1, kind: 'char' },
//   { text: ' ', weight: 1, kind: 'char' }, { text: 'example.com', weight: 23, kind: 'link' },
//   { text: '.', weight: 1, kind: 'char' } ]
```

In a browser, pass your own copy so nothing touches the filesystem:

```js
const { vectors } = await (await fetch('https://postsiete.com/tools/x-vectors.json')).json();
check(myCounter, { vectors });
```

---

## How this was checked

A counter whose author also wrote its tests shares its author's blind spots, and this one proved it twice (see [Provenance](#provenance)). So nothing here rests on this repository's own opinion of itself.

**It is x.com's own patterns, not an imitation of them.** The link patterns in `src/core.js` have the same source text as the ones x.com's composer compiles, character for character, including its list of 1,581 domain endings, and so does the emoji pattern. `tools/build-core.mjs` lifts them out of `twitter-text` 3.1.0 and `@twemoji/parser` 15.0.0, makes x.com's edits, and refuses to write the core unless every pattern has the SHA-256 recorded on x.com. Nobody retyped them.

**It passes X's own test cases.** `npm test` runs the 1,706 cases in `twitter-text`'s conformance suite that concern weighted length and link extraction, one per domain ending included. None of them touches the four places x.com differs, so all of them still hold. It needs nothing installed.

**It agrees with x.com on input nobody chose.** `npm install && npm run test:reference` regenerates the 1,731,072 strings x.com's composer was asked about and gets x.com's answers for every one: the same count, and the same links at the same positions. It does the same on a million and a half more strings built from the fragments that land on every rule. Zero differences, or the run fails.

**And it differs from X's published library in exactly four places.** The same run switches x.com's four changes off and gets `twitter-text`'s own answers, with the last emoji table X published, on all of those strings. That is what makes the list of differences above complete rather than illustrative.

---

## What this is not

**Not official.** Not published by, endorsed by, or affiliated with X or Twitter. It is a port of code X published under open licences, with the changes x.com has made to it since, and the vectors are one reading of the rules that code implements.

**Not the first conformance suite, and you should know that before you cite it.** X publishes [`twitter-text`](https://github.com/twitter/twitter-text) under Apache 2.0 **with its own conformance tests**, in `conformance/validate.yml`. Anybody telling you nobody else publishes vectors is wrong, and this package runs theirs. What is different here is narrow and checkable: these are CORS-fetchable JSON a browser suite can pull at runtime rather than a YAML file you vendor with a parser; every vector carries the arithmetic for its expected value, so a failure is a diagnosis rather than a mismatch; they cover what follows a link and what is not one, which the weighted-length cases in theirs do not; and there is a runner you can point at your own code. If you want the canonical suite, use theirs. This one is not trying to replace it.

**Not timeless.** The rules are x.com's as read on 9 October 2026. X has changed its composer since `twitter-text` 3.1.0 without publishing the changes, in at least the four ways above, and it can do so again. Emoji newer than 15.0, like the phoenix, are charged by the piece because x.com charges them that way today; when x.com learns them, this will be wrong until someone notices. `tools/x-live.json` records exactly what was read, so a change can be found rather than argued about, and the next section is how to find one.

**Not tidier than X.** Two places in x.com's emoji table disagree with Unicode, and they are kept: `♾️` with its variation selector costs 4, and the fully qualified `👁️‍🗨️` costs 5. The claim is what X's code charges, not what the standard says it should.


---

## How to prove this wrong

Please do. The failure mode of a reference implementation is being trusted after it stops being right.

The authority is X. The quickest check is the composer: paste a text this library says is exactly 280 into a new post, without sending it, and the counter should read 0; at 281 it should read -1 and the Post button should be disabled. Or post it, and see whether it is accepted. If X disagrees with this, this is wrong.

For a specific disagreement, `findLinks` usually settles it in one step. Most "your count is wrong" reports are really "we disagree about what is a link", and that is a two-second conversation once both sides can see the substrings:

```js
findLinks('e.g. index.js and example.com');  // [ { text: 'example.com', index: 18 } ]
```

Open an issue with the input, what you expected, what you got, and where the expectation comes from. A vector with reasoning attached is the most useful thing anyone can send.

---

## Sources

- [twitter/twitter-text](https://github.com/twitter/twitter-text): `config/v3.json` for the weights, the flat 23 and the emoji rule (`scale: 100`, `defaultWeight: 200`, `transformedURLLength: 23`, `emojiParsingEnabled: true`), the link patterns and the list of domain endings, and the conformance suite
- [twitter/twemoji-parser](https://github.com/twitter/twemoji-parser), and its continuation [jdecked/twemoji-parser](https://github.com/jdecked/twemoji-parser) (`@twemoji/parser`): the emoji pattern
- x.com's composer, read on 9 October 2026: the four differences, the fingerprints in `tools/x-live.json`, and the answers the reference suite is held to
- [Counting characters](https://docs.x.com/resources/fundamentals/counting-characters) in X's developer documentation, which points at `twitter-text` as the way to count
- [twitter-text#369](https://github.com/twitter/twitter-text/issues/369): where the mechanic-emoji `5` comes from
- [tweepy#1538](https://github.com/tweepy/tweepy/issues/1538): an open request for exactly this calculation

---

## Provenance

This began as four separate copies of a counter inside one product: a server module, a browser extension, a public tool page, and the app itself. A parity test ran all four over the same fixtures and failed on any disagreement, and in August 2026 it caught the fourth copy undercounting bare domains and over-charging family emoji. Extracting the vectors afterwards seemed more useful than keeping them.

That first version was wrong, and its own 49 vectors could not say so. It matched a link as a protocol and then everything up to the next space, and bare domains on a list of 49 endings. All four copies agreed with each other and with every vector, because the same person had written all of them. Run against `twitter-text`, it took a sentence's full stop into the link before it, had never heard of `.gov`, and charged an email address 23 for its domain. Four implementations agreeing with each other is evidence of consistency and no evidence of correctness.

So the counter was thrown away and replaced by a port of X's own patterns, and 22 vectors were added for what it had got wrong. The old counter is kept in the test suite in miniature, where it fails 15 of the 74.

The port was wrong too, and it was caught before the package was announced. It agreed with `twitter-text` on a million and a half strings, and a five-string check in x.com's composer found that `README.md` is not a link there. Reading the code x.com runs turned up three more differences. The `README.md` vector was turned around, and three were added. The suite had been checking the package against X's library, which is what X tells developers to use, and the library is not what X runs. The old counter, for what it is worth, said `README.md` was 19 all along: it had never heard of `.md`.

Two more bugs were found while writing this package, by property tests rather than by examples: the truncation bound, and the link created by cutting. Neither was in the original implementations' test suites, and one of them is probably in yours.

Built while working on [PostSiete](https://postsiete.com).

## Licence

MIT for this package's own code. The link patterns and the list of domain endings are from `twitter-text` (Apache-2.0) and the emoji pattern is `@twemoji/parser`'s (MIT), both copyright Twitter, Inc.; `NOTICE` says exactly what was taken and what was changed, and `LICENSES/` holds both licence texts. Take the vectors, ignore the rest.
