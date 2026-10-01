import { describe, expect, it } from "vitest";
import { affordableLevels, levelCost, levelsCost, wholeNous } from "./economy";
import { startSession, endSession, upgradeAll, upgradeModuleLevels } from "./actions";
import { fresh, give } from "./fixtures";
import { hex } from "./hex";

// The bulk-purchase seam (issue #195, the #173 contract): the shared ladder
// (+1 / +5 / +10 / MAX) priced exactly like the one-level action — whole
// nous, ceiling-exact — with partial-by-design purchases that buy what the
// bank covers and report what landed.

describe("bulk pricing (economy)", () => {
  it("levelsCost sums the per-level curve exactly", () => {
    expect(levelsCost(0, 1)).toBe(levelCost(0));
    expect(levelsCost(0, 3)).toBe(levelCost(0) + levelCost(1) + levelCost(2));
    expect(levelsCost(7, 2)).toBe(levelCost(7) + levelCost(8));
    expect(levelsCost(4, 0)).toBe(0);
  });

  it("affordableLevels counts whole-nous purchases from a level, never overdraws", () => {
    const first = levelCost(0);
    expect(affordableLevels(first, 0)).toBe(1);
    expect(affordableLevels(first + levelCost(1) - 1, 0)).toBe(1);
    expect(affordableLevels(first + levelCost(1), 0)).toBe(2);
    expect(affordableLevels(0, 0)).toBe(0);
    // A veteran's next level alone prices a small bank out entirely.
    expect(affordableLevels(levelCost(40) - 1, 40)).toBe(0);
  });
});

describe("upgradeModuleLevels", () => {
  it("buys up to the wanted levels in one action, charging the one-level prices", () => {
    const s = fresh();
    const synth = s.modules[0]!;
    s.nous = levelsCost(0, 5) + 1;
    const result = upgradeModuleLevels(s, synth.id, 5);
    expect(result.ok).toBe(true);
    expect(synth.level).toBe(5);
    expect(s.nous).toBe(1);
    expect(result.bulk).toEqual({ levels: 5, modules: 1, spent: levelsCost(0, 5) });
    // The invested ledger tracks exactly what was charged, like the one-level action.
    expect(synth.invested).toBe(levelsCost(0, 5));
  });

  it("is partial by design: a dry bank buys what it covers", () => {
    const s = fresh();
    const synth = s.modules[0]!;
    // Enough for three of the five wanted levels.
    s.nous = levelsCost(0, 3);
    const result = upgradeModuleLevels(s, synth.id, 5);
    expect(result.ok).toBe(true);
    expect(synth.level).toBe(3);
    expect(s.nous).toBe(0);
    expect(result.bulk?.levels).toBe(3);
    expect(wholeNous(s)).toBe(0);
  });

  it("refuses when not even one level is affordable, touching nothing", () => {
    const s = fresh();
    const synth = s.modules[0]!;
    s.nous = levelCost(0) - 1;
    const result = upgradeModuleLevels(s, synth.id, 5);
    expect(result.ok).toBe(false);
    expect(synth.level).toBe(0);
    expect(s.nous).toBe(levelCost(0) - 1);
  });

  it("stays behind the upgrade-mode gate", () => {
    const s = fresh();
    startSession(s, 600);
    s.nous = 1000;
    const synth = s.modules[0]!;
    expect(upgradeModuleLevels(s, synth.id, 5).ok).toBe(false);
    expect(synth.level).toBe(0);
    endSession(s);
    expect(upgradeModuleLevels(s, synth.id, 5).ok).toBe(true);
  });
});

