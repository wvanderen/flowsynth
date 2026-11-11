import { describe, it, expect } from "vitest";
import { createInitialState, createModule } from "./state";
import { serialize, deserialize } from "./save";
import { prestige } from "./actions";
import { ARETE_HORIZON } from "./accumulator";

describe("Encyclopedia save lifecycle", () => {
  it("round trips available and seen identity through reload and prestige, without copy-based rebadging", () => {
    for (const mark of ["available", "seen"] as const) {
      const state = createInitialState();
      state.encyclopedia.charge = mark;
      state.eraEarned = ARETE_HORIZON;
      expect(prestige(state).ok).toBe(true);
      expect(deserialize(serialize(state)).state!.encyclopedia).toEqual({ charge: mark });
    }
    expect(createInitialState().encyclopedia).toEqual({});
  });
  it.each(["focusKeyed", "noteKeyed", "goalKeyed", "pulsewell", "infusor", "forge", "amplifier", "ritual", "blaster", "sideband", "saw"] as const)("backfills the owned %s charge mechanic even in inventory", type => {
    const state = createInitialState();
    state.modules.push(createModule(state, type));
    const file = JSON.parse(serialize(state)); delete file.state.encyclopedia;
    const loaded = deserialize(JSON.stringify(file)).state!;
    expect(loaded.encyclopedia).toEqual({ charge: "seen" });
    loaded.modules = [];
    expect(deserialize(serialize(loaded)).state!.encyclopedia).toEqual({ charge: "seen" });
  });
  it("normalizes malformed and unknown entries without exposing hidden knowledge", () => {
    const file = JSON.parse(serialize(createInitialState()));
    file.state.encyclopedia = { charge: "learned", world: "seen" };
    expect(deserialize(JSON.stringify(file)).state!.encyclopedia).toEqual({});
  });
  it("backfills owned Charge mechanics as seen, but never guesses exposure from the opening oscillator", () => {
    const state = createInitialState();
    const legacy = () => { const raw = JSON.parse(serialize(state)); delete raw.state.encyclopedia; return JSON.stringify(raw); };
    expect(deserialize(legacy()).state).toHaveProperty("encyclopedia", {});
    state.modules.push(createModule(state, "focusKeyed"));
    const loaded = deserialize(legacy()).state!;
    expect(loaded).toHaveProperty("encyclopedia.charge", "seen");
    expect(deserialize(serialize(loaded)).state).toHaveProperty("encyclopedia.charge", "seen");
  });
});
