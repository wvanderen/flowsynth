import { createInitialState } from "./state";
import { SAVE_VERSION } from "./constants";
import { freshAccounting } from "./trust";
import type { GameState, SessionReflection } from "./types";

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

// ADR-0018 retired the plain generator type pre-release: the focus-keyed
// generator is the launch generator. Early v5 saves may still carry
// "generator" types — modules, or unspent roll candidates — so remap them
// rather than crashing on a type that no longer exists. Untyped on purpose:
// the data comes straight from the parsed file.
function remapRetiredGenerator(rows: { type: string }[]): void {
  for (const row of rows) {
    if (row.type === "generator") {
      row.type = "focusKeyed";
    }
  }
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
    !Array.isArray(merged.sessionRecords) ||
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
  // The close-out summary's final numbers and reflection (§8) join the v5
  // shape additively, defaulted leniently like the achievements row above:
  // a summary written before them shows plain minutes, no event lines, and
  // no reflection — never a half-shaped object.
  if (merged.summary) {
    if (!Array.isArray(merged.summary.honestyEvents)) {
      merged.summary.honestyEvents = [];
    }
    if (typeof merged.summary.plannedTarget !== "number") {
      merged.summary.plannedTarget = null;
    }
    const reflection = merged.summary.reflection as SessionReflection | null | undefined;
    if (!reflection || typeof reflection.text !== "string" || typeof reflection.slider !== "number") {
      merged.summary.reflection = null;
    }
  }
  // The focus-tool spec's trust accounting (ADR-0019) joins as additive v5
  // fields: sessions from before it carry no ledger, so default the whole
  // object and its lists leniently — older saves load unchanged.
  if (merged.session) {
    if (!isRecord(merged.session.accounting)) {
      merged.session.accounting = freshAccounting();
    } else {
      if (!Array.isArray(merged.session.accounting.events)) {
        merged.session.accounting.events = [];
      }
      if (typeof merged.session.accounting.pendingAwaySeconds !== "number") {
        merged.session.accounting.pendingAwaySeconds = 0;
      }
    }
    // The overrun entry flag (§4) joins the v5 shape additively: a session
    // from before the signals existed re-fires them once at most, then the
    // flag holds.
    if (typeof merged.session.targetSignaled !== "boolean") {
      merged.session.targetSignaled = false;
    }
    // The session record's seams (§9) join additively: a pre-§9 session
    // carries no start stamp and no goal ledger, and zero/empty are honest
    // defaults — the record falls back to its end time at close.
    if (typeof merged.session.startedAt !== "number") {
      merged.session.startedAt = 0;
    }
    if (!isRecord(merged.session.goalSeconds)) {
      merged.session.goalSeconds = {};
    }
  }
  // Note tags and stamps (§9) join additively: pre-§9 notes load untagged
  // and undated, exactly what they were.
  for (const note of merged.notes) {
    if (note.habitId !== null && typeof note.habitId !== "string") {
      note.habitId = null;
    }
    if (typeof note.at !== "number") {
      note.at = 0;
    }
  }
  // The global mute and the notification-ask flag (§4–5) join additively:
  // older saves load unmuted, never having been asked.
  if (typeof merged.muted !== "boolean") {
    merged.muted = false;
  }
  if (typeof merged.notificationAsked !== "boolean") {
    merged.notificationAsked = false;
  }
  // The retired 120 s reconcile dialog's frozen gap (ADR-0010 → ADR-0019):
  // a pre-trust save may still carry one; drop it rather than resuming a
  // state shape this build no longer reads.
  delete (merged as unknown as Record<string, unknown>).pendingGap;
  // ADR-0018 retired the plain generator type pre-release (see
  // remapRetiredGenerator above); shelf keys added after a save was written
  // (the additive synth) default to unpurchased rather than reading as
  // undefined.
  remapRetiredGenerator(merged.modules);
  for (const offer of merged.bankedRolls) {
    remapRetiredGenerator(offer.candidates);
  }
  merged.purchased = { ...fresh.purchased, ...merged.purchased };
  return { state: merged };
}

export const STORAGE_KEY = "flowsynth.save.v1";
