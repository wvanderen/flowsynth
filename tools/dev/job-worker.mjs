// Issue #507: one later-era work unit, on its own process. The supervisor
// spawns one worker per unit with an explicit heap budget; the worker
// loads the compiled recording bundle, executes exactly its planned unit,
// verifies the result reads back, and persists it atomically — so a kill
// at any point leaves the previous evidence untouched and never a partial
// write that could pass for completed work. Exit 0 only after the unit
// file is on disk. Plain JavaScript so the npm-script path runs under
// plain node; the static gate checks it with the other recorder scripts.
import { parseArgs } from "node:util";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { recordingEnvironment, writeJsonAtomic } from "./runtime.mjs";
import { logEvent, readPlan, unitPath } from "./job-recorder.mjs";

const usageError = () => new Error("Usage: job-worker --dir <job-dir> --unit <unit-id>");

const { values } = parseArgs({
  options: {
    dir: { type: "string" },
    unit: { type: "string" },
  },
});
const fail = (message) => {
  console.error(`job-worker: ${message}`);
  process.exit(1);
};
if (!values.dir || !values.unit) fail(usageError().message);

const plan = await readPlan(values.dir);
const descriptor = plan.units.find((unit) => unit.id === values.unit);
if (!descriptor) fail(`the job plan carries no unit "${values.unit}"`);
// The worker runs the same compiled bundle the supervisor certified — one
// compiled engine identity with the suite, dev server, and build.
const bundle = await import(pathToFileURL(plan.bundle).href);
const {
  PROBE_WALK_SEED,
  LONG_SESSION_MINUTES,
  laterEraRow,
  laterEraUnitIdentity,
  prepareProbeOrder,
  probeForwardFor,
  routeProbes,
  runPlaythrough,
  assertLaterEraWalk,
  validateLaterEraUnit,
} = bundle;

const t0 = performance.now();
let result;
if (descriptor.key.kind === "seed") {
  const record = runPlaythrough(descriptor.recipe);
  assertLaterEraWalk(record);
  result = { row: laterEraRow(descriptor.key.seed, descriptor.key.minutes, record) };
} else if (descriptor.key.kind === "probe-walk") {
  const record = runPlaythrough(descriptor.recipe);
  assertLaterEraWalk(record);
  // The cheap enumeration only — no route continuation runs in the walk's
  // worker; every order's forward is its own persisted unit (issue #507).
  result = {
    row: laterEraRow(PROBE_WALK_SEED, LONG_SESSION_MINUTES, record),
    banks: routeProbes(record),
    record,
  };
} else {
  const parent = descriptor.deps[0];
  if (!parent) fail(`forward unit "${descriptor.id}" names no parent`);
  const parentPath = unitPath(values.dir, parent);
  let parentUnit;
  try {
    parentUnit = JSON.parse(await readFile(parentPath, "utf8"));
  } catch (error) {
    fail(`the parent unit ${parent} is unreadable at ${parentPath}: ${error?.message ?? error}`);
  }
  const record = parentUnit.result.record;
  const prepared = prepareProbeOrder(record, descriptor.forward.bank, descriptor.forward.order);
  result = {
    prepared: {
      order: prepared.order,
      spend: prepared.spend,
      purchasesOk: prepared.purchasesOk,
      placementsOk: prepared.placementsOk,
      finite: prepared.finite,
    },
    forward: prepared.purchasesOk ? probeForwardFor(record, prepared, descriptor.forward.budgetDays) : null,
  };
}

const payload = {
  unit: descriptor.id,
  key: descriptor.key,
  identity: laterEraUnitIdentity(descriptor),
  result,
  provenance: {
    recordingCommit: plan.commit,
    recordingEnvironment: recordingEnvironment(),
  },
  elapsedMs: Math.round(performance.now() - t0),
  // ru_maxrss as the platform reports it (kilobytes on Linux).
  worker: { peakRssKb: process.resourceUsage().maxRSS, node: process.version },
};

// The unit never persists in a shape its own module cannot read back.
try {
  validateLaterEraUnit(descriptor, payload);
} catch (error) {
  fail(`the computed unit does not read back: ${error?.message ?? error}`);
}

await writeJsonAtomic(unitPath(values.dir, descriptor.id), payload);
await logEvent(values.dir, `worker pid ${process.pid} persisted unit ${descriptor.id}`);
console.log(`unit ${descriptor.id} done in ${Math.round(payload.elapsedMs / 1000)}s, peak ${Math.round(payload.worker.peakRssKb / 1024)}MB`);
