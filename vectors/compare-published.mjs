/**
 * Does the published copy still agree with the shipped copy?
 *
 * ---------------------------------------------------------------------------
 * THE FAILURE THIS CATCHES
 * ---------------------------------------------------------------------------
 *
 * The same vectors exist in two places on purpose:
 *
 *   vectors/vectors.json                            shipped in this package
 *   https://postsiete.com/tools/x-vectors.json      the CORS URL other people
 *                                                   fetch into their own suites
 *
 * They are generated from the same reasoning and they are meant to be the same
 * tests. Nothing in either repository can notice when they stop being, because
 * neither can see the other — and "two copies that quietly stop agreeing" is the
 * exact failure this whole project was built to document. Reproducing it one
 * level up, in the artefact that warns about it, would be the most embarrassing
 * possible outcome.
 *
 * So CI fetches the published file and compares the part that must match: every
 * vector's name, text, expected value and stated arithmetic. The ENVELOPE is
 * allowed to differ — the published copy carries `license`, `source` and `check`
 * fields that the package does not need — because those are metadata about where
 * the file lives, not claims about what X charges.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS ALLOWED TO FAIL NOISILY
 * ---------------------------------------------------------------------------
 *
 * It is a network call in CI, so it can fail for reasons that are nobody's
 * fault. It is therefore its own job rather than a step in the matrix build: a
 * DNS blip should not hide a real test failure, and a real disagreement should
 * not be buried under three Node versions of green.
 *
 *   node vectors/compare-published.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLISHED = process.env.VECTORS_URL || 'https://postsiete.com/tools/x-vectors.json';

/** The fields that are a claim about X's behaviour. Everything else is bookkeeping. */
const CLAIMS = ['name', 'category', 'text', 'expected', 'why'];

const pick = (v) => Object.fromEntries(CLAIMS.map((k) => [k, v[k]]));

const mine = JSON.parse(readFileSync(path.join(HERE, 'vectors.json'), 'utf8')).vectors;

let theirs;
try {
  const res = await fetch(PUBLISHED, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  theirs = (await res.json()).vectors;
} catch (err) {
  console.error(`Could not fetch ${PUBLISHED}: ${err.message}`);
  console.error('This is a network failure, not a disagreement. Re-run the job.');
  process.exit(2); // 2 = could not check. 1 is reserved for "checked, and they differ".
}

if (!Array.isArray(theirs)) {
  console.error(`${PUBLISHED} did not return a vectors array.`);
  process.exit(2);
}

const byName = new Map(theirs.map((v) => [v.name, v]));
const problems = [];

for (const v of mine) {
  const other = byName.get(v.name);
  if (!other) {
    problems.push(`${v.name}: shipped here, missing from the published file`);
    continue;
  }
  byName.delete(v.name);
  for (const k of CLAIMS) {
    if (JSON.stringify(other[k]) !== JSON.stringify(v[k])) {
      problems.push(`${v.name}.${k}\n    package:   ${JSON.stringify(v[k])}\n    published: ${JSON.stringify(other[k])}`);
    }
  }
}
for (const name of byName.keys()) {
  problems.push(`${name}: in the published file, not shipped here`);
}

if (problems.length) {
  console.error(`\nThe published vectors and the shipped vectors disagree (${problems.length} difference(s)).\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    '\nOne of the two was edited without the other. Decide which is right, fix it there,\n' +
      'run `node vectors/build.js`, and republish — do NOT make them agree by copying,\n' +
      'because a copy hides which one was wrong.\n',
  );
  process.exit(1);
}

console.log(`${mine.length} vectors: package and ${PUBLISHED} agree on every name, text, expected value and stated arithmetic.`);
