// The retained-recording profiler (issue #509): one reproducible,
// bounded entry point that measures what a long scheduled recording
// retains and where its time goes, then verifies the optimized path
// against the existing one on identical inputs. Compile with the
// recorders' shared Vite transform so the fingerprint certifies the same
// compiled engine the suite and recorders run.
//
//   node tools/record-profile.mjs fixture <raw|collection-reset>
//        [--stop-hours N] [--budget-days N] [--out <path>]
//   node tools/record-profile.mjs smoke
//
// The fixture workload is the supplied-board recording — the declared
// expensive fixture whose full walks ride the century tier. Each
// invocation runs the identical workload twice, once per retention:
// "complete" (every snapshot's whole frozen state, the existing path)
// and "bounded" (captured figures, dropped boards — the optimized batch
// path). Per run it separates simulation/allocation, snapshot capture,
// serialization, and report-generation costs, reports peak memory,
// snapshot retention and counts, allocation solves and memo hits, and
// solver budget/deadline outcomes, then records the differential
// comparison. A disagreement is a failure unless the runs carried
// uncertified solves — the wall-clock valve is timing-dependent, so
// time-budget-limited divergence is surfaced, never presumed away.
//
// The smoke workload is the declared smoke recipe on the fresh board:
// the whole pipeline in seconds, publishing only into isolated output.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { performance } from "node:perf_hooks";
import { compileEngine } from "./dev/compile-engine.mjs";
import {
  recordingPayload,
  refuseExistingArtifact,
  requireRuntimeEnvironment,
  resolveSmokeRoot,
  writeJsonAtomic,
} from "./dev/runtime.mjs";

const SCRIPT_NAME = "record-profile";
const FIXTURE_VARIANTS = ["raw", "collection-reset"];
const SMOKE_MARK_HOURS = 1;
const usageError = () => new Error(
  "Usage: node tools/record-profile.mjs fixture <raw|collection-reset> [--stop-hours N] [--budget-days N] [--out <path>]"
    + " | smoke",
);

// Allocation-free retained-size estimate: object nodes, array slots, and
// primitive payloads, counted over the graph. A proxy for resident size,
// not a heap figure — the heap numbers ride the sampled readings.
function estimateDeepBytes(value, seen = new Set()) {
  if (value === null) return 8;
  const kind = typeof value;
  if (kind === "number") return 8;
  if (kind === "boolean") return 4;
  if (kind === "string") return 2 * value.length + 8;
  if (kind !== "object" && kind !== "function") return 8;
  if (seen.has(value)) return 0;
  seen.add(value);
  let bytes = 64;
  if (Array.isArray(value)) {
    for (const item of value) bytes += 8 + estimateDeepBytes(item, seen);
    return bytes;
  }
  for (const key in value) {
    if (!Object.hasOwn(value, key)) continue;
    bytes += 2 * key.length + 16 + estimateDeepBytes(value[key], seen);
  }
  return bytes;
}

const kb = (bytes) => Math.round(bytes / 1024);
const roundedMs = (ms) => Math.round(ms);

