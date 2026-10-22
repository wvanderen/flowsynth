// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { App } from "./app";
import { createAppFixture, setVisibility } from "./testing/app-fixture";
import { STORAGE_KEY, serialize } from "../engine/save";
import { assertFocusScenario, createFocusScenarioState } from "../engine/focus-scenario";
import { SCENARIOS } from "../engine/scenarios";
import { createInitialState } from "../engine/state";
import { addPracticeLog, createHabit } from "../engine/habits";
import { activeGoalOf, deleteGoal } from "../engine/goals";

// The playtesting suite's launch boundary (issue #467, parent #465): the
// suite entry and the launch command the dev panel and agent access share.
// Every launch asserts its candidate before installation, detaches the tab
// onto a private in-memory slot before any write (ADR-0077), rebuilds on
// repeat launch, and cannot be displaced by shared-save recovery — the
// Focus scenario's prior guarantees (#456) generalized to the catalog, the
// fresh start included. Each install stamps the real wall clock — the
// Focus goal's occurrence is the current day — so each case anchors one
// captured stamp and compares against a fresh build of the same stamp.
const fixture = createAppFixture();
const boot = fixture.boot;

let app: App;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => fixture.release());

const status = (): string => document.getElementById("status")?.textContent ?? "";

// The prior-save boot the isolation cases share: an ordinary save with
// 500ν on the slot, then a dev boot over it.
function seedOrdinaryAndBoot(t: number): number {
  const prior = createInitialState();
  prior.nous = 500;
  localStorage.setItem(STORAGE_KEY, serialize(prior, t - 60_000));
  app = boot(undefined, true);
  return prior.nous;
}

describe("the suite's catalog", () => {
  it("declares the fresh start and the Focus setup with their situations and origins", () => {
    app = boot(undefined, true);
    expect(app.devScenarios().map((scenario) => scenario.id)).toEqual(["fresh-start", "focus"]);
    const fresh = app.devScenarios()[0]!;
    expect(fresh.name).toBe("Fresh start");
    expect(fresh.origin).toBe("initial state");
    expect(fresh.situation).toContain("opening board");
    const focus = app.devScenarios()[1]!;
    expect(focus.name).toBe("Focus");
    expect(focus.origin).toBe("constructed fixture");
    expect(focus.situation).toContain("session preparation");
    expect(SCENARIOS).toBe(app.devScenarios());
  });
});

