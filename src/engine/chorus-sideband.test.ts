import { describe, expect, it } from "vitest";
import { BALANCE, NAMED_CHORDS } from "./constants";
import { blasterConversion, chargeTermOf, computeRates, displayedRates, projectPlacement } from "./economy";
import { allocationQualityOf, summaryTermsOf } from "./allocation";
import { profileAxesOf, OSCILLATOR_PROFILES } from "./profiles";
import { typeRarityOf } from "./constants";
import { syncChordDiscoveries } from "./library";
import { deserialize, serialize } from "./save";
import { fresh, give } from "./fixtures";
import { hex } from "./hex";
import { combine, placeModule, returnModule } from "./actions";
import type { GameState, ModuleInstance } from "./types";

// The chord-centered wave (issue #375, parent #366): the Chorus lifts the
// chord-response term and nothing else — no amplitude bonus, inert without
// an active chord — and the Sideband converts received charge into its
// chord response instead of direct empowerment, over weak standalone
// production. The contract reads through observable outcomes — final ν/s,
// the pass's own charge and chord terms — never coefficient tables:
// charged/uncharged and chord/no-chord boards, same-term stacking, the
// mutators, the certified allocation, and preview/commit agreement.

const synthRate = BALANCE.synthRate;

// A single-Fifth board: the opening C4 at (0,0) and a second voice at
// (1,0) — G4. CHORUS_SEAT touches both voices; FIELD_SEAT touches the
// opening alone; GEN_SEAT touches only whatever sits at (2,0). SOLO_SEAT
// is off the opening's adjacency — a chordless formation of one — with
// SOLO_GEN_SEAT charging it alone.
const CHORUS_SEAT = hex(1, -1);
const FIELD_SEAT = hex(0, -1);
const GEN_SEAT = hex(2, 0);
const SOLO_SEAT = hex(2, 0);
const SOLO_GEN_SEAT = hex(2, -1);

function charged(s: GameState, at: ReturnType<typeof hex>): ModuleInstance {
  const generator = give(s, "focusKeyed", at);
  generator.reserve = 600;
  return generator;
}

