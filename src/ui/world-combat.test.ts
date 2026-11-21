// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { STORAGE_KEY, serialize } from "../engine/save";
import { createInitialState } from "../engine/state";
import { createAppFixture, setAppWidth } from "./testing/app-fixture";

const fixture = createAppFixture();
afterEach(() => fixture.release());

it("launches the fixed fight in a private slot and equips it from World without changing the ordinary save", () => {
  const prior = createInitialState();
  const ordinary = serialize(prior, Date.now());
  localStorage.setItem(STORAGE_KEY, ordinary);
  const app = fixture.boot(undefined, true);
  const beforeLaunch = localStorage.getItem(STORAGE_KEY);
  app.devLaunchScenario("world-combat");
  app.devScenarioAssert();
  expect(app.ui.boardLayer).toBe("world");
  expect(document.querySelector('[data-world-cell="-1,0"]')?.getAttribute("aria-label")).toContain("Shale · 48/48 HP · −20% ν");
  document.querySelector<HTMLButtonElement>('[data-world-tray="sentinel"]')!.click();
  expect(document.querySelector(".inventory-inspection")?.textContent).toContain("24/24 HP · Ready");
  document.querySelector<HTMLButtonElement>('[data-world-place="sentinel"]')!.click();
  document.querySelector<SVGElement>('[data-world-cell="0,0"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  expect(app.state.world.proof!.creature.pos).toEqual({ q: 0, r: 0 });
  expect(localStorage.getItem(STORAGE_KEY)).toBe(beforeLaunch);
  app.dispose();
  const reopened = fixture.boot();
  expect(reopened.state.world.proof).toBeUndefined();
  expect(reopened.state.world.unlocked).toBe(false);
});

it("edits the conduit only between sessions and explains the defeated tray lock", () => {
  const app = fixture.boot(undefined, true);
  app.devLaunchScenario("world-combat");
  expect(app.devActionWorldPlace("conduit", 1, 0).ok).toBe(true);
  document.querySelector('[data-world-cell="1,0"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  const outlet = document.querySelector<HTMLButtonElement>('[data-world-edge="5"]')!;
  outlet.focus();
  outlet.click();
  expect(document.querySelector('[data-world-edge="5"]')?.getAttribute("aria-pressed")).toBe("true");
  expect(document.activeElement?.getAttribute("data-world-edge")).toBe("5");
  app.closeDetail();
  expect(app.devActionWorldPlace("sentinel", 0, 0).ok).toBe(true);
  expect(app.devActionStartSession(null).ok).toBe(true);
  app.setBoardLayer("world");
  app.worldPickCell({ q: 1, r: 0 });
  expect(document.querySelector("[data-world-edge]")).toBeNull();
  app.closeDetail();
  expect(app.devActionAdvance(16).ok).toBe(true);
  expect(app.devActionEndSession().ok).toBe(true);
  app.setBoardLayer("world");
  document.querySelector<HTMLButtonElement>('[data-world-tray="sentinel"]')!.click();
  expect(document.querySelector(".inventory-inspection")?.textContent).toContain("0/24 HP · Recovering");
  expect(document.querySelector<HTMLButtonElement>('[data-world-place="sentinel"]')!.disabled).toBe(true);
});

it("keeps the phone board unobstructed and brings the proof kit in through Inventory", () => {
  const app = fixture.boot(undefined, true);
  setAppWidth(390);
  app.devLaunchScenario("world-combat");
  expect(document.getElementById("world-tray")!.hidden).toBe(true);
  expect(document.getElementById("arc-card")!.hidden).toBe(true);
  app.openModal("inventory");
  const rows = document.querySelectorAll('#modal-content [data-world-tray]');
  expect(rows).toHaveLength(6);
  expect(document.querySelector('#modal-content [data-world-tray="guard-plate"]')?.textContent).not.toContain("Unbound");
});
