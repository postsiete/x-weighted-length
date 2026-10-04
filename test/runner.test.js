/**
 * The runner's own tests.
 *
 * `conformance.test.js` proves the VECTORS hold against this library.
 * This file proves the RUNNER can tell you when a counter does not.
 *
 * Those are different claims and only the second one matters to somebody
 * checking their own implementation. A runner that cannot detect a wrong
 * answer is worse than no runner, because it converts "I have not checked"
 * into "I have checked and it is fine" — the precise transformation this
 * package exists to stop people making about their counter.
 *
 * So most of what follows is about making the runner FAIL on demand, with
 * pinned numbers. The naive code-point counter is the star witness: it is what
 * almost every wrong implementation actually is.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, mkdirSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { check, format, vectors, categories } from '../src/conformance.js';
import { weightedLength } from '../src/index.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ========================================================================== *
 * 1. The runner detects correctness
 * ========================================================================== */

test('THE REFERENCE IMPLEMENTATION PASSES ITS OWN SUITE', () => {
  /*
   * Not circular, and this is the one place worth saying why. The expected
   * values are derived from the published rules and stated as arithmetic in
   * `why`; vectors/build.js REFUSES to write the file when the implementation
   * disagrees with that arithmetic. So this asserts that the shipped file and
   * the shipped code are still the pair the build blessed — which is exactly
   * what would silently stop being true if someone edited one of them.
   */
  const r = check(weightedLength);
  assert.equal(r.ok, true, format(r));
  assert.equal(r.total, 71);
  assert.equal(r.failed, 0);
});

test('every category declared is exercised, and none is smuggled in', () => {
  const declared = new Set(Object.keys(categories()));
  const used = new Set(vectors().map((v) => v.category));
  assert.deepEqual([...used].sort().filter((c) => !declared.has(c)), []);
  assert.deepEqual([...declared].sort().filter((c) => !used.has(c)), []);
});

/* ========================================================================== *
 * 2. The runner detects wrongness — the part that matters
 * ========================================================================== */

test('THE NAIVE CODE-POINT COUNTER FAILS 36 OF 71', () => {
  /*
   * `[...text].length` is what a wrong counter usually IS. The numbers are
   * pinned because they are the argument, and the SHAPE is the argument rather
   * than the total: it passes every plain-text case, which is why this class of
   * bug survives review and ships.
   */
  const r = check((t) => [...t].length);
  assert.equal(r.ok, false);
  assert.equal(r.failed, 36);
  assert.equal(r.passed, 35);

  assert.equal(r.byCategory.basic.failed, 0, 'plain ASCII is where a naive counter looks correct');
  assert.equal(r.byCategory['not-a-url'].failed, 0, 'it never over-counts a non-URL, because it never detects one');

  assert.equal(r.byCategory.url.failed, 20, 'every URL vector must fail — this is the undercount that gets posts rejected');
  assert.equal(r.byCategory.url.passed, 0, 'not one link vector may pass by coincidence of length');
  assert.equal(r.byCategory.heavy.failed, 4, 'every CJK vector must fail');
  assert.ok(r.byCategory.emoji.failed >= 6, 'the emoji vectors must fail');
});

test('THE UTF-16 LENGTH COUNTER FAILS DIFFERENTLY', () => {
  /*
   * `text.length` is the other classic wrong answer and it fails a DIFFERENT
   * set — over-counting astral emoji while still under-counting URLs. If both
   * naive counters produced the same report the suite would not be
   * discriminating between them, and one of these tests would be redundant.
   */
  const naive = check((t) => [...t].length);
  const utf16 = check((t) => t.length);
  assert.equal(utf16.ok, false);
  assert.notDeepEqual(
    utf16.failures.map((f) => f.name).sort(),
    naive.failures.map((f) => f.name).sort(),
  );
});

test('a counter right about everything except links is still caught', () => {
  // The dangerous shape: correct on text, wrong only on the bare domain.
  const almost = (t) => (t === 'example.com' ? 11 : weightedLength(t));
  const r = check(almost);
  assert.equal(r.ok, false);
  assert.equal(r.failures.length, 1);
  assert.equal(r.failures[0].name, 'url-bare-domain');
  assert.match(r.failures[0].why, /UNDERCOUNTS/);
});

