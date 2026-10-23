import { describe, expect, it } from "vitest";
import {
  APPROACHING_PRESTIGE_RECIPE,
  PLAYTHROUGH_CHECKPOINTS,
  PUSHING_CHECKPOINT_RECIPE,
  composePlaythroughRecipe,
  playthroughCheckpointPreset,
  playthroughNote,
  runPlaythrough,
  runPlaythroughCheckpoint,
} from "./playthrough";
import { SCENARIOS, scenarioOf } from "./scenarios";
import { horizonReached } from "./accumulator";

// The progression presets (issue #471, parent #465): three scenario
// checkpoints grown from declared playthrough recipes — the approaching
// first-prestige door, the first earned bank unspent, and the World's
// living fight with its placement unplayed. The walks are the presets'
// ground, so this file walks each checkpoint exactly once through the
// memoized preset read and pins the declared recipes, the stopped
// situations, the named drift failure, the no-accumulation rebuild, and
// the scripted-run entry — the engine half of the shared boundary.
//
// Walk costs are the honesty price of recipe-generated states: the
// approaching door rides the baseline schedule (~0.2s), the earned bank
// and the World's fight push past the 1T entry depth on the declared
// long-session schedule (~40s and ~65s). The memo makes every later read
// in this file a clone, not a walk.

describe("the declared checkpoint recipes", () => {
  it("carries the baseline walk for the approaching door and the pushing walk past the 1T entry", () => {
    expect(APPROACHING_PRESTIGE_RECIPE).toMatchObject({
      scenarioId: "fresh-start",
      seed: 468,
      policyId: "prompt",
      budgetDays: 15,
      overrides: {},
    });
    expect(APPROACHING_PRESTIGE_RECIPE.schedule).toMatchObject({ sessionsPerDay: 2, sessionMinutes: 25 });
    // The earned bank and the World fight need depth the baseline's
    // credited practice cannot reach: the declared pushing fixture
    // schedule, the first positive claim target, and a budget that clears
    // both checkpoints.
    expect(PUSHING_CHECKPOINT_RECIPE).toMatchObject({
      scenarioId: "fresh-start",
      seed: 468,
      policyId: "pushing",
      claimTarget: 2,
      budgetDays: 36,
      overrides: {},
    });
    expect(PUSHING_CHECKPOINT_RECIPE.schedule).toMatchObject({
      sessionsPerDay: 2,
      sessionMinutes: 600,
      breatherMinutes: 5,
    });
    expect(PLAYTHROUGH_CHECKPOINTS.map((checkpoint) => checkpoint.id)).toEqual([
      "approaching-prestige",
      "after-first-bank",
      "world-enemy-active",
    ]);
  });
});

describe("the walked presets", () => {
  it("stops the approaching walk at the open door of the played first era", { timeout: 120_000 }, () => {
    const preset = playthroughCheckpointPreset("approaching-prestige");
    expect(preset.record.stop.kind).toBe("checkpoint");
    expect(preset.record.stop.reason).toContain("Approaching prestige reached at day 9");
    expect(preset.record.complete).toBe(false);
    expect(preset.record.bottleneck).toBeNull();
    expect(playthroughNote(preset.record)).toContain("Prompt prestige ◆");
    const state = preset.state;
    expect(state.prestiges).toBe(0);
    expect(state.arete).toBe(0);
    expect(horizonReached(state)).toBe(true);
    expect(state.sessionsCompleted).toBeGreaterThan(0);
    expect(state.modules.filter((module) => module.pos !== null).length).toBeGreaterThanOrEqual(2);
    scenarioOf("approaching-prestige")!.assert(state, 0);
  });

  it("stops the pushing walk immediately after its first earned bank, before the spending", { timeout: 120_000 }, () => {
    const preset = playthroughCheckpointPreset("after-first-bank");
    expect(preset.record.stop.kind).toBe("checkpoint");
    expect(preset.record.stop.reason).toContain("After first bank reached at day 10");
    expect(preset.record.claims).toEqual([2]);
    expect(playthroughNote(preset.record)).toContain("claim 2/2 Arete");
    expect(playthroughNote(preset.record)).toContain("no Arete spent");
    const state = preset.state;
    // The earned claim sits unspent — banked by the walk's own practice
    // at the World's entry depth, never granted.
    expect(state.prestiges).toBe(1);
    expect(state.arete).toBe(PUSHING_CHECKPOINT_RECIPE.claimTarget);
    expect(state.eraEarned).toBe(0);
    expect(state.catalogEntryOwned).toBe(false);
    expect(state.world.frontier).toBe(PUSHING_CHECKPOINT_RECIPE.claimTarget);
    expect(state.world.weapons).toHaveLength(1);
    expect(state.world.weapons[0]!.pos).toBeNull();
    scenarioOf("after-first-bank")!.assert(state, 0);
  });

  it("stops the pushing walk at the living fight with the placement unplayed", { timeout: 120_000 }, () => {
    const preset = playthroughCheckpointPreset("world-enemy-active");
    expect(preset.record.stop.kind).toBe("checkpoint");
    expect(preset.record.stop.reason).toContain("World enemy reached at day 15");
    expect(playthroughNote(preset.record)).toContain("spent Catalog entry + 1× Charge Column");
    const state = preset.state;
    const living = Object.entries(state.world.enemies).filter(([, enemy]) => enemy.discovered && enemy.hp > 0);
    expect(living.length).toBeGreaterThanOrEqual(1);
    expect(state.world.weapons.some((weapon) => weapon.pos === null)).toBe(true);
    expect(state.catalogEntryOwned).toBe(true);
    expect(state.world.columns.some((column) => column.pos !== null)).toBe(true);
    expect(state.arete).toBe(0);
    scenarioOf("world-enemy")!.assert(state, 0);
  });

  it("carries the recipe and origin provenance on each preset descriptor", () => {
    expect(SCENARIOS.map((scenario) => scenario.id)).toEqual([
      "fresh-start",
      "approaching-prestige",
      "after-first-bank",
      "world-enemy",
      "focus",
    ]);
    const approaching = scenarioOf("approaching-prestige")!;
    expect(approaching.origin).toBe("recipe checkpoint");
    expect(approaching.situation).toContain("first prestige door open");
    expect(approaching.recipe).toEqual(APPROACHING_PRESTIGE_RECIPE);
    const bank = scenarioOf("after-first-bank")!;
    expect(bank.origin).toBe("recipe checkpoint");
    expect(bank.situation).toContain("earned Arete unspent");
    expect(bank.recipe).toEqual(PUSHING_CHECKPOINT_RECIPE);
    const enemy = scenarioOf("world-enemy")!;
    expect(enemy.origin).toBe("recipe checkpoint");
    expect(enemy.situation).toContain("placement decision unplayed");
    expect(enemy.recipe).toEqual(PUSHING_CHECKPOINT_RECIPE);
    // The non-checkpoint presets carry no recipe: nothing about them
    // claims a walk.
    expect(scenarioOf("fresh-start")!.recipe).toBeUndefined();
    expect(scenarioOf("focus")!.recipe).toBeUndefined();
    // The summaries name the walked day and the run identity.
    for (const id of ["approaching-prestige", "after-first-bank", "world-enemy"] as const) {
      expect(scenarioOf(id)!.summary()).toMatch(/^day \d+ of the declared walk · fresh-start-s468-/);
    }
  });
});

