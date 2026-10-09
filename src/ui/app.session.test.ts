// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { App } from "./app";
import { createHabit, selectHabit } from "../engine/habits";
import { recordSummaryReflection } from "../engine/actions";
import { SAVE_VERSION } from "../engine/constants";
import { STORAGE_KEY, serialize } from "../engine/save";
import { startSession, endSession } from "../engine/actions";
import { advance } from "../engine/advance";
import { applyGap, poolOutstanding } from "../engine/trust";
import type { GameState } from "../engine/types";
import { createAppFixture, setVisibility } from "./testing/app-fixture";
import { makeRecorder } from "./testing/signal-recorder";

// session rendering and interaction on the production HTML skeleton.
const fixture = createAppFixture();
const boot = fixture.boot;
let app: App;

beforeEach(() => {
  localStorage.clear();
  app = boot();
});
afterEach(() => fixture.release());

function stubChannels() {
  const recorder = makeRecorder();
  return { ...recorder, app: boot(recorder.channels) };
}

describe("the enter prompt", () => {
  it("only opens when no habit is selected; a selected habit starts directly", () => {
    app.startFlow();
    expect(app.ui.modal).toBe("enter");
    const modal = document.getElementById("modal-content")!;
    expect(modal.querySelector("h2")!.textContent).toBe("What are you practicing?");
    expect(modal.querySelector(".lead")).toBeNull();
    // The decided shape (issue #92): a kind-first segmented control, with
    // unstructured as its own resting pane, not a row in a shared list.
    const tabs = [...modal.querySelectorAll(".mode-tab")].map((t) => t.textContent);
    expect(tabs).toEqual(["A habit", "New habit", "Unstructured"]);
    expect(modal.querySelector(".mode-tab.active")!.textContent).toBe("A habit");
    // The fresh-save habit pane is empty: it points at the way out.
    expect(modal.querySelector(".mode-pane")!.textContent).toContain("No habits yet");
    expect(modal.textContent).not.toContain("development holds still");

    app.closeModal();
    const created = createHabit(app.state, "Jammin");
    selectHabit(app.state, created.habit!.id);
    app.startFlow();
    expect(app.ui.modal).toBeNull();
    expect(app.state.mode).toBe("flow");
    expect(app.state.activeHabitId).toBe(created.habit!.id);
  });

  it("carries a pointer to the Time app, not a second copy of the plan controls (§7)", () => {
    app.startFlow();
    const modal = document.getElementById("modal-content")!;
    // Planning lives only in the Time app — the prompt points there.
    expect(modal.querySelectorAll(".plan-chip")).toHaveLength(0);
    expect(modal.querySelector("#plan-minutes")).toBeNull();
    expect(modal.querySelector(".enter-plan-hint")!.textContent).toContain("Time app");
    // Session one's steer still rides above it (ADR-0019).
    expect(modal.querySelector(".enter-steer")!.textContent).toContain("five minutes");
  });

  it("the Time app owns the plan affordances: a picked chip plans the next session and lights the console clock", () => {
    const created = createHabit(app.state, "Jammin");
    selectHabit(app.state, created.habit!.id);
    app.openApp("time");
    const popover = document.getElementById("app-popover")!;
    expect(popover.querySelectorAll(".plan-chip")).toHaveLength(8);
    expect(popover.querySelectorAll(".plan-chip.active")).toHaveLength(0);
    document.querySelector<HTMLButtonElement>('#app-popover [data-plan="25"]')!.click();
    expect(app.ui.chosenTarget).toBe(1500);
    // The pick re-renders the popover at once: the chip highlights.
    expect([...document.querySelectorAll("#app-popover .plan-chip.active")].map((c) => c.textContent)).toEqual(["25"]);
    // The console clock wears the armed plan, the Time tile's state with it.
    expect(document.querySelector("#console-session .session-clock")!.textContent).toBe("25:00");
    expect(document.querySelector("#console-session .clock-caption")!.textContent).toBe("planned");
    // Open-ended stays its own mode.
    document.querySelector<HTMLButtonElement>("#app-popover #plan-open")!.click();
    expect(app.ui.chosenTarget).toBeNull();
    expect(document.querySelector("#console-session .session-clock")!.textContent).toBe("--:--");
    // The armed plan rides into the session.
    selectHabit(app.state, created.habit!.id);
    document.querySelector<HTMLButtonElement>('#app-popover [data-plan="25"]')!.click();
    app.startFlow();
    expect(app.state.mode).toBe("flow");
    expect(app.state.session!.target).toBe(1500);
  });

  it("every accepted plan change moves the console clock, not just the first (issue #114)", () => {
    app.openApp("time");
    const clock = () => document.querySelector("#console-session .session-clock")!.textContent;
    const caption = () => document.querySelector("#console-session .clock-caption")!.textContent;
    document.querySelector<HTMLButtonElement>('#app-popover [data-plan="25"]')!.click();
    expect(clock()).toBe("25:00");
    // A second, value-to-value change must still reach the clock node — by
    // chip and by free entry alike.
    document.querySelector<HTMLButtonElement>('#app-popover [data-plan="45"]')!.click();
    expect(clock()).toBe("45:00");
    expect(caption()).toBe("planned");
    const input = document.getElementById("plan-minutes") as HTMLInputElement;
    input.value = "40";
    input.dispatchEvent(new Event("change"));
    expect(clock()).toBe("40:00");
    expect(caption()).toBe("planned");
    document.querySelector<HTMLButtonElement>("#app-popover #plan-open")!.click();
    expect(clock()).toBe("--:--");
    expect(caption()).toBe("open-ended");
    document.querySelector<HTMLButtonElement>('#app-popover [data-plan="60"]')!.click();
    expect(clock()).toBe("1:00:00");
    expect(caption()).toBe("planned");
  });

  it("the footer's Begin CTA arms per the kind: a habit picked, then the session counts toward it", () => {
    const created = createHabit(app.state, "Jammin");
    app.startFlow();
    const begin = () => document.getElementById("modal-content")!.querySelector("#enter-begin") as HTMLButtonElement;
    // Nothing picked yet: the CTA names its own missing requirement.
    expect(begin().disabled).toBe(true);
    expect(begin().textContent).toBe("Select a habit");
    document.querySelector<HTMLButtonElement>(`#modal-content [data-enter-habit="${created.habit!.id}"]`)!.click();
    const modal = document.getElementById("modal-content")!;
    expect(modal.querySelector(`[data-enter-habit="${created.habit!.id}"]`)!.classList.contains("selected")).toBe(true);
    expect(begin().disabled).toBe(false);
    expect(begin().textContent).toBe("Begin — Jammin · open-ended");
    expect(modal.querySelector(".cta-summary")!.textContent).toBe("Jammin · open-ended");
    begin().click();
    expect(app.state.mode).toBe("flow");
    expect(app.state.activeHabitId).toBe(created.habit!.id);
    expect(app.ui.modal).toBeNull();
  });

  it("the New habit kind arms on a typed name and starts with the habit created", () => {
    app.startFlow();
    document.querySelector<HTMLButtonElement>('#modal-content [data-enter-kind="new"]')!.click();
    const begin = () => document.getElementById("modal-content")!.querySelector("#enter-begin") as HTMLButtonElement;
    const input = document.getElementById("enter-habit-name") as HTMLInputElement;
    expect(begin().disabled).toBe(true);
    expect(begin().textContent).toBe("Name your new habit");
    // Typing arms the CTA in place — the input never leaves the DOM, so the
    // caret keeps its place.
    input.value = "Sketching";
    input.dispatchEvent(new Event("input"));
    expect(input.isConnected).toBe(true);
    expect(begin().disabled).toBe(false);
    expect(begin().textContent).toBe("Begin — Sketching · open-ended");
    // A plan armed in the Time app rides into the label too.
    app.openApp("time");
    document.querySelector<HTMLButtonElement>('#app-popover [data-plan="10"]')!.click();
    app.closeApp();
    app.startFlow();
    document.querySelector<HTMLButtonElement>('#modal-content [data-enter-kind="new"]')!.click();
    const input2 = document.getElementById("enter-habit-name") as HTMLInputElement;
    input2.value = "Sketching";
    input2.dispatchEvent(new Event("input"));
    expect(document.getElementById("enter-begin")!.textContent).toBe("Begin — Sketching · 10 min");
    document.getElementById("enter-begin")!.click();
    expect(app.state.mode).toBe("flow");
    expect(app.state.habits.map((h) => h.name)).toContain("Sketching");
    expect(app.state.activeHabitId).toBe(app.state.habits.find((h) => h.name === "Sketching")!.id);
    expect(app.state.session!.target).toBe(600);
  });

  it("Enter in the name field starts when the CTA is armed, never before", () => {
    app.startFlow();
    document.querySelector<HTMLButtonElement>('#modal-content [data-enter-kind="new"]')!.click();
    const input = document.getElementById("enter-habit-name") as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(app.state.mode).toBe("upgrade");
    input.value = "Sketching";
    input.dispatchEvent(new Event("input"));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(app.state.mode).toBe("flow");
  });

  it("habit names render as text in the footer, never markup", () => {
    const created = createHabit(app.state, "<b>Logo</b>");
    app.startFlow();
    document.querySelector<HTMLButtonElement>(`#modal-content [data-enter-habit="${created.habit!.id}"]`)!.click();
    const begin = document.getElementById("enter-begin")!;
    expect(begin.textContent).toBe("Begin — <b>Logo</b> · open-ended");
    expect(begin.querySelector("b")).toBeNull();
  });

  it("the Unstructured kind is always armed and starts with no habit", () => {
    createHabit(app.state, "Jammin");
    app.startFlow();
    document.querySelector<HTMLButtonElement>('#modal-content [data-enter-kind="unstructured"]')!.click();
    const modal = document.getElementById("modal-content")!;
    expect(modal.querySelector('.mode-tab[data-enter-kind="unstructured"]')!.getAttribute("aria-pressed")).toBe("true");
    expect(modal.textContent).toContain("No habit attached — the session runs, and nous is unaffected.");
    const begin = document.getElementById("enter-begin") as HTMLButtonElement;
    expect(begin.disabled).toBe(false);
    expect(begin.textContent).toBe("Begin — unstructured · open-ended");
    begin.click();
    expect(app.state.mode).toBe("flow");
    expect(app.state.activeHabitId).toBeNull();
  });

  it("Back closes the prompt, and reopening starts the selection fresh", () => {
    const created = createHabit(app.state, "Jammin");
    app.startFlow();
    document.querySelector<HTMLButtonElement>(`#modal-content [data-enter-habit="${created.habit!.id}"]`)!.click();
    document.getElementById("enter-cancel")!.click();
    expect(app.ui.modal).toBeNull();
    app.startFlow();
    const modal = document.getElementById("modal-content")!;
    // The kind-first selection resets: nothing picked, nothing armed.
    expect(modal.querySelectorAll(".enter-choice.selected")).toHaveLength(0);
    expect((document.getElementById("enter-begin") as HTMLButtonElement).disabled).toBe(true);
    expect(document.getElementById("enter-begin")!.textContent).toBe("Select a habit");
  });

  it("a plan armed in the Time app plans session one; the steer leaves after the first session", () => {
    app.openApp("time");
    document.querySelector<HTMLButtonElement>('#app-popover [data-plan="25"]')!.click();
    app.closeApp();
    expect(app.ui.chosenTarget).toBe(1500);
    const created = createHabit(app.state, "Jammin");
    selectHabit(app.state, created.habit!.id);
    app.startFlow();
    expect(app.state.session!.target).toBe(1500);
    endSession(app.state);
    // Clear the selection so the prompt opens again.
    selectHabit(app.state, null);
    app.startFlow();
    expect(document.querySelector(".enter-steer")).toBeNull();
  });
});

