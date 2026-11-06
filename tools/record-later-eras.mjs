// Explicit, long-running evidence tier. Compile with Vite's real glob/raw
// transforms so a recording's fingerprint certifies the compiled engine —
// one identity with the suite, dev server, and build — then record the
// same functions the tests exercise. No listening server.
//
// The evaluation runs as a resumable job (issue #507): every completed
// seed walk, the probe walk, and each route order's forward continuation
// is a persisted work unit under its own identity, executed by a bounded
// set of worker processes. An interruption loses in-flight work only; a
// relaunch reuses exactly the units whose behavior-affecting inputs still
// match. One supported interface:
//
//   node tools/record-later-eras.mjs run [25|60:support|combat|ignoring]
//        [--jobs N] [--worker-mb N] [--detach] [--notify <command>] [--dir <path>]
//   node tools/record-later-eras.mjs status [--dir <path>]
//   node tools/record-later-eras.mjs compose
//
// `run` without a slice argument records the whole declared evaluation
// (all six slices plus the probe walk and its route forwards); with one,
// only that slice's units. `--detach` hands the job to a detached
// supervisor and returns immediately — the completion notification fires
// once at the terminal state, so no shell wait stays alive.
//
// The smoke tier (issue #506) drives the same job pipeline — plan,
// workers, atomic units, publication — on bounded walks in seconds,
// publishing only into isolated output:
//
//   node tools/record-later-eras.mjs smoke slice
//   node tools/record-later-eras.mjs smoke run
//   node tools/record-later-eras.mjs smoke compose
//
// Smoke artifacts carry smoke names and tier "smoke"; the production
// compose refuses them outright.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileEngineTo } from "./dev/compile-engine.mjs";
import {
  DEFAULT_JOBS,
  DEFAULT_WORKER_MEMORY_MB,
  acquireSupervisorLock,
  formatStatus,
  launchDetachedSupervisor,
  logEvent,
  prepareJobDir,
  readJobStatus,
  runSupervisor,
} from "./dev/job-recorder.mjs";
import {
  PROBE_EVIDENCE_PATH,
  assertSliceRows,
  probeGroup,
  sliceGroup,
  sliceGroups,
  slicePath,
  unitProvenanceOf,
} from "./dev/later-era-recording.mjs";
import {
  REPO_ROOT,
  assertNotSmokeTier,
  assertSameCompiledSource,
  assertSmokeTier,
  composeRecordingPayload,
  readRecordingFile,
  recordingPayload,
  refuseExistingArtifact,
  requireRuntimeEnvironment,
  resolveSmokeRoot,
  writeJsonAtomic,
  writeSmokeArtifact,
} from "./dev/runtime.mjs";

const SCRIPT_NAME = "record-later-eras";
const SLICE_PATTERN = /^(25|60):(support|combat|ignoring)$/;
const SMOKE_LEGS = ["slice", "run", "compose"];
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_JOB_ROOT = path.join(REPO_ROOT, ".recording", "later-era");
const usageError = () => new Error(
  "Usage: node tools/record-later-eras.mjs run [<25|60>:<support|combat|ignoring>] [--jobs N] [--worker-mb N] [--detach] [--notify <cmd>] [--dir <path>]"
  + " | status [--dir <path>]"
  + " | compose"
  + " | smoke <slice|run|compose>",
);

/** @type {import("node:util").ParseArgsOptionsConfig} */
const RUN_FLAGS = {
  jobs: { type: "string", short: "j" },
  "worker-mb": { type: "string" },
  detach: { type: "boolean" },
  notify: { type: "string" },
  dir: { type: "string" },
  // Internal: the detached supervisor's own invocation. Not usage.
  supervisor: { type: "boolean" },
};

function parseRunFlags(args) {
  const options = RUN_FLAGS;
  try {
    return parseArgs({ args, options, strict: true });
  } catch {
    throw usageError();
  }
}

const jobDirFor = (scope, explicit) => explicit ?? path.join(DEFAULT_JOB_ROOT, scope);
// ── run ────────────────────────────────────────────────────────────────────

// Validates every cheap precondition and returns the compiled module plus
// the plan builder. Used by both the foreground/detached-supervisor run
// and the launch handoff (which refuses before spawning a doomed child).
async function prepareRun(slice, dir) {
  await requireRuntimeEnvironment();
  // Production recordings publish committed evidence, so they require a
  // clean tree: the recording commit identifies exactly the recorded
  // source. (The smoke tier publishes only into isolated output.)
  execFileSync("git", ["diff", "--exit-code", "HEAD", "--", "src", "tools"], { stdio: "pipe" });
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const bundle = await compileEngineTo("tools/later-eras.ts", "later-eras", path.join(dir, "bundle"));
  const m = await import(bundle);
  const source = m.playthroughSource();
  const builder = slice ? m.laterEraSliceJobPlan(slice[0], slice[1]) : m.laterEraJobPlan();
  return { commit, bundle, m, source, builder };
}

