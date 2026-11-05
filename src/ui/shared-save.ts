import { deserialize, recoverLostSave, serialize, STORAGE_KEY, ORIGINAL_SAVE_KEY, PRE_V13_ORIGINAL_SAVE_KEY, type MigrationReport, type RecoveryReport } from "../engine/save";
import type { GameState } from "../engine/types";

export interface LoadedSave {
  state: GameState;
  savedAt: number;
  // The calibrated-economy translation (issue #493): present exactly when
  // this parse performed the one-time conversion — the fact the flow
  // explains at the save/import destination.
  migration?: MigrationReport;
  // The explicit lost-money recovery (issue #494): present exactly when
  // this parse performed the player's chosen recovery — the choice was
  // explained before it applied, so this rides without a second surface.
  recovered?: RecoveryReport;
}
// A failed parse: the recovery-required shape names the lost paths and —
// from load() — carries the exact stored bytes, so the app can offer the
// explicit recovery without reading the slot again.
export type ParsedSave = LoadedSave | { error: string; recoveryRequired?: boolean; lost?: string[]; raw?: string };
export type WriteOutcome = "written" | "failed" | "refused";
export type SaveStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

// Access stays lazy: denied localStorage access is a read/write failure,
// rather than an exception while creating the instrument.
export const browserSaveStorage: SaveStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
};

// A private in-memory slot: the storage shape SharedSave reads and writes,
// backed by a private key map no other tab — and no other SharedSave — can
// see. Previews and development scenarios ride this so their state can
// never read, resurrect, or overwrite the player's save (issue #456).
export function memorySaveStorage(): SaveStorage {
  const files = new Map<string, string>();
  return {
    getItem: (key) => files.get(key) ?? null,
    setItem: (key, next) => { files.set(key, next); },
    removeItem: (key) => { files.delete(key); },
  };
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
        ? { error: result.error ?? "Explicit recovery required.", recoveryRequired: true, lost: result.lost ?? [] }
        : { error: result.error ?? "unknown error" };
    }
    return result.migration
      ? { state: result.state, savedAt: savedAtOf(text) ?? this.now(), migration: result.migration }
      : { state: result.state, savedAt: savedAtOf(text) ?? this.now() };
  }

  // The recovery choice's parse (issue #494): the same bytes through the
  // recovery door. A recovery-required parse rides load()'s raw copy;
  // an import carries its own text.
  parseRecovered(text: string): ParsedSave {
    const result = recoverLostSave(text);
    if (result.error || !result.state) return { error: result.error ?? "The recovery could not read this save." };
    return {
      state: result.state,
      savedAt: savedAtOf(text) ?? this.now(),
      ...(result.recovered ? { recovered: result.recovered } : {}),
    };
  }

  load(): ParsedSave | null {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = this.parse(raw);
      if ("error" in parsed && parsed.recoveryRequired === true) {
        // The offer's material: the exact stored bytes and the named
        // paths, without a second slot read. The protection stands: no
        // save — even forced — replaces these bytes.
        this.sourceProtected = true;
        return { ...parsed, raw, lost: parsed.lost ?? [] };
      }
      this.sourceProtected = false;
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

  // Recovery commits persistence before App adopts anything. Serialize
  // first, retain the source, then write the recovered primary last.
  // Storage.setItem is atomic per key: a failed final write leaves the
  // primary intact, and only completed backup writes need undoing.
  // Keep the source timestamp so a reload can still reconcile its gap
  // if the normal post-adoption session save fails.
  adoptRecovered(raw: string, state: GameState, savedAt: number): boolean {
    const changed: { key: string; previous: string | null }[] = [];
    try {
      const text = serialize(state, savedAt);
      const earlier = this.storage.getItem(ORIGINAL_SAVE_KEY);
      const archive = this.storage.getItem(PRE_V13_ORIGINAL_SAVE_KEY);
      const replace = (key: string, value: string, previous: string | null): void => {
        if (previous === value) return;
        this.storage.setItem(key, value);
        changed.push({ key, previous });
      };
      if (earlier !== null && earlier !== raw) replace(PRE_V13_ORIGINAL_SAVE_KEY, earlier, archive);
      replace(ORIGINAL_SAVE_KEY, raw, earlier);
      this.storage.setItem(STORAGE_KEY, text);
      this.sourceProtected = false;
      this.knownSavedAt = savedAt;
      return true;
    } catch {
      let rollbackFailed = false;
      for (const { key, previous } of changed.reverse()) {
        try {
          if (previous === null) this.storage.removeItem(key);
          else this.storage.setItem(key, previous);
        } catch {
          rollbackFailed = true;
        }
      }
      if (rollbackFailed) {
        // Storage can become unavailable between any two operations. Do
        // not claim unchanged backups when even rollback was denied.
        this.sourceProtected = true;
        throw new Error("The recovered save could not be saved and backup restoration was denied. The primary save is unchanged; download the original before retrying.");
      }
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
