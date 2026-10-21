// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { createHabit, selectHabit, addPracticeLog } from "../engine/habits";
import { createGoal, accrueGoalProgress, goalCapacity } from "../engine/goals";
import { endSession, startSession } from "../engine/actions";
import { advance } from "../engine/advance";
import { deserialize, serialize } from "../engine/save";
import { goalMeterOf, GOAL_METER_SEGMENTS } from "./focus";
import { createInitialState } from "../engine/state";
import v10MigrationFixture from "../engine/fixtures/saves/v10-migration.json";
import { createAppFixture, setVisibility } from "./testing/app-fixture";

// The Focus control sheet (ADR-0050, issue #275): four faces in the ruled
// folio, the flow-mode rule, and the edge states derived from existing
// state.
const fixture = createAppFixture();
const boot = fixture.boot;
let app: App;

beforeEach(() => {
  localStorage.clear();
  app = boot();
});

afterEach(() => fixture.release());

const sheet = () => document.getElementById("app-popover")!;
function openFace(face: "plan" | "habit" | "goals" | "history"): HTMLElement {
  app.showFocusFace(face);
  return sheet();
}

describe("the four faces in the Focus frame", () => {
  it("each facetab selects its face; the frame is one clipped plate under the clock", () => {
    for (const face of ["plan", "habit", "goals", "history"] as const) {
      const frame = openFace(face);
      expect(frame.classList.contains("focus-sheet")).toBe(true);
      expect(frame.querySelector(".inst-panel")).not.toBeNull();
      expect(frame.querySelector(`.ftab[data-face="${face}"]`)!.getAttribute("aria-pressed")).toBe("true");
    }
  });

  it("the tabs are radio-like: switching faces never closes the frame", () => {
    openFace("habit");
    openFace("goals");
    expect(app.ui.app).toBe("goals");
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

  it("the GOALS face leads with the slots read; the PLAN face names the goals tracked", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 20, schedule: "daily", now: 1000 });
    expect(openFace("goals").querySelector("#focus-slots-read")!.textContent).toContain(`1/${goalCapacity()} slots`);
    expect(openFace("plan").querySelector("#focus-plan-read")!.textContent).toContain("1 goal tracked");
  });

  it("retired goals stay in history data without appearing in active goal controls or meters", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    const goal = createGoal(app.state, { habitId: habit.id, minutes: 20, schedule: "daily", now: 1000 }).goal!;
    goal.retired = true;
    expect(goalMeterOf(app.state)).toBeNull();
    expect(openFace("goals").querySelector("#focus-slots-read")!.textContent).toContain(`0/${goalCapacity()} slots`);
    expect(sheet().querySelector("[data-goal-delete]")).toBeNull();
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

describe("the flow-mode rule", () => {
  it("habit add/log and goal create/delete lock in flow; the reads stay live", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 20, schedule: "once", now: 1000 });
    startSession(app.state, null);
    advance(app.state, 60);
    // The HABIT face reads live and draws no forms.
    const habitFrame = openFace("habit");
    expect(habitFrame.querySelector('[data-live="focus-habit-session"]')!.textContent).toContain("01:00");
    expect(habitFrame.querySelector("#habit-add-open")).toBeNull();
    expect(habitFrame.querySelector("#habit-log-open")).toBeNull();
    expect(habitFrame.querySelector("#habit-name-input")).toBeNull();
    // The GOALS face reads live; create, delete, and the palette's edit
    // half are gone. The retired purchase row left no trace.
    const goalsFrame = openFace("goals");
    expect(goalsFrame.querySelector(".long-goal-row")).toBeNull();
    expect(goalsFrame.querySelector("#goal-create-open")).toBeNull();
    expect(goalsFrame.querySelector("[data-goal-delete]")).toBeNull();
    expect(goalsFrame.querySelector("[data-goal-recolor]")).toBeNull();
    expect(goalsFrame.querySelector("#long-goal-buy")).toBeNull();
    // The engine owns the lock too: nothing these actions accept in flow.
    const nousBefore = app.state.nous;
    app.createHabitAction("Sneaky");
    app.logPracticeAction(30);
    app.createGoalAction(habit.id, 5, "once", "vermillion");
    expect(app.state.habits.map((h) => h.name)).toEqual(["Piano"]);
    expect(app.state.goals).toHaveLength(1);
    expect(app.state.nous).toBe(nousBefore);
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

  it("the HABIT and GOALS faces read live during flow and mutate nothing", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 1, schedule: "once", now: 1000 });
    startSession(app.state, null);
    advance(app.state, 30);
    const goalsNode = openFace("goals").querySelector("[data-goal-minutes]")!;
    expect(goalsNode.textContent).toContain("30s / 1 min");
    advance(app.state, 30);
    app.render();
    expect(document.querySelector("[data-goal-minutes]")!.textContent).toContain("1 min / 1 min");
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
  it("the meter qualifies the selected habit's own goals, nearest complete leading (issue #423)", () => {
    const state = createInitialState();
    const piano = createHabit(state, "Piano").habit!;
    const cooking = createHabit(state, "Cooking").habit!;
    selectHabit(state, piano.id);
    createGoal(state, { habitId: piano.id, minutes: 10, schedule: "once", now: 1000 });
    createGoal(state, { habitId: piano.id, minutes: 30, schedule: "once", now: 1001 });
    createGoal(state, { habitId: cooking.id, minutes: 5, schedule: "once", now: 1002 }); // another habit's — never qualifies
    accrueGoalProgress(state, piano.id, 9 * 60); // the 10-min goal sits at 9/10
    const read = goalMeterOf(state)!;
    expect(read.fraction).toBeCloseTo(0.9);
    expect(read.done).toBe(false);
    // One more open goal of the same habit stays in play.
    expect(read.extra).toBe(1);
  });

  it("completion never displaces the nearest open goal; an all-done set closes on its mark", () => {
    const state = createInitialState();
    const habit = createHabit(state, "Piano").habit!;
    selectHabit(state, habit.id);
    createGoal(state, { habitId: habit.id, minutes: 10, schedule: "once", now: 1000 });
    createGoal(state, { habitId: habit.id, minutes: 5, schedule: "once", now: 1001 });
    accrueGoalProgress(state, habit.id, 5 * 60); // completes the 5-min goal
    const read = goalMeterOf(state)!;
    expect(read.done).toBe(false);
    expect(read.fraction).toBeCloseTo(0.5); // the 10-min goal leads, credited the same five minutes
    expect(read.extra).toBe(0); // the done goal is not "in play"
    accrueGoalProgress(state, habit.id, 10 * 60); // completes the 10-min too
    const complete = goalMeterOf(state)!;
    expect(complete.done).toBe(true);
    expect(complete.fraction).toBe(1);
    expect(complete.extra).toBe(0);
  });

  it("no habit, no qualifying goal, no meter", () => {
    expect(goalMeterOf(createInitialState())).toBeNull();
    const state = createInitialState();
    const habit = createHabit(state, "Piano").habit!;
    selectHabit(state, habit.id);
    expect(goalMeterOf(state)).toBeNull(); // a habit alone lights nothing
    const cooking = createHabit(state, "Cooking").habit!;
    createGoal(state, { habitId: cooking.id, minutes: 10, schedule: "daily", now: 1000 });
    expect(goalMeterOf(state)).toBeNull(); // another habit's goal never qualifies
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

  it("the meter stands at the well's right edge: seven segments, the goal's palette, the count mark", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    // The habit's full slot set tracks (issue #423: the fixed per-habit
    // capacity), each goal a step further from done.
    const capacity = goalCapacity();
    for (let i = 0; i < capacity; i++) createGoal(app.state, { habitId: habit.id, minutes: 10 + i, schedule: "once", now: 1000 + i });
    accrueGoalProgress(app.state, habit.id, 9 * 60); // the 10-min goal leads at 9/10
    app.render();
    const meter = document.querySelector("#console-session .goal-meter")!;
    expect(meter.getAttribute("style")).toContain("var(--goal-vermillion)");
    // Seven steps, six lit at 9/10 — the lit spelling the patch shares.
    expect(meter.querySelectorAll(".gm-seg")).toHaveLength(GOAL_METER_SEGMENTS);
    expect(meter.querySelectorAll(".gm-seg.lit")).toHaveLength(6);
    // The count mark answers for the further goals in play.
    expect(meter.querySelector(".gm-count")!.textContent).toBe(`·${capacity - 1}`);
    // The gloss rides the tooltip layer, the aria read carries the count.
    expect(meter.querySelector(".inst-tip-body")!.textContent).toBe("10 min · 1 min to go");
    expect(meter.getAttribute("aria-label")).toBe(`Goal progress: 10 min, 1 minute to go, ${capacity - 1} more goals in play`);
    // No nested controls: activating the meter opens PLAN with the door that
    // stays the one action.
    expect(meter.querySelectorAll("button, input, select, a")).toHaveLength(0);
  });

  it("in-progress vs complete reads without color: the aria read and the engraved mark carry it", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 10, schedule: "once", now: 1000, color: "cyan" });
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

  it("the selected habit's own goal lights the meter (issue #423)", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 30, schedule: "weekly", now: 1000, color: "amber" });
    accrueGoalProgress(app.state, habit.id, 15 * 60);
    app.render();
    const meter = document.querySelector("#console-session .goal-meter")!;
    expect(meter.getAttribute("style")).toContain("var(--goal-amber)");
    expect(meter.querySelectorAll(".gm-seg.lit")).toHaveLength(Math.floor(0.5 * GOAL_METER_SEGMENTS));
    expect(meter.querySelector(".inst-tip-body")!.textContent).toBe("Weekly 30 min · 15 min to go");
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
    openFace("goals");
    expect(app.ui.app).toBe("goals");
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
  it("tick updates keep the sheet's figures current without a rebuild", () => {
    setVisibility("visible");
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 1, schedule: "once", now: 1000 });
    startSession(app.state, null);
    advance(app.state, 30);
    const frame = openFace("goals");
    const bar = frame.querySelector("[data-goal-progress]") as HTMLElement;
    const before = bar.style.height;
    advance(app.state, 15);
    app.tick();
    expect(document.querySelector("[data-goal-progress]")).toBe(bar);
    expect(bar.style.height).not.toBe(before);
    expect(bar.style.height).toBe("75%");
  });
});

