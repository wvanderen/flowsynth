import { describe, expect, it } from "vitest";
import { combine, combinePreview, endSession, findCombinePartner, startSession, upgradeModule } from "./actions";
import { computeRates, levelCost } from "./economy";
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
    // The result lands where the drop target was — the tray twin's place
    // (#152). Nothing is pinned (ADR-0021).
    expect(s.modules[0]!.pos).toBeNull();
  });

  it("the confirmed result lands on the drop target's cell (#152)", () => {
    const s = fresh();
    // The dragged copy survives on level; the target's cell wins anyway.
    const drag = leveled(s, "additive", 2, hex(1, 0));
    const target = leveled(s, "additive", 1, hex(0, -1));
    const result = combine(s, drag.id, target.id);
    expect(result.ok).toBe(true);
    expect(result.refund).toBe(10);
    expect(drag.pos).toEqual(hex(0, -1));
    // Of the two inputs, exactly the survivor remains.
    expect([drag, target].filter((m) => s.modules.includes(m))).toHaveLength(1);
  });

  it("the confirmed result waits in the tray when the drop target was there (#152)", () => {
    const s = fresh();
    const drag = leveled(s, "additive", 1, hex(1, 0));
    const target = leveled(s, "additive", 2, null);
    const result = combine(s, drag.id, target.id);
    expect(result.ok).toBe(true);
    // The higher-level tray copy survives, and the result stays in the tray.
    expect(target.rarity).toBe("uncommon");
    expect(target.level).toBe(2);
    expect(target.pos).toBeNull();
    expect([drag, target].filter((m) => s.modules.includes(m))).toHaveLength(1);
  });

  it("a tie-melt relocates the dropped copy and the vacated cell's chord dies (#152)", () => {
    const s = fresh();
    // C4 (the opening synth) + G4 + C5: a Fifth and an Octave are live.
    const drag = leveled(s, "additive", 1, hex(1, 0)); // G4
    const target = leveled(s, "additive", 1, hex(0, 1)); // C5
    const before = computeRates(s, true);
    expect(before.namedChords.map((c) => c.name).sort()).toEqual(["Fifth", "Octave"]);

    // A level tie melts the target: the dropped copy survives and takes the
    // target's cell, and the G4 it vacated takes its chord down with it —
    // the relocation recomputes, nothing stale survives.
    const result = combine(s, drag.id, target.id);
    expect(result.ok).toBe(true);
    expect(drag.pos).toEqual(hex(0, 1));
    const after = computeRates(s, true);
    expect(after.namedChords.map((c) => c.name)).toEqual(["Octave"]);
    // The board rates exactly like the arrangement it became.
    const reference = fresh();
    give(reference, "additive", hex(0, 1));
    expect(after.chordMultiplier).toBeCloseTo(computeRates(reference, true).chordMultiplier, 9);
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

describe("combinePreview", () => {
  it("reports the next rarity, the retained level, and the melt's refund without touching state", () => {
    const s = fresh();
    const drag = leveled(s, "additive", 1, hex(1, 0));
    const target = leveled(s, "additive", 2, null);
    const nous = s.nous;
    const preview = combinePreview(s, drag.id, target.id);
    expect(preview).not.toBeNull();
    expect(preview!.keepId).toBe(target.id);
    expect(preview!.meltId).toBe(drag.id);
    expect(preview!.nextRarity).toBe("uncommon");
    expect(preview!.level).toBe(2);
    // The dragged level-1 copy melts; its 10 ν of upgrades come back.
    expect(preview!.refund).toBe(10);
    // A pure read: nothing consumed, nothing refunded, nobody moved.
    expect(s.modules).toHaveLength(3);
    expect(s.nous).toBe(nous);
    expect(drag.pos).toEqual(hex(1, 0));
    expect(target.pos).toBeNull();
  });

  it("is null for mismatched pairs, the highest rarity, and flow mode", () => {
    const s = fresh();
    const additive = give(s, "additive", hex(1, 0));
    const conditional = give(s, "conditional", null);
    expect(combinePreview(s, additive.id, conditional.id)).toBeNull();

    const rareA = give(s, "infusor", null);
    const rareB = give(s, "infusor", null);
    rareA.rarity = "rare";
    rareB.rarity = "rare";
    expect(combinePreview(s, rareA.id, rareB.id)).toBeNull();

    startSession(s, 600);
    const pairA = give(s, "forge", hex(0, 1));
    const pairB = give(s, "forge", null);
    expect(combinePreview(s, pairA.id, pairB.id)).toBeNull();
    endSession(s);
    expect(combinePreview(s, pairA.id, pairB.id)).not.toBeNull();
  });
});
