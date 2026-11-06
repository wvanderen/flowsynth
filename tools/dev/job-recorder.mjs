// Issue #507: the later-era evaluation's one recording boundary. A job is
// a directory of persisted work units: every completed unit lands
// atomically under its own identity, so an interruption — a killed
// supervisor, a tool-call timeout, a lost shell — loses in-flight work
// only, and a relaunch executes exactly the missing, failed, or
// invalidated units. This module owns persistence, validity decisions,
// and job status; the CLI and the verification drive it. Plain JavaScript
// so the npm-script path runs under plain node; the TypeScript surface
// lives in job-recorder.d.mts.
//
// Workers are separate processes (one per unit, bounded concurrency,
// each with an explicit heap budget). A worker persists its own unit
// before reporting success; the supervisor never writes evidence, so a
// worker that outlives a killed supervisor still lands its completed
// unit, and a resume reuses it.
import { spawn } from "node:child_process";
import { appendFile, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import {
  REPO_ROOT,
  clearStaleTemporaries,
  readRecordingFile,
  writeJsonAtomic,
} from "./runtime.mjs";

export const WORKER_SCRIPT = path.join(REPO_ROOT, "tools", "dev", "job-worker.mjs");

export const DEFAULT_JOBS = 4;
export const DEFAULT_WORKER_MEMORY_MB = 1024;

// ── Job directory layout ───────────────────────────────────────────────────

export function unitPath(dir, unitId) {
  return path.join(dir, "units", `${unitId}.json`);
}

const lockPath = (dir) => path.join(dir, "supervisor.lock.json");
const statusPath = (dir) => path.join(dir, "job-status.json");
const planPath = (dir) => path.join(dir, "plan.json");
const logsPath = (dir) => path.join(dir, "logs");

export { statusPath, planPath, logsPath, lockPath };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Single-flight supervision ──────────────────────────────────────────────

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

// Refuses when a live supervisor holds the job — the check a detached
// launch performs before spawning its supervisor child.
export async function assertNoLiveSupervisor(dir) {
  let existing;
  try {
    existing = JSON.parse(await readFile(lockPath(dir), "utf8"));
  } catch {
    return;
  }
  if (processAlive(existing?.pid)) {
    throw new Error(
      `a supervisor is already running this job (pid ${existing.pid}, started ${existing.startedAt}) — ` +
      `observe it with the status command, or kill pid ${existing.pid} to cancel it`,
    );
  }
}

// One supervisor at a time per job directory. A live lock refuses by
// name; a stale one (a killed supervisor) is taken over. The lock file
// carries the holder's pid and start stamp for the refusal message.
export async function acquireSupervisorLock(dir) {
  await mkdir(dir, { recursive: true });
  for (let attempt = 0; attempt < 5; attempt++) {
    let existing;
    try {
      existing = JSON.parse(await readFile(lockPath(dir), "utf8"));
    } catch {
      existing = null;
    }
    if (existing && processAlive(existing.pid)) {
      throw new Error(
        `a supervisor is already running this job (pid ${existing.pid}, started ${existing.startedAt}) — ` +
        `observe it with the status command, or kill pid ${existing.pid} to cancel it`,
      );
    }
    if (existing) {
      // A stale lock (a killed supervisor): clear it before re-creating.
      await rm(lockPath(dir), { force: true });
      await logEvent(dir, `took over the stale lock of pid ${existing.pid} (started ${existing.startedAt})`);
    }
    const stamp = { pid: process.pid, startedAt: new Date().toISOString() };
    try {
      const handle = await open(lockPath(dir), "wx", 0o644);
      await handle.writeFile(JSON.stringify(stamp, null, 2));
      await handle.close();
      // Lost-create defense: confirm this process owns the file.
      const confirmed = JSON.parse(await readFile(lockPath(dir), "utf8"));
      if (confirmed.pid === process.pid) return stamp;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
    await sleep(100);
  }
  throw new Error("could not acquire the job's supervision lock — another supervisor is starting");
}

async function releaseSupervisorLock(dir) {
  await rm(lockPath(dir), { force: true });
}

// ── The plan ───────────────────────────────────────────────────────────────

// The plan is rebuilt from the current checkout on every run: the
// compiled bundle path, the commit, and each unit's current identity. A
// stored unit is reused only when its identity equals the current one,
// so an engine or evaluation change invalidates exactly the units it
// touches. The plan file is the whole instruction a worker receives.
export async function prepareJobDir(dir, plan) {
  await mkdir(path.join(dir, "units"), { recursive: true });
  await mkdir(path.join(logsPath(dir), "corrupt"), { recursive: true });
  await writeJsonAtomic(planPath(dir), plan);
}

export function readPlan(dir) {
  return readRecordingFile(planPath(dir), {
    what: "the job plan",
    remedy: "relaunch the job with the run command",
  });
}

// Appends derived units (the probe forwards) once their parent's result
// exists. The plan file stays the whole instruction; workers read it.
export async function appendDerivedUnits(dir, descriptors) {
  const plan = await readPlan(dir);
  const known = new Set(plan.units.map((unit) => unit.id));
  const fresh = descriptors.filter((unit) => !known.has(unit.id));
  if (fresh.length === 0) return [];
  await writeJsonAtomic(planPath(dir), { ...plan, units: [...plan.units, ...fresh] });
  return fresh;
}

// ── Validity scanning ──────────────────────────────────────────────────────

// Classifies every planned unit's stored state against the current
// identity. Corrupt or duplicate-shaped evidence — unparseable JSON, a
// unit that does not name its own id and key, a result its own module
// cannot read back — is rejected: the bytes are preserved under
// logs/corrupt/ for forensics and the unit re-executes. A unit whose
// identity no longer matches keeps its bytes (valid evidence of an older
// checkout) and re-executes against the current inputs.
export async function scanUnits(dir, plan, { identityOf, validateUnit }) {
  const scanned = [];
  for (const descriptor of plan.units) {
    const file = unitPath(dir, descriptor.id);
    let text;
    try {
      text = await readFile(file, "utf8");
    } catch (error) {
      if (error?.code === "ENOENT") {
        scanned.push({ descriptor, state: "missing" });
        continue;
      }
      throw error;
    }
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      await preserveCorruptUnit(dir, descriptor.id, file, "not valid JSON");
      scanned.push({ descriptor, state: "corrupt", reason: "not valid JSON" });
      continue;
    }
    try {
      validateUnit(descriptor, payload);
    } catch (error) {
      await preserveCorruptUnit(dir, descriptor.id, file, error?.message ?? "does not read back");
      scanned.push({ descriptor, state: "corrupt", reason: `does not read back: ${error?.message ?? error}` });
      continue;
    }
    if (!identityMatches(identityOf(descriptor), payload.identity)) {
      scanned.push({ descriptor, state: "stale-identity", reason: "identity does not match the current inputs" });
      continue;
    }
    scanned.push({ descriptor, state: "valid", payload });
  }
  return scanned;
}

// Deep equality over parsed JSON: key order is irrelevant to identity,
// so both sides are canonicalized before the byte compare.
function identityMatches(current, stored) {
  try {
    return JSON.stringify(sortedIdentity(current)) === JSON.stringify(sortedIdentity(stored));
  } catch {
    return false;
  }
}

function sortedIdentity(value) {
  if (Array.isArray(value)) return value.map(sortedIdentity);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().map((key) => [key, sortedIdentity(value[key])]);
  }
  return value;
}

