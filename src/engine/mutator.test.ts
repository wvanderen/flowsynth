import { describe, expect, it } from "vitest";
import {
  buyCatalogEntry,
  chooseMutatorRoll,
  chooseRoll,
  combineMutators,
  combineMutatorsPreview,
  placeMutator,
  returnMutator,
  unlockMutatorSlot,
  endSession,
  prestige,
  startSession,
} from "./actions";
import { ARETE_HORIZON } from "./accumulator";
import { advance } from "./advance";
import { BALANCE, MUTATOR_FAMILIES } from "./constants";
import { computeRates, mutatorMagnitude, mutatorSlotCost } from "./economy";
import { createMutator } from "./state";
import { fresh, give, stubRng } from "./fixtures";
import { hex } from "./hex";
import type { Hex } from "./types";
import { addMutatorForgeProgress, generateMutatorOffer, generateOffer, mutatorForgeThreshold } from "./rolls";
import { deserialize, serialize } from "./save";
import type { GameState, MutatorFamily, MutatorInstance, Rarity } from "./types";

// The Mutator layer's engine (ADR-0043, issue #198): the entry's effects,
// the three families' exact terms, the one geometric rarity rule, the
// Mutator Forge's own charge-only branch minting two-candidate rolls, the
// combination gesture, the unbounded growth-constrained slot ladder — and
// all of it surviving prestige intact.

// A fresh state standing just past its first prestige: the Catalog's lock
// is the first Arete reset, so every Arete question starts here.
function banked(): GameState {
  const s = fresh();
  s.eraEarned = ARETE_HORIZON;
  prestige(s);
  return s;
}

// A mutator in the state under test, by the engine's own factory.
function mint(state: GameState, family: MutatorFamily, rarity: Rarity = "common", pos: Hex | null = null): MutatorInstance {
  const mutator = createMutator(state, family, rarity);
  mutator.pos = pos;
  state.mutators.push(mutator);
  return mutator;
}

// The entry bought and the Arete bank topped up: the mutator layer's
// standing setup.
function entered(): GameState {
  const s = banked();
  buyCatalogEntry(s);
  s.arete = 30;
  return s;
}

describe("the entry's engine effects", () => {
  it("the entry grants the Mutator Forge module to the Tray", () => {
    const s = banked();
    const before = s.modules.length;
    expect(buyCatalogEntry(s).ok).toBe(true);
    expect(s.modules).toHaveLength(before + 1);
    const forge = s.modules.at(-1)!;
    expect(forge.type).toBe("mutatorForge");
    expect(forge.rarity).toBe("common");
    expect(forge.pos).toBeNull();
  });

  it("the entry's first slot sits free on any owned cell", () => {
    const s = entered();
    expect(unlockMutatorSlot(s, hex(1, 0)).ok).toBe(true);
    expect(s.mutatorSlots).toEqual([hex(1, 0)]);
    expect(s.arete).toBe(30);
  });

  it("no slot exists before the entry, and slots need owned cells", () => {
    const s = banked();
    s.arete = 30;
    expect(unlockMutatorSlot(s, hex(1, 0)).ok).toBe(false);
    expect(s.mutatorSlots).toEqual([]);
    buyCatalogEntry(s);
    expect(unlockMutatorSlot(s, hex(2, 0)).ok).toBe(false);
    expect(s.mutatorSlots).toEqual([]);
  });

  it("a slot never duplicates, and the unlock is inert outside upgrade mode", () => {
    const s = entered();
    expect(unlockMutatorSlot(s, hex(1, 0)).ok).toBe(true);
    expect(unlockMutatorSlot(s, hex(1, 0)).ok).toBe(false);
    expect(s.mutatorSlots).toHaveLength(1);
    s.mode = "flow";
    expect(unlockMutatorSlot(s, hex(0, 1)).ok).toBe(false);
    expect(s.mutatorSlots).toHaveLength(1);
  });
});

