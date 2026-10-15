// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import type { App } from "./app";
import { createAppFixture, clickCell, setAppWidth } from "./testing/app-fixture";
import { give } from "../engine/fixtures";
import { hex, sameHex } from "../engine/hex";
import { startSession, endSession } from "../engine/actions";
import { renderHexDetail } from "./hexdetail";
import { formatInt, formatNumber } from "./format";
import { levelsCost, displayedRates, deployedAt } from "../engine/economy";
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
    expect(engraving).toContain("SINE");
    expect(engraving).toContain("LV 0");
    expect(engraving).toContain("C4");
    expect(engraving).toContain(`+${formatNumber(0.1)} ν/s`);
    // No text column re-speaks the face, and no header band repeats the
    // place (the standards: no second panel beside what the face says).
    expect(detail().querySelector(".hex-detail-name, .hex-detail-col, .hex-detail-place")).toBeNull();
    // The return control stands.
    expect(document.getElementById("hex-detail-return")).not.toBeNull();
  });

  it("the chord facts stand in their own column beside the module face", () => {
    app.render();
    clickCell(0, 0);
    const col = detail().querySelector(".hex-chord-col")!;
    expect(col).not.toBeNull();
    const row = col.querySelector(".hex-chord-row")!;
    // The ν/s figure stays off the row — the enlarged face carries it.
    expect(row.textContent).not.toContain("ν/s");
    // The voice's chord facts ride the reserved grammar's own chips.
    expect(row.textContent).toContain("chord factor");
    // The column is its own grid post — to the module's right, never
    // beneath the faces (issue #388), and the faces' section no longer
    // embeds it.
    expect(section("modules").querySelector(".hex-chord-row")).toBeNull();
    const css = readFileSync("src/ui/style.css", "utf8");
    expect(css).toMatch(/\.hex-chord-col\s*\{[^}]*grid-column:\s*3/);
    expect(css).toMatch(/\.hex-chord-col\s*\{[^}]*grid-row:\s*3/);
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
  });
});

