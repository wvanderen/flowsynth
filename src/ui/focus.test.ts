// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { createHabit, selectHabit, addPracticeLog, archiveHabit } from "../engine/habits";
import { createGoal, accrueGoalProgress, editGoal, retainGoalChoice } from "../engine/goals";
import type { Goal } from "../engine/types";
import { endSession, pauseSession, startSession } from "../engine/actions";
import { advance } from "../engine/advance";
import { deserialize, serialize } from "../engine/save";
import { goalMeterOf, GOAL_METER_SEGMENTS } from "./focus";
import { createInitialState } from "../engine/state";
import v10MigrationFixture from "../engine/fixtures/saves/v10-migration.json";
import { createAppFixture, setVisibility } from "./testing/app-fixture";

// The Focus control sheet (ADR-0050, issue #275): the faces in the ruled
// folio, the flow-mode rule, and the edge states derived from existing
// state. The GOALS face retired with the separate destination (issue
// #445): goals and colors edit inside their habit.
const fixture = createAppFixture();
const boot = fixture.boot;
let app: App;

beforeEach(() => {
  localStorage.clear();
  app = boot();
});

afterEach(() => fixture.release());

const sheet = () => document.getElementById("app-popover")!;
function openFace(face: "plan" | "habit" | "history"): HTMLElement {
  app.showFocusFace(face);
  return sheet();
}
function openHabitDetail(habitId: string): HTMLElement {
  openFace("habit");
  document.querySelector<HTMLButtonElement>(`[data-drill-habit="${habitId}"]`)!.click();
  return sheet();
}

describe("the faces in the Focus frame", () => {
  it("each facetab selects its face; the frame is one clipped plate under the clock", () => {
    for (const face of ["plan", "habit", "history"] as const) {
      const frame = openFace(face);
      expect(frame.classList.contains("focus-sheet")).toBe(true);
      expect(frame.querySelector(".inst-panel")).not.toBeNull();
      expect(frame.querySelector(`.ftab[data-face="${face}"]`)!.getAttribute("aria-pressed")).toBe("true");
    }
  });

  it("the GOALS face is gone: three tabs stand, and no face answers the old one", () => {
    openFace("habit");
    expect(sheet().querySelectorAll(".ftab")).toHaveLength(3);
    expect(sheet().querySelector('[data-face="goals"]')).toBeNull();
  });

  it("the tabs are radio-like: switching faces never closes the frame", () => {
    openFace("habit");
    openFace("plan");
    expect(app.ui.app).toBe("time");
    expect(sheet()).toBe(document.getElementById("app-popover"));
  });

  it("the HABIT face is the figure-led list: lifetime and sessions lead the name", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    habit.seconds = 3600;
    selectHabit(app.state, habit.id);
    const frame = openFace("habit");
    const row = frame.querySelector<HTMLButtonElement>(".habit-ledger-row")!;
    const first = row.querySelector(".folio-fig")!;
    expect(row.querySelector(".habit-ledger-name")!.textContent).toBe("Piano");
    expect(first.compareDocumentPosition(row.querySelector(".habit-ledger-name")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The selected habit wears its dot; the row drills into the detail.
    expect(row.querySelector(".habit-dot.on")).not.toBeNull();
    row.click();
    expect(document.querySelector(".focus-detail-name")!.textContent).toBe("Piano");
  });

  it("add and log are on-demand action-button forms; a landing collapses them", () => {
    createHabit(app.state, "Piano");
    selectHabit(app.state, app.state.habits[0]!.id);
    const frame = openFace("habit");
    // The forms stand as action buttons, no inputs in sight.
    expect(frame.querySelector("#habit-name-input")).toBeNull();
    expect(frame.querySelector("#habit-log-minutes")).toBeNull();
    frame.querySelector<HTMLButtonElement>("#habit-add-open")!.click();
    expect(document.getElementById("habit-name-input")).not.toBeNull();
    expect(document.activeElement).toBe(document.getElementById("habit-name-input"));
    (document.getElementById("habit-name-input") as HTMLInputElement).value = "Etudes";
    document.querySelector<HTMLButtonElement>("#habit-create")!.click();
    expect(app.state.habits.map((h) => h.name)).toContain("Etudes");
    // The landing collapsed the form; the list leads again.
    expect(document.getElementById("habit-name-input")).toBeNull();
    // The log form reveals on its own action button.
    document.querySelector<HTMLButtonElement>("#habit-log-open")!.click();
    expect(document.getElementById("habit-log-minutes")).not.toBeNull();
    // Escape collapses it without landing.
    document.getElementById("habit-log-minutes")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(app.ui.focusForm).toBeNull();
    expect(document.getElementById("habit-log-minutes")).toBeNull();
  });

  it("rename and archive live in the detail head, not the rows", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    const frame = openFace("habit");
    // The list rows carry no rename or archive controls.
    expect(frame.querySelector("[data-rename]")).toBeNull();
    expect(frame.querySelector("[data-archive]")).toBeNull();
    frame.querySelector<HTMLButtonElement>(`[data-drill-habit="${habit.id}"]`)!.click();
    expect(document.querySelector("[data-rename]")).not.toBeNull();
    expect(document.querySelector("[data-archive]")).not.toBeNull();
    // Rename lands from the head.
    document.querySelector<HTMLButtonElement>("[data-rename]")!.click();
    const input = document.getElementById("habit-rename-input") as HTMLInputElement;
    input.value = "Fortepiano";
    document.getElementById("habit-rename-save")!.click();
    expect(app.state.habits[0]!.name).toBe("Fortepiano");
  });

  it("the PLAN face names the goals tracked", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 20, schedule: "daily", now: 1000 });
    expect(openFace("plan").querySelector("#focus-plan-read")!.textContent).toContain("1 goal tracked");
  });

  it("retired goals stay in history data without appearing in active goal controls or meters", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    const goal = createGoal(app.state, { habitId: habit.id, minutes: 20, schedule: "daily", now: 1000 }).goal!;
    goal.retired = true;
    expect(goalMeterOf(app.state)).toBeNull();
    expect(openFace("plan").querySelector("#focus-plan-read")!.textContent).toContain("0 goals tracked");
    expect(app.state.goals.find((g) => g.id === goal.id)).toBe(goal);
  });

  it("session history resolves the full description of a retired migrated goal", () => {
    app.state = deserialize(JSON.stringify(v10MigrationFixture)).state!;
    openFace("history");
    app.openDrill(1);
    expect(sheet().textContent).toContain("5 min · Piano · 20 min a day");
    expect(sheet().textContent).not.toContain("a since-removed goal");
  });

  it("the PLAN face's habit chips and the HABIT list read the same selection", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    createHabit(app.state, "Cooking");
    openFace("plan");
    document.querySelector<HTMLButtonElement>(`[data-habit-pick="${habit.id}"]`)!.click();
    expect(app.state.activeHabitId).toBe(habit.id);
    // The ready readout followed in place: the practice a session would
    // start is the row's whole read, the chips wear the pressed state.
    expect(document.querySelector(".focus-ready")!.textContent).toBe("Piano");
    const chip = document.querySelector<HTMLButtonElement>(`[data-habit-pick="${habit.id}"]`)!;
    expect(chip.classList.contains("st-selected")).toBe(true);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
  });
});