describe("the power family", () => {
  it("raises its host's final ν/s exactly × (1 + m)", () => {
    const s = fresh();
    const synth = give(s, "additive", hex(2, 0));
    const before = computeRates(s, false).contributions.get(synth.id)!.value;
    mint(s, "power", "common", hex(2, 0));
    const after = computeRates(s, false).contributions.get(synth.id)!.value;
    expect(after / before).toBeCloseTo(1 + mutatorMagnitude("power", "common"));
    // The rare tier: the same ×4 on the base magnitude.
    s.mutators[0]!.rarity = "rare";
    expect(computeRates(s, false).contributions.get(synth.id)!.value / before).toBeCloseTo(1 + mutatorMagnitude("power", "rare"));
  });

  it("feeds Forge progress: strength × boosted power", () => {
    const s = fresh();
    give(s, "forge", hex(2, 0));
    give(s, "focusKeyed", hex(1, 0));
    s.chargeWindow = 100;
    const plain = computeRates(s, true).forgeRate;
    mint(s, "power", "common", hex(2, 0));
    const boosted = computeRates(s, true).forgeRate;
    expect(plain).toBeCloseTo(1);
    expect(boosted / plain).toBeCloseTo(1 + mutatorMagnitude("power", "common"));
  });

  it("boosts a Mutator Forge's own branch — intended, not a bug", () => {
    const s = fresh();
    give(s, "mutatorForge", hex(2, 0));
    give(s, "focusKeyed", hex(1, 0));
    s.chargeWindow = 100;
    const plain = computeRates(s, true).mutatorForgeRate;
    mint(s, "power", "common", hex(2, 0));
    const boosted = computeRates(s, true).mutatorForgeRate;
    expect(plain).toBeCloseTo(1);
    expect(boosted).toBeCloseTo(1 * (1 + mutatorMagnitude("power", "common")));
    expect(computeRates(s, true).forgeRate).toBe(0);
  });

  it("rides the generator's output strength", () => {
    const s = fresh();
    const synth = s.modules[0]!; // the starter synth at (0,0)
    give(s, "focusKeyed", hex(1, 0));
    s.chargeWindow = 100;
    expect(computeRates(s, true).chargeStrength.get(synth.id)).toBeCloseTo(1);
    mint(s, "power", "common", hex(1, 0));
    expect(computeRates(s, true).chargeStrength.get(synth.id)).toBeCloseTo(1 + mutatorMagnitude("power", "common"));
  });

  it("rides the infusor uplift", () => {
    const s = fresh();
    const synth = s.modules[0]!;
    give(s, "infusor", hex(1, 0));
    give(s, "focusKeyed", hex(2, 0));
    s.chargeWindow = 100;
    // 0.2 × power 1 × chargedFactor(strength 1): the plain uplift.
    expect(computeRates(s, true).contributions.get(synth.id)!.infusorBonus).toBeCloseTo(BALANCE.infusorBonus * 1.5);
    mint(s, "power", "common", hex(1, 0));
    // The power mutator rides the uplift: ×(1 + m) on the infusor's power.
    expect(computeRates(s, true).contributions.get(synth.id)!.infusorBonus).toBeCloseTo(BALANCE.infusorBonus * 1.5 * 1.5);
  });
});

