import { describe, expect, it } from "vitest";
import { fresh, give } from "../engine/fixtures";
import { hex } from "../engine/hex";
import type { GameState } from "../engine/types";
import { chargeGlow, chargeLeads } from "./leads";

function flowing(): GameState {
  const state = fresh();
  state.mode = "flow";
  return state;
}

describe("charge leads — the patch wire diagram (§8, #41)", () => {
  it("runs one directional lead per adjacent generator → receiver pair", () => {
    const s = flowing();
    const generator = give(s, "focusKeyed", hex(1, 0));
    s.chargeWindow = 60;
    const carrier = s.modules[0]!; // pinned at the origin, adjacent to (1,0)
    const forge = give(s, "forge", hex(2, 0));
    const leads = chargeLeads(s, true);
    expect(leads).toHaveLength(2);
    expect(leads.map((l) => [l.generator.id, l.receiver.id])).toContainEqual([generator.id, carrier.id]);
    expect(leads.map((l) => [l.generator.id, l.receiver.id])).toContainEqual([generator.id, forge.id]);
    expect(leads.every((l) => l.emitting)).toBe(true);
  });

  it("never charges generators themselves or each other", () => {
    const s = flowing();
    const gen = give(s, "focusKeyed", hex(1, 0));
    const keyed = give(s, "focusKeyed", hex(2, 0));
    s.chargeWindow = 60;
    const pairs = chargeLeads(s, true).map((l) => [l.generator.id, l.receiver.id]);
    expect(pairs).not.toContainEqual([gen.id, keyed.id]);
    expect(pairs).not.toContainEqual([keyed.id, gen.id]);
  });

  it("skips receivers beyond adjacency", () => {
    const s = flowing();
    give(s, "focusKeyed", hex(1, 0));
    give(s, "additive", hex(0, -1)); // two hexes from the generator
    const leads = chargeLeads(s, true);
    expect(leads.map((l) => l.receiver.type)).toEqual(["carrier"]);
  });

  it("emits nothing live from a spent charge window — the wiring dims, not vanishes", () => {
    const s = flowing();
    s.chargeWindow = 0;
    const keyed = give(s, "focusKeyed", hex(1, 0));
    const fromKeyed = () => chargeLeads(s, true).filter((l) => l.generator.id === keyed.id);
    // The lead stays (dim preview in the renderer) but flags no emission.
    expect(fromKeyed().map((l) => l.emitting)).toEqual([false]);
    s.chargeWindow = 30;
    expect(fromKeyed().map((l) => l.emitting)).toEqual([true]);
    // Between sessions nothing flows, whatever the window holds (ADR-0001).
    s.chargeWindow = 60;
    expect(chargeLeads(s, false).every((l) => !l.emitting)).toBe(true);
  });
});

describe("chargeGlow — receiver brightening with received strength", () => {
  it("maps strength onto a saturating 0..1 glow", () => {
    expect(chargeGlow(0)).toBe(0);
    expect(chargeGlow(-1)).toBe(0);
    expect(chargeGlow(1)).toBeCloseTo(0.5);
    for (let strength = 1; strength < 12; strength++) {
      expect(chargeGlow(strength + 1)).toBeGreaterThan(chargeGlow(strength));
      expect(chargeGlow(strength)).toBeLessThan(1);
    }
  });

  it("brightens with generator additions summed before mapping", () => {
    // Two strength-1 generators into one receiver outrun one.
    expect(chargeGlow(2)).toBeGreaterThan(chargeGlow(1));
    expect(chargeGlow(4)).toBeGreaterThan(chargeGlow(2));
  });
});
