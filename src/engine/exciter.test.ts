import { describe, expect, it } from "vitest";
import { BALANCE, NAMED_CHORDS } from "./constants";
import { blasterConversion, boosterTermOf, chargeTermOf, chordConversionScaleOf, computeRates, displayedRates, projectPlacement } from "./economy";
import { allocationQualityOf, summaryTermsOf } from "./allocation";
import { profileAxesOf, OSCILLATOR_PROFILES } from "./profiles";
import { typeRarityOf } from "./constants";
import { syncChordDiscoveries } from "./library";
import { deserialize, serialize } from "./save";
import { fresh, give } from "./fixtures";
import { hex } from "./hex";
import { combine, placeModule, returnModule } from "./actions";
import type { GameState, ModuleInstance } from "./types";

// The charge-response booster (issue #376, parent #366): the Exciter adds
// its authored share to adjacent oscillators' charge response — the
// coefficient that scales the charged curve above ×1, the conversion
// types' alternatives included — and grants no amplitude, no base
// production, and no second charge behavior. An uncharged recipient's
// curve delta is zero, so the grant reads exactly nothing on it: the
// Exciter needs charged recipients. The contract reads through observable
// outcomes — final ν/s, the pass's own charge and chord terms — never
// coefficient tables: charged/uncharged recipients, ordinary and
// alternative recipients, same-term stacking, the mutators, the certified
// allocation, and preview/commit agreement.

const synthRate = BALANCE.synthRate;

// A single-Fifth board: the opening C4 at (0,0) and a second voice at
// (1,0) — G4. EXCITER_SEAT touches both voices; SOLO_EXCITER_SEAT touches
// the opening alone; GEN_SEAT charges only whatever sits at (1,0);
// VOICE_GEN_SEAT charges only the opening; EXCITER_GEN_SEAT charges only
// the exciter at (1,-1); SOLO_SEAT is off the opening's adjacency — a
// chordless formation of one — with SOLO_GEN_SEAT beside it.
const EXCITER_SEAT = hex(1, -1);
const SOLO_EXCITER_SEAT = hex(0, -1);
const FED_SEAT = hex(1, 0);
const GEN_SEAT = hex(2, 0);
const VOICE_GEN_SEAT = hex(-1, 1);
const EXCITER_GEN_SEAT = hex(1, -2);
const SOLO_SEAT = hex(2, 0);
const SOLO_GEN_SEAT = hex(2, -1);

function charged(s: GameState, at: ReturnType<typeof hex>): ModuleInstance {
  const generator = give(s, "focusKeyed", at);
  generator.reserve = 600;
  return generator;
}

