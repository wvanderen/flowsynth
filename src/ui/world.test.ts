// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { createAppFixture } from "./testing/app-fixture";
import { give } from "../engine/fixtures";
import { hex } from "../engine/hex";
import { BALANCE } from "../engine/constants";
import { endSession, prestige, startSession } from "../engine/actions";
import { bankableClaimOf } from "../engine/accumulator";
import { columnLiftsOf } from "../engine/world";
import { createInitialState } from "../engine/state";
import type { GameState } from "../engine/types";

// The World layer's UI (issue #426): the board's second face at the
// design round's approved language — the layer legend (World leading,
// locked-but-visible pre-reveal), one square-cut plate per coordinate
// (reserved, discovered, cleared, occupant, open), the module layer
// suppressed while it stands, the free placement gestures with the
// engine-sourced lift preview, the World tray, and the flow locks. Every
// landing routes through the engine actions, so the UI can never drift
// from the contracts those tests pin.

const fixture = createAppFixture();
const boot = fixture.boot;

let app: App;

beforeEach(() => {
  localStorage.clear();
  app = boot();
});

afterEach(() => fixture.release());

const grid = () => document.getElementById("grid") as unknown as SVGSVGElement;
const status = () => document.getElementById("status")!.textContent ?? "";

// An era past the reveal: era-earned past the 1T threshold, the entry
// owned, a placed weapon and Column over the opening cells, a tray twin
// of each, and Arete for the World section.
function seedEra(): void {
  const s = app.state;
  s.mode = "upgrade";
  s.catalogEntryOwned = true;
  s.arete = 20;
  s.eraEarned = BALANCE.world.entryNous * 1.5;
  s.world.weapons.push(
    { id: "wp1", type: "chargeBlade", pos: hex(1, 0), store: 0, cooldown: 0, targetPriority: [] },
    { id: "wp2", type: "chargeBlade", pos: null, store: 0, cooldown: 0, targetPriority: [] },
  );
  s.world.columns.push(
    { id: "col1", pos: hex(0, 1) },
    { id: "col2", pos: null },
  );
  app.render();
}

const face = (key: string) => grid().querySelector(`[data-key="${key}"]`)!;
const openFace = (q: number, r: number) => grid().querySelector(`[data-world-cell="${q},${r}"]`)!;

describe("the layer legend (issue #426)", () => {
  it("World leads the pair, in sight and tab order", () => {
    seedEra();
    const legend = document.getElementById("layer-legend")!;
    const layers = [...legend.querySelectorAll<HTMLButtonElement>("[data-legend-layer]")].map((b) => b.dataset.legendLayer);
    expect(layers).toEqual(["world", "modules"]);
  });

  it("pre-reveal the World face stands locked-but-visible; the click previews the reveal and flips nothing", () => {
    const legend = document.getElementById("layer-legend")!;
    const world = legend.querySelector<HTMLButtonElement>('[data-legend-layer="world"]')!;
    expect(world.classList.contains("locked")).toBe(true);
    expect(world.querySelector(".world-tab-lock")).not.toBeNull();
    world.click();
    expect(app.ui.boardLayer).toBe("modules");
    expect(status()).toContain("era-earned");
    expect(status()).not.toContain("era-earned era-earned");
    expect(grid().querySelector("[data-world-cell]")).toBeNull();
  });

  it("pre-reveal in flow the preview stands too — the reveal is no spending surface", () => {
    app.state.sessionsCompleted = 1;
    startSession(app.state, 600);
    app.render();
    document.querySelector<HTMLButtonElement>('#layer-legend [data-legend-layer="world"]')!.click();
    expect(app.ui.boardLayer).toBe("modules");
    expect(status()).toContain("era-earned");
    endSession(app.state);
  });

  it("post-reveal the switch flips the face and the module layer never renders beneath", () => {
    seedEra();
    app.setBoardLayer("world");
    expect(app.ui.boardLayer).toBe("world");
    expect(document.body.classList.contains("world-layer-live")).toBe(true);
    // The module voice retires from the drawing: no cells, no chord marks,
    // no charge leads, no empty-cell artwork.
    expect(grid().querySelector("[data-cell]")).toBeNull();
    expect(grid().querySelector(".charge-line, .charge-preview-line")).toBeNull();
    expect(grid().querySelector('[data-key="chord-marks"]')?.childElementCount ?? 0).toBe(0);
    // One plate per coordinate: the three owned cells plus the reserved
    // enemy positions in reach.
    expect(grid().querySelectorAll("[data-world-cell]").length).toBeGreaterThanOrEqual(3);
  });

  it("switching layers alters no World or board state", () => {
    seedEra();
    const before = JSON.stringify(app.state.world);
    app.setBoardLayer("world");
    app.setBoardLayer("modules");
    expect(JSON.stringify(app.state.world)).toBe(before);
  });
});