describe("the launch command", () => {
  it("rejects a failing candidate before changing state or the save destination", () => {
    const t = Date.now();
    seedOrdinaryAndBoot(t);
    const state = app.state;
    const ordinary = localStorage.getItem(STORAGE_KEY)!;
    const fresh = SCENARIOS[0]!;
    const assertion = vi.spyOn(fresh, "assert").mockImplementation(() => {
      throw new Error("rejected candidate");
    });
    try {
      expect(() => app.devLaunchScenario("fresh-start", t)).toThrow("rejected candidate");
      expect(app.state).toBe(state);
      expect(app.devScenarioId).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY)).toBe(ordinary);
      app.state.nous = 501;
      app.save(t + 1000, true);
      expect(boot(undefined, true).state.nous).toBe(501);
    } finally {
      assertion.mockRestore();
    }

    app = boot(undefined, true);
    app.devLaunchScenario("focus", t);
    const installed = app.state;
    const bytes = localStorage.getItem(STORAGE_KEY);
    const failed = vi.spyOn(fresh, "assert").mockImplementation(() => {
      throw new Error("rejected candidate");
    });
    try {
      expect(() => app.devLaunchScenario("fresh-start", t)).toThrow("rejected candidate");
      expect(app.state).toBe(installed);
      expect(app.devScenarioId).toBe("focus");
      app.state.nous += 1;
      app.save(t + 2000, true);
      window.dispatchEvent(new Event("beforeunload"));
      expect(localStorage.getItem(STORAGE_KEY)).toBe(bytes);
    } finally {
      failed.mockRestore();
    }
  });

  it("launching fresh start installs the shipped opening state and leaves the ordinary save untouched", () => {
    const t = Date.now();
    seedOrdinaryAndBoot(t);
    const ordinary = localStorage.getItem(STORAGE_KEY)!;

    app.devLaunchScenario("fresh-start", t);
    expect(app.state).toEqual(createInitialState());
    expect(app.devScenarioId).toBe("fresh-start");
    // The launch declares its situation and origin in the standing note.
    expect(app.devScenarioNote).toContain("Fresh start ✓");
    expect(app.devScenarioNote).toContain("the shipped opening board");
    expect(app.devScenarioNote).toContain("initial state");
    expect(app.devScenarioNote).toContain("isolated save");
    expect(status()).toContain("Fresh start installed in an isolated save");

    // Every later write — an explicit save, drift, the unload save —
    // lands in the private slot; the ordinary save is never touched.
    app.state.nous += 1;
    app.save();
    window.dispatchEvent(new Event("beforeunload"));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(ordinary);

    // The scenario never reached the slot, so a reload returns to the
    // ordinary save.
    const revived = boot(undefined, true);
    expect(revived.state.nous).toBe(500);
    expect(revived.state.habits).toHaveLength(0);
  });

  it("launching Focus through the same boundary keeps the prior guarantees (#456)", () => {
    const t = Date.now();
    seedOrdinaryAndBoot(t);
    const ordinary = localStorage.getItem(STORAGE_KEY)!;

    app.devLaunchScenario("focus", t);
    assertFocusScenario(app.state);
    expect(app.state).toEqual(createFocusScenarioState(t));
    expect(app.devScenarioNote).toContain("Focus ✓");
    expect(app.devScenarioNote).toContain("session preparation with class development");
    expect(app.devScenarioNote).toContain("constructed fixture");
    expect(app.devScenarioNote).toContain("isolated save");

    app.state.nous += 1;
    app.save();
    window.dispatchEvent(new Event("beforeunload"));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(ordinary);

    const revived = boot(undefined, true);
    expect(revived.state.nous).toBe(500);
    expect(revived.state.habits).toHaveLength(0);
  });

  it("launching from a boot with no prior save claims nothing else", () => {
    const t = Date.now();
    app = boot(undefined, true);
    // The boot itself saved the opening state; that is the ordinary save
    // the launch must leave standing.
    const ordinary = localStorage.getItem(STORAGE_KEY)!;
    app.devLaunchScenario("fresh-start", t);
    expect(app.state).toEqual(createInitialState());
    // The install writes only the private slot — the ordinary save keeps
    // its boot-time bytes.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(ordinary);
  });

  it("repeating a launch rebuilds the setup without accumulating, either scenario", () => {
    const t = Date.now();
    app = boot(undefined, true);
    for (const id of ["fresh-start", "focus"] as const) {
      app.devLaunchScenario(id, t);
      app.devNous();
      createHabit(app.state, "Sketching");
      addPracticeLog(app.state, app.state.habits[0]!.id, 10, t);
      expect(app.state.habits).toHaveLength(id === "focus" ? 2 : 1);

      app.devLaunchScenario(id, t);
      expect(app.state).toEqual(id === "focus" ? createFocusScenarioState(t) : createInitialState());
      expect(app.devScenarioNote).toContain("✓");
      expect(document.querySelector("#dev-scenario-note")?.textContent).toContain("✓");
    }
  });

  it("an unknown scenario id refuses by name and leaves the installed scenario standing", () => {
    const t = Date.now();
    app = boot(undefined, true);
    const before = structuredClone(app.state);
    const slotBefore = localStorage.getItem(STORAGE_KEY);

    app.devLaunchScenario("focus", t);
    app.devLaunchScenario("speedrun", t);

    expect(status()).toBe('Dev: no scenario "speedrun" — the suite offers fresh-start, focus.');
    // The refused candidate never installed: the Focus setup stays the
    // active scenario, its note and its assertion intact.
    expect(app.devScenarioId).toBe("focus");
    expect(app.devScenarioNote).toContain("Focus ✓");
    expect(() => app.devScenarioAssert(t)).not.toThrow();
    expect(app.state).not.toEqual(before);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(slotBefore);

    // An unknown id on a scenario-free boot touches nothing at all.
    const fresh = boot(undefined, true);
    const untouched = structuredClone(fresh.state);
    fresh.devLaunchScenario("speedrun", t);
    expect(fresh.state).toEqual(untouched);
    expect(fresh.devScenarioId).toBeNull();
    expect(fresh.devScenarioNote).toBeNull();
  });

  it("is dev-gated: a normal instrument ignores the boundary", () => {
    app = boot(undefined, false);
    const before = app.state;
    app.devLaunchScenario("focus", Date.now());
    app.devScenarioAssert();
    expect(app.state).toBe(before);
    expect(app.devScenarioId).toBeNull();
    expect(app.devScenarioNote).toBeNull();
  });
});

