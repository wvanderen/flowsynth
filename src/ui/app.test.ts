// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { addPracticeLog, archiveHabit, createHabit, selectHabit } from "../engine/habits";
import { createGoal, deleteGoal, goalSummary, accrueGoalProgress } from "../engine/goals";
import { recordSummaryReflection } from "../engine/actions";
import { writeNote } from "../engine/notes";
import { STORAGE_KEY, serialize } from "../engine/save";
import { longGoalCost } from "../engine/economy";
import { startSession, endSession } from "../engine/actions";
import { advance } from "../engine/advance";
import { applyGap, flushPendingAway, resolveHonestyReport } from "../engine/trust";
import { recordMissed, recordTargetHit } from "../engine/records";
import { createInitialState } from "../engine/state";
import { formatInt } from "./format";
import { createAppFixture } from "./testing/app-fixture";

// console rendering and interaction on the production HTML skeleton.
const fixture = createAppFixture();
const boot = fixture.boot;
let app: App;

beforeEach(() => {
  localStorage.clear();
  app = boot();
});
afterEach(() => fixture.release());

const DAY = new Date(2026, 8, 18, 12).getTime();

describe("the console tiles", () => {
  it("three icon-only tiles — Habit, Notes, Goals; Time wears none (issue #148)", () => {
    app.render();
    for (const key of ["habit", "notes", "goals"]) {
      const tile = document.getElementById(`app-tile-${key}`)!;
      expect(tile.classList.contains("locked")).toBe(false);
      expect(tile.title).not.toContain("locked");
      // Icon-only: a glyph and an accessible name, no state text.
      expect(tile.querySelector(".app-tile-glyph svg")).not.toBeNull();
      expect(tile.getAttribute("aria-label")).toBeTruthy();
    }
    // Consistently sized: no tile carries state text, so all three are the
    // same icon square.
    expect(document.querySelectorAll(".app-tile-state")).toHaveLength(0);
    expect(document.getElementById("app-tile-time")).toBeNull();
  });

  it("every tile opens its panel from session one", () => {
    for (const key of ["habit", "notes", "goals"] as const) {
      app.openApp(key);
      expect(document.getElementById("app-popover")).not.toBeNull();
      app.closeApp();
    }
  });

  it("every tile's panel opens inside its own slot, with no first/last anchor classes", () => {
    app.render();
    for (const key of ["habit", "notes", "goals"] as const) {
      app.openApp(key);
      // Uniform right-anchoring: the popover lives in the tile's slot, and
      // the slot carries no per-position anchor class for the CSS to fork on.
      const slot = document.getElementById(`app-tile-${key}`)!.closest(".app-slot")!;
      expect(slot.querySelector("#app-popover")).not.toBeNull();
      expect(slot.className).toBe("app-slot");
      app.closeApp();
    }
  });
});

describe("the console", () => {
  it("is pure control: no production readout, no trophy, no nous balance (§7)", () => {
    app.render();
    expect(document.getElementById("console-status")).toBeNull();
    expect(document.getElementById("nous-balance")).toBeNull();
    expect(document.querySelector(".production-slot")).toBeNull();
    expect(document.querySelector(".trophy-glyph")).toBeNull();
    // The console carries only session controls, app tiles, and settings.
    expect(document.getElementById("console-session")!.querySelector(".main-switch")).not.toBeNull();
    expect(document.getElementById("console-apps")).not.toBeNull();
    expect(document.getElementById("console-settings")).not.toBeNull();
    expect(document.querySelector("#flow-switch .switch-state")).not.toBeNull();
  });

  it("the upgrade-mode clock is the plan affordance: clicking it opens the Time app", () => {
    app.state.sessionsCompleted = 1;
    app.ui.chosenTarget = 600;
    app.render();
    expect(document.querySelector("#console-session .session-clock")!.textContent).toBe("10:00");
    expect(document.querySelector("#console-session .clock-caption")!.textContent).toBe("planned");
    document.getElementById("clock-plan")!.click();
    expect(app.ui.app).toBe("time");
    expect(document.getElementById("app-popover")).not.toBeNull();
    app.closeApp();
    app.ui.chosenTarget = null;
    app.render();
    // The clock slot only ever holds clock text: an unplanned open-ended
    // shape wears a placeholder, the caption names the mode.
    expect(document.querySelector("#console-session .session-clock")!.textContent).toBe("--:--");
    expect(document.querySelector("#console-session .clock-caption")!.textContent).toBe("open-ended");
  });

  it("the flow clock keeps the live session; the Time popover never repeats it (§7)", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, 600);
    advance(s, 30);
    app.render();
    expect(document.getElementById("clock-plan")).not.toBeNull();
    document.getElementById("clock-plan")!.click();
    const popover = document.getElementById("app-popover")!;
    expect(popover.textContent).not.toContain("00:30");
    expect(popover.textContent).toContain("holds the history");
    app.closeApp();
  });

  it("the planned clock counts the overrun past the target instead of freezing at 0:00 (#193)", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, 600);
    advance(s, 30);
    app.render();
    expect(document.querySelector("#console-session .session-clock")!.textContent).toBe("09:30");
    expect(document.querySelector("#console-session .clock-caption")!.textContent).toBe("of 10:00");
    // Sixty seconds past the target: the clock counts the overrun, the
    // caption names it.
    advance(s, 630);
    app.render();
    expect(document.querySelector("#console-session .session-clock")!.textContent).toBe("01:00");
    expect(document.querySelector("#console-session .clock-caption")!.textContent).toBe("overrun");
    // Paused mid-overrun: the hold wins the caption; the frozen overrun stays.
    app.pause();
    expect(document.querySelector("#console-session .session-clock")!.textContent).toBe("01:00");
    expect(document.querySelector("#console-session .clock-caption")!.textContent).toBe("paused");
  });
});