test('A COUNTER THAT THROWS IS A FAILURE, NOT A CRASH', () => {
  const r = check(() => {
    throw new Error('boom');
  });
  assert.equal(r.failed, 71);
  assert.equal(r.failures[0].threw, 'boom');
  assert.equal(r.failures[0].actual, undefined);
});

test('a counter that throws on ONE vector still reports the other 70', () => {
  const r = check((t) => {
    if (t === '') throw new Error('empty input not supported');
    return weightedLength(t);
  });
  assert.equal(r.failed, 1);
  assert.equal(r.passed, 70);
  assert.match(r.failures[0].threw, /empty input/);
});

test('check() refuses anything that is not a function', () => {
  for (const bad of [undefined, null, 42, 'nope', {}, []]) {
    assert.throws(() => check(bad), TypeError);
  }
});

/* ========================================================================== *
 * 3. Narrowing, injection, output
 * ========================================================================== */

test('only/skip narrow by category, and the report says how many ran', () => {
  const only = check(weightedLength, { only: ['url'] });
  assert.equal(only.total, 20);
  assert.deepEqual(Object.keys(only.byCategory), ['url']);

  const skip = check(weightedLength, { skip: ['url'] });
  assert.equal(skip.total, 51);
  assert.ok(!('url' in skip.byCategory));

  assert.equal(check(weightedLength, { only: ['nonexistent'] }).total, 0);
});

test('a caller can supply their own vectors, so a browser never touches the filesystem', () => {
  /*
   * The reason `check` takes `vectors`: a page that fetched the CORS copy can
   * run the identical function. Without this the runner would be Node-only in
   * a way that mattered rather than in a way that is merely true.
   */
  const mine = [{ name: 'made-up', category: 'basic', text: 'abc', expected: 3, why: 'three Latin letters at 1 each.' }];
  const r = check(weightedLength, { vectors: mine });
  assert.equal(r.total, 1);
  assert.equal(r.ok, true);

  const bad = check(() => 999, { vectors: mine });
  assert.equal(bad.ok, false);
  assert.equal(bad.failures[0].expected, 3);
});

test('THE OUTPUT PRINTS THE ARITHMETIC, NOT JUST THE TWO NUMBERS', () => {
  const r = check((t) => [...t].length);
  const out = format(r);
  assert.ok(out.includes(r.failures[0].why), 'the failure explanation is missing from the output');
  assert.ok(out.includes(r.failures[0].name));
  assert.match(out, /FAIL/);
  assert.match(out, /url \d+\/20/, 'the per-category tally is missing');
});

test('a clean run says so and prints no failures', () => {
  const out = format(check(weightedLength));
  assert.match(out, /PASS {2}71\/71/);
  assert.ok(!out.includes('FAIL'));
});

test('format truncates long vectors instead of dumping 280 characters per failure', () => {
  assert.ok(format(check((t) => [...t].length), { maxText: 10 }).includes('…'));
});

/* ========================================================================== *
 * 4. The CLI, which is the whole integration surface for CI
 * ========================================================================== */

