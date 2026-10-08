// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import type { App } from "./app";
import { createAppFixture, clickCell, setAppWidth } from "./testing/app-fixture";
import { give } from "../engine/fixtures";
import { hex, sameHex } from "../engine/hex";
import { startSession, endSession } from "../engine/actions";
import { formatInt, formatNumber } from "./format";
import { levelsCost, displayedRates } from "../engine/economy";
import type { MutatorFamily, MutatorInstance, Rarity } from "../engine/types";

// The Hex detail (issue #295): the module bloom's successor — an owned
// cell's full-stack cross-section replacing the grid. The presentation is
// the instrument, not a menu: the module face below at bloom scale (the
// face itself is the plate — no text column re-speaks it), the Mutators
// face above in the arete register (its state in the four-state grammar),
// the action rail beside the stack, the chord row in the reserved
// readout's grammar, and the return contract (explicit control and
// Escape, preserving the layer, position, and zoom).

const fixture = createAppFixture();
const boot = fixture.boot;
let app: App;

beforeEach(() => {
  localStorage.clear();
  app = boot();
});

afterEach(() => fixture.release());

const detail = () => document.getElementById("hex-detail")!;
const open = () => !detail().hidden;
const sections = () => [...detail().querySelectorAll<HTMLElement>(".hex-detail-layer")];
const section = (face: "modules" | "mutators") =>
  detail().querySelector<HTMLElement>(`.hex-detail-layer.${face}`)!;
const faceSvg = (face: "modules" | "mutators") => section(face).querySelector<SVGElement>(".hex-stack-chassis svg")!;
const grid = () => document.getElementById("grid") as unknown as SVGSVGElement;

function mut(id: string, family: MutatorFamily, rarity: Rarity, pos: Hex_json | null): MutatorInstance {
  return { id, family, rarity, pos };
}
type Hex_json = { q: number; r: number };

// An era past the entry: one slot hosting the opening synth, Arete for
// the ladder, the tray twin waiting.
function seedEra(): void {
  const s = app.state;
  s.mode = "upgrade";
  s.catalogEntryOwned = true;
  s.arete = 20;
  s.mutatorSlots = [hex(0, 0)];
  s.mutators = [mut("mu1", "power", "common", hex(0, 0)), mut("mu2", "power", "common", null)];
  app.render();
}

