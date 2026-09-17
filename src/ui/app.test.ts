// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { App } from "./app";
import { createHabit, selectHabit } from "../engine/habits";
import { BALANCE } from "../engine/constants";
import { startSession, endSession } from "../engine/actions";
import { advance } from "../engine/advance";
import { give } from "../engine/fixtures";
import { hex } from "../engine/hex";
import type { GameState } from "../engine/types";

// UI smoke tests: the console chrome, the enter-prompt gating, and the
// catalog's shelf behavior, booted on the real index.html skeleton.

function boot(): App {
  const html = readFileSync("index.html", "utf8");
  const body = html.slice(html.indexOf("<body>") + 6, html.lastIndexOf("</body>"));
  document.body.innerHTML = body;
  const els: Record<string, HTMLElement> = {};
  for (const id of [
    "console-session",
    "console-apps",
    "console-status",
    "nous-balance",
    "board-tools",
    "grid",
    "status-monitor",
    "inspector",
    "status",
    "modal",
    "modal-content",
  ]) {
    const element = document.getElementById(id);
    if (element) els[id] = element;
  }
  return new App(els, false);
}

let app: App;

beforeEach(() => {
  localStorage.clear();
  app = boot();
});

describe("the console tiles", () => {
  it("Habit wears the selected habit (or no habit); Notes and Goals are icon-only with lock tooltips", () => {
    app.render();
    const stateText = (id: string) => document.getElementById(id)?.querySelector(".app-tile-state")?.textContent ?? null;
    expect(stateText("app-tile-habit")).toBe("no habit");
    expect(stateText("app-tile-time")).toBe(null); // locked: tooltip carries the gate
    expect(document.getElementById("app-tile-time")!.classList.contains("locked")).toBe(true);
    expect(document.getElementById("app-tile-time")!.title).toContain("after your first session");
    expect(document.getElementById("app-tile-notes")!.title).toContain("activate with nous");
    expect(stateText("app-tile-notes")).toBe(null);
    expect(stateText("app-tile-goals")).toBe(null);

    const created = createHabit(app.state, "Jammin");
    selectHabit(app.state, created.habit!.id);
    app.render();
    expect(stateText("app-tile-habit")).toBe("Jammin");
  });

  it("the Time tile wears the current plan once Time is active", () => {
    app.state.sessionsCompleted = 1;
    app.ui.chosenTarget = 600;
    app.render();
    expect(document.getElementById("app-tile-time")!.querySelector(".app-tile-state")!.textContent).toBe("10:00");
  });
});

describe("the console readout", () => {
  it("wears bare values: no labels, nous in units, session total under the rate", () => {
    app.render();
    expect(document.getElementById("console-status")!.textContent).not.toContain("Mode");
    expect(document.getElementById("console-status")!.textContent).not.toContain("Production");
    expect(document.getElementById("nous-balance")!.textContent).toMatch(/^\d+ ν$/);
    expect(document.querySelector(".production-slot .session-total")).not.toBeNull();
    expect(document.querySelector(".app-led")).toBeNull();
    expect(document.querySelector("#flow-switch .switch-state")).not.toBeNull();
  });

  it("the upgrade-mode clock wears the target in flow styles, 'planned' as caption", () => {
    app.state.sessionsCompleted = 1;
    app.ui.chosenTarget = 600;
    app.render();
    expect(document.querySelector("#console-session .session-clock")!.textContent).toBe("10:00");
    expect(document.querySelector("#console-session .clock-caption")!.textContent).toBe("planned");
    app.ui.chosenTarget = null;
    app.render();
    expect(document.querySelector("#console-session .session-clock")!.textContent).toBe("open");
  });

  it("the session total only exists while a session runs", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, 600);
    advance(s, 30);
    app.render();
    expect(document.querySelector('[data-live="session"]')!.textContent).toContain("ν this session");
    endSession(s);
    app.render();
    expect(document.querySelector('[data-live="session"]')!.textContent).toBe("");
  });
});

