import { expect, it } from "vitest";
import { createInitialState, createWeapon, createWorldColumn } from "./state";
import { deserialize, serialize } from "./save";
import { prestige, buyHoneRank, placeWorldOccupant } from "./actions";
import { attackPowerOf } from "./world";
import type { GameState } from "./types";

function oldSave(state: GameState): string {
  const file = JSON.parse(serialize(state, 5_000));
  delete file.state.world.unlocked;
  delete file.state.world.starterColumnGranted;
  return JSON.stringify(file);
}

it("zero bank, pending entitlement and Catalog ownership do not translate into World discovery", () => {
  const s = createInitialState();
  s.eraEarned = 7_000_000;
  expect(prestige(s).ok).toBe(true);
  expect(s.world.unlocked).toBe(false);
  expect(s.world.columns).toHaveLength(0);
  s.eraEarned = 20_000_000;
  s.catalogEntryOwned = true;
  s.arete = 20;
  const loaded = deserialize(oldSave(s)).state!;
  expect(loaded.world.unlocked).toBe(false);
  expect(loaded.world.columns).toHaveLength(0);
  expect(loaded.world.weapons).toHaveLength(0);
  expect(prestige(loaded).ok).toBe(true);
  expect(loaded.world.unlocked).toBe(true);
  expect(loaded.world.columns).toHaveLength(1);
  expect(loaded.world.weapons).toHaveLength(1);
});

it.each(["frontier", "starter", "collection", "hone"] as const)("translates old %s eligibility once without resetting or refunding the era", (proof) => {
  const s = createInitialState();
  s.eraEarned = 12_345_678;
  s.nous = 4_321;
  s.arete = 17;
  s.scrap = 11;
  s.modules[0]!.level = 8;
  s.bankedRolls = [{ id: "existing-offer", candidates: [
    { id: "offer-a", type: "additive", tier: 1 },
    { id: "offer-b", type: "triangle", tier: 1 },
    { id: "offer-c", type: "square", tier: 1 },
  ] }];
  if (proof === "frontier") s.world.frontier = 2;
  if (proof === "starter") s.world.starterWeaponGranted = true;
  if (proof === "hone") s.world.hone.chargeBlade = 1;
  if (proof === "collection") {
    const c = createWorldColumn(s);
    c.pos = s.cells[0]!;
    s.world.columns.push(c);
    const w = createWeapon(s, "chargeBlade");
    w.pos = s.cells[1]!;
    s.world.weapons.push(w);
  }
  const loaded = deserialize(oldSave(s)).state!;
  expect(loaded.world.unlocked).toBe(true);
  expect(loaded.world.starterColumnGranted).toBe(true);
  expect(loaded.world.columns).toHaveLength(s.world.columns.length + 1);
  expect(loaded.world.columns.at(-1)!.pos).toBeNull();
  if (proof === "collection") {
    expect(loaded.world.columns[0]).toEqual(s.world.columns[0]);
    expect(loaded.world.weapons).toEqual(s.world.weapons);
  }
  expect(loaded.eraEarned).toBe(12_345_678);
  expect(loaded.nous).toBe(4_321);
  expect(loaded.arete).toBe(17);
  expect(loaded.scrap).toBe(11);
  expect(loaded.modules).toEqual(s.modules);
  expect(loaded.bankedRolls).toEqual(s.bankedRolls);
  const again = deserialize(serialize(loaded, 6_000)).state!;
  expect(again.world).toEqual(loaded.world);
});

it("later zero and positive prestiges preserve placement and never repeat either starter grant", () => {
  const s = createInitialState();
  s.eraEarned = 20_000_000;
  expect(prestige(s).ok).toBe(true);
  const column = s.world.columns[0]!;
  const blade = s.world.weapons[0]!;
  expect(placeWorldOccupant(s, column.id, s.cells[0]!).ok).toBe(true);
  expect(placeWorldOccupant(s, blade.id, s.cells[1]!).ok).toBe(true);
  for (const depth of [7_000_000, 20_000_000, 200_000_000]) {
    s.eraEarned = depth;
    expect(prestige(s).ok).toBe(true);
    expect(s.world.unlocked).toBe(true);
    expect(s.world.columns).toEqual([column]);
    expect(s.world.weapons).toEqual([blade]);
    expect(deserialize(serialize(s, 7_000)).state!.world).toEqual(s.world);
  }
});

it("Hone requires no entry, improves current and future Blades type-wide, and persists without refund", () => {
  const s = createInitialState();
  s.arete = 5;
  const first = createWeapon(s, "chargeBlade");
  s.world.weapons.push(first);
  expect(buyHoneRank(s, "chargeBlade").ok).toBe(true);
  expect(s.arete).toBe(4);
  expect(s.catalogEntryOwned).toBe(false);
  expect(attackPowerOf(s, first.type)).toBe(6);
  const second = createWeapon(s, "chargeBlade");
  s.world.weapons.push(second);
  expect(attackPowerOf(s, second.type)).toBe(6);
  s.eraEarned = 20_000_000;
  expect(prestige(s).ok).toBe(true);
  const loaded = deserialize(serialize(s, 8_000)).state!;
  expect(loaded.world.hone.chargeBlade).toBe(1);
  expect(loaded.arete).toBe(6);
});
