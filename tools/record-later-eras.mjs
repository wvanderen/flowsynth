// Explicit, long-running evidence tier. Compile with Vite's real glob/raw
// transforms so a recording's fingerprint certifies the compiled engine —
// one identity with the suite, dev server, and build since #503's fix
// made that fingerprint content-sensitive in every path — then record the
// same functions the tests exercise. No listening server.
//
//   node tools/record-later-eras.mjs slice <25|60>:<support|combat|ignoring>
//   node tools/record-later-eras.mjs compose
//
// The smoke tier (issue #506) drives the same pipeline in seconds,
// publishing only into isolated output:
//
//   node tools/record-later-eras.mjs smoke slice
//   node tools/record-later-eras.mjs smoke compose
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
  recordingEnvironment,
  recordingPayload,
  refuseExistingArtifact,
  requireRuntimeEnvironment,
  resolveSmokeRoot,
} from "./dev/runtime.mjs";

const SCRIPT_NAME = "record-later-eras";
const [command, slice] = process.argv.slice(2);
const SLICE_PATTERN = /^(25|60):(support|combat|ignoring)$/;
const SMOKE_LEGS = ["slice", "compose"];
const usageError = () => new Error("Usage: node tools/record-later-eras.mjs slice <25|60>:<support|combat|ignoring> | compose | smoke <slice|compose>");

