// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { App } from "./app";
import { give } from "../engine/fixtures";
import { hex } from "../engine/hex";
import { createAppFixture } from "./testing/app-fixture";
import { inventoryModules } from "./inventory";

const fixture = createAppFixture();
let app: App;
const host = () => document.getElementById("inventory-zone")!;
const click = (selector: string, scope: ParentNode = host()) => scope.querySelector<HTMLButtonElement>(selector)!.click();
const filter = (value: string) => {
  const el = host().querySelector<HTMLSelectElement>("[data-inventory-filter]")!;
  el.value = value; el.dispatchEvent(new Event("change"));
};
beforeEach(() => { localStorage.clear(); app = fixture.boot(); });
afterEach(() => fixture.release());

describe("inventory browsing", () => {
  it("inspects without arming, shows authored profile, then explicitly places", () => {
    const m = give(app.state, "triangle", null);
    app.render();
    click(`[data-inv="${m.id}"]`);
    expect(app.ui.placing).toBeNull();
    expect(host().querySelector(".profile-grades")).not.toBeNull();
    expect(host().querySelector(".inventory-detail-face")).not.toBeNull();
    expect(host().textContent).not.toContain("active chord");
    click("[data-inventory-place]");
    expect(app.ui.placing).toBe(m.id);
    app.pickCell(hex(0, 1));
    expect(m.pos).toEqual(hex(0, 1));
  });
  it("filters modules by category and preserves filtering and scroll through detail", () => {
    give(app.state, "additive", null);
    const gen = give(app.state, "focusKeyed", null);
    app.render(); filter("generator");
    expect(host().querySelectorAll("[data-inv]")).toHaveLength(1);
    const list = host().querySelector<HTMLElement>("[data-inventory-scroll]")!;
    list.scrollTop = 120; list.dispatchEvent(new Event("scroll"));
    click(`[data-inv="${gen.id}"]`); click("[data-inventory-back]");
    expect(host().querySelector<HTMLSelectElement>("[data-inventory-filter]")!.value).toBe("generator");
    expect(host().querySelector<HTMLElement>("[data-inventory-scroll]")!.scrollTop).toBe(120);
    expect(host().querySelectorAll("[data-inv]")).toHaveLength(1);
  });
  it("sorts by acquisition order, rarity and purchased level", () => {
    const sine = give(app.state, "additive", null);
    const rare = give(app.state, "blaster", null);
    const last = give(app.state, "spacer", null);
    sine.level = 8;
    app.ui.inventory.sorts.modules = "newest";
    expect(inventoryModules(app)[0]!.id).toBe(last.id);
    app.ui.inventory.sorts.modules = "level";
    expect(inventoryModules(app)[0]!.id).toBe(sine.id);
    app.ui.inventory.sorts.modules = "rarity";
    expect(inventoryModules(app)[0]!.id).toBe(rare.id);
  });
  it("collapses to a count-bearing handle and reopens with browsing choices intact", () => {
    give(app.state, "additive", null); app.render(); filter("oscillator");
    click("[data-inventory-collapse]");
    expect(host().querySelector("[data-inv]")).toBeNull();
    expect(host().querySelector("[aria-expanded='false']")!.textContent).toContain("1");
    click("[data-inventory-collapse]");
    expect(host().querySelector<HTMLSelectElement>("[data-inventory-filter]")!.value).toBe("oscillator");
  });
  it("temporarily opens a collapsed retrieval target and restores collapse after a board drag", async () => {
    app.render(); click("[data-inventory-collapse]");
    document.elementFromPoint = () => host();
    document.querySelector('[data-cell="0,0"]')!.dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 100 }));
    expect(app.ui.inventory.dragOpen).toBe(true);
    expect(host().querySelector("[data-inventory-filter]")).not.toBeNull();
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 130, clientY: 100 }));
    await Promise.resolve();
    expect(app.state.modules.find((m) => m.id === "m1")!.pos).toBeNull();
    expect(app.ui.inventory.collapsed).toBe(true); expect(app.ui.inventory.dragOpen).toBe(false);
    expect(host().querySelector("[data-inventory-filter]")).toBeNull();
  });
  it("keyboard Escape returns from inspection and selection without consuming copies", () => {
    const m = give(app.state, "additive", null); app.render();
    click(`[data-inv="${m.id}"]`);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(app.ui.inventory.inspect).toBeNull();
    expect(host().querySelector(`[data-inv="${m.id}"]`)).not.toBeNull();
    expect(app.state.modules).toContain(m);
  });
});

