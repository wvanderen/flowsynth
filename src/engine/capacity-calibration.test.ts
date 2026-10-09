import { describe, expect, it } from "vitest";
import { ARETE_HORIZON } from "./accumulator";
import { AGGRESSIVE, ORDINARY, PUSHY, runProgression } from "./capacity-calibration";

// The harmonic-capacity release calibration (issue #262): the adopted
// tuning's pacing record, run through the authoritative progression —
// real purchases (Catalog entry and prerequisites included), practice
// advancement and prestige, never free resources — on the allocation
// economy every state rides by default. The first era crosses
// the horizon near twenty credited hours of ordinary play and the second
// lands provisionally near seventy percent of that; both are tuning
// targets with tolerance bands here, not hard gates. The always-on tier
// guards the adopted figures on one seed; the full multi-seed battery
// and the ten-era ladder walks (FLOWSYNTH_CALIBRATION=1) are the release
// evidence recorded in docs/capacity-release-tuning.md.

const FULL = !!process.env.FLOWSYNTH_CALIBRATION;
const SEEDS = [157, 42, 2026, 7, 99, 11, 23, 77];

describe("the harmonic-capacity release calibration (#262)", () => {
  it("paces the first era near twenty credited hours and the second provisionally near seventy percent", () => {
    // Seed 2026 is the recorded median ordinary seed at the adopted
    // tuning (full distributions in the calibration tier and in
    // docs/capacity-release-tuning.md).
    const rec = runProgression(2026, ORDINARY, { eras: 2, maxSessions: 80, stepSeconds: 120 });
    const [era1, era2] = rec.eras;
    expect(era2).toBeDefined();
    // The first era: the horizon stands near twenty credited hours for
    // ordinary play (the recorded eight-seed median is 1,215 minutes).
    expect(era1.minutes).toBeGreaterThan(950);
    expect(era1.minutes).toBeLessThan(1400);
    expect(rec.eras[0]!.earned.at(-1)!.value).toBeGreaterThanOrEqual(ARETE_HORIZON);
    // The second era: provisionally near seventy percent, meaningfully
    // shorter but never collapsing into an immediate re-crossing.
    const ratio = era2!.minutes / era1.minutes;
    expect(ratio).toBeGreaterThan(0.45);
    expect(ratio).toBeLessThan(0.85);
    // The claims bank the linear base: the first two resets bank one and
    // two Arete — no other code path mints any.
    expect(rec.claims).toEqual([1, 2]);
    // Both first-era rungs sold inside the era, each opening a real
    // optimization opportunity on the board the player actually held.
    const rungs = era1.milestones.map((milestone) => milestone.rung);
    expect(rungs).toEqual([1, 2]);
    for (const milestone of era1.milestones) {
      expect(milestone.rateAfter).toBeGreaterThan(milestone.rateBefore * 1.1);
    }
  }, 600_000);

  it("sells the ceiling-unlocked rungs when the Arete ladders open, without collapsing the rebuild", { skip: !FULL, timeout: 3_600_000 }, async () => {
    // The ten-era walk: both Arete ladders complete (two discounts, two
    // ceilings), the first ceiling-unlocked rung sells the era after its
    // ceiling opens, the top rung sells under the saving posture, and no
    // era ever collapses — every rebuild stays a substantial fraction of
    // the first era, so the finite offerings never recreate an immediate
    // repeatable prestige.
    for (const policy of [ORDINARY, AGGRESSIVE]) {
      const rec = runProgression(157, policy, { eras: 10, maxSessions: 80, stepSeconds: 120 });
      expect(rec.eras.length).toBe(10);
      // The playable Arete path: the Catalog entry paid first, then both
      // ladders complete (two discounts, two ceilings).
      expect(rec.areteSpent).toEqual({ entry: 1, ceilings: 2, discounts: 2 });
      const rungs = new Set(rec.eras.flatMap((era) => era.milestones.map((milestone) => milestone.rung)));
      expect(rungs).toContain(1);
      expect(rungs).toContain(2);
      expect(rungs).toContain(3);
      if (policy === AGGRESSIVE) expect(rungs).toContain(4);
      for (const era of rec.eras) {
        expect(era.minutes).toBeGreaterThan(rec.eras[0]!.minutes * 0.4);
      }
      // The claims bank the era count, one per prestige — the linear base
      // the harness's at-threshold resets always see.
      expect(rec.claims).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    }
  });

  it("reports the full seed-and-policy distributions under the calibration tier", { skip: !FULL, timeout: 7_200_000 }, async () => {
    const report: string[] = [];
    for (const policy of [ORDINARY, PUSHY, AGGRESSIVE]) {
      for (const seed of SEEDS) {
        const rec = runProgression(seed, policy, { eras: 2, maxSessions: 80, stepSeconds: 60 });
        const [era1, era2] = rec.eras;
        const jumps = (era: typeof era1) =>
          era.milestones.map((m) => `r${m.rung}@${m.minute}m+${((m.rateAfter / Math.max(m.rateBefore, 1e-9) - 1) * 100).toFixed(0)}%`).join(",");
        report.push(
          [
            `seed=${seed} ${policy.name}: era1=${era1.minutes}min era2=${era2?.minutes ?? "uncrossed"}min`,
            `  ratio=${era2 ? (era2.minutes / era1.minutes).toFixed(3) : "-"} cells=${era1.cells} voices=${era1.voices} claims=${JSON.stringify(rec.claims)}`,
            `  era1 ${jumps(era1)}`,
            ...(era2 ? [`  era2 ${jumps(era2)}`] : []),
          ].join("\n"),
        );
        // Every crossing is real production, never a grant: the era's
        // earned measure is bounded by the horizon by the crossing's
        // definition, and both eras' purchases spent whole nous.
        for (const era of rec.eras) {
          for (const milestone of era.milestones) {
            expect(milestone.rateAfter).toBeGreaterThanOrEqual(milestone.rateBefore);
          }
        }
      }
    }
    console.log(`\nfirst- and second-horizon distributions (ARETE_HORIZON=${ARETE_HORIZON.toExponential(0)}):\n${report.join("\n")}`);
  });
});
