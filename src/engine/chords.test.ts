import { describe, expect, it } from "vitest";
import { BALANCE, NAMED_CHORDS } from "./constants";
import { computeRates } from "./economy";
import { analyzeChords, pitchOf } from "./chords";
import { fresh, give } from "./fixtures";
import { DIRECTIONS, hex, hexDistance } from "./hex";

// The additive-synthesis formula (ADR-0014 / §4):
//   rate      = composite × empowerment × achievementBoost
//   composite = (carrier + Σ harmonic terms) × Π chord terms
// Straight axial lines (k,0) sit at hex distance k, so a chain (1,0)…(n,0)
// climbs pitches 2…n+1 — a readable way to build chords in tests.

describe("pitch", () => {
  it("is hex distance from the Carrier plus one", () => {
    expect(pitchOf(hex(0, 0))).toBe(1);
    expect(pitchOf(hex(1, 0))).toBe(2);
    expect(pitchOf(hex(0, -1))).toBe(2);
    expect(pitchOf(hex(2, 0))).toBe(3);
    expect(pitchOf(hex(2, -1))).toBe(3);
    expect(pitchOf(hex(9, 0))).toBe(10);
  });

  it("is pure distance: adjacent cells differ by at most one ring", () => {
    for (let q = -3; q <= 3; q++) {
      for (let r = -3; r <= 3; r++) {
        for (const [dq, dr] of DIRECTIONS) {
          const gap = Math.abs(hexDistance(hex(q, r), hex(q + dq, r + dr)));
          expect(gap <= 1).toBe(true);
        }
      }
    }
  });

  it("contributions expose the pitch of every deployed synthesizer", () => {
    const s = fresh();
    give(s, "additive", hex(2, 0));
    const snapshot = computeRates(s, true);
    expect(snapshot.contributions.get("m1")?.pitch).toBe(1);
    expect(snapshot.contributions.get("m2")?.pitch).toBe(3);
  });
});

describe("chord pairs", () => {
  it("adjacent synthesizers one pitch apart multiply the composite", () => {
    const s = fresh();
    give(s, "additive", hex(7, 0));
    give(s, "additive", hex(8, 0));
    // Pitches 8 and 9: above the named vocabulary, so raw pairs only.
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords).toHaveLength(0);
    expect(snapshot.pairs).toHaveLength(1);
    expect(snapshot.chordMultiplier).toBeCloseTo(1 + BALANCE.pairBonus, 9);
    expect(snapshot.rate).toBeCloseTo((0.1 + 0.1) * (1 + BALANCE.pairBonus), 9);
  });

  it("pair bonuses stack multiplicatively and uncapped", () => {
    const s = fresh();
    for (const q of [7, 8, 9, 10]) give(s, "additive", hex(q, 0));
    const snapshot = computeRates(s, true);
    expect(snapshot.pairs).toHaveLength(3);
    expect(snapshot.chordMultiplier).toBeCloseTo((1 + BALANCE.pairBonus) ** 3, 9);
  });

  it("identical pitches add amplitude without forming a chord", () => {
    const s = fresh();
    give(s, "additive", hex(2, 0));
    give(s, "additive", hex(2, -1));
    // Both pitch 3 and adjacent along a same-ring edge: amplitude, no chord.
    const snapshot = computeRates(s, true);
    expect(snapshot.pairs).toHaveLength(0);
    expect(snapshot.namedChords).toHaveLength(0);
    expect(snapshot.chordMultiplier).toBe(1);
    expect(snapshot.rate).toBeCloseTo(0.1 + 0.1, 9);
  });

  it("shelved synthesizers join no chord and add no harmonic", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0), 0).pos = null;
    const snapshot = computeRates(s, true);
    expect(snapshot.harmonics).toBe(0);
    expect(snapshot.namedChords).toHaveLength(0);
    expect(snapshot.rate).toBeCloseTo(0.1, 9);
  });
});