async function preserveCorruptUnit(dir, unitId, file, why) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const target = path.join(logsPath(dir), "corrupt", `${unitId}-${stamp}.json`);
  await rm(target, { force: true });
  await rename(file, target).catch(async () => {
    await rm(file, { force: true });
  });
  await logEvent(dir, `rejected unit ${unitId} (${why}): bytes preserved at ${target}`);
}

export async function logEvent(dir, line) {
  await appendFile(path.join(logsPath(dir), "supervisor.log"), `${new Date().toISOString()} ${line}\n`).catch(() => {});
}

// ── Job status ─────────────────────────────────────────────────────────────

async function writeJobStatus(dir, status) {
  await writeJsonAtomic(statusPath(dir), { ...status, updatedAt: new Date().toISOString() });
}

export async function readJobStatus(dir) {
  return readRecordingFile(statusPath(dir), {
    what: "the job status",
    remedy: "no job has been started at this directory",
  });
}

export async function readJobStatusIfAny(dir) {
  try {
    return await readJobStatus(dir);
  } catch {
    return null;
  }
}

// The human summary the status command prints: completed/remaining units,
// failures, elapsed time, worker memory usage beside its budget, and
// where the logs and the durable status live.
export function formatStatus(dir, status) {
  const units = Object.entries(status.units ?? {});
  const done = units.filter(([, unit]) => unit.state === "done");
  const failed = units.filter(([, unit]) => unit.state === "failed");
  const running = units.filter(([, unit]) => unit.state === "running");
  const open_ = units.filter(([, unit]) => unit.state === "pending");
  const total = units.length;
  const elapsedMs = (status.terminalAt ? Date.parse(status.terminalAt) : Date.now()) - Date.parse(status.startedAt);
  const elapsed = elapsedMs >= 60_000
    ? `${Math.floor(elapsedMs / 60_000)}m${Math.round((elapsedMs % 60_000) / 1000)}s`
    : `${Math.round(elapsedMs / 1000)}s`;
  const peak = Math.max(0, ...units.map(([, unit]) => unit.peakRssKb ?? 0));
  const lines = [
    `${status.scope} job at ${dir} — ${status.status}${status.supervisor?.pid ? ` (pid ${status.supervisor.pid})` : ""}`,
    `units: ${done.length}/${total} done, ${failed.length} failed, ${open_.length + running.length} remaining · elapsed ${elapsed}`,
    `options: ${status.options.jobs} concurrent workers · ${status.options.workerMemoryBudgetMb} MB worker memory budget${status.options.notify ? ` · notify: ${status.options.notify}` : ""}`,
  ];
  for (const [id, unit] of running) lines.push(`  running ${id} (attempt ${unit.attempts}, started ${unit.startedAt})`);
  for (const [id, unit] of failed) lines.push(`  FAILED ${id} (attempt ${unit.attempts}) — ${unit.error ?? "worker failed"}`);
  const doneLine = (id, unit) => {
    const seconds = unit.elapsedMs !== undefined ? `${Math.round(unit.elapsedMs / 1000)}s` : "?";
    const rss = unit.peakRssKb ? `${Math.round(unit.peakRssKb / 1024)}MB` : "?";
    return `  done ${id} — ${seconds}, worker peak ${rss}`;
  };
  for (const [id, unit] of done.slice(0, 12)) lines.push(doneLine(id, unit));
  if (done.length > 12) lines.push(`  … and ${done.length - 12} more done units (read ${statusPath(dir)} for all)`);
  if (done.length > 0) lines.push(`worker peak memory this job: ${Math.round(peak / 1024)}MB of the ${status.options.workerMemoryBudgetMb}MB budget`);
  for (const [id, published] of Object.entries(status.published ?? {})) {
    lines.push(`published ${id} → ${published.path}`);
  }
  if (status.notification) {
    lines.push(`notification (${status.notification.command}): exit ${status.notification.exitCode}${status.notification.error ? ` — ${status.notification.error}` : ""}`);
  }
  lines.push(`logs: ${logsPath(dir)}/ · durable status: ${statusPath(dir)}`);
  return lines.join("\n");
}

