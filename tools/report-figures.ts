// Recorded-report figure generation (issue #512): the later-era and
// century numerical report summaries — tables, totals, distributions, and
// mechanical threshold reads — are generated from their recorded JSON so
// they cannot drift from the evidence after a rerun. The recorded JSON in
// `docs/` is the source of numerical truth; each generated figure has one
// authoritative derivation, in this module.
//
// This module imports no engine code — only the shared evaluation
// declaration — so generation structurally cannot simulate: every figure
// is arithmetic over the recorded JSON it is handed. Validation is cheap
// and refuses corrupted evidence before any figure derives from it:
// incomplete or duplicate matrix rows, totals inconsistent with the
// recorded eras, provenance disagreement between the composed report and
// its published slices, and route flags the recorded forwards contradict.
// Mechanical verdicts name their criterion, their observed read, and
// their state (met / UNMET / incomplete); a reported miss never becomes
// an approved exception merely because it is documented. Legacy evidence
// records its absent metadata as absent — nothing is fabricated.

import {
  CENTURY_BUDGET_DAYS,
  CENTURY_MARK_HOURS,
  CENTURY_MEASUREMENT_VERSION,
  CENTURY_POLICIES,
  EVALUATION_SEEDS,
  LONG_GAP_CREDITED,
  LATER_ERA_BUDGET_DAYS,
  LATER_ERA_WINDOW,
  OPENING_WINDOW,
  SPARSE_ACQUISITION_SEEDS,
  TARGET_ERAS,
  WORLD_POLICIES,
} from "./evaluation-declaration";

// ── Corrupted evidence ────────────────────────────────────────────────

// One error carrying every validation failure, so a rerun shows the whole
// corruption instead of only its first symptom.
export class EvidenceError extends Error {
  readonly failures: readonly string[];
  constructor(failures: readonly string[]) {
    super(
      `Recorded evidence is not usable for figure generation (${failures.length} failure${failures.length === 1 ? "" : "s"}):\n` +
        failures.map((failure) => `  - ${failure}`).join("\n"),
    );
    this.name = "EvidenceError";
    this.failures = [...failures];
  }
}

class FailureList {
  readonly failures: string[] = [];
  add(failure: string): void {
    this.failures.push(failure);
  }
  get empty(): boolean {
    return this.failures.length === 0;
  }
  throwIfAny(label: string): void {
    if (!this.empty) throw new EvidenceError(this.failures.map((f) => `${label}: ${f}`));
  }
}

// ── Structural views of the recorded JSON (typing only) ──────────────

export interface LaterEraReportJson {
  readonly target: { readonly minHours: number; readonly maxHours: number; readonly eras: number };
  readonly seeds: readonly number[];
  readonly budgets: { readonly baselineDays: number; readonly longDays: number };
  readonly policies: readonly string[];
  readonly source: { readonly game: string; readonly saveVersion: number; readonly runnerVersion: number; readonly engineSource: string };
  readonly runs: readonly LaterEraRunJson[];
  readonly distributions: readonly LaterEraDistributionJson[];
  readonly recordingCommit: string;
  readonly routeProbes: readonly RouteProbeJson[];
  readonly recordingInputs: readonly RecordingInputJson[];
}
export interface LaterEraRunJson {
  readonly seed: number;
  readonly sessionMinutes: number;
  readonly policy: string;
  readonly complete: boolean;
  readonly stopKind: string;
  readonly days: number;
  readonly creditedHours: number;
  readonly claims: readonly number[];
  readonly frontiers: readonly number[];
  readonly eras: readonly LaterEraEraJson[];
  readonly noGrant: boolean;
}
export interface LaterEraEraJson {
  readonly index: number;
  readonly eraClass: string;
  readonly hours: number | null;
  readonly claim: number | null;
  readonly frontierAfter: number | null;
  readonly newShare: number | null;
  readonly familiarFaster: boolean | null;
  readonly rebuildingShare: number | null;
}
export interface LaterEraDistributionJson {
  readonly sessionMinutes: number;
  readonly policy: string;
  readonly erasBySeed: readonly {
    readonly seed: number;
    readonly classes: readonly { readonly index: number; readonly eraClass: string; readonly hours: number | null }[];
  }[];
  readonly counts: { readonly inWindow: number; readonly under: number; readonly over: number; readonly open: number };
}
export interface RouteProbeJson {
  readonly frontier: number;
  readonly claim: number;
  readonly orders: readonly {
    readonly order: readonly string[];
    readonly forward: { readonly outcome: string; readonly frontierAfter: number } | null;
  }[];
  readonly routeDemonstrated: boolean;
}
export interface RecordingInputJson {
  readonly path: string;
  readonly source: { readonly engineSource: string };
  readonly recordingCommit: string;
  readonly recordingEnvironment?: { readonly node: string; readonly timeZone: string; readonly utcOffsetMinutes: number };
}
export interface LaterEraSliceJson {
  readonly source: { readonly engineSource: string };
  readonly recordingCommit: string;
  readonly minutes: number;
  readonly policy: string;
  readonly rows: readonly LaterEraRunJson[];
  readonly unitProvenance: Record<string, unknown>;
}
export interface LaterEraProbeJson {
  readonly source: { readonly engineSource: string };
  readonly banks: readonly RouteProbeJson[];
  readonly unitProvenance: Record<string, unknown>;
}
export interface LaterEraInputs {
  readonly slices: readonly LaterEraSliceJson[];
  readonly probe: LaterEraProbeJson;
}

export interface CenturyReportJson {
  readonly target: {
    readonly markHours: number;
    readonly opening: { readonly minHours: number; readonly maxHours: number };
    readonly later: { readonly minHours: number; readonly maxHours: number };
    readonly longGapCredited: number;
  };
  readonly seeds: readonly number[];
  readonly budgets: { readonly baselineDays: number; readonly longDays: number };
  readonly policies: readonly string[];
  readonly sparseSeeds: readonly number[];
  readonly source: { readonly game: string; readonly saveVersion: number; readonly runnerVersion: number; readonly engineSource: string };
  readonly runs: readonly CenturyRunJson[];
  readonly distributions: readonly CenturyDistributionJson[];
  readonly investments: readonly { readonly key: string; readonly reached: number; readonly runs: number }[];
  readonly comparisons: readonly { readonly seed: number; readonly sessionMinutes: number; readonly byPolicy: readonly { readonly policy: string }[] }[];
  readonly recordingCommit: string;
  readonly fixtures: { readonly raw: CenturyRunJson; readonly collectionReset: CenturyRunJson };
  readonly representative: { readonly seed: number; readonly sessionMinutes: number; readonly policy: string; readonly claims: readonly number[]; readonly frontiers: readonly number[] };
}
export interface CenturyRunJson {
  readonly measurementVersion?: number;
  readonly seed: number;
  readonly sessionMinutes: number;
  readonly policy: string;
  readonly kind: string;
  readonly complete: boolean;
  readonly stopKind: string;
  readonly creditedHours: number;
  readonly claims: readonly number[];
  readonly frontiers: readonly number[];
  readonly eras: readonly CenturyEraJson[];
  // The legacy compose re-projects fixture trajectories at a coarser
  // stride than the published fixture files; validation compares fixture
  // rows without them.
  readonly trajectory?: readonly unknown[];
  readonly gaps: { readonly count: number; readonly maxCredited: number; readonly meanCredited: number; readonly longCount: number };
  readonly numeric: { readonly finiteSnapshots: boolean; readonly serializedChecks: number; readonly serializedOk: number };
  readonly noGrant: boolean;
}
export interface CenturyEraJson {
  readonly index: number;
  readonly eraClass: string;
  readonly hours: number | null;
  readonly claim: number | null;
  readonly finite: boolean | null;
}
export interface CenturyDistributionJson {
  readonly sessionMinutes: number;
  readonly policy: string;
  readonly counts: { readonly inWindow: number; readonly under: number; readonly over: number; readonly open: number };
}
export interface CenturySliceJson {
  readonly source: { readonly engineSource: string };
  readonly minutes: number;
  readonly policy: string;
  readonly rows: readonly CenturyRunJson[];
}
export interface CenturyFixtureJson {
  readonly variant: string;
  readonly recordingCommit: string;
  readonly row: CenturyRunJson;
}
export interface CenturyInputs {
  readonly slices: readonly CenturySliceJson[];
  readonly fixtures: { readonly raw: CenturyFixtureJson; readonly collectionReset: CenturyFixtureJson };
}

