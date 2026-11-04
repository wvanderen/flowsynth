// Issue #505: the supported-runtime check core. The repository declares its
// CI-compatible Node runtime once, in `.node-version`; local setup (version
// managers read idiomatic files), CI (`actions/setup-node` with
// `node-version-file`), and every check here consume that one declaration.
// The check answers three questions before any expensive work: does the
// effective runtime match the declaration, what calendar does the host read
// (gameplay's goal and schedule days follow the host's local calendar, so the
// zone is reported, never silently assumed), and can the UI harness actually
// use the storage it requires (happy-dom's localStorage). Plain JavaScript so
// the preflight and the npm-script wrapper run under plain node; this module's
// TypeScript surface lives in runtime.d.mts.
import { readFileSync } from "node:fs";
import path from "node:path";

export const DECLARATION_FILE = ".node-version";

// The trimmed first line of the declaration, or null when the checkout
// carries none. A first comment line is allowed. The line is returned as
// written — shape validation (one concrete semver, never "latest" or a
// range) is the check core's job, which names malformed content in its
// refusal.
export function declaredRuntimeVersion(root = process.cwd()) {
  let text;
  try {
    text = readFileSync(path.join(root, DECLARATION_FILE), "utf8");
  } catch {
    return null;
  }
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
  return lines[0] ?? null;
}

export function effectiveRuntime() {
  return {
    version: process.version,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
    utcOffsetMinutes: -new Date().getTimezoneOffset(),
  };
}

// Normalize "v22.23.4" and "22.23.4" to one comparison basis.
export function normalizeVersion(version) {
  return version.replace(/^v/, "");
}

// The storage capability the UI harness requires: the vitest UI project's
// happy-dom environment must provide a working localStorage — the fixtures
// boot and clean up through it (clear, set, read, remove). The probe builds
// the same Window the harness does and exercises the same operations, so a
// runtime that breaks the harness's storage fails here, in milliseconds,
// instead of twenty-eight files deep into a suite run. The probe also reads
// any native webstorage global: one that exists but is unusable (Node's
// experimental webstorage without a storage file, historically) shadows the
// harness's own storage and is reported for what it is.
export async function probeStorageCapability() {
  let happyDom;
  try {
    happyDom = await import("happy-dom");
  } catch {
    return { ok: false, detail: "happy-dom is not installed — run `npm install` in this checkout first, then the preflight again" };
  }
  try {
    const window = new happyDom.Window({ url: "https://localhost/" });
    window.localStorage.clear();
    window.localStorage.setItem("flowsynth-runtime-probe", "1");
    const reads = window.localStorage.getItem("flowsynth-runtime-probe") === "1";
    window.localStorage.removeItem("flowsynth-runtime-probe");
    const clears = window.localStorage.length === 0;
    window.close();
    if (!reads || !clears) {
      return { ok: false, detail: "happy-dom's localStorage did not roundtrip (set/read/remove/clear)" };
    }
    const native = globalThis.localStorage;
    if (native !== undefined && native !== null) {
      try {
        native.clear();
      } catch (error) {
        return {
          ok: false,
          detail: `a native webstorage global shadows the UI harness's storage and is unusable (${error?.message ?? error}) — the runtime's experimental webstorage needs --localstorage-file, or the runtime is not the declared one`,
        };
      }
    }
    return { ok: true, detail: "happy-dom localStorage roundtrip" };
  } catch (error) {
    return { ok: false, detail: `storage probe failed: ${error?.message ?? error}` };
  }
}

const RUNTIME_SELECTION_HELP = [
  "  select the declared runtime with your version manager, then rerun:",
  "    mise install node@<version> && mise exec node@<version> -- npm test",
  "    nvm install <version> && nvm use <version>",
  "    fnm install <version> && fnm use <version>",
  "  npm scripts select the declared runtime automatically (npm test, npm run check,",
  "  npm run dev, npm run build) — run checks through them, not through a hand-built PATH.",
].join("\n");

// The verdict core: one report naming declared, effective, timezone, storage,
// the refusal reason, and the actionable fix. Pure — callers gather the real
// values (declaration read, process read, storage probe) and inject them, so
// every verdict is testable under any host.
export function checkRuntimeEnvironment(input = {}) {
  const root = input.root ?? process.cwd();
  const effective = input.effective ?? effectiveRuntime();
  const storage = input.storage ?? { ok: true, detail: "not probed" };
  const declared = input.declared !== undefined ? input.declared : declaredRuntimeVersion(root);

  const report = {
    declared: declared ?? null,
    effective: effective.version,
    timeZone: effective.timeZone,
    utcOffsetMinutes: effective.utcOffsetMinutes,
    storage,
    ok: false,
    reason: null,
    diagnostics: [],
  };

  if (declared === null) {
    report.reason = "missing-declaration";
    report.diagnostics.push(
      `supported runtime declaration missing: ${DECLARATION_FILE} not found in ${root} — the repository pins its CI-compatible Node runtime there.`,
    );
    return report;
  }
  if (!/^\d+\.\d+\.\d+$/.test(declared)) {
    report.reason = "bad-declaration";
    report.diagnostics.push(
      `unsupported ${DECLARATION_FILE} content: "${declared}" — pin one concrete semver version (the runtime CI installs), not a range or a tag.`,
    );
    return report;
  }
  if (normalizeVersion(effective.version) !== declared) {
    report.reason = "version-mismatch";
    report.diagnostics.push(
      `supported runtime mismatch: effective ${effective.version}, declared ${declared} (${DECLARATION_FILE}).`,
      RUNTIME_SELECTION_HELP.replace(/<version>/g, declared),
    );
    return report;
  }
  if (!storage.ok) {
    report.reason = "storage-unavailable";
    report.diagnostics.push(
      `UI-storage capability unavailable: ${storage.detail}`,
      "The UI test project boots its fixtures through happy-dom's localStorage; fix the storage or the runtime before running the suite.",
    );
    return report;
  }
  report.ok = true;
  return report;
}

// The recording environment for balance experiments (issue #505): what the
// recording actually ran on. Written beside each new recording's commit and
// source fingerprint; recordings made before this metadata existed carry no
// field — they stay identifiable as legacy, and no reader fabricates a value
// for them.
export function recordingEnvironment() {
  const { version, timeZone, utcOffsetMinutes } = effectiveRuntime();
  return { node: version, timeZone, utcOffsetMinutes };
}

// A recording's payload with its environment attached (issue #505): every
// balance writer composes its results through this one helper, so a future
// writer cannot forget the field and the convention lives in one place.
export function recordingPayload(payload) {
  return { ...payload, recordingEnvironment: recordingEnvironment() };
}
