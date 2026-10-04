import { describe, expect, it } from "vitest";
import { BALANCE, NAMED_CHORDS } from "./constants";
import { chargedFactor, computeRates } from "./economy";
import { analyzeChords, newChordTerms, wouldFormPreview } from "./chords";
import { deserialize, serialize } from "./save";
import { fresh, give, sumSynthValues } from "./fixtures";
import { hex } from "./hex";
import { pitchOf } from "./lattice";

// The chord model (ADR-0021/0022, extended by ADR-0048/0049): register-free
// pitch sets over connected formations of oscillators and silent voices —
// any voicing, any octave. Chord bonuses are LOCAL: each instance multiplies
// only its member voices, so overlapping and repeated instances stack on
// their voices while distant modules are untouched. The spacer conducts
// adjacency through chains of wired cells; bridged chords match by pitch
// content. Adjacency alone is chordless: the anonymous pair bonus is gone.
// Every formation scores one quality Q (ADR-0049) that rides each member's
// factor exactly once.
//
// Lattice recap (see lattice.test.ts): (0,0) is C4; (±1, 0) steps a fifth;
// (0, ±1) steps an octave. The opening board is C4 (0,0), G4 (1,0), C5 (0,1)
// with the opening synthesizer pre-placed at C4.

// The formation quality for the tensionless two-class formations these
// tests build ({0,7}, {0,10}, {0,2}): complexity alone, tension forgiven.
const q2 = 1 + BALANCE.complexityRate;
// The three-class triads ({0,3,7}, {0,4,7}, {0,2,7}): the small tensions
// are forgiven whole to the named formation.
const q3 = 1 + BALANCE.complexityRate * 2;
// Raw named-instance factors — the formation's Q multiplies on top, once.
const fifth = 1 + 0.3;
const octave = 1 + 0.15;
const flatSeventh = 1 + 0.45;
const suspendedFourth = 1 + 0.55;

// A synthesizer's final ν/s: base × chord factor × infusor × charge ×
// achievements (charge and achievements at unity in these fixtures).
const voiceValue = (power: number, factor: number): number => BALANCE.synthRate * power * factor;

describe("the named vocabulary is pitch-class sets", () => {
  it("spells #218's eleven classes with bonuses tracking the wire ladder", () => {
    expect(NAMED_CHORDS.map((c) => `${c.name}:${c.intervals.join(",")}`)).toEqual([
      "Octave:0,0",
      "Fifth:0,7",
      "Flat seventh:0,10",
      "Suspended fourth:0,5,7",
      "Minor triad:0,3,7",
      "Diminished triad:0,3,6",
      "Augmented triad:0,4,8",
      "Major triad:0,4,7",
      "Minor seventh:0,3,7,10",
      "Dominant seventh:0,4,7,10",
      "Major seventh:0,4,7,11",
    ]);
    // Harder chords cost more board and earn bigger multipliers — within
    // each tier; the six new classes ride the tuning table's tiers.
    expect(NAMED_CHORDS.find((c) => c.name === "Major seventh")!.bonus).toBeGreaterThan(
      NAMED_CHORDS.find((c) => c.name === "Major triad")!.bonus,
    );
    expect(NAMED_CHORDS.find((c) => c.name === "Dominant seventh")!.bonus).toBeGreaterThan(
      NAMED_CHORDS.find((c) => c.name === "Minor triad")!.bonus,
    );
  });
});

