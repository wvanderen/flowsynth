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
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

// The same fail-fast gate protects suites and standalone recorders. Check
// the runtime before importing the storage harness or compiling an engine.
export async function requireRuntimeEnvironment(root = process.cwd()) {
  let report = checkRuntimeEnvironment({ root });
  if (report.ok) report = checkRuntimeEnvironment({ root, storage: await probeStorageCapability() });
  if (!report.ok) {
    throw new Error([
      "runtime preflight failed — checks and recordings require the supported environment.",
      `  declared ${report.declared ?? "(missing)"} · effective ${report.effective} · timezone ${report.timeZone} · storage ${report.storage.detail}`,
      ...report.diagnostics,
    ].join("\n"));
  }
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

// Composition is not a new measurement of the input runs. Preserve each
// input's original provenance (including absent legacy metadata), and name
// the composer's environment separately. Slice shape identifies its rows;
// fixture variant identifies its continuation; the tier identifies smoke
// evidence (issue #506). Never infer an input's zone.
export function composeRecordingPayload(payload, inputs) {
  return {
    ...payload,
    compositionEnvironment: recordingEnvironment(),
    recordingInputs: inputs.map(({ path, recording }) => {
      const metadata = { path, source: recording.source };
      for (const key of ["tier", "recordingCommit", "recordingEnvironment", "minutes", "policy", "variant"]) {
        if (Object.hasOwn(recording, key)) metadata[key] = recording[key];
      }
      return metadata;
    }),
  };
}

// ── Issue #506: the smoke tier's output isolation and compose refusals ──

// The checkout root, derived from this module's own location — shared so
// the recorder tooling computes it one way.
export const REPO_ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

// Smoke output is always isolated. The default root is a fresh mkdtemp
// per invocation — concurrent smoke recordings cannot collide, and
// nothing lands in the checkout. FLOWSYNTH_SMOKE_OUTPUT may name a root
// for inspecting artifacts (created when absent), but it must be a
// directory and it must sit outside the checkout: a committed calibration
// artifact can never be smoke's target.
// Resolve existing ancestors before creating anything: lexical containment
// alone misses outside symlinks pointing into the checkout. Only ENOENT is
// recoverable; permissions and non-directory ancestors retain their errors.
async function canonicalOutputPath(candidate) {
  try {
    return await realpath(candidate);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const parent = path.dirname(candidate);
    if (parent === candidate) throw error;
    return path.join(await canonicalOutputPath(parent), path.basename(candidate));
  }
}

export async function resolveSmokeRoot(prefix, { env = process.env, cwd = process.cwd(), repoRoot = REPO_ROOT, tmp = tmpdir() } = {}) {
  const requested = env.FLOWSYNTH_SMOKE_OUTPUT;
  const explicit = requested !== undefined && requested !== "";
  const checkout = await realpath(repoRoot);
  const outsideCheckout = (resolved) => {
    const relative = path.relative(checkout, resolved);
    if (relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) {
      throw new Error(
        `FLOWSYNTH_SMOKE_OUTPUT ${requested ?? tmp} sits inside the checkout (${checkout}) — smoke output must stay outside it, so a committed calibration artifact can never be smoke's target.`,
      );
    }
    return resolved;
  };
  const resolved = outsideCheckout(await canonicalOutputPath(path.resolve(cwd, explicit ? requested : tmp)));
  if (!explicit) return mkdtemp(path.join(resolved, prefix));
  const existing = await stat(resolved).catch((error) => {
    if (error?.code !== "ENOENT") throw error;
    return null;
  });
  if (existing && !existing.isDirectory()) {
    throw new Error(`FLOWSYNTH_SMOKE_OUTPUT ${requested} is not a directory — name a directory smoke may create or reuse.`);
  }
  if (!existing) await mkdir(resolved, { recursive: true });
  return outsideCheckout(await realpath(resolved));
}

const existingArtifactError = (filePath, what) => new Error(
  `${what} already exists at ${filePath} — smoke never overwrites; point FLOWSYNTH_SMOKE_OUTPUT at a fresh path or unset it for a temporary root.`,
);

// A cheap early refusal, not a concurrency guarantee. Publication below
// uses exclusive creation even when multiple callers passed this check.
export async function refuseExistingArtifact(filePath, what) {
  try {
    await lstat(filePath);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  throw existingArtifactError(filePath, what);
}

// ── Issue #507: atomic evidence persistence ────────────────────────────

// Serialize, write a uniquely named temporary sibling, then rename it
// over the target. The target only ever changes by one atomic rename, so
// a reader — or a kill at any point — sees the previous bytes or the
// complete new ones, never a partial write that could pass for completed
// evidence. Temporaries are cleaned on every handled failure; a hard kill
// can leave one behind, and the job supervisor clears stale temporaries
// when it takes a directory over (no other writer can be alive then).
export async function writeJsonAtomic(filePath, payload) {
  const text = JSON.stringify(payload, null, 2);
  const directory = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmp = path.join(directory, `.${base}.tmp-${process.pid}-${Math.random().toString(36).slice(2)}`);
  let handle;
  try {
    handle = await open(tmp, "wx", 0o644);
    await handle.writeFile(text);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(tmp, filePath);
  } catch (error) {
    if (handle !== undefined) await handle.close().catch(() => {});
    await rm(tmp, { force: true }).catch(() => {});
    throw error;
  }
}

// Remove a directory's stale atomic-write temporaries. Only ever called
// while this process holds the directory's supervision lock, so nothing
// else is mid-write.
export async function clearStaleTemporaries(directory) {
  const entries = await readdir(directory).catch((error) => {
    if (error?.code === "ENOENT") return [];
    throw error;
  });
  await Promise.all(entries
    .filter((name) => name.includes(".tmp-"))
    .map((name) => rm(path.join(directory, name), { force: true })));
}

export async function writeSmokeArtifact(filePath, payload, what) {
  try {
    await writeFile(filePath, JSON.stringify(payload, null, 2), { flag: "wx" });
  } catch (error) {
    if (error?.code === "EEXIST") throw existingArtifactError(filePath, what);
    throw error;
  }
}

// Compose input loading with named refusals: a missing input names the
// artifact and its remedy; a corrupted one names the path — neither ever
// publishes a report (issue #506). Any other read failure (permissions,
// for instance) surfaces with the system's own named error.
export async function readRecordingFile(filePath, { what, remedy } = {}) {
  let text;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    throw new Error(`${what} is missing at ${filePath}${remedy ? ` — ${remedy}` : ""}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${what} at ${filePath} is not valid JSON — the recording was truncated or corrupted; re-record it.`);
  }
}

// Composition verifies each input's fingerprint byte for byte against the
// engine this checkout compiles; a mismatch is stale evidence and is
// refused by name, not with a structural diff.
export function assertSameCompiledSource(recordedSource, source, label) {
  try {
    assert.deepEqual(recordedSource, source);
  } catch {
    throw new Error(
      `${label} was recorded against a different compiled engine source than this checkout compiles — stale evidence cannot compose; re-record it at the current source.`,
    );
  }
}

// The tier guards keep smoke evidence and calibration evidence out of
// each other's compose paths: the smoke compose reads only smoke-tier
// recordings, and a calibration compose refuses a smoke slice outright.
export function assertSmokeTier(recorded, label) {
  if (recorded?.tier !== "smoke") {
    throw new Error(
      `${label} is not a smoke recording (tier ${JSON.stringify(recorded?.tier ?? null)}) — the smoke compose composes only smoke evidence.`,
    );
  }
}

export function assertNotSmokeTier(recorded, label) {
  if (recorded?.tier === "smoke") {
    throw new Error(`${label} is smoke evidence — smoke rows cannot join the calibration matrix; compose smoke with the smoke tier.`);
  }
}