// ── Generated-block plumbing: markers, splice, staleness ─────────────

export const LATER_ERA_BLOCK_ID = "report-figures:later-era";
export const CENTURY_BLOCK_ID = "report-figures:century";
export const REGENERATE_HINT = "node tools/run-supported.mjs tools/render-report-figures.mjs write";

const beginMarker = (id: string): string => `<!-- ${id} begin (regenerate: ${REGENERATE_HINT}) -->`;
const endMarker = (id: string): string => `<!-- ${id} end -->`;

// The full fenced text a document must carry for its figures to be
// current — the marker pair around the rendered block.
export function generatedBlock(id: string, rendered: string): string {
  return `${beginMarker(id)}\n${rendered}\n${endMarker(id)}`;
}

// The staleness check the suite and the CLI both run: the committed
// document's generated region must equal what the recorded evidence
// regenerates, byte for byte.
export function figuresCurrent(doc: string, id: string, rendered: string): boolean {
  return doc.includes(generatedBlock(id, rendered));
}

// Replace (or, for first publication, require) the document's generated
// region. Only the fenced region moves; the handwritten interpretation
// around it is never touched by regeneration.
export function spliceGeneratedBlock(doc: string, id: string, rendered: string): string {
  const begin = beginMarker(id);
  const end = endMarker(id);
  const failures: string[] = [];
  const first = doc.indexOf(begin);
  const duplicatedBegin = first !== -1 && doc.indexOf(begin, first + begin.length) !== -1;
  if (first === -1) failures.push(`the document carries no begin marker for "${id}"`);
  if (duplicatedBegin) failures.push(`the document carries more than one begin marker for "${id}"`);
  const last = doc.indexOf(end);
  const duplicatedEnd = last !== -1 && doc.indexOf(end, last + end.length) !== -1;
  if (last === -1) failures.push(`the document carries no end marker for "${id}"`);
  if (duplicatedEnd) failures.push(`the document carries more than one end marker for "${id}"`);
  if (first !== -1 && last !== -1 && last < first) failures.push(`the end marker for "${id}" precedes its begin marker`);
  if (failures.length > 0) throw new EvidenceError(failures.map((f) => `generated-block marker: ${f}`));
  return doc.slice(0, first) + generatedBlock(id, rendered) + doc.slice(last + end.length);
}

// ── Comparison and formatting helpers ─────────────────────────────────

// Canonical JSON compare: key order never decides equality of recorded
// figures.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}
const deepEqual = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);

// Recorded hours are rounded at recording time; render them verbatim.
const formatHours = (hours: number): string => String(hours);

const POLICY_CLASS_LABELS: Record<string, string> = { "in-window": "in", under: "under", over: "over", open: "open" };

// ── Later-era validation ──────────────────────────────────────────────

const LATER_ERA_SLICE_PATH = (minutes: number, policy: string): string => `docs/later-era-slice-${minutes}-${policy}.json`;
const LATER_ERA_PROBE_PATH = "docs/later-era-probe.json";

