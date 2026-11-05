import { describe, expect, it } from "vitest";
import { SAVE_VERSION } from "../engine/constants";
import { serialize, STORAGE_KEY, ORIGINAL_SAVE_KEY, PRE_V13_ORIGINAL_SAVE_KEY } from "../engine/save";
import { createInitialState } from "../engine/state";
import { SharedSave, memorySaveStorage } from "./shared-save";

function memoryStorage() {
  const files = new Map<string, string>();
  return {
    getItem: (key: string) => files.get(key) ?? null,
    setItem: (key: string, value: string) => { files.set(key, value); },
    removeItem: (key: string) => { files.delete(key); },
  };
}
function scenario() {
  const storage = memoryStorage();
  const owner = new SharedSave(storage, () => 1000);
  const state = createInitialState();
  owner.write(state);
  const stored = () => JSON.parse(storage.getItem(STORAGE_KEY)!) as { savedAt: number; state: typeof state };
  const newer = () => storage.setItem(STORAGE_KEY, serialize({ ...state, nous: 777 }, 2000));
  return { owner, state, storage, stored, newer };
}

describe("shared-save ownership (ADR-0032)", () => {
  it("refuses an older owner without adopting or mutating its working progress", () => {
    const { owner, state, stored, newer } = scenario();
    newer();
    state.nous = 999;
    expect(owner.write(state)).toBe("refused");
    expect(stored().state.nous).toBe(777);
    expect(state.nous).toBe(999);
    expect(owner.isNewer()).toBe(true);
  });

  it("the owner holding the newest state writes normally", () => {
    const { owner, state, storage, stored } = scenario();
    storage.setItem(STORAGE_KEY, serialize(state, 999));
    state.nous = 999;
    expect(owner.write(state)).toBe("written");
    expect(stored().state.nous).toBe(999);
    expect(stored().savedAt).toBe(1000);
  });

  it("an exact timestamp tie permits a legitimate write", () => {
    const { owner, state, stored } = scenario();
    state.nous = 555;
    expect(owner.write(state, 1000)).toBe("written");
    expect(stored().state.nous).toBe(555);
  });

  it.each([
    ["absent", null],
    ["malformed JSON", "{not json"],
    ["JSON null", "null"],
    ["missing stamp", "{}"],
    ["non-numeric stamp", '{"savedAt":"2000"}'],
    ["non-finite stamp", '{"savedAt":1e999}'],
  ])("a slot with %s never blocks an attempted write", (_label, raw) => {
    const { state } = scenario();
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { saved = value; }, removeItem: () => {} };
    let saved = "";
    const owner = new SharedSave(storage, () => 1000);
    expect(owner.isNewer()).toBe(false);
    expect(owner.write(state)).toBe("written");
    expect(JSON.parse(saved).savedAt).toBe(1000);
  });

  it("a forced write deliberately replaces a newer shared save", () => {
    const { owner, state, stored, newer } = scenario();
    newer();
    state.nous = 555;
    expect(owner.write(state, 1000, true)).toBe("written");
    expect(stored().state.nous).toBe(555);
    expect(owner.isNewer()).toBe(false);
  });

  it("two owners share the slot while keeping their incorporated progress independent", () => {
    const { owner, state, storage } = scenario();
    const other = new SharedSave(storage, () => 2000);
    const loaded = other.load();
    if (!loaded || "error" in loaded) throw new Error("expected a readable save");
    other.incorporate(loaded.savedAt);
    loaded.state.nous = 777;
    expect(other.write(loaded.state)).toBe("written");
    expect(owner.write(state)).toBe("refused");
    const adopted = owner.load();
    if (!adopted || "error" in adopted) throw new Error("expected newer progress");
    owner.incorporate(adopted.savedAt);
    expect(owner.write(adopted.state, 2001)).toBe("written");
    expect(other.isNewer()).toBe(true);
  });

  it("a successful read does not claim progress until the caller incorporates it", () => {
    const { owner, newer } = scenario();
    newer();
    const loaded = owner.load();
    if (!loaded || "error" in loaded) throw new Error("expected newer progress");
    expect(owner.isNewer()).toBe(true);
    owner.incorporate(loaded.savedAt);
    expect(owner.isNewer()).toBe(false);
  });

  it("a rejected-version save records its stamp so fresh progress can replace it", () => {
    const { owner, storage, state, stored } = scenario();
    storage.setItem(STORAGE_KEY, JSON.stringify({ app: "flowsynth", version: 1, savedAt: 2000, state: {} }));
    expect(owner.load()).toHaveProperty("error");
    expect(owner.write(state)).toBe("written");
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).version).toBe(SAVE_VERSION);
    expect(stored().savedAt).toBe(1000);
  });

  it("a missing or invalid load timestamp uses controlled wall time without fabricating new shared progress", () => {
    const { owner, state, storage } = scenario();
    const file = JSON.parse(serialize(state, 2000));
    delete file.savedAt;
    storage.setItem(STORAGE_KEY, JSON.stringify(file));
    expect(owner.load()).toMatchObject({ savedAt: 1000 });
    expect(owner.isNewer()).toBe(false);
  });

  it("import parsing never claims ownership of a rejected file", () => {
    const { owner, state, newer } = scenario();
    newer();
    expect(owner.parse(JSON.stringify({ app: "flowsynth", version: 1, savedAt: 5000, state: {} }))).toHaveProperty("error");
    expect(owner.write(state)).toBe("refused");
  });

  it("storage read failures prevent replacing an unreadable original", () => {
    let saved = "";
    const owner = new SharedSave({
      getItem: () => { throw new Error("denied read"); },
      removeItem: () => { throw new Error("denied removal"); },
      setItem: (_key, value) => { saved = value; },
    }, () => 1000);
    expect(owner.load()).toBeNull();
    expect(owner.isNewer()).toBe(false);
    expect(owner.write(createInitialState())).toBe("failed");
    expect(saved).toBe("");
  });

  it("failed writes do not claim a stamp or hide later external progress", () => {
    const { storage, state } = scenario();
    const owner = new SharedSave({
      getItem: storage.getItem,
      removeItem: storage.removeItem,
      setItem: () => { throw new Error("quota exceeded"); },
    }, () => 3000);
    owner.incorporate(1000);
    expect(owner.write(state)).toBe("failed");
    storage.setItem(STORAGE_KEY, serialize({ ...state, nous: 777 }, 2000));
    expect(owner.isNewer()).toBe(true);
    expect(owner.write(state)).toBe("refused");
  });
});

