// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { App } from "./app";
import { APPROACHING_PRESTIGE_RECIPE } from "../engine/playthrough";
import { scenarioOf } from "../engine/scenarios";
import { STORAGE_KEY } from "../engine/save";
import { createAppFixture } from "./testing/app-fixture";

// The experiment boundary (issue #472, parent stories 30–33): terminal
// inspection and game-action commands on the installed run, shared by the
// panel's controls, the panel's terminal, and agent access — the same
// contracts, validation, outcomes, and errors. Real prerequisites and mode
// restrictions ride the engine's own actions; interventions are recorded
// verbatim and mark the run modified without rewriting its baseline; and
// nothing here — action, grant, or override — ever reaches the ordinary
// save.

const fixture = createAppFixture();
const boot = fixture.boot;

let app: App;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => { fixture.release(); vi.restoreAllMocks(); });

const scenarioNote = (): string => document.getElementById("dev-scenario-note")?.textContent ?? "";
const terminalLog = (): string[] =>
  [...document.querySelectorAll("#dev-terminal-log .dev-terminal-line")].map((row) => row.textContent ?? "");

describe("the development gate", () => {
  it("refuses the experiment commands outside dev mode", () => {
    app = boot(undefined, false);
    expect(() => app.devInspect()).toThrow(/development commands/);
    expect(() => app.devActionStartSession(25)).toThrow(/development commands/);
    expect(() => app.devActionPrestige()).toThrow(/development commands/);
    expect(() => app.devTerminalRun("inspect")).toThrow(/development surface/);
    expect(document.getElementById("dev-terminal")).toBeNull();
  });

  it("refuses game actions without an installed run — the ordinary save is not an experiment", () => {
    app = boot(undefined, true);
    const saved = localStorage.getItem(STORAGE_KEY);
    expect(() => app.devActionStartSession(25)).toThrow(/ordinary save is not an experiment/);
    expect(() => app.devActionAdvance(60)).toThrow(/ordinary save is not an experiment/);
    expect(() => app.devActionPrestige()).toThrow(/ordinary save is not an experiment/);
    expect(app.devTerminalRun("start 25")).toMatch(/✗.*ordinary save is not an experiment/);
    // The refusals wrote nothing anywhere.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
    expect(app.devScenarioModified).toBe(false);
  });
});

describe("inspection", () => {
  it("reads the installed run's figures and names its identity and modified state", () => {
    app = boot(undefined, true);
    void app.devLaunchScenario("fresh-start");
    const read = app.devInspect();
    expect(read.scenario).toBe("fresh-start");
    expect(read.modified).toBe(false);
    expect(read.mode).toBe("upgrade");
    expect(read.balances.nous).toBe(12);
    expect(read.balances.cells).toBe(3);
    expect(read.balances.tray).toBe(0);
    expect(read.balances.prestiges).toBe(0);
    expect(read.session).toBeNull();
    expect(read.horizonReached).toBe(false);
    // The terminal's inspect line carries the same figures — one read,
    // every reader.
    const out = app.devTerminalRun("inspect");
    expect(out).toContain("fresh-start");
    expect(out).toContain("mode upgrade");
    expect(out).toContain("nous 12ν");
    expect(out).toContain("door closed");
    expect(terminalLog().at(-1)).toBe(out);
  });
});

