// Explicit, long-running evidence tier for the century calibration
// (issue #492). Compile with Vite's real glob/raw transforms so a
// recording's fingerprint certifies the compiled engine — one identity
// with the suite, dev server, and build since #503's fix — then record
// the same functions the tests exercise. No listening server.
//
//   node tools/record-century.mjs slice <25|60>:<prompt|pushing|support|combat|ignoring>
//   node tools/record-century.mjs fixture <raw|collection-reset>
//   node tools/record-century.mjs compose
//
// The ten slices (two session shapes × five policies, eight seeds each)
// run independently. Record both fixture variants before composing; compose
// reads their evidence and writes the frozen calibration baseline.
//
// The smoke tier (issue #506) drives the same pipeline — argument
// validation, this compile, one bounded walk, the slice payload, and
// composition — in seconds, publishing only into isolated output:
//
//   node tools/record-century.mjs smoke slice
//   node tools/record-century.mjs smoke compose
//
// Smoke artifacts carry smoke names and tier "smoke"; the production
// compose refuses them outright.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { compileEngine } from "./dev/compile-engine.mjs";
import {
  assertNotSmokeTier,
  assertSameCompiledSource,
  assertSmokeTier,
  composeRecordingPayload,
  readRecordingFile,
  recordingPayload,
  refuseExistingArtifact,
  requireRuntimeEnvironment,
  resolveSmokeRoot,
} from "./dev/runtime.mjs";

const SCRIPT_NAME = "record-century";
const [command, arg] = process.argv.slice(2);
const SLICE_PATTERN = /^(25|60):(prompt|pushing|support|combat|ignoring)$/;
const FIXTURE_VARIANTS = ["raw", "collection-reset"];
const SMOKE_LEGS = ["slice", "compose"];
const usageError = () => new Error("Usage: node tools/record-century.mjs slice <25|60>:<policy> | fixture <raw|collection-reset> | compose | smoke <slice|compose>");

// The recorded fixture row's shared checks: currency integrity, finite
// snapshots, intact serialized round trips, and the variant's own strand
// or bank shape (the raw position's strand is the recorded limitation the
// save translation, issue #493, exists to repair — never silently
// repaired here).
const assertFixtureRecord = (variant, measurementVersion) => (row) => {
  assert.equal(row.measurementVersion, measurementVersion,
    "legacy fixture gap measurements require re-recording");
  assert.equal(row.kind, "continuation");
  assert.equal(row.noGrant, true);
  assert.equal(row.numeric.finiteSnapshots, true);
  assert.equal(row.numeric.serializedOk, row.numeric.serializedChecks);
  assert.equal(row.eras.filter(era => era.claim !== null).length, row.claims.length);
  if (variant === "raw") {
    assert.ok(row.claims[0] > 12, `raw fixture's first claim ${row.claims[0]}`);
    assert.ok(row.eras.at(-1).claim === null, "the raw position's later era stays open at the mark");
  } else {
    assert.ok(row.claims.length >= 1, "the collection-reset position banks calibrated claims");
    let frontier = 0;
    for (const era of row.eras) {
      if (era.claim === null) continue;
      assert.ok(era.frontierAfter > frontier);
      frontier = era.frontierAfter;
    }
  }
};

// The mechanical per-walk checks both the matrix slices and the smoke
// walk validate (issue #506): finite state and rate at every snapshot,
// event credit matching its snapshot, and the prior depth's credit
// carried into the era.
const assertCenturyWalkMechanics = (m, record) => {
  for (const snapshot of record.snapshots) {
    assert.equal(m.stateNumbersFinite(snapshot.state), true, "the recorded state stayed finite");
    assert.ok(Number.isFinite(snapshot.rate), "the credited rate stayed finite");
  }
  for (const event of record.events) assert.equal(record.snapshots[event.snapshot].credited, event.credited);
  for (const era of record.eras) {
    if (era.priorDepthPassed) assert.equal(era.familiarCredited, era.priorDepthPassed.credited);
  }
};

