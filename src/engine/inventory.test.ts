import { describe, expect, it } from "vitest";
import { combineInventory, inventoryCombinePreview, scrapInventoryBatch } from "./actions";
import { createInitialState } from "./state";
import { give } from "./fixtures";
import { hex } from "./hex";

describe("reviewed inventory actions", () => {
  it("inherits the higher level and investment but keeps the chosen copy's reserve and shift", () => {
    const state = createInitialState();
    const chosen = give(state, "bend", null); chosen.shift = -1; chosen.reserve = 7; chosen.invested = 12;
    const partner = give(state, "bend", null); partner.level = 5; partner.invested = 90; partner.shift = 1;
    const bank = state.nous;
    expect(inventoryCombinePreview(state, chosen.id, partner.id)).toMatchObject({ keepId: chosen.id, meltId: partner.id, level: 5, refund: 12 });
    expect(combineInventory(state, chosen.id, partner.id).ok).toBe(true);
    expect(chosen).toMatchObject({ level: 5, invested: 90, shift: -1, reserve: 7, tier: 1 });
    expect(state.nous).toBe(bank + 12);
    expect(state.modules).not.toContain(partner);
  });
  it("refuses stale/deployed merges and whole scrap batches atomically", () => {
    const state = createInitialState(); const a = give(state, "additive", null); const b = give(state, "additive", hex(1, 0));
    const before = JSON.stringify(state);
    expect(combineInventory(state, a.id, b.id).ok).toBe(false);
    expect(scrapInventoryBatch(state, [a.id, b.id]).ok).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
    expect(scrapInventoryBatch(state, [a.id, "missing"]).ok).toBe(false);
    expect(state.modules).toContain(a);
  });
  it("deduplicates batch ids, pays once and rejects replays and flow", () => {
    const state = createInitialState(); const a = give(state, "additive", null);
    const result = scrapInventoryBatch(state, [a.id, a.id]);
    expect(result.ok).toBe(true); expect(state.scrap).toBe(result.scrap);
    expect(scrapInventoryBatch(state, [a.id]).ok).toBe(false);
    const b = give(state, "additive", null); state.mode = "flow";
    expect(scrapInventoryBatch(state, [b.id]).ok).toBe(false); expect(state.modules).toContain(b);
  });
});
