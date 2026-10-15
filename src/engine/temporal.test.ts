import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { applyGap, flushPendingAway } from "./trust";
import { forgeThreshold } from "./rolls";
import { endSession, pauseSession, placeModule, resumeSession, returnModule, startSession } from "./actions";
import { computeRates, emittedStrength, projectPlacement, syncRates } from "./economy";
import { AFTERGLOW_WARMUP, PULSEWELL_CYCLE, OSCILLATOR_PROFILES, GENERATOR_PROFILES, temporalTimingOf, profileAxesOf } from "./profiles";
import { deserialize, serialize } from "./save";
import { fresh, give, stubRng } from "./fixtures";
import { createMutator } from "./state";
import { hex } from "./hex";
import { BALANCE, TYPE_RARITY } from "./constants";

// The temporal profiles (issue #372, parent #366): the Afterglow warms up
// on the shared session clock and the Pulsewell delivers its earned
// reserve in predictable bursts. Public actions and state are the whole
// seam — practice time in, production and reserve out — with no
// profile-specific test API. The shared clock is the session's own: pauses
// never move it, restarts reset it, and no module holds a private timer,
// so movement and placement cannot manipulate a phase.

const SYNTH = BALANCE.synthRate;

// The Afterglow alone on the D5 island, chordless and unboosted: its whole
// value is its authored base term times the session clock's warmup factor.
function afterglowValueAt(elapsedSeconds: number, step = 60): number {
  const s = fresh();
  const module = give(s, "afterglow", hex(2, 0));
  startSession(s, null);
  const rng = stubRng(new Array(60).fill(0.5));
  for (let t = 0; t < elapsedSeconds; t += step) advance(s, Math.min(step, elapsedSeconds - t), rng);
  return computeRates(s, true).contributions.get(module.id)!.value;
}

// The Pulsewell feeding the forge receiver at (1, 0): what it delivers
// lands on the branch's meter — rolls crossed or not, `deliveredOf`
// prices the whole delivery exactly as the generators suite does.
function pulsewellBoard(reserve: number): ReturnType<typeof fresh> {
  const s = fresh();
  give(s, "pulsewell", hex(2, 0)).reserve = reserve;
  give(s, "forge", hex(1, 0));
  return s;
}

function deliveredOf(s: ReturnType<typeof fresh>): number {
  const spent = Array.from({ length: s.forge.earned }, (_, i) => forgeThreshold(i)).reduce((a, b) => a + b, 0);
  return s.forge.progress + spent;
}