describe("game actions and interventions", () => {
  it("performs real engine actions, records their outcomes, and marks the run modified", () => {
    app = boot(undefined, true);
    void app.devLaunchScenario("fresh-start");
    const launchNote = scenarioNote();
    expect(launchNote).toContain("✓");

    const started = app.devActionStartSession(25);
    expect(started.ok).toBe(true);
    expect(app.state.mode).toBe("flow");
    expect(app.devScenarioModified).toBe(true);
    expect(app.devInterventions).toHaveLength(1);
    expect(app.devInterventions[0]).toMatchObject({ label: "Start a 25-minute session", ok: true });
    // The note carries the launch's own ✓ line — the untouched baseline —
    // plus the modified mark.
    expect(scenarioNote()).toContain(launchNote);
    expect(scenarioNote()).toContain("modified — 1 intervention");

    // A second start rides the engine's own refusal, verbatim.
    const again = app.devActionStartSession(25);
    expect(again.ok).toBe(false);
    expect(again.reason).toBe("A session is already running.");
    expect(app.devInterventions[1]).toMatchObject({ ok: false, reason: "A session is already running." });

    // The clock is a flow tool here, as on the panel buttons.
    const advanced = app.devActionAdvance(60);
    expect(advanced.ok).toBe(true);
    expect(app.state.session?.elapsed).toBe(60);

    // Purchases keep their between-sessions lock; prestige keeps its
    // horizon prerequisite — the engine's reasons, recorded verbatim.
    const buy = app.devActionBuyShelf("generator");
    expect(buy.ok).toBe(false);
    expect(buy.reason).toBe("Purchases happen between sessions.");
    expect(app.devActionEndSession().ok).toBe(true);
    const prestige = app.devActionPrestige();
    expect(prestige.ok).toBe(false);
    expect(prestige.reason).toBe("The horizon is not reached yet.");
    expect(app.devInterventions.some((row) => row.reason === "The horizon is not reached yet.")).toBe(true);
    expect(app.devInterventions).toHaveLength(6);
    expect(app.devScenarioModified).toBe(true);
  });

  it("marks the run modified only by interventions that landed — refusals record without the mark", () => {
    app = boot(undefined, true);
    void app.devLaunchScenario("fresh-start");
    // The prestige refusal is recorded with the engine's own reason, but
    // nothing changed — the run still reads as baseline evidence.
    const refused = app.devActionPrestige();
    expect(refused.ok).toBe(false);
    expect(refused.reason).toBe("The horizon is not reached yet.");
    expect(app.devInterventions).toHaveLength(1);
    expect(app.devScenarioModified).toBe(false);
    expect(scenarioNote()).not.toContain("modified");
  });

  it("keeps the baseline recipe untouched and rebuilds clean on relaunch", () => {
    app = boot(undefined, true);
    void app.devLaunchScenario("fresh-start");
    app.devActionStartSession(25);
    app.devNous();
    expect(app.devScenarioModified).toBe(true);
    expect(app.devInterventions).toHaveLength(2);
    // The declared recipes are the scenarios' own reachability evidence —
    // the boundary has no path that rewrites one.
    expect(scenarioOf("approaching-prestige")!.recipe).toEqual(APPROACHING_PRESTIGE_RECIPE);
    expect(app.devPlaythroughRecipe().overrides).toEqual({});

    // A relaunch rebuilds from nothing: the interventions do not
    // accumulate and the modified mark resets with the state they altered.
    void app.devLaunchScenario("fresh-start");
    expect(app.devScenarioModified).toBe(false);
    expect(app.devInterventions).toHaveLength(0);
    expect(scenarioNote()).not.toContain("modified");
  });

  it("records the quick grants as interventions on a run, and never on the ordinary save", () => {
    app = boot(undefined, true);
    // No run installed: the quick grants stay the live-save tier, no
    // record — and that tier may write the ordinary save, as ever.
    app.devNous();
    const saved = localStorage.getItem(STORAGE_KEY);
    expect(app.devScenarioModified).toBe(false);
    expect(app.devInterventions).toHaveLength(0);

    void app.devLaunchScenario("fresh-start");
    app.devNous();
    // The dev clock rides flow, as on the panel buttons.
    app.devActionStartSession(25);
    app.devAdvance(30);
    expect(app.devScenarioModified).toBe(true);
    expect(app.devInterventions.map((row) => row.label)).toEqual([
      "Dev grant — +100ν",
      "Start a 25-minute session",
      "Dev clock +30s",
    ]);
    // Every mutation landed in the isolated memory store; the ordinary
    // save's bytes are exactly what they were.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
  });
});