describe("named chords", () => {
  it("the launch vocabulary is four consecutive-pitch runs", () => {
    expect(NAMED_CHORDS.map((c) => c.name)).toEqual(["Octave", "Fifth", "Major triad", "Blues triad"]);
    for (const chord of NAMED_CHORDS) {
      const runs = chord.pitches.slice(1).map((p, i) => p - chord.pitches[i]!);
      expect(runs.every((step) => step === 1)).toBe(true);
    }
  });

  it("the octave is the only chord touching the Carrier", () => {
    expect(NAMED_CHORDS.filter((c) => c.pitches.includes(1))).toHaveLength(1);
    const s = fresh();
    give(s, "additive", hex(1, 0));
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => c.name)).toEqual(["Octave"]);
    expect(snapshot.pairs).toHaveLength(0);
    expect(snapshot.rate).toBeCloseTo((0.1 + 0.05) * 1.15, 9);
  });

  it("recognizes the fifth alongside the octave on a 1·2·3 chain", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0));
    give(s, "additive", hex(2, 0));
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => c.name)).toEqual(["Octave", "Fifth"]);
    // Both named chords replace their member pairs; nothing survives raw.
    expect(snapshot.pairs).toHaveLength(0);
    expect(snapshot.chordMultiplier).toBeCloseTo(1.15 * 1.3, 9);
    // The pitch-2 bridge sings in both chords.
    expect(snapshot.contributions.get("m2")?.chordTerms).toBe(2);
  });

  it("recognizes the blues triad 5:6:7 as a free-standing island", () => {
    const s = fresh();
    for (const q of [4, 5, 6]) give(s, "additive", hex(q, 0));
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => c.name)).toEqual(["Blues triad"]);
    expect(snapshot.pairs).toHaveLength(0);
    // No path back to the Carrier: the chord rings anyway.
    expect(snapshot.rate).toBeCloseTo((0.1 + 0.15) * 1.75, 9);
  });

  it("overlapping named chords stack multiplicatively on a 4·5·6·7 run", () => {
    const s = fresh();
    for (const q of [3, 4, 5, 6]) give(s, "additive", hex(q, 0));
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => c.name)).toEqual(["Major triad", "Blues triad"]);
    expect(snapshot.pairs).toHaveLength(0);
    expect(snapshot.chordMultiplier).toBeCloseTo(1.5 * 1.75, 9);
    expect(snapshot.rate).toBeCloseTo((0.1 + 0.2) * 1.5 * 1.75, 9);
  });

  it("replaces only its member pairs: a doubled voice keeps the anonymous pair", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0));
    give(s, "additive", hex(0, -1));
    // Two pitch-2 voices both adjacent to the Carrier (#29): the octave sings
    // through one of them; the other's pair is outside the named chord and
    // keeps the anonymous pair bonus (issue #29 — pairs outside any named
    // chord keep the anonymous bonus).
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords).toHaveLength(1);
    expect(snapshot.pairs).toHaveLength(1);
    expect(snapshot.chordMultiplier).toBeCloseTo(1.15 * (1 + BALANCE.pairBonus), 9);
    expect(snapshot.amplitude).toBeCloseTo(0.2, 9);
    // One voice sings the chord; the double chords anonymously.
    expect(snapshot.contributions.get("m2")?.chordTerms).toBe(1);
    expect(snapshot.contributions.get("m3")?.chordTerms).toBe(1);
  });

  it("keeps non-member pairs in mixed clusters with doubled voices", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // pitch 2 — octave voice
    give(s, "additive", hex(0, -1)); // pitch 2 — adjacent to the Carrier only
    give(s, "additive", hex(2, 0)); // pitch 3 — fifth voice with (1,0)
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => c.name)).toEqual(["Octave", "Fifth"]);
    // (Carrier, pitch-2 double) survives: neither module is a chord voice.
    expect(snapshot.pairs).toHaveLength(1);
    expect(snapshot.chordMultiplier).toBeCloseTo(1.15 * 1.3 * (1 + BALANCE.pairBonus), 9);
    expect(snapshot.contributions.get("m3")?.chordTerms).toBe(1);
  });

  it("the textbook 10:12:15 minor triad is geometrically impossible", () => {
    // A connected run covering pitches 10 through 15: every adjacent pair is
    // consecutive, so the gapped 10:12:15 voicing can never connect — and no
    // named chord reaches pitch 8 and beyond.
    const s = fresh();
    for (const q of [9, 10, 11, 12, 13, 14]) give(s, "additive", hex(q, 0));
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords).toHaveLength(0);
    expect(snapshot.pairs).toHaveLength(5);
    expect(snapshot.chordMultiplier).toBeCloseTo((1 + BALANCE.pairBonus) ** 5, 9);
  });

  it("recognizes each pattern once per cluster, not once per position", () => {
    const s = fresh();
    give(s, "additive", hex(4, 0));
    give(s, "additive", hex(5, 0));
    give(s, "additive", hex(6, 0));
    give(s, "additive", hex(4, 1));
    // (4,1) doubles pitch 6 (adjacent to both 5·6 voices): the cluster still
    // rings one blues triad; the double's consecutive pair at 5·6 is outside
    // the chord's voices and keeps the anonymous pair bonus.
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => c.name)).toEqual(["Blues triad"]);
    expect(snapshot.pairs).toHaveLength(1);
    expect(snapshot.chordMultiplier).toBeCloseTo(1.75 * (1 + BALANCE.pairBonus), 9);
  });
});

