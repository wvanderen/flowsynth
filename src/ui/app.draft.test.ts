// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { BALANCE } from "../engine/constants";
import { startSession } from "../engine/actions";
import { createAppFixture, setAppWidth } from "./testing/app-fixture";

// The Draft Loom's player-facing controls (issue #378): the Forge's
// Modules-face purchase row — the tier-bonus chance read, the scrap price,
// and the state grammar that mutes what cannot charge. The balance it
// spends is the one canonical scrap balance.

describe("the Draft Loom row (issue #378)", () => {
  const fixture = createAppFixture();
  const boot = fixture.boot;
  let app: App;

  beforeEach(() => {
    localStorage.clear();
    app = boot();
  });
  afterEach(() => fixture.release());

  const status = () => document.getElementById("status")!.textContent ?? "";
  const row = () => document.querySelector("#modal-content .forge-loom")!;
  const chanceText = () => {
    const readout = row().querySelector(".loom-state")!.cloneNode(true) as HTMLElement;
    readout.querySelectorAll(".inst-tip-body").forEach((tip) => tip.remove());
    return readout.textContent;
  };
  const buy = () => document.querySelector<HTMLButtonElement>("#modal-content [data-buy-draft-upgrade]")!;

  it("renders name, current chance, and the first rung's price — muted at an empty balance", () => {
    app.openModal("forge");
    expect(row()).not.toBeNull();
    expect(row().querySelector(".loom-name")!.textContent).toBe("Draft Loom");
    expect(chanceText()).toBe("merge tier bonus 0% → 15%");
    expect(buy().getAttribute("aria-label")).toBe(`Improve the Draft Loom to 15% tier bonus · ${BALANCE.tierBonusCosts[0]} scrap`);
    expect(buy().textContent).toContain(String(BALANCE.tierBonusCosts[0]));
    expect(buy().disabled).toBe(true); // the opening balance carries no scrap
    app.closeModal();
  });

  it("buys from the canonical scrap balance and re-quotes the next rung", () => {
    app.state.scrap = BALANCE.tierBonusCosts[0] + 10;
    app.render();
    app.openModal("forge");
    expect(buy().disabled).toBe(false);
    buy().click();
    expect(app.state.scrap).toBe(10);
    expect(app.state.draftTierBonus).toBe(1);
    expect(status()).toContain("Draft Loom improved · tier bonus 15%.");
    // The rebuilt row quotes the next rung and the raised chance.
    expect(chanceText()).toBe("merge tier bonus 15% → 30%");
    expect(buy().getAttribute("aria-label")).toBe(`Improve the Draft Loom to 30% tier bonus · ${BALANCE.tierBonusCosts[1]} scrap`);
    app.closeModal();
  });

  it("mutes an unaffordable price without touching the balance", () => {
    app.state.scrap = BALANCE.tierBonusCosts[0] - 1;
    app.render();
    app.openModal("forge");
    expect(buy().disabled).toBe(true);
    buy().click(); // a muted control refuses pointer activation
    expect(app.state.scrap).toBe(BALANCE.tierBonusCosts[0] - 1);
    expect(app.state.draftTierBonus).toBe(0);
    app.closeModal();
  });

  it("retires the buy at the ladder's end: the row reads Tuned", () => {
    app.state.scrap = 10_000;
    app.state.draftTierBonus = BALANCE.tierBonusCosts.length;
    app.render();
    app.openModal("forge");
    expect(document.querySelector("#modal-content [data-buy-draft-upgrade]")).toBeNull();
    expect(row().querySelector(".loom-tuned")!.textContent).toBe("Tuned");
    expect(chanceText()).toBe("merge tier bonus 50%");
    app.closeModal();
  });

  it("keeps the flow lock: the buy stands muted mid-session", () => {
    app.state.scrap = 500;
    app.render();
    startSession(app.state, 600);
    app.render();
    app.openModal("forge");
    expect(buy().disabled).toBe(true);
    app.closeModal();
  });

  it("stands on the Modules face only", () => {
    app.state.catalogEntryOwned = true;
    app.state.scrap = 500;
    app.render();
    app.openModal("forge");
    expect(row()).not.toBeNull();
    document.querySelector<HTMLButtonElement>('#modal-content [data-forge-face="mutators"]')!.click();
    expect(document.querySelector("#modal-content .forge-loom")).toBeNull();
    app.closeModal();
  });

  it("reads at phone width: the row and its affordances hold at 390px", () => {
    app.state.scrap = BALANCE.tierBonusCosts[0];
    setAppWidth(390);
    app.render();
    app.openModal("forge");
    expect(row()).not.toBeNull();
    expect(row().querySelector(".loom-name")!.textContent).toBe("Draft Loom");
    const button = buy();
    expect(button.disabled).toBe(false);
    // The control keeps its touch target: the stylesheet pins the 44px
    // minimum height (the fixture performs no layout).
    expect(readFileSync("src/ui/style.css", "utf8")).toMatch(
      /\.forge-loom \.loom-buy \{[^}]*min-height:\s*44px/,
    );
    button.click();
    expect(app.state.draftTierBonus).toBe(1);
    expect(app.state.scrap).toBe(0);
    app.closeModal();
  });
});