describe("register-free recognition", () => {
  it("a lone synthesizer is chordless and worth its bare term", () => {
    const s = fresh();
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords).toHaveLength(0);
    expect(snapshot.contributions.get("m1")?.chordFactor).toBe(1);
    expect(snapshot.rate).toBeCloseTo(BALANCE.synthRate, 9);
  });

  it("adjacent fifths form a Fifth: the opening pair C4 · G4", () => {
    const s = fresh();
    const g = give(s, "additive", hex(1, 0)); // G4
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => `${c.name}×${c.instances}`)).toEqual(["Fifth×1"]);
    // Local: both members carry ×1.3 × the pair's Q and the rate is the
    // sum of their final figures — not the bare terms times a board-wide
    // multiplier.
    expect(snapshot.contributions.get("m1")?.value).toBeCloseTo(voiceValue(1, fifth * q2), 9);
    expect(snapshot.contributions.get(g.id)?.value).toBeCloseTo(voiceValue(1, fifth * q2), 9);
    expect(snapshot.rate).toBeCloseTo(2 * BALANCE.synthRate * fifth * q2, 9);
  });

  it("the octave stacks vertically: C4 · C5 form an Octave", () => {
    const s = fresh();
    give(s, "additive", hex(0, 1)); // C5
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => `${c.name}×${c.instances}`)).toEqual(["Octave×1"]);
    expect(snapshot.rate).toBeCloseTo(2 * BALANCE.synthRate * octave, 9);
  });

  it("any voicing, any octave: a twelfth apart is still a Fifth", () => {
    const s = fresh();
    // G5 at (1,1) is two steps out; bridge with the G4 at (1,0).
    give(s, "additive", hex(1, 0)); // G4
    give(s, "additive", hex(1, 1)); // G5 — a twelfth above C4
    const snapshot = computeRates(s, true);
    const names = snapshot.namedChords.map((c) => `${c.name}×${c.instances}`).sort();
    // Register-free: C4 pairs with each G — a fifth and a twelfth are the
    // same pitch content — while the G pair stacks its own octave. One
    // formation, one Q.
    expect(names).toEqual(["Fifth×2", "Octave×1"]);
    // Every voice carries its own stacked factor × the formation's Q: C4
    // sings two fifths, each G a fifth and their octave.
    const factors = [...snapshot.contributions.values()]
      .filter((c) => c.type === "additive")
      .map((c) => c.chordFactor)
      .sort();
    expect(factors).toEqual([fifth * octave * q2, fifth * octave * q2, fifth ** 2 * q2]);
    expect(snapshot.rate).toBeCloseTo(BALANCE.synthRate * (fifth ** 2 + 2 * fifth * octave) * q2, 9);
  });

  it("adjacency alone is chordless: bridged non-matching voices pay nothing", () => {
    const s = fresh();
    give(s, "spacer", hex(1, -1)); // wire
    give(s, "spacer", hex(2, -1)); // wire
    give(s, "additive", hex(3, -1)); // A5 — a major sixth away: no named pair
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords).toHaveLength(0);
    expect(snapshot.contributions.get("m1")?.chordFactor).toBe(1);
    expect(snapshot.rate).toBeCloseTo(2 * BALANCE.synthRate, 9);
  });

  it("shelved synthesizers join no chord and add no term", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)).pos = null;
    const snapshot = computeRates(s, true);
    expect(snapshot.synths).toBeCloseTo(BALANCE.synthRate, 9);
    expect(snapshot.namedChords).toHaveLength(0);
    expect(snapshot.rate).toBeCloseTo(BALANCE.synthRate, 9);
  });
});

