import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
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
  it("checks both recorder CLIs by default", () => {
    expect(RECORDER_SCRIPTS.map((script) => path.basename(script))).toEqual([
      "record-century.mjs",
      "record-later-eras.mjs",
    ]);
  });

  it("accepts the recorder scripts as committed", () => {
    const result = checkRecorderScripts();
    expect(result.ok).toBe(true);
    expect(result.diagnostics).toBe("");
  });

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
  });

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
  });
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
    const root = await resolveSmokeRoot("flowsynth-smoke-test-");
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
  });

  it("refuses invalid arguments with the usage diagnostic before any work", () => {
    for (const args of [["smoke"], ["smoke", "walk"], ["nonsense"], ["slice", "99:support"]]) {
      const result = spawnRecorder("record-century.mjs", args);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Usage: node tools/record-century.mjs");
    }
  });

  it("refuses an incomplete input by name and publishes no report", () => {
    const envRoot = freshSmokeRoot("century-missing");
    const compose = spawnRecorder("record-century.mjs", ["smoke", "compose"], { FLOWSYNTH_SMOKE_OUTPUT: envRoot });
    expect(compose.status).toBe(1);
    expect(compose.stderr).toContain("the century smoke slice is missing at");
    expect(compose.stderr).toContain("record it with: node tools/record-century.mjs smoke slice");
    expect(existsSync(path.join(envRoot, "century-smoke-report.json"))).toBe(false);
  });

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

  it("never touches committed calibration artifacts, and concurrent smokes never collide", () => {
    const before = docsArtifactDigests();
    // Two concurrent smoke slices, default temporary roots: each must get
    // its own isolation and neither may write the checkout.
    const [sliceA, sliceB] = [
      spawnRecorder("record-century.mjs", ["smoke", "slice"]),
      spawnRecorder("record-century.mjs", ["smoke", "slice"]),
    ];
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
    expect(slicePayload.rows).toHaveLength(1);
    const row = slicePayload.rows[0];
    expect(row.seed).toBe(LATER_ERA_SMOKE.seed);
    expect(row.complete).toBe(true);
    expect(row.stopKind).toBe("century");
    expect(row.creditedHours).toBeGreaterThanOrEqual(LATER_ERA_SMOKE.stopCreditedHours);
    expect(row.creditedHours).toBeLessThan(LATER_ERA_MIN_HOURS);
    expect(slice.stdout).toContain("smoke slice:");

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
  });

  it("refuses invalid arguments with the usage diagnostic before any work", () => {
    for (const args of [["smoke"], ["smoke", "walk"], ["nonsense"], ["slice", "99:support"], ["slice", "25:pushing"]]) {
      const result = spawnRecorder("record-later-eras.mjs", args);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Usage: node tools/record-later-eras.mjs");
    }
  });

  it("refuses an incomplete input by name and publishes no report", () => {
    const envRoot = freshSmokeRoot("later-missing");
    const compose = spawnRecorder("record-later-eras.mjs", ["smoke", "compose"], { FLOWSYNTH_SMOKE_OUTPUT: envRoot });
    expect(compose.status).toBe(1);
    expect(compose.stderr).toContain("the later-era smoke slice is missing at");
    expect(compose.stderr).toContain("record it with: node tools/record-later-eras.mjs smoke slice");
    expect(existsSync(path.join(envRoot, "later-era-smoke-report.json"))).toBe(false);
  });

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
