// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { App } from "./app";
import { addPracticeLog, archiveHabit, createHabit, selectHabit } from "../engine/habits";
import { createGoal, deleteGoal, goalSummary } from "../engine/goals";
import { recordSummaryReflection } from "../engine/actions";
import { writeNote } from "../engine/notes";
import { BALANCE } from "../engine/constants";
import { computeRates } from "../engine/economy";
import { startSession, endSession } from "../engine/actions";
import { advance } from "../engine/advance";
import { applyGap, flushPendingAway, poolOutstanding, resolveHonestyReport } from "../engine/trust";
import { recordMissed, recordTargetHit } from "../engine/records";
import { give } from "../engine/fixtures";
import { hex } from "../engine/hex";
import { formatNumber } from "./format";
import type { GameState } from "../engine/types";
import type { SignalChannels } from "./signals";

// UI smoke tests: the console chrome, the enter-prompt gating, and the
// catalog's shelf behavior, booted on the real index.html skeleton.

function boot(channels?: SignalChannels): App {
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
  return new App(els, false, channels);
}

let app: App;

// Cell nodes are SVG g elements: happy-dom gives them no .click().
function clickCell(q: number, r: number): void {
  document.querySelector(`[data-cell="${q},${r}"]`)!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

beforeEach(() => {
  localStorage.clear();
  app = boot();
});

// A synthetic drag installs a once-capture click suppressor (killing the
// browser's post-drop click) that removes itself on a timer; drain that
// timer so it never swallows the next test's clicks, and drop any
// elementFromPoint mock the test left behind.
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  delete (document as unknown as { elementFromPoint?: unknown }).elementFromPoint;
});

