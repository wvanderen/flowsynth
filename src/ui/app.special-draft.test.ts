// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { BALANCE, CATEGORY_OF } from "../engine/constants";
import { startSession } from "../engine/actions";
import { createAppFixture, setAppWidth } from "./testing/app-fixture";

// The special drafts' player-facing rows (issue #379): the catalog's
// Special Drafts section (2026-10-18 feedback) — name, trimmed effect
// line, the scrap price beside its Roll control, and the Jacquard Card's
// category symbols that roll the chosen draft. The balance they spend is
// the one canonical scrap balance; the candidates they mint stand in the
// Forge under the product's own name and resolve with the ordinary choose
// and skip.

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
  const openScrap = () => {
    app.openModal("catalog");
    document.querySelector<HTMLButtonElement>('[data-catalog-face="scrap"]')!.click();
  };
  const rows = () => [...document.querySelectorAll("#modal-content .catalog-row")].filter((r) => r.querySelector("[data-buy-special]"));
  const rowOf = (name: string) => rows().find((r) => r.querySelector("h3")!.textContent === name)!;
  const buyOf = (name: string) => rowOf(name).querySelector<HTMLButtonElement>("[data-buy-special]")!;
  const rowRollOf = (name: string) => rowOf(name).querySelector<HTMLButtonElement>("[data-roll-special]")!;
  const rollPicks = () => [...document.querySelectorAll<HTMLButtonElement>("#modal-content .special-roll-pick")];
  const heldOf = (name: string) => rowOf(name).querySelector(".shop-countdown")?.textContent ?? "";
  const effectOf = (name: string) => {
    const note = rowOf(name).querySelector(".t-note")!.cloneNode(true) as HTMLElement;
    note.querySelectorAll(".inst-tip-body").forEach((tip) => tip.remove());
    return note.textContent;
  };

  it("renders the three products with name, trimmed effect, and price — muted at an empty balance", () => {
    openScrap();
    expect(rows().map((r) => r.querySelector("h3")!.textContent)).toEqual(["Jacquard Card", "Silk Warp", "Plied Weft"]);
    expect(rowOf("Jacquard Card").querySelector(".t-note")!.textContent).toContain("Your chosen category");
    expect(effectOf("Silk Warp")).toContain("Every candidate rare");
    expect(effectOf("Plied Weft")).toContain("one merge tier up");
    expect(buyOf("Jacquard Card").getAttribute("aria-label")).toBe(`Buy a Jacquard Card · ${BALANCE.specialDraftCosts.category} scrap`);
    expect(buyOf("Silk Warp").getAttribute("aria-label")).toBe(`Buy a Silk Warp · ${BALANCE.specialDraftCosts.rare} scrap`);
    expect(buyOf("Plied Weft").getAttribute("aria-label")).toBe(`Buy a Plied Weft · ${BALANCE.specialDraftCosts.tier} scrap`);
    for (const name of ["Jacquard Card", "Silk Warp", "Plied Weft"]) {
      expect(buyOf(name).disabled).toBe(true); // the opening balance carries no scrap
    }
    // The Roll controls stand visible but muted while nothing is held.
    expect(rowRollOf("Silk Warp").disabled).toBe(true);
    expect(rowRollOf("Plied Weft").disabled).toBe(true);
    expect(rowOf("Jacquard Card").querySelector("[data-roll-special]")).toBeNull();
    // The held count renders on every row — "0 held" keeps the row's
    // height steady as entitlements come and go.
    expect(heldOf("Jacquard Card")).toBe("0 held");
    expect(heldOf("Silk Warp")).toBe("0 held");
    expect(heldOf("Plied Weft")).toBe("0 held");
    // The category symbols wait for a held Card — hidden until then,
    // too bulky to stand on the face unowned (2026-10-18 feedback).
    expect(rollPicks()).toHaveLength(0);
    // No info icons: the rows carry name, note, and price alone — the
    // only disclosures left are the hoverable domain terms.
    expect(document.querySelectorAll("#modal-content .loom-tip")).toHaveLength(0);
    for (const trigger of document.querySelectorAll("#modal-content .catalog-row .inst-tip-trigger")) {
      expect(trigger.classList.contains("term-trigger")).toBe(true);
    }
    app.closeModal();
  });

  it("buys from the canonical scrap balance, shows the held count, and arms the Roll", () => {
    app.state.scrap = 400;
    app.render();
    openScrap();
    buyOf("Jacquard Card").click();
    expect(app.state.scrap).toBe(400 - BALANCE.specialDraftCosts.category);
    expect(app.state.specialDrafts.category).toBe(1);
    expect(status()).toContain("Jacquard Card bought · 1 held.");
    // The rebuilt row shows the held count and the live symbols; the loom
    // row's price still reads the one balance.
    expect(heldOf("Jacquard Card")).toBe("1 held");
    expect(rollPicks()).toHaveLength(8);
    expect(rollPicks()[0]!.getAttribute("aria-label")).toBe("Roll the held Jacquard Card · Oscillator draft");
    for (const pick of rollPicks()) expect(pick.disabled).toBe(false);
    buyOf("Silk Warp").click();
    buyOf("Plied Weft").click();
    expect(rowRollOf("Silk Warp").disabled).toBe(false);
    expect(rowRollOf("Plied Weft").disabled).toBe(false);
    app.closeModal();
  });

  it("discloses category meanings without spending the held Card", () => {
    app.state.specialDrafts.category = 1;
    openScrap();
    const term = document.querySelector<HTMLButtonElement>('.special-category-choice [aria-label="Spacer — what it means"]')!;
    term.focus();
    expect(term.getAttribute("aria-expanded")).toBe("true");
    term.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(term.getAttribute("aria-expanded")).toBe("false");
    term.click();
    expect(term.getAttribute("aria-expanded")).toBe("true");
    expect(app.state.specialDrafts.category).toBe(1);
    expect(app.state.bankedRolls).toHaveLength(0);
    expect(document.querySelector(".special-category-choice button button")).toBeNull();
    app.closeModal();
  });

  it("rolls the chosen category from its symbol without touching the others", () => {
    app.state.specialDrafts.category = 1;
    app.render();
    openScrap();
    const pick = rollPicks().find((p) => p.dataset.specialCategory === "spacer")!;
    expect(pick.disabled).toBe(false);
    pick.click();
    expect(app.state.specialDrafts.category).toBe(0);
    expect(app.state.bankedRolls[0]!.candidates.every((c) => CATEGORY_OF[c.type] === "spacer")).toBe(true);
    // The spent entitlement mutes the strip again.
    for (const p of rollPicks()) expect(p.disabled).toBe(true);
    app.closeModal();
  });

  it("rolls the Jacquard Card into a category-guaranteed offer the Forge resolves under its name", () => {
    app.state.scrap = BALANCE.specialDraftCosts.category;
    app.render();
    openScrap();
    buyOf("Jacquard Card").click();
    const chip = document.querySelector<HTMLButtonElement>('#modal-content [data-roll-special="category"][data-special-category="spacer"]')!;
    chip.click();
    expect(app.state.specialDrafts.category).toBe(0);
    expect(app.state.bankedRolls).toHaveLength(1);
    expect(app.state.bankedRolls[0]!.candidates.every((c) => CATEGORY_OF[c.type] === "spacer")).toBe(true);
    expect(status()).toContain("Jacquard Card rolled · Spacer draft banked.");
    // The rolled offer stands in the Forge under the product's own name
    // and guarantee; the same choose and skip resolve it there.
    app.openModal("forge");
    const note = document.querySelector("#modal-content .forge-offer-note")!;
    expect(note.querySelector(".t-condensed")!.textContent).toBe("Jacquard Card");
    const visibleNote = note.cloneNode(true) as HTMLElement;
    visibleNote.querySelectorAll(".inst-tip-body").forEach((tip) => tip.remove());
    expect(visibleNote.textContent).toContain("Spacer draft");
    expect(document.querySelectorAll("#modal-content .candidate-tile")).toHaveLength(3);
    expect(document.querySelector("#modal-content .forge-skip")).not.toBeNull();
    app.closeModal();
    // The symbols muted again with the spent entitlement.
    openScrap();
    for (const pick of rollPicks()) expect(pick.disabled).toBe(true);
    app.closeModal();
  });

  it("rolls the Silk Warp and the Plied Weft from their row buttons", () => {
    app.state.scrap = BALANCE.specialDraftCosts.rare + BALANCE.specialDraftCosts.tier;
    app.render();
    openScrap();
    buyOf("Silk Warp").click();
    rowRollOf("Silk Warp").click();
    expect(app.state.specialDrafts.rare).toBe(0);
    expect(status()).toContain("Silk Warp rolled · rare draft banked.");
    buyOf("Plied Weft").click();
    rowRollOf("Plied Weft").click();
    expect(app.state.bankedRolls.at(-1)!.candidates.every((c) => c.tier >= 1)).toBe(true);
    expect(status()).toContain("Plied Weft rolled · tiered draft banked.");
    // The Silk Warp's rolled offer still banks its rares.
    expect(app.state.bankedRolls[0]!.candidates.every((c) => c.tier >= 0)).toBe(true);
    app.closeModal();
  });

  it("mutes an unaffordable buy without touching the balance", () => {
    app.state.scrap = BALANCE.specialDraftCosts.rare - 1;
    app.render();
    openScrap();
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
      openScrap();
      expect(buyOf("Plied Weft").disabled).toBe(true);
      buyOf("Plied Weft").click();
      expect(app.state.scrap).toBe(5_000);
      expect(app.state.specialDrafts.tier).toBe(0);
    } finally {
      BALANCE.mergeCap = cap;
    }
    app.closeModal();
  });

  it("keeps the flow lock across buys, rolls, and picks", () => {
    app.state.scrap = 1_000;
    app.state.specialDrafts = { category: 1, rare: 1, tier: 1 };
    app.render();
    startSession(app.state, 600);
    app.render();
    openScrap();
    for (const name of ["Jacquard Card", "Silk Warp", "Plied Weft"]) {
      expect(buyOf(name).disabled).toBe(true);
    }
    expect(rowRollOf("Silk Warp").disabled).toBe(true);
    expect(rowRollOf("Plied Weft").disabled).toBe(true);
    for (const pick of rollPicks()) expect(pick.disabled).toBe(true);
    const before = app.state.bankedRolls.length;
    rollPicks()[0]!.click();
    expect(app.state.bankedRolls).toHaveLength(before);
    app.closeModal();
  });

  it("reads at phone width: the rows and their affordances hold at 390px", () => {
    app.state.scrap = BALANCE.specialDraftCosts.category + BALANCE.specialDraftCosts.tier;
    setAppWidth(390);
    app.render();
    openScrap();
    expect(rows()).toHaveLength(3);
    buyOf("Jacquard Card").click();
    // The picks keep their touch target: the stylesheet pins the 44px
    // minimum height (the fixture performs no layout).
    expect(readFileSync("src/ui/style.css", "utf8")).toMatch(
      /\.special-roll-pick \{[^}]*min-height:\s*44px/,
    );
    const chip = document.querySelector<HTMLButtonElement>('#modal-content [data-special-category="generator"]')!;
    chip.click();
    expect(app.state.specialDrafts.category).toBe(0);
    expect(app.state.bankedRolls[0]!.candidates.every((c) => CATEGORY_OF[c.type] === "generator")).toBe(true);
    app.closeModal();
  });
});
