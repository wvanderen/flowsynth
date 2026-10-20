import { describe, expect, it } from "vitest";
import { ARETE_HORIZON } from "../../src/engine/accumulator";
import { ORDINARY, PUSHY, crossingMinute, runProgression } from "../../src/engine/capacity-calibration";

// #424 question 5: when does era-earned actually reach 1T (1e12) under the
// CURRENT engine — the capacity-calibration harness precedent, pushed past
// its horizon instead of resetting at it. The World/reset/Engineer economy
// does not exist in this engine, so whatever this walks is an optimistic
// bound on World-era entry: no debuffs, no combat, no class meters. The
// run's answer is recorded as research evidence, never as a tuning gate;
// the findings file cites these numbers as unavailable-or-measured.
//
// The walk keeps the harness's own discipline: real purchases, real
// prestige semantics, no free resources. `horizonOverride` only moves
// where the era ends; the prestige boundary still reads the era measure
// at the real horizon (capacity-calibration.ts's documented behavior).

const ENTRY = 1e12;
const SEEDS = [42, 157];

describe("current-engine 1T era-earned pacing (#424 q5)", () => {
  it(
    "walks an ordinary era past the horizon toward 1T and records what happens",
    { timeout: 3_600_000 },
    () => {
      for (const policy of [ORDINARY, PUSHY]) {
        for (const seed of SEEDS) {
          const rec = runProgression(seed, policy, {
            eras: 1,
            maxSessions: 400, // 400 × 30-minute sessions = 200 credited hours
            stepSeconds: 60,
            horizonOverride: ENTRY,
          });
          const era = rec.eras[0]!;
          const horizonMinute = crossingMinute(era, ARETE_HORIZON);
          const entryMinute = crossingMinute(era, ENTRY);
          const peak = era.earned.at(-1)!;
          // Rate over the last recorded hour: is the board still growing,
          // or has the walk plateaued below 1T?
          const hourAgo = era.earned.at(-61) ?? era.earned[0]!;
          const tailRatePerHour = (peak.value - hourAgo.value) / Math.max(peak.minute - hourAgo.minute, 1);
          console.log(
            [
              `seed=${seed} policy=${policy.name}`,
              `  horizon(${ARETE_HORIZON.toExponential(0)}) crossed at ${horizonMinute} min`,
              `  1T crossed at ${entryMinute ?? "never"} min after ${era.minutes} min (${era.minutes / 60} h)`,
              `  peak era-earned ${peak.value.toExponential(3)} at ${peak.minute} min`,
              `  tail rate ${tailRatePerHour.toExponential(3)} /h; rungs sold: ${era.milestones.length}`,
            ].join("\n"),
          );
          expect(horizonMinute).not.toBeNull();
          expect(era.earned.length).toBeGreaterThan(0);
        }
      }
    },
  );
});