describe("the Exciter's charge-response grant", () => {
  it("deepens adjacent oscillators' charged curve — and no amplitude leg", () => {
    const s = fresh();
    const second = give(s, "additive", FED_SEAT); // G4 — the Fifth's second voice
    give(s, "exciter", EXCITER_SEAT);
    charged(s, GEN_SEAT); // charges the second voice only
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => c.name)).toEqual(["Fifth"]);
    // The booster produces nothing and grants no amplitude: both legs stay
    // bare, and the recipients' uplift term reads zero.
    const exciter = s.modules.find((m) => m.type === "exciter")!;
    expect(snapshot.contributions.get(exciter.id)!.value).toBe(0);
    expect(snapshot.infusors).toBe(0);
    expect(snapshot.contributions.get("m1")!.infusorBonus).toBe(0);
    expect(snapshot.contributions.get(second.id)!.infusorBonus).toBe(0);
    // The uncharged voice reads exactly ×1 — the grant has nothing to ride.
    expect(snapshot.chargeStrength.get("m1")!).toBe(0);
    expect(snapshot.contributions.get("m1")!.chargeFactor).toBe(1);
    // The charged voice's authored ×1.0 response plus the ×0.5 grant scale
    // the curve's delta (×1.5 became ×1.75 at strength 1), the chord
    // factor riding beside it.
    const charge = 1 + (OSCILLATOR_PROFILES.additive.charge + BALANCE.exciterBonus) * 0.5;
    const chord = (1 + OSCILLATOR_PROFILES.additive.chord * 0.3) * 1.06;
    expect(snapshot.contributions.get(second.id)!.chargeFactor).toBeCloseTo(charge, 9);
    expect(snapshot.contributions.get(second.id)!.value).toBeCloseTo(synthRate * chord * charge, 9);
  });

  it("uncharged recipients receive no benefit — the board's rate never moves", () => {
    const bare = fresh();
    const plain = computeRates(bare, false);
    const s = fresh();
    give(s, "exciter", EXCITER_SEAT);
    const boosted = computeRates(s, false);
    // No charge anywhere: the grant's coefficient multiplies a zero delta.
    expect(boosted.rate).toBeCloseTo(plain.rate, 9);
    expect(boosted.contributions.get("m1")!.chargeFactor).toBe(1);
    expect(boosted.contributions.get("m1")!.value).toBeCloseTo(plain.contributions.get("m1")!.value, 9);
  });

  it("received charge strengthens the Exciter's own grant — the recipients' strength stays untouched", () => {
    const s = fresh();
    give(s, "additive", FED_SEAT);
    give(s, "exciter", EXCITER_SEAT);
    charged(s, GEN_SEAT); // adjacent to the recipient alone
    const unfed = computeRates(s, true).contributions.get("m2")!.chargeFactor;
    charged(s, EXCITER_GEN_SEAT); // adjacent to the exciter alone
    const snapshot = computeRates(s, true);
    const exciter = s.modules.find((m) => m.type === "exciter")!;
    // The exciter itself rides the charged curve; the voice's own strength
    // is exactly what the generator delivers.
    expect(snapshot.chargeStrength.get(exciter.id)!).toBeCloseTo(1, 9);
    expect(snapshot.chargeStrength.get("m2")!).toBeCloseTo(1, 9);
    // The grant sharpens from ×0.5 to ×0.75 — the response the term reads.
    const fed = snapshot.contributions.get("m2")!.chargeFactor;
    expect(fed).toBeCloseTo(1 + (1 + BALANCE.exciterBonus * 1.5) * 0.5, 9);
    expect(fed).toBeGreaterThan(unfed);
  });

  it("same-term contributions add: two Exciters deepen the covered voice alone", () => {
    const s = fresh();
    const second = give(s, "additive", FED_SEAT);
    give(s, "exciter", EXCITER_SEAT); // touches both voices
    give(s, "exciter", SOLO_EXCITER_SEAT); // touches the opening alone
    charged(s, VOICE_GEN_SEAT); // charges the opening
    charged(s, GEN_SEAT); // charges the second voice
    const snapshot = computeRates(s, true);
    const doubled = 1 + (1 + 2 * BALANCE.exciterBonus) * 0.5;
    const single = 1 + (1 + BALANCE.exciterBonus) * 0.5;
    expect(snapshot.contributions.get("m1")!.chargeFactor).toBeCloseTo(doubled, 9);
    expect(snapshot.contributions.get(second.id)!.chargeFactor).toBeCloseTo(single, 9);
  });

  it("distinct terms interact per the production contract: amplitude uplift and charge response multiply", () => {
    const s = fresh();
    const second = give(s, "additive", FED_SEAT);
    give(s, "exciter", EXCITER_SEAT); // charge response to both
    give(s, "field", SOLO_EXCITER_SEAT); // amplitude to the opening alone
    charged(s, VOICE_GEN_SEAT); // charges the opening
    const snapshot = computeRates(s, true);
    const charge = 1 + (1 + BALANCE.exciterBonus) * 0.5;
    const opening = snapshot.contributions.get("m1")!;
    expect(opening.infusorBonus).toBeCloseTo(BALANCE.fieldBonus * OSCILLATOR_PROFILES.additive.booster, 9);
    expect(opening.chargeFactor).toBeCloseTo(charge, 9);
    expect(opening.value).toBeCloseTo(synthRate * (1 + 0.3) * 1.06 * (1 + opening.infusorBonus) * charge, 9);
    // The second voice reads the exciter's charge term, not the field —
    // and uncharged, the grant reads nothing at all.
    expect(snapshot.contributions.get(second.id)!.infusorBonus).toBe(0);
    expect(snapshot.contributions.get(second.id)!.chargeFactor).toBe(1);
  });

  it("the defining niche: a charged board gains, a charge-starved board gains nothing", () => {
    // One Saw beside one generator, an Exciter over the pair — the
    // charge-fed board is the niche. The reads come off the pass's own
    // terms: an uncharged board's deepened coefficient multiplies a zero
    // delta, so its value never moves, and the chord leg never moves
    // however deep the curve runs.
    const board = (fed: boolean, withExciter: boolean): { value: number; chargeFactor: number; chordFactor: number | null } => {
      const s = fresh();
      give(s, "saw", SOLO_SEAT);
      if (withExciter) give(s, "exciter", SOLO_GEN_SEAT);
      if (fed) charged(s, hex(3, 0)); // the saw's other neighbor
      const snapshot = computeRates(s, fed);
      const read = snapshot.contributions.get(s.modules.find((m) => m.type === "saw")!.id)!;
      return { value: read.value, chargeFactor: read.chargeFactor, chordFactor: read.chordFactor };
    };
    const idle = board(false, false);
    const idleCovered = board(false, true);
    expect(idleCovered.chargeFactor).toBe(1);
    expect(idleCovered.value).toBeCloseTo(idle.value, 9);
    const fed = board(true, false);
    const covered = board(true, true);
    expect(covered.chargeFactor).toBeCloseTo(1 + (OSCILLATOR_PROFILES.saw.charge + BALANCE.exciterBonus) * 0.5, 9);
    expect(covered.value).toBeGreaterThan(fed.value);
    expect(covered.chordFactor).toBe(1);
  });
});

