// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import type { App } from "./app";
import { createHabit, selectHabit } from "../engine/habits";
import { createGoal, accrueGoalProgress } from "../engine/goals";
import { BALANCE } from "../engine/constants";
import { startSession, endSession } from "../engine/actions";
import { give } from "../engine/fixtures";
import { hex } from "../engine/hex";
import { formatFixed, formatInt } from "./format";
import { lensFrame } from "./zoom";
import { createAppFixture, clickCell, setAppWidth } from "./testing/app-fixture";

// phone rendering and interaction on the production HTML skeleton.
const fixture = createAppFixture();
const boot = fixture.boot;
let app: App;

beforeEach(() => {
  localStorage.clear();
  app = boot();
});
afterEach(() => fixture.release());

describe("the thumb bar (§7, portrait phone)", () => {
  beforeEach(() => {
    setAppWidth(390);
  });

  it("holds five segments — Catalog / Forge / Add / Inventory / Collection (issue #270)", () => {
    give(app.state, "additive", null);
    app.render();
    const bar = document.getElementById("thumb-bar")!;
    const ops = [...bar.querySelectorAll("[data-op]")].map((b) => b.getAttribute("data-op"));
    expect(ops).toEqual(["catalog", "forge", "cell", "inventory", "collection"]);
    expect(bar.querySelector('[data-op="cell"] .tool-word')!.textContent).toBe("Add");
    expect(bar.querySelector('[data-op="inventory"] .tool-word')!.textContent).toBe("Inventory");
    expect(bar.querySelector('[data-op="inventory"] .tool-badge')!.textContent).toBe("1");
    // The feats and chords segments are gone — Collection is their sole
    // phone door now, and the dock never grew a fourth icon.
    expect(bar.querySelector('[data-op="feats"]')).toBeNull();
    expect(bar.querySelector('[data-op="library"]')).toBeNull();
    // The dock never grew a Collection or Inventory icon: it stays
    // Catalog / Forge / Add (issue #272).
    expect(document.querySelectorAll("#board-tools [data-op]")).toHaveLength(3);
    // On phone Inventory taps the sheet; Collection opens the launcher.
    bar.querySelector<HTMLButtonElement>('[data-op="inventory"]')!.click();
    expect(app.ui.modal).toBe("inventory");
    app.closeModal();
    bar.querySelector<HTMLButtonElement>('[data-op="collection"]')!.click();
    expect(app.ui.modal).toBe("collection");
    app.closeModal();
  });

  it("the Collection launcher's rows reach both sheets behind a back control (issue #270)", () => {
    app.state.achievements["first-light"] = Date.now();
    app.openModal("collection");
    const modal = document.getElementById("modal-content")!;
    // The launcher reads both ledgers: icon, name, count — no other copy.
    expect(modal.querySelector(".eyebrow")!.textContent).toBe("COLLECTION");
    const rows = [...modal.querySelectorAll<HTMLButtonElement>(".collection-row")];
    expect(rows).toHaveLength(2);
    expect(rows[0]!.querySelector("svg")).not.toBeNull();
    expect(rows[0]!.textContent).toContain("Feats");
    expect(rows[0]!.textContent).toContain("1/23");
    expect(rows[1]!.textContent).toContain("Chords");
    expect(rows[1]!.textContent).toContain("0/11");
    // The feats row opens the feats sheet, and the sheet carries the
    // launcher's back control on phone.
    rows[0]!.click();
    expect(app.ui.modal).toBe("achievements");
    const back = document.getElementById("modal-back")!;
    expect(back.textContent).toBe("‹ Collection");
    back.click();
    expect(app.ui.modal).toBe("collection");
    // The chords row reaches the field guide the same way.
    modal.querySelector<HTMLButtonElement>("#collection-chords")!.click();
    expect(app.ui.modal).toBe("library");
    document.getElementById("modal-back")!.click();
    expect(app.ui.modal).toBe("collection");
    app.closeModal();
  });

  it("the back control belongs to the phone launcher flow only; the desktop chips open the sheets bare", () => {
    // Desktop width: the feats sheet has no back control — the ledger chip
    // is its door, and there is nothing to walk back to.
    setAppWidth(1200);
    app.render();
    app.openModal("achievements");
    expect(document.getElementById("modal-back")).toBeNull();
    app.closeModal();
    app.openModal("library");
    expect(document.getElementById("modal-back")).toBeNull();
    app.closeModal();
    // Phone width: both sheets carry it.
    setAppWidth(390);
    app.render();
    app.openModal("achievements");
    expect(document.getElementById("modal-back")).not.toBeNull();
    app.closeModal();
    app.openModal("library");
    expect(document.getElementById("modal-back")).not.toBeNull();
  });

  it("the arete read's canonical mark rides the stylesheet's 15px contract (issue #270)", () => {
    // The mark's size is a spec figure, not tuning: one rule serves both
    // faces of the ledger, and the contract test pins it like the door's.
    const css = readFileSync("src/ui/style.css", "utf8");
    const rule = css.slice(css.indexOf(".arete-mark svg {"), css.indexOf("}", css.indexOf(".arete-mark svg {")));
    expect(rule).toContain("width: 15px");
    expect(rule).toContain("height: 15px");
  });

  it("the inventory sheet arms a placement from its tiles, and carries no how-to prose", () => {
    app.returnToInventory("m1");
    app.openModal("inventory");
    const modal = document.getElementById("modal-content")!;
    expect(modal.querySelector('[data-inv="m1"]')).not.toBeNull();
    // The tiles are the instructions: no heading, no explanatory lead.
    expect(modal.querySelector("h2")).toBeNull();
    expect(modal.querySelector(".lead")).toBeNull();
    (modal.querySelector('[data-inv="m1"]') as HTMLButtonElement).click();
    expect(app.ui.modal).toBeNull();
    expect(app.ui.placing).toBe("m1");
    app.cancelPlacing();
  });

  it("the tray sheet wears the mode's switch — flipping it swaps the face and the board tabs follow (issue #272)", () => {
    const s = app.state;
    s.mode = "upgrade";
    s.catalogEntryOwned = true;
    s.mutatorSlots = [hex(0, 0)];
    s.mutators = [
      { id: "mu1", family: "power", rarity: "common", pos: hex(0, 0) },
      { id: "mu2", family: "charge", rarity: "uncommon", pos: null },
    ];
    app.returnToInventory("m1");
    app.openModal("inventory");
    const modal = document.getElementById("modal-content")!;
    // The switch rides the sheet; the modules face stands first.
    const pair = [...modal.querySelectorAll("[data-mut-layer]")];
    expect(pair).toHaveLength(2);
    expect(modal.querySelector('[data-inv="m1"]')).not.toBeNull();
    expect(modal.querySelector("[data-mut-tray]")).toBeNull();
    // Flipping the sheet's switch turns the global mode: the sheet swaps
    // to the arete-register mutator tiles, the board tabs follow.
    (modal.querySelector('[data-mut-layer="mutators"]') as HTMLButtonElement).click();
    expect(app.ui.mutLayer).toBe("mutators");
    expect(document.querySelector('#mut-tabs [data-mut-layer="mutators"]')!.classList.contains("active")).toBe(true);
    const modalAfter = document.getElementById("modal-content")!;
    expect(modalAfter.querySelector('[data-inv="m1"]')).toBeNull();
    const tile = modalAfter.querySelector<HTMLButtonElement>('[data-mut-tray="mu2"]')!;
    expect(tile).not.toBeNull();
    expect(tile.querySelector(".mut-tile-hex")).not.toBeNull();
    const detail = tile.closest(".inst-tip")!;
    const trigger = detail.querySelector<HTMLButtonElement>(".inst-tip-trigger")!;
    const tooltip = () => document.getElementById(trigger.getAttribute("aria-describedby")!)!;
    tile.focus();
    expect(tooltip().classList.contains("inst-show")).toBe(true);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(tooltip().classList.contains("inst-show")).toBe(false);
    expect(app.ui.modal).toBe("inventory");
    trigger.click();
    expect(tooltip().classList.contains("inst-show")).toBe(true);
    expect(app.ui.mutArmedTray).toBeNull();
    document.body.click();
    expect(tooltip().classList.contains("inst-show")).toBe(false);
    // Tapping a mutator tile arms it and puts the sheet away, so the slot
    // taps land on a visible board.
    tile.click();
    expect(app.ui.modal).toBeNull();
    expect(app.ui.mutArmedTray).toBe("mu2");
    app.mutCancelGestures();
  });

  it("the tray sheet stands scrimless — the board behind stays live, and a drop onto the sheet retrieves", async () => {
    app.openModal("inventory");
    const backdrop = document.getElementById("modal")!;
    // Scrimless and click-through: the sheet is a docked panel, never a
    // blocking dialog (issue #272 review).
    expect(backdrop.classList.contains("peek-tray")).toBe(true);
    expect(backdrop.getAttribute("aria-modal")).toBe("false");
    expect(backdrop.classList.contains("drag-through")).toBe(false);
    const board = app.state.modules[0]!;
    expect(board.pos).not.toBeNull();
    // The drag's release suppresses the synthetic post-drop click; drain
    // the suppressor before this test ends.
    try {
      // A board drop onto the open sheet retrieves — the chord-breaking
      // gesture against the sheet, with the board live behind it.
      const cellNode = () => document.querySelector<SVGGElement>('[data-cell="0,0"]')!;
      document.elementFromPoint = () => cellNode();
      cellNode().dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
      document.dispatchEvent(new MouseEvent("pointermove", { clientX: 160, clientY: 90 }));
      expect(document.querySelector(".drag-ghost")).not.toBeNull();
      document.elementFromPoint = () => document.getElementById("modal-content")!;
      document.dispatchEvent(new MouseEvent("pointerup", { clientX: 200, clientY: 600 }));
      expect(board.pos).toBeNull();
      expect(app.ui.modal).toBe("inventory");
      // Another modal kind drops the scrimless standing.
      app.openModal("forge");
      expect(backdrop.classList.contains("peek-tray")).toBe(false);
      app.closeModal();
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 0));
      delete (document as unknown as { elementFromPoint?: unknown }).elementFromPoint;
    }
  });

  it("Add arms the mode's action — the cell in module mode, the slot unlock in mutator mode", () => {
    const s = app.state;
    s.mode = "upgrade";
    s.catalogEntryOwned = true;
    s.mutatorSlots = [hex(0, 0)];
    s.mutators = [{ id: "mu1", family: "power", rarity: "common", pos: hex(0, 0) }];
    app.render();
    // Module mode: the cell purchase (the icon prices at zero ν, so grant
    // the first cell's cost — the same affordably-armed shape as desktop).
    app.state.nous = BALANCE.cellFirstCost;
    app.render();
    document.querySelector<HTMLButtonElement>('#board-tools [data-op="cell"]')!.click();
    expect(app.ui.buyingCell).toBe(true);
    expect(app.ui.mutUnlockArmed).toBe(false);
    app.cancelCellPurchase();
    // Mutator mode: the slot unlock, armed from Add — never a tray card.
    app.mutSetLayer("mutators");
    app.render();
    const add = document.querySelector<HTMLButtonElement>('#board-tools [data-op="cell"]')!;
    expect(add.title).toContain("Unlock a Mutator slot — 2 Arete");
    add.click();
    expect(app.ui.mutUnlockArmed).toBe(true);
    expect(app.ui.buyingCell).toBe(false);
    expect(document.getElementById("mut-unlock-pill")!.hidden).toBe(false);
    // The Add tool's tray-sheet pass: arming from the thumb bar puts the
    // sheet away so the pulsing targets stand on a visible board.
    app.mutCancelGestures();
    app.openModal("inventory");
    document.querySelector<HTMLButtonElement>('#thumb-bar [data-op="cell"], #board-tools [data-op="cell"]')!.click();
    expect(app.ui.mutUnlockArmed).toBe(true);
    expect(app.ui.modal).toBeNull();
    app.mutCancelGestures();
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
    expect(chip.textContent).toContain("1/11");
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
    const breakdown = document.querySelector("#board-ledger .rate-breakdown")!;
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
    // The lock reason rides the tooltip layer — no explanatory paragraph.
    expect(document.getElementById(tile.getAttribute("aria-describedby")!)!.textContent).toContain("locked during flow");
    tile.click();
    expect(app.ui.placing).toBeNull();
    expect(app.ui.modal).toBe("inventory");
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

  it("the game-info strip carries the resource reads only — no session, no chips; Collection is the feats/chords door (issue #270)", () => {
    app.render();
    const strip = document.getElementById("game-info-strip")!;
    // The grouped reads: value then unit.
    expect(strip.querySelector('[data-live="i-nous"]')).not.toBeNull();
    expect(strip.querySelector('[data-live="i-nous"]')!.nextElementSibling!.textContent).toBe("ν");
    // The strip's read is fixed-decimal (ADR-0031 as applied here):
    // trailing zeros stay, so the centered pill never breathes.
    expect(strip.querySelector('[data-live="i-rate"]')!.textContent).toBe(formatFixed(0.1));
    // The session read has left the strip.
    expect(strip.querySelector('[data-live="i-session"]')).toBeNull();
    // No feats or chords chips — Collection owns their phone entry, and
    // the thumb bar holds it exactly once.
    expect(strip.querySelector(".ledger-chip")).toBeNull();
    const collection = document.querySelector('#thumb-bar [data-op="collection"]');
    expect(collection).not.toBeNull();
    expect(document.querySelectorAll('#thumb-bar [data-op="collection"]')).toHaveLength(1);
  });

  it("the strip's arete read carries the dim telegraph slot before the first prestige", () => {
    app.render();
    const strip = document.getElementById("game-info-strip")!;
    const slot = strip.querySelector(".info-arete")!;
    expect(slot.classList.contains("arete-dim")).toBe(true);
    expect(slot.querySelector("b")!.textContent).toBe("—");
    expect(slot.querySelector(".arete-mark svg")).not.toBeNull();
    expect(strip.querySelector('[data-live="i-arete"]')).toBeNull();
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
    row.querySelector(".rd-pick")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
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