// ── The supervisor ─────────────────────────────────────────────────────────

// Runs the job to a terminal state: reuses every scanned-valid unit,
// executes the rest on bounded worker processes, derives the fan-out
// units when their parent lands, publishes completed groups, and records
// the durable final status plus the completion notification. The adapter
// supplies the recording domain:
//   identityOf(descriptor) — the unit's current identity
//   validateUnit(descriptor, payload) — refuses a unit that does not
//     name its own id and key and carry a readable result
//   deriveFrom / derive — the fan-out: when the named unit's result
//     lands, derive builds the follow-on descriptors from it
//   groups — [{id, unitIds, publish(unitsById, ctx) → artifact path}],
//     published once all their units are valid
// Options: jobs (bounded concurrency), workerMemoryBudgetMb (each
// worker's V8 heap cap), notify (one shell command at the terminal
// state), detached (recording that the supervisor runs detached).
export async function runSupervisor(dir, plan, adapter, options = {}) {
  const jobs = options.jobs ?? DEFAULT_JOBS;
  const workerMemoryBudgetMb = options.workerMemoryBudgetMb ?? DEFAULT_WORKER_MEMORY_MB;
  const notify = options.notify ?? null;
  if (!Number.isInteger(jobs) || jobs < 1) throw new Error(`--jobs must be a whole number ≥ 1 — found ${options.jobs}`);
  if (!Number.isInteger(workerMemoryBudgetMb) || workerMemoryBudgetMb < 128) {
    throw new Error(`--worker-mb must be a whole number ≥ 128 — found ${options.workerMemoryBudgetMb}`);
  }

  // A pre-acquired lock (the CLI acquires before compiling, so a refused
  // second supervisor can never disturb the holder's bundle) skips the
  // acquisition; the release always happens in the finally below.
  const lock = options.lock ?? await acquireSupervisorLock(dir);
  await clearStaleTemporaries(path.join(dir, "units"));
  await clearStaleTemporaries(dir);
  await logEvent(dir, `supervisor pid ${process.pid} took the job (jobs=${jobs}, worker-mb=${workerMemoryBudgetMb})`);

  const scanned = await scanUnits(dir, plan, adapter);
  const previous = await readJobStatusIfAny(dir);
  const validIds = new Set(scanned.filter((entry) => entry.state === "valid").map((entry) => entry.descriptor.id));
  const unitStates = {};
  for (const entry of scanned) {
    const prior = previous?.units?.[entry.descriptor.id] ?? {};
    unitStates[entry.descriptor.id] = {
      ...prior,
      state: entry.state === "valid" ? "done" : "pending",
      attempts: prior.attempts ?? (entry.state === "valid" ? 1 : 0),
      error: entry.state === "valid" ? null : entry.reason ?? null,
    };
  }
  const status = {
    scope: plan.scope,
    status: "running",
    options: { jobs, workerMemoryBudgetMb, notify, detached: options.detached ?? false },
    supervisor: { pid: process.pid, startedAt: lock.startedAt, node: process.version },
    units: unitStates,
    published: previous?.published ?? {},
    notification: null,
    startedAt: previous?.startedAt ?? new Date().toISOString(),
    resumedAt: new Date().toISOString(),
    terminalAt: null,
  };
  await writeJobStatus(dir, status);

  const descriptors = new Map(plan.units.map((unit) => [unit.id, unit]));
  // Everything not already valid needs a run, in declaration order.
  const queue = scanned.filter((entry) => entry.state !== "valid").map((entry) => entry.descriptor.id);

  let cancelled = null;
  let stopSpawning = false;
  let publishError = null;
  let derivedOnce = adapter.deriveFrom === undefined;
  const running = new Map();
  const logHandles = new Map();
  const doneThisRun = new Map();
  const exits = [];
  let wake = null;

  const onSignal = (signal) => {
    if (cancelled) return;
    cancelled = signal;
    void logEvent(dir, `received ${signal} — cancelling in-flight workers`);
    for (const [, entry] of running) {
      try { entry.child.kill("SIGTERM"); } catch { /* already gone */ }
    }
  };
  const onInterrupt = () => onSignal("SIGINT");
  const onTerminate = () => onSignal("SIGTERM");
  process.on("SIGINT", onInterrupt);
  process.on("SIGTERM", onTerminate);

  const eligible = () => {
    if (cancelled || stopSpawning) return null;
    for (const id of queue) {
      if (running.has(id)) continue;
      if (unitStates[id]?.state !== "pending") continue;
      const descriptor = descriptors.get(id);
      if (descriptor?.deps.every((dep) => validIds.has(dep))) return id;
    }
    return null;
  };

  const spawnWorker = async (id) => {
    unitStates[id] = {
      ...unitStates[id],
      state: "running",
      attempts: (unitStates[id]?.attempts ?? 0) + 1,
      startedAt: new Date().toISOString(),
      error: null,
    };
    await writeJobStatus(dir, status);
    await logEvent(dir, `worker started unit ${id} (attempt ${unitStates[id].attempts})`);
    const logHandle = await open(path.join(logsPath(dir), `${id}.log`), "a");
    await logHandle.write(`\n=== attempt ${unitStates[id].attempts} started ${new Date().toISOString()} ===\n`);
    logHandles.set(id, logHandle);
    const child = spawn(process.execPath,
      [`--max-old-space-size=${workerMemoryBudgetMb}`, WORKER_SCRIPT, "--dir", dir, "--unit", id],
      { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"], env: process.env });
    running.set(id, { child, startedAt: Date.now() });
    child.stdout.on("data", (chunk) => void logHandle.write(chunk));
    child.stderr.on("data", (chunk) => void logHandle.write(chunk));
    child.on("close", (code, signal) => {
      exits.push({ id, code, signal });
      if (wake) { const release = wake; wake = null; release(); }
    });
  };

  const finishUnit = async (id, state, extra = {}) => {
    const { elapsedMs, peakRssKb, error } = extra;
    const startedAt = running.get(id)?.startedAt ?? Date.now();
    running.delete(id);
    unitStates[id] = {
      ...unitStates[id],
      state,
      finishedAt: new Date().toISOString(),
      elapsedMs: elapsedMs ?? Date.now() - startedAt,
      ...(peakRssKb !== undefined ? { peakRssKb } : {}),
      error: error ?? null,
    };
    const handle = logHandles.get(id);
    if (handle) {
      await handle.write(`=== attempt ended ${new Date().toISOString()} (${state}) ===\n`).catch(() => {});
      await handle.close().catch(() => {});
      logHandles.delete(id);
    }
    await writeJobStatus(dir, status);
  };

  const handleExit = async ({ id, code, signal }) => {
    if (signal === "SIGTERM" || signal === "SIGKILL") {
      if (cancelled) {
        await finishUnit(id, "pending", { error: `cancelled by ${cancelled} before completion` });
      } else {
        await finishUnit(id, "failed", { error: `worker terminated by ${signal} — read the unit's log` });
        await logEvent(dir, `unit ${id} was killed by ${signal}`);
      }
      return;
    }
    if (code !== 0) {
      const tail = await workerErrorTail(id);
      await finishUnit(id, "failed", { error: tail ?? `worker exited ${code}` });
      await logEvent(dir, `unit ${id} failed: ${tail ?? `exit ${code}`}`);
      return;
    }
    let payload;
    try {
      payload = await readRecordingFile(unitPath(dir, id), { what: `unit ${id}` });
      adapter.validateUnit(descriptors.get(id), payload);
      if (!identityMatches(adapter.identityOf(descriptors.get(id)), payload.identity)) {
        throw new Error("the persisted unit's identity does not match the current inputs");
      }
    } catch (error) {
      await finishUnit(id, "failed", { error: `worker claimed success but the unit does not read back: ${error?.message ?? error}` });
      await logEvent(dir, `unit ${id} unreadable after success: ${error?.message ?? error}`);
      return;
    }
    await finishUnit(id, "done", {
      elapsedMs: payload.elapsedMs,
      peakRssKb: payload.worker?.peakRssKb,
      error: null,
    });
    doneThisRun.set(id, payload);
    validIds.add(id);
    await logEvent(dir, `unit ${id} done in ${payload.elapsedMs !== undefined ? Math.round(payload.elapsedMs / 1000) + "s" : "?"}, worker peak ${payload.worker?.peakRssKb ? Math.round(payload.worker.peakRssKb / 1024) + "MB" : "?"}`);
    if (adapter.derive && id === adapter.deriveFrom && !derivedOnce) {
      derivedOnce = true;
      const derived = await adapter.derive(payload);
      const fresh = await appendDerivedUnits(dir, derived);
      for (const unit of fresh) {
        descriptors.set(unit.id, unit);
        queue.push(unit.id);
        unitStates[unit.id] = { state: "pending", attempts: 0, error: null };
      }
      if (fresh.length > 0) {
        await writeJobStatus(dir, status);
        await logEvent(dir, `derived ${fresh.length} follow-on units from ${id}`);
      }
    }
    await publishReadyGroups();
  };

  // Publication readiness is per-run: a resumed job re-attempts each
  // group's publish (production slices overwrite atomically; the smoke
  // tier's exclusive creation refuses by name), so the persisted record
  // stays observability only, never a skip marker.
  const publishedThisRun = new Set();
  const groupContext = () => ({ descriptors, validIds });
  const publishReadyGroups = async () => {
    for (const group of adapter.groups ?? []) {
      if (publishedThisRun.has(group.id)) continue;
      // A group whose ids depend on derived units resolves them against
      // the plan the supervisor currently carries, and may gate its own
      // readiness (the probe evidence is not publishable before its
      // forwards have been derived and completed).
      const unitIds = typeof group.unitIds === "function" ? group.unitIds(groupContext()) : group.unitIds;
      if (!unitIds.every((id) => validIds.has(id))) continue;
      if (group.ready && !group.ready(groupContext())) continue;
      const unitsById = Object.fromEntries(unitIds.map((id) => {
        const payload = doneThisRun.get(id) ?? scanned.find((entry) => entry.descriptor.id === id)?.payload;
        return [id, payload];
      }));
      try {
        const published = await group.publish(unitsById, { commit: plan.commit, dir });
        publishedThisRun.add(group.id);
        status.published = { ...(status.published ?? {}), [group.id]: { path: published, at: new Date().toISOString() } };
        await writeJobStatus(dir, status);
        await logEvent(dir, `published ${group.id} → ${published}`);
      } catch (error) {
        publishError = `${group.id} could not publish: ${error?.message ?? error}`;
        stopSpawning = true;
        await logEvent(dir, `publish failed for ${group.id}: ${error?.message ?? error}`);
      }
    }
  };

  const workerErrorTail = async (id) => {
    try {
      const text = await readFile(path.join(logsPath(dir), `${id}.log`), "utf8");
      const lines = text.trimEnd().split("\n").filter((line) => line.length > 0 && !line.startsWith("==="));
      return lines.at(-1)?.slice(0, 400) ?? null;
    } catch {
      return null;
    }
  };

  // Groups whose units were all valid before this run (a crash between
  // completion and publication) publish immediately.
  for (const entry of scanned) if (entry.state === "valid") doneThisRun.set(entry.descriptor.id, entry.payload);
  await publishReadyGroups();

  try {
    while (true) {
      while (running.size < jobs) {
        const next = eligible();
        if (!next) break;
        await spawnWorker(next);
      }
      if (running.size === 0) break;
      await new Promise((resolve) => {
        if (exits.length > 0) return resolve();
        wake = resolve;
      });
      while (exits.length > 0) await handleExit(exits.shift());
    }

    const failedCount = Object.values(unitStates).filter((unit) => unit.state === "failed").length;
    const doneCount = Object.values(unitStates).filter((unit) => unit.state === "done").length;
    const outcome = cancelled ? "cancelled" : failedCount > 0 || publishError ? "failed" : "complete";
    status.status = outcome;
    status.terminalAt = new Date().toISOString();
    await writeJobStatus(dir, status);
    await logEvent(dir, `job ${outcome}: ${doneCount} done, ${failedCount} failed, ${queue.length - doneCount + failedCount} not done${publishError ? `; publish error: ${publishError}` : ""}`);
    status.notification = notify ? await runNotification(dir, notify, outcome) : null;
    await writeJobStatus(dir, status);
    return { outcome, publishError, cancelled };
  } finally {
    for (const [, entry] of running) {
      try { entry.child.kill("SIGTERM"); } catch { /* already gone */ }
    }
    for (const handle of logHandles.values()) await handle.close().catch(() => {});
    await releaseSupervisorLock(dir);
    process.removeListener("SIGINT", onInterrupt);
    process.removeListener("SIGTERM", onTerminate);
  }
}

// The completion-notification handoff: the terminal state runs the
// command once, with the job directory, the final status word, and the
// status file's path in its environment. The agent registers it at
// launch and never keeps a shell wait alive.
async function runNotification(dir, command, finalStatus) {
  await logEvent(dir, `running notification: ${command}`);
  return new Promise((resolve) => {
    const child = spawn("/bin/sh", ["-c", command], {
      cwd: dir,
      env: {
        ...process.env,
        FLOWSYNTH_JOB_DIR: dir,
        FLOWSYNTH_JOB_STATUS: finalStatus,
        FLOWSYNTH_JOB_STATUS_FILE: statusPath(dir),
      },
      timeout: 60_000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout = (stdout + chunk).slice(-2000); });
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-2000); });
    child.on("error", (error) => resolve({ command, exitCode: null, error: error?.message ?? String(error), stdout, stderr }));
    child.on("close", (code) => resolve({ command, exitCode: code, stdout, stderr }));
  });
}

