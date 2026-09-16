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

// ADR-0017: the v5 boundary is a clean cut. Saves older than SAVE_VERSION
// are rejected with a clear message and the game starts fresh; there is no
// migration chain, archive, or import path for them.
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
  const fresh = createInitialState();
  const raw = parsed.state as Partial<GameState> & { mode?: unknown };
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
    !Array.isArray(merged.goals) ||
    !Array.isArray(merged.activatedApps)
  ) {
    return { error: "The save data is incomplete." };
  }
  // A v5 save from before the session summary existed carries a session
  // without the earned tally; default it rather than NaN the summary.
  if (merged.session && typeof merged.session.earned !== "number") {
    merged.session.earned = 0;
  }
  // ADR-0015 fields join the v5 shape: the achievement ledger, the
  // session's unlock queue, and the summary's readout of it. No users
  // exist pre-release, so defaults are enough — no migration chain.
  if (!isRecord(merged.achievements)) {
    merged.achievements = {};
  }
  if (merged.session && !Array.isArray(merged.session.unlocked)) {
    merged.session.unlocked = [];
  }
  if (merged.summary && !Array.isArray(merged.summary.achievements)) {
    merged.summary.achievements = [];
  }
  // ADR-0018 retired the plain generator type pre-release: the focus-keyed
  // generator is the launch generator. Early v5 saves may still carry
  // "generator" modules or unspent roll candidates — remap them rather than
  // crashing on a type that no longer exists.
  for (const module of merged.modules) {
    if ((module as { type: string }).type === "generator") {
      module.type = "focusKeyed";
    }
  }
  for (const offer of merged.bankedRolls) {
    for (const candidate of offer.candidates) {
      if ((candidate as { type: string }).type === "generator") {
        candidate.type = "focusKeyed";
      }
    }
  }
  // Shelf keys added after a save was written (the additive synth) default
  // to unpurchased rather than reading as undefined.
  merged.purchased = { ...fresh.purchased, ...merged.purchased };
  return { state: merged };
}

export const STORAGE_KEY = "flowsynth.save.v1";
