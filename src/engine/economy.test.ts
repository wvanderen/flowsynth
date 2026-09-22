import { describe, expect, it } from "vitest";
import { BALANCE } from "./constants";
import { chargedFactor, modulePower, nominalContribution } from "./economy";
import type { ModuleType, Rarity } from "./types";

const spec = (type: ModuleType, rarity: Rarity = "common", level = 0) => ({ type, rarity, level });

describe("nominalContribution — the one per-type magnitude table", () => {
  it("level-0 uncharged synthesizers pin to their base rates", () => {
    expect(nominalContribution(spec("carrier"))).toBe(BALANCE.carrierRate);
    expect(nominalContribution(spec("additive"))).toBe(BALANCE.additiveRate);
    expect(nominalContribution(spec("conditional"))).toBe(BALANCE.conditionalRate);
  });

  it("synthesizers contribute base × power × chargedFactor at any strength, rarity, or level", () => {
    for (const type of ["carrier", "additive", "conditional"] as const) {
      const base = nominalContribution(spec(type));
      for (const rarity of ["common", "uncommon", "rare"] as const) {
        for (const level of [0, 1, 5]) {
          for (const strength of [0, 1, 4]) {
            expect(nominalContribution(spec(type, rarity, level), strength)).toBeCloseTo(
              base * modulePower({ rarity, level }) * chargedFactor(strength),
              12,
            );
          }
        }
      }
    }
  });

  it("the generator and the Forge ride modulePower alone — charge never empowers them", () => {
    for (const strength of [0, 2, 9]) {
      expect(nominalContribution(spec("focusKeyed", "rare", 2), strength)).toBe(modulePower({ rarity: "rare", level: 2 }));
      expect(nominalContribution(spec("forge", "common", 4), strength)).toBe(modulePower({ rarity: "common", level: 4 }));
    }
  });

  it("infusors contribute their bonus fraction, empowered by received charge", () => {
    expect(nominalContribution(spec("infusor"))).toBe(BALANCE.infusorBonus);
    expect(nominalContribution(spec("infusor", "uncommon", 2), 3)).toBeCloseTo(
      BALANCE.infusorBonus * modulePower({ rarity: "uncommon", level: 2 }) * chargedFactor(3),
      12,
    );
  });
});
