// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { ORIGINAL_SAVE_KEY, STORAGE_KEY, serialize } from "../engine/save";
import { createInitialState } from "../engine/state";
import { BALANCE } from "../engine/constants";
import { SharedSave, memorySaveStorage, type SaveStorage } from "./shared-save";
import { createAppFixture } from "./testing/app-fixture";

// The calibrated-economy migration's save/import flow (issue #493): the
// one-time conversion explains itself where the save arrives, the exact
// original bytes stand retained before anything replaces them, and a
// reload never explains twice.

const fixture = createAppFixture();
const boot = fixture.boot;
let app: App;

beforeEach(() => {
  localStorage.clear();
  app = boot(undefined, false, new SharedSave(memorySaveStorage()));
});
afterEach(() => fixture.release());

// A finite overpowered v12 save: the parent's shape, every figure
// representable — runaway levels, a deep era, banked Arete, one claimed
// frontier step.
function overpoweredV12(savedAt = 750): string {
  const state = createInitialState();
  const mod = state.modules[0]!;
  mod.level = 1504;
  mod.invested = 1.6e308;
  state.nous = 8.2e9;
  state.eraEarned = 4e14;
  state.arete = 4;
  state.world.frontier = 1;
  const file = JSON.parse(serialize(state, savedAt));
  file.version = 12;
  return JSON.stringify(file);
}

function mapStorage(files: Map<string, string>): SaveStorage {
  return {
    getItem: (key: string) => files.get(key) ?? null,
    setItem: (key: string, value: string) => files.set(key, value),
  };
}

describe("the calibrated migration's flow (issue #493)", () => {
  it("booting a stored v12 save explains the migration, retains the original bytes, and lands calibrated", () => {
    const source = overpoweredV12();
    const files = new Map<string, string>([[STORAGE_KEY, source]]);
    app = boot(undefined, false, new SharedSave(mapStorage(files)));
    // The report stands and names the movement.
    expect(app.ui.migration).toMatchObject({ fromVersion: 12, modulesCleared: 1, nousCleared: 8.2e9, eraEarnedCleared: 4e14, frontierCleared: 1, areteRetained: 4 });
    expect(app.ui.modal).toBe("migration");
    // The exact stored bytes were retained before the boot save replaced
    // the slot with the converted v13 file.
    expect(files.get(ORIGINAL_SAVE_KEY)).toBe(source);
    const stored = JSON.parse(files.get(STORAGE_KEY)!);
    expect(stored.version).toBe(13);
    expect(stored.state.nous).toBe(BALANCE.openingGrant);
    expect(stored.state.eraEarned).toBe(0);
    expect(stored.state.world.frontier).toBe(0);
    expect(stored.state.arete).toBe(4);
  });

  it("the explanation presents once: a reload of the converted save stands silent", () => {
    const files = new Map<string, string>([[STORAGE_KEY, overpoweredV12()]]);
    app = boot(undefined, false, new SharedSave(mapStorage(files)));
    app.closeModal();
    expect(app.ui.migration).toBeNull();
    expect(app.ui.modal).toBeNull();
    const second = boot(undefined, false, new SharedSave(mapStorage(files)));
    expect(second.ui.migration).toBeNull();
    expect(second.ui.modal).toBeNull();
  });

  it("an imported v12 save retains its source bytes and explains the economy it landed on", () => {
    app = boot(undefined, false, new SharedSave(localStorage));
    const source = overpoweredV12();
    expect(app.importText(source)).toBe(true);
    expect(localStorage.getItem(ORIGINAL_SAVE_KEY)).toBe(source);
    expect(app.ui.modal).toBe("migration");
    expect(app.state.nous).toBe(BALANCE.openingGrant);
    expect(app.state.eraEarned).toBe(0);
  });

  it("a rejected v12 save adopts nothing and its exact bytes stay retained", () => {
    const corrupt = '{"app":"flowsynth","version":12,"state":{"mode":"weird"}}';
    const files = new Map<string, string>([[STORAGE_KEY, corrupt]]);
    app = boot(undefined, false, new SharedSave(mapStorage(files)));
    // A rejected save never carries a report: the fresh instrument stands,
    // and the corrupt original is what the retained slot keeps.
    expect(app.ui.migration).toBeNull();
    expect(app.ui.modal).toBeNull();
    expect(app.state.sessionRecords).toHaveLength(0);
    expect(files.get(ORIGINAL_SAVE_KEY)).toBe(corrupt);
  });

  it("a canceled import migrates nothing: the stored save and its retained original stand untouched", () => {
    const stored = serialize({ ...createInitialState(), nous: 9 }, 500);
    localStorage.setItem(STORAGE_KEY, stored);
    app = boot(undefined, false, new SharedSave(localStorage));
    const afterBoot = localStorage.getItem(STORAGE_KEY);
    app.openModal("import");
    // The walk's cancel: closing the import modal without applying. No
    // conversion ran, nothing was adopted, and neither slot moved.
    app.closeModal();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(afterBoot);
    expect(JSON.parse(afterBoot!).state.nous).toBe(9);
    // The boot retained the first-seen bytes once; the cancel moved
    // neither slot.
    expect(localStorage.getItem(ORIGINAL_SAVE_KEY)).toBe(stored);
    expect(app.ui.modal).toBeNull();
    expect(app.ui.migration).toBeNull();
  });

  it("the explanation names what was kept and what moved, and offers the retained original", () => {
    const files = new Map<string, string>([[STORAGE_KEY, overpoweredV12()]]);
    app = boot(undefined, false, new SharedSave(mapStorage(files)));
    const content = document.getElementById("modal-content")!;
    expect(content.textContent).toContain("calibrated economy");
    // What was kept: the collection, the Arete, the life record.
    expect(content.textContent).toContain("Arete");
    // What moved: the levels and the balances, with the report's figures.
    expect(content.textContent).toContain("8.2B");
    expect(content.textContent).toContain("opening grant");
    // The retained original is offered, not just claimed.
    expect(content.querySelector("#migration-original")).not.toBeNull();
    app.closeModal();
    expect(app.ui.modal).toBeNull();
  });
});
