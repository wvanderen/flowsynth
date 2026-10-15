import { describe, expect, it } from "vitest";
import { computeRates, projectPlacement, chargeTermOf, chargedFactor, blasterConversion } from "./economy";
import { BALANCE, TYPE_RARITY } from "./constants";
import { gradeOfCoefficient, OSCILLATOR_PROFILES, profileAxesOf, type AptitudeGrade } from "./profiles";
import { combine, placeModule } from "./actions";
import { deserialize, serialize } from "./save";
import { fresh, give } from "./fixtures";
import { createMutator } from "./state";
import { hex } from "./hex";
import type { Contribution, GameState, OscillatorType } from "./types";

// The authored oscillator profiles (issue #369, parent #366; ADR-0059):
// four waveform designs over one shared leg, each with a situation where
// it is preferable — the niche demonstrations run through the real rate
// pass, and progression scales the strengths without touching the
// proportions between the axes. The aptitude grades (issue #370) ride the
// same tables: fixed coefficient bands, fixed per type.

const SYNTH = BALANCE.synthRate;

// One test oscillator alone on the D5 island, chordless — its whole value
// is its authored base term (the fixture's opening Sine stays at C4).
function islandValue(type: OscillatorType, shape?: (module: ReturnType<typeof give>) => void): number {
  const s = fresh();
  const module = give(s, type, hex(2, 0));
  shape?.(module);
  return contributionOf(s, module.id).value;
}

function contributionOf(s: GameState, id: string): Contribution {
  const contribution = computeRates(s, true).contributions.get(id);
  expect(contribution).toBeDefined();
  return contribution!;
}

describe("the four waveform niches (#369)", () => {
  it("naked boards read the base ladder: Sine, Square, Triangle, Saw", () => {
    const values = (["additive", "square", "triangle", "saw"] as const).map((type) => islandValue(type));
    for (let i = 1; i < values.length; i++) expect(values[i - 1]!).toBeGreaterThan(values[i]!);
    expect(values[0]).toBeCloseTo(SYNTH * OSCILLATOR_PROFILES.additive.base, 9);
  });

  it("one adjacent booster flips the board to the Square", () => {
    const boosted = (type: OscillatorType): number => {
      const s = fresh();
      const module = give(s, type, hex(2, 0));
      give(s, "infusor", hex(2, -1));
      return contributionOf(s, module.id).value;
    };
    const sine = boosted("additive");
    const square = boosted("square");
    expect(square).toBeGreaterThan(sine);
    // The authored shape, exactly: base × (1 + response × bonus).
    expect(square / sine).toBeCloseTo(
      (OSCILLATOR_PROFILES.square.base * (1 + OSCILLATOR_PROFILES.square.booster * BALANCE.infusorBonus)) /
        (OSCILLATOR_PROFILES.additive.base * (1 + OSCILLATOR_PROFILES.additive.booster * BALANCE.infusorBonus)),
      9,
    );
    // The chord specialist still trails under pure boost — its niche
    // needs the chord, and the Sine's reduced response still leaves it
    // the un-supported board's runner-up.
    expect(boosted("triangle")).toBeLessThan(sine);
  });

  it("a named chord flips the board to the Triangle; the Square gains least", () => {
    // A Fifth across D5·A5: the test oscillator at (2,0), a plain partner
    // at (3,0). Q rides both members equally — the response decides.
    const chorded = (type: OscillatorType): { value: number; factor: number } => {
      const s = fresh();
      const module = give(s, type, hex(2, 0));
      give(s, "additive", hex(3, 0));
      const contribution = contributionOf(s, module.id);
      return { value: contribution.value, factor: contribution.chordFactor! };
    };
    const sine = chorded("additive");
    const triangle = chorded("triangle");
    const square = chorded("square");
    // The Triangle overtakes the stronger base the moment the chord rings.
    expect(triangle.value).toBeGreaterThan(sine.value);
    // The Square's reduced chord response: its chorded factor trails the
    // Sine's even from a higher naked base.
    expect(square.factor).toBeLessThan(sine.factor);
    expect(triangle.factor).toBeGreaterThan(sine.factor);
    // Chordless, the profiles sit at exactly ×1 — the chordless ×1.00
    // contract (ADR-0049) holds per profile.
    expect(contributionFactorOf("square")).toBe(1);
  });

  function contributionFactorOf(type: OscillatorType): number | null {
    const s = fresh();
    const module = give(s, type, hex(2, 0));
    return computeRates(s, true).contributions.get(module.id)?.chordFactor ?? null;
  }

  it("a charged generator flips the board to the Saw; uncharged the Saw trails", () => {
    const charged = (type: OscillatorType): number => {
      const s = fresh();
      const module = give(s, type, hex(2, 0));
      give(s, "focusKeyed", hex(2, -1));
      s.modules.find((m) => m.type === "focusKeyed")!.reserve = 600;
      return contributionOf(s, module.id).value;
    };
    // One adjacent level-0 generator: strength 1. The Saw's ×3 delta has
    // long crossed the Sine's ×1 delta at that strength.
    expect(charged("saw")).toBeGreaterThan(charged("additive"));
    // Uncharged, the curves sit at ×1 and the reduced base shows.
    const unchargedSaw = islandValue("saw");
    expect(unchargedSaw).toBeLessThan(islandValue("additive"));
    // The charge term itself: the authored multiplier scales the curve's
    // delta above ×1, never the ×1 floor.
    expect(chargeTermOf("saw", 1)).toBeCloseTo(1 + OSCILLATOR_PROFILES.saw.charge * 0.5, 9);
    expect(chargeTermOf("saw", 0)).toBe(1);
    expect(chargeTermOf("saw", 2)).toBeGreaterThan(chargedFactor(2));
  });

  it("the Blaster's conversion still replaces the charge factor — no second pass", () => {
    expect(chargeTermOf("blaster", 0)).toBe(0);
    expect(chargeTermOf("blaster", 2)).toBeCloseTo(blasterConversion(2), 9);
    expect(chargeTermOf("blaster", 2)).toBeLessThan(1);
  });
});

