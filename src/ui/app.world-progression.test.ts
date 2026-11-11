// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it } from "vitest";
import { createAppFixture } from "./testing/app-fixture";
import { createInitialState } from "../engine/state";
import { deserialize, serialize, STORAGE_KEY } from "../engine/save";

const fixture = createAppFixture();
beforeEach(() => localStorage.clear());
afterEach(() => fixture.release());

it("hides World until a confirmed positive prestige, then retains the usable kit across resets and reload", () => {
  const app = fixture.boot();
  const worldDoor = () => document.querySelector('[data-legend-layer="world"]');
  const confirmReset = () => {
    app.openLedger("arete");
    document.getElementById("prestige-door")!.click();
    document.getElementById("prestige-confirm")!.click();
  };
  app.state.arete = 20; // Catalog spending is not discovery.
  app.openModal("catalog");
  document.querySelector<HTMLButtonElement>('[data-catalog-face="arete"]')!.click();
  expect(document.getElementById("buy-arete-entry")).toBeNull();
  expect(document.getElementById("buy-world-column")).toBeNull();
  document.getElementById("buy-world-hone")!.click();
  expect(app.state.world.hone.chargeBlade).toBe(1);
  app.closeModal();
  expect(worldDoor()).toBeNull();
  app.openDetail(app.state.cells[0]!);
  expect(document.querySelector('[data-detail-face="world"]')).toBeNull();
  app.closeDetail();
  app.state.eraEarned = 7_000_000;
  confirmReset();
  expect(app.state.arete).toBe(19);
  expect(worldDoor()).toBeNull();
  app.state.eraEarned = 20_000_000;
  app.render();
  expect(worldDoor()).toBeNull(); // Pending entitlement is not discovery.
  confirmReset();
  expect(app.ui.modal).toBe("grant");
  expect(document.getElementById("modal-content")!.textContent).toContain("Column");
  app.closeModal();
  expect(worldDoor()).not.toBeNull();
  expect(app.state.catalogEntryOwned).toBe(false);
  expect(app.state.world.columns).toHaveLength(1);
  expect(app.state.world.weapons).toHaveLength(1);
  app.setBoardLayer("world");
  const column = app.state.world.columns[0]!;
  const blade = app.state.world.weapons[0]!;
  app.worldArmTray(column.id);
  app.worldPickCell(app.state.cells[0]!);
  app.worldArmTray(blade.id);
  app.worldPickCell(app.state.cells[1]!);
  expect(column.pos).toEqual(app.state.cells[0]);
  expect(blade.pos).toEqual(app.state.cells[1]);
  app.state.eraEarned = 7_000_000;
  confirmReset();
  expect(worldDoor()).not.toBeNull();
  const loaded = deserialize(serialize(app.state, 5_000)).state!;
  expect(loaded.world.unlocked).toBe(true);
  expect(loaded.world.columns).toEqual(app.state.world.columns);
  expect(loaded.world.weapons).toEqual(app.state.world.weapons);
  expect(loaded.world.hone.chargeBlade).toBe(1);
  fixture.release();
  localStorage.setItem(STORAGE_KEY, serialize(loaded, Date.now()));
  const reopened = fixture.boot();
  expect(worldDoor()).not.toBeNull();
  reopened.setBoardLayer("world");
  expect(document.querySelectorAll("[data-world-cell]").length).toBeGreaterThan(0);
});

it("loading an eligible old save discovers World and adds exactly one free Column without rewriting progression", () => {
  const old = createInitialState();
  old.world.frontier = 2;
  old.world.starterWeaponGranted = true;
  old.world.weapons.push({ id: "old-blade", type: "chargeBlade", pos: old.cells[0]!, store: 0, cooldown: 0, targetPriority: [] });
  old.world.columns.push({ id: "old-column", pos: old.cells[1]! });
  const raw = JSON.parse(serialize(old, 5_000));
  delete raw.state.world.unlocked;
  delete raw.state.world.starterColumnGranted;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
  const app = fixture.boot();
  expect(document.querySelector('[data-legend-layer="world"]')).not.toBeNull();
  expect(app.state.world.columns).toHaveLength(2);
  expect(app.state.world.columns[0]).toEqual(old.world.columns[0]);
  expect(app.state.world.columns[1]!.pos).toBeNull();
  expect(app.state.modules).toEqual(old.modules);
  expect(deserialize(serialize(app.state, 6_000)).state!.world.columns).toHaveLength(2);
});