describe("the resonance family", () => {
  // A Fifth across (2,0)·D and (3,0)·A — the starter synth at (0,0) sings
  // alone in its own cluster, far from both.
  function chorded(): { s: GameState; a: ReturnType<typeof give>; b: ReturnType<typeof give> } {
    const s = fresh();
    const a = give(s, "additive", hex(2, 0));
    const b = give(s, "additive", hex(3, 0));
    return { s, a, b };
  }

  it("multiplies a chorded host's chord factor, its neighbor's untouched", () => {
    const { s, a, b } = chorded();
    mint(s, "resonance", "common", hex(2, 0));
    const snapshot = computeRates(s, false);
    const ca = snapshot.contributions.get(a.id)!;
    const cb = snapshot.contributions.get(b.id)!;
    // A Fifth's ×1.3, folded ×1.5 on the hosted voice alone.
    expect(ca.chordFactor).toBeCloseTo(1.3 * 1.5);
    expect(cb.chordFactor).toBeCloseTo(1.3);
    expect(ca.value / cb.value).toBeCloseTo(1.5);
    expect(snapshot.namedChords[0]!.bonus).toBeCloseTo(0.3);
  });

  it("is inert on a chordless host", () => {
    const s = fresh();
    const lone = give(s, "additive", hex(5, 0));
    const before = computeRates(s, false).contributions.get(lone.id)!.value;
    mint(s, "resonance", "rare", hex(5, 0));
    const snapshot = computeRates(s, false);
    expect(snapshot.contributions.get(lone.id)!.value).toBe(before);
    expect(snapshot.contributions.get(lone.id)!.chordFactor).toBe(1);
  });

  it("is inert on a spacer", () => {
    const s = fresh();
    const lone = give(s, "additive", hex(5, 0));
    const wired = give(s, "spacer", hex(4, 0));
    const before = computeRates(s, false);
    mint(s, "resonance", "rare", hex(4, 0));
    const after = computeRates(s, false);
    expect(after.contributions.get(lone.id)!.value).toBe(before.contributions.get(lone.id)!.value);
    const spacerAfter = after.contributions.get(wired.id)!;
    expect(spacerAfter.value).toBe(0);
    expect(spacerAfter.chordFactor).toBeNull();
  });

  it("leaves the Conditional's per-instance bonus untouched", () => {
    const s = fresh();
    const a = give(s, "conditional", hex(2, 0));
    give(s, "additive", hex(3, 0));
    const plain = computeRates(s, false).contributions.get(a.id)!;
    expect(plain.chordTerms).toBe(1);
    mint(s, "resonance", "common", hex(2, 0));
    const folded = computeRates(s, false).contributions.get(a.id)!;
    expect(folded.chordTerms).toBe(plain.chordTerms);
    expect(folded.value / plain.value).toBeCloseTo(1 + mutatorMagnitude("resonance", "common"));
  });
});

describe("the charge family", () => {
  it("multiplies received strength before the curve, and is inert while uncharged", () => {
    const s = fresh();
    const synth = s.modules[0]!; // the starter synth at (0,0)
    give(s, "focusKeyed", hex(1, 0));
    mint(s, "charge", "common", hex(0, 0));
    // Uncharged: zero strength stays zero — the mutator never shows.
    const dry = computeRates(s, false);
    expect(dry.chargeStrength.get(synth.id)).toBe(0);
    expect(dry.contributions.get(synth.id)!.chargeFactor).toBe(1);
    // Charged: strength ×(1 + m) before chargedFactor.
    s.chargeWindow = 100;
    const wet = computeRates(s, true);
    const strength = wet.chargeStrength.get(synth.id)!;
    expect(strength).toBeCloseTo(1 + mutatorMagnitude("charge", "common"));
    expect(wet.contributions.get(synth.id)!.chargeFactor).toBeCloseTo(1 + strength / (1 + strength));
  });

  it("feeds the host's charge leg and the strength side of infusor bonuses", () => {
    const s = fresh();
    const synth = s.modules[0]!;
    give(s, "infusor", hex(1, 0));
    give(s, "focusKeyed", hex(2, 0));
    s.chargeWindow = 100;
    const plain = computeRates(s, true).contributions.get(synth.id)!.infusorBonus;
    expect(plain).toBeCloseTo(BALANCE.infusorBonus * (1 + 1 / 2));
    mint(s, "charge", "common", hex(1, 0));
    const fed = computeRates(s, true).contributions.get(synth.id)!.infusorBonus;
    expect(fed).toBeCloseTo(BALANCE.infusorBonus * (1 + 1.5 / 2.5));
  });

  it("scales what a Mutator Forge receives", () => {
    const s = fresh();
    give(s, "mutatorForge", hex(2, 0));
    give(s, "focusKeyed", hex(1, 0));
    s.chargeWindow = 100;
    const plain = computeRates(s, true).mutatorForgeRate;
    mint(s, "charge", "common", hex(2, 0));
    const fed = computeRates(s, true).mutatorForgeRate;
    expect(plain).toBeCloseTo(1);
    expect(fed / plain).toBeCloseTo(1 + mutatorMagnitude("charge", "common"));
  });
});