describe("the console header around Enter/Exit Flow (#148)", () => {
  it("orders the row: brand, session cluster, icon tiles, Settings last", () => {
    app.render();
    const header = document.querySelector(".console")!;
    const children = [...header.children];
    const order = (el: Element) => children.indexOf(el);
    expect(order(header.querySelector(".brand")!)).toBeLessThan(order(document.getElementById("console-session")!));
    expect(order(document.getElementById("console-session")!)).toBeLessThan(order(document.getElementById("console-apps")!));
    expect(order(document.getElementById("console-apps")!)).toBeLessThan(order(document.getElementById("console-settings")!));
    // The session cluster is the switch's home — the header's dominant
    // control, wearing its state light.
    expect(document.querySelector("#console-session #flow-switch .switch-state")).not.toBeNull();
  });

  it("the clock wears a small disclosure affordance that tracks the Time popover", () => {
    app.render();
    const clock = () => document.getElementById("clock-plan")!;
    expect(clock().querySelector(".clock-disclose")).not.toBeNull();
    expect(clock().getAttribute("aria-expanded")).toBe("false");
    clock().click();
    expect(app.ui.app).toBe("time");
    // The button is a native control: pointer, keyboard, and touch all
    // drive the same click.
    expect(clock().getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById("app-popover")).not.toBeNull();
    clock().click();
    expect(app.ui.app).toBeNull();
    expect(clock().getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById("app-popover")).toBeNull();
  });

  it("the Time popover anchors beneath the clock and survives clicks inside it", () => {
    app.state.sessionsCompleted = 1;
    app.ui.chosenTarget = 600;
    app.render();
    document.getElementById("clock-plan")!.click();
    const popover = document.getElementById("app-popover")!;
    expect(document.getElementById("console-session")!.contains(popover)).toBe(true);
    // A plan chip pick inside the popover neither closes it nor rebuilds it:
    // node identity, focus, and scroll all ride through (#115's contract,
    // now at the clock anchor).
    const chip = popover.querySelector<HTMLButtonElement>('[data-plan="25"]')!;
    popover.scrollTop = 80;
    chip.focus();
    chip.click();
    expect(app.ui.app).toBe("time");
    expect(document.getElementById("app-popover")).toBe(popover);
    expect(app.ui.chosenTarget).toBe(1500);
    expect(document.activeElement).toBe(chip);
    expect(popover.scrollTop).toBe(80);
    app.closeApp();
    expect(document.getElementById("app-popover")).toBeNull();
  });

  it("the provisional line rides beside the clock, never stacked below it", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, 600);
    advance(s, 600);
    advance(s, 1, Math.random, "provisional");
    s.session!.accounting.poolSeconds = 300;
    s.session!.accounting.bucketNous = 30;
    app.render();
    const flag = document.getElementById("session-provisional")!;
    const anchor = document.querySelector("#console-session .clock-anchor")!;
    expect(anchor.contains(flag)).toBe(true);
    expect(anchor.querySelector(".clock-stack")!.contains(flag)).toBe(false);
    expect(flag.textContent).toContain("provisional");
    expect(flag.textContent).toContain("30 ν");
  });

  it("pause stays reachable during flow and toggles from the header", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, 600);
    advance(s, 30);
    app.render();
    document.getElementById("pause-flow")!.click();
    expect(app.state.mode).toBe("paused");
    app.render();
    expect(document.getElementById("pause-flow")!.textContent).toBe("Resume");
    document.getElementById("pause-flow")!.click();
    expect(app.state.mode).toBe("flow");
  });
});