const adapterFor = (m, source, builder, slice) => ({
  identityOf: (descriptor) => m.laterEraUnitIdentity(descriptor),
  validateUnit: (descriptor, payload) => m.validateLaterEraUnit(descriptor, payload),
  ...(slice ? {} : {
    deriveFrom: "probe-walk",
    derive: (parentPayload) => builder.derive(parentPayload.result.banks, parentPayload.identity),
    groups: [...sliceGroups(m, source), probeGroup(m, source)],
  }),
  ...(slice ? { groups: [sliceGroup(m, source, slice)] } : {}),
});

async function runCommand(slice, flags) {
  const jobs = flags.values.jobs !== undefined ? Number(flags.values.jobs) : DEFAULT_JOBS;
  const workerMb = flags.values["worker-mb"] !== undefined ? Number(flags.values["worker-mb"]) : DEFAULT_WORKER_MEMORY_MB;
  if (!Number.isInteger(jobs) || jobs < 1) throw new Error(`--jobs must be a whole number ≥ 1 — found ${flags.values.jobs}`);
  if (!Number.isInteger(workerMb) || workerMb < 128) throw new Error(`--worker-mb must be a whole number ≥ 128 — found ${flags.values["worker-mb"]}`);

  const scope = slice ? `${slice[0]}-${slice[1]}` : "evaluation";
  const dir = jobDirFor(scope, flags.values.dir);
  const options = { jobs, workerMemoryBudgetMb: workerMb, notify: flags.values.notify ?? null };

  if (flags.values.supervisor) {
    // The detached supervisor. Single-flight first — before any compile —
    // so a refused second supervisor cannot disturb the holder's bundle.
    const lock = await acquireSupervisorLock(dir);
    try {
      const { commit, bundle, m, source, builder } = await prepareRun(slice, dir);
      await prepareJobDir(dir, { scope, bundle, commit, units: builder.units });
      const { outcome, cancelled, publishError } = await runSupervisor(dir,
        { scope, bundle, commit, units: builder.units }, adapterFor(m, source, builder, slice),
        { ...options, detached: true, lock });
      if (publishError) console.error(publishError);
      return { outcome, cancelled };
    } catch (error) {
      await logEvent(dir, `supervisor failed: ${error?.message ?? error}`);
      throw error;
    }
  }

  if (flags.values.detach) {
    // The launch handoff: refuse everything cheap first (a broken compile
    // never detaches), then spawn the detached supervisor and return.
    await prepareRun(slice, dir);
    const childArgs = [
      process.execPath, SCRIPT_PATH, "run",
      ...(slice ? [`${slice[0]}:${slice[1]}`] : []),
      "--dir", dir, "--jobs", String(jobs), "--worker-mb", String(workerMb),
      ...(flags.values.notify ? ["--notify", flags.values.notify] : []),
      "--supervisor",
    ];
    const { pid, status } = await launchDetachedSupervisor({ argv: childArgs, dir });
    console.log(`later-era ${scope} job launched detached: ${dir}`);
    console.log(`pid ${pid} · ${Object.keys(status.units ?? {}).length || "planned"} units · durable status: ${path.join(dir, "job-status.json")}`);
    console.log(`observe: node tools/record-later-eras.mjs status --dir ${dir}`);
    console.log(flags.values.notify
      ? `the notification fires once at the terminal state: ${flags.values.notify}`
      : "no --notify registered — check the status file, or relaunch with --notify to be told on completion");
    return { outcome: "detached" };
  }

  const lock = await acquireSupervisorLock(dir);
  try {
    const { commit, bundle, m, source, builder } = await prepareRun(slice, dir);
    await prepareJobDir(dir, { scope, bundle, commit, units: builder.units });
    const { outcome, cancelled, publishError } = await runSupervisor(dir,
      { scope, bundle, commit, units: builder.units }, adapterFor(m, source, builder, slice),
      { ...options, lock });
    const status = await readJobStatus(dir);
    console.log(formatStatus(dir, status));
    if (publishError) console.error(publishError);
    return { outcome, cancelled };
  } catch (error) {
    await logEvent(dir, `run failed: ${error?.message ?? error}`);
    throw error;
  }
}