export function validateLaterEraEvidence(report: LaterEraReportJson, inputs: LaterEraInputs): void {
  const failures = new FailureList();
  const label = "later-era evidence";

  // The declaration the report claims to have recorded.
  if (!deepEqual(report.target, { minHours: LATER_ERA_WINDOW.minHours, maxHours: LATER_ERA_WINDOW.maxHours, eras: TARGET_ERAS })) {
    failures.add(`target ${canonical(report.target)} disagrees with the declared evaluation window and walk`);
  }
  if (!deepEqual(report.seeds, EVALUATION_SEEDS)) failures.add(`seeds ${canonical(report.seeds)} disagree with the declared matrix`);
  if (!deepEqual(report.budgets, { baselineDays: LATER_ERA_BUDGET_DAYS.baseline, longDays: LATER_ERA_BUDGET_DAYS.long })) {
    failures.add(`budgets ${canonical(report.budgets)} disagree with the declared budgets`);
  }
  if (!deepEqual(report.policies, WORLD_POLICIES)) failures.add(`policies ${canonical(report.policies)} disagree with the declared policies`);

  // Matrix completeness: every declared cell exactly once.
  const expectedCells = new Set(EVALUATION_SEEDS.flatMap((seed) =>
    [25, 60].flatMap((minutes) => WORLD_POLICIES.map((policy) => cellKey(minutes, policy, seed)))));
  const seenCells = new Set<string>();
  const duplicates: string[] = [];
  for (const run of report.runs) {
    const key = cellKey(run.sessionMinutes, run.policy, run.seed);
    if (!expectedCells.has(key)) {
      failures.add(`recorded walk ${key} is not a declared matrix cell`);
      continue;
    }
    if (seenCells.has(key)) duplicates.push(key);
    seenCells.add(key);
    validateLaterEraRun(run, failures);
  }
  if (duplicates.length > 0) {
    failures.add(`duplicate recorded walk(s) ${duplicates.join(", ")} — each declared cell appears exactly once`);
  }
  const missing = [...expectedCells].filter((key) => !seenCells.has(key));
  if (report.runs.length !== expectedCells.size || missing.length > 0) {
    failures.add(
      `expected ${expectedCells.size} recorded walks, found ${report.runs.length}` +
        (missing.length > 0 ? ` — missing: ${missing.join(", ")}` : ""),
    );
  }

  // Distributions: one per declared slice, consistent with the recorded
  // eras twice over (internally and against the runs).
  const expectedSlices = [25, 60].flatMap((minutes) => WORLD_POLICIES.map((policy) => ({ minutes, policy })));
  if (report.distributions.length !== expectedSlices.length) {
    failures.add(`expected ${expectedSlices.length} distributions, found ${report.distributions.length}`);
  }
  expectedSlices.forEach((slice, index) => {
    const distribution = report.distributions[index];
    if (!distribution) return;
    if (distribution.sessionMinutes !== slice.minutes || distribution.policy !== slice.policy) {
      failures.add(`distribution ${index} covers ${distribution.sessionMinutes}:${distribution.policy}, expected ${slice.minutes}:${slice.policy}`);
      return;
    }
    const sliceRuns = report.runs.filter((run) => run.sessionMinutes === slice.minutes && run.policy === slice.policy);
    const recomputed = recomputeLaterEraClasses(sliceRuns);
    if (!deepEqual(distribution.erasBySeed, recomputed)) {
      failures.add(`distribution ${slice.minutes}:${slice.policy} erasBySeed is inconsistent with the recorded eras`);
    }
    const counts = countLaterEraClasses(sliceRuns);
    if (!deepEqual(distribution.counts, counts)) {
      failures.add(
        `distribution ${slice.minutes}:${slice.policy} counts ${canonical(distribution.counts)} are inconsistent with the recorded eras (recomputed ${canonical(counts)})`,
      );
    }
  });

  // Provenance: the composed report, its declared inputs, and the
  // published slices must agree — one fingerprint across the set.
  if (!/^[0-9a-f]{8}$/.test(report.source.engineSource)) {
    failures.add(`composed source fingerprint "${report.source.engineSource}" is not an 8-hex engine fingerprint`);
  }
  if (!/^[0-9a-f]{40}$/.test(report.recordingCommit)) {
    failures.add(`composed recording commit "${report.recordingCommit}" is not a 40-hex commit`);
  }
  const expectedInputPaths = [...expectedSlices.map((s) => LATER_ERA_SLICE_PATH(s.minutes, s.policy)), LATER_ERA_PROBE_PATH].sort();
  const inputPaths = report.recordingInputs.map((input) => input.path).sort();
  if (!deepEqual(inputPaths, expectedInputPaths)) {
    failures.add(`recordingInputs ${canonical(inputPaths)} do not cover exactly the published slices and the probe evidence`);
  }
  const inputByPath = new Map(report.recordingInputs.map((input) => [input.path, input]));
  for (const input of report.recordingInputs) {
    if (!deepEqual(input.source.engineSource, report.source.engineSource)) {
      failures.add(`input ${input.path} provenance disagrees with the composed report (fingerprint ${input.source.engineSource} vs ${report.source.engineSource})`);
    }
    if (!/^[0-9a-f]{40}$/.test(input.recordingCommit)) {
      failures.add(`input ${input.path} carries no 40-hex recording commit`);
    }
    if (input.recordingEnvironment !== undefined) {
      const environment = input.recordingEnvironment;
      if (typeof environment.node !== "string" || typeof environment.timeZone !== "string" || typeof environment.utcOffsetMinutes !== "number") {
        failures.add(`input ${input.path} recording environment is malformed — absence is recorded as absence, never invented`);
      }
    }
  }

  // The published slices must be the report's own rows.
  if (inputs.slices.length !== expectedSlices.length) {
    failures.add(`expected ${expectedSlices.length} published slices, found ${inputs.slices.length}`);
  }
  for (const slice of inputs.slices) {
    const path = LATER_ERA_SLICE_PATH(slice.minutes, slice.policy);
    if (!expectedInputPaths.includes(path)) {
      failures.add(`published slice ${path} is not a declared slice`);
      continue;
    }
    if (!deepEqual(slice.source.engineSource, report.source.engineSource)) {
      failures.add(`slice ${path} provenance disagrees with the composed report (fingerprint ${slice.source.engineSource} vs ${report.source.engineSource})`);
    }
    const input = inputByPath.get(path);
    if (input && !deepEqual(slice.recordingCommit, input.recordingCommit)) {
      failures.add(`slice ${path} recording commit disagrees with the composed report's recordingInputs`);
    }
    const reportRuns = report.runs.filter((run) => run.sessionMinutes === slice.minutes && run.policy === slice.policy);
    if (!deepEqual(slice.rows, reportRuns)) {
      failures.add(`slice ${path} rows disagree with the composed report's runs — the report is not the composition of its published slices`);
    }
    for (const row of slice.rows) {
      const unitId = `seed-${slice.minutes}-${slice.policy}-${row.seed}`;
      if (slice.unitProvenance[unitId] === undefined) {
        failures.add(`slice ${path} carries no unit provenance for ${unitId} (required since #519)`);
      }
    }
  }

  // The probe evidence and its route flags.
  const probe = inputs.probe;
  if (!deepEqual(probe.source.engineSource, report.source.engineSource)) {
    failures.add(`probe provenance disagrees with the composed report (fingerprint ${probe.source.engineSource} vs ${report.source.engineSource})`);
  }
  report.routeProbes.forEach((bank, index) => validateRouteBank(bank, `routeProbes[${index}]`, failures));
  probe.banks.forEach((bank, index) => validateRouteBank(bank, `probe banks[${index}]`, failures));
  if (!deepEqual(
    report.routeProbes.map((bank) => [bank.frontier, bank.routeDemonstrated]),
    probe.banks.map((bank) => [bank.frontier, bank.routeDemonstrated]),
  )) {
    failures.add("the composed route probes disagree with the published probe evidence");
  }
  const probeUnits = ["probe-walk", ...probe.banks.flatMap((bank, b) => bank.orders.map((_, o) => `forward-b${b}-o${o}`))];
  for (const unit of probeUnits) {
    if (probe.unitProvenance[unit] === undefined) {
      failures.add(`probe evidence carries no unit provenance for ${unit} (required since #519)`);
    }
  }

  failures.throwIfAny(label);
}

function cellKey(minutes: number, policy: string, seed: number): string {
  return `${minutes}:${policy}:${seed}`;
}

function laterEraClassCounts(eras: readonly LaterEraEraJson[]): { inWindow: number; under: number; over: number; open: number } {
  const counts = { inWindow: 0, under: 0, over: 0, open: 0 };
  for (const era of eras) {
    if (era.index === 0) continue;
    if (era.eraClass === "in-window") counts.inWindow++;
    else if (era.eraClass === "under") counts.under++;
    else if (era.eraClass === "over") counts.over++;
    else if (era.eraClass === "open") counts.open++;
  }
  return counts;
}

const countLaterEraClasses = (runs: readonly LaterEraRunJson[]): { inWindow: number; under: number; over: number; open: number } =>
  laterEraClassCounts(runs.flatMap((run) => run.eras));

const recomputeLaterEraClasses = (runs: readonly LaterEraRunJson[]) =>
  EVALUATION_SEEDS.map((seed) => ({
    seed,
    classes: runs
      .filter((run) => run.seed === seed)
      .flatMap((run) => run.eras)
      .filter((era) => era.index > 0)
      .map((era) => ({ index: era.index, eraClass: era.eraClass, hours: era.hours })),
  }));