describe("the habit editor's color and goal (issue #445)", () => {
  it("the detail wears the palette row: six swatches, the standing color marked", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    const frame = openHabitDetail(habit.id);
    const swatches = [...frame.querySelectorAll<HTMLButtonElement>(".habit-swatch")];
    expect(swatches.map((s) => s.getAttribute("data-habit-set-color"))).toEqual([
      "vermillion", "amber", "green", "cyan", "indigo", "violet",
    ]);
    expect(swatches.find((s) => s.getAttribute("aria-pressed") === "true")!.getAttribute("data-habit-set-color")).toBe("vermillion");
    // A pick lands through the engine at once; the picker re-renders with
    // the pick standing.
    frame.querySelector<HTMLButtonElement>('[data-habit-set-color="cyan"]')!.click();
    expect(habit.color).toBe("cyan");
    const repicked = [...sheet().querySelectorAll<HTMLButtonElement>(".habit-swatch")];
    expect(repicked.find((s) => s.getAttribute("data-habit-set-color") === "cyan")!.getAttribute("aria-pressed")).toBe("true");
  });

  it("the goal section creates the habit's one goal; the form carries no habit select and no palette", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    const frame = openHabitDetail(habit.id);
    expect(frame.querySelector("#goal-create-open")).not.toBeNull();
    expect(frame.querySelector(".goal-row")).toBeNull();
    frame.querySelector<HTMLButtonElement>("#goal-create-open")!.click();
    expect(document.activeElement).toBe(document.getElementById("goal-minutes"));
    expect(document.getElementById("goal-habit")).toBeNull();
    expect(document.querySelector(".habit-swatch[data-goal-draft-color]")).toBeNull();
    (document.getElementById("goal-minutes") as HTMLInputElement).value = "20";
    (document.getElementById("goal-schedule") as HTMLSelectElement).value = "weekly";
    document.querySelector<HTMLButtonElement>("#goal-add")!.click();
    expect(app.state.goals).toHaveLength(1);
    expect(app.state.goals[0]).toMatchObject({ condition: { habitId: habit.id, minutes: 20 }, schedule: { kind: "weekly" } });
    // The landing collapsed the form; the goal row stands in its place.
    expect(document.getElementById("goal-minutes")).toBeNull();
    expect(sheet().querySelector(".goal-row .goal-ledger-name")!.textContent).toContain("20 min");
  });

  it("the goal row reads its progress and inherits the habit color on its track", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    const goal = createGoal(app.state, { habitId: habit.id, minutes: 20, schedule: "once", now: 1000 }).goal!;
    accrueGoalProgress(app.state, habit.id, 10 * 60);
    const frame = openHabitDetail(habit.id);
    const row = frame.querySelector(`[data-goal="${goal.id}"]`)!;
    expect(row.querySelector<HTMLElement>("[data-goal-progress]")!.style.background).toBe(`var(--habit-${habit.color})`);
    expect(row.querySelector("[data-goal-minutes]")!.textContent).toContain("10 min / 20 min");
    // A habit re-color moves the inherited track with it.
    app.setHabitColorAction(habit.id, "amber");
    const recolored = sheet().querySelector<HTMLElement>(`[data-goal="${goal.id}"] [data-goal-progress]`)!;
    expect(recolored.style.background).toBe("var(--habit-amber)");
    // The header meter wears the same pick.
    expect(document.querySelector("#console-session .goal-meter")!.getAttribute("style")).toContain("var(--habit-amber)");
  });

  it("the goal's edit form replaces target and cadence; remove takes it away", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    const goal = createGoal(app.state, { habitId: habit.id, minutes: 30, schedule: "once", now: 1000 }).goal!;
    accrueGoalProgress(app.state, habit.id, 20 * 60);
    const frame = openHabitDetail(habit.id);
    frame.querySelector<HTMLButtonElement>('[data-goal-edit-open="' + goal.id + '"]')!.click();
    const minutes = document.getElementById("goal-minutes") as HTMLInputElement;
    expect(minutes.value).toBe("30");
    // The form prefills the goal's own cadence (the option carries the
    // selected state in markup).
    expect(document.querySelector('#goal-schedule option[value="once"]')!.hasAttribute("selected")).toBe(true);
    minutes.value = "60";
    const schedule = document.getElementById("goal-schedule") as HTMLSelectElement;
    schedule.value = "once";
    document.querySelector<HTMLButtonElement>("#goal-edit-apply")!.click();
    // The edit landed through the engine: qualifying practice retained.
    expect(goal.condition.minutes).toBe(60);
    expect(goal.schedule.kind).toBe("once");
    expect(goal.progressSeconds).toBeCloseTo(20 * 60, 6);
    expect(app.ui.focusForm).toBeNull();
    expect(sheet().querySelector("[data-goal-minutes]")!.textContent).toContain("20 min / 1 h 0 min");
    // Remove takes the goal away; the create action stands again.
    sheet().querySelector<HTMLButtonElement>('[data-goal-remove="' + goal.id + '"]')!.click();
    expect(sheet().querySelector(`[data-goal="${goal.id}"]`)).toBeNull();
    expect(app.state.goals.find(row => row.id === goal.id)!.retired).toBe(true);
    expect(sheet().querySelector("#goal-create-open")).not.toBeNull();
  });

  it("a completed once-only goal reads complete until edited or replaced", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    const goal = createGoal(app.state, { habitId: habit.id, minutes: 10, schedule: "once", now: 1000 }).goal!;
    accrueGoalProgress(app.state, habit.id, 10 * 60);
    const frame = openHabitDetail(habit.id);
    expect(frame.querySelector(`[data-goal="${goal.id}"] .goal-status.done`)!.textContent).toBe("complete");
    // Raising the target un-completes it in the same view.
    frame.querySelector<HTMLButtonElement>('[data-goal-edit-open="' + goal.id + '"]')!.click();
    (document.getElementById("goal-minutes") as HTMLInputElement).value = "20";
    (document.getElementById("goal-schedule") as HTMLSelectElement).value = "once";
    document.querySelector<HTMLButtonElement>("#goal-edit-apply")!.click();
    const row = sheet().querySelector(`[data-goal="${goal.id}"]`)!;
    expect(row.querySelector(".goal-status.done")).toBeNull();
    expect(row.querySelector(".goal-status")!.textContent).toContain("to go");
  });

  it("a multi-goal save presents the retain-one choice; keeping one retires the rest", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    const goal = createGoal(app.state, { habitId: habit.id, minutes: 20, schedule: "daily", now: 1000 }).goal!;
    const carried: Goal = { ...structuredClone(goal), id: `${goal.id}b`, condition: { kind: "habit-minutes", habitId: habit.id, minutes: 45 }, schedule: { kind: "once" }, progressSeconds: 900, createdAt: 1001 };
    app.state.goals.push(carried);
    goal.pendingChoice = true;
    carried.pendingChoice = true;
    app.render();
    const frame = openHabitDetail(habit.id);
    const rows = [...frame.querySelectorAll(".goal-row")];
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain("carried over");
    expect(rows[0]!.querySelector("[data-goal-progress]")).toBeNull(); // no live track on a pending row
    expect(rows[0]!.querySelector("[data-goal-keep]")).not.toBeNull();
    // Keeping the 45-minute row lands the choice: it activates with its
    // record, the sibling retires, and the read lights again.
    frame.querySelector<HTMLButtonElement>('[data-goal-keep="' + carried.id + '"]')!.click();
    expect(carried.pendingChoice).toBeUndefined();
    expect(goal.retired).toBe(true);
    const kept = sheet().querySelector(`[data-goal="${carried.id}"]`)!;
    expect(kept.querySelector("[data-goal-minutes]")!.textContent).toContain("15 min / 45 min");
    expect(sheet().querySelector("[data-goal-keep]")).toBeNull();
    // The retained goal is the one the habit tracks.
    expect(app.state.goals.filter((g) => !g.retired && !g.pendingChoice)).toHaveLength(1);
  });
});

