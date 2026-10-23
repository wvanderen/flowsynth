import { deepFreeze, type PlaythroughRecord } from "./playthrough";

// The run artifact (issue #473, parent stories 34–36): the versioned file
// format that owns persisted provenance and results. One artifact carries
// one recorded run whole — its recipe, its source provenance, its
// trajectory, the action record's decisions and reasons, its exact
// historical snapshots, and the intervention/modified status — complete
// and incomplete runs alike, checkpoint halts included. The artifact is
// the only thing that crosses a session or a checkout: importing inspects
// the carried evidence as it stands, never re-executing or reinterpreting
// it against the current engine, so a record from an older source keeps
// its own provenance and an ordinary save never meets this format (the
// two are marked apart — an artifact is not a save, and a save is not an
// artifact; neither importer accepts the other). Malformed payloads and
// unsupported versions are rejected with named errors, never silently
// interpreted (story 32's clarity rule at the file boundary).

// The artifact format's own version. A behavior-affecting change to what
// an artifact must carry bumps it; older versions read here after that
// bump are rejected by name until a migration is authored — no silent
// chain, ADR-0017's boundary pattern.
export const PLAYTHROUGH_ARTIFACT_VERSION = 1;

// The format marker, distinct from the ordinary save's `app: "flowsynth"`:
// a save pasted into the run importer is not an artifact, and an artifact
// pasted into the save importer is not a save.
export const PLAYTHROUGH_ARTIFACT_FORMAT = "flowsynth-playthrough";

// One interactive intervention as the artifact carries it (story 33's
// persisted form): what was done beyond the recipe, when, and the
// engine's own outcome — structurally the app's DevIntervention, read
// here without an upward import.
export interface PlaythroughArtifactIntervention {
  readonly at: number;
  readonly label: string;
  readonly ok: boolean;
  readonly reason?: string;
}

export interface PlaythroughArtifactInput {
  readonly record: PlaythroughRecord;
  // The intervention/modified status the artifact preserves verbatim
  // (issue #473): a pure walk exports unmodified with no interventions —
  // its evidence cannot have been altered — while a checkpoint preset's
  // record exported from a modified install carries the install's
  // interventions and the mark, so altered evidence can never masquerade
  // as baseline (story 33).
  readonly modified?: boolean;
  readonly interventions?: readonly PlaythroughArtifactIntervention[];
  readonly exportedAt?: number;
}

