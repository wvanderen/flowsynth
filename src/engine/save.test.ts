import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { startSession } from "./actions";
import { fresh, give, grantBurst, setActive, stubRng } from "./fixtures";
import { deserialize, serialize } from "./save";
import { planTick } from "./clock";
import { hex } from "./hex";

describe("persistence", () => {
  it("round-trips the full game state", () => {
    const s = fresh();
    setActive(s);
    give(s, "additive", hex(0, 0));
    give(s, "forge", hex(2, 0));
    s.nous = 123.456;
    s.forge.progress = 42.5;
    startSession(s, 600);
    advance(s, 123, stubRng(new Array(6).fill(0.4)));
    const text = serialize(s, 1_000);
    const loaded = deserialize(text);
    expect(loaded.error).toBeUndefined();
    expect(serialize(loaded.state!, 1_000)).toBe(text);
  });

  it("resuming from a mid-flow save does not duplicate rewards", () => {
    const build = () => {
      const s = fresh();
      setActive(s);
      give(s, "forge", hex(0, 0));
      give(s, "expander", hex(2, 0));
      grantBurst(s, 1, 200);
      startSession(s, 600);
      return s;
    };

    const straight = build();
    advance(straight, 400);

    const split = build();
    advance(split, 150);
    const reloaded = deserialize(serialize(split))!;
    const restored = reloaded.state!;
    advance(restored, 250);

    expect(restored.nous).toBeCloseTo(straight.nous, 6);
    expect(restored.forge.progress).toBeCloseTo(straight.forge.progress, 6);
    expect(restored.expansion.progress).toBeCloseTo(straight.expansion.progress, 6);
    expect(restored.cellTokens).toBe(straight.cellTokens);
  });

  it("rejects corrupt, foreign, and future-version saves", () => {
    expect(deserialize("{nope").error).toBeDefined();
    expect(deserialize('{"app":"other","version":1}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":99,"state":{}}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":1,"state":{"mode":"weird"}}').error).toBeDefined();
  });
});

describe("interruption reconciliation", () => {
  it("applies ordinary background gaps without confirmation", () => {
    const plan = planTick(1_000_000, 1_000_000 + 60_000);
    expect(plan.apply).toBeCloseTo(60, 6);
    expect(plan.pending).toBeNull();
  });

  it("freezes extended gaps for confirmation", () => {
    const plan = planTick(1_000_000, 1_000_000 + 600_000);
    expect(plan.apply).toBe(0);
    expect(plan.pending).toBeCloseTo(600, 6);
  });

  it("never produces negative gaps", () => {
    const plan = planTick(2_000_000, 1_000_000);
    expect(plan.apply).toBe(0);
    expect(plan.pending).toBeNull();
  });
});