describe("the feats page's milestone group (issue #268)", () => {
  it("leads with Milestones; each row carries icon, name, unlock, and effect", () => {
    app.state.sessionsCompleted = 1;
    app.state.achievements["mutator-entry"] = Date.now();
    app.openModal("achievements");
    const content = document.getElementById("modal-content")!;
    expect(content.querySelector(".eyebrow")!.textContent).toBe("FEATS");
    expect(content.querySelector("#modal-title")!.textContent).toBe("1 of 23 feats.");
    const sections = [...content.querySelectorAll(".ach-section")];
    expect(sections[0]!.querySelector(".catalog-section-title")!.textContent).toBe("Milestones");
    const rows = [...sections[0]!.querySelectorAll(".ach-milestone")];
    expect(rows).toHaveLength(5);
    const entry = rows[0]!;
    expect(entry.querySelector(".ach-name")!.textContent).toBe("Mutator entry");
    expect(entry.querySelector(".ach-unlock")!.textContent).toBe("Mutator Grid on");
    expect(entry.querySelector(".ach-effect")!.textContent).toBe("+2% ν");
    expect(entry.querySelector(".ach-icon svg")).not.toBeNull();
    // The engraved done-mark is the crossed row's state.
    expect(entry.classList.contains("crossed")).toBe(true);
    expect(entry.querySelector(".ach-mark")).not.toBeNull();
    expect(entry.querySelector(".inst-tip")).toBeNull();
    // Milestones precede every encourager bucket.
    const titles = sections.map((s) => s.querySelector(".catalog-section-title")!.textContent);
    expect(titles[0]).toBe("Milestones");
    expect(titles).toContain("Practice capstones");
    expect(titles).toContain("Counter ladder");
  });

  it("an un-crossed milestone reads muted with its effect visible, its tooltip naming the gate", () => {
    app.openModal("achievements");
    const row = document.querySelector(".ach-milestone:not(.crossed)")!;
    expect(row.querySelector(".ach-name")!.textContent).toBe("Mutator entry");
    expect(row.querySelector(".ach-unlock")!.textContent).toBe("Mutator Grid on");
    expect(row.querySelector(".ach-effect")!.textContent).toBe("+2% ν");
    expect(row.querySelector(".ach-mark")).toBeNull();
    const tip = row.querySelector(".inst-tip-body")!;
    expect(tip.textContent).toContain("Arete Catalog");
    // The gate tooltip rides the instrument layer: focus opens it.
    const trigger = row.querySelector<HTMLElement>(".inst-tip-trigger")!;
    trigger.focus();
    expect(tip.classList.contains("inst-show")).toBe(true);
    trigger.blur();
    expect(tip.classList.contains("inst-show")).toBe(false);
  });

  it("a pre-existing save's satisfied milestones grant silently on load (N/23, no toast)", () => {
    const s = createInitialState();
    s.sessionsCompleted = 1;
    s.catalogEntryOwned = true;
    s.rollPoolJoined = true;
    s.prestiges = 1;
    s.unlockedRows.push(2);
    s.purchased = { generator: true, infusor: true, forge: true };
    localStorage.setItem(STORAGE_KEY, serialize(s, Date.now() - 1_000));
    const booted = boot();
    // first-light rides along: the save's completed session satisfies it
    // unstamped — the eager sync is achievement-wide, and silent throughout.
    expect([...Object.keys(booted.state.achievements)].sort()).toEqual(
      ["first-light", "first-prestige", "first-row", "mutator-entry", "roll-pool-join", "shelf-complete"].sort(),
    );
    // No toast announced the retro-grant.
    expect(document.getElementById("status")!.textContent).not.toContain("Feat unlocked");
    // The chip reads the full count — the five milestones plus first-light.
    booted.render();
    expect(document.getElementById("feats-chip")!.textContent).toContain("6/23");
    booted.openModal("achievements");
    expect(document.getElementById("modal-content")!.querySelector("#modal-title")!.textContent).toBe("6 of 23 feats.");
    const crossed = document.querySelectorAll(".ach-milestone.crossed");
    expect(crossed).toHaveLength(5);
  });
});

describe("the feats page's encourager icons (issue #269)", () => {
  it("every encourager row leads with its unique icon", () => {
    app.openModal("achievements");
    const rows = [...document.querySelectorAll(".ach-row")];
    expect(rows).toHaveLength(18);
    const marks = rows.map((row) => row.querySelector(".ach-icon svg")!.innerHTML);
    expect(new Set(marks).size).toBe(18);
  });

  it("an un-crossed encourager reads muted with its progress figures, no done-mark", () => {
    app.state.sessionsCompleted = 1;
    app.openModal("achievements");
    const row = document.querySelector(".ach-row:not(.unlocked)")!;
    expect(row.querySelector(".ach-mark")).toBeNull();
    // The four facts: icon, name, the shared effect, the state figures.
    expect(row.querySelector(".ach-icon svg")).not.toBeNull();
    expect(row.querySelector(".ach-effect")!.textContent).toBe("+2% ν");
    expect(row.querySelector(".ach-readout")!.textContent).toMatch(/\d+ \/ \d+/);
  });

  it("a crossed encourager wears the engraved done-mark in place of figures", () => {
    app.state.sessionsCompleted = 1;
    app.state.achievements["first-light"] = Date.now();
    app.openModal("achievements");
    const row = [...document.querySelectorAll(".ach-row")].find(
      (candidate) => candidate.querySelector(".ach-name")!.textContent === "First light",
    )!;
    expect(row.classList.contains("unlocked")).toBe(true);
    expect(row.querySelector(".ach-mark")!.textContent).toBe("✓");
    expect(row.querySelector(".ach-readout")).toBeNull();
    expect(row.querySelector(".ach-effect")!.textContent).toBe("+2% ν");
  });
});