function runCli(body, args = []) {
  const file = path.join(ROOT, `.tmp-probe-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  try {
    writeFileSync(file, body);
    execFileSync(process.execPath, ['bin/conformance.js', `./${path.basename(file)}`, ...args], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_TEST_CONTEXT: undefined, NODE_OPTIONS: undefined },
    });
    return 0;
  } catch (err) {
    return err.status ?? -1;
  } finally {
    /*
     * Cleanup must never fail the test it is cleaning up after.
     *
     * This package is developed on a OneDrive-backed mount where `unlink`
     * returns EPERM, and the first version of this helper let that escape from
     * the `finally` block — turning it into two failing tests whose assertions
     * had both already passed. A suite reporting a filesystem restriction as a
     * defect in the CLI is worse than useless: it is the thing that teaches
     * people to skim red.
     *
     * The probe name is gitignored, so a cleanup that could not run leaves
     * nothing tracked behind.
     */
    try {
      rmSync(file, { force: true });
    } catch {
      /* see above — a file we could not delete is not a test failure */
    }
  }
}

test('THE CLI EXIT CODE DISTINGUISHES THREE OUTCOMES, NOT TWO', () => {
  /*
   * 0 passed, 1 ran and failed, 2 could not run. The third is the one that
   * matters: a broken import reported as 0 turns "we check our counter" into a
   * green tick that means nothing, which is the failure this package is named
   * after, committed by the tool doing the checking.
   */
  assert.equal(runCli('export default (t) => [...t].length;\n'), 1, 'a wrong counter must exit 1');
  assert.equal(runCli("export { weightedLength as default } from './src/index.js';\n"), 0, 'a correct counter must exit 0');
  assert.equal(runCli('export const notAFunction = 1;\n'), 2, 'an unusable module must exit 2, not 0');
});

test('the CLI refuses to guess between several exported functions', () => {
  const two = 'export const alpha = (t) => t.length;\nexport const beta = (t) => t.length;\n';
  assert.equal(runCli(two), 2, 'ambiguity must be an error, not a coin flip');
  assert.equal(runCli(two, ['alpha']), 1, 'naming the export makes it runnable');
});

test('THE COUNTER THIS PACKAGE SHIPPED WITH FAILS 15 OF 71, and passed every vector it was written with', () => {
  /*
   * The first counter in this package matched a link as "http(s):// or www.,
   * then everything up to the next space", plus bare domains on a list of 49
   * endings its author thought of. It passed all 49 of the vectors written
   * alongside it. Run against X's own library it was wrong on 30 of 54 everyday
   * link shapes, and the 22 vectors added afterwards catch it on 15.
   *
   * It is kept here, in miniature, for one reason: a suite has to be able to
   * fail the counter its own author believed in. If this stops failing, the
   * vectors that were added for it have gone.
   */
  const OLD_ENDINGS = 'com net org io co dev app ai xyz me so sh to gg ly tv fm us uk ca de fr es it nl se no jp cn in br au eu info biz news blog shop store tech design studio'.split(' ');
  const oldLink = new RegExp(
    String.raw`\b(?:https?:\/\/|www\.)[^\s<>"']+` +
      String.raw`|\b(?!\d+\.)[a-z0-9](?:[-a-z0-9]*[a-z0-9])?(?:\.[a-z0-9](?:[-a-z0-9]*[a-z0-9])?)*\.(?:${OLD_ENDINGS.join('|')})\b(?:\/[^\s<>"']*)?`,
    'gi',
  );
  const light = (cp) => cp <= 0x10ff || (cp >= 0x2000 && cp <= 0x200d) || (cp >= 0x2010 && cp <= 0x201f) || (cp >= 0x2032 && cp <= 0x2037);
  // The `v` flag is Node 20 and later. On Node 18 the old counter used a looser
  // test for "is this cluster an emoji", exactly as it did when it shipped, and
  // that test gets one more vector wrong, so the exact count is pinned only
  // where the strict test exists.
  let emoji = null;
  try {
    emoji = new RegExp('^\\p{RGI_Emoji}$', 'v');
  } catch {
    emoji = /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/u;
  }
  const strict = emoji.flags.includes('v');
  const seg = new Intl.Segmenter('en', { granularity: 'grapheme' });
  const plain = (s) => {
    let n = 0;
    for (const { segment } of seg.segment(s)) {
      if (emoji.test(segment)) n += 2;
      else for (const ch of segment) n += light(ch.codePointAt(0)) ? 1 : 2;
    }
    return n;
  };
  const old = (text) => {
    const s = text.normalize('NFC');
    let n = 0;
    let last = 0;
    for (const m of s.matchAll(oldLink)) {
      n += plain(s.slice(last, m.index)) + 23;
      last = m.index + m[0].length;
    }
    return n + plain(s.slice(last));
  };

  const r = check(old);
  if (strict) {
    assert.equal(r.failed, 15, format(r));
    // the row in the README's table
    assert.ok(readFileSync(path.join(ROOT, 'README.md'), 'utf8').includes(`| ${r.passed} / ${r.total} |`), 'the README row for the first counter is stale');
  } else {
    assert.ok(r.failed >= 15, format(r));
  }
  const failed = new Set(r.failures.map((f) => f.name));
  // the one that costs somebody a rejected post, and the two that annoy the most people
  for (const name of ['url-full-stop-is-the-281st', 'url-then-full-stop', 'not-a-url-email', 'url-filename-that-is-a-domain']) {
    assert.ok(failed.has(name), `${name} no longer catches the old counter`);
  }
  // and it still passes everything it was written with
  if (strict) {
    const original = new Set(['basic', 'heavy', 'normalisation', 'boundary', 'structural']);
    assert.deepEqual(r.failures.filter((f) => original.has(f.category)), []);
  }
});

