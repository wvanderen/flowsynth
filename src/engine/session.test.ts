import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, pauseSession, resumeSession, startSession } from "./actions";
import { chargeSecondsRemaining } from "./economy";
import { fresh, give, grantBurst, setActive } from "./fixtures";
import { hex } from "./hex";

function earned(state: ReturnType<typeof fresh>, seconds: number): number {
  const before = state.nous;
  advance(state, seconds);
  return state.nous - before;
}

describe("session rules", () => {
  it("produces nothing in upgrade mode or while paused", () => {
    const s = fresh();
    setActive(s);
    grantBurst(s, 1, 60);
    expect(earned(s, 100)).toBe(0);
    startSession(s, 600);
    pauseSession(s);
    expect(earned(s, 100)).toBe(0);
    resumeSession(s);
    expect(earned(s, 1)).toBeGreaterThan(0);
  });

  it("zero elapsed time produces nothing", () => {
    const s = fresh();
    setActive(s);
    grantBurst(s, 1, 60);
    startSession(s, 600);
    expect(earned(s, 0)).toBe(0);
  });

  it("splitting integration preserves income", () => {
    const a = fresh();
    setActive(a);
    grantBurst(a, 1, 60);
    startSession(a, 600);
    const full = earned(a, 600);

    const b = fresh();
    setActive(b);
    grantBurst(b, 1, 60);
    startSession(b, 600);
    const split = earned(b, 20) + earned(b, 580);
    expect(split).toBeCloseTo(full, 6);
  });

  it("open-ended sessions consume banked charge but earn no burst", () => {
    const s = fresh();
    setActive(s);
    give(s, "forge", hex(0, 0));
    startSession(s, null);
    expect(earned(s, 3600)).toBeCloseTo(0.12 * 3600, 6);
    expect(s.forge.progress).toBe(0);

    const t = fresh();
    setActive(t);
    give(t, "forge", hex(0, 0));
    grantBurst(t, 1, 60);
    startSession(t, null);
    earned(t, 3600);
    expect(t.forge.earned).toBe(1);
    expect(t.forge.progress).toBeCloseTo(0, 6);
    expect(chargeSecondsRemaining(t)).toBe(0);
    expect(t.session?.burstAwarded).toBeFalsy();
  });

  it("ending early keeps production and withholds the completion burst", () => {
    const s = fresh();
    setActive(s);
    startSession(s, 600);
    const half = earned(s, 300);
    expect(half).toBeCloseTo(0.12 * 300, 6);
    endSession(s);
    expect(chargeSecondsRemaining(s)).toBe(0);
    expect(s.totalEarned).toBeCloseTo(0.12 * 300, 6);
  });

  it("a session ending exactly at target queues its burst intact", () => {
    const s = fresh();
    setActive(s);
    startSession(s, 600);
    expect(earned(s, 600)).toBeCloseTo(72, 6);
    expect(s.session?.burstAwarded).toBe(true);
    endSession(s);
    expect(chargeSecondsRemaining(s)).toBeCloseTo(60, 6);
  });

  it("awards the completion burst once; it acts immediately but never powers earlier time", () => {
    const s = fresh();
    setActive(s);
    startSession(s, 600);
    const result = advance(s, 700);
    expect(result.burstAwarded).toBe(true);
    expect(s.nous).toBeCloseTo(0.12 * 600 + 0.18 * 60 + 0.12 * 40, 6);
    expect(chargeSecondsRemaining(s)).toBeCloseTo(0, 6);
    const before = s.nous;
    advance(s, 100);
    expect(s.nous).toBeGreaterThan(before);
    expect(s.session?.burstAwarded).toBe(true);
  });

  it("accepts any timed duration; presets are a UI concern, not an engine rule", () => {
    const s = fresh();
    expect(startSession(s, 30).ok).toBe(true);
    const result = advance(s, 30);
    expect(result.nousEarned).toBeCloseTo(3, 6);
  });

  it("the first session neither multiplies nor awards a burst", () => {
    const s = fresh();
    startSession(s, 600);
    const result = advance(s, 600);
    expect(result.nousEarned).toBeCloseTo(60, 6);
    expect(result.burstAwarded).toBe(false);
    expect(result.storeOpened).toBe(false);
    endSession(s);
    expect(s.timeActive).toBe(true);
    expect(s.storeOpened).toBe(false);
    expect(chargeSecondsRemaining(s)).toBe(0);
  });

  it("the first completed timed target after Time activates opens the store", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    startSession(s, 600);
    const result = advance(s, 600);
    expect(result.storeOpened).toBe(true);
    expect(s.storeOpened).toBe(true);
  });

  it("an early first session still activates Time; a later timed completion opens the store", () => {
    const s = fresh();
    startSession(s, 600);
    advance(s, 30);
    endSession(s);
    expect(s.timeActive).toBe(true);
    expect(s.storeOpened).toBe(false);
    startSession(s, 600);
    const result = advance(s, 600);
    expect(result.storeOpened).toBe(true);
    expect(result.burstAwarded).toBe(true);
  });
});

describe("accepted opening numbers", () => {
  it("matches the three-session tutorial reference", () => {
    const s = fresh();
    const rng = () => 0.5;

    startSession(s, 600);
    const first = advance(s, 600, rng);
    expect(first.nousEarned).toBeCloseTo(60, 6);
    endSession(s);

    startSession(s, 600);
    const second = advance(s, 600, rng);
    expect(second.nousEarned).toBeCloseTo(72, 6);
    endSession(s);
    expect(s.nous).toBeCloseTo(132, 6);
    expect(s.storeOpened).toBe(true);

    expect(s.nous).toBeGreaterThanOrEqual(120);
    s.nous -= 40;
    s.purchased.additive = true;
    s.modules.push({ id: "add", type: "additive", rarity: "common", level: 0, invested: 0, pos: hex(0, 0), bursts: [] });
    s.nous -= 80;
    s.purchased.forge = true;
    s.modules.push({ id: "frg", type: "forge", rarity: "common", level: 0, invested: 0, pos: hex(2, 0), bursts: [] });
    expect(s.nous).toBeCloseTo(12, 6);

    startSession(s, 600);
    const third = advance(s, 600, rng);
    expect(third.nousEarned).toBeCloseTo(113.4, 6);
    expect(s.bankedRolls.length).toBe(1);
    endSession(s);
  });
});