describe("the session clock", () => {
  function runPlanned(state: GameState): void {
    state.sessionsCompleted = 1;
    app.ui.chosenTarget = 600;
    startSession(state, 600);
    advance(state, 240);
  }

  it("counts down what remains on a planned session, filling the header strip", () => {
    runPlanned(app.state);
    app.render();
    expect(document.getElementById("session-clock")!.textContent).toBe("06:00");
    expect(document.getElementById("session-strip-fill")!.style.width).toBe("40%");
  });

  it("counts up open-ended, pulsing the header strip instead of filling it", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, null);
    advance(s, 90);
    app.render();
    expect(document.getElementById("session-clock")!.textContent).toBe("01:30");
    // Every running state names itself: open-ended's caption says so.
    expect(document.getElementById("session-caption")!.textContent).toBe("open-ended");
    expect(document.getElementById("session-strip")!.classList.contains("pulse")).toBe(true);
    expect(document.getElementById("session-strip-fill")!.style.width).toBe("100%");
  });

  it("holds the header strip while paused: width kept, no pulse — planned or open-ended", () => {
    runPlanned(app.state);
    app.pause();
    app.render();
    const strip = document.getElementById("session-strip")!;
    const fill = document.getElementById("session-strip-fill")!;
    expect(strip.classList.contains("pulse")).toBe(false);
    expect(fill.style.width).toBe("40%");
    app.resume();
    const s = app.state;
    s.session!.target = null;
    app.pause();
    app.render();
    expect(strip.classList.contains("pulse")).toBe(false);
    expect(fill.style.width).toBe("100%");
  });

  it("leaves the header strip empty in upgrade mode", () => {
    app.render();
    expect(document.getElementById("session-strip")!.classList.contains("pulse")).toBe(false);
    expect(document.getElementById("session-strip-fill")!.style.width).toBe("0%");
  });

  it("the summary carries the reflection slot above its continue action", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, 600);
    advance(s, 60);
    endSession(s);
    app.ui.modal = "summary";
    app.render();
    const modal = document.getElementById("modal-content")!;
    const slider = document.getElementById("summary-reflection-slider") as HTMLInputElement;
    const text = document.getElementById("summary-reflection-text") as HTMLInputElement;
    const continueButton = document.getElementById("summary-continue")!;
    expect(slider).not.toBeNull();
    expect(text).not.toBeNull();
    // The 1–5 range holds, continuous (#233): end labels only, the middle
    // neutral and the default, decimals welcome.
    expect(slider.min).toBe("1");
    expect(slider.max).toBe("5");
    expect(slider.step).toBe("any");
    expect(slider.value).toBe("3");
    expect(text.value).toBe("");
    expect(modal.textContent).toContain("Reflect");
    expect(modal.textContent).toContain("rough");
    expect(modal.textContent).toContain("great");
    // The reserved slot rides above dismissal.
    expect(slider.compareDocumentPosition(continueButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("the summary's rolls line reads one source plainly and splits both (ADR-0041)", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    // Practice only: one flow-minted roll.
    s.summary = {
      sessionNumber: 2,
      earned: 30,
      seconds: 300,
      ratePerMinute: 6,
      synths: 0.1,
      infusors: 0,
      empowerment: 1,
      timeUnlocked: false,
      plannedTarget: null,
      honestyEvents: [],
      achievements: [],
      rollsFlow: 1,
      rollsForge: 0,
      rollsMutator: 0,
      reflection: null,
      seen: false,
    };
    app.ui.modal = "summary";
    app.render();
    let modal = document.getElementById("modal-content")!;
    expect(modal.textContent).toContain("Rolls");
    expect(modal.textContent).toContain("1 roll");
    expect(modal.textContent).toContain("from practice");
    expect(modal.textContent).not.toContain("from charge");
    // Both sources: the line splits its attribution.
    s.summary.rollsFlow = 2;
    s.summary.rollsForge = 1;
    app.render();
    modal = document.getElementById("modal-content")!;
    expect(modal.textContent).toContain("3 rolls");
    expect(modal.textContent).toContain("2 from practice · 1 from charge");
    // No rolls at all: no row.
    s.summary.rollsFlow = 0;
    s.summary.rollsForge = 0;
    app.render();
    const keys = [...document.querySelectorAll("#modal-content .folio-key")].map((k) => k.textContent);
    expect(keys).not.toContain("Rolls");
    app.closeModal();
  });
});

