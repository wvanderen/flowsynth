import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { checkRecorderScripts, RECORDER_SCRIPTS } from "./dev/recorder-static-check.mjs";
import {
  assertNotSmokeTier,
  assertSameCompiledSource,
  assertSmokeTier,
  composeRecordingPayload,
  readRecordingFile,
  refuseExistingArtifact,
  resolveSmokeRoot,
  writeSmokeArtifact,
} from "./dev/runtime.mjs";
import { CENTURY_MARK_HOURS, CENTURY_SEEDS, CENTURY_SMOKE, centurySmokeRecipe, runPlaythrough } from "./century";
import { LATER_ERA_MIN_HOURS, LATER_ERA_SEEDS, LATER_ERA_SMOKE, laterEraSmokeRecipe } from "./later-eras";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Issue #506: catch mechanical recorder defects and broken CLI entry
// points in ordinary verification, before any expensive walk launches.
// The recorder CLIs are plain .mjs — outside the root tsc program — so
// the static gate checks them here, and the smoke tier drives their real
// command surface end to end on bounded walks.
describe("recorder static gate", () => {
  it("checks the recorder CLIs and the job boundary scripts by default", () => {
    expect(RECORDER_SCRIPTS.map((script) => path.basename(script))).toEqual([
      "record-century.mjs",
      "record-later-eras.mjs",
      // Issue #507: the resumable job boundary and its worker — plain .mjs
      // outside tsc's program, covered by the same gate.
      "job-recorder.mjs",
      "job-worker.mjs",
    ]);
  });

  it("accepts the recorder scripts as committed", () => {
    const result = checkRecorderScripts();
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toBe("");
  }, 60_000);

  it("rejects a deliberate undefined reference statically, without launching a walk", () => {
    // The tampered content never executes: the checker is a static program
    // over the recorder's text, so the regression is refused before any
    // git call, compile, or walk the script would have launched.
    const script = path.join(root, "tools", "record-century.mjs");
    const original = readFileSync(script, "utf8");
    const tampered = `${original}\nnoSuchSmokeSeam();\n`;
    expect(tampered).not.toBe(original);
    const result = checkRecorderScripts({
      overrides: [{ path: script, text: tampered }],
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContain("Cannot find name 'noSuchSmokeSeam'");
    expect(result.diagnostics).toContain("record-century.mjs");
  }, 60_000);

  it("checks undefined references in the shared smoke lifecycle too", () => {
    const script = path.join(root, "tools", "dev", "smoke-recorder.mjs");
    const result = checkRecorderScripts({
      overrides: [{ path: script, text: `${readFileSync(script, "utf8")}\nnoSuchSharedSmokeSeam();\n` }],
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContain("Cannot find name 'noSuchSharedSmokeSeam'");
    expect(result.diagnostics).toContain("smoke-recorder.mjs");
  }, 60_000);

  it("rejects an unresolvable named import from the shared runtime module", () => {
    const script = path.join(root, "tools", "record-later-eras.mjs");
    const original = readFileSync(script, "utf8");
    const tampered = `import { noSuchRuntimeExport } from "./dev/runtime.mjs";\n${original}`;
    expect(tampered).not.toBe(original);
    const result = checkRecorderScripts({
      overrides: [{ path: script, text: tampered }],
    });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toContain("noSuchRuntimeExport");
  }, 60_000);
});

// The smoke tier's bounded recipe or execution seam: declared in the
// compiled recording modules themselves, explicitly named, and far under
// every calibration mark — a smoke walk finishes in seconds and can never
// be mistaken for full calibration evidence (issue #506).
describe("the smoke recipes", () => {
  it("the century smoke recipe declares a bound far under the calibration mark, and its walk completes at it", () => {
    const recipe = centurySmokeRecipe();
    expect(recipe.seed).toBe(CENTURY_SEEDS[0]);
    expect(recipe.stopCreditedHours).toBe(1);
    expect(recipe.budgetDays).toBe(3);
    expect(recipe.stopCreditedHours).toBeLessThan(CENTURY_MARK_HOURS);
    expect(recipe.schedule.sessionMinutes).toBe(CENTURY_SMOKE.sessionMinutes);
    expect(recipe.policyId).toBe(CENTURY_SMOKE.policyId);
    const record = runPlaythrough(recipe);
    expect(record.complete).toBe(true);
    expect(record.stop.kind).toBe("century");
    const creditedHours = record.creditedSeconds / 3600;
    expect(creditedHours).toBeGreaterThanOrEqual(CENTURY_SMOKE.stopCreditedHours);
    expect(creditedHours).toBeLessThan(CENTURY_MARK_HOURS);
  });

  it("the later-era smoke recipe declares a bound under the later-era window, and its walk completes at it", () => {
    const recipe = laterEraSmokeRecipe();
    expect(recipe.seed).toBe(LATER_ERA_SEEDS[0]);
    expect(recipe.stopCreditedHours).toBe(1);
    expect(recipe.budgetDays).toBe(3);
    expect(recipe.stopCreditedHours).toBeLessThan(LATER_ERA_MIN_HOURS);
    const record = runPlaythrough(recipe);
    expect(record.complete).toBe(true);
    expect(record.stop.kind).toBe("century");
    const creditedHours = record.creditedSeconds / 3600;
    expect(creditedHours).toBeGreaterThanOrEqual(LATER_ERA_SMOKE.stopCreditedHours);
    expect(creditedHours).toBeLessThan(LATER_ERA_MIN_HOURS);
  });
});

// Smoke output is always isolated: a fresh temporary root per invocation
// by default, or a validated FLOWSYNTH_SMOKE_OUTPUT that can never sit
// inside the checkout or overwrite anything (issue #506).
describe("smoke output isolation", () => {
  it("defaults to a fresh temporary directory per invocation", async () => {
    const root = await resolveSmokeRoot("flowsynth-smoke-test-", { env: {} });
    try {
      expect(path.dirname(root)).toBe(tmpdir());
      expect(path.basename(root)).toMatch(/^flowsynth-smoke-test-/);
      expect(readdirSync(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("FLOWSYNTH_SMOKE_OUTPUT names the root, created when absent", async () => {
    const parent = mkdtempSync(path.join(tmpdir(), "flowsynth-smoke-parent-"));
    try {
      const requested = path.join(parent, "smoke");
      const root = await resolveSmokeRoot("flowsynth-smoke-test-", { env: { FLOWSYNTH_SMOKE_OUTPUT: requested } });
      expect(root).toBe(requested);
      expect(existsSync(root)).toBe(true);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("refuses a smoke root inside the checkout", async () => {
    await expect(
      resolveSmokeRoot("flowsynth-smoke-test-", { env: { FLOWSYNTH_SMOKE_OUTPUT: path.join(root, "docs") } }),
    ).rejects.toThrow(/inside the checkout/);
    await expect(
      resolveSmokeRoot("flowsynth-smoke-test-", { env: { FLOWSYNTH_SMOKE_OUTPUT: path.join(root, "docs", "smoke") } }),
    ).rejects.toThrow(/inside the checkout/);
    await expect(
      resolveSmokeRoot("flowsynth-smoke-test-", { env: { FLOWSYNTH_SMOKE_OUTPUT: root } }),
    ).rejects.toThrow(/inside the checkout/);
  });

  it("refuses checkout aliases and missing descendants through symlinked ancestors", async () => {
    const parent = mkdtempSync(path.join(tmpdir(), "flowsynth-smoke-alias-"));
    try {
      const checkout = path.join(parent, "checkout");
      mkdirSync(path.join(checkout, "docs"), { recursive: true });
      const alias = path.join(parent, "outside-link");
      symlinkSync(path.join(checkout, "docs"), alias);
      for (const requested of [alias, path.join(alias, "missing", "nested")]) {
        await expect(resolveSmokeRoot("unused-", {
          repoRoot: checkout, env: { FLOWSYNTH_SMOKE_OUTPUT: requested },
        })).rejects.toThrow(/inside the checkout/);
      }
      expect(existsSync(path.join(checkout, "docs", "missing"))).toBe(false);
      const checkoutAlias = path.join(parent, "checkout-alias");
      symlinkSync(checkout, checkoutAlias);
      await expect(resolveSmokeRoot("unused-", {
        repoRoot: checkoutAlias, env: { FLOWSYNTH_SMOKE_OUTPUT: path.join(checkout, "docs") },
      })).rejects.toThrow(/inside the checkout/);
      const outside = path.join(parent, "outside");
      mkdirSync(outside);
      const outsideAlias = path.join(parent, "outside-alias");
      symlinkSync(outside, outsideAlias);
      await expect(resolveSmokeRoot("unused-", {
        repoRoot: checkout, env: { FLOWSYNTH_SMOKE_OUTPUT: path.join(outsideAlias, "new") },
      })).resolves.toBe(path.join(outside, "new"));
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("refuses a smoke root that is not a directory", async () => {
    const parent = mkdtempSync(path.join(tmpdir(), "flowsynth-smoke-parent-"));
    try {
      const occupied = path.join(parent, "occupied");
      writeFileSync(occupied, "not a directory");
      await expect(
        resolveSmokeRoot("flowsynth-smoke-test-", { env: { FLOWSYNTH_SMOKE_OUTPUT: occupied } }),
      ).rejects.toThrow(/not a directory/);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("exclusive publication has one winner and refuses occupied or dangling symlinks", async () => {
    const parent = mkdtempSync(path.join(tmpdir(), "flowsynth-smoke-exclusive-"));
    try {
      const artifact = path.join(parent, "slice.json");
      const results = await Promise.allSettled([
        writeSmokeArtifact(artifact, { writer: "a" }, "the smoke slice"),
        writeSmokeArtifact(artifact, { writer: "b" }, "the smoke slice"),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const refused = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
      expect(refused.reason.message).toContain("the smoke slice already exists");
      expect(["a", "b"]).toContain(JSON.parse(readFileSync(artifact, "utf8")).writer);
      const first = readFileSync(artifact, "utf8");
      const missing = path.join(parent, "missing.json");
      for (const target of [artifact, missing]) {
        const alias = `${target}.link`;
        symlinkSync(target, alias);
        await expect(refuseExistingArtifact(alias, "the smoke slice")).rejects.toThrow(/already exists/);
        await expect(writeSmokeArtifact(alias, {}, "the smoke slice")).rejects.toThrow(/already exists/);
      }
      expect(readFileSync(artifact, "utf8")).toBe(first);
      expect(existsSync(missing)).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("smoke refuses to overwrite an existing artifact and stays silent when the path is free", async () => {
    const parent = mkdtempSync(path.join(tmpdir(), "flowsynth-smoke-parent-"));
    try {
      const existing = path.join(parent, "slice.json");
      writeFileSync(existing, "{}");
      await expect(refuseExistingArtifact(existing, "the smoke slice")).rejects.toThrow(/already exists/);
      const free = path.join(parent, "free.json");
      await expect(refuseExistingArtifact(free, "the smoke slice")).resolves.toBeUndefined();
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

// The compose input refusals: incomplete or stale evidence fails with a
// named diagnostic before anything is published (issue #506).
describe("compose input refusals", () => {
  it("a missing recording input is refused with a named diagnostic and remedy", async () => {
    const parent = mkdtempSync(path.join(tmpdir(), "flowsynth-smoke-parent-"));
    try {
      const missing = path.join(parent, "slice.json");
      await expect(
        readRecordingFile(missing, {
          what: "the century smoke slice",
          remedy: "record it with: node tools/record-century.mjs smoke slice",
        }),
      ).rejects.toThrow(/the century smoke slice is missing at .*smoke slice/);
      await expect(
        readRecordingFile(missing, { what: "the century smoke slice", remedy: "record it with: node tools/record-century.mjs smoke slice" }),
      ).rejects.toThrow(/record it with: node tools\/record-century\.mjs smoke slice/);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("an input that is not valid JSON is refused with the path named", async () => {
    const parent = mkdtempSync(path.join(tmpdir(), "flowsynth-smoke-parent-"));
    try {
      const corrupted = path.join(parent, "slice.json");
      writeFileSync(corrupted, "{nope");
      await expect(readRecordingFile(corrupted, { what: "the century smoke slice" })).rejects.toThrow(/not valid JSON/);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

// The tier and provenance guards keep smoke evidence and calibration
// evidence out of each other's compose paths (issue #506).
describe("tier and provenance guards", () => {
  it("the smoke compose accepts only smoke-tier recordings, and the calibration compose refuses them", () => {
    const smoke = { tier: "smoke", source: { fingerprint: "a" } };
    expect(() => assertSmokeTier(smoke, "slice.json")).not.toThrow();
    expect(() => assertSmokeTier({ source: {} }, "slice.json")).toThrow(/not a smoke recording/);
    expect(() => assertNotSmokeTier({ source: {} }, "slice.json")).not.toThrow();
    expect(() => assertNotSmokeTier(smoke, "slice.json")).toThrow(/cannot join the calibration matrix/);
  });

  it("stale compiled-source evidence is refused with a named diagnostic", () => {
    const source = { fingerprint: "aaa" };
    expect(() => assertSameCompiledSource(source, source, "slice.json")).not.toThrow();
    expect(() => assertSameCompiledSource({ fingerprint: "bbb" }, source, "slice.json")).toThrow(
      /different compiled engine source/,
    );
  });

  it("composition carries each input's tier in its provenance", () => {
    const composed = composeRecordingPayload({}, [{ path: "smoke.json", recording: { tier: "smoke", source: {} } }]);
    expect(composed.recordingInputs[0].tier).toBe("smoke");
  });
});

// The smoke tier drives the recorders' real command surface — the same
// argument validation, persistence, and validation behavior production
// recordings use — on bounded walks that finish in seconds. Every failure
// refusal below must name its diagnostic and publish no report (issue #506).
const tempRoots: string[] = [];
const trackRoot = (dir: string) => {
  tempRoots.push(dir);
  return dir;
};
afterEach(() => {
  while (tempRoots.length > 0) rmSync(tempRoots.pop()!, { recursive: true, force: true });
});

const spawnRecorder = (script: string, args: string[], env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [path.join(root, "tools", script), ...args], {
    encoding: "utf8",
    cwd: root,
    env: { ...process.env, ...env },
    timeout: 120_000,
  });

// Start without blocking so Promise.all below really overlaps processes.
const spawnRecorderAsync = (script: string, args: string[], env: Record<string, string> = {}) =>
  new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, "tools", script), ...args], {
      cwd: root, env: { ...process.env, ...env }, timeout: 120_000,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });

const freshSmokeRoot = (label: string) =>
  trackRoot(mkdtempSync(path.join(tmpdir(), `flowsynth-smoke-cli-${label}-`)));

const docsArtifactDigests = () => {
  const docs = path.join(root, "docs");
  return readdirSync(docs)
    .filter((name) => name.startsWith("century-") || name.startsWith("later-era-"))
    .map((name) => `${name}:${createHash("sha256").update(readFileSync(path.join(docs, name))).digest("hex")}`)
    .sort();
};

const runSmokeSlice = (script: string, envRoot: string) =>
  spawnRecorder(script, ["smoke", "slice"], { FLOWSYNTH_SMOKE_OUTPUT: envRoot });

describe("the century smoke CLI", () => {
  it("runs the real entry points end to end: bounded walk, slice payload, composition", () => {
    const envRoot = freshSmokeRoot("century-happy");
    const slice = runSmokeSlice("record-century.mjs", envRoot);
    expect(slice.status).toBe(0);
    expect(slice.stderr).toBe("");
    const slicePayload = JSON.parse(readFileSync(path.join(envRoot, "century-smoke-slice.json"), "utf8"));
    // The slice is smoke evidence with full recording provenance: the
    // compiled fingerprint, the recording commit, the runtime it ran on.
    expect(slicePayload.tier).toBe("smoke");
    expect(slicePayload.source.game).toBe("flowsynth");
    expect(slicePayload.source.engineSource).toMatch(/^[0-9a-f]+$/);
    expect(slicePayload.recordingCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(slicePayload.recordingEnvironment.node).toBe(process.version);
    expect(slicePayload.minutes).toBe(CENTURY_SMOKE.sessionMinutes);
    expect(slicePayload.policy).toBe(CENTURY_SMOKE.policyId);
    expect(slicePayload.recipe).toEqual(JSON.parse(JSON.stringify(centurySmokeRecipe())));
    expect(slicePayload.rows).toHaveLength(1);
    const row = slicePayload.rows[0];
    expect(row.seed).toBe(CENTURY_SMOKE.seed);
    expect(row.complete).toBe(true);
    expect(row.stopKind).toBe("century");
    expect(row.creditedHours).toBeGreaterThanOrEqual(CENTURY_SMOKE.stopCreditedHours);
    expect(row.creditedHours).toBeLessThan(CENTURY_MARK_HOURS);
    expect(slice.stdout).toContain("smoke slice:");

    const compose = spawnRecorder("record-century.mjs", ["smoke", "compose"], { FLOWSYNTH_SMOKE_OUTPUT: envRoot });
    expect(compose.status).toBe(0);
    expect(compose.stderr).toBe("");
    const report = JSON.parse(readFileSync(path.join(envRoot, "century-smoke-report.json"), "utf8"));
    expect(report.tier).toBe("smoke");
    expect(report.smoke).toEqual(CENTURY_SMOKE);
    expect(report.runs).toHaveLength(1);
    expect(report.compositionEnvironment.node).toBe(process.version);
    // The composition's provenance carries the input's tier and source,
    // and nothing about the report's shape reads as calibration evidence.
    expect(report.recordingInputs).toHaveLength(1);
    expect(report.recordingInputs[0].path).toBe(path.join(envRoot, "century-smoke-slice.json"));
    expect(report.recordingInputs[0].tier).toBe("smoke");
    expect(report.recordingInputs[0].source).toEqual(slicePayload.source);
    expect(report.recordingInputs[0].recordingCommit).toBe(slicePayload.recordingCommit);
    expect(report.distributions).toBeUndefined();
    expect(report.investments).toBeUndefined();
    expect(compose.stdout).toContain("smoke report:");
  }, 120_000);

  it("refuses invalid arguments with the usage diagnostic before any work", () => {
    for (const args of [["smoke"], ["smoke", "walk"], ["nonsense"], ["slice", "99:support"]]) {
      const result = spawnRecorder("record-century.mjs", args);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Usage: node tools/record-century.mjs");
    }
  }, 60_000);

  it("refuses an incomplete input by name and publishes no report", () => {
    const envRoot = freshSmokeRoot("century-missing");
    const compose = spawnRecorder("record-century.mjs", ["smoke", "compose"], { FLOWSYNTH_SMOKE_OUTPUT: envRoot });
    expect(compose.status).toBe(1);
    expect(compose.stderr).toContain("the century smoke slice is missing at");
    expect(compose.stderr).toContain("record it with: node tools/record-century.mjs smoke slice");
    expect(existsSync(path.join(envRoot, "century-smoke-report.json"))).toBe(false);
  }, 120_000);

  it("refuses to overwrite an existing smoke report and leaves the first composition in place", () => {
    const envRoot = freshSmokeRoot("century-report-overwrite");
    expect(runSmokeSlice("record-century.mjs", envRoot).status).toBe(0);
    const composeArgs = ["smoke", "compose"];
    expect(spawnRecorder("record-century.mjs", composeArgs, { FLOWSYNTH_SMOKE_OUTPUT: envRoot }).status).toBe(0);
    const reportPath = path.join(envRoot, "century-smoke-report.json");
    const first = readFileSync(reportPath, "utf8");
    const rerun = spawnRecorder("record-century.mjs", composeArgs, { FLOWSYNTH_SMOKE_OUTPUT: envRoot });
    expect(rerun.status).toBe(1);
    expect(rerun.stderr).toContain("the century smoke report already exists");
    expect(readFileSync(reportPath, "utf8")).toBe(first);
  }, 240_000);

  describe("stale and foreign evidence is refused before publishing", () => {
    // One real smoke slice serves every tamper case: the cases copy it
    // into their own root, tamper one field, and compose.
    let pristineRoot: string;
    let pristineSlice: string;
    const composeTampered = (mutate: (payload: Record<string, unknown>) => Record<string, unknown>) => {
      const envRoot = freshSmokeRoot("century-tamper");
      const payload = JSON.parse(pristineSlice) as Record<string, unknown>;
      writeFileSync(path.join(envRoot, "century-smoke-slice.json"), JSON.stringify(mutate(payload)));
      const compose = spawnRecorder("record-century.mjs", ["smoke", "compose"], { FLOWSYNTH_SMOKE_OUTPUT: envRoot });
      return { compose, envRoot };
    };

    it("records the shared slice", async () => {
      pristineRoot = freshSmokeRoot("century-pristine");
      const slice = runSmokeSlice("record-century.mjs", pristineRoot);
      expect(slice.status).toBe(0);
      pristineSlice = readFileSync(path.join(pristineRoot, "century-smoke-slice.json"), "utf8");
    }, 120_000);

    it("refuses stale source evidence with a named diagnostic and no report", () => {
      const { compose, envRoot } = composeTampered((payload) => ({
        ...payload,
        source: { ...(payload.source as Record<string, unknown>), engineSource: "stale0000" },
      }));
      expect(compose.status).toBe(1);
      expect(compose.stderr).toContain("different compiled engine source");
      expect(existsSync(path.join(envRoot, "century-smoke-report.json"))).toBe(false);
    }, 120_000);

    it("refuses stale recipe evidence with a named diagnostic and no report", () => {
      const { compose, envRoot } = composeTampered((payload) => ({ ...payload, minutes: 60 }));
      expect(compose.status).toBe(1);
      expect(compose.stderr).toContain("stale recipe evidence");
      expect(existsSync(path.join(envRoot, "century-smoke-report.json"))).toBe(false);
    }, 120_000);

    it("refuses evidence that is not smoke-tier and publishes no report", () => {
      const mislabeled = composeTampered((payload) => ({ ...payload, tier: "calibration" }));
      expect(mislabeled.compose.status).toBe(1);
      expect(mislabeled.compose.stderr).toContain("not a smoke recording");
      expect(existsSync(path.join(mislabeled.envRoot, "century-smoke-report.json"))).toBe(false);
      const unmarked = composeTampered((payload) => {
        const { tier: _tier, ...rest } = payload;
        return rest;
      });
      expect(unmarked.compose.status).toBe(1);
      expect(unmarked.compose.stderr).toContain("not a smoke recording");
      expect(existsSync(path.join(unmarked.envRoot, "century-smoke-report.json"))).toBe(false);
    }, 120_000);
  });

  it("never touches committed calibration artifacts, and concurrent smokes never collide", async () => {
    const before = docsArtifactDigests();
    // Two concurrent smoke slices, default temporary roots: each must get
    // its own isolation and neither may write the checkout.
    const [sliceA, sliceB] = await Promise.all([
      spawnRecorderAsync("record-century.mjs", ["smoke", "slice"], { FLOWSYNTH_SMOKE_OUTPUT: "" }),
      spawnRecorderAsync("record-century.mjs", ["smoke", "slice"], { FLOWSYNTH_SMOKE_OUTPUT: "" }),
    ]);
    expect(sliceA.status).toBe(0);
    expect(sliceB.status).toBe(0);
    const rootA = path.dirname(sliceA.stdout.trim().split("\n").at(-1)!.split(" — ").at(-1)!);
    const rootB = path.dirname(sliceB.stdout.trim().split("\n").at(-1)!.split(" — ").at(-1)!);
    expect(rootA).not.toBe(rootB);
    expect(rootA).toContain("flowsynth-century-smoke-");
    expect(rootB).toContain("flowsynth-century-smoke-");
    trackRoot(rootA);
    trackRoot(rootB);
    // A compose reuses a recorded slice's root alongside the concurrent
    // sibling, and the checkout's committed artifacts never move.
    const composeA = spawnRecorder("record-century.mjs", ["smoke", "compose"], { FLOWSYNTH_SMOKE_OUTPUT: rootA });
    expect(composeA.status).toBe(0);
    expect(existsSync(path.join(rootA, "century-smoke-report.json"))).toBe(true);
    expect(docsArtifactDigests()).toEqual(before);
  }, 240_000);
});

interface RecipeTamperPayload {
  rows: Array<{ seed: number; sessionMinutes: number; policy: string }>;
  recipe?: Record<string, unknown>;
}

describe.each([
  { script: "record-century.mjs", name: "century" },
  { script: "record-later-eras.mjs", name: "later-era" },
])("$name smoke safety regressions", ({ script, name }) => {
  it("concurrent slices and reports sharing an explicit root have exactly one publisher", async () => {
    const envRoot = freshSmokeRoot(`${name}-race`);
    const env = { FLOWSYNTH_SMOKE_OUTPUT: envRoot };
    for (const leg of ["slice", "compose"]) {
      const results = await Promise.all([
        spawnRecorderAsync(script, ["smoke", leg], env),
        spawnRecorderAsync(script, ["smoke", leg], env),
      ]);
      expect(results.map((result) => result.status).sort()).toEqual([0, 1]);
      const refusal = results.find((result) => result.status === 1)?.stderr;
      // The later-era slice leg is job-supervised (issue #507): the second
      // supervisor is refused at the job's single-flight lock, before any
      // compile. Publication stays exclusive for everything else.
      if (script === "record-later-eras.mjs" && leg === "slice") {
        expect(refusal).toContain("already running this job");
      } else {
        expect(refusal).toContain("already exists");
      }
      const artifact = path.join(envRoot, `${name}-smoke-${leg === "slice" ? "slice" : "report"}.json`);
      const first = readFileSync(artifact, "utf8");
      expect(JSON.parse(first).tier).toBe("smoke");
      const rerun = spawnRecorder(script, ["smoke", leg], env);
      expect(rerun.status).toBe(1);
      expect(rerun.stderr).toContain("already exists");
      expect(readFileSync(artifact, "utf8")).toBe(first);
    }
  }, 240_000);

  it("rejects contradictory row identity and missing or changed full recipes without publishing", () => {
    const pristineRoot = freshSmokeRoot(`${name}-recipe`);
    expect(runSmokeSlice(script, pristineRoot).status).toBe(0);
    const pristine = readFileSync(path.join(pristineRoot, `${name}-smoke-slice.json`), "utf8");
    const mutations: Array<(payload: RecipeTamperPayload) => void> = [
      (payload) => { payload.rows[0]!.seed = 99; },
      (payload) => { payload.rows[0]!.sessionMinutes = 60; },
      (payload) => { payload.rows[0]!.policy = "combat"; },
      (payload) => { delete payload.recipe; },
      (payload) => { payload.recipe = { ...payload.recipe, stopCreditedHours: 2 }; },
      (payload) => { payload.recipe = { ...payload.recipe, budgetDays: 4 }; },
      (payload) => { payload.recipe = { ...payload.recipe, seed: 99 }; },
      (payload) => { payload.recipe = { ...payload.recipe, schedule: {
        ...(payload.recipe?.schedule as Record<string, unknown>), sessionMinutes: 60,
      } }; },
    ];
    for (const mutate of mutations) {
      const envRoot = freshSmokeRoot(`${name}-recipe-tamper`);
      const payload = JSON.parse(pristine);
      mutate(payload);
      writeFileSync(path.join(envRoot, `${name}-smoke-slice.json`), JSON.stringify(payload));
      const result = spawnRecorder(script, ["smoke", "compose"], { FLOWSYNTH_SMOKE_OUTPUT: envRoot });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("stale recipe evidence");
      expect(existsSync(path.join(envRoot, `${name}-smoke-report.json`))).toBe(false);
    }
  }, 240_000);
});

describe("the later-eras smoke CLI", () => {
  it("runs the real entry points end to end: bounded walk, slice payload, composition", () => {
    const envRoot = freshSmokeRoot("later-happy");
    const slice = runSmokeSlice("record-later-eras.mjs", envRoot);
    expect(slice.status).toBe(0);
    expect(slice.stderr).toBe("");
    const slicePayload = JSON.parse(readFileSync(path.join(envRoot, "later-era-smoke-slice.json"), "utf8"));
    expect(slicePayload.tier).toBe("smoke");
    expect(slicePayload.source.game).toBe("flowsynth");
    expect(slicePayload.source.engineSource).toMatch(/^[0-9a-f]+$/);
    expect(slicePayload.recordingCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(slicePayload.recordingEnvironment.node).toBe(process.version);
    expect(slicePayload.minutes).toBe(LATER_ERA_SMOKE.sessionMinutes);
    expect(slicePayload.policy).toBe(LATER_ERA_SMOKE.policyId);
    expect(slicePayload.recipe).toEqual(JSON.parse(JSON.stringify(laterEraSmokeRecipe())));
    expect(slicePayload.rows).toHaveLength(1);
    const row = slicePayload.rows[0];
    expect(row.seed).toBe(LATER_ERA_SMOKE.seed);
    expect(row.complete).toBe(true);
    expect(row.stopKind).toBe("century");
    expect(row.creditedHours).toBeGreaterThanOrEqual(LATER_ERA_SMOKE.stopCreditedHours);
    expect(row.creditedHours).toBeLessThan(LATER_ERA_MIN_HOURS);
    // The smoke slice rides the production job pipeline (issue #507): the
    // bounded walk runs on a worker process under the job supervisor, and
    // the summary names the completed job and its published artifact.
    expect(slice.stdout).toContain("job-slice — complete");
    expect(slice.stdout).toContain("1/1 done");
    expect(slice.stdout).toContain("published smoke-slice →");

    const compose = spawnRecorder("record-later-eras.mjs", ["smoke", "compose"], { FLOWSYNTH_SMOKE_OUTPUT: envRoot });
    expect(compose.status).toBe(0);
    expect(compose.stderr).toBe("");
    const report = JSON.parse(readFileSync(path.join(envRoot, "later-era-smoke-report.json"), "utf8"));
    expect(report.tier).toBe("smoke");
    expect(report.smoke).toEqual(LATER_ERA_SMOKE);
    expect(report.runs).toHaveLength(1);
    expect(report.compositionEnvironment.node).toBe(process.version);
    expect(report.recordingInputs).toHaveLength(1);
    expect(report.recordingInputs[0].path).toBe(path.join(envRoot, "later-era-smoke-slice.json"));
    expect(report.recordingInputs[0].tier).toBe("smoke");
    expect(report.recordingInputs[0].source).toEqual(slicePayload.source);
    // Nothing about the report's shape reads as later-era evaluation
    // evidence: no distributions, no route probes.
    expect(report.distributions).toBeUndefined();
    expect(report.routeProbes).toBeUndefined();
    expect(compose.stdout).toContain("smoke report:");
  }, 120_000);

  it("refuses invalid arguments with the usage diagnostic before any work", () => {
    for (const args of [["smoke"], ["smoke", "walk"], ["nonsense"], ["slice", "99:support"], ["slice", "25:pushing"]]) {
      const result = spawnRecorder("record-later-eras.mjs", args);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Usage: node tools/record-later-eras.mjs");
    }
  }, 60_000);

  it("refuses an incomplete input by name and publishes no report", () => {
    const envRoot = freshSmokeRoot("later-missing");
    const compose = spawnRecorder("record-later-eras.mjs", ["smoke", "compose"], { FLOWSYNTH_SMOKE_OUTPUT: envRoot });
    expect(compose.status).toBe(1);
    expect(compose.stderr).toContain("the later-era smoke slice is missing at");
    expect(compose.stderr).toContain("record it with: node tools/record-later-eras.mjs smoke slice");
    expect(existsSync(path.join(envRoot, "later-era-smoke-report.json"))).toBe(false);
  }, 120_000);

  describe("stale and foreign evidence is refused before publishing", () => {
    let pristineRoot: string;
    let pristineSlice: string;
    const composeTampered = (mutate: (payload: Record<string, unknown>) => Record<string, unknown>) => {
      const envRoot = freshSmokeRoot("later-tamper");
      const payload = JSON.parse(pristineSlice) as Record<string, unknown>;
      writeFileSync(path.join(envRoot, "later-era-smoke-slice.json"), JSON.stringify(mutate(payload)));
      const compose = spawnRecorder("record-later-eras.mjs", ["smoke", "compose"], { FLOWSYNTH_SMOKE_OUTPUT: envRoot });
      return { compose, envRoot };
    };

    it("records the shared slice", async () => {
      pristineRoot = freshSmokeRoot("later-pristine");
      const slice = runSmokeSlice("record-later-eras.mjs", pristineRoot);
      expect(slice.status).toBe(0);
      pristineSlice = readFileSync(path.join(pristineRoot, "later-era-smoke-slice.json"), "utf8");
    }, 120_000);

    it("refuses stale source evidence with a named diagnostic and no report", () => {
      const { compose, envRoot } = composeTampered((payload) => ({
        ...payload,
        source: { ...(payload.source as Record<string, unknown>), engineSource: "stale0000" },
      }));
      expect(compose.status).toBe(1);
      expect(compose.stderr).toContain("different compiled engine source");
      expect(existsSync(path.join(envRoot, "later-era-smoke-report.json"))).toBe(false);
    }, 120_000);

    it("refuses stale recipe evidence with a named diagnostic and no report", () => {
      const { compose, envRoot } = composeTampered((payload) => ({ ...payload, minutes: 60 }));
      expect(compose.status).toBe(1);
      expect(compose.stderr).toContain("stale recipe evidence");
      expect(existsSync(path.join(envRoot, "later-era-smoke-report.json"))).toBe(false);
    }, 120_000);

    it("refuses evidence that is not smoke-tier and publishes no report", () => {
      const mislabeled = composeTampered((payload) => ({ ...payload, tier: "calibration" }));
      expect(mislabeled.compose.status).toBe(1);
      expect(mislabeled.compose.stderr).toContain("not a smoke recording");
      expect(existsSync(path.join(mislabeled.envRoot, "later-era-smoke-report.json"))).toBe(false);
      const unmarked = composeTampered((payload) => {
        const { tier: _tier, ...rest } = payload;
        return rest;
      });
      expect(unmarked.compose.status).toBe(1);
      expect(unmarked.compose.stderr).toContain("not a smoke recording");
      expect(existsSync(path.join(unmarked.envRoot, "later-era-smoke-report.json"))).toBe(false);
    }, 120_000);
  });
});