// The row core both the matrix rows and the smoke row validate (issue
// #506): measurement currency, currency integrity, finite snapshots,
// intact serialized round trips, the claims/eras alignment, and strict
// frontier advance at every closed era.
const assertCenturyRowCore = (m, row) => {
  assert.equal(row.measurementVersion, m.CENTURY_MEASUREMENT_VERSION,
    "legacy gap measurements require re-recording; do not compose them as current evidence");
  assert.equal(row.kind, "representative");
  assert.equal(row.noGrant, true);
  assert.equal(row.numeric.finiteSnapshots, true);
  assert.equal(row.numeric.serializedChecks > 0, true);
  assert.equal(row.numeric.serializedOk, row.numeric.serializedChecks);
  assert.equal(row.eras.filter(era => era.claim !== null).length, row.claims.length);
  let frontier = 0;
  for (const era of row.eras) {
    if (!era.claim) continue;
    assert.equal(era.finite, true);
    assert.ok(era.frontierAfter > frontier);
    frontier = era.frontierAfter;
  }
};

// The smoke row's own checks (issue #506): the walk completed at its
// declared credited bound and stays far under the calibration mark — the
// bounded seam cannot pass a smoke row off as calibration evidence.
const assertSmokeRow = (m, row) => {
  assertCenturyRowCore(m, row);
  assert.equal(row.complete, true, "the smoke walk completes at its declared bound");
  assert.equal(row.stopKind, "century", "the smoke walk completes at its declared credited stop");
  assert.ok(row.creditedHours >= m.CENTURY_SMOKE.stopCreditedHours, `credited ${row.creditedHours} below the smoke bound`);
  assert.ok(row.creditedHours < m.CENTURY_MARK_HOURS, "a smoke row stays under the calibration mark — it is not calibration evidence");
};

// The smoke tier (issue #506): the recording pipeline's own path —
// argument validation, the compile, one bounded walk, the slice payload,
// and composition — published only into isolated output. The compose leg
// refuses an incomplete or corrupted slice before compiling anything.
async function runSmoke(leg, commit) {
  const root = await resolveSmokeRoot("flowsynth-century-smoke-");
  const slicePath = join(root, "century-smoke-slice.json");
  const reportPath = join(root, "century-smoke-report.json");
  if (leg === "slice") {
    await refuseExistingArtifact(slicePath, "the century smoke slice");
    const m = await compileEngine("tools/century.ts", "century");
    const source = m.playthroughSource();
    const t0 = performance.now();
    const record = m.runPlaythrough(m.centurySmokeRecipe());
    assertCenturyWalkMechanics(m, record);
    const row = m.centuryRow(m.CENTURY_SMOKE.seed, m.CENTURY_SMOKE.sessionMinutes, record);
    assertSmokeRow(m, row);
    // Issue #505: every recording names the runtime and timezone it ran on.
    await writeFile(slicePath, JSON.stringify(recordingPayload({
      tier: "smoke",
      source,
      recordingCommit: commit,
      minutes: m.CENTURY_SMOKE.sessionMinutes,
      policy: m.CENTURY_SMOKE.policyId,
      rows: [row],
    }), null, 2));
    console.log(`smoke slice: seed ${row.seed} completed at its declared credited stop, ${row.creditedHours} credited h, ${dt(t0)} — ${slicePath}`);
    return;
  }
  // Cheap failures first: the slice is read and its JSON parsed before
  // the engine compiles, so an incomplete input is refused in
  // milliseconds with its remedy.
  const recorded = await readRecordingFile(slicePath, {
    what: "the century smoke slice",
    remedy: "record it with: node tools/record-century.mjs smoke slice",
  });
  const m = await compileEngine("tools/century.ts", "century");
  const source = m.playthroughSource();
  assertSmokeTier(recorded, slicePath);
  assertSameCompiledSource(recorded.source, source, slicePath);
  assert.equal(typeof recorded.recordingCommit, "string", "the smoke slice names its recording commit");
  execFileSync("git", ["merge-base", "--is-ancestor", recorded.recordingCommit, commit], { stdio: "pipe" });
  assert.equal(recorded.minutes, m.CENTURY_SMOKE.sessionMinutes,
    "the smoke slice's recipe is not the declared smoke recipe — stale recipe evidence cannot compose; re-record it with: node tools/record-century.mjs smoke slice");
  assert.equal(recorded.policy, m.CENTURY_SMOKE.policyId,
    "the smoke slice's recipe is not the declared smoke recipe — stale recipe evidence cannot compose; re-record it with: node tools/record-century.mjs smoke slice");
  assert.equal(recorded.rows?.length, 1, "the smoke slice carries exactly one bounded walk");
  assertSmokeRow(m, recorded.rows[0]);
  await refuseExistingArtifact(reportPath, "the century smoke report");
  await writeFile(reportPath, JSON.stringify(composeRecordingPayload({
    tier: "smoke",
    recordingCommit: commit,
    smoke: m.CENTURY_SMOKE,
    runs: recorded.rows,
  }, [{ path: slicePath, recording: recorded }]), null, 2));
  console.log(`smoke report: composed the bounded walk — ${reportPath}`);
}

