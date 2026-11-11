import { expect, it } from "vitest";
import { fresh, stubRng } from "./fixtures";
import { generateOffer } from "./rolls";
import { chooseRoll, prestige, skipRoll, useSpecialDraft } from "./actions";
import { CATEGORY_OF, TYPE_RARITY } from "./constants";
import { isModuleCandidate } from "./types";
import { skipPayoutOf } from "./scrap";
import { deserialize, serialize } from "./save";

it("ordinary World replacement uses the exact quarter boundary and equal type split only after discovery", () => {
  // Nine module draws retain the existing band/category/type policy.
  const draw = (unlocked: boolean, chance: number, split: number) => {
    const s = fresh();
    s.world.unlocked = unlocked;
    return generateOffer(s, stubRng([...Array(9).fill(0.5), chance, split])).candidates;
  };
  expect(draw(false, 0, 0).every(c => c.type !== "column" && c.type !== "chargeBlade")).toBe(true);
  expect(draw(true, 0.25, 0).every(c => c.type !== "column" && c.type !== "chargeBlade")).toBe(true);
  expect(draw(true, 0.25 - 1e-9, 0.5 - 1e-9).map(c => c.type)).toEqual(["field", "spotlight", "column"]);
  expect(draw(true, 0, 0.5).map(c => c.type)).toEqual(["field", "spotlight", "chargeBlade"]);
});

it.each([0, 0.25 - 1e-9, 0.25, 0.25 + 1e-9, 1 - 1e-9])("ordinary offers retain at least two weighted module candidates at chance %f", (chance) => {
  const s = fresh();
  s.draftTierBonus = 1;
  const moduleDraws = [0.0, 0.0, 0.0, 0.0, 0.5, 0.5, 0.5, 0.99, 0.5, 0.95, 0.5, 0.0];
  const before = generateOffer(s, stubRng(moduleDraws));
  s.world.unlocked = true;
  const mixed = generateOffer(s, stubRng([...moduleDraws, chance, 1 - 1e-9]));
  const modules = mixed.candidates.filter(isModuleCandidate);
  expect(modules).toHaveLength(chance < 0.25 ? 2 : 3);
  expect(modules.map(c => [c.type, c.tier])).toEqual(before.candidates.slice(0, modules.length).map(c => isModuleCandidate(c) ? [c.type, c.tier] : null));
  if (chance < 0.25) expect(mixed.candidates[2]).toEqual({ id: mixed.candidates[2].id, type: "chargeBlade" });
});

it("mixed replacement preserves the opening roll's oscillator guarantee", () => {
  const s = fresh();
  s.world.unlocked = true;
  s.forge.earned = 1;
  const offer = generateOffer(s, stubRng([...Array(9).fill(0.5), 0, 0]));
  expect(offer.candidates.map(c => c.type)).toEqual(["column", "spotlight", "additive"]);
});

it("World selection grants repeated unplaced copies once and preserves pending offers on reload", () => {
  const s = fresh();
  s.world.unlocked = true;
  s.world.starterColumnGranted = true;
  s.world.starterWeaponGranted = true;
  const modules = structuredClone(s.modules);
  for (const split of [0, 0, 0.5, 0.5]) {
    const offer = generateOffer(s, stubRng([...Array(9).fill(0.5), 0, split]));
    s.bankedRolls.push(offer);
    const loaded = deserialize(serialize(s, 1_000)).state!;
    expect(loaded.bankedRolls).toEqual(s.bankedRolls);
    const choice = offer.candidates[2];
    expect(chooseRoll(s, offer.id, choice.id).ok).toBe(true);
    expect(chooseRoll(s, offer.id, choice.id).ok).toBe(false);
  }
  expect(s.modules).toEqual(modules);
  expect(s.world.columns).toHaveLength(2);
  expect(s.world.weapons).toHaveLength(2);
  expect([...s.world.columns, ...s.world.weapons].every(c => c.pos === null)).toBe(true);
  expect(new Set([...s.world.columns, ...s.world.weapons].map(c => c.id)).size).toBe(4);
  const loaded = deserialize(serialize(s, 2_000)).state!;
  expect(loaded.world).toEqual(s.world);
});

it("unlock and old-save translation preserve existing offers while fresh special drafts retain every guarantee", () => {
  const s = fresh();
  const pending = generateOffer(s, stubRng(Array(9).fill(0.5)));
  s.bankedRolls.push(pending);
  s.eraEarned = 20_000_000;
  expect(prestige(s).ok).toBe(true);
  expect(s.world.unlocked).toBe(true);
  expect(s.bankedRolls).toEqual([pending]);
  const raw = JSON.parse(serialize(s, 1_000));
  delete raw.state.world.unlocked;
  delete raw.state.world.starterColumnGranted;
  const loaded = deserialize(JSON.stringify(raw)).state!;
  expect(loaded.bankedRolls).toEqual([pending]);
  expect(deserialize(serialize(loaded, 2_000)).state!.bankedRolls).toEqual([pending]);
  loaded.mergeCapPurchases = 1;
  for (const kind of ["category", "rare", "tier"] as const) {
    loaded.specialDrafts[kind] = 1;
    expect(useSpecialDraft(loaded, kind, "generator", () => 0).ok).toBe(true);
    const special = loaded.bankedRolls.at(-1)!;
    expect(special.candidates.every(isModuleCandidate)).toBe(true);
    for (const candidate of special.candidates) {
      if (!isModuleCandidate(candidate)) throw new Error("Special draft lost its module guarantee");
      if (kind === "category") expect(CATEGORY_OF[candidate.type]).toBe("generator");
      if (kind === "rare") expect(TYPE_RARITY[candidate.type]).toBe("rare");
      if (kind === "tier") expect(candidate.tier).toBeGreaterThanOrEqual(1);
    }
    expect(deserialize(serialize(loaded, 3_000)).state!.bankedRolls).toEqual(loaded.bankedRolls);
  }
});

it("mixed offers retain the module skip payout and refuse invalid or locked selection without grants", () => {
  const s = fresh();
  s.world.unlocked = true;
  const offer = generateOffer(s, stubRng([...Array(9).fill(0.5), 0, 0]));
  s.bankedRolls.push(offer);
  const before = serialize(s, 1_000);
  expect(chooseRoll(s, offer.id, "missing").ok).toBe(false);
  expect(serialize(s, 1_000)).toBe(before);
  s.mode = "flow";
  expect(chooseRoll(s, offer.id, offer.candidates[2].id).ok).toBe(false);
  s.mode = "upgrade";
  expect(skipPayoutOf(offer)).toBe(5);
  expect(skipRoll(s, offer.id).ok).toBe(true);
  expect(skipRoll(s, offer.id).ok).toBe(false);
  expect(s.scrap).toBe(5);
  expect(s.world.columns).toHaveLength(0);
});