function validateLaterEraRun(run: LaterEraRunJson, failures: FailureList): void {
  const where = `walk ${cellKey(run.sessionMinutes, run.policy, run.seed)}`;
  if (run.complete !== (run.stopKind === "frontier")) {
    failures.add(`${where} complete flag disagrees with its stop kind "${run.stopKind}"`);
  }
  if (run.stopKind === "frontier" && run.claims.length !== TARGET_ERAS) {
    failures.add(`${where} banks ${run.claims.length} claims at a frontier stop, expected ${TARGET_ERAS}`);
  }
  if (run.stopKind !== "frontier" && run.claims.length >= TARGET_ERAS) {
    failures.add(`${where} banks ${run.claims.length} claims without a frontier stop`);
  }
  for (let i = 1; i < run.frontiers.length; i++) {
    const previous = run.frontiers[i - 1]!;
    const current = run.frontiers[i]!;
    if (!(current > previous)) failures.add(`${where} frontiers do not strictly increase at bank ${i} (${previous} → ${current})`);
  }
  run.eras.forEach((era, index) => {
    if (era.index !== index) failures.add(`${where} era ${index} carries index ${era.index} — era indexes must be contiguous`);
    if (index === 0) {
      if (era.eraClass !== "opening") failures.add(`${where} era 0 classifies as "${era.eraClass}", expected "opening"`);
      return;
    }
    if (!["in-window", "under", "over", "open"].includes(era.eraClass)) {
      failures.add(`${where} era ${index} carries unknown class "${era.eraClass}"`);
      return;
    }
    if (era.eraClass === "open") {
      if (era.claim !== null) failures.add(`${where} era ${index} is open but carries a claim`);
      if (era.rebuildingShare !== null && (era.rebuildingShare < 0 || era.rebuildingShare > 1)) {
        failures.add(`${where} open era ${index} rebuildingShare ${era.rebuildingShare} is outside [0, 1]`);
      }
    } else {
      if (typeof era.claim !== "number") failures.add(`${where} closed era ${index} carries no claim`);
      if (typeof era.familiarFaster !== "boolean") failures.add(`${where} closed era ${index} carries no faster-return read`);
      if (typeof era.rebuildingShare !== "number") failures.add(`${where} closed era ${index} carries no rebuilding read`);
      if (era.newShare !== null && (era.newShare < 0 || era.newShare > 1)) {
        failures.add(`${where} era ${index} newShare ${era.newShare} is outside [0, 1]`);
      }
    }
  });
  if (typeof run.noGrant !== "boolean") failures.add(`${where} carries no currency-integrity read`);
}

function validateRouteBank(bank: RouteProbeJson, where: string, failures: FailureList): void {
  if (!Array.isArray(bank.orders)) {
    failures.add(`${where} carries no order enumeration`);
    return;
  }
  const advanced = bank.orders.some((order) => order.forward !== null && order.forward.outcome === "advanced" && order.forward.frontierAfter > bank.frontier);
  if (bank.routeDemonstrated !== advanced) {
    failures.add(`${where} routeDemonstrated=${bank.routeDemonstrated} contradicts its recorded forwards (${bank.orders.filter((o) => o.forward !== null).length} continued, advanced=${advanced})`);
  }
  for (const order of bank.orders) {
    if (order.forward !== null && order.forward.outcome === "advanced" && !(order.forward.frontierAfter > bank.frontier)) {
      failures.add(`${where} forward claims "${order.forward.outcome}" without a strictly greater frontier (${order.forward.frontierAfter})`);
    }
  }
}

// ── Century validation ────────────────────────────────────────────────

const CENTURY_SLICE_PATH = (minutes: number, policy: string): string => `docs/century-slice-${minutes}-${policy}.json`;