export interface PlaythroughArtifact {
  readonly format: typeof PLAYTHROUGH_ARTIFACT_FORMAT;
  readonly version: number;
  readonly exportedAt: number;
  // Denormalized for discovery: the run's identity, readable without
  // walking the record. Import verifies it against the record.
  readonly runId: string;
  readonly record: PlaythroughRecord;
  readonly modified: boolean;
  readonly interventions: readonly PlaythroughArtifactIntervention[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// The export: the record as the run produced it plus the carried status,
// stamped. Nothing here trims, normalizes, or rewrites — the artifact is
// the evidence, byte-faithful where JSON allows.
export function exportPlaythroughArtifact(input: PlaythroughArtifactInput): string {
  const record = input.record;
  if (!record || typeof record.runId !== "string" || !record.runId) {
    throw new Error("Run artifact: export needs a recorded run — nothing stands selected.");
  }
  const artifact: PlaythroughArtifact = {
    format: PLAYTHROUGH_ARTIFACT_FORMAT,
    version: PLAYTHROUGH_ARTIFACT_VERSION,
    exportedAt: input.exportedAt ?? Date.now(),
    runId: record.runId,
    record,
    modified: input.modified === true,
    interventions: input.interventions ?? [],
  };
  return JSON.stringify(artifact);
}

export type PlaythroughArtifactLoad =
  | { ok: true; artifact: PlaythroughArtifact }
  | { ok: false; error: string };

// The import's named rejections, in the order a reader meets them: not
// JSON, not an artifact, unsupported version, incomplete payload. Every
// accepted artifact leaves this function with its recorded states frozen
// whole — the same read-only guarantee a fresh walk's snapshots carry —
// so imported evidence is exactly as safe to inspect as walked evidence.
export function importPlaythroughArtifact(text: string): PlaythroughArtifactLoad {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "The artifact is not valid JSON." };
  }
  if (!isRecord(parsed) || parsed.format !== PLAYTHROUGH_ARTIFACT_FORMAT) {
    return { ok: false, error: "This file is not a FlowSynth run artifact." };
  }
  const version = parsed.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: "The artifact is malformed — its format version is missing." };
  }
  if (version > PLAYTHROUGH_ARTIFACT_VERSION) {
    return {
      ok: false,
      error: `Artifact version ${version} is newer than this build supports (${PLAYTHROUGH_ARTIFACT_VERSION}).`,
    };
  }
  if (version < PLAYTHROUGH_ARTIFACT_VERSION) {
    return {
      ok: false,
      error: `Artifact version ${version} is not supported — this build reads version ${PLAYTHROUGH_ARTIFACT_VERSION}.`,
    };
  }
  if (!Number.isFinite(parsed.exportedAt)) {
    return { ok: false, error: "The artifact is malformed — its export stamp is missing." };
  }
  if (typeof parsed.runId !== "string" || !parsed.runId) {
    return { ok: false, error: "The artifact is malformed — its run id is missing." };
  }
  const record = parsed.record;
  if (!isRecord(record) || typeof record.runId !== "string" || !record.runId) {
    return { ok: false, error: "The artifact is malformed — its run record is missing." };
  }
  if (record.runId !== parsed.runId) {
    return { ok: false, error: "The artifact is malformed — its run id does not match its record." };
  }
  const recipe = record.recipe;
  if (
    !isRecord(recipe) ||
    typeof recipe.scenarioId !== "string" ||
    typeof recipe.policyId !== "string" ||
    typeof recipe.seed !== "number"
  ) {
    return { ok: false, error: "The artifact is malformed — its recipe is missing." };
  }
  const source = record.source;
  if (
    !isRecord(source) ||
    typeof source.engineSource !== "string" ||
    !Number.isFinite(source.saveVersion) ||
    !Number.isFinite(source.runnerVersion)
  ) {
    return { ok: false, error: "The artifact is malformed — its source provenance is missing." };
  }
  if (!Array.isArray(record.events)) {
    return { ok: false, error: "The artifact is malformed — its decision record is missing." };
  }
  if (!Array.isArray(record.trajectory)) {
    return { ok: false, error: "The artifact is malformed — its trajectory is missing." };
  }
  const snapshots = record.snapshots;
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return { ok: false, error: "The artifact is malformed — its historical snapshots are missing." };
  }
  for (const snapshot of snapshots) {
    if (
      !isRecord(snapshot) ||
      !Number.isFinite(snapshot.elapsed) ||
      !Number.isFinite(snapshot.credited) ||
      !isRecord(snapshot.state)
    ) {
      return { ok: false, error: "The artifact is malformed — a historical snapshot is incomplete." };
    }
  }
  if (typeof record.complete !== "boolean" || !isRecord(record.stop) || typeof record.stop.kind !== "string") {
    return { ok: false, error: "The artifact is malformed — its stop status is missing." };
  }
  if (!isRecord(record.state)) {
    return { ok: false, error: "The artifact is malformed — its final state is missing." };
  }
  const modified = parsed.modified;
  if (typeof modified !== "boolean") {
    return { ok: false, error: "The artifact is malformed — its modified status is missing." };
  }
  const interventions = parsed.interventions;
  if (
    !Array.isArray(interventions) ||
    interventions.some((entry) => !isRecord(entry) || typeof entry.label !== "string" || !Number.isFinite(entry.at))
  ) {
    return { ok: false, error: "The artifact is malformed — its intervention record is incomplete." };
  }
  for (const snapshot of snapshots) {
    deepFreeze(snapshot.state);
  }
  deepFreeze(record.state);
  return {
    ok: true,
    artifact: {
      format: PLAYTHROUGH_ARTIFACT_FORMAT,
      version: PLAYTHROUGH_ARTIFACT_VERSION,
      exportedAt: parsed.exportedAt as number,
      runId: parsed.runId,
      record: record as unknown as PlaythroughRecord,
      modified,
      interventions: interventions as PlaythroughArtifactIntervention[],
    },
  };
}

// The artifact's one-line read for notes and terminal receipts: the
// identity, the carried status, and the provenance a reader checks
// against the current engine — never a re-execution verdict.
export function artifactNote(artifact: PlaythroughArtifact): string {
  const status = artifact.modified
    ? `modified — ${artifact.interventions.length} intervention${artifact.interventions.length === 1 ? "" : "s"}`
    : "unmodified";
  return `${artifact.runId} · artifact v${artifact.version} · ${status} · source save v${artifact.record.source.saveVersion}, runner v${artifact.record.source.runnerVersion}, engine ${artifact.record.source.engineSource}`;
}
