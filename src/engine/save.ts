import { createInitialState, openingGrant } from "./state";
import { SAVE_VERSION } from "./constants";
import type { GameState } from "./types";

export interface SaveFile {
  app: "flowsynth";
  version: number;
  savedAt: number;
  state: GameState;
}

export interface LoadResult {
  state?: GameState;
  error?: string;
}

export function serialize(state: GameState, savedAt: number = Date.now()): string {
  const file: SaveFile = { app: "flowsynth", version: SAVE_VERSION, savedAt, state };
  return JSON.stringify(file, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// ADR-0023: the v5 → v6 boundary is a hybrid migration, not a clean cut.
// The life record and lifetime meta carry over — trust-model session
// accounting, the practice log, and the Arete accumulator all read it —
// while the board side resets to the new opening: the balance, purchase
// count, and shelf state were earned under the invalidated formula and
// scaler, and carrying them over would price a restarting player out of the
// new opening. Every player plays the new opening from zero, this time
// with the life record intact.
const PRESERVED_KEYS = [
  "habits",
  "practiceLog",
  "notes",
  "goals",
  "activeHabitId",
  "sessionRecords",
  "achievements",
  "sessionsCompleted",
  "unstructuredSessions",
  "plannedSessionsCompleted",
  "sessionIndex",
  "combinations",
  "muted",
  "notificationAsked",
  "activatedApps",
  "goalCapacityBought",
  "totalEarned",
  "arete",
  "horizonAcknowledged",
] as const satisfies readonly (keyof GameState)[];

// The largest numeric suffix across the preserved life-record ids — one
// lowercase prefix plus the shared counter's number (habits h, notes n,
// goals g, the practice log p).
function preservedMaxId(raw: Record<string, unknown>): number {
  let max = 0;
  for (const key of ["habits", "notes", "goals", "practiceLog"] as const) {
    const list = raw[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const id = isRecord(item) ? item.id : undefined;
      if (typeof id !== "string") continue;
      const match = /^[a-z]+(\d+)$/.exec(id);
      const n = match === null ? 0 : Number(match[1]);
      if (Number.isInteger(n) && n > max) max = n;
    }
  }
  return max;
}

function migrateV5(raw: Record<string, unknown>): GameState {
  const fresh = createInitialState();
  const merged = { ...fresh } as Record<string, unknown>;
  for (const key of PRESERVED_KEYS) {
    const value = raw[key];
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  // The life record shares the one id counter with fresh minting: wind
  // nextId past every preserved id so the migrated state can never mint a
  // duplicate id over the record it just carried over.
  merged.nextId = preservedMaxId(raw) + 1;
  // The mid-flow boundary (ADR-0023): a v5 save captured in flow or paused
  // discards the live session uncredited — the migration lands in upgrade
  // mode on the fresh board, whatever the save's mode said. `session`,
  // `summary`, and the rest of the board side stay at their fresh values,
  // `welcomeAcked` is deleted outright (retired with the Carrier), and
  // `nous` becomes the new opening grant.
  merged.mode = "upgrade";
  merged.nous = openingGrant();
  return merged as unknown as GameState;
}

// ADR-0017's version gate stands (ADR-0023): anything older than v5, and
// any future version, hard-rejects with the start-fresh message. There is
// no migration chain beyond the one hybrid step, no archive, and no import
// path for rejected versions.
export function deserialize(text: string): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: "The save data is not valid JSON." };
  }
  if (!isRecord(parsed) || parsed.app !== "flowsynth" || typeof parsed.version !== "number") {
    return { error: "This file is not a FlowSynth save." };
  }
  if (parsed.version < SAVE_VERSION - 1) {
    return {
      error: `Incompatible older version (save v${parsed.version}, this build is v${SAVE_VERSION}) — starting fresh.`,
    };
  }
  if (parsed.version > SAVE_VERSION) {
    return { error: `Save version ${parsed.version} is newer than this build supports (${SAVE_VERSION}).` };
  }
  if (!isRecord(parsed.state)) {
    return { error: "The save data is incomplete." };
  }
  const raw = parsed.state as Partial<GameState> & Record<string, unknown>;
  // The one-time hybrid migration: v5 converts once, here (ADR-0023).
  if (parsed.version === SAVE_VERSION - 1) {
    return { state: migrateV5(raw) };
  }
  const fresh = createInitialState();
  if (typeof raw.mode !== "string" || !["upgrade", "flow", "paused"].includes(raw.mode)) {
    return { error: "The save data has an unknown session mode." };
  }
  const merged: GameState = { ...fresh, ...raw } as GameState;
  if (
    !Array.isArray(merged.modules) ||
    !Array.isArray(merged.cells) ||
    !Array.isArray(merged.bankedRolls) ||
    !Array.isArray(merged.notes) ||
    !Array.isArray(merged.habits) ||
    !Array.isArray(merged.practiceLog) ||
    !Array.isArray(merged.sessionRecords) ||
    !Array.isArray(merged.goals) ||
    !Array.isArray(merged.activatedApps)
  ) {
    return { error: "The save data is incomplete." };
  }
  // The octave-row gate ledger joins the v6 shape (ADR-0022): lenient
  // default — a save written before it exists owes no gates it can't know
  // about. The check reads the raw save, not the merge: a fresh state's
  // granted opening rows must not masquerade as a ledger the save carried.
  if (!Array.isArray(raw.gatedRows)) {
    merged.gatedRows = [];
  }
  // The retired 120 s reconcile dialog's frozen gap (ADR-0010 → ADR-0019):
  // a save may still carry one; drop it rather than resuming a state shape
  // this build no longer reads.
  delete (merged as unknown as Record<string, unknown>).pendingGap;
  merged.purchased = { ...fresh.purchased, ...merged.purchased };
  return { state: merged };
}

export const STORAGE_KEY = "flowsynth.save.v1";
