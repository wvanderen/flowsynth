// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { App } from "./app";
import { addPracticeLog, archiveHabit, createHabit, selectHabit } from "../engine/habits";
import { equipBuildNode } from "../engine/builds";
import { createGoal, deleteGoal, goalSummary, accrueGoalProgress } from "../engine/goals";
import { recordSummaryReflection } from "../engine/actions";
import { writeNote } from "../engine/notes";
import { BALANCE, SAVE_VERSION } from "../engine/constants";
import { ARETE_HORIZON } from "../engine/accumulator";
import { STORAGE_KEY, serialize } from "../engine/save";
import { computeRates, cellCost, cellPurchasePrice, longGoalCost, affordableLevels, levelCost, levelsCost } from "../engine/economy";
import { startSession, endSession } from "../engine/actions";
import { advance } from "../engine/advance";
import { applyGap, flushPendingAway, poolOutstanding, resolveHonestyReport } from "../engine/trust";
import { recordMissed, recordTargetHit } from "../engine/records";
import { give } from "../engine/fixtures";
import { hex, sameHex } from "../engine/hex";
import { formatBalance, formatFixed, formatInt, formatNumber } from "./format";
import { lensFrame } from "./zoom";
import type { GameState } from "../engine/types";
import type { SignalChannels } from "./signals";

// UI smoke tests: the console chrome, the enter-prompt gating, and the
// catalog's shelf behavior, booted on the real index.html skeleton.

function boot(channels?: SignalChannels, dev = false): App {
  const html = readFileSync("index.html", "utf8");
  const body = html.slice(html.indexOf("<body>") + 6, html.lastIndexOf("</body>"));
  document.body.innerHTML = body;
  const els: Record<string, HTMLElement> = {};
  for (const id of [
    "console-session",
    "console-apps",
    "board-tools",
    "thumb-bar",
    "grid",
    "status",
    "modal",
    "modal-content",
  ]) {
    const element = document.getElementById(id);
    if (element) els[id] = element;
  }
  return new App(els, dev, channels);
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

describe("the board ledger strip (§7)", () => {
  it("docks above the board: Nous / Rate / Session as one instrument plus the feats chip", () => {
    app.render();
    const ledger = document.getElementById("board-ledger")!;
    expect(ledger.querySelector(".prod-ledger")).not.toBeNull();
    const labels = [...ledger.querySelectorAll(".prod-label")].map((n) => n.textContent);
    expect(labels).toEqual(["Nous", "Rate", "Session"]);
    expect(ledger.querySelector('[data-live="nous"]')!.textContent).toMatch(/ν$/);
    expect(ledger.querySelector('[data-live="rate"]')!.textContent).toMatch(/ν\/s$/);
    expect(ledger.querySelector('[data-live="session"]')!.textContent).toBe("—");
    expect(document.getElementById("feats-chip")).not.toBeNull();
    // The feats chip opens the achievements page.
    document.getElementById("feats-chip")!.click();
    expect(app.ui.modal).toBe("achievements");
    app.closeModal();
  });

  it("the nous read compresses instead of overflowing, with the exact value on its tooltip (issue #187)", () => {
    const read = () => document.querySelector('#board-ledger [data-live="nous"]')!;
    // Small balances render as before: the floored comma-grouped integer.
    app.state.nous = 5004.32;
    app.render();
    expect(read().textContent).toBe("5,004 ν");
    expect(read().getAttribute("title")).toBe("5,004");
    // The ladder takes over past the exact range; the tooltip stays exact.
    app.state.nous = 1_234_567;
    app.render();
    expect(read().textContent).toBe("1.235M ν");
    expect(read().getAttribute("title")).toBe(formatInt(1_234_567));
    // Scientific fallback: the figure stays in its lane at any magnitude.
    app.state.nous = 4.072e38;
    app.render();
    expect(read().textContent).toBe("4.072e38 ν");
    expect(read().getAttribute("title")).toBe(formatInt(4.072e38));
    // A tight live surface: the compressed read holds a constant, short
    // width as the balance ticks (ADR-0031).
    app.state.nous = 4.072e38 + 1e30;
    app.render();
    expect(read().textContent!.length).toBeLessThanOrEqual("4.072e38 ν".length);
  });

  it("the Rate cell shows the final total; the session read keeps its trailing zeros while a session runs", () => {
    app.render();
    const cell = document.getElementById("rate-cell")!;
    // No operand chain: the total is the display, the module-linked details
    // live beside the cell (issue #154).
    expect(cell.querySelector(".rate-equation")).toBeNull();
    expect(cell.querySelector('[data-live="rate"]')!.textContent).toBe(`${formatNumber(0.1)} ν/s`);
    expect(document.querySelector('#board-ledger [data-live="session"]')!.textContent).toBe("—");
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, 600);
    advance(s, 30);
    app.render();
    const session = document.querySelector('#board-ledger [data-live="session"]')!.textContent!;
    // A tight live surface (ADR-0031 as applied here): fixed decimals, so
    // the trailing zero never comes and goes mid-session.
    expect(session).toMatch(/\.\d{2} ν$/);
    endSession(s);
    app.render();
    expect(document.querySelector('#board-ledger [data-live="session"]')!.textContent).toBe("—");
  });

  it("the details disclose nonproducing modules' effects — never a second ν/s", () => {
    app.render();
    // The launch roster is one synthesizer: no other-modules section yet.
    expect(document.querySelector("#rate-slot .rd-other-row")).toBeNull();
    give(app.state, "infusor", hex(0, 1));
    app.render();
    const row = document.querySelector("#rate-slot .rd-other-row")!;
    expect(row.textContent).toContain("Booster");
    expect(row.querySelector('[data-live^="n-"]')!.textContent).toBe("+20% to adjacent");
    // The uplifted synth's own leg carries the same uplift...
    expect(document.querySelector("#rate-slot .rd-synth .rd-legs")!.textContent).toContain("+20%");
    // ...and the nonproducer's row never wears a ν/s figure.
    expect(row.textContent).not.toContain("ν/s");
  });

  it("every synthesizer row carries its final ν/s and expands into its legs; the rows sum to the board's rate", () => {
    const s = app.state;
    give(s, "additive", hex(1, 0)); // G4 — a Fifth with the launch C4
    give(s, "infusor", hex(0, 1)); // uplift on C4
    app.render();
    const snapshot = computeRates(s);
    const rows = [...document.querySelectorAll("#rate-slot .rd-synth")];
    expect(rows).toHaveLength(2);
    let sum = 0;
    for (const row of rows) {
      const id = row.getAttribute("data-module-id")!;
      const text = row.querySelector(`[data-live="s-${id}-v"]`)!.textContent!;
      expect(text).toMatch(/^\+/);
      sum += parseFloat(text.replace(/[+,]/g, "").replace(" ν/s", ""));
    }
    expect(Math.abs(sum - snapshot.rate)).toBeLessThan(0.01);
    // The total row answers with the same figure.
    expect(document.querySelector('#rate-slot [data-live="b-rate"]')!.textContent).toBe(
      `${formatNumber(snapshot.rate)} ν/s`,
    );
    // The expanded legs: base, chords (named), infusor, charge, achievements.
    const fifth = snapshot.namedChords[0]!;
    const legs = rows[0]!.querySelector(".rd-legs")!.textContent!;
    expect(legs).toContain("Base");
    expect(legs).toContain(fifth.name);
    expect(legs).toContain("Chords");
    expect(legs).toContain("Booster");
    expect(legs).toContain("Charge");
    expect(legs).toContain("Achievements");
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
    expect(modal.textContent).toContain("the synth terms alone");
    give(s, "additive", hex(1, 0)); // G4 — a Fifth for the next session
    give(s, "infusor", hex(0, 1)); // C5 — uplift on both voices
    startSession(s, null);
    advance(s, 60);
    endSession(s);
    app.render();
    // The synths leg carries the local chords — including the formation's
    // quality — and there is no board-wide chord-multiplier claim to lean
    // on (ADR-0036).
    const q = 1 + BALANCE.complexityRate;
    expect(modal.textContent).toContain(`synths +${formatNumber(0.26 * q)} ν/s`);
    expect(modal.textContent).toContain(`boosters +${formatNumber(0.052 * q)} ν/s`);
    expect(modal.textContent).not.toContain("chords ×");
    expect(modal.textContent).not.toContain("carrier");
    expect(modal.textContent).not.toContain("harmonics");
  });

  it("an old v6 save in localStorage boots fresh: refused with the standard version error", () => {
    const legacy = app.state;
    createHabit(legacy, "Piano");
    legacy.sessionsCompleted = 4;
    legacy.totalEarned = 2_500;
    legacy.arete = 1;
    const file = JSON.parse(JSON.stringify({ app: "flowsynth", version: 6, savedAt: 1_000, state: legacy }));
    localStorage.setItem("flowsynth.save.v1", JSON.stringify(file));
    const revived = boot();
    // The v7 boundary refuses v6 outright (ADR-0017's pattern): no crash,
    // no hybrid — the standard fresh-start message greets the player.
    expect(revived.state.sessionsCompleted).toBe(0);
    expect(revived.state.totalEarned).toBe(0);
    expect(revived.state.arete).toBe(0);
    expect(revived.state.habits).toHaveLength(0);
    expect(revived.state.modules).toHaveLength(1);
    expect(document.getElementById("status")!.textContent).toMatch(/older version/);
  });
});

// The responsive gates read the #app container's inline size; tests pin it
// directly (happy-dom lays out nothing).
function setAppWidth(px: number): void {
  Object.defineProperty(document.getElementById("app"), "clientWidth", { configurable: true, value: px });
}

describe("the rate details disclosure (§7, issue #154)", () => {
  it("below the 760px container breakpoint, tapping the Rate cell opens the rate sheet over a scrim", () => {
    setAppWidth(720);
    app.render();
    document.getElementById("rate-cell")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.modal).toBe("rate");
    // The modal layer is body-level, so the container gate's decision rides
    // a sheet class on the backdrop — bottom sheet over the scrim, whatever
    // the viewport media query thinks.
    expect(document.getElementById("modal")!.classList.contains("sheet")).toBe(true);
    const modal = document.getElementById("modal-content")!;
    // The sheet is the module-linked roster the popover holds above the
    // line: the total, one row per synthesizer with its final ν/s, printed.
    expect(modal.textContent).toContain("What makes the rate.");
    expect(modal.querySelector(".rd-total")).not.toBeNull();
    expect(modal.querySelectorAll(".rd-synth")).toHaveLength(1);
    expect(modal.querySelector(".rd-synth")!.getAttribute("data-module-id")).toBeTruthy();
    expect(modal.querySelector(".rd-synth .rd-legs")!.textContent).toContain("Achievements");
    // Closing drops the sheet presentation with the modal.
    app.closeModal();
    expect(document.getElementById("modal")!.classList.contains("sheet")).toBe(false);
  });

  it("the rate sheet rides the container, not the viewport", () => {
    // A 700px container inside a wide viewport still presents as a sheet.
    setAppWidth(700);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
    app.render();
    document.getElementById("rate-cell")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.modal).toBe("rate");
    expect(document.getElementById("modal")!.classList.contains("sheet")).toBe(true);
    app.closeModal();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  });

  it("above the breakpoint a tap opens the sheet too, the popover stays in the DOM, and a row selects its module", () => {
    setAppWidth(1200);
    app.render();
    // A touch surface above the line has no hover and (on iOS) no
    // focus-on-tap, so the cell's tap is its door at every width — the
    // sheet presents as a plain modal here, not a bottom sheet.
    document.getElementById("rate-cell")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.modal).toBe("rate");
    expect(document.getElementById("modal")!.classList.contains("sheet")).toBe(false);
    app.closeModal();
    // The disclosure rides the cell's slot: the roster lives in the DOM.
    expect(document.querySelector("#rate-slot .rate-breakdown")).not.toBeNull();
    // A synthesizer row's tap identifies its module on the board: the
    // bloom lifts the module's own face off the grid and the row wears
    // the picked mark.
    const row = document.querySelector("#rate-slot .rd-synth")!;
    row.querySelector("summary")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const id = row.getAttribute("data-module-id")!;
    expect(app.ui.selected).toBe(id);
    expect((document.getElementById("module-bloom") as HTMLElement).hidden).toBe(false);
    expect(row.classList.contains("picked")).toBe(true);
    // A second tap releases it.
    row.querySelector("summary")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.selected).toBeNull();
    // A click inside the expanded legs is reading, never picking: copying
    // a figure or scrolling the roster must not select the module.
    (row as HTMLDetailsElement).open = true;
    row.querySelector(".rd-legs")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.selected).toBeNull();
  });

  it("the boundary width itself stays on the desktop side of the 760px line", () => {
    // Exactly 760: the tap opens the sheet as a plain modal — the sheet
    // presentation is the strict `<` range (width < 760px) the stylesheet
    // reads. One pixel less: the same door opens as a bottom sheet.
    setAppWidth(760);
    app.render();
    document.getElementById("rate-cell")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.modal).toBe("rate");
    expect(document.getElementById("modal")!.classList.contains("sheet")).toBe(false);
    app.closeModal();
    setAppWidth(759);
    app.render();
    document.getElementById("rate-cell")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.modal).toBe("rate");
    expect(document.getElementById("modal")!.classList.contains("sheet")).toBe(true);
    app.closeModal();
  });

  it("a leg's click never closes the sheet mid-read; only a row's tap does", () => {
    setAppWidth(720);
    app.render();
    document.getElementById("rate-cell")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const modal = document.getElementById("modal-content")!;
    const row = modal.querySelector(".rd-synth") as HTMLDetailsElement;
    row.open = true;
    row.querySelector(".rd-legs")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.modal).toBe("rate");
    // The row's own tap closes the sheet and lands the selection.
    row.querySelector("summary")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.modal).toBeNull();
    expect(app.ui.selected).toBe(row.getAttribute("data-module-id"));
  });

  it("above the line the whole ledger is the door; below it nothing changes (#233)", () => {
    // The door's contract lives in the stylesheet's ≥760px container block:
    // the strip is the hover/focus area, the popover drops ledger-wide, the
    // rate cell's inner hairline (button border and hover fill) is dead, and
    // the ⓘ ring brightens with the ledger — never the cell.
    const css = readFileSync("src/ui/style.css", "utf8");
    const mark = "@container app (width >= 760px)";
    expect(css).toContain(mark);
    const after = css.indexOf(mark);
    const door = css.slice(after, css.indexOf("\n}", after));
    expect(door).toContain(".prod-ledger { position: relative; }");
    expect(door).toContain(".rate-slot { position: static; }");
    expect(door).toContain(".prod-cell-rate { border-color: transparent; }");
    expect(door).toContain(".prod-ledger:hover .prod-cell-rate");
    expect(door).toContain(".rate-breakdown { left: 0; width: min(560px, 100%); max-height: min(76vh, 640px); }");
    expect(door).toContain(".prod-ledger:hover .rate-breakdown");
    expect(door).toContain(".prod-ledger:focus-within .rate-breakdown { display: block; }");
    // The disclosure's geometry below the line is untouched.
    const base = css.slice(css.indexOf(".rate-breakdown {"), css.indexOf(mark));
    expect(base).toContain("width: 350px");
  });

  it("the sheet keeps its figures live in place — a tick never rebuilds it (ADR-0037)", () => {
    setAppWidth(720);
    app.render();
    document.getElementById("rate-cell")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const modal = document.getElementById("modal-content")!;
    const row = modal.querySelector(".rd-synth") as HTMLDetailsElement;
    row.open = true;
    // Stamp a sentinel into a live slot: the next render must overwrite it
    // in place (the tick's fill), not rebuild the sheet around it.
    modal.querySelector('[data-live="b-rate"]')!.textContent = "stale";
    app.render();
    expect(modal.querySelector('[data-live="b-rate"]')!.textContent).not.toBe("stale");
    expect(modal.querySelector('[data-live="b-rate"]')!.textContent).toMatch(/ν\/s$/);
    expect(row.open).toBe(true);
    app.closeModal();
  });

  it("the zoom cluster rises above an open modal sheet (§7, ADR-0029)", () => {
    // The cluster's reaction rides a body class: up with the sheet, down
    // when it closes — inspection never buries it.
    setAppWidth(720);
    app.render();
    expect(document.body.classList.contains("modal-sheet-open")).toBe(false);
    document.getElementById("rate-cell")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.modal).toBe("rate");
    expect(document.body.classList.contains("modal-sheet-open")).toBe(true);
    app.closeModal();
    expect(document.body.classList.contains("modal-sheet-open")).toBe(false);
  });
});