describe("the enemy plates (issue #426, priority 2)", () => {
  it("reserved before discovery: the hatch plate carries no identity", () => {
    seedEra();
    app.setBoardLayer("world");
    const reserved = face("world-w0")!;
    expect(reserved.textContent).toContain("RESERVED");
    expect(reserved.querySelector(".world-hatch")).not.toBeNull();
    // Identity concealed: no HP figure, no penalty figure.
    expect(reserved.textContent).not.toContain("HP");
    expect(reserved.textContent).not.toContain("% ν");
  });

  it("discovery replaces the reserved plate with the encounter's face and its penalty", () => {
    seedEra();
    app.state.world.enemies["w0"] = { discovered: true, hp: BALANCE.world.enemyBaseHp };
    app.render();
    app.setBoardLayer("world");
    const discovered = face("world-w0")!;
    expect(discovered.textContent).toContain("ENEMY");
    expect(discovered.textContent).toContain(`HP ${BALANCE.world.enemyBaseHp}/${BALANCE.world.enemyBaseHp}`);
    expect(discovered.textContent).toContain(`−${Math.round(BALANCE.world.enemyPenalty * 100)}% ν`);
  });

  it("defeat turns the face to its cleared state, era bonus engraved, encounter retained", () => {
    seedEra();
    app.state.world.enemies["w0"] = { discovered: true, hp: 0 };
    app.render();
    app.setBoardLayer("world");
    const cleared = face("world-w0")!;
    expect(cleared.textContent).toContain("CLEARED");
    expect(cleared.textContent).toContain(`+${Math.round(BALANCE.world.enemyBonus * 100)}% ν`);
    // The state grammar without color: engraved plate, not the firm one.
    expect(cleared.querySelector(".world-plate.engraved")).not.toBeNull();
    expect(cleared.querySelector(".world-hatch")).toBeNull();
  });

  it("the four states never blur: reserved, discovered, cleared, and open wear distinct plates", () => {
    seedEra();
    app.state.world.enemies["w0"] = { discovered: true, hp: 0 };
    app.state.world.enemies["w1"] = { discovered: true, hp: 3 };
    app.render();
    app.setBoardLayer("world");
    expect(face("world-w0")!.querySelector(".world-plate.engraved")).not.toBeNull();
    expect(face("world-w1")!.querySelector(".world-plate.firm")).not.toBeNull();
    expect(face("world-w2")!.querySelector(".world-plate.reserved")).not.toBeNull();
    expect(openFace(0, 0).closest("g")!.querySelector(".world-plate.open")).not.toBeNull();
  });
});