describe("the Chorus's chord-response grant", () => {
  it("adds to adjacent oscillators' chord-response term — and to no amplitude leg", () => {
    const s = fresh();
    const second = give(s, "additive", hex(1, 0)); // G4 — the Fifth's second voice
    give(s, "chorus", CHORUS_SEAT);
    const snapshot = computeRates(s, false);
    expect(snapshot.namedChords.map((c) => c.name)).toEqual(["Fifth"]);
    // The booster produces nothing and grants no amplitude: both legs stay
    // bare, and the recipients' uplift term reads zero.
    const chorus = s.modules.find((m) => m.type === "chorus")!;
    expect(snapshot.contributions.get(chorus.id)!.value).toBe(0);
    expect(snapshot.infusors).toBe(0);
    expect(snapshot.contributions.get("m1")!.infusorBonus).toBe(0);
    expect(snapshot.contributions.get(second.id)!.infusorBonus).toBe(0);
    // The response the factors carry is the authored ×1.0 plus the grant
    // ×0.5, the Fifth's bonus riding inside and Q outside — ×1.3 became
    // ×1.45 per instance.
    const factor = (1 + (OSCILLATOR_PROFILES.additive.chord + BALANCE.chorusBonus) * 0.3) * 1.06;
    expect(snapshot.contributions.get("m1")!.chordFactor).toBeCloseTo(factor, 9);
    expect(snapshot.contributions.get("m1")!.value).toBeCloseTo(synthRate * factor, 9);
    expect(snapshot.contributions.get(second.id)!.chordFactor).toBeCloseTo(factor, 9);
  });

  it("is inert without an active chord — the board's rate never moves", () => {
    const bare = fresh();
    const plain = computeRates(bare, false);
    const s = fresh();
    give(s, "chorus", CHORUS_SEAT);
    const boosted = computeRates(s, false);
    // One voice, no named formation: the response has nothing to scale.
    expect(boosted.namedChords).toHaveLength(0);
    expect(boosted.rate).toBeCloseTo(plain.rate, 9);
    expect(boosted.contributions.get("m1")!.chordFactor).toBe(1);
    expect(boosted.contributions.get("m1")!.value).toBeCloseTo(plain.contributions.get("m1")!.value, 9);
  });

  it("received charge strengthens the Chorus's own grant — the recipients' charge stays untouched", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0));
    give(s, "chorus", CHORUS_SEAT);
    const plain = computeRates(s, false).contributions.get("m1")!.chordFactor;
    charged(s, hex(1, -2)); // adjacent to the chorus alone
    const snapshot = computeRates(s, true);
    const chorus = s.modules.find((m) => m.type === "chorus")!;
    // The chorus itself rides the charged curve; the voices receive none.
    expect(snapshot.chargeStrength.get(chorus.id)!).toBeCloseTo(1, 9);
    expect(snapshot.chargeStrength.get("m1")!).toBe(0);
    expect(snapshot.contributions.get("m1")!.chargeFactor).toBe(1);
    // The grant sharpens from ×0.5 to ×0.75 — the response the factor reads.
    const fed = snapshot.contributions.get("m1")!.chordFactor ?? 0;
    expect(fed).toBeCloseTo((1 + (1 + BALANCE.chorusBonus * 1.5) * 0.3) * 1.06, 9);
    expect(fed / (plain ?? 1)).toBeCloseTo(1.525 / 1.45, 9);
  });

  it("same-term contributions add: two Choruses double the share on the covered voice alone", () => {
    const s = fresh();
    const second = give(s, "additive", hex(1, 0));
    give(s, "chorus", CHORUS_SEAT); // touches both voices
    give(s, "chorus", FIELD_SEAT); // touches the opening alone
    const snapshot = computeRates(s, false);
    const doubled = (1 + (1 + 2 * BALANCE.chorusBonus) * 0.3) * 1.06;
    const single = (1 + (1 + BALANCE.chorusBonus) * 0.3) * 1.06;
    expect(snapshot.contributions.get("m1")!.chordFactor).toBeCloseTo(doubled, 9);
    expect(snapshot.contributions.get(second.id)!.chordFactor).toBeCloseTo(single, 9);
  });

  it("distinct terms interact per the production contract: amplitude uplift and chord response multiply", () => {
    const s = fresh();
    const second = give(s, "additive", hex(1, 0));
    give(s, "field", FIELD_SEAT); // amplitude to the opening alone
    give(s, "chorus", CHORUS_SEAT); // chord response to both
    const snapshot = computeRates(s, false);
    const chordFactor = (1 + 1.5 * 0.3) * 1.06;
    const opening = snapshot.contributions.get("m1")!;
    expect(opening.infusorBonus).toBeCloseTo(BALANCE.fieldBonus * OSCILLATOR_PROFILES.additive.booster, 9);
    expect(opening.value).toBeCloseTo(synthRate * chordFactor * (1 + opening.infusorBonus), 9);
    // The second voice reads the chorus, not the field.
    expect(snapshot.contributions.get(second.id)!.infusorBonus).toBe(0);
    expect(snapshot.contributions.get(second.id)!.chordFactor).toBeCloseTo(chordFactor, 9);
  });

  it("progression scales the grant through the host power — the term never moves", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0));
    const chorus = give(s, "chorus", CHORUS_SEAT);
    chorus.tier = 1; // ×1.5 host power
    chorus.level = 1; // ×1.25 uncommon power
    const snapshot = computeRates(s, false);
    const factor = (1 + (1 + BALANCE.chorusBonus * 1.5 * 1.25) * 0.3) * 1.06;
    expect(snapshot.contributions.get("m1")!.chordFactor).toBeCloseTo(factor, 9);
    // The recipient's own progression never touches the coefficient —
    // a chordless board reads ×1 whatever the voice's power.
    const twin = fresh();
    twin.modules[0]!.tier = 2;
    twin.modules[0]!.level = 4;
    const raised = computeRates(twin, false);
    expect(raised.contributions.get("m1")!.chordFactor).toBe(1);
  });
});