describe("progression and mutators preserve the profile shape", () => {
  it("levels and tiers scale every axis together: the niche ratios hold", () => {
    const ratio = (type: OscillatorType, shape?: (module: ReturnType<typeof give>) => void): number =>
      islandValue(type, shape) / islandValue("additive", shape);
    for (const shape of [undefined, (m: ReturnType<typeof give>) => void (m.level = 4), (m: ReturnType<typeof give>) => void (m.tier = 2)]) {
      expect(ratio("square", shape)).toBeCloseTo(OSCILLATOR_PROFILES.square.base, 9);
      expect(ratio("triangle", shape)).toBeCloseTo(OSCILLATOR_PROFILES.triangle.base, 9);
      expect(ratio("saw", shape)).toBeCloseTo(OSCILLATOR_PROFILES.saw.base, 9);
    }
  });

  it("merging scales the profile: two Squares at one tier become one stronger Square", () => {
    const s = fresh();
    const a = give(s, "square", hex(2, 0));
    const b = give(s, "square", null);
    a.level = 3;
    // The tray copy drops onto the deployed one: the higher-level survivor
    // stands where it stood, one tier up, the melt consumed.
    const result = combine(s, b.id, a.id);
    expect(result.ok).toBe(true);
    expect(a.tier).toBe(1);
    expect(a.level).toBe(3);
    expect(s.modules.includes(b)).toBe(false);
    // The survivor keeps its profile: chordless, unboosted, and worth
    // exactly the same square proportion as any copy of its shape — the
    // merge stepped the strength ×1.5 and nothing else moved.
    expect(contributionOf(s, a.id).infusorBonus).toBe(0);
    const shape = (m: ReturnType<typeof give>): void => {
      m.level = 3;
      m.tier = 1;
    };
    expect(contributionOf(s, a.id).value / islandValue("additive", shape)).toBeCloseTo(OSCILLATOR_PROFILES.square.base, 9);
    expect(contributionOf(s, a.id).value / islandValue("square", (m) => void (m.level = 3))).toBeCloseTo(BALANCE.tierPower[1], 9);
    // One copy cannot merge again without a second at its new tier.
    expect(combine(s, a.id).ok).toBe(false);
  });

  it("a resonance mutator amplifies the profile-scaled chord factor, tradeoffs intact", () => {
    const chorded = (type: OscillatorType): number => {
      const s = fresh();
      const module = give(s, type, hex(2, 0));
      give(s, "additive", hex(3, 0));
      s.mutators.push({ ...createMutator(s, "resonance", "common"), pos: hex(2, 0) });
      return contributionOf(s, module.id).value;
    };
    // The resonance multiplies the whole chord factor (ADR-0043), the
    // response already inside — the Triangle still leads, the Square
    // still trails the Sine's chord gain.
    expect(chorded("triangle")).toBeGreaterThan(chorded("additive"));
    expect(chorded("square")).toBeLessThan(chorded("additive") * 1.01);
  });
});