describe("the flow-mode rule", () => {
  it("habit add/log and goal editing lock in flow; the reads stay live", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 20, schedule: "once", now: 1000 });
    startSession(app.state, null);
    advance(app.state, 60);
    // The HABIT face reads live and draws no forms — and no drill into the
    // editor: the goal rows stand only between sessions.
    const habitFrame = openFace("habit");
    expect(habitFrame.querySelector('[data-live="focus-habit-session"]')!.textContent).toContain("01:00");
    expect(habitFrame.querySelector("#habit-add-open")).toBeNull();
    expect(habitFrame.querySelector("#habit-log-open")).toBeNull();
    expect(habitFrame.querySelector("#habit-name-input")).toBeNull();
    expect(habitFrame.querySelector("#goal-create-open")).toBeNull();
    expect(habitFrame.querySelector("[data-goal-remove]")).toBeNull();
    expect(habitFrame.querySelector(".habit-swatch")).toBeNull();
    // The engine owns the lock too: nothing these actions accept in flow.
    const nousBefore = app.state.nous;
    app.createHabitAction("Sneaky");
    app.logPracticeAction(30);
    app.createGoalAction(habit.id, 5, "once");
    app.setHabitColorAction(habit.id, "cyan");
    expect(app.state.habits.map((h) => h.name)).toEqual(["Piano"]);
    expect(app.state.goals).toHaveLength(1);
    expect(app.state.nous).toBe(nousBefore);
    expect(habit.color).toBe("vermillion");
  });

  it("the engine gates the goal's edit and the migration choice behind the lock too", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    const goal = createGoal(app.state, { habitId: habit.id, minutes: 20, schedule: "once", now: 1000 }).goal!;
    goal.pendingChoice = true;
    startSession(app.state, 1200);
    advance(app.state, 60);
    app.pause();
    expect(editGoal(app.state, goal.id, { minutes: 45, schedule: "once" }, 9000).ok).toBe(false);
    expect(retainGoalChoice(app.state, goal.id).ok).toBe(false);
    expect(goal.condition.minutes).toBe(20);
    expect(goal.pendingChoice).toBe(true);
    endSession(app.state);
  });

  it("the PLAN face in flow: the plan read only — no selection, no time UI, no end control", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    startSession(app.state, 1200);
    advance(app.state, 60);
    const frame = openFace("plan");
    // The plan read stands as in the ready state — habit and goals — and
    // nothing else: the console header owns the session.
    expect(frame.querySelector(".focus-ready")!.textContent).toBe("Piano");
    expect(document.getElementById("focus-plan-read")!.textContent).toBe("0 goals tracked");
    expect(frame.querySelector(".focus-habit-chips")).toBeNull();
    expect(frame.querySelector(".focus-plan-controls")).toBeNull();
    expect(frame.querySelector('[data-live="focus-elapsed"]')).toBeNull();
    expect(frame.querySelector("#focus-end")).toBeNull();
    expect(frame.querySelector("#focus-enter")).toBeNull();
    // The head names the mode: running.
    expect(frame.querySelector(".focus-state")!.textContent).toBe("running");
    // A flow tick keeps the sheet standing without rebuilding it.
    const readNode = frame.querySelector("#focus-plan-read")!;
    advance(app.state, 30);
    app.render();
    expect(document.querySelector("#app-popover #focus-plan-read")).toBe(readNode);
  });

  it("the HABIT face reads live during flow and mutates nothing", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 1, schedule: "once", now: 1000 });
    startSession(app.state, null);
    advance(app.state, 30);
    openFace("habit");
    advance(app.state, 30);
    app.render();
    // Reading the sheet banked nothing: the save's shape is untouched.
    const saved = JSON.parse(serialize(app.state, Date.now())).state;
    expect(Object.keys(saved)).toEqual(Object.keys(createInitialState()));
  });

  it("paused reads in the head's state word; the controls stay absent", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    startSession(app.state, 1200);
    advance(app.state, 60);
    app.pause();
    const frame = openFace("plan");
    expect(frame.querySelector(".focus-state")!.textContent).toBe("paused");
    expect(frame.querySelector(".focus-habit-chips")).toBeNull();
    expect(frame.querySelector(".focus-plan-controls")).toBeNull();
  });

  it("the sheet closes and its surfaces unwind on every teardown path", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    openFace("habit");
    document.querySelector<HTMLButtonElement>("#habit-add-open")!.click();
    document.querySelector<HTMLButtonElement>(`[data-drill-habit="${habit.id}"]`)!.click();
    // Escape unwinds the sheet with its inner surfaces — the revealed form
    // and the drilled detail go with it.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(app.ui.app).toBeNull();
    expect(app.ui.detailHabitId).toBeNull();
    expect(app.ui.focusForm).toBeNull();
    expect(document.getElementById("app-popover")).toBeNull();
  });
});

describe("the edge states derived from existing state", () => {
  it("a never-planned ready read is open-ended — plannedTarget null, no new key", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    app.ui.chosenTarget = null;
    openFace("plan");
    expect(document.getElementById("focus-plan-read")!.textContent).toBe("0 goals tracked");
    expect(document.getElementById("plan-open")!.getAttribute("aria-pressed")).toBe("true");
    // Entering with the fallback runs an open-ended session — the sheet
    // standing, the main switch's re-click commits the face's read.
    app.startFlow();
    expect(app.state.mode).toBe("flow");
    expect(app.state.session!.target).toBeNull();
  });

  it("zero habits never blocks entry: the re-click starts unstructured", () => {
    expect(app.state.habits).toHaveLength(0);
    openFace("plan");
    expect(app.ui.app).toBe("time");
    app.startFlow();
    expect(app.state.mode).toBe("flow");
    expect(app.state.activeHabitId).toBeNull();
  });

  it("no habit selected leaves the habit row unnamed; entry runs unstructured", () => {
    createHabit(app.state, "Piano"); // exists but not selected
    const frame = openFace("plan");
    expect(frame.querySelector(".focus-ready")).toBeNull();
    expect(document.querySelector<HTMLButtonElement>('.plan-habit-chip-none')!.getAttribute("aria-pressed")).toBe("true");
    app.startFlow();
    expect(app.state.mode).toBe("flow");
    expect(app.state.activeHabitId).toBeNull();
  });

  it("the chime fact is narrated nowhere: the tooltip went with the section", () => {
    const frame = openFace("plan");
    expect(frame.querySelector(".inst-tip")).toBeNull();
    expect(frame.textContent).not.toContain("chime");
    expect(frame.textContent).not.toContain("notification");
  });

  it("manual logs carry their boundary in the tooltip layer, not as prose", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    openFace("habit");
    document.querySelector<HTMLButtonElement>("#habit-log-open")!.click();
    // The reveal rebuilt the sheet; the frame is re-read fresh.
    const frame = document.getElementById("app-popover")!;
    // The boundary is the tooltip body's alone: the deepest nodes carrying
    // the mechanic are all tooltip bodies, never visible prose.
    const phrase = "Manual logs never produce nous or charge.";
    const deepest = [...frame.querySelectorAll<HTMLElement>("*")].filter(
      (el) => el.textContent!.includes(phrase) && ![...el.children].some((child) => child.textContent!.includes(phrase)),
    );
    expect(deepest).toHaveLength(1);
    expect(deepest[0]!.classList.contains("inst-tip-body")).toBe(true);
    // The tooltip layer rides the instrument wiring: focus opens it.
    const tip = frame.querySelector("#focus-log-tip")!;
    frame.querySelector<HTMLElement>('[aria-describedby="focus-log-tip"]')!.focus();
    expect(tip.classList.contains("inst-show")).toBe(true);
  });

  it("a manual log advances the goal condition without a session", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 10, schedule: "once", now: 1000 });
    openFace("habit");
    document.querySelector<HTMLButtonElement>("#habit-log-open")!.click();
    const input = document.getElementById("habit-log-minutes") as HTMLInputElement;
    const nousBefore = app.state.nous;
    input.value = "10";
    document.getElementById("habit-log-add")!.click();
    expect(app.state.goals[0]!.completed).toBe(true);
    expect(app.state.nous).toBe(nousBefore);
  });
});

