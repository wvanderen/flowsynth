// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { BALANCE } from "../engine/constants";
import { unlockedMergeCap } from "../engine/catalog";
import { setAppWidth, createAppFixture } from "./testing/app-fixture";

// The Warp Beam's row (issue #380, parent #366): the Arete Catalog's
// merge-cap product in the capacity rows' own grammar, and the cap
// contract it serves — the Plied Weft's availability and the drafts'
// offered tiers read the one unlocked cap the purchase raises, never a
// separate hard-coded limit.

describe("the Warp Beam's row (issue #380)", () => {
  const fixture = createAppFixture();
  const boot = fixture.boot;
  let app: App;

  beforeEach(() => {
    localStorage.clear();
    app = boot();
    app.state.catalogEntryOwned = true;
  });
  afterEach(() => fixture.release());

  const status = () => document.getElementById("status")!.textContent ?? "";
  const openArete = () => {
    app.openModal("catalog");
    // The door opens on the mode's face — flip to ◇ through the switch.
    document.querySelector<HTMLButtonElement>('[data-catalog-face="arete"]')!.click();
  };
  const beamRow = () => [...document.querySelectorAll("#modal-content .catalog-row")].find((r) => r.textContent!.includes("Warp Beam"))!;
  const beamBuy = () => beamRow().querySelector<HTMLButtonElement>("#buy-arete-beam")!;
  const pliedBuy = () => [...document.querySelectorAll<HTMLButtonElement>("#modal-content [data-buy-special]")].find((b) => b.getAttribute("data-buy-special") === "tier")!;

  it("renders the product with its owned figure, cap delta, and Arete price — muted until affordable", () => {
    openArete();
    expect(beamRow()).toBeTruthy();
    expect(beamRow().querySelector(".mono")!.textContent).toBe(`0/${BALANCE.mergeCapCosts.length}`);
    expect(beamRow().textContent).toContain(`Tier ${BALANCE.mergeCap + 1} → Tier ${BALANCE.mergeCap + 2}`);
    expect(beamBuy().textContent).toBe(`5 Arete`);
    expect(beamBuy().disabled).toBe(true); // the fresh state banks no Arete
    app.state.arete = BALANCE.mergeCapCosts[0];
    app.render();
    expect(beamBuy().disabled).toBe(false);
    app.closeModal();
  });

  it("buys a rung: the Arete balance pays, the cap advances, and the toast names the beat", () => {
    app.state.arete = BALANCE.mergeCapCosts[0] + BALANCE.mergeCapCosts[1];
    openArete();
    beamBuy().click();
    expect(app.state.mergeCapPurchases).toBe(1);
    expect(app.state.arete).toBe(BALANCE.mergeCapCosts[1]);
    expect(unlockedMergeCap(app.state)).toBe(BALANCE.mergeCap + 1);
    expect(status()).toContain(`Merge cap raised — copies now combine to Tier ${BALANCE.mergeCap + 2}.`);
    // The rebuilt row quotes the next rung against the raised cap.
    expect(beamRow().querySelector(".mono")!.textContent).toBe(`1/${BALANCE.mergeCapCosts.length}`);
    expect(beamRow().textContent).toContain(`Tier ${BALANCE.mergeCap + 2} → Tier ${BALANCE.mergeCap + 3}`);
    app.closeModal();
  });

  it("stands sold out at the ladder's end: the engraved word lands, no price remains", () => {
    app.state.mergeCapPurchases = BALANCE.mergeCapCosts.length;
    openArete();
    expect(beamRow().querySelector(".mono")!.textContent).toBe(`${BALANCE.mergeCapCosts.length}/${BALANCE.mergeCapCosts.length}`);
    expect(beamRow().textContent).toContain("extended");
    expect(document.getElementById("buy-arete-beam")).toBeNull();
    app.closeModal();
  });

  it("mutes in flow like every Arete purchase", () => {
    app.state.arete = BALANCE.mergeCapCosts[0];
    openArete();
    app.state.mode = "flow";
    app.render();
    expect(beamBuy().disabled).toBe(true);
    app.state.mode = "upgrade";
    app.closeModal();
  });

  it("the Plied Weft's availability rides the raised cap, across the two surfaces", () => {
    const base = BALANCE.mergeCap;
    BALANCE.mergeCap = 0; // a degenerate cap: no draft can mint above base
    try {
      app.state.scrap = BALANCE.specialDraftCosts.tier;
      app.openModal("forge");
      expect(pliedBuy().disabled).toBe(true);
      app.closeModal();
      // The rung raises the cap from 0 to 1: the tier product arms.
      app.state.arete = BALANCE.mergeCapCosts[0];
      openArete();
      beamBuy().click();
      app.closeModal();
      app.openModal("forge");
      expect(pliedBuy().disabled).toBe(false);
      expect(unlockedMergeCap(app.state)).toBe(1);
    } finally {
      BALANCE.mergeCap = base;
    }
    app.closeModal();
  });

  it("reads at phone width: the row and its buy hold at 390px", () => {
    app.state.arete = BALANCE.mergeCapCosts[0];
    setAppWidth(390);
    app.render();
    openArete();
    expect(beamBuy().disabled).toBe(false);
    beamBuy().click();
    expect(app.state.mergeCapPurchases).toBe(1);
    expect(status()).toContain("Merge cap raised");
    app.closeModal();
  });
});
