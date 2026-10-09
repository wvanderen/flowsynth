// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { createHabit, selectHabit, addPracticeLog } from "../engine/habits";
import { createGoal, accrueGoalProgress } from "../engine/goals";
import { endSession, startSession } from "../engine/actions";
import { advance } from "../engine/advance";
import { serialize } from "../engine/save";
import { goalBarsOf } from "./focus";
import { createInitialState } from "../engine/state";
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
    expect(openFace("goals").querySelector("#focus-slots-read")!.textContent).toContain("1/2 slots");
    expect(openFace("plan").querySelector("#focus-plan-read")!.textContent).toContain("1 goal tracked");
  });

  it("the session habit select and the HABIT list read the same selection", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    createHabit(app.state, "Cooking");
    openFace("plan");
    const select = document.getElementById("focus-habit-select") as HTMLSelectElement;
    select.value = habit.id;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(app.state.activeHabitId).toBe(habit.id);
    // The ready readout followed in place: the practice a session would
    // start leads the read.
    expect(document.querySelector(".focus-ready")!.textContent).toBe("Ready · Piano");
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
    // The GOALS face reads live; create and delete are gone.
    const goalsFrame = openFace("goals");
    expect(goalsFrame.querySelector(".long-goal-row")!.textContent).toContain("between sessions");
    expect(goalsFrame.querySelector("#goal-create-open")).toBeNull();
    expect(goalsFrame.querySelector("[data-goal-delete]")).toBeNull();
    expect(goalsFrame.querySelector("#long-goal-buy")!.getAttribute("title")).toBe("Purchases happen between sessions");
    // The engine owns the lock too: nothing these actions accept in flow.
    const nousBefore = app.state.nous;
    app.createHabitAction("Sneaky");
    app.logPracticeAction(30);
    app.createGoalAction(habit.id, 5, "once");
    expect(app.state.habits.map((h) => h.name)).toEqual(["Piano"]);
    expect(app.state.goals).toHaveLength(1);
    expect(app.state.nous).toBe(nousBefore);
  });

  it("the PLAN face becomes the running read: live elapsed, End flow, targets visibly disabled", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    startSession(app.state, 1200);
    advance(app.state, 60);
    const frame = openFace("plan");
    expect(frame.querySelector('[data-live="focus-elapsed"]')!.textContent).toBe("01:00");
    expect(frame.querySelector('[data-live="focus-caption"]')!.textContent).toBe("of 20:00");
    expect(frame.querySelector("#focus-end")).not.toBeNull();
    // A flow tick moves the live figures without rebuilding the sheet —
    // node identity, and the open frame with it, ride through.
    const elapsedNode = frame.querySelector('[data-live="focus-elapsed"]')!;
    advance(app.state, 30);
    app.render();
    expect(document.querySelector('[data-live="focus-elapsed"]')).toBe(elapsedNode);
    expect(elapsedNode.textContent).toBe("01:30");
    // End flow mirrors the main switch.
    document.querySelector<HTMLButtonElement>("#focus-end")!.click();
    expect(app.state.mode).toBe("upgrade");
    expect(app.state.summary).not.toBeNull();
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

  it("paused reads in the running read; the controls stay disabled", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    startSession(app.state, 1200);
    advance(app.state, 60);
    app.pause();
    const frame = openFace("plan");
    expect(frame.querySelector('[data-live="focus-caption"]')!.textContent).toBe("paused");
    expect(frame.querySelector<HTMLButtonElement>(".plan-chip")!.disabled).toBe(true);
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
    const frame = openFace("plan");
    expect(document.getElementById("focus-plan-read")!.textContent).toBe("open-ended · 0 goals tracked");
    expect(frame.querySelector("#focus-plan-figure")!.textContent).toBe("—");
    // Entering with the fallback runs an open-ended session.
    document.querySelector<HTMLButtonElement>("#focus-enter")!.click();
    expect(app.state.mode).toBe("flow");
    expect(app.state.session!.target).toBeNull();
  });

  it("zero habits never blocks entry: the Enter flow control stands and the prompt answers", () => {
    expect(app.state.habits).toHaveLength(0);
    const frame = openFace("plan");
    const enter = frame.querySelector<HTMLButtonElement>("#focus-enter")!;
    expect(enter.disabled).toBe(false);
    enter.click();
    // The kind-first prompt opens — unstructured is one pane away.
    expect(app.ui.modal).toBe("enter");
    expect(document.getElementById("modal-content")!.textContent).toContain("Unstructured");
    app.closeModal();
    // And through the prompt, the unstructured session starts.
    document.querySelector<HTMLButtonElement>('[data-enter-kind="unstructured"]')!.click();
    document.getElementById("enter-begin")!.click();
    expect(app.state.mode).toBe("flow");
    expect(app.state.activeHabitId).toBeNull();
  });

  it("no habit selected reads as ready without naming a practice; entry opens the prompt", () => {
    createHabit(app.state, "Piano"); // exists but not selected
    const frame = openFace("plan");
    expect(frame.querySelector(".focus-ready")!.textContent).toBe("Ready");
    expect((document.getElementById("focus-habit-select") as HTMLSelectElement).value).toBe("");
    document.querySelector<HTMLButtonElement>("#focus-enter")!.click();
    expect(app.ui.modal).toBe("enter");
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

describe("the goal bars' derivation (the banner's edge states)", () => {
  it("bars bias in-progress goals, nearest complete first, completed filling the rest", () => {
    const state = createInitialState();
    state.goalCapacityBought = 1; // three slots for the three tracked goals
    const habit = createHabit(state, "Piano").habit!;
    createGoal(state, { habitId: habit.id, minutes: 10, schedule: "once", now: 1000 });
    createGoal(state, { habitId: habit.id, minutes: 60, schedule: "once", now: 1001 });
    createGoal(state, { habitId: habit.id, minutes: 5, schedule: "once", now: 1002 });
    accrueGoalProgress(state, habit.id, 8 * 60); // completes the 5-min goal; the 10-min sits at 8/10
    const read = goalBarsOf(state);
    expect(read.overflow).toBe(0);
    expect(read.bars.map((bar) => `${bar.done ? "done" : "open"}@${bar.fraction.toFixed(2)}`)).toEqual([
      "open@0.80", // nearest complete first
      "open@0.13", // the far goal follows
      "done@1.00", // completed occurrences close the run
    ]);
  });

  it("goals past the bar budget read as the +N overflow count", () => {
    const state = createInitialState();
    state.goalCapacityBought = 3; // five slots for the five tracked goals
    const habit = createHabit(state, "Piano").habit!;
    for (let i = 0; i < 5; i++) createGoal(state, { habitId: habit.id, minutes: 10 + i, schedule: "once", now: 1000 + i });
    const read = goalBarsOf(state);
    expect(read.bars).toHaveLength(3);
    expect(read.overflow).toBe(2);
    // Every goal complete: the full bars hold, done-marked, overflow intact.
    accrueGoalProgress(state, habit.id, 70 * 60);
    const complete = goalBarsOf(state);
    expect(complete.bars.every((bar) => bar.done)).toBe(true);
    expect(complete.overflow).toBe(2);
  });

  it("an empty tracker derives no bars and no overflow", () => {
    expect(goalBarsOf(createInitialState())).toEqual({ bars: [], overflow: 0 });
  });

  it("the derivation lives on existing state alone — the save shape never grows", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    createGoal(app.state, { habitId: habit.id, minutes: 10, schedule: "daily", now: 1000 });
    addPracticeLog(app.state, habit.id, 5, 2000);
    goalBarsOf(app.state);
    const saved = JSON.parse(serialize(app.state, Date.now())).state;
    expect(Object.keys(saved)).toEqual(Object.keys(createInitialState()));
  });
});

describe("the restructure stays presentational", () => {
  it("FocusApp ids keep their meaning; activatedApps is untouched", () => {
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
    const before = [...app.state.activatedApps];
    startSession(app.state, null);
    endSession(app.state);
    expect(app.state.activatedApps).toEqual(before);
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
    const before = bar.style.width;
    advance(app.state, 15);
    app.tick();
    expect(document.querySelector("[data-goal-progress]")).toBe(bar);
    expect(bar.style.width).not.toBe(before);
    expect(bar.style.width).toBe("75%");
  });
});