describe("the Afterglow's warmup curve (#372)", () => {
  it("opens weak, warms at two minutes, sustains strong from five", () => {
    expect(afterglowValueAt(60)).toBeCloseTo(SYNTH * OSCILLATOR_PROFILES.afterglow.base * 0.3, 9);
    expect(afterglowValueAt(150)).toBeCloseTo(SYNTH * OSCILLATOR_PROFILES.afterglow.base * 0.8, 9);
    expect(afterglowValueAt(360)).toBeCloseTo(SYNTH * OSCILLATOR_PROFILES.afterglow.base * 1.25, 9);
  });

  it("the step lands at the authored mark, one second or one span", () => {
    const stepped = afterglowValueAt(121, 1);
    const spanned = afterglowValueAt(120, 120);
    expect(stepped).toBeCloseTo(SYNTH * OSCILLATOR_PROFILES.afterglow.base * 0.8, 9);
    expect(spanned).toBeCloseTo(SYNTH * OSCILLATOR_PROFILES.afterglow.base * 0.8, 9);
  });

  it("the niche: below the Sine at the open, above it sustained", () => {
    const s = fresh();
    const sine = give(s, "additive", hex(2, 0));
    startSession(s, null);
    advance(s, 60);
    const sineValue = computeRates(s, true).contributions.get(sine.id)!.value;
    endSession(s);
    expect(afterglowValueAt(60)).toBeLessThan(sineValue);
    expect(afterglowValueAt(360)).toBeGreaterThan(sineValue);
  });

  it("an open-ended session warms exactly as a planned one — no duration dependency", () => {
    const s = fresh();
    const module = give(s, "afterglow", hex(2, 0));
    startSession(s, 600);
    advance(s, 300);
    const planned = computeRates(s, true).contributions.get(module.id)!.value;
    endSession(s);
    expect(planned).toBeCloseTo(afterglowValueAt(300), 9);
  });

  it("pauses never move the clock: a paused session warms by its flowed seconds alone", () => {
    const s = fresh();
    const module = give(s, "afterglow", hex(2, 0));
    startSession(s, null);
    advance(s, 100);
    pauseSession(s);
    // While paused the board is frozen: the span runs nothing, moves no
    // clock, spends nothing.
    const frozen = advance(s, 500);
    expect(frozen.nousEarned).toBe(0);
    expect(s.session!.elapsed).toBeCloseTo(100, 9);
    resumeSession(s);
    advance(s, 20, stubRng(new Array(12).fill(0.5)));
    // 120 flowed seconds: exactly onto the second step's mark.
    expect(s.session!.elapsed).toBeCloseTo(120, 9);
    expect(computeRates(s, true).contributions.get(module.id)!.value).toBeCloseTo(SYNTH * OSCILLATOR_PROFILES.afterglow.base * 0.8, 9);
    endSession(s);
  });

  it("a restart resets the phase — no sustained carry-over, no free opening", () => {
    const s = fresh();
    const module = give(s, "afterglow", hex(2, 0));
    startSession(s, null);
    advance(s, 400);
    expect(computeRates(s, true).contributions.get(module.id)!.value).toBeCloseTo(SYNTH * OSCILLATOR_PROFILES.afterglow.base * 1.25, 9);
    endSession(s);
    startSession(s, null);
    expect(s.session!.elapsed).toBe(0);
    advance(s, 121);
    const opened = computeRates(s, true).contributions.get(module.id)!.value;
    advance(s, 179, stubRng(new Array(24).fill(0.5)));
    const warmed = computeRates(s, true).contributions.get(module.id)!.value;
    // The same session, one boost set apart: the ratio is the curve's own —
    // a carried-over phase would read sustained at both reads (ratio 1).
    expect(warmed / opened).toBeCloseTo(1.25 / 0.8, 9);
    endSession(s);
  });

  it("movement owns no timer: a moved Afterglow reads the same fresh phase as a new copy", () => {
    const s = fresh();
    s.cells.push(hex(3, 0), hex(4, 0));
    const moved = give(s, "afterglow", hex(2, 0));
    give(s, "afterglow", null);
    startSession(s, null);
    advance(s, 150);
    endSession(s);
    // The move between sessions — retrieve and re-place — touches no
    // timing state, because none exists on the module: the veteran reads
    // exactly what the fresh copy reads.
    returnModule(s, moved.id);
    placeModule(s, moved.id, hex(3, 0));
    const freshCopy = give(s, "afterglow", hex(4, 0));
    startSession(s, null);
    advance(s, 60);
    const read = computeRates(s, true).contributions;
    expect(read.get(moved.id)!.value).toBeCloseTo(read.get(freshCopy.id)!.value, 12);
    endSession(s);
  });
});

