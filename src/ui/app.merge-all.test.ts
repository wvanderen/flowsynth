// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { BALANCE } from "../engine/constants";
import { endSession, startSession } from "../engine/actions";
import { give } from "../engine/fixtures";
import { hex } from "../engine/hex";
import { createAppFixture, setAppWidth } from "./testing/app-fixture";

// The library's MERGE ALL control (issue #368): the tray column's and the
// tray sheet's batch combine — the eligibility count, the pip mark on
// eligible tiles, the harmless zero read, the flow lock, and the sweep
// itself riding the one-combine terms.

describe("the tray's merge-all control (issue #368)", () => {
  const fixture = createAppFixture();
  const boot = fixture.boot;
  let app: App;

  beforeEach(() => {
    localStorage.clear();
    app = boot();
  });
  afterEach(() => fixture.release());

  const control = () => document.querySelector<HTMLButtonElement>("#inventory-zone [data-merge-all]")!;
  const status = () => document.getElementById("status")!.textContent ?? "";

  it("counts the eligible pairs and marks the tray tiles that carry a legal twin", () => {
    const twin = give(app.state, "additive", null); // pairs with the opening synth
    give(app.state, "harmonizer", null); // a singleton stays unmarked
    app.render();
    expect(control().textContent).toBe("MERGE ALL · 1");
    // The gloss carries the verb, never the count the label already shows.
    expect(control().title).toBe("Combines every eligible twin pair");
    const marked = document.querySelectorAll("#inventory-zone [data-mergeable]");
    expect(marked).toHaveLength(1);
    expect(marked[0]!.getAttribute("data-inv")).toBe(twin.id);
  });

  it("merges every eligible pair on one activation and reports the sweep", () => {
    const twin = give(app.state, "harmonizer", null, 1); // invested 10 — the melt
    const veteran = give(app.state, "harmonizer", hex(1, 0), 2); // retained
    give(app.state, "infusor", null); // a singleton keeps the control standing at zero
    app.render();
    control().click();
    expect(status()).toContain("MERGE ALL: 1 combine · 10 ν refunded");
    expect(app.state.modules.filter((m) => m.type === "harmonizer")).toHaveLength(1);
    expect(veteran.tier).toBe(1);
    expect(veteran.level).toBe(2);
    expect(app.state.modules.includes(twin)).toBe(false);
    expect(app.state.nous).toBe(22); // the 12 ν grant plus the 10 ν refund
    expect(control().textContent).toBe("MERGE ALL · 0");
  });

  it("is harmless with no eligible pairs: the refusal says why and nothing changes", () => {
    const cappedA = give(app.state, "additive", hex(1, 0));
    const cappedB = give(app.state, "additive", null);
    cappedA.tier = BALANCE.mergeCap;
    cappedB.tier = BALANCE.mergeCap;
    app.render();
    expect(control().textContent).toBe("MERGE ALL · 0");
    expect(document.querySelectorAll("[data-mergeable]")).toHaveLength(0);
    const before = {
      nous: app.state.nous,
      combinations: app.state.combinations,
      roster: app.state.modules.map((m) => m.id),
    };
    control().click();
    expect(status()).toContain("No eligible copies to combine.");
    expect(app.state.nous).toBe(before.nous);
    expect(app.state.combinations).toBe(before.combinations);
    expect(app.state.modules.map((m) => m.id)).toEqual(before.roster);
  });

  it("counts only exact copies: unequal tiers stay separate in the read and the sweep", () => {
    const low = give(app.state, "harmonizer", null);
    const high = give(app.state, "harmonizer", hex(1, 0));
    high.tier = 1;
    app.render();
    expect(control().textContent).toBe("MERGE ALL · 0");
    expect(document.querySelectorAll("[data-mergeable]")).toHaveLength(0);
    control().click();
    expect(app.state.modules.includes(low)).toBe(true);
    expect(app.state.modules.includes(high)).toBe(true);
    expect(low.tier).toBe(0);
  });

  it("chains pairs across the sweep: four tray twins collapse to one copy at the next tier of the next tier", () => {
    for (let i = 0; i < 4; i++) give(app.state, "infusor", null);
    app.render();
    expect(control().textContent).toBe("MERGE ALL · 3");
    control().click();
    const infusors = app.state.modules.filter((m) => m.type === "infusor");
    expect(infusors).toHaveLength(1);
    expect(infusors[0]!.tier).toBe(2);
    expect(app.state.combinations).toBe(3);
    expect(status()).toContain("MERGE ALL: 3 combines");
  });

  it("keeps the flow locks: the column hides and the sheet's control stands muted", () => {
    give(app.state, "harmonizer", null);
    give(app.state, "harmonizer", hex(1, 0));
    startSession(app.state, 600);
    app.render();
    expect(document.getElementById("inventory-zone")!.classList.contains("off")).toBe(true);
    app.openModal("inventory");
    const sheetControl = document.querySelector<HTMLButtonElement>("#modal-content [data-merge-all]")!;
    expect(sheetControl.disabled).toBe(true);
    expect(sheetControl.title).toBe("Locked during flow");
    endSession(app.state);
    app.render();
    expect(document.querySelector<HTMLButtonElement>("#modal-content [data-merge-all]")!.disabled).toBe(false);
    app.closeModal();
  });

  it("rides the tray sheet's Modules face only, and merges from the sheet", () => {
    const s = app.state;
    s.mode = "upgrade";
    s.catalogEntryOwned = true;
    s.mutatorSlots = [hex(0, 0)];
    s.mutators = [{ id: "mu1", family: "power", rarity: "common", pos: hex(0, 0) }];
    const twin = give(s, "harmonizer", null);
    const veteran = give(s, "harmonizer", hex(1, 0), 1);
    give(s, "infusor", null); // keeps the sheet's control standing after the sweep
    setAppWidth(390);
    app.render();
    app.openModal("inventory");
    const modal = () => document.getElementById("modal-content")!;
    expect(modal().querySelector("[data-merge-all]")).not.toBeNull();
    // The Mutators face carries no merge control: mutators combine by their
    // own drop gesture, never by the modules' sweep.
    (modal().querySelector('[data-legend-layer="mutators"]') as HTMLButtonElement).click();
    expect(modal().querySelector("[data-merge-all]")).toBeNull();
    (modal().querySelector('[data-legend-layer="modules"]') as HTMLButtonElement).click();
    expect(modal().querySelector("[data-merge-all]")).not.toBeNull();
    (modal().querySelector("[data-merge-all]") as HTMLButtonElement).click();
    expect(app.state.modules.filter((m) => m.type === "harmonizer")).toHaveLength(1);
    expect(veteran.tier).toBe(1);
    expect(app.state.modules.includes(twin)).toBe(false);
    // The sheet re-renders in place: the swept read stands at zero.
    expect(modal().querySelector<HTMLButtonElement>("[data-merge-all]")!.textContent).toBe("MERGE ALL · 0");
    app.closeModal();
  });
});
