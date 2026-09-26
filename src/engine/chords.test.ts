import { describe, expect, it } from "vitest";
import { BALANCE, NAMED_CHORDS } from "./constants";
import { computeRates } from "./economy";
import { analyzeChords } from "./chords";
import { fresh, give } from "./fixtures";
import { hex } from "./hex";
import { pitchOf } from "./lattice";

// The chord model (ADR-0021/0022): register-free pitch sets over connected
// clusters of synthesizers — any voicing, any octave. The spacer conducts
// adjacency through chains of wired cells; bridged chords match by pitch
// content. Adjacency alone is chordless: the anonymous pair bonus is gone.
//
// Lattice recap (see lattice.test.ts): (0,0) is C4; (±1, 0) steps a fifth;
// (0, ±1) steps an octave. The opening board is C4 (0,0), G4 (1,0), C5 (0,1)
// with the opening synthesizer pre-placed at C4.

const fifth = 1 + 0.3;
const octave = 1 + 0.15;
const flatSeventh = 1 + 0.45;

describe("the named vocabulary is pitch-class sets", () => {
  it("spells the launch vocabulary with bonuses tracking the wire ladder", () => {
    expect(NAMED_CHORDS.map((c) => `${c.name}:${c.intervals.join(",")}`)).toEqual([
      "Octave:0,0",
      "Fifth:0,7",
      "Flat seventh:0,10",
      "Minor triad:0,3,7",
      "Major triad:0,4,7",
    ]);
    for (let i = 1; i < NAMED_CHORDS.length; i++) {
      expect(NAMED_CHORDS[i]!.bonus).toBeGreaterThan(NAMED_CHORDS[i - 1]!.bonus);
    }
  });
});

describe("register-free recognition", () => {
  it("a lone synthesizer is chordless", () => {
    const s = fresh();
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords).toHaveLength(0);
    expect(snapshot.chordMultiplier).toBe(1);
    expect(snapshot.rate).toBeCloseTo(BALANCE.synthRate, 9);
  });

  it("adjacent fifths form a Fifth: the opening pair C4 · G4", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // G4
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => `${c.name}×${c.instances}`)).toEqual(["Fifth×1"]);
    expect(snapshot.chordMultiplier).toBeCloseTo(fifth, 9);
    expect(snapshot.rate).toBeCloseTo(2 * BALANCE.synthRate * fifth, 9);
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
    // same pitch content — while the G pair stacks its own octave.
    expect(names).toEqual(["Fifth×2", "Octave×1"]);
    expect(snapshot.chordMultiplier).toBeCloseTo(fifth ** 2 * octave, 9);
  });

  it("adjacency alone is chordless: bridged non-matching voices pay nothing", () => {
    const s = fresh();
    give(s, "spacer", hex(1, -1)); // wire
    give(s, "spacer", hex(2, -1)); // wire
    give(s, "additive", hex(3, -1)); // A5 — a major sixth away: no named pair
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords).toHaveLength(0);
    expect(snapshot.chordMultiplier).toBe(1);
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

describe("instances stack", () => {
  it("doubled voices form Octave instances that stack — three Cs ring three octaves", () => {
    const s = fresh();
    give(s, "additive", hex(0, 1)); // C5
    give(s, "additive", hex(0, 2)); // C6
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => `${c.name}×${c.instances}`)).toEqual(["Octave×3"]);
    expect(snapshot.chordMultiplier).toBeCloseTo(octave ** 3, 9);
    // Every doubled voice sings the term — the panel read and the hulls
    // share moduleIds, so no voice is shown chordless while its instances
    // multiply the rate.
    expect(snapshot.namedChords[0]!.moduleIds.sort()).toEqual(["m1", "m2", "m3"]);
  });

  it("overlapping instances stack: a C · G · D row rings two fifths and a flat seventh", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // G4
    give(s, "additive", hex(2, 0)); // D5
    const snapshot = computeRates(s, true);
    // Register-free matching is generous (the accepted risk): as pitch
    // classes C is D's flat seventh, whatever octave either sits in.
    const names = snapshot.namedChords.map((c) => `${c.name}×${c.instances}`).sort();
    expect(names).toEqual(["Fifth×1", "Fifth×1", "Flat seventh×1"]);
    expect(snapshot.chordMultiplier).toBeCloseTo(fifth ** 2 * flatSeventh, 9);
    // Every voice sings in two instances: C (fifth + flat seventh), G (both
    // fifths), D (fifth + flat seventh).
    expect(snapshot.contributions.get("m1")?.chordTerms).toBe(2);
    expect(snapshot.contributions.get("m2")?.chordTerms).toBe(2);
    expect(snapshot.contributions.get("m3")?.chordTerms).toBe(2);
  });

  it("a doubled voice doubles the chord it joins", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // G4
    give(s, "additive", hex(1, -1)); // G3 — the fifth doubled at the octave
    const snapshot = computeRates(s, true);
    const names = snapshot.namedChords.map((c) => `${c.name}×${c.instances}`).sort();
    // Fifth×2: C pairs with each G. Octave×1: the G pair.
    expect(names).toEqual(["Fifth×2", "Octave×1"]);
    expect(snapshot.chordMultiplier).toBeCloseTo(fifth ** 2 * octave, 9);
  });

  it("disjoint same-chord clusters stack multiplicatively", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // G4 — Fifth with the opening C4
    give(s, "additive", hex(5, 0)); // B6 — a far island…
    give(s, "additive", hex(6, 0)); // F♯7 — …ringing its own Fifth
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => c.name)).toEqual(["Fifth", "Fifth"]);
    expect(snapshot.chordMultiplier).toBeCloseTo(fifth ** 2, 9);
  });
});