describe("the Pulsewell's burst cycle (#372)", () => {
  it("delivers the steady stretch at ×0.5 and the closing burst at ×2.5", () => {
    const s = pulsewellBoard(600);
    const rng = stubRng(new Array(24).fill(0.5));
    startSession(s, null);
    const well = s.modules.find((m) => m.type === "pulsewell")!;
    advance(s, 60, rng);
    // Mid-steady, well before the first burst's mark.
    expect(emittedStrength(s, well, true)).toBeCloseTo(PULSEWELL_CYCLE.steadyFactor, 9);
    expect(well.reserve).toBeCloseTo(600 - 30, 6);
    advance(s, 30, rng);
    // The stretch's last seconds, then the mark: the read at 90 opens the
    // burst window the authored cycle closes with.
    expect(deliveredOf(s)).toBeCloseTo(45, 6);
    expect(emittedStrength(s, well, true)).toBeCloseTo(PULSEWELL_CYCLE.burstFactor, 9);
    advance(s, 30, rng);
    expect(well.reserve).toBeCloseTo(600 - 120, 6);
    expect(deliveredOf(s)).toBeCloseTo(120, 6);
  });

  it("the cycle repeats on the clock — the burst lands on every cycle's mark", () => {
    const s = pulsewellBoard(600);
    const rng = stubRng(new Array(48).fill(0.5));
    startSession(s, null);
    advance(s, 210, rng);
    const well = s.modules.find((m) => m.type === "pulsewell")!;
    // 210 seconds in: one full cycle (45 + 75), the second cycle's steady
    // stretch complete (45) — and the read stands on the second burst's
    // front edge. The clock decides, not luck.
    expect(emittedStrength(s, well, true)).toBeCloseTo(PULSEWELL_CYCLE.burstFactor, 9);
    expect(deliveredOf(s)).toBeCloseTo(45 + 75 + 45, 6);
  });

  it("faster emission spends the reserve faster — never more of it", () => {
    const s = pulsewellBoard(600);
    const rng = stubRng(new Array(24).fill(0.5));
    startSession(s, null);
    advance(s, 90, rng);
    const steadyLeft = s.modules.find((m) => m.type === "pulsewell")!.reserve;
    endSession(s);
    // The same quantity under a fresh session's opening 30 s — steady —
    // spends a quarter of what the burst's 30 s spent above.
    const burst = pulsewellBoard(steadyLeft);
    startSession(burst, null);
    advance(burst, 30, rng);
    expect(burst.modules.find((m) => m.type === "pulsewell")!.reserve).toBeCloseTo(steadyLeft - 15, 6);
    expect(deliveredOf(burst)).toBeCloseTo(15, 6);
  });

  it("a restart cannot land a free opening burst — every session opens mid-steady", () => {
    // 90 seconds in, the next second would burst. Ending and restarting
    // instead opens at phase zero: thirty steady seconds, not thirty
    // bursting ones.
    const s = pulsewellBoard(600);
    const rng = stubRng(new Array(48).fill(0.5));
    startSession(s, null);
    advance(s, 90, rng);
    endSession(s);
    startSession(s, null);
    const before = deliveredOf(s);
    advance(s, 30, rng);
    expect(deliveredOf(s) - before).toBeCloseTo(15, 6);
    endSession(s);
  });

  it("an exhausted reserve stops the output where the quantity ends", () => {
    const s = pulsewellBoard(40);
    const rng = stubRng(new Array(24).fill(0.5));
    startSession(s, null);
    advance(s, 120, rng);
    const well = s.modules.find((m) => m.type === "pulsewell")!;
    // 40 charge at the steady ×0.5: eighty charged seconds, then dry —
    // still short of the first burst's mark.
    expect(well.reserve).toBe(0);
    expect(deliveredOf(s)).toBeCloseTo(40, 6);
    advance(s, 60, rng);
    expect(deliveredOf(s)).toBeCloseTo(40, 6);
  });

  it("ordinary endings retain the unused reserve across sessions", () => {
    const s = pulsewellBoard(600);
    const rng = stubRng(new Array(120).fill(0.5));
    startSession(s, 600);
    advance(s, 600, rng);
    endSession(s);
    // Five cycles delivered exactly 600 (the ×1.00 average); the ending
    // banks the profile's focus window — the Pulsewell's mixed 0.05.
    const well = s.modules.find((m) => m.type === "pulsewell")!;
    expect(well.reserve).toBeCloseTo(0.05 * 600, 6);
    startSession(s, null);
    const before = deliveredOf(s);
    advance(s, 90, rng);
    // The next session opens mid-steady: the banked 30 drains sixty
    // seconds in, short of the first burst.
    expect(deliveredOf(s) - before).toBeCloseTo(30, 6);
    expect(well.reserve).toBe(0);
    endSession(s);
  });
});