// ── status ─────────────────────────────────────────────────────────────────

async function statusCommand(flags) {
  const dir = flags.values.dir ?? jobDirFor("evaluation");
  const status = await readJobStatus(dir);
  console.log(formatStatus(dir, status));
  return { outcome: status.status };
}

// ── compose ────────────────────────────────────────────────────────────────

async function composeCommand() {
  await requireRuntimeEnvironment();
  execFileSync("git", ["diff", "--exit-code", "HEAD", "--", "src", "tools"], { stdio: "pipe" });
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const m = await (await import("./dev/compile-engine.mjs")).compileEngine("tools/later-eras.ts", "later-eras");
  const source = m.playthroughSource();
  // Every input's recording commits — the slice's own and each unit's —
  // must be ancestors of this checkout: evidence from a divergent history
  // is refused. A slice recorded on an ancestor whose engine source
  // compiled identically is the same evidence.
  const assertAncestry = (commits) => {
    for (const recorded of new Set(commits)) {
      execFileSync("git", ["merge-base", "--is-ancestor", recorded, commit], { stdio: "pipe" });
    }
  };
  const runs = [];
  const inputs = [];
  for (const minutes of [25, 60]) for (const policy of m.WORLD_POLICIES) {
    const sliceLabel = slicePath(minutes, policy);
    const recorded = await readRecordingFile(sliceLabel, {
      what: "the later-era slice",
      remedy: `record it with: node tools/record-later-eras.mjs run ${minutes}:${policy}`,
    });
    assertNotSmokeTier(recorded, sliceLabel);
    assertSameCompiledSource(recorded.source, source, sliceLabel);
    assertAncestry([recorded.recordingCommit,
      ...Object.values(recorded.unitProvenance ?? {}).map((provenance) => provenance.recordingCommit)]);
    assertSliceRows(m, recorded.rows, minutes, policy);
    inputs.push({ path: sliceLabel, recording: recorded });
    runs.push(...recorded.rows);
  }
  const probeLabel = PROBE_EVIDENCE_PATH;
  const probe = await readRecordingFile(probeLabel, {
    what: "the later-era probe evidence",
    remedy: "record it with: node tools/record-later-eras.mjs run",
  });
  assertNotSmokeTier(probe, probeLabel);
  assertSameCompiledSource(probe.source, source, probeLabel);
  assertAncestry([probe.recordingCommit,
    ...Object.values(probe.unitProvenance ?? {}).map((p) => p.recordingCommit)]);
  m.assertProbeEvidence(probe, "the later-era probe evidence");
  inputs.push({ path: probeLabel, recording: probe });
  const report = m.laterEraReport(runs);
  // The fighting demonstration (issue #491's capability clause) rides the
  // recorded support walks' defeats, as before.
  assert.ok(
    runs.some(row => row.policy === "support" && row.defeats.length > 0),
    "the support walks demonstrate fighting configurations",
  );
  await writeFile(process.env.FLOWSYNTH_LATER_ERA_REPORT || "docs/later-era-results.json", JSON.stringify(composeRecordingPayload({
    ...report, recordingCommit: commit,
    routeProbes: probe.banks,
    // The probes are persisted work units recorded by the job's workers —
    // composition runs no walks and no continuations (issue #507).
    routeProbeRecordingEnvironment: probe.recordingEnvironment,
  }, inputs), null, 2));
  console.log(`Composed ${runs.length} matrix walks and ${probe.banks.reduce((n, bank) => n + bank.orders.length, 0)} persisted route continuations into the report.`);
}

// ── smoke ──────────────────────────────────────────────────────────────────