describe("the spacer conducts", () => {
  it("a wire bridges a ♭7: one spacer out, the flat-seventh chord forms", () => {
    const s = fresh();
    give(s, "spacer", hex(-1, 1)); // F4 — the wire cell
    give(s, "additive", hex(-2, 2)); // B♭4 — one wire cell out
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => `${c.name}×${c.instances}`)).toEqual(["Flat seventh×1"]);
    expect(snapshot.chordMultiplier).toBeCloseTo(flatSeventh, 9);
    expect(snapshot.rate).toBeCloseTo(2 * BALANCE.synthRate * flatSeventh, 9);
  });

  it("chains of wired cells conduct — a minor triad across two wires", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // G4 — the fifth voice, adjacent to C4
    give(s, "spacer", hex(-1, 1)); // wire
    give(s, "spacer", hex(-2, 1)); // wire
    give(s, "additive", hex(-3, 2)); // E♭4 — m3, two wire cells out
    const snapshot = computeRates(s, true);
    const names = snapshot.namedChords.map((c) => `${c.name}×${c.instances}`).sort();
    // The adjacent C · G pair rings its Fifth alongside the bridged triad.
    expect(names).toEqual(["Fifth×1", "Minor triad×1"]);
    expect(snapshot.chordMultiplier).toBeCloseTo(fifth * 1.6, 9);
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
    expect(snapshot.chordMultiplier).toBeCloseTo(fifth * 1.75, 9);
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
    // Without the wire they are two islands: adjacency gone, chord gone —
    // the wire was the only conductor.
    wire.pos = null;
    const split = computeRates(s, true);
    expect(split.namedChords).toHaveLength(0);
    expect(split.chordMultiplier).toBe(1);
  });
});