describe("instances stack on their members", () => {
  it("doubled voices form Octave instances that stack — three Cs ring three octaves", () => {
    const s = fresh();
    give(s, "additive", hex(0, 1)); // C5
    give(s, "additive", hex(0, 2)); // C6
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => `${c.name}×${c.instances}`)).toEqual(["Octave×3"]);
    // Repeated instances stack on the members: each C sings in two of the
    // three pairs, so each carries ×1.15².
    for (const id of ["m1", "m2", "m3"]) {
      expect(snapshot.contributions.get(id)?.chordFactor).toBeCloseTo(octave ** 2, 9);
      expect(snapshot.contributions.get(id)?.chordTerms).toBe(2);
    }
    expect(snapshot.rate).toBeCloseTo(3 * BALANCE.synthRate * octave ** 2, 9);
    // Every doubled voice sings the term — the panel read and the hulls
    // share moduleIds, so no voice is shown chordless while its instances
    // multiply the rate.
    expect(snapshot.namedChords[0]!.moduleIds.sort()).toEqual(["m1", "m2", "m3"]);
  });

  it("overlapping instances stack on members only: C · G · D leaves no voice untouched but adds nothing elsewhere", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // G4
    give(s, "additive", hex(2, 0)); // D5
    const far = give(s, "additive", hex(5, 0)); // B6 — its own island, chordless
    const snapshot = computeRates(s, true);
    // Register-free matching is generous (the accepted risk): as pitch
    // classes C is D's flat seventh, whatever octave either sits in. The
    // bridged trio's classes {0,2,7}: the whole-tone pair's 0.2 is forgiven
    // whole to the named formation.
    const names = snapshot.namedChords.map((c) => `${c.name}×${c.instances}`).sort();
    // The 11-class vocabulary: the quartal stack is a Suspended fourth on
    // G — every cluster voice sings it.
    expect(names).toEqual(["Fifth×1", "Fifth×1", "Flat seventh×1", "Suspended fourth×1"]);
    const qTrio = 1 + BALANCE.complexityRate * 2;
    // Each cluster voice stacks the factors of the instances it sings in ×
    // the trio's Q: C and D (fifth + flat seventh + sus fourth), G (both
    // fifths + sus fourth).
    expect(snapshot.contributions.get("m1")?.chordFactor).toBeCloseTo(fifth * flatSeventh * suspendedFourth * qTrio, 9);
    expect(snapshot.contributions.get("m1")?.chordTerms).toBe(3);
    expect(snapshot.contributions.get("m2")?.chordFactor).toBeCloseTo(fifth ** 2 * suspendedFourth * qTrio, 9);
    expect(snapshot.contributions.get("m2")?.chordTerms).toBe(3);
    expect(snapshot.contributions.get("m3")?.chordFactor).toBeCloseTo(fifth * flatSeventh * suspendedFourth * qTrio, 9);
    expect(snapshot.contributions.get("m3")?.chordTerms).toBe(3);
    // The distant module is unchanged: no factor, no term, bare value.
    expect(far.pos).not.toBeNull();
    expect(snapshot.contributions.get(far.id)?.chordFactor).toBe(1);
    expect(snapshot.contributions.get(far.id)?.formationQ).toBe(1);
    expect(snapshot.contributions.get(far.id)?.chordTerms).toBe(0);
    expect(snapshot.contributions.get(far.id)?.value).toBeCloseTo(BALANCE.synthRate, 9);
    // The displayed figures sum to the board rate within rounding.
    expect(sumSynthValues(snapshot)).toBeCloseTo(snapshot.rate, 9);
  });

  it("a doubled voice doubles the chord it joins", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // G4
    give(s, "additive", hex(1, -1)); // G3 — the fifth doubled at the octave
    const snapshot = computeRates(s, true);
    const names = snapshot.namedChords.map((c) => `${c.name}×${c.instances}`).sort();
    // Fifth×2: C pairs with each G. Octave×1: the G pair.
    expect(names).toEqual(["Fifth×2", "Octave×1"]);
    // C4 sings two fifths; each G its fifth and their octave — one Q.
    expect(snapshot.contributions.get("m1")?.chordFactor).toBeCloseTo(fifth ** 2 * q2, 9);
    for (const id of ["m2", "m3"]) {
      expect(snapshot.contributions.get(id)?.chordFactor).toBeCloseTo(fifth * octave * q2, 9);
    }
  });

  it("disjoint same-chord clusters stack on their own members, never on strangers", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // G4 — Fifth with the opening C4
    give(s, "additive", hex(5, 0)); // B6 — a far island…
    give(s, "additive", hex(6, 0)); // F♯7 — …ringing its own Fifth
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => c.name)).toEqual(["Fifth", "Fifth"]);
    // Each cluster's pair carries ×1.3 × its own Q locally; no voice
    // carries the other cluster's factor or quality.
    for (const id of ["m1", "m2", "m3", "m4"]) {
      expect(snapshot.contributions.get(id)?.chordFactor).toBeCloseTo(fifth * q2, 9);
    }
    expect(snapshot.rate).toBeCloseTo(4 * BALANCE.synthRate * fifth * q2, 9);
  });

  it("a disconnected synthesizer is unchanged by every chord on the board", () => {
    const s = fresh();
    give(s, "additive", hex(0, 1)); // C5 — Octave with the opening voice
    const island = give(s, "additive", hex(-5, 3)); // A♭6 — no path, no match
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => `${c.name}×${c.instances}`)).toEqual(["Octave×1"]);
    expect(snapshot.contributions.get(island.id)?.chordFactor).toBe(1);
    expect(snapshot.contributions.get(island.id)?.chordTerms).toBe(0);
    expect(snapshot.contributions.get(island.id)?.value).toBeCloseTo(BALANCE.synthRate, 9);
    // The chorded pair earns the bonus; the rate is the pair's figures plus
    // the island's bare term.
    expect(snapshot.rate).toBeCloseTo(2 * BALANCE.synthRate * octave + BALANCE.synthRate, 9);
  });
});