async function smokeCommand(leg, flags) {
  const root = await resolveSmokeRoot("flowsynth-later-era-smoke-");
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dir = flags.values.dir ?? path.join(root, leg === "compose" ? "job" : `job-${leg}`);
  const jobs = flags.values.jobs !== undefined ? Number(flags.values.jobs) : 2;
  const workerMb = flags.values["worker-mb"] !== undefined ? Number(flags.values["worker-mb"]) : DEFAULT_WORKER_MEMORY_MB;
  if (!Number.isInteger(jobs) || jobs < 1) throw new Error(`--jobs must be a whole number ≥ 1 — found ${flags.values.jobs}`);
  if (!Number.isInteger(workerMb) || workerMb < 128) throw new Error(`--worker-mb must be a whole number ≥ 128 — found ${flags.values["worker-mb"]}`);
  const options = { jobs, workerMemoryBudgetMb: workerMb, notify: flags.values.notify ?? null };

  if (leg === "compose") {
    const sliceArtifact = path.join(root, "later-era-smoke-slice.json");
    const sliceLabel = "the later-era smoke slice";
    const remedy = `record it with: node tools/${SCRIPT_NAME}.mjs smoke slice`;
    // Missing/corrupt inputs and occupied output paths fail before compiling.
    const recorded = await readRecordingFile(sliceArtifact, { what: sliceLabel, remedy });
    await refuseExistingArtifact(path.join(root, "later-era-smoke-report.json"), "the later-era smoke report");
    const bundle = await compileEngineTo("tools/later-eras.ts", "later-eras", path.join(dir, "bundle"));
    const m = await import(bundle);
    const source = m.playthroughSource();
    assertSmokeTier(recorded, sliceArtifact);
    assertSameCompiledSource(recorded.source, source, sliceArtifact);
    assert.equal(typeof recorded.recordingCommit, "string", "the smoke slice names its recording commit");
    execFileSync("git", ["merge-base", "--is-ancestor", recorded.recordingCommit, commit], { stdio: "pipe" });
    // Compare the actual persisted JSON representation, including the
    // seed, schedule, budget, stop, and every other behavior-affecting input.
    const recipe = m.laterEraSmokeRecipe();
    const expectedRecipe = JSON.parse(JSON.stringify(recipe));
    assert.equal(recorded.rows?.length, 1, "the smoke slice carries exactly one bounded walk");
    const row = recorded.rows[0];
    assert.deepEqual({
      recipe: recorded.recipe,
      minutes: recorded.minutes,
      policy: recorded.policy,
      row: { seed: row?.seed, sessionMinutes: row?.sessionMinutes, policy: row?.policy },
    }, {
      recipe: expectedRecipe,
      minutes: expectedRecipe.schedule.sessionMinutes,
      policy: expectedRecipe.policyId,
      row: { seed: expectedRecipe.seed, sessionMinutes: expectedRecipe.schedule.sessionMinutes, policy: expectedRecipe.policyId },
    }, `the smoke slice's recipe is not the declared smoke recipe — stale recipe evidence cannot compose; ${remedy}`);
    m.assertLaterEraSmokeRow(row);
    const reportArtifact = path.join(root, "later-era-smoke-report.json");
    await writeSmokeArtifact(reportArtifact, composeRecordingPayload({
      tier: "smoke", recordingCommit: commit, smoke: m.LATER_ERA_SMOKE, recipe: expectedRecipe,
      runs: recorded.rows,
    }, [{ path: sliceArtifact, recording: recorded }]), "the later-era smoke report");
    console.log(`smoke report: composed the bounded walk — ${reportArtifact}`);
    return { outcome: "complete" };
  }

  const tiny = leg === "run";

  if (flags.values.supervisor) {
    // The detached smoke supervisor: single-flight before any compile.
    const lock = await acquireSupervisorLock(dir);
    const bundle = await compileEngineTo("tools/later-eras.ts", "later-eras", path.join(dir, "bundle"));
    const m = await import(bundle);
    const source = m.playthroughSource();
    const planBuilder = tiny ? m.laterEraTinyJobPlan() : m.laterEraSmokeJobPlan();
    await prepareJobDir(dir, { scope: `smoke-${leg}`, bundle, commit, units: planBuilder.units });
    const { outcome, publishError } = await runSupervisor(dir,
      { scope: `smoke-${leg}`, bundle, commit, units: planBuilder.units },
      smokeAdapter(m, source, root, planBuilder, tiny),
      { ...options, detached: true, lock });
    if (publishError) console.error(publishError);
    return { outcome };
  }

  if (flags.values.detach) {
    if (!flags.values.dir) throw new Error("smoke --detach needs --dir: the detached supervisor publishes into the same root, and the default root is per-invocation");
    await compileEngineTo("tools/later-eras.ts", "later-eras", path.join(dir, "bundle"));
    const childArgs = [
      process.execPath, SCRIPT_PATH, "smoke", leg,
      "--dir", dir, "--jobs", String(jobs), "--worker-mb", String(workerMb),
      ...(flags.values.notify ? ["--notify", flags.values.notify] : []),
      "--supervisor",
    ];
    const { pid } = await launchDetachedSupervisor({ argv: childArgs, dir });
    console.log(`later-era smoke ${leg} job launched detached: ${dir} (pid ${pid})`);
    console.log(`observe: node tools/record-later-eras.mjs status --dir ${dir}`);
    if (flags.values.notify) console.log(`the notification fires once at the terminal state: ${flags.values.notify}`);
    return { outcome: "detached" };
  }

  // Single-flight before any compile — a refused second supervisor cannot
  // disturb the holder's bundle.
  const lock = await acquireSupervisorLock(dir);
  const bundle = await compileEngineTo("tools/later-eras.ts", "later-eras", path.join(dir, "bundle"));
  const m = await import(bundle);
  const source = m.playthroughSource();
  const planBuilder = tiny ? m.laterEraTinyJobPlan() : m.laterEraSmokeJobPlan();
  await prepareJobDir(dir, { scope: `smoke-${leg}`, bundle, commit, units: planBuilder.units });
  const adapter = smokeAdapter(m, source, root, planBuilder, tiny);
  const { outcome, publishError } = await runSupervisor(dir, { scope: `smoke-${leg}`, bundle, commit, units: planBuilder.units }, adapter, {
    ...options, lock,
  });
  const status = await readJobStatus(dir);
  console.log(formatStatus(dir, status));
  if (publishError) console.error(publishError);
  return { outcome };
}