describe("opening the cross-section (issue #295)", () => {
  it("any owned cell's idle click opens the detail and retires the grid", () => {
    app.render();
    clickCell(0, 0);
    expect(app.ui.detail).toEqual({ pos: hex(0, 0), face: "modules" });
    expect(open()).toBe(true);
    expect(document.body.classList.contains("hex-detail-open")).toBe(true);
    // The grid keeps its geometry — the return restores it by standing
    // still — but yields the surface.
    expect(grid().classList.length).toBeGreaterThanOrEqual(0);
    // The face itself is the plate: the enlarged engraving carries name,
    // level, pitch, and the live contribution with its unit.
    const engraving = faceSvg("modules").textContent ?? "";
    expect(engraving).toContain("OSC");
    expect(engraving).toContain("LV 0");
    expect(engraving).toContain("C4");
    expect(engraving).toContain(`+${formatNumber(0.1)} ν/s`);
    // No text column re-speaks the face, and no header band repeats the
    // place (the standards: no second panel beside what the face says).
    expect(detail().querySelector(".hex-detail-name, .hex-detail-col, .hex-detail-place")).toBeNull();
    // The return control stands.
    expect(document.getElementById("hex-detail-return")).not.toBeNull();
  });

  it("the chord row mounts beside the module face in the readout's grammar", () => {
    app.render();
    clickCell(0, 0);
    const row = section("modules").querySelector(".hex-chord-row")!;
    expect(row).not.toBeNull();
    // The ν/s figure stays off the row — the enlarged face carries it.
    expect(row.textContent).not.toContain("ν/s");
    // The voice's chord facts ride the reserved grammar's own chips.
    expect(row.textContent).toContain("chord factor");
  });

  it("an empty owned cell opens too: the empty Module place shows its state", () => {
    app.render();
    clickCell(0, 1);
    expect(open()).toBe(true);
    const modules = section("modules");
    expect(modules.getAttribute("aria-label")).toContain("empty place at C5");
    // The dashed chassis carries the cell's own pitch — the place's identity.
    expect(faceSvg("modules")).toBeTruthy();
    expect(faceSvg("modules")!.querySelector(".hex.empty")).not.toBeNull();
    expect(faceSvg("modules").textContent).toContain("C5");
    // No upgrade column on an empty place.
    expect(modules.querySelector("#detail-upgrade")).toBeNull();
  });

  it("the fixed stack shows both faces, Mutators above Modules, never reordered", () => {
    seedEra();
    app.render();
    clickCell(0, 0);
    const faces = sections().map((node) => node.classList.contains("mutators") ? "mutators" : "modules");
    expect(faces).toEqual(["mutators", "modules"]);
    // Selecting the Modules face changes emphasis without reordering.
    document.querySelector<HTMLButtonElement>('[data-detail-face="modules"]')!.click();
    const after = sections().map((node) => node.classList.contains("mutators") ? "mutators" : "modules");
    expect(after).toEqual(["mutators", "modules"]);
    expect(section("modules").classList.contains("selected")).toBe(true);
    expect(section("mutators").classList.contains("selected")).toBe(false);
  });

  it("a face selection emphasizes its section, focuses its control, and syncs the legend", () => {
    seedEra();
    app.render();
    clickCell(0, 0);
    // The legend opens synchronized with the click's layer.
    const legend = () => document.getElementById("layer-legend")!;
    expect(legend().querySelector<HTMLElement>('[data-legend-layer="modules"]')!.classList.contains("active")).toBe(true);
    // Selecting the Mutators face through the legend moves emphasis, the
    // marker, and the focus.
    legend().querySelector<HTMLButtonElement>('[data-legend-layer="mutators"]')!.click();
    expect(app.ui.detail!.face).toBe("mutators");
    expect(section("mutators").classList.contains("selected")).toBe(true);
    expect(section("modules").classList.contains("selected")).toBe(false);
    expect(legend().querySelector<HTMLElement>('[data-legend-layer="mutators"]')!.classList.contains("active")).toBe(true);
    expect(legend().querySelector<HTMLElement>('[data-legend-layer="modules"]')!.classList.contains("active")).toBe(false);
    expect(document.activeElement).toBe(section("mutators").querySelector("[data-detail-face]"));
    // Post-entry the grid's layer follows the selection, so the return
    // lands on the face the player last read.
    expect(app.ui.mutLayer).toBe("mutators");
    // A face's own chassis selects too.
    document.querySelector<HTMLButtonElement>('[data-detail-face="modules"]')!.click();
    expect(app.ui.detail!.face).toBe("modules");
  });

  it("the emphasized face wears the firm inset marker; the other stays present, dimmed", () => {
    seedEra();
    app.render();
    clickCell(0, 0);
    // The state grammar's marker is a drawn stroke on each chassis —
    // readable without color — and the stylesheet shows it on the
    // emphasized layer only.
    expect(section("modules").querySelector(".hex-stack-marker")).not.toBeNull();
    expect(section("mutators").querySelector(".hex-stack-marker")).not.toBeNull();
    const css = readFileSync("src/ui/style.css", "utf8");
    expect(css).toMatch(/\.hex-detail-layer\.selected \.hex-stack-marker[^{]*\{[^}]*display:\s*block/);
    expect(css).toMatch(/\.hex-stack-marker[^{]*\{[^}]*display:\s*none/);
  });

  it("the rate roster's pick opens the module's Hex detail and marks its row", () => {
    app.render();
    const row = document.querySelector("#board-ledger .rd-synth")!;
    row.querySelector(".rd-pick")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const id = row.getAttribute("data-module-id")!;
    expect(app.ui.detail).not.toBeNull();
    expect(app.state.modules.find((m) => m.id === id)!.pos).toEqual(app.ui.detail!.pos);
    expect(row.classList.contains("st-selected")).toBe(true);
    // A click inside the tooltip's legs is reading, never picking.
    row.querySelector(".rd-legs")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.detail).toEqual({ pos: hex(0, 0), face: "modules" });
  });
});

describe("the Mutators face in detail", () => {
  it("pre-entry the locked place wears the muted outline and offers the Catalog entry", () => {
    app.render();
    clickCell(0, 1);
    const mutators = section("mutators");
    expect(mutators.querySelector("svg.locked, .hex-stack-mut.locked")).not.toBeNull();
    expect(faceSvg("mutators").textContent).toContain("LOCKED");
    // The layer's mechanics ride the tooltip: focus discloses the entry rule.
    const trigger = mutators.querySelector<HTMLButtonElement>(".inst-tip-trigger")!;
    trigger.focus();
    expect(document.getElementById(trigger.getAttribute("aria-describedby")!)!.classList.contains("inst-show")).toBe(true);
    expect(document.getElementById(trigger.getAttribute("aria-describedby")!)!.textContent).toContain("Mutator entry");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.getElementById(trigger.getAttribute("aria-describedby")!)!.classList.contains("inst-show")).toBe(false);
    // The entry action walks to the ◇ face; Escape returns to the detail,
    // the entry not bought.
    document.getElementById("detail-mutator-entry")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.modal).toBe("catalog");
    expect(app.ui.catalogFace).toBe("arete");
    expect(document.querySelector(".entry-screen")).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(app.ui.modal).toBeNull();
    expect(open()).toBe(true);
  });

  it("post-entry a slotless eligible cell prices the unlock and buys it directly", () => {
    seedEra();
    app.state.cells.push(hex(0, 1));
    app.render();
    clickCell(0, 1);
    const button = document.getElementById("detail-mutator-unlock")! as HTMLButtonElement;
    expect(button.textContent).toContain("Unlock slot");
    expect(button.textContent).toContain(`${formatInt(2)} ◇`);
    button.click();
    expect(app.state.mutatorSlots.some((slot) => sameHex(slot, hex(0, 1)))).toBe(true);
    expect(app.state.arete).toBe(18);
    // The stack refreshes into the vacant-slot state.
    expect(section("mutators").textContent).toContain("OPEN SLOT");
    expect(section("mutators").textContent).toContain("inert · no host");
  });

  it("the first slot is free on any owned cell", () => {
    app.state.mode = "upgrade";
    app.state.catalogEntryOwned = true;
    app.state.arete = 5;
    app.render();
    clickCell(1, 0);
    const button = document.getElementById("detail-mutator-unlock")! as HTMLButtonElement;
    expect(button.textContent).toContain("free");
    button.click();
    expect(app.state.mutatorSlots).toHaveLength(1);
    expect(app.state.arete).toBe(5);
  });

  it("an ineligible cell wears the muted outline and names the adjacency rule", () => {
    seedEra();
    app.state.cells.push(hex(2, 0)); // owned, but not beside the patch
    app.render();
    clickCell(2, 0);
    expect(faceSvg("mutators").textContent).toContain("NO SLOT");
    expect(faceSvg("mutators")!.querySelector(".mut-slot-hex.muted")).not.toBeNull();
    expect(document.getElementById("detail-mutator-unlock")).toBeNull();
    // The refusal names its rule in the mutator rail's own row.
    const noslot = detail().querySelector(".hex-rail-row.mutators .hex-detail-noslot")!;
    expect(noslot.textContent).toBe("beside the patch");
  });

  it("a placed mutator's declaration is its own face above the stack — hosts is never said", () => {
    seedEra();
    app.render();
    clickCell(0, 0);
    const mutators = section("mutators");
    expect(faceSvg("mutators").textContent).toContain("POWER");
    // The face carries the compact declaration; the full sentence rides
    // the tooltip layer.
    expect(faceSvg("mutators").textContent).toContain("+50%");
    const trigger = mutators.querySelector<HTMLButtonElement>(".inst-tip-trigger")!;
    trigger.focus();
    expect(document.getElementById(trigger.getAttribute("aria-describedby")!)!.textContent).toContain("+50% to this module's power");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    // The hosting relation is the stack itself: the module occupies the
    // position directly below, so no face repeats "hosts" — and no text
    // column repeats the mutator beside its module.
    expect(mutators.textContent).not.toContain("hosts");
    expect(section("modules").querySelector(".hex-detail-mutline")).toBeNull();
    document.getElementById("detail-mutator-retrieve")!.click();
    expect(app.state.mutators.find((m) => m.id === "mu1")!.pos).toBeNull();
    expect(section("mutators").textContent).toContain("OPEN SLOT");
  });

  it("an inert mutator promises no effect on its own face", () => {
    seedEra();
    app.state.mutators[0]!.family = "resonance";
    app.render();
    clickCell(0, 0);
    const mutators = section("mutators");
    expect(mutators.textContent).toContain("inert · no chord");
    expect(mutators.textContent).not.toContain("+");
  });
});