describe("the ruled folio surfaces (#279)", () => {
  it("the summary is a headline figure over ruled rows; unlocks wear NEW; the breakdown rides the RATE tooltip", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    s.summary = {
      sessionNumber: 12,
      earned: 148,
      seconds: 1200,
      ratePerMinute: 7.4,
      synths: 0.26,
      infusors: 0.052,
      empowerment: 1,
      timeUnlocked: false,
      plannedTarget: 1200,
      honestyEvents: [{ awaySeconds: 1320, outcome: "missed" }],
      achievements: ["first-prestige"],
      rollsFlow: 1,
      rollsForge: 0,
      rollsMutator: 0,
      reflection: null,
      seen: false,
    };
    app.ui.modal = "summary";
    app.render();
    const modal = document.getElementById("modal-content")!;
    // The headline figure is the identity: earned nous with the unit, the
    // session read beside it — no sentence restates the figure.
    const head = modal.querySelector(".summary-head")!;
    expect(head.querySelector(".summary-earned")!.textContent).toBe("148 ν");
    expect(head.textContent).toContain("Banked · Session 12");
    // The ruled rows read practice, rate, rolls — figures right-aligned —
    // and the honesty event as a neutral factual line in its own row.
    const rows = [...modal.querySelectorAll(".folio-rows")][0]!.querySelectorAll(".folio-row");
    const keyed = new Map([...rows].map((row) => [row.querySelector(".folio-key")!.textContent, row.textContent]));
    expect(keyed.get("Practice")).toContain("20 / 20 min");
    expect(keyed.get("Rolls")).toContain("1 roll");
    expect(keyed.get("Honesty")).toContain("22 min away · didn't practice");
    // The rate breakdown lives in the RATE row's tooltip, not the row body.
    const rateRow = [...rows].find((row) => row.querySelector(".inst-tip-body"))!;
    expect(rateRow.querySelector(".folio-key")!.textContent).toContain("Rate");
    const tip = rateRow.querySelector(".inst-tip-body")!;
    expect(tip.textContent).toContain("synths +0.26 ν/s");
    expect(tip.textContent).toContain("boosters +0.05 ν/s");
    // The rate row's figure alone stays critical outside the tooltip.
    expect(rateRow.querySelector(".folio-fig")!.textContent).toContain("7.4 ν/min");
    // Unlocks wear the engraved NEW mark.
    const unlockRow = [...rows].find((row) => row.querySelector(".folio-key")!.textContent === "Unlocked")!;
    expect(unlockRow.querySelector(".folio-new")!.textContent).toBe("NEW");
    expect(unlockRow.textContent).toContain("First prestige");
    // The reflection keeps its reserved slot between the rows and Continue.
    const reflect = modal.querySelector(".folio-reflect .folio-key")!;
    expect(reflect.textContent).toBe("Reflect");
    expect(reflect.closest(".folio-row")!.compareDocumentPosition(document.getElementById("summary-continue")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    app.closeModal();
  });

  it("the Time unlock joins the folio with its own NEW mark", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, 600);
    advance(s, 60);
    endSession(s);
    // Launch leaves the row inert (ADR-0019: free from minute 0); the
    // ladder's first tenant is the presentation case.
    s.summary!.timeUnlocked = true;
    app.ui.modal = "summary";
    app.render();
    const rows = [...document.querySelectorAll("#modal-content .folio-row")];
    const timeRow = rows.find((row) => row.textContent!.includes("Time your flow sessions"))!;
    expect(timeRow).toBeTruthy();
    expect(timeRow.querySelector(".folio-new")!.textContent).toBe("NEW");
    app.closeModal();
  });

  it("the report leads with its readout, keeps the taken-back line, and needs no tooltip", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, 600);
    advance(s, 600);
    advance(s, 1, Math.random, "provisional");
    s.session!.accounting.poolSeconds = 300;
    s.session!.accounting.bucketNous = 30;
    app.tick();
    const modal = document.getElementById("modal-content")!;
    // The readout leads: away time against the plan, the held bucket beside.
    const readout = modal.querySelector(".honesty-readout .folio-row")!;
    expect(readout.querySelector(".honesty-read")!.textContent).toBe("5 min away · past your plan");
    expect(readout.querySelector(".honesty-held")!.textContent).toBe("30 ν held");
    // The reassurance stays visible as a plain line.
    expect(modal.querySelector(".honesty-readout")!.textContent).toContain("Nothing already banked is taken back.");
    // Choices are full-width rule-line rows; each consequence is a mono
    // line beneath its label — and no tooltip layer exists on the surface.
    const choices = [...modal.querySelectorAll(".honesty-choice")];
    expect(choices).toHaveLength(3);
    for (const choice of choices) {
      expect(choice.querySelector(".honesty-label")).not.toBeNull();
      expect(choice.querySelector(".honesty-consequence")!.classList.contains("mono")).toBe(true);
    }
    expect(choices[0]!.querySelector(".honesty-consequence")!.textContent).toContain("the 30 ν drop");
    expect(modal.querySelector(".inst-tip")).toBeNull();
    app.closeModal();
  });
});