describe("the preset read's honesty", () => {
  it("rebuilds the same stopped state from nothing on every read — no accumulation", { timeout: 120_000 }, () => {
    const first = playthroughCheckpointPreset("after-first-bank");
    const second = playthroughCheckpointPreset("after-first-bank");
    // Equal situations, independent states: a launch mutation can never
    // reach the next launch's candidate.
    expect(second.state).toEqual(first.state);
    expect(second.state).not.toBe(first.state);
    first.state.prestiges = 99;
    first.state.arete = 999;
    const third = playthroughCheckpointPreset("after-first-bank");
    expect(third.state.prestiges).toBe(1);
    expect(third.state.arete).toBe(PUSHING_CHECKPOINT_RECIPE.claimTarget);
  });

  it("fails the build with a named reason when the recipe cannot reach its checkpoint", { timeout: 120_000 }, () => {
    // One day cannot reach the day-nine door: the drift failure names the
    // checkpoint, the budget, and the situation instead of stopping
    // somewhere near it.
    expect(() => runPlaythroughCheckpoint({ ...APPROACHING_PRESTIGE_RECIPE, budgetDays: 1 }, "approaching-prestige"))
      .toThrowError(/checkpoint "approaching-prestige" was not reached within the 1-day budget/);
  });
});

describe("scripted-run entry from a preset", () => {
  it("starts declared runs from every checkpoint preset through the same composition seam", { timeout: 240_000 }, () => {
    for (const id of ["approaching-prestige", "after-first-bank", "world-enemy"] as const) {
      const recipe = composePlaythroughRecipe({ scenarioId: id, budgetDays: 1 });
      expect(recipe.scenarioId).toBe(id);
      // runPlaythrough asserts its built candidate before walking, so a
      // run that started anywhere but the preset's situation would have
      // thrown; the run id names the preset it started from.
      const initial = scenarioOf(id)!.build(recipe.schedule.startAt);
      const lastEnd = Math.max(...initial.sessionRecords.map((session) => session.endedAt));
      const record = runPlaythrough(recipe);
      expect(record.recipe.schedule.startAt).toBeGreaterThanOrEqual(lastEnd);
      const added = record.state.sessionRecords.slice(initial.sessionRecords.length);
      for (const session of added) expect(session.startedAt).toBeGreaterThanOrEqual(lastEnd);
      expect(record.state.sessionRecords.slice(0, initial.sessionRecords.length)).toEqual(initial.sessionRecords);
      if (id !== "approaching-prestige") expect(added.length).toBeGreaterThan(0);
      expect(record.runId).toMatch(new RegExp(`^${id}-s468-`));
      expect(record.recipe.scenarioId).toBe(id);
      expect(record.days).toBe(1);
    }
  });

  it("starts a declared run from the first bank through the same composition seam", { timeout: 120_000 }, () => {
    const recipe = composePlaythroughRecipe({ scenarioId: "after-first-bank", budgetDays: 1 });
    expect(recipe.scenarioId).toBe("after-first-bank");
    const record = runPlaythrough(recipe);
    // The run id names its starting preset; the walked state — the first
    // bank's situation — is the state the run started from.
    expect(record.runId).toMatch(/^after-first-bank-s468-/);
    expect(record.recipe.scenarioId).toBe("after-first-bank");
    expect(record.state.prestiges).toBe(1);
  });
});