describe("the Sideband's charge conversion", () => {
  it("uncharged, it sings its authored response with the weak base — no empowerment anywhere", () => {
    const s = fresh();
    give(s, "sideband", hex(1, 0)); // G4 — the Fifth's second voice
    const snapshot = computeRates(s, false);
    expect(snapshot.namedChords.map((c) => c.name)).toEqual(["Fifth"]);
    const side = snapshot.contributions.get("m2")!;
    expect(side.chargeStrength).toBe(0);
    expect(side.chargeFactor).toBe(1);
    const factor = (1 + OSCILLATOR_PROFILES.sideband.chord * 0.3) * 1.06;
    expect(side.chordFactor).toBeCloseTo(factor, 9);
    expect(side.value).toBeCloseTo(synthRate * OSCILLATOR_PROFILES.sideband.base * factor, 9);
  });

  it("received charge strengthens the chord response — never the term itself", () => {
    const s = fresh();
    give(s, "sideband", hex(1, 0));
    charged(s, GEN_SEAT); // adjacent to the sideband only
    const snapshot = computeRates(s, true);
    const side = snapshot.contributions.get("m2")!;
    expect(side.chargeStrength).toBeCloseTo(1, 9);
    // The replacement, not a second effect: the charge leg reads exactly
    // ×1 while the response carries the conversion.
    expect(side.chargeFactor).toBe(1);
    expect(chargeTermOf("sideband", 1)).toBe(1);
    const factor = (1 + OSCILLATOR_PROFILES.sideband.chord * (1 + blasterConversion(1)) * 0.3) * 1.06;
    expect(side.chordFactor).toBeCloseTo(factor, 9);
    expect(side.value).toBeCloseTo(synthRate * OSCILLATOR_PROFILES.sideband.base * factor, 9);
  });

  it("charged and chordless, the conversion has nothing to strengthen — the value never moves", () => {
    const s = fresh();
    give(s, "sideband", SOLO_SEAT); // off the opening's adjacency — a formation of one
    charged(s, SOLO_GEN_SEAT);
    const snapshot = computeRates(s, true);
    const side = snapshot.contributions.get(
      s.modules.find((m) => m.type === "sideband")!.id,
    )!;
    expect(snapshot.namedChords).toHaveLength(0);
    expect(side.chargeStrength).toBeCloseTo(1, 9);
    expect(side.chordFactor).toBe(1);
    expect(side.value).toBeCloseTo(synthRate * OSCILLATOR_PROFILES.sideband.base, 9);
  });

  it("the conversion and a Chorus grant add on the response term — distinct sources, one term", () => {
    const s = fresh();
    give(s, "sideband", hex(1, 0));
    give(s, "chorus", CHORUS_SEAT);
    charged(s, GEN_SEAT);
    const snapshot = computeRates(s, true);
    const side = snapshot.contributions.get("m2")!;
    const response = OSCILLATOR_PROFILES.sideband.chord * (1 + blasterConversion(1)) + BALANCE.chorusBonus;
    expect(side.chargeFactor).toBe(1);
    expect(side.chordFactor).toBeCloseTo((1 + response * 0.3) * 1.06, 9);
  });

  it("the defining niche: charge compounds per instance — the rich charged board flips the seat", () => {
    // Six voices — C·G across three octave rows — so every G seat sings
    // three Fifths and two Octaves, and a response compounds through both
    // terms. Generators at (2,0) and (2,1) charge the middle G seat twice
    // (strength 2) and its neighbors once.
    const voiceFactor = (r: number): number => (1 + r * 0.3) ** 3 * (1 + r * 0.15) ** 2 * 1.06;
    const board = (type: ModuleInstance["type"], fed: boolean): GameState => {
      const s = fresh();
      for (const seat of [hex(1, 0), hex(1, 1), hex(1, 2)]) give(s, type, seat);
      for (const seat of [hex(0, 1), hex(0, 2)]) give(s, "additive", seat);
      if (fed) {
        charged(s, hex(2, 0));
        charged(s, hex(2, 1));
      }
      return s;
    };
    const midVoice = (s: GameState): number =>
      computeRates(s, s.modules.some((m) => m.type === "focusKeyed")).contributions.get(
        s.modules.find((m) => m.pos !== null && m.pos.q === 1 && m.pos.r === 1)!.id,
      )!.value;
    // Uncharged, the specialist leads; the Sideband's weak base trails.
    expect(midVoice(board("sideband", false))).toBeCloseTo(synthRate * 0.5 * voiceFactor(2), 9);
    expect(midVoice(board("sideband", false))).toBeLessThan(midVoice(board("triangle", false)));
    // Charged, the middle seat's conversion compounds it past the Saw's
    // flat empowerment and the Sine — and past its own uncharged read —
    // while the charged specialist keeps the crown.
    const sideband = midVoice(board("sideband", true));
    expect(sideband).toBeCloseTo(synthRate * 0.5 * voiceFactor(10 / 3), 9);
    expect(sideband).toBeGreaterThan(midVoice(board("saw", true)));
    expect(sideband).toBeGreaterThan(midVoice(board("additive", true)));
    expect(sideband).toBeGreaterThan(midVoice(board("sideband", false)));
    expect(sideband).toBeLessThan(midVoice(board("triangle", true)));
  });

  it("identity survives progression: tier scales the weak term, never the condition or proportion", () => {
    const s = fresh();
    const side = give(s, "sideband", hex(1, 0));
    side.tier = 1;
    const uncharged = computeRates(s, false).contributions.get("m2")!;
    expect(uncharged.chargeFactor).toBe(1);
    expect(uncharged.value).toBeCloseTo(synthRate * OSCILLATOR_PROFILES.sideband.base * 1.5 * (1 + 0.6) * 1.06, 9);
    charged(s, GEN_SEAT);
    const fed = computeRates(s, true).contributions.get("m2")!;
    expect(fed.chargeFactor).toBe(1); // the condition holds at any tier
    const response = OSCILLATOR_PROFILES.sideband.chord * (1 + blasterConversion(1));
    expect(fed.chordFactor).toBeCloseTo((1 + response * 0.3) * 1.06, 9);
    // Levels scale the whole term too — rarity power per level, the
    // response and its condition untouched.
    side.level = 2; // ×1.3² rare power
    const leveled = computeRates(s, true).contributions.get("m2")!;
    expect(leveled.chargeFactor).toBe(1);
    expect(leveled.chordFactor).toBeCloseTo((1 + response * 0.3) * 1.06, 9);
    expect(leveled.value).toBeCloseTo(fed.value * 1.3 * 1.3, 9);
    // A combine to tier 2 preserves both reads too.
    const twin = give(s, "sideband", null);
    twin.tier = 1;
    combine(s, twin.id, side.id);
    const merged = s.modules.find((m) => m.type === "sideband")!;
    expect(merged.tier).toBe(2);
    const after = computeRates(s, true).contributions.get(merged.id)!;
    expect(after.chargeFactor).toBe(1);
    expect(after.chordFactor).toBeCloseTo((1 + response * 0.3) * 1.06, 9);
  });
});