// One measured walk: the declared workload through the exported step
// generator, so the profiler samples heap between simulated steps and
// reads the engine's own counters around the run. The batch reads — the
// same functions a recorded row consumes — are timed as the report tier,
// and the row kept for the differential comparison.
function measuredWalk(m, { label, recipe, state, retention }) {
  const beforeHeap = process.memoryUsage().heapUsed;
  const rssBefore = process.resourceUsage().maxRSS;
  // The engine's module counters, zeroed around this run so the deltas
  // are the run's own.
  m.allocationMemoStats.solves = 0;
  m.allocationMemoStats.hits = 0;
  m.allocationBudgetStats.solves = 0;
  m.allocationBudgetStats.uncertified = 0;
  m.allocationBudgetStats.nodeTrips = 0;
  m.allocationBudgetStats.deadlineTrips = 0;
  m.allocationBudgetStats.maxNodes = 0;
  m.allocationBudgetStats.maxMs = 0;
  m.playthroughCaptureStats.captures = 0;
  m.playthroughCaptureStats.retainedStates = 0;
  m.playthroughCaptureStats.captureMs = 0;
  m.playthroughCaptureStats.serializeMs = 0;

  const walk = m.walkPlaythrough(recipe, null, m.playthroughSource(), state, retention);
  const walkStarted = performance.now();
  let steps = 0;
  let peakSampledHeap = beforeHeap;
  let result = walk.next();
  while (!result.done) {
    steps++;
    try {
      const heap = process.memoryUsage().heapUsed;
      if (heap > peakSampledHeap) peakSampledHeap = heap;
    } catch { /* sampling is best-effort */ }
    result = walk.next();
  }
  const record = result.value;
  const walkMs = performance.now() - walkStarted;
  const rssAfter = process.resourceUsage().maxRSS;
  const capture = { ...m.playthroughCaptureStats };
  const memo = { ...m.allocationMemoStats };
  const budget = { ...m.allocationBudgetStats };

  // The report tier: the exact functions a recorded row runs — the era
  // views, the decision-gap read, the numeric and acquisition reads, the
  // trajectory — timed as one phase, and the row itself kept for the
  // differential comparison.
  const reportStarted = performance.now();
  const row = m.centuryRow(m.CENTURY_SEEDS[0], m.CENTURY_SESSION_MINUTES.long, record);
  const reportMs = performance.now() - reportStarted;

  const snapshots = record.snapshots;
  const retainedEstimate = estimateDeepBytes(record);
  const snapshotEstimate = estimateDeepBytes(snapshots);
  return {
    label,
    retention,
    record,
    row,
    measures: {
      walkMs: roundedMs(walkMs),
      steps,
      reportMs: roundedMs(reportMs),
      capture: {
        captures: capture.captures,
        retainedStates: capture.retainedStates,
        captureMs: roundedMs(capture.captureMs),
        serializeMs: roundedMs(capture.serializeMs),
      },
      memo,
      budget,
      memory: {
        heapStartBytes: beforeHeap,
        heapEndBytes: process.memoryUsage().heapUsed,
        peakSampledHeapBytes: peakSampledHeap,
        maxRssKbProcessWide: Math.round(Math.max(rssBefore, rssAfter)),
      },
      retention: {
        snapshots: snapshots.length,
        snapshotsWithState: snapshots.filter((snapshot) => snapshot.state !== null).length,
        recordEstimateBytes: retainedEstimate,
        snapshotsEstimateBytes: snapshotEstimate,
      },
    },
  };
}

// The differential comparison (issue #509): identical inputs, two
// retentions, the recorded outcomes must agree. Time-budget-limited
// allocator behavior is surfaced, not assumed away — a disagreement with
// zero uncertified solves on either side is a failure; a disagreement
// under deadline trips is recorded as the honest timing-dependent read.
// The compared shape is the run's agreement slice: the recorded outcomes
// a reader could act on, not the boards.
function differential(complete, bounded) {
  const checks = [];
  const disagreements = [];
  const compare = (name, a, b) => {
    let agrees = false;
    try {
      assert.deepEqual(b, a);
      agrees = true;
    } catch {
      // deepEqual threw — recorded below with the phase's name.
    }
    checks.push({ name, agrees });
    if (!agrees) disagreements.push(name);
  };
  compare("century row (the recorded figures)", complete.row, bounded.row);
  compare("decision record", complete.agreement.events, bounded.agreement.events);
  compare("trajectory samples", complete.agreement.trajectory, bounded.agreement.trajectory);
  compare("claims", complete.agreement.claims, bounded.agreement.claims);
  compare("era ledgers", complete.agreement.eras, bounded.agreement.eras);
  compare("stop", complete.agreement.stop, bounded.agreement.stop);
  compare("snapshot count", complete.agreement.snapshots, bounded.agreement.snapshots);
  const uncertified = {
    complete: complete.measures.budget.uncertified,
    bounded: bounded.measures.budget.uncertified,
  };
  const deadlineTrips = {
    complete: complete.measures.budget.deadlineTrips,
    bounded: bounded.measures.budget.deadlineTrips,
  };
  const timeLimited = uncertified.complete > 0 || uncertified.bounded > 0;
  if (disagreements.length > 0 && !timeLimited) {
    throw new Error(
      `Differential verification failed: ${disagreements.join(", ")} disagree on identical inputs `
        + `with no uncertified solves — the retentions must agree when every solve certified.`,
    );
  }
  return { agrees: disagreements.length === 0, checks, disagreements, uncertified, deadlineTrips, timeLimited };
}

