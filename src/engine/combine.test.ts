import { describe, expect, it } from "vitest";
import { combine, endSession, findCombinePartner, startSession, upgradeModule } from "./actions";
import { levelCost } from "./economy";
import { fresh, give } from "./fixtures";
import { hex } from "./hex";
import type { GameState, ModuleType } from "./types";

function leveled(state: GameState, type: ModuleType, level: number, pos: { q: number; r: number } | null) {
  const module = give(state, type, pos);
  for (let i = 0; i < level; i++) {
    const cost = levelCost(i);
    module.invested += cost;
    module.level++;
  }
  return module;
}

describe("combination", () => {
  it("consumes both inputs and produces the next rarity keeping the higher level", () => {
    const s = fresh();
    const a = leveled(s, "conditional", 2, hex(1, 0));
    const b = leveled(s, "conditional", 1, hex(0, -1));
    s.nous = 0;
    const result = combine(s, b.id);
    expect(result.ok).toBe(true);
    expect(result.refund).toBe(10);
    expect(a.rarity).toBe("uncommon");
    expect(a.level).toBe(2);
    expect(a.invested).toBe(26);
    expect(s.nous).toBeCloseTo(10, 6);
    expect(s.modules.filter((m) => m.type === "conditional")).toHaveLength(1);
    expect(a.pos).toEqual(hex(1, 0));
  });

  it("keeps the surviving copy deployed when the melt was deployed", () => {
    const s = fresh();
    const a = leveled(s, "forge", 0, null);
    const b = leveled(s, "forge", 0, hex(1, 0));
    const result = combine(s, a.id);
    expect(result.ok).toBe(true);
    expect(a.pos).toEqual(hex(1, 0));
    expect(b.pos).toBeNull();
    expect(s.modules.filter((m) => m.type === "forge")).toHaveLength(1);
  });

  it("refunds nothing at level zero and cannot combine at the highest rarity", () => {
    const s = fresh();
    const a = give(s, "infusor", null);
    const b = give(s, "infusor", null);
    const result = combine(s, a.id, b.id);
    expect(result.ok).toBe(true);
    expect(result.refund).toBe(0);
    expect(a.rarity).toBe("uncommon");

    a.rarity = "rare";
    const c = give(s, "infusor", null);
    c.rarity = "rare";
    expect(combine(s, a.id).ok).toBe(false);
  });

  it("does not treat a previous refund as new expenditure", () => {
    const s = fresh();
    const a = leveled(s, "additive", 2, hex(1, 0));
    const b = leveled(s, "additive", 2, null);
    const first = combine(s, a.id, b.id);
    expect(first.refund).toBe(26);
    expect(a.invested).toBe(26);
    expect(a.rarity).toBe("uncommon");

    s.nous += 100;
    upgradeModule(s, a.id);
    expect(a.level).toBe(3);
    expect(a.invested).toBe(26 + 26);

    const c = leveled(s, "additive", 3, null);
    c.rarity = "uncommon";
    c.invested = 77;
    const second = combine(s, a.id, c.id);
    expect(second.ok).toBe(true);
    expect(second.refund).toBe(77);
    expect(a.invested).toBe(52);
  });

  it("nothing is privileged: the opening synthesizer combines like any other", () => {
    const s = fresh();
    const opening = s.modules[0]!;
    const twin = give(s, "additive", null);
    const result = combine(s, opening.id, twin.id);
    expect(result.ok).toBe(true);
    expect(s.modules.filter((m) => m.type === "additive")).toHaveLength(1);
    // The survivor keeps the opening's cell — nothing is pinned (ADR-0021).
    expect(s.modules[0]!.pos).toEqual(hex(0, 0));
  });

  it("leaves global meters untouched and works only in upgrade mode", () => {
    const s = fresh();
    s.forge.progress = 42;
    const a = give(s, "forge", hex(1, 0));
    const b = give(s, "forge", hex(0, -1));
    startSession(s, 600);
    expect(combine(s, a.id, b.id).ok).toBe(false);
    endSession(s);
    const result = combine(s, a.id, b.id);
    expect(result.ok).toBe(true);
    expect(s.forge.progress).toBeCloseTo(42, 6);
    expect(findCombinePartner(s, a.id)).toBeUndefined();
  });
});
