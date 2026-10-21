// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { App } from "./app";
import { createHabit, selectHabit } from "../engine/habits";
import { createGoal, accrueGoalProgress, rollGoalOccurrences } from "../engine/goals";
import { BALANCE } from "../engine/constants";
import { startSession, endSession } from "../engine/actions";
import { levelsCost } from "../engine/economy";
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
    expect(rows[0]!.textContent).toContain("1/22");
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
    expect(app.ui.placing).toBeNull();
    modal.querySelector<HTMLButtonElement>("[data-inventory-place]")!.click();
    expect(app.ui.modal).toBeNull();
    expect(app.ui.placing).toBe("m1");
    app.cancelPlacing();
  });

  it("the tray sheet wears the layer switch — flipping it swaps the face and the board legend follows (issue #426)", () => {
    const s = app.state;
    s.mode = "upgrade";
    s.catalogEntryOwned = true;
    s.eraEarned = BALANCE.world.entryNous * 1.5;
    s.world.weapons.push({ id: "wp2", type: "chargeBlade", pos: null, store: 0, cooldown: 0, targetPriority: [] });
    app.returnToInventory("m1");
    app.openModal("inventory");
    const modal = document.getElementById("modal-content")!;
    // The switch rides the sheet (the layer legend's symbols, issue #295);
    // the modules face stands first.
    const pair = [...modal.querySelectorAll("[data-legend-layer]")];
    expect(pair).toHaveLength(2);
    expect(modal.querySelector('[data-inv="m1"]')).not.toBeNull();
    expect(modal.querySelector("[data-world-tray]")).toBeNull();
    // Flipping the sheet's switch turns the global layer: the sheet swaps
    // to the steel-register World tiles, the board legend follows.
    (modal.querySelector('[data-legend-layer="world"]') as HTMLButtonElement).click();
    expect(app.ui.boardLayer).toBe("world");
    expect(document.querySelector('#layer-legend [data-legend-layer="world"]')!.classList.contains("active")).toBe(true);
    const modalAfter = document.getElementById("modal-content")!;
    expect(modalAfter.querySelector('[data-inv="m1"]')).toBeNull();
    const tile = modalAfter.querySelector<HTMLButtonElement>('[data-world-tray="wp2"]')!;
    expect(tile).not.toBeNull();
    expect(tile.querySelector(".world-tile-plate")).not.toBeNull();
    tile.click();
    expect(app.ui.worldArmed).toBeNull();
    expect(modalAfter.textContent).toContain("Place");
    modalAfter.querySelector<HTMLButtonElement>("[data-world-place]")!.click();
    expect(app.ui.worldArmed).toBe("wp2");
    expect(app.ui.modal).toBeNull();
    // Tapping a World tile arms it and puts the sheet away, so the plate
    // taps land on a visible board.
    tile.click();
    expect(app.ui.modal).toBeNull();
    expect(app.ui.worldArmed).toBe("wp2");
    app.worldCancelGestures();
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
    expect(app.ui.worldArmed !== null).toBe(false);
    app.cancelCellPurchase();
    // The World layer: Add walks to Modules and arms the cell purchase —
    // the World face carries no Add arm (issue #426).
    app.state.eraEarned = BALANCE.world.entryNous * 1.5;
    app.setBoardLayer("world");
    app.render();
    const add = document.querySelector<HTMLButtonElement>('#board-tools [data-op="cell"]')!;
    add.click();
    expect(app.ui.boardLayer).toBe("modules");
    expect(app.ui.buyingCell).toBe(true);
    expect(app.ui.worldArmed).toBeNull();
    expect(document.getElementById("cell-arm-pill")!.hidden).toBe(false);
    // The Add tool's tray-sheet pass: arming from the thumb bar puts the
    // sheet away so the pulsing targets stand on a visible board. From the
    // World layer the Add walks to Modules first (issue #426).
    app.cancelCellPurchase();
    app.setBoardLayer("world");
    app.openModal("inventory");
    document.querySelector<HTMLButtonElement>('#thumb-bar [data-op="cell"], #board-tools [data-op="cell"]')!.click();
    expect(app.ui.buyingCell).toBe(true);
    expect(app.ui.boardLayer).toBe("modules");
    expect(app.ui.modal).toBeNull();
    app.cancelCellPurchase();
  });

  it("the chord sheet's door, index, and stage (issue #230, reworked by #278)", () => {
    // A placement forms the board's first Fifth: the discovery lands at
    // the action boundary, the ledger chip counts it, and the sheet's
    // index names the class on its stage.
    const tray = give(app.state, "additive", null);
    app.pickCellThenPlace(tray.id, hex(1, 0));
    app.render();
    expect(app.state.chordDiscovery["Fifth"]?.formed).toBe(true);
    const chip = document.getElementById("library-chip")!;
    expect(chip.textContent).toContain("1/11");
    chip.click();
    expect(app.ui.modal).toBe("library");
    const modal = document.getElementById("modal-content")!;
    // The header is the count readout — no explanatory paragraph.
    expect(modal.querySelector("#modal-title")!.textContent).toContain("Chords (1/11)");
    expect(modal.querySelector(".lead")).toBeNull();
    // The discovered class leads the index and stands on the stage.
    const named = [...modal.querySelectorAll(".chord-row:not(.locked)")];
    expect(named).toHaveLength(1);
    expect(named[0]!.getAttribute("data-chord")).toBe("Fifth");
    expect(named[0]!.getAttribute("aria-current")).toBe("true");
    expect(modal.querySelector(".chord-stage-name")!.textContent).toBe("Fifth");
    // Every undiscovered class is the dashes and the dim silhouette —
    // no name, no copy.
    const locked = [...modal.querySelectorAll(".chord-row.locked")];
    expect(locked).toHaveLength(10);
    for (const row of locked) {
      expect(row.textContent).not.toContain("Fifth");
      expect(row.querySelector(".chord-glyph")).not.toBeNull();
    }
    // The active read counts standing instances; its tooltip names the
    // class ringing and states the stacking — reachable by keyboard focus,
    // dismissed by Escape (#278).
    const activeTrigger = modal.querySelector<HTMLButtonElement>('[aria-describedby="chord-tip-active"]')!;
    expect(activeTrigger.textContent).toBe("1 active");
    activeTrigger.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    const activeBody = document.getElementById("chord-tip-active")!;
    expect(activeBody.classList.contains("inst-show")).toBe(true);
    expect(activeBody.textContent).toContain("Fifth ×1");
    expect(activeBody.textContent).toContain("Instances stack on their members");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(activeBody.classList.contains("inst-show")).toBe(false);
    // Selecting a row puts that class on the stage and keeps keyboard
    // focus in the index after the sheet replaces its markup.
    (locked[0] as HTMLButtonElement).focus();
    (locked[0] as HTMLButtonElement).click();
    expect(document.activeElement).toBe(modal.querySelector('.chord-row[aria-current="true"]'));
    const stageName = document.querySelector("#modal-content .chord-stage-name")!.textContent!;
    expect(stageName).not.toBe("Fifth");
    expect(document.querySelector("#modal-content .chord-stage")!.textContent).toContain("·····");
    modal.querySelector<HTMLButtonElement>('.chord-row[data-chord="Fifth"]')!.click();
    expect(document.activeElement).toBe(modal.querySelector('.chord-row[data-chord="Fifth"]'));
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
    tile.click();
    expect(modal.querySelector<HTMLButtonElement>("[data-inventory-place]")!.disabled).toBe(true);
    modal.querySelector<HTMLButtonElement>("[data-inventory-place]")!.click();
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

  function setZoom(value: number): void {
    const slider=document.getElementById("board-zoom") as HTMLInputElement;
    slider.value=String(value);slider.dispatchEvent(new Event("input",{bubbles:true}));
  }
  it("sets a repeatable continuous zoom and resets both zoom and position", () => {
    const before=viewBox();setZoom(173);
    expect(app.ui.zoom).toBeCloseTo(1.73);
    expect(document.getElementById("board-zoom-value")!.textContent).toBe("173%");
    setZoom(300);expect(app.ui.zoom).toBe(3);
    setZoom(80);expect(app.ui.zoom).toBe(.8);
    app.ui.pan={x:0,y:0};document.getElementById("zoom-fit")!.click();
    expect(app.ui.zoom).toBe(1);expect(app.ui.pan).toBeNull();expect(viewBox()).toBe(before);
  });
  it("trackpad scrolling pans without zooming", async () => {
    mockWrap(800,600);const before=viewBox();
    svgEl().dispatchEvent(new WheelEvent("wheel",{deltaX:60,deltaY:40,cancelable:true}));
    await new Promise(resolve=>requestAnimationFrame(resolve));
    expect(app.ui.zoom).toBe(1);expect(viewBox()).not.toBe(before);
  });
  it("pinch wheel zoom anchors the pointer including letterboxed space", async () => {
    mockWrap(800,600);const before=lensFrame(1,null,app.boardBounds).view;
    const scale=Math.min(800/before.width,600/before.height);
    const anchor={x:before.x+before.width/2+80/scale,y:before.y+before.height/2-30/scale};
    const wheel=new WheelEvent("wheel",{deltaY:-20,ctrlKey:true,cancelable:true});
    Object.defineProperties(wheel,{clientX:{value:480},clientY:{value:270},ctrlKey:{value:true}});svgEl().dispatchEvent(wheel);
    await new Promise(resolve=>requestAnimationFrame(resolve));
    expect(app.ui.zoom).toBeCloseTo(Math.exp(.2));
    const after=lensFrame(app.ui.zoom,app.ui.pan,app.boardBounds).view;
    const nextScale=Math.min(800/after.width,600/after.height);
    expect(after.x+after.width/2+80/nextScale).toBeCloseTo(anchor.x);
    expect(after.y+after.height/2-30/nextScale).toBeCloseTo(anchor.y);
  });
  it("coalesces a smooth pinch to one render per frame", async () => {
    mockWrap(800,600);const render=vi.spyOn(app,"render");
    for(let i=0;i<4;i++) { const wheel=new WheelEvent("wheel",{deltaY:-5,ctrlKey:true,cancelable:true}); Object.defineProperty(wheel,"ctrlKey",{value:true}); svgEl().dispatchEvent(wheel); }
    expect(render).not.toHaveBeenCalled();await new Promise(resolve=>requestAnimationFrame(resolve));
    expect(render).toHaveBeenCalledTimes(1);expect(app.ui.zoom).toBeCloseTo(Math.exp(.2));
  });
  it("Space pans over an occupied module while Space in a text input remains typing", () => {
    mockWrap(800,600);document.dispatchEvent(new KeyboardEvent("keydown",{code:"Space",bubbles:true}));
    document.querySelector('[data-cell="0,0"]')!.dispatchEvent(new MouseEvent("pointerdown",{button:0,bubbles:true,clientX:200,clientY:200}));
    document.dispatchEvent(new MouseEvent("pointermove",{bubbles:true,clientX:130,clientY:200}));
    document.dispatchEvent(new MouseEvent("pointerup",{bubbles:true}));
    expect(app.ui.pan).not.toBeNull();expect(document.querySelector(".drag-ghost")).toBeNull();
    document.dispatchEvent(new KeyboardEvent("keyup",{code:"Space"}));
    const input=document.createElement("input");document.body.append(input);
    const key=new KeyboardEvent("keydown",{code:"Space",bubbles:true,cancelable:true});input.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(false);
    const notes=document.getElementById("app-tile-notes")!;
    const activation=new KeyboardEvent("keydown",{code:"Space",key:" ",bubbles:true,cancelable:true});
    notes.dispatchEvent(activation);expect(activation.defaultPrevented).toBe(false);
  });
  it("two touch contacts take over from placement to pan and pinch", () => {
    mockWrap(800,600);const cell=document.querySelector('[data-cell="0,0"]')!;
    cell.dispatchEvent(new PointerEvent("pointerdown",{button:0,pointerId:1,pointerType:"touch",bubbles:true,clientX:100,clientY:100}));
    cell.dispatchEvent(new PointerEvent("pointerdown",{button:0,pointerId:2,pointerType:"touch",bubbles:true,clientX:200,clientY:100}));
    document.dispatchEvent(new PointerEvent("pointermove",{pointerId:2,pointerType:"touch",clientX:240,clientY:120}));
    expect(app.ui.zoom).toBeGreaterThan(1);expect(app.ui.pan).not.toBeNull();
    expect(document.querySelector(".drag-ghost")).toBeNull();
    document.dispatchEvent(new PointerEvent("pointerup",{pointerId:1}));document.dispatchEvent(new PointerEvent("pointerup",{pointerId:2}));
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
    // A pan is a gesture, not a click: the release never falls through —
    // the suppressor ate the click, so no Hex detail opened.
    expect(app.ui.detail).toBeNull();
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
    setZoom(125);
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

  it("the top nav holds session controls and bare doors; the clock's popover anchors to the clock", () => {
    app.render();
    // The Focus sheet anchors beneath the clock's own disclosure (issue
    // #148) — never beneath a door in the apps row (ADR-0050's phone line
    // keeps the doors out of the session cluster).
    const clock = document.getElementById("clock-plan")!;
    expect(clock.tagName).toBe("BUTTON");
    expect(clock.querySelector(".clock-disclose")).toBeNull();
    clock.click();
    expect(document.getElementById("app-tile-focus")).toBeNull();
    expect(app.ui.app).toBe("time");
    const popover = document.getElementById("app-popover")!;
    expect(document.getElementById("console-session")!.contains(popover)).toBe(true);
    expect(document.getElementById("console-apps")!.contains(popover)).toBe(false);
    app.closeApp();
    app.render();
    expect(document.getElementById("app-popover")).toBeNull();
    setAppWidth(1200);
    app.render();
    expect(document.getElementById("clock-plan")!.tagName).toBe("BUTTON");
    document.getElementById("clock-plan")!.click();
    expect(app.ui.app).toBe("time");
    setAppWidth(390);
    app.render();
    expect(document.getElementById("clock-plan")!.tagName).toBe("BUTTON");
    expect(document.getElementById("clock-plan")!.getAttribute("aria-expanded")).toBe("true");
  });

  it("the Hex detail presents as a bottom sheet replacing the grid", () => {
    app.render();
    clickCell(0, 0);
    const detailEl = document.getElementById("hex-detail")!;
    expect(detailEl.hidden).toBe(false);
    expect(detailEl.classList.contains("sheet")).toBe(true);
    expect(detailEl.querySelector(".hex-detail-layer.modules .hex-stack-face")!.textContent).toContain("SINE");
    expect(detailEl.querySelector("#detail-upgrade")).not.toBeNull();
    expect(document.body.classList.contains("hex-detail-open")).toBe(true);
    // The details column reflows into the single column's last post
    // (ADR-0072): the faces and the action rail stand before it, so the
    // detailed content scrolls without ever making them unreachable, the
    // context map last.
    const grid = detailEl.querySelector(".hex-detail-grid")!;
    const side = grid.querySelector(".hex-detail-side");
    expect(side).not.toBeNull();
    expect(grid.lastElementChild).toBe(side);
    expect(side!.querySelector(".ctx-map")).not.toBeNull();
    expect(grid.querySelector(".hex-detail-actions #detail-upgrade")).not.toBeNull();
    expect(document.getElementById("horizon-bar")).toBeNull();
    // The return control closes the sheet and restores the grid.
    document.getElementById("hex-detail-return")!.click();
    expect(detailEl.hidden).toBe(true);
    expect(document.body.classList.contains("hex-detail-open")).toBe(false);
    expect(document.getElementById("horizon-bar")).toBeNull();
  });

  it("tracks phone modal sheet state while zoom retains its board lane", () => {
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
    // A synthesizer row's tap closes the sheet and opens the module's Hex
    // detail, so the answer lands on the cross-section it names (issue #295).
    const row = sheet.querySelector(".rd-synth")!;
    row.querySelector(".rd-pick")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.modal).toBeNull();
    expect(app.state.modules.find((m) => m.id === row.getAttribute("data-module-id"))!.pos).toEqual(app.ui.detail!.pos);
  });

  it("uses the ledger for prestige and leaves board zoom in its stable lane", () => {
    expect(document.getElementById("horizon-bar")).toBeNull();
    expect(document.getElementById("board-zoom")).not.toBeNull();
    document.querySelector<HTMLButtonElement>(".info-arete")!.click();
    expect(app.ui.modal).toBe("rate");expect(document.getElementById("prestige-door")).not.toBeNull();
  });

});

// The phone tests read the stylesheet's container blocks as lane
// contracts (happy-dom has no layout engine): each block runs to its
// column-0 closing brace, and cssPx() lifts one declaration out of one
// block. The physical no-overlap proof is browser evidence; these pins
// hold the contract between runs.
const cssBlocks = (query: string) =>
  [...readFileSync("src/ui/style.css", "utf8").matchAll(new RegExp(`${query} \\{[\\s\\S]*?\\n\\}`, "g"))].map((match) => match[0]);
const cssPx = (block: string, selector: string, prop: string) =>
  Number(block.match(new RegExp(`${selector}\\s*\\{[^}]*${prop}:\\s*(\\d+)px`))![1]);

describe("the small-screen composition (issue #389)", () => {
  beforeEach(() => {
    setAppWidth(390);
  });

  it("the legend answers taps at phone width — grid layer, detail emphasis, flow included", () => {
    const s = app.state;
    s.mode = "upgrade";
    s.catalogEntryOwned = true;
    s.eraEarned = BALANCE.world.entryNous * 1.5;
    s.mutatorSlots = [hex(0, 0)];
    s.mutators = [{ id: "mu1", family: "power", rarity: "common", pos: hex(0, 0) }];
    app.render();
    const legend = () => document.getElementById("layer-legend")!;
    // The grid: the strip is the one layer switch.
    expect(legend().hidden).toBe(false);
    legend().querySelector<HTMLButtonElement>('[data-legend-layer="world"]')!.click();
    expect(app.ui.boardLayer).toBe("world");
    expect(legend().querySelector('[data-legend-layer="world"]')!.classList.contains("active")).toBe(true);
    // The detail: the same strip emphasizes the faces, in upgrade mode…
    app.setBoardLayer("modules");
    clickCell(0, 0);
    expect(app.ui.detail).not.toBeNull();
    legend().querySelector<HTMLButtonElement>('[data-legend-layer="world"]')!.click();
    expect(app.ui.detail!.face).toBe("world");
    expect(legend().querySelector('[data-legend-layer="world"]')!.classList.contains("active")).toBe(true);
    // …and in flow, where the detail stands read-only and the entry drops
    // it, so the read-only cross-section re-opens on the locked board.
    app.beginFlow(null);
    expect(app.ui.detail).toBeNull();
    // The strip still switches the locked grid's layer read-only — both
    // ways, so the modules cells return for the detail's click.
    legend().querySelector<HTMLButtonElement>('[data-legend-layer="world"]')!.click();
    expect(app.ui.boardLayer).toBe("world");
    expect(legend().querySelector('[data-legend-layer="world"]')!.classList.contains("active")).toBe(true);
    legend().querySelector<HTMLButtonElement>('[data-legend-layer="modules"]')!.click();
    expect(app.ui.boardLayer).toBe("modules");
    clickCell(0, 0);
    expect(app.ui.detail).not.toBeNull();
    expect(document.querySelector(".hex-detail-readonly")).not.toBeNull();
    legend().querySelector<HTMLButtonElement>('[data-legend-layer="world"]')!.click();
    expect(app.ui.detail!.face).toBe("world");
    // Return restores the grid with the layer intact.
    document.getElementById("hex-detail-return")!.click();
    expect(app.ui.detail).toBeNull();
    expect(app.ui.boardLayer).toBe("world");
  });

  it.each([320, 360, 390])("Upgrade All buys at %ipx and hides during flow", (width) => {
    setAppWidth(width);
    const s = app.state;
    s.nous = levelsCost(0, 3);
    app.render();
    const cluster = document.getElementById("upgrade-all")!;
    expect(cluster.hidden).toBe(false);
    cluster.querySelector<HTMLButtonElement>('[data-sweep="5"]')!.click();
    expect(s.modules[0]!.level).toBe(3);
    expect(s.nous).toBe(0);
    // Flow stands the row down — the lower lanes stay the bar's.
    startSession(app.state, 600);
    app.render();
    expect(cluster.hidden).toBe(true);
    endSession(app.state);
  });

  it("the phone sheet carries no Catalog or Forge duplicates — the thumb bar stays the destination", () => {
    app.render();
    clickCell(0, 0);
    const detail = document.getElementById("hex-detail")!;
    expect(detail.querySelector('[data-op="catalog"], [data-op="forge"]')).toBeNull();
    for (const button of detail.querySelectorAll("button")) {
      expect((button.textContent ?? "").toLowerCase()).not.toContain("catalog");
      expect((button.textContent ?? "").toLowerCase()).not.toContain("forge");
    }
    // The surrounding navigation holds both doors exactly once.
    const bar = document.getElementById("thumb-bar")!;
    expect(bar.querySelector('[data-op="catalog"]')).not.toBeNull();
    expect(bar.querySelector('[data-op="forge"]')).not.toBeNull();
  });

  it("the dense chord case keeps idle facts inspectable and Return restores the grid", () => {
    give(app.state, "additive", hex(1, 0));
    give(app.state, "additive", hex(0, 1));
    app.render();
    clickCell(0, 1);
    const detail = document.getElementById("hex-detail")!;
    const idle = detail.querySelector<HTMLButtonElement>(".detail-idle-trigger")!;
    expect(idle.textContent).toContain("idle");
    idle.focus();
    idle.click();
    const tooltipId = idle.getAttribute("aria-describedby")!;
    expect(document.getElementById(tooltipId)?.textContent).toContain("Octave");
    expect(document.getElementById(tooltipId)?.classList.contains("inst-show")).toBe(true);
    document.getElementById("hex-detail-return")!.click();
    expect(app.ui.detail).toBeNull();
  });
});

describe("the coarse-pointer touch floor (issue #350)", () => {
  // The floor lifts only where the primary pointer is a finger — the
  // desktop's compact densities stand (instrument standards: touch
  // targets are accessibility, not decoration).
  it("the compact controls reach the 44px floor on coarse pointers", () => {
    const floor = cssBlocks("@media \\(pointer: coarse\\)").find((block) => block.includes(".zoom-cluster button"));
    expect(floor).toBeTruthy();
    expect(floor).toMatch(/\.zoom-cluster button\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/);
    expect(floor).toMatch(/\.arc-dismiss\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/);
    expect(floor).toMatch(/\.app-tile\s*\{[^}]*width:\s*44px[^}]*height:\s*44px/);
    expect(floor).toMatch(/\.focus-close\s*\{[^}]*min-width:\s*44px[^}]*min-height:\s*44px/);
    expect(floor).toMatch(/\.history-row\s*\{[^}]*min-height:\s*44px/);
    // The dismiss's grown target rides inside the card: the copy's right
    // padding clears it (44px target + its 6px inset + breathing room).
    expect(floor).toMatch(/\.arc-card\s*\{[^}]*padding-right:\s*56px/);
  });

  it("the arc card docks above the zoom cluster's coarse lane, clear of the Arete read", () => {
    const phone = cssBlocks("@container app \\(width < 600px\\)").find((block) => block.includes(".arc-card"));
    expect(phone).toBeTruthy();
    const floor = cssBlocks("@media \\(pointer: coarse\\)").find((block) => block.includes(".zoom-cluster button"))!;
    // The cluster's lane on phone: bottom 64 carrying three coarse-floor
    // buttons and two gaps; the card docks over its top with air to
    // spare — it never runs beneath the cluster's edge.
    const laneTop = cssPx(phone!, "\\.zoom-cluster", "bottom") + 3 * cssPx(floor, "\\.zoom-cluster button", "height") + 2 * 6;
    const cardBottom = cssPx(phone!, "\\.arc-card", "bottom");
    expect(cardBottom).toBeGreaterThanOrEqual(laneTop + 4);
    // And the horizon bar's whole lane sits below that dock, so the
    // Arete word stays readable under the card.
    const barTop = cssPx(phone!, "\\.horizon-bar", "bottom") + cssPx(phone!, "\\.horizon-bar", "height");
    expect(cardBottom).toBeGreaterThan(barTop);
  });
});

