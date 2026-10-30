import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { pendingClaimOf } from "../src/engine/accumulator";
import { composePlaythroughRecipe, runPlaythrough } from "../src/engine/playthrough";
import { growthReport, logRigRate, responsePower, RIGS } from "./balance-growth";

describe("balance growth experiment (ADR-0078)", () => {
  it("detects Chorus and the independent Exciter runaway paths", () => {
    const report = growthReport();
    for (const name of ["chorus-five-chords", "exciter-tail", "exciter-sideband-five-chords"]) {
      const row = report.rows.find((r) => r.rig === name && r.curve === "shipped")!;
      expect(row.milestones.at(-1)!.nextWaitRatio).toBeLessThan(1);
    }
    const chorusOnly = report.rows.find((r) => r.rig === "exciter-tail" && r.curve === "chorus-bounded")!;
    expect(chorusOnly.milestones.at(-1)!.nextWaitRatio).toBeLessThan(1);
    if (process.env.FLOWSYNTH_BALANCE_REPORT) {
      writeFileSync(process.env.FLOWSYNTH_BALANCE_REPORT, JSON.stringify(report, null, 2) + "\n");
    }
  });

  it("bounded response candidates preserve the floor and leave no repeated exponential response term", () => {
    for (const type of ["chorus", "exciter"] as const) {
      expect(responsePower(0, type, "responses-bounded")).toBe(1);
      expect(responsePower(1000, type, "responses-bounded")).toBeLessThan(4);
      expect(responsePower(1e6, type, "responses-bounded")).toBeGreaterThan(responsePower(1000, type, "responses-bounded"));
    }
    for (const rig of RIGS) {
      const marginal = Math.exp(logRigRate(rig, 1000001, "responses-bounded") - logRigRate(rig, 1000000, "responses-bounded"));
      expect(marginal).toBeLessThan(1.6);
    }
  });

  it("records the four-hour fresh-start baseline through real engine actions", { skip: !process.env.FLOWSYNTH_BASELINE_REPORT, timeout: 600000 }, () => {
    const rows = [];
    for (const seed of [42, 468]) {
      for (const sessionMinutes of [25, 60]) {
        const recipe = composePlaythroughRecipe({
          seed, policyId: "pushing", claimTarget: 2,
          budgetDays: sessionMinutes === 25 ? 5 : 2,
          schedule: { sessionMinutes, sessionsPerDay: 2, breatherMinutes: 5 },
        });
        const run = runPlaythrough(recipe);
        expect(Number.isFinite(run.earnedNous)).toBe(true);
        expect(run.creditedSeconds).toBeGreaterThanOrEqual(4 * 3600);
        rows.push({
          recipe: run.recipe, source: run.source, runId: run.runId,
          stop: run.stop, creditedHours: run.creditedSeconds / 3600,
          breatherHours: run.breatherSeconds / 3600,
          earnedNous: run.earnedNous, pendingClaim: pendingClaimOf(run.state),
          claims: run.claims, lastMilestone: run.lastMilestone,
          worldDiscoveries: run.worldDiscoveries, worldDefeats: run.worldDefeats,
          maxModuleLevel: Math.max(...run.state.modules.map((m) => m.level)),
        });
      }
    }
    writeFileSync(process.env.FLOWSYNTH_BASELINE_REPORT!, JSON.stringify({
      model: "real-engine fresh-start pushing policy, four credited hours (25-minute schedule rounds to 4.167); shipped tuning only",
      rows,
    }, null, 2) + "\n");
  });
});