describe("the profile rides the authoritative seams", () => {
  it("placement previews agree with the committed board for a profiled type", () => {
    const s = fresh();
    s.cells.push(hex(2, 0));
    const triangle = give(s, "triangle", null);
    const projection = projectPlacement(s, triangle.id, hex(2, 0), true);
    placeModule(s, triangle.id, hex(2, 0));
    const committed = computeRates(s, true);    expect(projection.projected.rate).toBeCloseTo(committed.rate, 9);
    expect(projection.projected.contributions.get(triangle.id)!.value).toBeCloseTo(
      committed.contributions.get(triangle.id)!.value,
      9,
    );
  });

  it("profiled types save and restore: types, tiers, and levels stand", () => {
    const s = fresh();
    give(s, "triangle", hex(2, 0)).tier = 1;
    give(s, "square", hex(3, 0)).level = 2;
    give(s, "saw", null);
    const restored = deserialize(serialize(s, 1)).state!;
    const byType = (type: string): number => restored.modules.filter((m) => m.type === type).length;
    expect(byType("triangle")).toBe(1);
    expect(byType("square")).toBe(1);
    expect(byType("saw")).toBe(1);
    expect(restored.modules.find((m) => m.type === "triangle")!.tier).toBe(1);
    expect(restored.modules.find((m) => m.type === "square")!.level).toBe(2);
  });
});

describe("fixed aptitude grades (#370)", () => {
  it("each waveform reads a distinct grade signature on the four axes", () => {
    const letters = (type: OscillatorType): string => profileAxesOf(type).map((axis) => axis.grade).join("");
    // base · boost · chord · charge
    expect(letters("additive")).toBe("ACBB");
    expect(letters("triangle")).toBe("CBSB");
    expect(letters("square")).toBe("BSCB");
    expect(letters("saw")).toBe("CBBS");
  });

  it("the Blaster's charge axis takes the absent mark — the conversion replaces, not scales", () => {
    const axes = profileAxesOf("blaster");
    const charge = axes.find((axis) => axis.id === "charge")!;
    expect(charge.grade).toBe("—");
    expect(charge.coefficient).toBeNull();
    // Its comparable axes grade from the same bands as every profile.
    expect(axes.find((axis) => axis.id === "base")!.grade).toBe("A");
  });

  it("grades are fixed: level, tier, mutators, and live conditions never re-rank them", () => {
    const before = profileAxesOf("square");
    const s = fresh();
    const square = give(s, "square", hex(2, 0));
    give(s, "additive", hex(3, 0)); // a Fifth — the mutator has a chord to ride
    square.level = 6;
    square.tier = 2;
    const leveledValue = contributionOf(s, square.id).value;
    s.mutators.push({ ...createMutator(s, "resonance", "rare"), pos: hex(2, 0) });
    const mutatedValue = contributionOf(s, square.id).value;
    // Output moved; the grades did not.
    expect(mutatedValue).toBeGreaterThan(leveledValue);
    expect(profileAxesOf("square")).toEqual(before);
  });

  it("rarity never implies a grade: re-authoring a type's rarity moves no axis", () => {
    // The bands are absolute within the category, so a rarer tag on the
    // same coefficients reranks nothing — the launch roster is all-common
    // (ADR-0058), so the probe authors and restores the table entry.
    const before = profileAxesOf("saw");
    const authored = TYPE_RARITY.saw;
    TYPE_RARITY.saw = "rare";
    try {
      expect(profileAxesOf("saw")).toEqual(before);
    } finally {
      TYPE_RARITY.saw = authored;
    }
  });

  it("the bands are absolute: D weak, — absent, and no roster addition moves an edge", () => {
    const cases: [number, AptitudeGrade][] = [
      [0, "—"],
      [0.2, "D"],
      [0.5, "C"],
      [0.7, "C"],
      [0.9, "B"],
      [1.0, "B"],
      [1.2, "A"],
      [1.5, "S"],
    ];
    for (const [value, grade] of cases) {
      expect(gradeOfCoefficient(value, "booster")).toBe(grade);
    }
    // Base production bands against the category standard: 1.0 reads strong.
    expect(gradeOfCoefficient(1.0, "base")).toBe("A");
    expect(gradeOfCoefficient(0.75, "base")).toBe("C");
  });

  it("types without authored profiles carry no axes yet", () => {
    expect(profileAxesOf("infusor")).toEqual([]);
    expect(profileAxesOf("focusKeyed")).toEqual([]);
    expect(profileAxesOf("harmonizer")).toEqual([]);
  });
});
