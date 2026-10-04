/**
 * Run ANY weighted-length implementation against the vectors.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS HERE AND NOT IN A SEPARATE PACKAGE
 * ---------------------------------------------------------------------------
 *
 * The obvious objection to a conformance suite that ships beside an
 * implementation is that it cannot be neutral — that a package supplying both
 * the answer and the test is grading its own homework.
 *
 * The objection is right about where independence has to live, and wrong about
 * where it does live. It is not in keeping the two in separate tarballs. It is
 * in how the expected values were DERIVED, and `vectors/build.js` is the thing
 * that settles it: every expected value is written as arithmetic from the
 * published rules, in the `why` field, and the build refuses to write the file
 * when the reference implementation disagrees with that arithmetic. A suite
 * generated FROM the code it tests passes forever, including on the day the
 * code becomes wrong. This one cannot be generated that way by construction.
 *
 * So the vectors are already independent of `src/index.js`, and splitting them
 * into a second package would buy the appearance of neutrality at the cost of
 * a second copy of the vectors to keep in sync — which is the same "two copies
 * that quietly stop agreeing" failure this whole project exists to document,
 * committed one level up.
 *
 * What this file adds is the part the package genuinely could not do before:
 * point the suite at SOMEBODY ELSE'S counter.
 *
 * ---------------------------------------------------------------------------
 * NODE ONLY, DELIBERATELY
 * ---------------------------------------------------------------------------
 *
 * This module reads the vectors from disk, so it is a Node module. That is the
 * right trade for a test tool. A browser that wants to run the same check
 * imports the JSON directly (`x-weighted-length/vectors`) or fetches the
 * CORS-enabled copy, and passes it in as `options.vectors` — `check()` never
 * touches the filesystem when you give it a suite.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

let _suite = null;
/** The bundled suite, read once. */
function bundled() {
  if (_suite === null) {
    _suite = JSON.parse(readFileSync(path.join(HERE, '..', 'vectors', 'vectors.json'), 'utf8'));
  }
  return _suite;
}

/** The vectors as shipped. */
export function vectors() {
  return bundled().vectors;
}

/** What each category is for, one sentence each. */
export function categories() {
  return bundled().categories;
}

/**
 * Check a counter against the suite.
 *
 * @param {(text: string) => number} counter
 *   The function under test. Called once per vector.
 * @param {{ vectors?: object[], only?: string[], skip?: string[] }} [options]
 *   `vectors` overrides the bundled suite — pass a fetched copy in a browser,
 *   or a narrowed set of your own. `only`/`skip` take CATEGORY names; a green
 *   run on a narrowed suite is not a green run, and the report says so by
 *   reporting how many vectors it actually ran.
 * @returns {Report}
 */
export function check(counter, options = {}) {
  if (typeof counter !== 'function') {
    throw new TypeError('check(counter): counter must be a function (text: string) => number');
  }
  const suite = options.vectors ?? vectors();
  const only = options.only ? new Set(options.only) : null;
  const skip = options.skip ? new Set(options.skip) : null;

  const results = [];
  for (const v of suite) {
    if (only && !only.has(v.category)) continue;
    if (skip && skip.has(v.category)) continue;

    let actual;
    let threw = null;
    try {
      actual = counter(v.text);
    } catch (err) {
      /*
       * A counter that throws is a FAILURE, not a crash of the runner. Real
       * implementations throw on lone surrogates and on empty input, and an
       * exception that escapes here tells you about one vector instead of all
       * of them — the least useful possible moment to give up.
       */
      threw = err instanceof Error ? err.message : String(err);
    }
    results.push({ ...v, actual: threw === null ? actual : undefined, threw, passed: threw === null && actual === v.expected });
  }

  const failures = results.filter((r) => !r.passed);
  const byCategory = {};
  for (const r of results) {
    const c = (byCategory[r.category] ??= { total: 0, passed: 0, failed: 0 });
    c.total += 1;
    if (r.passed) c.passed += 1;
    else c.failed += 1;
  }

  return {
    ok: failures.length === 0,
    total: results.length,
    passed: results.length - failures.length,
    failed: failures.length,
    byCategory,
    results,
    failures,
  };
}

/**
 * Render a report as text.
 *
 * Every failure prints the ARITHMETIC behind the expected value, not just the
 * two numbers. "expected 2, got 7" tells you that you are wrong. The `why`
 * tells you which rule you missed, and distinguishes the two different ways of
 * being wrong that produce two different numbers — which is the only part
 * anyone can act on.
 *
 * @param {Report} report
 * @param {{ color?: boolean, maxText?: number }} [options]
 * @returns {string}
 */
export function format(report, options = {}) {
  const color = options.color ?? false;
  const maxText = options.maxText ?? 48;
  const red = (s) => (color ? `[31m${s}[0m` : s);
  const green = (s) => (color ? `[32m${s}[0m` : s);
  const dim = (s) => (color ? `[2m${s}[0m` : s);

  const lines = [`x-weighted-length conformance — ${report.total} vectors`, ''];

  for (const f of report.failures) {
    const shown = [...f.text].length > maxText ? `${[...f.text].slice(0, maxText).join('')}…` : f.text;
    lines.push(red(`FAIL  ${f.name}  [${f.category}]`));
    lines.push(`      text      ${JSON.stringify(shown)}`);
    lines.push(f.threw !== null ? `      threw     ${f.threw}` : `      expected  ${f.expected}, got ${f.actual}`);
    lines.push(dim(`      why       ${f.why}`));
    lines.push('');
  }

  lines.push(
    Object.entries(report.byCategory)
      .map(([name, c]) => `${name} ${c.passed}/${c.total}`)
      .join('   '),
  );
  lines.push('');
  lines.push(report.ok ? green(`PASS  ${report.passed}/${report.total}`) : red(`FAIL  ${report.failed} of ${report.total} vectors`));
  return lines.join('\n');
}

/**
 * @typedef {object} Result
 * @property {string} name
 * @property {string} category
 * @property {string} text
 * @property {number} expected
 * @property {number|undefined} actual
 * @property {string|null} threw
 * @property {string} why
 * @property {boolean} passed
 */

/**
 * @typedef {object} Report
 * @property {boolean} ok
 * @property {number} total
 * @property {number} passed
 * @property {number} failed
 * @property {Record<string, {total: number, passed: number, failed: number}>} byCategory
 * @property {Result[]} results
 * @property {Result[]} failures
 */