describe("the app popovers", () => {
  it("open bare: no head, no close button, no focus-controls eyebrow", () => {
    app.openApp("habit");
    const popover = document.getElementById("app-popover")!;
    expect(popover.querySelector(".popover-head")).toBeNull();
    expect(popover.querySelector("#app-close")).toBeNull();
    expect(popover.textContent).not.toContain("Focus Controls");
    // Close so the instance's document-level click-away listener never
    // reaches into a later test's DOM.
    app.closeApp();
  });
});

describe("the planned-target affordances (§6)", () => {
  function openTimePlan(): void {
    app.openApp("time");
  }

  afterEach(() => app.closeApp());

  it("the preset chips stay as quick picks, the set gained 90, nothing preselected", () => {
    openTimePlan();
    const chips = [...document.querySelectorAll<HTMLButtonElement>(".plan-chip")];
    expect(chips.map((c) => c.textContent)).toEqual(["10", "15", "20", "25", "30", "45", "60", "90"]);
    // Visible but unpushed (ADR-0019): the resting plan is open-ended.
    expect([...document.querySelectorAll(".plan-chip.active")]).toHaveLength(0);
    expect(document.getElementById("plan-open")!.getAttribute("aria-pressed")).toBe("true");
  });

  it("picking a chip plans that many minutes", () => {
    openTimePlan();
    document.querySelector<HTMLButtonElement>('[data-plan="25"]')!.click();
    expect(app.ui.chosenTarget).toBe(1500);
    const input = document.getElementById("plan-minutes") as HTMLInputElement;
    expect(input.value).toBe("25");
    expect(input.disabled).toBe(false);
  });

  it("free entry takes any whole minute from 1 to 90 and clamps past the range", () => {
    openTimePlan();
    const commit = (value: string): HTMLInputElement => {
      const input = document.getElementById("plan-minutes") as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event("change"));
      return document.getElementById("plan-minutes") as HTMLInputElement;
    };
    commit("37");
    expect(app.ui.chosenTarget).toBe(37 * 60);
    commit("200");
    expect(app.ui.chosenTarget).toBe(90 * 60);
    commit("0");
    expect(app.ui.chosenTarget).toBe(60);
    const minutes = commit("3.6");
    expect(app.ui.chosenTarget).toBe(4 * 60);
    expect(minutes.value).toBe("4");
  });

  it("open-ended is its own mode, not a duration choice", () => {
    openTimePlan();
    document.getElementById("plan-open")!.click();
    expect(app.ui.chosenTarget).toBeNull();
    expect(document.getElementById("plan-open")!.getAttribute("aria-pressed")).toBe("true");
    const input = document.getElementById("plan-minutes") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect([...document.querySelectorAll(".plan-chip.active")]).toHaveLength(0);
    expect(document.querySelector("#app-popover .clock-caption")!.textContent).toBe("Open-ended");
  });
});

