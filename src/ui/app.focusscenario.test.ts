// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { createAppFixture, setVisibility } from "./testing/app-fixture";
import { STORAGE_KEY, serialize } from "../engine/save";
import { assertFocusScenario, createFocusScenarioState } from "../engine/focus-scenario";
import { createInitialState } from "../engine/state";
import { addPracticeLog, createHabit } from "../engine/habits";
import { activeGoalOf, deleteGoal } from "../engine/goals";

// The Focus evidence scenario's app seam (issue #456): the install
// detaches the tab from the player's save before it writes, repeats
// without accumulating, and cannot be displaced by shared-save recovery.
// The install stamps the scenario with the real wall clock — the goal's
// occurrence is the current day, and the tick rolls against the real
// clock — so each case anchors one captured stamp and compares against a
// fresh build of the same stamp.
const fixture = createAppFixture();
const boot = fixture.boot;

let app: App;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => fixture.release());

describe("the Focus evidence scenario install", () => {
  it("produces the intended state from an arbitrary prior save and leaves that save untouched", () => {
    const t = Date.now();
    const prior = createInitialState();
    prior.nous = 500;
    localStorage.setItem(STORAGE_KEY, serialize(prior, t - 60_000));
    app = boot(undefined, true);
    const ordinary = localStorage.getItem(STORAGE_KEY)!;
    expect(app.state.nous).toBe(500);

    app.devFocusScenario(t);
    assertFocusScenario(app.state);
    expect(app.state).toEqual(createFocusScenarioState(t));

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

  it("repeating the setup rebuilds the scenario without accumulating", () => {
    const t = Date.now();
    app = boot(undefined, true);
    app.devFocusScenario(t);
    app.devNous();
    createHabit(app.state, "Sketching");
    addPracticeLog(app.state, app.state.habits[0]!.id, 10, t);
    expect(app.state.habits).toHaveLength(2);

    app.devFocusScenario(t);
    expect(app.state).toEqual(createFocusScenarioState(t));
    assertFocusScenario(app.state);
    expect(document.querySelector("#dev-focus-note")?.textContent).toContain("focus ✓");
  });

  it("shared-save recovery cannot replace the scenario with unrelated state", () => {
    const t = Date.now();
    app = boot(undefined, true);
    const intruder = createInitialState();
    // Control: before the install, the storage-event recovery adopts a
    // newer unrelated save — the path is live in this tab.
    localStorage.setItem(STORAGE_KEY, serialize({ ...intruder, nous: 777 }, t + 60_000));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    expect(app.state.nous).toBe(777);

    app.devFocusScenario(t);
    // The same intrusion, newer still, announces through the same event:
    // the tab reads only its private slot now, and the scenario stands.
    localStorage.setItem(STORAGE_KEY, serialize({ ...intruder, nous: 999 }, t + 120_000));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    expect(app.state).toEqual(createFocusScenarioState(t));
    expect(app.state.nous).not.toBe(999);

    // The visible-return door runs the same recovery and finds nothing.
    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(app.state).toEqual(createFocusScenarioState(t));
  });

  it("assertions fail clearly when the setup drifts, and reinstall restores it", () => {
    const t = Date.now();
    app = boot(undefined, true);
    app.devFocusScenario(t);
    deleteGoal(app.state, activeGoalOf(app.state, app.state.habits[0]!.id)!.id);
    expect(() => app.devFocusScenarioAssert()).toThrowError(/Focus scenario: expected the active goal/);
    expect(document.querySelector("#dev-focus-note")?.textContent).toContain("focus ✗");

    app.devFocusScenario(t);
    expect(() => app.devFocusScenarioAssert()).not.toThrow();
    expect(document.querySelector("#dev-focus-note")?.textContent).toContain("focus ✓");
  });

  it("is dev-gated: a normal instrument ignores the setup", () => {
    app = boot(undefined, false);
    const before = app.state;
    app.devFocusScenario(Date.now());
    expect(app.state).toBe(before);
    expect(app.devFocusScenarioNote).toBeNull();
  });
});
