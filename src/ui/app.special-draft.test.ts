// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { BALANCE, CATEGORY_OF } from "../engine/constants";
import { startSession } from "../engine/actions";
import { createAppFixture, setAppWidth } from "./testing/app-fixture";

// The special drafts' player-facing rows (issue #379): the Forge's
// Modules-face products under the Draft Loom row — name, effect, price,
// held state, and the weave controls that bank a guaranteed offer into
// the ordinary queue. The balance they spend is the one canonical scrap
// balance; the candidates they mint resolve with the ordinary choose and
// skip.

describe("the special drafts' rows (issue #379)", () => {
  const fixture = createAppFixture();
  const boot = fixture.boot;
  let app: App;

  beforeEach(() => {
    localStorage.clear();
    app = boot();
  });
  afterEach(() => fixture.release());

  const status = () => document.getElementById("status")!.textContent ?? "";
  const rows = () => [...document.querySelectorAll("#modal-content .forge-special")];
  const rowOf = (name: string) => rows().find((r) => r.querySelector(".special-name")!.textContent === name)!;
  const buyOf = (name: string) => rowOf(name).querySelector<HTMLButtonElement>("[data-buy-special]")!;
  const weaves = () => [...document.querySelectorAll<HTMLButtonElement>("#modal-content [data-weave-special]")];
  const heldOf = (name: string) => rowOf(name).querySelector(".loom-state")?.textContent ?? "";
  const effectOf = (name: string) => {
    const effect = rowOf(name).querySelector(".special-effect")!.cloneNode(true) as HTMLElement;
    effect.querySelectorAll(".inst-tip-body").forEach((tip) => tip.remove());
    return effect.textContent;
  };
  const candidates = () => [...document.querySelectorAll("#modal-content .candidate-tile")];

  it("renders the three products with name, effect, and price — muted at an empty balance", () => {
    app.openModal("forge");
    expect(rows().map((r) => r.querySelector(".special-name")!.textContent)).toEqual(["Jacquard Card", "Silk Warp", "Plied Weft"]);
    expect(rowOf("Jacquard Card").querySelector(".special-effect")!.textContent).toContain("One draft, your chosen category");
    expect(effectOf("Silk Warp")).toContain("every candidate rare");
    expect(effectOf("Plied Weft")).toContain("one merge tier up");
    expect(buyOf("Jacquard Card").getAttribute("aria-label")).toBe(`Buy a Jacquard Card · ${BALANCE.specialDraftCosts.category} scrap`);
    expect(buyOf("Silk Warp").getAttribute("aria-label")).toBe(`Buy a Silk Warp · ${BALANCE.specialDraftCosts.rare} scrap`);
    expect(buyOf("Plied Weft").getAttribute("aria-label")).toBe(`Buy a Plied Weft · ${BALANCE.specialDraftCosts.tier} scrap`);
    for (const name of ["Jacquard Card", "Silk Warp", "Plied Weft"]) {
      expect(buyOf(name).disabled).toBe(true); // the opening balance carries no scrap
    }
    expect(weaves()).toHaveLength(0); // nothing held, nothing to weave
    app.closeModal();
  });

  it("buys from the canonical scrap balance, shows the held count, and arms the weave", () => {
    app.state.scrap = 400;
    app.render();
    app.openModal("forge");
    buyOf("Jacquard Card").click();
    expect(app.state.scrap).toBe(400 - BALANCE.specialDraftCosts.category);
    expect(app.state.specialDrafts.category).toBe(1);
    expect(status()).toContain("Jacquard Card bought · 1 held.");
    // The rebuilt row shows the held count and the chip strip; the loom
    // row's price still reads the one balance.
    expect(heldOf("Jacquard Card")).toBe("1 held");
    const picks = document.querySelectorAll<HTMLButtonElement>("#modal-content .special-weave-pick");
    expect(picks).toHaveLength(8);
    expect(picks[0]!.getAttribute("aria-label")).toBe("Weave the held Jacquard Card · Oscillator draft");
    buyOf("Silk Warp").click();
    buyOf("Plied Weft").click();
    expect(rowOf("Silk Warp").querySelector<HTMLButtonElement>("[data-weave-special]:not(.special-weave-pick)")!.disabled).toBe(false);
    expect(rowOf("Plied Weft").querySelector<HTMLButtonElement>("[data-weave-special]:not(.special-weave-pick)")!.disabled).toBe(false);
    app.closeModal();
  });

  it("discloses categories without spending the held draft", () => {
    app.state.specialDrafts.category = 1;
    app.render();
    app.openModal("forge");
    const group = document.querySelector(".special-category-pick")!;
    const term = group.querySelector<HTMLButtonElement>(".term-trigger")!;
    const weave = group.querySelector<HTMLButtonElement>(".special-weave-pick")!;
    expect(term.textContent).toBe("Oscillator");
    expect(weave.textContent).toBe("Weave");
    term.focus();
    expect(term.getAttribute("aria-expanded")).toBe("true");
    term.click(); // the same activation used by touch and Enter
    expect(document.getElementById(term.getAttribute("aria-describedby")!)!.classList.contains("inst-show")).toBe(true);
    expect(app.state.specialDrafts.category).toBe(1);
    expect(app.state.bankedRolls).toHaveLength(0);
    term.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(term.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector("#modal-content .special-weaves")).not.toBeNull();
    weave.click();
    expect(app.state.specialDrafts.category).toBe(0);
    expect(app.state.bankedRolls[0]!.candidates.every((c) => CATEGORY_OF[c.type] === "oscillator")).toBe(true);
    app.closeModal();
  });

  it("weaves the Jacquard Card into a category-guaranteed offer the Forge resolves", () => {
    app.state.scrap = BALANCE.specialDraftCosts.category;
    app.render();
    app.openModal("forge");
    buyOf("Jacquard Card").click();
    const chip = document.querySelector<HTMLButtonElement>('#modal-content [data-weave-special="category"][data-special-category="spacer"]')!;
    chip.click();
    expect(app.state.specialDrafts.category).toBe(0);
    expect(app.state.bankedRolls).toHaveLength(1);
    expect(app.state.bankedRolls[0]!.candidates.every((c) => CATEGORY_OF[c.type] === "spacer")).toBe(true);
    expect(status()).toContain("Jacquard Card woven · Spacer draft banked.");
    // The woven offer stands in the ordinary candidates row — the same
    // choose and skip resolve it.
    expect(candidates()).toHaveLength(3);
    expect(document.querySelector("#modal-content .forge-skip")).not.toBeNull();
    // The chip strip retired with the spent entitlement.
    expect(document.querySelectorAll("#modal-content .special-weave-pick")).toHaveLength(0);
    app.closeModal();
  });

  it("weaves the Silk Warp and the Plied Weft from their row buttons", () => {
    app.state.scrap = BALANCE.specialDraftCosts.rare + BALANCE.specialDraftCosts.tier;
    app.render();
    app.openModal("forge");
    buyOf("Silk Warp").click();
    rowOf("Silk Warp").querySelector<HTMLButtonElement>("[data-weave-special]")!.click();
    expect(app.state.specialDrafts.rare).toBe(0);
    expect(status()).toContain("Silk Warp woven · rare draft banked.");
    buyOf("Plied Weft").click();
    rowOf("Plied Weft").querySelector<HTMLButtonElement>("[data-weave-special]")!.click();
    expect(app.state.bankedRolls.at(-1)!.candidates.every((c) => c.tier >= 1)).toBe(true);
    expect(status()).toContain("Plied Weft woven · tiered draft banked.");
    // The Silk Warp's woven offer still banks its rares.
    expect(app.state.bankedRolls[0]!.candidates.every((c) => c.tier >= 0)).toBe(true);
    app.closeModal();
  });

  it("mutes an unaffordable buy without touching the balance", () => {
    app.state.scrap = BALANCE.specialDraftCosts.rare - 1;
    app.render();
    app.openModal("forge");
    expect(buyOf("Silk Warp").disabled).toBe(true);
    buyOf("Silk Warp").click();
    expect(app.state.scrap).toBe(BALANCE.specialDraftCosts.rare - 1);
    expect(app.state.specialDrafts.rare).toBe(0);
    app.closeModal();
  });

  it("mutes the Plied Weft when no candidate could benefit, with the balance untouched", () => {
    const cap = BALANCE.mergeCap;
    BALANCE.mergeCap = 0;
    try {
      app.state.scrap = 5_000;
      app.render();
      app.openModal("forge");
      expect(buyOf("Plied Weft").disabled).toBe(true);
      buyOf("Plied Weft").click();
      expect(app.state.scrap).toBe(5_000);
      expect(app.state.specialDrafts.tier).toBe(0);
    } finally {
      BALANCE.mergeCap = cap;
    }
    app.closeModal();
  });

  it("keeps the flow lock across buys, weaves, and picks", () => {
    app.state.scrap = 1_000;
    app.state.specialDrafts = { category: 1, rare: 1, tier: 1 };
    app.render();
    startSession(app.state, 600);
    app.render();
    app.openModal("forge");
    for (const name of ["Jacquard Card", "Silk Warp", "Plied Weft"]) {
      expect(buyOf(name).disabled).toBe(true);
    }
    for (const weave of weaves()) {
      expect(weave.disabled).toBe(true);
    }
    const before = app.state.bankedRolls.length;
    weaves()[0]!.click();
    expect(app.state.bankedRolls).toHaveLength(before);
    app.closeModal();
  });

  it("reads at phone width: the rows and their affordances hold at 390px", () => {
    app.state.scrap = BALANCE.specialDraftCosts.category + BALANCE.specialDraftCosts.tier;
    setAppWidth(390);
    app.render();
    app.openModal("forge");
    expect(rows()).toHaveLength(3);
    expect(document.querySelectorAll("#modal-content .special-weave-pick")).toHaveLength(0);
    buyOf("Jacquard Card").click();
    // The picks keep their touch target: the stylesheet pins the 44px
    // minimum height (the fixture performs no layout).
    expect(readFileSync("src/ui/style.css", "utf8")).toMatch(
      /\.special-weaves \.special-weave-pick \{[^}]*min-height:\s*44px/,
    );
    const chip = document.querySelector<HTMLButtonElement>('#modal-content [data-special-category="generator"]')!;
    chip.click();
    expect(app.state.specialDrafts.category).toBe(0);
    expect(app.state.bankedRolls[0]!.candidates.every((c) => CATEGORY_OF[c.type] === "generator")).toBe(true);
    app.closeModal();
  });
});