describe("the horizon bar (§7, issue #156)", () => {
  it("is an ambient curve: centered label with the log percentage; no totals, marks, countdown, or button", () => {
    app.render();
    expect(document.getElementById("status-monitor")).toBeNull();
    expect(document.querySelector(".board-footer")).toBeNull();
    const bar = document.getElementById("horizon-bar")!;
    expect(bar.querySelector(".horizon-track")).not.toBeNull();
    // The label rides centered with its one figure: the bar's log percentage.
    const word = bar.querySelector(".horizon-word")!;
    expect(word.textContent).toContain("Arete");
    expect(word.querySelector('[data-live="h-word"]')!.textContent).toBe("0%");
    // No endpoint tick, no lifetime total, no decade marks, no practice
    // beat, no prestige door.
    expect(bar.querySelector(".horizon-cap")).toBeNull();
    expect(bar.querySelector('[data-live="p-total"]')).toBeNull();
    expect(bar.querySelector(".pill-grad")).toBeNull();
    expect(bar.querySelector(".pill-head")).toBeNull();
    expect(bar.querySelector("button")).toBeNull();
  });

  it("moves visibly in early play: clip width and label percentage follow the log scale", () => {
    app.render();
    const clip = document.querySelector<SVGRectElement>('#horizon-bar [data-live="h-clip"]')!;
    // At the floor the bar starts empty.
    expect(Number.parseFloat(clip.style.getPropertyValue("width"))).toBe(0);
    expect(document.querySelector('#horizon-bar [data-live="h-word"]')!.textContent).toBe("0%");
    // The bar reads the era's measure (ADR-0039), not the lifetime total.
    app.state.eraEarned = 1_000;
    app.render();
    // Two of twenty-two decades through the scale, patched in place — no rebuild.
    expect(Number.parseFloat(clip.style.getPropertyValue("width"))).toBe(54.55);
    expect(document.querySelector('#horizon-bar [data-live="h-word"]')!.textContent).toBe("9%");
    expect(document.querySelector(".horizon-word")).not.toBeNull();
  });

  it("the completed era hosts the prestige door in upgrade mode (ADR-0039)", () => {
    app.state.eraEarned = ARETE_HORIZON;
    app.render();
    const bar = document.getElementById("horizon-bar")!;
    expect(bar.classList.contains("reached")).toBe(true);
    // The percentage readout gives way to the door, its claim live.
    expect(bar.querySelector(".horizon-word")).toBeNull();
    const door = bar.querySelector<HTMLButtonElement>("#prestige-door")!;
    expect(door.textContent).toContain("Prestige and Claim 1 Arete");
    // The fill sits complete at the horizon.
    const clip = bar.querySelector<SVGRectElement>('[data-live="h-clip"]')!;
    expect(Number.parseFloat(clip.style.getPropertyValue("width"))).toBe(600);
  });

  it("outside upgrade mode the door shows locked — a readout, never a button", () => {
    app.state.eraEarned = ARETE_HORIZON;
    startSession(app.state, null);
    app.render();
    const bar = document.getElementById("horizon-bar")!;
    expect(bar.querySelector("#prestige-door")).toBeNull();
    expect(bar.querySelector("button")).toBeNull();
    expect(bar.querySelector(".horizon-state")!.textContent).toContain("enter upgrade mode");
    // And nothing about the locked state opens the confirm.
    app.openPrestigeConfirm();
    expect(app.ui.modal).toBeNull();
  });

  it("pressing the door opens a confirm; confirming banks the claim and begins the next era", () => {
    app.state.eraEarned = ARETE_HORIZON;
    app.state.nous = 8_000;
    const prestigeGen = give(app.state, "focusKeyed", hex(2, 0));
    prestigeGen.reserve = 120;
    app.render();
    document.getElementById("prestige-door")!.click();
    expect(app.ui.modal).toBe("prestige");
    const content = document.getElementById("modal-content")!;
    expect(content.textContent).toContain("1 Arete");
    document.getElementById("prestige-confirm")!.click();
    expect(app.ui.modal).toBeNull();
    expect(app.state.arete).toBe(1);
    expect(app.state.prestiges).toBe(1);
    // The boundary: era bar rebased, nous and charge reset.
    expect(app.state.eraEarned).toBe(0);
    expect(app.state.nous).toBe(BALANCE.openingGrant);
    expect(app.state.modules.every((m) => m.reserve === 0)).toBe(true);
    // The bar reads the fresh era: 0%, no door.
    app.render();
    const bar = document.getElementById("horizon-bar")!;
    expect(bar.querySelector("#prestige-door")).toBeNull();
    expect(document.querySelector('#horizon-bar [data-live="h-word"]')!.textContent).toBe("0%");
  });

  it("two consecutive resets bank 1 then 2, the door's claim reading live", () => {
    app.state.eraEarned = ARETE_HORIZON;
    app.render();
    document.getElementById("prestige-door")!.click();
    document.getElementById("prestige-confirm")!.click();
    expect(app.state.arete).toBe(1);
    app.state.eraEarned = ARETE_HORIZON;
    app.render();
    const door = document.getElementById("prestige-door")!;
    expect(door.textContent).toContain("Claim 2 Arete");
    door.click();
    document.getElementById("prestige-confirm")!.click();
    expect(app.state.arete).toBe(3);
    expect(app.state.prestiges).toBe(2);
  });

  it("post-break the door's claim carries the era's overfill, live (issue #200)", () => {
    app.state.horizonBroken = true;
    app.state.eraEarned = ARETE_HORIZON * 100;
    app.render();
    expect(document.getElementById("prestige-door")!.textContent).toContain("Claim 3 Arete");
    // The readout grows as the era does: another decade, another point.
    app.state.eraEarned = ARETE_HORIZON * 1000;
    app.render();
    expect(document.getElementById("prestige-door")!.textContent).toContain("Claim 4 Arete");
  });

  it("carries no formula chip; the flow meter rides the dock's pip", () => {
    app.render();
    expect(document.querySelector(".monitor-formula")).toBeNull();
    expect(document.querySelector(".monitor-rail")).toBeNull();
    app.state.flow.progress = 90;
    app.render();
    const forge = document.querySelector('#board-tools [data-op="forge"]') as HTMLElement;
    expect(forge.querySelector(".forge-pip")).not.toBeNull();
    expect(forge.querySelector('[data-live="forge-pip"]')!.getAttribute("style")).toContain("50");
    expect(forge.querySelector(".forge-detail")!.textContent).toContain("Flow meter 1:30 / 3:00");
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

describe("the action row (§7)", () => {
  it("is a left-edge icon dock: Catalog / Forge / New cell / Inventory — no legend, no Arrange, no Chords toggle", () => {
    app.render();
    const dock = document.getElementById("board-tools")!;
    const ops = [...dock.querySelectorAll("[data-op]")].map((b) => b.getAttribute("data-op"));
    expect(ops).toEqual(["catalog", "forge", "cell", "inventory"]);
    // The count badge rides the Forge icon; the charge pip rides beneath it.
    expect(dock.querySelector('[data-op="forge"] .forge-pip')).not.toBeNull();
    expect(document.querySelector(".legend")).toBeNull();
    expect(document.getElementById("tool-manage")).toBeNull();
    expect(document.getElementById("manage-banner")).toBeNull();
    expect(document.getElementById("inventory-zone")).not.toBeNull();
    // The tray column starts closed and the dock icon toggles it.
    const zone = document.getElementById("inventory-zone") as HTMLElement;
    expect(zone.classList.contains("off")).toBe(true);
    dock.querySelector<HTMLButtonElement>('[data-op="inventory"]')!.click();
    expect(zone.classList.contains("off")).toBe(false);
    expect(app.ui.trayOpen).toBe(true);
  });

  it("the Forge tool carries the flow-meter pip and the one meter detail (ADR-0041)", () => {
    app.state.flow.progress = 90;
    app.state.forge.progress = 30;
    app.render();
    const forge = document.querySelector('#board-tools [data-op="forge"]') as HTMLButtonElement;
    // The pip shows the flow meter: half of the 3-minute opening fill.
    expect(forge.querySelector('[data-live="forge-pip"]')!.getAttribute("style")).toContain("50");
    // The detail lists every meter's progress, threshold, and rate.
    expect(forge.querySelector(".forge-detail")!.textContent).toContain("Flow meter 1:30 / 3:00 — next roll in ~1:30 of practice");
    expect(forge.querySelector(".forge-detail")!.textContent).toContain("Forge progress 30 / 60");
    // The sheet locks in flow (#233): the dock button disables, the pip
    // stays as the indicator, and the tooltip carries the meter read plus
    // the lock reason. The click never expands the sheet mid-session.
    app.state.sessionsCompleted = 1;
    startSession(app.state, null);
    app.render();
    const flowForge = document.querySelector<HTMLButtonElement>('#board-tools [data-op="forge"]')!;
    expect(flowForge.disabled).toBe(true);
    expect(flowForge.querySelector('[data-live="forge-pip"]')).not.toBeNull();
    expect(flowForge.querySelector(".forge-detail")!.textContent).toContain("choices settle between sessions.");
    flowForge.click();
    expect(app.ui.modal).toBeNull();
  });

  it("in flow the locked Forge reads its meters on hover, both dock and thumb bar (#233)", () => {
    app.state.sessionsCompleted = 1;
    startSession(app.state, null);
    app.render();
    for (const host of ["board-tools", "thumb-bar"]) {
      const forge = document.querySelector<HTMLButtonElement>(`#${host} [data-op="forge"]`)!;
      expect(forge.disabled).toBe(true);
      const detail = forge.querySelector<HTMLElement>(".forge-detail")!;
      forge.dispatchEvent(new MouseEvent("mouseenter"));
      expect(detail.hidden).toBe(false);
      expect(detail.textContent).toContain("Flow meter");
      expect(detail.textContent).toContain("choices settle between sessions.");
      forge.dispatchEvent(new MouseEvent("mouseleave"));
      expect(detail.hidden).toBe(true);
      forge.click();
      expect(app.ui.modal).toBeNull();
    }
  });

  it("focus opens live meter details without moving focus, and Escape or blur dismisses them", () => {
    app.state.flow.progress = 90;
    app.render();
    for (const host of ["board-tools", "thumb-bar"]) {
      const forge = document.querySelector<HTMLButtonElement>(`#${host} [data-op="forge"]`)!;
      const detail = forge.querySelector<HTMLElement>(".forge-detail")!;
      expect(detail.hidden).toBe(true);
      expect(forge.getAttribute("aria-describedby")).toBe(detail.id);
      forge.focus();
      expect(detail.hidden).toBe(false);
      expect(document.activeElement).toBe(forge);
      expect(app.ui.modal).toBeNull();
      app.state.flow.progress = 90;
      app.render();
      expect(forge.querySelector(".forge-detail")).toBe(detail);
      expect(detail.textContent).toContain("Flow meter 1:30 / 3:00");
      expect(detail.textContent).toContain("Forge progress");
      forge.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(detail.hidden).toBe(true);
      forge.blur();
      forge.focus();
      expect(detail.hidden).toBe(false);
      forge.blur();
      expect(detail.hidden).toBe(true);
      forge.dispatchEvent(new MouseEvent("mouseenter"));
      expect(detail.hidden).toBe(false);
      forge.dispatchEvent(new MouseEvent("mouseleave"));
      expect(detail.hidden).toBe(true);
    }
  });

  it("the Forge modal lists both meters live, and flow only previews its candidates", () => {
    app.state.forge.progress = 30;
    app.state.bankedRolls.push({
      id: "offer",
      candidates: [
        { id: "c1", type: "additive", rarity: "common" },
        { id: "c2", type: "spacer", rarity: "common" },
        { id: "c3", type: "infusor", rarity: "common" },
      ],
    });
    app.openModal("forge");
    const modal = document.getElementById("modal-content")!;
    expect(modal.querySelector(".forge-meters")).not.toBeNull();
    expect(modal.querySelector('[data-live="modal-flow-line"]')!.textContent).toContain("Flow meter 0:00 / 3:00");
    expect(modal.querySelector('[data-live="modal-forge-line"]')!.textContent).toContain("30 / 60");
    // Live slots fill in place as the meters move.
    app.state.flow.progress = 90;
    app.render();
    expect(modal.querySelector('[data-live="modal-flow-line"]')!.textContent).toContain("1:30 / 3:00");
    app.closeModal();
    // The sheet locks in flow (#233): the dock refuses, the modal never
    // opens, and the banked roll waits for the session's end — the engine's
    // guard stands behind the UI's locked door.
    app.state.sessionsCompleted = 1;
    startSession(app.state, null);
    app.render();
    const forgeButton = document.querySelector<HTMLButtonElement>('#board-tools [data-op="forge"]')!;
    expect(forgeButton.disabled).toBe(true);
    forgeButton.click();
    expect(app.ui.modal).toBeNull();
    expect(app.state.bankedRolls).toHaveLength(1);
  });

  it("the cell tool shows the price and arms the frontier pick", () => {
    app.state.nous = BALANCE.cellFirstCost;
    app.render();
    document.querySelector<HTMLButtonElement>('#board-tools [data-op="cell"]')!.click();
    expect(app.ui.buyingCell).toBe(true);
    // Arming re-renders the dock; the re-queried icon is active.
    const armed = document.querySelector<HTMLButtonElement>('#board-tools [data-op="cell"]')!;
    expect(armed.classList.contains("active")).toBe(true);
    expect(armed.title).toContain("Esc cancels");
    // Armed again toggles off; no banner element exists anywhere.
    armed.click();
    expect(app.ui.buyingCell).toBe(false);
    expect(document.getElementById("buy-banner")).toBeNull();
  });

  it("the Inventory dock button is disabled during flow, like Catalog/Forge/New cell (#193)", () => {
    app.render();
    const dockButton = () => document.querySelector<HTMLButtonElement>('#board-tools [data-op="inventory"]')!;
    expect(dockButton().disabled).toBe(false);
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.render();
    expect(dockButton().disabled).toBe(true);
    expect(dockButton().title).toContain("locked during flow");
    // Dead in flow: the tray column never opens.
    dockButton().click();
    expect(app.ui.trayOpen).toBe(false);
    expect(document.getElementById("inventory-zone")!.classList.contains("off")).toBe(true);
  });
});

describe("the thumb bar (§7, portrait phone)", () => {
  beforeEach(() => {
    setAppWidth(390);
  });

  it("folds the dock plus Inventory and Feats into the bottom bar", () => {
    give(app.state, "additive", null);
    app.render();
    const bar = document.getElementById("thumb-bar")!;
    const ops = [...bar.querySelectorAll("[data-op]")].map((b) => b.getAttribute("data-op"));
    expect(ops).toEqual(["catalog", "forge", "cell", "inventory", "feats", "library"]);
    expect(bar.querySelector('[data-op="inventory"]')!.textContent).toContain("Inventory · 1");
    expect(bar.querySelector('[data-op="feats"]')!.textContent).toContain("Feats · 0");
    // On phone Inventory taps the sheet; feats opens the feats page; the
    // library opens the field guide (issue #230).
    bar.querySelector<HTMLButtonElement>('[data-op="inventory"]')!.click();
    expect(app.ui.modal).toBe("inventory");
    app.closeModal();
    bar.querySelector<HTMLButtonElement>('[data-op="feats"]')!.click();
    expect(app.ui.modal).toBe("achievements");
    app.closeModal();
    bar.querySelector<HTMLButtonElement>('[data-op="library"]')!.click();
    expect(app.ui.modal).toBe("library");
    app.closeModal();
  });

  it("the inventory sheet arms a placement from its tiles", () => {
    app.returnToInventory("m1");
    app.openModal("inventory");
    const modal = document.getElementById("modal-content")!;
    expect(modal.querySelector('[data-inv="m1"]')).not.toBeNull();
    (modal.querySelector('[data-inv="m1"]') as HTMLButtonElement).click();
    expect(app.ui.modal).toBeNull();
    expect(app.ui.placing).toBe("m1");
    app.cancelPlacing();
  });

  it("the chord library's door and cards (issue #230)", () => {
    // A placement forms the board's first Fifth: the discovery lands at
    // the action boundary, the ledger chip counts it, and the field guide
    // names the class.
    const tray = give(app.state, "additive", null);
    app.pickCellThenPlace(tray.id, hex(1, 0));
    app.render();
    expect(app.state.chordDiscovery["Fifth"]?.formed).toBe(true);
    const chip = document.getElementById("library-chip")!;
    expect(chip.textContent).toContain("1/11 chords");
    chip.click();
    expect(app.ui.modal).toBe("library");
    const modal = document.getElementById("modal-content")!;
    expect(modal.textContent).toContain("1 of 11 classes discovered");
    const named = [...modal.querySelectorAll(".library-card:not(.locked)")];
    expect(named).toHaveLength(1);
    expect(named[0]!.querySelector("h3")!.textContent).toBe("Fifth");
    // Every undiscovered class is the silhouette alone — no name, no copy.
    const locked = [...modal.querySelectorAll(".library-card.locked")];
    expect(locked).toHaveLength(10);
    for (const card of locked) {
      expect(card.querySelector("h3")).toBeNull();
      expect(card.querySelector(".chord-glyph")).not.toBeNull();
    }
    // The rate details carry the discovery bonus beside the feats'.
    app.closeModal();
    const breakdown = document.querySelector("#rate-slot .rate-breakdown")!;
    expect(breakdown.textContent).toContain("Discoveries");
    expect(breakdown.textContent).toContain("+1%");
  });

  it("the inventory sheet cannot arm a placement during flow (#193)", () => {
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    const trayModule = give(app.state, "additive", null);
    app.render();
    // The thumb bar's Inventory segment is dead in flow, so the sheet is
    // opened directly here — the gate the tap would ride.
    app.openModal("inventory");
    const modal = document.getElementById("modal-content")!;
    const tile = modal.querySelector<HTMLButtonElement>(`[data-inv="${trayModule.id}"]`)!;
    expect(tile.disabled).toBe(true);
    expect(modal.textContent).toContain("locked during flow");
    tile.click();
    expect(app.ui.placing).toBeNull();
    expect(app.ui.modal).toBe("inventory");
  });
});

describe("a module roll's scrimless peek (#193)", () => {
  // One banked roll to open the Forge with.
  const bankRoll = (): void => {
    app.state.sessionsCompleted = 1;
    app.state.bankedRolls.push({
      id: "roll1",
      candidates: [
        { id: "rc1", type: "additive", rarity: "common" },
        { id: "rc2", type: "spacer", rarity: "common" },
        { id: "rc3", type: "infusor", rarity: "uncommon" },
      ],
    });
  };

  it("a pending roll drops the scrim: the backdrop is pass-through and the board stays inspectable", () => {
    bankRoll();
    app.openModal("forge");
    const backdrop = document.getElementById("modal")!;
    expect(backdrop.classList.contains("peek")).toBe(true);
    expect(backdrop.getAttribute("aria-modal")).toBe("false");
    // Selection works through the peek and dismisses it without taking the roll.
    clickCell(0, 0);
    expect(app.ui.selected).toBe("m1");
    expect(app.ui.modal).toBeNull();
    expect(app.state.bankedRolls).toHaveLength(1);
    app.openModal("forge");
    expect(document.getElementById("modal-content")!.querySelectorAll(".candidate-tile")).toHaveLength(3);
    // Candidate faces carry no engraved level (#193) — a roll is a choice of
    // module, not of level.
    expect(document.querySelectorAll(".candidate-tile .face-level")).toHaveLength(0);
    // Hover works under the peek too: the reserved readout answers.
    document.getElementById("grid")!.querySelector('[data-cell="0,0"]')!.dispatchEvent(
      new MouseEvent("pointerover", { bubbles: true }),
    );
    expect(document.getElementById("chord-readout")!.hidden).toBe(false);
    expect(document.getElementById("chord-readout")!.textContent).toContain("ν/s");
  });

  it("outside clicks dismiss the pass-through peek, while card clicks and opening it do not", () => {
    bankRoll();
    app.render();
    document.querySelector<HTMLButtonElement>('#board-tools [data-op="forge"]')!.click();
    expect(app.ui.modal).toBe("forge");
    document.querySelector("#modal-content .modal-note")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.modal).toBe("forge");
    document.body.click();
    expect(app.ui.modal).toBeNull();
    expect(app.state.bankedRolls).toHaveLength(1);
  });

  it("the peek carries a visible dismiss affordance, and Esc dismisses", () => {
    bankRoll();
    app.openModal("forge");
    const close = document.getElementById("close-modal")!;
    expect(close).not.toBeNull();
    close.click();
    expect(app.ui.modal).toBeNull();
    // Esc puts the choice away too.
    bankRoll();
    app.openModal("forge");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(app.ui.modal).toBeNull();
  });

  it("every other modal keeps its scrim", () => {
    app.openModal("catalog");
    const backdrop = document.getElementById("modal")!;
    expect(backdrop.classList.contains("peek")).toBe(false);
    expect(backdrop.getAttribute("aria-modal")).toBe("true");
    app.closeModal();
    // And a closed peek clears: the next render leaves no residue.
    bankRoll();
    app.openModal("forge");
    app.closeModal();
    expect(backdrop.classList.contains("peek")).toBe(false);
    expect(backdrop.hidden).toBe(true);
  });
});

describe("the always-live board (§5)", () => {
  const cell = (q: number, r: number) => document.querySelector(`[data-cell="${q},${r}"]`)!;
  const ghosts = () => document.getElementById("grid")!.querySelectorAll(".ghost-mark");
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

  it("an empty cell reads as owned space: dashed outline and note, no add prompt (#151)", () => {
    app.render();
    const grid = document.getElementById("grid")!;
    const empty = grid.querySelector('[data-cell="0,1"]')!;
    // The dashed outline and the pitch name stay; the plus and the EMPTY
    // CELL prompt are gone — an owned cell is not an add button.
    expect(empty.querySelector(".hex.empty")).not.toBeNull();
    expect(empty.querySelector(".hex-note")!.textContent).toBe("C5");
    expect(empty.querySelector(".empty-plus")).toBeNull();
    expect(empty.textContent).not.toContain("EMPTY CELL");
  });

  it("empty and occupied faces wear one note treatment: centered, in the same register (#193)", () => {
    app.render();
    const grid = document.getElementById("grid")!;
    const emptyNote = grid.querySelector('[data-cell="0,1"] .hex-note')!;
    // The empty cell's note centers on its cell — the old alignment defect
    // (#172), the translucent chassis (#201) letting the chord work through.
    expect(emptyNote.getAttribute("y")).toBe("0");
    expect(emptyNote.getAttribute("dominant-baseline")).toBe("central");
    expect(emptyNote.getAttribute("text-anchor")).toBe("middle");
    expect(grid.querySelector('[data-cell="0,1"] .hex.empty')!.getAttribute("class")).toContain("empty");
    // The occupied face's note is where it always sat.
    const faceNote = grid.querySelector('[data-cell="0,0"] .face-note')!;
    expect(faceNote.textContent).toBe("C4");
    expect(faceNote.getAttribute("y")).toBe("43");
  });

  it("a spacer face never wears a level engraving; upgrading modules keep theirs (#193)", () => {
    give(app.state, "spacer", hex(1, 0));
    app.render();
    const grid = document.getElementById("grid")!;
    expect(grid.querySelector('[data-type="spacer"] .face-level')).toBeNull();
    expect(grid.querySelector('.module-node:not([data-type="spacer"]) .face-level')!.textContent).toBe("LV 0");
  });

  it("the armed frontier wears one cost spot: the pill carries the price, the hexes rest bare (#201)", () => {
    app.state.nous = BALANCE.cellFirstCost;
    app.render();
    document.querySelector<HTMLButtonElement>('#board-tools [data-op="cell"]')!.click();
    expect(app.ui.buyingCell).toBe(true);
    const grid = document.getElementById("grid")!;
    // Per-hex price stamps retire: no NEW CELL label, no stamped figure,
    // no plus — the frontier hex keeps only its accent outline.
    expect(grid.querySelector(".hex-sub")).toBeNull();
    const armed = [...grid.querySelectorAll(".hex.buy-here")];
    expect(armed.length).toBeGreaterThan(0);
    // The pill over the board's top edge carries the single cost spot.
    const pill = document.getElementById("cell-arm-pill")!;
    expect(pill.hidden).toBe(false);
    expect(pill.textContent).toContain("New cell");
    expect(pill.textContent).toContain(`${formatInt(BALANCE.cellFirstCost)} ν`);
    expect(pill.textContent).toContain("Cancel · Esc");
    // The pill is the cancel: one click backs out and the pill rests.
    pill.click();
    expect(app.ui.buyingCell).toBe(false);
    expect(document.getElementById("cell-arm-pill")!.hidden).toBe(true);
  });

  it("the cell pill discloses unpaid frontier row premiums", () => {
    app.state.nous = 1e6;
    app.armCellPurchase();
    const base = cellCost(app.state.cellsBought);
    const premium = Math.max(...app.frontierCells().map((pos) => cellPurchasePrice(app.state, pos) - base));
    expect(premium).toBeGreaterThan(0);
    expect(document.getElementById("cell-arm-pill")!.textContent).toContain(`+ up to ${formatInt(premium)} ν row premium`);
    app.state.gatedRows = [-1, 0, 1, 2];
    app.render();
    expect(document.getElementById("cell-arm-pill")!.textContent).not.toContain("row premium");
  });

  it("face upgrades cannot spend nous while cell purchase is armed", () => {
    app.state.nous = 1e6;
    app.render();
    const button = document.querySelector<SVGElement>(".face-buy")!;
    const module = app.state.modules.find((m) => m.id === button.dataset.module)!;
    const level = module.level;
    const bank = app.state.nous;
    app.armCellPurchase();
    expect(document.querySelector(".face-buy")).toBeNull();
    // Even an event queued on the previous node must obey the armed mode.
    button.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(module.level).toBe(level);
    expect(app.state.nous).toBe(bank);
    app.cancelCellPurchase();
    expect(document.querySelector(".face-buy")).not.toBeNull();
  });

  it("add-cell mode is the one mode that dims the board (#201)", () => {
    app.render();
    expect(document.body.classList.contains("cell-arming")).toBe(false);
    app.state.nous = BALANCE.cellFirstCost;
    app.armCellPurchase();
    app.render();
    expect(document.body.classList.contains("cell-arming")).toBe(true);
    // Owned modules rest greyed and pointer-dead behind the pill.
    const opener = document.querySelector('[data-cell="0,0"] .module-node') as SVGElement;
    expect(opener).not.toBeNull();
    // Esc backs the mode out and the board wakes.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(app.ui.buyingCell).toBe(false);
    app.render();
    expect(document.body.classList.contains("cell-arming")).toBe(false);
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
    give(app.state, "harmonizer", hex(1, 0)); // G4 — occupied, but no twin of m1
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

  it("the drop register wears its combine tint over a matching twin, and the release opens the review (#152)", () => {
    give(app.state, "additive", hex(1, 0)); // G4 — the opening's common twin
    app.render();
    document.elementFromPoint = () => cell(1, 0);
    cell(0, 0).dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 220, clientY: 100 }));
    expect(cell(1, 0).querySelector(".hex")!.classList.contains("drop-combine")).toBe(true);
    expect(cell(1, 0).querySelector(".hex")!.classList.contains("drop-occupied")).toBe(false);
    // A combine offer promises no swap: no would-form ghosts over the twin.
    expect(ghosts()).toHaveLength(0);
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 220, clientY: 100 }));
    expect(app.ui.modal).toBe("combine");
  });

  it("a drop onto an occupied cell swaps immediately — unless the occupant is a matching twin — and only twins confirm", () => {
    // A different type: pitch lives in the cell, so the swap is a plain
    // swap (§5, §8) — occupied drops swap without confirm; the review is
    // for matching pairs alone (#152).
    const stranger = give(app.state, "harmonizer", hex(1, 0));
    app.render();
    document.elementFromPoint = () => cell(1, 0);
    cell(0, 0).dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 220, clientY: 100 }));
    expect(app.state.modules[0]!.pos).toEqual(hex(1, 0));
    expect(stranger.pos).toEqual(hex(0, 0));
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
    // Retrieved: the chord-breaking gesture leaves the synthesizer in the tray.
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
    // A placement never opens the expanded face (§5) — and it presents
    // closed: the render the landing triggers must not catch the armed
    // placement's stale selection.
    expect(app.ui.selected).toBeNull();
    expect(document.getElementById("module-bloom")!.hidden).toBe(true);
  });

  it("an armed placement previews the would-form ghosts on hover — one per forming chord", () => {
    // m2 at G4 rings a Fifth with the opening synthesizer; m3 waits in the tray.
    give(app.state, "additive", hex(1, 0));
    const traySynth = give(app.state, "additive", null);
    app.render();
    document.querySelector<HTMLButtonElement>(`[data-inv="${traySynth.id}"]`)!.click();
    // Hovering C5 (0,1): the drop rings an Octave with C4 — and doubles the
    // Fifth's root, a second instance forming (§6). Two ghosts, one per
    // forming chord.
    cell(0, 1).dispatchEvent(new MouseEvent("pointerenter", { bubbles: true }));
    app.render();
    expect(ghosts()).toHaveLength(2);
    const labels = [...document.getElementById("grid")!.querySelectorAll(`[data-key^="ghost-"] .chord-label`)].map((node) => node.textContent);
    expect(labels).toContain("Octave ×1.15");
    // Hovering the occupied G4: an identical-synthesizer swap forms nothing new.
    cell(1, 0).dispatchEvent(new MouseEvent("pointerenter", { bubbles: true }));
    app.render();
    expect(ghosts()).toHaveLength(0);
  });

  it("placement rides the pointer: a press-and-slide previews live, and the release places", () => {
    // Touch has no hover phase before its tap: pressing an open cell while
    // a placement is armed previews the would-form chord as the finger
    // slides, and the release places — a drop leaves the face closed (§5).
    give(app.state, "additive", hex(1, 0));
    const traySynth = give(app.state, "additive", null);
    app.render();
    document.querySelector<HTMLButtonElement>(`[data-inv="${traySynth.id}"]`)!.click();
    expect(app.ui.placing).toBe(traySynth.id);
    document.elementFromPoint = () => cell(0, 1);
    cell(0, 1).dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 100 }));
    // The Octave the C5 drop would ring — and the doubled Fifth — preview
    // under the finger, one hull per forming chord.
    expect(ghosts()).toHaveLength(2);
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 130, clientY: 110 }));
    expect(traySynth.pos).toEqual(hex(0, 1));
    expect(app.ui.placing).toBeNull();
    expect(app.ui.selected).toBeNull();
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
    const labels = [...document.getElementById("grid")!.querySelectorAll(`[data-key^="ghost-"] .chord-label`)].map((node) => node.textContent);
    expect(labels).toContain("Octave ×1.15");
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
    expect(bloom().querySelector(".bloom-face .face-name")!.textContent).toBe("OSC");
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
    expect(faceSvg.querySelector(".face-readout")!.getAttribute("y")).toBe("16");
    expect(faceSvg.querySelector(".face-note")!.getAttribute("y")).toBe("55");
    expect(faceSvg.querySelector(".face-signature")!.getAttribute("transform")).toBe("translate(0 -12) scale(0.7)");
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

  it("cannot afford: zero reads zero — the shortfall leads, nothing disables (ADR-0045, #233)", () => {
    app.state.nous = 0;
    app.render();
    clickCell(0,0);
    const button = bloom().querySelector<HTMLButtonElement>("#bloom-upgrade")!;
    expect(button.disabled).toBe(false);
    // The zero-affordable tooltip leads with the shortfall.
    expect(button.title).toBe("+0 — 10 ν short of one level");
    // The dial's MAX chip reads MAX·0 and carries the same read.
    const maxChip = document.querySelector<HTMLButtonElement>('.bloom-dial [data-bulk="max"]')!;
    expect(maxChip.textContent).toBe("MAX·0");
    expect(maxChip.title).toBe("MAX · buys 0 — 10 ν short");
    // The click still refuses plainly: not even one level is affordable.
    button.click();
    expect(app.state.modules[0]!.level).toBe(0);
    expect(document.getElementById("status")!.textContent).toContain("Not enough whole nous");
  });

  it("a short bank keeps the ordinary partial read when some levels are affordable", () => {
    // The bank covers three of the five wanted levels.
    app.state.nous = levelsCost(0, 3);
    app.render();
    clickCell(0,0);
    document.querySelector<HTMLButtonElement>('.bloom-dial [data-bulk="5"]')!.click();
    const button = bloom().querySelector<HTMLButtonElement>("#bloom-upgrade")!;
    expect(button.disabled).toBe(false);
    expect(button.title).toBe("Not enough for all 5 — buys what it can");
    // The MAX chip still counts the affordable levels.
    expect(document.querySelector<HTMLButtonElement>('.bloom-dial [data-bulk="max"]')!.textContent).toBe("MAX·3");
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
    // The silent wire's expanded face carries no level either (#193).
    expect(bloom().querySelector(".bloom-face .face-level")).toBeNull();
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

  it("the inspector is retired — the expanded face is the module's only surface", () => {
    app.render();
    expect(document.getElementById("inspector")).toBeNull();
    // Selecting a module opens the bloom with the Upgrade action; no panel
    // exists to duplicate it.
    clickCell(0,0);
    expect(bloom().hidden).toBe(false);
    expect(bloom().querySelector("#bloom-upgrade")).not.toBeNull();
  });

  it("no Combine button rides any expanded-face presentation — combining lives on the drop (#152)", () => {
    // A live pair exists, so the old button would show if it survived.
    give(app.state, "additive", hex(1, 0));
    app.render();
    clickCell(0, 0);
    expect(bloom().hidden).toBe(false);
    expect(bloom().querySelector("#bloom-combine")).toBeNull();
    expect(document.querySelector(".bloom-combine")).toBeNull();
    // The phone bottom sheet — the same retirement at every presentation.
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    app.render();
    expect(bloom().classList.contains("sheet")).toBe(true);
    expect(bloom().querySelector("#bloom-combine")).toBeNull();
    expect(document.querySelector(".bloom-combine")).toBeNull();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  });
});

