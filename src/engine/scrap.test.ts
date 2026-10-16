import { describe, expect, it } from "vitest";
import { chooseRoll, combine, endSession, prestige, scrapModule, skipRoll, startSession } from "./actions";
import { ARETE_HORIZON } from "./accumulator";
import { BALANCE } from "./constants";
import { fresh, give, stubRng } from "./fixtures";
import { generateOffer } from "./rolls";
import { moduleScrapValue, scrapValueOf, skipPayoutOf } from "./scrap";
import { deserialize, serialize } from "./save";
import type { GameState, ModuleType } from "./types";

// The scrap loop (issue #377, ADR-0066): skipping a draft pays the best
// candidate's recovery value; scrapping an owned copy pays the same
// schedule; merging conserves collection value; the balance persists
// through the arete reset. Every read goes through the public actions.

function offerWith(s: GameState, type: ModuleType, tier = 0): string {
  const offerId = `offer-${s.nextId++}`;
  s.bankedRolls.push({
    id: offerId,
    candidates: [
      { id: `${offerId}-a`, type, tier },
      { id: `${offerId}-b`, type: "spacer", tier: 0 },
      { id: `${offerId}-c`, type: "spacer", tier: 0 },
    ],
  });
  return offerId;
}

describe("the scrap valuation", () => {
  it("pays the fixed rarity's base scaled once per merge tier", () => {
    expect(scrapValueOf("harmonizer", 0)).toBe(BALANCE.scrapValue.common);
    expect(scrapValueOf("chorus", 0)).toBe(BALANCE.scrapValue.uncommon);
    expect(scrapValueOf("exciter", 0)).toBe(BALANCE.scrapValue.rare);
    expect(scrapValueOf("harmonizer", 1)).toBe(BALANCE.scrapValue.common * BALANCE.scrapTierFactor);
    expect(scrapValueOf("harmonizer", 2)).toBe(BALANCE.scrapValue.common * BALANCE.scrapTierFactor ** 2);
  });

  it("conserves collection value through merging", () => {
    const s = fresh();
    const a = give(s, "harmonizer", null);
    const b = give(s, "harmonizer", null);
    const pairValue = moduleScrapValue(a) + moduleScrapValue(b);
    combine(s, a.id, b.id);
    expect(s.modules.filter((m) => m.type === "harmonizer")).toHaveLength(1);
    expect(moduleScrapValue(a)).toBe(pairValue);
  });

  it("values a directly drafted higher tier like its merged equivalent", () => {
    const direct = give(fresh(), "harmonizer", null);
    direct.tier = 1; // the legacy conversion's only tier source (ADR-0058)
    const s = fresh();
    const a = give(s, "harmonizer", null);
    combine(s, a.id, give(s, "harmonizer", null).id);
    expect(moduleScrapValue(direct)).toBe(moduleScrapValue(a));
  });
});

describe("the scrap action", () => {
  it("removes the module once and banks its recovery value once", () => {
    const s = fresh();
    const module = give(s, "chorus", null);
    const result = scrapModule(s, module.id);
    expect(result.ok).toBe(true);
    expect(result.scrap).toBe(BALANCE.scrapValue.uncommon);
    expect(s.scrap).toBe(BALANCE.scrapValue.uncommon);
    expect(s.modules.includes(module)).toBe(false);
    expect(scrapModule(s, module.id).ok).toBe(false);
    expect(s.scrap).toBe(BALANCE.scrapValue.uncommon);
  });

  it("pays a merged copy its full constituent value with no hidden loss", () => {
    const s = fresh();
    const a = give(s, "harmonizer", null);
    const pairValue = moduleScrapValue(a) * 2;
    combine(s, a.id, give(s, "harmonizer", null).id);
    const result = scrapModule(s, a.id);
    expect(result.scrap).toBe(pairValue);
    expect(s.scrap).toBe(pairValue);
  });

  it("drops a dead recipient's Spotlight pick, keeping every other", () => {
    const s = fresh();
    const voice = give(s, "additive", null);
    const doomed = give(s, "triangle", null);
    const other = give(s, "square", null);
    const spot = give(s, "spotlight", null);
    spot.target = doomed.id;
    scrapModule(s, doomed.id);
    expect(spot.target).toBeNull();
    spot.target = voice.id;
    scrapModule(s, other.id);
    expect(spot.target).toBe(voice.id);
  });

  it("is locked during flow and refuses unknown ids", () => {
    const s = fresh();
    const module = give(s, "harmonizer", null);
    startSession(s, 600);
    expect(scrapModule(s, module.id).ok).toBe(false);
    expect(s.scrap).toBe(0);
    expect(s.modules.includes(module)).toBe(true);
    endSession(s);
    expect(scrapModule(s, "no-such-module").ok).toBe(false);
  });
});