describe("alternative charge recipients", () => {
  it("the Blaster's promoted conversion strengthens — never a second empowerment pass", () => {
    // No grants: the conversion reads exactly the curve it always did.
    expect(chargeTermOf("blaster", 0)).toBe(0);
    expect(chargeTermOf("blaster", 2)).toBeCloseTo(blasterConversion(2), 9);
    // The grant rides inside the conversion — ×0 uncharged preserved,
    // the asymptote's share deepened, never an added empowerment factor.
    expect(chargeTermOf("blaster", 0, BALANCE.exciterBonus)).toBe(0);
    expect(chargeTermOf("blaster", 1, BALANCE.exciterBonus)).toBeCloseTo((1 + BALANCE.exciterBonus) * blasterConversion(1), 9);
    const s = fresh();
    give(s, "blaster", FED_SEAT);
    give(s, "exciter", EXCITER_SEAT);
    charged(s, GEN_SEAT);
    const snapshot = computeRates(s, true);
    const blaster = snapshot.contributions.get("m2")!;
    expect(blaster.chargeStrength).toBeCloseTo(1, 9);
    expect(blaster.chargeFactor).toBeCloseTo((1 + BALANCE.exciterBonus) * 0.5, 9);
    expect(blaster.chargeFactor).toBeLessThan(1 + BALANCE.exciterBonus); // still the conversion's curve, one behavior
    expect(blaster.value).toBeCloseTo(synthRate * blaster.chargeFactor * (1 + 0.3) * 1.06, 9);
  });

  it("the Sideband's charge-to-chord response strengthens — the charge leg stays exactly ×1", () => {
    // No grants: the conversion scale reads exactly the curve it always did.
    expect(chordConversionScaleOf("sideband", 1)).toBeCloseTo(1 + blasterConversion(1), 9);
    expect(chargeTermOf("sideband", 1, 2 * BALANCE.exciterBonus)).toBe(1);
    const s = fresh();
    give(s, "sideband", FED_SEAT);
    give(s, "exciter", EXCITER_SEAT);
    charged(s, GEN_SEAT);
    const snapshot = computeRates(s, true);
    const side = snapshot.contributions.get("m2")!;
    expect(side.chargeStrength).toBeCloseTo(1, 9);
    expect(side.chargeFactor).toBe(1); // the replacement holds — no empowerment anywhere
    const scale = chordConversionScaleOf("sideband", 1, BALANCE.exciterBonus);
    const response = OSCILLATOR_PROFILES.sideband.chord * scale;
    const chord = side.chordFactor ?? 0;
    expect(chord).toBeCloseTo((1 + response * 0.3) * 1.06, 9);
    expect(side.value).toBeCloseTo(synthRate * OSCILLATOR_PROFILES.sideband.base * chord, 9);
    // The Exciter deepens only the conversion: the opening's chord
    // response is untouched by it.
    expect(snapshot.contributions.get("m1")!.chordFactor).toBeCloseTo((1 + 0.3) * 1.06, 9);
  });

  it("a charged chordless Sideband keeps its uncharged value beside the Exciter", () => {
    const s = fresh();
    give(s, "sideband", SOLO_SEAT);
    give(s, "exciter", SOLO_GEN_SEAT);
    charged(s, hex(3, 0)); // charges the sideband; (2,-1) charges the exciter
    const snapshot = computeRates(s, true);
    const side = snapshot.contributions.get(s.modules.find((m) => m.type === "sideband")!.id)!;
    expect(side.chargeStrength).toBeGreaterThan(0);
    expect(side.chordFactor).toBe(1); // no chord, nothing for the conversion to scale
    expect(side.value).toBeCloseTo(synthRate * OSCILLATOR_PROFILES.sideband.base, 9);
  });
});