describe("combining by drop (issue #152)", () => {
  const cell = (q: number, r: number) => document.querySelector(`[data-cell="${q},${r}"]`)!;
  const tile = (id: string) => document.querySelector(`[data-inv="${id}"]`)!;

  function dragFrom(source: Element, target: Element): void {
    document.elementFromPoint = () => target;
    source.dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 220, clientY: 100 }));
    // A real release synthesizes a click, which the drag's suppressor eats;
    // happy-dom fires none, so wear the guard out exactly as the browser
    // would — then later clicks (Combine, Keep both) land for real.
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }

  it("board to board: a matching drop opens the review, and cancel leaves both copies unchanged", () => {
    // Both copies upgraded once: the pair is level, so the review shows
    // the twin's 10 ν as the refund.
    const m1 = app.state.modules[0]!;
    m1.level = 1;
    m1.invested = 10;
    const twin = give(app.state, "additive", hex(1, 0), 1);
    app.render();
    const nous = app.state.nous;
    dragFrom(cell(0, 0), cell(1, 0));
    expect(app.ui.modal).toBe("combine");
    expect(app.ui.combineOffer).toEqual({ dragId: "m1", targetId: twin.id });
    const review = document.getElementById("modal-content")!;
    expect(review.textContent).toContain("uncommon");
    expect(review.textContent).toContain("LV 1");
    expect(review.textContent).toContain("10");
    // Cancel: neither copy is consumed, nothing moves, nothing refunds.
    document.getElementById("combine-cancel")!.click();
    expect(app.ui.modal).toBeNull();
    expect(app.ui.combineOffer).toBeNull();
    expect(app.state.modules).toHaveLength(2);
    expect(m1.pos).toEqual(hex(0, 0));
    expect(m1.rarity).toBe("common");
    expect(m1.level).toBe(1);
    expect(m1.invested).toBe(10);
    expect(twin.pos).toEqual(hex(1, 0));
    expect(twin.level).toBe(1);
    expect(twin.invested).toBe(10);
    expect(app.state.nous).toBe(nous);
  });

  it("board to board: confirming consumes both — next rarity, retained level, refund, result on the target cell", () => {
    const m1 = app.state.modules[0]!;
    m1.level = 1;
    m1.invested = 10;
    give(app.state, "additive", hex(1, 0), 1); // the board twin melts (tie: the dragged copy survives)
    app.state.nous = 0;
    app.render();
    dragFrom(cell(0, 0), cell(1, 0));
    document.getElementById("combine-confirm")!.click();
    expect(app.state.modules).toHaveLength(1);
    const merged = app.state.modules[0]!;
    expect(merged.id).toBe(m1.id);
    expect(merged.rarity).toBe("uncommon");
    expect(merged.level).toBe(1);
    expect(merged.pos).toEqual(hex(1, 0));
    expect(app.state.nous).toBe(10);
    expect(app.ui.modal).toBeNull();
    expect(app.ui.combineOffer).toBeNull();
  });

  it("board to tray: dropping a board module onto its tray twin offers the combine; the result waits in the tray", () => {
    const twin = give(app.state, "additive", null);
    app.render();
    dragFrom(cell(0, 0), tile(twin.id));
    expect(app.ui.modal).toBe("combine");
    expect(app.ui.combineOffer).toEqual({ dragId: "m1", targetId: twin.id });
    document.getElementById("combine-confirm")!.click();
    expect(app.state.modules).toHaveLength(1);
    expect(app.state.modules[0]!.rarity).toBe("uncommon");
    expect(app.state.modules[0]!.pos).toBeNull();
  });

  it("Esc on the review cancels: the offer drops and both copies stay untouched", () => {
    const twin = give(app.state, "additive", hex(1, 0), 1);
    app.render();
    dragFrom(cell(0, 0), cell(1, 0));
    expect(app.ui.modal).toBe("combine");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(app.ui.modal).toBeNull();
    expect(app.ui.combineOffer).toBeNull();
    expect(app.state.modules).toHaveLength(2);
    expect(app.state.modules[0]!.pos).toEqual(hex(0, 0));
    expect(twin.pos).toEqual(hex(1, 0));
  });

  it("tray to board: dragging a tray module onto its deployed twin keeps the target cell", () => {
    app.returnToInventory("m1");
    const twin = give(app.state, "additive", hex(1, 0), 2); // the tray copy melts
    app.render();
    dragFrom(tile("m1"), cell(1, 0));
    expect(app.ui.modal).toBe("combine");
    document.getElementById("combine-confirm")!.click();
    expect(app.state.modules).toHaveLength(1);
    expect(app.state.modules[0]!.id).toBe(twin.id);
    expect(app.state.modules[0]!.rarity).toBe("uncommon");
    expect(app.state.modules[0]!.level).toBe(2);
    expect(app.state.modules[0]!.pos).toEqual(hex(1, 0));
  });

  it("tray to tray: dropping a tray module onto its tray twin offers the combine", () => {
    app.returnToInventory("m1");
    const twin = give(app.state, "additive", null);
    app.render();
    dragFrom(tile("m1"), tile(twin.id));
    expect(app.ui.modal).toBe("combine");
    expect(app.ui.combineOffer).toEqual({ dragId: "m1", targetId: twin.id });
    document.getElementById("combine-confirm")!.click();
    expect(app.state.modules).toHaveLength(1);
    expect(app.state.modules[0]!.rarity).toBe("uncommon");
    expect(app.state.modules[0]!.pos).toBeNull();
  });

  it("rare twins still swap — the highest rarity does not combine", () => {
    const twin = give(app.state, "additive", hex(1, 0));
    app.state.modules[0]!.rarity = "rare";
    twin.rarity = "rare";
    app.render();
    dragFrom(cell(0, 0), cell(1, 0));
    expect(app.ui.modal).toBeNull();
    expect(app.state.modules[0]!.pos).toEqual(hex(1, 0));
    expect(twin.pos).toEqual(hex(0, 0));
    expect(app.state.modules).toHaveLength(2);
  });
});