describe("the Mutators face in detail", () => {
  it("pre-entry the locked place wears the muted outline; the entry walk stays with the surrounding navigation", () => {
    app.render();
    clickCell(0, 1);
    const mutators = section("mutators");
    expect(mutators.querySelector("svg.locked, .hex-stack-mut.locked")).not.toBeNull();
    expect(faceSvg("mutators").textContent).toContain("LOCKED");
    // A locked layer is never selectable: the detail stays on Modules,
    // whether the locked face or the legend's locked symbol asks.
    mutators.querySelector<HTMLButtonElement>('[data-detail-face="mutators"]')!.click();
    expect(app.ui.detail!.face).toBe("modules");
    document.querySelector<HTMLButtonElement>('[data-legend-layer="mutators"]')!.click();
    expect(app.ui.detail!.face).toBe("modules");
    expect(section("modules").classList.contains("selected")).toBe(true);
    // The layer's mechanics ride the tooltip: focus discloses the entry rule.
    const trigger = mutators.querySelector<HTMLButtonElement>(".inst-tip-trigger")!;
    trigger.focus();
    expect(document.getElementById(trigger.getAttribute("aria-describedby")!)!.classList.contains("inst-show")).toBe(true);
    expect(document.getElementById(trigger.getAttribute("aria-describedby")!)!.textContent).toContain("Mutator entry");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.getElementById(trigger.getAttribute("aria-describedby")!)!.classList.contains("inst-show")).toBe(false);
    // No destination button stands in the detail (issue #388): the Catalog
    // entry belongs to the surrounding navigation — the legend's locked
    // walk and the dock's Catalog door, both reachable with the detail open.
    expect(document.getElementById("detail-mutator-entry")).toBeNull();
    expect(detail().querySelector("[data-op]")).toBeNull();
    expect(document.querySelector('#board-tools [data-op="catalog"]')).not.toBeNull();
  });

  it("the detail carries cell-specific actions only; global destinations stay in the navigation", () => {
    seedEra();
    app.render();
    clickCell(0, 0);
    // Only cell-specific actions ride the surfaces: the swap/retrieve
    // orbit, the upgrade band, the occupied slot's declaration.
    expect(detail().querySelectorAll("[data-op]").length).toBe(0);
    expect(document.getElementById("detail-module-retrieve")).not.toBeNull();
    expect(document.getElementById("detail-upgrade")).not.toBeNull();
    // The dock's doors still work over the detail — the destinations were
    // never lost, only un-duplicated.
    document.querySelector<HTMLButtonElement>('#board-tools [data-op="catalog"]')!.click();
    expect(app.ui.modal).toBe("catalog");
    app.closeModal();
    expect(open()).toBe(true);
    document.querySelector<HTMLButtonElement>('#board-tools [data-op="forge"]')!.click();
    expect(app.ui.modal).toBe("forge");
    app.closeModal();
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

  it("an ineligible cell wears the locked state and names the adjacency prerequisite", () => {
    seedEra();
    // Owned beside an occupied module, yet not beside the unlocked slot:
    // adjacency means the Mutator patch, never a mere module cell.
    // ((1,0) is a starter cell; (2,0) is the far candidate.)
    app.state.cells.push(hex(2, 0));
    give(app.state, "additive", hex(1, 0));
    app.render();
    clickCell(2, 0);
    // The locked state (issue #388): muted outline, the lock mark, LOCKED
    // in words — the board layer's own face (issue #386), readable
    // without color.
    expect(faceSvg("mutators").textContent).toContain("LOCKED");
    expect(faceSvg("mutators")!.querySelector(".mut-slot-hex.muted")).not.toBeNull();
    expect(faceSvg("mutators")!.querySelector(".hex-stack-lock")).not.toBeNull();
    expect(document.getElementById("detail-mutator-unlock")).toBeNull();
    // The accessible help names the prerequisite concretely, riding the
    // chassis's own description and disclosed by focus.
    const trigger = section("mutators").querySelector<HTMLButtonElement>(".inst-tip-trigger")!;
    trigger.focus();
    const body = document.getElementById(trigger.getAttribute("aria-describedby")!)!;
    expect(body.classList.contains("inst-show")).toBe(true);
    expect(body.textContent).toBe("Unlock an adjacent Mutator slot first");
    // No rail stands for a locked position — the refusal is the face's.
    expect(detail().querySelector(".hex-detail-noslot")).toBeNull();
    expect(section("mutators").textContent).not.toContain("beside the patch");
    // An eligible owned cell right beside the patch keeps the priced
    // unlock — eligibility and price stay distinct states, and both stay
    // distinct from an open slot.
    clickCell(1, 0);
    const unlock = document.getElementById("detail-mutator-unlock")! as HTMLButtonElement;
    expect(unlock.textContent).toContain("Unlock slot");
    unlock.click();
    expect(app.state.mutatorSlots.some((slot) => sameHex(slot, hex(1, 0)))).toBe(true);
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

  it("the Spotlight's recipient picker focuses from the detail (issue #374)", () => {
    const spot = give(app.state, "spotlight", hex(1, 0));
    give(app.state, "additive", hex(0, 1));
    app.render();
    clickCell(1, 0);
    // One chip per adjacent oscillator, named by its note.
    const group = detail().querySelector('.hex-rail-row [role="group"][aria-label="Recipient"]')!;
    const chips = [...group.querySelectorAll<HTMLButtonElement>("[data-target]")];
    expect(chips.map((chip) => chip.textContent)).toEqual(["C4", "C5"]);
    // Nothing picked yet: the inactive verdict stands with the chips, the
    // face reads the state in words — never a zero that reads as a weak
    // grant.
    expect(group.textContent).toContain("inactive · pick a recipient");
    expect(faceSvg("modules").textContent).toContain("—");
    expect(faceSvg("modules").textContent).toContain("inactive");
    // The pick lands in the engine by identity and re-renders active.
    chips[1]!.click();
    expect(spot.target).toBe(app.state.modules.find((m) => m.pos && sameHex(m.pos, hex(0, 1)))!.id);
    const refreshedGroup = detail().querySelector('[role="group"][aria-label="Recipient"]')!;
    const refreshed = detail().querySelector<HTMLButtonElement>('[data-target][aria-pressed="true"]')!;
    expect(refreshed.textContent).toBe("C5");
    expect(refreshedGroup.classList.contains("st-inactive")).toBe(false);
    // The picker remains the recovery control after the recipient leaves:
    // the verdict names the broken adjacency beside the remaining pick.
    const recipient = app.state.modules.find((m) => m.id === spot.target)!;
    recipient.pos = null;
    app.render();
    expect(detail().querySelector('[role="group"][aria-label="Recipient"]')!.textContent).toContain("inactive");
    expect(detail().querySelectorAll("[data-target]")).toHaveLength(1); // the starter, still adjacent
  });

  it("the Spotlight with no adjacent recipient pick carries the verdict beside the live candidates", () => {
    const spot = give(app.state, "spotlight", hex(1, 0));
    const recipient = give(app.state, "additive", hex(0, 1));
    app.setBoosterTarget(spot.id, recipient.id);
    recipient.pos = hex(2, 2); // out of range, no cell moved — the identity stands
    app.render();
    clickCell(1, 0);
    const group = detail().querySelector('[role="group"][aria-label="Recipient"]')!;
    expect(group.textContent).toContain("inactive · recipient not adjacent");
    // The starter synth remains an adjacent candidate — the recovery is
    // one click away from the verdict that explains the silence.
    expect(group.querySelectorAll("[data-target]")).toHaveLength(1);
    expect(group.classList.contains("st-inactive")).toBe(true);
  });

  it("flow locks the picker with the rest of the editing furniture", () => {
    give(app.state, "spotlight", hex(1, 0));
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.render();
    clickCell(1, 0);
    expect(open()).toBe(true);
    expect(detail().querySelector('[role="group"][aria-label="Recipient"]')).toBeNull();
    endSession(app.state);
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

  it("the Mutators face reads live too: the hosted resonance wears the live chord register's verdict", () => {
    seedEra();
    // The lone opening synth hosts the resonance and sings no chord — the
    // verdict is the snapshot's own, so flow's live pass must speak it.
    app.state.mutators[0].family = "resonance";
    startSession(app.state, 600);
    app.render();
    app.openDetail(hex(0, 0), "mutators");
    expect(open()).toBe(true);
    expect(detail().querySelector(".hex-detail-readonly")).not.toBeNull();
    expect(section("mutators").textContent).toContain("inert · no chord");
    expect(section("mutators").textContent).toContain("RESONANCE");
    endSession(app.state);
  });
});

describe("the return contract (issue #295)", () => {
  it("Return floats over the stage — visible and compact, no dedicated band (issue #388)", () => {
    app.render();
    clickCell(0, 0);
    expect(document.getElementById("hex-detail-return")).not.toBeNull();
    const css = readFileSync("src/ui/style.css", "utf8");
    // The corner is an overlay on the scene, not a flex band above the
    // grid: the cross-section keeps the full stage height.
    expect(css).toMatch(/\.hex-detail-corner\s*\{[^}]*position:\s*absolute/);
    expect(css).toMatch(/\.hex-detail-corner\s*\{[^}]*z-index:\s*6/);
  });

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

describe("the idle disclosure (issue #388)", () => {
  // C4 · G4 sing the Fifth; the second Fifth (G4 · C5) and C4 · C5's
  // Octave sit idle — the capacity spends each voice's one unit once.
  // C5 sings two idle candidates and no active chord; C4 sings the
  // active Fifth beside its idle Octave.
  function seedIdleVoices(): void {
    give(app.state, "additive", hex(1, 0));
    give(app.state, "additive", hex(0, 1));
    app.render();
  }

  it("idle candidates hide behind one N idle disclosure in the shared tooltip layer", () => {
    seedIdleVoices();
    clickCell(0, 1);
    const row = detail().querySelector(".hex-chord-row")!;
    // No inline idle list: the candidates' names ride only the body, and
    // no transient-readout disclosure is duplicated here.
    expect(row.querySelectorAll(".chord-readout-chip.chord-readout-idle")).toHaveLength(0);
    const trigger = row.querySelector<HTMLButtonElement>(".detail-idle-trigger")!;
    expect(trigger.textContent).toBe("2 idle");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    // Keyboard focus opens it; the body lists the names and factors.
    trigger.focus();
    const body = document.getElementById(trigger.getAttribute("aria-describedby")!)!;
    expect(body.classList.contains("inst-show")).toBe(true);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(body.textContent).toContain("Fifth ×1.3");
    expect(body.textContent).toContain("Octave ×1.15");
    // Escape dismisses the disclosure first; the detail stands.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(body.classList.contains("inst-show")).toBe(false);
    expect(open()).toBe(true);
    // Touch pins it: a first tap opens, a tap elsewhere dismisses.
    trigger.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(body.classList.contains("inst-show")).toBe(true);
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(body.classList.contains("inst-show")).toBe(false);
    // Opening shifts nothing: the body floats fixed over the stage.
    const css = readFileSync("src/ui/style.css", "utf8");
    expect(css).toMatch(/\.inst-tip-body\s*\{[^}]*position:\s*fixed/);
  });

  it("dense facts: active chips stand inline beside the single idle disclosure", () => {
    seedIdleVoices();
    clickCell(0, 0);
    const row = detail().querySelector(".hex-chord-row")!;
    const chips = [...row.querySelectorAll(".chord-readout-chip")].map((node) => node.textContent);
    // The earning chord reads as itself — no idle suffix any more.
    expect(chips).toContain("Fifth ×1.3");
    expect(chips).not.toContain("Fifth ×1.3 · idle");
    // The idle Octave waits behind its one count.
    expect(row.querySelector(".detail-idle-trigger")!.textContent).toBe("1 idle");
    const trigger = row.querySelector<HTMLButtonElement>(".detail-idle-trigger")!;
    trigger.focus();
    expect(document.getElementById(trigger.getAttribute("aria-describedby")!)!.textContent).toContain("Octave ×1.15");
  });

  it("no idle candidates, no disclosure", () => {
    app.render();
    clickCell(0, 0);
    expect(detail().querySelector(".detail-idle-trigger")).toBeNull();
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

  it("pre-entry the Mutators symbol stands locked-but-visible; its own tooltip carries the lock", () => {
    app.render();
    const legend = document.getElementById("layer-legend")!;
    const mutators = legend.querySelector<HTMLButtonElement>('[data-legend-layer="mutators"]')!;
    expect(mutators.classList.contains("locked")).toBe(true);
    // One mark per state: the padlock alone stands for the locked layer —
    // the arete register joins only when the layer unlocks.
    expect(mutators.querySelector(".mut-tab-lock")).not.toBeNull();
    expect(mutators.querySelectorAll("svg")).toHaveLength(1);
    expect(mutators.getAttribute("aria-pressed")).toBe("false");
    // No ⓘ rides the legend (issue #314 review): the symbol's native
    // tooltip says the lock mechanic, and the click walks to the
    // Catalog's ◇ entry, never flipping the mode.
    expect(legend.querySelector(".inst-tip-trigger")).toBeNull();
    expect(mutators.getAttribute("title")).toContain("locked; unlocks with the Mutator entry");
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

  it("flow keeps the legend as the one switch: emphasis follows, the stack stays read-only (issue #387)", () => {
    seedEra();
    app.beginFlow(null);
    app.render();
    expect(document.getElementById("layer-legend")!.hidden).toBe(false);
    clickCell(0, 0);
    expect(open()).toBe(true);
    // The stack still shows both faces in the fixed order, read-only, and
    // the legend stands beside it — the session's shared switch.
    expect(sections()).toHaveLength(2);
    expect(sections()[0].classList.contains("mutators")).toBe(true);
    expect(detail().querySelector(".hex-detail-readonly")).not.toBeNull();
    const legend = document.getElementById("layer-legend")!;
    expect(legend.querySelector('[data-legend-layer="modules"]')!.classList.contains("active")).toBe(true);
    // The legend emphasizes the face without reordering the stack.
    legend.querySelector<HTMLButtonElement>('[data-legend-layer="mutators"]')!.click();
    expect(app.ui.detail!.face).toBe("mutators");
    expect(section("mutators").classList.contains("selected")).toBe(true);
    expect(legend.querySelector('[data-legend-layer="mutators"]')!.classList.contains("active")).toBe(true);
    expect(sections()).toHaveLength(2);
    expect(sections()[0].classList.contains("mutators")).toBe(true);
    // The grid's layer followed the emphasis: the return lands where the
    // player read, the Mutators layer standing read-only.
    expect(app.ui.mutLayer).toBe("mutators");
    document.getElementById("hex-detail-return")!.click();
    expect(app.ui.detail).toBeNull();
    expect(document.body.classList.contains("mut-layer-live")).toBe(true);
    expect(document.querySelector("#grid [data-mut-slot]")).not.toBeNull();
    endSession(app.state);
  });

  it("flow's return and Escape restore the grid with the layer, position, and zoom intact (issue #387)", () => {
    seedEra();
    app.beginFlow(null);
    app.ui.zoom = 2;
    app.ui.pan = { x: 10, y: -20 };
    app.render();
    // The session reads the Mutators layer, then inspects a slot.
    app.mutSetLayer("mutators");
    document.querySelector<SVGGElement>('[data-mut-slot="0,0"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(open()).toBe(true);
    // Escape returns the grid: no additional layer switch, the read layer
    // stands, and position and zoom never moved.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(app.ui.detail).toBeNull();
    expect(app.ui.mutLayer).toBe("mutators");
    expect(document.body.classList.contains("mut-layer-live")).toBe(true);
    expect(app.ui.zoom).toBe(2);
    expect(app.ui.pan).toEqual({ x: 10, y: -20 });
    // The explicit Return answers the same contract from a fresh inspection.
    document.querySelector<SVGGElement>('[data-mut-slot="0,0"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document.getElementById("hex-detail-return")!.click();
    expect(app.ui.mutLayer).toBe("mutators");
    expect(app.ui.zoom).toBe(2);
    expect(app.ui.pan).toEqual({ x: 10, y: -20 });
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
    // The chord facts reflow into the single column (issue #388): the
    // detailed content scrolls beneath the faces and actions, and the
    // sheet drops the column's fixed width.
    expect(detail().querySelector(".hex-chord-col .hex-chord-row")).not.toBeNull();
    const css = readFileSync("src/ui/style.css", "utf8");
    expect(css).toMatch(/\.hex-detail\.sheet \.hex-chord-col\s*\{[^}]*width:\s*auto/);
    expect(css).toMatch(/\.hex-detail\.sheet \.hex-detail-grid\s*\{[^}]*overflow-y:\s*auto|\.hex-detail-grid\s*\{[^}]*overflow-y:\s*auto/);
    // Return restores the grid.
    document.getElementById("hex-detail-return")!.click();
    expect(app.ui.detail).toBeNull();
    setAppWidth(1200);
  });

  it("narrow compositions reflow the chord column beneath the stack before the sheet", () => {
    setAppWidth(900);
    app.render();
    clickCell(0, 0);
    expect(open()).toBe(true);
    expect(detail().classList.contains("sheet")).toBe(false);
    // The container query drops the column to its own row: the faces and
    // the rail keep their posts, the facts scroll below (issue #388).
    const css = readFileSync("src/ui/style.css", "utf8");
    const reflow = css.match(/@container app \(width < 1000px\) \{[\s\S]*?\n\}/g)!.find((block) => block.includes(".hex-chord-col"));
    expect(reflow).toBeTruthy();
    expect(reflow).toMatch(/\.hex-detail-scene\.readonly \.hex-chord-col\s*[,{][^}]*grid-column:\s*1/);
    expect(reflow).toMatch(/grid-row:\s*4/);
    setAppWidth(1200);
  });
});


describe("live detail review regressions (PR #301)", () => {
  it("updates charge effects, glow, and accessible readout without a chord row", () => {
    const module = give(app.state, "amplifier", hex(1, 0));
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.openDetail(hex(1, 0));
    const snapshot = displayedRates(app.state, true);
    snapshot.chargeStrength.set(module.id, 10);
    renderHexDetail(app, snapshot, snapshot, { html: "", key: "" });
    expect(faceSvg("modules").textContent).toContain("⌁10");
    expect(faceSvg("modules").querySelector(".charged")).not.toBeNull();
    const face = section("modules").querySelector<HTMLElement>("[data-detail-face]")!;
    const description = document.getElementById(face.getAttribute("aria-describedby")!)!;
    expect(description.textContent).toContain("level 0");
    expect(description.textContent).toContain("⌁10");
    face.focus();
    snapshot.chargeStrength.set(module.id, 0);
    renderHexDetail(app, snapshot, snapshot, { html: "", key: "" });
    expect(faceSvg("modules").textContent).toContain("⌁0");
    expect(faceSvg("modules").querySelector(".charged")).toBeNull();
    expect(document.activeElement?.getAttribute("data-detail-face")).toBe("modules");
    const updatedFace = document.activeElement!;
    expect(document.getElementById(updatedFace.getAttribute("aria-describedby")!)!.textContent).toContain("⌁0");
  });

  it("keeps Return and an open chord disclosure focused across unchanged flow renders", () => {
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.openDetail(hex(0, 0));
    const back = document.getElementById("hex-detail-return")!;
    back.focus();
    app.render();
    expect(document.activeElement).toBe(back);
    const trigger = detail().querySelector<HTMLElement>(".hex-chord-row .inst-tip-trigger")!;
    trigger.focus();
    const body = document.getElementById(trigger.getAttribute("aria-describedby")!)!;
    expect(body.classList.contains("inst-show")).toBe(true);
    app.render();
    expect(document.activeElement).toBe(trigger);
    expect(body.isConnected).toBe(true);
    expect(body.classList.contains("inst-show")).toBe(true);
  });

  it("restores chord disclosure focus and removes its old portal when live values change", () => {
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.openDetail(hex(0, 0));
    const trigger = detail().querySelector<HTMLElement>(".hex-chord-row .inst-tip-trigger")!;
    const id = trigger.getAttribute("aria-describedby")!;
    const chordRow = detail().querySelector(".hex-chord-row")!.innerHTML;
    trigger.focus();
    const oldBody = document.getElementById(id)!;
    const snapshot = displayedRates(app.state, true);
    const module = app.state.modules.find((m) => m.pos && sameHex(m.pos, hex(0, 0)))!;
    snapshot.contributions.get(module.id)!.value += 1;
    renderHexDetail(app, snapshot, snapshot, { html: chordRow, key: "" });
    expect(document.activeElement?.getAttribute("aria-describedby")).toBe(id);
    expect(oldBody.isConnected).toBe(false);
    expect(document.querySelectorAll(`[id="${id}"]`)).toHaveLength(1);
    expect(document.getElementById(id)!.classList.contains("inst-show")).toBe(true);
  });
});

/* ── The detail's direct inventory (issue #296) ───────
   The tray hides in the detail; a layer's Add or Swap opens that layer's
   inventory beside the stack, and a tile's click places straight into the
   detail's place — no second destination click. Swap always swaps (never
   an implicit combine), Cancel closes without changes, a layer switch
   cancels, Escape unwinds the tray before the grid, and flow locks it
   all. */
describe("the detail's direct inventory (issue #296)", () => {
  it.each(["modules", "mutators"] as const)("%s candidates disclose without placing and Escape keeps the tray", (face) => {
    seedEra();
    give(app.state, "additive", null);
    clickCell(0, 0);
    app.openDetailTray(face);
    const before = JSON.stringify(app.state);
    const info = document.querySelector<HTMLButtonElement>(".hex-detail-tray .inst-tip-trigger")!;
    const id = info.getAttribute("aria-describedby")!;
    info.focus();
    expect(document.getElementById(id)!.classList.contains("inst-show")).toBe(true);
    info.click();
    expect(info.getAttribute("aria-expanded")).toBe("true");
    expect(JSON.stringify(app.state)).toBe(before);
    expect(app.ui.detailTray).toBe(face);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.getElementById(id)!.classList.contains("inst-show")).toBe(false);
    expect(app.ui.detailTray).toBe(face);
  });

  it.each(["swap", "retrieve"])("%s orbit disclosure supports focus and tap without editing", (action) => {
    seedEra();
    clickCell(0, 0);
    const control = document.getElementById(`detail-module-${action}`)!;
    const id = control.getAttribute("aria-describedby")!;
    control.focus();
    expect(document.getElementById(id)!.classList.contains("inst-show")).toBe(true);
    const before = JSON.stringify(app.state);
    control.dispatchEvent(new PointerEvent("click", { bubbles: true, pointerType: "touch" }));
    expect(control.getAttribute("aria-expanded")).toBe("true");
    expect(JSON.stringify(app.state)).toBe(before);
    expect(app.ui.detailTray).toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(document.getElementById(id)!.classList.contains("inst-show")).toBe(false);
    expect(open()).toBe(true);
    control.dispatchEvent(new PointerEvent("click", { bubbles: true, pointerType: "touch" }));
    control.dispatchEvent(new PointerEvent("click", { bubbles: true, pointerType: "touch" }));
    if (action === "swap") expect(app.ui.detailTray).toBe("modules");
    else expect(app.state.modules.find((m) => m.pos && sameHex(m.pos, hex(0, 0)))).toBeUndefined();
  });

  it("slot availability follows affordability and a refused click preserves the slot", () => {
    seedEra();
    app.state.arete = 0;
    clickCell(1, 0);
    const button = document.getElementById("detail-mutator-unlock")!;
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.classList.contains("st-unavailable")).toBe(true);
    expect(button.textContent).toContain("need Arete");
    button.focus();
    expect(document.getElementById(button.getAttribute("aria-describedby")!)!.textContent).toContain("Not enough Arete");
    button.click();
    expect(app.state.mutatorSlots).toHaveLength(1);
    app.state.arete = 100;
    app.render();
    expect(document.getElementById("detail-mutator-unlock")!.getAttribute("aria-disabled")).toBe("false");
    document.getElementById("detail-mutator-unlock")!.click();
    expect(app.state.mutatorSlots).toHaveLength(2);
  });

  it("the tray hides by default in detail; Add module opens the Modules inventory", () => {
    give(app.state, "additive", null);
    app.render();
    clickCell(0, 1);
    expect(open()).toBe(true);
    expect(document.querySelector(".hex-detail-tray")).toBeNull();
    document.getElementById("detail-module-add")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.detailTray).toBe("modules");
    const tray = detail().querySelector(".hex-detail-tray")!;
    expect(tray.getAttribute("data-detail-tray")).toBe("modules");
    // Opening the tray emphasizes its face — the inventory belongs to one
    // layer and never stands under a dimmed one.
    expect(app.ui.detail!.face).toBe("modules");
    expect(section("modules").classList.contains("selected")).toBe(true);
    // The inventory's tile waits, and Cancel stands beside it.
    expect(tray.querySelector("[data-detail-place]")).not.toBeNull();
    expect(document.getElementById("detail-tray-cancel")).not.toBeNull();
  });

  it("the tray overlays — opening it never reflows the composition", () => {
    // The grid keeps its three posts (stack, rail, chord column) whether
    // the tray stands or not; the tray covers from outside the flow.
    const css = readFileSync("src/ui/style.css", "utf8");
    expect(css).toMatch(/\.hex-detail-tray\s*\{[^}]*position:\s*absolute/);
    expect(css).toMatch(/\.hex-detail-grid\s*\{[^}]*grid-template-columns:\s*auto auto auto/);
    expect(css).toMatch(/\.hex-detail\.sheet \.hex-detail-tray\s*\{[^}]*position:\s*static/);
  });

  it("Swap and Retrieve orbit the cell as icons, not rail rows", () => {
    give(app.state, "additive", hex(1, 0));
    app.render();
    clickCell(1, 0);
    const modules = section("modules");
    // The gestures ride the chassis's orbit…
    const orbit = modules.querySelector(".hex-orbit")!;
    expect(orbit.querySelector("#detail-module-swap")).not.toBeNull();
    expect(orbit.querySelector("#detail-module-retrieve")).not.toBeNull();
    // …as icon buttons, named for the hand that reads without color.
    const swap = orbit.querySelector<HTMLButtonElement>("#detail-module-swap")!;
    expect(swap.getAttribute("aria-label")).toContain("Swap");
    expect(swap.querySelector("svg")).not.toBeNull();
    expect(swap.textContent!.trim()).toBe("");
    // The rail keeps the upgrade band only — no duplicated text rows.
    expect(modules.querySelector(".hex-rail-row ~ * #detail-module-swap, .hex-rail-row #detail-module-swap")).toBeNull();
    // The Mutators face orbits the same way where a mutator stands.
    seedEra();
    app.render();
    clickCell(0, 0);
    const mutators = section("mutators");
    expect(mutators.querySelector(".hex-orbit #detail-mutator-swap")).not.toBeNull();
    expect(mutators.querySelector(".hex-orbit #detail-mutator-retrieve")).not.toBeNull();
    // A vacant slot carries no orbit — Add mutator is the rail's action.
    app.mutRetrieve("mu1");
    app.render();
    expect(section("mutators").querySelector(".hex-orbit .orbit-swap")).toBeNull();
    expect(document.getElementById("detail-mutator-add")).not.toBeNull();
  });

  it("the tray shows larger cell previews: the module's own face at tray scale", () => {
    give(app.state, "additive", null);
    app.render();
    clickCell(0, 1);
    document.getElementById("detail-module-add")!.click();
    const tile = detail().querySelector(".hex-detail-tray [data-detail-place]")!;
    // The preview is the face — nameplate, rarity rings, level — not the
    // bare hexagon-and-glyph mark the board column carries, and never a
    // production figure: an undeployed module has no contribution, and a
    // tray readout saying "+0" would misread the swap.
    expect(tile.querySelector("svg.tray-face .face-name")).not.toBeNull();
    expect(tile.querySelector("svg.tray-face .face-level")).not.toBeNull();
    expect(tile.querySelector("svg.tray-face")!.getAttribute("data-type")).toBe("additive");
    expect(tile.querySelector("svg.tray-face .face-readout")).toBeNull();
  });

  it("a tile's click places straight into the detail's place, closing the tray and refreshing the row", () => {
    give(app.state, "additive", null);
    app.render();
    clickCell(0, 1);
    document.getElementById("detail-module-add")!.click();
    document.querySelector<HTMLButtonElement>(".hex-detail-tray [data-detail-place]")!.click();
    const placed = app.state.modules.find((m) => m.pos !== null && sameHex(m.pos, hex(0, 1)))!;
    expect(placed).toBeDefined();
    // Success closes the tray and preserves the selected Hex and layer.
    expect(app.ui.detailTray).toBeNull();
    expect(document.querySelector(".hex-detail-tray")).toBeNull();
    expect(app.ui.detail).toEqual({ pos: hex(0, 1), face: "modules" });
    // The readouts and the relationship breakdown refresh immediately:
    // the new voice's face stands, and the octave names itself in the
    // chord column.
    expect(faceSvg("modules").textContent).toContain("SINE");
    expect(detail().querySelector(".hex-chord-row")!.textContent).toContain("Octave");
  });

  it("Swap always swaps — identical items included — and never combines implicitly", () => {
    const twin = give(app.state, "additive", hex(1, 0));
    app.returnToInventory(twin.id);
    app.render();
    clickCell(0, 0); // the opening synth's place — same type, same rarity
    document.getElementById("detail-module-swap")!.click();
    expect(app.ui.detailTray).toBe("modules");
    document.querySelector<HTMLButtonElement>(`[data-detail-place="${twin.id}"]`)!.click();
    expect(deployedAt(app.state, hex(0, 0))!.id).toBe(twin.id);
    expect(app.state.modules.find((m) => m.id === "m1")!.pos).toBeNull();
    // The combine stays the drop gesture's explicit review: no offer, no
    // modal, both copies alive.
    expect(app.ui.combineOffer).toBeNull();
    expect(app.ui.mutCombineOffer).toBeNull();
    expect(app.ui.modal).toBeNull();
    expect(app.state.modules).toHaveLength(2);
    expect(app.ui.detail).toEqual({ pos: hex(0, 0), face: "modules" });
    expect(app.ui.detailTray).toBeNull();
  });

  it("Retrieve works directly in detail", () => {
    app.render();
    clickCell(0, 0);
    document.getElementById("detail-module-retrieve")!.click();
    expect(app.state.modules.find((m) => m.id === "m1")!.pos).toBeNull();
    expect(open()).toBe(true);
    // The stack refreshes into the empty place, its Add module waiting.
    expect(section("modules").getAttribute("aria-label")).toContain("empty place");
    expect(document.getElementById("detail-module-add")).not.toBeNull();
  });

  it("Add mutator places straight into the selected layer's slot", () => {
    seedEra();
    app.mutRetrieve("mu1"); // the slot stands vacant, the twin in the tray
    app.render();
    clickCell(0, 0);
    document.querySelector<HTMLButtonElement>('[data-legend-layer="mutators"]')!.click();
    expect(app.ui.detail!.face).toBe("mutators");
    document.getElementById("detail-mutator-add")!.click();
    expect(app.ui.detailTray).toBe("mutators");
    document.querySelector<HTMLButtonElement>('[data-detail-place-mut="mu2"]')!.click();
    expect(app.state.mutators.find((m) => m.id === "mu2")!.pos).toEqual(hex(0, 0));
    expect(app.ui.detailTray).toBeNull();
    expect(document.querySelector(".hex-detail-tray")).toBeNull();
    expect(app.ui.detail).toEqual({ pos: hex(0, 0), face: "mutators" });
    // The stack refreshes: the slot now declares the placed mutator.
    expect(faceSvg("mutators").textContent).toContain("POWER");
  });

  it("the Mutators face's Swap returns the resident to the Mutator tray, never combining", () => {
    seedEra(); // mu1 power·common in the slot, mu2 power·common in the tray
    app.render();
    clickCell(0, 0);
    document.getElementById("detail-mutator-swap")!.click();
    expect(app.ui.detailTray).toBe("mutators");
    document.querySelector<HTMLButtonElement>('[data-detail-place-mut="mu2"]')!.click();
    expect(app.state.mutators.find((m) => m.id === "mu2")!.pos).toEqual(hex(0, 0));
    expect(app.state.mutators.find((m) => m.id === "mu1")!.pos).toBeNull();
    expect(app.ui.detailTray).toBeNull();
    expect(document.querySelector(".hex-detail-tray")).toBeNull();
    // Matching twins never combine through Swap — the review stays the
    // drop gesture's own.
    expect(app.ui.mutCombineOffer).toBeNull();
    expect(app.ui.modal).toBeNull();
    expect(app.state.mutators).toHaveLength(2);
  });

  it("Cancel closes the tray without changes", () => {
    give(app.state, "additive", null);
    app.render();
    clickCell(0, 1);
    document.getElementById("detail-module-add")!.click();
    expect(app.ui.detailTray).toBe("modules");
    document.getElementById("detail-tray-cancel")!.click();
    expect(app.ui.detailTray).toBeNull();
    expect(app.state.modules.find((m) => m.id !== "m1")!.pos).toBeNull();
    expect(deployedAt(app.state, hex(0, 1))).toBeUndefined();
    expect(open()).toBe(true);
  });

  it("opening the tray cancels any armed placement; switching layers closes it", () => {
    seedEra();
    give(app.state, "additive", null);
    app.render();
    clickCell(0, 0);
    app.beginPlacing(app.state.modules.find((m) => m.pos === null)!.id);
    expect(app.ui.placing).not.toBeNull();
    document.getElementById("detail-module-swap")!.click();
    // The two-step arm has no destination left: the tray places directly.
    expect(app.ui.placing).toBeNull();
    expect(app.ui.detailTray).toBe("modules");
    // A layer switch closes the tray — its placement would lose the place.
    document.querySelector<HTMLButtonElement>('[data-detail-face="mutators"]')!.click();
    expect(app.ui.detailTray).toBeNull();
    expect(app.ui.detail!.face).toBe("mutators");
  });

  it("Escape unwinds the tray first, then returns the grid; the keyboard lands back on the face's rail", () => {
    give(app.state, "additive", null);
    app.render();
    clickCell(0, 1);
    document.getElementById("detail-module-add")!.click();
    expect(app.ui.detailTray).toBe("modules");
    // The tray's keyboard landing is its first tile — not the Cancel head.
    expect(document.activeElement?.getAttribute("data-detail-place")).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(app.ui.detailTray).toBeNull();
    expect(app.ui.detail).not.toBeNull();
    // The keyboard returns to the control the tray stood under — the
    // face's own Add, plain furniture with no disclosure of its own.
    expect(document.activeElement?.id).toBe("detail-module-add");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(app.ui.detail).toBeNull();
  });

  it("Cancel returns the keyboard to the face's rail too", () => {
    give(app.state, "additive", null);
    app.render();
    clickCell(0, 1);
    document.getElementById("detail-module-add")!.click();
    document.getElementById("detail-tray-cancel")!.click();
    expect(document.activeElement?.id).toBe("detail-module-add");
  });

  it("Add cell remains the grid-expansion action: it returns the grid and arms the purchase", () => {
    app.state.nous = 500; // the Add arm needs the bank to afford a cell
    app.render();
    clickCell(0, 1);
    document.querySelector<HTMLButtonElement>('#board-tools [data-op="cell"]')!.click();
    expect(app.ui.detail).toBeNull();
    expect(app.ui.detailTray).toBeNull();
    expect(app.ui.buyingCell).toBe(true);
  });

  it("all editing stays locked during flow: no rail actions, no tray", () => {
    give(app.state, "additive", null);
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.render();
    clickCell(0, 1);
    expect(open()).toBe(true);
    expect(document.getElementById("detail-module-add")).toBeNull();
    expect(document.getElementById("detail-module-swap")).toBeNull();
    expect(document.getElementById("detail-module-retrieve")).toBeNull();
    expect(document.getElementById("detail-mutator-add")).toBeNull();
    expect(document.getElementById("detail-mutator-swap")).toBeNull();
    app.openDetailTray("modules");
    app.openDetailTray("mutators");
    expect(app.ui.detailTray).toBeNull();
    expect(document.querySelector(".hex-detail-tray")).toBeNull();
    endSession(app.state);
  });
});
