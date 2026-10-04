import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { chooseRoll, dismissArcCard, endSession, placeModule, returnModule, startSession, upgradeModule } from "./actions";
import { arcCardDue, synthsAcquired } from "./arc";
import { BALANCE, CATEGORY_OF } from "./constants";
import { computeRates } from "./economy";
import { fresh, give, stubRng } from "./fixtures";
import { hex } from "./hex";
import { cellNoteOf } from "./lattice";
import { addForgeProgress, forgeThreshold, flowThreshold } from "./rolls";
import { deserialize, serialize } from "./save";

// The opening learning arc (board-redesign spec §8, issue #138): a
// single-synth earned start — practice fills the flow meter, the first roll
// offers the synth it made, and one pop-up card fires after the second
// acquisition, once, ever. No Carrier, no tutorial state machine.

describe("practice fills the flow meter (§8, ADR-0041)", () => {
  it("the opening fill crosses once fast; the cadence is flat 30 credited minutes forever", () => {
    expect(flowThreshold(0)).toBe(180);
    expect(flowThreshold(1)).toBe(1800);
    expect(flowThreshold(9)).toBe(1800);
  });

  it("credited practice seconds bank the first roll with no Forge owned", () => {
    const s = fresh();
    expect(s.modules.map((m) => m.type)).toEqual(["additive"]); // no Forge, no generator
    startSession(s, null);
    advance(s, 179, stubRng(new Array(6).fill(0.3)));
    expect(s.flow.earned).toBe(0);
    advance(s, 1, stubRng(new Array(6).fill(0.3)));
    expect(s.flow.earned).toBe(1);
    expect(s.bankedRolls).toHaveLength(1);
  });

  it("away time feeds nothing: provisional minutes never credit practice", () => {
    const s = fresh();
    startSession(s, null);
    advance(s, 600, stubRng([]), "provisional");
    expect(s.flow.progress).toBe(0);
    expect(s.flow.earned).toBe(0);
  });

  it("after the opening fill the cadence runs flat, never scaling", () => {
    const s = fresh();
    startSession(s, null);
    advance(s, 180, stubRng(new Array(6).fill(0.3)));
    expect(s.flow.earned).toBe(1);
    advance(s, 1799, stubRng(new Array(6).fill(0.3)));
    expect(s.flow.earned).toBe(1);
    advance(s, 1, stubRng(new Array(6).fill(0.3)));
    expect(s.flow.earned).toBe(2);
    expect(s.flow.progress).toBeCloseTo(0, 6);
  });

  it("practice never touches the Forge branch; charge never touches the flow meter", () => {
    const s = fresh();
    give(s, "forge", hex(1, 0));
    give(s, "focusKeyed", hex(2, 0));
    s.modules.find((m) => m.type === "focusKeyed")!.reserve = 600;
    startSession(s, null);
    advance(s, 120, stubRng(new Array(12).fill(0.3)));
    // Charge: strength 1 × 120 s = 120 through the Forge branch — the 60
    // threshold crosses, 60 carries into the 90. Practice: the same 120
    // credited seconds fill only the flow meter, inside its 180 s opening
    // fill.
    expect(s.forge.earned).toBe(1);
    expect(s.forge.progress).toBeCloseTo(60, 6);
    expect(s.bankedRolls).toHaveLength(1);
    expect(s.flow.earned).toBe(0);
    expect(s.flow.progress).toBeCloseTo(120, 6);
  });
});