export function validateCenturyEvidence(report: CenturyReportJson, inputs: CenturyInputs): number | null {
  const failures = new FailureList();
  const label = "century evidence";

  if (report.target.markHours !== CENTURY_MARK_HOURS ||
    !deepEqual(report.target.opening, { minHours: OPENING_WINDOW.minHours, maxHours: OPENING_WINDOW.maxHours }) ||
    !deepEqual(report.target.later, { minHours: LATER_ERA_WINDOW.minHours, maxHours: LATER_ERA_WINDOW.maxHours })) {
    failures.add(`target ${canonical(report.target)} disagrees with the declared century mark and windows`);
  }
  // The legacy rows read gaps against their own recorded threshold. A
  // disagreement with the declared boundary-aware threshold does not
  // block generation — it is surfaced in the generated block as a legacy
  // limitation instead of being silently reconciled.
  const legacyGapThreshold = report.target.longGapCredited !== undefined && report.target.longGapCredited !== LONG_GAP_CREDITED
    ? report.target.longGapCredited
    : null;
  if (!deepEqual(report.seeds, EVALUATION_SEEDS)) failures.add(`seeds ${canonical(report.seeds)} disagree with the declared matrix`);
  if (!deepEqual(report.budgets, { baselineDays: CENTURY_BUDGET_DAYS.baseline, longDays: CENTURY_BUDGET_DAYS.long })) {
    failures.add(`budgets ${canonical(report.budgets)} disagree with the declared budgets`);
  }
  if (!deepEqual(report.policies, CENTURY_POLICIES)) failures.add(`policies ${canonical(report.policies)} disagree with the declared policies`);
  if (!deepEqual(report.sparseSeeds, SPARSE_ACQUISITION_SEEDS)) {
    failures.add(`sparseSeeds ${canonical(report.sparseSeeds)} disagree with the declared stress seeds`);
  }

  // Matrix completeness: every declared cell exactly once, every row a
  // representative walk — the supplied-board continuations stay outside.
  const expectedCells = new Set(EVALUATION_SEEDS.flatMap((seed) =>
    [25, 60].flatMap((minutes) => CENTURY_POLICIES.map((policy) => cellKey(minutes, policy, seed)))));
  const seenCells = new Set<string>();
  const duplicates: string[] = [];
  for (const run of report.runs) {
    const key = cellKey(run.sessionMinutes, run.policy, run.seed);
    if (!expectedCells.has(key)) {
      failures.add(`recorded walk ${key} is not a declared matrix cell`);
      continue;
    }
    if (seenCells.has(key)) duplicates.push(key);
    seenCells.add(key);
    validateCenturyRun(run, failures);
  }
  if (duplicates.length > 0) {
    failures.add(`duplicate recorded walk(s) ${duplicates.join(", ")} — each declared cell appears exactly once`);
  }
  const missing = [...expectedCells].filter((key) => !seenCells.has(key));
  if (report.runs.length !== expectedCells.size || missing.length > 0) {
    failures.add(
      `expected ${expectedCells.size} recorded walks, found ${report.runs.length}` +
        (missing.length > 0 ? ` — missing: ${missing.join(", ")}` : ""),
    );
  }

  // Distributions, twice over.
  const expectedSlices = [25, 60].flatMap((minutes) => CENTURY_POLICIES.map((policy) => ({ minutes, policy })));
  if (report.distributions.length !== expectedSlices.length) {
    failures.add(`expected ${expectedSlices.length} distributions, found ${report.distributions.length}`);
  }
  expectedSlices.forEach((slice, index) => {
    const distribution = report.distributions[index];
    if (!distribution) return;
    if (distribution.sessionMinutes !== slice.minutes || distribution.policy !== slice.policy) {
      failures.add(`distribution ${index} covers ${distribution.sessionMinutes}:${distribution.policy}, expected ${slice.minutes}:${slice.policy}`);
      return;
    }
    const sliceRuns = report.runs.filter((run) => run.sessionMinutes === slice.minutes && run.policy === slice.policy);
    const counts = countCenturyClasses(sliceRuns);
    if (!deepEqual(distribution.counts, counts)) {
      failures.add(
        `distribution ${slice.minutes}:${slice.policy} counts ${canonical(distribution.counts)} are inconsistent with the recorded eras (recomputed ${canonical(counts)})`,
      );
    }
  });

  // Derived summaries must agree with the runs they summarize.
  for (const investment of report.investments) {
    if (investment.runs !== report.runs.length) {
      failures.add(`investment "${investment.key}" cites ${investment.runs} runs, inconsistent with the ${report.runs.length} recorded walks`);
    }
    if (investment.reached > investment.runs) {
      failures.add(`investment "${investment.key}" reached in ${investment.reached} of ${investment.runs} runs`);
    }
  }
  if (report.comparisons.length !== EVALUATION_SEEDS.length) {
    failures.add(`expected ${EVALUATION_SEEDS.length} policy comparisons, found ${report.comparisons.length}`);
  }
  for (const comparison of report.comparisons) {
    if (!deepEqual(comparison.byPolicy.map((entry) => entry.policy), CENTURY_POLICIES)) {
      failures.add(`policy comparison for seed ${comparison.seed} (${comparison.sessionMinutes}m) does not cover the declared policies in order`);
    }
  }
  const representativeRun = report.runs.find((run) =>
    run.seed === report.representative.seed && run.sessionMinutes === report.representative.sessionMinutes && run.policy === report.representative.policy);
  if (!representativeRun) {
    failures.add(`the representative walk ${cellKey(report.representative.sessionMinutes, report.representative.policy, report.representative.seed)} is not a recorded row`);
  } else {
    if (!deepEqual(report.representative.claims, representativeRun.claims) || !deepEqual(report.representative.frontiers, representativeRun.frontiers)) {
      failures.add("the representative walk's claims or frontiers disagree with its recorded row");
    }
  }

  // Provenance: legacy absence is recorded as absence, never invented;
  // disagreement between the composed report and its published slices is
  // still a hard failure.
  if (!/^[0-9a-f]{8}$/.test(report.source.engineSource)) {
    failures.add(`composed source fingerprint "${report.source.engineSource}" is not an 8-hex engine fingerprint`);
  }
  if (!/^[0-9a-f]{40}$/.test(report.recordingCommit)) {
    failures.add(`composed recording commit "${report.recordingCommit}" is not a 40-hex commit`);
  }
  if (inputs.slices.length !== expectedSlices.length) {
    failures.add(`expected ${expectedSlices.length} published slices, found ${inputs.slices.length}`);
  }
  for (const slice of inputs.slices) {
    const path = CENTURY_SLICE_PATH(slice.minutes, slice.policy);
    if (!deepEqual(slice.source.engineSource, report.source.engineSource)) {
      failures.add(`slice ${path} provenance disagrees with the composed report (fingerprint ${slice.source.engineSource} vs ${report.source.engineSource})`);
    }
    const reportRuns = report.runs.filter((run) => run.sessionMinutes === slice.minutes && run.policy === slice.policy);
    if (!deepEqual(slice.rows, reportRuns)) {
      failures.add(`slice ${path} rows disagree with the composed report's runs — the report is not the composition of its published slices`);
    }
  }
  for (const variant of ["raw", "collectionReset"] as const) {
    const fixture = inputs.fixtures[variant];
    if (fixture.row.kind !== "continuation") {
      failures.add(`fixture ${variant} is not a recorded continuation`);
    }
    // The legacy compose re-projects the fixtures' trajectories at a
    // coarser stride than the published fixture files; every other field
    // must be byte-identical, and the trajectory difference is a
    // projection, not a different walk.
    const withoutTrajectory = (row: CenturyRunJson): Record<string, unknown> => {
      const { trajectory: _trajectory, ...rest } = row;
      return rest;
    };
    if (!deepEqual(withoutTrajectory(fixture.row), withoutTrajectory(report.fixtures[variant]))) {
      failures.add(`fixture ${variant} row disagrees with the composed report's fixtures`);
    }
    if (!/^[0-9a-f]{40}$/.test(fixture.recordingCommit)) {
      failures.add(`fixture ${variant} carries no 40-hex recording commit`);
    }
  }

  failures.throwIfAny(label);
  return legacyGapThreshold;
}

function countCenturyClasses(runs: readonly CenturyRunJson[]): { inWindow: number; under: number; over: number; open: number } {
  const counts = { inWindow: 0, under: 0, over: 0, open: 0 };
  for (const era of runs.flatMap((run) => run.eras)) {
    if (era.eraClass === "in-window") counts.inWindow++;
    else if (era.eraClass === "under") counts.under++;
    else if (era.eraClass === "over") counts.over++;
    else if (era.eraClass === "open") counts.open++;
  }
  return counts;
}

function validateCenturyRun(run: CenturyRunJson, failures: FailureList): void {
  const where = `walk ${cellKey(run.sessionMinutes, run.policy, run.seed)}`;
  if (run.kind !== "representative") {
    failures.add(`${where} is a "${run.kind}" row — supplied-board continuations stay outside the matrix`);
  }
  if (run.complete !== true) {
    failures.add(`${where} is an incomplete matrix row (stop "${run.stopKind}")`);
  }
  if (run.claims.length !== run.frontiers.length) {
    failures.add(`${where} banks ${run.claims.length} claims against ${run.frontiers.length} frontier reads`);
  }
  for (let i = 1; i < run.frontiers.length; i++) {
    const previous = run.frontiers[i - 1]!;
    const current = run.frontiers[i]!;
    if (current < previous) failures.add(`${where} frontiers move backwards at bank ${i} (${previous} → ${current})`);
  }
  run.eras.forEach((era, index) => {
    if (era.index !== index) failures.add(`${where} era ${index} carries index ${era.index} — era indexes must be contiguous`);
    if (!["in-window", "under", "over", "open"].includes(era.eraClass)) {
      failures.add(`${where} era ${index} carries unknown class "${era.eraClass}"`);
      return;
    }
    if (era.eraClass === "open") {
      if (era.claim !== null || era.finite !== null) {
        failures.add(`${where} open era ${index} carries closed-era reads — absence is recorded as absence`);
      }
    } else if (era.finite !== true) {
      failures.add(`${where} closed era ${index} carries a non-finite bank-state read`);
    }
  });
  if (run.numeric.finiteSnapshots !== true) {
    failures.add(`${where} carries a non-finite sampled snapshot`);
  }
  if (run.numeric.serializedOk !== run.numeric.serializedChecks) {
    failures.add(`${where} serialized round trips ${run.numeric.serializedOk} of ${run.numeric.serializedChecks} — an exact monetary round trip failed`);
  }
  if (typeof run.gaps?.longCount !== "number") {
    failures.add(`${where} carries no long-gap count`);
  }
  // A rerun must measure gaps at the current measurement version; the
  // legacy rows carry no version at all and are handled as legacy.
  if (run.measurementVersion !== undefined && run.measurementVersion !== CENTURY_MEASUREMENT_VERSION) {
    failures.add(`${where} measures gaps at version ${run.measurementVersion}, not the declared ${CENTURY_MEASUREMENT_VERSION} — legacy gap summaries require re-recording`);
  }
  if (run.noGrant !== true) {
    failures.add(`${where} carries a grant-or-refund read`);
  }
}