describe("the shared session clock (#372)", () => {
  it("catches up a week away with an empty Pulsewell without losing time", () => {
    const whole = pulsewellBoard(0);
    const chunked = pulsewellBoard(0);
    const week = 7 * 24 * 60 * 60;
    for (const state of [whole, chunked]) startSession(state, null);
    applyGap(whole, week, "away", 0, () => 0.5);
    const result = flushPendingAway(whole, () => 0.5);
    for (let elapsed = 0; elapsed < week; elapsed += 3600) {
      applyGap(chunked, 3600, "away", 0, () => 0.5);
      flushPendingAway(chunked, () => 0.5);
    }
    expect(whole.session!.elapsed).toBe(week);
    expect(whole.session!.accounting.pendingAwaySeconds).toBe(0);
    expect(whole.session!.accounting.poolSeconds).toBe(week);
    expect(whole.session!.accounting.bucketNous).toBeCloseTo(chunked.session!.accounting.bucketNous, 6);
    expect(result.nousEarned).toBeCloseTo(whole.session!.accounting.bucketNous, 6);
    expect(deliveredOf(whole)).toBe(0);
  });

  it("equivalent advancement intervals deliver equivalently — one span or many", () => {
    function run(step: number): { earned: number; reserve: number; delivered: number } {
      const s = fresh();
      const pulsewell = give(s, "pulsewell", hex(2, 0));
      pulsewell.reserve = 240;
      give(s, "afterglow", hex(2, 1));
      give(s, "forge", hex(1, 0));
      startSession(s, null);
      const rng = stubRng(new Array(120).fill(0.5));
      for (let t = 0; t < 300; t += step) advance(s, Math.min(step, 300 - t), rng);
      return { earned: s.session!.earned, reserve: pulsewell.reserve, delivered: deliveredOf(s) };
    }
    const one = run(300);
    const four = run(75);
    const many = run(1);
    for (const result of [four, many]) {
      expect(result.earned).toBeCloseTo(one.earned, 6);
      expect(result.reserve).toBeCloseTo(one.reserve, 6);
      expect(result.delivered).toBeCloseTo(one.delivered, 6);
    }
    // And the totals say what the curves author: the reserve spent to its
    // last unit inside five cycles, whatever the step shape.
    expect(one.reserve).toBeCloseTo(0, 6);
    expect(one.delivered).toBeCloseTo(240, 6);
  });

  it("both temporal profiles ride the one session — a restart resets both phases together", () => {
    const s = fresh();
    const afterglow = give(s, "afterglow", hex(2, 1));
    const pulsewell = give(s, "pulsewell", hex(2, 0));
    pulsewell.reserve = 6000; // charged neighbor both reads: the curve alone moves the ratio
    give(s, "forge", hex(1, 0));
    startSession(s, null);
    advance(s, 400, stubRng(new Array(60).fill(0.5)));
    expect(emittedStrength(s, pulsewell, true)).toBeCloseTo(PULSEWELL_CYCLE.steadyFactor, 9);
    endSession(s);
    startSession(s, null);
    advance(s, 121, stubRng(new Array(24).fill(0.5)));
    // Both phases fresh: the Pulsewell reads a steady stretch (a carried
    // phase would land mid-cycle at luck), and the Afterglow's two reads
    // inside this session sit one step apart — a carried phase would read
    // sustained at both.
    expect(emittedStrength(s, pulsewell, true)).toBeCloseTo(PULSEWELL_CYCLE.steadyFactor, 9);
    const opened = computeRates(s, true).contributions.get(afterglow.id)!.value;
    advance(s, 179, stubRng(new Array(24).fill(0.5)));
    const warmed = computeRates(s, true).contributions.get(afterglow.id)!.value;
    expect(warmed / opened).toBeCloseTo(1.25 / 0.8, 9);
  });

  it("the phase survives a mid-session save round-trip", () => {
    const s = fresh();
    const afterglow = give(s, "afterglow", hex(2, 0));
    startSession(s, null);
    advance(s, 150);
    const restored = deserialize(serialize(s, 7)).state!;
    // The session itself reloads — no restart, no reset: the reloaded
    // clock speaks the same phase.
    expect(restored.session!.elapsed).toBeCloseTo(150, 6);
    expect(computeRates(restored, true).contributions.get(afterglow.id)!.value).toBeCloseTo(SYNTH * OSCILLATOR_PROFILES.afterglow.base * 0.8, 9);
  });
});