describe("the spacer conducts", () => {
  it("a wire bridges a ♭7: one spacer out, the flat-seventh chord forms", () => {
    const s = fresh();
    give(s, "spacer", hex(-1, 1)); // F4 — the wire cell
    give(s, "additive", hex(-2, 2)); // B♭4 — one wire cell out
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => `${c.name}×${c.instances}`)).toEqual(["Flat seventh×1"]);
    expect(snapshot.contributions.get("m1")?.chordFactor).toBeCloseTo(flatSeventh * q2, 9);
    expect(snapshot.contributions.get("m3")?.chordFactor).toBeCloseTo(flatSeventh * q2, 9);
    expect(snapshot.rate).toBeCloseTo(2 * BALANCE.synthRate * flatSeventh * q2, 9);
  });

  it("chains of wired cells conduct — a minor triad across two wires", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // G4 — the fifth voice, adjacent to C4
    give(s, "spacer", hex(-1, 1)); // wire
    give(s, "spacer", hex(-2, 1)); // wire
    give(s, "additive", hex(-3, 2)); // E♭4 — m3, two wire cells out
    const snapshot = computeRates(s, true);
    const names = snapshot.namedChords.map((c) => `${c.name}×${c.instances}`).sort();
    // The adjacent C · G pair rings its Fifth alongside the bridged triad —
    // and register-free, the triad root C holds C4, G4, and E♭4, so both C4
    // and G4 sing in the Fifth and the triad; E♭4 only the triad. One
    // formation, one Q.
    expect(names).toEqual(["Fifth×1", "Minor triad×1"]);
    expect(snapshot.contributions.get("m1")?.chordFactor).toBeCloseTo(fifth * 1.6 * q3, 9);
    expect(snapshot.contributions.get("m2")?.chordFactor).toBeCloseTo(fifth * 1.6 * q3, 9);
    expect(snapshot.contributions.get("m5")?.chordFactor).toBeCloseTo(1.6 * q3, 9);
  });

  it("a major triad costs three wires — the ladder's top rung", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // G4
    give(s, "spacer", hex(1, -1)); // wire
    give(s, "spacer", hex(2, -1)); // wire
    give(s, "spacer", hex(3, -1)); // wire
    give(s, "additive", hex(4, -2)); // E4 — M3, three wire cells out
    const snapshot = computeRates(s, true);
    const names = snapshot.namedChords.map((c) => `${c.name}×${c.instances}`).sort();
    expect(names).toEqual(["Fifth×1", "Major triad×1"]);
    expect(snapshot.contributions.get("m1")?.chordFactor).toBeCloseTo(fifth * 1.75 * q3, 9);
  });

  it("the spacer never joins a pitch set and never produces", () => {
    const s = fresh();
    const spacer = give(s, "spacer", hex(1, 0)); // G4's cell, wired to C4
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords).toHaveLength(0); // C alone: no Octave from wire
    expect(snapshot.synths).toBeCloseTo(BALANCE.synthRate, 9);
    expect(snapshot.contributions.get(spacer.id)?.value).toBe(0);
    expect(snapshot.contributions.get(spacer.id)?.amplitude).toBe(0);
    expect(snapshot.rate).toBeCloseTo(BALANCE.synthRate, 9);
  });

  it("shared wire merges clusters: bridged voices ring a chord they can't reach alone", () => {
    const s = fresh();
    const wire = give(s, "spacer", hex(1, 0));
    give(s, "additive", hex(2, 0)); // D5
    // With the wire: C4 and D5 connect — one cluster — and their pitch
    // content rings a flat seventh (D's root, C a register-free ♭7 below).
    const bridged = computeRates(s, true);
    expect(bridged.namedChords.map((c) => `${c.name}×${c.instances}`)).toEqual(["Flat seventh×1"]);
    expect(bridged.contributions.get("m1")?.chordFactor).toBeCloseTo(flatSeventh * q2, 9);
    // Without the wire they are two islands: adjacency gone, chord gone —
    // the wire was the only conductor, and both voices fall back to bare.
    wire.pos = null;
    const split = computeRates(s, true);
    expect(split.namedChords).toHaveLength(0);
    expect(split.contributions.get("m1")?.chordFactor).toBe(1);
    expect(split.contributions.get("m3")?.chordFactor).toBe(1);
  });
});