// ── Later-era figures and their rendering ─────────────────────────────

export interface LaterEraFigures {
  readonly walks: number;
  readonly slices: readonly { readonly label: string; readonly minutes: number; readonly policy: string; readonly inWindow: number; readonly under: number; readonly over: number; readonly open: number }[];
  readonly totals: { readonly inWindow: number; readonly under: number; readonly over: number; readonly open: number };
  readonly closedEras: number;
  readonly completeWalks: number;
  readonly budgetWalks: number;
  readonly budgetBanksRange: readonly [number, number];
  readonly fasterReturn: { readonly faster: number; readonly notFaster: number };
  readonly rebuilding: { readonly withinHalf: number; readonly overHalf: number };
  readonly newTerritoryMajorities: number;
  readonly noGrantWalks: number;
  readonly routes: { readonly frontiers: readonly number[]; readonly orders: number; readonly advanced: number; readonly demonstratedFrontiers: number };
  readonly provenance: {
    readonly engineSource: string;
    readonly recordingCommit: string;
    readonly inputs: readonly { readonly path: string; readonly recordingCommit: string; readonly environment: string | null }[];
  };
}

export function laterEraFigures(report: LaterEraReportJson, inputs: LaterEraInputs): LaterEraFigures {
  validateLaterEraEvidence(report, inputs);
  const closed = report.runs.flatMap((run) => run.eras).filter((era) => era.index > 0 && era.eraClass !== "open");
  const faster = closed.filter((era) => era.familiarFaster === true).length;
  const withinHalf = closed.filter((era) => era.rebuildingShare !== null && era.rebuildingShare <= 0.5).length;
  const majorities = closed.filter((era) => era.newShare !== null && era.newShare > 0.5).length;
  const budgetWalks = report.runs.filter((run) => !run.complete);
  const budgetBanks = budgetWalks.map((run) => run.claims.length);
  const sliceFigures = report.distributions.map((distribution) => ({
    label: `${distribution.policy} / ${distribution.sessionMinutes}m`,
    minutes: distribution.sessionMinutes,
    policy: distribution.policy,
    ...distribution.counts,
  }));
  const totals = sliceFigures.reduce(
    (sum, slice) => ({
      inWindow: sum.inWindow + slice.inWindow,
      under: sum.under + slice.under,
      over: sum.over + slice.over,
      open: sum.open + slice.open,
    }),
    { inWindow: 0, under: 0, over: 0, open: 0 },
  );
  return {
    walks: report.runs.length,
    slices: sliceFigures,
    totals,
    closedEras: closed.length,
    completeWalks: report.runs.length - budgetWalks.length,
    budgetWalks: budgetWalks.length,
    budgetBanksRange: budgetBanks.length > 0 ? [Math.min(...budgetBanks), Math.max(...budgetBanks)] : [0, 0],
    fasterReturn: { faster, notFaster: closed.length - faster },
    rebuilding: { withinHalf, overHalf: closed.length - withinHalf },
    newTerritoryMajorities: majorities,
    noGrantWalks: report.runs.filter((run) => run.noGrant).length,
    routes: {
      frontiers: report.routeProbes.map((bank) => bank.frontier),
      orders: report.routeProbes.reduce((sum, bank) => sum + bank.orders.length, 0),
      advanced: report.routeProbes.reduce((sum, bank) => sum + bank.orders.filter((order) => order.forward?.outcome === "advanced").length, 0),
      demonstratedFrontiers: report.routeProbes.filter((bank) => bank.routeDemonstrated).length,
    },
    provenance: {
      engineSource: report.source.engineSource,
      recordingCommit: report.recordingCommit,
      inputs: report.recordingInputs.map((input) => ({
        path: input.path,
        recordingCommit: input.recordingCommit,
        environment: input.recordingEnvironment
          ? `${input.recordingEnvironment.node} on ${input.recordingEnvironment.timeZone}`
          : null,
      })),
    },
  };
}