describe("conditional synthesizers", () => {
  it("pay amplitude plus a bonus per chord pair participated", () => {
    const s = fresh();
    give(s, "conditional", hex(1, 0));
    const snapshot = computeRates(s, true);
    // Octave voice: one participation.
    expect(snapshot.contributions.get("m2")?.chordTerms).toBe(1);
    expect(snapshot.contributions.get("m2")?.value).toBeCloseTo(0.05 * (1 + BALANCE.conditionalPairBonus), 9);
    expect(snapshot.rate).toBeCloseTo((0.1 + 0.05 * 1.1) * 1.15, 9);
  });

  it("count a named chord once however many member pairs they share in", () => {
    const s = fresh();
    give(s, "conditional", hex(1, 0));
    give(s, "additive", hex(2, 0));
    // The conditional bridges octave and fifth: two chord terms.
    const snapshot = computeRates(s, true);
    expect(snapshot.contributions.get("m2")?.chordTerms).toBe(2);
    expect(snapshot.contributions.get("m2")?.value).toBeCloseTo(0.05 * (1 + 2 * BALANCE.conditionalPairBonus), 9);
    expect(snapshot.rate).toBeCloseTo((0.1 + 0.05 * 1.2 + 0.05) * 1.15 * 1.3, 9);
  });

  it("stay plain amplitude when chordless", () => {
    const s = fresh();
    give(s, "conditional", hex(2, 0));
    const snapshot = computeRates(s, true);
    expect(snapshot.contributions.get("m2")?.chordTerms).toBe(0);
    expect(snapshot.rate).toBeCloseTo(0.15, 9);
  });

  it("additives never take the per-pair bonus", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0));
    const snapshot = computeRates(s, true);
    expect(snapshot.contributions.get("m2")?.chordTerms).toBe(1);
    expect(snapshot.contributions.get("m2")?.value).toBeCloseTo(0.05, 9);
  });
});

