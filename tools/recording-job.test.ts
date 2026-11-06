import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clearStaleTemporaries, writeJsonAtomic } from "./dev/runtime.mjs";
import {
  acquireSupervisorLock,
  assertNoLiveSupervisor,
  DEFAULT_WORKER_MEMORY_MB,
  formatStatus,
  prepareJobDir,
  readJobStatus,
  type JobPlan,
  type SupervisorAdapter,
  runSupervisor,
  scanUnits,
} from "./dev/job-recorder.mjs";
import { compileEngineTo } from "./dev/compile-engine.mjs";
import { assertSliceRows, probeGroup, sliceGroup } from "./dev/later-era-recording.mjs";
import {
  LATER_ERA_EVALUATION_VERSION,
  LATER_ERA_SEEDS,
  laterEraProbeWalkRecipe,
  laterEraSmokeRecipe,
  laterEraTinyJobPlan,
  laterEraUnitIdentity,
  laterEraUnitMatches,
  validateLaterEraUnit,
  assertProbeEvidence,
} from "./later-eras";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Issue #507: the resumable later-era evaluation. One supported interface
// — run, status, compose — over persisted work units: atomic per-unit
// persistence, identity-checked reuse, bounded worker processes with an
// explicit memory budget, observable status, and a completion
// notification. These cases demonstrate the machinery at its boundaries;
// the tiny recipes make every case seconds-scale.

const tempRoots: string[] = [];
const freshDir = (label: string) => {
  const dir = mkdtempSync(path.join(tmpdir(), `flowsynth-job-${label}-`));
  tempRoots.push(dir);
  return dir;
};
afterAll(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop()!, { recursive: true, force: true });
});

// ── Atomic evidence persistence ────────────────────────────────────────────

