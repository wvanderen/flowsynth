import { describe, expect, it } from "vitest";
import { buySpecialDraft, chooseRoll, prestige, scrapModule, skipRoll, startSession, useSpecialDraft } from "./actions";
import { ARETE_HORIZON } from "./accumulator";
import { BALANCE, TYPE_RARITY } from "./constants";
import { fresh, stubRng } from "./fixtures";
import { generateSpecialOffer } from "./rolls";
import { deserialize, serialize } from "./save";
import type { GameState } from "./types";

// The special drafts (issue #379, parent #366): scrap buys one-time
// entitlements whose woven offer carries an explicit guarantee every
// candidate satisfies — a category, the rare band, or one merge tier up.
// Every read goes through the public actions and the generation seam's
// controlled randomness. Per-slot streams: category 6 draws at no loom
// rungs (band, type) and 9 with; rare 6/9 (category, type); tier 9/12
// (band, category, type, then the lift while rungs are owned). The woven
// offer banks into the ordinary queue, so choice, skip, and scrap read
// the one authoritative schedule.

describe("the special drafts' purchase", () => {
  it("buys an entitlement from the scrap balance, exactly once charged", () => {
    const s = fresh();
    s.scrap = 400;
    expect(buySpecialDraft(s, "category").ok).toBe(true);
    expect(s.scrap).toBe(400 - BALANCE.specialDraftCosts.category);
    expect(s.specialDrafts.category).toBe(1);
    expect(buySpecialDraft(s, "rare").ok).toBe(true);
    expect(buySpecialDraft(s, "tier").ok).toBe(true);
    expect(s.specialDrafts).toEqual({ category: 1, rare: 1, tier: 1 });
  });

  it("refuses an unaffordable price without consuming scrap", () => {
    const s = fresh();
    s.scrap = BALANCE.specialDraftCosts.category - 1;
    const result = buySpecialDraft(s, "category");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("scrap");
    expect(s.scrap).toBe(BALANCE.specialDraftCosts.category - 1);
    expect(s.specialDrafts.category).toBe(0);
  });

  it("refuses the tier product when no candidate could benefit, without loss", () => {
    const cap = BALANCE.mergeCap;
    BALANCE.mergeCap = 0; // a degenerate cap: no tier can mint above base
    try {
      const s = fresh();
      s.scrap = 5_000;
      const result = buySpecialDraft(s, "tier");
      expect(result.ok).toBe(false);
      expect(result.reason).toContain("base tier");
      expect(s.scrap).toBe(5_000);
      expect(s.specialDrafts.tier).toBe(0);
    } finally {
      BALANCE.mergeCap = cap;
    }
  });

  it("stands behind the flow lock on both the purchase and the weave", () => {
    const s = fresh();
    s.scrap = 1_000;
    s.specialDrafts.category = 1;
    startSession(s, 600);
    expect(buySpecialDraft(s, "category").ok).toBe(false);
    expect(useSpecialDraft(s, "category", "spacer").ok).toBe(false);
    expect(s.specialDrafts.category).toBe(1);
    expect(s.bankedRolls).toHaveLength(0);
  });
});