describe("mutators on the chord-centered wave", () => {
  it("resonance multiplies the converted-and-granted chord factor, inert chordless", () => {
    const s = fresh();
    give(s, "sideband", hex(1, 0));
    give(s, "chorus", CHORUS_SEAT);
    charged(s, GEN_SEAT);
    s.mutators.push({ id: "mu-r", family: "resonance", rarity: "common", pos: hex(1, 0) });
    const snapshot = computeRates(s, true);
    const response = OSCILLATOR_PROFILES.sideband.chord * (1 + blasterConversion(1)) + BALANCE.chorusBonus;
    expect(snapshot.contributions.get("m2")!.chordFactor).toBeCloseTo((1 + response * 0.3) * 1.06 * 1.5, 9);
    // Chordless, the mutator is inert — the ×1.00 contract holds.
    const bare = fresh();
    give(bare, "sideband", SOLO_SEAT);
    charged(bare, SOLO_GEN_SEAT);
    bare.mutators.push({ id: "mu-r", family: "resonance", rarity: "common", pos: SOLO_SEAT });
    expect(computeRates(bare, true).contributions.get(
      bare.modules.find((m) => m.type === "sideband")!.id,
    )!.chordFactor).toBe(1);
  });

  it("a power mutator scales the Chorus's grant with its host power", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0));
    give(s, "chorus", CHORUS_SEAT);
    s.mutators.push({ id: "mu-p", family: "power", rarity: "common", pos: CHORUS_SEAT });
    const snapshot = computeRates(s, false);
    const factor = (1 + (1 + BALANCE.chorusBonus * 1.5) * 0.3) * 1.06;
    expect(snapshot.contributions.get("m1")!.chordFactor).toBeCloseTo(factor, 9);
  });

  it("a charge mutator feeds the Sideband's conversion through the strength it receives", () => {
    const s = fresh();
    give(s, "sideband", hex(1, 0));
    charged(s, GEN_SEAT);
    s.mutators.push({ id: "mu-c", family: "charge", rarity: "common", pos: hex(1, 0) });
    const snapshot = computeRates(s, true);
    const side = snapshot.contributions.get("m2")!;
    expect(side.chargeStrength).toBeCloseTo(1.5, 9);
    expect(side.chargeFactor).toBe(1); // still no empowerment
    const response = OSCILLATOR_PROFILES.sideband.chord * (1 + blasterConversion(1.5));
    expect(side.chordFactor).toBeCloseTo((1 + response * 0.3) * 1.06, 9);
  });
});

