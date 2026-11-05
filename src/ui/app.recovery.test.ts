// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { App } from "./app";
import { ORIGINAL_SAVE_KEY, PRE_V13_ORIGINAL_SAVE_KEY, STORAGE_KEY, serialize } from "../engine/save";
import { bankableClaimOf } from "../engine/accumulator";
import { createInitialState } from "../engine/state";
import { BALANCE } from "../engine/constants";
import { SharedSave, memorySaveStorage, type SaveStorage } from "./shared-save";
import { createAppFixture } from "./testing/app-fixture";

// The lost-money recovery's save/import flow (issue #494): the offer
// stands where the save arrived, explains the unavailable figures, the
// retained development, and the reset before the choice applies, keeps
// the exact original bytes through cancel and failure, and never
// presents twice for the same recovery.

const fixture = createAppFixture();
const boot = fixture.boot;
let app: App;

beforeEach(() => {
  localStorage.clear();
  app = boot(undefined, false, new SharedSave(memorySaveStorage()));
});
afterEach(() => { fixture.release(); vi.restoreAllMocks(); });

// The recovery class's own shape: the runaway build whose monetary
// figures serialized to null — synthetic figures throughout.
function lostMoneyV12(savedAt = 750): string {
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
  file.state.nous = null;
  file.state.arete = null;
  file.state.eraEarned = null;
  file.state.totalEarned = null;
  file.state.modules[0].invested = null;
  return JSON.stringify(file);
}

function mapStorage(files: Map<string, string>): SaveStorage {
  return {
    getItem: (key: string) => files.get(key) ?? null,
    setItem: (key: string, value: string) => files.set(key, value),
  };
}

