import { deserialize, serialize, STORAGE_KEY, ORIGINAL_SAVE_KEY, PRE_V13_ORIGINAL_SAVE_KEY, type MigrationReport } from "../engine/save";
import type { GameState } from "../engine/types";

export interface LoadedSave {
  state: GameState;
  savedAt: number;
  // The calibrated-economy translation (issue #493): present exactly when
  // this parse performed the one-time conversion — the fact the flow
  // explains at the save/import destination.
  migration?: MigrationReport;
}
export type ParsedSave = LoadedSave | { error: string; recoveryRequired?: boolean };
export type WriteOutcome = "written" | "failed" | "refused";
export type SaveStorage = Pick<Storage, "getItem" | "setItem">;

// Access stays lazy: denied localStorage access is a read/write failure,
// rather than an exception while creating the instrument.
export const browserSaveStorage: SaveStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};

// A private in-memory slot: the storage shape SharedSave reads and writes,
// backed by a private key map no other tab — and no other SharedSave — can
// see. Previews and development scenarios ride this so their state can
// never read, resurrect, or overwrite the player's save (issue #456).
export function memorySaveStorage(): SaveStorage {
  const files = new Map<string, string>();
  return { getItem: (key) => files.get(key) ?? null, setItem: (key, next) => { files.set(key, next); } };
}

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
  // A lost-money or unbacked migration source is not a fresh-start slot.
  // Boot may show an unsaved opening, but no save (even forced) replaces
  // these bytes. A successful import or load is the only new adoption.
  private sourceProtected = false;

  constructor(private storage: SaveStorage, private now: () => number = () => Date.now()) {}

  parse(text: string): ParsedSave {
    const result = deserialize(text);
    if (result.error || !result.state) {
      return result.recoveryRequired
        ? { error: result.error ?? "Explicit recovery required.", recoveryRequired: true }
        : { error: result.error ?? "unknown error" };
    }
    return result.migration
      ? { state: result.state, savedAt: savedAtOf(text) ?? this.now(), migration: result.migration }
      : { state: result.state, savedAt: savedAtOf(text) ?? this.now() };
  }

  load(): ParsedSave | null {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = this.parse(raw);
      this.sourceProtected = "error" in parsed && parsed.recoveryRequired === true;
      if (this.sourceProtected) return parsed;
      if ("migration" in parsed && parsed.migration) {
        try {
          // This boundary needs today's exact bytes, not a first-seen
          // snapshot from an earlier release. Archive that older original
          // before replacing the download slot, then permit adoption.
          const earlier = this.storage.getItem(ORIGINAL_SAVE_KEY);
          if (earlier !== null && earlier !== raw) {
            this.storage.setItem(PRE_V13_ORIGINAL_SAVE_KEY, earlier);
          }
          this.storage.setItem(ORIGINAL_SAVE_KEY, raw);
        } catch {
          this.sourceProtected = true;
          return { error: "The pre-migration save could not be retained. The stored save is unchanged; retry after making storage available." };
        }
      } else {
        try {
          this.retainOnce(raw);
        } catch {
          // A later write retries before replacing the source.
        }
      }
      // Ordinary rejected versions still permit a fresh start. Lost
      // money and failed migration retention above never do.
      if ("error" in parsed) this.knownSavedAt = savedAtOf(raw) ?? this.knownSavedAt;
      return parsed;
    } catch {
      return null;
    }
  }

  // An import adopts a new lineage only after its source bytes are safe.
  retain(raw: string): boolean {
    try {
      this.storage.setItem(ORIGINAL_SAVE_KEY, raw);
      this.sourceProtected = false;
      return true;
    } catch {
      return false;
    }
  }

  // The retained lineage's exact source bytes (issue #493): what the
  // migration's explanation offers for download — the untouched original
  // behind whatever the working state now carries.
  retainedOriginal(): string | null {
    try {
      return this.storage.getItem(ORIGINAL_SAVE_KEY);
    } catch {
      return null;
    }
  }

  // Ordinary loads and writes retain the first source once per lineage.
  // Let the caller handle denial; a write must never replace that source.
  private retainOnce(raw: string): void {
    if (this.storage.getItem(ORIGINAL_SAVE_KEY) === null) {
      this.storage.setItem(ORIGINAL_SAVE_KEY, raw);
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
    if (this.sourceProtected || (!force && this.isNewer())) return "refused";
    try {
      const text = serialize(state, now);
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw !== null) this.retainOnce(raw);
      this.storage.setItem(STORAGE_KEY, text);
      this.knownSavedAt = now;
      return "written";
    } catch {
      // Failed writes do not advance ownership. App may throttle this
      // attempt, but a later external write must still be recognized.
      return "failed";
    }
  }
}