describe("rarity is one geometric rule", () => {
  it("each family's magnitude reads ×1/×2/×4 of its base", () => {
    for (const family of MUTATOR_FAMILIES) {
      expect(mutatorMagnitude(family, "common")).toBe(BALANCE.mutatorMagnitudeBase[family]);
      expect(mutatorMagnitude(family, "uncommon")).toBe(BALANCE.mutatorMagnitudeBase[family] * 2);
      expect(mutatorMagnitude(family, "rare")).toBe(BALANCE.mutatorMagnitudeBase[family] * 4);
    }
  });
});

describe("the Mutator Forge branch", () => {
  it("keeps its own meter on its own constants, steeper than the module branch", () => {
    expect(mutatorForgeThreshold(0)).toBe(BALANCE.mutatorForgeInitialThreshold);
    expect(mutatorForgeThreshold(1)).toBe(BALANCE.mutatorForgeInitialThreshold * 2);
    expect(mutatorForgeThreshold(2)).toBe(BALANCE.mutatorForgeInitialThreshold * 4);
    expect(BALANCE.mutatorForgeThresholdGrowth).toBeGreaterThan(BALANCE.forgeThresholdGrowth);
    const s = fresh();
    addMutatorForgeProgress(s, 10);
    expect(s.mutatorForge).toEqual({ progress: 10, earned: 0 });
    expect(s.forge).toEqual({ progress: 0, earned: 0 });
    expect(s.flow).toEqual({ progress: 0, earned: 0 });
  });

  it("mints two-candidate rolls into its own queue and carries the excess", () => {
    const s = fresh();
    // charge/common, then power/common — four draws: family, rarity ×2.
    const rolls = addMutatorForgeProgress(s, BALANCE.mutatorForgeInitialThreshold + 5, stubRng([0.9, 0.5, 0.1, 0.5]));
    expect(rolls).toBe(1);
    expect(s.mutatorForge).toEqual({ progress: 5, earned: 1 });
    expect(s.bankedMutatorRolls).toHaveLength(1);
    const offer = s.bankedMutatorRolls[0]!;
    expect(offer.candidates).toHaveLength(2);
    expect(offer.candidates[0]).toMatchObject({ family: "charge", rarity: "common" });
    expect(offer.candidates[1]).toMatchObject({ family: "power", rarity: "common" });
    // The module queue and the rig's ledger stay untouched.
    expect(s.bankedRolls).toHaveLength(0);
    expect(s.forge.earned + s.flow.earned).toBe(0);
    // The next threshold sits at ×2: the carried 5 waits inside it.
    addMutatorForgeProgress(s, BALANCE.mutatorForgeInitialThreshold * 2 - 5 - 1);
    expect(s.mutatorForge.earned).toBe(1);
    addMutatorForgeProgress(s, 1);
    expect(s.mutatorForge.earned).toBe(2);
    expect(s.bankedMutatorRolls).toHaveLength(2);
  });

  it("is charge-only: practice never feeds it", () => {
    const s = fresh();
    give(s, "mutatorForge", hex(2, 0));
    give(s, "focusKeyed", hex(1, 0));
    s.chargeWindow = 30;
    startSession(s, null);
    const result = advance(s, 30);
    // strength 1 × 30 s: short of the threshold, but the meter moves —
    // while practice fills the flow meter alone.
    expect(s.mutatorForge.progress).toBeCloseTo(30);
    expect(result.rollsMutator).toBe(0);
    expect(s.flow.progress).toBeCloseTo(30);
    expect(s.forge.progress).toBe(0);
    endSession(s, 5_000);
    expect(s.mutatorForge.progress).toBeCloseTo(30);
  });

  it("the first roll lands within the first post-entry era's window", () => {
    const s = fresh();
    give(s, "mutatorForge", hex(2, 0));
    give(s, "focusKeyed", hex(1, 0));
    // One session's banked window at the launch fraction covers the first
    // threshold: strength 1 across 240 credited seconds.
    s.chargeWindow = 0.1 * 2_400;
    startSession(s, null);
    const result = advance(s, 240);
    expect(result.rollsMutator).toBe(1);
    expect(s.mutatorForge.earned).toBe(1);
    expect(s.bankedMutatorRolls).toHaveLength(1);
    expect(s.session!.rolls.mutator).toBe(1);
    endSession(s, 5_000);
    expect(s.summary!.rollsMutator).toBe(1);
  });
});

