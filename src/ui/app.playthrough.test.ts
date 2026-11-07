// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { App } from "./app";
import { completeSnapshotsOf, playthroughEventMarker, playthroughRunId, playthroughNote, type PlaythroughRecord } from "../engine/playthrough";
import { exportPlaythroughArtifact, PLAYTHROUGH_ARTIFACT_VERSION } from "../engine/playthrough-artifact";
import { ARETE_HORIZON } from "../engine/accumulator";
import { BALANCE } from "../engine/constants";
import { sameHex } from "../engine/hex";
import { createAppFixture } from "./testing/app-fixture";
import * as actions from "../engine/actions";
import { composePlaythroughRecipe } from "../engine/playthrough";
import { scenarioOf } from "../engine/scenarios";
import { createInitialState, createModule } from "../engine/state";
import { STORAGE_KEY } from "../engine/save";
import type { GameState } from "../engine/types";
import { SUPPLIED_ENGINE_SOURCE, suppliedArtifact, suppliedEvent, suppliedRecord, suppliedSnapshot, suppliedState, type SuppliedRecordFacts } from "./testing/supplied-playthrough";

// The playthrough presentation tests (issues #468/#469/#470/#473, the
// presentation/integration split of #510, ADR-0085): two kinds of
// evidence, each owning its own guarantees.
//
// **Presentation cases read supplied records.** Rendering, inspection,
// selection, marker classification, the note's readouts, and the
// import/read artifact paths declare explicit records through
// ./testing/supplied-playthrough and bring them in through the real
// artifact boundary — no walk establishes a UI setup, and no case pins a
// shipped balance amount or completion day: every expectation derives
// from the record's own declared facts. A supplied record marks its
// constructed origin (an imported library entry with "≠ current"
// provenance) and is never reachability evidence. Records are isolated:
// each case constructs its own.
//
// **A named integration set walks the real engine.** Reachability and
// command-to-engine behavior stay real walks:
// - reachability: the prompt door's honest zero bank ("completion"), the
//   pushing policy's worthwhile-prestige journey, its unfinished recovery
//   at the budget exit, and the incomplete claim-target outcome ("the pushing
//   policy");
// - command-to-engine: the recipe composition and rejection seams ("the
//   declared recipe", "declared tuning overrides", "declared response
//   curves"), the schedule's session/goal/calendar arithmetic ("schedule
//   accounting"), walk reproducibility and provenance
//   ("reproducibility"), the record's event shapes and the walk's
//   isolation from the live state and ordinary save ("the prompt
//   policy's record"), budget exhaustion, the frontier cap and the World
//   placement rules ("the pushing policy"), the checkpoint preset
//   install ("the run artifact boundary"), and the panel and terminal
//   wiring ("the panel's visible wiring", "the curves surface's visible
//   wiring", "the run artifact boundary"). The walk's isolation from the
//   live state and ordinary save is owned by "the prompt policy's
//   record", echoed on the tuned walk in "declared tuning overrides"
//   and on the artifact commands in "the run artifact boundary".
// Which figure the claim curve banks, which day a journey completes, and
// where the horizon sits are balance outcomes — engine and calibration
// verification: the frontier curve (`src/engine/world.test.ts`), the
// walked checkpoint banks (`src/engine/progression-presets.test.ts`),
// and the declared evaluation windows (`tools/first-prestige.test.ts`,
// `tools/century.test.ts`). The integration cases assert reachability
// and record-derived structure, never those shipped figures.
//
// The application-command fixtures (issues #468/#469, parent #465) boot
// a plain dev app per case: the runner is a pure engine walk that never
// touches the live state or the save, so every integration case keeps
// the app watching. The pushing integration cases ride one 600-minute
// daily session on the same five-minute breather — a declared schedule,
// not the default: the same credited-time economics at a fraction of the
// boundary breaks, so the long push to the first positive claim stays a
// test-sized run.
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
function comparable(record: PlaythroughRecord): Omit<PlaythroughRecord, "state" | "runId"> & { state: unknown } {
  const normalize = (raw: GameState): GameState => {
    const state = structuredClone(raw);
    state.achievements = Object.fromEntries(Object.keys(state.achievements).map((id) => [id, 0]));
    for (const discovery of Object.values(state.chordDiscovery)) discovery.firstFormedAt = 0;
    return state;
  };
  const { state, runId: _executionId, ...rest } = record;
  return {
    ...rest,
    snapshots: completeSnapshotsOf(record).map((snapshot) => ({ ...snapshot, state: normalize(snapshot.state) })),
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
    expect(recipe.eras).toBe(1);
    expect(recipe.overrides).toEqual({});
    // The policy catalog the five declared policies compose, and the app
    // offers it: the prompt/pushing pair and the World-comparison trio.
    expect(app.devPlaythroughPolicies().map((policy) => policy.id)).toEqual([
      "prompt", "pushing", "support", "combat", "ignoring",
    ]);
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
    expect(second.runId).not.toBe(first.runId);
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
  // The walk's isolation owner (issue #510's integration set): the
  // command drives the real engine walk on its own candidate state, and
  // the run — any run, tuned or curved — never touches the live state or
  // the ordinary save.
  it("records purchases, placement, milestones, sessions, and the engine's own decline reasons, and never touches the live state or the save", () => {
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
    // it, so the stop is the prestige, never the budget. The reachability
    // facts only — how far the era measure stands below the horizon and
    // which day the door opens are balance outcomes owned by engine and
    // calibration verification (the horizon pin and the frontier curve in
    // src/engine/world.test.ts, the first-prestige windows in tools/).
    const record = app.devRunPlaythrough({ budgetDays: 20 });
    expect(record.complete).toBe(true);
    expect(record.stop.kind).toBe("prestige");
    expect(record.claims).toEqual([0]);
    expect(record.state.prestiges).toBe(1);
    expect(record.state.arete).toBe(0);
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
  it("never banks past the frontier advance while observing the recovered era", () => {
    app = boot(undefined, true);
    const scenario = scenarioOf("fresh-start")!;
    vi.spyOn(scenario, "build").mockImplementation(() => {
      const state = createInitialState();
      state.eraEarned = BALANCE.world.entryNous * 10;
      state.totalEarned = state.eraEarned;
      return state;
    });
    vi.spyOn(scenario, "assert").mockImplementation(() => {});
    const prestige = actions.prestige;
    const bank = vi.spyOn(actions, "prestige").mockImplementation((state) => {
      const result = prestige(state);
      // Force the next claim across the target immediately, so this case
      // distinguishes the frontier advance's cap from endlessly farming
      // deeper claims: every break could bank again, and must not.
      state.eraEarned = BALANCE.world.entryNous *
        10 ** (state.world.frontier / BALANCE.world.claimDepthSlope + 1);
      return result;
    });
    const record = app.devRunPlaythrough({ policyId: "pushing", budgetDays: 3,
      schedule: { sessionsPerDay: 1, sessionMinutes: 1, breatherMinutes: 0 } });
    // The second bank advanced the frontier beyond the first bank's claim
    // — the journey's last mark — and the walk banked no more: three
    // further breaks followed with the refill mock always offering a
    // claim, and none of them prestaged.
    expect(bank).toHaveBeenCalledTimes(2);
    expect(record.claims).toHaveLength(2);
    expect(record.recovery!.frontierAdvanced).not.toBeNull();
    expect(record.state.prestiges).toBe(2);
    expect(record.stop.kind).toBe("budget");
    expect(record.stop.reason).toContain("worthwhile-prestige journey");
  });

  it("leaves unfinished recovery marks explicitly unreached at the budget exit", () => {
    app = boot(undefined, true);
    const before = JSON.stringify(app.state);
    const saved = localStorage.getItem(STORAGE_KEY);
    const scenario = scenarioOf("fresh-start")!;
    vi.spyOn(scenario, "build").mockImplementation(() => {
      const state = createInitialState();
      // Start at a real bank with a high pre-reset rate and a working
      // charge line. The one-minute next era cannot regain that rate or
      // the horizon; no action or recovery result is mocked.
      const generator = createModule(state, "focusKeyed");
      generator.pos = { q: 1, r: 0 };
      state.modules.push(generator);
      state.modules[0]!.level = 100;
      state.eraEarned = BALANCE.world.entryNous * 10;
      state.totalEarned = state.eraEarned;
      return state;
    });
    vi.spyOn(scenario, "assert").mockImplementation(() => {});
    const record = app.devRunPlaythrough({ policyId: "pushing", budgetDays: 1,
      claimTarget: BALANCE.world.claimBase,
      schedule: { sessionsPerDay: 1, sessionMinutes: 1, breatherMinutes: 0 } });
    expect(record.complete).toBe(false);
    expect(record.stop.kind).toBe("budget");
    expect(record.stop.reason).toContain("inside the worthwhile-prestige journey");
    expect(record.claims).toHaveLength(1);
    expect(record.claims[0]).toBeGreaterThan(0);
    expect(record.state.prestiges).toBe(1);
    expect(record.creditedSeconds).toBe(60);
    expect(record.recovery).not.toBeNull();
    expect(record.recovery!.claim).toBe(record.claims[0]);
    expect(record.recovery!.lastingPurchase).not.toBeNull();
    expect(record.recovery!.columnDeployed).not.toBeNull();
    expect(record.recovery!.weaponDeployed).toBeNull();
    expect(record.recovery!.productionRegained).toBeNull();
    expect(record.recovery!.eligibilityReached).toBeNull();
    expect(record.recovery!.frontierAdvanced).toBeNull();
    expect(record.events.some(event => event.milestone && event.label.startsWith("Recovery —") &&
      /production regained|eligibility reached|frontier advanced/.test(event.label))).toBe(false);
    expect(app.devPlaythroughNote).toContain("blade unreached");
    expect(app.devPlaythroughNote).toContain("rate unreached, door unreached, frontier unreached");
    expect(app.devPlaythroughNote).not.toContain("✓");
    expect(JSON.stringify(app.state)).toBe(before);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
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
    // The charge line's seat reads the authoritative preview: the owned
    // cell carries no module, so no line exists and the Column waits.
    expect(record.events.some((event) => event.reason === "no free World cell on a charge line")).toBe(true);
  });

  it("pushes past the first eligibility, banks, spends, deploys the starter rig, recovers, and advances the frontier", { timeout: 300_000 }, () => {
    app = boot(undefined, true);
    const before = app.state;
    const saved = localStorage.getItem(STORAGE_KEY);
    const record = app.devRunPlaythrough({ policyId: "pushing", claimTarget: 2, budgetDays: 12, schedule: PUSHING_SCHEDULE });
    // The run never touched the live state or the save.
    expect(app.state).toBe(before);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);

    // The reachability facts: the pushing policy held the first-eligibility
    // door (where the prompt run banks zero), banked a positive claim,
    // banked again past it, and completed the worthwhile-prestige journey
    // inside the budget. How much the curve pays at each bank and which
    // day the journey completes are balance outcomes — owned by engine
    // and calibration verification (the frontier curve in
    // src/engine/world.test.ts, the walked banks and their days in
    // src/engine/progression-presets.test.ts, the declared windows in
    // tools/) — so this case reads the record's own structure: the
    // frontier stands exactly at the claims' sum, each bank having
    // advanced it by the banked step, and the journey's stop names the
    // record's own day and frontier.
    expect(record.complete).toBe(true);
    expect(record.stop.kind).toBe("recovered");
    expect(record.claims.length).toBe(2);
    expect(record.claims[0]).toBeGreaterThan(0);
    expect(record.claims[1]).toBeGreaterThan(0);
    expect(record.state.world.frontier).toBe(record.claims[0]! + record.claims[1]!);
    expect(record.stop.reason)
      .toContain(`journey completed at day ${record.days} — the frontier advanced to ${record.state.world.frontier} Arete.`);
    expect(record.claimTarget).toBe(2);
    expect(record.state.prestiges).toBe(2);
    expect(record.policy.name).toBe("Pushing");

    // The earned spending: the Catalog entry with the first claim and at
    // least the first Charge Column — nothing granted, nothing minted.
    // The starter Charge Blade is the first World-eligible claim's own
    // grant; the exact rung count the bank funds rides the balance.
    expect(record.areteSpent.entry).toBe(1);
    expect(record.areteSpent.columns).toBeGreaterThanOrEqual(1);
    expect(record.state.world.starterWeaponGranted).toBe(true);
    expect(record.state.arete).toBeLessThan(record.claims[0]! + record.claims[1]!);
    // No grants: every ν the state ever banked is what the run earned —
    // the sessions and their breathers, each recorded separately. At this
    // scale the summations drift by float rounding alone, so the
    // guarantee reads as a relative tolerance, not an exact figure.
    expect(record.sessionNous).toBeGreaterThan(record.breatherNous);
    expect(record.sessionNous + record.breatherNous).toBe(record.earnedNous);
    expect(Math.abs(record.state.totalEarned - record.earnedNous)).toBeLessThan(Math.max(1, record.earnedNous) * 1e-12);

    // The functioning starter rig, through the real actions: the weapon
    // deployed beside the living discovered enemy and the Column on the
    // charge line — and the rig fought: the starter blade defeated w0 on
    // its own cadence, the combat route the journey exists to prove.
    const weapon = record.state.world.weapons[0]!;
    expect(weapon.type).toBe("chargeBlade");
    expect(weapon.pos).not.toBeNull();
    const column = record.state.world.columns[0]!;
    expect(column.pos).not.toBeNull();
    expect(record.state.cells.some((cell) => cell.q === column.pos!.q && cell.r === column.pos!.r)).toBe(true);
    // The rig fought: the defeat ledger carries w0, killed on the blade's
    // own cadence — the final state's w0 is the second prestige's fresh
    // enemy, so the defeat lives in the ledger, not the last board. The
    // journey completes at its frontier advance before the relocated
    // blade's second fight resolves, so w1 stands discovered but alive —
    // the route the later frontiers owe, demonstrated walk-wide in the
    // recorded matrices.
    expect(record.worldDefeats).toEqual(["w0"]);
    expect(record.worldDiscoveries).toContain("w0");
    expect(record.worldDiscoveries).toContain("w1");
    // The Column stands on a charge line: a module beneath it, receiving
    // what the line copies — the lift's own requirement, read at the
    // placement rule too.
    expect(column.pos !== null && record.state.modules.some((m) => m.pos !== null && sameHex(m.pos, column.pos!))).toBe(true);
    const worldEvents = record.events.filter((event) => event.kind === "world" && event.ok);
    expect(worldEvents.map((event) => event.label)).toContain("World Column");
    expect(worldEvents.some((event) => event.label.startsWith("Placed the chargeBlade at"))).toBe(true);
    expect(worldEvents.some((event) => event.label.startsWith("Placed a Charge Column at"))).toBe(true);

    // The worthwhile-prestige ledger: every mark reached, each measured
    // from the first bank on both clocks, in the journey's order — the
    // purchase landing the moment the walk could spend, the blade and the
    // rate following, the next door, and the frontier advancing beyond
    // the claimed frontier. Each mark's credited practice cannot exceed
    // its simulated elapsed time.
    expect(record.recovery).not.toBeNull();
    const recovery = record.recovery!;
    expect(recovery.claim).toBe(record.claims[0]!);
    expect(recovery.lastingPurchase).toEqual({ elapsed: 0, credited: 0 });
    expect(recovery.lastingPurchaseLabel).toBe("Catalog entry");
    // The Column lands the moment it is bought: the opening board already
    // carries a charge line — a receiving module beside the generator —
    // so the purchase functions from its first between-sessions read.
    expect(recovery.columnDeployed).toEqual({ elapsed: 0, credited: 0 });
    expect(recovery.weaponDeployed).not.toBeNull();
    expect(recovery.productionRegained).not.toBeNull();
    expect(recovery.eligibilityReached).not.toBeNull();
    expect(recovery.frontierAdvanced).not.toBeNull();
    expect(recovery.preResetRate).toBeGreaterThan(0);
    for (const mark of [recovery.lastingPurchase!, recovery.weaponDeployed!, recovery.columnDeployed!,
      recovery.eligibilityReached!, recovery.productionRegained!, recovery.frontierAdvanced!]) {
      expect(mark.credited).toBeGreaterThanOrEqual(0);
      expect(mark.credited).toBeLessThanOrEqual(mark.elapsed);
    }
    expect(recovery.frontierAdvanced!.elapsed).toBeGreaterThan(recovery.eligibilityReached!.elapsed);
    expect(record.events.some((event) => event.milestone && event.label.includes("next prestige eligibility reached"))).toBe(true);
    expect(record.events.some((event) => event.milestone && event.label.includes("pre-reset production regained"))).toBe(true);
    expect(record.events.some((event) => event.milestone && event.label === "Recovery — lasting purchase (Catalog entry)")).toBe(true);
    expect(record.events.some((event) => event.milestone && /Recovery — frontier advanced to \d+ Arete/.test(event.label))).toBe(true);
    // The eligibility settle read the era measure past the horizon — the
    // door's own gate (ARETE_HORIZON, engine-pinned in
    // src/engine/world.test.ts): the milestone's own snapshot carries
    // the settle's board, so the walk-level "the settle read the era
    // measure" evidence rides the real journey, no mocks.
    const eligibilityEvent = record.events.find((event) => event.milestone && event.label.includes("next prestige eligibility reached"))!;
    expect(completeSnapshotsOf(record)[eligibilityEvent.snapshot]!.state.eraEarned).toBeGreaterThanOrEqual(ARETE_HORIZON);

    // The readable record: the prestige lines name their banks, and the
    // note carries the journey's read. The exact note figures are the
    // readout's own presentation evidence (supplied records own that
    // rendering); the walked note names the record's own facts.
    const prestiges = record.events.filter((event) => event.kind === "prestige");
    expect(prestiges.map((event) => event.label)).toEqual([
      `Prestige 1 — banked ${record.claims[0]} Arete`,
      `Prestige 2 — banked ${record.claims[1]} Arete`,
    ]);
    for (const event of prestiges) expect(event.milestone).toBe(true);
    expect(app.devPlaythroughNote).toContain("Pushing ✓");
    expect(app.devPlaythroughNote).toContain("recovery — bank");
    expect(app.devPlaythroughNote).toContain(`journey completed at day ${record.days}`);
  });

  it("treats an unreached claim target as an explicit incomplete outcome, never a fabricated bank", () => {
    app = boot(undefined, true);
    // A real walk, at the test-sized one-minute session: the push plays
    // its day and the budget ends — the 36-Arete entitlement lives
    // decades past the World's entry, far past anything the budget
    // reaches. How deep an era measure credited time carries, and how
    // far past the door a multi-day push rides, are balance outcomes —
    // the calibration windows own them (tools/first-prestige.test.ts,
    // tools/century.test.ts), and the journey case above owns the real
    // bank past the door. This case owns the outcome contract: a target
    // the budget cannot reach is named unreached, and nothing is
    // fabricated.
    const record = app.devRunPlaythrough({ policyId: "pushing", claimTarget: 36, budgetDays: 1,
      schedule: { sessionsPerDay: 1, sessionMinutes: 1, breatherMinutes: 0 } });
    expect(record.complete).toBe(false);
    expect(record.stop.kind).toBe("budget");
    expect(record.claimTarget).toBe(36);
    expect(record.claims).toEqual([]);
    expect(record.state.prestiges).toBe(0);
    expect(record.recovery).toBeNull();
    expect(record.bottleneck).toContain("36-Arete");
    // Nothing was spent, because nothing was ever banked.
    expect(record.areteSpent).toEqual({ entry: 0, discounts: 0, ceilings: 0, columns: 0, rowUnlocks: 0, hone: { chargeBlade: 0 } });
    expect(app.devPlaythroughNote).toContain("Pushing ✗");
    expect(app.devPlaythroughNote).toContain("claim none/36 Arete");
  });

  it("reproduces the pushing run from the same recipe and identifies a changed target", { timeout: 240_000 }, () => {
    app = boot(undefined, true);
    const input = { policyId: "pushing", claimTarget: 6, budgetDays: 2, schedule: PUSHING_SCHEDULE } as const;
    const first = app.devRunPlaythrough({ ...input });
    const second = app.devRunPlaythrough({ ...input });
    expect(second.runId).not.toBe(first.runId);
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

describe("declared tuning overrides", () => {
  it("declares the tuning catalog with shipped defaults, and the default recipe carries none", () => {
    app = boot(undefined, true);
    const tuning = app.devTuning();
    expect(tuning.map((param) => param.key)).toEqual(["openingGrant", "claimBase"]);
    // The catalog reads the shipped balance it declares — the figures
    // themselves are engine verification's pins (the frontier curve in
    // src/engine/world.test.ts), so a controlled balance change moves
    // that pin, never this wiring.
    expect(tuning.find((param) => param.key === "openingGrant")!.default).toBe(BALANCE.openingGrant);
    expect(tuning.find((param) => param.key === "claimBase")!.default).toBe(BALANCE.world.claimBase);
    for (const param of tuning) {
      expect(param.max).toBeGreaterThan(param.min);
      expect(param.description).toBeTruthy();
    }
    expect(app.devPlaythroughRecipe().overrides).toEqual({});
  });

  it("rejects unsupported, invalid, and inapplicable overrides by name before running", () => {
    app = boot(undefined, true);
    expect(() => app.devRunPlaythrough({ overrides: { grant: 5 } })).toThrow(/override "grant" is not supported — the suite offers openingGrant, claimBase/);
    expect(() => app.devRunPlaythrough({ overrides: { openingGrant: 1.5 } })).toThrow(/override "openingGrant" must be a whole number 0–120 — found 1\.5/);
    expect(() => app.devRunPlaythrough({ overrides: { openingGrant: 999 } })).toThrow(/override "openingGrant" must be a whole number 0–120 — found 999/);
    expect(() => app.devRunPlaythrough({ overrides: { claimBase: 0 } })).toThrow(/override "claimBase" must be a whole number 1–36 — found 0/);
    // The prompt door opens below the frontier curve's entry depth, so a
    // claim-base override cannot bind there — refused, not silently inert.
    expect(() => app.devRunPlaythrough({ overrides: { claimBase: 4 } })).toThrow(/override "claimBase" is inapplicable/);
    expect(app.devPlaythrough).toBeNull();
    // The same override composes once the policy reads the curve —
    // validated at the composition seam, no walk needed to know.
    expect(() => composePlaythroughRecipe({ policyId: "pushing", overrides: { claimBase: 4 } })).not.toThrow();
    expect(composePlaythroughRecipe({ policyId: "pushing", overrides: { claimBase: 4 } }).overrides).toEqual({ claimBase: 4 });
  });

  it("pays the declared opening grant on a fresh start, names the tuning, and leaves the live state, save, and baseline recipe untouched", () => {
    app = boot(undefined, true);
    const before = app.state;
    const saved = localStorage.getItem(STORAGE_KEY);
    const tuned = app.devRunPlaythrough({ seed: 7, budgetDays: 1, overrides: { openingGrant: 60 } });
    // The declared grant is the run's own first moment: the 60ν opening
    // affords the generator shelf purchase the shipped 12ν never can —
    // the run's first recorded board carries two modules against the
    // baseline's one, the purchase landed through the real action.
    expect(tuned.recipe.overrides).toEqual({ openingGrant: 60 });
    expect(completeSnapshotsOf(tuned)[0]!.state.modules.length).toBe(2);
    expect(app.devPlaythroughNote).toContain("tuned openingGrant=60");
    // The baseline beside it, same seed: shipped grant, shipped board.
    const plain = app.devRunPlaythrough({ seed: 7, budgetDays: 1 });
    expect(plain.recipe.overrides).toEqual({});
    expect(completeSnapshotsOf(plain)[0]!.state.modules.length).toBe(1);
    expect(tuned.runId).not.toBe(plain.runId);
    // The tuned walks touched nothing live: the baseline recipe — the
    // app's own default — still carries no overrides, the tuned recipes
    // rode the records alone, and neither the live state nor the save
    // moved (the isolation owner is "the prompt policy's record"; this
    // is the override-carrying walk's own instance of it).
    expect(app.state).toBe(before);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
    expect(app.devPlaythroughRecipe().overrides).toEqual({});
  });

  it("binds the declared claim base at the pushing bank where the shipped curve pays its own floor", () => {
    app = boot(undefined, true);
    const scenario = scenarioOf("fresh-start")!;
    vi.spyOn(scenario, "build").mockImplementation(() => {
      const state = createInitialState();
      state.eraEarned = BALANCE.world.entryNous;
      state.totalEarned = state.eraEarned;
      return state;
    });
    vi.spyOn(scenario, "assert").mockImplementation(() => {});
    // The shipped curve pays its entry floor — the shipped claimBase,
    // read from the balance it owns, never pinned here (the curve's
    // figures are engine verification, src/engine/world.test.ts); the
    // declared base 4 pays 4 — the same walk, the run's own claim curve,
    // banked through the real prestige action. The relative behavior —
    // the override binding where the shipped floor stood — is what this
    // case owns.
    const shipped = app.devRunPlaythrough({ policyId: "pushing", claimTarget: BALANCE.world.claimBase, budgetDays: 1,
      schedule: { sessionsPerDay: 1, sessionMinutes: 1, breatherMinutes: 0 } });
    expect(shipped.claims).toEqual([BALANCE.world.claimBase]);
    const tuned = app.devRunPlaythrough({ policyId: "pushing", claimTarget: 4, budgetDays: 1,
      schedule: { sessionsPerDay: 1, sessionMinutes: 1, breatherMinutes: 0 }, overrides: { claimBase: 4 } });
    expect(tuned.claims).toEqual([4]);
    expect(tuned.state.world.frontier).toBe(tuned.claims[0]!);
    expect(tuned.recipe.overrides).toEqual({ claimBase: 4 });
    expect(app.devPlaythroughNote).toContain("tuned claimBase=4");
  });

  it("reproduces a tuned run from the same recipe and identifies a changed override", () => {
    app = boot(undefined, true);
    const input = { seed: 9, budgetDays: 2, overrides: { openingGrant: 100 } };
    const first = app.devRunPlaythrough({ ...input });
    const second = app.devRunPlaythrough({ ...input });
    expect(second.runId).not.toBe(first.runId);
    expect(comparable(second)).toEqual(comparable(first));
    const changed = app.devRunPlaythrough({ ...input, overrides: { openingGrant: 101 } });
    expect(changed.runId).not.toBe(first.runId);
    expect(changed.recipe.overrides).toEqual({ openingGrant: 101 });
  });
});

describe("declared response curves (issue #487)", () => {
  it("declares the curve catalog, and the default recipe carries shipped", () => {
    app = boot(undefined, true);
    const curves = app.devResponseCurves();
    expect(curves.map((curve) => curve.id)).toEqual(["shipped", "linear", "bounded"]);
    expect(curves.map((curve) => curve.name)).toEqual(["Shipped", "Linear", "Bounded"]);
    for (const curve of curves) expect(curve.description).toBeTruthy();
    expect(app.devPlaythroughRecipe().responseCurve).toBe("shipped");
  });

  it("rejects unknown candidates by name before running, through the command and the terminal", () => {
    app = boot(undefined, true);
    expect(() => app.devRunPlaythrough({ responseCurve: "exponential" as never }))
      .toThrow(/response curve "exponential" is not supported — the suite offers shipped, linear, bounded\./);
    expect(app.devPlaythrough).toBeNull();
    expect(app.devTerminalRun("run curve=bogus seed=7 days=1")).toMatch(/✗ .*response curve "bogus" is not supported/);
    expect(app.devPlaythrough).toBeNull();
  });

  it("applies the declared curve to the walk's own state and names it in the note; shipped stays untouched", () => {
    app = boot(undefined, true);
    const boundedRun = app.devRunPlaythrough({ seed: 7, budgetDays: 1, responseCurve: "bounded" });
    expect(boundedRun.recipe.responseCurve).toBe("bounded");
    expect(boundedRun.state.candidates).toEqual({ responseCurve: "bounded" });
    expect(completeSnapshotsOf(boundedRun)[0]!.state.candidates).toEqual({ responseCurve: "bounded" });
    expect(app.devPlaythroughNote).toContain("curve bounded");
    const plain = app.devRunPlaythrough({ seed: 7, budgetDays: 1 });
    expect(plain.recipe.responseCurve).toBe("shipped");
    expect(plain.state.candidates).toBeUndefined();
    expect(app.devPlaythroughNote).not.toContain("curve");
    expect(boundedRun.runId).not.toBe(plain.runId);
  });

  it("never lets a candidate curve touch the live state or the ordinary save", () => {
    app = boot(undefined, true);
    const before = app.state;
    const saved = localStorage.getItem(STORAGE_KEY);
    const record = app.devRunPlaythrough({ seed: 7, budgetDays: 1, responseCurve: "linear" });
    expect(app.state).toBe(before);
    expect(app.state.candidates).toBeUndefined();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
    expect(app.devPlaythroughRecipe().responseCurve).toBe("shipped");
    expect(record.recipe.responseCurve).toBe("linear");
  });

  it("reproduces a curve run from the same recipe and identifies a changed candidate", () => {
    app = boot(undefined, true);
    const input = { seed: 9, budgetDays: 2, responseCurve: "bounded" as const };
    const first = app.devRunPlaythrough({ ...input });
    const second = app.devRunPlaythrough({ ...input });
    expect(second.runId).not.toBe(first.runId);
    expect(comparable(second)).toEqual(comparable(first));
    const changed = app.devRunPlaythrough({ ...input, responseCurve: "linear" });
    expect(changed.runId).not.toBe(first.runId);
    expect(changed.recipe.responseCurve).toBe("linear");
  });

  it("runs from the panel's curve select — the same composition the agent command takes", () => {
    app = boot(undefined, true);
    const curve = document.getElementById("dev-playthrough-curve") as HTMLSelectElement;
    expect([...curve.options].map((option) => option.value)).toEqual(["shipped", "linear", "bounded"]);
    expect(curve.options[curve.selectedIndex]!.text).toBe("Shipped");
    curve.value = "bounded";
    const seedField = document.getElementById("dev-playthrough-seed") as HTMLInputElement;
    const budgetField = document.getElementById("dev-playthrough-budget") as HTMLInputElement;
    seedField.value = "9";
    budgetField.value = "1";
    const run = document.querySelector<HTMLButtonElement>('[data-dev="playthrough"]')!;
    run.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const clicked = app.devPlaythrough!;
    expect(clicked.recipe.responseCurve).toBe("bounded");
    expect(clicked.state.candidates).toEqual({ responseCurve: "bounded" });
    expect(note()).toContain("curve bounded");
    const agent = app.devRunPlaythrough({ seed: 9, budgetDays: 1, responseCurve: "bounded" });
    expect(agent.runId).not.toBe(clicked.runId);
    expect(comparable(agent)).toEqual(comparable(clicked));
  });

  it("serves the curve through the terminal run command", () => {
    app = boot(undefined, true);
    expect(app.devTerminalRun("run curve=bounded seed=7 days=1")).toContain("curve bounded");
    expect(app.devPlaythrough!.recipe.responseCurve).toBe("bounded");
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
    expect(agent.runId).not.toBe(clicked.runId);
    expect(comparable(agent)).toEqual(comparable(clicked));
  });

  it("exposes the policy select and claim-target input, and the run reads them", () => {
    app = boot(undefined, true);
    const policy = document.getElementById("dev-playthrough-policy") as HTMLSelectElement;
    const targetField = document.getElementById("dev-playthrough-target") as HTMLInputElement;
    // The select offers the five declared policies under their own names.
    expect([...policy.options].map((option) => option.value)).toEqual([
      "prompt", "pushing", "support", "combat", "ignoring",
    ]);
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
    expect(agent.runId).not.toBe(clicked.runId);
  });

  it("is a development command, refused outside dev mode", () => {
    app = boot(undefined, false);
    expect(() => app.devRunPlaythrough({ budgetDays: 1 })).toThrow(/development commands/);
    expect(document.getElementById("dev-playthrough-note")).toBeNull();
  });
});

// The supplied-record facts and the import seam the presentation cases
// read. Each case constructs its own (isolated between tests) and brings
// it in through the artifact boundary like any recorded evidence — the
// record's constructed origin stays visible on every surface that shows
// provenance.
function importSupplied(facts: SuppliedRecordFacts): PlaythroughRecord {
  app.devImportPlaythrough(suppliedArtifact(facts));
  return app.devPlaythrough!;
}

// The supplied two-era journey several presentation cases read. Facts,
// not a walk: plotted samples at snapshots 0, 1, 2, 4, 5; session
// boundaries at 1, 3, and 5; a tied clock at the first session's close
// (elapsed == credited); a bank at snapshot 4 splitting era-local
// decisions; and the recovery ledger's blade, rate, door, and frontier
// marks explicitly unreached — a half-recovered era, valid evidence no
// fabricated mark may replace.
function suppliedJourney(): SuppliedRecordFacts {
  // The two-era board facts: the same generator beside the opening synth,
  // changing synth levels so selection must read each snapshot's own
  // rate, with era 2's balances and frontier on the banked board.
  const journeyBoard = (era: 1 | 2, level: number): GameState => suppliedState((state) => {
    state.modules[0]!.level = level;
    const generator = createModule(state, "focusKeyed");
    generator.pos = { q: 1, r: 0 };
    state.modules.push(generator);
    if (era === 1) {
      state.nous = 480;
      state.totalEarned = 6000;
      state.eraEarned = 6000;
    } else {
      state.prestiges = 1;
      state.arete = 3;
      state.world.frontier = 4;
      state.nous = 240;
      state.totalEarned = 6000;
      state.eraEarned = 1800;
    }
  });
  const snapshots = [
    suppliedSnapshot({ state: journeyBoard(1, 0), elapsed: 0, credited: 0 }),
    // Session 1's close: the tied clock — the whole span is the session
    // itself, so both clocks read the same.
    suppliedSnapshot({ state: journeyBoard(1, 1), elapsed: 1500, credited: 1500 }),
    suppliedSnapshot({ state: journeyBoard(1, 2), elapsed: 3000, credited: 1500 }),
    suppliedSnapshot({ state: journeyBoard(1, 3), elapsed: 4500, credited: 3000 }),
    // The bank: era 2's board.
    suppliedSnapshot({ state: journeyBoard(2, 0), elapsed: 5000, credited: 3000 }),
    // Session 3, era 2's first session boundary — the record's final
    // moment, beyond the last plotted sample.
    suppliedSnapshot({ state: journeyBoard(2, 1), elapsed: 6500, credited: 4500 }),
  ];
  const events = [
    suppliedEvent({ at: 0, credited: 0, kind: "purchase", label: "Shelf — generator", snapshot: 0 }),
    suppliedEvent({ at: 1500, credited: 1500, kind: "session", label: "Session 1", snapshot: 1 }),
    suppliedEvent({ at: 3000, credited: 1500, kind: "breather", label: "Breather — 300s of the 300s allowance", snapshot: 2 }),
    suppliedEvent({ at: 3000, credited: 1500, kind: "placement", label: "Placed the generator at 1,0", ok: false, reason: "the cell is occupied", snapshot: 2 }),
    suppliedEvent({ at: 3000, credited: 1500, kind: "upgrade", label: "Upgrade — generator II", snapshot: 2 }),
    suppliedEvent({ at: 4500, credited: 3000, kind: "session", label: "Session 2", snapshot: 3 }),
    suppliedEvent({ at: 5000, credited: 3000, kind: "prestige", label: "Prestige 1 — banked 4 Arete", milestone: true, snapshot: 4 }),
    suppliedEvent({ at: 5000, credited: 3000, kind: "arete", label: "Catalog entry", snapshot: 4 }),
    suppliedEvent({ at: 6500, credited: 4500, kind: "session", label: "Session 3", snapshot: 5 }),
  ];
  // Plot and inspection read the same captured facts, including the
  // tied sample at snapshot 1. No independent rate or balance can drift
  // away from the board the point selects.
  const trajectory = [0, 1, 2, 4, 5].map(index => {
    const snapshot = snapshots[index]!;
    return {
      elapsed: snapshot.elapsed, credited: snapshot.credited,
      rate: snapshot.rate, forgeRate: 0,
      eraEarned: snapshot.numbers.eraEarned,
      nous: Math.floor(snapshot.numbers.nous), arete: snapshot.numbers.arete,
      snapshot: index,
    };
  });
  return {
    // The target stays below what the record's curve paid — intent and
    // outcome distinguishable in the note, the same shape the real
    // journey's walked record carries.
    recipe: { seed: 510, policyId: "pushing", claimTarget: 3, eras: 2 },
    complete: false,
    stop: { kind: "budget", reason: "The 1-day budget ended inside the worthwhile-prestige journey." },
    claims: [4],
    days: 1,
    elapsedSeconds: 6500,
    creditedSeconds: 4500,
    breatherSeconds: 300,
    manageBreaks: 3,
    sessionNous: 400,
    breatherNous: 80,
    lastMilestone: "Prestige 1 — banked 4 Arete",
    events,
    trajectory,
    snapshots,
    recovery: {
      preResetRate: snapshots[3]!.rate,
      claim: 4,
      lastingPurchase: { elapsed: 0, credited: 0 },
      lastingPurchaseLabel: "Catalog entry",
      columnDeployed: { elapsed: 0, credited: 0 },
      weaponDeployed: null,
      productionRegained: null,
      eligibilityReached: null,
      frontierAdvanced: null,
    },
    areteSpent: { entry: 1, discounts: 0, ceilings: 0, columns: 0, rowUnlocks: 0, hone: { chargeBlade: 0 } },
    worldDiscoveries: ["w0"],
    eras: [
      { index: 0, startElapsed: 0, startCredited: 0, endElapsed: 5000, endCredited: 3000, claim: 4, frontierAfter: 4, priorDepth: null, priorRate: null, familiarCredited: 3000, newCredited: 0, productionRegained: null, priorDepthPassed: null, finite: true },
      { index: 1, startElapsed: 5000, startCredited: 3000, endElapsed: null, endCredited: null, claim: null, frontierAfter: null, priorDepth: 4, priorRate: snapshots[3]!.rate, familiarCredited: 0, newCredited: 0, productionRegained: null, priorDepthPassed: null, finite: null },
    ],
  };
}

// The historical inspection boundary (issue #470, parent stories 26–29),
// re-homed onto supplied records by #510: what the plot, the selection,
// and the inspector read off a record, exercised on explicit constructed
// evidence. The walked-record guarantees underneath — the capture shape,
// the deep-frozen states, the exact event/sample/rate bindings on a real
// walk — are engine verification (src/engine/playthrough-retention.test.ts);
// these cases own how the presentation reads the record's declared
// facts, including the boundary shapes a given walk may never produce on
// schedule: tied clocks, era-local events, and explicitly unreached
// marks.
describe("historical snapshots and inspection on supplied records", () => {
  it("selection reveals the matching board, state, and recent decisions through the shared command", () => {
    app = boot(undefined, true);
    const record = importSupplied(suppliedJourney());
    const point = record.trajectory[2]!;
    const inspection = app.devInspectPlaythrough(point.snapshot)!;
    // The selection is the one owner of which snapshot is inspected, and
    // the inspected figures are the plotted sample's own.
    expect(app.devInspected).toBe(point.snapshot);
    expect(inspection.index).toBe(point.snapshot);
    expect(inspection.elapsed).toBe(point.elapsed);
    expect(inspection.credited).toBe(point.credited);
    expect(inspection.rate).toBe(point.rate);
    expect(inspection.balances.nous).toBe(point.nous);
    expect(inspection.balances.arete).toBe(point.arete);
    expect(inspection.balances.eraEarned).toBe(point.eraEarned);
    expect(inspection.balances.cells).toBe(completeSnapshotsOf(record)[point.snapshot]!.state.cells.length);
    // The shared command exposes the record's frozen state itself.
    expect(inspection.state).toBe(completeSnapshotsOf(record)[point.snapshot]!.state);
    expect(inspection.events.every(event => event.snapshot <= point.snapshot)).toBe(true);
    for (const event of inspection.events) expect(record.events).toContain(event);
    // The board reads: every deployed voice with its note, level, and
    // ν/s — the snapshot's own voices, nothing recomputed.
    expect(inspection.voices.length).toBeGreaterThan(0);
    const snapshotState = completeSnapshotsOf(record)[point.snapshot]!.state;
    expect(inspection.voices.length).toBe(snapshotState.modules.filter((m) => m.pos !== null).length);
    expect(inspection.voices.every((voice) => voice.nuPerSecond === null || voice.nuPerSecond >= 0)).toBe(true);
    // A session-boundary snapshot recorded between samples carries no
    // plotted point, and says so — Session 2's boundary (snapshot 3)
    // sits between the plotted samples.
    const boundary = record.events.filter((event) => event.kind === "session" && event.ok)[1]!;
    const boundaryInspection = app.devInspectPlaythrough(boundary.snapshot)!;
    expect(record.trajectory.some((p) => p.snapshot === boundary.snapshot)).toBe(false);
    expect(boundaryInspection.point).toBeNull();
    expect(boundaryInspection.elapsed).toBe(boundary.at);
    expect(boundaryInspection.events.length).toBeGreaterThan(0);
    // A bad index is a thrown, named error and moves nothing.
    expect(() => app.devInspectPlaythrough(record.snapshots.length)).toThrow(/no recorded snapshot/);
    expect(app.devInspected).toBe(boundary.snapshot);
  });

  it("keeps every plotted sample's rate and balances aligned with its inspected snapshot", () => {
    app = boot(undefined, true);
    const record = importSupplied(suppliedJourney());
    expect(new Set(record.trajectory.map(point => point.rate)).size).toBeGreaterThan(1);
    for (const point of record.trajectory) {
      const inspection = app.devInspectPlaythrough(point.snapshot)!;
      expect(inspection.elapsed).toBe(point.elapsed);
      expect(inspection.credited).toBe(point.credited);
      expect(inspection.rate).toBe(point.rate);
      expect(inspection.balances.nous).toBe(point.nous);
      expect(inspection.balances.eraEarned).toBe(point.eraEarned);
      expect(inspection.balances.arete).toBe(point.arete);
    }
  });

  it("keeps preparation decisions at a session boundary without future or stale sessions", () => {
    app = boot(undefined, true);
    const record = importSupplied(suppliedJourney());
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

  it("reads tied clocks and era-local facts exactly as the record declares them", () => {
    app = boot(undefined, true);
    const record = importSupplied(suppliedJourney());
    // The tied sample: both clocks equal, plotted and inspectable — the
    // boundary a walk produces only where its schedule happens to land
    // one, and a supplied record declares outright.
    const tied = record.trajectory[1]!;
    expect(tied.elapsed).toBe(tied.credited);
    const tiedRead = app.devInspectPlaythrough(tied.snapshot)!;
    expect(tiedRead.point!.elapsed).toBe(tiedRead.point!.credited);
    expect(tiedRead.elapsed).toBe(tiedRead.credited);
    // Era-local reads: era 1's samples carry no prestiges; the bank
    // snapshot's board carries era 2; the ledgers close era 0 at its
    // claim and leave era 1 open — the record's own facts, not a
    // recomputation.
    const era1Sample = app.devInspectPlaythrough(record.trajectory[2]!.snapshot)!;
    expect(era1Sample.balances.prestiges).toBe(0);
    const bank = app.devInspectPlaythrough(4)!;
    expect(bank.balances.prestiges).toBe(1);
    expect(bank.balances.arete).toBe(3);
    expect(record.eras[0]!.claim).toBe(record.claims[0]);
    expect(record.eras[1]!.claim).toBeNull();
    expect(app.devPlaythroughNote).toContain("eras 1/2 closed");
    // The plot renders samples from both eras on one clock.
    app.devToggleCurves();
    const panel = document.getElementById("dev-curves")!;
    expect(panel.querySelectorAll("circle.dev-curves-pt")).toHaveLength(record.trajectory.length);
  });

  it.each(["recovered", "budget"] as const)("binds the recovery milestone at its own stamp on a %s record", (stop) => {
    app = boot(undefined, true);
    // The bank sits at the very first recorded moment — the tied zero
    // clock — and the eligibility milestone binds there. The recovered
    // record carries the journey's marks; the budget record leaves blade
    // and rate explicitly unreached — a slower recovery being valid
    // evidence no fabricated mark may replace. (The walk-produced
    // ledger's owners are "the pushing policy"'s journey case and
    // "leaves unfinished recovery marks explicitly unreached at the budget exit".)
    const bankState = suppliedState((state) => {
      state.prestiges = 1;
      state.arete = 4;
      state.world.frontier = 4;
      state.eraEarned = 1_800_000;
      state.totalEarned = 1_800_000;
    });
    const eligibility = suppliedEvent({ at: 0, credited: 0, kind: "milestone", label: "Recovery — next prestige eligibility reached", milestone: true, snapshot: 0 });
    const recovered = stop === "recovered";
    const bankSnapshot = suppliedSnapshot({ state: bankState, elapsed: 0, credited: 0 });
    const record = importSupplied({
      recipe: { seed: 510, policyId: "pushing", claimTarget: 2 },
      complete: recovered,
      stop: recovered
        ? { kind: "recovered", reason: "The worthwhile-prestige journey completed at day 2 — the frontier advanced to 6 Arete." }
        : { kind: "budget", reason: "The 2-day budget ended inside the worthwhile-prestige journey." },
      claims: [4],
      days: recovered ? 2 : 1,
      elapsedSeconds: recovered ? 172_800 : 0,
      creditedSeconds: recovered ? 7_200 : 0,
      lastMilestone: "Recovery — next prestige eligibility reached",
      events: [
        suppliedEvent({ at: 0, credited: 0, kind: "prestige", label: "Prestige 1 — banked 4 Arete", milestone: true, snapshot: 0 }),
        eligibility,
      ],
      trajectory: [{ elapsed: 0, credited: 0, rate: bankSnapshot.rate, forgeRate: 0,
        eraEarned: bankSnapshot.numbers.eraEarned, nous: Math.floor(bankSnapshot.numbers.nous),
        arete: bankSnapshot.numbers.arete, snapshot: 0 }],
      snapshots: [bankSnapshot],
      recovery: {
        preResetRate: 2,
        claim: 4,
        lastingPurchase: { elapsed: 0, credited: 0 },
        lastingPurchaseLabel: "Catalog entry",
        columnDeployed: { elapsed: 0, credited: 0 },
        weaponDeployed: recovered ? { elapsed: 86_400, credited: 3_600 } : null,
        productionRegained: recovered ? { elapsed: 86_400, credited: 3_600 } : null,
        eligibilityReached: recovered ? { elapsed: 86_400, credited: 3_600 } : null,
        frontierAdvanced: recovered ? { elapsed: 172_800, credited: 7_200 } : null,
      },
    });
    expect(record.stop.kind).toBe(stop);
    if (recovered) {
      expect(record.recovery!.weaponDeployed).not.toBeNull();
      expect(record.recovery!.productionRegained).not.toBeNull();
    } else {
      expect(record.recovery!.weaponDeployed).toBeNull();
      expect(record.recovery!.productionRegained).toBeNull();
    }
    expect(eligibility.at).toBe(0);
    expect(eligibility.snapshot).toBeGreaterThanOrEqual(0);
    const inspection = app.devInspectPlaythrough(eligibility.snapshot)!;
    expect(inspection.elapsed).toBe(eligibility.at);
    expect(inspection.credited).toBe(eligibility.credited);
    expect(inspection.point!.snapshot).toBe(eligibility.snapshot);
    // Imported evidence compares by value: the inspection window reads
    // the imported record's own decisions.
    expect(inspection.events).toContainEqual(eligibility);
    for (const event of record.events) {
      expect(event.snapshot).toBeGreaterThanOrEqual(0);
      expect(record.snapshots[event.snapshot]!.elapsed).toBe(event.at);
    }
  });

  it("draws the selected board layers and exposes the same frozen state without editing the live board", () => {
    app = boot(undefined, true);
    const liveBefore = JSON.stringify(app.state);
    const saveBefore = localStorage.getItem(STORAGE_KEY);
    importSupplied({
      snapshots: [suppliedSnapshot({
        state: suppliedState((state) => {
          state.nous = 0;
          state.mutatorSlots = [{ q: 0, r: 0 }];
          state.mutators = [{ id: "historic-mutator", family: "power", rarity: "rare", pos: { q: 0, r: 0 } }];
          state.world.columns = [{ id: "historic-column", pos: { q: 0, r: 0 } }];
          state.world.weapons = [{ id: "historic-weapon", type: "chargeBlade", pos: { q: 0, r: 1 }, store: 12, cooldown: 0, targetPriority: ["w0"] }];
          state.world.enemies.w0 = { discovered: true, hp: 123 };
        }),
        elapsed: 0,
        credited: 0,
      })],
    });
    app.devToggleCurves();
    const record = app.devPlaythrough!;
    const inspection = app.devInspectPlaythrough(0)!;
    expect(inspection.state).toBe(completeSnapshotsOf(record)[0]!.state);
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
    const record = importSupplied(suppliedJourney());
    const before = app.state;
    const saved = localStorage.getItem(STORAGE_KEY);
    const beforeJson = JSON.stringify(app.state);
    for (let index = 0; index < record.snapshots.length; index++) {
      app.devInspectPlaythrough(index);
    }
    // The live run and its save are untouched by inspection.
    expect(app.state).toBe(before);
    expect(JSON.stringify(app.state)).toBe(beforeJson);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
    // The recorded states refuse writes loudly — strict-mode assignment
    // to a frozen state throws, so even an agent bug cannot rewrite
    // evidence in place.
    const snapshot = completeSnapshotsOf(record)[0]!;
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
    // The marker zoo on one declared record: every class the classifier
    // names, beside the gestures and attempts that plot none. (The
    // walked record's event kinds are pinned by "the prompt policy's
    // record"; this case owns the classification and its rendering.)
    importSupplied({
      events: [
        suppliedEvent({ at: 0, credited: 0, kind: "purchase", label: "Shelf — generator", snapshot: 0 }),
        suppliedEvent({ at: 0, credited: 0, kind: "arete", label: "Catalog entry", snapshot: 0 }),
        suppliedEvent({ at: 0, credited: 0, kind: "session", label: "Session 1", snapshot: 0 }),
        suppliedEvent({ at: 0, credited: 0, kind: "roll", label: "Rolled — accepted", snapshot: 0 }),
        suppliedEvent({ at: 0, credited: 0, kind: "breather", label: "Breather — 300s of the 300s allowance", snapshot: 0 }),
        suppliedEvent({ at: 0, credited: 0, kind: "prestige", label: "Prestige 1 — banked 0 Arete", milestone: true, snapshot: 0 }),
        suppliedEvent({ at: 0, credited: 0, kind: "world", label: "World Column", snapshot: 0 }),
        suppliedEvent({ at: 0, credited: 0, kind: "world", label: "Placed a Charge Column at 1,0", snapshot: 0 }),
        suppliedEvent({ at: 0, credited: 0, kind: "milestone", label: "Poly Expander 3 — 1.0ν/s → 1.2ν/s", milestone: true, snapshot: 0 }),
        suppliedEvent({ at: 0, credited: 0, kind: "milestone", label: "Feat unlocked — time-in-the-seat", milestone: true, snapshot: 0 }),
        suppliedEvent({ at: 0, credited: 0, kind: "milestone", label: "Recovery — next prestige eligibility reached", milestone: true, snapshot: 0 }),
        suppliedEvent({ at: 0, credited: 0, kind: "placement", label: "Placed the generator at 1,0", ok: false, reason: "the cell is occupied", snapshot: 0 }),
        suppliedEvent({ at: 0, credited: 0, kind: "upgrade", label: "Upgrade — generator II", snapshot: 0 }),
      ],
    });
    app.devToggleCurves();
    const panel = document.getElementById("dev-curves")!;
    // The panel plots exactly what the classifier names: four purchases
    // (the shelf, the Catalog offering, the World buy, the capacity
    // milestone), two unlocks (the roll, the feat), the session, the
    // breather, and the prestige. The declined attempt, the placement
    // and upgrade gestures, the World placement, and the recovery
    // milestone stay decisions-list lines.
    expect(panel.querySelectorAll(".dev-curves-mk-purchase")).toHaveLength(4);
    expect(panel.querySelectorAll(".dev-curves-mk-unlock")).toHaveLength(2);
    expect(panel.querySelectorAll(".dev-curves-hair-session")).toHaveLength(1);
    expect(panel.querySelectorAll(".dev-curves-mk-breather")).toHaveLength(1);
    expect(panel.querySelectorAll(".dev-curves-hair-prestige")).toHaveLength(1);
    // Declined attempts and unlisted gestures stay decisions-list lines.
    expect(panel.querySelectorAll(".dev-curves-mk")).toHaveLength(7);
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
    const record = importSupplied(suppliedJourney());
    // Simulated elapsed covers the declared span; credited practice
    // covers only the sessions — both recorded on every sample, the tied
    // sample reading both clocks equal.
    expect(record.trajectory[0]!.elapsed).toBe(0);
    expect(record.trajectory.at(-1)!.elapsed).toBe(record.elapsedSeconds);
    for (const point of record.trajectory) {
      expect(point.credited).toBeLessThanOrEqual(point.elapsed);
    }
    expect(record.trajectory.at(-1)!.credited).toBe(record.creditedSeconds);
    const tied = record.trajectory[1]!;
    expect(tied.elapsed).toBe(tied.credited);
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

// The selected run's readout (the note line): the record's own figures,
// rendered — exercised on supplied records, so no shipped balance amount
// or completion day pins the rendering. `playthroughNote` is the
// engine's pure renderer over the record; the app's note adds only the
// imported/modified provenance marks.
describe("the selected run's readout on supplied records", () => {
  it("derives the ✓ line from the record's own facts — claims, target, spending, tuning, curve, eras, stop", () => {
    app = boot(undefined, true);
    importSupplied({
      recipe: { seed: 510, policyId: "pushing", claimTarget: 3, eras: 2, overrides: { openingGrant: 60 }, responseCurve: "bounded" },
      complete: true,
      stop: { kind: "recovered", reason: "The worthwhile-prestige journey completed at day 2 — the frontier advanced to 7 Arete." },
      claims: [5, 2],
      days: 2,
      elapsedSeconds: 172_800,
      creditedSeconds: 7_200,
      breatherSeconds: 600,
      manageBreaks: 4,
      sessionNous: 500,
      breatherNous: 100,
      areteSpent: { entry: 1, discounts: 0, ceilings: 0, columns: 2, rowUnlocks: 0, hone: { chargeBlade: 0 } },
      lastMilestone: "Recovery — frontier advanced to 7 Arete",
      eras: [
        { index: 0, startElapsed: 0, startCredited: 0, endElapsed: 86_400, endCredited: 3_600, claim: 5, frontierAfter: 5, priorDepth: null, priorRate: null, familiarCredited: 3_600, newCredited: 0, productionRegained: null, priorDepthPassed: null, finite: true },
        { index: 1, startElapsed: 86_400, startCredited: 3_600, endElapsed: 172_800, endCredited: 7_200, claim: 2, frontierAfter: 7, priorDepth: 5, priorRate: 2.0, familiarCredited: 3_600, newCredited: 0, productionRegained: { elapsed: 43_200, credited: 1_800 }, priorDepthPassed: { elapsed: 86_400, credited: 3_600 }, finite: true },
      ],
    });
    expect(app.devPlaythroughNote).toContain("Pushing ✓");
    expect(app.devPlaythroughNote).toContain("2d · 120m credited of 2880m elapsed");
    expect(app.devPlaythroughNote).toContain("claim 5, 2/3 Arete");
    expect(app.devPlaythroughNote).toContain("spent Catalog entry + 2× Charge Column");
    expect(app.devPlaythroughNote).toContain("tuned openingGrant=60");
    expect(app.devPlaythroughNote).toContain("curve bounded");
    expect(app.devPlaythroughNote).toContain("eras 2/2 closed");
    expect(app.devPlaythroughNote).toContain("journey completed at day 2");
    expect(app.devPlaythroughNote).not.toContain("✗");
  });

  it("reads unreached recovery marks as unreached, never fabricated", () => {
    app = boot(undefined, true);
    importSupplied(suppliedJourney());
    // The half-recovered journey: banked 4, the purchase and column at
    // the bank's own moment, blade, rate, door, and frontier explicitly
    // unreached — the note says so, and no ✓ invents a completion.
    expect(app.devPlaythroughNote).toContain("recovery — bank 4, purchase 0.0d/0m (Catalog entry)");
    expect(app.devPlaythroughNote).toContain("blade unreached, column 0.0d/0m, rate unreached");
    expect(app.devPlaythroughNote).toContain("door unreached, frontier unreached");
    expect(app.devPlaythroughNote).toContain("Pushing ✗");
    expect(app.devPlaythroughNote).not.toContain("✓");
  });

  it("marks imported origin — a supplied record never reads as a fresh walk", () => {
    app = boot(undefined, true);
    const record = importSupplied(suppliedJourney());
    // The library marks the entry imported and unmodified; the note
    // rides the "Imported · " prefix; the carried source names the
    // constructed origin, so the curves provenance shows it beside the
    // current engine.
    expect(app.devResults[0]!.imported).toBe(true);
    expect(app.devResults[0]!.modified).toBe(false);
    expect(app.devPlaythroughNote!.startsWith("Imported · ")).toBe(true);
    expect(record.source.engineSource).toBe(SUPPLIED_ENGINE_SOURCE);
    app.devToggleCurves();
    const prov = document.querySelector(".dev-curves-prov")!.textContent!;
    expect(prov).toContain("imported");
    expect(prov).toContain("≠ current");
  });
});

describe("the curves surface's visible wiring", () => {
  it("opens empty, plots the supplied record's samples, and selects from points, markers, and stepping", () => {
    app = boot(undefined, true);
    const toggle = document.querySelector<HTMLButtonElement>('[data-dev="curves"]')!;
    expect(document.getElementById("dev-curves")).toBeNull();
    toggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.devCurvesOpen).toBe(true);
    expect(document.getElementById("dev-curves")!.textContent).toContain("no run yet");
    // The button's label carries the toggle state like the board's.
    expect(toggle.textContent).toBe("close curves");
    const record = importSupplied(suppliedJourney());
    const panel = document.getElementById("dev-curves")!;
    expect(panel.textContent).toContain("RESOURCE CURVES");
    expect(panel.querySelectorAll("circle.dev-curves-pt")).toHaveLength(record.trajectory.length);
    expect(panel.textContent).toContain("no selection");
    // A plotted point selects its exact snapshot; the read names it.
    const point = record.trajectory[3]!;
    panel.querySelectorAll<HTMLDivElement>("circle.dev-curves-pt")[3]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.devInspected).toBe(point.snapshot);
    expect(document.getElementById("dev-curves")!.textContent).toContain(`sample ${point.snapshot + 1}/${record.snapshots.length} · sim `);
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
    // A new run clears the stale selection with the record it pointed
    // at — the one walk here: the command-level integration the clearing
    // owns (a fresh walk lands in the library and invalidates the stale
    // selection), not a setup walk.
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

// The artifact boundary (issue #473, parent stories 34–36): export,
// import, and the results library through the same commands the dev
// panel's controls, the terminal, and agent access share. The artifact is
// the persisted form of provenance and results — the ordinary save is
// never read or written here — and importing reopens recorded evidence
// without the original browser, session, or checkout, never re-executing
// or reinterpreting it.
describe("the run artifact boundary", () => {
  it("exports the selected run whole and imports it back exactly as carried", () => {
    app = boot(undefined, true);
    const record = app.devRunPlaythrough({ seed: 7, budgetDays: 1 });
    const text = app.devExportPlaythrough();
    const artifact = JSON.parse(text) as Record<string, unknown>;
    expect(artifact.format).toBe("flowsynth-playthrough");
    expect(artifact.version).toBe(PLAYTHROUGH_ARTIFACT_VERSION);
    expect(artifact.runId).toBe(record.runId);
    // The import joins the library as carried, takes the selection, and
    // marks itself: old evidence never reads as a fresh walk.
    const loaded = app.devImportPlaythrough(text);
    expect(loaded.runId).toBe(record.runId);
    expect(app.devSelectedRunId).toBe(record.runId);
    expect(app.devResults).toHaveLength(1);
    expect(app.devResults[0]!.imported).toBe(true);
    expect(app.devResults[0]!.modified).toBe(false);
    expect(comparable(app.devPlaythrough!)).toEqual(comparable(record));
    expect(app.devPlaythroughNote).toContain("Imported · ");
    expect(app.devPlaythroughNote).toContain(record.runId);
  });

  it("reopens an imported run's inspection after the original session is gone", () => {
    app = boot(undefined, true);
    const record = importSupplied(suppliedJourney());
    const index = record.trajectory[2]!.snapshot;
    const original = app.devInspectPlaythrough(index)!;
    const artifact = app.devExportPlaythrough();
    app.dispose();
    // A fresh browser: empty library, nothing shared but the artifact
    // text.
    const fresh = boot(undefined, true);
    expect(fresh.devResults).toHaveLength(0);
    fresh.devImportPlaythrough(artifact);
    const reopened = fresh.devInspectPlaythrough(index)!;
    expect(reopened.balances).toEqual(original.balances);
    expect(reopened.rate).toBe(original.rate);
    expect(reopened.voices).toEqual(original.voices);
    expect(reopened.events.map((event) => event.label)).toEqual(original.events.map((event) => event.label));
    // Nothing re-executes: the library holds exactly the imported record.
    expect(fresh.devResults).toHaveLength(1);
    expect(fresh.devResults[0]!.imported).toBe(true);
    expect(fresh.devResults[0]!.record.events).toEqual(record.events);
    // The curves surface reads the imported run with its provenance named.
    fresh.devToggleCurves();
    const panel = document.getElementById("dev-curves")!;
    expect(panel.textContent).toContain(record.runId);
    expect(panel.querySelector(".dev-curves-prov")!.textContent).toContain("imported");
  });

  it("rejects malformed and unsupported artifacts by name and imports nothing", () => {
    app = boot(undefined, true);
    const record = importSupplied(suppliedJourney());
    const before = app.devResults.length;
    const refuse = (text: string, fragment: RegExp): void => {
      expect(() => app.devImportPlaythrough(text)).toThrow(fragment);
    };
    // Not JSON, an ordinary save, and a newer format version each name
    // their refusal; the library and selection stay untouched.
    refuse("not json at all", /not valid JSON/);
    refuse('{"app":"flowsynth","version":14,"savedAt":0,"state":{}}', /not a FlowSynth run artifact/);
    const newer = JSON.parse(app.devExportPlaythrough()) as Record<string, unknown>;
    newer.version = 99;
    refuse(JSON.stringify(newer), new RegExp(`Artifact version 99 is newer than this build supports \\(${PLAYTHROUGH_ARTIFACT_VERSION}\\)`));
    expect(app.devResults).toHaveLength(before);
    expect(app.devSelectedRunId).toBe(record.runId);
    expect(app.devPlaythroughNote).toContain("Import ✗");
  });

  it("keeps imported evidence read-only and unchanged by inspection", () => {
    const facts = suppliedJourney();
    const text = suppliedArtifact(facts);
    const fresh = boot(undefined, true);
    fresh.devImportPlaythrough(text);
    // The imported recorded states freeze whole, like a fresh walk's: a
    // stray write through inspection fails loudly instead of rewriting
    // evidence.
    const imported = fresh.devResults[0]!.record;
    expect(() => {
      (completeSnapshotsOf(imported)[0]!.state as { mode: string }).mode = "flow";
    }).toThrow();
    const first = fresh.devInspectPlaythrough(0)!;
    const second = fresh.devInspectPlaythrough(0)!;
    expect(second.balances).toEqual(first.balances);
    expect(comparable(imported)).toEqual(comparable(suppliedRecord(facts)));
  });

  it("preserves an incomplete run's status and bottleneck through the artifact", () => {
    app = boot(undefined, true);
    const record = importSupplied(suppliedJourney());
    expect(record.complete).toBe(false);
    expect(record.stop.kind).toBe("budget");
    const artifact = app.devExportPlaythrough();
    const fresh = boot(undefined, true);
    fresh.devImportPlaythrough(artifact);
    const reopened = fresh.devPlaythrough!;
    expect(reopened.complete).toBe(false);
    expect(reopened.stop).toEqual(record.stop);
    expect(reopened.bottleneck).toBe(record.bottleneck);
    expect(fresh.devPlaythroughNote).toContain("✗");
  });

  it("carries a modified preset install's interventions and mark through export and import", { timeout: 240_000 }, async () => {
    app = boot(undefined, true);
    await app.devLaunchScenario("approaching-prestige", Date.UTC(2026, 0, 20, 9));
    // The install brings its own walked record: the evidence the preset
    // grew from, selected and clean.
    const walked = app.devPlaythrough!;
    expect(app.devScenarioId).toBe("approaching-prestige");
    expect(app.devResults.map((result) => result.record.runId)).toEqual([walked.runId]);
    expect(app.devResults[0]!.modified).toBe(false);
    // One intervention on the installed run marks it and rides its
    // record's library entry.
    app.devNous();
    expect(app.devScenarioModified).toBe(true);
    expect(app.devResults[0]!.modified).toBe(true);
    expect(app.devResults[0]!.interventions).toHaveLength(1);
    expect(app.devResults[0]!.interventions[0]!.label).toContain("grant");
    const artifact = app.devExportPlaythrough();
    expect(JSON.parse(artifact).modified).toBe(true);
    // Across the boundary the status survives verbatim: the imported
    // evidence reads modified and re-exports with the same interventions.
    app.dispose();
    const fresh = boot(undefined, true);
    fresh.devImportPlaythrough(artifact);
    expect(fresh.devResults[0]!.modified).toBe(true);
    expect(fresh.devResults[0]!.interventions).toHaveLength(1);
    expect(fresh.devPlaythroughNote).toContain("modified — 1 intervention");
    fresh.devToggleCurves();
    expect(document.getElementById("dev-curves")!.querySelector(".dev-curves-prov")!.textContent).toContain("modified — 1 intervention");
    const reexported = JSON.parse(fresh.devExportPlaythrough()) as Record<string, unknown>;
    expect(reexported.modified).toBe(true);
    expect(reexported.interventions).toEqual(JSON.parse(artifact).interventions);
  });

  it("keeps reruns separately identified and each result's own provenance", () => {
    app = boot(undefined, true);
    const first = app.devRunPlaythrough({ seed: 9, budgetDays: 1 });
    const second = app.devRunPlaythrough({ seed: 10, budgetDays: 1 });
    expect(first.runId).not.toBe(second.runId);
    expect(app.devResults.map((result) => result.record.runId)).toEqual([second.runId, first.runId]);
    // Viewing the older result moves the selection only — its provenance
    // stands as recorded, and nothing re-executes.
    app.devSelectRun(first.runId);
    expect(app.devSelectedRunId).toBe(first.runId);
    expect(app.devPlaythrough!.recipe.seed).toBe(9);
    expect(app.devPlaythroughNote).toBe(playthroughNote(first));
    // Each execution preserves the earlier evidence, even for the same recipe/source.
    const rerun = app.devRunPlaythrough({ seed: 9, budgetDays: 1 });
    expect(rerun.runId).not.toBe(first.runId);
    expect(app.devResults).toHaveLength(3);
    expect(app.devResults.find(result => result.record.runId === first.runId)!.record).toBe(first);
    const modifiedArtifact = JSON.parse(app.devExportPlaythrough());
    modifiedArtifact.modified = true;
    modifiedArtifact.interventions = [{ at: 1, label: "historical intervention", ok: true }];
    app.devImportPlaythrough(JSON.stringify(modifiedArtifact));
    const again = app.devRunPlaythrough({ seed: 9, budgetDays: 1 });
    expect(again.runId).not.toBe(rerun.runId);
    const preserved = app.devResults.find(result => result.record.runId === rerun.runId)!;
    expect(preserved.imported).toBe(true);
    expect(preserved.modified).toBe(true);
    expect(preserved.interventions).toEqual(modifiedArtifact.interventions);
    // An artifact from another engine joins as carried: its own source
    // provenance stays, visibly different from the current engine, and
    // the run is never re-walked against it.
    const foreign = exportPlaythroughArtifact({
      record: { ...rerun, source: { ...rerun.source, engineSource: "older-engine" } },
    });
    app.devImportPlaythrough(foreign);
    const imported = app.devResults.find((result) => result.record.runId === rerun.runId)!;
    expect(imported.imported).toBe(true);
    expect(imported.record.source.engineSource).toBe("older-engine");
    expect(imported.record.events).toEqual(rerun.events);
    app.devToggleCurves();
    expect(document.getElementById("dev-curves")!.querySelector(".dev-curves-prov")!.textContent).toContain("≠ current");
  });

  it("never touches the ordinary save on export, import, or selection", () => {
    app = boot(undefined, true);
    const before = localStorage.getItem(STORAGE_KEY);
    const record = app.devRunPlaythrough({ seed: 7, budgetDays: 1 });
    const artifact = app.devExportPlaythrough();
    app.devImportPlaythrough(artifact);
    app.devSelectRun(record.runId);
    app.devExportPlaythrough();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
    // The formats stay strangers both ways: the save importer refuses an
    // artifact by name, and the artifact importer refused the save above.
    const failed = app.importText(artifact);
    expect(failed).toBe(false);
    expect(app.ui.importError).toContain("not a FlowSynth save");
  });

  it("wires the visible controls to the same commands", async () => {
    app = boot(undefined, true);
    const first = app.devRunPlaythrough({ seed: 9, budgetDays: 1 });
    const second = app.devRunPlaythrough({ seed: 10, budgetDays: 1 });
    // The library select lists every recorded run newest-first with its
    // marks, and changing it drives the same selection command.
    const select = document.getElementById("dev-runs") as HTMLSelectElement;
    expect(select.hidden).toBe(false);
    expect(select.options).toHaveLength(2);
    expect(select.value).toBe(second.runId);
    select.value = first.runId;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(app.devSelectedRunId).toBe(first.runId);
    // Export downloads the selected run's artifact file — the same JSON
    // the command returns.
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    document.querySelector<HTMLButtonElement>('[data-dev="export-run"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    // The downloaded artifact is the selected run's — the export stamp is
    // the one field that legitimately differs call to call.
    const downloaded = JSON.parse(await blob.text()) as Record<string, unknown>;
    const standing = JSON.parse(app.devExportPlaythrough()) as Record<string, unknown>;
    delete downloaded.exportedAt;
    delete standing.exportedAt;
    expect(downloaded).toEqual(standing);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    // Import reads the chosen file through the same command.
    const input = document.getElementById("dev-import-file") as HTMLInputElement;
    const file = new File([app.devExportPlaythrough()], "run.json", { type: "application/json" });
    Object.defineProperty(input, "files", {
      configurable: true,
      value: { 0: file, length: 1, item: (index: number) => (index === 0 ? file : null) },
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(app.devResults[0]!.imported).toBe(true);
    expect(app.devSelectedRunId).toBe(first.runId);
  });

  it("serves the same artifact commands through the terminal", () => {
    app = boot(undefined, true);
    const record = app.devRunPlaythrough({ seed: 9, budgetDays: 1 });
    expect(app.devTerminalRun("runs")).toContain(record.runId);
    expect(app.devTerminalRun("export")).toContain(record.runId);
    app.devRunPlaythrough({ seed: 10, budgetDays: 1 });
    expect(app.devTerminalRun(`select ${record.runId}`)).toContain(record.runId);
    expect(app.devSelectedRunId).toBe(record.runId);
    const artifact = app.devExportPlaythrough();
    expect(app.devTerminalRun(`import ${artifact}`)).toContain(record.runId);
    expect(app.devResults[0]!.imported).toBe(true);
    // Named failures land as ✗ lines, and help lists the commands.
    expect(app.devTerminalRun("import { nope")).toMatch(/^✗/);
    expect(app.devTerminalRun("select missing")).toMatch(/^✗/);
    expect(app.devTerminalRun("help")).toContain("import");
  });

  it("is a development boundary, refused outside dev mode", () => {
    app = boot(undefined, false);
    expect(() => app.devExportPlaythrough()).toThrow(/development commands/);
    expect(() => app.devImportPlaythrough("{}")).toThrow(/development commands/);
    expect(() => app.devSelectRun("x")).toThrow(/development commands/);
  });
});
