import { describe, expect, it } from "vitest";
import {
  combine,
  placeModule,
  returnModule,
  setBoosterTarget,
  startSession,
  prestige,
} from "./actions";
import { BALANCE } from "./constants";
import { computeRates, displayedRates, projectPlacement, spotlightRecipientOf } from "./economy";
import { deserialize, serialize } from "./save";
import { fresh, give } from "./fixtures";
import { hex } from "./hex";
import { OSCILLATOR_PROFILES } from "./profiles";
import { normalizeModules } from "./state";
import type { GameState, ModuleInstance } from "./types";

// The booster wave (issue #374, parent #366): the Field's moderate breadth
// against the Spotlight's player-targeted strength. The contract reads
// through observable outcomes — final ν/s and the rate pass's own terms —
// never coefficient tables: selection by identity, invalidation without
// silent retargeting, restoration when adjacency returns, same-term
// stacking, the session lock, and preview/commit agreement.

// A small working board: the starter synth at (0,0), two more oscillator
// seats and a booster seat, all mutually adjacent around the middle.
function board(): { s: GameState; center: ModuleInstance; left: ModuleInstance; right: ModuleInstance } {
  const s = fresh();
  const center = s.modules[0]!; // the opening synth at (0,0)
  const left = give(s, "additive", hex(1, 0));
  const right = give(s, "additive", hex(0, 1));
  return { s, center, left, right };
}

// Two booster seats around the center voice, each touching it and (for
// the first) the left voice: one cell per module, like a real board.
const BOOSTER_SEAT = hex(1, -1); // adjacent to (0,0) and (1,0)
const FIELD_SEAT = hex(0, -1); // adjacent to (0,0) alone

describe("the Field's breadth", () => {
  it("grants its moderate share to every adjacent oscillator, and only oscillators", () => {
    const { s, center, left } = board();
    give(s, "field", BOOSTER_SEAT);
    const snapshot = computeRates(s, false);
    // Uncharged: the authored share × power 1, scaled by each voice's
    // authored booster response — the Sine converts half.
    const plain = BALANCE.fieldBonus * OSCILLATOR_PROFILES.additive.booster;
    expect(snapshot.contributions.get(center.id)!.infusorBonus).toBeCloseTo(plain);
    expect(snapshot.contributions.get(left.id)!.infusorBonus).toBeCloseTo(plain);
    // The silent wire and the charge family read none of it: the initial
    // support is oscillator-only.
    give(s, "forge", hex(1, 1));
    const generator = give(s, "focusKeyed", hex(2, 0));
    generator.reserve = 600;
    const before = computeRates(s, true);
    const forgeBefore = before.forgeRate;
    const strengthBefore = before.chargeStrength.get(generator.id);
    s.modules = s.modules.filter((m) => m.type !== "field");
    give(s, "field", hex(1, 1));
    give(s, "field", hex(2, -1));
    const after = computeRates(s, true);
    expect(after.forgeRate).toBeCloseTo(forgeBefore);
    expect(after.chargeStrength.get(generator.id)).toBeCloseTo(strengthBefore ?? 0);
  });

  it("keeps its niche: one Field leg loses to the Spotlight, two beat it", () => {
    const { s, center } = board();
    // One neighbor: the Spotlight's narrow strength wins.
    give(s, "field", BOOSTER_SEAT);
    const field1 = computeRates(s, false).contributions.get(center.id)!.infusorBonus;
    s.modules = s.modules.filter((m) => m.type !== "field");
    const spot = give(s, "spotlight", BOOSTER_SEAT);
    setBoosterTarget(s, spot.id, center.id);
    const spot1 = computeRates(s, false).contributions.get(center.id)!.infusorBonus;
    expect(spot1).toBeGreaterThan(field1);
    // Two neighbors: the Field's coverage overtakes the single Spotlight —
    // both grants land on the same recipient, one seat per module.
    s.modules = s.modules.filter((m) => m.type !== "spotlight");
    give(s, "field", BOOSTER_SEAT);
    give(s, "field", FIELD_SEAT);
    const doubled = computeRates(s, false).contributions.get(center.id)!.infusorBonus;
    expect(doubled).toBeCloseTo(2 * field1);
    expect(doubled).toBeGreaterThan(spot1);
  });
});