describe("the lost-money recovery's flow (issue #494)", () => {
  it("booting onto a lost-money save offers recovery where the save arrived, with both slots intact", () => {
    const source = lostMoneyV12();
    const earlier = serialize(createInitialState(), 100);
    const files = new Map<string, string>([[STORAGE_KEY, source], [ORIGINAL_SAVE_KEY, earlier]]);
    app = boot(undefined, false, new SharedSave(mapStorage(files)));
    // The offer stands, naming the lost paths; the screen is its own —
    // no duplicate load-failure notice rides beside it.
    expect(app.ui.recovery).toMatchObject({ lost: ["nous", "totalEarned", "eraEarned", "arete", "modules[0].invested"], from: "boot" });
    expect(app.ui.modal).toBe("recovery");
    expect(document.getElementById("status")!.textContent).not.toContain("Could not load");
    // Nothing was adopted: the fresh instrument stands beneath, and both
    // slots keep their exact bytes.
    expect(app.state.sessionRecords).toHaveLength(0);
    expect(files.get(STORAGE_KEY)).toBe(source);
    expect(files.get(ORIGINAL_SAVE_KEY)).toBe(earlier);
    // The protected source cannot be replaced, forced or not.
    app.save();
    app.save(Date.now(), true);
    expect(files.get(STORAGE_KEY)).toBe(source);
  });

  it("the offer explains the unavailable figures, the retained development, the reset, and the original", () => {
    const files = new Map<string, string>([[STORAGE_KEY, lostMoneyV12()]]);
    app = boot(undefined, false, new SharedSave(mapStorage(files)));
    const content = document.getElementById("modal-content")!;
    expect(content.textContent).toContain("unavailable");
    // What was lost, named — not summarized into a fabricated balance.
    expect(content.textContent).toContain("nous");
    expect(content.textContent).toContain("modules[0].invested");
    // What stands: the record and the collection.
    expect(content.textContent).toContain("Practice history");
    // What resets: the economy, to the calibrated opening.
    expect(content.textContent).toContain("opening grant");
    // The original is offered, not just claimed.
    expect(content.querySelector("#recovery-original")).not.toBeNull();
    for (const term of ["Arete", "nous", "merge tier", "module rolls", "Claimed frontier"]) {
      expect(content.querySelector(`.term-trigger[aria-label="${term} — what it means"]`)).not.toBeNull();
    }
  });

  it("applying the recovery lands the calibrated economy and retains the exact source bytes", () => {
    const source = lostMoneyV12();
    const files = new Map<string, string>([[STORAGE_KEY, source]]);
    app = boot(undefined, false, new SharedSave(mapStorage(files)));
    document.getElementById("recovery-apply")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    // The state: calibrated opening, levels cleared, the offer gone.
    expect(app.ui.recovery).toBeNull();
    expect(app.ui.modal).toBeNull();
    expect(app.state.nous).toBe(BALANCE.openingGrant);
    expect(app.state.eraEarned).toBe(0);
    expect(app.state.modules[0]!.level).toBe(0);
    expect(app.state.modules[0]!.tier).toBe(0);
    expect(bankableClaimOf(app.state)).toBe(0);
    // The slots: the exact source bytes as the lineage's original, the
    // recovered v13 file in the slot.
    expect(files.get(ORIGINAL_SAVE_KEY)).toBe(source);
    const stored = JSON.parse(files.get(STORAGE_KEY)!);
    expect(stored.version).toBe(13);
    expect(stored.state.nous).toBe(BALANCE.openingGrant);
    // A reload of the recovered save stands silent: no re-recovery, no
    // duplicated explanation, no duplicated entitlement.
    const second = boot(undefined, false, new SharedSave(mapStorage(files)));
    expect(second.ui.recovery).toBeNull();
    expect(second.ui.modal).toBeNull();
    expect(second.state.nous).toBe(BALANCE.openingGrant);
    expect(files.get(ORIGINAL_SAVE_KEY)).toBe(source);
  });

  it("declining keeps both slots intact and offers again next boot", () => {
    const source = lostMoneyV12();
    const files = new Map<string, string>([[STORAGE_KEY, source]]);
    app = boot(undefined, false, new SharedSave(mapStorage(files)));
    document.getElementById("recovery-decline")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.recovery).toBeNull();
    expect(app.ui.modal).toBeNull();
    expect(app.state.sessionRecords).toHaveLength(0);
    expect(files.get(STORAGE_KEY)).toBe(source);
    expect(files.get(ORIGINAL_SAVE_KEY) ?? null).toBeNull();
    // The next boot offers the same choice again.
    const second = boot(undefined, false, new SharedSave(mapStorage(files)));
    expect(second.ui.recovery).toMatchObject({ from: "boot" });
    expect(second.ui.modal).toBe("recovery");
  });

  it("an existing lineage backup archives when the recovery retains its source bytes", () => {
    const source = lostMoneyV12();
    const earlier = serialize({ ...createInitialState(), nous: 7 }, 100);
    const files = new Map<string, string>([[STORAGE_KEY, source], [ORIGINAL_SAVE_KEY, earlier]]);
    app = boot(undefined, false, new SharedSave(mapStorage(files)));
    document.getElementById("recovery-apply")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.retainedOriginal()).toBe(source);
    expect(files.get(PRE_V13_ORIGINAL_SAVE_KEY)).toBe(earlier);
  });

  it("a backup failure fails the recovery honestly: both slots stand, the source stays protected", () => {
    const source = lostMoneyV12();
    const earlier = serialize(createInitialState(), 100);
    const files = new Map<string, string>([[STORAGE_KEY, source], [ORIGINAL_SAVE_KEY, earlier]]);
    const storage: SaveStorage = {
      getItem: (key) => files.get(key) ?? null,
      setItem: (key, value) => {
        if (key === PRE_V13_ORIGINAL_SAVE_KEY) throw new Error("quota exceeded");
        files.set(key, value);
      },
    };
    app = boot(undefined, false, new SharedSave(storage));
    document.getElementById("recovery-apply")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    // The failure explains itself in the offer; nothing was adopted.
    expect(app.ui.recovery).not.toBeNull();
    expect(app.ui.modal).toBe("recovery");
    expect(document.getElementById("modal-content")!.textContent).toContain("could not be retained");
    expect(app.state.sessionRecords).toHaveLength(0);
    expect(files.get(STORAGE_KEY)).toBe(source);
    expect(files.get(ORIGINAL_SAVE_KEY)).toBe(earlier);
    app.save(Date.now(), true);
    expect(files.get(STORAGE_KEY)).toBe(source);
  });

  it("an imported lost save offers recovery at the import destination; declining returns there", () => {
    app = boot(undefined, false, new SharedSave(localStorage));
    const source = lostMoneyV12();
    expect(app.importText(source)).toBe(false);
    // The offer stands where the import stood, and nothing was adopted.
    expect(app.ui.modal).toBe("recovery");
    expect(app.ui.recovery).toMatchObject({ from: "import" });
    expect(localStorage.getItem(STORAGE_KEY)).not.toBe(source);
    expect(localStorage.getItem(ORIGINAL_SAVE_KEY)).toBeNull();
    // Declining hands the screen back to the import walk, its message
    // standing; the state and both slots are untouched.
    document.getElementById("recovery-decline")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.modal).toBe("import");
    expect(app.ui.importError).toContain("recovery");
    expect(app.ui.recovery).toBeNull();
    const before = serialize(app.state, 1000);
    expect(serialize(app.state, 1000)).toBe(before);
  });

  it("an imported lost save applies through the same door: exact source bytes retained first", () => {
    app = boot(undefined, false, new SharedSave(localStorage));
    const source = lostMoneyV12();
    expect(app.importText(source)).toBe(false);
    document.getElementById("recovery-apply")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.modal).toBeNull();
    expect(app.ui.recovery).toBeNull();
    expect(localStorage.getItem(ORIGINAL_SAVE_KEY)).toBe(source);
    expect(app.state.nous).toBe(BALANCE.openingGrant);
    expect(app.state.eraEarned).toBe(0);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.version).toBe(13);
  });

  it("closing the offer counts as declining", () => {
    const source = lostMoneyV12();
    const files = new Map<string, string>([[STORAGE_KEY, source]]);
    app = boot(undefined, false, new SharedSave(mapStorage(files)));
    app.closeModal();
    expect(app.ui.recovery).toBeNull();
    expect(app.ui.modal).toBeNull();
    expect(files.get(STORAGE_KEY)).toBe(source);
  });
});
