import { describe, expect, it } from "vitest";
import { affordableLevels, levelCost, levelsCost } from "./economy";
import { upgradeAll, upgradeModule, upgradeModuleLevels } from "./actions";
import { fresh, give } from "./fixtures";
import { hex } from "./hex";

// Purchase integrity at the numeric limits (issue #485): the upgrade
// ladder's four purchase modes — single, bulk, MAX, and upgrade-all —
// charge finite whole nous or commit nothing. A nonfinite budget, an
// unrepresentable price, a cumulative spend past the finite range, or a
// result the economy cannot represent refuses through the existing
// failure surface and leaves every level, ledger, and balance exactly as
// it stood.

const UNSAFE = "The purchase cannot be charged safely, so nothing was bought.";

// The curve's representable ceiling: the price of entering level 1506 is
// the last finite one; the next level's price reads Infinity.
const LAST_REPRESENTABLE_LEVEL = 1505;

// A full finite bank, for the cases that must afford everything finite.
const FULL_BANK = Number.MAX_VALUE;

function snapshot(state: ReturnType<typeof fresh>): string {
  return JSON.stringify({
    nous: state.nous,
    modules: state.modules.map((m) => ({ id: m.id, level: m.level, invested: m.invested })),
  });
}

describe("finite boundaries stay purchasable (issue #485)", () => {
  it("an exact bank buys the whole ladder and one ν short refuses, as before", () => {
    const s = fresh();
    const synth = s.modules[0]!;
    s.nous = levelsCost(0, 3);
    expect(upgradeModuleLevels(s, synth.id, 3)).toMatchObject({ ok: true });
    expect(synth.level).toBe(3);
    expect(s.nous).toBe(0);
    const again = upgradeModule(s, synth.id);
    expect(again.ok).toBe(false);
    expect(again.reason).toBe("Not enough whole nous for even one level.");
    expect(synth.level).toBe(3);
    expect(s.nous).toBe(0);
  });

  it("the last representable level still buys; its successor's price refuses", () => {
    const s = fresh();
    const synth = s.modules[0]!;
    expect(Number.isFinite(levelCost(LAST_REPRESENTABLE_LEVEL))).toBe(true);
    expect(levelCost(LAST_REPRESENTABLE_LEVEL + 1)).toBe(Infinity);
    synth.level = LAST_REPRESENTABLE_LEVEL;
    synth.invested = 0;
    s.nous = FULL_BANK;
    expect(upgradeModuleLevels(s, synth.id, "max")).toMatchObject({ ok: true, bulk: { levels: 1 } });
    expect(synth.level).toBe(LAST_REPRESENTABLE_LEVEL + 1);
    expect(Number.isFinite(synth.invested)).toBe(true);
    expect(s.nous).toBe(FULL_BANK - levelCost(LAST_REPRESENTABLE_LEVEL));
    // From the ceiling level itself the next price is unrepresentable —
    // the refusal is integrity, never a crash and never a grant.
    const again = upgradeModuleLevels(s, synth.id, "max");
    expect(again.ok).toBe(false);
    expect(again.reason).toBe(UNSAFE);
    expect(synth.level).toBe(LAST_REPRESENTABLE_LEVEL + 1);
    expect(s.nous).toBe(FULL_BANK - levelCost(LAST_REPRESENTABLE_LEVEL));
  });
});

describe("nonfinite budgets afford nothing (issue #485)", () => {
  it("a NaN or infinite balance refuses every purchase mode, touching nothing", () => {
    for (const bank of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const s = fresh();
      const synth = s.modules[0]!;
      const other = give(s, "additive", hex(1, 0), 4);
      s.nous = bank;
      const before = snapshot(s);
      for (const result of [
        upgradeModule(s, synth.id),
        upgradeModuleLevels(s, synth.id, 5),
        upgradeModuleLevels(s, synth.id, "max"),
        upgradeAll(s, 5),
        upgradeAll(s, "max"),
      ]) {
        expect(result.ok).toBe(false);
        expect(result.reason).toBe(UNSAFE);
      }
      expect(snapshot(s)).toBe(before);
      // The balance itself is unchanged, nonfinite as it was.
      expect(Object.is(s.nous, bank)).toBe(true);
      expect(other.level).toBe(4);
    }
  });

  it("affordableLevels counts nothing for a nonfinite budget", () => {
    expect(affordableLevels(Number.NaN, 0)).toBe(0);
    expect(affordableLevels(Number.POSITIVE_INFINITY, 0)).toBe(0);
  });
});