describe("the first roll yields a synthesizer candidate (§8)", () => {
  it("re-rigs a synthless first draw to carry a synthesizer", () => {
    const s = fresh();
    // 0.9 draws: forge, infusor, focusKeyed — no synthesizer.
    addForgeProgress(s, forgeThreshold(0), stubRng([0.9, 0.5, 0.9, 0.5, 0.9, 0.5]));
    const offer = s.bankedRolls[0]!;
    expect(offer.candidates.some((c) => CATEGORY_OF[c.type] === "oscillator")).toBe(true);
    expect(offer.candidates.some((c) => c.type === "additive")).toBe(true);
    // The rig keeps three distinct candidates.
    expect(new Set(offer.candidates.map((c) => c.type)).size).toBe(3);
  });

  it("later rolls draw the pool plain — the rig fires once", () => {
    const s = fresh();
    addForgeProgress(s, forgeThreshold(0), stubRng([0.9, 0.5, 0.9, 0.5, 0.9, 0.5]));
    expect(s.bankedRolls[0]!.candidates.some((c) => c.type === "additive")).toBe(true);
    // The same seed on the second roll: the same synthless draw stands
    // (RITUAL joins the pool at index 6, shifting the draw's picks).
    addForgeProgress(s, forgeThreshold(1), stubRng([0.9, 0.5, 0.9, 0.5, 0.9, 0.5]));
    const second = s.bankedRolls[1]!.candidates.map((c) => c.type);
    expect(second).toEqual(["infusor", "forge", "focusKeyed"]);
  });

  it("a draw that already sings is left alone", () => {
    const s = fresh();
    // 0.0/0.2/0.3 draws: additive, spacer, focusKeyed — a synthesizer is
    // already here, so the rig never touches the draw.
    // 0.05/0.6/0.7 draws over the roster pool: additive, spacer,
    // focusKeyed — a synthesizer is already here, so the rig never touches
    // the draw.
    addForgeProgress(s, forgeThreshold(0), stubRng([0.05, 0.5, 0.6, 0.5, 0.7, 0.5]));
    expect(s.bankedRolls[0]!.candidates.map((c) => c.type)).toEqual(["additive", "spacer", "focusKeyed"]);
  });
});

describe("the one pop-up card, once, ever (§8)", () => {
  it("waits through the single-synth opening", () => {
    const s = fresh();
    expect(s.modules).toHaveLength(1);
    expect(arcCardDue(s)).toBe(false);
  });

  it("fires when the second synthesizer is acquired — tray or board", () => {
    const s = fresh();
    s.modules.push({ id: "m99", type: "additive", rarity: "common", level: 0, invested: 0, pos: null, reserve: 0, shift: null });
    expect(synthsAcquired(s)).toBe(2);
    expect(arcCardDue(s)).toBe(true);
  });

  it("non-synthesizer acquisitions never fire it", () => {
    const s = fresh();
    s.modules.push({ id: "m99", type: "infusor", rarity: "common", level: 0, invested: 0, pos: null, reserve: 0, shift: null });
    s.modules.push({ id: "m100", type: "forge", rarity: "common", level: 0, invested: 0, pos: null, reserve: 0, shift: null });
    expect(arcCardDue(s)).toBe(false);
  });

  it("one dismissal, ever — more synths never re-arm it", () => {
    const s = fresh();
    s.modules.push({ id: "m99", type: "additive", rarity: "common", level: 0, invested: 0, pos: null, reserve: 0, shift: null });
    expect(dismissArcCard(s).ok).toBe(true);
    expect(dismissArcCard(s).ok).toBe(false); // idempotent
    s.modules.push({ id: "m100", type: "additive", rarity: "common", level: 0, invested: 0, pos: null, reserve: 0, shift: null });
    s.modules.push({ id: "m101", type: "harmonizer", rarity: "common", level: 0, invested: 0, pos: null, reserve: 0, shift: null });
    expect(arcCardDue(s)).toBe(false);
  });

  it("the seen flag survives a save round-trip, and corrupt saves stay dismissed-once", () => {
    const s = fresh();
    s.modules.push({ id: "m99", type: "additive", rarity: "common", level: 0, invested: 0, pos: null, reserve: 0, shift: null });
    dismissArcCard(s);
    const restored = deserialize(serialize(s, 1_000)).state!;
    expect(restored.arcCardSeen).toBe(true);
    expect(arcCardDue(restored)).toBe(false);
    // A v6 save written before the flag existed lenient-defaults to unseen —
    // still owed its one hint; a corrupt value falls back the same way.
    const file = JSON.parse(serialize(fresh()));
    delete file.state.arcCardSeen;
    const absent = deserialize(JSON.stringify(file)).state!;
    expect(absent.arcCardSeen).toBe(false);
    file.state.arcCardSeen = null;
    const corrupt = deserialize(JSON.stringify(file)).state!;
    expect(corrupt.arcCardSeen).toBe(false);
  });
});