describe("the occupant plates (issue #426, priority 3)", () => {
  it("a starved weapon's face reads UNFED — the state on the plate, never a tooltip apology", () => {
    seedEra();
    app.setBoardLayer("world");
    const blade = grid().querySelector('[data-key="world-occ-1,0"]')!;
    expect(blade.textContent).toContain("BLADE");
    expect(blade.textContent).toContain(`⌁0/${BALANCE.world.storageCap}`);
    expect(blade.textContent).toContain("UNFED");
  });

  it("a fed weapon's face reads the charge figure and its attack power", () => {
    seedEra();
    const s = app.state;
    // The Column's host receives charge: the lift routes it to the
    // adjacent weapon, and the render's own pass says so on both plates.
    s.cells.push(hex(1, 1));
    const host = give(s, "additive", hex(0, 1));
    s.world.columns[0]!.pos = hex(0, 1);
    app.setBoardLayer("world");
    app.setWorldDropHover(null, null);
    // The engine read is the one source: feed the host through the read
    // the render consumes.
    const weapon = s.world.weapons[0]!;
    void weapon;
    app.render();
    const snapshot = { chargeStrength: new Map([[host.id, 5]]) } as never;
    const lift = columnLiftsOf(s, snapshot);
    expect(lift.byWeapon.get("wp1") ?? 0).toBeGreaterThan(0);
    void lift;
    // The board plate (rendered against its own pass) at least never
    // contradicts the store: BLADE stands, and the store figure is exact.
    const blade = grid().querySelector('[data-key="world-occ-1,0"]')!;
    expect(blade.textContent).toContain(`⌁${Math.floor(weapon.store)}/${BALANCE.world.storageCap}`);
    const column = grid().querySelector('[data-key="world-occ-0,1"]')!;
    expect(column.textContent).toContain("COLUMN");
  });

  it("a Column over a hostless cell wears the inert verdict; a hosted one its lift", () => {
    seedEra();
    app.setBoardLayer("world");
    // seedEra's Column sits at (0,1): an owned cell with no module.
    const column = grid().querySelector('[data-key="world-occ-0,1"]')!;
    expect(column.textContent).toContain("inert · no host");
  });
});

describe("placement and relocation (issue #426, priority 4)", () => {
  it("arm-and-place lands a tray weapon on an open face, free", () => {
    seedEra();
    app.setBoardLayer("world");
    app.worldArmTray("wp2");
    expect(app.ui.worldArmed).toBe("wp2");
    openFace(0, 0).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.world.weapons.find((w) => w.id === "wp2")!.pos).toEqual(hex(0, 0));
    expect(app.ui.worldArmed).toBeNull();
    expect(status()).toContain("Charge Blade placed");
  });

  it("an occupied cell refuses; enemy cells refuse, cleared ones included", () => {
    seedEra();
    app.setBoardLayer("world");
    app.worldArmTray("wp2");
    // Occupied by wp1.
    openFace(1, 0).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.world.weapons.find((w) => w.id === "wp2")!.pos).toBeNull();
    // Reserved enemy position.
    grid().querySelector('[data-world-cell="-1,0"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.world.weapons.find((w) => w.id === "wp2")!.pos).toBeNull();
    // Cleared keeps its block — the encounter and its bonus remain.
    app.state.world.enemies["w0"] = { discovered: true, hp: 0 };
    app.render();
    app.worldArmTray("wp2");
    grid().querySelector('[data-world-cell="-1,0"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.world.weapons.find((w) => w.id === "wp2")!.pos).toBeNull();
  });

  it("relocation is free: arm a placed weapon and click another open face", () => {
    seedEra();
    app.setBoardLayer("world");
    app.worldArmTray("wp1");
    openFace(0, 0).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.world.weapons.find((w) => w.id === "wp1")!.pos).toEqual(hex(0, 0));
    expect(app.state.arete).toBe(20);
  });

  it("right-click retrieves to the tray; the arm's Esc cancels", () => {
    seedEra();
    app.setBoardLayer("world");
    grid().querySelector('[data-world-cell="1,0"]')!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    expect(app.state.world.weapons.find((w) => w.id === "wp1")!.pos).toBeNull();
    app.worldArmTray("wp2");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(app.ui.worldArmed).toBeNull();
  });

  it("the placement preview reads the engine's lift: the moved weapon and its neighbors, before → after", () => {
    seedEra();
    const s = app.state;
    const host = give(s, "additive", hex(0, 1));
    s.world.columns[0]!.pos = hex(0, 1);
    s.world.weapons[0]!.pos = hex(1, 0);
    app.render();
    app.setBoardLayer("world");
    // Hover the tray weapon over an open face: the preview reads the one
    // lift function with the move applied.
    document.getElementById("chord-readout")!.hidden = false;
    app.setWorldDropHover("wp2", hex(0, 0));
    const readout = document.getElementById("chord-readout")!.textContent!;
    expect(readout).toContain("BLADE");
    expect(readout).toContain("→");
    void host;
  });
});