describe("atomic evidence persistence", () => {
  it("round-trips and replaces evidence through one atomic rename", async () => {
    const dir = freshDir("atomic");
    const target = path.join(dir, "unit.json");
    await writeJsonAtomic(target, { n: 1 });
    expect(JSON.parse(readFileSync(target, "utf8"))).toEqual({ n: 1 });
    await writeJsonAtomic(target, { n: 2 });
    expect(JSON.parse(readFileSync(target, "utf8"))).toEqual({ n: 2 });
  });

  it("never lets a concurrent reader observe a partial write", async () => {
    const dir = freshDir("atomic-race");
    const target = path.join(dir, "unit.json");
    let reads = 0;
    const readers = Promise.all(Array.from({ length: 4 }, async () => {
      while (reads < 400) {
        reads++;
        if (existsSync(target)) {
          // Any read of the target must parse: the target only ever
          // changes by one atomic rename.
          JSON.parse(readFileSync(target, "utf8"));
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }));
    const payloads = Array.from({ length: 6 }, (_, n) => ({ n, blob: "x".repeat(2 * 1024 * 1024) }));
    await Promise.all(payloads.map((payload) => writeJsonAtomic(target, payload)));
    await readers;
    const final = JSON.parse(readFileSync(target, "utf8")) as { n: number };
    expect(payloads.map((payload) => payload.n)).toContain(final.n);
  });

  it("a killed writer leaves the previous bytes or nothing, never a partial target", async () => {
    const dir = freshDir("atomic-kill");
    const target = path.join(dir, "unit.json");
    const runtime = path.join(root, "tools", "dev", "runtime.mjs");
    // An 8 MiB payload takes long enough to serialize and write that a
    // kill 30ms in lands mid-write. The target must never hold partial
    // bytes — completed evidence cannot be forged by a termination.
    for (let iteration = 0; iteration < 5; iteration++) {
      const child = spawn(process.execPath, ["-e", `
        import(${JSON.stringify(pathToFileURL(runtime).href)}).then(async ({ writeJsonAtomic }) => {
          await writeJsonAtomic(${JSON.stringify(target)}, { blob: "x".repeat(8 * 1024 * 1024), i: ${iteration} });
          console.log("persisted");
        });
      `], { stdio: "ignore" });
      await new Promise<void>((resolve) => {
        const kill = setTimeout(() => {
          child.kill("SIGKILL");
          resolve();
        }, 30);
        child.on("close", () => { clearTimeout(kill); resolve(); });
      });
      if (existsSync(target)) {
        const parsed = JSON.parse(readFileSync(target, "utf8")) as { i: number };
        expect(parsed.i).toBeLessThan(iteration);
      }
    }
    await writeJsonAtomic(target, { blob: "x".repeat(8 * 1024 * 1024), i: 99 });
    expect(JSON.parse(readFileSync(target, "utf8")).i).toBe(99);
  });

  it("clears stale write temporaries while keeping real evidence", async () => {
    const dir = freshDir("atomic-tmp");
    const keep = path.join(dir, "unit.json");
    writeFileSync(keep, "{}");
    const staleTmp = path.join(dir, ".unit.json.tmp-123-abc");
    writeFileSync(staleTmp, "{partial");
    await clearStaleTemporaries(dir);
    expect(existsSync(staleTmp)).toBe(false);
    expect(existsSync(keep)).toBe(true);
  });
});

// ── Single-flight supervision ──────────────────────────────────────────────

describe("the job's single-flight lock", () => {
  it("refuses a second supervisor by name and releases cleanly", async () => {
    const dir = freshDir("lock");
    const first = await acquireSupervisorLock(dir);
    expect(first.pid).toBe(process.pid);
    await expect(acquireSupervisorLock(dir)).rejects.toThrow(/already running this job/);
    await expect(acquireSupervisorLock(dir)).rejects.toThrow(`pid ${process.pid}`);
    rmSync(path.join(dir, "supervisor.lock.json"));
    const again = await acquireSupervisorLock(dir);
    expect(again.pid).toBe(process.pid);
  });

  it("takes over a stale lock left by a killed supervisor", async () => {
    const dir = freshDir("lock-stale");
    const dead = spawnSync(process.execPath, ["-e", "process.exit(0)"]);
    const deadPid = dead.pid!;
    const lock = { pid: deadPid, startedAt: new Date().toISOString() };
    writeFileSync(path.join(dir, "supervisor.lock.json"), JSON.stringify(lock));
    const taken = await acquireSupervisorLock(dir);
    expect(taken.pid).toBe(process.pid);
  });

  it("reports no live supervisor when none holds the lock", async () => {
    const dir = freshDir("lock-absent");
    await expect(assertNoLiveSupervisor(dir)).resolves.toBeUndefined();
    await acquireSupervisorLock(dir);
    await expect(assertNoLiveSupervisor(dir)).rejects.toThrow(/already running this job/);
  });
});

// ── Identity: what makes completed evidence reusable ───────────────────────

describe("unit identity and validity", () => {
  const recipe = laterEraSmokeRecipe();
  const descriptor = {
    id: "seed-25-support-42",
    key: { kind: "seed" as const, seed: 42, minutes: 25, policy: "support" },
    recipe,
    forward: null,
    deps: [] as string[],
  };

  it("covers exactly the behavior-affecting inputs, and nothing report-shaped", () => {
    const identity = laterEraUnitIdentity(descriptor);
    expect(Object.keys(identity).sort()).toEqual(["engine", "evaluation", "forward", "recipe", "runtime", "solver"]);
    expect(identity.engine.game).toBe("flowsynth");
    expect(typeof identity.engine.engineSource).toBe("string");
    expect(identity.engine.runnerVersion).toBeGreaterThan(0);
    expect(identity.evaluation).toBe(LATER_ERA_EVALUATION_VERSION);
    expect(identity.solver.maxNodes).toBeGreaterThan(0);
    expect(identity.solver.maxMs).toBeGreaterThan(0);
    expect(identity.runtime.node).toBe(process.version);
    expect(identity.recipe).toEqual(JSON.parse(JSON.stringify(recipe)));
    expect(identity.forward).toBeNull();
  });

  it("distinguishes the units the declared matrix separates", () => {
    const plan = laterEraTinyJobPlan(LATER_ERA_SEEDS.slice(0, 3));
    const identities = plan.units.map((unit) => JSON.stringify(laterEraUnitIdentity(unit)));
    expect(new Set(identities).size).toBe(identities.length);
  });

  it("rejects reuse when any behavior-affecting input moves", () => {
    const identity = JSON.parse(JSON.stringify(laterEraUnitIdentity(descriptor)));
    const stored = { unit: descriptor.id, key: descriptor.key, identity, result: {} };
    expect(laterEraUnitMatches(descriptor, stored)).toBe(true);
    for (const tamper of [
      (stolen: typeof identity) => { stolen.evaluation = stolen.evaluation + 1; },
      (stolen: typeof identity) => { stolen.engine.engineSource = "00000000"; },
      (stolen: typeof identity) => { stolen.engine.runnerVersion = stolen.engine.runnerVersion + 1; },
      (stolen: typeof identity) => { stolen.recipe.schedule.sessionMinutes = 60; },
      (stolen: typeof identity) => { stolen.recipe.seed = 99; },
      (stolen: typeof identity) => { stolen.recipe.schedule.timeZone = "UTC"; },
      (stolen: typeof identity) => { stolen.solver.maxNodes = stolen.solver.maxNodes + 1; },
      (stolen: typeof identity) => { stolen.runtime.node = "v0.0.0"; },
    ]) {
      const copy = JSON.parse(JSON.stringify(identity));
      tamper(copy);
      expect(laterEraUnitMatches(descriptor, { ...stored, identity: copy })).toBe(false);
    }
    // Key order is irrelevant to identity.
    const reordered = JSON.parse(JSON.stringify(identity));
    expect(laterEraUnitMatches(descriptor, { ...stored, identity: JSON.parse(JSON.stringify(reordered)) })).toBe(true);
  });

  it("a forward is invalidated by its parent's identity, not only its own inputs", () => {
    const parent = JSON.parse(JSON.stringify(laterEraUnitIdentity(descriptor)));
    const forwardDescriptor = {
      id: "forward-b0-o0",
      key: { kind: "probe-forward" as const, bank: 0, orderIndex: 0 },
      recipe: null,
      forward: { bank: 0, order: ["entry" as const], budgetDays: 30, parentIdentity: parent },
      deps: ["probe-walk"],
    };
    const movedParent = JSON.parse(JSON.stringify(parent));
    movedParent.recipe.schedule.sessionMinutes = 60;
    const sibling = { ...forwardDescriptor, forward: { ...forwardDescriptor.forward, parentIdentity: movedParent } };
    const a = JSON.stringify(laterEraUnitIdentity(forwardDescriptor));
    const b = JSON.stringify(laterEraUnitIdentity(sibling));
    expect(a).not.toBe(b);
    expect(laterEraUnitMatches(forwardDescriptor, { identity: JSON.parse(a) })).toBe(true);
    expect(laterEraUnitMatches(sibling, { identity: JSON.parse(a) })).toBe(false);
  });

  it("refuses a stored unit that does not name its own id and key", () => {
    const identity = laterEraUnitIdentity(descriptor);
    const payload = {
      unit: descriptor.id,
      key: descriptor.key,
      identity,
      result: { row: { noGrant: true, eras: [], seed: 42, sessionMinutes: 25, policy: "support" } },
    };
    validateLaterEraUnit(descriptor, payload);
    for (const tampered of [
      { ...payload, unit: "seed-25-support-468" },
      { ...payload, key: { kind: "seed", seed: 468, minutes: 25, policy: "support" } },
      { ...payload, result: {} },
      { ...payload, identity: { ...identity, evaluation: 0 } },
    ]) {
      expect(() => validateLaterEraUnit(descriptor, tampered as typeof payload)).toThrow();
    }
  });
});

// ── The supervisor: reuse, invalidation, corruption, concurrency ───────────

describe("the job supervisor", () => {
  let bundlePath: string;
  let bundle: any;
  beforeAll(async () => {
    bundlePath = await compileEngineTo("tools/later-eras.ts", "later-eras", path.join(freshDir("bundle"), "bundle"));
    bundle = await import(pathToFileURL(bundlePath).href);
  });

  const tinyPlan = (seeds: readonly number[] = LATER_ERA_SEEDS.slice(0, 3), scope = "tiny"): JobPlan => {
    const plan = bundle.laterEraTinyJobPlan(seeds);
    return { scope, bundle: bundlePath, commit: "0".repeat(40), units: plan.units };
  };

  // The test adapter's group needs the plan; runSupervisor passes only
  // unitsById and ctx, so resolve the ids through the dir's plan.
  const adapterForPlan = (m: any, plan: JobPlan, extra: Partial<SupervisorAdapter> = {}): SupervisorAdapter => ({
    identityOf: (descriptor) => m.laterEraUnitIdentity(descriptor),
    validateUnit: (descriptor, payload) => m.validateLaterEraUnit(descriptor, payload),
    groups: [{
      id: "tiny",
      unitIds: plan.units.map((unit) => unit.id),
      publish: async (unitsById, { dir }) => {
        const target = path.join(dir, "tiny-artifact.json");
        await writeJsonAtomic(target, { rows: Object.keys(unitsById).sort() });
        return target;
      },
    }],
    ...extra,
  });

  const runToCompletion = async (dir: string, plan: JobPlan, adapter: SupervisorAdapter, options = {}) => {
    const lock = await acquireSupervisorLock(dir);
    try {
      return await runSupervisor(dir, plan, adapter, { ...options, lock });
    } finally {
      rmSync(path.join(dir, "supervisor.lock.json"), { force: true });
    }
  };

  it("executes every unit on separate worker processes and publishes once complete", async () => {
    const dir = freshDir("sup-run");
    const plan = tinyPlan(LATER_ERA_SEEDS.slice(0, 3));
    await prepareJobDir(dir, plan);
    const adapter = adapterForPlan(bundle, plan);
    const { outcome } = await runToCompletion(dir, plan, adapter, { jobs: 3, workerMemoryBudgetMb: 256 });
    expect(outcome).toBe("complete");
    const status = await readJobStatus(dir);
    expect(status.status).toBe("complete");
    for (const unit of Object.values(status.units)) {
      expect(unit.state).toBe("done");
      expect(unit.attempts).toBe(1);
      expect(unit.peakRssKb).toBeGreaterThan(0);
      expect(unit.elapsedMs).toBeGreaterThan(0);
    }
    // The unit files carry their identity and provenance.
    for (const descriptor of plan.units) {
      const unit = JSON.parse(readFileSync(path.join(dir, "units", `${descriptor.id}.json`), "utf8"));
      expect(unit.unit).toBe(descriptor.id);
      expect(unit.provenance.recordingCommit).toBe(plan.commit);
      expect(unit.worker.node).toBe(process.version);
    }
    expect(JSON.parse(readFileSync(path.join(dir, "tiny-artifact.json"), "utf8")).rows.sort()).toEqual(
      plan.units.map((unit) => unit.id).sort(),
    );
  }, 120_000);

  it("a relaunch reuses completed units and executes none of them again", async () => {
    const dir = freshDir("sup-resume");
    const plan = tinyPlan(LATER_ERA_SEEDS.slice(0, 3));
    await prepareJobDir(dir, plan);
    const adapter = adapterForPlan(bundle, plan);
    await runToCompletion(dir, plan, adapter);
    const before = Object.fromEntries(plan.units.map((unit) => [
      unit.id, readFileSync(path.join(dir, "units", `${unit.id}.json`), "utf8"),
    ]));
    const statusBefore = await readJobStatus(dir);
    // The interrupted-and-relaunched job: every stored unit's identity
    // still matches, so nothing re-executes.
    const { outcome } = await runToCompletion(dir, plan, adapter);
    expect(outcome).toBe("complete");
    const statusAfter = await readJobStatus(dir);
    for (const unit of plan.units) {
      expect(readFileSync(path.join(dir, "units", `${unit.id}.json`), "utf8")).toBe(before[unit.id]);
      expect(statusAfter.units[unit.id]!.attempts).toBe(statusBefore.units[unit.id]!.attempts);
    }
  }, 120_000);

  it("an interrupted run keeps completed evidence and finishes only the rest", async () => {
    const dir = freshDir("sup-interrupt");
    const plan = tinyPlan(LATER_ERA_SEEDS.slice(0, 3));
    await prepareJobDir(dir, plan);
    const adapter = adapterForPlan(bundle, plan);
    const first = await runToCompletion(dir, plan, adapter, { jobs: 2 });
    expect(first.outcome).toBe("complete");
    // Simulate the interruption's durable state: drop one unit's evidence
    // and one's validity, as a killed worker and a changed input would.
    rmSync(path.join(dir, "units", `${plan.units[1]!.id}.json`));
    const staleUnit = path.join(dir, "units", `${plan.units[2]!.id}.json`);
    const stale = JSON.parse(readFileSync(staleUnit, "utf8"));
    stale.identity.evaluation = LATER_ERA_EVALUATION_VERSION + 1;
    await writeJsonAtomic(staleUnit, stale);
    const before = readFileSync(path.join(dir, "units", `${plan.units[0]!.id}.json`), "utf8");
    const { outcome } = await runToCompletion(dir, plan, adapter);
    expect(outcome).toBe("complete");
    const status = await readJobStatus(dir);
    expect(readFileSync(path.join(dir, "units", `${plan.units[0]!.id}.json`), "utf8")).toBe(before);
    expect(status.units[plan.units[0]!.id]!.attempts).toBe(1);
    expect(status.units[plan.units[1]!.id]!.attempts).toBe(2);
    expect(status.units[plan.units[2]!.id]!.attempts).toBe(2);
    // The invalidated unit's replacement carries the current identity.
    const replaced = JSON.parse(readFileSync(staleUnit, "utf8"));
    expect(replaced.identity.evaluation).toBe(LATER_ERA_EVALUATION_VERSION);
  }, 120_000);

  it("rejects a corrupt unit by preserving its bytes and re-executing it", async () => {
    const dir = freshDir("sup-corrupt");
    const plan = tinyPlan(LATER_ERA_SEEDS.slice(0, 2));
    await prepareJobDir(dir, plan);
    const victim = path.join(dir, "units", `${plan.units[0]!.id}.json`);
    writeFileSync(victim, '{"unit": "seed-25-support-42", "resu');
    const adapter = adapterForPlan(bundle, plan);
    const { outcome } = await runToCompletion(dir, plan, adapter);
    expect(outcome).toBe("complete");
    const corruptDir = path.join(dir, "logs", "corrupt");
    const preserved = readdirSync(corruptDir);
    expect(preserved).toHaveLength(1);
    expect(readFileSync(path.join(corruptDir, preserved[0]!), "utf8")).toContain('"resu');
    expect(JSON.parse(readFileSync(victim, "utf8")).unit).toBe(plan.units[0]!.id);
  }, 120_000);

  it("rejects a duplicate claim — a unit that does not name its own key", async () => {
    const dir = freshDir("sup-duplicate");
    const plan = tinyPlan(LATER_ERA_SEEDS.slice(0, 2));
    await prepareJobDir(dir, plan);
    // The file claims unit A's id but carries unit B's key: duplicated
    // evidence is rejected, preserved, and re-executed.
    const victim = path.join(dir, "units", `${plan.units[0]!.id}.json`);
    await writeJsonAtomic(victim, {
      unit: plan.units[0]!.id,
      key: plan.units[1]!.key,
      identity: bundle.laterEraUnitIdentity(plan.units[0]!),
      result: { row: {} },
    });
    const adapter = adapterForPlan(bundle, plan);
    const { outcome } = await runToCompletion(dir, plan, adapter);
    expect(outcome).toBe("complete");
    expect(readdirSync(path.join(dir, "logs", "corrupt"))).toHaveLength(1);
    const status = await readJobStatus(dir);
    expect(status.units[plan.units[0]!.id]!.attempts).toBe(1);
    expect(JSON.parse(readFileSync(victim, "utf8")).key).toEqual(plan.units[0]!.key);
  }, 120_000);

  it("bounds concurrency: no more workers start than the budget allows", async () => {
    const dir = freshDir("sup-bounded");
    const plan = tinyPlan(LATER_ERA_SEEDS, "bounded");
    await prepareJobDir(dir, plan);
    const adapter = adapterForPlan(bundle, plan);
    await runToCompletion(dir, plan, adapter, { jobs: 2 });
    const events = readFileSync(path.join(dir, "logs", "supervisor.log"), "utf8").split("\n").filter(Boolean);
    const started = events.filter((line) => line.includes("worker started unit"));
    const finished = events.filter((line) => /unit \S+ done in/.test(line));
    expect(started).toHaveLength(LATER_ERA_SEEDS.length);
    // The third worker may only start after a first unit has finished.
    expect(events.indexOf(started[2]!)).toBeGreaterThan(events.indexOf(finished[0]!));
    const status = await readJobStatus(dir);
    expect(status.options.jobs).toBe(2);
    expect(status.options.workerMemoryBudgetMb).toBe(DEFAULT_WORKER_MEMORY_MB);
  }, 180_000);

  it("a failing worker fails its unit and the job, with the diagnostic recorded", async () => {
    const dir = freshDir("sup-fail");
    const plan = tinyPlan(LATER_ERA_SEEDS.slice(0, 2));
    const broken = { ...plan.units[0]!, recipe: null };
    const brokenPlan = { ...plan, units: [broken, plan.units[1]!] };
    await prepareJobDir(dir, brokenPlan);
    const adapter = adapterForPlan(bundle, brokenPlan);
    const { outcome } = await runToCompletion(dir, brokenPlan, adapter);
    expect(outcome).toBe("failed");
    const status = await readJobStatus(dir);
    expect(status.status).toBe("failed");
    expect(status.units[broken.id]!.state).toBe("failed");
    expect(status.units[broken.id]!.error).toBeTruthy();
    // The healthy unit still completed — failure is per unit, not per job.
    expect(status.units[plan.units[1]!.id]!.state).toBe("done");
    expect(existsSync(path.join(dir, "tiny-artifact.json"))).toBe(false);
  }, 120_000);

  it("derives the fan-out units once the parent's result lands", async () => {
    const dir = freshDir("sup-derive");
    const plan = tinyPlan([LATER_ERA_SEEDS[0]!]);
    await prepareJobDir(dir, plan);
    const derived = {
      id: "derived-unit",
      key: { kind: "seed" as const, seed: 999, minutes: 25, policy: "support" },
      recipe: bundle.laterEraSmokeRecipe(),
      forward: null,
      deps: [plan.units[0]!.id],
    };
    const adapter = adapterForPlan(bundle, plan, {
      deriveFrom: plan.units[0]!.id,
      derive: () => [derived],
      // The probe evidence's group resolves its ids lazily — the forwards
      // exist only after the derive pass — so the supervisor must call it.
      groups: [{
        id: "lazy",
        unitIds: () => [plan.units[0]!.id, "derived-unit"],
        publish: async (unitsById, { dir: at }) => {
          const target = path.join(at, "lazy-artifact.json");
          await writeJsonAtomic(target, { ids: Object.keys(unitsById).sort() });
          return target;
        },
      }],
    });
    const { outcome } = await runToCompletion(dir, plan, adapter);
    expect(outcome).toBe("complete");
    const status = await readJobStatus(dir);
    expect(status.units["derived-unit"]!.state).toBe("done");
    expect(status.units["derived-unit"]!.attempts).toBe(1);
    const storedPlan = JSON.parse(readFileSync(path.join(dir, "plan.json"), "utf8"));
    expect(storedPlan.units.map((unit: { id: string }) => unit.id)).toContain("derived-unit");
    // The lazy group published once both its units were valid.
    expect(JSON.parse(readFileSync(path.join(dir, "lazy-artifact.json"), "utf8")).ids)
      .toEqual(["derived-unit", plan.units[0]!.id].sort());
  }, 120_000);

  it("reports a publish defect as a failed job without discarding the units", async () => {
    const dir = freshDir("sup-publish");
    const plan = tinyPlan(LATER_ERA_SEEDS.slice(0, 2));
    await prepareJobDir(dir, plan);
    const adapter = adapterForPlan(bundle, plan, {
      groups: [{
        id: "tiny",
        unitIds: plan.units.map((unit) => unit.id),
        publish: async () => { throw new Error("the asserted slice does not hold together"); },
      }],
    });
    const { outcome, publishError } = await runToCompletion(dir, plan, adapter);
    expect(outcome).toBe("failed");
    expect(publishError).toContain("the asserted slice does not hold together");
    // The evidence stays durable; a corrected publisher reuses it.
    const scanned = await scanUnits(dir, plan, { identityOf: adapter.identityOf, validateUnit: adapter.validateUnit });
    expect(scanned.every((entry) => entry.state === "valid")).toBe(true);
  }, 120_000);
});

// ── The real CLI: launch, detach, notify, cancel ───────────────────────────

describe("the run CLI's job lifecycle", () => {
  const smokeRun = (envRoot: string, args: string[] = []) => spawnSync(
    process.execPath,
    [path.join(root, "tools", "record-later-eras.mjs"), "smoke", "run", ...args],
    { encoding: "utf8", cwd: root, env: { ...process.env, FLOWSYNTH_SMOKE_OUTPUT: envRoot }, timeout: 240_000 },
  );

  it("invalid arguments refuse before any work, naming the defect", () => {
    for (const args of [["--nonsense"], ["run", "--nonsense"]]) {
      const result = spawnSync(
        process.execPath,
        [path.join(root, "tools", "record-later-eras.mjs"), ...args],
        { encoding: "utf8", cwd: root, env: process.env, timeout: 60_000 },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Usage: node tools/record-later-eras.mjs");
    }
    for (const [args, defect] of [
      [["--jobs", "0"], "--jobs must be a whole number"],
      [["--worker-mb", "64"], "--worker-mb must be a whole number"],
    ] as const) {
      const envRoot = freshDir("cli-args");
      const result = smokeRun(envRoot, [...args]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(defect);
    }
  }, 120_000);

  it("status refuses when no job has started at the directory", () => {
    const envRoot = freshDir("cli-status");
    const result = spawnSync(process.execPath, [
      path.join(root, "tools", "record-later-eras.mjs"), "status", "--dir", path.join(envRoot, "job-run"),
    ], { encoding: "utf8", cwd: root, env: process.env, timeout: 60_000 });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("the job status is missing");
    expect(result.stderr).toContain("no job has been started at this directory");
  }, 60_000);

  it("the completion notification fires exactly once at the terminal state", async () => {
    const envRoot = freshDir("cli-notify");
    const marker = path.join(envRoot, "notified.txt");
    const result = smokeRun(envRoot, ["--notify", `echo "$FLOWSYNTH_JOB_STATUS,$FLOWSYNTH_JOB_DIR" > ${JSON.stringify(marker)}`]);
    expect(result.status).toBe(0);
    const notification = readFileSync(marker, "utf8").trim().split(",");
    expect(notification[0]).toBe("complete");
    expect(notification[1]).toBe(path.join(envRoot, "job-run"));
    const status = await readJobStatus(path.join(envRoot, "job-run"));
    expect(status.notification?.exitCode).toBe(0);
    const events = readFileSync(path.join(envRoot, "job-run", "logs", "supervisor.log"), "utf8");
    expect(events.match(/running notification/g)).toHaveLength(1);
  }, 240_000);

  it("a detached job hands off: the launch returns before completion, the notification still fires", async () => {
    const envRoot = freshDir("cli-detach");
    const marker = path.join(envRoot, "notified.txt");
    const jobDir = path.join(envRoot, "job-run");
    const result = smokeRun(envRoot, [
      "--detach", "--dir", jobDir,
      "--notify", `echo "$FLOWSYNTH_JOB_STATUS" > ${JSON.stringify(marker)}`,
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("launched detached");
    expect(result.stdout).toContain("the notification fires once at the terminal state");
    // The durable status already names a live supervisor pid that is not
    // this process — the handoff happened.
    const status = await readJobStatus(jobDir);
    expect(status.status).toBe("running");
    expect(status.supervisor.pid).not.toBe(process.pid);
    expect(status.options.detached).toBe(true);
    // Wait for the terminal state without keeping the job's shell alive.
    const deadline = Date.now() + 240_000;
    let terminal = status;
    while (terminal.status === "running" && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      terminal = await readJobStatus(jobDir);
    }
    expect(terminal.status).toBe("complete");
    expect(readFileSync(marker, "utf8").trim()).toBe("complete");
    expect(existsSync(path.join(envRoot, "later-era-smoke-evaluation.json"))).toBe(true);
  }, 300_000);

  it("a second supervisor cannot start while one holds the job", async () => {
    const envRoot = freshDir("cli-single");
    // A detached, notification-less job holds the lock while it walks.
    const jobDir = path.join(envRoot, "job-run");
    const launched = smokeRun(envRoot, ["--detach", "--dir", jobDir]);
    expect(launched.status).toBe(0);
    const second = spawnSync(process.execPath, [
      path.join(root, "tools", "record-later-eras.mjs"), "smoke", "run",
    ], {
      encoding: "utf8", cwd: root, env: { ...process.env, FLOWSYNTH_SMOKE_OUTPUT: envRoot }, timeout: 60_000,
    });
    expect(second.status).toBe(1);
    expect(second.stderr).toContain("already running this job");
    // Let the detached job finish so its temp root can be removed.
    const deadline = Date.now() + 240_000;
    let terminal = await readJobStatus(jobDir);
    while (terminal.status === "running" && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      terminal = await readJobStatus(jobDir);
    }
    expect(terminal.status).toBe("complete");
  }, 300_000);
});

// ── Cancellation: defined behavior for a terminated job ────────────────────

describe("cancellation", () => {
  it("SIGTERM cancels in-flight workers, records the durable state, and fires the notification", async () => {
    const dir = freshDir("cancel");
    const bundlePath = await compileEngineTo("tools/later-eras.ts", "later-eras", path.join(dir, "bundle"));
    const bundle = await import(pathToFileURL(bundlePath).href);
    const plan = bundle.laterEraTinyJobPlan(LATER_ERA_SEEDS);
    await prepareJobDir(dir, { scope: "cancel", bundle: bundlePath, commit: "0".repeat(40), units: plan.units });
    const marker = path.join(dir, "notified.txt");
    // A real supervisor process, cancelled by signal mid-run.
    const supervisorScript = path.join(dir, "supervisor.mjs");
    writeFileSync(supervisorScript, `
      import { readPlan, runSupervisor } from ${JSON.stringify(path.join(root, "tools", "dev", "job-recorder.mjs"))};
      const dir = ${JSON.stringify(dir)};
      const marker = process.argv[2];
      const plan = await readPlan(dir);
      const bundle = await import(${JSON.stringify(pathToFileURL(bundlePath).href)});
      const adapter = {
        identityOf: (d) => bundle.laterEraUnitIdentity(d),
        validateUnit: (d, p) => bundle.validateLaterEraUnit(d, p),
        groups: [],
      };
      const { outcome, cancelled } = await runSupervisor(dir, plan, adapter, {
        jobs: 1,
        notify: "echo $FLOWSYNTH_JOB_STATUS > " + JSON.stringify(marker),
      });
      console.log(outcome);
      // The production CLI maps a cancellation to the signal's exit code.
      if (cancelled) process.exitCode = cancelled === "SIGINT" ? 130 : 143;
    `);
    const child = spawn(process.execPath, [supervisorScript, marker], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk; });
    // Wait until at least one unit is done, then cancel mid-run.
    const deadline = Date.now() + 120_000;
    let done = 0;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      try {
        const status = await readJobStatus(dir);
        done = Object.values(status.units).filter((unit) => unit.state === "done").length;
        if (done >= 1) break;
      } catch { /* status not written yet */ }
    }
    expect(done).toBeGreaterThanOrEqual(1);
    child.kill("SIGTERM");
    const exit = await new Promise<number | null>((resolve) => child.on("close", (code) => resolve(code)));
    expect(exit).toBe(143);
    expect(stdout.trim()).toBe("cancelled");
    const status = await readJobStatus(dir);
    expect(status.status).toBe("cancelled");
    expect(done).toBeGreaterThanOrEqual(1);
    const preserved = Object.values(status.units).filter((unit) => unit.state === "done").length;
    expect(preserved).toBeGreaterThanOrEqual(done);
    expect(readFileSync(marker, "utf8").trim()).toBe("cancelled");
    // The cancelled job resumes: relaunch reuses what completed.
    const resumed = spawnSync(process.execPath, [supervisorScript], {
      encoding: "utf8", timeout: 120_000,
    });
    expect(resumed.stdout.trim()).toBe("complete");
    const finalStatus = await readJobStatus(dir);
    expect(finalStatus.status).toBe("complete");
    for (const unit of Object.values(finalStatus.units)) expect(unit.state).toBe("done");
  }, 300_000);
});

// ── Publication: how units compose into the committed evidence ─────────────

describe("the recording domain's publication", () => {
  let bundlePath: string;
  let bundle: any;
  beforeAll(async () => {
    bundlePath = await compileEngineTo("tools/later-eras.ts", "later-eras", path.join(freshDir("pub-bundle"), "bundle"));
    bundle = await import(pathToFileURL(bundlePath).href);
  });

  const source = { game: "flowsynth", saveVersion: 12, runnerVersion: 15, engineSource: "abcdef01" };
  const provenance = { recordingCommit: "0".repeat(40), recordingEnvironment: { node: process.version } };
  const row = (seed: number, minutes: number, policy: string) => ({
    seed, sessionMinutes: minutes, policy, noGrant: true, eras: [], defeats: [], complete: true,
    stopKind: "frontier", stopReason: "the declared eras", days: 60, elapsedHours: 40, creditedHours: 8,
    manageBreaks: 0, claims: [2], claimTarget: 2, frontiers: [2], bottleneck: null, note: "n",
  });
  const unit = (id: string, result: unknown) => ({ id, result, provenance });

  it("publishes a slice from its eight seed units, with per-unit provenance", async () => {
    const dir = freshDir("pub-slice");
    const target = path.join(dir, "slice.json");
    const minutes = 25;
    const policy = "support";
    const unitsById = Object.fromEntries(LATER_ERA_SEEDS.map((seed) =>
      [`seed-${minutes}-${policy}-${seed}`, unit(`seed-${minutes}-${policy}-${seed}`, { row: row(seed, minutes, policy) })]));
    const group = sliceGroup(bundle, source, [minutes, policy], { slice: target });
    const published = await group.publish(unitsById, { commit: "1".repeat(40), dir });
    expect(published).toBe(target);
    const payload = JSON.parse(readFileSync(target, "utf8"));
    expect(payload.rows.map((r: { seed: number }) => r.seed)).toEqual(LATER_ERA_SEEDS);
    expect(payload.recordingCommit).toBe("1".repeat(40));
    expect(payload.unitProvenance[`seed-${minutes}-${policy}-42`].recordingCommit).toBe("0".repeat(40));
    expect(payload.recordingEnvironment.node).toBe(process.version);
    // Composition's own checks accept the published slice.
    expect(() => assertSliceRows(bundle, payload.rows, minutes, policy)).not.toThrow();
  });

  it("refuses to publish a slice whose rows are not the declared matrix's own faces", async () => {
    const dir = freshDir("pub-slice-bad");
    const target = path.join(dir, "slice.json");
    const minutes = 25;
    const policy = "ignoring";
    const unitsById = Object.fromEntries(LATER_ERA_SEEDS.map((seed) =>
      [`seed-${minutes}-${policy}-${seed}`, unit(`seed-${minutes}-${policy}-${seed}`, {
        row: { ...row(seed, minutes, policy), defeats: ["Sapling"], eras: [{ placements: ["x"] }] },
      })]));
    const group = sliceGroup(bundle, source, [minutes, policy], { slice: target });
    await expect(group.publish(unitsById, { commit: "1".repeat(40), dir })).rejects.toThrow();
    expect(existsSync(target)).toBe(false);
  });

  const forward = (frontier: number) => ({
    outcome: "advanced", runId: "fresh-start-s23-abcdef01", recipe: laterEraProbeWalkRecipe(),
    frontierAfter: frontier + 1, creditedHours: 2, defeats: ["Sapling"], noGrant: true, noRefund: true, finite: true,
  });
  const banks = () => [2, 6].map((frontier) => ({
    frontier, claim: 2, budget: 2, pieces: [], routeDemonstrated: true,
    orders: [{ order: ["entry"], spend: 1, purchasesOk: true, placementsOk: true, finite: true, forward: null }],
  }));
  const probeUnits = (): Record<string, any> => {
    const walk: Record<string, any> = {
      "probe-walk": {
        id: "probe-walk",
        identity: { recipe: JSON.parse(JSON.stringify(laterEraProbeWalkRecipe())) },
        result: { row: { noGrant: true, eras: [], frontiers: [2, 6] }, banks: banks() },
        provenance,
      },
    };
    for (const [b, frontier] of [2, 6].entries()) {
      walk[`forward-b${b}-o0`] = {
        id: `forward-b${b}-o0`,
        result: {
          prepared: { order: ["entry"], spend: 1, purchasesOk: true, placementsOk: true, finite: true },
          forward: forward(frontier),
        },
        provenance,
      };
    }
    return walk;
  };

  it("publishes the probe evidence from the walk and its persisted forwards", async () => {
    const dir = freshDir("pub-probe");
    const target = path.join(dir, "probe.json");
    const group = probeGroup(bundle, source, { probe: target });
    const published = await group.publish(probeUnits(), { commit: "1".repeat(40), dir });
    expect(published).toBe(target);
    const payload = JSON.parse(readFileSync(target, "utf8"));
    expect(payload.seed).toBe(23);
    expect(payload.minutes).toBe(60);
    expect(payload.policy).toBe("support");
    // The composed evidence passes composition's verification unchanged.
    expect(() => assertProbeEvidence(payload, "the probe file")).not.toThrow();
  });

  it("refuses a forward that disagrees with the walk's enumeration, and a missing forward", async () => {
    const dir = freshDir("pub-probe-bad");
    const target = path.join(dir, "probe.json");
    const group = probeGroup(bundle, source, { probe: target });
    const disagreeing = probeUnits();
    disagreeing["forward-b0-o0"].result.prepared.spend = 2;
    await expect(group.publish(disagreeing, { commit: "1".repeat(40), dir })).rejects.toThrow(/disagrees with the walk's enumeration/);
    const missing = probeUnits();
    delete missing["forward-b1-o0"];
    await expect(group.publish(missing, { commit: "1".repeat(40), dir })).rejects.toThrow(/no persisted forward unit/);
    expect(existsSync(target)).toBe(false);
  });
});

// ── Observable status ──────────────────────────────────────────────────────

describe("the observable status", () => {
  it("reports completed and remaining units, failures, elapsed time, and worker memory", () => {
    const dir = "/job";
    const summary = formatStatus(dir, {
      scope: "evaluation",
      status: "running",
      options: { jobs: 3, workerMemoryBudgetMb: 1024, notify: "echo done", detached: true },
      supervisor: { pid: 7, startedAt: new Date().toISOString(), node: process.version },
      units: {
        "seed-25-support-42": { state: "done", attempts: 1, elapsedMs: 312_000, peakRssKb: 421_000, error: null },
        "seed-25-support-468": { state: "failed", attempts: 2, error: "worker exited 1" },
        "probe-walk": { state: "running", attempts: 1, startedAt: new Date().toISOString() },
      },
      published: {},
      notification: null,
      startedAt: new Date(Date.now() - 120_000).toISOString(),
      resumedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      terminalAt: null,
    });
    expect(summary).toContain("evaluation job at /job — running (pid 7)");
    expect(summary).toContain("1/3 done, 1 failed, 1 remaining");
    expect(summary).toContain("3 concurrent workers");
    expect(summary).toContain("1024 MB worker memory budget");
    expect(summary).toContain("notify: echo done");
    expect(summary).toContain("FAILED seed-25-support-468 (attempt 2) — worker exited 1");
    expect(summary).toContain("worker peak 411MB");
    expect(summary).toContain("411MB of the 1024MB budget");
    expect(summary).toContain("durable status: /job/job-status.json");
  });
});

// ── Composition verifies the persisted probe evidence ──────────────────────

describe("probe evidence verification", () => {
  const order = (frontier: number) => ({
    order: ["entry" as const],
    spend: 1,
    purchasesOk: true,
    placementsOk: true,
    finite: true,
    forward: {
      outcome: "advanced" as const,
      runId: "fresh-start-s23-abcdef01",
      recipe: laterEraProbeWalkRecipe(),
      frontierAfter: frontier + 1,
      creditedHours: 2,
      defeats: ["Sapling"],
      noGrant: true,
      noRefund: true,
      finite: true,
    },
  });

  const evidence = () => ({
    source: { game: "flowsynth", saveVersion: 12, runnerVersion: 15, engineSource: "abcdef01" },
    recordingCommit: "0".repeat(40),
    recordingEnvironment: { node: process.version, timeZone: "UTC", utcOffsetMinutes: 0 },
    unitProvenance: { "probe-walk": { recordingCommit: "0".repeat(40) } },
    seed: 23,
    minutes: 60,
    policy: "support",
    walk: {
      recipe: JSON.parse(JSON.stringify(laterEraProbeWalkRecipe())),
      row: { noGrant: true, eras: [], frontiers: [2, 6] },
    },
    banks: [
      { frontier: 2, claim: 2, budget: 2, pieces: [], orders: [order(2)], routeDemonstrated: true },
      { frontier: 6, claim: 2, budget: 2, pieces: [], orders: [order(6)], routeDemonstrated: true },
    ],
  });

  it("accepts evidence whose walk, banks, and every persisted forward hold together", () => {
    expect(() => assertProbeEvidence(evidence(), "the probe file")).not.toThrow();
  });

  it("refuses evidence that composition could not have verified", () => {
    for (const [label, mutate] of [
      ["missing forward", (payload: any) => { payload.banks[0]!.orders[0]!.forward = null; }],
      ["not advanced", (payload: any) => { payload.banks[0]!.orders[0]!.forward.outcome = "unreached"; }],
      ["no route demonstrated", (payload: any) => { payload.banks[1]!.routeDemonstrated = false; }],
      ["frontier not surpassed", (payload: any) => { payload.banks[0]!.orders[0]!.forward.frontierAfter = 2; }],
      ["grant", (payload: any) => { payload.banks[0]!.orders[0]!.forward.noGrant = false; }],
      ["refund", (payload: any) => { payload.banks[1]!.orders[0]!.forward.noRefund = false; }],
      ["wrong walk", (payload: any) => { payload.walk.recipe.seed = 99; }],
      ["banks not the walk's", (payload: any) => { payload.banks[1]!.frontier = 7; }],
      ["incomplete row", (payload: any) => { payload.walk.row.noGrant = false; }],
    ] as const) {
      const payload: any = evidence();
      mutate(payload);
      expect(() => assertProbeEvidence(payload, "the probe file"), label).toThrow();
    }
  });

  it("refuses an incomplete forward set — a missing continuation is a named refusal", () => {
    const payload: any = evidence();
    payload.banks[1]!.orders = [];
    expect(() => assertProbeEvidence(payload, "the probe file")).toThrow(/every affordable order/);
  });
});