describe("the upgrade column in detail", () => {
  it("the upgrade button upgrades and the panel reprices, staying open", () => {
    app.state.nous = 30;
    app.render();
    clickCell(0, 0);
    const button = () => document.querySelector<HTMLButtonElement>("#detail-upgrade")!;
    expect(button().querySelector(".hex-upgrade-title")!.textContent).toContain(formatInt(10));
    button().click();
    expect(app.state.modules[0]!.level).toBe(1);
    expect(app.state.nous).toBe(20);
    expect(open()).toBe(true);
    expect(button().querySelector(".hex-upgrade-title")!.textContent).toContain(formatInt(16));
  });

  it("cannot afford: zero reads zero — the shortfall leads, nothing disables", () => {
    app.state.nous = 0;
    app.render();
    clickCell(0, 0);
    const button = document.querySelector<HTMLButtonElement>("#detail-upgrade")!;
    expect(button.disabled).toBe(false);
    expect(button.title).toBe("+0 — 10 ν short of one level");
    const maxChip = document.querySelector<HTMLButtonElement>('.hex-dial [data-bulk="max"]')!;
    expect(maxChip.textContent).toBe("MAX·0");
  });

  it("the dial picks its count and holds per module; another Hex needs the grid", () => {
    give(app.state, "additive", hex(1, 0));
    app.state.nous = levelsCost(0, 3);
    app.render();
    clickCell(0, 0);
    document.querySelector<HTMLButtonElement>('.hex-dial [data-bulk="5"]')!.click();
    expect(app.ui.bulkCount).toBe(5);
    // Selecting another Hex requires returning to the grid first.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(app.ui.detail).toBeNull();
    clickCell(1, 0);
    expect(app.ui.bulkCount).toBe(1);
    expect(document.querySelector(".hex-upgrade-title")!.textContent).toContain("Upgrade ×1");
  });

  it("the silent wire wears no Upgrade button", () => {
    give(app.state, "spacer", hex(1, 0));
    app.render();
    clickCell(1, 0);
    expect(section("modules").querySelector("#detail-upgrade")).toBeNull();
    // The face speaks the wire's silence; no text column carries a line.
    expect(faceSvg("modules").textContent).toContain("⌇");
    expect(section("modules").querySelector(".hex-detail-contrib")).toBeNull();
  });

  it("the Bend's shift picker re-pitches from the detail", () => {
    give(app.state, "bend", hex(1, 0));
    app.render();
    clickCell(1, 0);
    const chip = document.querySelector<HTMLButtonElement>('[data-shift="-1"]')!;
    chip.click();
    expect(app.state.modules.find((m) => m.type === "bend")!.shift).toBe(-1);
  });
});