describe("the silent voice sings nothing of its own (the Conditional's mechanic is dead)", () => {
  it("the Harmonizer produces zero while its uplift rides the members", () => {
    const s = fresh();
    const harm = give(s, "harmonizer", hex(1, 0)); // G4 — one Fifth instance with C4
    const snapshot = computeRates(s, true);
    expect(snapshot.contributions.get(harm.id)?.chordTerms).toBe(1);
    expect(snapshot.contributions.get(harm.id)?.value).toBe(0);
    // The chord's ×1.3 rides the producer with the formation's Q; the
    // silent voice earns it nothing beyond its (level-0) uplift.
    expect(snapshot.contributions.get("m1")?.value).toBeCloseTo(BALANCE.synthRate * fifth * q2, 9);
    expect(snapshot.rate).toBeCloseTo(BALANCE.synthRate * fifth * q2, 9);
  });

  it("stay plain amplitude when chordless — and never read as producers", () => {
    const s = fresh();
    const harm = give(s, "harmonizer", hex(3, 0)); // A5 — its own island
    const snapshot = computeRates(s, true);
    expect(snapshot.contributions.get(harm.id)?.chordTerms).toBe(0);
    expect(snapshot.contributions.get(harm.id)?.chordFactor).toBe(1);
    expect(snapshot.contributions.get(harm.id)?.formationQ).toBe(1);
    expect(snapshot.rate).toBeCloseTo(BALANCE.synthRate, 9);
  });

  it("additives never take a per-instance bonus on top of the factor", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0));
    const snapshot = computeRates(s, true);
    expect(snapshot.contributions.get("m2")?.chordTerms).toBe(1);
    expect(snapshot.contributions.get("m2")?.value).toBeCloseTo(BALANCE.synthRate * fifth * q2, 9);
  });
});