describe("live rate breakdown", () => {
  it("multiplies out exactly: rate = composite × empowerment × achievements", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0));
    give(s, "additive", hex(2, 0));
    give(s, "infusor", hex(3, 0));
    const snapshot = computeRates(s, true);
    expect(snapshot.amplitude).toBeCloseTo(snapshot.carrier + snapshot.harmonics, 9);
    expect(snapshot.composite).toBeCloseTo(snapshot.amplitude * snapshot.chordMultiplier, 9);
    expect(snapshot.empowerment).toBe(1);
    expect(snapshot.achievementBoost).toBe(1);
    expect(snapshot.rate).toBeCloseTo(snapshot.composite * snapshot.empowerment * snapshot.achievementBoost, 9);
  });

  it("charge aggregates into the empowerment leg, per module", () => {
    const s = fresh();
    give(s, "focusKeyed", hex(0, 1));
    s.chargeWindow = 60;
    const snapshot = computeRates(s, true);
    // Only the carrier is charged: the uncharged legs stay clean and the
    // empowerment leg carries the exact multiplier.
    expect(snapshot.composite).toBeCloseTo(0.1, 9);
    expect(snapshot.empowerment).toBeCloseTo(1.5, 9);
    expect(snapshot.rate).toBeCloseTo(snapshot.composite * snapshot.empowerment, 9);
  });

  it("keeps the empowerment leg honest across chords and conditionals", () => {
    const s = fresh();
    give(s, "conditional", hex(1, 0));
    give(s, "additive", hex(2, 0));
    give(s, "focusKeyed", hex(0, 1));
    s.chargeWindow = 60;
    // (0,1) touches both the Carrier and the conditional at (1,0): each
    // charges to strength 1 while the additive at (2,0) stays uncharged. The
    // conditional's per-pair bonus rides in its harmonic leg; empowerment is
    // exactly the charge story (1.5 on two of three modules).
    const snapshot = computeRates(s, true);
    const unchargedSum = 0.1 + 0.05 * (1 + 2 * BALANCE.conditionalPairBonus) + 0.05;
    const chargedSum = 0.1 * 1.5 + 0.05 * (1 + 2 * BALANCE.conditionalPairBonus) * 1.5 + 0.05;
    expect(snapshot.composite).toBeCloseTo(unchargedSum * 1.15 * 1.3, 9);
    expect(snapshot.rate).toBeCloseTo(chargedSum * 1.15 * 1.3, 9);
    expect(snapshot.empowerment).toBeCloseTo(chargedSum / unchargedSum, 9);
    expect(snapshot.rate).toBeCloseTo(snapshot.composite * snapshot.empowerment * snapshot.achievementBoost, 9);
  });

  it("keeps empowerment at unity when only chords boost the rate", () => {
    const s = fresh();
    give(s, "conditional", hex(1, 0));
    give(s, "additive", hex(2, 0));
    const snapshot = computeRates(s, true);
    // Two chord terms on the conditional, but no charge anywhere: the
    // empowerment leg must not absorb the chord bonus.
    expect(snapshot.empowerment).toBe(1);
    expect(snapshot.rate).toBeCloseTo(snapshot.composite, 9);
  });

  it("derives a module's contribution for tooltips", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0), 2);
    const snapshot = computeRates(s, true);
    const additive = snapshot.contributions.get("m2")!;
    expect(additive.pitch).toBe(2);
    expect(additive.amplitude).toBeCloseTo(1.2 ** 2, 9);
    expect(additive.value).toBeCloseTo(BALANCE.additiveRate * additive.amplitude, 9);
    expect(additive.chordTerms).toBe(1);
    // Its share of the composite: term × chord multiplier.
    expect(additive.value * snapshot.chordMultiplier).toBeCloseTo(0.05 * 1.44 * 1.15, 9);
  });

  it("the achievements leg exists at unity until ADR-0015 lands", () => {
    const s = fresh();
    expect(computeRates(s, true).achievementBoost).toBe(1);
  });
});

describe("cluster shape", () => {
  it("analyzes clusters without a path to the Carrier", () => {
    const s = fresh();
    const island = [
      give(s, "additive", hex(4, 0)),
      give(s, "additive", hex(5, 0)),
    ].map((m) => ({ ...m, pos: m.pos! }));
    // Pitches 5·6: a raw pair position — no named chord covers it.
    const analysis = analyzeChords(island);
    expect(analysis.namedChords).toHaveLength(0);
    expect(analysis.pairs).toHaveLength(1);
    expect(analysis.multiplier).toBeCloseTo(1.1, 9);
  });
});
