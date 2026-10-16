import { describe, expect, it } from "vitest";
import { buyDraftUpgrade, buyMergeCapIncrease, buySpecialDraft, combine, mergeAll, prestige, startSession } from "./actions";import { ARETE_HORIZON } from "./accumulator";
import { unlockedMergeCap, mergeCapIncreaseCost } from "./catalog";
import { BALANCE } from "./constants";
import { fresh, give, stubRng } from "./fixtures";
import { modulePower } from "./economy";
import { generateSpecialOffer } from "./rolls";
import { deserialize, serialize } from "./save";

// The Warp Beam (issue #380, parent #366): the Arete Catalog's merge-cap
// purchase — each owned rung raises the unlocked merge cap one tier past
// BALANCE.mergeCap, up to the authored ladder's end. Every read goes
// through the public actions and the one catalog read: merge eligibility,
// the drafts' offered tiers, the loom's and the tier product's
// availability, and the purchase itself all read the same unlocked cap.

// The rungs' sum buys the whole ladder twice over.
const WHOLE_LADDER = BALANCE.mergeCapCosts.reduce((a, b) => a + b, 0) * 2;

describe("the Warp Beam's purchase", () => {
  it("buys a rung from the Arete balance, one tier per rung at the authored prices", () => {
    const s = fresh();
    s.catalogEntryOwned = true;
    s.arete = WHOLE_LADDER;
    expect(buyMergeCapIncrease(s).ok).toBe(true);
    expect(s.arete).toBe(WHOLE_LADDER - BALANCE.mergeCapCosts[0]);
    expect(s.mergeCapPurchases).toBe(1);
    expect(unlockedMergeCap(s)).toBe(BALANCE.mergeCap + 1);
    expect(mergeCapIncreaseCost(s)).toBe(BALANCE.mergeCapCosts[1]);
    expect(buyMergeCapIncrease(s).ok).toBe(true);
    expect(buyMergeCapIncrease(s).ok).toBe(true);
    expect(unlockedMergeCap(s)).toBe(BALANCE.mergeCap + 3);
  });

  it("refuses an unaffordable price without charging", () => {
    const s = fresh();
    s.catalogEntryOwned = true;
    s.arete = BALANCE.mergeCapCosts[0] - 1;
    const result = buyMergeCapIncrease(s);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Arete");
    expect(s.arete).toBe(BALANCE.mergeCapCosts[0] - 1);
    expect(s.mergeCapPurchases).toBe(0);
  });

  it("is unavailable past the ladder's end, and the cap reads the clamp", () => {
    const s = fresh();
    s.catalogEntryOwned = true;
    s.arete = WHOLE_LADDER;
    s.mergeCapPurchases = BALANCE.mergeCapCosts.length;
    expect(mergeCapIncreaseCost(s)).toBeNull();
    const result = buyMergeCapIncrease(s);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("cap");
    expect(s.arete).toBe(WHOLE_LADDER);
    expect(unlockedMergeCap(s)).toBe(BALANCE.mergeCap + BALANCE.mergeCapCosts.length);
  });

  it("stands behind the Arete lock: no entry and no flow", () => {
    const s = fresh();
    s.arete = WHOLE_LADDER;
    expect(buyMergeCapIncrease(s).ok).toBe(false);
    s.catalogEntryOwned = true;
    startSession(s, 600);
    expect(buyMergeCapIncrease(s).ok).toBe(false);
    expect(s.mergeCapPurchases).toBe(0);
    expect(s.arete).toBe(WHOLE_LADDER);
  });
});

describe("merging past the base cap", () => {
  function cappedPair(s = fresh()): { a: ReturnType<typeof give>; b: ReturnType<typeof give> } {
    const a = give(s, "additive", null);
    const b = give(s, "additive", null);
    a.tier = BALANCE.mergeCap;
    b.tier = BALANCE.mergeCap;
    return { a, b };
  }

  it("a pair at the base cap refuses until a rung is bought, then combines", () => {
    const s = fresh();
    s.catalogEntryOwned = true;
    s.arete = WHOLE_LADDER;
    const { a } = cappedPair(s);
    expect(combine(s, a.id).ok).toBe(false);
    expect(buyMergeCapIncrease(s).ok).toBe(true);
    expect(combine(s, a.id).ok).toBe(true);
    expect(a.tier).toBe(BALANCE.mergeCap + 1);
    expect(s.modules).toHaveLength(2); // the survivor and the untouched opening synth
  });

  it("merge-all sweeps the newly eligible pair through the same cap", () => {
    const s = fresh();
    s.catalogEntryOwned = true;
    s.arete = WHOLE_LADDER;
    cappedPair(s);
    expect(mergeAll(s).ok).toBe(false);
    expect(buyMergeCapIncrease(s).ok).toBe(true);
    const result = mergeAll(s);
    expect(result.ok).toBe(true);
    expect(result.merge).toEqual({ combines: 1, refund: 0 });
    expect(s.modules.filter((m) => m.type === "additive")).toHaveLength(2);
    expect(s.modules.find((m) => m.tier === BALANCE.mergeCap + 1)).toBeTruthy();
  });

  it("the minted tier's strength reads the extended power ladder, not a clamp", () => {
    const plain = give(fresh(), "additive", null);
    const raised = give(fresh(), "additive", null);
    raised.tier = BALANCE.mergeCap + 1;
    expect(modulePower(raised) / modulePower(plain)).toBeCloseTo(BALANCE.tierPower[BALANCE.mergeCap + 1], 9);
  });
});

