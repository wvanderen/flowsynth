import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { startSession } from "./actions";
import { fresh, give, stubRng } from "./fixtures";
import { ROLL_POOL } from "./constants";
import { generateOffer } from "./rolls";
import { hex } from "./hex";

describe("forge roll generation", () => {
  it("samples three distinct types from the launch pool", () => {
    const s = fresh();
    const rng = stubRng([0.0, 0.99, 0.2, 0.5, 0.3, 0.5]);
    const offer = generateOffer(s, rng);
    const types = offer.candidates.map((c) => c.type);
    expect(new Set(types).size).toBe(3);
    for (const type of types) {
      expect(ROLL_POOL).toContain(type);
    }
    expect(types).toEqual([ROLL_POOL[0], ROLL_POOL[2], ROLL_POOL[3]]);
  });

  it("rolls each candidate's rarity independently", () => {
    const s = fresh();
    const offer = generateOffer(s, stubRng([0.0, 0.989, 0.2, 0.995, 0.3, 0.9999]));
    expect(offer.candidates.map((c) => c.rarity)).toEqual(["common", "uncommon", "rare"]);
  });

  it("contains every launch module type except the granted Carrier", () => {
    expect(ROLL_POOL).toContain("additive");
    expect(ROLL_POOL).toContain("conditional");
    expect(ROLL_POOL).toContain("generator");
    expect(ROLL_POOL).toContain("focusKeyed");
    expect(ROLL_POOL).toContain("infusor");
    expect(ROLL_POOL).toContain("forge");
    expect(ROLL_POOL).not.toContain("carrier");
    expect(ROLL_POOL).toHaveLength(6);
  });

  it("persists outcomes when the roll is earned, not when it is revealed", () => {
    const s = fresh();
    give(s, "forge", hex(1, 0));
    give(s, "generator", hex(2, 0));
    startSession(s, null);
    advance(s, 100, stubRng(new Array(12).fill(0.3)));
    expect(s.bankedRolls).toHaveLength(1);
    const saved = JSON.parse(JSON.stringify(s.bankedRolls[0]));
    expect(saved.candidates).toHaveLength(3);
    const before = s.nous;
    advance(s, 1);
    expect(s.bankedRolls).toHaveLength(1);
    expect(s.nous).toBeGreaterThan(before);
  });
});