test('THE CLI FINDS A PACKAGE FROM THE DIRECTORY IT IS RUN IN, NOT FROM WHERE IT LIVES', () => {
  /*
   * `x-conformance twitter-text getTweetLength` is the first thing anybody
   * checking this suite will try, and through npx it used to fail with "cannot
   * find package": the CLI sits in npm's cache and looked for the package
   * there. So this builds a project somewhere else entirely, with a package in
   * it that this repository has never heard of, and runs the CLI from there.
   */
  const project = mkdtempSync(path.join(os.tmpdir(), 'x-conformance-'));
  const cli = path.join(ROOT, 'bin', 'conformance.js');
  const run = (args) => {
    try {
      execFileSync(process.execPath, [cli, ...args], { cwd: project, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NODE_TEST_CONTEXT: undefined, NODE_OPTIONS: undefined } });
      return 0;
    } catch (err) {
      return err.status ?? -1;
    }
  };
  try {
    // a CommonJS package with a named function, the shape twitter-text has
    mkdirSync(path.join(project, 'node_modules', 'their-counter'), { recursive: true });
    writeFileSync(path.join(project, 'node_modules', 'their-counter', 'package.json'), JSON.stringify({ name: 'their-counter', main: 'index.js' }));
    writeFileSync(path.join(project, 'node_modules', 'their-counter', 'index.js'), 'exports.naive = (t) => [...t].length;\nexports.other = () => 0;\n');
    // an ESM-only package, which `require` cannot resolve at all
    mkdirSync(path.join(project, 'node_modules', '@scope', 'esm-counter'), { recursive: true });
    writeFileSync(
      path.join(project, 'node_modules', '@scope', 'esm-counter', 'package.json'),
      JSON.stringify({ name: '@scope/esm-counter', type: 'module', exports: { '.': { import: './counter.js' } } }),
    );
    writeFileSync(path.join(project, 'node_modules', '@scope', 'esm-counter', 'counter.js'), `export { weightedLength as default } from ${JSON.stringify(pathToFileURL(path.join(ROOT, 'src', 'index.js')).href)};\n`);

    assert.equal(run(['their-counter', 'naive']), 1, 'a package installed in the project must be found, run, and fail');
    assert.equal(run(['@scope/esm-counter']), 0, 'an ESM-only package in the project must be found, run, and pass');
    assert.equal(run(['a-package-that-is-not-there']), 2, 'a missing package is "could not run", never a pass');
  } finally {
    try {
      rmSync(project, { recursive: true, force: true });
    } catch {
      /* a directory we could not delete is not a test failure */
    }
  }
});

test('NO COMMAND IN THE README OR THE CLI ASKS THE REGISTRY FOR A PACKAGE THAT IS NOT THIS ONE', () => {
  /*
   * Every copy of the runner command once read `npx x-conformance ...`. That
   * asks the npm registry for a package named x-conformance, which this is not:
   * the command fails today, and on the day somebody registers the name it runs
   * their code on the reader's machine. The only safe spellings name this
   * repository or this package.
   */
  for (const file of ['README.md', path.join('bin', 'conformance.js')]) {
    const text = readFileSync(path.join(ROOT, file), 'utf8');
    for (const line of text.split('\n')) {
      // a line that warns against the bare form has to quote it
      if (/\bnever\b|\bdo not\b/i.test(line)) continue;
      assert.ok(!/npx\s+x-conformance\b/.test(line), `${file}: "${line.trim()}" would fetch a package called x-conformance`);
      const m = /npx\s+(?:-y\s+)?(?:-p\s+(\S+)\s+)?(\S+)/.exec(line);
      if (m) {
        const fetched = m[1] ?? m[2];
        assert.ok(/^github:postsiete\/x-weighted-length$|^x-weighted-length$/.test(fetched), `${file}: "${line.trim()}" fetches ${fetched}`);
      }
    }
  }
});