describe("the PLAN face rework (#311)", () => {
  function openPlan(): HTMLElement {
    app.showFocusFace("plan");
    return document.getElementById("app-popover")!;
  }

  it("the console clock is the only planned-duration readout: the sheet never repeats the time", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    app.ui.chosenTarget = 1500;
    const frame = openPlan();
    // The ready row reads habit and goals tracked — no time anywhere.
    expect(frame.querySelector(".focus-ready")!.textContent).toBe("Piano");
    expect(document.getElementById("focus-plan-read")!.textContent).toBe("0 goals tracked");
    expect(frame.textContent).not.toContain("25:00");
    expect(frame.textContent).not.toContain("planned");
    // The figure row is gone; the console clock holds the one read.
    expect(document.getElementById("focus-plan-figure")).toBeNull();
    expect(document.getElementById("focus-plan-word")).toBeNull();
    expect(document.querySelector("#console-session .session-clock")!.textContent).toBe("25:00");
  });

  it("the plan controls are one compact row: presets, inline custom entry, open-ended", () => {
    openPlan();
    const row = document.querySelector(".focus-plan-controls")!;
    // The custom entry sits inline among the chips — no separate section.
    expect(row.querySelector("#plan-minutes")).not.toBeNull();
    expect(row.querySelector("#plan-open")).not.toBeNull();
    expect(row.querySelectorAll(".plan-chip")).toHaveLength(8);
    // No "Planned practice" section survives — no keyed figure row.
    expect(document.querySelector("#app-popover .folio-key")).toBeNull();
  });

  it("habits switch in one tap; none selected returns unstructured; create/edit lives behind the add chip", () => {
    const piano = createHabit(app.state, "Piano").habit!;
    const cooking = createHabit(app.state, "Cooking").habit!;
    openPlan();
    document.querySelector<HTMLButtonElement>(`[data-habit-pick="${piano.id}"]`)!.click();
    expect(app.state.activeHabitId).toBe(piano.id);
    // One tap over: the pressed state moved with the selection.
    document.querySelector<HTMLButtonElement>(`[data-habit-pick="${cooking.id}"]`)!.click();
    expect(app.state.activeHabitId).toBe(cooking.id);
    expect(document.querySelector<HTMLButtonElement>(`[data-habit-pick="${cooking.id}"]`)!.classList.contains("st-selected")).toBe(true);
    // The unstructured choice keeps its UI word as its own chip.
    document.querySelector<HTMLButtonElement>(".plan-habit-chip-none")!.click();
    expect(app.state.activeHabitId).toBeNull();
    // The add chip walks to the HABIT face — create and edit live there.
    document.querySelector<HTMLButtonElement>("#habit-add-chip")!.click();
    expect(app.ui.app).toBe("habit");
  });
});

describe("the goal meter's derivation (the display well's edge states)", () => {
  it("the meter qualifies the selected habit's own goal (issue #445: one per habit)", () => {
    const state = createInitialState();
    const piano = createHabit(state, "Piano").habit!;
    const cooking = createHabit(state, "Cooking").habit!;
    selectHabit(state, piano.id);
    createGoal(state, { habitId: piano.id, minutes: 10, schedule: "once", now: 1000 });
    createGoal(state, { habitId: cooking.id, minutes: 5, schedule: "once", now: 1002 }); // another habit's — never qualifies
    accrueGoalProgress(state, piano.id, 9 * 60); // the 10-min goal sits at 9/10
    const read = goalMeterOf(state)!;
    expect(read.fraction).toBeCloseTo(0.9);
    expect(read.done).toBe(false);
  });

  it("completion closes the meter on its done mark; the goal stays the habit's read", () => {
    const state = createInitialState();
    const habit = createHabit(state, "Piano").habit!;
    selectHabit(state, habit.id);
    createGoal(state, { habitId: habit.id, minutes: 10, schedule: "once", now: 1000 });
    accrueGoalProgress(state, habit.id, 5 * 60);
    const read = goalMeterOf(state)!;
    expect(read.done).toBe(false);
    expect(read.fraction).toBeCloseTo(0.5);
    accrueGoalProgress(state, habit.id, 5 * 60);
    const complete = goalMeterOf(state)!;
    expect(complete.done).toBe(true);
    expect(complete.fraction).toBe(1);
  });

  it("no habit, no goal, or an unresolved choice leaves the well bare", () => {
    expect(goalMeterOf(createInitialState())).toBeNull();
    const state = createInitialState();
    const habit = createHabit(state, "Piano").habit!;
    selectHabit(state, habit.id);
    expect(goalMeterOf(state)).toBeNull(); // a habit alone lights nothing
    const cooking = createHabit(state, "Cooking").habit!;
    createGoal(state, { habitId: cooking.id, minutes: 10, schedule: "daily", now: 1000 });
    expect(goalMeterOf(state)).toBeNull(); // another habit's goal never qualifies
    // The carried rows of a multi-goal save read as none until retained.
    selectHabit(state, cooking.id);
    state.goals[0]!.pendingChoice = true;
    expect(goalMeterOf(state)).toBeNull();
  });

  it("the gloss names the goal and what remains — the habit name stays off it", () => {
    const state = createInitialState();
    const habit = createHabit(state, "Piano").habit!;
    selectHabit(state, habit.id);
    createGoal(state, { habitId: habit.id, minutes: 20, schedule: "daily", now: 1000 });
    accrueGoalProgress(state, habit.id, 14 * 60);
    const read = goalMeterOf(state)!;
    expect(read.label).toBe("Daily 20 min · 6 min to go");
    expect(read.aria).toBe("Goal progress: daily 20 min, 6 minutes to go");
    accrueGoalProgress(state, habit.id, 6 * 60);
    expect(goalMeterOf(state)!.label).toBe("Daily 20 min · complete");
  });

  it("the derivation lives on existing state alone — the save shape never grows", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 10, schedule: "daily", now: 1000 });
    addPracticeLog(app.state, habit.id, 5, 2000);
    goalMeterOf(app.state);
    const saved = JSON.parse(serialize(app.state, Date.now())).state;
    expect(Object.keys(saved)).toEqual(Object.keys(createInitialState()));
  });
});