describe("the console tiles", () => {
  it("all four tiles are live from a fresh boot: Habit wears its habit, Time its plan, Notes and Goals icon-only", () => {
    app.render();
    const stateText = (id: string) => document.getElementById(id)?.querySelector(".app-tile-state")?.textContent ?? null;
    expect(stateText("app-tile-habit")).toBe("no habit");
    // Time is free from minute 0 (ADR-0019): the tile wears the resting
    // plan, and no tile is greyed or carries a lock tooltip.
    expect(stateText("app-tile-time")).toBe("open-ended");
    for (const key of ["habit", "time", "notes", "goals"]) {
      expect(document.getElementById(`app-tile-${key}`)!.classList.contains("locked")).toBe(false);
      expect(document.getElementById(`app-tile-${key}`)!.title).not.toContain("locked");
    }
    expect(stateText("app-tile-notes")).toBe(null);
    expect(stateText("app-tile-goals")).toBe(null);

    const created = createHabit(app.state, "Jammin");
    selectHabit(app.state, created.habit!.id);
    app.render();
    expect(stateText("app-tile-habit")).toBe("Jammin");
  });

  it("every tile opens its panel from session one", () => {
    for (const key of ["time", "notes", "goals"] as const) {
      app.openApp(key);
      expect(document.getElementById("app-popover")).not.toBeNull();
      app.closeApp();
    }
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
    // The clock slot only ever holds clock text: an unplanned open-ended
    // shape wears a placeholder, the caption names the mode.
    expect(document.querySelector("#console-session .session-clock")!.textContent).toBe("--:--");
    expect(document.querySelector("#console-session .clock-caption")!.textContent).toBe("open-ended");
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

  it("names the infusor term only when uplift reaches a synth", () => {
    app.render();
    expect(document.querySelector('[data-live="m-inf"]')).toBeNull();
    give(app.state, "infusor", hex(0, 1));
    app.render();
    expect(document.querySelector('[data-live="m-inf"]')).not.toBeNull();
    expect(document.querySelector('[data-live="m-inf"]')!.textContent).toBe(formatNumber(0.02));
    expect(document.querySelector('[data-live="b-inf"]')!.textContent).toBe(`+${formatNumber(0.02)} ν/s`);
  });

  it("carries the unified synths leg: (synths + infusors) × chords × emp", () => {
    app.render();
    expect(document.querySelector('[data-live="m-synths"]')!.textContent).toBe(formatNumber(0.1));
    expect(document.querySelector('[data-live="m-carrier"]')).toBeNull();
    expect(document.querySelector('[data-live="m-harmonics"]')).toBeNull();
  });

  it("the session summary's legs use the new names", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, 600);
    advance(s, 60);
    endSession(s);
    app.ui.modal = "summary";
    app.render();
    const modal = document.getElementById("modal-content")!;
    expect(modal.textContent).toContain("the synth term alone");
    give(s, "additive", hex(1, 0)); // G4 — a Fifth for the next session
    startSession(s, null);
    advance(s, 60);
    endSession(s);
    app.render();
    expect(modal.textContent).toContain(`synths +${formatNumber(0.2)} ν/s`);
    expect(modal.textContent).toContain(`chords ×${formatNumber(1.3)}`);
    expect(modal.textContent).not.toContain("carrier");
    expect(modal.textContent).not.toContain("harmonics");
  });

  it("an old v5 save in localStorage boots migrated: life record kept, board reset", () => {
    const legacy = app.state;
    createHabit(legacy, "Piano");
    legacy.sessionsCompleted = 4;
    legacy.totalEarned = 2_500;
    const file = JSON.parse(JSON.stringify({ app: "flowsynth", version: 5, savedAt: 1_000, state: legacy }));
    file.state.welcomeAcked = true;
    file.state.modules.push({ id: "m9", type: "carrier", rarity: "common", level: 3, invested: 66, pos: hex(1, 0) });
    localStorage.setItem("flowsynth.save.v1", JSON.stringify(file));
    const revived = boot();
    expect(revived.state.sessionsCompleted).toBe(4);
    expect(revived.state.totalEarned).toBe(2_500);
    expect(revived.state.habits.map((h) => h.name)).toEqual(["Piano"]);
    // The board reset to the new opening: one synth at C4, grant balance.
    expect(revived.state.modules).toHaveLength(1);
    expect(revived.state.modules[0]!.pos).toEqual(hex(0, 0));
    expect(revived.state.nous).toBe(12);
    expect("welcomeAcked" in revived.state).toBe(false);
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

  it("carries no Arrange action anywhere — dragging is already live (§5)", () => {
    app.render();
    expect(document.getElementById("tool-manage")).toBeNull();
    expect(document.getElementById("manage-banner")).toBeNull();
    expect(document.getElementById("inventory-zone")).not.toBeNull();
    expect((document.getElementById("inventory-zone") as HTMLElement).classList.contains("off")).toBe(false);
  });
});

describe("the always-live board (§5)", () => {
  const cell = (q: number, r: number) => document.querySelector(`[data-cell="${q},${r}"]`)!;
  const ghosts = () => document.getElementById("grid")!.querySelectorAll(".ghost-hull");
  const bloom = () => document.getElementById("module-bloom")!;

  afterEach(() => {
    delete (document as unknown as { elementFromPoint?: unknown }).elementFromPoint;
  });

  it("the board renders the lattice: note names on cells, columns as one name", () => {
    app.render();
    const grid = document.getElementById("grid")!;
    // Every empty cell wears its absolute note — the two free opening cells
    // read G4 and C5.
    const labels = [...grid.querySelectorAll(".hex-note")].map((n) => n.textContent);
    expect(labels).toContain("G4");
    expect(labels).toContain("C5");
    // The occupied cell's face carries its note beneath the readout.
    expect(grid.querySelector('[data-cell="0,0"] .face-note')!.textContent).toBe("C4");
  });

  it("every module is draggable with no arrange mode — nothing pinned, nothing refused", () => {
    app.render();
    cell(0, 0).dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 100 }));
    // The opening synthesizer lifts like any module: a ghost, no refusal
    // toast, no shake (ADR-0021 — nothing is spatially privileged).
    expect(document.querySelector(".drag-ghost")).not.toBeNull();
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 130, clientY: 100 }));
    expect(app.state.modules[0]!.pos).toEqual(hex(0, 0));
    expect(document.querySelector(".drag-ghost")).toBeNull();
  });

  it("holding the face starts a live drag; the bloom collapses into the ghost; a drop leaves it closed", () => {
    app.render();
    // Click opens the expanded face.
    clickCell(0, 0);
    expect(app.ui.selected).toBe("m1");
    expect(bloom().hidden).toBe(false);
    // Holding the face and moving: the ghost appears, the face collapses.
    document.elementFromPoint = () => cell(0, 0);
    cell(0, 0).dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 100 }));
    expect(document.querySelector(".drag-ghost")).not.toBeNull();
    expect(app.ui.selected).toBeNull();
    expect(bloom().hidden).toBe(true);
    // Dropping back on the origin cell moves nothing — and opens nothing.
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 130, clientY: 110 }));
    expect(app.state.modules[0]!.pos).toEqual(hex(0, 0));
    expect(app.ui.selected).toBeNull();
    expect(bloom().hidden).toBe(true);
  });

  it("the drop register previews amber over occupied cells, green over open ones", () => {
    give(app.state, "additive", hex(1, 0)); // G4 — occupies the second cell
    app.render();
    document.elementFromPoint = () => cell(0, 1);
    cell(0, 0).dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 100 }));
    // Hover the open cell C5 (0,1): green.
    expect(cell(0, 1).querySelector(".hex")!.classList.contains("drop-open")).toBe(true);
    // Hover the occupied cell G4 (1,0): amber — the swap preview.
    document.elementFromPoint = () => cell(1, 0);
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 220, clientY: 100 }));
    expect(cell(1, 0).querySelector(".hex")!.classList.contains("drop-occupied")).toBe(true);
    expect(cell(1, 0).querySelector(".hex")!.classList.contains("drop-open")).toBe(false);
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 220, clientY: 100 }));
  });

  it("a drop onto an occupied cell swaps immediately — even identical twins — never confirming", () => {
    // Two identical synths: pitch lives in the cell, so their swap is a
    // plain swap (§5, §8) — occupied drops swap, always, without confirm.
    const twin = give(app.state, "additive", hex(1, 0));
    app.render();
    document.elementFromPoint = () => cell(1, 0);
    cell(0, 0).dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 220, clientY: 100 }));
    expect(app.state.modules[0]!.pos).toEqual(hex(1, 0));
    expect(twin.pos).toEqual(hex(0, 0));
    expect(app.state.modules).toHaveLength(2);
    expect(app.ui.placing).toBeNull();
    expect(app.ui.modal).toBeNull();
  });

  it("dragging off the board into the tray retrieves the module", () => {
    app.render();
    const tray = document.getElementById("inventory-zone")!;
    document.elementFromPoint = () => tray;
    cell(0, 0).dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 100 }));
    expect(tray.classList.contains("drag-over")).toBe(true);
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 100, clientY: 500 }));
    // Retrieved: the chord-breaking gesture leaves the synth in the tray.
    expect(app.state.modules[0]!.pos).toBeNull();
  });

  it("the tray renders inventory; clicking an item arms placement, then a cell places (swapping occupied)", () => {
    app.returnToInventory("m1");
    app.render();
    const tray = document.getElementById("inventory-zone")!;
    expect(tray.querySelector('[data-inv="m1"]')).not.toBeNull();
    tray.querySelector<HTMLButtonElement>('[data-inv="m1"]')!.click();
    expect(app.ui.placing).toBe("m1");
    clickCell(0, 1);
    expect(app.state.modules[0]!.pos).toEqual(hex(0, 1));
    expect(app.ui.placing).toBeNull();
    // A placement never opens the expanded face (§5).
    expect(app.ui.selected).toBeNull();
  });

  it("an armed placement previews the would-form ghosts on hover — one per forming chord", () => {
    // m2 at G4 rings a Fifth with the opening synth; m3 waits in the tray.
    give(app.state, "additive", hex(1, 0));
    const traySynth = give(app.state, "additive", null);
    app.render();
    document.querySelector<HTMLButtonElement>(`[data-inv="${traySynth.id}"]`)!.click();
    // Hovering C5 (0,1): the drop would ring an Octave with C4 — a ghost.
    cell(0, 1).dispatchEvent(new MouseEvent("pointerenter", { bubbles: true }));
    app.render();
    expect(ghosts()).toHaveLength(1);
    expect(document.getElementById("grid")!.querySelector(".ghost-hull + .chord-label")!.textContent).toBe("Octave ×1.15");
    // Hovering the occupied G4: an identical-synth swap forms nothing new.
    cell(1, 0).dispatchEvent(new MouseEvent("pointerenter", { bubbles: true }));
    app.render();
    expect(ghosts()).toHaveLength(0);
  });

  it("a held drag wears its ghost over the target cell, and the drop delivers what it previewed", () => {
    // C4 · G4 · C5: the board rings Fifth ×2 and Octave at root C.
    give(app.state, "additive", hex(1, 0));
    give(app.state, "additive", hex(0, 1));
    app.state.cells.push(hex(1, 1)); // G5
    app.render();
    // Holding C5 (m3) over G5: one dashed hull — the would-be Octave at the
    // new root G, which the current board has never rung.
    document.elementFromPoint = () => cell(1, 1);
    cell(0, 1).dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 100 }));
    expect(ghosts()).toHaveLength(1);
    expect(document.getElementById("grid")!.querySelector(".ghost-hull + .chord-label")!.textContent).toBe("Octave ×1.15");
    // The drop delivers exactly what the ghost promised; the hull lifts.
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 130, clientY: 110 }));
    expect(app.state.modules[2]!.pos).toEqual(hex(1, 1));
    expect(ghosts()).toHaveLength(0);
    expect(computeRates(app.state, true).namedChords.map((c) => `${c.name}|${c.root}`).sort()).toEqual(["Fifth|0", "Octave|7"]);
  });
});

