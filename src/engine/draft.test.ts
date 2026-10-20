import { describe, expect, it } from "vitest";
import { buyDraftUpgrade, chooseRoll, endSession, prestige, scrapModule, skipRoll, startSession } from "./actions";
import { ARETE_HORIZON } from "./accumulator";
import { BALANCE, CATEGORY_OF, TYPE_RARITY } from "./constants";
import { fresh, giveHabit, stubRng } from "./fixtures";
import { draftTierChanceOf, generateOffer, nextDraftUpgradePrice } from "./rolls";
import { deserialize, serialize } from "./save";
import type { Category, GameState, ModuleType } from "./types";

// The draft composition and the Draft Loom (issue #378, parent #366): the
// category frequencies ride their own weighted draw — a category's share
// never depends on its roster size — and scrap buys permanent tier-bonus
// rungs whose offered tiers respect the unlocked merge cap. Every read
// goes through the public actions and the generation seam's controlled
// randomness; the nine-draw stream per offer is band, category, type per
// slot, plus the loom's tier draw only while a rung is owned.

// The launch roster's common types, read from the same rarity table the
// draw filters with — the joined Mutator Forge stays out (membership is a
// purchase, not authoring).
const COMMON_TYPES: ModuleType[] = [
  "additive", "blaster", "triangle", "square", "saw", "harmonizer", "echo", "bend",
  "amplifier", "ritual", "spacer", "focusKeyed", "noteKeyed", "goalKeyed",
  "infusor", "field", "spotlight", "forge",
];

// The common band's category walk in the weights' authored order: each
// present category's share is its weight over the total. The boundary
// draws below read off the same table the engine reads — the test pins the
// boundary behavior, not a coefficient table.
function commonCategoryWalk(): { category: Category; high: number }[] {
  const present = new Set(COMMON_TYPES.map((type) => CATEGORY_OF[type]));
  const entries = (Object.entries(BALANCE.draftCategoryWeights) as [Category, number][]).filter(([category]) =>
    present.has(category),
  );
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let acc = 0;
  return entries.map(([category, weight]) => {
    acc += weight;
    return { category, high: acc / total };
  });
}