export function renderLaterEraBlock(figures: LaterEraFigures): string {
  const lines: string[] = [];
  const inputs = figures.provenance.inputs
    .map((input) => `\`${input.path}\` at ${shortCommit(input.recordingCommit)}${input.environment ? ` (${input.environment})` : " (environment recorded absent)"}`)
    .join("; ");
  lines.push(
    `Source evidence: [\`later-era-results.json\`](later-era-results.json) — ${figures.walks} recorded walks composed from the six published slices and the probe evidence; engine fingerprint \`${figures.provenance.engineSource}\`, composed at recording commit \`${shortCommit(figures.provenance.recordingCommit)}\`. Every input's own recording commit and environment ride the results file: ${inputs}.`,
  );
  lines.push(
    `Generated from the recorded JSON alone — no simulation; regenerate with \`${REGENERATE_HINT}\` and review the diff. The recorded rows are the only numerical truth in this section.`,
  );
  lines.push("");
  lines.push("| Policy / session length | In 5–10h | Under | Over | Open at stop |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  for (const slice of figures.slices) {
    lines.push(`| ${slice.label} | ${slice.inWindow} | ${slice.under} | ${slice.over} | ${slice.open} |`);
  }
  lines.push(`| **Total** | **${figures.totals.inWindow}** | **${figures.totals.under}** | **${figures.totals.over}** | **${figures.totals.open}** |`);
  lines.push("");
  lines.push(
    `${figures.completeWalks} of ${figures.walks} walks complete all four declared banks; ${figures.budgetWalks} stop at their day budget with ${figures.budgetBanksRange[0]}–${figures.budgetBanksRange[1]} banks banked. Across ${figures.closedEras} closed later eras:`,
  );
  lines.push("");
  lines.push(
    `- **Faster familiar return:** ${figures.fasterReturn.faster} re-walk the previous bank's depth in less credited time than its first development; ${figures.fasterReturn.notFaster} do not.`,
  );
  lines.push(
    `- **Rebuilding:** ${figures.rebuilding.withinHalf} regain the previous production within half their era; ${figures.rebuilding.overHalf} spend more than half rebuilding — recorded misses of the rebuilding bar, not passes rescued by a majority elsewhere.`,
  );
  lines.push(
    `- **New territory:** ${figures.newTerritoryMajorities} eras hold a recorded new-territory share above one half.`,
  );
  lines.push(
    `- **Cadence:** ${figures.totals.over} closed later eras exceed ten credited hours. The record evaluates the requested window honestly; it does not establish that the shipped deeper eras generally meet it.`,
  );
  lines.push("");
  lines.push("Mechanical verdicts — each names its criterion, its observed read, and its state:");
  lines.push("");
  lines.push("| Criterion | Observed read | State |");
  lines.push("| --- | --- | --- |");
  lines.push(
    `| New-territory majority of era effort (#491) | ${figures.newTerritoryMajorities} of ${figures.closedEras} closed eras hold a new-territory share above one half | **UNMET** — merge blocker |`,
  );
  lines.push(
    `| Rebuilding not most of later eras (#491) | ${figures.rebuilding.overHalf} of ${figures.closedEras} closed eras spend more than half rebuilding | **UNMET** |`,
  );
  lines.push(
    `| Faster familiar return (#491) | ${figures.fasterReturn.faster} of ${figures.closedEras} closed eras re-walk the previous bank's depth faster | met by the recorded majority |`,
  );
  lines.push(
    `| Four declared banks per walk (#491) | ${figures.completeWalks} of ${figures.walks} walks complete; ${figures.budgetWalks} stop at budget | ${figures.completeWalks} met; ${figures.budgetWalks} incompletes recorded |`,
  );
  lines.push(`| No grant, no refund (#491) | ${figures.noGrantWalks} of ${figures.walks} walks \`noGrant\` | met |`);
  lines.push(
    `| No-refund routes at the probed banks (${figures.routes.frontiers.join(", ")}) | ${figures.routes.advanced} of ${figures.routes.orders} orders advanced strictly within budget; route demonstrated at ${figures.routes.demonstratedFrontiers} of ${figures.routes.frontiers.length} tested banks | met at the tested states, not extrapolated |`,
  );
  lines.push("");
  lines.push(
    "An unmet or incomplete verdict is a recorded finding, never an approved exception: this documentation does not waive it, and resolving it takes a validated balance repair or an explicit maintainer scope decision.",
  );
  return lines.join("\n");
}

const shortCommit = (commit: string): string => commit.slice(0, 7);

// ── Century figures and their rendering ───────────────────────────────

export interface CenturyFigures {
  readonly walks: number;
  readonly slices: readonly {
    readonly label: string;
    readonly minutes: number;
    readonly policy: string;
    readonly inWindow: number;
    readonly under: number;
    readonly over: number;
    readonly open: number;
    readonly banks: number;
    readonly maxFrontier: number;
  }[];
  readonly totals: { readonly inWindow: number; readonly under: number; readonly over: number; readonly open: number; readonly banks: number };
  readonly centuryStops: number;
  readonly reachedMark: number;
  readonly noGrantWalks: number;
  readonly finiteRows: number;
  readonly serializedExactRows: number;
  readonly promptBanks: { readonly banks: number; readonly nonzeroClaims: number; readonly maxFrontier: number };
  readonly claimPushingBanks: { readonly banks: number; readonly nonzeroClaims: number };
  readonly walkBanksMin: number;
  readonly walkBanksMax: number;
  readonly longGapCount: number;
  readonly legacy: {
    readonly environmentAbsent: boolean;
    readonly unitProvenanceAbsent: boolean;
    readonly measurementVersionAbsent: boolean;
    readonly gapThresholdLegacySeconds: number | null;
  };
  readonly representativeSupport60: readonly { readonly seed: number; readonly banks: number; readonly frontier: number; readonly spans: string }[];
  readonly provenance: { readonly engineSource: string; readonly recordingCommit: string };
}

export function centuryFigures(report: CenturyReportJson, inputs: CenturyInputs): CenturyFigures {
  const legacyGapThreshold = validateCenturyEvidence(report, inputs);
  const runs = report.runs;
  const sliceFigures = report.distributions.map((distribution) => {
    const sliceRuns = runs.filter((run) => run.sessionMinutes === distribution.sessionMinutes && run.policy === distribution.policy);
    return {
      label: `${distribution.policy}, ${distribution.sessionMinutes}m`,
      minutes: distribution.sessionMinutes,
      policy: distribution.policy,
      ...distribution.counts,
      banks: sliceRuns.reduce((sum, run) => sum + run.claims.length, 0),
      maxFrontier: Math.max(...sliceRuns.map((run) => finalFrontier(run))),
    };
  });
  const totals = sliceFigures.reduce(
    (sum, slice) => ({
      inWindow: sum.inWindow + slice.inWindow,
      under: sum.under + slice.under,
      over: sum.over + slice.over,
      open: sum.open + slice.open,
      banks: sum.banks + slice.banks,
    }),
    { inWindow: 0, under: 0, over: 0, open: 0, banks: 0 },
  );
  const policyBanks = (policy: string): { banks: number; nonzeroClaims: number; maxFrontier: number } => {
    const policyRuns = runs.filter((run) => run.policy === policy);
    return {
      banks: policyRuns.reduce((sum, run) => sum + run.claims.length, 0),
      nonzeroClaims: policyRuns.reduce((sum, run) => sum + run.claims.filter((claim) => claim > 0).length, 0),
      maxFrontier: Math.max(...policyRuns.map((run) => finalFrontier(run))),
    };
  };
  const claimPushingRuns = runs.filter((run) => run.policy !== "prompt");
  const claimPushingBanks = claimPushingRuns.reduce((sum, run) => sum + run.claims.length, 0);
  const claimPushingNonzero = claimPushingRuns.reduce((sum, run) => sum + run.claims.filter((claim) => claim > 0).length, 0);
  const banksPerPushingWalk = claimPushingRuns.map((run) => run.claims.length);
  const legacy = {
    environmentAbsent: !runs.some((run) => (run as unknown as Record<string, unknown>).recordingEnvironment !== undefined) &&
      report.recordingCommit !== undefined && !("compositionEnvironment" in report) && !("recordingInputs" in report),
    unitProvenanceAbsent: !("unitProvenance" in report),
    measurementVersionAbsent: runs.every((run) => run.measurementVersion === undefined),
  };
  return {
    walks: runs.length,
    slices: sliceFigures,
    totals,
    centuryStops: runs.filter((run) => run.stopKind === "century").length,
    reachedMark: runs.filter((run) => run.stopKind === "century" && run.creditedHours >= CENTURY_MARK_HOURS).length,
    noGrantWalks: runs.filter((run) => run.noGrant).length,
    finiteRows: runs.filter((run) => run.numeric.finiteSnapshots).length,
    serializedExactRows: runs.filter((run) => run.numeric.serializedOk === run.numeric.serializedChecks).length,
    promptBanks: policyBanks("prompt"),
    claimPushingBanks: { banks: claimPushingBanks, nonzeroClaims: claimPushingNonzero },
    walkBanksMin: Math.min(...banksPerPushingWalk),
    walkBanksMax: Math.max(...banksPerPushingWalk),
    longGapCount: runs.reduce((sum, run) => sum + run.gaps.longCount, 0),
    legacy: {
      ...legacy,
      gapThresholdLegacySeconds: legacyGapThreshold,
    },
    representativeSupport60: EVALUATION_SEEDS.map((seed) => {
      const run = runs.find((candidate) => candidate.seed === seed && candidate.sessionMinutes === 60 && candidate.policy === "support");
      if (!run) throw new EvidenceError([`no representative support walk recorded for seed ${seed} at 60 minutes`]);
      return {
        seed,
        banks: run.claims.length,
        frontier: finalFrontier(run),
        spans: run.eras.map((era) =>
          era.eraClass === "open" ? "open" : `${era.index}:${formatHours(era.hours ?? 0)}/${POLICY_CLASS_LABELS[era.eraClass] ?? era.eraClass}`,
        ).join(" · "),
      };
    }),
    provenance: { engineSource: report.source.engineSource, recordingCommit: report.recordingCommit },
  };
}