// Issue #115: a focus-control pick must patch the affected bits in place —
// the popover and modal keep their DOM identity, focus stays on the
// control, and scroll rides through — never a whole-surface rebuild. Node
// identity is the assertable core of that contract.
describe("interaction continuity (#115)", () => {
  afterEach(() => app.closeApp());

  it("a plan chip pick patches the popover in place: identity, pressed state, focus, and scroll all survive", () => {
    app.openApp("time");
    const popover = document.getElementById("app-popover")!;
    const chip = document.querySelector<HTMLButtonElement>('#app-popover [data-plan="25"]')!;
    const input = document.getElementById("plan-minutes") as HTMLInputElement;
    const openButton = document.getElementById("plan-open")!;
    popover.scrollTop = 120;
    chip.focus();
    chip.click();
    expect(app.ui.chosenTarget).toBe(1500);
    // Nothing rebuilt: the popover and every control kept their nodes.
    expect(document.getElementById("app-popover")).toBe(popover);
    expect(document.querySelector('#app-popover [data-plan="25"]')).toBe(chip);
    expect(document.getElementById("plan-minutes")).toBe(input);
    expect(document.getElementById("plan-open")).toBe(openButton);
    // The picked chip's state moved at once, and the free entry followed.
    expect(chip.classList.contains("active")).toBe(true);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(input.value).toBe("25");
    expect(input.disabled).toBe(false);
    // Focus stayed on the chip; the popover's scroll offset rode through.
    expect(document.activeElement).toBe(chip);
    expect(popover.scrollTop).toBe(120);
  });

  it("committing a custom minute value keeps focus in the minutes input", () => {
    app.openApp("time");
    // The resting plan is open-ended, so the free entry starts disabled; a
    // chip pick arms it — the state the input is typed into.
    const chip = document.querySelector<HTMLButtonElement>('#app-popover [data-plan="25"]')!;
    chip.click();
    expect(chip.classList.contains("active")).toBe(true);
    const input = document.getElementById("plan-minutes") as HTMLInputElement;
    input.focus();
    input.value = "37";
    input.dispatchEvent(new Event("change"));
    expect(app.ui.chosenTarget).toBe(37 * 60);
    expect(document.getElementById("plan-minutes")).toBe(input);
    expect(input.value).toBe("37");
    expect(document.activeElement).toBe(input);
    // The custom value is its own plan: the preset chip's pressed state
    // cleared in place.
    expect(chip.classList.contains("active")).toBe(false);
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    // The console clock followed without touching the session controls.
    expect(document.querySelector("#console-session .session-clock")!.textContent).toBe("37:00");
    expect(document.getElementById("flow-switch")!.isConnected).toBe(true);
  });

  it("the open-ended toggle disables the input in place, and focus survives on the toggle", () => {
    app.openApp("time");
    document.querySelector<HTMLButtonElement>('#app-popover [data-plan="30"]')!.click();
    const toggle = document.getElementById("plan-open")!;
    const input = document.getElementById("plan-minutes") as HTMLInputElement;
    const popover = document.getElementById("app-popover")!;
    popover.scrollTop = 90;
    toggle.focus();
    toggle.click();
    expect(app.ui.chosenTarget).toBeNull();
    expect(document.getElementById("app-popover")).toBe(popover);
    expect(document.getElementById("plan-open")).toBe(toggle);
    expect(document.getElementById("plan-minutes")).toBe(input);
    expect(input.disabled).toBe(true);
    expect(input.value).toBe("");
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(toggle);
    expect(popover.scrollTop).toBe(90);
    expect(document.querySelector("#app-popover .clock-caption")!.textContent).toBe("Open-ended");
  });

  it("the enter prompt's kind switch swaps the pane without rebuilding the modal; focus survives on the tab", () => {
    createHabit(app.state, "Jammin");
    app.startFlow();
    const modal = document.getElementById("modal-content")!;
    const tab = modal.querySelector<HTMLButtonElement>('[data-enter-kind="new"]')!;
    tab.focus();
    tab.click();
    expect(app.ui.enter.kind).toBe("new");
    // The modal shell and the tab kept their nodes; the pane swapped beneath.
    expect(document.getElementById("modal-content")).toBe(modal);
    expect(modal.querySelector('[data-enter-kind="new"]')).toBe(tab);
    expect(document.activeElement).toBe(tab);
    expect(tab.getAttribute("aria-pressed")).toBe("true");
    expect(modal.querySelector('.mode-tab[data-enter-kind="habit"]')!.getAttribute("aria-pressed")).toBe("false");
    // The pane and footer followed at once (#95's contract).
    expect(document.getElementById("enter-habit-name")).not.toBeNull();
    const begin = document.getElementById("enter-begin") as HTMLButtonElement;
    expect(begin.textContent).toBe("Name your new habit");
    expect(begin.disabled).toBe(true);
    expect(modal.querySelector(".cta-summary")!.textContent).toBe("name it to arm the start");
  });

  it("picking a habit in the enter prompt keeps the choice buttons and moves the footer in place", () => {
    const created = createHabit(app.state, "Jammin");
    createHabit(app.state, "Etudes");
    app.startFlow();
    const modal = document.getElementById("modal-content")!;
    const choice = modal.querySelector<HTMLButtonElement>(`[data-enter-habit="${created.habit!.id}"]`)!;
    const list = modal.querySelector(".enter-choices") as HTMLElement;
    list.scrollTop = 60;
    choice.focus();
    choice.click();
    expect(document.getElementById("modal-content")).toBe(modal);
    expect(modal.querySelector(`[data-enter-habit="${created.habit!.id}"]`)).toBe(choice);
    expect(document.activeElement).toBe(choice);
    // The inner list is the same node, scroll untouched.
    expect(modal.querySelector(".enter-choices")).toBe(list);
    expect(list.scrollTop).toBe(60);
    expect(choice.classList.contains("selected")).toBe(true);
    expect(choice.getAttribute("aria-pressed")).toBe("true");
    const begin = document.getElementById("enter-begin") as HTMLButtonElement;
    expect(begin.textContent).toBe("Begin — Jammin · open-ended");
    expect(begin.disabled).toBe(false);
    expect(modal.querySelector(".cta-summary")!.textContent).toBe("Jammin · open-ended");
  });

  it("typed names keep the modal off the rebuild path: a later render leaves the input node alone", () => {
    app.startFlow();
    document.querySelector<HTMLButtonElement>('#modal-content [data-enter-kind="new"]')!.click();
    const input = document.getElementById("enter-habit-name") as HTMLInputElement;
    input.focus();
    input.value = "Sketching";
    input.dispatchEvent(new Event("input"));
    const modal = document.getElementById("modal-content")!;
    app.render();
    expect(document.getElementById("modal-content")).toBe(modal);
    expect(document.getElementById("enter-habit-name")).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(document.getElementById("enter-begin")!.textContent).toBe("Begin — Sketching · open-ended");
  });
});