describe("inventory row merges", () => {
  it("excludes deployed twins and removes collection-wide and info controls", () => {
    const a = give(app.state, "additive", null); app.render();
    expect(host().querySelector<HTMLButtonElement>(`[data-inventory-merge="${a.id}"]`)!.disabled).toBe(true);
    expect(host().querySelector("[data-merge-all]")).toBeNull();
    expect(host().textContent).not.toContain("ⓘ");
  });
  it("auto-selects a sole partner and reviews before preserving the clicked copy", () => {
    const a = give(app.state, "focusKeyed", null);
    const b = give(app.state, "focusKeyed", null);
    a.reserve = 25; b.level = 4; b.invested = 80; b.reserve = 6;
    app.render(); click(`[data-inventory-merge="${a.id}"]`);
    expect(app.ui.inventory.merge?.partner).toBe(b.id);
    expect(app.state.modules).toContain(b);
    expect(host().textContent).toContain("6 charge reserve lost");
    click("[data-inventory-merge-confirm]");
    expect(app.state.modules).toContain(a);
    expect(app.state.modules).not.toContain(b);
    expect(a.level).toBe(4); expect(a.invested).toBe(80); expect(a.reserve).toBe(25); expect(a.tier).toBe(1);
  });
  it("offers multiple matching partners, cancels safely, and never chains", () => {
    const a = give(app.state, "spacer", null);
    const b = give(app.state, "spacer", null);
    const c = give(app.state, "spacer", null);
    app.render(); click(`[data-inventory-merge="${a.id}"]`);
    expect(host().querySelectorAll("[data-partner]")).toHaveLength(2);
    click(`[data-partner="${b.id}"]`); click("[data-inventory-back]");
    expect(app.state.modules).toContain(b);
    click(`[data-inventory-merge="${a.id}"]`); click(`[data-partner="${c.id}"]`); click("[data-inventory-merge-confirm]");
    expect(app.state.modules).toContain(b); expect(app.state.modules).not.toContain(c); expect(a.tier).toBe(1);
  });
  it("refuses a partner deployed after review", () => {
    const a = give(app.state, "spacer", null); const b = give(app.state, "spacer", null);
    app.render(); click(`[data-inventory-merge="${a.id}"]`);
    b.pos = hex(1, 0); app.confirmInventoryMerge();
    expect(app.state.modules).toContain(a); expect(app.state.modules).toContain(b); expect(a.tier).toBe(0);
  });
  it("filters, inspects and merges mutators without targeting board copies", () => {
    app.state.catalogEntryOwned = true;
    app.state.mutators = [
      { id: "a", family: "power", rarity: "common", pos: null },
      { id: "b", family: "power", rarity: "common", pos: null },
      { id: "c", family: "charge", rarity: "common", pos: null },
      { id: "d", family: "power", rarity: "common", pos: hex(0, 0) },
    ];
    app.mutSetLayer("mutators");
    const tray = document.getElementById("mutator-tray")!;
    const select = tray.querySelector<HTMLSelectElement>("[data-inventory-filter]")!;
    select.value = "power"; select.dispatchEvent(new Event("change"));
    expect(tray.querySelectorAll("[data-mut-tray]")).toHaveLength(2);
    click('[data-mut-tray="a"]', tray); expect(app.ui.mutArmedTray).toBeNull();
    click("[data-inventory-back]", tray); click('[data-inventory-merge="a"]', tray);
    click("[data-inventory-merge-confirm]", tray);
    expect(app.state.mutators.find((m) => m.id === "a")!.rarity).toBe("uncommon");
    expect(app.state.mutators.some((m) => m.id === "b")).toBe(false);
    expect(app.state.mutators.some((m) => m.id === "d")).toBe(true);
  });
});
