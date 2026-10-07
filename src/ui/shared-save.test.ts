import { describe, expect, it } from "vitest";
import { SAVE_VERSION } from "../engine/constants";
import { serialize, STORAGE_KEY } from "../engine/save";
import { createInitialState } from "../engine/state";
import { SharedSave } from "./shared-save";

function memoryStorage() {
  const files = new Map<string, string>();
  return {
    getItem: (key: string) => files.get(key) ?? null,
    setItem: (key: string, value: string) => { files.set(key, value); },
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
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { saved = value; } };
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

  it("storage read failures are silent and still permit attempting a write", () => {
    let saved = "";
    const owner = new SharedSave({
      getItem: () => { throw new Error("denied read"); },
      setItem: (_key, value) => { saved = value; },
    }, () => 1000);
    expect(owner.load()).toBeNull();
    expect(owner.isNewer()).toBe(false);
    expect(owner.write(createInitialState())).toBe("written");
    expect(JSON.parse(saved).savedAt).toBe(1000);
  });

  it("failed writes do not claim a stamp or hide later external progress", () => {
    const { storage, state } = scenario();
    const owner = new SharedSave({
      getItem: storage.getItem,
      setItem: () => { throw new Error("quota exceeded"); },
    }, () => 3000);
    owner.incorporate(1000);
    expect(owner.write(state)).toBe("failed");
    storage.setItem(STORAGE_KEY, serialize({ ...state, nous: 777 }, 2000));
    expect(owner.isNewer()).toBe(true);
    expect(owner.write(state)).toBe("refused");
  });
});
