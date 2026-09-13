// Browser regression checks against the running app (npm run dev, open /?dev=1):
// await import('/tools/ui/check-rendering.ts').then(m => m.checkRendering(window.__flowsynth))
import type { App } from "../../src/ui/app";
import { fresh, give, grantBurst, setActive } from "../../src/engine/fixtures";
import { startSession } from "../../src/engine/actions";
import { advance } from "../../src/engine/advance";
import { STORAGE_KEY } from "../../src/engine/save";

export async function checkRendering(app: App): Promise<string[]> {
  const state = app.state;
  const ui = structuredClone(app.ui);
  const save = localStorage.getItem(STORAGE_KEY);
  const passed: string[] = [];
  const check = (condition: unknown, name: string) => {
    if (!condition) throw new Error(name);
    passed.push(name);
  };
  const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  try {
    app.state = fresh();
    setActive(app.state);
    give(app.state, "forge", { q: 0, r: 0 });
    app.ui.modal = null;
    app.ui.selected = null;
    app.ui.managing = false;
    app.ui.placing = null;
    app.ui.reshape = null;
    startSession(app.state, 600);
    grantBurst(app.state, 1, 60);
    app.render();
    await frame();
    const hex = document.querySelector(".hex.charged")!;
    const animation = hex.getAnimations()[0];
    const fill = document.querySelector(".water-fill")!;
    const initialFill = fill.getAttribute("y");
    for (let i = 0; i < 5; i++) app.render();
    check(document.querySelector(".hex.charged") === hex, "Charge hex survives repeated renders");
    check(hex.getAnimations().includes(animation), "Charge pulse keeps its animation timeline");
    advance(app.state, 0.5);
    app.render();
    check(document.querySelector(".water-fill") === fill, "Water fill survives a clock advance");
    check(fill.getAttribute("y") !== initialFill, "Clock advance raises the water fill");
    check(getComputedStyle(fill).transitionProperty.includes("y"), "Water accumulation has a CSS transition");
    check(document.querySelector('head link[rel="stylesheet"]'), "Styles load before first paint");

    // Buttons must survive clock ticks so a single click always lands.
    const endButton = document.getElementById("end-flow")!;
    for (let i = 0; i < 5; i++) app.render();
    check(document.getElementById("end-flow") === endButton, "End flow button survives repeated renders");
    endButton.click();
    check(app.state.mode === "upgrade", "End flow ends the session on the first click");

    // Settings is meta and lives in the top bar; board tools stay gameplay.
    check(!!document.getElementById("topbar-settings"), "Settings lives in the top bar");
    check(!document.getElementById("tool-settings"), "Board tools are gameplay-only");
    document.getElementById("topbar-settings")!.click();
    check(app.ui.modal === "settings", "The top-bar button opens Settings");
    app.closeModal();

    app.ui.managing = true;
    app.render();
    for (let i = 0; i < 5; i++) app.render();
    const cell = document.querySelector('[data-cell="0,0"]')!;
    cell.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    check(app.ui.selected === app.state.modules.find(m => m.type === "forge")!.id, "Retained cells have one click handler");
    check(!document.querySelector(".hex-actions"), "Management has no obsolete grid action buttons");
    const drag = (source: Element, target: Element) => {
      const from = source.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      source.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: from.x + from.width / 2, clientY: from.y + from.height / 2 }));
      const destination = { clientX: to.x + to.width / 2, clientY: to.y + to.height / 2 };
      document.dispatchEvent(new PointerEvent("pointermove", destination));
      document.dispatchEvent(new PointerEvent("pointerup", destination));
    };
    const forge = app.state.modules.find(m => m.type === "forge")!;
    drag(cell, document.querySelector('[data-cell="2,0"]')!);
    check(forge.pos?.q === 2 && forge.pos.r === 0, "Retained grid cells support dragging to a destination");
    await frame();
    drag(document.querySelector('[data-cell="2,0"]')!, document.querySelector("#inventory-zone")!);
    check(forge.pos === null, "Dragging into inventory returns the module");
    await frame();

    // Arranging mode is unmistakable: banner, body flag, raised tiles.
    check(document.body.classList.contains("managing"), "Arranging mode is marked on the body");
    const banner = document.getElementById("manage-banner")!;
    check(getComputedStyle(banner).display !== "none", "The arranging banner is visible while managing");
    check(!!document.getElementById("manage-banner-done"), "The banner carries a Done exit");
    // The banner is a header row, not an overlay: it must never cover a cell.
    const bannerBox = banner.getBoundingClientRect();
    const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    check(![...document.querySelectorAll("[data-cell]")].some((node) => overlaps(node.getBoundingClientRect(), bannerBox)), "The banner never covers board cells");
    const deadCell = [...document.querySelectorAll<SVGElement>("[data-cell]")].find((node) => {
      const box = node.getBoundingClientRect();
      return !document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest("[data-cell]");
    });
    check(!deadCell, "Every cell stays clickable while arranging");
    check(getComputedStyle(document.querySelector(".module-node")!).transform !== "none", "Deployed modules raise off the board while arranging");
    check(!!document.querySelector(".module-node .core-pin"), "Core tiles wear a pin while arranging");
    check(document.querySelector(".module-node title")?.textContent?.includes("Required core") === true, "The pin carries a stays-on-the-board tooltip");
    const invTile = document.querySelector(`[data-inv="${forge.id}"]`);
    check(!!invTile?.querySelector("svg polygon.hex"), "Returned modules appear as inventory hex tiles");
    check(invTile?.getAttribute("data-rarity") === "common", "Inventory hex tiles carry the rarity accent");

    // The live drag ghost is the module's own hex tile and it places back out.
    const tileBox = invTile!.getBoundingClientRect();
    invTile!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: tileBox.x + tileBox.width / 2, clientY: tileBox.y + tileBox.height / 2 }));
    document.dispatchEvent(new PointerEvent("pointermove", { clientX: tileBox.x + tileBox.width / 2 + 40, clientY: tileBox.y + tileBox.height / 2 + 40 }));
    const ghostTile = document.querySelector(".drag-ghost");
    check(!!ghostTile?.querySelector("polygon.hex"), "The drag ghost is the module's hex tile");
    check(ghostTile?.getAttribute("data-rarity") === "common", "The drag ghost keeps the module's rarity accent");
    const home = document.querySelector('[data-cell="0,0"]')!.getBoundingClientRect();
    document.dispatchEvent(new PointerEvent("pointerup", { clientX: home.x + home.width / 2, clientY: home.y + home.height / 2 }));
    check(forge.pos?.q === 0 && forge.pos.r === 0, "Inventory hex tiles drag back onto the board");
    await frame();

    // Dropping a tile onto a matching twin combines them at the drop cell.
    const twin = give(app.state, "forge", { q: 2, r: 0 });
    app.render();
    await frame();
    drag(document.querySelector('[data-cell="0,0"]')!, document.querySelector('[data-cell="2,0"]')!);
    check(app.state.modules.filter((m) => m.type === "forge").length === 1, "Dropping a tile onto its matching twin combines them");
    check(!app.state.modules.includes(twin), "The twin is consumed");
    check(forge.rarity === "uncommon" && forge.pos?.q === 2 && forge.pos.r === 0, "The combined module upgrades and lands on the drop cell");
    await frame();

    // Done exits arranging everywhere it is visible.
    document.getElementById("manage-banner-done")!.click();
    check(app.ui.managing === false, "Banner Done exits arranging");
    check(getComputedStyle(document.getElementById("manage-banner")!).display === "none", "The arranging banner hides on exit");
    check(!document.body.classList.contains("managing"), "The body flag clears on exit");

    // Right-click while placing keeps the module in inventory.
    app.state.bankedRolls = [
      { id: "check-first", candidates: [
        { id: "check-a", type: "enter", rarity: "common" },
        { id: "check-b", type: "time", rarity: "uncommon" },
        { id: "check-c", type: "expander", rarity: "rare" },
      ] },
    ];
    app.openModal("forge");
    check(document.querySelectorAll(".candidate-tile").length === 3, "Forge offers three hex candidates");
    check(document.querySelector(".candidate-tile")?.textContent?.includes("0.1 ν/s"), "Forge tiles show concrete production");
    check(!document.querySelector("#modal-content .modal-note, #modal-content .lead"), "Forge omits surrounding filler");
    check(!document.querySelector("#close-modal"), "Forge closes by clicking away, not an ✕ button");
    document.querySelector<HTMLButtonElement>("[data-choice]")!.click();
    check(app.state.bankedRolls.length === 0, "Select consumes the offer");
    check(app.ui.modal === null, "Choosing a module closes the Forge");
    check(app.ui.managing === true && typeof app.ui.placing === "string", "Choosing enters grid management with the module ready to place");
    const placed = app.state.modules[app.state.modules.length - 1]!;
    check(placed.id === app.ui.placing, "The placed module is the chosen candidate");
    document.querySelector('[data-cell="0,0"]')!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    check(app.ui.placing === null && placed.pos === null, "Right-click keeps the module in inventory");
    return passed;
  } finally {
    app.state = state;
    app.ui = ui;
    app.render();
    if (save === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, save);
  }
}