describe("conditional synthesizers", () => {
  it("pay their base term plus 10% per chord instance they belong to", () => {
    const s = fresh();
    give(s, "conditional", hex(1, 0)); // G4 — one Fifth instance with C4
    const snapshot = computeRates(s, true);
    expect(snapshot.contributions.get("m2")?.chordTerms).toBe(1);
    expect(snapshot.contributions.get("m2")?.value).toBeCloseTo(BALANCE.synthRate * (1 + BALANCE.conditionalChordBonus), 9);
    expect(snapshot.synths).toBeCloseTo(BALANCE.synthRate * 2 + BALANCE.synthRate * BALANCE.conditionalChordBonus, 9);
    expect(snapshot.rate).toBeCloseTo((2 * BALANCE.synthRate + BALANCE.synthRate * 0.1) * fifth, 9);
  });

  it("count every instance they sing in — the bridge rings twice", () => {
    const s = fresh();
    give(s, "conditional", hex(1, 0)); // G4
    give(s, "additive", hex(2, 0)); // D5 — conditional bridges two Fifths
    const snapshot = computeRates(s, true);
    expect(snapshot.contributions.get("m2")?.chordTerms).toBe(2);
    expect(snapshot.contributions.get("m2")?.value).toBeCloseTo(BALANCE.synthRate * (1 + 2 * BALANCE.conditionalChordBonus), 9);
  });

  it("stay plain amplitude when chordless", () => {
    const s = fresh();
    give(s, "conditional", hex(3, 0)); // A5 — its own island
    const snapshot = computeRates(s, true);
    expect(snapshot.contributions.get("m2")?.chordTerms).toBe(0);
    expect(snapshot.rate).toBeCloseTo(2 * BALANCE.synthRate, 9);
  });

  it("additives never take the per-instance bonus", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0));
    const snapshot = computeRates(s, true);
    expect(snapshot.contributions.get("m2")?.chordTerms).toBe(1);
    expect(snapshot.contributions.get("m2")?.value).toBeCloseTo(BALANCE.synthRate, 9);
  });
});

describe("live rate breakdown", () => {
  it("multiplies out exactly: rate = composite × empowerment × achievements", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // G4 — Fifth with C4
    give(s, "infusor", hex(0, 1)); // C5 — adjacent to both C4 and G4
    const snapshot = computeRates(s, true);
    // The infusor touches both synths: uplift is its own leg, and the
    // amplitude splits exactly across legs.
    expect(snapshot.infusors).toBeCloseTo(2 * BALANCE.synthRate * BALANCE.infusorBonus, 9);
    expect(snapshot.amplitude).toBeCloseTo(snapshot.synths + snapshot.infusors, 9);
    expect(snapshot.composite).toBeCloseTo(snapshot.amplitude * snapshot.chordMultiplier, 9);
    expect(snapshot.empowerment).toBeCloseTo(1, 9);
    expect(snapshot.achievementBoost).toBe(1);
    expect(snapshot.rate).toBeCloseTo(snapshot.composite * snapshot.empowerment * snapshot.achievementBoost, 9);
  });

  it("charge aggregates into the empowerment leg, per module", () => {
    const s = fresh();
    give(s, "focusKeyed", hex(0, 1)); // C5 — adjacent to the opening C4
    s.chargeWindow = 60;
    const snapshot = computeRates(s, true);
    expect(snapshot.composite).toBeCloseTo(BALANCE.synthRate, 9);
    expect(snapshot.empowerment).toBeCloseTo(1.5, 9);
    expect(snapshot.rate).toBeCloseTo(snapshot.composite * snapshot.empowerment, 9);
  });

  it("keeps empowerment at unity when only chords boost the rate", () => {
    const s = fresh();
    give(s, "conditional", hex(1, 0));
    give(s, "additive", hex(2, 0));
    const snapshot = computeRates(s, true);
    expect(snapshot.empowerment).toBe(1);
    expect(snapshot.rate).toBeCloseTo(snapshot.composite, 9);
  });

  it("derives a module's contribution and pitch for tooltips", () => {
    const s = fresh();
    const g = give(s, "additive", hex(1, 0), 2); // G4, level 2
    const snapshot = computeRates(s, true);
    const contribution = snapshot.contributions.get(g.id)!;
    expect(contribution.pitch).toBe(67);
    expect(contribution.amplitude).toBeCloseTo(1.2 ** 2, 9);
    expect(contribution.value).toBeCloseTo(BALANCE.synthRate * contribution.amplitude, 9);
    expect(contribution.chordTerms).toBe(1);
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
      island.map((m) => ({ ...m, pos: m.pos! })),
    );
    // (-5,3) is A♭6 (class 8); (-4,3) is E♭7 (class 3): a fifth apart.
    expect(analysis.namedChords.map((c) => `${c.name}×${c.instances}`)).toEqual(["Fifth×1"]);
    expect(analysis.multiplier).toBeCloseTo(fifth, 9);
  });
});
