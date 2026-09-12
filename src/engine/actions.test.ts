import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import {
  buyStarter,
  chooseRoll,
  endSession,
  placeCell,
  placeModule,
  reshapeCells,
  returnModule,
  startSession,
  upgradeModule,
} from "./actions";
import { wholeNous } from "./economy";
import { fresh, give, grantBurst, setActive, stubRng } from "./fixtures";
import { generateOffer } from "./rolls";
import { hex, isConnected } from "./hex";
import { BALANCE } from "./constants";
import type { StarterType } from "./types";

describe("starter store", () => {
  function opened() {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    expect(s.storeOpened).toBe(true);
    return s;
  }

  it("refuses purchases before the store opens", () => {
    const s = fresh();
    expect(buyStarter(s, "additive").ok).toBe(false);
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    expect(s.storeOpened).toBe(false);
    expect(buyStarter(s, "additive").ok).toBe(false);
  });

  it("sells each starter copy once for whole nous", () => {
    const s = opened();
    s.nous = 40.9;
    expect(buyStarter(s, "additive").ok).toBe(true);
    expect(s.nous).toBeCloseTo(0.9, 6);
    expect(buyStarter(s, "additive").ok).toBe(false);

    s.nous = 39.9;
    expect(buyStarter(s, "infusor").ok).toBe(false);

    for (const type of ["conditional", "infusor", "forge", "expander"] as StarterType[]) {
      s.nous = BALANCE.starterPrices[type];
      expect(buyStarter(s, type).ok).toBe(true);
    }
    expect(s.modules.filter((m) => m.type === "additive").length).toBe(1);
  });

  it("refuses upgrades before the store opens and for inactive cores", () => {
    const s = fresh();
    s.nous = 100;
    const enter = s.modules.find((m) => m.type === "enter")!;
    const habit = s.modules.find((m) => m.type === "habit")!;
    expect(upgradeModule(s, enter.id).ok).toBe(false);

    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    startSession(s, 600);
    advance(s, 600);
    endSession(s);

    expect(upgradeModule(s, habit.id).ok).toBe(false);
    expect(upgradeModule(s, enter.id).ok).toBe(true);
    expect(enter.level).toBe(1);
    expect(s.nous).toBeCloseTo(100 + 60 + 72 - 10, 6);
    expect(upgradeModule(s, enter.id).ok).toBe(true);
    expect(s.nous).toBeCloseTo(100 + 60 + 72 - 10 - 16, 6);
  });
});