describe("the honesty report", () => {
  // Overrun away time past a 600 s plan: 300 s provisional.
  function stageProvisionalPool(s: GameState, target: number | null): void {
    s.sessionsCompleted = 1;
    startSession(s, target);
    advance(s, target ?? 0);
    advance(s, 1, Math.random, "provisional");
    s.session!.accounting.poolSeconds = 300;
    s.session!.accounting.bucketNous = 30;
  }

  it("a return with the pool outstanding opens the mandatory report mid-session", () => {
    stageProvisionalPool(app.state, 600);
    app.tick();
    expect(app.ui.modal).toBe("honesty");
    const modal = document.getElementById("modal-content")!;
    expect(modal.textContent).toContain("5 min");
    expect(modal.textContent).toContain("30 ν");
    // Planned sessions offer all three outcomes, consequences inline.
    const outcomes = [...modal.querySelectorAll("[data-honesty]")].map((b) => b.getAttribute("data-honesty"));
    expect(outcomes).toEqual(["missed", "planned", "full"]);
    expect(modal.textContent).toContain("the 30 ν drop");
    expect(modal.textContent).toContain("the ν banks");
    // Non-dismissible: no close button, Esc and backdrop never close it.
    expect(document.getElementById("close-modal")).toBeNull();
    app.closeModal();
    expect(app.ui.modal).toBe("honesty");
  });

  it("open-ended sessions offer two outcomes", () => {
    stageProvisionalPool(app.state, null);
    app.tick();
    const modal = document.getElementById("modal-content")!;
    const outcomes = [...modal.querySelectorAll("[data-honesty]")].map((b) => b.getAttribute("data-honesty"));
    expect(outcomes).toEqual(["missed", "full"]);
  });

  it("the bucket banks or drops in one move, then flow continues", () => {
    stageProvisionalPool(app.state, null);
    app.tick();
    const balance = app.state.nous;
    const creditedBefore = app.state.session!.accounting.creditedSeconds;
    document.querySelector<HTMLButtonElement>('[data-honesty="full"]')!.click();
    expect(app.ui.modal).toBeNull();
    expect(app.state.nous - balance).toBeCloseTo(30, 6);
    expect(app.state.session!.accounting.creditedSeconds).toBeCloseTo(creditedBefore + 300, 6);
    expect(app.state.mode).toBe("flow");
  });

  it("at exit the answer is mandatory and final: report first, summary after", () => {
    stageProvisionalPool(app.state, 600);
    app.endFlow();
    expect(app.ui.modal).toBe("honesty");
    expect(app.state.mode).toBe("flow");
    const balance = app.state.nous;
    const banked = app.state.session!.earned;
    document.querySelector<HTMLButtonElement>('[data-honesty="missed"]')!.click();
    // The dropped bucket never joins the banked headline.
    expect(app.state.nous - balance).toBeCloseTo(0, 6);
    expect(app.state.mode).toBe("upgrade");
    expect(app.ui.modal).toBe("summary");
    expect(app.state.summary!.earned).toBeCloseTo(banked, 6);
    expect(app.state.summary!.seconds).toBeCloseTo(600, 6);
  });

  it("the provisional bucket is visibly flagged on the console while it holds", () => {
    stageProvisionalPool(app.state, 600);
    app.tick();
    const flag = document.getElementById("session-provisional")!;
    expect(flag.textContent).toContain("provisional");
    expect(flag.textContent).toContain("30 ν");
    app.resolveHonesty("full");
    app.render();
    expect(document.getElementById("session-provisional")!.textContent).toBe("");
  });
});