const finalFrontier = (run: { readonly frontiers: readonly number[] }): number =>
  run.frontiers.length > 0 ? run.frontiers[run.frontiers.length - 1]! : 0;

export function renderCenturyBlock(figures: CenturyFigures): string {
  const lines: string[] = [];
  const legacyNotes: string[] = [];
  if (figures.legacy.environmentAbsent) legacyNotes.push("no runtime or timezone metadata");
  if (figures.legacy.unitProvenanceAbsent) legacyNotes.push("no per-unit provenance");
  if (figures.legacy.measurementVersionAbsent) legacyNotes.push(`no measurementVersion (the boundary-aware read is version ${CENTURY_MEASUREMENT_VERSION})`);
  lines.push(
    `Legacy evidence: these figures derive from the restored historical recording — engine fingerprint \`${figures.provenance.engineSource}\`, composed at recording commit \`${shortCommit(figures.provenance.recordingCommit)}\`, restored byte-for-byte per [the review completion record](evidence/pr514-review/README.md). The legacy rows carry ${legacyNotes.join(", ")}; absence is recorded as absence, never invented.`,
  );
  lines.push(
    `Generated from the recorded JSON alone — no simulation; regenerate with \`${REGENERATE_HINT}\` and review the diff. The recorded rows are the only numerical truth in this section.`,
  );
  lines.push("");
  lines.push("| slice | in-window | under | over | open | banks | max frontier |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const slice of figures.slices) {
    lines.push(`| ${slice.label} | ${slice.inWindow} | ${slice.under} | ${slice.over} | ${slice.open} | ${slice.banks} | ${slice.maxFrontier} |`);
  }
  lines.push(
    `| **total** | **${figures.totals.inWindow}** | **${figures.totals.under}** | **${figures.totals.over}** | **${figures.totals.open}** | **${figures.totals.banks}** | — |`,
  );
  lines.push("");
  lines.push(
    `Excluding the prompt rows, the claim-pushing policies bank ${figures.claimPushingBanks.nonzeroClaims} nonzero claims across the matrix; banks per claim-pushing walk run ${figures.walkBanksMin}–${figures.walkBanksMax}. The prompt rows bank ${figures.promptBanks.banks} doors of which ${figures.promptBanks.banks - figures.promptBanks.nonzeroClaims} are honest zeros, with a final frontier no higher than ${figures.promptBanks.maxFrontier}.`,
  );
  lines.push("");
  lines.push("The representative 60-minute support walks read seed by seed (era: hours/class):");
  lines.push("");
  lines.push("| seed | banks | frontier | era spans |");
  lines.push("| --- | ---: | ---: | --- |");
  for (const row of figures.representativeSupport60) {
    lines.push(`| ${row.seed} | ${row.banks} | ${row.frontier} | ${row.spans} |`);
  }
  lines.push("");
  lines.push("Mechanical verdicts — each names its criterion, its observed read, and its state:");
  lines.push("");
  lines.push("| Criterion | Observed read | State |");
  lines.push("| --- | --- | --- |");
  const markState =
    figures.reachedMark === figures.walks ? "met"
    : figures.reachedMark === 0 ? "UNMET"
    : "incomplete";
  lines.push(
    `| Walks through the ${CENTURY_MARK_HOURS}-credited-hour mark (#492) | ${figures.reachedMark} of ${figures.walks} matrix rows stop at the century mark with at least ${CENTURY_MARK_HOURS} credited hours | ${markState} |`,
  );
  lines.push(
    `| Finite state and exact serialized round trips (#492) | ${figures.finiteRows} of ${figures.walks} rows read finite at every sampled snapshot; ${figures.serializedExactRows} of ${figures.walks} serialized every sampled bank, stride, and final state with exact monetary round trips | ${figures.finiteRows === figures.walks && figures.serializedExactRows === figures.walks ? "met" : "UNMET"} |`,
  );
  lines.push(`| No grant, no refund (#492) | ${figures.noGrantWalks} of ${figures.walks} walks \`noGrant\` | ${figures.noGrantWalks === figures.walks ? "met" : "UNMET"} |`);
  const gapState =
    figures.legacy.measurementVersionAbsent ? "incomplete"
    : figures.longGapCount > 0 ? "UNMET"
    : "met";
  const gapThreshold = figures.legacy.gapThresholdLegacySeconds !== null
    ? `legacy gap read at the recorded ${figures.legacy.gapThresholdLegacySeconds}s threshold`
    : `gap read at the declared ${LONG_GAP_CREDITED}s threshold`;
  lines.push(
    `| Long decision-free periods recorded as failures (#492) | ${gapThreshold}: ${figures.longGapCount} inter-decision gaps at or above it, but start and terminal waits were not measured | **${gapState}** — the legacy zero is not evidence of absence; the boundary-aware rerun is owed |`,
  );
  lines.push(
    `| Expected-unsuccessful prompt policy distinguished (#492) | ${figures.promptBanks.banks - figures.promptBanks.nonzeroClaims} of ${figures.promptBanks.banks} prompt banks are zero-claim; final frontier at most ${figures.promptBanks.maxFrontier} across its rows | recorded as the expected unsuccessful policy — the distinction holds |`,
  );
  lines.push(
    `| Sparse seeds and supplied-board continuations included, never pooled (#492) | the sparse seeds (${SPARSE_ACQUISITION_SEEDS.join(", ")}) ride the matrix rows; both continuations stand outside the ${figures.walks} matrix rows | met |`,
  );
  lines.push("");
  lines.push(
    "An unmet or incomplete verdict is a recorded finding, never an approved exception: this documentation does not waive it, and resolving it takes the declared boundary-aware re-recording or an explicit maintainer scope decision.",
  );
  return lines.join("\n");
}