describe("allocation, previews, and persistence", () => {
  it("the certified allocation prices the same effective response the pass applies", () => {
    const s = fresh();
    give(s, "sideband", hex(1, 0));
    give(s, "chorus", CHORUS_SEAT);
    charged(s, GEN_SEAT);
    const displayed = displayedRates(s, true);
    expect(displayed.allocation?.certified).toBe(true);
    // The allocator's own quality scale (issue #260) over the effective
    // responses: the opening reads the Chorus's grant; the Sideband the
    // conversion plus the grant.
    const q = allocationQualityOf([0, 7]);
    expect(displayed.contributions.get("m1")!.value).toBeCloseTo(synthRate * (1 + 1.5 * 0.3) * q, 9);
    expect(displayed.contributions.get("m2")!.value).toBeCloseTo(synthRate * 0.5 * (1 + 3.5 * 0.3) * q, 9);
  });

  it("moving the Chorus out of range previews the same drop the commit lands", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0));
    const chorus = give(s, "chorus", CHORUS_SEAT);
    // Settle the live discovery ledger first, so the previewed and
    // committed boards read the same permanent bonus.
    syncChordDiscoveries(s, { chords: summaryTermsOf(displayedRates(s, false).allocation!), now: 0 });
    const before = displayedRates(s, false).contributions.get("m1")!.value;
    s.cells.push(hex(2, 2));
    const projection = projectPlacement(s, chorus.id, hex(2, 2), false);
    const previewed = projection.projected.contributions.get("m1")!.value;
    expect(previewed).toBeLessThan(before); // the grant is gone from the range
    placeModule(s, chorus.id, hex(2, 2));
    expect(displayedRates(s, false).contributions.get("m1")!.value).toBeCloseTo(previewed, 9);
  });

  it("a trayed Chorus grants nothing; the roster rolls both designs", () => {
    const s = fresh();
    s.cells.push(CHORUS_SEAT);
    give(s, "additive", hex(1, 0));
    const chorus = give(s, "chorus", CHORUS_SEAT);
    // Settle the discovery ledger first: the placement actions sync it,
    // so every read below carries the same permanent bonus.
    syncChordDiscoveries(s, { chords: summaryTermsOf(displayedRates(s, false).allocation!), now: 0 });
    const placed = computeRates(s, false).contributions.get("m1")!.value;
    returnModule(s, chorus.id);
    const trayed = computeRates(s, false).contributions.get("m1")!.value;
    expect(trayed).toBeCloseTo(synthRate * 1.3 * 1.06 * 1.01, 9);
    expect(placed).toBeGreaterThan(trayed);
    placeModule(s, chorus.id, CHORUS_SEAT);
    expect(computeRates(s, false).contributions.get("m1")!.value).toBeCloseTo(placed, 9);
    const side = give(s, "sideband", null);
    expect(computeRates(s, false).namedChords.every((c) => !c.moduleIds.includes(side.id))).toBe(true);
  });

  it("both designs survive a save/load round trip with their reads intact", () => {
    const s = fresh();
    give(s, "sideband", hex(1, 0));
    give(s, "chorus", CHORUS_SEAT);
    charged(s, GEN_SEAT);
    const restored = deserialize(serialize(s)).state!;
    const live = computeRates(s, true);
    const loaded = computeRates(restored, true);
    expect(loaded.rate).toBeCloseTo(live.rate, 9);
    expect(restored.modules.map((m) => m.type).sort()).toEqual(s.modules.map((m) => m.type).sort());
  });
});

describe("authorship and disclosure", () => {
  it("the roster's rarities follow the accepted sample table", () => {
    expect(typeRarityOf("sideband")).toBe("rare");
    expect(typeRarityOf("chorus")).toBe("uncommon");
  });

  it("the Sideband's charge axis takes the absent mark — the replacement is the disclosure", () => {
    const axes = profileAxesOf("sideband");
    expect(axes.map((axis) => `${axis.id}:${axis.grade}`)).toEqual(["base:D", "booster:B", "chord:S", "charge:—"]);
    const charge = axes.find((axis) => axis.id === "charge")!;
    expect(charge.coefficient).toBeNull();
    expect(axes.find((axis) => axis.id === "chord")!.coefficient).toBe(OSCILLATOR_PROFILES.sideband.chord);
    // The Chorus is a booster: no authored oscillator axes, no grade line.
    expect(profileAxesOf("chorus")).toEqual([]);
  });

  it("the vocabulary is untouched — the wave adds no chord classes", () => {
    expect(NAMED_CHORDS).toHaveLength(11);
  });
});