describe("isolation against recovery", () => {
  it("shared-save recovery cannot replace a launched scenario with unrelated state", () => {
    const t = Date.now();
    app = boot(undefined, true);
    const intruder = createInitialState();
    // Control: before the launch, the storage-event recovery adopts a
    // newer unrelated save — the path is live in this tab.
    localStorage.setItem(STORAGE_KEY, serialize({ ...intruder, nous: 777 }, t + 60_000));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    expect(app.state.nous).toBe(777);

    app.devLaunchScenario("fresh-start", t);
    // The same intrusion, newer still, announces through the same event:
    // the tab reads only its private slot now, and the scenario stands.
    localStorage.setItem(STORAGE_KEY, serialize({ ...intruder, nous: 999 }, t + 120_000));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    expect(app.state).toEqual(createInitialState());
    expect(app.state.nous).not.toBe(999);

    // The visible-return door runs the same recovery and finds nothing.
    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(app.state).toEqual(createInitialState());

    // The Focus setup rides the same isolation.
    app.devLaunchScenario("focus", t);
    localStorage.setItem(STORAGE_KEY, serialize({ ...intruder, nous: 555 }, t + 180_000));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(app.state).toEqual(createFocusScenarioState(t));
  });
});

describe("the active scenario's assertion", () => {
  it("fails clearly when the setup drifts, and relaunch restores it", () => {
    const t = Date.now();
    app = boot(undefined, true);
    app.devLaunchScenario("focus", t);
    deleteGoal(app.state, activeGoalOf(app.state, app.state.habits[0]!.id)!.id);
    expect(() => app.devScenarioAssert(t)).toThrowError(/Focus scenario: expected the active goal/);
    expect(app.devScenarioNote).toContain("Focus ✗");
    expect(app.devScenarioNote).toContain("expected the active goal");
    expect(document.querySelector("#dev-scenario-note")?.textContent).toContain("Focus ✗");

    app.devLaunchScenario("focus", t);
    expect(() => app.devScenarioAssert(t)).not.toThrow();
    expect(app.devScenarioNote).toContain("Focus ✓");
    expect(document.querySelector("#dev-scenario-note")?.textContent).toContain("Focus ✓");
  });

  it("asserts a fresh start by its own named facts", () => {
    const t = Date.now();
    app = boot(undefined, true);
    app.devLaunchScenario("fresh-start", t);
    expect(() => app.devScenarioAssert(t)).not.toThrow();
    expect(app.devScenarioNote).toContain("Fresh start ✓");

    app.state.prestiges = 1;
    expect(() => app.devScenarioAssert(t)).toThrowError(/Fresh start: expected the first era/);
  });

  it("without a launch it names the missing scenario", () => {
    app = boot(undefined, true);
    app.devScenarioAssert();
    expect(status()).toBe("Dev: no scenario installed — launch one from the suite first.");
  });
});

describe("the dev panel's suite entry", () => {
  it("drives the same launch command the app method is", () => {
    app = boot(undefined, true);
    const select = document.getElementById("dev-scenario") as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect([...select.options].map((option) => option.value)).toEqual(["fresh-start", "focus"]);
    expect(select.options[0]!.hasAttribute("title")).toBe(false);
    expect(select.options[0]!.textContent).toBe("Fresh start");

    select.value = "fresh-start";
    document.querySelector<HTMLButtonElement>('[data-dev="scenario"]')!.click();
    expect(app.state).toEqual(createInitialState());
    expect(app.devScenarioId).toBe("fresh-start");
    expect(document.querySelector("#dev-scenario-note")?.textContent).toContain("Fresh start ✓");

    // The active scenario's option carries the selected marker after a
    // launch, whoever drove it. Controls retain their nodes across renders.
    const relaunched = document.getElementById("dev-scenario") as HTMLSelectElement;
    expect(relaunched.value).toBe("fresh-start");
    relaunched.value = "focus";
    document.querySelector<HTMLButtonElement>('[data-dev="scenario"]')!.click();
    assertFocusScenario(app.state);
  });

  it.each(["flow", "breather"] as const)("keeps pending selection and focus through %s ticks", (mode) => {
    app = boot(undefined, true);
    app.devLaunchScenario("focus");
    app.beginFlowFromPlan();
    app.state.mode = mode;
    const select = document.getElementById("dev-scenario") as HTMLSelectElement;
    select.value = "fresh-start";
    select.focus();
    app.tick();
    expect(document.getElementById("dev-scenario")).toBe(select);
    expect(document.activeElement).toBe(select);
    expect(select.value).toBe("fresh-start");
    document.querySelector<HTMLButtonElement>('[data-dev="scenario"]')!.click();
    expect(app.devScenarioId).toBe("fresh-start");
    expect(app.state).toEqual(createInitialState());
  });

  it("is absent on a normal instrument", () => {
    app = boot(undefined, false);
    expect(document.getElementById("dev-scenario")).toBeNull();
    expect(document.querySelector('[data-dev="scenario"]')).toBeNull();
  });
});