describe("the settings preferences (§5)", () => {
  it("carries one global mute toggle that gates and persists", () => {
    app.openModal("settings");
    const toggle = document.getElementById("pref-mute") as HTMLInputElement;
    expect(toggle).not.toBeNull();
    expect(toggle.checked).toBe(false);
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    expect(app.state.muted).toBe(true);
    const saved = JSON.parse(localStorage.getItem("flowsynth.save.v1")!);
    expect(saved.state.muted).toBe(true);
  });
});

describe("the Time app's history (§9)", () => {
  function runHitSession(): void {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, 600, DAY);
    advance(s, 600);
    endSession(s, DAY + 600_000);
  }

  function runMissSession(): void {
    const s = app.state;
    startSession(s, 600, DAY + 1_000_000);
    advance(s, 600);
    applyGap(s, 300, "away", 0);
    flushPendingAway(s);
    resolveHonestyReport(s, "missed");
    endSession(s, DAY + 1_900_000);
  }

  afterEach(() => app.closeApp());

  it("the affordance opens the list: newest first, date · habit · credited minutes · chips", () => {
    const s = app.state;
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    runHitSession();
    selectHabit(s, null);
    runMissSession();
    s.sessionRecords[0]!.startedAt = DAY; // the hit ran the day under test
    app.openApp("time");
    document.getElementById("time-history")!.click();
    const panel = document.getElementById("app-popover")!;
    const rows = [...panel.querySelectorAll(".history-row")];
    expect(rows).toHaveLength(2);
    // Newest first: the miss session leads.
    expect(rows[0]!.textContent).toContain("unstructured");
    expect(rows[0]!.textContent).toContain("10 / 10 min");
    expect(rows[0]!.querySelector(".history-chip.miss")).not.toBeNull();
    expect(rows[1]!.textContent).toContain("Piano");
    expect(rows[1]!.textContent).toContain("10 / 10 min");
    expect(rows[1]!.querySelector(".history-chip.hit")).not.toBeNull();
    expect(rows[1]!.textContent).toMatch(/Sep 18/);
    // Open-ended minutes carry no denominator anywhere.
    expect(rows[0]!.textContent).not.toMatch(/min \/ /);
  });

  it("the list pages ~20 rows with a show-more tail", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    for (let i = 0; i < 21; i++) {
      startSession(s, null, DAY + i * 1000);
      endSession(s, DAY + i * 1000 + 500);
    }
    app.openApp("time");
    document.getElementById("time-history")!.click();
    expect(document.getElementById("app-popover")!.querySelectorAll(".history-row")).toHaveLength(20);
    document.getElementById("history-more")!.click();
    expect(document.getElementById("app-popover")!.querySelectorAll(".history-row")).toHaveLength(21);
    expect(document.getElementById("history-more")).toBeNull();
  });

  it("back from the list returns to the Time panel", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, null, DAY);
    endSession(s, DAY + 500);
    app.openApp("time");
    document.getElementById("time-history")!.click();
    expect(document.getElementById("app-popover")!.querySelector(".history-row")).not.toBeNull();
    document.getElementById("history-back")!.click();
    // The panel body is the planner again, not the record list.
    expect(document.getElementById("app-popover")!.querySelector(".history-row")).toBeNull();
    expect(document.getElementById("app-popover")!.querySelector(".plan-chips")).not.toBeNull();
    expect(document.getElementById("time-history")).not.toBeNull();
  });

  it("a row drills into the full record; notes and the rate breakdown stay out", () => {
    const s = app.state;
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    const goal = createGoal(s, { habitId: habit.id, minutes: 5, schedule: "once", now: DAY }).goal!;
    startSession(s, null, DAY);
    writeNote(s, "a private note", DAY + 1000);
    advance(s, 120);
    endSession(s, DAY + 600_000);
    recordSummaryReflection(s, { text: "held focus", slider: 5 });
    app.openApp("time");
    document.getElementById("time-history")!.click();
    document.querySelector<HTMLButtonElement>(`[data-drill="1"]`)!.click();
    const panel = document.getElementById("app-popover")!;
    expect(panel.textContent).toContain("Session 1 · Piano");
    expect(panel.textContent).toContain("Open-ended");
    expect(panel.textContent).toContain("2 min");
    expect(panel.textContent).toContain(`2 min · ${goalSummary(s, goal)}`);
    expect(panel.textContent).toContain("First light");
    expect(panel.textContent).toContain("held focus");
    expect(panel.textContent).toContain("felt great");
    // The drill-down is about practice: no note replay, no economy rate.
    expect(panel.textContent).not.toContain("a private note");
    expect(panel.textContent).not.toContain("per practice minute");
    expect(panel.textContent).not.toContain("synths +");
    // Back returns to the list; the deleted goal still renders its snapshot.
    deleteGoal(s, goal.id);
    app.openDrill(1);
    expect(document.getElementById("app-popover")!.textContent).toContain("a since-removed goal");
    document.getElementById("history-back")!.click();
    expect(document.getElementById("app-popover")!.querySelector(".history-row")).not.toBeNull();
  });

  it("one chip per row: a presence-earned hit that later missed shows the muted miss marker alone", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, 600, DAY);
    advance(s, 600); // the target hit, earned by presence
    applyGap(s, 300, "away", 0);
    flushPendingAway(s);
    resolveHonestyReport(s, "missed");
    endSession(s, DAY + 900_000);
    const record = s.sessionRecords[0]!;
    expect(recordTargetHit(record)).toBe(true);
    expect(recordMissed(record)).toBe(true);
    app.openApp("time");
    document.getElementById("time-history")!.click();
    const row = document.querySelector(".history-row")!;
    expect(row.querySelectorAll(".history-chip")).toHaveLength(1);
    expect(row.querySelector(".history-chip.miss")).not.toBeNull();
    // The minutes figure still shows the hit factually.
    expect(row.textContent).toContain("10 / 10 min");
    app.closeApp();
  });

  it("the drill-down renders each honesty event as a neutral factual line", () => {
    runMissSession();
    app.openApp("time");
    document.getElementById("time-history")!.click();
    document.querySelector<HTMLButtonElement>('[data-drill="1"]')!.click();
    const panel = document.getElementById("app-popover")!;
    expect(panel.textContent).toContain("5 min away · didn't practice");
    expect(panel.textContent).toContain("Planned · 10:00");
    expect(panel.textContent).toContain("10 / 10 min");
  });
});