// The agreement slice one measured run carries for the comparison: the
// recorded outcomes, not the boards.
function agreementOf(record) {
  return {
    events: record.events,
    trajectory: record.trajectory,
    claims: record.claims,
    eras: record.eras,
    stop: record.stop,
    snapshots: record.snapshots.length,
  };
}

function runLine(run) {
  return `${run.retention}: walk ${Math.round(run.measures.walkMs / 1000)}s, `
    + `${run.measures.retention.snapshots} snapshots `
    + `(${run.measures.retention.snapshotsWithState} with states), `
    + `retained ~${kb(run.measures.retention.recordEstimateBytes)}KB, `
    + `peak sampled heap ${kb(run.measures.memory.peakSampledHeapBytes)}KB, `
    + `memo ${run.measures.memo.solves}/${run.measures.memo.hits}, `
    + `uncertified ${run.measures.budget.uncertified} `
    + `(node ${run.measures.budget.nodeTrips}, deadline ${run.measures.budget.deadlineTrips})`;
}

// One measured fixture walk in this process, written as its own payload.
// The pair command spawns one child per retention (issue #509): peak
// memory is attributed per run, never polluted by a sibling's retained
// record — the same isolation rule the job workers follow.
async function runSingleFixtureRun({ variant, stopHours, budgetDays, retention, out }) {
  await requireRuntimeEnvironment();
  execFileSync("git", ["diff", "--exit-code", "HEAD", "--", "src", "tools"], { stdio: "pipe" });
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const m = await compileEngine("tools/century.ts", "profile");
  const { recipe, state } = m.suppliedBoardWalkInputs(variant, stopHours, budgetDays);
  const run = measuredWalk(m, { label: retention, recipe, state, retention });
  console.log(runLine(run));
  const payload = recordingPayload({
    tier: "profile-run",
    profile: "retained-recording",
    source: m.playthroughSource(),
    workload: {
      name: `supplied-board fixture (${variant})`,
      variant,
      stopCreditedHours: recipe.stopCreditedHours,
      budgetDays: recipe.budgetDays,
      schedule: recipe.schedule,
      policyId: recipe.policyId,
      seed: recipe.seed,
      modules: state.modules.length,
      cells: state.cells.length,
    },
    recipe,
    recordingCommit: commit,
    retention,
    measures: run.measures,
    row: run.row,
    agreement: agreementOf(run.record),
    stopKind: run.record.stop.kind,
    complete: run.record.complete,
    days: run.record.days,
    creditedHours: Math.round(run.record.creditedSeconds / 360) / 10,
    runId: run.record.runId,
    rowDigest: createHash("sha256").update(JSON.stringify(run.row)).digest("hex").slice(0, 16),
  });
  await writeJsonAtomic(out, payload);
}