describe("the local rate breakdown", () => {
  it("multiplies out exactly: rate = (synths + infusors) × empowerment × achievements", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // G4 — Fifth with C4
    give(s, "infusor", hex(0, 1)); // C5 — adjacent to both C4 and G4
    const snapshot = computeRates(s, true);
    // The booster touches both synths: uplift is its own leg, chord-weighted
    // so the amplitude splits exactly across legs.
    expect(snapshot.infusors).toBeCloseTo(2 * BALANCE.synthRate * fifth * q2 * BALANCE.infusorBonus, 9);
    expect(snapshot.synths).toBeCloseTo(2 * BALANCE.synthRate * fifth * q2, 9);
    expect(snapshot.amplitude).toBeCloseTo(snapshot.synths + snapshot.infusors, 9);
    expect(snapshot.empowerment).toBeCloseTo(1, 9);
    expect(snapshot.achievementBoost).toBe(1);
    expect(snapshot.rate).toBeCloseTo(snapshot.amplitude * snapshot.empowerment * snapshot.achievementBoost, 9);
  });

  it("every synthesizer's figure carries its local chords, charge, and achievements", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // G4 — Fifth with C4
    s.achievements["first-light"] = 1; // one feat: +2% board-wide
    give(s, "focusKeyed", hex(1, 1)); // G5's cell — adjacent to G4 only
    const gen = s.modules.find((m) => m.type === "focusKeyed")!;
    gen.reserve = 60;
    const snapshot = computeRates(s, true);
    const boost = 1 + BALANCE.achievementBoostPerFeat;
    const charge = chargedFactor(1);
    // C4: chord only. G4: chord + charge.
    expect(snapshot.contributions.get("m1")?.value).toBeCloseTo(BALANCE.synthRate * fifth * q2 * boost, 9);
    expect(snapshot.contributions.get("m2")?.value).toBeCloseTo(
      BALANCE.synthRate * fifth * q2 * charge * boost,
      9,
    );
    // Displayed figures sum to the board rate within rounding.
    expect(sumSynthValues(snapshot)).toBeCloseTo(snapshot.rate, 9);
    expect(snapshot.rate).toBeCloseTo(snapshot.amplitude * snapshot.empowerment * boost, 9);
  });

  it("keeps empowerment at unity when only chords boost the rate", () => {
    const s = fresh();
    give(s, "harmonizer", hex(1, 0));
    give(s, "additive", hex(2, 0));
    const snapshot = computeRates(s, true);
    expect(snapshot.empowerment).toBe(1);
    expect(snapshot.rate).toBeCloseTo(snapshot.amplitude, 9);
  });

  it("derives a module's contribution and pitch for tooltips", () => {
    const s = fresh();
    const g = give(s, "additive", hex(1, 0), 2); // G4, level 2
    const snapshot = computeRates(s, true);
    const contribution = snapshot.contributions.get(g.id)!;
    expect(contribution.pitch).toBe(67);
    expect(contribution.amplitude).toBeCloseTo(1.2 ** 2, 9);
    expect(contribution.chordFactor).toBeCloseTo(fifth * q2, 9);
    expect(contribution.value).toBeCloseTo(BALANCE.synthRate * contribution.amplitude * fifth * q2, 9);
    expect(contribution.chordTerms).toBe(1);
    expect(contribution.formationQ).toBeCloseTo(q2, 9);
  });

  it("exposes the pitch of every deployed synthesizer", () => {
    const s = fresh();
    give(s, "additive", hex(2, 0)); // D5
    const snapshot = computeRates(s, true);
    expect(snapshot.contributions.get("m1")?.pitch).toBe(60);
    expect(snapshot.contributions.get("m2")?.pitch).toBe(74);
    expect(pitchOf(hex(2, 0))).toBe(74);
  });
});