describe("placement and board rules", () => {
  it("gameplay modules cannot displace core modules", () => {
    const s = fresh();
    setActive(s);
    const additive = give(s, "additive", null);
    expect(placeModule(s, additive.id, hex(1, 0)).ok).toBe(false);
    expect(placeModule(s, additive.id, hex(0, 0)).ok).toBe(true);

    const second = give(s, "forge", hex(2, 0));
    expect(placeModule(s, second.id, hex(0, 0)).ok).toBe(true);
    expect(additive.pos).toEqual(hex(2, 0));
  });

  it("spare core copies replace only their matching deployed core", () => {
    const s = fresh();
    const spareTime = give(s, "time", null);
    expect(placeModule(s, spareTime.id, hex(0, 0)).ok).toBe(false);
    expect(placeModule(s, spareTime.id, hex(1, -1)).ok).toBe(false);
    expect(placeModule(s, spareTime.id, hex(1, 0)).ok).toBe(true);
    expect(s.modules.filter((m) => m.type === "time" && m.pos !== null)).toHaveLength(1);
    expect(s.modules.find((m) => m.type === "time" && m.pos === null)).toBeDefined();
  });

  it("deployed core modules swap freely and stay deployed", () => {
    const s = fresh();
    const enter = s.modules.find((m) => m.type === "enter")!;
    const time = s.modules.find((m) => m.type === "time")!;
    expect(placeModule(s, enter.id, hex(1, 0)).ok).toBe(true);
    expect(enter.pos).toEqual(hex(1, 0));
    expect(time.pos).toEqual(hex(1, -1));
  });

  it("returns gameplay modules to inventory and keeps cores deployed", () => {
    const s = fresh();
    const additive = give(s, "additive", hex(0, 0));
    expect(returnModule(s, additive.id).ok).toBe(true);
    expect(additive.pos).toBeNull();
    const time = s.modules.find((m) => m.type === "time")!;
    expect(returnModule(s, time.id).ok).toBe(false);
  });

  it("locks the grid during flow", () => {
    const s = fresh();
    const additive = give(s, "additive", null);
    startSession(s, 600);
    expect(placeModule(s, additive.id, hex(0, 0)).ok).toBe(false);
    expect(returnModule(s, additive.id).ok).toBe(false);
    expect(reshapeCells(s, s.cells).ok).toBe(false);
    expect(placeCell(s, hex(3, 0)).ok).toBe(false);
  });

  it("places earned cells adjacent to the board only", () => {
    const s = fresh();
    s.cellTokens = 1;
    expect(placeCell(s, hex(5, 5)).ok).toBe(false);
    expect(placeCell(s, hex(2, 1)).ok).toBe(true);
    expect(s.cells.some((c) => c.q === 2 && c.r === 1)).toBe(true);
    expect(s.cellTokens).toBe(0);
  });

  it("reshapes preserve count, connectivity, and deployed positions", () => {
    const s = fresh();
    const next = [hex(0, 0), hex(1, 0), hex(1, -1), hex(0, -1), hex(-1, 0), hex(-1, 1), hex(0, 1), hex(2, 0)];
    expect(reshapeCells(s, [...next.slice(0, 7)]).ok).toBe(false);
    const moved = [...next.slice(0, 7), hex(1, 1)];
    expect(isConnected(moved)).toBe(true);
    expect(reshapeCells(s, moved).ok).toBe(true);
    expect(s.cells).toHaveLength(8);
    const withCoreGone = next.filter((c) => !(c.q === 1 && c.r === -1));
    expect(reshapeCells(s, [...withCoreGone, hex(1, 1)]).ok).toBe(false);
  });
});

describe("conservation", () => {
  it("never spends more than earned whole nous", () => {
    const s = fresh();
    const rng = stubRng(new Array(64).fill(0.5));
    setActive(s);
    give(s, "additive", hex(0, 0));
    give(s, "forge", hex(2, 0));
    grantBurst(s, 1, 120);
    startSession(s, 600);
    advance(s, 600, rng);
    endSession(s);

    const earnedTotal = s.totalEarned;
    let spent = 0;
    for (const type of ["additive", "conditional", "infusor", "forge", "expander"] as StarterType[]) {
      if (wholeNous(s) >= BALANCE.starterPrices[type]) {
        const before = s.nous;
        buyStarter(s, type);
        spent += before - s.nous;
      }
    }
    const enter = s.modules.find((m) => m.type === "enter")!;
    while (wholeNous(s) >= 10) {
      const before = s.nous;
      const result = upgradeModule(s, enter.id);
      if (!result.ok) break;
      spent += before - s.nous;
    }
    expect(s.nous).toBeGreaterThanOrEqual(0);
    expect(earnedTotal).toBeCloseTo(s.nous + spent, 6);
  });
});

describe("chooseRoll", () => {
  it("adds the chosen candidate and consumes the offer", () => {
    const s = fresh();
    const offer = generateOffer(s, stubRng([0.1, 0.5, 0.2, 0.5, 0.3, 0.5]));
    s.bankedRolls.push(offer);
    startSession(s, 600);
    advance(s, 10);
    endSession(s);
    const candidate = offer.candidates[1]!;
    expect(chooseRoll(s, offer.id, candidate.id).ok).toBe(true);
    expect(s.bankedRolls).toHaveLength(0);
    const added = s.modules[s.modules.length - 1]!;
    expect(added.type).toBe(candidate.type);
    expect(added.rarity).toBe(candidate.rarity);
    expect(added.pos).toBeNull();
    expect(chooseRoll(s, offer.id, candidate.id).ok).toBe(false);
  });
});
