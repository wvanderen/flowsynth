import { describe, expect, it } from "vitest";
import { BALANCE } from "./constants";
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
  it("consumes both inputs and produces the next tier keeping the higher level", () => {
    const s = fresh();
    const a = leveled(s, "harmonizer", 2, hex(1, 0));
    const b = leveled(s, "harmonizer", 1, hex(0, -1));
    s.nous = 0;
    const result = combine(s, b.id);
    expect(result.ok).toBe(true);
    expect(result.refund).toBe(10);
    expect(a.tier).toBe(1);
    expect(a.level).toBe(2);
    expect(a.invested).toBe(26);
    expect(s.nous).toBeCloseTo(10, 6);
    expect(s.modules.filter((m) => m.type === "harmonizer")).toHaveLength(1);
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

  it("refunds nothing at level zero and stops at the unlocked cap", () => {
    const s = fresh();
    const a = give(s, "infusor", null);
    const b = give(s, "infusor", null);
    const result = combine(s, a.id, b.id);
    expect(result.ok).toBe(true);
    expect(result.refund).toBe(0);
    expect(a.tier).toBe(1);

    // A pair at the unlocked cap refuses — and the cap is finite, not the
    // ladder's end by coincidence: raising it would let them combine.
    a.tier = BALANCE.mergeCap;
    const c = give(s, "infusor", null);
    c.tier = BALANCE.mergeCap;
    expect(combine(s, a.id).ok).toBe(false);
  });

  it("tier scaling multiplies the authored strength, conditions unchanged", () => {
    // Twin boards, identical placement: the only difference is the copy's
    // tier, so the value ratio is exactly the tier ladder's step.
    const plainState = fresh();
    const plain = give(plainState, "additive", hex(3, 0)); // chordless island
    const mergedState = fresh();
    const merged = give(mergedState, "additive", hex(3, 0));
    merged.tier = 1;
    const plainValue = computeRates(plainState, true).contributions.get(plain.id)!.value;
    const mergedValue = computeRates(mergedState, true).contributions.get(merged.id)!.value;
    expect(mergedValue / plainValue).toBeCloseTo(BALANCE.tierPower[1] / BALANCE.tierPower[0], 9);
    // The tier never changed the conditions: the copy still sings its cell
    // uncharged, receiving nothing.
    expect(computeRates(mergedState, true).chargeStrength.get(merged.id)).toBe(0);
    expect(computeRates(mergedState, true).contributions.get(merged.id)!.pitch).toBe(
      computeRates(plainState, true).contributions.get(plain.id)!.pitch,
    );
  });

  it("a merged silent voice increases production through its allocated chord", () => {
    const s = fresh();
    const voice = give(s, "harmonizer", hex(1, 0), 2);
    const twin = give(s, "harmonizer", null, 2);
    const before = computeRates(s, true).synths;
    expect(combine(s, twin.id, voice.id).ok).toBe(true);
    expect(computeRates(s, true).synths).toBeGreaterThan(before);
    const survivor = s.modules.find(m => m.type === "harmonizer")!;
    expect(computeRates(s, true).contributions.get(survivor.id)?.value).toBe(0);
  });

  it("a merged Amplifier increases relayed charge even at level zero", () => {
    const s = fresh();
    const generator = give(s, "focusKeyed", hex(2, -2));
    generator.reserve = 60;
    const amp = give(s, "amplifier", hex(1, -1));
    const twin = give(s, "amplifier", null);
    const before = computeRates(s, true);
    expect(combine(s, twin.id, amp.id).ok).toBe(true);
    const after = computeRates(s, true);
    expect(after.chargeStrength.get("m1")!).toBeGreaterThan(before.chargeStrength.get("m1")!);
    generator.reserve = 0;
    expect(computeRates(s, true).chargeStrength.get("m1")).toBe(0);
  });

  it("a merged RITUAL increases amplification only while charged", () => {
    const s = fresh();
    const generator = give(s, "focusKeyed", hex(2, 0));
    generator.reserve = 60;
    const ritual = give(s, "ritual", hex(1, 0), 2);
    const twin = give(s, "ritual", null, 2);
    const before = computeRates(s, true).ritualAmplification;
    expect(before).toBeGreaterThan(0);
    expect(combine(s, twin.id, ritual.id).ok).toBe(true);
    expect(computeRates(s, true).ritualAmplification).toBeGreaterThan(before);
    generator.reserve = 0;
    expect(computeRates(s, true).ritualAmplification).toBe(0);
  });

  it("does not treat a previous refund as new expenditure", () => {
    const s = fresh();
    const a = leveled(s, "additive", 2, hex(1, 0));
    const b = leveled(s, "additive", 2, null);
    const first = combine(s, a.id, b.id);
    expect(first.refund).toBe(26);
    expect(a.invested).toBe(26);
    expect(a.tier).toBe(1);

    s.nous += 100;
    upgradeModule(s, a.id);
    expect(a.level).toBe(3);
    expect(a.invested).toBe(26 + 26);

    const c = leveled(s, "additive", 3, null);
    c.tier = 1;
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
    expect(target.tier).toBe(1);
    expect(target.level).toBe(2);
    expect(target.pos).toBeNull();
    expect([drag, target].filter((m) => s.modules.includes(m))).toHaveLength(1);
  });

  it("unequal tiers and different named types cannot combine (ADR-0058)", () => {
    const s = fresh();
    const low = leveled(s, "harmonizer", 1, hex(1, 0));
    const high = leveled(s, "harmonizer", 2, null);
    high.tier = 1;
    expect(combine(s, low.id, high.id).ok).toBe(false);
    expect(findCombinePartner(s, low.id)).toBeUndefined();

    const other = leveled(s, "forge", 1, null);
    expect(combine(s, low.id, other.id).ok).toBe(false);
    // The pair is untouched by every refusal.
    expect(low.tier).toBe(0);
    expect(high.tier).toBe(1);
    expect(s.modules).toHaveLength(4);
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
    const survivor = give(reference, "additive", hex(0, 1));
    expect(after.contributions.get(drag.id)?.chordFactor).toBeCloseTo(
      computeRates(reference, true).contributions.get(survivor.id)?.chordFactor ?? 0,
      9,
    );
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
  it("reports the next tier, the retained level, and the melt's refund without touching state", () => {
    const s = fresh();
    const drag = leveled(s, "additive", 1, hex(1, 0));
    const target = leveled(s, "additive", 2, null);
    const nous = s.nous;
    const preview = combinePreview(s, drag.id, target.id);
    expect(preview).not.toBeNull();
    expect(preview!.keepId).toBe(target.id);
    expect(preview!.meltId).toBe(drag.id);
    expect(preview!.nextTier).toBe(1);
    expect(preview!.level).toBe(2);
    // The dragged level-1 copy melts; its 10 ν of upgrades come back.
    expect(preview!.refund).toBe(10);
    // A pure read: nothing consumed, nothing refunded, nobody moved.
    expect(s.modules).toHaveLength(3);
    expect(s.nous).toBe(nous);
    expect(drag.pos).toEqual(hex(1, 0));
    expect(target.pos).toBeNull();
  });

  it("is null for mismatched pairs, the unlocked cap, and flow mode", () => {
    const s = fresh();
    const additive = give(s, "additive", hex(1, 0));
    const conditional = give(s, "harmonizer", null);
    expect(combinePreview(s, additive.id, conditional.id)).toBeNull();

    const cappedA = give(s, "infusor", null);
    const cappedB = give(s, "infusor", null);
    cappedA.tier = BALANCE.mergeCap;
    cappedB.tier = BALANCE.mergeCap;
    expect(combinePreview(s, cappedA.id, cappedB.id)).toBeNull();

    startSession(s, 600);
    const pairA = give(s, "forge", hex(0, 1));
    const pairB = give(s, "forge", null);
    expect(combinePreview(s, pairA.id, pairB.id)).toBeNull();
    endSession(s);
    expect(combinePreview(s, pairA.id, pairB.id)).not.toBeNull();
  });

  // ADR-0047 (wave 5): reserves are charge state owned per module — the
  // consumed copy's unspent reserve is forfeited with it, the survivor's
  // carries on under the next tier. Never summed, never refunded.
  it("combining two Note Generators forfeits the consumed one's unspent reserve and keeps the survivor's", () => {
    const s = fresh();
    const survivor = give(s, "noteKeyed", hex(2, 0));
    const consumed = give(s, "noteKeyed", null);
    survivor.reserve = 100;
    consumed.reserve = 40;
    const result = combine(s, survivor.id, consumed.id);
    expect(result.ok).toBe(true);
    expect(s.modules.find((m) => m.type === "noteKeyed")).toBe(survivor);
    expect(survivor.tier).toBe(1);
    expect(survivor.reserve).toBeCloseTo(100, 6);
  });

  // The secondary-effect retention contract (ADR-0058 §7), pinned: the
  // survivor keeps its own shift; the consumed copy's is forfeited with it
  // — never summed, never copied over.
  it("combining two Bends keeps the survivor's shift and forfeits the melt's", () => {
    const s = fresh();
    const survivor = give(s, "bend", hex(2, 0));
    const consumed = give(s, "bend", null);
    survivor.shift = -1;
    consumed.shift = 1;
    const result = combine(s, survivor.id, consumed.id);
    expect(result.ok).toBe(true);
    expect(survivor.tier).toBe(1);
    expect(survivor.shift).toBe(-1);
  });
});