describe("drafts read the unlocked cap", () => {
  it("the loom's lift stands behind the same cap the purchase raises", () => {
    const base = BALANCE.mergeCap;
    BALANCE.mergeCap = 0; // a degenerate cap: nothing can mint above base
    try {
      const s = fresh();
      s.catalogEntryOwned = true;
      s.scrap = 5_000;
      s.arete = WHOLE_LADDER;
      expect(buyDraftUpgrade(s).ok).toBe(false);
      expect(buySpecialDraft(s, "tier").ok).toBe(false);
      expect(s.scrap).toBe(5_000);
      // One rung raises the cap: the same purchases arm.
      expect(buyMergeCapIncrease(s).ok).toBe(true);
      expect(buyDraftUpgrade(s).ok).toBe(true);
      expect(buySpecialDraft(s, "tier").ok).toBe(true);
    } finally {
      BALANCE.mergeCap = base;
    }
  });

  it("offer generation clamps to the unlocked cap, whatever the base", () => {
    const base = BALANCE.mergeCap;
    BALANCE.mergeCap = 0;
    try {
      const s = fresh();
      s.draftTierBonus = 1;
      // One rung owned: each slot's stream is band, category, type, lift —
      // the lift reads (0.1 < 0.15) fires, the rest walk the ordinary draw.
      const stream = () => stubRng([0.5, 0.5, 0.5, 0.1, 0.5, 0.5, 0.5, 0.1, 0.5, 0.5, 0.5, 0.1]);
      s.mergeCapPurchases = 1; // cap 1: the guaranteed base stands, the lift clamps off
      const clamped = generateSpecialOffer(s, "tier", "spacer", stream());
      expect(clamped.candidates.every((c) => c.tier === 1)).toBe(true);
      // The same stream at a raised cap mints past it: the offer read the
      // state's cap, not a hard-coded limit.
      s.mergeCapPurchases = BALANCE.mergeCapCosts.length;
      const lifted = generateSpecialOffer(s, "tier", "spacer", stream());
      expect(lifted.candidates.every((c) => c.tier === 2)).toBe(true);
    } finally {
      BALANCE.mergeCap = base;
    }
  });
});

describe("persistence", () => {
  it("round-trips through the save, and a pre-beam save lenient-defaults to none", () => {
    const s = fresh();
    s.mergeCapPurchases = 2;
    expect(deserialize(serialize(s)).state!.mergeCapPurchases).toBe(2);
    const file = JSON.parse(serialize(s)) as { state: Record<string, unknown> };
    delete file.state.mergeCapPurchases;
    expect(deserialize(JSON.stringify(file)).state!.mergeCapPurchases).toBe(0);
    // A corrupt figure floors at zero; an implausible one clamps at the
    // ladder's end, so the cap can never promise an unsold tier.
    file.state.mergeCapPurchases = -1;
    expect(deserialize(JSON.stringify(file)).state!.mergeCapPurchases).toBe(0);
    file.state.mergeCapPurchases = 1.7;
    expect(deserialize(JSON.stringify(file)).state!.mergeCapPurchases).toBe(1);
    file.state.mergeCapPurchases = 99;
    expect(deserialize(JSON.stringify(file)).state!.mergeCapPurchases).toBe(BALANCE.mergeCapCosts.length);
    file.state.mergeCapPurchases = "many";
    expect(deserialize(JSON.stringify(file)).state!.mergeCapPurchases).toBe(0);
  });

  it("the rungs survive the arete reset while the era economy resets around them", () => {
    const s = fresh();
    s.catalogEntryOwned = true;
    s.arete = WHOLE_LADDER;
    expect(buyMergeCapIncrease(s).ok).toBe(true);
    const copy = give(s, "additive", null);
    copy.tier = BALANCE.mergeCap + 1;
    copy.level = 5;
    copy.reserve = 100;
    s.capacityBought = 2;
    s.eraEarned = ARETE_HORIZON;
    expect(prestige(s).ok).toBe(true);
    expect(s.mergeCapPurchases).toBe(1);
    expect(unlockedMergeCap(s)).toBe(BALANCE.mergeCap + 1);
    expect(copy.tier).toBe(BALANCE.mergeCap + 1);
    // The ordinary reset stands: levels, stored charge, purchased
    // capacity, and the nous balance all re-earn.
    expect(copy.level).toBe(0);
    expect(copy.reserve).toBe(0);
    expect(s.capacityBought).toBe(0);
    expect(s.nous).toBe(BALANCE.openingGrant);
  });
});