describe("always-on chord feedback (§6, #137)", () => {
  const cell = (q: number, r: number) => document.querySelector(`[data-cell="${q},${r}"]`)!;
  const readout = () => document.getElementById("chord-readout") as HTMLElement;

  it("seams draw always-on in upgrade mode; the readout waits empty", () => {
    // The opening C4 plus an additive at G4: a Fifth on the lattice.
    give(app.state, "additive", hex(1, 0));
    app.render();
    const grid = document.getElementById("grid")!;
    const mark = grid.querySelector('[data-key="chord-marks"] .chord-mark')!;
    // The adjacent pair seals its shared edge: twin bracket lines (#201).
    expect(mark.querySelectorAll(".chord-seam")).toHaveLength(2);
    // The mark wears its chord hue and pulse period.
    expect((mark as HTMLElement).style.getPropertyValue("--cc")).toBe("var(--chord-fifth)");
    expect((mark as HTMLElement).style.getPropertyValue("--seam-dur")).toBe("2.7s");
    // No chip floats over the board, and the reserved readout sits empty.
    expect(grid.querySelector('[data-key="chord-marks"] .chord-chip')).toBeNull();
    expect(readout().hidden).toBe(true);
    // No chord toggle exists: no button, no C-key beat.
    expect(document.getElementById("tool-chords")).toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "c" }));
    expect(mark.querySelectorAll(".chord-seam")).toHaveLength(2);
  });

  it("the readout is a reserved spot: the module's final ν/s leads, every chord it sings in follows", () => {
    // The power-chord region again: C4 sings in two chords — the Octave
    // (C4·C5) and the Fifth (C4·G4).
    give(app.state, "additive", hex(1, 0));
    app.state.cells.push(hex(0, 1));
    give(app.state, "additive", hex(0, 1));
    app.render();
    const chips = () => [...readout().querySelectorAll(".chord-readout-chip")].map((chip) => chip.textContent);
    // Hovering G4 — its final ν/s leads (it sings the doubled Fifth: both
    // instances share it), then the chord's chip.
    cell(1, 0).dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(readout().hidden).toBe(false);
    // The formation quality is its own named term (ADR-0049) and rides the
    // ν/s: classes {0,7}, one class of complexity.
    expect(chips()).toEqual([
      `+${formatNumber(0.1 * 1.3 ** 2 * (1 + BALANCE.complexityRate))} ν/s`,
      "Formation ×1.06",
      "Fifth ×1.3 ×2",
    ]);
    // Hovering C4 asks its ν/s and both of its chords into the spot — the
    // octave and its one fifth instance (the other pairs C5 · G4).
    cell(0, 0).dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(chips()).toEqual([
      `+${formatNumber(0.1 * 1.15 * 1.3 * (1 + BALANCE.complexityRate))} ν/s`,
      "Formation ×1.06",
      "Octave ×1.15",
      "Fifth ×1.3 ×2",
    ]);
    // Leaving clears them.
    document.getElementById("grid")!.dispatchEvent(new MouseEvent("pointerleave"));
    expect(readout().hidden).toBe(true);
    // Selecting C4 pins the same row without any hover.
    const c4 = app.state.modules.find((m) => m.pos !== null && sameHex(m.pos, hex(0, 0)))!;
    app.select(c4.id);
    expect(readout().hidden).toBe(false);
    expect(chips()).toEqual([
      `+${formatNumber(0.1 * 1.15 * 1.3 * (1 + BALANCE.complexityRate))} ν/s`,
      "Formation ×1.06",
      "Octave ×1.15",
      "Fifth ×1.3 ×2",
    ]);
    // Deselecting empties the readout again.
    app.select(c4.id);
    expect(readout().hidden).toBe(true);
  });

  it("a chordless module still shows its final ν/s in the reserved readout", () => {
    app.render();
    const island = give(app.state, "additive", hex(5, 0)); // its own island
    app.render();
    const chips = () => [...readout().querySelectorAll(".chord-readout-chip")].map((chip) => chip.textContent);
    app.select(island.id);
    expect(readout().hidden).toBe(false);
    expect(chips()).toEqual([`+${formatNumber(BALANCE.synthRate)} ν/s`]);
  });

  it("clicking a module during flow answers the lock — no selection, no bloom", () => {
    give(app.state, "additive", hex(1, 0));
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    clickCell(1, 0);
    expect(app.ui.selected).toBeNull();
    const bloomEl = document.getElementById("module-bloom")!;
    expect(bloomEl.hidden).toBe(true);
    expect(document.getElementById("status")!.textContent).toContain("locked during flow");
    endSession(app.state);
  });

  it("the readout carries the module's live ν/s during a session; chips stay names and multipliers", () => {
    give(app.state, "additive", hex(1, 0));
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.render();
    // The session is live: the stylesheet pulses the focused seams; the
    // mark group itself carries no mode class. Hovering asks the module's
    // live ν/s into the slot, and the chip names the chord without any
    // board-wide +ν/s claim (ADR-0036).
    expect(document.body.classList.contains("live")).toBe(true);
    expect(document.querySelector('[data-key="chord-marks"].flow')).toBeNull();
    // The expected figure reads off the same live snapshot the render used —
    // startSession's feats ride the boost.
    const g4 = app.state.modules.find((m) => m.pos !== null && sameHex(m.pos, hex(1, 0)))!;
    const liveValue = `+${formatNumber(computeRates(app.state, true).contributions.get(g4.id)!.value)} ν/s`;
    cell(1, 0).dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(readout().textContent).toContain(liveValue);
    expect(readout().textContent).toContain("Fifth ×1.3");
    expect(readout().textContent).not.toMatch(/×1\.3 · \+/);
    endSession(app.state);
    // Back in upgrade the same row holds, at the projected figure.
    app.render();
    cell(1, 0).dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(readout().textContent).toContain(liveValue);
    expect(readout().textContent).toContain("Fifth ×1.3");
  });

  it("overlapping chords draw their own work, chord-colored (#201)", () => {
    // A power-chord region: C4 (the opening synth), G4 and C5 — the Octave
    // and the Fifth share the region, both draw.
    give(app.state, "additive", hex(1, 0));
    app.state.cells.push(hex(0, 1));
    give(app.state, "additive", hex(0, 1));
    app.render();
    const grid = document.getElementById("grid")!;
    const marks = [...grid.querySelectorAll('[data-key="chord-marks"] .chord-mark')];
    expect(marks).toHaveLength(2);
    // Two hues: the engine names the Octave first, the Fifth second.
    const hues = marks.map((mark) => (mark as HTMLElement).style.getPropertyValue("--cc"));
    expect(hues).toEqual(["var(--chord-octave)", "var(--chord-fifth)"]);
    // The Octave's vertical pair runs one continuous twin line down the
    // column; the three-voice Fifth wraps the region in its note-corner
    // polygon — both draw, no pair is claimed once (#201).
    expect(marks.map((mark) => mark.querySelectorAll("line.chord-seam").length)).toEqual([2, 0]);
    expect(marks[1]!.querySelector("polygon.chord-loop")).not.toBeNull();
    // The chord work renders behind the modules: the marks group precedes
    // the cell nodes (which carry data-cell, no data-key) in paint order.
    const children = [...grid.children].map((child) => child.getAttribute("data-key"));
    expect(children.indexOf("chord-marks")).toBeLessThan(children.findIndex((key) => key === null));
  });

  it("the selection lifts the focused chords over the faces; at rest the lift rests (#201)", () => {
    give(app.state, "additive", hex(1, 0));
    app.render();
    const grid = document.getElementById("grid")!;
    // At rest: the lift group stands empty — the chords whisper in the
    // gaps, never over a face.
    const lift = () => grid.querySelector('[data-key="chord-lift"]')!;
    expect(lift().children).toHaveLength(0);
    // Selecting C4 lifts its chord: the focused marks draw again over the
    // faces, past the lift group that rides above the cell nodes.
    const c4 = app.state.modules.find((m) => m.pos !== null && sameHex(m.pos, hex(0, 0)))!;
    app.select(c4.id);
    expect(lift().children).toHaveLength(1);
    const lifted = lift().querySelector(".chord-mark")!;
    expect(lifted.classList.contains("chord-focus")).toBe(true);
    expect(lifted.querySelectorAll(".chord-seam")).toHaveLength(2);
    const children = [...grid.children].map((child) => child.getAttribute("data-key"));
    expect(children.indexOf("chord-lift")).toBeGreaterThan(children.findIndex((key) => key === null));
    // Deselecting empties the lift again.
    app.select(c4.id);
    expect(lift().children).toHaveLength(0);
  });

  it("selection focuses the selected module's chords and fades the rest", () => {
    // Two chords in separate clusters: the opening Fifth and an island
    // Octave down the board.
    give(app.state, "additive", hex(1, 0));
    app.state.cells.push(hex(3, 0), hex(3, 1));
    give(app.state, "additive", hex(3, 0));
    give(app.state, "additive", hex(3, 1));
    app.render();
    const island = app.state.modules.find((m) => m.pos !== null && sameHex(m.pos, hex(3, 0)))!;
    app.select(island.id);
    const marks = [...document.querySelectorAll('[data-key="chord-marks"] > g')];
    expect(marks).toHaveLength(2);
    expect(marks.filter((mark) => mark.classList.contains("chord-focus"))).toHaveLength(1);
    expect(marks.filter((mark) => mark.classList.contains("chord-fade"))).toHaveLength(1);
    // The selected module's row leads with its final ν/s and names its chord.
    expect(readout().hidden).toBe(false);
    expect(readout().textContent).toContain(`+${formatNumber(0.115)} ν/s`);
    expect(readout().textContent).toContain("Octave ×1.15");
    // Clearing the selection unfades everything and empties the readout.
    app.select(island.id);
    expect(document.querySelectorAll(".chord-mark.chord-fade")).toHaveLength(0);
    expect(readout().hidden).toBe(true);
  });

  it("the spacer's board face is the open wire: cap, base, window (#201)", () => {
    give(app.state, "spacer", hex(1, 0));
    app.render();
    const grid = document.getElementById("grid")!;
    // The shared clip def rides the grid once.
    expect(grid.querySelector('clipPath[id="spacer-window"]')).not.toBeNull();
    const face = grid.querySelector('[data-type="spacer"]')!;
    // The chassis opens the window; the frame rides the plate.
    expect(face.querySelector(".hex")!.getAttribute("clip-path")).toBe("url(#spacer-window)");
    expect(face.querySelector(".spacer-frame")).not.toBeNull();
    // Glyph, readout glyph, level line, rings, and rail all go quiet.
    for (const key of ["signature", "readout", "rings", "rail", "level"]) {
      expect(face.querySelector(`[data-key="${key}"]`)).toBeNull();
    }
    // The cap carries the name at its center; the base keeps the note.
    const name = face.querySelector('[data-key="name"]')!;
    expect(name.getAttribute("y")).toBe("-40");
    expect(face.querySelector('[data-key="note"]')!.textContent).toBe("G4");
  });

  it("a spacer's hover asks its chords by containment — the wire names what it carries (#201)", () => {
    // The wired octave: C4 and C6 with the spacer conducting between —
    // the run passes straight through the wire's cell.
    give(app.state, "spacer", hex(0, 1));
    app.state.cells.push(hex(0, 2));
    give(app.state, "additive", hex(0, 2));
    app.render();
    const chips = () => [...readout().querySelectorAll(".chord-readout-chip")].map((chip) => chip.textContent);
    // Resting on the spacer asks the chord it conducts.
    cell(0, 1).dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(readout().hidden).toBe(false);
    expect(chips()).toEqual(["Octave ×1.15"]);
    // Resting on an empty cell off the run asks nothing.
    cell(1, 0).dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(readout().hidden).toBe(true);
  });

  it("a conducting spacer's selection never hides the chord it serves (#201)", () => {
    give(app.state, "spacer", hex(0, 1));
    app.state.cells.push(hex(0, 2));
    give(app.state, "additive", hex(0, 2));
    app.render();
    const spacer = app.state.modules.find((m) => m.type === "spacer")!;
    app.select(spacer.id);
    // The spacer sings in no chord, yet the run it carries keeps the focus
    // register and lifts over the faces with it.
    const mark = document.querySelector('[data-key="chord-marks"] .chord-mark')!;
    expect(mark.classList.contains("chord-focus")).toBe(true);
    expect(document.querySelector('[data-key="chord-lift"]')!.children).toHaveLength(1);
    // The readout pins the carried chord, and no ν/s chip ever rides a
    // spacer — the silent wire produces nothing (#172).
    expect(readout().textContent).toContain("Octave ×1.15");
    expect(readout().textContent).not.toContain("ν/s");
  });

  it("the bloom adds no chord line — the seams are the callout", () => {
    give(app.state, "additive", hex(1, 0));
    app.render();
    clickCell(0, 0);
    const bloomEl = document.getElementById("module-bloom")!;
    expect(bloomEl.hidden).toBe(false);
    expect(bloomEl.querySelector(".chord-seam, .chord-chip, .chord-label")).toBeNull();
  });

  it("a placement that forms a chord strums it, behind the mute", () => {
    const { fired, app } = stubChannels();
    // Room for two placements beside the opening C4: G4 (its fifth) and a
    // chordless D5 island.
    app.state.cells.push(hex(1, 0), hex(2, 0));
    // Arm a placement for an additive at G4 — the opening C4's fifth.
    const placed = give(app.state, "additive", null);
    app.beginPlacing(placed.id);
    clickCell(1, 0);
    expect(fired.strums).toBe(1);
    // The drop gesture unlocked the audio seam for it.
    expect(fired.unlocks).toBeGreaterThanOrEqual(1);
    // Muted, the same placement strums nothing.
    fired.strums = 0;
    app.setMuted(true);
    const again = give(app.state, "additive", null);
    app.beginPlacing(again.id);
    clickCell(2, 0);
    expect(fired.strums).toBe(0);
  });

  it("flow adds no sound of its own — no ambient, only the seams pulse", () => {
    const { fired, app } = stubChannels();
    give(app.state, "additive", hex(1, 0));
    app.state.sessionsCompleted = 1;
    app.ui.chosenTarget = 600;
    app.beginFlow(null);
    expect(app.state.mode).toBe("flow");
    expect(fired.chimes).toBe(0);
    expect(fired.strums).toBe(0);
    // The only live-flow sound left is the target chime.
    advance(app.state, 600);
    app.tick();
    expect(fired.chimes).toBe(1);
    app.endFlow();
    app.dismissSummary();
  });
});