describe("the draft composition", () => {
  it("draws its category before its type, and the boundary sits where the weight puts it", () => {
    // The oscillator category's mass ends at 4/13.5 ≈ 0.296 of the common
    // band's walk. A draw just below lands an oscillator; a draw just
    // above lands the next category in the authored order, the generator's.
    const walk = commonCategoryWalk();
    expect(walk[0]!.category).toBe("oscillator");
    expect(walk[1]!.category).toBe("generator");
    const edge = walk[0]!.high;
    const below = generateOffer(fresh(), stubRng([0.5, edge - 1e-9, 0.0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
    const above = generateOffer(fresh(), stubRng([0.5, edge + 1e-9, 0.0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
    expect(CATEGORY_OF[below.candidates[0]!.type]).toBe("oscillator");
    expect(CATEGORY_OF[above.candidates[0]!.type]).toBe("generator");
  });

  it("the category's mass never reads the roster size", () => {
    // The uniform-by-type draw this table replaces drifted with every
    // roster wave: six band types in a category moved its share. Authoring
    // a sixth oscillator into the common band (the Afterglow promoted for
    // the probe) moves nothing — the weight still says 4.
    const edge = commonCategoryWalk()[0]!.high;
    const authored = TYPE_RARITY.afterglow;
    TYPE_RARITY.afterglow = "common";
    try {
      const below = generateOffer(fresh(), stubRng([0.5, edge - 1e-9, 0.0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
      const above = generateOffer(fresh(), stubRng([0.5, edge + 1e-9, 0.0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
      expect(CATEGORY_OF[below.candidates[0]!.type]).toBe("oscillator");
      expect(CATEGORY_OF[above.candidates[0]!.type]).toBe("generator");
    } finally {
      TYPE_RARITY.afterglow = authored;
    }
  });

  it("keeps the distinct-candidate offer over the weighted draw", () => {
    const offer = generateOffer(fresh(), stubRng(new Array(9).fill(0.5)));
    expect(new Set(offer.candidates.map((c) => c.type)).size).toBe(3);
  });

  it("spends exactly nine draws with no loom rungs, twelve with one", () => {
    const s = fresh();
    expect(generateOffer(s, stubRng(new Array(9).fill(0.5))).candidates).toHaveLength(3);
    s.draftTierBonus = 1;
    // The tier draw rides each slot — band, category, type, tier — so a
    // owned rung spends twelve draws per offer; a draw past the rung's
    // chance mints the base tier.
    const offer = generateOffer(s, stubRng(new Array(12).fill(0.99)));
    expect(offer.candidates.every((c) => c.tier === 0)).toBe(true);
    expect(() => generateOffer(s, stubRng(new Array(9).fill(0.5)))).toThrow();
  });
});

describe("the Draft Loom's tier bonus", () => {
  it("lifts candidates one tier with the owned rung's chance", () => {
    const s = fresh();
    s.draftTierBonus = 1;
    // Twelve draws: each slot's band, category, type, then its tier roll —
    // the first slot's 0.1 sits under the first rung's 0.15, so that
    // candidate mints at tier 1 while its siblings stay base.
    const offer = generateOffer(s, stubRng([0.5, 0.5, 0.5, 0.1, 0.5, 0.5, 0.5, 0.99, 0.5, 0.5, 0.5, 0.99]));
    expect(offer.candidates[0]!.tier).toBe(1);
    expect(offer.candidates[1]!.tier).toBe(0);
    expect(offer.candidates[2]!.tier).toBe(0);
    expect(draftTierChanceOf(1)).toBe(BALANCE.tierBonusChance[0]);
    expect(draftTierChanceOf(0)).toBe(0);
  });

  it("never offers a tier past the unlocked merge cap", () => {
    const cap = BALANCE.mergeCap;
    BALANCE.mergeCap = 0; // a degenerate cap: no tier can mint above base
    try {
      const s = fresh();
      s.draftTierBonus = BALANCE.tierBonusChance.length; // the ceiling rung
      const offer = generateOffer(s, stubRng(new Array(12).fill(0.0)));
      expect(offer.candidates.every((c) => c.tier === 0)).toBe(true);
    } finally {
      BALANCE.mergeCap = cap;
    }
  });

  it("a tiered candidate pays its doubled scrap value; skipping banks the same schedule", () => {
    const s = fresh();
    s.draftTierBonus = 1;
    s.forge.earned = 5;
    giveHabit(s).pair.rollMeter.earned = 5;
    // Slot one: common band, oscillator category, the additive — its tier
    // roll 0.0 lifts it to tier 1.
    const offer = generateOffer(s, stubRng([0.0, 0.0, 0.0, 0.0, 0.5, 0.5, 0.0, 0.99, 0.9, 0.95, 0.2, 0.99]));
    const tiered = offer.candidates[0]!;
    expect(tiered.type).toBe("additive");
    expect(tiered.tier).toBe(1);
    // The round trip: take the tiered candidate, scrap the fresh mint.
    s.bankedRolls.push(offer);
    expect(chooseRoll(s, offer.id, tiered.id).ok).toBe(true);
    const minted = s.modules.at(-1)!;
    expect(scrapModule(s, minted.id).scrap).toBe(BALANCE.scrapValue.common * BALANCE.scrapTierFactor);
    // The twin offer, skipped instead: the same payout.
    const s2 = fresh();
    s2.bankedRolls.push(JSON.parse(JSON.stringify(offer)) as GameState["bankedRolls"][number]);
    expect(skipRoll(s2, offer.id).scrap).toBe(BALANCE.scrapValue.common * BALANCE.scrapTierFactor);
  });
});

describe("the Draft Loom purchase", () => {
  it("buys rungs from the scrap balance, one price each, and raises the chance", () => {
    const s = fresh();
    s.scrap = 700;
    expect(nextDraftUpgradePrice(0)).toBe(BALANCE.tierBonusCosts[0]);
    expect(buyDraftUpgrade(s).ok).toBe(true);
    expect(s.scrap).toBe(700 - BALANCE.tierBonusCosts[0]!);
    expect(s.draftTierBonus).toBe(1);
    expect(buyDraftUpgrade(s).ok).toBe(true);
    expect(s.scrap).toBe(700 - BALANCE.tierBonusCosts[0]! - BALANCE.tierBonusCosts[1]!);
    expect(draftTierChanceOf(s.draftTierBonus)).toBe(BALANCE.tierBonusChance[1]);
  });

  it("refuses an unaffordable price without consuming scrap", () => {
    const s = fresh();
    s.scrap = BALANCE.tierBonusCosts[0]! - 1;
    const result = buyDraftUpgrade(s);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("scrap");
    expect(s.scrap).toBe(BALANCE.tierBonusCosts[0]! - 1);
    expect(s.draftTierBonus).toBe(0);
  });

  it("is unavailable past the ladder's end, and the flow locks it", () => {
    const s = fresh();
    s.scrap = 10_000;
    while (nextDraftUpgradePrice(s.draftTierBonus) !== null) {
      expect(buyDraftUpgrade(s).ok).toBe(true);
    }
    expect(s.draftTierBonus).toBe(BALANCE.tierBonusCosts.length);
    const before = s.scrap;
    const result = buyDraftUpgrade(s);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("tuned");
    expect(s.scrap).toBe(before);
    startSession(s, 600);
    expect(buyDraftUpgrade(s).ok).toBe(false);
    expect(s.scrap).toBe(before);
    endSession(s);
  });

  it("a pocket of skips funds the first rung — surplus drafts become quality", () => {
    const s = fresh();
    // Two skipped offers whose best candidates are rare-band: the balance
    // the skip action banks alone covers the first rung's price.
    for (const id of ["offer-a", "offer-b"]) {
      s.bankedRolls.push({
        id,
        candidates: [
          { id: `${id}-1`, type: "sideband", tier: 0 },
          { id: `${id}-2`, type: "spacer", tier: 0 },
          { id: `${id}-3`, type: "spacer", tier: 0 },
        ],
      });
    }
    expect(skipRoll(s, "offer-a").scrap).toBe(BALANCE.scrapValue.rare);
    expect(skipRoll(s, "offer-b").scrap).toBe(BALANCE.scrapValue.rare);
    expect(s.scrap).toBeGreaterThanOrEqual(BALANCE.tierBonusCosts[0]!);
    expect(buyDraftUpgrade(s).ok).toBe(true);
    expect(s.draftTierBonus).toBe(1);
    expect(draftTierChanceOf(1)).toBeGreaterThan(0);
  });
});

describe("loom persistence", () => {
  it("the rungs and the scrap both survive the arete reset", () => {
    const s = fresh();
    s.scrap = 250;
    s.draftTierBonus = 2;
    s.eraEarned = ARETE_HORIZON;
    expect(prestige(s).ok).toBe(true);
    expect(s.scrap).toBe(250);
    expect(s.draftTierBonus).toBe(2);
    expect(s.modules.every((m) => m.level === 0 && m.reserve === 0)).toBe(true);
  });

  it("round-trips through the save, and a pre-loom save lenient-defaults to none", () => {
    const s = fresh();
    s.scrap = 60;
    s.draftTierBonus = 3;
    const restored = deserialize(serialize(s)).state!;
    expect(restored.draftTierBonus).toBe(3);
    expect(restored.scrap).toBe(60);
    // Absent reads as none owned; an implausible count clamps at the
    // ladder's end so the purchase's quotes can never disagree.
    const file = JSON.parse(serialize(s)) as { state: Record<string, unknown> };
    delete file.state.draftTierBonus;
    expect(deserialize(JSON.stringify(file)).state!.draftTierBonus).toBe(0);
    file.state.draftTierBonus = 99;
    expect(deserialize(JSON.stringify(file)).state!.draftTierBonus).toBe(BALANCE.tierBonusCosts.length);
    file.state.draftTierBonus = -2;
    expect(deserialize(JSON.stringify(file)).state!.draftTierBonus).toBe(0);
  });
});

describe("the chance ladder read", () => {
  it("climbs the authored rungs and holds its ceiling", () => {
    expect(draftTierChanceOf(0)).toBe(0);
    BALANCE.tierBonusChance.forEach((chance, index) => {
      expect(draftTierChanceOf(index + 1)).toBe(chance);
    });
    expect(draftTierChanceOf(BALANCE.tierBonusChance.length + 5)).toBe(BALANCE.tierBonusChance.at(-1)!);
  });
});