// The smoke legs' recording adapter: the same identity and validation the
// production run uses, publishing only into the isolated smoke root.
const smokeAdapter = (m, source, root, planBuilder, tiny) => ({
  identityOf: (descriptor) => m.laterEraUnitIdentity(descriptor),
  validateUnit: (descriptor, payload) => m.validateLaterEraUnit(descriptor, payload),
  groups: [{
    id: tiny ? "smoke-run" : "smoke-slice",
    unitIds: planBuilder.units.map((unit) => unit.id),
    publish: async (unitsById, { commit: at }) => {
      const rows = planBuilder.units.map((unit) => unitsById[unit.id].result.row);
      for (const row of rows) m.assertLaterEraSmokeRow(row);
      if (tiny) {
        const artifact = path.join(root, "later-era-smoke-evaluation.json");
        await writeSmokeArtifact(artifact, recordingPayload({
          tier: "smoke", source, recordingCommit: at, rows,
          unitProvenance: unitProvenanceOf(unitsById),
        }), "the later-era smoke evaluation");
        return artifact;
      }
      // The smoke slice payload keeps its published shape (issue #506):
      // one bounded walk, the full declared recipe beside it.
      const recipe = JSON.parse(JSON.stringify(planBuilder.units[0].recipe));
      assert.equal(rows.length, 1, "the smoke slice carries exactly one bounded walk");
      const target = path.join(root, "later-era-smoke-slice.json");
      await writeSmokeArtifact(target, recordingPayload({
        tier: "smoke", source, recordingCommit: at, recipe,
        minutes: recipe.schedule.sessionMinutes, policy: recipe.policyId,
        rows, unitProvenance: unitProvenanceOf(unitsById),
      }), "the later-era smoke slice");
      return target;
    },
  }],
});

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  const [command, operand, ...rest] = process.argv.slice(2);
  if (command === "compose" && operand === undefined) return composeCommand();
  if (command === "status" && (operand === undefined || operand.startsWith("--"))) {
    return statusCommand(parseRunFlags(operand === undefined ? rest : [operand, ...rest]));
  }
  if (command === "smoke") {
    if (!SMOKE_LEGS.includes(operand)) throw usageError();
    const { outcome } = await smokeCommand(operand, parseRunFlags(rest));
    if (outcome === "failed") process.exitCode = 1;
    return;
  }
  if (command === "run") {
    // `run [<slice>] [flags]` and `run [flags]` both work: a leading flag
    // is never a slice.
    const sliceArg = operand !== undefined && !operand.startsWith("--") ? operand : undefined;
    const flags = parseRunFlags(sliceArg === undefined && operand !== undefined ? [operand, ...rest] : rest);
    if (sliceArg !== undefined && !SLICE_PATTERN.test(sliceArg)) throw usageError();
    const slice = sliceArg ? [Number(sliceArg.split(":")[0]), sliceArg.split(":")[1]] : null;
    const { outcome, cancelled } = await runCommand(slice, flags);
    if (outcome === "failed") process.exitCode = 1;
    if (cancelled) process.exitCode = cancelled === "SIGINT" ? 130 : 143;
    return;
  }
  throw usageError();
}

try {
  await main();
} catch (error) {
  console.error(`${SCRIPT_NAME}: ${error?.message ?? error}`);
  process.exitCode = 1;
}