describe("the close-out choreography (§8)", () => {
  function endPlannedSession(seconds: number): void {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, 600);
    advance(s, seconds);
    app.endFlow();
    app.render();
  }

  it("a present-typed exit goes straight to the summary", () => {
    endPlannedSession(600);
    expect(app.state.mode).toBe("upgrade");
    expect(app.ui.modal).toBe("summary");
    expect(app.state.summary).not.toBeNull();
  });

  it("practice time shows credited minutes in the history list's format", () => {
    endPlannedSession(600);
    const modal = document.getElementById("modal-content")!;
    expect(modal.textContent).toContain("10 / 10 min");
    // The next session is open-ended and short: plain minutes, no plan.
    app.dismissSummary();
    const s = app.state;
    startSession(s, null);
    advance(s, 300);
    app.endFlow();
    app.render();
    const open = document.getElementById("modal-content")!;
    expect(open.textContent).toContain("5 min");
    expect(open.textContent).not.toContain("/ 10 min");
  });

  it("honesty events render as neutral factual lines; no raw wall-duration row", () => {
    // 600 s present under a 600 s plan, then 300 s provisional away settled
    // as a miss: wall time is 15 min, credited is 10, and only the latter
    // may appear as a duration row.
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, 600);
    advance(s, 600);
    advance(s, 1, Math.random, "provisional");
    s.session!.accounting.poolSeconds = 300;
    s.session!.accounting.bucketNous = 30;
    app.endFlow();
    document.querySelector<HTMLButtonElement>('[data-honesty="missed"]')!.click();
    app.render();
    const modal = document.getElementById("modal-content")!;
    expect(modal.textContent).toContain("5 min away · didn't practice");
    expect(modal.textContent).toContain("10 / 10 min");
    expect(modal.textContent).not.toContain("15 min");
  });

  it("touching either field records the reflection; the untouched field keeps its neutral default", () => {
    endPlannedSession(60);
    const text = document.getElementById("summary-reflection-text") as HTMLInputElement;
    text.value = "held the plan";
    text.dispatchEvent(new Event("input"));
    expect(app.state.summary!.reflection).toEqual({ text: "held the plan", slider: 3 });
    const slider = document.getElementById("summary-reflection-slider") as HTMLInputElement;
    slider.value = "5";
    slider.dispatchEvent(new Event("input"));
    expect(app.state.summary!.reflection).toEqual({ text: "held the plan", slider: 5 });
  });

  it("the continuous slider stores decimals and the ends respond to the thumb (#233)", () => {
    endPlannedSession(60);
    const slider = document.getElementById("summary-reflection-slider") as HTMLInputElement;
    const rough = slider.previousElementSibling as HTMLElement;
    const great = slider.nextElementSibling as HTMLElement;
    const rest = 0.675;
    // Untouched, both labels rest at the neutral thumb's read — no bands,
    // no numbers.
    expect(Number(rough.style.opacity || rest)).toBeCloseTo(rest);
    // A decimal touch stores raw — the engine clamps the range, not the step.
    slider.value = "4.5";
    slider.dispatchEvent(new Event("input"));
    expect(app.state.summary!.reflection).toEqual({ text: "", slider: 4.5 });
    // The ends brighten as the thumb nears them; nothing else moves.
    expect(Number(rough.style.opacity)).toBeCloseTo(0.35 + 0.65 * (1 - 0.875), 2);
    expect(Number(great.style.opacity)).toBeCloseTo(0.35 + 0.65 * 0.875, 2);
    slider.value = "1";
    slider.dispatchEvent(new Event("input"));
    expect(Number(rough.style.opacity)).toBeCloseTo(1, 2);
    expect(Number(great.style.opacity)).toBeCloseTo(0.35, 2);
    expect(app.state.summary!.reflection).toEqual({ text: "", slider: 1 });
  });

  it("a stored decimal reflection re-opens with its ends already reading the thumb", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, 600);
    advance(s, 60);
    endSession(s);
    recordSummaryReflection(s, { slider: 2.5 });
    app.ui.modal = "summary";
    app.render();
    const slider = document.getElementById("summary-reflection-slider") as HTMLInputElement;
    expect(slider.value).toBe("2.5");
    const rough = slider.previousElementSibling as HTMLElement;
    const great = slider.nextElementSibling as HTMLElement;
    expect(Number(rough.style.opacity)).toBeCloseTo(0.35 + 0.65 * 0.625, 2);
    expect(Number(great.style.opacity)).toBeCloseTo(0.35 + 0.65 * 0.375, 2);
  });

  it("an untouched reflection stays absent when dismissed via Continue", () => {
    endPlannedSession(60);
    document.getElementById("summary-continue")!.click();
    expect(app.ui.modal).toBeNull();
    expect(app.state.summary!.seen).toBe(true);
    expect(app.state.summary!.reflection).toBeNull();
  });

  it("the close, backdrop, and Esc path logs the same reflection-or-absent", () => {
    endPlannedSession(60);
    const text = document.getElementById("summary-reflection-text") as HTMLInputElement;
    text.value = "rough start";
    text.dispatchEvent(new Event("input"));
    app.closeModal();
    expect(app.state.summary!.seen).toBe(true);
    expect(app.state.summary!.reflection).toEqual({ text: "rough start", slider: 3 });
    const s = app.state;
    startSession(s, null);
    advance(s, 60);
    app.endFlow();
    app.render();
    app.closeModal();
    expect(app.state.summary!.seen).toBe(true);
    expect(app.state.summary!.reflection).toBeNull();
  });

  it("an unseen summary and its half-entered reflection survive a reload", () => {
    endPlannedSession(60);
    const text = document.getElementById("summary-reflection-text") as HTMLInputElement;
    text.value = "half-done thought";
    text.dispatchEvent(new Event("input"));
    app.save();
    const revived = boot();
    expect(revived.ui.modal).toBe("summary");
    expect(revived.state.summary!.seen).toBe(false);
    expect(revived.state.summary!.reflection).toEqual({ text: "half-done thought", slider: 3 });
    const reloaded = document.getElementById("summary-reflection-text") as HTMLInputElement;
    expect(reloaded.value).toBe("half-done thought");
  });

  it("relaunching with a running session resumes it; the owed report fires, nothing auto-closes", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, null);
    advance(s, 60);
    applyGap(s, 600, "away", 0);
    app.save();
    const revived = boot();
    expect(revived.state.mode).toBe("flow");
    expect(revived.state.session).not.toBeNull();
    expect(poolOutstanding(revived.state)).toBe(true);
    expect(revived.ui.modal).toBe("honesty");
  });
});