describe("the dev panel's synth grant (#137)", () => {
  it("lands an additive on the first free cell that chords with a synth", () => {
    app = boot(undefined, true);
    app.devSynth();
    const granted = app.state.modules[app.state.modules.length - 1]!;
    expect(granted.type).toBe("additive");
    expect(granted.pos).toEqual(hex(1, 0)); // G4 — the opening C4's fifth
    app.render();
    // It chords at once; selecting the granted synth names its final ν/s
    // and its chord in the reserved readout.
    app.select(granted.id);
    expect(document.getElementById("chord-readout")!.textContent).toContain("Fifth ×1.3");
    expect(document.getElementById("chord-readout")!.textContent).toContain(
      `+${formatNumber(0.1 * 1.3 * (1 + BALANCE.complexityRate))} ν/s`,
    );
  });

  it("falls back to the tray when no free cell chords with a synth", () => {
    app = boot(undefined, true);
    // Fill both chordable opening cells.
    give(app.state, "additive", hex(1, 0));
    give(app.state, "additive", hex(0, 1));
    app.devSynth();
    const granted = app.state.modules[app.state.modules.length - 1]!;
    expect(granted.pos).toBeNull();
  });

  it("in flow the synth waits in the tray — the board stays locked", () => {
    app = boot(undefined, true);
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.devSynth();
    const granted = app.state.modules[app.state.modules.length - 1]!;
    expect(granted.pos).toBeNull();
    expect(document.querySelector('[data-key="chord-marks"] .chord-seam')).toBeNull();
    endSession(app.state);
  });

  it("the dev panel wears the +synth button, dev boots only", () => {
    app = boot(undefined, true);
    app.render();
    expect(document.querySelector('[data-dev="synth"]')).not.toBeNull();
    app = boot();
    app.render();
    expect(document.getElementById("dev-panel")).toBeNull();
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

  it("the lead line compresses the balance instead of overflowing, with the exact value on its tooltip (issue #187)", () => {
    // The ladder takes over past the exact range…
    app.state.nous = 1_234_567;
    app.openModal("catalog");
    let lead = document.querySelector("#modal-content p.lead")!;
    expect(lead.textContent).toBe(`${formatBalance(1_234_567)} ν available.`);
    expect(lead.querySelector("span")!.getAttribute("title")).toBe(formatInt(1_234_567));
    // …and the scientific ladder keeps the figure in its lane.
    app.state.nous = 4.072e38;
    app.openModal("catalog");
    lead = document.querySelector("#modal-content p.lead")!;
    expect(lead.textContent).toBe(`${formatBalance(4.072e38)} ν available.`);
    expect(lead.querySelector("span")!.getAttribute("title")).toBe(formatInt(4.072e38));
  });
});

describe("the Arete Catalog (issue #197)", () => {
  const UNLOCK_ABOVE = BALANCE.launchRowsAbove + 1;
  const UNLOCK_BELOW = -BALANCE.launchRowsBelow - 1;

  function bankFirstArete(): void {
    app.state.eraEarned = ARETE_HORIZON;
    app.render();
    document.getElementById("prestige-door")!.click();
    document.getElementById("prestige-confirm")!.click();
    expect(app.state.arete).toBe(1);
  }

  it("before the first prestige no Arete surface exists anywhere", () => {
    app.render();
    expect(document.getElementById("arete-chip")).toBeNull();
    expect(document.querySelector(".info-arete")).toBeNull();
    // Even with the board grown to the unlock boundary and add-cell mode
    // armed, the banner never renders — the lock is the prestige count
    // (the first Arete reset), and nothing has reset yet.
    app.state.cells.push(hex(0, 2), hex(0, -1));
    app.armCellPurchase();
    app.render();
    expect(document.querySelector("[data-unlock-row]")).toBeNull();
  });

  it("the first banked Arete raises the chip on the ledger, and it opens the sheet", () => {
    bankFirstArete();
    app.render();
    const chip = document.getElementById("arete-chip")!;
    expect(chip.textContent).toContain("Catalog");
    expect(chip.textContent).toContain("1");
    chip.click();
    expect(app.ui.modal).toBe("arete");
    const sheet = document.getElementById("modal-content")!;
    expect(sheet.textContent).toContain("Mutator tree");
    expect(sheet.textContent).toContain("Horizon break");
    // The sheet stays pure: no informational rows for the surface-bought
    // ladders.
    expect(sheet.textContent).not.toContain("octave row");
  });

  it("the sheet's purchases debit Arete: the entry, then the pool join behind it", () => {
    app.state.arete = BALANCE.catalogEntryCost + BALANCE.rollPoolJoinCost;
    app.openModal("arete");
    // The join sits behind the entry.
    const join = document.getElementById("buy-arete-pool") as HTMLButtonElement;
    expect(join.disabled).toBe(true);
    document.getElementById("buy-arete-entry")!.click();
    expect(app.state.catalogEntryOwned).toBe(true);
    expect(app.state.arete).toBe(BALANCE.rollPoolJoinCost);
    app.render();
    document.getElementById("buy-arete-pool")!.click();
    expect(app.state.rollPoolJoined).toBe(true);
    expect(app.state.arete).toBe(0);
    app.render();
    const sheet = document.getElementById("modal-content")!;
    expect(sheet.textContent).toContain("entered");
    expect(sheet.textContent).toContain("joined");
  });

  it("the sheet's buttons stand inert outside upgrade mode", () => {
    app.state.arete = 3;
    startSession(app.state, null);
    app.openModal("arete");
    const sheet = document.getElementById("modal-content")!;
    expect(sheet.querySelector(".modal-note")!.textContent).toContain("between sessions");
    expect((document.getElementById("buy-arete-entry") as HTMLButtonElement).disabled).toBe(true);
    expect((document.getElementById("buy-arete-break") as HTMLButtonElement).disabled).toBe(true);
    expect(app.state.catalogEntryOwned).toBe(false);
    expect(app.state.horizonBroken).toBe(false);
  });

  it("the Horizon break buys outright: one click debits ten Arete and reads as broken (issue #200)", () => {
    app.state.sessionsCompleted = 1;
    app.state.arete = BALANCE.horizonBreakCost;
    app.openModal("arete");
    const button = document.getElementById("buy-arete-break") as HTMLButtonElement;
    expect(button.textContent).toContain(`${BALANCE.horizonBreakCost} Arete`);
    button.click();
    expect(app.state.horizonBroken).toBe(true);
    expect(app.state.arete).toBe(0);
    expect(app.state.achievements["breaking-the-horizon"]).toBeGreaterThan(0);
    // The toast carries both the beat's words and the feat's unlock.
    expect(document.getElementById("status")!.textContent).toContain("The horizon breaks");
    expect(document.getElementById("status")!.textContent).toContain("Breaking the horizon");
    // The beat's one visual rides the bar.
    expect(app.breakBeatUntil).toBeGreaterThan(Date.now());
    app.render();
    expect(document.getElementById("horizon-bar")!.classList.contains("break-beat")).toBe(true);
    app.render();
    const sheet = document.getElementById("modal-content")!;
    expect(sheet.textContent).toContain("broken");
    // One-time: the button is gone, nothing re-charges it.
    expect(document.getElementById("buy-arete-break")).toBeNull();
  });

  it("the banner buys the row in one click; cells inside then buy with nous", () => {
    bankFirstArete();
    // Grow to the unlock boundary: rows 2 and −1 owned, so each frontier
    // touches its side's unlock row.
    app.state.cells.push(hex(0, 2), hex(0, -1));
    app.armCellPurchase();
    app.render();
    const banners = document.querySelectorAll("[data-unlock-row]");
    expect(banners).toHaveLength(2);
    expect(banners[0]!.getAttribute("data-unlock-row")).toBe(String(UNLOCK_ABOVE));
    const label = banners[0]!.textContent!;
    expect(label).toContain("Unlock this octave row");
    expect(label).toContain("1 Arete");
    // One click, outright: the row opens and its gate stands paid.
    (banners[0] as SVGElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.unlockedRows).toEqual([UNLOCK_ABOVE]);
    expect(app.state.arete).toBe(0);
    app.render();
    // The bought row's band is gone; the other side's banner escalates to 2.
    expect(document.querySelector(`[data-unlock-row="${UNLOCK_ABOVE}"]`)).toBeNull();
    expect(document.querySelector(`[data-unlock-row="${UNLOCK_BELOW}"]`)!.textContent).toContain("2 Arete");
    // Cells inside the unlocked row buy with nous as usual — no gate
    // premium, in range for the frontier.
    const price = cellCost(app.state.cellsBought);
    app.state.nous = price;
    app.render();
    const frontierInRow = document.querySelector(`[data-cell="0,${UNLOCK_ABOVE}"]`);
    expect(frontierInRow).not.toBeNull();
    frontierInRow!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.cells.some((c) => c.q === 0 && c.r === UNLOCK_ABOVE)).toBe(true);
    expect(app.state.nous).toBe(0);
  });

  it("a row beyond the cap never renders a banner and refuses the buy", () => {
    app.state.arete = 10;
    app.state.unlockedRows = [UNLOCK_ABOVE, UNLOCK_BELOW];
    app.state.cells.push(hex(0, 2), hex(0, -1));
    app.armCellPurchase();
    app.render();
    expect(document.querySelectorAll("[data-unlock-row]")).toHaveLength(0);
    app.buyRowUnlockAction(UNLOCK_ABOVE + 1);
    expect(app.state.unlockedRows).toEqual([UNLOCK_ABOVE, UNLOCK_BELOW]);
    expect(app.state.arete).toBe(10);
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
    expect(modal.textContent).toContain("How did it go?");
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
    expect(modal.textContent).toContain("Rolls banked");
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
    expect(document.getElementById("modal-content")!.textContent).not.toContain("Rolls banked");
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
    const rest = 0.7;
    // Untouched, both labels rest at the muted tint — no bands, no numbers.
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

// The signal channels (§4–5), recorded instead of played: the App seam
// takes a SignalChannels stub, mirroring how the engine injects Rng.
function makeRecorder() {
  const fired = {
    unlocks: 0,
    chimes: 0,
    strums: 0,
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
    playStrum: (_ctx, chords) => {
      fired.strums += chords.length;
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

describe("board navigation (§7)", () => {
  const svgEl = () => document.getElementById("grid") as unknown as SVGSVGElement;
  const viewBox = () => svgEl().getAttribute("viewBox")!;

  function mockWrap(width: number, height: number): void {
    Object.defineProperty(svgEl(), "clientWidth", { configurable: true, value: width });
    Object.defineProperty(svgEl(), "clientHeight", { configurable: true, value: height });
    (svgEl() as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  }

  it("the zoom cluster zooms and fits, clamped to the zoom range", () => {
    app.render();
    const before = viewBox();
    document.getElementById("zoom-in")!.click();
    const zoomed = viewBox();
    expect(app.ui.zoom).toBeGreaterThan(1);
    // Zoom shrinks the lens: the view narrows.
    expect(Number(zoomed.split(" ")[2])).toBeLessThan(Number(before.split(" ")[2]));
    for (let i = 0; i < 8; i++) document.getElementById("zoom-in")!.click();
    expect(app.ui.zoom).toBe(3); // ZOOM_MAX
    document.getElementById("zoom-out")!.click();
    expect(app.ui.zoom).toBeLessThan(3);
    document.getElementById("zoom-fit")!.click();
    expect(app.ui.zoom).toBe(1);
    expect(viewBox()).toBe(before);
  });

  it("zooming out below the range clamps; fitted is the floor", () => {
    app.render();
    const before = viewBox();
    document.getElementById("zoom-out")!.click();
    expect(app.ui.zoom).toBe(0.8); // ZOOM_MIN — a wider lens than fit
    document.getElementById("zoom-fit")!.click();
    expect(app.ui.zoom).toBe(1);
    expect(viewBox()).toBe(before);
  });

  it("wheel zoom anchors the cursor's world point", () => {
    app.render();
    mockWrap(800, 600);
    const bounds = app.boardBounds;
    const anchor = { x: bounds.x + bounds.width * 0.7, y: bounds.y + bounds.height * 0.4 };
    const frame = lensFrame(app.ui.zoom, app.ui.pan, bounds);
    const u = (anchor.x - frame.view.x) / frame.view.width;
    const v = (anchor.y - frame.view.y) / frame.view.height;
    // happy-dom's WheelEvent carries no pointer coordinates: assign them.
    const wheel = new WheelEvent("wheel", { deltaY: -100, cancelable: true });
    Object.defineProperty(wheel, "clientX", { value: u * 800 });
    Object.defineProperty(wheel, "clientY", { value: v * 600 });
    svgEl().dispatchEvent(wheel);
    expect(app.ui.zoom).toBeGreaterThan(1);
    const after = lensFrame(app.ui.zoom, app.ui.pan, bounds);
    const keptX = after.view.x + u * after.view.width;
    const keptY = after.view.y + v * after.view.height;
    expect(Math.abs(keptX - anchor.x)).toBeLessThan(1);
    expect(Math.abs(keptY - anchor.y)).toBeLessThan(1);
  });

  it("the board pans by dragging outside the grid at any zoom, clamped to the board", () => {
    app.render();
    mockWrap(800, 600);
    const before = lensFrame(app.ui.zoom, app.ui.pan, app.boardBounds).view;
    svgEl().dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 400, clientY: 300 }));
    document.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 100, clientY: 240 }));
    document.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: 100, clientY: 240 }));
    expect(app.ui.pan).not.toBeNull();
    const after = lensFrame(app.ui.zoom, app.ui.pan, app.boardBounds).view;
    // The drag moved the view; it never left the board's bounds.
    expect(after.x).toBeGreaterThan(before.x);
    expect(after.x).toBeLessThanOrEqual(app.boardBounds.x + app.boardBounds.width);
    // A pan is a gesture, not a click: the release never falls through.
    // (No selection change, no placement — the suppressor ate the click.)
    expect(app.ui.selected).toBeNull();
  });

  it("press-and-move inside the grid pans only when zoomed in", () => {
    app.render();
    mockWrap(800, 600);
    const empty = document.querySelector('[data-cell="0,1"]')!;
    const fitted = lensFrame(1, app.ui.pan, app.boardBounds).view.x;
    // At fit, an empty-cell press stays a tap — no pan.
    empty.dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 200, clientY: 200 }));
    document.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 100, clientY: 200 }));
    document.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: 100, clientY: 200 }));
    expect(lensFrame(app.ui.zoom, app.ui.pan, app.boardBounds).view.x).toBe(fitted);
    // Zoomed in, the same gesture walks the board.
    document.getElementById("zoom-in")!.click();
    const zoomed = lensFrame(app.ui.zoom, app.ui.pan, app.boardBounds).view.x;
    empty.dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 200, clientY: 200 }));
    document.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 100, clientY: 200 }));
    document.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: 100, clientY: 200 }));
    expect(lensFrame(app.ui.zoom, app.ui.pan, app.boardBounds).view.x).not.toBe(zoomed);
  });
});