describe("the skip action", () => {
  it("consumes the offer once and banks the best candidate's scrap value", () => {
    const s = fresh();
    const offerId = offerWith(s, "chorus"); // the uncommon beats two spacer commons
    const result = skipRoll(s, offerId);
    expect(result.ok).toBe(true);
    expect(result.scrap).toBe(BALANCE.scrapValue.uncommon);
    expect(s.scrap).toBe(BALANCE.scrapValue.uncommon);
    expect(s.bankedRolls).toHaveLength(0);
    // No duplicate payout: the consumed offer's id is simply not banked.
    expect(skipRoll(s, offerId).ok).toBe(false);
    expect(s.scrap).toBe(BALANCE.scrapValue.uncommon);
  });

  it("pays identically to taking the best candidate and scrapping it", () => {
    // A controlled draw: two common-band oscillator picks, then the rare
    // band's booster category — the Exciter. The rig stays off (total
    // earned ≠ 1). Nine draws: band, category, type ×3.
    const common = 1 - BALANCE.rarityProbability.uncommon - BALANCE.rarityProbability.rare - 1e-6;
    const s = fresh();
    s.forge.earned = 5;
    s.flow.earned = 5;
    const offer = generateOffer(s, stubRng([common, 0.0, 0.0, common, 0.0, 0.0, 1 - 1e-6, 0.9, 0.999]));
    s.bankedRolls.push(offer);
    const payout = skipPayoutOf(offer);
    expect(payout).toBe(BALANCE.scrapValue.rare);
    // The round trip: take the Exciter, scrap it immediately.
    const s2 = fresh();
    s2.bankedRolls.push(JSON.parse(JSON.stringify(offer)) as GameState["bankedRolls"][number]);
    const exciter = offer.candidates.find((c) => c.type === "exciter")!;
    expect(chooseRoll(s2, offer.id, exciter.id).ok).toBe(true);
    const minted = s2.modules.at(-1)!;
    expect(minted.type).toBe("exciter");
    expect(moduleScrapValue(minted)).toBe(payout);
    expect(scrapModule(s2, minted.id).scrap).toBe(payout);
    expect(skipRoll(s, offer.id).scrap).toBe(payout);
  });

  it("is locked during flow and refuses unbaked offers", () => {
    const s = fresh();
    const offerId = offerWith(s, "harmonizer");
    startSession(s, 600);
    expect(skipRoll(s, offerId).ok).toBe(false);
    expect(s.bankedRolls).toHaveLength(1);
    expect(s.scrap).toBe(0);
    endSession(s);
    expect(skipRoll(s, "no-such-offer").ok).toBe(false);
  });

  it("leaves mutator offers without consolation", () => {
    const s = fresh();
    s.bankedMutatorRolls.push({
      id: "mut-offer",
      candidates: [
        { id: "mut-a", family: "power", rarity: "rare" },
        { id: "mut-b", family: "charge", rarity: "rare" },
      ],
    });
    expect(skipRoll(s, "mut-offer").ok).toBe(false);
    expect(s.bankedMutatorRolls).toHaveLength(1);
    expect(s.scrap).toBe(0);
  });
});

describe("scrap persistence", () => {
  it("survives the arete reset with the collection", () => {
    const s = fresh();
    scrapModule(s, give(s, "harmonizer", null).id);
    s.eraEarned = ARETE_HORIZON;
    s.nous = 5000;
    expect(prestige(s).ok).toBe(true);
    expect(s.scrap).toBe(BALANCE.scrapValue.common);
    expect(s.nous).not.toBe(5000);
    expect(s.modules.every((m) => m.level === 0 && m.reserve === 0)).toBe(true);
  });

  it("round-trips through the save", () => {
    const s = fresh();
    scrapModule(s, give(s, "exciter", null).id);
    expect(deserialize(serialize(s)).state!.scrap).toBe(BALANCE.scrapValue.rare);
    // A pre-scrap save lenient-defaults to zero.
    const file = JSON.parse(serialize(s)) as { state: Record<string, unknown> };
    delete file.state.scrap;
    expect(deserialize(JSON.stringify(file)).state!.scrap).toBe(0);
  });
});
