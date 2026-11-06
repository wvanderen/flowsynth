import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { compileEngineTo } from "./dev/compile-engine.mjs";
import { acquireSupervisorLock, prepareJobDir, readJobStatus } from "./dev/job-recorder.mjs";
import { mergedPlanUnits, sliceGroup } from "./dev/later-era-recording.mjs";

const root = process.cwd();
const roots: string[] = [];
const fresh = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "flowsynth-recording-review-"));
  roots.push(dir);
  return dir;
};
afterAll(() => { for (const dir of roots) rmSync(dir, { recursive: true, force: true }); });
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 30_000;
  while (!await predicate()) {
    if (Date.now() > deadline) throw new Error("timed out waiting for the recording transition");
    await pause(25);
  }
}
const cli = (dir: string, args: string[]) => spawnSync(process.execPath,
  [path.join(root, "tools/record-later-eras.mjs"), ...args],
  { cwd: root, encoding: "utf8", timeout: 60_000, env: { ...process.env, FLOWSYNTH_SMOKE_OUTPUT: dir } });

// These are structural fixtures, not balance measurements. The integration
// case below still executes the real worker and the real bounded recipe.
describe("recording review boundaries (#519)", () => {
  let m: any;
  let bundle: string;
  beforeAll(async () => {
    bundle = await compileEngineTo("tools/later-eras.ts", "later-eras", path.join(fresh(), "bundle"));
    m = await import(pathToFileURL(bundle).href);
  });
  const row = (seed: number, minutes: number, policy: string) => ({
    seed, sessionMinutes: minutes, policy, noGrant: true, eras: [], defeats: [], frontiers: [2, 6],
  });
  const probe = () => {
    const walk = m.laterEraJobPlan().units.find((d: any) => d.id === "probe-walk");
    const banks = [2, 6].map(frontier => ({
      frontier, claim: 2, budget: 2, pieces: [{ piece: "entry", price: 1 }], routeDemonstrated: true,
      orders: [[], ["entry"]].map(order => ({
        order, spend: order.length, purchasesOk: true, placementsOk: false, finite: true,
        forward: { outcome: "advanced", runId: "fixture", recipe: m.laterEraProbeWalkRecipe(),
          frontierAfter: frontier + 1, creditedHours: 2, defeats: [], noGrant: true, noRefund: true, finite: true },
      })),
    }));
    const descriptors = [walk, ...m.laterEraJobPlan().derive(banks, m.laterEraUnitIdentity(walk))];
    return {
      source: m.playthroughSource(), recordingCommit: "0".repeat(40),
      seed: 23, minutes: 60, policy: "support", walk: { recipe: walk.recipe, row: row(23, 60, "support") }, banks,
      unitProvenance: Object.fromEntries(descriptors.map((d: any) => [d.id, {
        recordingCommit: "0".repeat(40), identity: m.laterEraUnitIdentity(d),
      }])),
    };
  };

  it("rebuilds resumed forwards with the current budget, not the old descriptor", async () => {
    const dir = fresh();
    const builder = m.laterEraJobPlan();
    const walk = builder.units.find((d: any) => d.id === "probe-walk");
    const evidence = probe();
    const parent = {
      unit: walk.id, key: walk.key, identity: m.laterEraUnitIdentity(walk),
      result: { row: evidence.walk.row, banks: evidence.banks, record: { recipe: walk.recipe, snapshots: [{}] } },
    };
    const forwards = builder.derive(evidence.banks, parent.identity);
    await prepareJobDir(dir, { scope: "evaluation", bundle, commit: "0".repeat(40), units: [...builder.units, ...forwards] });
    writeFileSync(path.join(dir, "units/probe-walk.json"), JSON.stringify(parent));
    // Change the actual compiled declaration: changing an exported property
    // on a mock would leave the plan builder's closure at the old budget.
    const text = readFileSync(bundle, "utf8");
    const changed = text.replace("const PROBE_FORWARD_BUDGET_DAYS = LONG_BUDGET_DAYS;", "const PROBE_FORWARD_BUDGET_DAYS = 15;");
    expect(changed).not.toBe(text);
    const changedBundle = path.join(path.dirname(bundle), "changed-budget.mjs");
    writeFileSync(changedBundle, changed);
    const current = await import(pathToFileURL(changedBundle).href);
    const merged = await mergedPlanUnits(dir, current, current.laterEraJobPlan());
    const derived = merged.filter((d: any) => d.key.kind === "probe-forward");
    expect(derived).toHaveLength(forwards.length);
    expect(derived.every((d: any) => d.forward.budgetDays === 15)).toBe(true);
    expect(current.laterEraUnitMatches(derived[0], { identity: m.laterEraUnitIdentity(forwards[0]) })).toBe(false);
  });

  it("publishes recorded identities and refuses stale evaluation evidence at composition", async () => {
    const dir = fresh();
    const plan = m.laterEraSliceJobPlan(25, "support");
    const units = Object.fromEntries(plan.units.map((d: any) => [d.id, {
      identity: m.laterEraUnitIdentity(d), result: { row: row(d.key.seed, 25, "support") },
      provenance: { recordingCommit: "0".repeat(40) },
    }]));
    const target = path.join(dir, "slice.json");
    await sliceGroup(m, m.playthroughSource(), [25, "support"], { slice: target }).publish(units, { commit: "0".repeat(40), dir });
    const recorded = JSON.parse(readFileSync(target, "utf8"));
    expect(recorded.unitProvenance[plan.units[0].id].identity).toEqual(units[plan.units[0].id].identity);
    const { assertSliceEvidence } = await import("./dev/later-era-recording.mjs");
    expect(() => assertSliceEvidence(m, recorded, 25, "support")).not.toThrow();
    const text = readFileSync(bundle, "utf8");
    const changed = text.replace(`const LATER_ERA_EVALUATION_VERSION = ${m.LATER_ERA_EVALUATION_VERSION};`,
      `const LATER_ERA_EVALUATION_VERSION = ${m.LATER_ERA_EVALUATION_VERSION + 1};`);
    expect(changed).not.toBe(text);
    const changedBundle = path.join(path.dirname(bundle), "changed-evaluation.mjs");
    writeFileSync(changedBundle, changed);
    const current = await import(pathToFileURL(changedBundle).href);
    expect(current.playthroughSource()).toEqual(m.playthroughSource());
    expect(() => assertSliceEvidence(current, recorded, 25, "support")).toThrow(/identity/);
    expect(() => current.assertProbeEvidence(probe(), "probe")).toThrow(/identity/);
  });

  it("requires every affordable order exactly once and complete identity provenance", () => {
    expect(() => m.assertProbeEvidence(probe(), "probe")).not.toThrow();
    for (const mutate of [
      (p: any) => { p.banks[0].orders.pop(); },
      (p: any) => { p.banks[0].orders[1] = p.banks[0].orders[0]; },
      (p: any) => { p.unitProvenance = {}; },
      (p: any) => { delete p.unitProvenance["forward-b0-o0"]; },
      (p: any) => { p.unitProvenance["unexpected"] = p.unitProvenance["probe-walk"]; },
    ]) {
      const p = probe(); mutate(p);
      expect(() => m.assertProbeEvidence(p, "probe")).toThrow();
    }
  });

  it("refuses a detached second launch without touching the live bundle", async () => {
    const dir = fresh();
    const job = path.join(dir, "job");
    await acquireSupervisorLock(job);
    mkdirSync(path.join(job, "bundle"));
    const sentinel = path.join(job, "bundle/live-chunk.mjs");
    writeFileSync(sentinel, "live dependency");
    for (const command of [["smoke", "run"], ["run"]]) {
      const result = cli(dir, [...command, "--detach", "--dir", job]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("already running this job");
      expect(existsSync(sentinel)).toBe(true);
      expect(readFileSync(sentinel, "utf8")).toBe("live dependency");
    }
  }, 120_000);

  it("accepts a relative job directory through the real CLI", () => {
    const dir = fresh();
    const job = path.join(dir, "job");
    const result = cli(dir, ["smoke", "slice", "--dir", path.relative(root, job)]);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(JSON.parse(readFileSync(path.join(job, "job-status.json"), "utf8")).status).toBe("complete");
  }, 120_000);

  it("the slice recording command validates budgets before walking", () => {
    const result = cli(fresh(), ["run", "25:support", "--jobs", "0"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--jobs must be a whole number");
  });

  it.each([false, true])("waits for an orphan worker before cleanup and reuses it (cancel recovery: %s)", async (cancelRecovery) => {
    const dir = fresh();
    const trace = path.join(dir, "starts");
    const release = path.join(dir, "release");
    const notification = path.join(dir, "notification");
    const controlled = path.join(dir, "controlled.mjs");
    writeFileSync(controlled, `
      export * from ${JSON.stringify(pathToFileURL(bundle).href)};
      import {runPlaythrough as run} from ${JSON.stringify(pathToFileURL(bundle).href)};
      import {appendFileSync,existsSync} from 'node:fs';
      export function runPlaythrough(recipe) {
        appendFileSync(${JSON.stringify(trace)}, process.pid+'\\n');
        const deadline=Date.now()+30000;
        while(!existsSync(${JSON.stringify(release)}) && Date.now()<deadline)
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);
        return run(recipe);
      }
    `);
    const plan = { scope: "orphan", bundle: controlled, commit: "0".repeat(40), units: m.laterEraTinyJobPlan([42]).units };
    await prepareJobDir(dir, plan);
    const script = path.join(dir, "supervisor.mjs");
    writeFileSync(script, `
      import {readPlan,runSupervisor} from ${JSON.stringify(pathToFileURL(path.join(root, "tools/dev/job-recorder.mjs")).href)};
      const dir=${JSON.stringify(dir)}, plan=await readPlan(dir), m=await import(plan.bundle);
      try {
        await runSupervisor(dir,plan,{identityOf:m.laterEraUnitIdentity,validateUnit:m.validateLaterEraUnit,groups:[]},
          {jobs:1,notify:${JSON.stringify(`echo "$FLOWSYNTH_JOB_STATUS" >> ${JSON.stringify(notification)}`)}});
      } catch(error) {
        if(error.cancelled) process.exitCode=143;
        else throw error;
      }
    `);
    const first = spawn(process.execPath, [script], { stdio: "ignore" });
    const firstExit = new Promise(resolve => first.once("close", resolve));
    let second: ReturnType<typeof spawn> | undefined;
    try {
      await until(() => existsSync(trace));
      first.kill("SIGKILL"); await firstExit;
      const temporary = path.join(dir, "units/.unit.json.tmp-orphan");
      writeFileSync(temporary, "in flight");
      second = spawn(process.execPath, [script], { stdio: "ignore" });
      let secondExit = new Promise(resolve => second!.once("close", resolve));
      await until(async () => (await readJobStatus(dir)).supervisor.pid === second!.pid);
      // Recovery must not touch a live writer's temporaries or start a
      // duplicate worker while the old process is synchronously computing.
      await pause(200);
      expect(readFileSync(trace, "utf8").trim().split("\n")).toHaveLength(1);
      expect(existsSync(temporary)).toBe(true);
      if (cancelRecovery) {
        second.kill("SIGTERM");
        expect(await secondExit).toBe(143);
        expect((await readJobStatus(dir)).status).toBe("cancelled");
        expect(readFileSync(notification, "utf8").trim()).toBe("cancelled");
        // Cancelling recovery does not signal a potentially recycled pid;
        // the original writer stays registered for another safe resume.
        second = spawn(process.execPath, [script], { stdio: "ignore" });
        secondExit = new Promise(resolve => second!.once("close", resolve));
        await until(async () => (await readJobStatus(dir)).supervisor.pid === second!.pid);
      }
      writeFileSync(release, "go");
      await secondExit;
      expect(readFileSync(trace, "utf8").trim().split("\n")).toHaveLength(1);
      const status = await readJobStatus(dir);
      expect(status.status).toBe("complete");
      expect(status.units[plan.units[0].id].attempts).toBe(1);
      expect(status.units[plan.units[0].id].elapsedMs).toBeGreaterThan(0);
      expect(status.units[plan.units[0].id].peakRssKb).toBeGreaterThan(0);
      expect(existsSync(temporary)).toBe(false);
      expect(readFileSync(notification, "utf8").trim().split("\n")).toEqual(cancelRecovery ? ["cancelled", "complete"] : ["complete"]);
    } finally {
      writeFileSync(release, "go");
      first.kill("SIGKILL"); second?.kill("SIGKILL");
    }
  }, 120_000);
});