describe("the tab title (§4)", () => {
  it("is plain FlowSynth with no session", () => {
    app.render();
    expect(document.title).toBe("FlowSynth");
  });

  it("carries the remaining clock on planned, done past the target, paused overriding done", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, 600);
    advance(s, 60);
    app.render();
    expect(document.title).toBe("09:00 · FlowSynth");
    app.pause();
    expect(document.title).toBe("paused · FlowSynth");
    app.resume();
    advance(s, 600);
    app.render();
    expect(document.title).toBe("done · FlowSynth");
    endSession(s);
    app.render();
    expect(document.title).toBe("FlowSynth");
  });

  it("counts up on open-ended", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, null);
    advance(s, 2530);
    app.render();
    expect(document.title).toBe("42:10 · FlowSynth");
  });
});

describe("the target-hit signals (§4)", () => {
  afterEach(() => setVisibility("visible"));

  it("the first wake-up past the target fires chime and notification together; the session stays live", () => {
    const { fired, app } = stubChannels();
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    advance(app.state, 600);
    app.tick();
    expect(fired.chimes).toBe(1);
    expect(fired.notifications).toBe(1);
    expect(app.state.session!.targetSignaled).toBe(true);
    expect(app.state.mode).toBe("flow");
    expect(document.title).toBe("done · FlowSynth");
  });

  it("open-ended sessions never chime and never notify", () => {
    const { fired, app } = stubChannels();
    app.state.sessionsCompleted = 1;
    startSession(app.state, null);
    advance(app.state, 7200);
    app.tick();
    expect(fired.chimes).toBe(0);
    expect(fired.notifications).toBe(0);
    expect(app.state.session!.targetSignaled).toBe(false);
  });

  it("hidden re-fires ride the wall clock, capped at three total", () => {
    const { fired, app } = stubChannels();
    setVisibility("hidden");
    startSession(app.state, 600);
    advance(app.state, 600);
    app.tick();
    expect(fired.chimes).toBe(1);
    // Same-minute wake-ups re-fire nothing, however often they come.
    app.tick();
    app.tick();
    expect(fired.chimes).toBe(1);
    // A wall-clock minute later: one re-fire per minute, to the cap.
    app.signals.lastChimeAt -= 61_000;
    app.tick();
    expect(fired.chimes).toBe(2);
    app.signals.lastChimeAt -= 61_000;
    app.tick();
    expect(fired.chimes).toBe(3);
    app.signals.lastChimeAt -= 61_000;
    app.tick();
    expect(fired.chimes).toBe(3);
    // One notification only, however long the absence runs.
    expect(fired.notifications).toBe(1);
  });

  it("a visible return acknowledges; hiding again never re-fires", () => {
    const { fired, app } = stubChannels();
    setVisibility("hidden");
    startSession(app.state, 600);
    advance(app.state, 600);
    app.tick();
    expect(fired.chimes).toBe(1);
    setVisibility("visible");
    app.tick();
    setVisibility("hidden");
    app.signals.lastChimeAt -= 61_000;
    app.tick();
    expect(fired.chimes).toBe(1);
  });

  it("pausing silences immediately; nothing fires while paused or after resume", () => {
    const { fired, app } = stubChannels();
    startSession(app.state, 600);
    advance(app.state, 600);
    app.tick();
    expect(fired.chimes).toBe(1);
    app.pause();
    setVisibility("hidden");
    app.signals.lastChimeAt -= 61_000;
    app.tick();
    app.tick();
    expect(fired.chimes).toBe(1);
    setVisibility("visible");
    app.resume();
    setVisibility("hidden");
    app.signals.lastChimeAt -= 61_000;
    app.tick();
    expect(fired.chimes).toBe(1);
  });

  it("the global mute gates every chime, including hidden re-fires; the silent notification is unaffected", () => {
    const { fired, app } = stubChannels();
    app.setMuted(true);
    setVisibility("hidden");
    startSession(app.state, 600);
    advance(app.state, 600);
    app.tick();
    expect(fired.chimes).toBe(0);
    expect(fired.notifications).toBe(1);
    expect(app.state.session!.targetSignaled).toBe(true);
    app.setMuted(false);
    app.signals.lastChimeAt -= 61_000;
    app.tick();
    expect(fired.chimes).toBe(1);
  });

  it("a reload mid-overrun never re-delivers the signals", () => {
    const { fired, channels, app } = stubChannels();
    setVisibility("hidden");
    startSession(app.state, 600);
    advance(app.state, 600);
    app.tick();
    app.save();
    const revived = boot(channels);
    setVisibility("visible");
    revived.tick();
    expect(fired.chimes).toBe(1);
    expect(fired.notifications).toBe(1);
    expect(document.title).toBe("done · FlowSynth");
  });
});