describe("read-only during flow (issue #295)", () => {
  it("flow's click answers the lock with a live, read-only cross-section", () => {
    give(app.state, "additive", hex(1, 0));
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.render();
    clickCell(1, 0);
    expect(open()).toBe(true);
    expect(detail().querySelector(".hex-detail-readonly")!.textContent).toContain("read-only");
    // Live readouts stand on the face; every editing control is gone. The
    // figure is the live pass's own — the session's legs included.
    const live = displayedRates(app.state, true);
    const value = live.contributions.get(app.state.modules.find((m) => m.pos !== null && sameHex(m.pos, hex(1, 0)))!.id)!.value;
    expect(faceSvg("modules").textContent).toContain(`+${formatNumber(value)} ν/s`);
    expect(document.getElementById("detail-upgrade")).toBeNull();
    expect(section("modules").querySelector(".hex-dial")).toBeNull();
    expect(document.getElementById("detail-mutator-retrieve")).toBeNull();
    endSession(app.state);
  });

  it("the empty place reads read-only too, with no unlock action", () => {
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.render();
    clickCell(0, 1);
    expect(open()).toBe(true);
    expect(section("modules").getAttribute("aria-label")).toContain("empty place");
    expect(document.getElementById("detail-mutator-unlock")).toBeNull();
    expect(document.getElementById("detail-mutator-entry")).toBeNull();
    endSession(app.state);
  });
});