// ── Detached launch ────────────────────────────────────────────────────────

// The launch handoff: the CLI validates everything cheap, builds the
// plan, then spawns the detached supervisor and returns once the status
// file reports a live pid — the agent's shell call ends here, the walk
// continues, and the notification fires at the terminal state.
export async function launchDetachedSupervisor({ argv, dir, timeoutMs = 30_000 }) {
  await assertNoLiveSupervisor(dir);
  const child = spawn(argv[0], argv.slice(1), {
    detached: true,
    stdio: "ignore",
    cwd: REPO_ROOT,
    env: process.env,
  });
  child.unref();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await readJobStatusIfAny(dir);
    // A leftover status from a dead run must never satisfy the wait: the
    // reported supervisor has to be alive.
    if (status?.supervisor?.pid && status.supervisor.pid !== process.pid && processAlive(status.supervisor.pid)) {
      return { pid: status.supervisor.pid, status };
    }
    if (child.exitCode !== null) {
      throw new Error(`the detached supervisor exited immediately (code ${child.exitCode}) — read ${path.join(logsPath(dir), "supervisor.log")}`);
    }
    await sleep(150);
  }
  throw new Error(`the detached supervisor did not report a live pid within ${timeoutMs / 1000}s — read ${path.join(logsPath(dir), "supervisor.log")}`);
}