describe("the Habit app's development summary (§9)", () => {
  afterEach(() => app.closeApp());

  it("aggregates read the practice log; tagged notes list newest first", () => {
    const s = app.state;
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    startSession(s, null, DAY);
    writeNote(s, "first", DAY + 1000);
    writeNote(s, "second", DAY + 2000);
    advance(s, 60);
    endSession(s, DAY + 120_000);
    addPracticeLog(s, habit.id, 10, DAY + 500_000);
    app.openApp("habit");
    document.querySelector<HTMLButtonElement>(`[data-summary="${habit.id}"]`)!.click();
    const summary = document.querySelector(`[data-summary-for="${habit.id}"]`)!;
    expect(summary.textContent).toContain("1 min"); // lifetime = credited 60s
    expect(summary.textContent).toContain("Sessions practiced");
    expect(summary.textContent).toContain("1");
    expect(summary.textContent).toContain("Last practiced");
    expect(summary.textContent).toContain("Sep 18, 2026");
    const notes = [...summary.querySelectorAll(".note-entry p")].map((n) => n.textContent);
    expect(notes).toEqual(["second", "first"]);
    // The stamp carries the date and the in-session clock.
    expect(summary.querySelector(".note-when")!.textContent).toContain("Sep 18");
    expect(summary.querySelector(".note-when")!.textContent).toContain("S1 ·");
  });

  it("archiving hides the habit from selection but keeps its summary reachable", () => {
    const s = app.state;
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    startSession(s, null, DAY);
    writeNote(s, "a thought", DAY + 1000);
    advance(s, 60);
    endSession(s, DAY + 120_000);
    archiveHabit(s, habit.id);
    app.openApp("habit");
    const popover = document.getElementById("app-popover")!;
    expect(popover.querySelector(`[data-pick="${habit.id}"]`)).toBeNull();
    expect(popover.textContent).toContain("ARCHIVED");
    document.querySelector<HTMLButtonElement>(`.habit-archived [data-summary="${habit.id}"]`)!.click();
    const summary = document.querySelector(`[data-summary-for="${habit.id}"]`)!;
    expect(summary.textContent).toContain("a thought");
    // Renames resolve forward through the archived summary's habit tile.
    expect(popover.querySelector(".habit-archived .habit-name")!.textContent).toBe("Piano");
  });
});