// The success test (§0): in the opening minutes a player places a few
// synthesizers, discovers or intentionally forms a basic chord, perceives
// its effect, and rearranges the board — without ever meeting a Carrier,
// harmonic distance, or a chord-management view.
describe("the opening walk, end to end", () => {
  it("grant → practice → roll → place → chord → rearrange, no Carrier anywhere", () => {
    const s = fresh();
    expect(cellNoteOf(s.modules[0]!.pos!)).toBe("C4");
    // Beat one: the grant affords the first upgrade.
    expect(upgradeModule(s, s.modules[0]!.id).ok).toBe(true);
    // Beat two: the 3-minute opening fill mints the first roll (the 0.9
    // seed draws no synthesizer, so the first-roll rig supplies the additive).
    startSession(s, null);
    advance(s, 180, stubRng([0.9, 0.5, 0.9, 0.5, 0.9, 0.5]));
    endSession(s);
    expect(s.bankedRolls).toHaveLength(1);
    // Beat three: the forge offers the synth it made — take it into the tray.
    const offer = s.bankedRolls[0]!;
    const synth = offer.candidates.find((c) => c.type === "additive")!;
    expect(chooseRoll(s, offer.id, synth.id).ok).toBe(true);
    const second = s.modules.at(-1)!;
    expect(second.pos).toBeNull(); // the tray holds it
    // Beat four: the dashed ghost previewed this — placing beside the first
    // forms the Fifth (C4 + G4), and the × rides each member's own value.
    const before = computeRates(s, true);
    // In the tray it never sounds: no contribution, no factor.
    expect(before.contributions.get(second.id)).toBeUndefined();
    expect(placeModule(s, second.id, hex(1, 0)).ok).toBe(true);
    expect(cellNoteOf(second.pos!)).toBe("G4");
    const after = computeRates(s, true);
    expect(after.namedChords.map((c) => c.name)).toEqual(["Fifth"]);
    expect(after.contributions.get(second.id)?.chordFactor).toBeCloseTo(1.3 * (1 + BALANCE.complexityRate), 9);
    expect(after.rate).toBeGreaterThan(before.rate);
    // Beat five: rearranging never breaks what pitch keeps — a swap of
    // identical synths re-voices, never breaks (pitch lives in the cell).
    startSession(s, null);
    // One flat cadence block later, the second roll mints (the seed draws
    // additive first — the rig is long past, later rolls draw plain).
    advance(s, 1800, stubRng([0.0, 0.5, 0.99, 0.5, 0.99, 0.5]));
    endSession(s);
    const offer2 = s.bankedRolls[0]!;
    const third = offer2.candidates.find((c) => c.type === "additive")!;
    expect(chooseRoll(s, offer2.id, third.id).ok).toBe(true);
    const thirdModule = s.modules.at(-1)!;
    expect(placeModule(s, thirdModule.id, hex(0, 1)).ok).toBe(true); // C5
    const stacked = computeRates(s, true);
    expect(stacked.namedChords.map((c) => c.name).sort()).toEqual(["Fifth", "Octave"]);
    expect(placeModule(s, second.id, hex(0, 1)).ok).toBe(true); // swaps with the twin
    const swapped = computeRates(s, true);
    expect(swapped.namedChords.map((c) => `${c.name}×${c.instances}`)).toEqual(
      stacked.namedChords.map((c) => `${c.name}×${c.instances}`),
    );
    // Pitch lives in the cell: the swapped second sings exactly what the
    // voice it replaced sang at C5.
    expect(swapped.contributions.get(second.id)?.chordFactor).toBeCloseTo(
      stacked.contributions.get(thirdModule.id)?.chordFactor ?? 0,
      9,
    );
    // The chord-breaking gesture is the tray: drag (or right-click) off the
    // board — the swap left the twin at G4 and the second at C5, so
    // retrieving the second leaves C4 + G4: the Octave dies, the Fifth
    // survives on its own voices.
    expect(returnModule(s, second.id).ok).toBe(true);
    const broken = computeRates(s, true);
    expect(broken.namedChords.map((c) => c.name)).toEqual(["Fifth"]);
    expect(broken.contributions.get(thirdModule.id)?.chordFactor).toBeCloseTo(1.3 * (1 + BALANCE.complexityRate), 9);
    // No Carrier, no tutorial machinery, anywhere.
    expect(s.modules.some((m) => (m.type as string) === "carrier")).toBe(false);
    expect("welcomeAcked" in s).toBe(false);
  });
});