describe("the original-bytes backup (issue #486)", () => {
  it("a loaded save's raw bytes are retained before anything can replace them", () => {
    const storage = memoryStorage();
    const raw = serialize({ ...createInitialState(), nous: 123 }, 500);
    storage.setItem(STORAGE_KEY, raw);
    const owner = new SharedSave(storage, () => 1000);
    expect(owner.load()).not.toHaveProperty("error");
    expect(storage.getItem(ORIGINAL_SAVE_KEY)).toBe(raw);
    // Ordinary saves move the main slot; the retained bytes stand.
    owner.incorporate(500);
    expect(owner.write({ ...createInitialState(), nous: 5 }, 1000)).toBe("written");
    expect(storage.getItem(STORAGE_KEY)).not.toBe(raw);
    expect(storage.getItem(ORIGINAL_SAVE_KEY)).toBe(raw);
  });

  it("a rejected save's bytes are retained too — the corrupt original is the recovery source", () => {
    const storage = memoryStorage();
    const raw = JSON.stringify({ app: "flowsynth", version: 1, savedAt: 500, state: { nous: null } });
    storage.setItem(STORAGE_KEY, raw);
    const owner = new SharedSave(storage, () => 1000);
    expect(owner.load()).toHaveProperty("error");
    expect(storage.getItem(ORIGINAL_SAVE_KEY)).toBe(raw);
  });

  it("a refused write leaves the last valid save and the retained original byte-identical", () => {
    const storage = memoryStorage();
    const raw = serialize(createInitialState(), 500);
    storage.setItem(STORAGE_KEY, raw);
    const owner = new SharedSave(storage, () => 1000);
    owner.load();
    owner.incorporate(500); // the loaded save is this owner's to replace
    const broken = createInitialState();
    broken.nous = Infinity; // serialize refuses: JSON would write null
    expect(owner.write(broken, 1000)).toBe("failed");
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(storage.getItem(ORIGINAL_SAVE_KEY)).toBe(raw);
  });

  it("a later boot never overwrites the retained original with newer slot bytes", () => {
    const storage = memoryStorage();
    const first = serialize({ ...createInitialState(), nous: 123 }, 500);
    storage.setItem(STORAGE_KEY, first);
    const owner = new SharedSave(storage, () => 1000);
    owner.load();
    owner.incorporate(500);
    owner.write({ ...createInitialState(), nous: 999 }, 1500);
    // A new day's boot reads the newer save; the retained original is the
    // lineage's first-seen bytes, not the newest slot's.
    const owner2 = new SharedSave(storage, () => 2000);
    expect(owner2.load()).not.toHaveProperty("error");
    expect(storage.getItem(ORIGINAL_SAVE_KEY)).toBe(first);
  });

  it("a later boot never overwrites a retained corrupt original with the fresh state's bytes", () => {
    const storage = memoryStorage();
    const corrupt = JSON.stringify({ app: "flowsynth", version: 1, savedAt: 500, state: { nous: null } });
    storage.setItem(STORAGE_KEY, corrupt);
    const owner = new SharedSave(storage, () => 1000);
    expect(owner.load()).toHaveProperty("error");
    expect(owner.write(createInitialState(), 1000)).toBe("written"); // the fresh state replaces the rejected save
    const owner2 = new SharedSave(storage, () => 2000);
    expect(owner2.load()).not.toHaveProperty("error");
    expect(storage.getItem(ORIGINAL_SAVE_KEY)).toBe(corrupt); // the corrupt original survives
  });

  it("the retained slot takes an applied import's source bytes", () => {
    const storage = memoryStorage();
    const first = serialize(createInitialState(), 500);
    storage.setItem(STORAGE_KEY, first);
    const owner = new SharedSave(storage, () => 1000);
    owner.load();
    const imported = serialize({ ...createInitialState(), nous: 9 }, 750);
    owner.parse(imported); // the parse the import applies
    owner.retain(imported);
    expect(storage.getItem(ORIGINAL_SAVE_KEY)).toBe(imported);
  });
});