describe("terminal commands", () => {
  it("plays a session loop through the same commands agents call", () => {
    app = boot(undefined, true);
    void app.devLaunchScenario("fresh-start");
    expect(app.devTerminalRun("start 25")).toMatch(/^✓/);
    expect(app.state.mode).toBe("flow");
    expect(app.devTerminalRun("advance 1500")).toMatch(/^✓/);
    expect(app.devTerminalRun("end")).toMatch(/^✓/);
    expect(app.state.mode).toBe("upgrade");
    expect(app.state.sessionsCompleted).toBe(1);
    // The engine's refusals read as named ✗ lines, in the log.
    expect(app.devTerminalRun("start 25")).toMatch(/^✓/);
    const clash = app.devTerminalRun("start 10");
    expect(clash).toBe("✗ A session is already running.");
    expect(terminalLog().at(-1)).toBe(clash);
    // The intervention record owns what the terminal did, exactly once
    // per command.
    expect(app.devInterventions.map((row) => row.label)).toEqual([
      "Start a 25-minute session",
      "Dev clock +1500s",
      "End the session",
      "Start a 25-minute session",
      "Start a 10-minute session",
    ]);
  });

  it("lists its commands, the scenarios, and the declared tuning", () => {
    app = boot(undefined, true);
    expect(app.devTerminalRun("help")).toContain("commands:");
    expect(app.devTerminalRun("scenarios")).toContain("fresh-start — Fresh start");
    expect(app.devTerminalRun("scenarios")).toContain("world-enemy — World enemy");
    const tuning = app.devTerminalRun("tuning");
    expect(tuning).toContain("openingGrant 0–120 (default 12)");
    expect(tuning).toContain("claimBase 1–36 (default 2)");
  });

  it("buys, places, and upgrades through the engine's own gates", () => {
    app = boot(undefined, true);
    void app.devLaunchScenario("fresh-start");
    // The shipped 12ν cannot afford the shelf; the refusal is the
    // engine's own line.
    expect(app.devTerminalRun("buy generator")).toBe("✗ Not enough whole nous.");
    // The grants ride the terminal too, then the purchase lands.
    expect(app.devTerminalRun("grant nous")).toMatch(/^✓/);
    expect(app.devTerminalRun("buy generator")).toMatch(/^✓/);
    const tray = app.devInspect().trayModules;
    expect(tray).toHaveLength(1);
    const id = tray[0]!.id;
    expect(app.devTerminalRun(`place ${id} 1 0`)).toMatch(/^✓/);
    expect(app.devInspect().balances.tray).toBe(0);
    expect(app.devTerminalRun(`levels ${id} 2`)).toMatch(/^✓/);
    expect(app.state.modules.find((module) => module.id === id)!.level).toBe(2);
    // A bad cell is the engine's named refusal, not a crash.
    expect(app.devTerminalRun("cell 9 9")).toBe("✗ New cells must touch the board.");
  });

  it("rejects unknown commands and malformed input by name", () => {
    app = boot(undefined, true);
    expect(app.devTerminalRun("prestige now")).toMatch(/✗.*ordinary save is not an experiment/);
    expect(app.devTerminalRun("teleport")).toBe("✗ unknown command \"teleport\" — try help.");
    expect(app.devTerminalRun("run seed=abc days=1")).toBe("✗ Playthrough recipe: seed must be a whole number 0–4294967295 — found NaN.");
    expect(app.devTerminalRun("run nope")).toBe("✗ run reads key=value pairs — found \"nope\".");
    expect(app.devTerminalRun("start")).toBe("✗ start needs minutes or `open`.");
    expect(app.devTerminalRun("start 0")).toBe("✗ minutes must be a whole number 1–600, or null for an open session.");
    expect(app.devTerminalRun("advance nope")).toBe("✗ seconds must be a positive number up to 172800 (two days).");
  });
});