describe("the phone banner (ADR-0050's amended phone line)", () => {
  beforeEach(() => {
    setAppWidth(390);
  });

  // The doors re-render with the console's app section; re-query per
  // interaction — a held node goes stale the moment the render that
  // answered it replaces the markup.
  const door = (key: string) => document.getElementById(`app-tile-${key}`)!;

  it("Notes is the only separate launcher beside the session surface and Settings", () => {
    app.render();
    // The doors: exactly focus + Notes — the compact launcher retired with
    // ADR-0033, and Habit and Goals live in the sheet's faces behind the
    // focus door.
    expect([...document.querySelectorAll("#console-apps .app-tile")].map((t) => t.id)).toEqual([
      "app-tile-notes",
    ]);
    expect(document.getElementById("app-launcher")).toBeNull();
    expect(document.getElementById("app-launcher-menu")).toBeNull();
    // The nav row's full roster: brand, clock, switch, doors, Settings —
    // every launcher surface a native button.
    const row = () => document.querySelector("header.console")!;
    for (const id of ["flow-switch", "clock-plan", "app-tile-notes", "console-settings"]) {
      expect(row().contains(document.getElementById(id)!)).toBe(true);
      expect(document.getElementById(id)!.tagName).toBe("BUTTON");
    }
    // And the row stays fixed-height (issue #149's acceptance check, kept):
    // the phone query pins the console's 56px, each block running to its
    // column-0 closing brace.
    const css = readFileSync("src/ui/style.css", "utf8");
    const consoleBlock = [...css.matchAll(/@container app \(width < 600px\) \{[\s\S]*?\n\}/g)]
      .map((match) => match[0])
      .find((block) => block.includes(".console {"));
    expect(consoleBlock).toBeTruthy();
    expect(consoleBlock!.slice(consoleBlock!.indexOf(".console"))).toMatch(/\.console\s*\{[^}]*height:\s*56px/);
  });

  it("the doors carry no Goals- or Habit-state read — the goal read is the display well's meter (ADR-0033 amended, #445)", () => {
    app.render();
    // No Goals or Habit door stands at any width (#313): the Focus sheet's
    // faces carry them, so the console row wears no tracker aggregate. The
    // separate GOALS face retired with #445 — its head read went with it.
    expect(document.getElementById("app-tile-goals")).toBeNull();
    expect(document.getElementById("app-tile-habit")).toBeNull();
    expect(document.querySelector(".launcher-goal-state, .launcher-habit-state")).toBeNull();
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 20, schedule: "daily", now: 1_000 });
    accrueGoalProgress(app.state, habit.id, 20 * 60);
    setAppWidth(1200);
    app.render();
    expect(document.getElementById("app-tile-goals")).toBeNull();
    expect(document.getElementById("app-tile-habit")).toBeNull();
    expect(document.querySelector(".launcher-goal-state, .launcher-habit-state")).toBeNull();
    // The console row never reads an aggregate; the display well's meter
    // carries the goal read, its engraved mark answering for completion.
    const consoleText = document.querySelector(".console")!.textContent ?? "";
    expect(consoleText).not.toMatch(/\d+\s*%/);
    expect(document.querySelector("#console-session .goal-meter")).not.toBeNull();
    expect(document.querySelector("#console-session .session-habit .habit-done")).not.toBeNull();
    // A recurring reset clears the done mark — on the tick, not the door.
    rollGoalOccurrences(app.state, Date.now() + 24 * 3600_000);
    app.render();
    expect(document.querySelector("#console-session .session-habit .habit-done")).toBeNull();
  });

  it("the session surface opens Focus and marks every standing face without a separate icon", () => {
    app.render();
    const group = () => document.querySelector<HTMLButtonElement>(".session-focus")!;
    group().click();
    expect(app.ui.app).toBe("time");
    expect(group().classList.contains("open")).toBe(true);
    expect(document.getElementById("app-tile-focus")).toBeNull();
    document.querySelector<HTMLButtonElement>('[data-face="habit"]')!.click();
    expect(app.ui.app).toBe("habit");
    expect(group().classList.contains("open")).toBe(true);
    group().click();
    expect(app.ui.app).toBe("time");
    group().click();
    expect(app.ui.app).toBe("time");
    app.closeApp();
    expect(group().classList.contains("open")).toBe(false);
  });

  it("Notes opens from its own door as a modal; the composer is reachable mid-session, and the clock anchor stays clear", () => {
    // Mid-session (notes are a flow-surface app): the door answers with
    // the centered modal (issue #332) — never a frame under the clock.
    startSession(app.state, null);
    app.render();
    door("notes").click();
    expect(app.ui.modal).toBe("notes");
    expect(document.getElementById("note-composer")).not.toBeNull();
    expect(document.getElementById("modal")!.hidden).toBe(false);
    expect(document.getElementById("console-session")!.querySelector(".app-popover")).toBeNull();
    // The door toggles: a second press closes.
    door("notes").click();
    expect(app.ui.modal).toBeNull();
    expect(document.getElementById("modal")!.hidden).toBe(true);
    endSession(app.state);
  });

  it("the goal meter rides at every width; the session group carries the habit name (ADR-0050 amended, #331)", () => {
    const habit = createHabit(app.state, "Piano").habit!;
    selectHabit(app.state, habit.id);
    createGoal(app.state, { habitId: habit.id, minutes: 20, schedule: "once", now: 1000 });
    accrueGoalProgress(app.state, habit.id, 10 * 60);
    app.render();
    // The phone row's session group — display well, switch — reads where
    // the player starts: the habit is no longer dropped (ADR-0050's
    // omission amended by #331), and it is the change door here too.
    const group = document.querySelector("#console-session .session-habit")!;
    expect(group.querySelector('[data-session="habit"]')!.textContent).toBe("Piano");
    expect((group as HTMLElement).tagName).toBe("SPAN");
    expect(group.closest("button")).toBe(document.querySelector(".session-focus"));
    // The meter rides where the banner never did (the header-status
    // brief): the phone header finally carries a goal read.
    expect(document.querySelector("#console-session .goal-meter")).not.toBeNull();
    // Desktop wears the same panel, and the same session group.
    setAppWidth(1200);
    app.render();
    expect(document.querySelector("#console-session .display-well")).not.toBeNull();
    expect(document.querySelector("#console-session .goal-meter")).not.toBeNull();
    expect(document.querySelector("#console-session .session-habit")!.querySelector('[data-session="habit"]')!.textContent).toBe("Piano");
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

describe("render-pass layout reads (#349)", () => {
  it("captures scroll positions before console writes and preserves them on rebuild", () => {
    clickCell(0, 0);
    app.dev = true;
    app.devToggleBoard();
    const consoleHost = document.getElementById("console-session")!;
    const detailHost = document.getElementById("hex-detail")!;
    const grid = detailHost.querySelector<HTMLElement>(".hex-detail-grid")!;
    const panel = document.getElementById("dev-board")!;
    const reads: string[] = [];
    const restored: number[] = [];
    for (const [element, name, value] of [[grid, "detail", 57], [panel, "dev", 83]] as const) {
      Object.defineProperty(element, "scrollTop", {
        configurable: true,
        get() {
          expect(consoleHost.dataset.renderKey).toBe("force-rebuild");
          reads.push(name);
          return value;
        },
        set(value: number) { restored.push(value); },
      });
    }
    consoleHost.dataset.renderKey = "force-rebuild";
    detailHost.dataset.renderKey = "force-rebuild";
    app.render();
    expect(reads).toEqual(["detail", "dev"]);
    expect(detailHost.querySelector<HTMLElement>(".hex-detail-grid")!.scrollTop).toBe(57);
    expect(restored).toEqual([83]);
  });

  it("a render pass reads the container's layout once, and a resized pass reads again", () => {
    app.render();
    const appEl = document.getElementById("app")!;
    let reads = 0;
    Object.defineProperty(appEl, "clientWidth", {
      configurable: true,
      get() {
        reads++;
        return 390;
      },
    });
    try {
      // One pass, one read: the batch lands before the pass's writes and
      // every phone gate inside the pass reads it.
      app.render();
      expect(reads).toBe(1);
      // The phone gates agree with the batched read (the thumb bar's dock
      // stands on phone width).
      expect(document.querySelector("#thumb-bar")).not.toBeNull();
      // The next pass reads fresh: a resize between passes re-batches
      // (setAppWidth swaps in a plain value; re-arm the counting getter).
      setAppWidth(1200);
      Object.defineProperty(appEl, "clientWidth", {
        configurable: true,
        get() {
          reads++;
          return 1200;
        },
      });
      app.render();
      expect(reads).toBe(2);
    } finally {
      setAppWidth(390);
    }
  });
});
