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
    const ring = document.querySelector(".ring-progress")!;
    const initialProgress = ring.getAttribute("stroke-dasharray");
    for (let i = 0; i < 5; i++) app.render();
    check(document.querySelector(".hex.charged") === hex, "Charge hex survives repeated renders");
    check(hex.getAnimations().includes(animation), "Charge pulse keeps its animation timeline");
    advance(app.state, 0.5);
    app.render();
    check(document.querySelector(".ring-progress") === ring, "Progress ring survives a clock advance");
    check(ring.getAttribute("stroke-dasharray") !== initialProgress, "Clock advance updates ring progress");
    check(getComputedStyle(ring).transitionProperty.includes("stroke-dasharray"), "Ring accumulation has a CSS transition");
    check(document.querySelector('head link[rel="stylesheet"]'), "Styles load before first paint");

    app.state.mode = "upgrade";
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
    app.state.bankedRolls = [
      { id: "check-first", candidates: [
        { id: "check-a", type: "enter", rarity: "common" },
        { id: "check-b", type: "time", rarity: "uncommon" },
        { id: "check-c", type: "expander", rarity: "rare" },
      ] },
      { id: "check-second", candidates: [
        { id: "check-d", type: "additive", rarity: "common" },
        { id: "check-e", type: "conditional", rarity: "uncommon" },
        { id: "check-f", type: "infusor", rarity: "rare" },
      ] },
    ];
    app.openModal("forge");
    check(document.querySelectorAll(".candidate").length === 3, "Forge displays three choices");
    check(document.querySelector(".candidate")?.textContent?.includes("+0.05 ν/s"), "Forge displays concrete production");
    check(!document.querySelector("#modal-content .lead, #modal-content .modal-note"), "Forge omits surrounding filler");
    document.querySelector<HTMLButtonElement>("[data-choice]")!.click();
    check(app.state.bankedRolls.length === 1, "Select consumes one offer");
    check(document.querySelector("[data-choice]")?.getAttribute("data-choice") === "check-a", "Next banked offer replaces the previous options");
    return passed;
  } finally {
    app.state = state;
    app.ui = ui;
    app.render();
    if (save === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, save);
  }
}
