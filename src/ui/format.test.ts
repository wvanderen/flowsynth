import { describe, expect, it } from "vitest";
import { formatCountdown, formatInt, formatNumber, formatPracticeMinutes, practiceCountdown } from "./format";

describe("formatNumber — the shared live-value formatter (§7)", () => {
  it("shows exact comma-grouped integers below one million", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(5)).toBe("5");
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(5004)).toBe("5,004");
    expect(formatNumber(12345)).toBe("12,345");
    expect(formatNumber(999999)).toBe("999,999");
  });

  it("never compresses exact-range integers into the ladder", () => {
    // "5004" never reads "5.00K" — the ladder starts at one million.
    expect(formatNumber(5004)).not.toContain("k");
    expect(formatNumber(999_999)).not.toContain("k");
  });

  it("gives fractional values below the exact range at most two trimmed decimals", () => {
    expect(formatNumber(0.35)).toBe("0.35");
    expect(formatNumber(0.3)).toBe("0.3");
    expect(formatNumber(0.123)).toBe("0.12");
    expect(formatNumber(1.5)).toBe("1.5");
    expect(formatNumber(12.25)).toBe("12.25");
    expect(formatNumber(1234.567)).toBe("1,234.57");
    expect(formatNumber(0.001)).toBe("0");
  });

  it("enters the suffix ladder at one million, at four significant digits", () => {
    expect(formatNumber(1_000_000)).toBe("1M");
    expect(formatNumber(1_000_001)).toBe("1M");
    expect(formatNumber(1_234_567)).toBe("1.235M");
    expect(formatNumber(99_999_999)).toBe("100M");
    expect(formatNumber(123_456_789)).toBe("123.5M");
  });

  it("walks the full short-scale ladder", () => {
    expect(formatNumber(12_345_678_901)).toBe("12.35B");
    expect(formatNumber(1e12)).toBe("1T");
    expect(formatNumber(1.234e15)).toBe("1.234Qa");
    expect(formatNumber(2e18)).toBe("2Qi");
    expect(formatNumber(3.456e21)).toBe("3.456Sx");
    expect(formatNumber(1e24)).toBe("1Sp");
    expect(formatNumber(5e27)).toBe("5Oc");
    expect(formatNumber(7.7e30)).toBe("7.7No");
  });

  it("rolls a rounded mantissa into the next rung instead of reading 1000M", () => {
    expect(formatNumber(999_999_999)).toBe("1B");
    expect(formatNumber(999_999_999_999)).toBe("1T");
  });

  it("falls back to scientific notation at 1e33", () => {
    expect(formatNumber(1e33)).toBe("1e33");
    expect(formatNumber(1.234e34)).toBe("1.234e34");
    expect(formatNumber(2.5e34)).toBe("2.5e34");
    expect(formatNumber(9.9999e33)).toBe("1e34");
    expect(formatNumber(4.2e40)).toBe("4.2e40");
  });

  it("hands a rounding carry at the top rung to scientific notation", () => {
    // 999.9No rounds to 1000No; the carry must re-enter past the ladder
    // ceiling instead of recursing on the same rung.
    expect(formatNumber(9.9996e32)).toBe("1e33");
    expect(formatNumber(9.999e32)).toBe("999.9No");
  });

  it("keeps signs and replaces non-finite values with an em dash", () => {
    expect(formatNumber(-1234)).toBe("-1,234");
    expect(formatNumber(-2e6)).toBe("-2M");
    expect(formatNumber(-1.234e34)).toBe("-1.234e34");
    expect(formatNumber(Number.NaN)).toBe("—");
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("—");
  });
});

describe("formatInt — integer quantities are always exact", () => {
  it("comma-groups whole quantities at any magnitude", () => {
    expect(formatInt(5004)).toBe("5,004");
    expect(formatInt(1_234_567)).toBe("1,234,567");
    expect(formatInt(1e9)).toBe("1,000,000,000");
    expect(formatInt(0)).toBe("0");
  });

  it("floors fractional input", () => {
    expect(formatInt(99.9)).toBe("99");
    expect(formatInt(10.000000001)).toBe("10");
  });
});

describe("formatCountdown — practice-minute spans", () => {
  it("phrases sub-hour spans as m:ss", () => {
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(4)).toBe("0:04");
    expect(formatCountdown(62)).toBe("1:02");
    expect(formatCountdown(220)).toBe("3:40");
    expect(formatCountdown(3599)).toBe("59:59");
  });

  it("rolls over to h m past an hour", () => {
    expect(formatCountdown(3600)).toBe("1h");
    expect(formatCountdown(3720)).toBe("1h 2m");
    expect(formatCountdown(4800)).toBe("1h 20m");
    expect(formatCountdown(9000)).toBe("2h 30m");
  });
});

describe("formatPracticeMinutes — the history list's credited-minute format (§8)", () => {
  it("planned sessions show credited over planned minutes", () => {
    expect(formatPracticeMinutes(600, 600)).toBe("10 / 10 min");
    expect(formatPracticeMinutes(540, 600)).toBe("9 / 10 min");
    expect(formatPracticeMinutes(900, 600)).toBe("15 / 10 min");
  });

  it("open-ended sessions show credited minutes only", () => {
    expect(formatPracticeMinutes(300, null)).toBe("5 min");
    expect(formatPracticeMinutes(0, null)).toBe("0 min");
  });

  it("rounds to the nearest minute and never goes negative", () => {
    expect(formatPracticeMinutes(90, 600)).toBe("2 / 10 min");
    expect(formatPracticeMinutes(-5, null)).toBe("0 min");
  });
});

describe("practiceCountdown — the upgrade-mode countdown decision", () => {
  it("hides when the purchase is already affordable", () => {
    expect(practiceCountdown(50, 100, 10)).toBeNull();
    expect(practiceCountdown(50, 50, 10)).toBeNull();
  });

  it("hides when no rate exists", () => {
    expect(practiceCountdown(50, 10, 0)).toBeNull();
    expect(practiceCountdown(50, 10, Number.NaN)).toBeNull();
  });

  it("phrases the wait as approximate practice time", () => {
    expect(practiceCountdown(60, 20, 10)).toBe("in ~0:04 of practice");
    expect(practiceCountdown(240, 0, 1.1)).toBe("in ~3:38 of practice");
    expect(practiceCountdown(4900, 100, 1)).toBe("in ~1h 20m of practice");
  });
});
