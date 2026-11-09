// Exploratory real-action experiment, not a replacement calibration recorder.
// From repo root: node tools/run-supported.mjs research/later-era-banking-experiment/run.mjs
// Audit retained original records without walks: append --audit .dev/banking-experiment
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compileEngineTo } from '../../tools/dev/compile-engine.mjs';

const audit = process.argv[2] === '--audit';
const output = resolve(audit ? (process.argv[3] ?? '.dev/banking-experiment') : '.dev/banking-experiment-replay');
const root = new URL('./', import.meta.url);
const load = async path => JSON.parse(await readFile(path, 'utf8'));
const evidence = await load(new URL('results.json', root));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const comparisonHash = state => hash({ ...state,
  achievements: Object.keys(state.achievements).sort(),
  chordDiscovery: Object.fromEntries(Object.entries(state.chordDiscovery).map(([key, value]) =>
    [key, { ...value, firstFormedAt: 0 }])),
});
const banks = record => record.events.filter(event => event.kind === 'prestige' && event.ok);
await mkdir(output, { recursive: true });
const entry = resolve(output, 'entry.ts');
// The entry is in .dev/<output>/, two levels below the repository root.
await writeFile(entry, "export { continuePlaythrough, playthroughSource, stateNumbersFinite } from '../../src/engine/playthrough';\nexport { DEFAULT_ALLOCATION_BUDGET } from '../../src/engine/allocation';\n");
const bundle = await compileEngineTo(entry, 'experiment', resolve(output, 'audit-bundle'));
const engine = await import(pathToFileURL(bundle).href);
assert.deepEqual(engine.playthroughSource(), evidence.source, 'compiled source must match the experiment');
assert.deepEqual(engine.DEFAULT_ALLOCATION_BUDGET, evidence.solver);
assert.equal(process.version, evidence.environment.node);
assert.equal(Intl.DateTimeFormat().resolvedOptions().timeZone, evidence.environment.timeZone);

function verifyRecord(record, input) {
  assert.deepEqual(record.source, evidence.source);
  assert.deepEqual(record.snapshots[0].state, input, 'exact input, without normalization');
  assert.ok(record.snapshots.every(snapshot => engine.stateNumbersFinite(snapshot.state)));
  const earned = record.state.totalEarned - input.totalEarned;
  assert.ok(Math.abs(earned - record.earnedNous) <= Math.max(1, earned, record.earnedNous) * 1e-12);
}
async function execute(name, recipe, input) {
  const original = JSON.stringify(input);
  const path = resolve(output, `${name}.json`);
  const record = audit ? await load(path) : engine.continuePlaythrough(recipe, input, evidence.source);
  assert.equal(JSON.stringify(input), original, 'caller input is not mutated');
  assert.deepEqual(record.recipe, recipe);
  verifyRecord(record, input);
  if (!audit) await writeFile(path, JSON.stringify(record));
  return record;
}

for (const specimen of evidence.cases) {
  const input = await load(new URL(`${specimen.name}-input.json`, root));
  assert.equal(hash(input), specimen.inputHash);
  const branches = [];
  for (const expected of specimen.branches) {
    const name = `${specimen.name}-target-${expected.recipe.claimTarget}`;
    console.log(audit ? 'audit' : 'run', name);
    const record = await execute(name, expected.recipe, input);
    assert.equal(record.creditedSeconds / 3600, expected.creditedHours);
    assert.deepEqual(record.claims, expected.claims);
    assert.equal(record.state.world.frontier, expected.frontier);
    branches.push(record);
    const after = await execute(`${name}-after`, expected.oneHourAfter.recipe, record.state);
    assert.equal(after.creditedSeconds, 3600);
    assert.deepEqual(after.claims, expected.oneHourAfter.claims);
    assert.deepEqual(after.areteSpent, expected.oneHourAfter.areteSpent);
    assert.deepEqual(after.worldDefeats, expected.oneHourAfter.defeats);
    if (audit) {
      const digest = path => readFile(path).then(bytes => createHash('sha256').update(bytes).digest('hex'));
      assert.equal(await digest(resolve(output, `${name}.json`)), expected.rawRecordSha256);
      assert.equal(await digest(resolve(output, `${name}-after.json`)), expected.rawFollowUpSha256);
    }
    console.log('banked', record.claims, 'in', record.creditedSeconds / 3600, 'credited hours; frontier', record.state.world.frontier);
  }
  const first = banks(branches[0])[0];
  const before = branches[0].snapshots[first.snapshot - 1];
  assert.ok(branches[1].snapshots.some(snapshot => snapshot.credited === before.credited &&
    comparisonHash(snapshot.state) === comparisonHash(before.state)), 'same pre-divergence state except logging timestamps');
  const index = branches[0].events.indexOf(first);
  const actionPrefix = record => record.events.slice(0, index).map(({ at, credited, kind, label, ok, reason }) =>
    ({ at, credited, kind, label, ok, reason }));
  assert.deepEqual(actionPrefix(branches[0]), actionPrefix(branches[1]));
}
console.log(audit ? 'All original input, provenance, record hashes, action prefixes and outcomes verified; no walks run.' : 'Diagnostic replay reproduced all four branch outcomes and four one-hour observations.');
