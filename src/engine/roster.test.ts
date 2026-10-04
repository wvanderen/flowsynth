import { describe, expect, it } from "vitest";
import { BALANCE, NAMED_CHORDS } from "./constants";
import { computeRates, blasterConversion } from "./economy";
import { formationQuality } from "./chords";
import { deserialize, serialize } from "./save";
import { fresh, give } from "./fixtures";
import { setBendShift } from "./actions";
import { BUILD_MILESTONE_SECONDS, buildUnlocksFor, equipSlotsFor } from "./builds";
import { hex } from "./hex";
import { createMutator } from "./state";
import { pitchOf } from "./lattice";

// The roster wave (ADR-0048) and the harmony formula (ADR-0049): the
// silent voices sing derived pitches and count in the quality's read, the
// conduit routes charge, the Blaster converts charge into its synth term,
// and every connected formation scores one Q that rides each member's
// chord factor. All magnitudes ride the spec's tuning table.

const synthRate = BALANCE.synthRate;

describe("the three-way balance (the acceptance check)", () => {
  // A formation's per-voice read: the average final ν/s across its
  // oscillators — the same read the prototype's harness scored. Voices
  // chain through wired cells so each pitch-class set is one connected
  // formation, register-free like the board itself.
  function perVoice(classes: number[]): { average: number; q: number } {
    const s = fresh();
    // Cell columns walk the circle of fifths: class c sits at q = 7c (mod
    // 12). Place each voice at its class's column, spacers bridging the
    // gaps, all in row 0.
    const columns = classes.map((c) => (7 * c) % 12).sort((a, b) => a - b);
    const occupied = new Set<number>(columns);
    for (let q = columns[0]!; q <= columns[columns.length - 1]!; q++) {
      if (!occupied.has(q)) give(s, "spacer", hex(q, 0));
    }
    for (const q of columns) {
      // The opening oscillator already sings column 0 — the fixture reuses
      // it rather than stacking a second voice onto the cell.
      if (q !== 0) give(s, "additive", hex(q, 0));
    }
    const snapshot = computeRates(s, true);
    let voices = 0;
    let total = 0;
    let q = 1;
    for (const contribution of snapshot.contributions.values()) {
      if (contribution.type === "spacer") continue;
      if (contribution.type === "additive") {
        voices++;
        total += contribution.value;
        q = contribution.formationQ;
      }
    }
    return { average: total / voices, q };
  }

  it("a dominant seventh outproduces a clean major triad per voice (×7.09 vs ×2.35)", () => {
    const seventh = perVoice([0, 4, 7, 10]);
    const clean = perVoice([0, 4, 7]);
    expect(seventh.average / synthRate).toBeCloseTo(7.094, 2);
    expect(clean.average / synthRate).toBeCloseTo(2.352, 2);
    expect(seventh.average).toBeGreaterThan(clean.average);
  });

  it("a major seventh outproduces a clean major triad per voice (×5.25 vs ×2.35)", () => {
    const lush = perVoice([0, 4, 7, 11]);
    const clean = perVoice([0, 4, 7]);
    expect(lush.average / synthRate).toBeCloseTo(5.247, 2);
    expect(lush.average).toBeGreaterThan(clean.average);
  });

  it("the bridged C+D♭ chromatic mass loses to the clean triad (×1.50 vs ×2.35)", () => {
    const mass = perVoice([0, 1, 4, 5, 7, 8]);
    const clean = perVoice([0, 4, 7]);
    expect(mass.average / synthRate).toBeCloseTo(1.495, 2);
    expect(mass.average).toBeLessThan(clean.average);
    // Tension 3.7 against the 0.70 allowance and 0.30 of complexity sinks
    // far past the floor: the clamp prices it down to near-silence.
    expect(mass.q).toBeCloseTo(BALANCE.qualityFloor, 9);
  });

  it("a chordless formation sits at exactly ×1.00 — tension prices nothing it cannot name", () => {
    const unnamed = perVoice([0, 1, 4]);
    expect(unnamed.q).toBe(1);
    // Two semitone pairs of tension, no named chord: the voices carry
    // their bare terms, unmultiplied.
    expect(unnamed.average / synthRate).toBeCloseTo(1, 9);
  });

  it("the vocabulary is #218's eleven classes", () => {
    expect(NAMED_CHORDS.map((c) => c.name)).toEqual([
      "Octave",
      "Fifth",
      "Flat seventh",
      "Suspended fourth",
      "Minor triad",
      "Diminished triad",
      "Augmented triad",
      "Major triad",
      "Minor seventh",
      "Dominant seventh",
      "Major seventh",
    ]);
  });
});

