import { expect, it } from "vitest";
import { buyCatalogEntry, joinRollPool, chooseMutatorRoll, unlockMutatorSlot, placeMutator, returnMutator, combineMutators, chooseRoll, reshapeCells, skipRoll, placeModule, upgradeModuleLevels, upgradeAll } from "./actions";
import { createInitialState, createModule } from "./state";
import { deserialize, serialize } from "./save";
import { syncRates } from "./economy";
import { addMutatorForgeProgress, generateOffer, generateSpecialOffer } from "./rolls";
import { hex } from "./hex";

it("retired Mutator actions refuse without spending, granting, placing or consuming pending choices", () => {
  const state = createInitialState();
  state.arete = 100;
  state.catalogEntryOwned = true;
  state.rollPoolJoined = true;
  state.mutatorSlots = [hex(0, 0)];
  state.mutators = [{ id: "legacy", family: "power", rarity: "common", pos: null }];
  state.bankedMutatorRolls = [{ id: "pending", candidates: [{ id: "a", family: "power", rarity: "common" }, { id: "b", family: "charge", rarity: "rare" }] }];
  const before = structuredClone(state);
  for (const act of [() => buyCatalogEntry(state), () => joinRollPool(state), () => chooseMutatorRoll(state, "pending", "a"), () => unlockMutatorSlot(state, hex(1, 0)), () => placeMutator(state, "legacy", hex(0, 0)), () => returnMutator(state, "legacy"), () => combineMutators(state, "legacy")]) {
    expect(act()).toEqual({ ok: false, reason: "Mutators are retired." });
    expect(state).toEqual(before);
  }
});

it("legacy load retires copies, slots, rolls, Forge and flags without resetting the era or refunding", () => {
  const state = createInitialState();
  state.nous = 12345; state.arete = 17; state.eraEarned = 9000000;
  state.modules[0]!.level = 7;
  state.catalogEntryOwned = true; state.rollPoolJoined = true;
  state.mutatorSlots = [hex(0, 0)];
  state.mutators = [{ id: "legacy", family: "power", rarity: "rare", pos: hex(0, 0) }];
  state.mutatorForge = { progress: 900, earned: 8 };
  state.modules.push(createModule(state, "mutatorForge"));
  state.bankedMutatorRolls = [{ id: "pending", candidates: [{ id: "a", family: "power", rarity: "common" }, { id: "b", family: "charge", rarity: "rare" }] }];
  state.world.unlocked = true; state.world.starterColumnGranted = true; state.world.starterWeaponGranted = true;
  state.world.columns = [{ id: "column", pos: hex(0, 0) }];
  state.bankedRolls = [{ id: "mixed-legacy", candidates: [{ id: "forge", type: "mutatorForge", tier: 0 }, { id: "module", type: "additive", tier: 1 }, { id: "world", type: "column" }] }];
  const loaded = deserialize(serialize(state, 1000)).state!;
  expect(loaded.nous).toBe(12345); expect(loaded.arete).toBe(17); expect(loaded.eraEarned).toBe(9000000);
  expect(loaded.modules).toEqual(state.modules.filter(m => m.type !== "mutatorForge"));
  expect(loaded.world).toEqual(state.world);
  expect(loaded.mutators).toEqual([]); expect(loaded.mutatorSlots).toEqual([]);
  expect(loaded.bankedMutatorRolls).toEqual([]); expect(loaded.mutatorForge).toEqual({ progress: 0, earned: 0 });
  expect(loaded.catalogEntryOwned).toBe(false); expect(loaded.rollPoolJoined).toBe(false);
  expect(loaded.bankedRolls).toEqual(state.bankedRolls);
  expect(chooseRoll(loaded, "mixed-legacy", "forge").ok).toBe(false);
  expect(loaded.bankedRolls).toEqual(state.bankedRolls);
  expect(deserialize(serialize(loaded, 2000)).state).toEqual(loaded);
});

it("lost retired Forge fill and investment do not force monetary recovery", () => {
  const raw = JSON.parse(serialize(createInitialState(), 1000));
  raw.version = 12;
  raw.state.mutatorForge.progress = null;
  raw.state.modules.push({ id: "retired", type: "mutatorForge", pos: null, tier: 0, level: 0, invested: null, reserve: null });
  const result = deserialize(JSON.stringify(raw));
  expect(result.error).toBeUndefined();
  expect(result.state!.mutatorForge).toEqual({ progress: 0, earned: 0 });
});

it("retired Forge candidates cannot inflate a preserved offer's skip payout", () => {
  const state = createInitialState();
  state.bankedRolls = [{ id: "old-offer", candidates: [{ id: "legacy", type: "mutatorForge", tier: 20 }, { id: "live", type: "additive", tier: 0 }, { id: "support", type: "infusor", tier: 0 }] }];
  expect(skipRoll(state, "old-offer")).toMatchObject({ ok: true, scrap: 5 });
  expect(state.scrap).toBe(5);
});

it("retained Forge copies cannot place, upgrade, or join a bulk purchase", () => {
  const state = createInitialState();
  const forge = createModule(state, "mutatorForge");
  state.modules = [forge]; state.nous = 100;
  const before = structuredClone(state);
  expect(placeModule(state, forge.id, state.cells[0]!).ok).toBe(false);
  expect(upgradeModuleLevels(state, forge.id, 1).ok).toBe(false);
  expect(upgradeAll(state, 1).ok).toBe(false);
  expect(state).toEqual(before);
});

it("retained in-memory Mutators cannot affect production, forge progress, draft pools or reshape gates", () => {
  const state = createInitialState();
  state.modules[0]!.pos = state.cells[0]!;
  const baseline = syncRates(state).rate;
  expect(baseline).toBeGreaterThan(0);
  state.catalogEntryOwned = true; state.rollPoolJoined = true;
  for (const family of ["power", "charge", "resonance"] as const) {
    state.mutators = [{ id: "legacy", family, rarity: "rare", pos: state.modules[0]!.pos }];
    expect(syncRates(state).rate).toBe(baseline);
  }
  state.mutatorSlots = [hex(99, 99)];
  expect(reshapeCells(state, state.cells).ok).toBe(true);
  expect(addMutatorForgeProgress(state, 1e9)).toBe(0);
  expect(state.bankedMutatorRolls).toEqual([]);
  expect(state.mutatorForge).toEqual({ progress: 0, earned: 0 });
  const rig = createInitialState();
  const generator = createModule(rig, "focusKeyed");
  generator.pos = hex(0, 0); generator.reserve = 100;
  const retiredForge = createModule(rig, "mutatorForge");
  retiredForge.pos = hex(1, 0);
  rig.modules = [generator, retiredForge];
  expect(syncRates(rig, true).mutatorForgeRate).toBe(0);
  const liveForge = createModule(rig, "forge"); liveForge.pos = hex(1, 0);
  rig.modules = [generator, liveForge];
  expect(syncRates(rig, true).forgeRate).toBeGreaterThan(0);
  for (let i = 0; i < 100; i++) {
    expect(generateOffer(state, () => i / 100).candidates.some(c => c.type === "mutatorForge")).toBe(false);
    expect(generateSpecialOffer(state, "category", "forge", () => i / 100).candidates.some(c => c.type === "mutatorForge")).toBe(false);
  }
});