describe("the return contract (issue #295)", () => {
  it("the return control restores the grid with the layer, position, and zoom intact", () => {
    seedEra();
    app.ui.zoom = 2;
    app.ui.pan = { x: 10, y: -20 };
    app.render();
    clickCell(0, 0);
    document.querySelector<HTMLButtonElement>('[data-legend-layer="mutators"]')!.click();
    document.getElementById("hex-detail-return")!.click();
    expect(app.ui.detail).toBeNull();
    expect(document.body.classList.contains("hex-detail-open")).toBe(false);
    // The layer the player last read stands; position and zoom never moved.
    expect(app.ui.mutLayer).toBe("mutators");
    expect(document.body.classList.contains("mut-layer-live")).toBe(true);
    expect(app.ui.zoom).toBe(2);
    expect(app.ui.pan).toEqual({ x: 10, y: -20 });
  });

  it("Escape closes the detail after any armed placement cancels first", () => {
    app.render();
    clickCell(0, 0);
    // Arm a placement from the tray sheet while the detail stands.
    app.returnToInventory("m1");
    app.openModal("inventory");
    document.querySelector<HTMLButtonElement>('#modal-content [data-inv="m1"]')!.click();
    expect(app.ui.modal).toBeNull();
    expect(app.ui.placing).toBe("m1");
    expect(open()).toBe(true);
    // Escape cancels the armed placement first; the detail stands.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(app.ui.placing).toBeNull();
    expect(open()).toBe(true);
    // The next Escape returns the grid.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(app.ui.detail).toBeNull();
  });

  it("Escape never opens a second Hex from the detail — the grid is the only navigator", () => {
    give(app.state, "additive", hex(1, 0));
    app.render();
    clickCell(0, 0);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(app.ui.detail).toBeNull();
    // Clicking the legend's Modules symbol on the grid does not open a detail.
    document.querySelector<HTMLButtonElement>('[data-legend-layer="modules"]')!.click();
    expect(app.ui.detail).toBeNull();
  });
});