test('THE README STATES THE SCORE THE RUNNER ACTUALLY PRODUCES', () => {
  /*
   * "26 out of 49" is the argument the README opens with and the number in the
   * Show HN title. If the vectors change and the prose does not, the headline
   * becomes a lie in the one document whose subject is checking your numbers —
   * so it is derived here rather than trusted.
   *
   * The pasted sample output is checked too. A README containing invented tool
   * output is the worst possible defect in a package like this, and I know
   * because I shipped one in a draft of it the day before.
   */
  const r = check((t) => [...t].length);
  const readme = readFileSync(path.join(ROOT, 'README.md'), 'utf8');

  assert.match(readme, new RegExp(`\\*\\*${r.passed} out of ${r.total}\\*\\*`), `README score is stale: now ${r.passed}/${r.total}`);
  assert.match(readme, new RegExp(`FAIL {2}${r.failed} of ${r.total} vectors`), `README pasted output is stale: ${r.failed} failures now`);
  assert.ok(readme.includes(`| ${r.passed} / ${r.total} |`), 'the table row for the code-point counter is stale');
  assert.ok(readme.includes(`| ${r.total} / ${r.total} |`), 'the table row for this package is stale');
  assert.ok(readme.includes(`and ${r.total} conformance vectors`), 'the headline count is stale');

  // The vector quoted as JSON is the vector in the file, word for word.
  const quoted = JSON.parse(/```json\n([\s\S]*?)\n```/.exec(readme)[1]);
  const { name, category, text, expected, why } = vectors().find((v) => v.name === quoted.name);
  assert.deepEqual(quoted, { name, category, text, expected, why }, 'the vector quoted in the README is not the one in vectors.json');

  const tally = Object.entries(r.byCategory).map(([n, c]) => `${n} ${c.passed}/${c.total}`);
  for (const line of tally) {
    assert.ok(readme.includes(line), `README's per-category output is stale — "${line}" is not in it`);
  }

  const bare = r.failures.find((f) => f.name === 'url-bare-domain');
  assert.ok(
    readme.includes(`expected  ${bare.expected}, got ${bare.actual}`),
    'the pasted url-bare-domain failure does not match what the runner prints',
  );
});

test('the README acknowledges that twitter-text ships its own conformance tests', () => {
  /*
   * Somebody will raise it on HN. Being the one who raised it first is the only
   * version of that exchange worth having, and "nobody else publishes vectors"
   * is both false and exactly the claim that would destroy a package whose
   * entire subject is being checkable.
   */
  const readme = readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const section = readme.slice(readme.indexOf('## What this is not'));
  assert.ok(section.length > 200, 'the README lost its "What this is not" section');
  for (const claim of [/twitter-text/, /Apache 2\.0/, /conformance tests/, /validate\.yml/]) {
    assert.match(section, claim, `the acknowledgement must state ${claim}`);
  }
});

test('REBUILDING THE VECTORS CHANGES NOTHING WHEN NOTHING CHANGED', () => {
  /*
   * CI runs `node vectors/build.js` then `git diff --exit-code vectors.json`.
   * That check is only meaningful if the build is a pure function of the
   * vectors — and it was not. `generated` was stamped with `new Date()`, so on
   * the day after the last commit the rebuild produced a different file, the
   * diff was non-empty, and CI went red reporting "the committed vectors
   * drifted from what build.js derives". Every day. Forever. On a repository
   * whose whole argument is that it checks things rather than trusting them,
   * and with an alarming message for a reason that was purely the calendar.
   *
   * The date is now preserved when the content is unchanged, which also makes
   * the field mean what every reader already assumed it meant: when these
   * expectations last moved, not when a script last ran.
   *
   * Asserted by running the real build, because the bug was in the real build.
   */
  const file = path.join(ROOT, 'vectors', 'vectors.json');
  const before = readFileSync(file);
  execFileSync(process.execPath, ['vectors/build.js'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NODE_TEST_CONTEXT: undefined, NODE_OPTIONS: undefined },
  });
  const after = readFileSync(file);
  assert.ok(
    before.equals(after),
    'rebuilding changed vectors.json without the vectors changing — CI\'s drift check will go red for a reason that is not drift',
  );
});

test('SELFCHECK RUNS THE SHIPPED LIBRARY THROUGH THE SHIPPED CLI', () => {
  /*
   * `npm run selfcheck` is what the README tells a sceptic to run. If the
   * wiring between bin/, src/conformance.js and vectors/ ever breaks, it breaks
   * for them before it breaks for us, so it is pinned here.
   */
  const out = execFileSync(process.execPath, ['bin/conformance.js', './src/index.js', 'weightedLength'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, NODE_TEST_CONTEXT: undefined, NODE_OPTIONS: undefined },
  });
  assert.match(out, /PASS {2}71\/71/);
});