describe("phone anatomy (§7, below the 600px container line)", () => {
  beforeEach(() => {
    setAppWidth(390);
  });

  it("the top nav holds session controls only; the clock's Time popover anchors to the clock", () => {
    app.render();
    // At rest the icon-only tiles hide — session controls only (§7) — and
    // they stay hidden: the Time popover anchors beneath the clock's own
    // disclosure (issue #148), not beneath a tile in the apps row.
    document.getElementById("clock-plan")!.click();
    expect(app.ui.app).toBe("time");
    const popover = document.getElementById("app-popover")!;
    expect(document.getElementById("console-session")!.contains(popover)).toBe(true);
    expect(document.getElementById("console-apps")!.contains(popover)).toBe(false);
    app.closeApp();
    app.render();
    expect(document.getElementById("app-popover")).toBeNull();
  });

  it("the bloom presents as a bottom sheet; the zoom cluster rises above it", () => {
    app.render();
    clickCell(0, 0);
    const bloomEl = document.getElementById("module-bloom")!;
    expect(bloomEl.hidden).toBe(false);
    expect(bloomEl.classList.contains("sheet")).toBe(true);
    expect(bloomEl.querySelector(".bloom-sheet")).not.toBeNull();
    expect(bloomEl.querySelector(".bloom-sheet-name")!.textContent).toContain("Oscillator");
    expect(bloomEl.querySelector("#bloom-upgrade")).not.toBeNull();
    expect(document.body.classList.contains("bloom-sheet-open")).toBe(true);
    // The horizon bar floats at every width (§7): an open sheet covers the
    // board's lower edge but never dismisses the bar itself.
    const bar = document.getElementById("horizon-bar")!;
    expect(bar).not.toBeNull();
    expect(bar.querySelector('[data-live="h-clip"]')).not.toBeNull();
    // Deselecting closes the sheet and lowers the cluster again.
    clickCell(0, 0);
    expect(bloomEl.hidden).toBe(true);
    expect(document.body.classList.contains("bloom-sheet-open")).toBe(false);
    // The bar rides on: still rendered, still whole, era intact.
    app.render();
    const barAfter = document.getElementById("horizon-bar")!;
    expect(barAfter.querySelector('[data-live="h-clip"]')).not.toBeNull();
    expect(barAfter.querySelector(".horizon-word")!.textContent).toContain("Arete");
  });

  it("on phone every modal presents as a sheet, so any open modal raises the zoom cluster", () => {
    // The modal layer reads the viewport (it lives outside #app), so the
    // cluster's rise reads it too: at a phone viewport any open modal is a
    // bottom sheet (§7), and the cluster must never be buried beneath one.
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    app.render();
    expect(document.body.classList.contains("modal-sheet-open")).toBe(false);
    app.openModal("settings");
    expect(app.ui.modal).toBe("settings");
    expect(document.body.classList.contains("modal-sheet-open")).toBe(true);
    app.closeModal();
    expect(document.body.classList.contains("modal-sheet-open")).toBe(false);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  });

  it("the game-info strip carries ν, rate, and session on the board surface — no feats chip; feats rides the thumb bar once", () => {
    app.render();
    const strip = document.getElementById("game-info-strip")!;
    expect(strip.querySelector('[data-live="i-nous"]')).not.toBeNull();
    // The strip's reads are fixed-decimal: trailing zeros stay, so the row
    // never resizes as the values drift.
    expect(strip.querySelector('[data-live="i-rate"]')!.textContent).toBe(formatFixed(0.1));
    expect(strip.querySelector('[data-live="i-session"]')!.textContent).toBe("—");
    // Feats appears once on phone: the thumb bar's segment, not a second
    // chip in the strip.
    expect(strip.querySelector(".feats-chip")).toBeNull();
    expect(document.querySelector('#thumb-bar [data-op="feats"]')).not.toBeNull();
  });

  it("the strip's ν read compresses instead of overflowing, with the exact value on its tooltip (issue #187)", () => {
    const read = () => document.querySelector('#game-info-strip [data-live="i-nous"]')!;
    app.state.nous = 1_234_567;
    app.render();
    expect(read().textContent).toBe("1.235M");
    app.state.nous = 4.072e38;
    app.render();
    expect(read().textContent).toBe("4.072e38");
    expect(read().getAttribute("title")).toBe(formatInt(4.072e38));
    // A tight live surface: the compressed read holds a constant, short
    // width as the balance ticks (ADR-0031).
    app.state.nous = 4.072e38 + 1e30;
    app.render();
    expect(read().textContent!.length).toBeLessThanOrEqual("4.072e38".length);
  });

  it("the strip's rate read is the phone's details door: tapping it opens the rate sheet, and a row lands on its module", () => {
    app.render();
    const strip = document.getElementById("game-info-strip")!;
    // The ledger's Rate cell is display:none at this width; the strip's
    // read takes over, and the module-linked roster stays one tap away.
    expect(strip.querySelector(".rate-equation")).toBeNull();
    document.getElementById("info-rate")!.click();
    expect(app.ui.modal).toBe("rate");
    expect(document.getElementById("modal")!.classList.contains("sheet")).toBe(true);
    const sheet = document.getElementById("modal-content")!;
    expect(sheet.querySelector(".rd-total")).not.toBeNull();
    expect(sheet.querySelectorAll(".rd-synth").length).toBeGreaterThan(0);
    // A synthesizer row's tap closes the sheet and selects the module, so
    // the answer lands on the board it names.
    const row = sheet.querySelector(".rd-synth")!;
    row.querySelector("summary")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.modal).toBeNull();
    expect(app.ui.selected).toBe(row.getAttribute("data-module-id"));
  });

  it("the horizon bar spans the board's lower edge with its full anatomy", () => {
    app.render();
    const bar = document.getElementById("horizon-bar")!;
    expect(bar.querySelector(".horizon-svg")).not.toBeNull();
    expect(bar.querySelector('[data-live="h-clip"]')).not.toBeNull();
    expect(bar.querySelector('[data-live="h-word"]')).not.toBeNull();
    expect(document.getElementById("zoom-cluster")).not.toBeNull();
  });
});