describe("unrepresentable prices grant no levels (issue #485)", () => {
  it("an infinite price is not affordable against an infinite balance", () => {
    const s = fresh();
    const synth = s.modules[0]!;
    synth.level = LAST_REPRESENTABLE_LEVEL + 1;
    synth.invested = 0;
    s.nous = Number.POSITIVE_INFINITY;
    expect(upgradeModuleLevels(s, synth.id, 1)).toMatchObject({ ok: false, reason: UNSAFE });
    expect(upgradeModuleLevels(s, synth.id, "max")).toMatchObject({ ok: false, reason: UNSAFE });
    expect(upgradeAll(s, "max")).toMatchObject({ ok: false, reason: UNSAFE });
    expect(synth.level).toBe(LAST_REPRESENTABLE_LEVEL + 1);
    expect(Object.is(s.nous, Number.POSITIVE_INFINITY)).toBe(true);
  });

  it("a level the ladder cannot price refuses before meeting the curve", () => {
    const s = fresh();
    const synth = s.modules[0]!;
    s.nous = FULL_BANK;
    for (const corrupted of [Number.NaN, Number.POSITIVE_INFINITY, 1.5]) {
      synth.level = corrupted;
      const before = snapshot(s);
      expect(upgradeModuleLevels(s, synth.id, "max")).toMatchObject({ ok: false, reason: UNSAFE });
      expect(upgradeAll(s, "max").ok).toBe(false);
      expect(snapshot(s)).toBe(before);
    }
    expect(s.nous).toBe(FULL_BANK);
  });

  it("the sweep skips an unpriceable module and still serves the priceable rest", () => {
    const s = fresh();
    const corrupted = s.modules[0]!;
    corrupted.level = Number.NaN;
    const rookie = give(s, "additive", hex(1, 0), 0);
    s.nous = levelCost(0);
    const result = upgradeAll(s, 1);
    expect(result.ok).toBe(true);
    expect(rookie.level).toBe(1);
    expect(result.bulk).toEqual({ levels: 1, modules: 1, spent: levelCost(0) });
    expect(Number.isNaN(corrupted.level)).toBe(true);
  });

  it("an all-ceiling roster reports integrity, not a shortfall", () => {
    const s = fresh();
    s.modules[0]!.level = LAST_REPRESENTABLE_LEVEL + 1;
    give(s, "additive", hex(1, 0), LAST_REPRESENTABLE_LEVEL + 1);
    s.nous = FULL_BANK;
    expect(upgradeAll(s, "max")).toMatchObject({ ok: false, reason: UNSAFE });
    expect(s.nous).toBe(FULL_BANK);
  });
});

describe("cumulative spend past the finite range commits nothing (issue #485)", () => {
  it.each([2, "max"] as const)("a %s-level operation refuses whole when only its later step overflows", (want) => {
    const state = fresh();
    const module = state.modules[0]!;
    module.level = 1503;
    const firstCost = levelCost(module.level);
    const secondCost = levelCost(module.level + 1);
    module.invested = FULL_BANK - firstCost - secondCost / 2;
    state.nous = levelsCost(module.level, 2);
    expect(Number.isFinite(state.nous)).toBe(true);
    expect(Number.isFinite(module.invested + firstCost)).toBe(true);
    expect(module.invested + state.nous).toBe(Infinity);
    const single = structuredClone(state);
    expect(upgradeModule(single, module.id).ok).toBe(true);
    expect(upgradeModule(single, module.id)).toMatchObject({ ok: false, reason: UNSAFE });
    const before = snapshot(state);
    expect(upgradeModuleLevels(state, module.id, want)).toMatchObject({ ok: false, reason: UNSAFE });
    expect(snapshot(state)).toBe(before);
    expect(upgradeAll(state, want)).toMatchObject({ ok: false, reason: UNSAFE });
    expect(snapshot(state)).toBe(before);
  });

  it("a bulk ladder whose ledger would overflow after earlier affordable steps refuses whole", () => {
    const s = fresh();
    const synth = s.modules[0]!;
    // A lifetime of earlier affordable steps sits in the ledger; the next
    // level's price is finite and affordable on its own, but the
    // cumulative spend would leave the finite range.
    synth.level = 1504;
    synth.invested = 1.7e308;
    s.nous = levelsCost(1504, 1);
    const before = snapshot(s);
    for (const want of [1, 2, "max"] as const) {
      const result = upgradeModuleLevels(s, synth.id, want);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe(UNSAFE);
      expect(snapshot(s)).toBe(before);
    }
  });

  it("the sweep refuses whole when one planned module's ledger would overflow", () => {
    const s = fresh();
    const edge = s.modules[0]!;
    edge.level = 1504;
    edge.invested = 1.7e308;
    const rookie = give(s, "additive", hex(1, 0), 0);
    s.nous = FULL_BANK;
    const result = upgradeAll(s, 1);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe(UNSAFE);
    expect(edge.level).toBe(1504);
    expect(edge.invested).toBe(1.7e308);
    expect(rookie.level).toBe(0);
    expect(s.nous).toBe(FULL_BANK);
  });
});

describe("invalid requests are not ladder counts (issue #485)", () => {
  it("a nonfinite, fractional, or negative request refuses without granting levels", () => {
    const s = fresh();
    const synth = s.modules[0]!;
    s.nous = levelsCost(0, 5);
    const before = snapshot(s);
    for (const want of [Number.NaN, Number.POSITIVE_INFINITY, 2.5, -1]) {
      const result = upgradeModuleLevels(s, synth.id, want);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe(UNSAFE);
      expect(upgradeAll(s, want).ok).toBe(false);
      expect(snapshot(s)).toBe(before);
    }
  });
});

describe("a refused purchase leaves the flow usable (issue #485)", () => {
  it("the next valid purchase after an integrity refusal buys normally", () => {
    const s = fresh();
    const synth = s.modules[0]!;
    s.nous = Number.NaN;
    expect(upgradeAll(s, "max").ok).toBe(false);
    expect(upgradeModuleLevels(s, synth.id, "max").ok).toBe(false);
    s.nous = levelsCost(0, 2);
    const result = upgradeAll(s, "max");
    expect(result.ok).toBe(true);
    expect(result.bulk).toEqual({ levels: 2, modules: 1, spent: levelsCost(0, 2) });
    expect(synth.level).toBe(2);
    expect(s.nous).toBe(0);
  });
});