describe("the Spotlight's selection", () => {
  it("lands on the player's pick alone — never the strongest output", () => {
    const { s, center, left, right } = board();
    right.level = 0; // the weak voice
    left.level = 3; // the strong one
    const spot = give(s, "spotlight", BOOSTER_SEAT); // touches (0,0) and (1,0)
    // Nothing selected: inactive.
    expect(spotlightRecipientOf(s, spot)).toBeNull();
    expect(computeRates(s, false).contributions.get(center.id)!.infusorBonus).toBe(0);
    // The player picks the weak voice — the support follows the pick.
    expect(setBoosterTarget(s, spot.id, center.id).ok).toBe(true);
    const snapshot = computeRates(s, false);
    expect(snapshot.contributions.get(center.id)!.infusorBonus).toBeCloseTo(
      BALANCE.spotlightBonus * OSCILLATOR_PROFILES.additive.booster,
    );
    expect(snapshot.contributions.get(left.id)!.infusorBonus).toBe(0);
    expect(right.target).toBeNull();
  });

  it("re-aims when the player changes the pick — the certified allocation follows", () => {
    const { s, center, left } = board();
    const spot = give(s, "spotlight", BOOSTER_SEAT);
    setBoosterTarget(s, spot.id, center.id);
    const first = displayedRates(s, false).contributions.get(center.id)!.infusorBonus;
    expect(first).toBeGreaterThan(0);
    setBoosterTarget(s, spot.id, left.id);
    const reSolved = displayedRates(s, false);
    expect(reSolved.contributions.get(center.id)!.infusorBonus).toBe(0);
    expect(reSolved.contributions.get(left.id)!.infusorBonus).toBeCloseTo(first);
    // The certified allocation rode the same target semantics: the solve
    // is certified and agrees with the uncapped pass on the grant.
    expect(reSolved.allocation?.certified).toBe(true);
    expect(reSolved.contributions.get(left.id)!.infusorBonus).toBeCloseTo(
      computeRates(s, false).contributions.get(left.id)!.infusorBonus,
    );
  });

  it("only the Spotlight picks, and the pick is a real oscillator", () => {
    const { s, center } = board();
    const field = give(s, "field", BOOSTER_SEAT);
    expect(setBoosterTarget(s, field.id, center.id).ok).toBe(false);
    expect(setBoosterTarget(s, "nope", center.id).ok).toBe(false);
    const spot = give(s, "spotlight", BOOSTER_SEAT);
    expect(setBoosterTarget(s, spot.id, "nope").ok).toBe(false);
    expect(setBoosterTarget(s, spot.id, give(s, "forge", hex(2, 0)).id).ok).toBe(false);
    expect(setBoosterTarget(s, spot.id, give(s, "harmonizer", hex(2, -1)).id).ok).toBe(false);
    expect(spot.target).toBeNull();
  });

  it("the grid is locked during flow — the pick waits for upgrade mode", () => {
    const { s, center } = board();
    const spot = give(s, "spotlight", BOOSTER_SEAT);
    startSession(s, null);
    expect(setBoosterTarget(s, spot.id, center.id).ok).toBe(false);
    expect(spot.target).toBeNull();
  });
});

describe("invalidation and restoration", () => {
  it("a recipient that leaves adjacency deactivates the booster — no silent retarget", () => {
    const { s, center, left } = board();
    const spot = give(s, "spotlight", BOOSTER_SEAT);
    setBoosterTarget(s, spot.id, center.id);
    expect(computeRates(s, false).contributions.get(center.id)!.infusorBonus).toBeGreaterThan(0);
    // The recipient walks away: the pick is remembered, the support is not.
    s.cells.push(hex(2, 2));
    placeModule(s, center.id, hex(2, 2));
    const moved = computeRates(s, false);
    expect(moved.contributions.get(center.id)!.infusorBonus).toBe(0);
    expect(moved.contributions.get(left.id)!.infusorBonus).toBe(0);
    expect(spot.target).toBe(center.id);
    expect(spotlightRecipientOf(s, spot)).toBeNull();
    // The booster itself walks away instead: same verdict.
    placeModule(s, center.id, hex(0, 0));
    placeModule(s, spot.id, hex(2, 2));
    expect(computeRates(s, false).contributions.get(center.id)!.infusorBonus).toBe(0);
    expect(spot.target).toBe(center.id);
  });

  it("a trayed recipient deactivates the booster; re-placing adjacent restores it", () => {
    const { s, center, left } = board();
    const spot = give(s, "spotlight", BOOSTER_SEAT);
    setBoosterTarget(s, spot.id, center.id);
    returnModule(s, center.id);
    // The trayed recipient earns nothing and the second voice reads no
    // silent retarget; the pick itself is remembered.
    expect(spotlightRecipientOf(s, spot)).toBeNull();
    expect(computeRates(s, false).infusors).toBe(0);
    expect(spot.target).toBe(center.id);
    // Adjacency returns — no new pick, support resumes on its own.
    placeModule(s, center.id, hex(0, 0));
    expect(computeRates(s, false).contributions.get(center.id)!.infusorBonus).toBeCloseTo(
      BALANCE.spotlightBonus * OSCILLATOR_PROFILES.additive.booster,
    );
    // And a later round trip through the tray restores again.
    returnModule(s, center.id);
    placeModule(s, center.id, hex(0, 0));
    expect(computeRates(s, false).contributions.get(center.id)!.infusorBonus).toBeGreaterThan(0);
    expect(left.target).toBeNull();
  });

  it("the recipient's melt drops the pick; the kept copy's own pick survives a booster merge", () => {
    const { s, center, left } = board();
    const spot = give(s, "spotlight", BOOSTER_SEAT);
    setBoosterTarget(s, spot.id, center.id);
    // The pick's owner melts: the pick dies with it, the booster stands
    // unselected — its own recovery control, never a dead reference.
    const twin = give(s, "additive", null);
    combine(s, twin.id, center.id); // equal levels: the partner copy melts
    expect(s.modules.some((m) => m.id === center.id)).toBe(false);
    expect(spot.target).toBeNull();
    expect(computeRates(s, false).contributions.get(left.id)!.infusorBonus).toBe(0);
    // A Spotlight merge keeps the surviving copy's own pick; the melted
    // copy's pick is gone with it.
    const other = give(s, "additive", hex(0, 1));
    setBoosterTarget(s, spot.id, other.id);
    const twinSpot = give(s, "spotlight", hex(2, 2));
    setBoosterTarget(s, twinSpot.id, left.id);
    combine(s, twinSpot.id, spot.id); // equal levels: the partner copy melts
    expect(s.modules.some((m) => m.id === spot.id)).toBe(false);
    expect(twinSpot.target).toBe(left.id);
    expect(s.modules.every((m) => m.target !== spot.id)).toBe(true);
  });
});