describe("harmony quality (ADR-0049)", () => {
  const tensionOf = (classes: number[]): number => {
    let total = 0;
    for (let i = 0; i < classes.length; i++) {
      for (let j = i + 1; j < classes.length; j++) {
        const d = Math.abs(classes[i]! - classes[j]!);
        total += BALANCE.tensionWeights[Math.min(d, 12 - d)] ?? 0;
      }
    }
    return total;
  };

  it("scores one clamp over the deduplicated classes: interior, floor, cap", () => {
    // The C·D♭ pair: one semitone, one class of complexity, the allowance
    // forgiving 0.70 of the 1.0 semitone weight.
    expect(formationQuality([0, 1], tensionOf([0, 1]), true)).toBeCloseTo(
      1 + BALANCE.complexityRate - (1.0 - BALANCE.tensionAllowance),
      9,
    );
    // The six-class whole-tone mass sinks to the floor…
    expect(formationQuality([0, 2, 4, 6, 8, 10], tensionOf([0, 2, 4, 6, 8, 10]), true)).toBe(BALANCE.qualityFloor);
    // …and a formation whose complexity outruns its tension entirely
    // reaches for the cap.
    const many = Array.from({ length: 30 }, (_, i) => i);
    expect(formationQuality(many, 0, true)).toBe(BALANCE.qualityCap);
  });

  it("Q rides inside every producing member's chord factor, formation-wide", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // G4
    give(s, "additive", hex(2, 0)); // D5 — the bridged third voice
    const snapshot = computeRates(s, true);
    const names = snapshot.namedChords.map((c) => c.name).sort();
    expect(names).toContain("Fifth");
    // Every member of the named formation carries the same formationQ.
    const qs = [...snapshot.contributions.values()].filter((c) => c.type === "additive").map((c) => c.formationQ);
    expect(new Set(qs).size).toBe(1);
    expect(qs[0]).toBeCloseTo(1 + BALANCE.complexityRate * 2, 9);
  });

  it("a doubled root is multiplicity, not quality: the Octave's Q is exactly neutral-plus-nothing", () => {
    const s = fresh();
    give(s, "additive", hex(0, 1)); // C5 — the doubled root
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => c.name)).toEqual(["Octave"]);
    // One class: no complexity, no tension → Q = 1.
    expect(snapshot.contributions.get("m1")?.formationQ).toBe(1);
  });

  it("resonance mutators multiply the whole chord factor including Q", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // G4 — a Fifth with the opening C4
    s.mutators.push({ id: "mu1", family: "resonance", rarity: "common", pos: hex(0, 0) });
    const snapshot = computeRates(s, true);
    const c4 = snapshot.contributions.get("m1")!;
    expect(c4.chordFactor).toBeCloseTo(1.3 * c4.formationQ * 1.5, 9);
  });
});