describe("progression and mutators", () => {
  it("progression scales the grant through the host power — the condition never moves", () => {
    const s = fresh();
    give(s, "additive", FED_SEAT);
    const exciter = give(s, "exciter", EXCITER_SEAT);
    exciter.tier = 1; // ×1.5 host power
    exciter.level = 1; // ×1.3 rare power
    charged(s, GEN_SEAT);
    const snapshot = computeRates(s, true);
    const factor = 1 + (1 + BALANCE.exciterBonus * 1.5 * 1.3) * 0.5;
    expect(snapshot.contributions.get("m2")!.chargeFactor).toBeCloseTo(factor, 9);
    // The recipient's own progression never touches the coefficient —
    // an uncharged board reads ×1 whatever the voice's power.
    const twin = fresh();
    give(twin, "exciter", EXCITER_SEAT);
    const voice = twin.modules[0]!;
    voice.tier = 2;
    voice.level = 4;
    expect(computeRates(twin, false).contributions.get(voice.id)!.chargeFactor).toBe(1);
  });

  it("identity survives a combine: the tier scales the share, the condition stands", () => {
    const s = fresh();
    give(s, "additive", FED_SEAT);
    const exciter = give(s, "exciter", EXCITER_SEAT);
    exciter.tier = 1;
    const twin = give(s, "exciter", null);
    twin.tier = 1;
    charged(s, GEN_SEAT);
    const before = computeRates(s, true).contributions.get("m2")!.chargeFactor;
    combine(s, twin.id, exciter.id);
    const merged = s.modules.find((m) => m.type === "exciter")!;
    expect(merged.tier).toBe(2);
    const after = computeRates(s, true).contributions.get("m2")!.chargeFactor;
    expect(after).toBeCloseTo(1 + (1 + BALANCE.exciterBonus * 2.25) * 0.5, 9);
    expect(after).toBeGreaterThan(before);
    // And an uncharged recipient still reads exactly ×1 beside tier 2.
    const quiet = fresh();
    give(quiet, "exciter", EXCITER_SEAT).tier = 2;
    expect(computeRates(quiet, false).contributions.get("m1")!.chargeFactor).toBe(1);
  });

  it("a power mutator scales the Exciter's grant with its host power", () => {
    const s = fresh();
    give(s, "additive", FED_SEAT);
    give(s, "exciter", EXCITER_SEAT);
    s.mutators.push({ id: "mu-p", family: "power", rarity: "common", pos: EXCITER_SEAT });
    charged(s, GEN_SEAT);
    const snapshot = computeRates(s, true);
    expect(snapshot.contributions.get("m2")!.chargeFactor).toBeCloseTo(1 + (1 + BALANCE.exciterBonus * 1.5) * 0.5, 9);
  });

  it("a charge mutator feeds the deepened curve through the strength the recipient receives", () => {
    const s = fresh();
    give(s, "additive", FED_SEAT);
    give(s, "exciter", EXCITER_SEAT);
    charged(s, GEN_SEAT);
    s.mutators.push({ id: "mu-c", family: "charge", rarity: "common", pos: FED_SEAT });
    const snapshot = computeRates(s, true);
    const voice = snapshot.contributions.get("m2")!;
    expect(voice.chargeStrength).toBeCloseTo(1.5, 9);
    expect(voice.chargeFactor).toBeCloseTo(1 + (1 + BALANCE.exciterBonus) * (1.5 / 2.5), 9);
    // Uncharged, the same mutator is inert — the condition outlives it.
    const idle = fresh();
    give(idle, "additive", FED_SEAT);
    give(idle, "exciter", EXCITER_SEAT);
    idle.mutators.push({ id: "mu-c", family: "charge", rarity: "common", pos: FED_SEAT });
    expect(computeRates(idle, false).contributions.get("m1")!.chargeFactor).toBe(1);
  });
});