describe("the display well's goal meter (the header-status brief)", () => {
  it("keeps the gloss live after disclosure portals it outside the meter", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    const goal = createGoal(app.state, { habitId: habit.id, minutes: 20, schedule: "daily", now: Date.now() }).goal!;
    app.render();
    const meter = document.getElementById("goal-meter")!;
    meter.focus();
    const body = document.getElementById(meter.getAttribute("aria-describedby")!)!;
    expect(body.parentElement).toBe(document.body);
    expect(body.textContent).toBe("Daily 20 min · 20 min to go");
    goal.progressSeconds = 600;
    app.render();
    expect(document.getElementById("goal-meter")).toBe(meter);
    expect(body.textContent).toBe("Daily 20 min · 10 min to go");
    meter.blur();
    meter.focus();
    expect(body.classList.contains("inst-show")).toBe(true);
    expect(body.textContent).toBe("Daily 20 min · 10 min to go");
    meter.click();
    expect(app.ui.app).toBe("time");
  });

  it("the meter stands at the well's right edge: seven segments in the habit's palette", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 10, schedule: "once", now: 1000 });
    accrueGoalProgress(app.state, habit.id, 9 * 60); // the goal leads at 9/10
    app.render();
    const meter = document.querySelector("#console-session .goal-meter")!;
    // The column wears the habit's color — the goal inherits it (issue #445).
    expect(meter.getAttribute("style")).toContain("var(--habit-vermillion)");
    // Seven steps, six lit at 9/10 — the lit spelling the patch shares.
    expect(meter.querySelectorAll(".gm-seg")).toHaveLength(GOAL_METER_SEGMENTS);
    expect(meter.querySelectorAll(".gm-seg.lit")).toHaveLength(6);
    // One goal per habit: no count mark stands beside the column.
    expect(meter.querySelector(".gm-count")).toBeNull();
    // The gloss rides the tooltip layer, the aria read carries the read.
    expect(meter.querySelector(".inst-tip-body")!.textContent).toBe("10 min · 1 min to go");
    expect(meter.getAttribute("aria-label")).toBe("Goal progress: 10 min, 1 minute to go");
    // No nested controls: activating the meter opens PLAN with the door that
    // stays the one action.
    expect(meter.querySelectorAll("button, input, select, a")).toHaveLength(0);
  });

  it("in-progress vs complete reads without color: the aria read and the engraved mark carry it", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 10, schedule: "once", now: 1000 });
    accrueGoalProgress(app.state, habit.id, 10 * 60);
    app.render();
    const meter = document.querySelector("#console-session .goal-meter")!;
    expect(meter.classList.contains("goal-meter")).toBe(true);
    expect(meter.querySelectorAll(".gm-seg.lit")).toHaveLength(GOAL_METER_SEGMENTS);
    expect(meter.getAttribute("aria-label")).toBe("Goal progress: 10 min, complete");
    // The done mark rides the practice name — the column stays at the edge.
    expect(document.querySelector("#console-session .session-habit .habit-done")).not.toBeNull();
    expect(meter.querySelector(".gm-done")).toBeNull();
  });

  it("the habit's palette pick re-tints the meter without touching its meaning", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 30, schedule: "weekly", now: 1000 });
    accrueGoalProgress(app.state, habit.id, 15 * 60);
    app.render();
    const meter = document.querySelector("#console-session .goal-meter")!;
    expect(meter.getAttribute("style")).toContain("var(--habit-vermillion)");
    expect(meter.querySelectorAll(".gm-seg.lit")).toHaveLength(Math.floor(0.5 * GOAL_METER_SEGMENTS));
    expect(meter.querySelector(".inst-tip-body")!.textContent).toBe("Weekly 30 min · 15 min to go");
    app.setHabitColorAction(habit.id, "amber");
    expect(document.querySelector("#console-session .goal-meter")!.getAttribute("style")).toContain("var(--habit-amber)");
  });

  it("an empty tracker and no habit leave the well bare; the session group names the unstructured choice", () => {
    app.render();
    expect(document.querySelector("#console-session .goal-meter")).toBeNull();
    // No habit selected wears the roster's one edge-state word, muted.
    const group = document.querySelector("#console-session .session-habit")!;
    const name = group.querySelector('[data-session="habit"]')!;
    expect(name.textContent).toBe("none selected");
    expect(name.classList.contains("unselected")).toBe(true);
  });

  it("live reads during flow: the lit steps move on the tick and mutate nothing", () => {
    setVisibility("visible");
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 1, schedule: "once", now: 1000 });
    startSession(app.state, null);
    advance(app.state, 30);
    app.render();
    const meter = () => document.querySelector("#console-session .goal-meter")!;
    const host = document.getElementById("console-session")!;
    const meterBefore = meter();
    const keyBefore = host.dataset.renderKey;
    expect(meterBefore.querySelectorAll(".gm-seg.lit")).toHaveLength(Math.floor(0.5 * GOAL_METER_SEGMENTS));
    // One more tick, one more render: the read moved — same node, more lit
    // segments — the tick patched in place rather than rebuilding the door.
    advance(app.state, 15);
    app.render();
    const meterAfter = meter();
    expect(meterAfter).toBe(meterBefore);
    expect(meterAfter.querySelectorAll(".gm-seg.lit")).toHaveLength(5);
    expect(host.dataset.renderKey).toBe(keyBefore);
    // And the reads mutated nothing: the render's derivation is not on the
    // engine's path — the goal's progress holds exactly what advance left.
    const progressAfter = JSON.stringify(app.state.goals);
    app.render();
    expect(JSON.stringify(app.state.goals)).toBe(progressAfter);
    endSession(app.state);
  });

  it("a goal completing mid-session rebuilds the read onto its engraved mark", () => {
    setVisibility("visible");
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 1, schedule: "once", now: 1000 });
    startSession(app.state, null);
    advance(app.state, 30);
    app.render();
    expect(document.querySelector("#console-session .session-habit .habit-done")).toBeNull();
    advance(app.state, 31);
    app.render();
    expect(document.querySelector("#console-session .session-habit .habit-done")).not.toBeNull();
    expect(app.state.goals[0]!.completed).toBe(true);
    endSession(app.state);
  });
});

describe("the restructure stays presentational", () => {
  it("FocusApp ids keep their meaning", () => {
    createHabit(app.state, "Piano");
    openFace("habit");
    expect(app.ui.app).toBe("habit");
    openFace("plan");
    expect(app.ui.app).toBe("time");
    openFace("history");
    expect(app.ui.app).toBe("time");
    expect(app.ui.historyOpen).toBe(true);
    startSession(app.state, null);
    endSession(app.state);
  });

  it("the sheet's flow lock rides the engine's own gates — no new persistence anywhere", () => {
    // Nothing about the sheet's furniture survives a save: the serialized
    // state carries no focusForm, no face, no drill.
    openFace("habit");
    const saved = JSON.parse(serialize(app.state, Date.now()));
    expect(saved.state.ui).toBeUndefined();
    expect(JSON.stringify(saved)).not.toContain("focusForm");
  });
});

describe("the sheet's live reads", () => {
  it("a manual log's completion lands in the standing goal row", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 1, schedule: "once", now: 1000 });
    accrueGoalProgress(app.state, habit.id, 30);
    openHabitDetail(habit.id);
    const bar = document.querySelector("[data-goal-progress]") as HTMLElement;
    const before = bar.style.height;
    app.logPracticeAction(1); // 60 s: completes the goal
    app.render();
    const after = document.querySelector("[data-goal-progress]") as HTMLElement;
    expect(after.style.height).toBe("100%");
    expect(after.style.height).not.toBe(before);
  });
});

