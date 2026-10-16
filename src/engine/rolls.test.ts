import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { chooseRoll as chooseRollAction, startSession } from "./actions";
import { fresh, give, stubRng } from "./fixtures";
import { ROLL_POOL, TYPE_RARITY } from "./constants";
import { addFlowProgress, addForgeProgress, generateOffer } from "./rolls";
import { hex } from "./hex";

describe("forge roll generation", () => {
  it("samples three distinct types from the launch pool", () => {
    const s = fresh();
    // Each slot draws the rarity band first, then its type (ADR-0058):
    // six draws — band, index ×3.
    const rng = stubRng([0.0, 0.0, 0.5, 0.3, 0.9, 0.2]);
    const offer = generateOffer(s, rng);
    const types = offer.candidates.map((c) => c.type);
    expect(new Set(types).size).toBe(3);
    for (const type of types) {
      expect(ROLL_POOL).toContain(type);
    }
    // Draws without replacement over the twenty-three-type pool: additive,
    // then echo (index 5 of the seventeen remaining commons), then saw
    // (index 3 of the sixteen left).
    expect(types).toEqual(["additive", "echo", "saw"]);
  });

  it("candidates carry the type's fixed rarity and the base tier — nothing is rolled per copy", () => {
    const s = fresh();
    const offer = generateOffer(s, stubRng([0.0, 0.0, 0.5, 0.3, 0.9, 0.2]));
    for (const candidate of offer.candidates) {
      expect(candidate.tier).toBe(0);
      expect(TYPE_RARITY[candidate.type]).toBe("common");
    }
    // An out-of-band draw still lands on a real type: with no rare types
    // authored yet, a rare band falls back to the whole pool.
    const fallback = generateOffer(fresh(), stubRng([0.9995, 0.4, 0.5, 0.5, 0.5, 0.5]));
    expect(ROLL_POOL).toContain(fallback.candidates[0]!.type);
  });

  it("the band filters the type draw, and the fallback never corrupts the pool", () => {
    // Author one more uncommon design for the probe (ADR-0058's seam),
    // restore the table after — the roster's standing uncommon band is the
    // temporal wave's two designs (#372) and the chord-response booster
    // (#375).
    const authored = TYPE_RARITY.echo;
    TYPE_RARITY.echo = "uncommon";
    try {
      const s = fresh();
      // Slot one draws the uncommon band (0.995): afterglow, echo,
      // pulsewell, and chorus match, and the 0.5 index draw lands the
      // third — pulsewell; slots two and three draw common bands (0.5)
      // over the remaining pool.
      const offer = generateOffer(s, stubRng([0.995, 0.5, 0.5, 0.5, 0.5, 0.5]));
      expect(offer.candidates[0]!.type).toBe("pulsewell");
      // The uncommon type cannot be drawn twice: three distinct types, the
      // other two drawn from the common remainder, pool intact.
      const types = offer.candidates.map((c) => c.type);
      expect(new Set(types).size).toBe(3);
      expect(TYPE_RARITY[types[1]!]).toBe("common");
      expect(TYPE_RARITY[types[2]!]).toBe("common");
      // The fallback path spends the shared pool exactly once per slot: a
      // rare band with no remaining matches draws three distinct types
      // and nothing vanishes beyond the draws themselves.
      const fallback = generateOffer(fresh(), stubRng([0.0, 0.0, 0.9995, 0.5, 0.9995, 0.5]));
      expect(new Set(fallback.candidates.map((c) => c.type)).size).toBe(3);
    } finally {
      TYPE_RARITY.echo = authored;
    }
  });

  it("the pool is every launch module type — the roster rolls, the spacer ships through rolls only", () => {
    expect(ROLL_POOL).toContain("additive");
    expect(ROLL_POOL).toContain("blaster");
    expect(ROLL_POOL).toContain("triangle");
    expect(ROLL_POOL).toContain("square");
    expect(ROLL_POOL).toContain("saw");
    expect(ROLL_POOL).toContain("afterglow");
    expect(ROLL_POOL).toContain("sideband");
    expect(ROLL_POOL).toContain("harmonizer");
    expect(ROLL_POOL).toContain("echo");
    expect(ROLL_POOL).toContain("bend");
    expect(ROLL_POOL).toContain("amplifier");
    expect(ROLL_POOL).toContain("ritual");
    expect(ROLL_POOL).toContain("spacer");
    expect(ROLL_POOL).toContain("focusKeyed");
    expect(ROLL_POOL).toContain("noteKeyed");
    expect(ROLL_POOL).toContain("goalKeyed");
    expect(ROLL_POOL).toContain("pulsewell");
    expect(ROLL_POOL).toContain("infusor");
    expect(ROLL_POOL).toContain("field");
    expect(ROLL_POOL).toContain("spotlight");
    expect(ROLL_POOL).toContain("chorus");
    expect(ROLL_POOL).toContain("exciter");
    expect(ROLL_POOL).toContain("forge");
    expect(ROLL_POOL).toHaveLength(23);
  });

  it("persists outcomes when the roll is earned, not when it is revealed", () => {
    const s = fresh();
    give(s, "forge", hex(1, 0));
    give(s, "focusKeyed", hex(2, 0));
    s.modules.find((m) => m.type === "focusKeyed")!.reserve = 600;
    startSession(s, null);
    // Charge 100 crosses 60, carries 40; the 100 credited seconds sit
    // inside the flow meter's opening fill — one offer, from the charge
    // source, in the one shared queue.
    advance(s, 100, stubRng(new Array(12).fill(0.3)));
    expect(s.bankedRolls).toHaveLength(1);
    const saved = JSON.parse(JSON.stringify(s.bankedRolls[0]));
    expect(saved.candidates).toHaveLength(3);
    const before = s.nous;
    advance(s, 1);
    expect(s.bankedRolls).toHaveLength(1);
    expect(s.nous).toBeGreaterThan(before);
  });

  it("the one queue is interchangeable: each source's take spends the same bank", () => {
    const s = fresh();
    addFlowProgress(s, 180);
    addForgeProgress(s, 60);
    expect(s.flow.earned).toBe(1);
    expect(s.forge.earned).toBe(1);
    expect(s.bankedRolls).toHaveLength(2);
    // Spending never asks which meter minted the offer.
    const first = s.bankedRolls[0]!;
    expect(chooseRollAction(s, first.id, first.candidates[0]!.id).ok).toBe(true);
    expect(s.bankedRolls).toHaveLength(1);
  });
});
