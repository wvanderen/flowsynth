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
      document.querySelector<HTMLButtonElement>(`#inventory-zone [data-scrap='${minted.id}']`)!.click();
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

  describe("the tray's scrap chips", () => {
    it("scrap a tray copy once, pay its recovery value, and move the ledger read", () => {
      const module = give(app.state, "chorus", null);
      app.render();
      const chip = document.querySelector<HTMLButtonElement>("#inventory-zone [data-scrap]")!;
      expect(chip.getAttribute("aria-label")).toBe(`Scrap Chorus · +${BALANCE.scrapValue.uncommon} scrap`);
      expect(chip.textContent).toContain(`+${BALANCE.scrapValue.uncommon}`);
      const ledger = document.querySelector("#board-ledger [data-live='scrap']")!;
      expect(ledger.textContent).toBe("0");
      chip.click();
      expect(app.state.modules.includes(module)).toBe(false);
      expect(app.state.scrap).toBe(BALANCE.scrapValue.uncommon);
      expect(status()).toContain(`Chorus scrapped · +${BALANCE.scrapValue.uncommon} scrap.`);
      // The column rebuilt without the chip; the ledger's balance moved.
      expect(document.querySelector("#inventory-zone [data-scrap]")).toBeNull();
      expect(document.querySelector("#board-ledger [data-live='scrap']")!.textContent).toBe(String(BALANCE.scrapValue.uncommon));
    });

    it("scrap from the tray sheet and price carried tiers double", () => {
      const tiered = give(app.state, "harmonizer", null);
      tiered.tier = 1;
      give(app.state, "infusor", null);
      setAppWidth(390);
      app.render();
      app.openModal("inventory");
      const sheet = document.getElementById("modal-content")!;
      const chips = [...sheet.querySelectorAll<HTMLButtonElement>("[data-scrap]")];
      expect(chips).toHaveLength(2);
      const tieredChip = chips.find((c) => c.dataset.scrap === tiered.id)!;
      expect(tieredChip.getAttribute("aria-label")).toBe(`Scrap Harmonizer · +${BALANCE.scrapValue.common * 2} scrap`);
      tieredChip.click();
      expect(app.state.modules.includes(tiered)).toBe(false);
      expect(app.state.scrap).toBe(BALANCE.scrapValue.common * 2);
      app.closeModal();
    });

    it("keep the flow lock: the column hides and the sheet's chips stand muted", () => {
      give(app.state, "chorus", null);
      startSession(app.state, 600);
      app.render();
      expect(document.getElementById("inventory-zone")!.classList.contains("off")).toBe(true);
      app.openModal("inventory");
      const chip = document.querySelector<HTMLButtonElement>("#modal-content [data-scrap]")!;
      expect(chip.disabled).toBe(true);
      endSession(app.state);
      app.render();
      expect(document.querySelector<HTMLButtonElement>("#modal-content [data-scrap]")!.disabled).toBe(false);
      app.closeModal();
    });

    it("never double-pay: the scrapped id is gone, a second press refuses", () => {
      const module = give(app.state, "harmonizer", null);
      app.render();
      document.querySelector<HTMLButtonElement>("#inventory-zone [data-scrap]")!.click();
      const before = app.state.scrap;
      document.querySelector<HTMLButtonElement>("#inventory-zone [data-scrap]")?.click();
      expect(app.state.scrap).toBe(before);
      expect(app.state.modules.includes(module)).toBe(false);
    });
  });
});