describe("the notification permission ask (§4)", () => {
  afterEach(() => setVisibility("visible"));

  function selectJammin(s: ReturnType<typeof stubChannels>["app"]["state"]): void {
    const created = createHabit(s, "Jammin");
    selectHabit(s, created.habit!.id);
  }

  it("rides the first planned start exactly once, never again — session one included", () => {
    const { fired, app } = stubChannels();
    selectJammin(app.state);
    app.ui.chosenTarget = 600;
    app.startFlow();
    expect(fired.permissionRequests).toBe(1);
    expect(app.state.notificationAsked).toBe(true);
    endSession(app.state);
    app.startFlow();
    expect(fired.permissionRequests).toBe(1);
  });

  it("open-ended starts never ask", () => {
    const { fired, app } = stubChannels();
    selectJammin(app.state);
    app.ui.chosenTarget = null;
    app.startFlow();
    expect(fired.permissionRequests).toBe(0);
    expect(app.state.notificationAsked).toBe(false);
    app.pause();
    endSession(app.state);
    // A later planned start still carries the one ask.
    app.ui.chosenTarget = 600;
    app.startFlow();
    expect(fired.permissionRequests).toBe(1);
    expect(app.state.notificationAsked).toBe(true);
  });

  it("a pre-decided permission spends the ask-slot without prompting, and the start still unlocks audio", () => {
    const { fired, app } = stubChannels();
    fired.permission = "denied";
    selectJammin(app.state);
    app.ui.chosenTarget = 600;
    app.startFlow();
    expect(fired.permissionRequests).toBe(0);
    expect(app.state.notificationAsked).toBe(true);
    expect(fired.unlocks).toBe(1);
  });

  it("the audio unlock rides every start gesture, planned or open-ended", () => {
    const { fired, app } = stubChannels();
    selectJammin(app.state);
    app.ui.chosenTarget = 600;
    app.startFlow();
    expect(fired.unlocks).toBe(1);
    app.pause();
    endSession(app.state);
    app.ui.chosenTarget = null;
    app.startFlow();
    expect(fired.unlocks).toBe(2);
  });
});