describe("human and agent parity", () => {
  it("runs the same tuned playthrough from the terminal, the panel inputs, and the agent command", () => {
    app = boot(undefined, true);
    // The agent command is the contract; the terminal's `run` and the
    // panel's tuning inputs compose through the same method.
    const agent = app.devRunPlaythrough({ seed: 9, budgetDays: 1, overrides: { openingGrant: 100 } });
    const terminal = app.devTerminalRun("run seed=9 days=1 openingGrant=100");
    expect(terminal).toBe(app.devPlaythroughNote);
    expect(app.devPlaythrough!.runId).toBe(agent.runId);

    const seedField = document.getElementById("dev-playthrough-seed") as HTMLInputElement;
    const budgetField = document.getElementById("dev-playthrough-budget") as HTMLInputElement;
    const openingField = document.getElementById("dev-tuning-openingGrant") as HTMLInputElement;
    seedField.value = "9";
    budgetField.value = "1";
    openingField.value = "100";
    document.querySelector<HTMLButtonElement>('[data-dev="playthrough"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.devPlaythrough!.runId).toBe(agent.runId);
    expect(app.devPlaythroughNote).toContain("tuned openingGrant=100");
    // The invalid override reads the same ✗ through every door.
    openingField.value = "999";
    expect(() => document.querySelector<HTMLButtonElement>('[data-dev="playthrough"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }))).toThrow(/must be a whole number 0–120/);
    expect(app.devTerminalRun("run seed=9 days=1 openingGrant=999")).toBe(
      "✗ Playthrough recipe: override \"openingGrant\" must be a whole number 0–120 — found 999.");
  });
});

describe("visual and terminal intervention parity", () => {
  it("records visual session actions and purchases without rewriting the baseline or ordinary save", () => {
    app = boot(undefined, true);
    const saved = localStorage.getItem(STORAGE_KEY);
    void app.devLaunchScenario("fresh-start");
    app.beginFlow(null);
    expect(app.devScenarioModified).toBe(true);
    expect(app.devInterventions).toHaveLength(1);
    app.pause();
    app.resume();
    app.endFlow();
    app.upgradeLevels(app.state.modules[0]!.id, 1);
    expect(app.devInterventions).toHaveLength(5);
    expect(app.devInterventions.every((entry) => entry.ok)).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
    void app.devLaunchScenario("fresh-start");
    expect(app.devScenarioModified).toBe(false);
    expect(app.devInterventions).toEqual([]);
  });

  it("offers pause, resume, honesty, and World actions with real engine outcomes", () => {
    app = boot(undefined, true);
    void app.devLaunchScenario("fresh-start");
    expect(app.devTerminalRun("start 25")).toMatch(/^✓/);
    expect(app.devTerminalRun("pause")).toMatch(/^✓/);
    expect(app.state.mode).toBe("paused");
    expect(app.devTerminalRun("resume")).toMatch(/^✓/);
    expect(app.state.mode).toBe("flow");
    app.state.session!.accounting.poolSeconds = 60;
    expect(app.devTerminalRun("end")).toMatch(/^✗/);
    expect(app.devTerminalRun("honesty full")).toMatch(/^✓/);
    expect(app.state.session!.accounting.poolSeconds).toBe(0);
    expect(app.devTerminalRun("end")).toMatch(/^✓/);
    expect(app.devTerminalRun("world-buy")).toMatch(/^✗/);
    expect(app.devTerminalRun("world-place missing 0 0")).toMatch(/^✗/);
    expect(app.devTerminalRun("world-retrieve missing")).toMatch(/^✗/);
    expect(app.devTerminalRun("world-hone invalid")).toMatch(/✗.*chargeBlade/);
  });

  it("keeps tuning names visible after values are entered", () => {
    app = boot(undefined, true);
    const input = document.getElementById("dev-tuning-openingGrant") as HTMLInputElement;
    input.value = "60";
    expect(input.labels?.[0]?.textContent).toContain("Opening grant");
  });
});

describe("declared game-action catalog", () => {
  it("validates data arguments before mutation and exposes the remaining workspace actions", () => {
    app = boot(undefined, true);
    void app.devLaunchScenario("fresh-start");
    expect(app.devTerminalRun('action createHabit ["Violin"]')).toMatch(/^✓/);
    const habit = app.state.habits.find((h) => h.name === "Violin")!;
    expect(habit).toBeDefined();
    expect(app.devTerminalRun(`action selectHabit ["${habit.id}"]`)).toMatch(/^✓/);
    expect(app.state.activeHabitId).toBe(habit.id);
    const before = structuredClone(app.state);
    expect(app.devTerminalRun('action buyCell [{"q":0.5,"r":0}]')).toMatch(/✗.*whole number/);
    expect(app.devTerminalRun('action buyHoneRank ["unknown"]')).toMatch(/✗.*chargeBlade/);
    expect(app.devTerminalRun('action constructor []')).toMatch(/✗.*Unknown game action/);
    expect(app.state).toEqual(before);
    const id = app.state.modules[0]!.id;
    expect(app.devTerminalRun(`action upgradeModuleLevels ["${id}",1]`)).toMatch(/^✓/);
    expect(app.state.modules[0]!.level).toBe(1);
    expect(app.devInterventions.at(-1)).toMatchObject({ ok: true, label: `upgradeModuleLevels ["${id}",1]` });
    expect(app.devTerminalRun("actions")).toContain("chooseMutatorRoll");
    expect(app.devTerminalRun("actions")).toContain("buyCapacity");
  });

  it("records successful visual and terminal World actions with equivalent state", () => {
    app = boot(undefined, true);
    void app.devLaunchScenario("fresh-start");
    app.devWorldEra();
    const id = app.state.world.columns.find((c) => c.pos === null)!.id;
    expect(app.devTerminalRun(`world-place ${id} 0 0`)).toMatch(/^✓/);
    expect(app.state.world.columns.find((c) => c.id === id)!.pos).toEqual({ q: 0, r: 0 });
    app.worldRetrieve(id);
    expect(app.devInterventions.at(-1)).toMatchObject({ ok: true, label: "retrieveWorldOccupant" });
    expect(app.state.world.columns.find((c) => c.id === id)!.pos).toBeNull();
    expect(app.devTerminalRun("world-buy")).toMatch(/^✓/);
    expect(app.devTerminalRun("world-hone chargeBlade")).toMatch(/^✓/);
  });
});