describe("the rolled guarantee", () => {
  it("the Jacquard Card drafts its category alone", () => {
    // Oscillator card over mixed bands: common → the Sine, uncommon → the
    // Afterglow, rare → the Sideband. Every candidate still wears the
    // bought category.
    const offer = generateSpecialOffer(fresh(), "category", "oscillator", stubRng([0.5, 0.0, 0.998, 0.0, 0.9995, 0.0]));
    expect(offer.candidates.map((c) => c.type)).toEqual(["additive", "afterglow", "sideband"]);
    // The offer wears its product's name: the Forge reads the special tag
    // and the category it named.
    expect(offer.special).toEqual({ kind: "category", category: "oscillator" });
  });

  it("a band with none of the card's category falls back inside it, spending no extra draw", () => {
    // The spacer category holds no rare-band type, so the rare band's
    // draw falls back to the whole spacer pool — the stream stays six
    // draws and every candidate stays a spacer.
    const offer = generateSpecialOffer(fresh(), "category", "spacer", stubRng([0.9995, 0.0, 0.9995, 0.0, 0.9995, 0.0]));
    expect(offer.candidates.every((c) => c.type === "spacer")).toBe(true);
    expect(() => generateSpecialOffer(fresh(), "category", "spacer", stubRng(new Array(6).fill(0.5)))).not.toThrow();
    expect(() => generateSpecialOffer(fresh(), "category", "spacer", stubRng(new Array(5).fill(0.5)))).toThrow();
  });

  it("the Silk Warp drafts the rare band alone", () => {
    // Six draws: each slot walks the rare band's categories (the
    // oscillator's share over the band's present categories) then a type
    // inside it — the breather specialists' Tail rides the band beside
    // the Sideband (issue #416).
    const offer = generateSpecialOffer(fresh(), "rare", "oscillator", stubRng([0.5, 0.0, 0.9, 0.0, 0.5, 0.99]));
    expect(offer.candidates.map((c) => c.type)).toEqual(["sideband", "exciter", "tail"]);
    expect(offer.candidates.every((c) => TYPE_RARITY[c.type] === "rare")).toBe(true);
    expect(offer.special).toEqual({ kind: "rare" });
  });

  it("the Plied Weft mints every candidate a tier up", () => {
    const offer = generateSpecialOffer(fresh(), "tier", "spacer", stubRng(new Array(9).fill(0.5)));
    expect(offer.candidates.every((c) => c.tier === 1)).toBe(true);
  });

  it("the loom's rungs ride on top of every guarantee", () => {
    // One rung owned: a category card's slot stream grows to nine draws —
    // band, type, lift — and a low lift read lifts the candidate.
    const s = fresh();
    s.draftTierBonus = 1;
    const lifted = generateSpecialOffer(s, "category", "spacer", stubRng([0.5, 0.0, 0.0, 0.5, 0.0, 0.99, 0.5, 0.0, 0.99]));
    expect(lifted.candidates.map((c) => c.tier)).toEqual([1, 0, 0]);
    // The tier card's guaranteed base stacks with the lift: one rung
    // mints tier 2 where the cap allows it.
    const doubled = generateSpecialOffer(s, "tier", "spacer", stubRng([0.5, 0.5, 0.5, 0.0, 0.5, 0.5, 0.5, 0.99, 0.5, 0.5, 0.5, 0.99]));
    expect(doubled.candidates.map((c) => c.tier)).toEqual([2, 1, 1]);
    // The unlocked cap still clamps: at cap 1 the same stream holds tier 1.
    const cap = BALANCE.mergeCap;
    BALANCE.mergeCap = 1;
    try {
      const clamped = generateSpecialOffer(s, "tier", "spacer", stubRng([0.5, 0.5, 0.5, 0.0, 0.5, 0.5, 0.5, 0.99, 0.5, 0.5, 0.5, 0.99]));
      expect(clamped.candidates.every((c) => c.tier === 1)).toBe(true);
    } finally {
      BALANCE.mergeCap = cap;
    }
  });

  it("the weave consumes exactly one entitlement and banks one offer", () => {
    const s = fresh();
    s.specialDrafts.category = 1;
    expect(useSpecialDraft(s, "category", "spacer", stubRng(new Array(6).fill(0.0))).ok).toBe(true);
    expect(s.specialDrafts.category).toBe(0);
    expect(s.bankedRolls).toHaveLength(1);
    expect(s.bankedRolls[0]!.candidates.every((c) => c.type === "spacer")).toBe(true);
    // A repeated weave with nothing held refuses and mints nothing.
    const again = useSpecialDraft(s, "category", "spacer", stubRng(new Array(6).fill(0.0)));
    expect(again.ok).toBe(false);
    expect(again.reason).toContain("not held");
    expect(s.bankedRolls).toHaveLength(1);
    expect(s.specialDrafts.category).toBe(0);
  });
});

describe("the woven offer's economy", () => {
  // A Plied Weft offer whose candidates are three common tier-1 mints.
  function tieredOffer(): GameState["bankedRolls"][number] {
    return generateSpecialOffer(fresh(), "tier", "spacer", stubRng(new Array(9).fill(0.5)));
  }

  it("taking a tiered candidate and scrapping it pays the one schedule", () => {
    const s = fresh();
    const offer = tieredOffer();
    s.bankedRolls.push(offer);
    expect(chooseRoll(s, offer.id, offer.candidates[0]!.id).ok).toBe(true);
    const minted = s.modules.at(-1)!;
    expect(minted.tier).toBe(1);
    expect(scrapModule(s, minted.id).scrap).toBe(BALANCE.scrapValue.common * BALANCE.scrapTierFactor);
  });

  it("skipping the same offer banks the same payout", () => {
    const s = fresh();
    s.bankedRolls.push(tieredOffer());
    expect(skipRoll(s, s.bankedRolls[0]!.id).scrap).toBe(BALANCE.scrapValue.common * BALANCE.scrapTierFactor);
  });

  it("a Silk Warp's skip reads its rares at the same table", () => {
    const s = fresh();
    s.bankedRolls.push(generateSpecialOffer(fresh(), "rare", "oscillator", stubRng([0.5, 0.0, 0.9, 0.0, 0.5, 0.99])));
    expect(skipRoll(s, s.bankedRolls[0]!.id).scrap).toBe(BALANCE.scrapValue.rare);
  });
});

describe("entitlement persistence", () => {
  it("round-trips through the save, and a pre-specials save lenient-defaults to none", () => {
    const s = fresh();
    s.specialDrafts = { category: 2, rare: 1, tier: 3 };
    const restored = deserialize(serialize(s)).state!;
    expect(restored.specialDrafts).toEqual({ category: 2, rare: 1, tier: 3 });
    // Absent reads as none held; corrupt counts floor at zero — a broken
    // record can never read as a free draft.
    const file = JSON.parse(serialize(s)) as { state: Record<string, unknown> };
    delete file.state.specialDrafts;
    expect(deserialize(JSON.stringify(file)).state!.specialDrafts).toEqual({ category: 0, rare: 0, tier: 0 });
    file.state.specialDrafts = { category: -2, rare: 1.7, tier: "many" };
    expect(deserialize(JSON.stringify(file)).state!.specialDrafts).toEqual({ category: 0, rare: 1, tier: 0 });
    file.state.specialDrafts = "garbage";
    expect(deserialize(JSON.stringify(file)).state!.specialDrafts).toEqual({ category: 0, rare: 0, tier: 0 });
  });

  it("the entitlements survive the arete reset beside the scrap", () => {
    const s = fresh();
    s.scrap = 250;
    s.specialDrafts = { category: 1, rare: 2, tier: 1 };
    s.eraEarned = ARETE_HORIZON;
    expect(prestige(s).ok).toBe(true);
    expect(s.scrap).toBe(250);
    expect(s.specialDrafts).toEqual({ category: 1, rare: 2, tier: 1 });
  });
});
