// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import type { App } from "./app";
import { createHabit } from "../engine/habits";
import { equipBuildNode } from "../engine/builds";
import { BALANCE } from "../engine/constants";
import { ARETE_HORIZON } from "../engine/accumulator";
import { computeRates, cellCost, cellPurchasePrice, affordableLevels, levelCost, levelsCost } from "../engine/economy";
import { startSession, endSession } from "../engine/actions";
import { advance } from "../engine/advance";
import { give } from "../engine/fixtures";
import { hex, sameHex } from "../engine/hex";
import { formatInt, formatNumber } from "./format";
import { createAppFixture, clickCell, setAppWidth } from "./testing/app-fixture";
import { makeRecorder } from "./testing/signal-recorder";

// board rendering and interaction on the production HTML skeleton.
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

describe("the board ledger (§7, issue #270)", () => {
  it("docks above the board: grouped resource reads left, paired feats/chords chips right, no session read", () => {
    app.render();
    const ledger = document.getElementById("board-ledger")!;
    // One clipped instrument panel: the plate carries the ledger face.
    expect(ledger.querySelector(".inst-panel > .inst-panel-face.ledger-face")).not.toBeNull();
    // The resources group left — value and unit, no labels.
    const nous = ledger.querySelector('[data-live="nous"]')!;
    expect(nous.textContent).toMatch(/^\d/);
    expect(nous.nextElementSibling!.textContent).toBe("ν");
    const rate = ledger.querySelector('[data-live="rate"]')!;
    expect(rate.textContent).toMatch(/\/s$|^[\d.]+$/);
    expect(rate.parentElement!.textContent).toContain("ν/s");
    // The session read has left; no label rides any figure.
    expect(ledger.querySelector('[data-live="session"]')).toBeNull();
    expect(ledger.querySelectorAll(".prod-label")).toHaveLength(0);
    // Before the first prestige the arete slot stands dim: `— ◇`.
    const arete = ledger.querySelector(".ledger-arete")!;
    expect(arete.classList.contains("arete-dim")).toBe(true);
    expect(arete.querySelector("b")!.textContent).toBe("—");
    expect(arete.querySelector(".arete-mark svg")).not.toBeNull();
    // The hairline, then the paired chips: icon + count.
    expect(ledger.querySelector(".ledger-rule")).not.toBeNull();
    expect(document.getElementById("feats-chip")!.textContent).toContain("0/23");
    expect(document.getElementById("feats-chip")!.querySelector("svg")).not.toBeNull();
    expect(document.getElementById("library-chip")!.textContent).toContain("0/11");
    // The chips open their sheets.
    document.getElementById("feats-chip")!.click();
    expect(app.ui.modal).toBe("achievements");
    app.closeModal();
    document.getElementById("library-chip")!.click();
    expect(app.ui.modal).toBe("library");
    app.closeModal();
  });

  it("bonuses never ride the ledger face — they live in the sheets and the rate details' legs", () => {
    app.state.achievements["first-light"] = Date.now();
    app.render();
    // The panel's own reads carry no bonus figure anywhere.
    const face = document.querySelector("#board-ledger .ledger-face")!.textContent!;
    expect(face).not.toContain("%");
    // The feats sheet names the shared effect…
    app.openModal("achievements");
    expect(document.getElementById("modal-content")!.textContent).toContain("+2% ν");
    app.closeModal();
    // …the chords sheet the discovery bonus…
    app.openModal("library");
    expect(document.getElementById("modal-content")!.textContent).toContain("+1%");
    app.closeModal();
    // …and the rate details carry both as legs (ADR-0037's one roster).
    app.render();
    const breakdown = document.querySelector("#board-ledger .rate-breakdown")!.textContent!;
    expect(breakdown).toContain("Achievements");
    expect(breakdown).toContain("Discoveries");
  });

  it("the nous read compresses instead of overflowing, with the exact value on its tooltip (issue #187)", () => {
    const read = () => document.querySelector('#board-ledger [data-live="nous"]')!;
    // Small balances render as before: the floored comma-grouped integer.
    app.state.nous = 5004.32;
    app.render();
    expect(read().textContent).toBe("5,004");
    expect(read().getAttribute("title")).toBe("5,004");
    // The ladder takes over past the exact range; the tooltip stays exact.
    app.state.nous = 1_234_567;
    app.render();
    expect(read().textContent).toBe("1.235M");
    expect(read().getAttribute("title")).toBe(formatInt(1_234_567));
    // Scientific fallback: the figure stays in its lane at any magnitude.
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

  it("the rate figure shows the final total and no session read exists anywhere on the panel", () => {
    app.render();
    const cell = document.getElementById("rate-cell")!;
    // No operand chain: the total is the display, the module-linked details
    // disclose beside the panel (issue #154).
    expect(cell.querySelector(".rate-equation")).toBeNull();
    expect(cell.querySelector('[data-live="rate"]')!.textContent).toBe(formatNumber(0.1));
    expect(document.querySelector('#board-ledger [data-live="session"]')).toBeNull();
    expect(document.querySelector('#game-info-strip [data-live="i-session"]')).toBeNull();
    // The arete read rides its live slot once banked; the telegraph slot
    // carries none before it.
    expect(document.querySelector('#board-ledger [data-live="arete"]')).toBeNull();
  });

  it("the details disclose nonproducing modules' effects — never a second ν/s", () => {
    app.render();
    // The launch roster is one synthesizer: no other-modules section yet.
    expect(document.querySelector("#board-ledger .rd-other-row")).toBeNull();
    give(app.state, "infusor", hex(0, 1));
    app.render();
    const row = document.querySelector("#board-ledger .rd-other-row")!;
    expect(row.textContent).toContain("Booster");
    expect(row.querySelector('[data-live^="n-"]')!.textContent).toBe("+20% to adjacent");
    // The uplifted synth's own leg carries the same uplift...
    expect(document.querySelector("#board-ledger .rd-synth .rd-legs")!.textContent).toContain("+20%");
    // ...and the nonproducer's row never wears a ν/s figure.
    expect(row.textContent).not.toContain("ν/s");
  });

  it("every synthesizer row carries its final ν/s and expands into its legs; the rows sum to the board's rate", () => {
    const s = app.state;
    give(s, "additive", hex(1, 0)); // G4 — a Fifth with the launch C4
    give(s, "infusor", hex(0, 1)); // uplift on C4
    app.render();
    const snapshot = computeRates(s);
    const rows = [...document.querySelectorAll("#board-ledger .rd-synth")];
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
    expect(document.querySelector('#board-ledger [data-live="b-rate"]')!.textContent).toBe(
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
    // The surface carries no header of its own — the eyebrow names it and
    // the roster speaks (the instrument standards' identity rule), and the
    // eyebrow carries the dialog's accessible name.
    expect(modal.querySelector("h2")).toBeNull();
    expect(document.getElementById("modal-title")!.textContent).toBe("RATE");
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
    // The disclosure rides the ledger's own slot: the roster lives in the
    // DOM, mounted beside the clipped panel.
    expect(document.querySelector("#board-ledger .rate-breakdown")).not.toBeNull();
    // A synthesizer row's tap names its module's place: the Hex detail
    // opens on it (issue #295) and the row wears the state grammar's
    // inset marker.
    const row = document.querySelector("#board-ledger .rd-synth")!;
    row.querySelector(".rd-pick")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const id = row.getAttribute("data-module-id")!;
    expect(app.ui.detail).not.toBeNull();
    expect(app.state.modules.find((m) => m.id === id)!.pos).toEqual(app.ui.detail!.pos);
    expect((document.getElementById("hex-detail") as HTMLElement).hidden).toBe(false);
    expect(row.classList.contains("st-selected")).toBe(true);
    // A click inside the tooltip's legs is reading, never picking: copying
    // a figure or scrolling the roster must not open another detail.
    row.querySelector(".rd-legs")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.modules.find((m) => m.id === id)!.pos).toEqual(app.ui.detail!.pos);
    // And the ⓘ trigger is the tooltip's own: pinning it never picks.
    row.querySelector(".inst-tip-trigger")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.modules.find((m) => m.id === id)!.pos).toEqual(app.ui.detail!.pos);
    expect(row.querySelector(".inst-tip")!.classList.contains("show")).toBe(true);
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
    const row = modal.querySelector(".rd-synth")!;
    row.querySelector(".rd-legs")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.modal).toBe("rate");
    // The row's own tap closes the sheet and opens the module's Hex detail.
    row.querySelector(".rd-pick")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.modal).toBeNull();
    expect(app.state.modules.find((m) => m.id === row.getAttribute("data-module-id"))!.pos).toEqual(app.ui.detail!.pos);
  });

  it("above the line the whole ledger is the door; below it nothing changes (#233)", () => {
    // The door's contract lives in the stylesheet's ≥760px container block:
    // the panel is the hover/focus area, the popover drops ledger-wide from
    // beneath the clipped plate, and the ⓘ ring brightens with the ledger —
    // never the figure alone.
    const css = readFileSync("src/ui/style.css", "utf8");
    const mark = "@container app (width >= 760px)";
    expect(css).toContain(mark);
    const after = css.indexOf(mark);
    const door = css.slice(after, css.indexOf("\n}", after));
    expect(door).toContain(".rate-breakdown .inst-panel-face { max-height: min(76vh, 640px); }");
    expect(door).toContain(".board-ledger:hover .rate-breakdown");
    expect(door).toContain(".board-ledger:focus-within .rate-breakdown { display: block; }");
    // The disclosure's ledger-wide geometry is the base rule — the popover
    // mounts outside the clipped plate, so no hover override moves it.
    const base = css.slice(css.indexOf(".rate-breakdown {"), css.indexOf(mark));
    expect(base).toContain("width: min(560px, 100%)");
  });

  it("the sheet keeps its figures live in place — a tick never rebuilds it (ADR-0037)", () => {
    setAppWidth(720);
    app.render();
    document.getElementById("rate-cell")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const modal = document.getElementById("modal-content")!;
    // Stamp a sentinel into a live slot: the next render must overwrite it
    // in place (the tick's fill), not rebuild the sheet around it.
    modal.querySelector('[data-live="b-rate"]')!.textContent = "stale";
    app.render();
    expect(modal.querySelector('[data-live="b-rate"]')!.textContent).not.toBe("stale");
    expect(modal.querySelector('[data-live="b-rate"]')!.textContent).toMatch(/ν\/s$/);
    expect(modal.querySelector(".rd-synth")).not.toBeNull();
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
    app.state.sessionsCompleted = 1;
    app.state.eraEarned = ARETE_HORIZON;
    app.state.nous = 8_000;
    const prestigeGen = give(app.state, "focusKeyed", hex(2, 0));
    prestigeGen.reserve = 120;
    app.render();
    document.getElementById("prestige-door")!.click();
    expect(app.ui.modal).toBe("prestige");
    const content = document.getElementById("modal-content")!;
    expect(content.textContent).toContain("1 Arete");
    expect(content.textContent).toContain("feats");
    expect(content.textContent).not.toContain("achievements");
    document.getElementById("prestige-confirm")!.click();
    expect(app.ui.modal).toBeNull();
    expect(app.state.arete).toBe(1);
    expect(app.state.prestiges).toBe(1);
    expect(document.getElementById("status")!.textContent).toContain("Banked 1 Arete");
    expect(document.getElementById("status")!.textContent).toContain("Feat unlocked — First prestige");
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

describe("the action row (§7)", () => {
  it("is a left-edge icon dock: Catalog / Forge / Add — Inventory left with the tray's collapse toggle (#272)", () => {
    app.render();
    const dock = document.getElementById("board-tools")!;
    const ops = [...dock.querySelectorAll("[data-op]")].map((b) => b.getAttribute("data-op"));
    expect(ops).toEqual(["catalog", "forge", "cell"]);
    // The dock reads Add: the cell tool's accessible name and its title.
    const add = dock.querySelector<HTMLButtonElement>('[data-op="cell"]')!;
    expect(add.getAttribute("aria-label")).toBe("Add");
    expect(add.title).toContain("Add — ");
    // The count badge rides the Forge icon; the charge pip rides beneath it.
    expect(dock.querySelector('[data-op="forge"] .forge-pip')).not.toBeNull();
    expect(document.querySelector(".legend")).toBeNull();
    expect(document.getElementById("tool-manage")).toBeNull();
    expect(document.getElementById("manage-banner")).toBeNull();
    // The tray column stands at the board's right edge, always open in
    // upgrade mode: head, modules face, and no collapse anywhere.
    const column = document.getElementById("tray-column")!;
    expect(column).not.toBeNull();
    const zone = document.getElementById("inventory-zone") as HTMLElement;
    expect(zone.classList.contains("off")).toBe(false);
    expect("trayOpen" in app.ui).toBe(false);
  });

  it("the tray column wears no second switch — the board tabs drive its faces (#272)", () => {
    app.state.mode = "upgrade";
    app.state.catalogEntryOwned = true;
    app.render();
    const zone = document.getElementById("inventory-zone")!;
    const mutTray = document.getElementById("mutator-tray")!;
    // The column carries no switcher of its own: the vertical layer legend
    // at the board's edge is the one Modules / Mutators switch (issue #295).
    expect(document.getElementById("tray-head")).toBeNull();
    expect(document.querySelectorAll("[data-legend-layer]")).toHaveLength(2);
    // The Modules face stands; the Mutators face waits.
    expect(zone.classList.contains("off")).toBe(false);
    expect(mutTray.hidden).toBe(true);
    // The legend flips the column's face with the global mode.
    document.querySelector<HTMLButtonElement>('#layer-legend [data-legend-layer="mutators"]')!.click();
    expect(app.ui.mutLayer).toBe("mutators");
    expect(zone.classList.contains("off")).toBe(true);
    expect(mutTray.hidden).toBe(false);
    document.querySelector<HTMLButtonElement>('#layer-legend [data-legend-layer="modules"]')!.click();
    expect(app.ui.mutLayer).toBe("modules");
    expect(zone.classList.contains("off")).toBe(false);
    expect(mutTray.hidden).toBe(true);
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

  it("flow locks the dock's three tools, and the tray column hides with the board (#272)", () => {
    app.render();
    const dockOps = () => [...document.querySelectorAll<HTMLButtonElement>('#board-tools [data-op]')];
    // Catalog and Forge stand open in upgrade mode; Add is price-gated.
    expect(dockOps()[0]!.disabled).toBe(false);
    expect(dockOps()[1]!.disabled).toBe(false);
    expect(document.getElementById("inventory-zone")!.classList.contains("off")).toBe(false);
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.render();
    // No Inventory button exists to lock — the dock reads Catalog/Forge/Add,
    // every tool disabled, and the column gone with the locked board.
    expect(dockOps().map((b) => b.getAttribute("data-op"))).toEqual(["catalog", "forge", "cell"]);
    for (const button of dockOps()) expect(button.disabled).toBe(true);
    expect(dockOps()[0]!.title).toContain("purchases happen between sessions");
    expect(dockOps()[2]!.title).toBe("Add — purchases happen between sessions");
    expect(document.getElementById("inventory-zone")!.classList.contains("off")).toBe(true);
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
    // The board answers through the peek (the Hex detail opens, issue
    // #295) and the click dismisses it without taking the roll.
    clickCell(0, 0);
    expect(app.ui.detail).not.toBeNull();
    expect(app.ui.modal).toBeNull();
    expect(app.state.bankedRolls).toHaveLength(1);
    app.closeDetail();
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
    expect(pill.textContent).toContain("Add");
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

  it("holding the face starts a live drag; a drop lands the move and opens no detail", () => {
    app.render();
    // Holding the face and moving: the ghost appears.
    document.elementFromPoint = () => cell(0, 0);
    cell(0, 0).dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 100 }));
    expect(document.querySelector(".drag-ghost")).not.toBeNull();
    // Dropping back on the origin cell moves nothing — and opens nothing:
    // a drop never opens the Hex detail (§5).
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 130, clientY: 110 }));
    expect(app.state.modules[0]!.pos).toEqual(hex(0, 0));
    expect(app.ui.detail).toBeNull();
    expect(document.getElementById("hex-detail")!.hidden).toBe(true);
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
    // A placement never opens the Hex detail (§5) — the gesture keeps its
    // own landing.
    expect(app.ui.placing).toBeNull();
    expect(document.getElementById("hex-detail")!.hidden).toBe(true);
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
    expect(app.ui.detail).toBeNull();
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

// The expanded face's suite (§5) retired with the bloom: the Hex detail's
// coverage lives in hexdetail.test.ts (issue #295).

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

  it("the readout is a reserved spot: ν/s, capacity, earned factor, then its chords", () => {
    app = boot(undefined, true);
    // The power-chord region again: C4 sings in two chords — the Octave
    // (C4·C5) and the Fifth (C4·G4). At capacity one only one instance
    // earns: the C4·G4 Fifth; the doubled fifth and the Octave stay
    // recognized idles (issue #258).
    give(app.state, "additive", hex(1, 0));
    app.state.cells.push(hex(0, 1));
    give(app.state, "additive", hex(0, 1));
    app.render();
    const chips = () => [...readout().querySelectorAll(".chord-readout-chip")].map((chip) => chip.textContent);
    // Hovering G4 — its final ν/s leads, then its capacity, then the total
    // earned factor (instance × formation), then the named terms: the
    // active chord, then the idle candidate it qualifies for but can't
    // afford (#258).
    cell(1, 0).dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(readout().hidden).toBe(false);
    // The formation quality is its own named term (ADR-0049) and rides the
    // factor: classes {0,7}, one class of complexity — scored on the
    // allocation's own magnitudes (#260).
    const earned = formatNumber(1.3 * (1 + BALANCE.allocationComplexityRate));
    expect(chips()).toEqual([
      `+${formatNumber(0.1 * 1.3 * (1 + BALANCE.allocationComplexityRate))} ν/s`,
      "Capacity 1/1",
      `×${earned}`,
      "Formation ×1.12",
      "Fifth ×1.3",
      "Fifth ×1.3 · idle",
    ]);
    // Hovering C4 asks its own row — the same earned Fifth, and the idle
    // Octave is the candidate it shares.
    cell(0, 0).dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(chips()).toEqual([
      `+${formatNumber(0.1 * 1.3 * (1 + BALANCE.allocationComplexityRate))} ν/s`,
      "Capacity 1/1",
      `×${earned}`,
      "Formation ×1.12",
      "Fifth ×1.3",
      "Octave ×1.15 · idle",
    ]);
    // Leaving clears them.
    document.getElementById("grid")!.dispatchEvent(new MouseEvent("pointerleave"));
    expect(readout().hidden).toBe(true);
  });

  it("a chordless module still shows its final ν/s — at zero capacity spent, factor ×1", () => {
    app = boot(undefined, true);
    app.render();
    give(app.state, "additive", hex(5, 0)); // its own island
    app.state.cells.push(hex(5, 0));
    app.render();
    const chips = () => [...readout().querySelectorAll(".chord-readout-chip")].map((chip) => chip.textContent);
    const cellAt = document.querySelector('[data-cell="5,0"]')!;
    cellAt.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(readout().hidden).toBe(false);
    expect(chips()).toEqual([`+${formatNumber(BALANCE.synthRate)} ν/s`, "Capacity 0/1", "×1"]);
  });

  it("clicking a module during flow answers the lock — a read-only cross-section, no bloom", () => {
    give(app.state, "additive", hex(1, 0));
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    clickCell(1, 0);
    expect(document.getElementById("hex-detail")!.hidden).toBe(false);
    expect(document.getElementById("hex-detail")!.textContent).toContain("read-only");
    expect(document.getElementById("status")!.textContent).not.toContain("locked during flow");
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

  it("overlapping chords draw their own work, chord-colored (#201); idles draw dimmer (#258)", () => {
    app = boot(undefined, true);
    // A power-chord region: C4 (the opening synth), G4 and C5 — the active
    // Fifth draws full-voice, and the recognized idles (the doubled fifth,
    // the Octave) draw their own dotted marks beneath it.
    give(app.state, "additive", hex(1, 0));
    app.state.cells.push(hex(0, 1));
    give(app.state, "additive", hex(0, 1));
    app.render();
    const grid = document.getElementById("grid")!;
    const marks = [...grid.querySelectorAll('[data-key="chord-marks"] .chord-mark')];
    expect(marks).toHaveLength(3);
    // The active seam dominates: the first mark is the earning Fifth; the
    // idles carry the chord-idle class (issue #258).
    expect(marks[0]!.classList.contains("chord-idle")).toBe(false);
    expect(marks[0]!.querySelectorAll("line.chord-seam").length).toBeGreaterThan(0);
    expect(marks.slice(1).every((mark) => mark.classList.contains("chord-idle"))).toBe(true);
    // The idle hues: the engine names the Octave and the doubled Fifth.
    const hues = marks.map((mark) => (mark as HTMLElement).style.getPropertyValue("--cc"));
    expect(hues).toContain("var(--chord-fifth)");
    expect(hues).toContain("var(--chord-octave)");
    // The chord work renders behind the modules: the marks group precedes
    // the cell nodes (which carry data-cell, no data-key) in paint order.
    const children = [...grid.children].map((child) => child.getAttribute("data-key"));
    expect(children.indexOf("chord-marks")).toBeLessThan(children.findIndex((key) => key === null));
  });

  // The selection lift and its focus/fade registers (#201) retired with
  // the bloom (issue #295): the grid's chords whisper in the gaps, the
  // hover asks name them in the reserved readout, and the Hex detail
  // carries the focused module's facts.

  it("a detail adds no chord line — the seams are the callout", () => {
    give(app.state, "additive", hex(1, 0));
    app.render();
    clickCell(0, 0);
    const detailEl = document.getElementById("hex-detail")!;
    expect(detailEl.hidden).toBe(false);
    expect(detailEl.querySelector(".chord-seam, .chord-chip, .chord-label")).toBeNull();
  });

  it("a conducting spacer's ask names the chord it carries — by containment (#201)", () => {
    give(app.state, "spacer", hex(0, 1));
    app.state.cells.push(hex(0, 2));
    give(app.state, "additive", hex(0, 2));
    app.render();
    // Resting on the spacer asks the chord it conducts; no ν/s chip ever
    // rides a spacer — the silent wire produces nothing (#172).
    cell(0, 1).dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(readout().hidden).toBe(false);
    expect(readout().textContent).toContain("Octave ×1.15");
    expect(readout().textContent).not.toContain("ν/s");
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
    // It chords at once; resting on the granted synth names its final ν/s
    // and its chord in the reserved readout.
    document.querySelector('[data-cell="1,0"]')!.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(document.getElementById("chord-readout")!.textContent).toContain("Fifth ×1.3");
    expect(document.getElementById("chord-readout")!.textContent).toContain(
      `+${formatNumber(0.1 * 1.3 * (1 + BALANCE.allocationComplexityRate))} ν/s`,
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
    // The gesture stays off the cell: no Hex detail opened.
    expect(app.ui.detail).toBeNull();
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

  it("the dial: ×5 retitles the button, the buy lands partially, the detail stands", () => {
    const s = app.state;
    s.nous = levelsCost(0, 3);
    app.render();
    clickCell(0, 0);
    const dial = document.querySelector(".hex-dial")!;
    expect(dial.querySelectorAll(".hex-dial-chip")).toHaveLength(4);
    dial.querySelector<HTMLButtonElement>('[data-bulk="5"]')!.click();
    const button = document.querySelector<HTMLButtonElement>("#detail-upgrade")!;
    expect(button.querySelector(".hex-upgrade-title")!.textContent).toContain("Upgrade ×5");
    expect(button.querySelector(".hex-upgrade-title")!.textContent).toContain(formatInt(levelsCost(0, 5)));
    button.click();
    expect(s.modules[0]!.level).toBe(3);
    expect(status()).toContain("+3 levels");
    // The purchase keeps the detail open, repriced for what remains.
    expect(app.ui.detail).toEqual({ pos: hex(0, 0), face: "modules" });
    expect(document.querySelector(".hex-upgrade-title")!.textContent).toContain("×5");
  });

  it("the dial's MAX chip counts the affordable levels and buys them all", () => {
    const s = app.state;
    s.nous = 1e6;
    app.render();
    clickCell(0, 0);
    const expected = affordableLevels(1e6, 0);
    const maxChip = document.querySelector<HTMLButtonElement>('.hex-dial [data-bulk="max"]')!;
    expect(maxChip.textContent).toBe(`MAX·${expected}`);
    maxChip.click();
    document.querySelector<HTMLButtonElement>("#detail-upgrade")!.click();
    expect(s.modules[0]!.level).toBe(expected);
    // The bank keeps whatever a further level would outprice.
    expect(s.nous).toBeLessThan(levelCost(expected));
  });

  it("the dial's MAX preview follows bank changes while ×1 stays affordable", () => {
    app.state.nous = 100;
    app.render();
    clickCell(0, 0);
    const maxChip = () => document.querySelector<HTMLButtonElement>('.hex-dial [data-bulk="max"]')!;
    expect(maxChip().textContent).toBe(`MAX·${affordableLevels(100, 0)}`);
    app.state.nous = 50;
    app.render();
    expect(app.ui.bulkCount).toBe(1);
    const count = affordableLevels(50, 0);
    expect(maxChip().textContent).toBe(`MAX·${count}`);
    expect(maxChip().title).toBe(`Buy every affordable level (${count})`);
  });

  it("a new detail resets the dial to ×1 — another Hex needs the grid", () => {
    give(app.state, "additive", hex(1, 0));
    app.render();
    clickCell(0, 0);
    document.querySelector<HTMLButtonElement>('.hex-dial [data-bulk="5"]')!.click();
    expect(app.ui.bulkCount).toBe(5);
    // The grid yielded to the detail: its surface is retired (pointer-dead
    // and hidden), so no other Hex is reachable from here.
    expect(document.body.classList.contains("hex-detail-open")).toBe(true);
    // Returning and opening the other module starts its dial fresh.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    clickCell(1, 0);
    expect(app.ui.bulkCount).toBe(1);
    expect(document.querySelector(".hex-upgrade-title")!.textContent).toContain("Upgrade ×1");
  });

  it("the dial rides the phone detail sheet's buy column", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    app.state.nous = levelsCost(0, 3);
    app.render();
    clickCell(0, 0);
    // The sheet carries the same ladder: the chip row rides the buy column.
    document.querySelector<HTMLButtonElement>('.hex-detail.sheet [data-bulk="5"]')!.click();
    const button = document.querySelector<HTMLButtonElement>("#detail-upgrade")!;
    expect(button.closest(".hex-rail-row.modules")).not.toBeNull();
    expect(button.querySelector(".hex-upgrade-title")!.textContent).toContain("Upgrade ×5");
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