describe("cluster shape", () => {
  it("analyzes free-floating islands without any path to the opening synth", () => {
    const s = fresh();
    const island = [give(s, "additive", hex(-5, 3)), give(s, "additive", hex(-4, 3))];
    const analysis = analyzeChords(
      island.map((m) => ({ module: { ...m, pos: m.pos! }, pitch: pitchOf(m.pos!) })),
    );
    // (-5,3) is A♭6 (class 8); (-4,3) is E♭7 (class 3): a fifth apart.
    expect(analysis.namedChords.map((c) => `${c.name}×${c.instances}`)).toEqual(["Fifth×1"]);
    for (const module of island) {
      expect(analysis.voiceMultiplier.get(module.id)).toBeCloseTo(fifth * q2, 9);
    }
  });

  it("a doubled flat seventh carries one voice past ×2 — the power-chord read", () => {
    const s = fresh();
    // C4 · G4 · D5 · D6: the G4 bridges the cluster, and register-free the
    // G pairs with both Ds (root-G Fifth ×2) while the ♭7 rings twice
    // against D — D5 sings the root-C Fifth, a root-G Fifth, the ♭7, and
    // its octave with D6, stacking past ×2 on its own. Classes {0,2,7}:
    // the whole-tone pair is forgiven whole to the named formation.
    give(s, "additive", hex(1, 0)); // G4 — the bridge
    give(s, "additive", hex(2, 0)); // D5
    give(s, "additive", hex(2, 1)); // D6
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => `${c.name}×${c.instances}`).sort()).toEqual([
      "Fifth×1",
      "Fifth×2",
      "Flat seventh×2",
      "Octave×1",
      "Suspended fourth×2",
    ]);
    const qTrio = 1 + BALANCE.complexityRate * 2;
    // C4: the root-C Fifth, both ♭7 instances, and the sus fourth ×2.
    expect(snapshot.contributions.get("m1")?.chordFactor).toBeCloseTo(
      fifth * flatSeventh ** 2 * suspendedFourth ** 2 * qTrio,
      9,
    );
    const d5 = snapshot.contributions.get("m3")?.chordFactor;
    expect(d5).toBeCloseTo(fifth * flatSeventh * octave * suspendedFourth * qTrio, 9);
    expect(d5!).toBeGreaterThan(2);
    // Each voice carries exactly its own instances × the one Q: G4 sings
    // three fifths and both sus fourths, D6 one fifth, one ♭7, its octave,
    // its sus fourth.
    expect(snapshot.contributions.get("m2")?.chordFactor).toBeCloseTo(fifth ** 3 * suspendedFourth ** 2 * qTrio, 9);
    expect(snapshot.contributions.get("m4")?.chordFactor).toBeCloseTo(d5!, 9);
  });
});

describe("save continuity", () => {
  it("a chorded board round-trips: the same voices ring the same local factors", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // G4 — Fifth
    give(s, "additive", hex(2, 0)); // D5 — the overlapping row
    const before = computeRates(s, true);
    const revived = deserialize(serialize(s)).state!;
    expect(revived.modules.map((m) => `${m.id}:${m.type}`)).toEqual(s.modules.map((m) => `${m.id}:${m.type}`));
    const after = computeRates(revived, true);
    expect(after.namedChords.map((c) => `${c.name}×${c.instances}`)).toEqual(
      before.namedChords.map((c) => `${c.name}×${c.instances}`),
    );
    expect(after.rate).toBeCloseTo(before.rate, 9);
    for (const [id, contribution] of before.contributions) {
      // Every voice in this fixture is a synthesizer: a real factor each.
      expect(after.contributions.get(id)?.chordFactor).toBeCloseTo(contribution.chordFactor!, 9);
      expect(after.contributions.get(id)?.value).toBeCloseTo(contribution.value, 9);
    }
  });
});