describe("upgradeAll", () => {
  it("+N raises every module up to N levels, cheapest modules first", () => {
    const s = fresh();
    const veteran = give(s, "additive", hex(1, 0), 6);
    const rookie = give(s, "infusor", hex(0, 1), 1);
    // Enough for the full ladder on every module.
    const spend = levelsCost(0, 2) + levelsCost(1, 2) + levelsCost(6, 2);
    s.nous = spend + 1000;
    const result = upgradeAll(s, 2);
    expect(result.ok).toBe(true);
    expect(s.modules[0]!.level).toBe(2);
    expect(rookie.level).toBe(3);
    expect(veteran.level).toBe(8);
    expect(result.bulk).toEqual({ levels: 6, modules: 3, spent: spend });
    expect(s.nous).toBe(1000);
  });

  it("+N is partial by design: the sweep buys what the bank covers, veterans unbuyable", () => {
    const s = fresh();
    const veteran = give(s, "additive", hex(1, 0), 20);
    // Enough for five levels on the rookie and one short of the veteran's
    // next level: the +5 sweep takes the rookie to 5 and leaves the veteran.
    s.nous = levelsCost(0, 5) + levelCost(20) - 1;
    const result = upgradeAll(s, 5);
    expect(result.ok).toBe(true);
    expect(s.modules[0]!.level).toBe(5);
    expect(veteran.level).toBe(20);
    expect(result.bulk).toEqual({ levels: 5, modules: 1, spent: levelsCost(0, 5) });
    expect(s.nous).toBe(levelCost(20) - 1);
  });

  it("MAX sweeps the globally cheapest next level until the bank cannot cover one", () => {
    const s = fresh();
    // The veteran's next level prices in before the bank runs dry, but the
    // sweep never reaches it: the cheap module's climb stays the global
    // minimum until the bank can't cover even that.
    const veteran = give(s, "additive", hex(1, 0), 2);
    const spend = levelsCost(0, 2);
    s.nous = spend + levelCost(2) - 1;
    const result = upgradeAll(s, "max");
    expect(result.ok).toBe(true);
    expect(s.modules[0]!.level).toBe(2);
    expect(veteran.level).toBe(2);
    expect(result.bulk).toEqual({ levels: 2, modules: 1, spent: spend });
    expect(s.nous).toBe(levelCost(2) - 1);
  });

  it("MAX order is by cost, not roster order; an equal-level tie falls to the older module", () => {
    const s = fresh();
    // The veteran module enters the roster second but holds the cheap
    // levels: the sweep pumps it first. Once both stand at the same level
    // their next costs tie, and the older module (first in the roster)
    // takes the last affordable level.
    s.modules[0]!.level = 5;
    const veteran = give(s, "additive", hex(1, 0), 2);
    const spend = levelsCost(2, 3) + levelCost(5);
    s.nous = spend;
    const result = upgradeAll(s, "max");
    expect(result.ok).toBe(true);
    expect(s.modules[0]!.level).toBe(6);
    expect(veteran.level).toBe(5);
    expect(result.bulk).toEqual({ levels: 4, modules: 2, spent: spend });
    expect(wholeNous(s)).toBe(0);
  });

  it("MAX raises the low tail and stops when the last cheap level outprices the bank", () => {
    const s = fresh();
    const veteran = give(s, "additive", hex(1, 0), 8);
    // The rookie's whole climb to the veteran's level, one ν short of
    // raising either module past it.
    s.nous = levelsCost(0, 8) + levelCost(8) - 1;
    const result = upgradeAll(s, "max");
    expect(result.ok).toBe(true);
    expect(s.modules[0]!.level).toBe(8);
    expect(veteran.level).toBe(8);
    expect(result.bulk?.modules).toBe(1);
    expect(s.nous).toBe(levelCost(8) - 1);
  });

  it("excludes spacers everywhere and carries tray modules with the deployed", () => {
    const s = fresh();
    const wire = give(s, "spacer", hex(1, 0), 3);
    const traySynth = give(s, "additive", null, 0);
    s.nous = 1000;
    const result = upgradeAll(s, 1);
    expect(result.ok).toBe(true);
    expect(wire.level).toBe(3);
    expect(traySynth.level).toBe(1);
    expect(result.bulk?.modules).toBe(2); // the opening synth and the tray synth
  });

  it("refuses when nothing can be bought, touching nothing", () => {
    const s = fresh();
    s.nous = levelCost(0) - 1;
    const before = s.modules.map((m) => ({ level: m.level, invested: m.invested }));
    expect(upgradeAll(s, 5).ok).toBe(false);
    expect(upgradeAll(s, "max").ok).toBe(false);
    expect(s.nous).toBe(levelCost(0) - 1);
    expect(s.modules.map((m) => ({ level: m.level, invested: m.invested }))).toEqual(before);
  });

  it("stays behind the upgrade-mode gate", () => {
    const s = fresh();
    startSession(s, 600);
    s.nous = 1000;
    expect(upgradeAll(s, "max").ok).toBe(false);
    endSession(s);
    expect(upgradeAll(s, "max").ok).toBe(true);
  });
});
