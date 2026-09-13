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

// v1 (first playable) → v2 (Notes) → v3 (Goals) → v4 (activation economy).
// Before v4, Notes and Goals auto-activated when the store opened; those
// saves are grandfathered in as already-activated. From v4 on, activation
// is a store purchase (ADR-0007) and saved flags load exactly as stored.
function migrate(state: Record<string, unknown>, fromVersion: number): Record<string, unknown> {
  if (fromVersion < 4 && state.storeOpened === true) {
    state = { ...state, notesActive: true, goalsActive: true };
  }
  if (state.notes === undefined) state = { ...state, notes: [] };
  if (state.habits === undefined) state = { ...state, habits: [], activeHabitId: null, practiceLog: [] };
  if (state.goals === undefined) state = { ...state, goals: [] };
  return state;
}

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
  if (parsed.version > SAVE_VERSION) {
    return { error: `Save version ${String(parsed.version)} is newer than this build supports (${String(SAVE_VERSION)}).` };
  }
  if (!isRecord(parsed.state)) {
    return { error: "The save data is incomplete." };
  }
  const state = migrate(parsed.state, parsed.version);
  const fresh = createInitialState();
  const raw = state as Partial<GameState> & { mode?: unknown };
  if (typeof raw.mode !== "string" || !["upgrade", "flow", "paused"].includes(raw.mode)) {
    return { error: "The save data has an unknown session mode." };
  }
  const merged: GameState = { ...fresh, ...raw } as GameState;
  if (!Array.isArray(merged.modules) || !Array.isArray(merged.cells) || !Array.isArray(merged.bankedRolls) || !Array.isArray(merged.notes) || !Array.isArray(merged.habits) || !Array.isArray(merged.practiceLog) || !Array.isArray(merged.goals)) {
    return { error: "The save data is incomplete." };
  }
  return { state: merged };
}

export const STORAGE_KEY = "flowsynth.save.v1";
