// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { App } from "./app";
import { playthroughEventMarker, playthroughRunId, type PlaythroughRecord } from "../engine/playthrough";
import { ARETE_HORIZON } from "../engine/accumulator";
import { CATEGORY_OF } from "../engine/constants";
import { adjacent } from "../engine/hex";
import { syncRates } from "../engine/economy";
import { createAppFixture } from "./testing/app-fixture";
import * as actions from "../engine/actions";
import { scenarioOf } from "../engine/scenarios";
import { createInitialState } from "../engine/state";
import { STORAGE_KEY } from "../engine/save";
import type { GameState } from "../engine/types";

// The playthrough's application-command fixtures (issues #468/#469,
// parent #465): small deterministic known-outcome runs driven through the
// same command the dev panel's run control and agent access share —
// schedule accounting, reproducibility, recorded decisions, completion
// with the honest zero claim, the pushing policy's claim-target bank and
// next-era recovery, budget exhaustion, and the visible result wiring.
// The runner is a pure engine walk: a run never touches the live state or
// the save, so every case boots a plain dev app and keeps it watching.
// The pushing fixtures ride one 600-minute daily session on the same
// five-minute breather — a declared schedule, not the default: the same
// credited-time economics at a fraction of the boundary breaks, so the
// long push to the first positive claim stays a test-sized run.
const fixture = createAppFixture();
const boot = fixture.boot;

let app: App;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => { fixture.release(); vi.restoreAllMocks(); });

const note = (): string => document.getElementById("dev-playthrough-note")?.textContent ?? "";

// The pushing fixture's schedule: one long daily session, the same
// five-minute breather, the same host calendar.
const PUSHING_SCHEDULE = { sessionsPerDay: 1, sessionMinutes: 600, breatherMinutes: 5 };

// The behavior-affecting comparison form: the record as a run produced it,
// with the real-clock discovery stamps normalized to their identities. The
// engine stamps action-boundary unlocks (feats, first chord formations)
// with the honest wall clock — presentation metadata, not run behavior.
// The run's outcomes, trajectory, decisions, balances, and recorded
// snapshots must match exactly.
function comparable(record: PlaythroughRecord): Omit<PlaythroughRecord, "state"> & { state: unknown } {
  const normalize = (raw: GameState): GameState => {
    const state = structuredClone(raw);
    state.achievements = Object.fromEntries(Object.keys(state.achievements).map((id) => [id, 0]));
    for (const discovery of Object.values(state.chordDiscovery)) discovery.firstFormedAt = 0;
    return state;
  };
  const { state, ...rest } = record;
  return {
    ...rest,
    snapshots: record.snapshots.map((snapshot) => ({ ...snapshot, state: normalize(snapshot.state) })),
    state: normalize(state),
  };
}