// Cross-tab save conflicts (#128): one localStorage slot, many tabs. A tab
// whose memory predates the stored save must never write over it, and a tab
// that notices another tab's write converges onto it.
describe("cross-tab save conflicts (#128)", () => {
  afterEach(() => setVisibility("visible"));

  // Forges the file another tab would have written: same lineage, one mark
  // of progress, stamped later than anything this tab could have written.
  function forgeNewerSave(nous: number): void {
    localStorage.setItem(STORAGE_KEY, serialize({ ...app.state, nous }, Date.now() + 60_000));
  }

  const storedNous = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!).state.nous as number;

  it("a refused save leaves the tab's memory alone — convergence waits for the return", () => {
    forgeNewerSave(777);
    app.state.nous = 999;
    app.save();
    expect(storedNous()).toBe(777);
    expect(app.state.nous).toBe(999);
  });

  it("failed write attempts advance the throttle; refused writes do not", () => {
    const now = Date.now() + 10;
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota exceeded"); });
    try {
      app.save(now);
      expect(app.lastSaveWall).toBe(now);
    } finally {
      write.mockRestore();
    }
    forgeNewerSave(777);
    app.save(now + 10);
    expect(app.lastSaveWall).toBe(now);
    expect(storedNous()).toBe(777);
  });

  it("the hidden-transition save refuses to clobber a newer save", () => {
    forgeNewerSave(777);
    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(storedNous()).toBe(777);
  });

  it("a bfcache restore adopts a newer save written while the page sat frozen", () => {
    forgeNewerSave(777);
    setVisibility("visible");
    // happy-dom ignores the PageTransitionEvent init dict; the persisted
    // flag goes on as an own property.
    const event = new Event("pageshow");
    Object.defineProperty(event, "persisted", { value: true });
    window.dispatchEvent(event);
    expect(app.state.nous).toBe(777);
  });

  it("a storage event adopts the newer save when no session is live", () => {
    forgeNewerSave(777);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    expect(app.state.nous).toBe(777);
  });

  it("a storage event carrying an older forced write never reverts this tab's fresher memory", () => {
    // Another tab's import or reset can land an older-stamped file; the
    // announcement alone is not a reason to discard newer in-memory state.
    app.state.nous = 999;
    localStorage.setItem(STORAGE_KEY, serialize({ ...app.state, nous: 5 }, Date.now() - 60_000));
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    expect(app.state.nous).toBe(999);
  });

  it("a storage event on another key changes nothing", () => {
    const before = localStorage.getItem(STORAGE_KEY);
    window.dispatchEvent(new StorageEvent("storage", { key: "some.other.key" }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
    expect(app.state.nous).not.toBe(777);
  });

  it("a live flow session is never replaced mid-flow by a storage event", () => {
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    forgeNewerSave(777);
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    expect(app.state.nous).not.toBe(777);
    expect(app.state.mode).toBe("flow");
    expect(app.state.session).not.toBeNull();
  });

  it("a tab returning from the background adopts a newer save instead of clobbering it", () => {
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.tick();
    // The tab hides: its own save is the newest thing in the slot and lands.
    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(app.state.mode).toBe("flow");
    // Another tab banks progress and saves a newer file while we are away.
    forgeNewerSave(777);
    // The stale tab returns: it adopts, and the newer save survives. The
    // live session keeps producing behind the adoption, so the adopted
    // mark reads as a floor, not an equality.
    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(app.state.nous).toBeGreaterThanOrEqual(777);
    // The stored save keeps the other tab's progress — a stale clobber
    // would read near zero, an allowed post-adoption save at least 777.
    expect(storedNous()).toBeGreaterThanOrEqual(777);
  });

  it("the boundary throttle's save refuses to clobber a newer save", () => {
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.tick();
    forgeNewerSave(777);
    app.lastSaveWall = 0;
    app.tick();
    expect(storedNous()).toBe(777);
  });

  it("the unload save refuses to clobber a newer save", () => {
    forgeNewerSave(777);
    window.dispatchEvent(new Event("beforeunload"));
    expect(storedNous()).toBe(777);
  });

  it("an explicit import writes even when the stored save is newer", () => {
    forgeNewerSave(777);
    const ok = app.importText(serialize({ ...app.state, nous: 555 }, Date.now() - 60_000));
    expect(ok).toBe(true);
    expect(storedNous()).toBe(555);
  });

  it("a hard reset writes even when the stored save is newer", () => {
    forgeNewerSave(777);
    app.hardReset();
    expect(storedNous()).toBe(app.state.nous);
  });

  it("a rejected-version stored save never blocks the fresh save", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ app: "flowsynth", version: 1, savedAt: Date.now() + 60_000, state: {} }),
    );
    const fresh = boot();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).version).toBe(SAVE_VERSION);
    expect(fresh.state.mode).toBe("upgrade");
  });
});
