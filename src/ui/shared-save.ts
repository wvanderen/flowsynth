import { deserialize, serialize, STORAGE_KEY } from "../engine/save";
import type { GameState } from "../engine/types";

export interface LoadedSave {
  state: GameState;
  savedAt: number;
}
export type ParsedSave = LoadedSave | { error: string };
export type WriteOutcome = "written" | "failed" | "refused";
type SaveStorage = Pick<Storage, "getItem" | "setItem">;

// Access stays lazy: denied localStorage access is a read/write failure,
// rather than an exception while creating the instrument.
export const browserSaveStorage: SaveStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};

function savedAtOf(raw: string): number | null {
  try {
    const savedAt = (JSON.parse(raw) as { savedAt?: unknown }).savedAt;
    return typeof savedAt === "number" && Number.isFinite(savedAt) ? savedAt : null;
  } catch {
    return null;
  }
}

// ADR-0032's shared-save ownership: reading, validating and writing the
// slot all use the same incorporated stamp. Refusal never adopts state;
// session reconciliation and save-attempt throttling remain in App.
export class SharedSave {
  private knownSavedAt = 0;

  constructor(private storage: SaveStorage, private now: () => number = () => Date.now()) {}

  parse(text: string): ParsedSave {
    const result = deserialize(text);
    if (result.error || !result.state) return { error: result.error ?? "unknown error" };
    return { state: result.state, savedAt: savedAtOf(text) ?? this.now() };
  }

  load(): ParsedSave | null {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = this.parse(raw);
      // A rejected file is ours to replace, even if its stamp is in the
      // future. Successful reads are incorporated when App adopts them.
      if ("error" in parsed) this.knownSavedAt = savedAtOf(raw) ?? this.knownSavedAt;
      return parsed;
    } catch {
      return null;
    }
  }

  incorporate(savedAt: number): void {
    this.knownSavedAt = savedAt;
  }

  isNewer(): boolean {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      const stamp = raw === null ? null : savedAtOf(raw);
      return stamp !== null && stamp > this.knownSavedAt;
    } catch {
      // An unreadable slot must never prevent an attempted write.
      return false;
    }
  }

  write(state: GameState, now: number = this.now(), force = false): WriteOutcome {
    if (!force && this.isNewer()) return "refused";
    try {
      this.storage.setItem(STORAGE_KEY, serialize(state, now));
      this.knownSavedAt = now;
      return "written";
    } catch {
      // Failed writes do not advance ownership. App may throttle this
      // attempt, but a later external write must still be recognized.
      return "failed";
    }
  }
}
