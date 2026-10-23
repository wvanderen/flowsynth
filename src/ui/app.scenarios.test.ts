// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { App } from "./app";
import { createAppFixture, setVisibility } from "./testing/app-fixture";
import { STORAGE_KEY, serialize } from "../engine/save";
import { assertFocusScenario, createFocusScenarioState } from "../engine/focus-scenario";
import { SCENARIOS, scenarioOf } from "../engine/scenarios";
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
// The progression presets (issue #471) ride the same boundary: their
// builds walk the declared recipes (memoized per engine source, so this
// file's first launches carry the walk cost and every later one clones).
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
  it("declares the openings, the progression presets, and the Focus setup with their situations and origins", () => {
    app = boot(undefined, true);
    expect(app.devScenarios().map((scenario) => scenario.id)).toEqual([
      "fresh-start",
      "approaching-prestige",
      "after-first-bank",
      "world-enemy",
      "focus",
    ]);
    const fresh = app.devScenarios()[0]!;
    expect(fresh.name).toBe("Fresh start");
    expect(fresh.origin).toBe("initial state");
    expect(fresh.situation).toContain("opening board");
    // The progression presets (#471): recipe checkpoints, each carrying
    // its declared recipe as the reachability evidence.
    const approaching = app.devScenarios()[1]!;
    expect(approaching.name).toBe("Approaching prestige");
    expect(approaching.origin).toBe("recipe checkpoint");
    expect(approaching.situation).toContain("first prestige door open");
    expect(approaching.recipe).toMatchObject({ scenarioId: "fresh-start", policyId: "prompt", seed: 468 });
    const bank = app.devScenarios()[2]!;
    expect(bank.name).toBe("After first bank");
    expect(bank.origin).toBe("recipe checkpoint");
    expect(bank.situation).toContain("earned Arete unspent");
    expect(bank.recipe).toMatchObject({ policyId: "pushing", claimTarget: 2 });
    const enemy = app.devScenarios()[3]!;
    expect(enemy.name).toBe("World enemy");
    expect(enemy.origin).toBe("recipe checkpoint");
    expect(enemy.situation).toContain("placement decision unplayed");
    expect(enemy.recipe).toMatchObject({ policyId: "pushing", claimTarget: 2 });
    const focus = app.devScenarios()[4]!;
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

  // The progression presets (issue #471): the walked situations install
  // through the same boundary with the same guarantees. This case carries
  // the walks — the first launches of this file pay the declared recipes'
  // cost, the memo makes every later launch a clone.
  it("launching the progression presets installs each walked situation in an isolated save", { timeout: 240_000 }, async () => {
    const t = Date.now();
    seedOrdinaryAndBoot(t);
    const ordinary = localStorage.getItem(STORAGE_KEY)!;

    const before = app.state;
    let installed = false;
    const launch = Promise.resolve(app.devLaunchScenario("approaching-prestige", t)).then(() => { installed = true; });
    expect(app.devScenarioNote).toContain("preparing");
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(installed).toBe(false);
    expect(app.state).toBe(before);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(ordinary);
    await launch;
    expect(app.devScenarioId).toBe("approaching-prestige");
    expect(app.state.prestiges).toBe(0);
    expect(app.state.arete).toBe(0);
    expect(app.devScenarioNote).toContain("Approaching prestige ✓");
    expect(app.devScenarioNote).toContain("first prestige door open");
    expect(app.devScenarioNote).toContain("recipe checkpoint · isolated save");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(ordinary);

    await app.devLaunchScenario("after-first-bank", t);
    expect(app.devScenarioId).toBe("after-first-bank");
    expect(app.state.prestiges).toBe(1);
    expect(app.state.arete).toBe(2);
    expect(app.state.eraEarned).toBe(0);
    expect(app.devScenarioNote).toContain("After first bank ✓");
    expect(app.devScenarioNote).toContain("earned Arete unspent");
    expect(app.devScenarioNote).toContain("recipe checkpoint · isolated save");

    await app.devLaunchScenario("world-enemy", t);
    expect(app.devScenarioId).toBe("world-enemy");
    const living = Object.values(app.state.world.enemies).filter((enemy) => enemy.discovered && enemy.hp > 0);
    expect(living.length).toBeGreaterThanOrEqual(1);
    expect(app.state.world.weapons.some((weapon) => weapon.pos === null)).toBe(true);
    expect(app.state.arete).toBe(0);
    expect(app.devScenarioNote).toContain("World enemy ✓");
    expect(app.devScenarioNote).toContain("placement decision unplayed");
    expect(app.devScenarioNote).toContain("recipe checkpoint · isolated save");

    // Every launch is inspectable and its assertions re-run clean on
    // demand.
    expect(() => app.devScenarioAssert(t)).not.toThrow();

    // The walked states never reached the ordinary slot.
    app.state.arete = 1;
    app.save();
    window.dispatchEvent(new Event("beforeunload"));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(ordinary);
    const revived = boot(undefined, true);
    expect(revived.state.nous).toBe(500);
  });

  it("repeating a progression launch rebuilds the walked setup without accumulating", { timeout: 240_000 }, async () => {
    const t = Date.now();
    app = boot(undefined, true);
    for (const id of ["fresh-start", "after-first-bank", "world-enemy"] as const) {
      await app.devLaunchScenario(id, t);
      // The walked states already carry the recipe's own practice habit;
      // fresh start carries none.
      const lived = app.state.habits.length;
      app.devNous();
      createHabit(app.state, "Sketching");
      addPracticeLog(app.state, app.state.habits[0]!.id, 10, t);
      expect(app.state.habits).toHaveLength(lived + 1);

      await app.devLaunchScenario(id, t);
      expect(app.state).toEqual(scenarioOf(id)!.build(t));
      expect(app.devScenarioNote).toContain("✓");
      expect(document.querySelector("#dev-scenario-note")?.textContent).toContain("✓");
    }
  });

  it("a scripted run starts from a progression preset through the same run command", { timeout: 240_000 }, () => {
    app = boot(undefined, true);
    const before = app.state;
    const saved = localStorage.getItem(STORAGE_KEY);
    const record = app.devRunPlaythrough({ scenarioId: "after-first-bank", budgetDays: 1 });
    // The run's identity and its walked starting state: the run id names
    // the preset, and the record's state carries the first bank's era.
    expect(record.runId).toMatch(/^after-first-bank-s468-/);
    expect(record.recipe.scenarioId).toBe("after-first-bank");
    expect(record.state.prestiges).toBe(1);
    expect(app.devPlaythroughNote).toContain("after-first-bank");
    // The run never touched the live state or the save.
    expect(app.state).toBe(before);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
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

  it("repeating a launch rebuilds the setup without accumulating, either scenario", async () => {
    const t = Date.now();
    app = boot(undefined, true);
    for (const id of ["fresh-start", "focus"] as const) {
      await app.devLaunchScenario(id, t);
      app.devNous();
      createHabit(app.state, "Sketching");
      addPracticeLog(app.state, app.state.habits[0]!.id, 10, t);
      expect(app.state.habits).toHaveLength(id === "focus" ? 2 : 1);

      await app.devLaunchScenario(id, t);
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

    expect(status()).toBe(
      'Dev: no scenario "speedrun" — the suite offers fresh-start, approaching-prestige, after-first-bank, world-enemy, focus.',
    );
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

  it("a newer selection survives a pending preparation and its late failure", async () => {
    app = boot(undefined, true);
    const scenario = scenarioOf("after-first-bank")!;
    let reject!: (error: Error) => void;
    const prepare = vi.spyOn(scenario as Required<typeof scenario>, "prepare").mockImplementation(() => new Promise<void>((_, fail) => { reject = fail; }));
    try {
      const pending = app.devLaunchScenario("after-first-bank");
      app.devLaunchScenario("focus");
      reject(new Error("stale preparation"));
      await pending;
      expect(app.devScenarioId).toBe("focus");
      expect(app.devScenarioNote).toContain("Focus ✓");
    } finally { prepare.mockRestore(); }
  });

  it("a newer selection survives a successful pending preparation", async () => {
    app = boot(undefined, true);
    const scenario = scenarioOf("after-first-bank")!;
    let resolve!: () => void;
    const prepare = vi.spyOn(scenario as Required<typeof scenario>, "prepare").mockImplementation(() => new Promise<void>((done) => { resolve = done; }));
    const build = vi.spyOn(scenario, "build");
    try {
      const pending = app.devLaunchScenario("after-first-bank");
      app.devLaunchScenario("fresh-start");
      resolve();
      await pending;
      expect(build).not.toHaveBeenCalled();
      expect(app.devScenarioId).toBe("fresh-start");
      expect(app.state).toEqual(createInitialState());
    } finally { prepare.mockRestore(); build.mockRestore(); }
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

  it("asserts a walked preset by its own named facts, and relaunch restores it", { timeout: 240_000 }, async () => {
    const t = Date.now();
    app = boot(undefined, true);
    await app.devLaunchScenario("after-first-bank", t);
    expect(() => app.devScenarioAssert(t)).not.toThrow();
    expect(app.devScenarioNote).toContain("After first bank ✓");

    // The earned claim is the situation's defining figure: spend it and
    // the assertion names the drift.
    app.state.arete = 0;
    expect(() => app.devScenarioAssert(t)).toThrowError(/After first bank: expected the earned 2-Arete claim unspent/);
    expect(app.devScenarioNote).toContain("After first bank ✗");
    expect(document.querySelector("#dev-scenario-note")?.textContent).toContain("After first bank ✗");

    await app.devLaunchScenario("after-first-bank", t);
    expect(app.state.arete).toBe(2);
    expect(() => app.devScenarioAssert(t)).not.toThrow();
    expect(app.devScenarioNote).toContain("After first bank ✓");
  });

  it("without a launch it names the missing scenario", () => {
    app = boot(undefined, true);
    app.devScenarioAssert();
    expect(status()).toBe("Dev: no scenario installed — launch one from the suite first.");
  });
});

describe("the dev panel's suite entry", () => {
  it("drives the same launch command the app method is", async () => {
    app = boot(undefined, true);
    const select = document.getElementById("dev-scenario") as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect([...select.options].map((option) => option.value)).toEqual([
      "fresh-start",
      "approaching-prestige",
      "after-first-bank",
      "world-enemy",
      "focus",
    ]);
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

    // A walked preset drives through the same select and control — the
    // same launch command, the walked situation installed.
    relaunched.value = "after-first-bank";
    document.querySelector<HTMLButtonElement>('[data-dev="scenario"]')!.click();
    await vi.waitFor(() => expect(app.devScenarioId).toBe("after-first-bank"));
    expect(app.state.arete).toBe(2);
    expect(document.querySelector("#dev-scenario-note")?.textContent).toContain("After first bank ✓");
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