describe("the roll-pool join", () => {
  const draws = [0.99999, 0.5, 0.1, 0.5, 0.2, 0.5];

  it("appends the Mutator Forge type as one uniform entry, and only then", () => {
    const s = fresh();
    // Unjoined, the pool's last entry is still the module Forge.
    expect(generateOffer(s, stubRng(draws)).candidates[0]!.type).toBe("forge");
    const joined = fresh();
    joined.rollPoolJoined = true;
    const offer = generateOffer(joined, stubRng(draws));
    expect(offer.candidates[0]!.type).toBe("mutatorForge");
    expect(offer.candidates[0]!.rarity).toBe("common");
  });

  it("joined candidates still draw distinctly, and land as Mutator Forges", () => {
    const s = fresh();
    s.rollPoolJoined = true;
    // Three draws at the top of the pool: indices 6, 5, 4 — three
    // distinct types, the first the appended Mutator Forge.
    const offer = generateOffer(s, stubRng([0.99999, 0.5, 0.99999, 0.5, 0.99999, 0.5]));
    const types = offer.candidates.map((c) => c.type);
    expect(new Set(types).size).toBe(3);
    expect(types[0]).toBe("mutatorForge");
    s.bankedRolls.push(offer);
    expect(chooseRoll(s, offer.id, offer.candidates[0]!.id).ok).toBe(true);
    expect(s.modules.at(-1)!.type).toBe("mutatorForge");
    expect(s.modules.at(-1)!.pos).toBeNull();
  });
});

describe("mutator rolls offer two candidates", () => {
  it("family uniform, shared rarity table, no first-roll rig", () => {
    const s = fresh();
    // Draws: family 0.9→charge, rarity 0.9899→common; family 0.0→power,
    // rarity 0.9995→rare. Whatever the module side's rig state, the
    // mutator roll reads exactly these.
    s.flow.earned = 1;
    const offer = generateMutatorOffer(s, stubRng([0.9, 0.9899, 0.0, 0.9995]));
    expect(offer.candidates).toHaveLength(2);
    expect(offer.candidates[0]).toMatchObject({ family: "charge", rarity: "common" });
    expect(offer.candidates[1]).toMatchObject({ family: "power", rarity: "rare" });
    // The crossing ledger the module rig reads is the module meters' alone.
    addMutatorForgeProgress(s, BALANCE.mutatorForgeInitialThreshold);
    expect(s.forge.earned + s.flow.earned).toBe(1);
  });

  it("the choice mints the chosen candidate into the Mutator tray; the rest vanish", () => {
    const s = fresh();
    s.bankedMutatorRolls.push(generateMutatorOffer(s, stubRng([0.9, 0.5, 0.1, 0.5])));
    const offer = s.bankedMutatorRolls[0]!;
    expect(chooseMutatorRoll(s, offer.id, offer.candidates[1]!.id).ok).toBe(true);
    expect(s.bankedMutatorRolls).toHaveLength(0);
    expect(s.mutators).toHaveLength(1);
    expect(s.mutators[0]).toMatchObject({ family: "power", rarity: "common", pos: null });
  });

  it("refuses unknown offers and candidates, and acts only between sessions", () => {
    const s = fresh();
    s.bankedMutatorRolls.push(generateMutatorOffer(s, stubRng([0.9, 0.5, 0.1, 0.5])));
    const offer = s.bankedMutatorRolls[0]!;
    expect(chooseMutatorRoll(s, "nope", offer.candidates[0]!.id).ok).toBe(false);
    expect(chooseMutatorRoll(s, offer.id, "nope").ok).toBe(false);
    expect(s.mutators).toHaveLength(0);
    s.mode = "flow";
    expect(chooseMutatorRoll(s, offer.id, offer.candidates[0]!.id).ok).toBe(false);
    expect(s.bankedMutatorRolls).toHaveLength(1);
  });
});