describe("the compact class summary (issue #446)", () => {
  it("the detail wears the one advancement read: class, level, free points, the XP countdown, and Next module roll", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    const pair = habit.classes.engineer!;
    pair.level = 3;
    pair.points = 1;
    pair.spent = { reed: 1 };
    pair.rollMeter = { progress: 420, earned: 1 };
    const frame = openHabitDetail(habit.id);
    // The one-place read: level and the point balance live here alone.
    // (The term disclosures sit inline, so the read asserts in pieces.)
    const read = frame.querySelector(".habit-class .stat-row .mono")!.textContent!;
    expect(read).toContain("Engineer");
    expect(read).toContain("Level 3");
    expect(read).toContain("1 tree point");
    expect(read).toContain("free");
    // The XP countdown reads in practice-time units, under its own label.
    const xpRow = frame.querySelectorAll(".habit-class .stat-row")[1]!;
    expect(xpRow.textContent).toContain("Next level");
    expect(xpRow.textContent).toContain("of practice to level 4");
    // The reward meter renders under the player-facing name, with its live
    // slots and figures — distinct from the XP row above.
    const key = frame.querySelector(".class-meter-row .folio-key")!;
    expect(key.textContent).toContain("Next module roll");
    const track = frame.querySelector<HTMLElement>('[data-live="class-meter-track"]')!;
    expect(track.getAttribute("aria-label")).toBe("Next module roll");
    expect(track.getAttribute("aria-valuenow")).toBe("420");
    expect(track.querySelector('[data-live="class-meter-pip"]')!.getAttribute("style")).toContain("23.3");
    expect(frame.querySelector('[data-live="class-meter-line"]')!.textContent).toContain("next roll in");
    // The one deliberate entry to the tree.
    expect(frame.querySelector('[data-habit-develop]')).not.toBeNull();
    // No tree stands on the summary: allocation waits behind Develop.
    expect(frame.querySelector("[data-class-allocate]")).toBeNull();
    expect(frame.querySelector('[data-class-respec]')).toBeNull();
    expect(frame.querySelectorAll("[data-class-preset]")).toHaveLength(0);
  });

  it("edge states read correctly: fresh pair, zero points, and maximum level", () => {
    const fresh = createHabit(app.state, "Fresh").habit!;
    const frame = openHabitDetail(fresh.id);
    expect(frame.querySelector(".habit-class")!.textContent).toContain("Level 0");
    expect(frame.querySelector(".habit-class")!.textContent).toContain("0 tree points");
    expect(frame.querySelector('[data-live="class-xp-line"]')!.textContent).toContain("of practice to level 1");
    // The opening fill is the meter's first threshold.
    expect(frame.querySelector('[data-live="class-meter-track"]')!.getAttribute("aria-valuemax")).toBe("180");

    const capped = createHabit(app.state, "Capped").habit!;
    const pair = capped.classes.engineer!;
    pair.level = 6; // every authored threshold crossed
    pair.points = 0;
    pair.spent = { governor: 2, reed: 2, "punch-card": 1 };
    const cappedFrame = openHabitDetail(capped.id);
    expect(cappedFrame.querySelector(".habit-class")!.textContent).toContain("Level 6");
    expect(cappedFrame.querySelector(".habit-class")!.textContent).toContain("0 tree points");
    expect(cappedFrame.querySelector('[data-live="class-xp-line"]')!.textContent).toBe("max level");
    // The roll meter keeps running at the cap: the meter line still speaks.
    expect(cappedFrame.querySelector('[data-live="class-meter-line"]')!.textContent).toContain("next roll in");
  });

  it("the XP countdown and the roll meter update live while the view stays open", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    startSession(app.state, null);
    const frame = openFace("habit");
    const xp = frame.querySelector('[data-live="class-xp-line"]')!;
    const line = frame.querySelector('[data-live="class-meter-line"]')!;
    expect(xp.textContent).toContain("of practice to level 1");
    advance(app.state, 60);
    app.render();
    // The patch, not a rebuild: the same nodes carry the moved figures.
    expect(frame.querySelector('[data-live="class-xp-line"]')!.isSameNode(xp)).toBe(true);
    expect(xp.textContent).toContain("1h 59m of practice to level 1");
    expect(line.textContent).toContain("1:00 / 3:00");
  });

  it("a threshold crossing rebuilds the summary's figures; a meter crossing re-bases the track", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    startSession(app.state, null);
    const frame = openFace("habit");
    const track = frame.querySelector('[data-live="class-meter-track"]')!;
    expect(track.getAttribute("aria-valuemax")).toBe("180");
    // Two hours of credited practice: level 1 lands, a point frees, and
    // the meter crosses into its flat cadence. The crossing changes the
    // sheet's rebuild signature, so the summary stands rebuilt.
    advance(app.state, 2 * 3600);
    app.render();
    const rebuilt = sheet();
    expect(habit.classes.engineer!.level).toBe(1);
    expect(habit.classes.engineer!.points).toBe(1);
    expect(habit.classes.engineer!.rollMeter.earned).toBeGreaterThanOrEqual(1);
    expect(rebuilt.querySelector(".habit-class")!.textContent).toContain("Level 1");
    expect(rebuilt.querySelector(".habit-class")!.textContent).toContain("1 tree point");
    expect(rebuilt.querySelector('[data-live="class-xp-line"]')!.textContent).toContain("of practice to level 2");
    expect(rebuilt.querySelector('[data-live="class-meter-track"]')!.getAttribute("aria-valuemax")).toBe("1800");
  });

  it("the flow-mode active read carries the live summary; no Develop and no controls stand", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    startSession(app.state, null);
    advance(app.state, 60);
    const frame = openFace("habit");
    // The summary's figures ride the active read, live.
    expect(frame.querySelector(".habit-class")!.textContent).toContain("Engineer");
    expect(frame.querySelector('[data-live="class-meter-line"]')!.textContent).toContain("1:00 / 3:00");
    // No class mutations stand in flow — Develop included.
    expect(frame.querySelector("[data-habit-develop]")).toBeNull();
    expect(frame.querySelector("[data-class-pick]")).toBeNull();
    expect(frame.querySelector("[data-class-allocate]")).toBeNull();
    expect(frame.querySelector("[data-class-respec]")).toBeNull();
    // The same holds while the session is paused.
    pauseSession(app.state);
    app.render();
    expect(app.state.mode).toBe("paused");
    expect(sheet().querySelector("[data-habit-develop]")).toBeNull();
    expect(sheet().querySelector("[data-class-allocate]")).toBeNull();
    expect(sheet().querySelector('[data-live="class-meter-line"]')).not.toBeNull();
  });
});

describe("the Develop journey (issue #446)", () => {
  it("Develop opens the tree; allocation, respec, and preset moves land through the engine", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    const pair = habit.classes.engineer!;
    pair.level = 1;
    pair.points = 1;
    const frame = openHabitDetail(habit.id);
    frame.querySelector<HTMLButtonElement>('[data-habit-develop]')!.click();
    // The tree stands with its bounded-rank rows: the available node offers
    // its next rank; the locked rung names its level and renders no button.
    expect(sheet().querySelector('[data-class-allocate="governor"]')).not.toBeNull();
    expect(sheet().querySelector('[data-class-allocate="reed"]')).toBeNull();
    expect(sheet().textContent).toContain("unlocks at class level 3");
    expect(sheet().querySelector('[data-class-respec]')).not.toBeNull();
    expect(sheet().querySelectorAll("[data-class-preset]").length).toBeGreaterThanOrEqual(2);
    sheet().querySelector<HTMLButtonElement>('[data-class-allocate="governor"]')!.click();
    expect(pair.spent).toEqual({ governor: 1 });
    expect(pair.points).toBe(0);
    sheet().querySelector<HTMLButtonElement>('[data-class-respec]')!.click();
    expect(pair.spent).toEqual({});
    expect(pair.points).toBe(1);
    // The default preset needs level 3's reed — the refusal surfaces, the
    // allocation stands.
    sheet().querySelector<HTMLButtonElement>('[data-class-preset="engineer-default"]')!.click();
    expect(pair.spent).toEqual({});
    // Back returns to the summary, which still owns the advancement read.
    sheet().querySelector<HTMLButtonElement>('#habit-develop-back')!.click();
    expect(sheet().querySelector('[data-live="class-xp-line"]')).not.toBeNull();
    expect(sheet().querySelector("[data-class-allocate]")).toBeNull();
  });

  it("the tree repeats no advancement figures — the summary owns them", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    const pair = habit.classes.engineer!;
    pair.level = 3;
    pair.points = 1;
    pair.spent = { reed: 1 };
    pair.rollMeter = { progress: 420, earned: 1 };
    openHabitDetail(habit.id);
    sheet().querySelector<HTMLButtonElement>('[data-habit-develop]')!.click();
    const tree = sheet().querySelector(".habit-class")!;
    expect(tree.textContent).not.toContain("Level 3");
    expect(tree.textContent).not.toContain("tree point");
    expect(tree.textContent).not.toContain("Next level");
    expect(tree.textContent).not.toContain("of practice to level");
    expect(tree.textContent).not.toContain("Next module roll");
    expect(tree.textContent).not.toContain("next roll in");
    expect(tree.querySelector('[data-live="class-meter-track"]')).toBeNull();
    expect(tree.querySelector('[data-live="class-xp-line"]')).toBeNull();
  });

  it("node disclosures remain independent of rank actions and expose allocation state", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    const pair = habit.classes.engineer!;
    pair.level = 3;
    pair.points = 1;
    pair.spent = { governor: 2, reed: 1 };
    openHabitDetail(habit.id);
    sheet().querySelector<HTMLButtonElement>('[data-habit-develop]')!.click();
    const tree = sheet().querySelector(".habit-class")!;
    for (const name of ["Governor", "Reed", "Punch card"]) {
      const trigger = tree.querySelector<HTMLButtonElement>(`[aria-label="${name} — what it means"]`)!;
      expect(trigger).not.toBeNull();
      expect(trigger.closest("button")).toBe(trigger);
      trigger.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      expect(pair.spent).toEqual({ governor: 2, reed: 1 });
    }
    const fullRank = tree.querySelector(".tree-node.equipped .tree-node-mark")!;
    expect(fullRank.textContent).toBe("2/2");
    expect(fullRank.hasAttribute("aria-hidden")).toBe(false);
    expect(tree.querySelector('[data-class-allocate="reed"]')!.getAttribute("aria-label")).toContain("rank 1 of 2");
    expect(tree.textContent!.match(/Engineer/g)).toBeNull();
  });
});