describe("the would-form preview (spec §5–§6)", () => {
  const live = (s: ReturnType<typeof fresh>) => computeRates(s, true).namedChords;

  it("previews the chord a tray placement would form", () => {
    const s = fresh(); // C4 synth m1, cells C4 · G4 · C5
    give(s, "additive", null); // m2 waits in the tray
    const formed = newChordTerms(live(s), wouldFormPreview(s, "m2", hex(0, 1)).chords);
    // Dropped on C5 it rings the Octave with the opening synth — the ghost
    // the dashed hull previews before the drop (§6).
    expect(formed.map((c) => c.name)).toEqual(["Octave"]);
  });

  it("an occupied target swaps: the occupant takes the mover's cell", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // m2 at G4 — a Fifth with C4
    // m1 dropped onto m2's cell swaps them; the same voices ring the same
    // chord, so no ghost — and the hypothetical still carries the Fifth.
    const next = wouldFormPreview(s, "m1", hex(1, 0)).chords;
    expect(newChordTerms(live(s), next)).toHaveLength(0);
    expect(next.map((c) => `${c.name}×${c.instances}`)).toEqual(["Fifth×1"]);
  });

  it("an added instance previews: a dropped voice doubling the Fifth forms a second one", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // m2 G4 — Fifth ×1 with the opening synth
    give(s, "additive", null); // m3 waits in the tray
    const formed = newChordTerms(live(s), wouldFormPreview(s, "m3", hex(0, 1)).chords);
    // Dropped on C5 it doubles the Fifth's root — the second instance is a
    // chord forming (§6), stacked with the Octave the drop also rings.
    expect(formed.map((c) => `${c.name}×${c.instances}`).sort()).toEqual(["Fifth×2", "Octave×1"]);
  });

  it("a shed instance is a break, never a forming: Fifth ×2 → ×1 previews nothing", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // G4
    give(s, "additive", hex(0, 1)); // C5 — the doubled root: Fifth ×2
    expect(live(s).map((c) => `${c.name}×${c.instances}`).sort()).toEqual(["Fifth×2", "Octave×1"]);
    const next = wouldFormPreview(s, "m3", hex(2, 2)).chords; // C5 dragged to an isolated D6
    expect(newChordTerms(live(s), next)).toHaveLength(0);
  });

  it("what breaks is never previewed — only newcomers come back", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // m2: the Fifth's second voice
    expect(live(s).map((c) => c.name)).toEqual(["Fifth"]);
    const next = wouldFormPreview(s, "m2", hex(5, 0)).chords; // dragged far off the cluster
    expect(newChordTerms(live(s), next)).toHaveLength(0);
  });

  it("an inventory placement onto an occupied cell evicts the occupant", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // m2 G4 — Fifth
    give(s, "additive", hex(0, 1)); // m3 C5 — Octave with C4
    // Tray synth m4 dropped onto m3's cell: m3 leaves the board, m4 sings
    // in its place. The Octave at the same root persists — a voice change,
    // not a forming — so nothing previews, and the hypothetical rings both.
    give(s, "additive", null); // m4 in the tray
    const next = wouldFormPreview(s, "m4", hex(0, 1)).chords;
    expect(newChordTerms(live(s), next)).toHaveLength(0);
    expect(next.map((c) => c.name).sort()).toEqual(["Fifth", "Octave"]);
  });

  it("a spacer drop previews the chord its wire would bridge", () => {
    const s = fresh();
    give(s, "additive", hex(-2, 2)); // m2 B♭4 — one wire cell out of reach
    expect(live(s)).toHaveLength(0);
    give(s, "spacer", null); // m3 wire in the tray
    const formed = newChordTerms(live(s), wouldFormPreview(s, "m3", hex(-1, 1)).chords);
    expect(formed.map((c) => c.name)).toEqual(["Flat seventh"]);
  });

  it("non-conductor moves preview nothing new", () => {
    const s = fresh();
    give(s, "infusor", hex(1, 0));
    expect(newChordTerms(live(s), wouldFormPreview(s, "m2", hex(0, 1)).chords)).toHaveLength(0);
  });

  it("an unknown module previews nothing", () => {
    const s = fresh();
    expect(wouldFormPreview(s, "m99", hex(0, 1)).chords).toHaveLength(0);
  });
});