describe("the declared recipe", () => {
  it("carries starting state, seed, policy, claim target, schedule, budget, calendar anchor, and empty overrides", () => {
    app = boot(undefined, true);
    const recipe = app.devPlaythroughRecipe();
    expect(recipe.scenarioId).toBe("fresh-start");
    expect(recipe.policyId).toBe("prompt");
    expect(recipe.claimTarget).toBe(2);
    expect(recipe.seed).toBe(468);
    expect(recipe.schedule).toMatchObject({
      sessionsPerDay: 2,
      sessionMinutes: 25,
      breatherMinutes: 5,
      habitName: "Practice",
      goalMinutes: 25,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    expect(typeof recipe.schedule.startAt).toBe("number");
    expect(recipe.budgetDays).toBe(30);
    expect(recipe.overrides).toEqual({});
    // The policy catalog both policies declare, and the app offers it.
    expect(app.devPlaythroughPolicies().map((policy) => policy.id)).toEqual(["prompt", "pushing"]);
  });

  it("rejects unsupported input by name instead of running a default", () => {
    app = boot(undefined, true);
    expect(() => app.devRunPlaythrough({ scenarioId: "nope" } as never)).toThrow(/no scenario "nope"/);
    expect(() => app.devRunPlaythrough({ policyId: "optimal" } as never)).toThrow(/no policy "optimal"/);
    expect(() => app.devRunPlaythrough({ grant: 1000 } as never)).toThrow(/unsupported input "grant"/);
    expect(() => app.devRunPlaythrough({ schedule: { startAt: Number.NaN } })).toThrow(/startAt/);
    expect(note()).toContain("Playthrough ✗");
    expect(app.devPlaythrough).toBeNull();
  });

  it("rejects a claim target the frontier curve cannot treat as a stopping rule", () => {
    app = boot(undefined, true);
    for (const claimTarget of [0, 1.5, 100]) {
      expect(() => app.devRunPlaythrough({ claimTarget })).toThrow(/claimTarget/);
    }
    expect(app.devPlaythrough).toBeNull();
  });
});

describe("reproducibility", () => {
  it("reproduces the behavior-affecting outcomes from the same recipe and identifies a changed seed", () => {
    app = boot(undefined, true);
    const first = app.devRunPlaythrough({ seed: 9, budgetDays: 2 });
    const second = app.devRunPlaythrough({ seed: 9, budgetDays: 2 });
    expect(second.runId).toBe(first.runId);
    expect(comparable(second)).toEqual(comparable(first));

    const changed = app.devRunPlaythrough({ seed: 10, budgetDays: 2 });
    expect(changed.runId).not.toBe(first.runId);
    // A changed seed must be identifiable; it need not produce a
    // different trajectory to satisfy the recipe's contract.
    void changed;
  });
  it("records engine content provenance and identifies a changed source", () => {
    app = boot(undefined, true);
    const record = app.devRunPlaythrough({ budgetDays: 1 });
    expect(record.source.engineSource).toMatch(/^[0-9a-f]{8}$/);
    expect(playthroughRunId(record.recipe, { ...record.source, engineSource: "changed-engine" }))
      .not.toBe(record.runId);
  });

  it("declares the host calendar and rejects a different timezone before running", () => {
    app = boot(undefined, true);
    const timeZone = app.devPlaythroughRecipe().schedule.timeZone;
    expect(timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const other = timeZone === "UTC" ? "America/New_York" : "UTC";
    expect(() => app.devRunPlaythrough({ schedule: { timeZone: other } })).toThrow(/timeZone.*host calendar/);
    expect(app.devPlaythrough).toBeNull();
  });

});

describe("schedule accounting", () => {
  it("runs two 25-minute sessions with the five-minute breather and honest overnight gaps", () => {
    app = boot(undefined, true);
    const record = app.devRunPlaythrough({ seed: 7, budgetDays: 2 });
    const state = record.state;
    // Four sessions, each planned 25 minutes and credited in full, each
    // followed by the breather its allowance minted — 5 minutes, completed.
    expect(state.sessionRecords).toHaveLength(4);
    for (const line of state.sessionRecords) {
      expect(line.mode).toBe("planned");
      expect(line.plannedTarget).toBe(1500);
      expect(line.creditedSeconds).toBe(1500);
      expect(line.breather).toEqual({ seconds: 300, completed: true });
    }
    // The stamps: session two of a day starts one session-plus-breather
    // after the first; day two starts one day after day one.
    const startAt = record.recipe.schedule.startAt;
    expect(state.sessionRecords[0]!.startedAt).toBe(startAt);
    expect(state.sessionRecords[1]!.startedAt).toBe(startAt + 30 * 60_000);
    expect(state.sessionRecords[2]!.startedAt).toBe(startAt + 86_400_000);
    expect(state.sessionRecords[3]!.startedAt).toBe(startAt + 86_400_000 + 30 * 60_000);
    // Both clocks, distinct: simulated elapsed covers the day span and
    // the overnight gaps; credited practice covers only the sessions.
    expect(record.creditedSeconds).toBe(6000);
    expect(record.breatherSeconds).toBe(1200);
    // The day's last session takes its breather too, so the day spans
    // 25 + 5 + 25 + 5 minutes inside the 24-hour gap to day two.
    expect(record.elapsedSeconds).toBe(86_400 + 60 * 60);
    // The overnight gap produced nothing: every ν the state ever banked
    // came from the sessions and their breathers — a phantom gap credit
    // would inflate totalEarned past the run's own accounting.
    expect(record.state.totalEarned).toBeCloseTo(record.earnedNous, 6);
    // The daily goal rolled at the local day boundary: day one's
    // occurrence completed, day two's re-keyed and completed again.
    const dayOne = state.sessionRecords[0]!.goalsAdvanced[0]!.goal!.occurrenceKey;
    const dayTwo = state.sessionRecords[2]!.goalsAdvanced[0]!.goal!.occurrenceKey;
    expect(dayOne).not.toBe(dayTwo);
    const goal = state.goals.find((row) => !row.retired)!;
    expect(goal.completed).toBe(true);
    expect(goal.occurrenceKey).toBe(dayTwo);
  });
  it("rejects schedules that overlap a calendar day or overrun the budget", () => {
    app = boot(undefined, true);
    for (const schedule of [
      { sessionsPerDay: 8, sessionMinutes: 600, breatherMinutes: 0 },
      { sessionsPerDay: 8, sessionMinutes: 1, breatherMinutes: 600 },
    ]) {
      expect(() => app.devRunPlaythrough({ budgetDays: 2, schedule })).toThrow(/fit each calendar day/);
    }
    expect(app.devPlaythrough).toBeNull();
  });

  it("keeps local calendar starts and monotonic elapsed clocks across daylight-saving dates", () => {
    app = boot(undefined, true);
    const startAt = new Date(2026, 2, 7, 9).getTime();
    const record = app.devRunPlaythrough({ budgetDays: 3, schedule: { startAt } });
    const starts = record.state.sessionRecords.filter((_, i) => i % 2 === 0).map((r) => r.startedAt);
    expect(starts).toEqual([7, 8, 9].map((day) => new Date(2026, 2, day, 9).getTime()));
    expect(record.events[0]!.at).toBe(0);
    expect(record.trajectory[0]!.elapsed).toBe(0);
    expect(record.trajectory.at(-1)!.elapsed).toBe(record.elapsedSeconds);
    expect(record.events.every((e, i) => i === 0 || e.at >= record.events[i - 1]!.at)).toBe(true);
    const deadline = new Date(2026, 2, 10, 9).getTime();
    expect(record.elapsedSeconds).toBeLessThanOrEqual((deadline - startAt) / 1000);
  });

});

describe("the prompt policy's record", () => {
  it("records purchases, placement, milestones, sessions, and the engine's own decline reasons", () => {
    app = boot(undefined, true);
    const before = app.state;
    const saved = localStorage.getItem(STORAGE_KEY);
    const record = app.devRunPlaythrough({ seed: 7, budgetDays: 1 });
    // The run never touched the live state or the save.
    expect(app.state).toBe(before);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);

    // The readable decisions: the opening grant buys the generator first,
    // the board grows, the capacity ladder records its rungs.
    const purchases = record.events.filter((event) => event.kind === "purchase" && event.ok);
    expect(purchases[0]!.label).toBe("Shelf — generator");
    expect(record.events.some((event) => event.kind === "placement" && event.ok)).toBe(true);
    expect(record.events.some((event) => event.kind === "milestone" && event.label.startsWith("Poly Expander 1"))).toBe(true);
    // The engine's own reasons ride the declines verbatim.
    const declined = record.events.filter((event) => !event.ok);
    expect(declined.length).toBeGreaterThan(0);
    for (const event of declined) expect(event.reason).toBeTruthy();
    // Both sessions ended at their plan; the breathers ran; nothing
    // prestiged inside one day.
    expect(record.events.filter((event) => event.kind === "session" && event.ok)).toHaveLength(2);
    expect(record.events.filter((event) => event.kind === "breather" && event.ok)).toHaveLength(2);
    expect(record.events.some((event) => event.kind === "prestige")).toBe(false);
    expect(record.complete).toBe(false);
    // The trajectory carries both clocks with the board's rates.
    const first = record.trajectory[0]!;
    const last = record.trajectory[record.trajectory.length - 1]!;
    expect(last.rate).toBeGreaterThan(first.rate);
    expect(last.credited).toBeGreaterThan(first.credited);
    expect(last.elapsed).toBeGreaterThan(last.credited);
  });
});

describe("budget exhaustion", () => {
  it("returns an explicit incomplete result with milestone, bottleneck, and no granted resources", () => {
    app = boot(undefined, true);
    const record = app.devRunPlaythrough({ seed: 7, budgetDays: 1 });
    expect(record.complete).toBe(false);
    expect(record.stop.kind).toBe("budget");
    expect(record.bottleneck).toContain("budget");
    expect(record.bottleneck).toContain("Last decline —");
    expect(record.lastMilestone).toBeTruthy();
    // No automatic grants: every ν the state ever banked is what the run
    // earned — the sessions and their breathers — and earnNous is its
    // only writer, so a grant would inflate totalEarned. Spending never
    // touches it.
    expect(record.state.totalEarned).toBeCloseTo(record.earnedNous, 6);
    expect(record.events.some((event) => event.label.toLowerCase().includes("grant"))).toBe(false);
  });
});

describe("completion", () => {
  it("prestiges at first eligibility and banks the honest zero-Arete claim", { timeout: 120_000 }, () => {
    app = boot(undefined, true);
    // The budget stays clear of the crossing: the recipe completes inside
    // it, so the stop is the prestige, never the budget.
    const record = app.devRunPlaythrough({ budgetDays: 20 });
    expect(record.complete).toBe(true);
    expect(record.stop.kind).toBe("prestige");
    expect(record.days).toBeLessThan(20);
    expect(record.claims).toEqual([0]);
    expect(record.state.prestiges).toBe(1);
    expect(record.state.arete).toBe(0);
    expect(record.state.eraEarned).toBeLessThan(7e6);
    const prestige = record.events.find((event) => event.kind === "prestige")!;
    expect(prestige.milestone).toBe(true);
    expect(prestige.label).toBe("Prestige 1 — banked 0 Arete");
    expect(record.lastMilestone).toContain("Prestige 1");
    // The door opened between sessions: the era's earnings were banked by
    // real credited practice, never a grant.
    expect(record.creditedSeconds).toBeGreaterThan(0);
    expect(record.state.totalEarned).toBeGreaterThan(0);
  });
  it("reports the same prestige day when the budget ends on the crossing day", () => {
    app = boot(undefined, true);
    const first = app.devRunPlaythrough({ budgetDays: 20, schedule: { sessionsPerDay: 1 } });
    expect(first.complete).toBe(true);
    const bounded = app.devRunPlaythrough({ budgetDays: first.days, schedule: { sessionsPerDay: 1 } });
    expect(bounded.complete).toBe(true);
    expect(bounded.days).toBe(first.days);
    expect(bounded.elapsedSeconds).toBe(first.elapsedSeconds);
    expect(bounded.events).toEqual(first.events);
  });

});

describe("the pushing policy", () => {
  it("never banks again while observing the first recovery era", () => {
    app = boot(undefined, true);
    const scenario = scenarioOf("fresh-start")!;
    vi.spyOn(scenario, "build").mockImplementation(() => {
      const state = createInitialState();
      state.eraEarned = 1e12;
      state.totalEarned = 1e12;
      return state;
    });
    vi.spyOn(scenario, "assert").mockImplementation(() => {});
    const prestige = actions.prestige;
    const bank = vi.spyOn(actions, "prestige").mockImplementation((state) => {
      const result = prestige(state);
      // Force the next claim across the target immediately, so this case
      // distinguishes observing recovery from repeatedly resetting it.
      state.eraEarned = 1e12;
      return result;
    });
    const record = app.devRunPlaythrough({ policyId: "pushing", budgetDays: 1,
      schedule: { sessionsPerDay: 1, sessionMinutes: 1, breatherMinutes: 0 } });
    expect(bank).toHaveBeenCalledTimes(1);
    expect(record.claims).toEqual([2]);
    expect(record.state.prestiges).toBe(1);
    expect(record.recovery!.eligibilityReached).toEqual({ elapsed: 0, credited: 0 });
  });

  it("keeps World occupants in the tray when no cell satisfies their adjacency rule", () => {
    app = boot(undefined, true);
    const scenario = scenarioOf("fresh-start")!;
    vi.spyOn(scenario, "build").mockImplementation(() => {
      const state = createInitialState();
      state.nous = 0;
      state.modules = [];
      state.cells = [{ q: 100, r: 100 }];
      state.world.starterWeaponGranted = true;
      state.world.enemies.w0!.discovered = true;
      state.world.columns = [{ id: "column-test", pos: null }];
      state.world.weapons = [{ id: "weapon-test", type: "chargeBlade", pos: null, store: 0, cooldown: 0, targetPriority: [] }];
      return state;
    });
    vi.spyOn(scenario, "assert").mockImplementation(() => {});
    const record = app.devRunPlaythrough({ policyId: "pushing", budgetDays: 1,
      schedule: { sessionsPerDay: 1, sessionMinutes: 1, breatherMinutes: 0 } });
    expect(record.state.world.weapons[0]!.pos).toBeNull();
    expect(record.state.world.columns[0]!.pos).toBeNull();
    expect(record.events.some((event) => event.reason === "no free World cell beside a living discovered enemy")).toBe(true);
    expect(record.events.some((event) => event.reason === "no free World cell beside a deployed generator")).toBe(true);
  });

  it("pushes past the first eligibility, banks its claim, spends it, and measures both recovery marks", { timeout: 300_000 }, () => {
    app = boot(undefined, true);
    const before = app.state;
    const saved = localStorage.getItem(STORAGE_KEY);
    const record = app.devRunPlaythrough({ policyId: "pushing", claimTarget: 2, budgetDays: 36, schedule: PUSHING_SCHEDULE });
    // The run never touched the live state or the save.
    expect(app.state).toBe(before);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);

    // The claim: the pushing policy held the first-eligibility door (where
    // the prompt run banks zero) and banked the configured 2-Arete claim
    // at the World's entry depth instead.
    expect(record.complete).toBe(true);
    expect(record.stop.kind).toBe("recovered");
    expect(record.claimTarget).toBe(2);
    expect(record.claims).toEqual([2]);
    expect(record.state.prestiges).toBe(1);
    expect(record.policy.name).toBe("Pushing");

    // The earned spending: the Catalog entry and the first Charge Column
    // — nothing granted, nothing minted. The starter Charge Blade is the
    // first World-eligible claim's own grant, and the bank ends empty.
    expect(record.areteSpent).toEqual({ entry: 1, discounts: 0, ceilings: 0, columns: 1, hone: { chargeBlade: 0 } });
    expect(record.state.world.starterWeaponGranted).toBe(true);
    expect(record.state.arete).toBe(0);
    expect(record.state.world.frontier).toBe(2);
    // No grants: every ν the state ever banked is what the run earned —
    // the sessions and their breathers. At this scale the two summations
    // drift by float rounding alone, so the guarantee reads as a relative
    // tolerance, not an exact figure.
    expect(Math.abs(record.state.totalEarned - record.earnedNous)).toBeLessThan(Math.max(1, record.earnedNous) * 1e-12);

    // The World effects, through the real actions: the Column stands on an
    // owned, enemy-unreserved cell on a generator's charge line. The
    // weapon waits in the tray: prestige restored w0 undiscovered, and the
    // era-2 depth re-revealed it only inside the recovery's final stretch
    // — "beside the fight" had no living enemy at any break after the
    // grant, and the run completed before the next break could deploy it.
    const column = record.state.world.columns[0]!;
    expect(column.pos).not.toBeNull();
    expect(record.state.cells.some((cell) => cell.q === column.pos!.q && cell.r === column.pos!.r)).toBe(true);
    expect(record.state.world.enemies.w0?.discovered).toBe(true);
    expect(record.state.world.enemies.w0?.hp).toBeGreaterThan(0);
    const weapon = record.state.world.weapons[0]!;
    expect(weapon.type).toBe("chargeBlade");
    expect(weapon.pos).toBeNull();
    expect(column.pos !== null && record.state.modules.some((m) => m.pos !== null && CATEGORY_OF[m.type] === "generator" && adjacent(column.pos!, m.pos))).toBe(true);
    const worldEvents = record.events.filter((event) => event.kind === "world" && event.ok);
    expect(worldEvents.map((event) => event.label)).toContain("World Column");
    expect(worldEvents.some((event) => event.label.startsWith("Placed a Charge Column at"))).toBe(true);

    // The recovery measures, both clocks, both marks: the next era reached
    // prestige eligibility first and regained the pre-reset production
    // later — measured, never judged. Each mark's credited practice
    // cannot exceed its simulated elapsed time.
    expect(record.recovery).not.toBeNull();
    const recovery = record.recovery!;
    expect(recovery.productionRegained).toEqual({ elapsed: 11 * 86_400, credited: 11 * 600 * 60 });
    expect(recovery.eligibilityReached).toEqual({ elapsed: 3 * 86_400, credited: 3 * 600 * 60 });
    expect(recovery.preResetRate).toBeGreaterThan(0);
    expect(recovery.eligibilityReached).not.toBeNull();
    expect(recovery.productionRegained).not.toBeNull();
    for (const mark of [recovery.eligibilityReached!, recovery.productionRegained!]) {
      expect(mark.credited).toBeGreaterThan(0);
      expect(mark.credited).toBeLessThanOrEqual(mark.elapsed);
    }
    expect(recovery.eligibilityReached!.elapsed).toBeLessThan(recovery.productionRegained!.elapsed);
    expect(record.events.some((event) => event.milestone && event.label.includes("next prestige eligibility reached"))).toBe(true);
    expect(record.events.some((event) => event.milestone && event.label.includes("pre-reset production regained"))).toBe(true);

    // The readable record: the discovery rode era 1 (the claim's depth),
    // the prestige line names its bank, and the note carries both claims
    // figures and the recovery read.
    expect(record.worldDiscoveries).toContain("w0");
    const prestige = record.events.find((event) => event.kind === "prestige")!;
    expect(prestige.label).toBe("Prestige 1 — banked 2 Arete");
    expect(prestige.milestone).toBe(true);
    expect(app.devPlaythroughNote).toContain("claim 2/2 Arete");
    expect(app.devPlaythroughNote).toContain("recovery — rate");
    expect(app.devPlaythroughNote).toContain("door");
  });

  it("treats an unreached claim target as an explicit incomplete outcome, never a fabricated bank", { timeout: 120_000 }, () => {
    app = boot(undefined, true);
    const record = app.devRunPlaythrough({ policyId: "pushing", claimTarget: 6, budgetDays: 4, schedule: PUSHING_SCHEDULE });
    // The push ran well past the first eligibility — the era measure the
    // prompt door opens at — but the 6-Arete entitlement lives at the
    // World's 100T depth, and the budget ended first.
    expect(record.complete).toBe(false);
    expect(record.stop.kind).toBe("budget");
    expect(record.claimTarget).toBe(6);
    expect(record.claims).toEqual([]);
    expect(record.state.prestiges).toBe(0);
    expect(record.state.eraEarned).toBeGreaterThan(ARETE_HORIZON);
    expect(record.recovery).toBeNull();
    expect(record.lastMilestone).toBeTruthy();
    expect(record.bottleneck).toContain("6-Arete");
    // Nothing was spent, because nothing was ever banked.
    expect(record.areteSpent).toEqual({ entry: 0, discounts: 0, ceilings: 0, columns: 0, hone: { chargeBlade: 0 } });
    expect(app.devPlaythroughNote).toContain("Pushing ✗");
    expect(app.devPlaythroughNote).toContain("claim none/6 Arete");
  });

  it("reports a half-recovered era with the missing measure explicitly unreached", { timeout: 300_000 }, () => {
    app = boot(undefined, true);
    const record = app.devRunPlaythrough({ policyId: "pushing", claimTarget: 2, budgetDays: 23, schedule: PUSHING_SCHEDULE });
    // The bank and the spending landed; the next era reached the door
    // again inside the budget, but production was still rebuilding when
    // the budget ended — a slower recovery is valid evidence, and the
    // missing mark stays explicitly null.
    expect(record.complete).toBe(false);
    expect(record.stop.kind).toBe("budget");
    expect(record.stop.reason).toContain("recovery era");
    expect(record.claims).toEqual([2]);
    expect(record.recovery).not.toBeNull();
    expect(record.recovery!.eligibilityReached).not.toBeNull();
    expect(record.recovery!.productionRegained).toBeNull();
    expect(app.devPlaythroughNote).toContain("rate unreached");
    expect(app.devPlaythroughNote).not.toContain("✓");
  });

  it("reproduces the pushing run from the same recipe and identifies a changed target", { timeout: 240_000 }, () => {
    app = boot(undefined, true);
    const input = { policyId: "pushing", claimTarget: 6, budgetDays: 2, schedule: PUSHING_SCHEDULE } as const;
    const first = app.devRunPlaythrough({ ...input });
    const second = app.devRunPlaythrough({ ...input });
    expect(second.runId).toBe(first.runId);
    expect(comparable(second)).toEqual(comparable(first));
    const changed = app.devRunPlaythrough({ ...input, claimTarget: 8 });
    expect(changed.runId).not.toBe(first.runId);
    expect(changed.claimTarget).toBe(8);
  });

  it("ignores the claim target behind the prompt door", { timeout: 120_000 }, () => {
    app = boot(undefined, true);
    const record = app.devRunPlaythrough({ claimTarget: 9, budgetDays: 20 });
    expect(record.complete).toBe(true);
    expect(record.stop.kind).toBe("prestige");
    expect(record.claims).toEqual([0]);
    expect(record.claimTarget).toBe(9);
  });
});

describe("the panel's visible wiring", () => {
  it("runs from the controls, shows the result note, and matches the agent command", () => {
    app = boot(undefined, true);
    const seedField = document.getElementById("dev-playthrough-seed") as HTMLInputElement;
    const budgetField = document.getElementById("dev-playthrough-budget") as HTMLInputElement;
    seedField.value = "9";
    budgetField.value = "1";
    const run = document.querySelector<HTMLButtonElement>('[data-dev="playthrough"]')!;
    run.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const clicked = app.devPlaythrough!;
    expect(clicked.runId).toMatch(/^fresh-start-s9-/);
    expect(clicked.complete).toBe(false);
    // The note is the run's ✓/✗ line, and it is the same line the agent
    // command's result produces.
    expect(note()).toBe(app.devPlaythroughNote);
    expect(note()).toContain("✗");
    expect(note()).toContain("seed 9");
    expect(note()).toContain("1d");
    const agent = app.devRunPlaythrough({ seed: 9, budgetDays: 1 });
    expect(agent.runId).toBe(clicked.runId);
    expect(comparable(agent)).toEqual(comparable(clicked));
  });

  it("exposes the policy select and claim-target input, and the run reads them", () => {
    app = boot(undefined, true);
    const policy = document.getElementById("dev-playthrough-policy") as HTMLSelectElement;
    const targetField = document.getElementById("dev-playthrough-target") as HTMLInputElement;
    // The select offers both declared policies under their own names.
    expect([...policy.options].map((option) => option.value)).toEqual(["prompt", "pushing"]);
    expect(policy.options[policy.selectedIndex]!.text).toBe("Prompt prestige");
    policy.value = "pushing";
    targetField.value = "5";
    const seedField = document.getElementById("dev-playthrough-seed") as HTMLInputElement;
    const budgetField = document.getElementById("dev-playthrough-budget") as HTMLInputElement;
    seedField.value = "9";
    budgetField.value = "1";
    const run = document.querySelector<HTMLButtonElement>('[data-dev="playthrough"]')!;
    run.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const clicked = app.devPlaythrough!;
    // The panel's selections composed the same run the agent command
    // takes: pushing, target 5, and the incomplete stop the one-day
    // budget forces.
    expect(clicked.policy.id).toBe("pushing");
    expect(clicked.claimTarget).toBe(5);
    expect(clicked.complete).toBe(false);
    expect(note()).toBe(app.devPlaythroughNote);
    expect(note()).toContain("Pushing ✗");
    expect(note()).toContain("claim none/5 Arete");
    const agent = app.devRunPlaythrough({ policyId: "pushing", claimTarget: 5, seed: 9, budgetDays: 1 });
    expect(agent.runId).toBe(clicked.runId);
  });

  it("is a development command, refused outside dev mode", () => {
    app = boot(undefined, false);
    expect(() => app.devRunPlaythrough({ budgetDays: 1 })).toThrow(/development commands/);
    expect(document.getElementById("dev-playthrough-note")).toBeNull();
  });
});

// The historical inspection boundary (issue #470, parent stories 26–29):
// every plotted sample and stamped event backed by its exact recorded
// state, the selection revealing board/state and recent decisions through
// the shared command, and inspection that cannot mutate the active run.
describe("historical snapshots and inspection", () => {
  it("records a frozen snapshot for every plotted sample and every event's exact moment", () => {
    app = boot(undefined, true);
    const record = app.devRunPlaythrough({ seed: 7, budgetDays: 1 });
    expect(record.snapshots.length).toBeGreaterThanOrEqual(record.trajectory.length);
    // Every plotted sample resolves to an exact recorded state carrying
    // the sample's own stamps and figures — the plot never interpolates.
    for (const point of record.trajectory) {
      const snapshot = record.snapshots[point.snapshot]!;
      expect(snapshot.elapsed).toBe(point.elapsed);
      expect(snapshot.credited).toBe(point.credited);
      expect(snapshot.state.eraEarned).toBe(point.eraEarned);
      expect(snapshot.state.arete).toBe(point.arete);
      expect(Math.floor(snapshot.state.nous)).toBe(point.nous);
      // The recorded state reproduces the recorded rate: the same preview
      // basis recomputed off the snapshot equals the plotted figure.
      expect(syncRates(structuredClone(snapshot.state), false).rate).toBeCloseTo(point.rate, 9);
    }
    // Every decision binds the state as it stood at the decision's own
    // simulated stamp — never a neighboring break's board.
    for (const event of record.events) {
      expect(event.snapshot).toBeGreaterThanOrEqual(0);
      expect(event.snapshot).toBeLessThan(record.snapshots.length);
      expect(record.snapshots[event.snapshot]!.elapsed).toBe(event.at);
    }
    // Recorded states are deep-frozen: read-only for human and agent alike.
    const someSnapshot = record.snapshots[Math.floor(record.snapshots.length / 2)]!;
    expect(Object.isFrozen(someSnapshot.state)).toBe(true);
    expect(Object.isFrozen(someSnapshot.state.modules)).toBe(true);
    expect(Object.isFrozen(someSnapshot.state.modules[0])).toBe(true);
    expect(Object.isFrozen(someSnapshot.state.cells)).toBe(true);
    expect(Object.isFrozen(someSnapshot.state.sessionRecords)).toBe(true);
  });

  it("selection reveals the matching board, state, and recent decisions through the shared command", () => {
    app = boot(undefined, true);
    const record = app.devRunPlaythrough({ seed: 7, budgetDays: 1 });
    const point = record.trajectory[Math.floor(record.trajectory.length / 2)]!;
    const inspection = app.devInspectPlaythrough(point.snapshot)!;
    // The selection is the one owner of which snapshot is inspected, and
    // the inspected figures are the plotted sample's own.
    expect(app.devInspected).toBe(point.snapshot);
    expect(inspection.index).toBe(point.snapshot);
    expect(inspection.elapsed).toBe(point.elapsed);
    expect(inspection.credited).toBe(point.credited);
    expect(inspection.rate).toBeCloseTo(point.rate, 9);
    expect(inspection.balances.nous).toBe(point.nous);
    expect(inspection.balances.arete).toBe(point.arete);
    expect(inspection.balances.eraEarned).toBe(point.eraEarned);
    expect(inspection.balances.cells).toBe(record.snapshots[point.snapshot]!.state.cells.length);
    // The shared command exposes the record's frozen state itself.
    expect(inspection.state).toBe(record.snapshots[point.snapshot]!.state);
    expect(inspection.events.every(event => event.snapshot <= point.snapshot)).toBe(true);
    for (const event of inspection.events) expect(record.events).toContain(event);
    // The board reads: every deployed voice with its note, level, and
    // final ν/s on the same preview basis.
    expect(inspection.voices.length).toBeGreaterThan(0);
    const snapshotState = record.snapshots[point.snapshot]!.state;
    expect(inspection.voices.length).toBe(snapshotState.modules.filter((m) => m.pos !== null).length);
    expect(inspection.voices.every((voice) => voice.nuPerSecond === null || voice.nuPerSecond >= 0)).toBe(true);
    // A session-boundary snapshot recorded between samples carries no
    // plotted point, and says so.
    const boundary = record.events.find((event) => event.kind === "session" && event.ok)!;
    const boundaryInspection = app.devInspectPlaythrough(boundary.snapshot)!;
    expect(record.trajectory.some((p) => p.snapshot === boundary.snapshot)).toBe(false);
    expect(boundaryInspection.point).toBeNull();
    expect(boundaryInspection.elapsed).toBe(boundary.at);
    expect(boundaryInspection.events.length).toBeGreaterThan(0);
    // A bad index is a thrown, named error and moves nothing.
    expect(() => app.devInspectPlaythrough(record.snapshots.length)).toThrow(/no recorded snapshot/);
    expect(app.devInspected).toBe(boundary.snapshot);
  });


  it.each(["recovered", "budget"] as const)("binds recovery milestones at their own stamp before %s exit", (stop) => {
    app = boot(undefined, true);
    const scenario = scenarioOf("fresh-start")!;
    vi.spyOn(scenario, "build").mockImplementation(() => {
      const state = createInitialState();
      state.eraEarned = 1e12;
      state.totalEarned = 1e12;
      state.modules[0]!.level = 100;
      return state;
    });
    vi.spyOn(scenario, "assert").mockImplementation(() => {});
    const prestige = actions.prestige;
    vi.spyOn(actions, "prestige").mockImplementation(state => {
      const result = prestige(state);
      state.modules[0]!.level = stop === "recovered" ? 100 : 0;
      return result;
    });
    const end = actions.endSession;
    vi.spyOn(actions, "endSession").mockImplementation((state, now) => {
      const result = end(state, now);
      state.eraEarned = 1e12;
      return result;
    });
    // Production recovery can occur during manage; eligibility is forced
    // across the horizon during the final session, after that settlement.
    const record = app.devRunPlaythrough({ policyId: "pushing", budgetDays: 1,
      schedule: { sessionsPerDay: 1, sessionMinutes: 1, breatherMinutes: 0 } });
    expect(record.stop.kind).toBe(stop);
    const eligibility = record.events.find(event => event.label === "Recovery — next prestige eligibility reached")!;
    expect(eligibility).toBeDefined();
    expect(eligibility.at).toBe(60);
    expect(eligibility.snapshot).toBeGreaterThanOrEqual(0);
    const inspection = app.devInspectPlaythrough(eligibility.snapshot)!;
    expect(inspection.elapsed).toBe(eligibility.at);
    expect(inspection.credited).toBe(eligibility.credited);
    expect(inspection.state.eraEarned).toBe(1e12);
    expect(inspection.events).toContain(eligibility);
    for (const event of record.events) {
      expect(event.snapshot).toBeGreaterThanOrEqual(0);
      expect(record.snapshots[event.snapshot]!.elapsed).toBe(event.at);
    }
  });

  it("keeps preparation decisions at a session boundary without future or stale sessions", () => {
    app = boot(undefined, true);
    const record = app.devRunPlaythrough({ seed: 7, budgetDays: 2 });
    const sessions = record.events.filter(event => event.kind === "session" && event.ok);
    const second = sessions[1]!;
    const first = sessions[0]!;
    const secondRead = app.devInspectPlaythrough(second.snapshot)!;
    const preparation = record.events.filter(event => event.snapshot > first.snapshot && event.snapshot < second.snapshot);
    expect(preparation.some(event => ["shelf", "cell", "place", "upgrade"].includes(event.kind))).toBe(true);
    expect(secondRead.events).toEqual(record.events.filter(event => event.snapshot > first.snapshot && event.snapshot <= second.snapshot));
    for (const event of preparation) expect(secondRead.events).toContain(event);
    expect(secondRead.events).not.toContain(first);
    expect(secondRead.events).toContain(second);
    expect(secondRead.events).not.toContain(sessions[2]);
    const after = app.devInspectPlaythrough(second.snapshot + 1)!;
    for (const event of preparation) expect(after.events).toContain(event);
  });

  it("draws the selected board layers and exposes the same frozen state without editing the live board", () => {
    app = boot(undefined, true);
    const scenario = scenarioOf("fresh-start")!;
    vi.spyOn(scenario, "build").mockImplementation(() => {
      const state = createInitialState();
      state.nous = 0;
      state.mutatorSlots = [{ q: 0, r: 0 }];
      state.mutators = [{ id: "historic-mutator", family: "power", rarity: "rare", pos: { q: 0, r: 0 } }];
      state.world.columns = [{ id: "historic-column", pos: { q: 0, r: 0 } }];
      state.world.weapons = [{ id: "historic-weapon", type: "chargeBlade", pos: { q: 0, r: 1 }, store: 12, cooldown: 0, targetPriority: ["w0"] }];
      state.world.enemies.w0 = { discovered: true, hp: 123 };
      return state;
    });
    vi.spyOn(scenario, "assert").mockImplementation(() => {});
    const liveBefore = JSON.stringify(app.state);
    const saveBefore = localStorage.getItem(STORAGE_KEY);
    const record = app.devRunPlaythrough({ budgetDays: 1, schedule: { sessionsPerDay: 1, sessionMinutes: 1 } });
    app.devToggleCurves();
    const inspection = app.devInspectPlaythrough(0)!;
    expect(inspection.state).toBe(record.snapshots[0]!.state);
    expect(Object.isFrozen(inspection.state.world.weapons[0])).toBe(true);
    const board = document.querySelector(".dev-history-board")!;
    expect([...board.querySelectorAll("h3")].map(h => h.querySelector("button")?.textContent ?? h.textContent)).toEqual(["Mutators", "Modules", "World"]);
    expect(board.querySelector('[data-history-mutator="0,0"]')!.textContent).toContain("rare power mutator");
    expect(board.querySelectorAll("[data-history-module]")).toHaveLength(inspection.state.cells.length);
    expect(board.querySelector('[data-history-world="0,0"]')!.textContent).toContain("COLUMN");
    expect(board.querySelector('[data-history-world="0,1"]')!.textContent).toContain("12");
    expect(board.querySelector('[data-history-world="-1,0"]')!.textContent).toContain("HP 123");
    expect(board.querySelectorAll("[data-buy], [data-cell], [data-world-cell]")).toHaveLength(0);
    expect(JSON.stringify(app.state)).toBe(liveBefore);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saveBefore);
    // The existing tooltip primitive supplies keyboard and touch access.
    const term = document.querySelector<HTMLButtonElement>('.dev-curves-line2 [aria-label="nous — what it means"]')!;
    term.focus();
    expect(term.getAttribute("aria-expanded")).toBe("true");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(term.getAttribute("aria-expanded")).toBe("false");
    term.click();
    expect(term.getAttribute("aria-expanded")).toBe("true");
  });

  it("inspection never mutates the active run, the save, or the recorded state", () => {
    app = boot(undefined, true);
    const record = app.devRunPlaythrough({ seed: 7, budgetDays: 1 });
    const before = app.state;
    const saved = localStorage.getItem(STORAGE_KEY);
    const beforeJson = JSON.stringify(app.state);
    for (let index = 0; index < record.snapshots.length; index += 7) {
      app.devInspectPlaythrough(index);
    }
    // The live run and its save are untouched by inspection.
    expect(app.state).toBe(before);
    expect(JSON.stringify(app.state)).toBe(beforeJson);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
    // The recorded states refuse writes loudly — strict-mode assignment
    // to a frozen state throws, so even an agent bug cannot rewrite
    // evidence in place.
    const snapshot = record.snapshots[0]!;
    expect(() => {
      (snapshot.state as { nous: number }).nous = 1234;
    }).toThrow(TypeError);
    expect(() => {
      (snapshot.state.modules as unknown[]).push({});
    }).toThrow(TypeError);
    expect(snapshot.state.nous).not.toBe(1234);
    // Clearing the selection is the same shared command at null.
    expect(app.devInspectPlaythrough(null)).toBeNull();
    expect(app.devInspected).toBeNull();
  });

  it("classifies curve markers, and declined attempts and unlisted actions plot none", () => {
    app = boot(undefined, true);
    const record = app.devRunPlaythrough({ seed: 7, budgetDays: 1 });
    const marked = new Set(record.events.map((event) => playthroughEventMarker(event)).filter(Boolean));
    expect(marked.has("purchase")).toBe(true);
    expect(marked.has("session")).toBe(true);
    expect(marked.has("unlock")).toBe(true);
    // Only successful events carry markers; the declined attempt and the
    // gestures the plot doesn't name stay decisions-list lines. World
    // buys are purchases; a World placement is a gesture, not one.
    for (const event of record.events) {
      if (!event.ok) expect(playthroughEventMarker(event)).toBeNull();
      if (event.kind === "placement" || event.kind === "upgrade") expect(playthroughEventMarker(event)).toBeNull();
      if (event.label.startsWith("Placed")) expect(playthroughEventMarker(event)).toBeNull();
    }
    // The classes' own rules, on the engine's classifier.
    expect(playthroughEventMarker({ at: 0, credited: 0, kind: "prestige", label: "Prestige 1", ok: true, snapshot: 0 })).toBe("prestige");
    expect(playthroughEventMarker({ at: 0, credited: 0, kind: "breather", label: "Breather — 300s of the 300s allowance", ok: true, snapshot: 0 })).toBe("breather");
    expect(playthroughEventMarker({ at: 0, credited: 0, kind: "world", label: "World Column", ok: true, snapshot: 0 })).toBe("purchase");
    expect(playthroughEventMarker({ at: 0, credited: 0, kind: "world", label: "Placed a Charge Column at 1,0", ok: true, snapshot: 0 })).toBeNull();
    expect(playthroughEventMarker({ at: 0, credited: 0, kind: "milestone", label: "Poly Expander 3 — 1.0ν/s → 1.2ν/s", ok: true, snapshot: 0 })).toBe("purchase");
    expect(playthroughEventMarker({ at: 0, credited: 0, kind: "milestone", label: "Feat unlocked — time-in-the-seat", ok: true, snapshot: 0 })).toBe("unlock");
    expect(playthroughEventMarker({ at: 0, credited: 0, kind: "milestone", label: "Recovery — next prestige eligibility reached", ok: true, snapshot: 0 })).toBeNull();
  });

  it("reports both clocks per sample, and the axes switch", () => {
    app = boot(undefined, true);
    const record = app.devRunPlaythrough({ seed: 7, budgetDays: 1 });
    // Simulated elapsed covers the day span; credited practice covers only
    // the sessions — both recorded on every sample.
    expect(record.trajectory[0]!.elapsed).toBe(0);
    expect(record.trajectory.at(-1)!.elapsed).toBe(record.elapsedSeconds);
    for (const point of record.trajectory) {
      expect(point.credited).toBeLessThanOrEqual(point.elapsed);
    }
    expect(record.trajectory.at(-1)!.credited).toBe(record.creditedSeconds);
    // The plot's clock is an app-level, agent-reachable setting.
    expect(app.devCurvesAxis).toBe("elapsed");
    app.devSetCurvesAxis("credited");
    expect(app.devCurvesAxis).toBe("credited");
    app.devSetCurvesAxis("credited");
    expect(app.devCurvesAxis).toBe("credited");
    app.devSetCurvesAxis("elapsed");
    expect(app.devCurvesAxis).toBe("elapsed");
  });
});

