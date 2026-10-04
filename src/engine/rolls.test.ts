import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { chooseRoll as chooseRollAction, startSession } from "./actions";
import { fresh, give, stubRng } from "./fixtures";
import { ROLL_POOL } from "./constants";
import { addFlowProgress, addForgeProgress, generateOffer } from "./rolls";
import { hex } from "./hex";

describe("forge roll generation", () => {
  it("samples three distinct types from the launch pool", () => {
    const s = fresh();
    const rng = stubRng([0.0, 0.99, 0.6, 0.5, 0.7, 0.5]);
    const offer = generateOffer(s, rng);
    const types = offer.candidates.map((c) => c.type);
    expect(new Set(types).size).toBe(3);
    for (const type of types) {
      expect(ROLL_POOL).toContain(type);
    }
    // Draws without replacement over the thirteen-type pool: additive,
    // then focusKeyed, then noteKeyed.
    expect(types).toEqual(["additive", "focusKeyed", "noteKeyed"]);
  });

  it("rolls each candidate's rarity independently", () => {
    const s = fresh();
    const offer = generateOffer(s, stubRng([0.0, 0.989, 0.2, 0.995, 0.3, 0.9999]));
    expect(offer.candidates.map((c) => c.rarity)).toEqual(["common", "uncommon", "rare"]);
  });

  it("the pool is every launch module type — the roster rolls, the spacer ships through rolls only", () => {
    expect(ROLL_POOL).toContain("additive");
    expect(ROLL_POOL).toContain("blaster");
    expect(ROLL_POOL).toContain("harmonizer");
    expect(ROLL_POOL).toContain("echo");
    expect(ROLL_POOL).toContain("bend");
    expect(ROLL_POOL).toContain("amplifier");
    expect(ROLL_POOL).toContain("ritual");
    expect(ROLL_POOL).toContain("spacer");
    expect(ROLL_POOL).toContain("focusKeyed");
    expect(ROLL_POOL).toContain("noteKeyed");
    expect(ROLL_POOL).toContain("goalKeyed");
    expect(ROLL_POOL).toContain("infusor");
    expect(ROLL_POOL).toContain("forge");
    expect(ROLL_POOL).toHaveLength(13);
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