async function main() {
  // Cheap failures first: the argument surface is validated before the
  // runtime gate, git, or any compile (issue #506).
  if (
    command !== "compose" &&
    !(command === "slice" && SLICE_PATTERN.test(arg ?? "")) &&
    !(command === "fixture" && FIXTURE_VARIANTS.includes(arg ?? "")) &&
    !(command === "smoke" && SMOKE_LEGS.includes(arg ?? ""))
  ) {
    throw usageError();
  }
  await requireRuntimeEnvironment();
  // Production recordings publish committed evidence, so they require a
  // clean tree: the recording commit identifies exactly the recorded
  // source. The smoke tier publishes only into isolated output and runs
  // on dirty worktrees too — mid-development suites include it (issue #506).
  if (command !== "smoke") {
    execFileSync("git", ["diff", "--exit-code", "HEAD", "--", "src", "tools"], { stdio: "pipe" });
  }
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (command === "smoke") return runSmoke(arg, commit);
  const m = await compileEngine("tools/century.ts", "century");
  const source = m.playthroughSource();
  const slicePath = (minutes, policy) => `docs/century-slice-${minutes}-${policy}.json`;

  const assertRows = (rows, minutes, policy) => {
    assert.deepEqual(rows.map(row => row.seed), m.CENTURY_SEEDS);
    for (const row of rows) {
      assertCenturyRowCore(m, row);
      assert.equal(row.sessionMinutes, minutes);
      assert.equal(row.policy, policy);
      // The century stop is the walk's declared completion.
      assert.equal(row.complete, true);
      assert.equal(row.stopKind, "century");
      assert.ok(row.creditedHours >= m.CENTURY_MARK_HOURS, `credited ${row.creditedHours} below the mark`);
      // The policy's own faces. The prompt door's first crossing banks
      // the honest zero on the baseline schedule; a single long session
      // can carry an era past the entry depth before its first door, so
      // the long-session slices assert only the door-banking shape.
      if (policy === "prompt" && minutes === 25) assert.equal(row.claims[0], 0, "the prompt door's honest zero");
      if (policy === "ignoring") {
        // The postponed-combat faces: no defeats, and no World product
        // ever bought or deployed. Board modules still place — the
        // era views' placements count them, so the World faces read
        // off the investment timeline and the route lines instead.
        assert.deepEqual(row.defeats, []);
        for (const entry of row.investments) assert.ok(!entry.key.startsWith("Charge Column") && entry.key !== "Hone ladder");
        for (const era of row.eras) {
          for (const line of era.purchases) {
            assert.ok(!line.startsWith("World Column") && !line.startsWith("Hone rank"), line);
          }
        }
      }
      // Whole-run waits cross bank boundaries; per-era waits are clipped.
      // They need not have the same long-gap count. A long wait is an
      // evaluation failure, not a reason to discard the evidence row.
      assert.equal(row.decisionGapsOk, row.gaps.longCount === 0);
      if (!row.decisionGapsOk) console.warn(`${minutes}:${policy} seed ${row.seed}: FAIL — ${row.gaps.longCount} long decision gap(s)`);
    }
  };

  if (command === "slice") {
    const [raw, policy] = arg.split(":");
    const minutes = Number(raw);
    const rows = [];
    for (const seed of m.CENTURY_SEEDS) {
      const t0 = performance.now();
      const recipe = m.centuryRecipe(seed, minutes, policy);
      const record = m.runPlaythrough(recipe);
      assertCenturyWalkMechanics(m, record);
      rows.push(m.centuryRow(seed, minutes, record));
      console.log(`${arg} seed ${seed}: ${record.claims.length} banks, frontier ${record.state.world.frontier}, ${record.days}d, ${dt(t0)} — ${record.stop.kind}`);
    }
    assertRows(rows, minutes, policy);
    // Issue #505: every recording names the runtime and timezone it ran on.
    await writeFile(slicePath(minutes, policy), JSON.stringify(recordingPayload({ source, recordingCommit: commit, minutes, policy, rows }), null, 2));
  } else if (command === "fixture") {
    // The anonymized supplied-board fixture's declared walks are their own
    // recording unit: the retained board's certified-allocation cost makes
    // each walk tens of minutes of work, so an interruption loses at most
    // its own variant, and the compose pass reads the recorded pair.
    const variant = arg;
    const t0 = performance.now();
    const record = m.suppliedBoardRecord(variant);
    const row = { ...m.centuryRow(m.CENTURY_SEEDS[0], m.CENTURY_SESSION_MINUTES.long, record), note: `${variant}: ${m.playthroughNote(record)}` };
    assertFixtureRecord(variant, m.CENTURY_MEASUREMENT_VERSION)(row);
    await writeFile(`docs/century-fixture-${variant}.json`, JSON.stringify(recordingPayload({ source, recordingCommit: commit, variant, row }), null, 2));
    console.log(`fixture ${variant}: ${row.claims.length} bank(s), ${row.creditedHours} credited h, ${dt(t0)}`);
  } else {
    const runs = [];
    const inputs = [];
    for (const minutes of [25, 60]) for (const policy of m.CENTURY_POLICIES) {
      const recorded = await readRecordingFile(slicePath(minutes, policy), {
        what: "the century slice",
        remedy: `record it with: node tools/record-century.mjs slice ${minutes}:${policy}`,
      });
      // Each slice carries its own recording commit and the compiled
      // engine fingerprint. Composition verifies the fingerprint byte for
      // byte and the commit's ancestry: a slice recorded on an ancestor
      // whose engine source compiled identically is the same evidence
      // (the recorder-fix commits landed between slices). Smoke evidence
      // is refused outright — it never joins the matrix.
      assertNotSmokeTier(recorded, slicePath(minutes, policy));
      assertSameCompiledSource(recorded.source, source, slicePath(minutes, policy));
      execFileSync("git", ["merge-base", "--is-ancestor", recorded.recordingCommit, commit], { stdio: "pipe" });
      assertRows(recorded.rows, minutes, policy);
      inputs.push({ path: slicePath(minutes, policy), recording: recorded });
      runs.push(...recorded.rows);
    }
    const report = m.centuryReport(runs);
    // The anonymized supplied-board fixture's two recorded walks (their
    // own recording units — the retained board's certified-allocation
    // cost makes each a tens-of-minutes walk). Both ride kind
    // "continuation" and never join the matrix.
    const fixturePath = variant => `docs/century-fixture-${variant}.json`;
    const fixtures = {};
    for (const variant of FIXTURE_VARIANTS) {
      const recorded = await readRecordingFile(fixturePath(variant), {
        what: "the century fixture",
        remedy: `record it with: node tools/record-century.mjs fixture ${variant}`,
      });
      assertNotSmokeTier(recorded, fixturePath(variant));
      assertSameCompiledSource(recorded.source, source, fixturePath(variant));
      execFileSync("git", ["merge-base", "--is-ancestor", recorded.recordingCommit, commit], { stdio: "pipe" });
      assert.equal(recorded.variant, variant);
      assertFixtureRecord(variant, m.CENTURY_MEASUREMENT_VERSION)(recorded.row);
      inputs.push({ path: fixturePath(variant), recording: recorded });
      fixtures[variant] = recorded.row;
      console.log(`fixture ${variant}: ${recorded.row.claims.length} bank(s), ${recorded.row.creditedHours} credited h`);
    }

    const baseline = m.calibrationBaseline();
    const representative = runs.find(row => row.seed === 468 && row.sessionMinutes === 60 && row.policy === "support");
    assert.ok(representative, "the representative run recorded");
    const results = composeRecordingPayload({
      ...report,
      recordingCommit: commit,
      fixtures: {
        raw: { ...fixtures.raw, trajectory: fixtures.raw.trajectory.filter((_, index) => index % 4 === 0) },
        collectionReset: { ...fixtures["collection-reset"], trajectory: fixtures["collection-reset"].trajectory.filter((_, index) => index % 4 === 0) },
      },
      representative: {
        seed: representative.seed,
        sessionMinutes: representative.sessionMinutes,
        policy: representative.policy,
        runIdNote: "the composed rows carry their recipes; this names the baseline's reference walk",
        claims: representative.claims,
        frontiers: representative.frontiers,
        creditedHours: representative.creditedHours,
      },
    }, inputs);
    await writeFile(process.env.FLOWSYNTH_CENTURY_REPORT || "docs/century-calibration-results.json", JSON.stringify(results, null, 2));
    await writeFile("docs/century-calibration-baseline.json", JSON.stringify(composeRecordingPayload({
      ...baseline,
      recordingCommit: commit,
      results: "docs/century-calibration-results.json",
      representative: results.representative,
      limitations: [
        "The claim curve's entry depth and the opening era's 8-12 credited-hour window are #490's calibration, unchanged here.",
        "On the fresh-start matrix walks the roster's reachable span is w0-w6: the enemy ladder's two upper decades (w7, w8) sit past the 100-credited-hour horizon at opening-era production. The retained collection-reset fixture, whose mature tiers compound faster, reaches the whole roster (w0-w8) inside its 100 credited hours.",
        "Later eras lengthen as the board matures: the recorded distributions carry every over-window and open era explicitly.",
        "The prompt door policy banks the honest zero at every early crossing and cannot sustain century-scale progression; its runs are recorded, not repaired.",
        "The raw supplied-board position strands its frontier past the calibrated curve's reach; the translation that repairs it is issue #493's work, grounded in the baseline's frozen figures.",
        "The Arete product ladders (Hone, Chord Catalysts, Expansion Bays) saturate inside the century; Charge Columns remain the open-ended sink.",
      ],
    }, inputs)));
    console.log(`Recorded ${runs.length} matrix walks, the fixture pair, and the frozen baseline.`);
  }
}

try {
  await main();
} catch (error) {
  console.error(`${SCRIPT_NAME}: ${error?.message ?? error}`);
  process.exit(1);
}

function dt(from) {
  const seconds = (performance.now() - from) / 1000;
  return seconds >= 60 ? `${(seconds / 60).toFixed(1)}m` : `${seconds.toFixed(0)}s`;
}
