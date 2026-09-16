import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, pauseSession, resumeSession, startSession } from "./actions";
import { computeRates } from "./economy";
import { fresh, give } from "./fixtures";
import { hex } from "./hex";

function earned(state: ReturnType<typeof fresh>, seconds: number): number {
  const before = state.nous;
  advance(state, seconds);
  return state.nous - before;
}

describe("session rules", () => {
  it("produces nothing in upgrade mode or while paused", () => {
    const s = fresh();
    expect(earned(s, 100)).toBe(0);
    startSession(s, 600);
    pauseSession(s);
    expect(earned(s, 100)).toBe(0);
    resumeSession(s);
    expect(earned(s, 1)).toBeGreaterThan(0);
  });

  it("zero elapsed time produces nothing", () => {
    const s = fresh();
    startSession(s, 600);
    expect(earned(s, 0)).toBe(0);
  });

  it("splitting integration preserves income", () => {
    const a = fresh();
    startSession(a, 600);
    const full = earned(a, 600);

    const b = fresh();
    startSession(b, 600);
    const split = earned(b, 20) + earned(b, 580);
    expect(split).toBeCloseTo(full, 6);
  });

  it("open-ended sessions produce exactly what the board produces", () => {
    const s = fresh();
    give(s, "forge", hex(1, 0));
    startSession(s, null);
    // Carrier alone: 0.1 ν/s; the forge receives no charge (no generator).
    expect(earned(s, 3600)).toBeCloseTo(0.1 * 3600, 6);
    expect(s.forge.progress).toBe(0);
    expect(s.session?.target).toBeNull();
  });

  it("ending early keeps production; there is no completion bonus", () => {
    const s = fresh();
    startSession(s, 600);
    const half = earned(s, 300);
    expect(half).toBeCloseTo(0.1 * 300, 6);
    endSession(s);
    expect(s.totalEarned).toBeCloseTo(0.1 * 300, 6);
  });

  it("reaching the target is informational only; production continues unchanged", () => {
    const s = fresh();
    startSession(s, 600);
    expect(earned(s, 600)).toBeCloseTo(60, 6);
    expect(s.session?.elapsed).toBeCloseTo(600, 6);
    const before = s.nous;
    advance(s, 100);
    expect(s.nous - before).toBeCloseTo(10, 6);
  });

  it("accepts any timed duration; presets are a UI concern, not an engine rule", () => {
    const s = fresh();
    expect(startSession(s, 30).ok).toBe(true);
    const result = advance(s, 30);
    expect(result.nousEarned).toBeCloseTo(3, 6);
  });

  it("the first session completes like any session: no rewards beyond board production", () => {
    const s = fresh();
    startSession(s, 600);
    const result = advance(s, 600);
    expect(result.nousEarned).toBeCloseTo(60, 6);
    endSession(s);
    expect(s.sessionsCompleted).toBe(1);
  });

  it("session production derives entirely from board modules", () => {
    const s = fresh();
    startSession(s, 600);
    expect(earned(s, 600)).toBeCloseTo(60, 6);
    endSession(s);

    // Same session shape with an added harmonic: production grows only
    // because the board grew. (2,0) is pitch 3 — chordless, so the arithmetic
    // stays pure amplitude; the octave lesson lives in chords.test.ts. The
    // achievement boost is a global multiplier outside that comparison.
    give(s, "additive", hex(2, 0));
    startSession(s, 600);
    expect(earned(s, 600)).toBeCloseTo((0.1 + 0.05) * 600 * computeRates(s, true).achievementBoost, 6);
  });
});
