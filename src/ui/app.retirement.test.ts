// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it } from "vitest";
import { createAppFixture } from "./testing/app-fixture";
import { createInitialState, createModule } from "../engine/state";
import { serialize, STORAGE_KEY } from "../engine/save";

const fixture = createAppFixture();
beforeEach(() => localStorage.clear());
afterEach(() => fixture.release());

it("loading legacy pending mechanics exposes only live Catalog and Forge choices and preserves progression on reload", () => {
  const old = createInitialState();
  old.arete = 19; old.nous = 12345; old.eraEarned = 9000000;
  old.catalogEntryOwned = true; old.rollPoolJoined = true;
  old.world.unlocked = true; old.world.starterColumnGranted = true; old.world.starterWeaponGranted = true;
  old.world.columns = [{ id: "retained-column", pos: old.cells[1]! }];
  old.world.weapons = [{ id: "retained-blade", type: "chargeBlade", pos: old.cells[2]!, store: 9, cooldown: 0, targetPriority: [] }];
  old.world.hone.chargeBlade = 1;
  old.mutatorSlots = [old.cells[0]!];
  old.mutators = [{ id: "old", family: "power", rarity: "rare", pos: old.cells[0]! }];
  old.modules.push(createModule(old, "mutatorForge"));
  old.mutatorForge = { progress: 900, earned: 5 };
  old.bankedMutatorRolls = [{ id: "old-roll", candidates: [{ id: "a", family: "power", rarity: "common" }, { id: "b", family: "charge", rarity: "rare" }] }];
  old.bankedRolls = [{ id: "ordinary", candidates: [{ id: "retired", type: "mutatorForge", tier: 0 }, { id: "live", type: "additive", tier: 1 }, { id: "other", type: "spacer", tier: 0 }] }];
  localStorage.setItem(STORAGE_KEY, serialize(old, Date.now()));
  let app = fixture.boot();
  app.openModal("catalog");
  document.querySelector<HTMLButtonElement>('[data-catalog-face="arete"]')!.click();
  expect(document.getElementById("modal-content")!.textContent).not.toMatch(/Mutator|Accelerator|Module Types/);
  app.closeModal();
  app.openModal("forge");
  expect(document.querySelector('[data-forge-face="mutators"]')).toBeNull();
  expect(document.querySelector('[data-choice="retired"]')).toBeNull();
  document.querySelector<HTMLButtonElement>('[data-choice="live"]')!.click();
  expect(app.ui.modal).toBeNull();
  expect(app.state.modules.at(-1)!.type).toBe("additive");
  expect(app.state.modules.at(-1)!.tier).toBe(1);
  expect(app.state.arete).toBe(19); expect(app.state.nous).toBe(12345);
  const saved = serialize(app.state, Date.now());
  fixture.release();
  localStorage.setItem(STORAGE_KEY, saved);
  app = fixture.boot();
  expect(app.state.modules.some(m => m.type === "mutatorForge")).toBe(false);
  expect(app.state.bankedMutatorRolls).toEqual([]);
  expect(app.state.eraEarned).toBe(9000000);
  expect(app.state.world).toEqual(old.world);
  app.openModal("forge");
  expect(document.getElementById("modal-content")!.textContent).not.toMatch(/Mutator|mutator/);
});