describe("progression and mutators preserve the temporal conditions (#372)", () => {
  it("levels and tiers scale the warm term; the curve's marks never move", () => {
    const opening = afterglowValueAt(60);
    const sustained = afterglowValueAt(360);
    expect(sustained / opening).toBeCloseTo(1.25 / 0.3, 9);
  });

  it("a power mutator scales the term around the condition", () => {
    const s = fresh();
    const module = give(s, "afterglow", hex(2, 0));
    s.mutators.push({ ...createMutator(s, "power", "common"), pos: hex(2, 0) });
    startSession(s, null);
    advance(s, 60);
    const mutated = computeRates(s, true).contributions.get(module.id)!.value;
    endSession(s);
    expect(mutated).toBeCloseTo(afterglowValueAt(60) * 1.5, 9);
  });

  it("the Pulsewell's earning scales by power; the cycle's shape does not", () => {
    const s = fresh();
    // The roster's first uncommon design: its rarity power (1.25 per
    // level) is the whole scaling, three levels deep.
    const well = give(s, "pulsewell", hex(2, 0), 3);
    const power = 1.25 ** 3;
    well.reserve = 600 * power;
    give(s, "forge", hex(1, 0));
    startSession(s, 600);
    advance(s, 600, stubRng(new Array(240).fill(0.5)));
    endSession(s);
    // The bank rode the same power as delivery: five cycles at the ×1.00
    // average spend exactly the banked quantity, rhythm unchanged — and
    // the ending banks the mixed focus window at that same power.
    expect(well.reserve).toBeCloseTo(0.05 * 600 * power, 6);
  });
});

describe("the temporal profiles on the authoritative seams (#372)", () => {
  it("the allocation weighs the factor: the warm Afterglow takes the chord seat the cold one yields", () => {
    // One doubled D class and one A: the Fifth can ring through either
    // D voice, and capacity one forces the choice. Both seats convert the
    // bonus equally (two Sines' responses), so the seat belongs to the
    // heavier weight — and the session clock alone decides which one that
    // is: cold, the doubled Sine's seat; sustained, the Afterglow's.
    const s = fresh();
    const afterglow = give(s, "afterglow", hex(2, 0));
    const rival = give(s, "additive", hex(2, 1));
    give(s, "additive", hex(3, 0));
    const activeMembers = (): string[] => syncRates(s, true).allocation!.active.flatMap((inst) => inst.memberIds);
    startSession(s, null);
    advance(s, 30);
    expect(activeMembers()).toContain(rival.id);
    expect(activeMembers()).not.toContain(afterglow.id);
    advance(s, 370); // past the sustained mark
    expect(activeMembers()).toContain(afterglow.id);
    expect(activeMembers()).not.toContain(rival.id);
  });

  it("the upgrade-mode preview shows the fresh-session phase the commit opens at", () => {
    const s = fresh();
    s.cells.push(hex(2, 0));
    const afterglow = give(s, "afterglow", null);
    const projection = projectPlacement(s, afterglow.id, hex(2, 0), true);
    const projected = projection.projected.contributions.get(afterglow.id)!.value;
    expect(projected).toBeCloseTo(SYNTH * OSCILLATOR_PROFILES.afterglow.base * 0.3, 9);
    placeModule(s, afterglow.id, hex(2, 0));
    startSession(s, null);
    advance(s, 1, stubRng(new Array(12).fill(0.5)));
    expect(computeRates(s, true).contributions.get(afterglow.id)!.value).toBeCloseTo(projected, 9);
  });

  it("timing is described directly — axes stay graded, the curve takes no letter", () => {
    // The Afterglow's comparable axes grade from the same bands as every
    // profile; the warmup is not among them.
    expect(profileAxesOf("afterglow").map((axis) => axis.grade).join("")).toBe("ABBB");
    expect(profileAxesOf("pulsewell")).toEqual([]);
    expect(temporalTimingOf("afterglow")?.label).toBe("Warm-up");
    expect(temporalTimingOf("afterglow")?.timing).toBe("×0.3 open · ×0.8 from 2 min · ×1.25 sustained from 5 min");
    expect(temporalTimingOf("pulsewell")?.label).toBe("Burst cycle");
    expect(temporalTimingOf("pulsewell")?.timing).toBe("×0.5 steady · ×2.5 burst, 30 s every 2 min");
    expect(temporalTimingOf("additive")).toBeNull();
  });

  it("the authored rarities are the roster's first uncommon band", () => {
    expect(TYPE_RARITY.afterglow).toBe("uncommon");
    expect(TYPE_RARITY.pulsewell).toBe("uncommon");
    // The mixed earning profile: half of every specialist on its own axis.
    expect(GENERATOR_PROFILES.pulsewell).toEqual({ focus: 0.05, noteChar: 0.5, noteCreate: 15, goal: 2.5 });
    expect(AFTERGLOW_WARMUP.map((step) => step.factor)).toEqual([0.3, 0.8, 1.25]);
  });
});