describe("the status monitor", () => {
  it("carries the formula chip and accumulator only — no forge chip", () => {
    app.render();
    expect(document.querySelector(".monitor-forge")).toBeNull();
    expect(document.querySelector(".monitor-formula")).not.toBeNull();
    expect(document.querySelector(".monitor-rail")).not.toBeNull();
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

describe("the board toolbar", () => {
  it("the Forge tool carries the shared meter pip and progress tooltip", () => {
    app.state.forge.progress = 30;
    app.render();
    const forge = document.getElementById("tool-forge")!;
    expect(forge.querySelector(".forge-pip")).not.toBeNull();
    expect(forge.querySelector('[data-live="forge-pip"]')!.getAttribute("style")).toContain("50");
    expect(forge.title).toContain("30 / 60");
  });

  it("the cell tool shows the price and arms the frontier pick", () => {
    app.state.nous = BALANCE.cellFirstCost;
    app.render();
    document.getElementById("tool-cell")!.click();
    expect(app.ui.buyingCell).toBe(true);
    // Arming re-renders the toolbar; the re-queried icon is active.
    const armed = document.getElementById("tool-cell")!;
    expect(armed.classList.contains("active")).toBe(true);
    expect(armed.title).toContain("Esc cancels");
    // Armed again toggles off; no banner element exists anywhere.
    armed.click();
    expect(app.ui.buyingCell).toBe(false);
    expect(document.getElementById("buy-banner")).toBeNull();
  });
});

describe("the chord view", () => {
  it("toggles from the toolbar and the C key, in either mode", () => {
    const button = () => document.getElementById("tool-chords") as HTMLButtonElement;
    expect(app.ui.showChords).toBe(false);
    button().click();
    expect(app.ui.showChords).toBe(true);
    expect(button().classList.contains("active")).toBe(true);
    expect(button().getAttribute("aria-pressed")).toBe("true");
    // The keyboard beat toggles.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "c" }));
    expect(app.ui.showChords).toBe(false);
    // Typing a c never toggles it.
    const input = document.createElement("input");
    document.body.append(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "c", bubbles: true }));
    expect(app.ui.showChords).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "c" }));
    expect(app.ui.showChords).toBe(true);
    // A reading aid, not a purchase surface: it stays live during flow.
    startSession(app.state, 600);
    app.render();
    expect(button().disabled).toBe(false);
    button().click();
    expect(app.ui.showChords).toBe(false);
    endSession(app.state);
  });

  it("lights chord voices, dims the rest, links the pair, labels the named chord", () => {
    // The octave: the Carrier (pitch 1) plus an additive one hex out.
    give(app.state, "additive", hex(1, 0));
    // A raw pair island at pitches 6–7: below the triad vocabulary's reach.
    app.state.cells.push(hex(5, 0), hex(6, 0));
    give(app.state, "additive", hex(5, 0));
    give(app.state, "additive", hex(6, 0));
    app.ui.showChords = true;
    app.render();
    const grid = document.getElementById("grid")!;
    expect(grid.classList.contains("chord-view")).toBe(true);
    expect(grid.querySelectorAll(".cell-node.chord-lit")).toHaveLength(4);
    expect(grid.querySelectorAll(".cell-node.chord-dim")).toHaveLength(1);
    expect(grid.querySelectorAll(".chord-link")).toHaveLength(1);
    expect(grid.querySelectorAll(".chord-hull")).toHaveLength(1);
    expect(grid.querySelector(".chord-label")!.textContent).toBe("Octave ×1.15");
    // Off again: the board returns undimmed, no overlay nodes linger.
    app.ui.showChords = false;
    app.render();
    expect(grid.classList.contains("chord-view")).toBe(false);
    expect(grid.querySelectorAll(".chord-link, .chord-hull, .chord-label")).toHaveLength(0);
    expect(grid.querySelectorAll(".cell-node.chord-dim")).toHaveLength(0);
  });
});

describe("the enter prompt", () => {
  it("only opens when no habit is selected; a selected habit starts directly", () => {
    app.startFlow();
    expect(app.ui.modal).toBe("enter");
    const modal = document.getElementById("modal-content")!;
    expect(modal.querySelector("h2")!.textContent).toBe("What are you practicing?");
    expect(modal.querySelector(".lead")).toBeNull();
    expect(modal.textContent).toContain("Practice unstructured");
    expect(modal.textContent).toContain("nous is unaffected");
    expect(modal.textContent).not.toContain("development holds still");

    app.closeModal();
    const created = createHabit(app.state, "Jammin");
    selectHabit(app.state, created.habit!.id);
    app.startFlow();
    expect(app.ui.modal).toBeNull();
    expect(app.state.mode).toBe("flow");
    expect(app.state.activeHabitId).toBe(created.habit!.id);
  });
});

describe("the catalog", () => {
  it("a shelf purchase stays in the catalog and lands in inventory", () => {
    app.state.nous = BALANCE.shelfPrices.generator;
    app.openModal("store");
    document.querySelector<HTMLButtonElement>('[data-buy="generator"]')!.click();
    expect(app.ui.modal).toBe("store");
    const generator = app.state.modules.find((m) => m.type === "focusKeyed")!;
    expect(generator.pos).toBeNull();
    expect(app.state.purchased.generator).toBe(true);
  });

  it("the cell row quotes the actual price", () => {
    app.openModal("store");
    const cellButton = document.getElementById("buy-cell")!;
    expect(cellButton.textContent).toContain(`${BALANCE.cellFirstCost} ν`);
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

  it("the loud summary keeps only data rows and the continue action", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, 600);
    advance(s, 60);
    endSession(s);
    app.ui.modal = "summary";
    app.render();
    const modal = document.getElementById("modal-content")!;
    expect(modal.querySelector(".summary-reflections")).toBeNull();
    expect(modal.textContent).not.toContain("Trophies live");
    expect(document.getElementById("summary-continue")).not.toBeNull();
  });
});