describe("placing and retrieving mutators", () => {
  it("a tray mutator places into an unlocked slot; an occupied slot swaps", () => {
    const s = entered();
    unlockMutatorSlot(s, hex(1, 0));
    const a = mint(s, "power", "common");
    expect(placeMutator(s, a.id, hex(1, 0)).ok).toBe(true);
    expect(a.pos).toEqual(hex(1, 0));
    const b = mint(s, "charge", "rare");
    expect(placeMutator(s, b.id, hex(1, 0)).ok).toBe(true);
    expect(b.pos).toEqual(hex(1, 0));
    expect(a.pos).toBeNull();
    expect(returnMutator(s, b.id).ok).toBe(true);
    expect(b.pos).toBeNull();
  });

  it("placement needs a slot, and the grid locks during flow", () => {
    const s = entered();
    const a = mint(s, "power", "common");
    expect(placeMutator(s, a.id, hex(1, 0)).ok).toBe(false);
    unlockMutatorSlot(s, hex(1, 0));
    placeMutator(s, a.id, hex(1, 0));
    s.mode = "flow";
    expect(returnMutator(s, a.id).ok).toBe(false);
    expect(placeMutator(s, a.id, hex(0, 0)).ok).toBe(false);
    expect(a.pos).toEqual(hex(1, 0));
  });
});

describe("mutator combination", () => {
  it("two of a family and rarity yield the next rarity, same family", () => {
    const s = fresh();
    const a = mint(s, "power", "common");
    const b = mint(s, "power", "common");
    expect(combineMutators(s, a.id, b.id).ok).toBe(true);
    expect(s.mutators).toHaveLength(1);
    expect(s.mutators[0]).toMatchObject({ id: b.id, family: "power", rarity: "uncommon" });
    // The module counter counts modules; a mutator pair is not one.
    expect(s.combinations).toBe(0);
    expect(s.nous).toBe(BALANCE.openingGrant);
  });

  it("the kept copy is the drop target, board or tray", () => {
    const s = fresh();
    s.mutatorSlots.push(hex(2, 0), hex(3, 0));
    const a = mint(s, "resonance", "common", hex(2, 0));
    const b = mint(s, "resonance", "common", hex(3, 0));
    expect(combineMutators(s, a.id, b.id).ok).toBe(true);
    expect(s.mutators[0]).toMatchObject({ id: b.id, rarity: "uncommon", pos: hex(3, 0) });
    // Tray direction: the target waits in the tray, the result stays there.
    const c = mint(s, "resonance", "uncommon");
    expect(combineMutators(s, b.id, c.id).ok).toBe(true);
    expect(s.mutators).toHaveLength(1);
    expect(s.mutators[0]).toMatchObject({ id: c.id, rarity: "rare", pos: null });
  });

  it("finds its own twin, refuses mismatches, and rares refuse", () => {
    const s = fresh();
    const a = mint(s, "charge", "common");
    const b = mint(s, "charge", "common");
    expect(combineMutators(s, a.id).ok).toBe(true);
    expect(s.mutators[0]!.rarity).toBe("uncommon");
    // The auto-found twin stands in the target's seat: keep = partner.
    expect(s.mutators[0]!.id).toBe(b.id);
    expect(combineMutators(s, s.mutators[0]!.id).ok).toBe(false);
    const c = mint(s, "charge", "uncommon");
    const d = mint(s, "power", "uncommon");
    expect(combineMutators(s, c.id, d.id).ok).toBe(false);
    d.rarity = "common";
    expect(combineMutators(s, c.id, d.id).ok).toBe(false);
    // The rare pair: the highest tier combines no further.
    const e = mint(s, "charge", "rare");
    const f = mint(s, "charge", "rare");
    expect(combineMutatorsPreview(s, e.id, f.id)).toBeNull();
    expect(combineMutators(s, e.id, f.id).ok).toBe(false);
    expect(s.mutators).toHaveLength(5);
  });

  it("the preview is pure and the confirm reads it", () => {
    const s = fresh();
    const a = mint(s, "power", "common");
    const b = mint(s, "power", "common");
    const preview = combineMutatorsPreview(s, a.id, b.id);
    expect(preview).toEqual({ keepId: b.id, meltId: a.id, nextRarity: "uncommon" });
    expect(s.mutators).toHaveLength(2);
    expect(combineMutatorsPreview(s, a.id, a.id)).toBeNull();
    s.mode = "flow";
    expect(combineMutatorsPreview(s, a.id, b.id)).toBeNull();
    expect(combineMutators(s, a.id, b.id).ok).toBe(false);
  });
});

