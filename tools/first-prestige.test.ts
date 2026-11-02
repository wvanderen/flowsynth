import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BASELINE_BUDGET_DAYS,
  BASELINE_SESSION_MINUTES,
  FIRST_PRESTIGE_SEEDS,
  LONG_BUDGET_DAYS,
  LONG_SESSION_MINUTES,
  TARGET_WINDOW_MAX_HOURS,
  TARGET_WINDOW_MIN_HOURS,
  classifyHours,
  firstPrestigeRecipe,
  firstPrestigeReport,
  firstPrestigeRow,
  meaningfulDecisions,
  openingDecisionGaps,
  worthwhileHoursOf,
} from "./first-prestige";
import { composePlaythroughRecipe, runPlaythrough } from "../src/engine/playthrough";

// The first-worthwhile-prestige evaluation's checks (issue #490, parent
// stories 1–4, 22–24, 28–31, and 42–43). The declared matrix and the
// reading rules run always; the full recorded report — the 32 scheduled
// walks over the eight seeds, both session shapes, and both declared
// policies — rides the FLOWSYNTH_FIRST_PRESTIGE_REPORT gate like the
// balance experiments before it, so a suite pass never pays for a
// multi-minute evaluation it did not ask for.

describe("the declared evaluation matrix", () => {
  it("declares the eight seeds, two session shapes, two policies, and the target window", () => {
    expect(FIRST_PRESTIGE_SEEDS).toEqual([42, 468, 157, 2026, 7, 99, 11, 23]);
    expect(BASELINE_SESSION_MINUTES).toBe(25);
    expect(LONG_SESSION_MINUTES).toBe(60);
    expect(TARGET_WINDOW_MIN_HOURS).toBe(8);
    expect(TARGET_WINDOW_MAX_HOURS).toBe(12);
    // Both declared policies ride the matrix; the recipes carry the
    // suite's session rhythm with only the session length swapped.
    for (const minutes of [BASELINE_SESSION_MINUTES, LONG_SESSION_MINUTES]) {
      for (const policyId of ["prompt", "pushing"]) {
        const recipe = firstPrestigeRecipe(FIRST_PRESTIGE_SEEDS[0]!, minutes, policyId);
        expect(recipe.policyId).toBe(policyId);
        expect(recipe.schedule.sessionMinutes).toBe(minutes);
        expect(recipe.schedule.sessionsPerDay).toBe(2);
        expect(recipe.schedule.breatherMinutes).toBe(5);
        expect(recipe.claimTarget).toBe(2);
      }
    }
    expect(firstPrestigeRecipe(468, BASELINE_SESSION_MINUTES, "prompt").budgetDays).toBe(BASELINE_BUDGET_DAYS);
    expect(firstPrestigeRecipe(468, LONG_SESSION_MINUTES, "pushing").budgetDays).toBe(LONG_BUDGET_DAYS);
  });

  it("classifies credited hours against the 8–12 window, unreached staying explicit", () => {
    expect(classifyHours(null)).toBe("unreached");
    expect(classifyHours(7.9)).toBe("under");
    expect(classifyHours(8)).toBe("in-window");
    expect(classifyHours(10)).toBe("in-window");
    expect(classifyHours(12)).toBe("in-window");
    expect(classifyHours(12.1)).toBe("over");
  });
});

describe("the opening decision-gap read", () => {
  // A real short walk: the fresh-start prompt policy over six baseline
  // days makes purchases, placements, and roll acceptances the rule can
  // read, without a prestige in sight.
  const record = runPlaythrough(composePlaythroughRecipe({ seed: 23, budgetDays: 9 }));

  it("reads only the ok decisions the rule names, and never session or upgrade stamps", () => {
    const decisions = meaningfulDecisions(record);
    expect(decisions.length).toBeGreaterThan(3);
    for (const event of decisions) {
      expect(["roll", "purchase", "placement", "arete", "world", "milestone"]).toContain(event.kind);
      if (event.kind === "milestone") {
        expect(
          event.label.startsWith("Poly Expander") || event.label.startsWith("Feat unlocked") ||
            event.label.startsWith("World —"),
        ).toBe(true);
      }
      expect(event.ok).toBe(true);
    }
    // Declined attempts and routine stamps stay out.
    const kinds = new Set(record.events.map((event) => event.kind));
    expect(kinds.has("session")).toBe(true);
    expect(meaningfulDecisions(record).every((event) => event.kind !== "session")).toBe(true);
  });

  it("measures credited gaps between consecutive opening decisions", () => {
    const gaps = openingDecisionGaps(record);
    expect(gaps.length).toBeGreaterThan(2);
    for (const gap of gaps) {
      expect(gap.credited).toBeGreaterThanOrEqual(0);
      expect(gap.closedBy).toBeTruthy();
    }
    // The gaps recombine to the span from the first decision to the last.
    const decisions = meaningfulDecisions(record);
    const total = gaps.reduce((sum, gap) => sum + gap.credited, 0);
    expect(total).toBe(decisions[decisions.length - 1]!.credited - decisions[0]!.credited);
  });

  it("keeps a zero-claim eligibility run out of the worthwhile classes", () => {
    // The prompt walk's first bank is the honest zero — not a worthwhile
    // prestige, and never classified as one.
    expect(record.claims).toEqual([0]);
    expect(worthwhileHoursOf(record)).toBeNull();
    const row = firstPrestigeRow(23, BASELINE_SESSION_MINUTES, record);
    expect(row.worthwhileHours).toBeNull();
    expect(row.worthwhileClass).toBe("unreached");
    expect(row.journey).not.toBeNull();
    expect(row.journey!.claim).toBe(0);
    expect(row.eligibilityHours).toBeGreaterThan(0);
    // The separate clocks ride every row.
    expect(row.creditedHours).toBeGreaterThan(0);
    expect(row.elapsedHours).toBeGreaterThan(row.creditedHours);
    expect(row.manageBreaks).toBeGreaterThan(0);
    expect(row.breatherSeconds).toBeGreaterThan(0);
    expect(row.sessionNous + row.breatherNous).toBeCloseTo(Math.round(record.sessionNous * 100) / 100 + Math.round(record.breatherNous * 100) / 100, 6);
  });
});

describe("the recorded evaluation report", { skip: !process.env.FLOWSYNTH_FIRST_PRESTIGE_REPORT, timeout: 3_600_000 }, () => {
  it("walks the full declared matrix — eight seeds, both session shapes, both policies — and records it", () => {
    const report = firstPrestigeReport();
    // 8 seeds × 2 schedules × 2 policies.
    expect(report.runs).toHaveLength(FIRST_PRESTIGE_SEEDS.length * 2 * 2);
    expect(report.distributions).toHaveLength(4);
    expect(report.source.runnerVersion).toBeGreaterThanOrEqual(11);
    // Every pushing run names its worthwhile classification; every prompt
    // run stays honestly unreached with its zero-claim door recorded.
    for (const row of report.runs) {
      expect(row.worthwhileClass).toBeTruthy();
      if (row.policy === "prompt") expect(row.worthwhileClass).toBe("unreached");
      if (row.policy === "pushing" && row.claims.length > 0) {
        expect(row.journey).not.toBeNull();
        expect(row.journey!.claim).toBe(row.claims[0]);
      }
    }
    const text = JSON.stringify(report, null, 2);
    writeFileSync(process.env.FLOWSYNTH_FIRST_PRESTIGE_REPORT!, text);
  });
});
