import { describe, expect, it } from "vitest";
import {
  chordWording,
  chargeSourceWording,
  chargeStrengthWording,
  effectLine,
  faceReadout,
  forgeWording,
  pitchWording,
  typeProse,
  upgradeGain,
  type ModuleSpec,
} from "./lexicon";

const spec = (type: ModuleSpec["type"], rarity: ModuleSpec["rarity"] = "common", level = 0): ModuleSpec => ({ type, rarity, level });

// Golden strings: the lexicon's wording is pinned byte-for-byte so a wording
// change is always a deliberate content decision, never a refactor accident.
describe("faceReadout — the face tile's nominal readout", () => {
  it("carries each type's contribution in its own units at level 0", () => {
    expect(faceReadout(spec("carrier"))).toBe("+0.1");
    expect(faceReadout(spec("additive"))).toBe("+0.05");
    expect(faceReadout(spec("focusKeyed"))).toBe("⌁1");
    expect(faceReadout(spec("infusor"))).toBe("+20%");
    expect(faceReadout(spec("forge"))).toBe("1/s");
  });

  it("scales with rarity and level like modulePower does", () => {
    expect(faceReadout(spec("additive", "uncommon", 3))).toBe("+0.1");
  });
});

describe("effectLine — the inspector's effect line", () => {
  it("speaks the nominal wording when nothing is live", () => {
    expect(effectLine(spec("additive"), null)).toBe("+0.05 ν/s");
    expect(effectLine(spec("conditional"), null)).toBe("+0.05 ν/s · +10% per chord pair");
    expect(effectLine(spec("focusKeyed"), null)).toBe("1 charge strength while its charge window lasts");
    expect(effectLine(spec("infusor", "common", 1), null)).toBe("+24% to adjacent");
    expect(effectLine(spec("forge"), null)).toBe("1 progress/s at strength 1");
  });

  it("previews strength-1 values when the nominal line is charged", () => {
    expect(effectLine(spec("additive"), null, true)).toBe("+0.08 ν/s");
    expect(effectLine(spec("infusor", "common", 1), null, true)).toBe("+36% to adjacent");
  });

  it("formats the live contribution and its received strength", () => {
    expect(effectLine(spec("additive"), { value: 3.456, strength: 0 })).toBe("+3.46 ν/s");
    expect(effectLine(spec("focusKeyed", "common", 2), { value: 1.44, strength: 0 })).toBe("1.44 strength");
    expect(effectLine(spec("infusor", "common", 1), { value: 0.4, strength: 2 })).toBe("+40% to adjacent");
    expect(effectLine(spec("forge"), { value: 2.5, strength: 1 })).toBe("2.5 progress/s");
  });
});

describe("upgradeGain — the upgrade row's gain line", () => {
  it("words the step by family", () => {
    expect(upgradeGain(spec("additive"))).toBe("+0.01 effect");
    expect(upgradeGain(spec("focusKeyed", "common", 1))).toBe("+0.24 strength");
    expect(upgradeGain(spec("forge", "common", 1))).toBe("0.24 progress/s");
  });
});

describe("typeProse — the static per-type description", () => {
  it("pins the Carrier's full sentence", () => {
    expect(typeProse("carrier")).toBe(
      "The granted origin synthesizer. Pinned at the origin: it never moves, never combines, never leaves the board, and plays the formula's carrier term.",
    );
  });

  it("names each family's role", () => {
    expect(typeProse("additive")).toContain("plain harmonic term");
    expect(typeProse("conditional")).toContain("chord pair");
    expect(typeProse("focusKeyed")).toContain("charge window");
    expect(typeProse("infusor")).toContain("adjacent modules");
    expect(typeProse("forge")).toContain("mints a roll");
  });
});

describe("forgeWording — the forge-roll candidate card", () => {
  it("pairs the nominal term with the strength-1 line", () => {
    expect(forgeWording("additive", 300)).toBe("+0.05 ν/s harmonic term<br>+0.08 ν/s at charge strength 1");
    expect(forgeWording("infusor", 300)).toBe("+20% to adjacent production contributions<br>+30% at charge strength 1");
  });

  it("names the shared meter's next threshold, supplied by the caller", () => {
    expect(forgeWording("forge", 300)).toBe(
      "1 Forge progress per received charge strength<br>Next roll: 300 progress",
    );
  });

  it("keeps the generator's prose card charge-free", () => {
    expect(forgeWording("focusKeyed", 300)).toContain("banks a charge window");
  });
});

describe("chargeStrengthWording — the charge stat", () => {
  it("says none at strength 0, regardless of a factor", () => {
    expect(chargeStrengthWording(0)).toBe("none");
    expect(chargeStrengthWording(0, 1)).toBe("none");
  });

  it("words the bare strength for the infusor row", () => {
    expect(chargeStrengthWording(1.5)).toBe("strength 1.5");
  });

  it("appends the synthesis factor for the synthesizer row", () => {
    expect(chargeStrengthWording(2, 1.44)).toBe("strength 2 (×1.44)");
  });
});

describe("pitchWording — the synthesizer pitch stat", () => {
  it("names the harmonic number and its hex distance from the Carrier", () => {
    expect(pitchWording(1)).toBe("P1 — 0 hexes from the Carrier");
    expect(pitchWording(2)).toBe("P2 — 1 hex from the Carrier");
    expect(pitchWording(4)).toBe("P4 — 3 hexes from the Carrier");
  });

  it("stays silent off the board", () => {
    expect(pitchWording(null)).toBe("—");
  });
});

describe("chordWording — the synthesizer chord stat", () => {
  it("joins named chords and appends plain pairs", () => {
    expect(chordWording(["Major third"], 1)).toBe("Major third + 1 pair");
    expect(chordWording(["Major third", "Perfect fifth"], 2)).toBe("Major third + Perfect fifth + 2 pairs");
  });

  it("falls back to plain pairs, then chordless", () => {
    expect(chordWording([], 2)).toBe("2 chord pairs");
    expect(chordWording([], 1)).toBe("1 chord pair");
    expect(chordWording([], 0)).toBe("chordless");
  });
});

describe("chargeSourceWording — the forge charge-source stat", () => {
  it("reports adjacency with a generator", () => {
    expect(chargeSourceWording(true)).toBe("adjacent generator");
    expect(chargeSourceWording(false)).toBe("no adjacent generator");
  });
});