describe("the slot ladder", () => {
  it("prices ride the 2/3/5/8/12 shape and keep climbing", () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(mutatorSlotCost)).toEqual([2, 3, 5, 8, 12, 17, 23]);
  });

  it("every later unlock attaches to the patch and pays its rung", () => {
    const s = entered();
    unlockMutatorSlot(s, hex(0, 1));
    // An owned cell away from the patch refuses.
    s.cells.push(hex(3, 0), hex(1, 1), hex(2, 0));
    expect(unlockMutatorSlot(s, hex(3, 0)).ok).toBe(false);
    expect(s.mutatorSlots).toHaveLength(1);
    // An adjacent owned cell pays the first rung.
    expect(unlockMutatorSlot(s, hex(1, 0)).ok).toBe(true);
    expect(s.arete).toBe(28);
    // The ladder escalates with the count already unlocked.
    expect(unlockMutatorSlot(s, hex(1, 1)).ok).toBe(true);
    expect(s.arete).toBe(25);
    expect(s.mutatorSlots).toHaveLength(3);
    // A short bank refuses and touches nothing.
    s.arete = 2;
    expect(unlockMutatorSlot(s, hex(2, 0)).ok).toBe(false);
    expect(s.mutatorSlots).toHaveLength(3);
  });
});

describe("the mutator layer survives prestige", () => {
  it("slots, mutators, the branch meter, and the pending rolls persist", () => {
    const s = entered();
    unlockMutatorSlot(s, hex(0, 1));
    unlockMutatorSlot(s, hex(1, 0));
    s.mutatorForge = { progress: 100, earned: 2 };
    const placed = mint(s, "power", "uncommon", hex(1, 0));
    mint(s, "charge", "common");
    s.bankedMutatorRolls.push({
      id: "mo1",
      candidates: [
        { id: "mc1", family: "resonance", rarity: "common" },
        { id: "mc2", family: "power", rarity: "rare" },
      ],
    });
    const synth = give(s, "additive", hex(1, 0), 4);
    s.eraEarned = ARETE_HORIZON;
    expect(prestige(s).ok).toBe(true);
    expect(s.mutatorSlots).toEqual([hex(0, 1), hex(1, 0)]);
    expect(s.mutators).toHaveLength(2);
    expect(s.mutators[0]).toMatchObject({ id: placed.id, family: "power", rarity: "uncommon", pos: hex(1, 0) });
    expect(s.mutators[1]!.pos).toBeNull();
    expect(s.mutatorForge).toEqual({ progress: 100, earned: 2 });
    expect(s.bankedMutatorRolls).toHaveLength(1);
    expect(s.catalogEntryOwned).toBe(true);
    // The module side still resets — and the placed mutator still
    // multiplies its host at the base-again board.
    expect(synth.level).toBe(0);
    const withMutator = computeRates(s, false).contributions.get(synth.id)!.value;
    s.mutators = s.mutators.filter((m) => m.id !== placed.id);
    const without = computeRates(s, false).contributions.get(synth.id)!.value;
    expect(withMutator / without).toBeCloseTo(1 + mutatorMagnitude("power", "uncommon"));
  });

  it("the layer round-trips the save cleanly", () => {
    const s = entered();
    unlockMutatorSlot(s, hex(0, 1));
    mint(s, "power", "rare", hex(0, 1));
    mint(s, "resonance", "common");
    s.mutatorForge = { progress: 40, earned: 1 };
    s.bankedMutatorRolls.push(generateMutatorOffer(s, stubRng([0.9, 0.5, 0.1, 0.5])));
    const loaded = deserialize(serialize(s, 9_000));
    expect(loaded.error).toBeUndefined();
    const m = loaded.state!;
    expect(m.mutatorSlots).toEqual([hex(0, 1)]);
    expect(m.mutators).toEqual(s.mutators);
    expect(m.mutatorForge).toEqual({ progress: 40, earned: 1 });
    expect(m.bankedMutatorRolls).toEqual(s.bankedMutatorRolls);
  });
});