describe("the silent voices (ADR-0048)", () => {
  it("the Harmonizer sings its cell's pitch and uplifts every instance it sings in", () => {
    const s = fresh();
    const harm = give(s, "harmonizer", hex(1, 0), 2); // G4, level 2
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => `${c.name}×${c.instances}`)).toEqual(["Fifth×1"]);
    // The uplift is additive into the instance's bonus: 0.30 + 2 × 0.05,
    // landing on all singing members — the Harmonizer included — and the
    // formation's Q rides on top.
    const uplifted = 1 + 0.3 + 2 * BALANCE.silentVoiceUpliftPerLevel;
    const q = snapshot.contributions.get("m1")!.formationQ;
    expect(snapshot.contributions.get("m1")?.chordFactor).toBeCloseTo(uplifted * q, 9);
    expect(snapshot.contributions.get(harm.id)?.chordFactor).toBeCloseTo(uplifted * q, 9);
    // The silent voice produces nothing: zero value, zero amplitude.
    expect(snapshot.contributions.get(harm.id)?.value).toBe(0);
    expect(snapshot.contributions.get(harm.id)?.amplitude).toBe(0);
    expect(snapshot.rate).toBeCloseTo(synthRate * uplifted * q, 9);
  });

  it("the uplift stacks additively across silent voices", () => {
    const s = fresh();
    give(s, "harmonizer", hex(1, 0), 2); // G4, level 2 — +0.10
    give(s, "echo", hex(0, 1), 2); // sings C4's class an octave down — +0.10
    const snapshot = computeRates(s, true);
    // Classes {0, 7}: the Fifth forms twice (each C voice with the G) and
    // the Octave once (the two Cs). Q reads the same two classes either way.
    const q = snapshot.contributions.get("m1")!.formationQ;
    expect(q).toBeCloseTo(1 + BALANCE.complexityRate, 9);
    // m1's fifth instance carries the Harmonizer's uplift (0.30 + 0.10);
    // its Octave carries the Echo's (0.15 + 0.10). The Echo's fifth
    // instance carries both silent voices at once: 0.30 + 0.10 + 0.10,
    // additive.
    const fifthWithH = 1 + 0.3 + 0.1;
    const fifthWithHE = 1 + 0.3 + 0.1 + 0.1;
    const octaveWithE = 1 + 0.15 + 0.1;
    expect(snapshot.contributions.get("m1")?.chordFactor).toBeCloseTo(fifthWithH * octaveWithE * q, 9);
    const echo = snapshot.contributions.get("m3")!;
    expect(echo.chordFactor).toBeCloseTo(fifthWithHE * octaveWithE * q, 9);
    const harm = snapshot.contributions.get("m2")!;
    expect(harm.chordFactor).toBeCloseTo(fifthWithH * fifthWithHE * q, 9);
  });

  it("the Echo doubles a neighbor into an Octave without changing its pitch", () => {
    const s = fresh();
    const before = computeRates(s, true);
    give(s, "echo", hex(1, -1)); // adjacent to the opening C4
    const after = computeRates(s, true);
    expect(after.namedChords.map((c) => `${c.name}×${c.instances}`)).toEqual(["Octave×1"]);
    // The neighbor's pitch — and with it its readout's note — never moved.
    expect(after.contributions.get("m1")?.pitch).toBe(before.contributions.get("m1")?.pitch);
    expect(after.contributions.get("m1")?.pitch).toBe(60);
    // The Echo sings the same class one octave down.
    const echoId = s.modules.find((m) => m.type === "echo")!.id;
    expect(after.contributions.get(echoId)?.pitch).toBe(48);
  });

  it("an Echo with no adjacent voice sings nothing", () => {
    const s = fresh();
    const echo = give(s, "echo", hex(5, 0)); // an island
    const snapshot = computeRates(s, true);
    expect(snapshot.contributions.get(echo.id)?.pitch).toBeNull();
    expect(snapshot.contributions.get(echo.id)?.chordFactor).toBeNull();
    expect(snapshot.namedChords).toHaveLength(0);
  });

  it("the Bend's picked shift landing in a vocabulary recipe earns named value", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // G4 — the Fifth's second voice
    // The Bend at F4 (class 5), shifted ♭1 to E: classes {0, 4, 7} — the
    // Major triad, named by the shift.
    const bend = give(s, "bend", hex(-1, 0));
    expect(setBendShift(s, bend.id, -1).ok).toBe(true);
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => c.name)).toContain("Major triad");
    expect(snapshot.contributions.get(bend.id)?.pitch).toBe(pitchOf(hex(-1, 0)) - 1);
  });

  it("the Bend's selectable set grows with rarity only", () => {
    expect(BALANCE.bendShifts.common).toEqual([-1, 1]);
    expect(BALANCE.bendShifts.uncommon).toEqual([-1, 1]);
    expect(BALANCE.bendShifts.rare).toEqual([-2, -1, 1, 2]);
    // The action refuses out-of-set shifts.
    const s = fresh();
    const bend = give(s, "bend", hex(1, 0));
    expect(setBendShift(s, bend.id, 2).ok).toBe(false);
    bend.rarity = "rare";
    expect(setBendShift(s, bend.id, 2).ok).toBe(true);
  });

  it("silent voices count in the pitch set; spacers still conduct only", () => {
    const s = fresh();
    give(s, "harmonizer", hex(0, 1)); // C5 — the Octave with the opening C4
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => c.name)).toEqual(["Octave"]);
    // The spacer never joins: a wire alone is chordless, then and now.
    const wired = fresh();
    give(wired, "spacer", hex(1, 0));
    expect(computeRates(wired, true).namedChords).toHaveLength(0);
  });
});

