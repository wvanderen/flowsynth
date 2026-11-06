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
  compare("decision record", complete.record.events, bounded.record.events);
  compare("trajectory samples", complete.record.trajectory, bounded.record.trajectory);
  compare("claims", complete.record.claims, bounded.record.claims);
  compare("era ledgers", complete.record.eras, bounded.record.eras);
  compare("stop", complete.record.stop, bounded.record.stop);
  compare("snapshot count", complete.record.snapshots.length, bounded.record.snapshots.length);
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

async function runProfile({ variant = undefined, stopHours = undefined, budgetDays = undefined, smoke = false, out = undefined }) {
  await requireRuntimeEnvironment();
  // Production profiles publish committed evidence, so like the recorders
  // they require a clean tree over src and tools: the profile commit
  // identifies exactly the measured source. The smoke tier publishes only
  // into isolated output and runs on dirty worktrees too.
  if (!smoke) {
    execFileSync("git", ["diff", "--exit-code", "HEAD", "--", "src", "tools"], { stdio: "pipe" });
  }
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const m = await compileEngine("tools/century.ts", "profile");

  // The workload: the supplied-board fixture's declared walk (the fresh
  // board for smoke), built fresh per retention so both runs start from
  // byte-identical inputs.
  const recipe = smoke
    ? m.centurySmokeRecipe()
    : m.suppliedBoardWalkInputs(variant, stopHours, budgetDays).recipe;
  const stateFor = () => {
    if (smoke) return undefined;
    return m.suppliedBoardWalkInputs(variant, stopHours, budgetDays).state;
  };

  const workloads = [
    { label: "complete", retention: "complete" },
    { label: "bounded", retention: "bounded" },
  ];
  const runs = {};
  for (const workload of workloads) {
    // GC between runs where the runtime offers it, so the second run's
    // start heap reads clean of the first's garbage.
    if (globalThis.gc) globalThis.gc();
    const inputState = stateFor();
    runs[workload.label] = measuredWalk(m, {
      label: workload.label,
      recipe,
      state: inputState,
      retention: workload.retention,
    });
    console.log(
      `${workload.label}: walk ${Math.round(runs[workload.label].measures.walkMs / 1000)}s, `
        + `${runs[workload.label].measures.retention.snapshots} snapshots `
        + `(${runs[workload.label].measures.retention.snapshotsWithState} with states), `
        + `retained ~${kb(runs[workload.label].measures.retention.recordEstimateBytes)}KB, `
        + `peak sampled heap ${kb(runs[workload.label].measures.memory.peakSampledHeapBytes)}KB, `
        + `memo ${runs[workload.label].measures.memo.solves}/${runs[workload.label].measures.memo.hits}, `
        + `uncertified ${runs[workload.label].measures.budget.uncertified} `
        + `(node ${runs[workload.label].measures.budget.nodeTrips}, deadline ${runs[workload.label].measures.budget.deadlineTrips})`,
    );
  }

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

  const stripped = (run) => {
    const { record, ...rest } = run;
    return {
      ...rest,
      stopKind: record.stop.kind,
      complete: record.complete,
      days: record.days,
      creditedHours: Math.round(record.creditedSeconds / 360) / 10,
      runId: record.runId,
      rowDigest: createHash("sha256").update(JSON.stringify(run.row)).digest("hex").slice(0, 16),
    };
  };
  const workloadState = smoke ? undefined : stateFor();
  const payload = recordingPayload({
    tier: smoke ? "smoke" : "profile",
    profile: "retained-recording",
    source: m.playthroughSource(),
    workload: {
      name: smoke ? "smoke recipe (fresh board)" : `supplied-board fixture (${variant})`,
      ...(smoke ? {} : { variant }),
      stopCreditedHours: recipe.stopCreditedHours,
      budgetDays: recipe.budgetDays,
      schedule: recipe.schedule,
      policyId: recipe.policyId,
      seed: recipe.seed,
      modules: workloadState?.modules.length,
      cells: workloadState?.cells.length,
    },
    recipe,
    recordingCommit: commit,
    runs: { complete: stripped(runs.complete), bounded: stripped(runs.bounded) },
    differential: comparison,
    limitations: [
      "Peak memory is sampled between simulated steps (per-step heapUsed) plus the process-wide maxRSS ceiling; the sampled peak can miss an intra-step spike.",
      "A disagreement under uncertified solves is the wall-clock valve's timing-dependent incumbent, not a deterministic divergence; the budget stats carry the trips.",
      "The complete retention run of the full declared fixture stop (100 credited hours) retains multi-gigabyte histories and is not a bounded or quick invocation; reduced stops keep the inputs comparable.",
      "Bounded snapshots carry no boards: historical inspection and artifact export refuse them by name, and the serialized stride verdicts move to capture time.",
    ],
  });
  const target = out ?? (smoke
    ? undefined
    : `docs/recording-profile-fixture-${variant}.json`);
  if (target) {
    await writeJsonAtomic(target, payload);
    console.log(`profile written: ${target}`);
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
  if (command !== "fixture" || !FIXTURE_VARIANTS.includes(positional ?? "")) throw usageError();
  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      "stop-hours": { type: "string" },
      "budget-days": { type: "string" },
      out: { type: "string" },
    },
    strict: true,
  });
  const stopHours = values["stop-hours"] !== undefined ? Number(values["stop-hours"]) : undefined;
  const budgetDays = values["budget-days"] !== undefined ? Number(values["budget-days"]) : undefined;
  if (stopHours !== undefined && (!Number.isFinite(stopHours) || stopHours <= 0)) throw new Error("--stop-hours must be a positive number");
  if (budgetDays !== undefined && (!Number.isInteger(budgetDays) || budgetDays < 1)) throw new Error("--budget-days must be a whole number ≥ 1");
  await runProfile({ variant: positional, stopHours, budgetDays, smoke: false, out: values.out });
}

try {
  await main();
} catch (error) {
  console.error(`${SCRIPT_NAME}: ${error?.message ?? error}`);
  process.exit(1);
}