describe("the Notes stream's habit chips (§9)", () => {
  it("tagged notes wear their habit; unstructured and between-sessions notes wear none", () => {
    const s = app.state;
    const habit = createHabit(s, "Piano").habit!;
    selectHabit(s, habit.id);
    startSession(s, null, DAY);
    writeNote(s, "keyed to piano", DAY + 1000);
    s.activeHabitId = null;
    writeNote(s, "unstructured thought", DAY + 2000);
    endSession(s, DAY + 120_000);
    writeNote(s, "between sessions", DAY + 300_000);
    app.openApp("notes");
    const entries = [...document.querySelectorAll(".note-entry")];
    expect(entries).toHaveLength(3);
    // Newest first: the between-sessions note leads, the tagged one trails.
    expect(entries[0]!.querySelector(".habit-chip")).toBeNull();
    expect(entries[1]!.querySelector(".habit-chip")).toBeNull();
    expect(entries[2]!.querySelector(".habit-chip")!.textContent).toBe("Piano");
    app.closeApp();
  });

  it("the stream shows everything it keeps — no recent-window cap", () => {
    const s = app.state;
    for (let i = 0; i < 10; i++) writeNote(s, `note ${i}`, DAY + i * 1000);
    app.openApp("notes");
    const entries = [...document.querySelectorAll(".note-entry")];
    expect(entries).toHaveLength(10);
    // Newest first: the last capture leads.
    expect(entries[0]!.querySelector("p")!.textContent).toBe("note 9");
    app.closeApp();
  });
});

describe("the Goals panel's slots and purchase row (#150)", () => {
  const panel = () => document.getElementById("app-popover")!;

  it("reads tracked goals first — open work above completed — then the empty add-goal slot", () => {
    const s = app.state;
    const habit = createHabit(s, "Piano").habit!;
    s.goalCapacityBought = 2; // room for the add-goal slot to stand beside the tracked three
    createGoal(s, { habitId: habit.id, minutes: 20, schedule: "daily", now: DAY });
    const recurringDone = createGoal(s, { habitId: habit.id, minutes: 5, schedule: "daily", now: DAY }).goal!;
    accrueGoalProgress(s, habit.id, 300); // completes the daily goal until its reset
    const onceDone = createGoal(s, { habitId: habit.id, minutes: 5, schedule: "once", now: DAY }).goal!;
    accrueGoalProgress(s, habit.id, 300); // completes the once goal for good
    app.openApp("goals");
    const rows = [...panel().querySelectorAll(".goal-row")];
    expect(rows).toHaveLength(3);
    expect(rows[0]!.classList.contains("done")).toBe(false);
    expect(rows[0]!.textContent).toContain("20 min");
    // Completed occurrences trail the open work, creation order kept.
    expect(rows[1]!.classList.contains("done")).toBe(true);
    expect(rows[1]!.getAttribute("data-goal")).toBe(recurringDone.id);
    expect(rows[2]!.classList.contains("done")).toBe(true);
    expect(rows[2]!.getAttribute("data-goal")).toBe(onceDone.id);
    // The slots then the purchase row: the add form trails the tracked
    // goals, the capacity purchase trails the slots.
    const sequence = [...panel().querySelectorAll(".goal-row, .goal-create, .long-goal-row")].map(
      (el) => el.className,
    );
    expect(sequence.at(-2)).toContain("goal-create");
    expect(sequence.at(-1)).toContain("long-goal-row");
  });

  it("a full tracker hides the add form and keeps the purchase row last", () => {
    const s = app.state;
    const habit = createHabit(s, "Piano").habit!;
    createGoal(s, { habitId: habit.id, minutes: 20, schedule: "daily", now: DAY });
    createGoal(s, { habitId: habit.id, minutes: 10, schedule: "once", now: DAY });
    app.openApp("goals");
    expect(panel().querySelector(".goal-slots")!.textContent).toContain("2/2");
    expect(panel().querySelector(".goal-create")).toBeNull();
    const section = panel().querySelector(".focus-controls")!.children;
    expect(section[section.length - 1]!.className).toContain("long-goal-row");
  });

  it("the purchase row is compact: one more slot at the next price, label and help text dropped", () => {
    app.openApp("goals");
    const row = panel().querySelector(".long-goal-row")!;
    expect(row.textContent).not.toContain("CONSOLE LONG GOAL");
    expect(row.textContent).not.toContain("→");
    expect(row.textContent).not.toContain("2 → 4");
    expect(row.querySelector(".long-goal-name")!.textContent).toBe("One more goal slot");
    expect(row.querySelector("#long-goal-buy")!.textContent).toBe(`${formatInt(longGoalCost(0))} ν`);
  });

  it("each purchase adds exactly one slot and reveals the next, steeper price — back-to-back when affordable", () => {
    const s = app.state;
    s.nous = longGoalCost(0) + longGoalCost(1);
    app.openApp("goals");
    const slots = () => panel().querySelector(".goal-slots")!.textContent;
    const buy = () => document.getElementById("long-goal-buy") as HTMLButtonElement;
    expect(slots()).toContain("0/2");
    buy()!.click();
    expect(slots()).toContain("0/3");
    expect(s.goalCapacityBought).toBe(1);
    expect(buy().textContent).toBe(`${formatInt(longGoalCost(1))} ν`);
    // No occupancy gate: the second slot buys with the tracker still empty.
    buy().click();
    expect(slots()).toContain("0/4");
    expect(s.goalCapacityBought).toBe(2);
  });
});