// The mechanical per-walk checks both the matrix slices and the smoke
// walk validate (issue #506): finite state and rate at every snapshot,
// event credit matching its snapshot, the prior depth's credit carried
// into the era, and every era's defeats read off its own pre-bank board.
const assertLaterEraWalkMechanics = (m, record) => {
  // Every era owns its actual end-of-era kills, including repeated
  // enemies. Check the pre-bank board, not the reset board.
  const banks = record.events.flatMap((event, index) => event.kind === "prestige" && event.ok ? [index] : []);
  for (const [index, bank] of banks.entries()) {
    const last = record.events.slice(0, bank).reverse().find(event => event.kind === "session" || event.kind === "breather");
    const state = record.snapshots[last.snapshot].state;
    const defeats = Object.entries(state.world.enemies).filter(([, enemy]) => enemy.discovered && enemy.hp === 0).map(([key]) => key);
    assert.deepEqual(m.laterEraView(record, index, null).defeats, defeats);
  }
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
// #506): currency integrity, finite banked state, the familiar/new hour
// split, and strict frontier advance at every closed era.
const assertLaterEraRowCore = (row) => {
  assert.equal(row.noGrant, true);
  let frontier = 0;
  for (const era of row.eras) {
    if (era.claim === null) continue;
    assert.equal(era.finite, true);
    if (era.index > 0) assert.ok(Math.abs(era.familiarHours + era.newHours - era.hours) < 0.02);
    assert.ok(era.frontierAfter > frontier);
    frontier = era.frontierAfter;
  }
};

// The smoke row's own checks (issue #506): the walk completed at its
// declared credited bound and stays under the later-era window's floor —
// the bounded seam cannot pass a smoke row off as later-era evidence.
const assertSmokeRow = (m, row) => {
  assertLaterEraRowCore(row);
  assert.equal(row.complete, true, "the smoke walk completes at its declared bound");
  assert.equal(row.stopKind, "century", "the smoke walk completes at its declared credited stop");
  assert.ok(row.creditedHours >= m.LATER_ERA_SMOKE.stopCreditedHours, `credited ${row.creditedHours} below the smoke bound`);
  assert.ok(row.creditedHours < m.LATER_ERA_MIN_HOURS, "a smoke row stays under the later-era window — it is not later-era evidence");
};

// The smoke tier (issue #506): the recording pipeline's own path —
// argument validation, the compile, one bounded walk, the slice payload,
// and composition — published only into isolated output. The compose leg
// refuses an incomplete or corrupted slice before compiling anything.
async function runSmoke(leg, commit) {
  const root = await resolveSmokeRoot("flowsynth-later-eras-smoke-");
  const slicePath = join(root, "later-era-smoke-slice.json");
  const reportPath = join(root, "later-era-smoke-report.json");
  if (leg === "slice") {
    await refuseExistingArtifact(slicePath, "the later-era smoke slice");
    const m = await compileEngine("tools/later-eras.ts", "later-eras");
    const source = m.playthroughSource();
    const t0 = performance.now();
    const record = m.runPlaythrough(m.laterEraSmokeRecipe());
    assertLaterEraWalkMechanics(m, record);
    const row = m.laterEraRow(m.LATER_ERA_SMOKE.seed, m.LATER_ERA_SMOKE.sessionMinutes, record);
    assertSmokeRow(m, row);
    await writeFile(slicePath, JSON.stringify(recordingPayload({
      tier: "smoke",
      source,
      recordingCommit: commit,
      minutes: m.LATER_ERA_SMOKE.sessionMinutes,
      policy: m.LATER_ERA_SMOKE.policyId,
      rows: [row],
    }), null, 2));
    console.log(`smoke slice: seed ${row.seed} completed at its declared credited stop, ${row.creditedHours} credited h, ${dt(t0)} — ${slicePath}`);
    return;
  }
  // Cheap failures first: the slice is read and its JSON parsed before
  // the engine compiles, so an incomplete input is refused in
  // milliseconds with its remedy.
  const recorded = await readRecordingFile(slicePath, {
    what: "the later-era smoke slice",
    remedy: "record it with: node tools/record-later-eras.mjs smoke slice",
  });
  const m = await compileEngine("tools/later-eras.ts", "later-eras");
  const source = m.playthroughSource();
  assertSmokeTier(recorded, slicePath);
  assertSameCompiledSource(recorded.source, source, slicePath);
  assert.equal(typeof recorded.recordingCommit, "string", "the smoke slice names its recording commit");
  execFileSync("git", ["merge-base", "--is-ancestor", recorded.recordingCommit, commit], { stdio: "pipe" });
  assert.equal(recorded.minutes, m.LATER_ERA_SMOKE.sessionMinutes,
    "the smoke slice's recipe is not the declared smoke recipe — stale recipe evidence cannot compose; re-record it with: node tools/record-later-eras.mjs smoke slice");
  assert.equal(recorded.policy, m.LATER_ERA_SMOKE.policyId,
    "the smoke slice's recipe is not the declared smoke recipe — stale recipe evidence cannot compose; re-record it with: node tools/record-later-eras.mjs smoke slice");
  assert.equal(recorded.rows?.length, 1, "the smoke slice carries exactly one bounded walk");
  assertSmokeRow(m, recorded.rows[0]);
  await refuseExistingArtifact(reportPath, "the later-era smoke report");
  await writeFile(reportPath, JSON.stringify(composeRecordingPayload({
    tier: "smoke",
    recordingCommit: commit,
    smoke: m.LATER_ERA_SMOKE,
    runs: recorded.rows,
  }, [{ path: slicePath, recording: recorded }]), null, 2));
  console.log(`smoke report: composed the bounded walk — ${reportPath}`);
}

async function main() {
  // Cheap failures first: the argument surface is validated before the
  // runtime gate, git, or any compile (issue #506).
  if (command !== "compose" && !(command === "slice" && SLICE_PATTERN.test(slice ?? "")) && !(command === "smoke" && SMOKE_LEGS.includes(slice ?? ""))) {
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
  if (command === "smoke") return runSmoke(slice, commit);
  const m = await compileEngine("tools/later-eras.ts", "later-eras");
  const source = m.playthroughSource();
  const slicePath = (minutes, policy) => `docs/later-era-slice-${minutes}-${policy}.json`;
  const assertRows = (rows, minutes, policy) => {
    assert.deepEqual(rows.map(row => row.seed), m.LATER_ERA_SEEDS);
    for (const row of rows) {
      assertLaterEraRowCore(row);
      assert.equal(row.sessionMinutes, minutes);
      assert.equal(row.policy, policy);
      if (policy === "ignoring") {
        assert.deepEqual(row.defeats, []);
        assert.ok(row.eras.every(era => era.placements.length === 0));
      }
    }
  };
  if (command === "slice") {
    const [raw, policy] = slice.split(":");
    const minutes = Number(raw);
    const rows = [];
    for (const seed of m.LATER_ERA_SEEDS) {
      const record = m.runPlaythrough(m.laterEraRecipe(seed, minutes, policy));
      assertLaterEraWalkMechanics(m, record);
      rows.push(m.laterEraRow(seed, minutes, record));
      console.log(`${slice} seed ${seed}: ${record.claims.length} banks, ${record.creditedSeconds / 3600} credited hours`);
    }
    assertRows(rows, minutes, policy);
    // Issue #505: every recording names the runtime and timezone it ran on.
    await writeFile(slicePath(minutes, policy), JSON.stringify(recordingPayload({ source, recordingCommit: commit, minutes, policy, rows }), null, 2));
  } else {
    const runs = [];
    const inputs = [];
    for (const minutes of [25, 60]) for (const policy of m.WORLD_POLICIES) {
      const recorded = await readRecordingFile(slicePath(minutes, policy), {
        what: "the later-era slice",
        remedy: `record it with: node tools/record-later-eras.mjs slice ${minutes}:${policy}`,
      });
      // Each slice carries its own recording commit and the compiled
      // engine fingerprint. Composition verifies the fingerprint byte for
      // byte and the commit's ancestry: a slice recorded on an ancestor
      // whose engine source compiled identically is the same evidence,
      // while a divergent engine source is refused (issue #503's
      // provenance discipline, kept for the recorder-fix commits that
      // landed between slices). Smoke evidence is refused outright.
      assertNotSmokeTier(recorded, slicePath(minutes, policy));
      assertSameCompiledSource(recorded.source, source, slicePath(minutes, policy));
      execFileSync("git", ["merge-base", "--is-ancestor", recorded.recordingCommit, commit], { stdio: "pipe" });
      assertRows(recorded.rows, minutes, policy);
      inputs.push({ path: slicePath(minutes, policy), recording: recorded });
      runs.push(...recorded.rows);
    }
    const report = m.laterEraReport(runs);
    const walk = m.runPlaythrough(m.laterEraRecipe(23, 60, "support"));
    const routeProbes = m.routeProbes(walk, { budgetDays: 30 });
    // The probed frontiers are the walk's own banks — strictly increasing
    // at whatever reach the calibrated curve pays (issue #492's slope
    // recalibration moved the shipped reach; the probe reads it live).
    const probedFrontiers = routeProbes.map(probe => probe.frontier);
    assert.ok(probedFrontiers.length >= 2, "the walk banked enough frontiers to probe");
    for (let i = 1; i < probedFrontiers.length; i++) assert.ok(probedFrontiers[i] > probedFrontiers[i - 1]);
    for (const probe of routeProbes) {
      assert.equal(probe.routeDemonstrated, true);
      for (const order of probe.orders) {
        assert.equal(order.purchasesOk, true);
        assert.equal(order.finite, true);
        assert.ok(order.spend <= probe.budget);
        assert.equal(order.forward.noGrant, true);
        assert.equal(order.forward.noRefund, true);
        assert.equal(order.forward.finite, true);
        assert.equal(order.forward.outcome, "advanced");
        assert.ok(order.forward.frontierAfter > probe.frontier);
      }
    }
    // The fighting demonstration (issue #491's capability clause): at
    // the calibrated slope a route continuation banks its claim by depth
    // growth before its weapon's fight resolves — the per-bank read — so
    // the fighting configurations are demonstrated by the support
    // policy's recorded walks, whose defeats ride every slice, while the
    // probes demonstrate the no-refund advancement at every tested
    // frontier. Every order's forward defeats ride the recorded JSON for
    // the per-configuration read.
    assert.ok(
      runs.some(row => row.policy === "support" && row.defeats.length > 0),
      "the support walks demonstrate fighting configurations",
    );
    await writeFile(process.env.FLOWSYNTH_LATER_ERA_REPORT || "docs/later-era-results.json", JSON.stringify(composeRecordingPayload({
      ...report, recordingCommit: commit, routeProbes,
      // These probes really ran during composition, unlike the input rows.
      routeProbeRecordingEnvironment: recordingEnvironment(),
    }, inputs), null, 2));
    console.log(`Recorded ${runs.length} matrix walks and ${routeProbes.reduce((n, probe) => n + probe.orders.length, 0)} directly continued purchase orders.`);
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
