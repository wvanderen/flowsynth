// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { playthroughRunId, type PlaythroughRecord } from "../engine/playthrough";
import { createAppFixture } from "./testing/app-fixture";
import { STORAGE_KEY } from "../engine/save";

// The playthrough's application-command fixtures (issue #468, parent
// #465): small deterministic known-outcome runs driven through the same
// command the dev panel's run control and agent access share — schedule
// accounting, reproducibility, recorded decisions, completion with the
// honest zero claim, budget exhaustion, and the visible result wiring.
// The runner is a pure engine walk: a run never touches the live state or
// the save, so every case boots a plain dev app and keeps it watching.
const fixture = createAppFixture();
const boot = fixture.boot;

let app: App;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => fixture.release());

const note = (): string => document.getElementById("dev-playthrough-note")?.textContent ?? "";

// The behavior-affecting comparison form: the record as a run produced it,
// with the real-clock discovery stamps normalized to their identities. The
// engine stamps action-boundary unlocks (feats, first chord formations)
// with the honest wall clock — presentation metadata, not run behavior.
// The run's outcomes, trajectory, decisions, and balances must match
// exactly.
function comparable(record: PlaythroughRecord): Omit<PlaythroughRecord, "state"> & { state: unknown } {
  const state = structuredClone(record.state);
  state.achievements = Object.fromEntries(Object.keys(state.achievements).map((id) => [id, 0]));
  for (const discovery of Object.values(state.chordDiscovery)) discovery.firstFormedAt = 0;
  const { state: _dropped, ...rest } = record;
  return { ...rest, state };
}

describe("the declared recipe", () => {
  it("carries starting state, seed, policy, schedule, budget, calendar anchor, and empty overrides", () => {
    app = boot(undefined, true);
    const recipe = app.devPlaythroughRecipe();
    expect(recipe.scenarioId).toBe("fresh-start");
    expect(recipe.policyId).toBe("prompt");
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
  });

  it("rejects unsupported input by name instead of running a default", () => {
    app = boot(undefined, true);
    expect(() => app.devRunPlaythrough({ scenarioId: "nope" } as never)).toThrow(/no scenario "nope"/);
    expect(() => app.devRunPlaythrough({ policyId: "pushing" } as never)).toThrow(/no policy "pushing"/);
    expect(() => app.devRunPlaythrough({ grant: 1000 } as never)).toThrow(/unsupported input "grant"/);
    expect(() => app.devRunPlaythrough({ schedule: { startAt: Number.NaN } })).toThrow(/startAt/);
    expect(note()).toContain("Playthrough ✗");
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

  it("is a development command, refused outside dev mode", () => {
    app = boot(undefined, false);
    expect(() => app.devRunPlaythrough({ budgetDays: 1 })).toThrow(/development commands/);
    expect(document.getElementById("dev-playthrough-note")).toBeNull();
  });
});
