import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { startSession } from "./actions";
import { fresh, give, stubRng } from "./fixtures";
import { SAVE_VERSION } from "./constants";
import { deserialize, serialize } from "./save";
import { planTick } from "./clock";
import { hex } from "./hex";

describe("persistence", () => {
  it("round-trips the full game state", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0));
    give(s, "forge", hex(0, -1));
    s.nous = 123.456;
    s.forge.progress = 42.5;
    startSession(s, 600);
    advance(s, 123, stubRng(new Array(6).fill(0.4)));
    const text = serialize(s, 1_000);
    const loaded = deserialize(text);
    expect(loaded.error).toBeUndefined();
    expect(serialize(loaded.state!, 1_000)).toBe(text);
  });

  it("saves carry the current version", () => {
    const parsed = JSON.parse(serialize(fresh()));
    expect(parsed.version).toBe(SAVE_VERSION);
    expect(parsed.version).toBe(5);
  });

  it("v5 saves from before cell purchases default cellsBought to zero", () => {
    const file = JSON.parse(serialize(fresh()));
    delete file.state.cellsBought;
    const loaded = deserialize(JSON.stringify(file));
    expect(loaded.error).toBeUndefined();
    expect(loaded.state!.cellsBought).toBe(0);
  });

  it("resuming from a mid-flow save does not duplicate rewards", () => {
    const build = () => {
      const s = fresh();
      give(s, "forge", hex(1, 0));
      give(s, "generator", hex(2, 0));
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
  });

  it("rejects v4 saves at the v5 boundary with a clear message (ADR-0017)", () => {
    const s = fresh();
    const v4 = serialize(s).replace(`"version": ${SAVE_VERSION}`, '"version": 4');
    const result = deserialize(v4);
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/older version/i);
    expect(result.state).toBeUndefined();
  });

  it("rejects every older version; there is no migrate chain", () => {
    for (const version of [1, 2, 3, 4]) {
      const text = serialize(fresh()).replace(`"version": ${SAVE_VERSION}`, `"version": ${version}`);
      const result = deserialize(text);
      expect(result.error, `v${version}`).toBeDefined();
      expect(result.state, `v${version}`).toBeUndefined();
    }
  });

  it("rejects corrupt, foreign, and future-version saves", () => {
    expect(deserialize("{nope").error).toBeDefined();
    expect(deserialize('{"app":"other","version":5}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":99,"state":{}}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":5,"state":{"mode":"weird"}}').error).toBeDefined();
    expect(deserialize('{"app":"flowsynth","version":5}').error).toBeDefined();
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