describe("the Blaster (ADR-0048)", () => {
  it("sings and completes chords even uncharged — at zero output", () => {
    const s = fresh();
    give(s, "blaster", hex(1, 0)); // G4 — the Fifth's second voice
    const snapshot = computeRates(s, true);
    expect(snapshot.namedChords.map((c) => `${c.name}×${c.instances}`)).toEqual(["Fifth×1"]);
    const blaster = snapshot.contributions.get("m2")!;
    expect(blaster.value).toBe(0);
    expect(blaster.chordFactor!).toBeGreaterThan(1);
    // The formation's named bonus and Q still land on the charged partner.
    expect(snapshot.contributions.get("m1")?.value).toBeCloseTo(
      synthRate * snapshot.contributions.get("m1")!.chordFactor!,
      9,
    );
  });

  it("converts received charge into its synth term — no second empowerment pass", () => {
    const s = fresh();
    give(s, "blaster", hex(1, 0)); // G4
    const gen = give(s, "focusKeyed", hex(2, 0)); // adjacent to the blaster only
    gen.reserve = 60;
    const snapshot = computeRates(s, true);
    const blaster = snapshot.contributions.get("m2")!;
    // The received strength is the generator's full output — generators
    // never divide among neighbors.
    expect(blaster.chargeStrength).toBeCloseTo(1, 9);
    expect(blaster.chargeFactor).toBeCloseTo(blasterConversion(1), 9);
    expect(blaster.value).toBeCloseTo(synthRate * blaster.chordFactor! * blasterConversion(1), 9);
  });

  it("the conversion curve is ×0 uncharged and rises toward ×1", () => {
    expect(blasterConversion(0)).toBe(0);
    expect(blasterConversion(1)).toBeCloseTo(0.5, 9);
    expect(blasterConversion(100)).toBeCloseTo(100 / 101, 9);
  });
});

describe("the Amplifier (ADR-0048)", () => {
  it("relays received charge at its level-scaled gain, counting fully at receivers", () => {
    const s = fresh();
    const gen = give(s, "focusKeyed", hex(2, -2));
    const amp = give(s, "amplifier", hex(1, -1), 3); // gen → amp → the opening C4
    gen.reserve = 60;
    amp.level = 3;
    const snapshot = computeRates(s, true);
    // The generator emits strength 1; the amplifier relays at ×(1 + 3 × 0.2).
    const gain = 1 + 3 * BALANCE.amplifierGainPerLevel;
    expect(snapshot.chargeStrength.get(amp.id)).toBeCloseTo(1, 9);
    expect(snapshot.chargeStrength.get("m1")).toBeCloseTo(gain, 9);
    // Relayed charge counts fully: the receiver's empowerment is the same
    // curve a directly-charged module would ride.
    expect(snapshot.contributions.get("m1")?.chargeFactor).toBeCloseTo(1 + gain / (1 + gain), 9);
    // The amplifier itself produces nothing.
    expect(snapshot.contributions.get(amp.id)?.value).toBe(0);
  });

  it("amplifiers relay through amplifiers, one hop deeper each time", () => {
    const s = fresh();
    const gen = give(s, "focusKeyed", hex(2, -2));
    gen.reserve = 60;
    give(s, "amplifier", hex(1, -1));
    const second = give(s, "amplifier", hex(1, 0));
    const far = give(s, "additive", hex(2, 0)); // the far receiver
    const snapshot = computeRates(s, true);
    // Each hop carries the full relayed strength; both gains at level 0
    // are ×1, so the far receiver sees the generator's own output.
    expect(snapshot.chargeStrength.get(second.id)).toBeCloseTo(1, 9);
    expect(snapshot.chargeStrength.get(far.id)).toBeCloseTo(1, 9);
  });

  it("an empty neighboring generator does not interrupt a live relay chain", () => {
    const s = fresh();
    const gen = give(s, "focusKeyed", hex(2, -2));
    gen.reserve = 60;
    give(s, "amplifier", hex(1, -1));
    const second = give(s, "amplifier", hex(1, 0));
    const far = give(s, "additive", hex(2, 0));
    give(s, "focusKeyed", hex(0, 1)); // empty, adjacent only to the second relay
    const snapshot = computeRates(s, true);
    expect(snapshot.chargeStrength.get(second.id)).toBeCloseTo(1, 9);
    expect(snapshot.chargeStrength.get(far.id)).toBeCloseTo(1, 9);
    expect(computeRates(s, false).chargeStrength.get(far.id)).toBe(0);
  });

  it("charge mutators strengthen every relay hop exactly once", () => {
    const s = fresh();
    const gen = give(s, "focusKeyed", hex(2, -2));
    gen.reserve = 60;
    const first = give(s, "amplifier", hex(1, -1), 3);
    const second = give(s, "amplifier", hex(1, 0));
    const far = give(s, "additive", hex(2, 0));
    for (const amp of [first, second]) {
      const mutator = createMutator(s, "charge", "common");
      mutator.pos = amp.pos;
      s.mutators.push(mutator);
    }
    const snapshot = computeRates(s, true);
    expect(snapshot.chargeStrength.get(first.id)).toBeCloseTo(1.5, 9);
    expect(snapshot.chargeStrength.get(second.id)).toBeCloseTo(2.4 * 1.5, 9);
    expect(snapshot.chargeStrength.get(far.id)).toBeCloseTo(2.4 * 1.5, 9);
  });

  it("the hop-depth cap guards cycles: an amplifier beyond it receives nothing", () => {
    const s = fresh();
    const gen = give(s, "focusKeyed", hex(2, -2));
    gen.reserve = 60;
    give(s, "amplifier", hex(1, -1));
    give(s, "amplifier", hex(1, 0));
    give(s, "amplifier", hex(2, 0));
    const fourth = give(s, "amplifier", hex(3, 0));
    const fifth = give(s, "amplifier", hex(4, 0));
    const snapshot = computeRates(s, true);
    // Four hops relay; the fifth sits past the cap of 4 and the chain ends
    // there — it never receives, so it never relays.
    expect(snapshot.chargeStrength.get(fourth.id)).toBeCloseTo(1, 9);
    expect(snapshot.chargeStrength.get(fifth.id)).toBe(0);
  });

  it("relayed charge feeds Forge thresholds like any receiving charge", () => {
    const s = fresh();
    const gen = give(s, "focusKeyed", hex(2, -2));
    gen.reserve = 60;
    give(s, "amplifier", hex(1, -1));
    give(s, "forge", hex(1, 0)); // adjacent to the amplifier
    const snapshot = computeRates(s, true);
    expect(snapshot.forgeRate).toBeCloseTo(1, 9);
  });
});