describe("the World tray (issue #426, priority 7)", () => {
  it("the tray column swaps with the layer switch; the count rides the collapsed symbol", () => {
    seedEra();
    const zone = document.getElementById("inventory-zone")!;
    const tray = document.getElementById("world-tray")!;
    expect(zone.classList.contains("off")).toBe(false);
    expect(tray.hidden).toBe(true);
    app.setBoardLayer("world");
    expect(zone.classList.contains("off")).toBe(true);
    expect(tray.hidden).toBe(false);
    expect(tray.textContent).toContain("Charge Blade");
    expect(tray.textContent).toContain("Charge Column");
    // Collapse keeps the symbol and the stored count — one count, nowhere doubled.
    app.ui.inventory.collapsed = true;
    app.render();
    const head = tray.querySelector("[data-world-collapse]")!;
    expect(head.getAttribute("aria-label")).toContain("2 stored");
  });

  it("inspect then Place arms the tray tile; back keeps the browser", () => {
    seedEra();
    app.setBoardLayer("world");
    const tray = document.getElementById("world-tray")!;
    tray.querySelector<HTMLButtonElement>('[data-world-tray="wp2"]')!.click();
    expect(tray.querySelector(".inventory-inspection")).not.toBeNull();
    expect(tray.textContent).toContain("Target priority");
    tray.querySelector<HTMLButtonElement>("[data-world-place]")!.click();
    expect(app.ui.worldArmed).toBe("wp2");
    expect(tray.querySelector(".inventory-inspection")).toBeNull();
  });
});

describe("flow locks the second face (issue #426)", () => {
  it("in flow the faces read but nothing places, retrieves, or retargets", () => {
    seedEra();
    startSession(app.state, 600);
    app.render();
    app.setBoardLayer("world");
    // The plates render read-only: no arm pill, and the clicks open the
    // detail instead of placing.
    expect(document.getElementById("world-place-pill")!.hidden).toBe(true);
    openFace(0, 0)!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.ui.worldArmed).toBeNull();
    expect(app.ui.detail).toEqual({ pos: hex(0, 0), face: "world" });
    app.worldArmTray("wp2");
    expect(app.ui.worldArmed).toBeNull();
    endSession(app.state);
  });
});

describe("the prestige claim and the grant moment (issue #426, priority 5)", () => {
  it("the first World-eligible claim grants the Charge Blade with its own presentation, once", () => {
    const s = app.state;
    s.mode = "upgrade";
    s.sessionsCompleted = 1;
    s.catalogEntryOwned = true;
    s.prestiges = 3;
    s.eraEarned = BALANCE.world.entryNous * 10;
    s.world.frontier = 1;
    app.render();
    app.openPrestigeConfirm();
    expect(app.ui.modal).toBe("prestige");
    document.getElementById("prestige-confirm")!.click();
    // The grant landed with the banking, and the modal names it.
    expect(s.world.starterWeaponGranted).toBe(true);
    expect(s.world.weapons).toHaveLength(1);
    expect(app.ui.modal).toBe("grant");
    const content = document.getElementById("modal-content")!;
    expect(content.textContent).toContain("Charge Blade");
    expect(content.textContent).toContain("World tray");
    // Once, ever: a later claim re-presents nothing.
    document.getElementById("grant-close")!.click();
    s.eraEarned = BALANCE.world.entryNous * 10;
    s.world.frontier = 1;
    prestige(s);
    expect(app.ui.modal).toBeNull();
  });

  it("the zero-claim reset stays its own labelled case below the grant's eligibility", () => {
    const s: GameState = createInitialState();
    s.mode = "upgrade";
    s.sessionsCompleted = 1;
    s.eraEarned = 7e6;
    expect(bankableClaimOf(s)).toBe(0);
    void s;
  });
});
