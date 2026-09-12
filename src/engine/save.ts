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
  if (parsed.version !== SAVE_VERSION) {
    return { error: `Save version ${String(parsed.version)} is not supported (expected ${String(SAVE_VERSION)}).` };
  }
  if (!isRecord(parsed.state)) {
    return { error: "The save data is incomplete." };
  }
  const fresh = createInitialState();
  const state = parsed.state as Partial<GameState> & { mode?: unknown };
  if (typeof state.mode !== "string" || !["upgrade", "flow", "paused"].includes(state.mode)) {
    return { error: "The save data has an unknown session mode." };
  }
  const merged: GameState = { ...fresh, ...state } as GameState;
  if (!Array.isArray(merged.modules) || !Array.isArray(merged.cells) || !Array.isArray(merged.bankedRolls)) {
    return { error: "The save data is incomplete." };
  }
  return { state: merged };
}

export const STORAGE_KEY = "flowsynth.save.v1";