describe("the expanded face (§5)", () => {
  const bloom = () => document.getElementById("module-bloom")!;

  it("click opens it above the module; the face itself is the bloom", () => {
    app.render();
    clickCell(0,0);
    expect(app.ui.selected).toBe("m1");
    expect(bloom().hidden).toBe(false);
    // The plate carries the enlarged face — glyph, level, short name, note —
    // and no second module inside it: one face, filling the bloom.
    expect(bloom().querySelectorAll(".bloom-face")).toHaveLength(1);
    expect(bloom().querySelector(".bloom-face .face-name")!.textContent).toBe("ADDITIVE");
    expect(bloom().querySelector(".bloom-face .face-level")!.textContent).toBe("LV 0");
    expect(bloom().querySelector(".bloom-face .face-note")!.textContent).toBe("C4");
    // The ν/s unit rides the face's own readout — no repeated readout.
    expect(bloom().querySelector(".bloom-face .face-readout")!.textContent).toBe(`+${formatNumber(0.1)} ν/s`);
    expect(bloom().querySelector(".bloom-contribution")).toBeNull();
    // The bloom re-proportions the engraving: the chassis hexagon stays a
    // direct child of the svg, and the rhythm is even — title block over
    // the signature, production line at button level, note in the taper.
    const faceSvg = bloom().querySelector(".bloom-face")!;
    expect(faceSvg.querySelector(":scope > [data-key='hex']")).not.toBeNull();
    expect(faceSvg.querySelector(".face-name")!.getAttribute("y")).toBe("-26");
    expect(faceSvg.querySelector(".face-readout")!.getAttribute("y")).toBe("11");
    expect(faceSvg.querySelector(".face-note")!.getAttribute("y")).toBe("44");
    expect(faceSvg.querySelector(".face-signature")!.getAttribute("transform")).toBe("translate(0 -7) scale(0.7)");
    // The module lifted off its cell: the bloom repeats every line the face
    // carries, so the origin renders vacated — no doubled module.
    expect(document.querySelector('[data-cell="0,0"] .module-node')).toBeNull();
    expect(document.querySelector('[data-cell="0,0"] .hex.lifted')).not.toBeNull();
    // …and the Upgrade button: title line with the price, benefit as its
    // subtitle.
    const button = bloom().querySelector<HTMLButtonElement>("#bloom-upgrade")!;
    expect(button.querySelector(".bloom-upgrade-title")!.textContent).toContain("Upgrade");
    expect(button.querySelector(".bloom-upgrade-title")!.textContent).toContain("10 ν");
    expect(button.querySelector(".bloom-upgrade-benefit")!.textContent).toBe("+0.02 ν/s");
    // The vacated cell still toggles its module — click it closed.
    clickCell(0,0);
    expect(app.ui.selected).toBeNull();
    expect(document.querySelector('[data-cell="0,0"] .module-node')).not.toBeNull();
  });

  it("the upgrade button upgrades the module and keeps the bloom open", () => {
    app.state.nous = 30;
    app.render();
    clickCell(0,0);
    bloom().querySelector<HTMLButtonElement>("#bloom-upgrade")!.click();
    expect(app.state.modules[0]!.level).toBe(1);
    expect(app.state.nous).toBe(20);
    // Still selected: the bloom stands, repriced.
    expect(app.ui.selected).toBe("m1");
    expect(bloom().querySelector("#bloom-upgrade")!.textContent).toContain("16 ν");
  });

  it("cannot afford: the button disables", () => {
    app.state.nous = 0;
    app.render();
    clickCell(0,0);
    expect((bloom().querySelector("#bloom-upgrade") as HTMLButtonElement).disabled).toBe(true);
  });

  it("the silent wire wears no Upgrade button — a level buys it nothing", () => {
    give(app.state, "spacer", hex(1, 0));
    app.render();
    clickCell(1,0);
    expect(bloom().hidden).toBe(false);
    expect(bloom().querySelector("#bloom-upgrade")).toBeNull();
    // The face itself is the bloom, sitting near its natural layout with no
    // button to make room for.
    expect(bloom().querySelector(".bloom-face .face-readout")!.textContent).toBe("⌇");
  });

  it("never opens for a drag or a drop; Esc, outside click, and selecting elsewhere close it", () => {
    app.render();
    // Open on click.
    clickCell(0,0);
    expect(bloom().hidden).toBe(false);
    // Esc closes.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    app.render();
    expect(bloom().hidden).toBe(true);
    expect(app.ui.selected).toBeNull();
    // Selecting elsewhere moves it.
    give(app.state, "additive", hex(1, 0));
    app.render();
    clickCell(1,0);
    expect(app.ui.selected).not.toBe("m1");
    expect(bloom().hidden).toBe(false);
    // Outside click — an empty cell — closes it.
    clickCell(0,1);
    expect(app.ui.selected).toBeNull();
    expect(bloom().hidden).toBe(true);
  });

  it("clicking the bloom's own upgrade button never closes it", () => {
    app.state.nous = 30;
    app.render();
    clickCell(0,0);
    expect(bloom().hidden).toBe(false);
    // The upgrade runs, and the bloom stands: its own click never closes it.
    bloom().querySelector<HTMLButtonElement>("#bloom-upgrade")!.click();
    expect(app.state.modules[0]!.level).toBe(1);
    expect(bloom().hidden).toBe(false);
  });

  it("zoomed past the bloom's size, the affordances ride the closed face and nothing pops", () => {
    // A roomy wrap on the tiny opening board: the on-screen module dwarfs
    // the fixed bloom, so an expanded face would only shrink it.
    const svg = document.getElementById("grid") as unknown as SVGSVGElement;
    Object.defineProperty(svg, "clientWidth", { configurable: true, value: 2000 });
    Object.defineProperty(svg, "clientHeight", { configurable: true, value: 2000 });
    app.render();
    clickCell(0,0);
    const bloomEl = document.getElementById("module-bloom")!;
    expect(bloomEl.hidden).toBe(false);
    expect(bloomEl.classList.contains("inline")).toBe(true);
    // No plate, no second face: just the upgrade card over the module.
    expect(bloomEl.querySelector(".bloom-plate")).toBeNull();
    expect(bloomEl.querySelector(".bloom-face")).toBeNull();
    expect(bloomEl.querySelector(".bloom-contribution")!.textContent).toBe(`+${formatNumber(0.1)} ν/s`);
    expect(bloomEl.querySelector("#bloom-upgrade")).not.toBeNull();
    // The upgrade still works from the closed face.
    bloomEl.querySelector<HTMLButtonElement>("#bloom-upgrade")!.click();
    expect(app.state.modules[0]!.level).toBe(1);
  });

  it("positions over the module: nested above, mirrored below when the top leaves no room", () => {
    const svg = document.getElementById("grid") as unknown as SVGSVGElement;
    // A tall, narrow wrap: the scaled board sits small enough for the bloom
    // to enlarge the module, with letterbox slack to separate the rows.
    Object.defineProperty(svg, "clientWidth", { configurable: true, value: 550 });
    Object.defineProperty(svg, "clientHeight", { configurable: true, value: 800 });
    app.state.cells.push(hex(0, 2));
    // The opening C4 (0,0) is the board's topmost cell: nesting above would
    // leave the frame, so the bloom presents below — mirrored onto the
    // cell's lower edges.
    app.render();
    clickCell(0,0);
    const bloomEl = document.getElementById("module-bloom")!;
    expect(bloomEl.hidden).toBe(false);
    expect(bloomEl.classList.contains("below")).toBe(true);
    expect(bloomEl.style.width).toBe("256px");
    // C5 (0,1) sits a full octave row lower: the bloom nests above — its
    // bottom corners resting on the cell's upper edges — and clears the
    // wrap's left edge.
    give(app.state, "additive", hex(0, 1));
    app.render();
    clickCell(0,1);
    expect(bloomEl.classList.contains("below")).toBe(false);
    const left = Number.parseFloat(bloomEl.style.left);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(Number.parseFloat(bloomEl.style.top)).toBeGreaterThan(0);
  });

  it("stays closed in flow — the board is locked and upgrades live between sessions", () => {
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.render();
    clickCell(0,0);
    expect(bloom().hidden).toBe(true);
    endSession(app.state);
  });

  it("module panels no longer offer upgrades — the expanded face is the upgrade surface", () => {
    app.render();
    clickCell(0,0);
    app.render();
    const panel = document.getElementById("inspector")!;
    expect(panel.querySelector("#upgrade-module")).toBeNull();
    expect(panel.textContent).not.toContain("Upgrade");
    // The panel keeps its information role.
    expect(panel.textContent).toContain("Additive Synth");
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

  it("lights chord voices, dims the rest, labels the named chord", () => {
    // The opening C4 plus an additive at G4: a Fifth on the lattice.
    give(app.state, "additive", hex(1, 0));
    // A far island with no pitch-set match: D5 at (2,0) is off-cluster.
    app.state.cells.push(hex(3, 0));
    give(app.state, "additive", hex(3, 0));
    app.ui.showChords = true;
    app.render();
    const grid = document.getElementById("grid")!;
    expect(grid.classList.contains("chord-view")).toBe(true);
    expect(grid.querySelectorAll(".cell-node.chord-lit")).toHaveLength(2);
    // Dimmed: the chordless island and the untouched empty cell.
    expect(grid.querySelectorAll(".cell-node.chord-dim")).toHaveLength(2);
    expect(grid.querySelectorAll(".chord-hull")).toHaveLength(1);
    expect(grid.querySelector(".chord-label")!.textContent).toBe("Fifth ×1.3");
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

  it("carries the duration affordances from the first start, visible but unpushed", () => {
    app.startFlow();
    const modal = document.getElementById("modal-content")!;
    // The chips and free entry are present; the resting plan is open-ended
    // and session one's steer suggests a short try (ADR-0019).
    expect([...modal.querySelectorAll(".plan-chip")]).toHaveLength(8);
    expect(modal.querySelectorAll(".plan-chip.active")).toHaveLength(0);
    expect((modal.querySelector("#plan-minutes") as HTMLInputElement).value).toBe("");
    expect(modal.querySelector("#plan-open")!.getAttribute("aria-pressed")).toBe("true");
    expect(modal.querySelector(".enter-steer")!.textContent).toContain("five minutes");
  });

  it("a picked chip re-renders the modal at once: the chip highlights and the footer tracks it", () => {
    const created = createHabit(app.state, "Jammin");
    app.startFlow();
    document.querySelector<HTMLButtonElement>('#modal-content [data-plan="25"]')!.click();
    expect(app.ui.chosenTarget).toBe(1500);
    let modal = document.getElementById("modal-content")!;
    // The renderKey fix (issue #92): the pick itself re-renders, so the
    // chip highlights without any further interaction.
    expect([...modal.querySelectorAll(".plan-chip.active")].map((c) => c.textContent)).toEqual(["25"]);
    expect((modal.querySelector("#plan-minutes") as HTMLInputElement).value).toBe("25");
    // The armed footer reads the live duration, summary included.
    document.querySelector<HTMLButtonElement>(`#modal-content [data-enter-habit="${created.habit!.id}"]`)!.click();
    modal = document.getElementById("modal-content")!;
    expect(document.getElementById("enter-begin")!.textContent).toBe("Begin — Jammin · 25 min");
    expect(modal.querySelector(".cta-summary")!.textContent).toBe("Jammin · 25 min");
    // Open-ended stays its own mode: it re-arms as the resting plan.
    document.getElementById("plan-open")!.click();
    modal = document.getElementById("modal-content")!;
    expect(modal.querySelectorAll(".plan-chip.active")).toHaveLength(0);
    expect(document.getElementById("enter-begin")!.textContent).toBe("Begin — Jammin · open-ended");
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
    // A planned pick rides into the label too.
    document.querySelector<HTMLButtonElement>('#modal-content [data-plan="10"]')!.click();
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
    document.querySelector<HTMLButtonElement>('#modal-content [data-plan="25"]')!.click();
    document.getElementById("enter-cancel")!.click();
    expect(app.ui.modal).toBeNull();
    app.startFlow();
    const modal = document.getElementById("modal-content")!;
    // The kind-first selection resets: nothing picked, nothing armed. The
    // chosen plan is the next session's plan (§6), so it persists — not
    // modal furniture.
    expect(modal.querySelectorAll(".enter-choice.selected")).toHaveLength(0);
    expect([...modal.querySelectorAll(".plan-chip.active")].map((c) => c.textContent)).toEqual(["25"]);
    expect((document.getElementById("enter-begin") as HTMLButtonElement).disabled).toBe(true);
    expect(document.getElementById("enter-begin")!.textContent).toBe("Select a habit");
  });

  it("a picked chip plans session one; the steer leaves after the first session", () => {
    app.startFlow();
    document.querySelector<HTMLButtonElement>('#modal-content [data-plan="25"]')!.click();
    expect(app.ui.chosenTarget).toBe(1500);
    app.closeModal();
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

describe("the catalog", () => {
  it("a shelf purchase stays in the catalog and lands in inventory", () => {
    app.state.nous = BALANCE.shelfPrices.generator;
    app.openModal("catalog");
    document.querySelector<HTMLButtonElement>('[data-buy="generator"]')!.click();
    expect(app.ui.modal).toBe("catalog");
    const generator = app.state.modules.find((m) => m.type === "focusKeyed")!;
    expect(generator.pos).toBeNull();
    expect(app.state.purchased.generator).toBe(true);
  });

  it("the cell row quotes the actual price", () => {
    app.openModal("catalog");
    const cellButton = document.getElementById("buy-cell")!;
    expect(cellButton.textContent).toContain(`${BALANCE.cellFirstCost} ν`);
  });

  it("omits the activation section while the ladder rests empty — no telegraph, no pricing", () => {
    app.openModal("catalog");
    const modal = document.getElementById("modal-content")!;
    expect(modal.querySelector(".catalog-activations")).toBeNull();
    expect(modal.textContent).not.toContain("Activations");
    expect(modal.querySelectorAll("[data-activate]")).toHaveLength(0);
    expect(modal.textContent).not.toContain("activate");
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
    // Five positions, end labels only, the middle neutral and the default.
    expect(slider.min).toBe("1");
    expect(slider.max).toBe("5");
    expect(slider.step).toBe("1");
    expect(slider.value).toBe("3");
    expect(text.value).toBe("");
    expect(modal.textContent).toContain("How did it go?");
    expect(modal.textContent).toContain("rough");
    expect(modal.textContent).toContain("great");
    // The reserved slot rides above dismissal.
    expect(slider.compareDocumentPosition(continueButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

// The signal channels (§4–5), recorded instead of played: the App seam
// takes a SignalChannels stub, mirroring how the engine injects Rng.
function makeRecorder() {
  const fired = {
    unlocks: 0,
    chimes: 0,
    notifications: 0,
    permissionRequests: 0,
    permission: "default" as "default" | "granted" | "denied",
  };
  const channels: SignalChannels = {
    unlockAudio: () => {
      fired.unlocks++;
      return null;
    },
    playChime: () => {
      fired.chimes++;
    },
    notificationPermission: () => fired.permission,
    requestNotificationPermission: () => {
      fired.permissionRequests++;
      fired.permission = "granted";
    },
    showTargetNotification: () => {
      fired.notifications++;
    },
  };
  return { fired, channels };
}

function stubChannels() {
  const recorder = makeRecorder();
  return { ...recorder, app: boot(recorder.channels) };
}

// happy-dom exposes visibilityState as a prototype getter; an own
// property override flips it per test (restored after each).
function setVisibility(state: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
}

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
    expect(document.querySelector("#console-apps .clock-caption")!.textContent).toBe("Open-ended");
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

// Midday stamps so no timezone can roll the date under test.
const DAY = new Date(2026, 8, 18, 12).getTime();

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