describe("the habit-class face (issue #423)", () => {
  function drill(habitId: string): HTMLElement {
    openFace("habit");
    document.querySelector<HTMLButtonElement>(`[data-drill-habit="${habitId}"]`)!.click();
    return sheet();
  }

  it("the detail wears the class section: chips, the level/point read, the meter, and the tree", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    const pair = habit.classes.engineer!;
    pair.level = 3;
    pair.points = 1;
    pair.spent = { reed: 1 };
    pair.rollMeter = { progress: 420, earned: 1 };
    const frame = drill(habit.id);
    expect(frame.querySelector("[data-class-pick]")).toBeNull();
    // The one-place read: level and the point balance live here alone.
    // (The term disclosures sit inline, so the read asserts in pieces.)
    const read = frame.querySelector(".habit-class .stat-row .mono")!.textContent!;
    expect(read).toContain("Engineer");
    expect(read).toContain("Level 3");
    expect(read).toContain("1 tree point");
    expect(read).toContain("free");
    // The practice-roll meter renders with its live slots and figures.
    const track = frame.querySelector<HTMLElement>('[data-live="class-meter-track"]')!;
    expect(track.getAttribute("aria-valuenow")).toBe("420");
    expect(track.querySelector('[data-live="class-meter-pip"]')!.getAttribute("style")).toContain("23.3");
    expect(frame.querySelector('[data-live="class-meter-line"]')!.textContent).toContain("next roll in");
    // The tree: the half-ranked node offers its next rank; the locked rung
    // names its level and renders no button.
    expect(frame.querySelector('[data-class-allocate="reed"]')).not.toBeNull();
    expect(frame.querySelector('[data-class-allocate="punch-card"]')).toBeNull();
    expect(frame.textContent).toContain("unlocks at class level 5");
    // Respec and presets stand in the tree's actions row.
    expect(frame.querySelector('[data-class-respec]')).not.toBeNull();
    expect(frame.querySelectorAll("[data-class-preset]").length).toBeGreaterThanOrEqual(2);
  });

  it("allocating, respecing, and preset moves land through the engine and re-render the sheet", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    const pair = habit.classes.engineer!;
    pair.level = 1;
    pair.points = 1;
    const frame = drill(habit.id);
    frame.querySelector<HTMLButtonElement>('[data-class-allocate="governor"]')!.click();
    expect(pair.spent).toEqual({ governor: 1 });
    expect(pair.points).toBe(0);
    sheet().querySelector<HTMLButtonElement>('[data-class-respec]')!.click();
    expect(pair.spent).toEqual({});
    expect(pair.points).toBe(1);
    // The default preset needs level 3's reed — the refusal surfaces, the
    // allocation stands.
    sheet().querySelector<HTMLButtonElement>('[data-class-preset="engineer-default"]')!.click();
    expect(pair.spent).toEqual({});
  });

  it("the flow-mode active read carries the live meter; the drill-down never draws controls", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    startSession(app.state, null);
    advance(app.state, 60);
    const frame = openFace("habit");
    // The active read shows the meter line live.
    expect(frame.querySelector('[data-live="class-meter-line"]')!.textContent).toContain("1:00 / 3:00");
    // No class controls stand in flow.
    expect(frame.querySelector("[data-class-pick]")).toBeNull();
    expect(frame.querySelector("[data-class-allocate]")).toBeNull();
    expect(frame.querySelector("[data-class-respec]")).toBeNull();
  });

  it("node disclosures remain independent of rank actions and expose allocation state", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    const pair = habit.classes.engineer!;
    pair.level = 3;
    pair.points = 1;
    pair.spent = { governor: 2, reed: 1 };
    const frame = drill(habit.id);
    for (const name of ["Governor", "Reed", "Punch card"]) {
      const trigger = frame.querySelector<HTMLButtonElement>(`[aria-label="${name} — what it means"]`)!;
      expect(trigger).not.toBeNull();
      expect(trigger.closest("button")).toBe(trigger);
      trigger.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      expect(pair.spent).toEqual({ governor: 2, reed: 1 });
    }
    const fullRank = frame.querySelector(".tree-node.equipped .tree-node-mark")!;
    expect(fullRank.textContent).toBe("2/2");
    expect(fullRank.hasAttribute("aria-hidden")).toBe(false);
    expect(frame.querySelector('[data-class-allocate="reed"]')!.getAttribute("aria-label")).toContain("rank 1 of 2");
    expect(frame.querySelector(".habit-class")!.textContent!.match(/Engineer/g)).toHaveLength(1);
  });
});