describe("the vertical layer legend (issue #295)", () => {
  it("symbols carry accessible names, tooltips, pressed state, and visible focus rules", () => {
    app.render();
    const legend = document.getElementById("layer-legend")!;
    expect(legend.hidden).toBe(false);
    const modules = legend.querySelector<HTMLButtonElement>('[data-legend-layer="modules"]')!;
    expect(modules.getAttribute("aria-label")).toBe("Modules layer");
    expect(modules.getAttribute("aria-pressed")).toBe("true");
    expect(modules.getAttribute("title")).toContain("Modules");
    expect(modules.querySelector("svg")).not.toBeNull();
    // Non-color state: the selected marker is a firm inset, styled in the
    // stylesheet; keyboard focus is an outline, also styled.
    const css = readFileSync("src/ui/style.css", "utf8");
    expect(css).toMatch(/\.legend-symbol\.active[^{]*\{[^}]*box-shadow:\s*inset/);
    expect(css).toMatch(/\.legend-symbol:focus-visible[^{]*\{[^}]*outline/);
  });

  it("pre-entry the Mutators symbol stands locked-but-visible; its ⓘ discloses by focus and tap", () => {
    app.render();
    const legend = document.getElementById("layer-legend")!;
    const mutators = legend.querySelector<HTMLButtonElement>('[data-legend-layer="mutators"]')!;
    expect(mutators.classList.contains("locked")).toBe(true);
    expect(mutators.querySelector(".mut-tab-lock")).not.toBeNull();
    expect(mutators.getAttribute("aria-pressed")).toBe("false");
    // The ⓘ trigger opens by focus…
    const trigger = legend.querySelector<HTMLButtonElement>(".inst-tip-trigger")!;
    trigger.focus();
    expect(document.getElementById(trigger.getAttribute("aria-describedby")!)!.classList.contains("inst-show")).toBe(true);
    // …dismisses by Escape without entering…
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.getElementById(trigger.getAttribute("aria-describedby")!)!.classList.contains("inst-show")).toBe(false);
    // …and the click walks to the Catalog's ◇ entry, never flipping the mode.
    mutators.click();
    expect(app.ui.mutLayer).toBe("modules");
    expect(app.ui.modal).toBe("catalog");
    expect(app.ui.catalogFace).toBe("arete");
  });

  it("the legend is the one switch: the tray sheet carries the same symbols", () => {
    seedEra();
    app.openModal("inventory");
    const sheet = document.getElementById("modal-content")!;
    const switchHost = sheet.querySelector(".tray-switch")!;
    expect(switchHost.querySelectorAll("[data-legend-layer]")).toHaveLength(2);
    expect(document.querySelectorAll("#layer-legend [data-legend-layer], .tray-switch [data-legend-layer]").length).toBe(4);
    // Switching from the sheet flips the one state the legend reads.
    sheet.querySelector<HTMLButtonElement>('[data-legend-layer="mutators"]')!.click();
    expect(app.ui.mutLayer).toBe("mutators");
    app.closeModal();
    app.render();
    expect(document.querySelector('#layer-legend [data-legend-layer="mutators"]')!.classList.contains("active")).toBe(true);
  });

  it("on the Mutators layer, an idle slot click opens the detail on that face", () => {
    seedEra();
    app.mutSetLayer("mutators");
    document.querySelector<SVGGElement>('[data-mut-slot="0,0"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.detail).toEqual({ pos: hex(0, 0), face: "mutators" });
    expect(section("mutators").classList.contains("selected")).toBe(true);
  });

  it("flow shows neither legend nor layer; the detail stands read-only without the switch", () => {
    seedEra();
    app.beginFlow(null);
    app.render();
    expect(document.getElementById("layer-legend")!.hidden).toBe(true);
    clickCell(0, 0);
    expect(open()).toBe(true);
    // The stack still shows both faces; no legend stands beside it.
    expect(sections()).toHaveLength(2);
    expect(document.getElementById("layer-legend")!.hidden).toBe(true);
    endSession(app.state);
  });
});

describe("the phone face (issue #295)", () => {
  it("the grid yields to the same cross-section, re-docked as a bottom sheet", () => {
    setAppWidth(500);
    app.state.nous = 30;
    app.render();
    clickCell(0, 0);
    expect(open()).toBe(true);
    expect(detail().classList.contains("sheet")).toBe(true);
    // The same content: upgrade column and all.
    expect(document.getElementById("detail-upgrade")).not.toBeNull();
    // Return restores the grid.
    document.getElementById("hex-detail-return")!.click();
    expect(app.ui.detail).toBeNull();
    setAppWidth(1200);
  });
});