describe("the v8 save surface", () => {
  it("mints bends with the ♯ pick and every module with a zero reserve", () => {
    const s = fresh();
    const bend = give(s, "bend", null);
    expect(bend.shift).toBe(1);
    expect(bend.reserve).toBe(0);
    const additive = give(s, "additive", null);
    expect(additive.shift).toBeNull();
  });

  it("the build-unlock derivation reads habit.seconds idempotently (the wave-4 surface)", () => {
    expect(buildUnlocksFor(0)).toBe(0);
    expect(buildUnlocksFor(3599)).toBe(0);
    expect(buildUnlocksFor(3600)).toBe(1);
    expect(buildUnlocksFor(150 * 3600)).toBe(BUILD_MILESTONE_SECONDS.length);
    expect(buildUnlocksFor(150 * 3600 + 1)).toBe(BUILD_MILESTONE_SECONDS.length);
    expect(equipSlotsFor(0)).toBe(0);
    expect(equipSlotsFor(3600)).toBe(1);
    expect(equipSlotsFor(15 * 3600)).toBe(2);
    expect(equipSlotsFor(150 * 3600)).toBe(4);
  });

  it("the discovery ledger persists like the feats; reserves are charge state", () => {
    const s = fresh();
    const gen = give(s, "focusKeyed", hex(2, 0));
    gen.reserve = 42;
    s.chordDiscovery["Major triad"] = { formed: true, firstFormedAt: 1000, rootsHeard: 2 };
    const loaded = deserialize(serialize(s, 7));
    expect(loaded.state!.chordDiscovery["Major triad"]?.formed).toBe(true);
    expect(loaded.state!.modules.find((m) => m.type === "focusKeyed")?.reserve).toBeCloseTo(42, 9);
  });

  it("the roster round-trips through the save", () => {
    const s = fresh();
    const bend = give(s, "bend", hex(-1, 0));
    bend.rarity = "rare";
    bend.shift = -2;
    give(s, "echo", hex(1, -1), 3);
    give(s, "amplifier", hex(2, 1), 1);
    const loaded = deserialize(serialize(s, 99));
    expect(loaded.error).toBeUndefined();
    const modules = loaded.state!.modules;
    expect(modules.find((m) => m.type === "bend")?.shift).toBe(-2);
    expect(modules.find((m) => m.type === "echo")?.level).toBe(3);
    expect(modules.find((m) => m.type === "amplifier")?.reserve).toBe(0);
  });
});