describe("the curves surface's visible wiring", () => {
  it("opens empty, plots the run's samples, and selects from points, markers, and stepping", () => {
    app = boot(undefined, true);
    const toggle = document.querySelector<HTMLButtonElement>('[data-dev="curves"]')!;
    expect(document.getElementById("dev-curves")).toBeNull();
    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.devCurvesOpen).toBe(true);
    expect(document.getElementById("dev-curves")!.textContent).toContain("no run yet");
    // The button's label carries the toggle state like the board's.
    expect(toggle.textContent).toBe("close curves");
    const record = app.devRunPlaythrough({ seed: 7, budgetDays: 1 });
    const panel = document.getElementById("dev-curves")!;
    expect(panel.textContent).toContain("RESOURCE CURVES");
    expect(panel.querySelectorAll("circle.dev-curves-pt")).toHaveLength(record.trajectory.length);
    expect(panel.textContent).toContain("no selection");
    // A plotted point selects its exact snapshot; the read names it.
    const point = record.trajectory[3]!;
    panel.querySelectorAll<HTMLDivElement>("circle.dev-curves-pt")[3]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.devInspected).toBe(point.snapshot);
    expect(panel.textContent).toContain(`sample ${point.snapshot + 1}/${record.snapshots.length} · sim `);
    // The marker glyphs select their events' snapshots (queried fresh —
    // the point's selection rebuilt the panel).
    document.getElementById("dev-curves")!.querySelector<SVGElement>(".dev-curves-mk-purchase")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.devInspected).toBe(record.events.find((event) => playthroughEventMarker(event) === "purchase")!.snapshot);
    // ◀ ▶ step the selection and wrap at the ends. Each selection rebuilds
    // the panel, so the stepping buttons are queried fresh per click.
    app.devInspectPlaythrough(0);
    document.getElementById("dev-curves")!.querySelector<HTMLButtonElement>('[data-devcurve="next"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.devInspected).toBe(1);
    document.getElementById("dev-curves")!.querySelector<HTMLButtonElement>('[data-devcurve="prev"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.devInspected).toBe(0);
    document.getElementById("dev-curves")!.querySelector<HTMLButtonElement>('[data-devcurve="prev"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.devInspected).toBe(record.snapshots.length - 1);
    document.getElementById("dev-curves")!.querySelector<HTMLButtonElement>('[data-devcurve="next"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.devInspected).toBe(0);
    // The axis buttons switch the plot's clock.
    const credited = document.getElementById("dev-curves")!.querySelector<HTMLButtonElement>('[data-devcurveaxis="credited"]')!;
    credited.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.devCurvesAxis).toBe("credited");
    expect(document.getElementById("dev-curves")!.querySelector('[data-devcurveaxis="credited"]')!.classList.contains("on")).toBe(true);
    // A new run clears the stale selection with the record it pointed at.
    app.devInspectPlaythrough(2);
    app.devRunPlaythrough({ seed: 8, budgetDays: 1 });
    expect(app.devInspected).toBeNull();
  });

  it("is a development surface, absent and refused outside dev mode", () => {
    app = boot(undefined, false);
    expect(() => app.devInspectPlaythrough(0)).toThrow(/development commands/);
    expect(() => app.devToggleCurves()).not.toThrow();
    expect(app.devCurvesOpen).toBe(false);
    expect(document.getElementById("dev-curves")).toBeNull();
  });
});