describe("allocation, previews, and persistence", () => {
  it("the certified allocation prices the same deepened terms the pass applies", () => {
    const s = fresh();
    give(s, "sideband", FED_SEAT);
    give(s, "exciter", EXCITER_SEAT);
    charged(s, GEN_SEAT);
    const displayed = displayedRates(s, true);
    expect(displayed.allocation?.certified).toBe(true);
    // The allocator's own quality scale (issue #260) over the deepened
    // reads: the Sideband's weight carries the strengthened conversion.
    const q = allocationQualityOf([0, 7]);
    const response = OSCILLATOR_PROFILES.sideband.chord * chordConversionScaleOf("sideband", 1, BALANCE.exciterBonus);
    expect(displayed.contributions.get("m2")!.value).toBeCloseTo(synthRate * 0.5 * (1 + response * 0.3) * q, 9);
  });

  it("moving the Exciter out of range previews the same drop the commit lands", () => {
    const s = fresh();
    give(s, "additive", FED_SEAT);
    const exciter = give(s, "exciter", EXCITER_SEAT);
    charged(s, GEN_SEAT);
    // Settle the live discovery ledger first, so the previewed and
    // committed boards read the same permanent bonus.
    syncChordDiscoveries(s, { chords: summaryTermsOf(displayedRates(s, true).allocation!), now: 0 });
    const before = displayedRates(s, true).contributions.get("m2")!.value;
    s.cells.push(hex(2, 2));
    const projection = projectPlacement(s, exciter.id, hex(2, 2), true);
    const previewed = projection.projected.contributions.get("m2")!.value;
    expect(previewed).toBeLessThan(before); // the grant is gone from the range
    placeModule(s, exciter.id, hex(2, 2));
    expect(displayedRates(s, true).contributions.get("m2")!.value).toBeCloseTo(previewed, 9);
  });

  it("a trayed Exciter grants nothing; the roster rolls the design", () => {
    const s = fresh();
    s.cells.push(EXCITER_SEAT);
    give(s, "additive", FED_SEAT);
    const exciter = give(s, "exciter", EXCITER_SEAT);
    charged(s, GEN_SEAT);
    // Settle the discovery ledger first: the placement actions sync it,
    // so every read below carries the same permanent bonus.
    syncChordDiscoveries(s, { chords: summaryTermsOf(displayedRates(s, true).allocation!), now: 0 });
    const placed = computeRates(s, true).contributions.get("m2")!.chargeFactor;
    expect(placed).toBeGreaterThan(1);
    returnModule(s, exciter.id);
    // Trayed, the grant is gone: the generator's own authored response is
    // the whole read.
    expect(computeRates(s, true).contributions.get("m2")!.chargeFactor).toBeCloseTo(1 + OSCILLATOR_PROFILES.additive.charge * 0.5, 9);
    placeModule(s, exciter.id, EXCITER_SEAT);
    expect(computeRates(s, true).contributions.get("m2")!.chargeFactor).toBeCloseTo(placed, 9);
  });

  it("the design survives a save/load round trip with its reads intact", () => {
    const s = fresh();
    give(s, "sideband", FED_SEAT);
    give(s, "exciter", EXCITER_SEAT);
    charged(s, GEN_SEAT);
    const restored = deserialize(serialize(s)).state!;
    const live = computeRates(s, true);
    const loaded = computeRates(restored, true);
    expect(loaded.rate).toBeCloseTo(live.rate, 9);
    expect(restored.modules.map((m) => m.type).sort()).toEqual(s.modules.map((m) => m.type).sort());
  });
});

describe("authorship and disclosure", () => {
  it("the roster's rarity follows the accepted sample table", () => {
    expect(typeRarityOf("exciter")).toBe("rare");
  });

  it("the single primary effect is the only disclosure — no oscillator axes, the term named", () => {
    // A booster: no authored oscillator axes, no grade line.
    expect(profileAxesOf("exciter")).toEqual([]);
    expect(boosterTermOf("exciter")).toBe("charge response");
    expect(boosterTermOf("chorus")).toBe("chord response");
    expect(boosterTermOf("field")).toBe("amplitude");
  });

  it("the vocabulary is untouched — the wave adds no chord classes", () => {
    expect(NAMED_CHORDS).toHaveLength(11);
  });
});