describe("stacking and charge", () => {
  it("same-term contributions add: two Spotlights on one recipient double the share", () => {
    const { s, center } = board();
    const a = give(s, "spotlight", BOOSTER_SEAT);
    setBoosterTarget(s, a.id, center.id);
    const one = computeRates(s, false).contributions.get(center.id)!.infusorBonus;
    // The second seat (-1,0) touches (0,0) alone.
    const c = give(s, "spotlight", hex(-1, 0));
    setBoosterTarget(s, c.id, center.id);
    const two = computeRates(s, false).contributions.get(center.id)!.infusorBonus;
    expect(two).toBeCloseTo(2 * one);
  });

  it("received charge strengthens the booster's own primary effect", () => {
    const { s, center } = board();
    const spot = give(s, "spotlight", BOOSTER_SEAT);
    setBoosterTarget(s, spot.id, center.id);
    const generator = give(s, "focusKeyed", hex(2, -1)); // adjacent to the booster
    generator.reserve = 600;
    const plain = computeRates(s, false).contributions.get(center.id)!.infusorBonus;
    const fed = computeRates(s, true).contributions.get(center.id)!.infusorBonus;
    // The charged curve over strength 1 lifts the grant above its plain
    // share — the empowerment the recipient then reads.
    expect(fed).toBeGreaterThan(plain);
    expect(fed / plain).toBeCloseTo(1 + 1 / 2);
  });

  it("the recipient's authored booster response scales the grant — distinct terms multiply", () => {
    const s = fresh();
    const starter = s.modules[0]!; // clear the opening seat for the Square
    s.modules = s.modules.filter((m) => m.id !== starter.id);
    const square = give(s, "square", hex(0, 0)); // doubles the boosters it reads
    const spot = give(s, "spotlight", BOOSTER_SEAT);
    setBoosterTarget(s, spot.id, square.id);
    expect(computeRates(s, false).contributions.get(square.id)!.infusorBonus).toBeCloseTo(
      BALANCE.spotlightBonus * OSCILLATOR_PROFILES.square.booster,
    );
  });
});

describe("persistence and previews", () => {
  it("the target identity survives a save/load round trip", () => {
    const { s, center } = board();
    const spot = give(s, "spotlight", BOOSTER_SEAT);
    setBoosterTarget(s, spot.id, center.id);
    const restored = deserialize(serialize(s)).state!;
    const loaded = restored.modules.find((m) => m.type === "spotlight")!;
    expect(loaded.target).toBe(center.id);
    expect(computeRates(restored, false).contributions.get(center.id)!.infusorBonus).toBeCloseTo(
      BALANCE.spotlightBonus * OSCILLATOR_PROFILES.additive.booster,
    );
    // A pick whose id resolves to nothing drops at load — never a dead
    // reference the surfaces cannot explain.
    const corrupted = deserialize(serialize(s)).state!;
    corrupted.modules.find((m) => m.type === "spotlight")!.target = "m999";
    normalizeModules(corrupted.modules);
    expect(corrupted.modules.find((m) => m.type === "spotlight")!.target).toBeNull();
  });

  it("the pick rides prestige out with the module it belongs to", () => {
    const { s, center } = board();
    const spot = give(s, "spotlight", BOOSTER_SEAT);
    setBoosterTarget(s, spot.id, center.id);
    prestige(s);
    expect(s.modules.find((m) => m.type === "spotlight")!.target).toBe(center.id);
  });

  it("the placement preview projects the same target semantics the commit lands", () => {
    const { s, center } = board();
    const spot = give(s, "spotlight", BOOSTER_SEAT);
    setBoosterTarget(s, spot.id, center.id);
    // Moving the booster out of range previews the same zero the commit
    // delivers — one authoritative economy behind both.
    s.cells.push(hex(2, 2));
    const projection = projectPlacement(s, spot.id, hex(2, 2), false);
    expect(projection.projected.contributions.get(center.id)!.infusorBonus).toBe(0);
    placeModule(s, spot.id, hex(2, 2));
    expect(displayedRates(s, false).contributions.get(center.id)!.infusorBonus).toBe(0);
  });
});
