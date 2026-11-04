import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  checkRuntimeEnvironment,
  DECLARATION_FILE,
  declaredRuntimeVersion,
  recordingEnvironment,
  recordingPayload,
} from "./dev/runtime.mjs";
import { probeStorageCapability } from "./dev/runtime.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// The supported-runtime checks (issue #505): the declaration is read from one
// place (.node-version), the effective runtime is compared against it, the
// storage capability the UI harness needs is probed, and every refusal names
// the fix. The decision core is pure — tests inject declared/effective/storage
// values so the verdicts hold under any host; the real probe and the real
// declaration get their own cases at the bottom.

const okStorage = { ok: true, detail: "happy-dom localStorage roundtrip" };

const declared = (version: string, root = repoRoot) => ({
  root,
  declared: version,
  effective: { version: `v${version}`, timeZone: "America/Chicago", utcOffsetMinutes: -360 },
  storage: okStorage,
});

describe("declaredRuntimeVersion (issue #505)", () => {
  it("reads the one authoritative declaration, trimmed", () => {
    expect(DECLARATION_FILE).toBe(".node-version");
    const root = mkdtempSync(path.join(tmpdir(), "flowsynth-runtime-"));
    try {
      expect(declaredRuntimeVersion(root)).toBeNull();
      writeFileSync(path.join(root, DECLARATION_FILE), " 22.23.4 \n");
      expect(declaredRuntimeVersion(root)).toBe("22.23.4");
      writeFileSync(path.join(root, DECLARATION_FILE), "22.23.4\n# comment\n");
      expect(declaredRuntimeVersion(root)).toBe("22.23.4");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses a malformed declaration by name", () => {
    const root = mkdtempSync(path.join(tmpdir(), "flowsynth-runtime-"));
    try {
      writeFileSync(path.join(root, DECLARATION_FILE), "latest\n");
      const report = checkRuntimeEnvironment({ root, storage: okStorage });
      expect(report.ok).toBe(false);
      expect(report.reason).toBe("bad-declaration");
      expect(report.diagnostics.join("\n")).toContain(".node-version");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("checkRuntimeEnvironment (issue #505)", () => {
  it("accepts the declared runtime, v-prefix notwithstanding", () => {
    expect(checkRuntimeEnvironment(declared("22.23.4")).ok).toBe(true);
    expect(checkRuntimeEnvironment({ ...declared("22.23.4"), effective: { version: "v22.23.4", timeZone: "UTC", utcOffsetMinutes: 0 } }).ok).toBe(true);
  });

  it("refuses a version mismatch and names the fix", () => {
    const report = checkRuntimeEnvironment({
      ...declared("22.23.4"),
      effective: { version: "v26.7.0", timeZone: "America/Chicago", utcOffsetMinutes: -360 },
    });
    expect(report.ok).toBe(false);
    expect(report.reason).toBe("version-mismatch");
    const help = report.diagnostics.join("\n");
    expect(help).toContain("26.7.0");
    expect(help).toContain("22.23.4");
    expect(help).toContain(".node-version");
    // The fix is a version-manager selection, not a private PATH override.
    expect(help).toMatch(/mise|nvm|fnm/);
    expect(help).toContain("npm scripts select the declared runtime automatically");
  });

  it("refuses a missing declaration before trusting the environment", () => {
    const root = mkdtempSync(path.join(tmpdir(), "flowsynth-runtime-"));
    try {
      const report = checkRuntimeEnvironment({ root, storage: okStorage });
      expect(report.ok).toBe(false);
      expect(report.reason).toBe("missing-declaration");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses when the UI harness's storage capability is unavailable", () => {
    const report = checkRuntimeEnvironment({
      ...declared("22.23.4"),
      storage: { ok: false, detail: "happy-dom is not installed — run npm install first" },
    });
    expect(report.ok).toBe(false);
    expect(report.reason).toBe("storage-unavailable");
    expect(report.diagnostics.join("\n")).toContain("npm install");
    // A failing probe must not mask a runtime verdict, and a passing runtime
    // must not pass the gate on a broken probe.
    expect(report.declared).toBe("22.23.4");
    expect(report.effective).toBe("v22.23.4");
  });
});

describe("recordingEnvironment (issue #505)", () => {
  it("names the runtime and timezone actually used — never fabricated values", () => {
    const env = recordingEnvironment();
    expect(env.node).toBe(process.version);
    expect(env.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(env.utcOffsetMinutes).toBe(-new Date().getTimezoneOffset());
    expect(Object.keys(env).sort()).toEqual(["node", "timeZone", "utcOffsetMinutes"]);
  });

  it("recordingPayload attaches the environment to a writer's payload", () => {
    const payload = recordingPayload({ model: "probe", rows: [1, 2, 3] });
    expect(payload.model).toBe("probe");
    expect(payload.rows).toEqual([1, 2, 3]);
    expect(payload.recordingEnvironment).toEqual(recordingEnvironment());
    // The field rides every payload the writers compose — a writer cannot
    // forget it without bypassing the helper.
    expect(Object.keys(payload).sort()).toEqual(["model", "recordingEnvironment", "rows"]);
  });
});

describe("the real probe and declaration in this checkout", () => {
  it("the real declaration matches the effective runtime and the storage probe passes", async () => {
    const storage = await probeStorageCapability();
    expect(storage.ok).toBe(true);
    const report = checkRuntimeEnvironment({ storage });
    // The suite runs on the supported runtime — the guard (tools/dev/runtime-guard.mjs)
    // fails the run before this file loads otherwise.
    expect(report.ok).toBe(true);
    expect(report.declared).toMatch(/^\d+\.\d+\.\d+$/);
    expect(report.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });
});