describe("review regressions: retain before replacement (#486)", () => {
  it.each([false, true])("backup denial protects the primary save, force=%s, then retries", (force) => {
    const files = memoryStorage();
    const raw = serialize(createInitialState(), 500);
    files.setItem(STORAGE_KEY, raw);
    let denyBackup = true;
    const storage = {
      getItem: files.getItem,
      removeItem: files.removeItem,
      setItem: (key: string, value: string) => {
        if (key === ORIGINAL_SAVE_KEY && denyBackup) throw new Error("quota exceeded");
        files.setItem(key, value);
      },
    };
    const owner = new SharedSave(storage);
    expect(owner.load()).toHaveProperty("state");
    owner.incorporate(500);
    expect(owner.write(createInitialState(), 1000, force)).toBe("failed");
    expect(files.getItem(STORAGE_KEY)).toBe(raw);
    expect(files.getItem(ORIGINAL_SAVE_KEY)).toBeNull();
    denyBackup = false;
    expect(owner.write(createInitialState(), 1000, force)).toBe("written");
    expect(files.getItem(ORIGINAL_SAVE_KEY)).toBe(raw);
    expect(files.getItem(STORAGE_KEY)).not.toBe(raw);
  });

  it("a write without a prior load retains the source first", () => {
    const storage = memoryStorage();
    const raw = "{corrupt original";
    storage.setItem(STORAGE_KEY, raw);
    expect(new SharedSave(storage).write(createInitialState(), 1000)).toBe("written");
    expect(storage.getItem(ORIGINAL_SAVE_KEY)).toBe(raw);
  });

  it("isolated memory storage keeps the primary and backup slots separate", () => {
    const storage = memorySaveStorage();
    storage.setItem(STORAGE_KEY, "primary");
    storage.setItem(ORIGINAL_SAVE_KEY, "original");
    expect(storage.getItem(STORAGE_KEY)).toBe("primary");
    expect(storage.getItem(ORIGINAL_SAVE_KEY)).toBe("original");
  });
});

