// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it } from "vitest";
import { createAppFixture, setAppWidth } from "./testing/app-fixture";
import { generateOffer } from "../engine/rolls";
import { stubRng } from "../engine/fixtures";
import { serialize, STORAGE_KEY } from "../engine/save";
import { isModuleCandidate } from "../engine/types";
import { TYPE_RARITY } from "../engine/constants";

const fixture = createAppFixture();
beforeEach(() => localStorage.clear());
afterEach(() => fixture.release());

it.each([1280, 390])("mixed drafts route repeated World choices through inventory inspection and placement at %ipx", (width) => {
  let app = fixture.boot();
  setAppWidth(width);
  app.state.world.unlocked = true;
  app.state.world.starterColumnGranted = true;
  app.state.world.starterWeaponGranted = true;
  const moduleCount = app.state.modules.length;
  for (const split of [0, 0, 0.5, 0.5]) {
    const offer = generateOffer(app.state, stubRng([...Array(9).fill(0.5), 0, split]));
    app.state.bankedRolls.push(offer);
    app.openModal("forge");
    const name = split === 0 ? "Column" : "Charge Blade";
    const pick = document.querySelector<HTMLButtonElement>(`[data-choice="${offer.candidates[2].id}"]`)!;
    expect(pick.getAttribute("aria-label")).toBe(`Take ${name}`);
    expect(document.querySelector(".forge-choice-cue")!.textContent).toBe("Choose a new item");
    pick.click();
    expect(app.state.modules).toHaveLength(moduleCount);
    expect(app.state.bankedRolls).toHaveLength(0);
    app.setBoardLayer("world");
    const copies = split === 0 ? app.state.world.columns : app.state.world.weapons;
    const copy = copies.at(-1)!;
    expect(copy.pos).toBeNull();
    app.ui.inventory.collapsed = false;
    app.render();
    if (width === 390) app.openModal("inventory");
    document.querySelector<HTMLButtonElement>(`[data-world-tray="${copy.id}"]`)!.click();
    expect(document.querySelector(".inventory-detail-face")!.parentElement!.textContent).toContain(name);
    document.querySelector<HTMLButtonElement>(`[data-world-place="${copy.id}"]`)!.click();
    app.worldPickCell(app.state.cells[0]!);
    expect(copy.pos).toEqual(app.state.cells[0]);
    app.worldRetrieve(copy.id);
    expect(copy.pos).toBeNull();
  }
  const world = structuredClone(app.state.world);
  const save = serialize(app.state, Date.now());
  fixture.release();
  localStorage.setItem(STORAGE_KEY, save);
  app = fixture.boot();
  expect(app.state.world).toEqual(world);
  expect(app.state.world.columns).toHaveLength(2);
  expect(app.state.world.weapons).toHaveLength(2);
});

it("Blade draft charge disclosure opens by focus and touch and dismisses without consuming the offer", () => {
  const app = fixture.boot();
  app.state.world.unlocked = true;
  const offer = generateOffer(app.state, stubRng([...Array(9).fill(0.5), 0, 0.5]));
  app.state.bankedRolls.push(offer);
  app.openModal("forge");
  const term = document.querySelector<HTMLButtonElement>(`#forge-effect-${offer.candidates[2].id} [aria-label="charge — what it means"]`)!;
  expect(term).not.toBeNull();
  term.focus();
  expect(term.getAttribute("aria-expanded")).toBe("true");
  term.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect(term.getAttribute("aria-expanded")).toBe("false");
  term.click();
  expect(term.getAttribute("aria-expanded")).toBe("true");
  term.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect(term.getAttribute("aria-expanded")).toBe("false");
  expect(app.state.bankedRolls).toEqual([offer]);
  expect(app.state.world.weapons).toHaveLength(0);
});

it("reload preserves a pending mixed choice and the unlocked Catalog's special draft remains guaranteed", () => {
  let app = fixture.boot();
  app.state.world.unlocked = true;
  app.state.world.starterColumnGranted = true;
  app.state.world.starterWeaponGranted = true;
  const pending = generateOffer(app.state, stubRng([...Array(9).fill(0.5), 0, 0.5]));
  app.state.bankedRolls.push(pending);
  const save = serialize(app.state, Date.now());
  fixture.release();
  localStorage.setItem(STORAGE_KEY, save);
  app = fixture.boot();
  expect(app.state.bankedRolls).toEqual([pending]);
  app.openModal("forge");
  document.querySelector<HTMLButtonElement>(`[data-choice="${pending.candidates[2].id}"]`)!.click();
  expect(app.state.world.weapons).toHaveLength(1);
  app.state.specialDrafts.rare = 1;
  app.openModal("catalog");
  document.querySelector<HTMLButtonElement>('[data-catalog-face="scrap"]')!.click();
  document.querySelector<HTMLButtonElement>('[data-roll-special="rare"]')!.click();
  const special = app.state.bankedRolls.at(-1)!;
  expect(special.candidates.every(c => isModuleCandidate(c) && TYPE_RARITY[c.type] === "rare")).toBe(true);
  app.openModal("forge");
  expect(document.querySelector(".forge-offer-note")!.textContent).toContain("Silk Warp");
  expect(document.querySelectorAll('[data-choice]')).toHaveLength(3);
  expect(document.querySelector('[aria-label="Take Column"]')).toBeNull();
  expect(document.querySelector('[aria-label="Take Charge Blade"]')).toBeNull();
});