describe("the phone launcher (§7, issue #149)", () => {
  beforeEach(() => {
    setAppWidth(390);
  });

  // Every open/close rebuilds the console's app section, so the launcher
  // and its entries are re-queried per interaction — a held node goes stale
  // the moment the render that answered it replaces the markup.
  const launcher = () => document.getElementById("app-launcher")!;
  const entry = (key: string) => document.getElementById(`app-launcher-${key}`)!;

  it("one compact control opens Habit, Notes, and Goals; each app opens and dismisses without a second header row", () => {
    app.render();
    expect(launcher().getAttribute("aria-expanded")).toBe("false");
    // The tiles stay docked out below the line; the launcher hosts the apps
    // in their place — the menu first, then the app's own panel, anchored
    // inside the nav's one row.
    for (const key of ["habit", "notes", "goals"] as const) {
      launcher().click();
      expect(app.ui.launcherOpen).toBe(true);
      expect(launcher().getAttribute("aria-expanded")).toBe("true");
      entry(key).click();
      expect(app.ui.app).toBe(key);
      const panel = document.getElementById("app-launcher-popover")!;
      expect(document.getElementById("console-apps")!.contains(panel)).toBe(true);
      expect(document.getElementById("app-popover")).toBeNull();
      // The launcher always means its menu: the panel gives way, and a
      // second press closes. Click-away and Esc land in the same place.
      launcher().click();
      expect(app.ui.app).toBeNull();
      expect(document.getElementById("app-launcher-popover")).toBeNull();
      launcher().click();
      expect(app.ui.launcherOpen).toBe(false);
      expect(launcher().getAttribute("aria-expanded")).toBe("false");
      expect(document.getElementById("app-launcher-menu")).toBeNull();
    }
  });

  it("the menu dismisses by click-away and Escape; opening it lands focus on the first entry for keyboard callers", () => {
    app.render();
    launcher().click();
    expect(document.activeElement).toBe(document.getElementById("app-launcher-habit"));
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.launcherOpen).toBe(false);
    expect(document.querySelector("#app-launcher-menu")).toBeNull();
    // Escape unwinds the menu, and the panel once an app stands open.
    launcher().click();
    entry("notes").click();
    expect(document.querySelector("#app-launcher-popover")).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(app.ui.app).toBeNull();
    expect(document.querySelector("#app-launcher-popover")).toBeNull();
  });

  it("the Goals entry distinguishes none tracked, in progress, and all complete — a recurring reset returns it to in progress, and no aggregate percentage rides the header", () => {
    app.render();
    const goalsEntry = () => {
      if (!app.ui.launcherOpen) launcher().click();
      return document.getElementById("app-launcher-goals")!;
    };
    // Nothing tracked yet.
    expect(goalsEntry().getAttribute("aria-label")).toBe("Goals — none tracked app");
    expect(document.querySelector(".launcher-goal-state.none")).not.toBeNull();
    // One tracked goal with its occurrence open reads in progress. The
    // goal wears an epoch occurrence so the tick below sees a day change.
    createGoal(app.state, { habitId: null, minutes: 20, schedule: "daily", now: 1_000 });
    app.render();
    expect(goalsEntry().getAttribute("aria-label")).toBe("Goals — in progress app");
    expect(document.querySelector(".launcher-goal-state.open")).not.toBeNull();
    // Completing the last open occurrence flips the read to all complete.
    accrueGoalProgress(app.state, null, 20 * 60);
    app.render();
    expect(goalsEntry().getAttribute("aria-label")).toBe("Goals — all complete app");
    expect(document.querySelector(".launcher-goal-state.complete")).not.toBeNull();
    // The header carries the state, never an aggregate: no percentage and
    // no completed-of-total readout anywhere in the console row.
    const consoleText = document.querySelector(".console")!.textContent ?? "";
    expect(consoleText).not.toMatch(/\d+\s*%/);
    expect(consoleText).not.toMatch(/\b\d+\s*\/\s*\d+\b/);
    // The daily boundary rolls on the tick itself — a tab resting in
    // upgrade mode reads the new occurrence without a session or reload —
    // and the entry returns to in progress.
    app.tick();
    app.render();
    expect(goalsEntry().getAttribute("aria-label")).toBe("Goals — in progress app");
    expect(document.querySelector(".launcher-goal-state.open")).not.toBeNull();
  });

  it("the Habit entry names the selected practice inline — 'none selected' when the session would be unstructured", () => {
    app.render();
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    app.render();
    if (!app.ui.launcherOpen) launcher().click();
    const habitEntry = () => document.getElementById("app-launcher-habit")!;
    expect(habitEntry().getAttribute("aria-label")).toBe("Habit — Piano app");
    expect(habitEntry().querySelector(".launcher-habit-state .launcher-state-word")!.textContent).toBe("Piano");
    // Toggling the habit off reads as the unstructured choice it becomes.
    selectHabit(app.state, null);
    app.render();
    expect(habitEntry().getAttribute("aria-label")).toBe("Habit — none selected app");
    expect(habitEntry().querySelector(".launcher-state-word")!.textContent).toBe("none selected");
  });

  it("every launcher surface is born inside the nav's one fixed row — menu, panel, and press alike", () => {
    app.render();
    // happy-dom lays out nothing, so the one-row claim (issue #149's
    // acceptance check) is asserted structurally: the phone rule pins the
    // console's height, and through menu, panel, and dismissal the header's
    // own roster never changes — every launcher surface is a descendant of
    // the row, never a sibling appended beside or beneath it.
    const css = readFileSync("src/ui/style.css", "utf8");
    const phoneBlock = css.slice(css.indexOf("@container app (width < 600px)"));
    expect(phoneBlock.slice(0, phoneBlock.indexOf("}"))).toMatch(/\.console\s*\{[^}]*height:\s*56px/);
    const row = () => document.querySelector("header.console")!;
    const roster = () => [...row().children].map((el) => el.id || el.className);
    const resting = roster();
    launcher().click();
    expect(document.querySelector("#app-launcher-menu")!.closest("header.console")).toBe(row());
    expect(roster()).toEqual(resting);
    entry("goals").click();
    expect(document.querySelector("#app-launcher-popover")!.closest("header.console")).toBe(row());
    expect(roster()).toEqual(resting);
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.app).toBeNull();
    expect(roster()).toEqual(resting);
  });

  it("every launcher control is a native button: pointer, keyboard, and touch drive the same click", () => {
    app.render();
    // Native <button> semantics are the keyboard contract (Enter and Space
    // activate; happy-dom doesn't synthesize the click), as with the clock's
    // disclosure — so the structural assertion is the assertion.
    expect(launcher().tagName).toBe("BUTTON");
    launcher().click();
    for (const key of ["habit", "notes", "goals"] as const) {
      const button = entry(key);
      expect(button.tagName).toBe("BUTTON");
      expect((button as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it("the launcher's menu swap rides closeApp's full teardown: a habit edit never leaks into the reopened panel", () => {
    app.render();
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    launcher().click();
    entry("habit").click();
    // An in-panel rename is mid-flight when the launcher is pressed.
    document.querySelector<HTMLButtonElement>('[data-rename]')!.click();
    expect(app.ui.editingHabitId).not.toBeNull();
    expect(document.querySelector("#habit-rename-input")).not.toBeNull();
    // The launcher always means its menu — and the menu swap dismisses the
    // panel's own surfaces with it, so reopening Habit presents a clean
    // roster, not the stale rename form.
    launcher().click();
    expect(app.ui.app).toBeNull();
    expect(app.ui.editingHabitId).toBeNull();
    expect(app.ui.launcherOpen).toBe(true);
    entry("habit").click();
    expect(app.ui.app).toBe("habit");
    expect(document.querySelector("#habit-rename-input")).toBeNull();
  });

  it("the launcher works mid-session too; the desktop row keeps its tiles and hosts the panel there", () => {
    // Mid-session (notes are a flow-surface app): the launcher answers.
    startSession(app.state, null);
    app.render();
    launcher().click();
    entry("notes").click();
    expect(app.ui.app).toBe("notes");
    expect(document.getElementById("note-composer")).not.toBeNull();
    app.closeApp();
    endSession(app.state);
    // Above the line the tiles stand and host the panels; the launcher's
    // slot exists only as the CSS-docked-out phone anchor.
    setAppWidth(1200);
    app.render();
    expect(document.getElementById("app-launcher")).not.toBeNull();
    expect(document.querySelector("#app-launcher-popover, #app-launcher-menu")).toBeNull();
    app.openApp("goals");
    expect(document.getElementById("app-popover")).not.toBeNull();
    expect(document.getElementById("app-launcher-popover")).toBeNull();
    app.closeApp();
  });
});

describe("prototype retirement (§7)", () => {
  it("the shipped UI carries no prototype switcher, demo board, or variant artifacts", () => {
    app.render();
    expect(document.querySelector(".prototype-bar")).toBeNull();
    expect(document.body.dataset.variant).toBeUndefined();
    expect(document.getElementById("status-monitor")).toBeNull();
    expect(document.querySelector(".legend")).toBeNull();
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

describe("the opening arc's one pop-up (§8, issue #138)", () => {
  function arcCard(): HTMLElement {
    return document.getElementById("arc-card")!;
  }

  it("stays hidden through the single-synth opening", () => {
    app.render();
    expect(arcCard().hidden).toBe(true);
  });

  it("fires after the second synthesizer is acquired, leans on the ghost and the ×, and dismisses once, ever", () => {
    give(app.state, "additive", null); // the tray holds the new arrival
    app.render();
    expect(arcCard().hidden).toBe(false);
    expect(arcCard().textContent).toContain("Place it beside your first");
    expect(arcCard().textContent).toContain("dashed");
    expect(arcCard().textContent).toContain("×");
    document.getElementById("arc-card-dismiss")!.click();
    expect(arcCard().hidden).toBe(true);
    // A third synth, a re-render, a reload: it never fires again.
    give(app.state, "additive", null);
    app.render();
    expect(arcCard().hidden).toBe(true);
    const reloaded = boot();
    reloaded.render();
    expect(document.getElementById("arc-card")!.hidden).toBe(true);
  });

  it("never fires for non-synthesizer acquisitions", () => {
    give(app.state, "infusor", null);
    give(app.state, "forge", null);
    app.render();
    expect(arcCard().hidden).toBe(true);
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

  it("a save from a tab whose snapshot is older than the stored save never replaces it", () => {
    forgeNewerSave(777);
    app.state.nous = 999;
    app.save();
    expect(storedNous()).toBe(777);
  });

  it("a tab holding the newest state saves normally", () => {
    localStorage.setItem(STORAGE_KEY, serialize({ ...app.state, nous: 1 }, Date.now() - 60_000));
    app.state.nous = 999;
    app.save();
    expect(storedNous()).toBe(999);
  });

  it("an equal stored savedAt never blocks a legitimate write", () => {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    localStorage.setItem(STORAGE_KEY, serialize({ ...app.state, nous: 5 }, stored.savedAt));
    app.state.nous = 999;
    app.save();
    expect(storedNous()).toBe(999);
  });

  it("an unparseable stored save never blocks a write", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    app.state.nous = 999;
    app.save();
    expect(storedNous()).toBe(999);
  });

  it("a stored save without a readable savedAt never blocks a write", () => {
    const file = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    delete file.savedAt;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(file));
    app.state.nous = 999;
    app.save();
    expect(storedNous()).toBe(999);
  });

  it("a refused save leaves the tab's memory alone — convergence waits for the return", () => {
    forgeNewerSave(777);
    app.state.nous = 999;
    app.save();
    expect(storedNous()).toBe(777);
    expect(app.state.nous).toBe(999);
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

// The bulk upgrade controls (issue #195, the #173 contract): the face
// button, the Upgrade All cluster, and the expanded face's dial — one
// shared ladder (+1 / +5 / +10 / MAX), partial by design, upgrade-mode-only.
describe("the bulk upgrade controls (#195)", () => {
  const status = () => document.getElementById("status")!.textContent ?? "";

  it("every closed, levelable face wears a corner button; +1 click buys one level", () => {
    app.state.nous = 100;
    app.render();
    const buy = document.querySelector(".face-buy")!;
    expect(buy.getAttribute("data-module")).toBe("m1");
    expect(buy.querySelector(".face-buy-label")!.textContent).toBe("+1");
    buy.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.modules[0]!.level).toBe(1);
    expect(app.state.nous).toBe(90);
    expect(status()).toContain("upgraded to level 1");
    // The gesture stays off the cell: no bloom opened, the selection unset.
    expect(app.ui.selected).toBeNull();
  });

  it("a shift-click buys every affordable level in one gesture", () => {
    app.state.nous = levelsCost(0, 9);
    app.render();
    document.querySelector(".face-buy")!.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
    expect(app.state.modules[0]!.level).toBe(9);
    expect(app.state.nous).toBe(0);
    expect(status()).toContain("+9 levels");
  });

  it("holding shift flips every face button board-wide, but the click's own shift state is the truth", () => {
    app.state.nous = 100;
    app.render();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
    app.render();
    const buy = document.querySelector(".face-buy")!;
    expect(buy.querySelector(".face-buy-label")!.textContent).toBe("MAX");
    expect(buy.getAttribute("aria-label")).toContain("MAX · buy");
    // The MAX tooltip carries the full-sweep cost preview like every
    // bulk surface's tooltip (the #173 resolution).
    expect(buy.getAttribute("aria-label")).toMatch(/· \d[\d,]* ν$/);
    expect(buy.querySelector("title")!.textContent).toMatch(/· \d[\d,]* ν$/);
    // …and the flip is transient: keyup restores every label.
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));
    app.render();
    expect(document.querySelector(".face-buy")!.querySelector(".face-buy-label")!.textContent).toBe("+1");
    // A shift released while the window lacks focus never fires keyup —
    // the blur drops the mode instead of leaving MAX stuck.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
    app.render();
    expect(document.querySelector(".face-buy")!.querySelector(".face-buy-label")!.textContent).toBe("MAX");
    window.dispatchEvent(new Event("blur"));
    app.render();
    expect(document.querySelector(".face-buy")!.querySelector(".face-buy-label")!.textContent).toBe("+1");
    // Even with the label showing MAX, a plain click still buys +1: the
    // click's own shift state is the source of truth.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
    app.render();
    document.querySelector(".face-buy")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.modules[0]!.level).toBe(1);
  });

  it("the spacer wears no face button — the silent wire never upgrades", () => {
    give(app.state, "spacer", hex(1, 0));
    app.render();
    const modules = document.querySelectorAll(".module-node");
    expect(modules).toHaveLength(2);
    // One button, and it belongs to the opening synth.
    expect(document.querySelectorAll(".face-buy")).toHaveLength(1);
    expect(document.querySelector(".face-buy")!.getAttribute("data-module")).toBe("m1");
  });

  it("in flow the face buttons vanish with the purchase furniture", () => {
    app.render();
    expect(document.querySelectorAll(".face-buy")).toHaveLength(1);
    startSession(app.state, 600);
    app.render();
    expect(document.querySelectorAll(".face-buy")).toHaveLength(0);
    endSession(app.state);
    app.render();
    expect(document.querySelectorAll(".face-buy")).toHaveLength(1);
  });

  it("the Upgrade All cluster buys up to N on every levelable module, tray included, spacers never", () => {
    const s = app.state;
    const traySynth = give(s, "additive", null);
    const wire = give(s, "spacer", null, 2);
    s.nous = 40;
    app.render();
    const cluster = document.getElementById("upgrade-all")!;
    expect(cluster.hidden).toBe(false);
    expect(cluster.textContent).toContain("UPGRADE ALL");
    cluster.querySelector<HTMLButtonElement>('[data-sweep="1"]')!.click();
    expect(s.modules[0]!.level).toBe(1);
    expect(traySynth.level).toBe(1);
    expect(wire.level).toBe(2);
    expect(s.nous).toBe(20);
    expect(status()).toContain("UPGRADE ALL +1: 2 levels across the board · 20 ν");
  });

  it("the cluster is partial by design: the +N sweep buys what the bank covers", () => {
    const s = app.state;
    s.nous = levelsCost(0, 3); // three of the five wanted levels
    app.render();
    document.querySelector<HTMLButtonElement>('#upgrade-all [data-sweep="5"]')!.click();
    expect(s.modules[0]!.level).toBe(3);
    expect(s.nous).toBe(0);
    expect(status()).toContain("UPGRADE ALL +5: 3 levels across the board");
  });

  it("MAX sweeps the bank into the cheapest next levels and reports the spend", () => {
    const s = app.state;
    s.nous = levelsCost(0, 8) + levelCost(8) - 1;
    app.render();
    const maxChip = document.querySelector<HTMLButtonElement>('#upgrade-all [data-sweep="max"]')!;
    expect(maxChip.title).toContain("Sweep the whole bank");
    maxChip.click();
    expect(s.modules[0]!.level).toBe(8);
    expect(status()).toContain("UPGRADE ALL MAX: 8 levels across 1 module");
  });

  it("the cluster quotes full-N cost previews in its tooltips", () => {
    app.render();
    const chip = document.querySelector<HTMLButtonElement>('#upgrade-all [data-sweep="5"]')!;
    expect(chip.title).toContain("+5 on all 1 modules");
    expect(chip.title).toContain(formatNumber(levelsCost(0, 5)));
  });

  it("zero reads zero on the face: the shortfall leads, the label says +0 (ADR-0045, #233)", () => {
    // The opening synth's next level costs 10 ν; the bank covers none.
    app.state.nous = 4;
    app.render();
    const buy = document.querySelector(".face-buy")!;
    expect(buy.querySelector(".face-buy-label")!.textContent).toBe("+0");
    expect(buy.getAttribute("aria-label")).toBe("+0 — 6 ν short of one level");
    expect(buy.querySelector("title")!.textContent).toBe("+0 — 6 ν short of one level");
    // Nothing disables: the click runs and the engine refuses plainly.
    (buy as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.modules[0]!.level).toBe(0);
  });

  it("the MAX flip reads MAX·0 when nothing is affordable", () => {
    app.state.nous = 4;
    app.render();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
    app.render();
    const buy = document.querySelector(".face-buy")!;
    expect(buy.querySelector(".face-buy-label")!.textContent).toBe("MAX·0");
    expect(buy.getAttribute("aria-label")).toBe("MAX · buys 0 — 6 ν short");
    document.dispatchEvent(new KeyboardEvent("keyup", { key: "Shift" }));
  });

  it("an affordable face keeps its ordinary read", () => {
    app.state.nous = 10;
    app.render();
    const buy = document.querySelector(".face-buy")!;
    expect(buy.querySelector(".face-buy-label")!.textContent).toBe("+1");
    expect(buy.getAttribute("aria-label")).toBe("+1 level · 10 ν");
  });

  it("when nothing is affordable every sweep tooltip gains the zero-buy suffix (#233)", () => {
    // The cheapest next level on the board is 10 ν; the bank covers none.
    app.state.nous = 4;
    app.render();
    const cluster = document.getElementById("upgrade-all")!;
    for (const chip of cluster.querySelectorAll<HTMLButtonElement>(".sweep-chip")) {
      expect(chip.title).toMatch(/ — buys 0: need 6 ν more$/);
    }
    // A bank past the cheapest level drops the suffix everywhere.
    app.state.nous = 10;
    app.render();
    for (const chip of cluster.querySelectorAll<HTMLButtonElement>(".sweep-chip")) {
      expect(chip.title).not.toContain("buys 0");
    }
  });

  it("in flow the cluster hides", () => {
    startSession(app.state, 600);
    app.render();
    expect(document.getElementById("upgrade-all")!.hidden).toBe(true);
  });

  it("the dial: ×5 retitles the button, the buy lands partially, the bloom stands", () => {
    const s = app.state;
    s.nous = levelsCost(0, 3);
    app.render();
    clickCell(0, 0);
    const dial = document.querySelector(".bloom-dial")!;
    expect(dial.querySelectorAll(".bloom-dial-chip")).toHaveLength(4);
    dial.querySelector<HTMLButtonElement>('[data-bulk="5"]')!.click();
    const button = document.querySelector<HTMLButtonElement>("#bloom-upgrade")!;
    expect(button.querySelector(".bloom-upgrade-title")!.textContent).toContain("Upgrade ×5");
    expect(button.querySelector(".bloom-upgrade-title")!.textContent).toContain(formatInt(levelsCost(0, 5)));
    button.click();
    expect(s.modules[0]!.level).toBe(3);
    expect(status()).toContain("+3 levels");
    // The purchase keeps the bloom open, repriced for what remains.
    expect(app.ui.selected).toBe("m1");
    expect(document.querySelector(".bloom-upgrade-title")!.textContent).toContain("×5");
  });

  it("the dial's MAX chip counts the affordable levels and buys them all", () => {
    const s = app.state;
    s.nous = 1e6;
    app.render();
    clickCell(0, 0);
    const expected = affordableLevels(1e6, 0);
    const maxChip = document.querySelector<HTMLButtonElement>('.bloom-dial [data-bulk="max"]')!;
    expect(maxChip.textContent).toBe(`MAX·${expected}`);
    maxChip.click();
    document.querySelector<HTMLButtonElement>("#bloom-upgrade")!.click();
    expect(s.modules[0]!.level).toBe(expected);
    // The bank keeps whatever a further level would outprice.
    expect(s.nous).toBeLessThan(levelCost(expected));
  });

  it("the dial's MAX preview follows bank changes while ×1 stays affordable", () => {
    app.state.nous = 100;
    app.render();
    clickCell(0, 0);
    const maxChip = () => document.querySelector<HTMLButtonElement>('.bloom-dial [data-bulk="max"]')!;
    expect(maxChip().textContent).toBe(`MAX·${affordableLevels(100, 0)}`);
    app.state.nous = 50;
    app.render();
    expect(app.ui.bulkCount).toBe(1);
    const count = affordableLevels(50, 0);
    expect(maxChip().textContent).toBe(`MAX·${count}`);
    expect(maxChip().title).toBe(`Buy every affordable level (${count})`);
  });

  it("a new selection resets the dial to ×1", () => {
    give(app.state, "additive", hex(1, 0));
    app.render();
    clickCell(0, 0);
    document.querySelector<HTMLButtonElement>('.bloom-dial [data-bulk="5"]')!.click();
    expect(app.ui.bulkCount).toBe(5);
    clickCell(1, 0);
    expect(app.ui.bulkCount).toBe(1);
    expect(document.querySelector(".bloom-upgrade-title")!.textContent).toContain("Upgrade ×1");
  });

  it("the dial rides the phone sheet's buy column", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    app.state.nous = levelsCost(0, 3);
    app.render();
    clickCell(0, 0);
    // The sheet carries the same ladder: the chip row rides the buy column.
    document.querySelector<HTMLButtonElement>('.bloom-sheet [data-bulk="5"]')!.click();
    const button = document.querySelector<HTMLButtonElement>("#bloom-upgrade")!;
    expect(button.closest(".bloom-sheet-buy")).not.toBeNull();
    expect(button.querySelector(".bloom-upgrade-title")!.textContent).toContain("Upgrade ×5");
    button.click();
    expect(app.state.modules[0]!.level).toBe(3);
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  });
});

describe("the habit build (ADR-0046, wave 4)", () => {
  it("reads the shared catalog in the development summary: slots, equipped, unlocked, locked", () => {
    const created = createHabit(app.state, "Piano");
    const habit = created.habit!;
    habit.seconds = 5 * 3600; // one slot; charge-tap and weights unlocked
    equipBuildNode(app.state, habit.id, "weights");
    app.openApp("habit");
    document.querySelector<HTMLButtonElement>(`[data-summary="${habit.id}"]`)!.click();
    const build = document.querySelector("#app-popover .habit-build")!;
    expect(build.textContent).toContain("1/1 slots");
    expect(build.textContent).toContain("effects only while this habit is active");
    const equipped = build.querySelector(".build-node.equipped")!;
    expect(equipped.textContent).toContain("Weights");
    expect(equipped.getAttribute("data-unequip")).toBe("weights");
    expect(build.querySelector('[data-equip="charge-tap"]')).not.toBeNull();
    // Locked rungs name the milestone they owe and render no button.
    const locked = build.querySelector(".build-node.locked")!;
    expect(locked.textContent).toContain("unlocks at 15 h");
    expect(build.querySelector('[data-equip="forge-hand"]')).toBeNull();
  });

  it("equips and unequips through the panel — free respec, upgrade mode only", () => {
    const created = createHabit(app.state, "Piano");
    const habit = created.habit!;
    habit.seconds = 3600;
    const nousBefore = app.state.nous;
    app.openApp("habit");
    document.querySelector<HTMLButtonElement>(`[data-summary="${habit.id}"]`)!.click();
    document.querySelector<HTMLButtonElement>('[data-equip="charge-tap"]')!.click();
    expect(habit.build).toEqual(["charge-tap"]);
    document.querySelector<HTMLButtonElement>('[data-unequip="charge-tap"]')!.click();
    expect(habit.build).toEqual([]);
    expect(app.state.nous).toBe(nousBefore);
  });

  it("a fresh habit's summary points at the practice that unlocks the first nodes", () => {
    createHabit(app.state, "Piano");
    const habit = app.state.habits[0]!;
    app.openApp("habit");
    document.querySelector<HTMLButtonElement>(`[data-summary="${habit.id}"]`)!.click();
    expect(document.querySelector("#app-popover .habit-build")).toBeNull();
    expect(document.querySelector("#app-popover .habit-summary")!.textContent).toContain("Build nodes unlock with practice time");
  });
});
