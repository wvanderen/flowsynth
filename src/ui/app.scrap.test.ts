// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { BALANCE } from "../engine/constants";
import { endSession, startSession } from "../engine/actions";
import { give } from "../engine/fixtures";
import { createAppFixture, setAppWidth } from "./testing/app-fixture";

// The scrap loop's player-facing controls (issue #377): the Forge draft's
// skip control with its payout, the tray's per-copy scrap chips with their
// recovery values — column and sheet — and the ledger's one balance read.

describe("the scrap controls (issue #377)", () => {
  const fixture = createAppFixture();
  const boot = fixture.boot;
  let app: App;

  beforeEach(() => {
    localStorage.clear();
    app = boot();
  });
  afterEach(() => fixture.release());

  const batchScrap = (ids: string[], scope = "#inventory-zone") => {
    const click = (selector: string) => document.querySelector<HTMLButtonElement>(`${scope} ${selector}`)!.click();
    click("[data-inventory-menu]"); click("[data-inventory-scrap-mode]");
    for (const id of ids) click(`[data-inv="${id}"]`);
    click("[data-inventory-review]"); click("[data-inventory-scrap-confirm]");
  };
  const status = () => document.getElementById("status")!.textContent ?? "";

  describe("the Forge draft's skip control", () => {
    beforeEach(() => {
      app.state.bankedRolls = [{
        id: "module-roll",
        candidates: [
          { id: "m1", type: "additive", tier: 0 },
          { id: "m2", type: "spacer", tier: 0 },
          { id: "m3", type: "chorus", tier: 0 }, // the uncommon: the payout
        ],
      }];
    });

    it("quotes the best candidate's scrap value and consumes the offer once", () => {
      app.openModal("forge");
      const skip = document.querySelector<HTMLButtonElement>("#modal-content [data-skip-offer]")!;
      expect(skip).not.toBeNull();
      expect(skip.getAttribute("aria-label")).toBe(`Skip draft · +${BALANCE.scrapValue.uncommon} scrap`);
      expect(skip.textContent).toContain(`+${BALANCE.scrapValue.uncommon}`);
      skip.click();
      expect(app.state.bankedRolls).toHaveLength(0);
      expect(app.state.scrap).toBe(BALANCE.scrapValue.uncommon);
      expect(status()).toContain(`Roll skipped · +${BALANCE.scrapValue.uncommon} scrap.`);
      // The panel rebuilds on the emptied queue; the consumed offer is gone.
      expect(document.querySelector("#modal-content [data-skip-offer]")).toBeNull();
      app.closeModal();
    });

    it("pays the same figure as taking the best candidate and scrapping it", () => {
      // The round trip through the controls themselves: take the uncommon
      // candidate, scrap the fresh mint from the tray, and read the balance.
      app.openModal("forge");
      document.querySelector<HTMLButtonElement>('[data-choice="m3"]')!.click();
      app.closeModal();
      // chooseCandidate arms placement; put the mint down.
      app.cancelPlacing();
      const minted = app.state.modules.find((m) => m.type === "chorus")!;
      expect(minted).toBeDefined();
      app.render();
      batchScrap([minted.id]);
      const roundTrip = app.state.scrap;
      expect(roundTrip).toBe(BALANCE.scrapValue.uncommon);
      // The same offer, skipped instead: the payout matches the round trip.
      app.state.scrap = 0;
      app.state.bankedRolls.push({
        id: "same-offer",
        candidates: [
          { id: "s1", type: "additive", tier: 0 },
          { id: "s2", type: "spacer", tier: 0 },
          { id: "s3", type: "chorus", tier: 0 },
        ],
      });
      app.render();
      app.openModal("forge");
      document.querySelector<HTMLButtonElement>("[data-skip-offer]")!.click();
      expect(app.state.scrap).toBe(roundTrip);
      app.closeModal();
    });

    it("advances to the next banked roll so skips chain in one visit", () => {
      app.state.bankedRolls.push({
        id: "module-roll-2",
        candidates: [
          { id: "n1", type: "harmonizer", tier: 0 },
          { id: "n2", type: "spacer", tier: 0 },
          { id: "n3", type: "spacer", tier: 0 },
        ],
      });
      app.openModal("forge");
      const skip = () => document.querySelector<HTMLButtonElement>("#modal-content [data-skip-offer]")!;
      // The panel presents the newest banked roll first.
      expect(skip().dataset.skipOffer).toBe("module-roll-2");
      skip().click();
      expect(skip().dataset.skipOffer).toBe("module-roll");
      skip().click();
      expect(app.state.scrap).toBe(BALANCE.scrapValue.common + BALANCE.scrapValue.uncommon);
      expect(document.querySelector("#modal-content [data-skip-offer]")).toBeNull();
      app.closeModal();
    });

    it("stands on the Modules face only: mutator drafts keep the no-consolation contract", () => {
      app.state.catalogEntryOwned = true;
      app.render();
      app.openModal("forge");
      // The queue holds a module roll, so the default face is Modules.
      expect(document.querySelector("#modal-content [data-skip-offer]")).not.toBeNull();
      document.querySelector<HTMLButtonElement>('#modal-content [data-forge-face="mutators"]')!.click();
      expect(document.querySelector("#modal-content [data-skip-offer]")).toBeNull();
      app.closeModal();
    });
  });

  describe("batch scrap selection", () => {
    it.each(["#inventory-zone", "#modal-content"])("reviews once, pays once, and updates the ledger from %s", (scope) => {
      const m = give(app.state, "chorus", null); m.tier = 1;
      app.render();
      if (scope === "#modal-content") { setAppWidth(390); app.openModal("inventory"); }
      batchScrap([m.id], scope);
      expect(app.state.modules).not.toContain(m);
      expect(app.state.scrap).toBe(BALANCE.scrapValue.uncommon * 2);
      expect(status()).toContain("1 module scrapped");
      expect(document.querySelector("#board-ledger [data-live='scrap']")!.textContent).toBe(String(BALANCE.scrapValue.uncommon * 2));
      app.confirmInventoryScrap();
      expect(app.state.scrap).toBe(BALANCE.scrapValue.uncommon * 2);
    });
    it("selects all matching, retains hidden selections, and cancels without loss", () => {
      const a = give(app.state, "additive", null); const b = give(app.state, "focusKeyed", null);
      app.render();
      const click = (sel: string) => document.querySelector<HTMLButtonElement>(`#inventory-zone ${sel}`)!.click();
      const filter = (value: string) => {
        const el = document.querySelector<HTMLSelectElement>("#inventory-zone [data-inventory-filter]")!;
        el.value = value; el.dispatchEvent(new Event("change"));
      };
      click("[data-inventory-menu]"); click("[data-inventory-scrap-mode]");
      filter("oscillator"); click("[data-inventory-select-all]");
      expect(app.ui.inventory.selected).toEqual([a.id]);
      expect(app.ui.placing).toBeNull();
      filter("generator"); click("[data-inventory-select-all]");
      expect(app.ui.inventory.selected).toEqual([a.id, b.id]);
      expect(document.querySelector(".inventory-selection")!.textContent).toContain("2 selected");
      click("[data-inventory-review]");
      expect(document.querySelector(".inventory-scrap-review")!.textContent).toContain("Sine");
      expect(document.querySelector(".inventory-scrap-review")!.textContent).toContain("Flywheel");
      click("[data-inventory-back]"); click("[data-inventory-cancel]");
      expect(app.state.modules).toContain(a); expect(app.state.modules).toContain(b); expect(app.state.scrap).toBe(0);
    });
    it("keeps scrap locked in flow and unlocks again between sessions", () => {
      give(app.state, "chorus", null); startSession(app.state, 600); app.render(); app.openModal("inventory");
      document.querySelector<HTMLButtonElement>("#modal-content [data-inventory-menu]")!.click();
      expect(document.querySelector<HTMLButtonElement>("#modal-content [data-inventory-scrap-mode]")!.disabled).toBe(true);
      endSession(app.state); app.render();
      expect(document.querySelector<HTMLButtonElement>("#modal-content [data-inventory-scrap-mode]")!.disabled).toBe(false);
    });
  });
});
