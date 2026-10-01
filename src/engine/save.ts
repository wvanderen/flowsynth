import { createInitialState } from "./state";
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

// ADR-0017's pattern at the v7 boundary (issue #194): the prestige cut is a
// clean break. Every version older than this build — v6 included — rejects
// with the start-fresh message, and there is no migration chain, no
// archive, and no import path for rejected versions. Old saves are
// disposable per the map's standing note.
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
  if (parsed.version < SAVE_VERSION) {
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
  // The octave-row gate ledger (ADR-0022): lenient default — a save written
  // before it exists owes no gates it can't know about. The check reads the
  // raw save, not the merge: a fresh state's granted opening rows must not
  // masquerade as a ledger the save carried.
  if (!Array.isArray(raw.gatedRows)) {
    merged.gatedRows = [];
  }
  // The arc card's seen flag (§8) lenient-defaults the same way: absent or
  // corrupt means never dismissed — the save is still owed its one hint.
  if (typeof raw.arcCardSeen !== "boolean") {
    merged.arcCardSeen = false;
  }
  // The retired 120 s reconcile dialog's frozen gap (ADR-0010 → ADR-0019):
  // a save may still carry one; drop it rather than resuming a state shape
  // this build no longer reads.
  delete (merged as unknown as Record<string, unknown>).pendingGap;
  merged.purchased = { ...fresh.purchased, ...merged.purchased };
  return { state: merged };
}

export const STORAGE_KEY = "flowsynth.save.v1";