describe("session preparation composition (issue #447)", () => {
  function openPlan(): HTMLElement {
    app.showFocusFace("plan");
    return document.getElementById("app-popover")!;
  }

  it("opening Focus lands on preparation; picking a habit selects it without opening an editor", () => {
    const piano = createHabit(app.state, "Piano").habit!;
    createHabit(app.state, "Cooking");
    // The console clock is Focus's door: it lands on the preparation face.
    document.getElementById("clock-plan")!.click();
    expect(app.ui.app).toBe("time");
    expect(app.ui.historyOpen).toBe(false);
    expect(document.querySelector(".ftab[data-face=\"plan\"]")!.getAttribute("aria-pressed")).toBe("true");
    // One tap selects: the session habit is authoritative at once, and no
    // editor stands — the sheet never left preparation.
    document.querySelector<HTMLButtonElement>(`[data-habit-pick="${piano.id}"]`)!.click();
    expect(app.state.activeHabitId).toBe(piano.id);
    expect(app.ui.app).toBe("time");
    expect(app.ui.detailHabitId).toBeNull();
    expect(document.getElementById("habit-rename-input")).toBeNull();
    expect(document.querySelector(".focus-ready")!.textContent).toBe("Piano");
    // The duration row still stands beside the selection.
    expect(document.querySelector(".focus-plan-controls")).not.toBeNull();
  });

  it("the selected habit's goal and compact class summary stand in one hierarchy, controls absent", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    const goal = createGoal(app.state, { habitId: habit.id, minutes: 20, schedule: "daily", now: 1000 }).goal!;
    accrueGoalProgress(app.state, habit.id, 12 * 60);
    const pair = habit.classes.engineer!;
    pair.level = 2;
    pair.points = 1;
    const frame = openPlan();
    // The goal read stands, figures and inherited palette, but read-only:
    // goal controls live only in Edit habit.
    const goalRow = frame.querySelector(`[data-goal="${goal.id}"]`)!;
    expect(goalRow.querySelector(".goal-ledger-name")!.textContent).toContain("20 min");
    expect(goalRow.querySelector("[data-goal-minutes]")!.textContent).toContain("12 min / 20 min");
    expect(goalRow.querySelector("[data-goal-progress]")!.getAttribute("style")).toContain(`var(--habit-${habit.color})`);
    expect(frame.querySelector("#goal-create-open")).toBeNull();
    expect(frame.querySelector("[data-goal-edit-open]")).toBeNull();
    expect(frame.querySelector("[data-goal-remove]")).toBeNull();
    expect(frame.querySelector(".habit-swatch")).toBeNull();
    // The compact summary is the one advancement read, once.
    const summary = frame.querySelector(".habit-class")!;
    expect(summary.textContent).toContain("Engineer");
    expect(summary.textContent).toContain("Level 2");
    expect(summary.textContent).toContain("Next level");
    expect(summary.textContent).toContain("Next module roll");
    expect(frame.querySelectorAll(".habit-class")).toHaveLength(1);
    // No allocation stands in preparation — the tree waits behind Develop.
    expect(frame.querySelector("[data-class-allocate]")).toBeNull();
    expect(frame.querySelector("[data-class-respec]")).toBeNull();
    expect(frame.querySelector("[data-class-pick]")).toBeNull();
    expect(frame.querySelector("[data-class-preset]")).toBeNull();
    // Edit habit and Develop close the hierarchy as the deliberate moves.
    expect(frame.querySelector("[data-habit-edit]")).not.toBeNull();
    expect(frame.querySelector("[data-habit-develop]")).not.toBeNull();
  });

  it("Edit habit enters the editor destination; Develop enters the tree; each returns", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    const pair = habit.classes.engineer!;
    pair.level = 1;
    pair.points = 1;
    const frame = openPlan();
    // Edit habit lands in the drilled editor: identity and goal controls.
    frame.querySelector<HTMLButtonElement>("[data-habit-edit]")!.click();
    expect(app.ui.app).toBe("habit");
    expect(app.ui.detailHabitId).toBe(habit.id);
    expect(document.querySelector("[data-rename]")).not.toBeNull();
    expect(document.querySelector("#goal-create-open")).not.toBeNull();
    expect(document.querySelector(".habit-swatch")).not.toBeNull();
    // Back returns to the HABIT face's list — the editor face's root.
    document.getElementById("habit-detail-back")!.click();
    expect(app.ui.detailHabitId).toBeNull();
    expect(app.ui.app).toBe("habit");
    // From preparation again: Develop opens the tree in the drilled habit.
    app.showFocusFace("plan");
    document.querySelector<HTMLButtonElement>("[data-habit-develop]")!.click();
    expect(app.ui.developHabitId).toBe(habit.id);
    expect(document.querySelector("[data-class-allocate]")).not.toBeNull();
    // The tree's back returns to the summary, which owns the figures.
    document.getElementById("habit-develop-back")!.click();
    expect(app.ui.developHabitId).toBeNull();
    expect(document.querySelector('[data-live="class-xp-line"]')).not.toBeNull();
    expect(document.querySelector("[data-class-allocate]")).toBeNull();
  });

  it("preparation stands for no selected habit, no goal, and an unresolved carried-over choice", () => {
    const piano = createHabit(app.state, "Piano").habit!;
    // No selection: no habit context at all — the chips and duration carry it.
    let frame = openPlan();
    expect(frame.querySelector(".habit-goal")).toBeNull();
    expect(frame.querySelector(".habit-class")).toBeNull();
    expect(frame.querySelector("[data-habit-edit]")).toBeNull();
    expect(frame.querySelector(`[data-habit-pick="${piano.id}"]`)).not.toBeNull();
    // A habit without a goal reads the no-goal state plainly.
    selectHabit(app.state, piano.id);
    frame = openPlan();
    expect(frame.querySelector(".habit-goal")!.textContent).toContain("No goal");
    expect(frame.querySelector(".habit-class")).not.toBeNull();
    // The unresolved migration choice names itself and keeps preparation
    // usable: no Keep control here (it lives in Edit habit), no goal row,
    // and a session still starts.
    const goal = createGoal(app.state, { habitId: piano.id, minutes: 20, schedule: "daily", now: 1000 }).goal!;
    const carried: Goal = { ...structuredClone(goal), id: `${goal.id}b`, condition: { kind: "habit-minutes", habitId: piano.id, minutes: 45 }, schedule: { kind: "once" }, progressSeconds: 900, createdAt: 1001 };
    app.state.goals.push(carried);
    goal.pendingChoice = true;
    carried.pendingChoice = true;
    app.render();
    frame = openPlan();
    expect(frame.querySelector(".habit-goal")!.textContent).toContain("carried over");
    expect(frame.querySelector("[data-goal-keep]")).toBeNull();
    expect(frame.querySelector("[data-goal]")).toBeNull();
    app.startFlow();
    expect(app.state.mode).toBe("flow");
    endSession(app.state);
    expect(app.state.mode).toBe("upgrade");
  });

  it("completed goals, a fresh pair, and the maximum level read on preparation", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    const goal = createGoal(app.state, { habitId: habit.id, minutes: 10, schedule: "once", now: 1000 }).goal!;
    accrueGoalProgress(app.state, habit.id, 10 * 60);
    habit.classes.engineer!.level = 6;
    const frame = openPlan();
    expect(frame.querySelector(`[data-goal="${goal.id}"] .goal-status.done`)!.textContent).toBe("complete");
    expect(frame.querySelector(".habit-class")!.textContent).toContain("Level 6");
    expect(frame.querySelector(".habit-class")!.textContent).toContain("0 tree points");
    expect(frame.querySelector('[data-live="class-xp-line"]')!.textContent).toBe("max level");
    // A fresh habit reads its opening state the same way.
    const fresh = createHabit(app.state, "Fresh").habit!;
    selectHabit(app.state, fresh.id);
    const freshFrame = openPlan();
    expect(freshFrame.querySelector(".habit-class")!.textContent).toContain("Level 0");
    expect(freshFrame.querySelector('[data-live="class-xp-line"]')!.textContent).toContain("of practice to level 1");
  });

  it("archived habits leave the chips and preparation; a long name reads whole", () => {
    const fading = createHabit(app.state, "Fading").habit!;
    selectHabit(app.state, fading.id);
    archiveHabit(app.state, fading.id);
    // Archiving the active habit clears the selection: preparation carries
    // no context, and the archived habit stands in no chip.
    const frame = openPlan();
    expect(frame.querySelector(".focus-prepare")).toBeNull();
    expect(frame.querySelector(`[data-habit-pick="${fading.id}"]`)).toBeNull();
    // A long name reads whole in the chip, the ready read, and the goal row
    // — the engine's 40-character cap is the one truncation.
    const long = "Timer exercises with the long name attac";
    const named = createHabit(app.state, long).habit!;
    selectHabit(app.state, named.id);
    createGoal(app.state, { habitId: named.id, minutes: 15, schedule: "weekly", now: 1000 });
    const longFrame = openPlan();
    expect(longFrame.querySelector(".focus-ready")!.textContent).toBe(long);
    expect(longFrame.querySelector(`[data-habit-pick="${named.id}"]`)!.textContent).toBe(long);
    expect(longFrame.querySelector(".goal-ledger-name")!.textContent).toContain("15 min");
  });

  it("the paused session keeps the running read and the live reads locked in place", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 20, schedule: "once", now: 1000 });
    startSession(app.state, 1200);
    advance(app.state, 60);
    app.pause();
    // PLAN: the running read only — no context, no controls.
    const frame = openFace("plan");
    expect(frame.querySelector(".focus-state")!.textContent).toBe("paused");
    expect(frame.querySelector(".habit-goal")).toBeNull();
    expect(frame.querySelector("[data-habit-edit]")).toBeNull();
    // The HABIT face keeps the advancement read live under the same lock.
    const habitFrame = openFace("habit");
    expect(habitFrame.querySelector('[data-live="class-xp-line"]')).not.toBeNull();
    expect(habitFrame.querySelector("[data-habit-develop]")).toBeNull();
    expect(habitFrame.querySelector("[data-class-allocate]")).toBeNull();
    endSession(app.state);
  });

  it("the PLAN face in flow stays the running read: no habit context, no controls", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 20, schedule: "once", now: 1000 });
    startSession(app.state, 1200);
    advance(app.state, 60);
    const frame = openFace("plan");
    expect(frame.querySelector(".habit-goal")).toBeNull();
    expect(frame.querySelector(".habit-class")).toBeNull();
    expect(frame.querySelector("[data-habit-edit]")).toBeNull();
    expect(frame.querySelector("[data-habit-develop]")).toBeNull();
    endSession(app.state);
  });

  it("the full journey: choose, plan, edit, develop, practice, pause, resume, inspect, finish, revisit", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    const pair = habit.classes.engineer!;
    pair.level = 1;
    pair.points = 1;
    // Choose the habit and arm a duration on preparation.
    document.getElementById("clock-plan")!.click();
    document.querySelector<HTMLButtonElement>(`[data-habit-pick="${habit.id}"]`)!.click();
    document.querySelector<HTMLButtonElement>('#app-popover [data-plan="25"]')!.click();
    expect(app.ui.chosenTarget).toBe(1500);
    // Edit habit: recolor, then give the habit its daily target.
    document.querySelector<HTMLButtonElement>("[data-habit-edit]")!.click();
    document.querySelector<HTMLButtonElement>('[data-habit-set-color="cyan"]')!.click();
    expect(habit.color).toBe("cyan");
    document.querySelector<HTMLButtonElement>("#goal-create-open")!.click();
    (document.getElementById("goal-minutes") as HTMLInputElement).value = "20";
    (document.getElementById("goal-schedule") as HTMLSelectElement).value = "daily";
    document.querySelector<HTMLButtonElement>("#goal-add")!.click();
    expect(app.state.goals[0]).toMatchObject({ condition: { minutes: 20 }, schedule: { kind: "daily" } });
    // Develop: one rank into the tree, then back out.
    app.showFocusFace("plan");
    document.querySelector<HTMLButtonElement>("[data-habit-develop]")!.click();
    document.querySelector<HTMLButtonElement>('[data-class-allocate="governor"]')!.click();
    expect(pair.spent).toEqual({ governor: 1 });
    document.getElementById("habit-develop-back")!.click();
    // Practice: enter, pause, resume — the session runs on the chosen plan.
    document.getElementById("flow-switch")!.click();
    expect(app.state.mode).toBe("flow");
    expect(app.state.session!.target).toBe(1500);
    advance(app.state, 120);
    app.pause();
    expect(app.state.mode).toBe("paused");
    app.resume();
    expect(app.state.mode).toBe("flow");
    advance(app.state, 60);
    // Inspect progress mid-session: the advancement read is live in place.
    app.showFocusFace("habit");
    const xp = document.querySelector('[data-live="class-xp-line"]')!;
    expect(xp.textContent).toContain("of practice to level 2");
    advance(app.state, 60);
    app.render();
    expect(document.querySelector('[data-live="class-xp-line"]')!.isSameNode(xp)).toBe(true);
    // Finish, then revisit the session in history.
    app.endFlow();
    app.dismissSummary();
    expect(app.state.mode).toBe("upgrade");
    openFace("history");
    const row = document.querySelector<HTMLButtonElement>(".history-row")!;
    expect(row.textContent).toContain("Piano");
    row.click();
    expect(sheet().textContent).toContain("Session 1");
  });
});