// The fixture profile: one child process per retention on identical
// inputs, then the differential over the pair and one committed artifact.
async function runFixtureProfile({ variant, stopHours, budgetDays, out }) {
  await requireRuntimeEnvironment();
  // The profile commit identifies exactly the measured source.
  execFileSync("git", ["diff", "--exit-code", "HEAD", "--", "src", "tools"], { stdio: "pipe" });
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const scriptPath = fileURLToPath(import.meta.url);
  const runs = {};
  const staging = await mkdtemp(path.join(tmpdir(), "flowsynth-profile-run-"));
  try {
    for (const retention of ["complete", "bounded"]) {
      const payloadPath = path.join(staging, `${retention}.json`);
      execFileSync(process.execPath, [
        scriptPath, "fixture-run", variant,
        "--retention", retention,
        "--out", payloadPath,
        ...(stopHours !== undefined ? ["--stop-hours", String(stopHours)] : []),
        ...(budgetDays !== undefined ? ["--budget-days", String(budgetDays)] : []),
      ], { stdio: "inherit" });
      runs[retention] = JSON.parse(await readFile(payloadPath, "utf8"));
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  // The pair must be the same declared workload.
  assert.deepEqual(runs.bounded.workload, runs.complete.workload, "the pair's workload identity");
  assert.deepEqual(runs.bounded.recipe, runs.complete.recipe, "the pair's recipe");

  const comparison = differential(runs.complete, runs.bounded);
  if (!comparison.agrees) {
    console.warn(
      `differential: disagreements recorded (${comparison.disagreements.join(", ")}) under `
        + `uncertified solves complete=${comparison.uncertified.complete}, bounded=${comparison.uncertified.bounded}`
        + " — time-budget-limited allocator behavior, surfaced rather than assumed equivalent",
    );
  } else {
    console.log(`differential: all ${comparison.checks.length} checks agree on identical inputs`);
  }

  const payload = recordingPayload({
    tier: "profile",
    profile: "retained-recording",
    source: runs.complete.source,
    workload: runs.complete.workload,
    recipe: runs.complete.recipe,
    recordingCommit: commit,
    runs: {
      complete: { retention: "complete", measures: runs.complete.measures, stopKind: runs.complete.stopKind, complete: runs.complete.complete, days: runs.complete.days, creditedHours: runs.complete.creditedHours, runId: runs.complete.runId, rowDigest: runs.complete.rowDigest, row: runs.complete.row },
      bounded: { retention: "bounded", measures: runs.bounded.measures, stopKind: runs.bounded.stopKind, complete: runs.bounded.complete, days: runs.bounded.days, creditedHours: runs.bounded.creditedHours, runId: runs.bounded.runId, rowDigest: runs.bounded.rowDigest, row: runs.bounded.row },
    },
    differential: comparison,
    limitations: [
      "Peak memory is sampled between simulated steps (per-step heapUsed); the sampled peak can miss an intra-step spike, and each run owns its process so no sibling's retained record pollutes its peak.",
      "A disagreement under uncertified solves is the wall-clock valve's timing-dependent incumbent, not a deterministic divergence; the budget stats carry the trips.",
      "The complete retention run of the full declared fixture stop (100 credited hours) retains multi-gigabyte histories and is not a bounded or quick invocation; reduced stops keep the inputs comparable.",
      "Bounded snapshots carry no boards: historical inspection and artifact export refuse them by name, and the serialized stride verdicts move to capture time.",
    ],
  });
  const target = out ?? `docs/recording-profile-fixture-${variant}.json`;
  await writeJsonAtomic(target, payload);
  console.log(`profile written: ${target}`);
  return payload;
}

async function runProfile({ variant = undefined, stopHours = undefined, budgetDays = undefined, smoke = false, out = undefined }) {
  const m = await compileEngine("tools/century.ts", "profile");
  // The smoke workload: the declared smoke recipe on the fresh board,
  // both retentions in-process — small boards, no isolation needed.
  const recipe = m.centurySmokeRecipe();
  const workloads = [
    { label: "complete", retention: "complete" },
    { label: "bounded", retention: "bounded" },
  ];
  const runs = {};
  for (const workload of workloads) {
    const run = measuredWalk(m, { label: workload.label, recipe, state: undefined, retention: workload.retention });
    runs[workload.label] = { ...run, agreement: agreementOf(run.record) };
    console.log(runLine(run));
  }
  const comparison = differential(runs.complete, runs.bounded);
  if (!comparison.agrees) throw new Error("the smoke workload's retentions must agree");
  console.log(`differential: all ${comparison.checks.length} checks agree on identical inputs`);
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const payload = recordingPayload({
    tier: "smoke",
    profile: "retained-recording",
    source: m.playthroughSource(),
    workload: {
      name: "smoke recipe (fresh board)",
      stopCreditedHours: recipe.stopCreditedHours,
      budgetDays: recipe.budgetDays,
      schedule: recipe.schedule,
      policyId: recipe.policyId,
      seed: recipe.seed,
    },
    recipe,
    recordingCommit: commit,
    runs: {
      complete: { retention: "complete", measures: runs.complete.measures, stopKind: runs.complete.record.stop.kind, complete: runs.complete.record.complete, days: runs.complete.record.days, creditedHours: Math.round(runs.complete.record.creditedSeconds / 360) / 10, runId: runs.complete.record.runId, rowDigest: createHash("sha256").update(JSON.stringify(runs.complete.row)).digest("hex").slice(0, 16) },
      bounded: { retention: "bounded", measures: runs.bounded.measures, stopKind: runs.bounded.record.stop.kind, complete: runs.bounded.record.complete, days: runs.bounded.record.days, creditedHours: Math.round(runs.bounded.record.creditedSeconds / 360) / 10, runId: runs.bounded.record.runId, rowDigest: createHash("sha256").update(JSON.stringify(runs.bounded.row)).digest("hex").slice(0, 16) },
    },
    differential: comparison,
    limitations: [
      "Peak memory is sampled between simulated steps (per-step heapUsed); the sampled peak can miss an intra-step spike.",
      "The smoke workload is the fresh-board smoke recipe — a pipeline check, never balance or retention evidence at fixture scale.",
    ],
  });
  if (out) {
    await writeJsonAtomic(out, payload);
    console.log(`profile written: ${out}`);
  }
  return payload;
}

async function main() {
  const [command, positional] = process.argv.slice(2);
  if (command === "smoke") {
    // The smoke tier publishes only into isolated output (issue #506's
    // rule, shared here): a free temp root, one artifact, written only
    // after every smoke assertion has held.
    const root = await resolveSmokeRoot(`flowsynth-profile-smoke-`);
    const target = `${root}/profile-smoke.json`;
    await refuseExistingArtifact(target, "the profile smoke artifact");
    const payload = await runProfile({ smoke: true, out: null });
    assert.equal(payload.tier, "smoke");
    assert.equal(payload.differential.agrees, true, "the smoke workload's retentions must agree");
    assert.equal(payload.runs.bounded.measures.retention.snapshotsWithState, 0, "the bounded smoke walk retains no boards");
    assert.ok(payload.runs.complete.measures.retention.snapshotsWithState > 0, "the complete smoke walk retains its boards");
    await writeJsonAtomic(target, payload);
    console.log(`smoke profile: ${payload.runs.complete.measures.retention.snapshots} complete snapshots, `
      + `${payload.runs.bounded.measures.retention.snapshots} bounded (no boards) — artifact at ${target}`);
    return;
  }
  if (command === "fixture-run") {
    // Internal: one measured fixture walk in its own process, spawned by
    // the fixture command for per-run memory attribution. Not usage-listed.
    const { values } = parseArgs({
      args: process.argv.slice(3),
      options: {
        retention: { type: "string" },
        "stop-hours": { type: "string" },
        "budget-days": { type: "string" },
        out: { type: "string" },
      },
      allowPositionals: true,
      strict: true,
    });
    if (!FIXTURE_VARIANTS.includes(positional ?? "")) throw usageError();
    if (values.retention !== "complete" && values.retention !== "bounded") {
      throw new Error("fixture-run: --retention must be complete or bounded");
    }
    if (!values.out) throw new Error("fixture-run: --out is required");
    const stopHours = values["stop-hours"] !== undefined ? Number(values["stop-hours"]) : undefined;
    const budgetDays = values["budget-days"] !== undefined ? Number(values["budget-days"]) : undefined;
    await runSingleFixtureRun({
      variant: positional,
      stopHours,
      budgetDays,
      retention: values.retention,
      out: values.out,
    });
    return;
  }
  if (command !== "fixture" || !FIXTURE_VARIANTS.includes(positional ?? "")) throw usageError();
  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      "stop-hours": { type: "string" },
      "budget-days": { type: "string" },
      out: { type: "string" },
    },
    // The variant is validated above; parseArgs only reads the flags.
    allowPositionals: true,
    strict: true,
  });
  const stopHours = values["stop-hours"] !== undefined ? Number(values["stop-hours"]) : undefined;
  const budgetDays = values["budget-days"] !== undefined ? Number(values["budget-days"]) : undefined;
  if (stopHours !== undefined && (!Number.isFinite(stopHours) || stopHours <= 0)) throw new Error("--stop-hours must be a positive number");
  if (budgetDays !== undefined && (!Number.isInteger(budgetDays) || budgetDays < 1)) throw new Error("--budget-days must be a whole number ≥ 1");
  await runFixtureProfile({ variant: positional, stopHours, budgetDays, out: values.out });
}

try {
  await main();
} catch (error) {
  console.error(`${SCRIPT_NAME}: ${error?.message ?? error}`);
  process.exit(1);
}