// The lost-money recovery's persistence seam (issue #494): the load that
// detects lost money names the paths and carries the exact bytes, and
// the explicit adoption retains those bytes as the new lineage's
// original before anything replaces the slot.
describe("the lost-money recovery's adoption (issue #494)", () => {
  // A v12 save whose monetary figures serialized to null — the recovery
  // class's own shape.
  function lostMoneyText(): string {
    const file = JSON.parse(serialize(createInitialState(), 750));
    file.version = 12;
    file.state.nous = null;
    file.state.arete = null;
    return JSON.stringify(file);
  }

  it("load names the lost paths and carries the exact raw bytes for the recovery choice", () => {
    const storage = memoryStorage();
    const raw = lostMoneyText();
    storage.setItem(STORAGE_KEY, raw);
    const owner = new SharedSave(storage, () => 1000);
    const parsed = owner.load();
    expect(parsed).toHaveProperty("recoveryRequired", true);
    expect((parsed as { lost?: string[] }).lost).toEqual(["nous", "arete"]);
    expect((parsed as { raw?: string }).raw).toBe(raw);
    // The protection stands: the owner cannot replace the source until
    // the explicit adoption succeeds.
    expect(owner.write(createInitialState(), 1000, true)).toBe("refused");
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("adoptRecovered retains the exact source bytes as the original and lifts the protection", () => {
    const storage = memoryStorage();
    const raw = lostMoneyText();
    storage.setItem(STORAGE_KEY, raw);
    const owner = new SharedSave(storage, () => 1000);
    owner.load();
    expect(owner.adoptRecovered(raw, createInitialState(), 1000)).toBe(true);
    expect(storage.getItem(ORIGINAL_SAVE_KEY)).toBe(raw);
    // The recovered lineage writes normally: the slot takes the v13
    // bytes, the original stands untouched.
    expect(owner.write(createInitialState(), 1000, true)).toBe("written");
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).version).toBe(SAVE_VERSION);
    expect(storage.getItem(ORIGINAL_SAVE_KEY)).toBe(raw);
  });

  it("adoptRecovered archives an earlier lineage's backup before retaining the source", () => {
    const storage = memoryStorage();
    const raw = lostMoneyText();
    const earlier = serialize(createInitialState(), 100);
    storage.setItem(STORAGE_KEY, raw);
    storage.setItem(ORIGINAL_SAVE_KEY, earlier);
    const owner = new SharedSave(storage, () => 1000);
    owner.load();
    expect(owner.adoptRecovered(raw, createInitialState(), 1000)).toBe(true);
    expect(storage.getItem(PRE_V13_ORIGINAL_SAVE_KEY)).toBe(earlier);
    expect(storage.getItem(ORIGINAL_SAVE_KEY)).toBe(raw);
  });

  it.each(["absent", "original", "archive", "same source"])("primary denial restores %s backup slots including absent keys, without advancing ownership", (backups) => {
    const storage = memoryStorage();
    const raw = lostMoneyText();
    storage.setItem(STORAGE_KEY, raw);
    if (backups !== "absent") storage.setItem(ORIGINAL_SAVE_KEY, backups === "same source" ? raw : "earlier original");
    if (backups === "archive") storage.setItem(PRE_V13_ORIGINAL_SAVE_KEY, "earlier archive");
    const keys = [STORAGE_KEY, ORIGINAL_SAVE_KEY, PRE_V13_ORIGINAL_SAVE_KEY];
    const before = keys.map((key) => storage.getItem(key));
    let deny = true;
    const owner = new SharedSave({
      ...storage,
      setItem: (key, value) => {
        if (key === STORAGE_KEY && deny) throw new Error("primary denied");
        storage.setItem(key, value);
      },
    });
    owner.load();
    expect(owner.adoptRecovered(raw, createInitialState(), 1000)).toBe(false);
    expect(keys.map((key) => storage.getItem(key))).toEqual(before);
    expect(owner.isNewer()).toBe(true);
    expect(owner.write(createInitialState(), 1000, true)).toBe("refused");
    deny = false;
    expect(owner.adoptRecovered(raw, createInitialState(), 1000)).toBe(true);
    expect(storage.getItem(ORIGINAL_SAVE_KEY)).toBe(raw);
    expect(owner.isNewer()).toBe(false);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).version).toBe(13);
  });

  it("recovery serialization denial changes no slot and retains protection", () => {
    const storage = memoryStorage();
    const raw = lostMoneyText();
    storage.setItem(STORAGE_KEY, raw);
    const owner = new SharedSave(storage);
    owner.load();
    const broken = createInitialState();
    broken.nous = Infinity;
    expect(owner.adoptRecovered(raw, broken, 1000)).toBe(false);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(storage.getItem(ORIGINAL_SAVE_KEY)).toBeNull();
    expect(storage.getItem(PRE_V13_ORIGINAL_SAVE_KEY)).toBeNull();
    expect(owner.write(createInitialState(), 1000, true)).toBe("refused");
  });

  it("rollback denial reports its limit honestly and leaves the primary protected", () => {
    const storage = memoryStorage();
    const raw = lostMoneyText();
    storage.setItem(STORAGE_KEY, raw);
    const owner = new SharedSave({
      ...storage,
      setItem: (key, value) => {
        if (key === STORAGE_KEY) throw new Error("primary denied");
        storage.setItem(key, value);
      },
      removeItem: () => { throw new Error("removal denied"); },
    });
    owner.load();
    expect(() => owner.adoptRecovered(raw, createInitialState(), 1000)).toThrow("backup restoration was denied");
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(owner.write(createInitialState(), 1000, true)).toBe("refused");
  });

  it("adoptRecovered denied keeps the protection: neither slot moves", () => {
    const storage = memoryStorage();
    const raw = lostMoneyText();
    const earlier = serialize(createInitialState(), 100);
    storage.setItem(STORAGE_KEY, raw);
    storage.setItem(ORIGINAL_SAVE_KEY, earlier);
    const denied = {
      getItem: (key: string) => storage.getItem(key),
      removeItem: storage.removeItem,
      setItem: (key: string, value: string) => {
        if (key === PRE_V13_ORIGINAL_SAVE_KEY) throw new Error("quota exceeded");
        storage.setItem(key, value);
      },
    };
    const owner = new SharedSave(denied, () => 1000);
    owner.load();
    expect(owner.adoptRecovered(raw, createInitialState(), 1000)).toBe(false);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(storage.getItem(ORIGINAL_SAVE_KEY)).toBe(earlier);
    // The protection stands: no save replaces the source.
    expect(owner.write(createInitialState(), 1000, true)).toBe("refused");
  });
});
