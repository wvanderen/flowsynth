import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { bankableClaimOf } from "../src/engine/accumulator";
import { endSession, startSession, upgradeModule } from "../src/engine/actions";
import { advance } from "../src/engine/advance";
import { BALANCE } from "../src/engine/constants";
import { deserialize, recoverLostSave, serialize } from "../src/engine/save";
import { continuePlaythrough, composePlaythroughRecipe, playthroughSource, stateNumbersFinite } from "../src/engine/playthrough";
import { recordingPayload } from "./dev/runtime.mjs";
import { SUPPLIED_BOARD_LEVEL, SUPPLIED_BOARD_MODULE_COUNT, suppliedBoardState } from "./century";
import { investment } from "../src/engine/economy";

// The lost-money recovery's recoverability evidence (issue #494, parent
// #484's stories 34, 38–40, 43): the anonymized supplied-board position —
// the same synthetic topology the century record walked — arrives as the
// pre-integrity build wrote it. The reported save's monetary fields are
// null because the runaway's arithmetic exceeded what JSON could hold:
// nonfinite numbers serialize to null. The fixture reproduces exactly
// that mechanism — levels two past the float64 boundary, the balances
// driven nonfinite — and never publishes the personal save, its note
// content, its habit names, or its practice details. No historical
// balance is reconstructed: the recovery names what was lost and starts
// those figures at their calibrated values.

// The overpowered position as the old build's bytes: the fixture's
// levels at 1506 — two past the boundary, so every invested sum is
// nonfinite — and the monetary figures driven nonfinite with them. The
// JSON.stringify pass is the corruption itself: it writes null.
function suppliedLostMoneyV12Text(): string {
  const state = suppliedBoardState();
  for (const module of state.modules) {
    module.level = SUPPLIED_BOARD_LEVEL + 2;
    module.invested = investment(module.level);
  }
  state.nous = Infinity;
  state.totalEarned = Infinity;
  state.eraEarned = Infinity;
  state.arete = Infinity;
  const file = { app: "flowsynth", version: 12, savedAt: 1_000, state: JSON.parse(JSON.stringify(state)) };
  // The nulls are the corruption's own output; assert the mechanism.
  expect(file.state.modules[0].invested).toBeNull();
  expect(file.state.nous).toBeNull();
  return JSON.stringify(file);
}

function recovered() {
  const loaded = recoverLostSave(suppliedLostMoneyV12Text());
  expect(loaded.error).toBeUndefined();
  return { state: loaded.state!, report: loaded.recovered! };
}

describe("the lost-money recovery's recoverability (issue #494)", () => {
  it("the supplied position recovers once: the lost figures named, the collection reset onto the calibrated economy", () => {
    const { state, report } = recovered();
    // Every monetary figure the corruption named — the four balances
    // plus each module's investment at the overflowing level (the
    // supplied collection beside the opening starter; the walk reads the
    // raw save, before the catalog entry's backfill adds its module).
    const moduleLost = Array.from({ length: SUPPLIED_BOARD_MODULE_COUNT + 1 }, (_, index) => `modules[${index}].invested`);
    expect(report.lost).toEqual(["nous", "totalEarned", "eraEarned", "arete", ...moduleLost]);
    expect(report.fromVersion).toBe(12);
    // The era reset landed: levels at base, the wallet at the opening
    // grant, the unreadable ledgers at zero.
    expect(state.modules.every((m) => m.level === 0 && m.invested === 0)).toBe(true);
    expect(state.nous).toBe(BALANCE.openingGrant);
    expect(state.eraEarned).toBe(0);
    expect(state.totalEarned).toBe(0);
    expect(state.arete).toBe(0);
    // The retention half stands: the tier spread and the board's mix —
    // the full supplied collection beside the opening starter — and
    // every enemy restored with the era.
    // The retention half stands: the tier spread and the board's mix —
    // the full supplied collection beside the opening starter — and
    // every enemy restored with the era. The catalog entry's Mutator
    // Forge backfill rides every load, recovery included.
    expect(state.modules).toHaveLength(SUPPLIED_BOARD_MODULE_COUNT + 2);
    expect(state.modules.some((m) => m.tier === 3)).toBe(true);
    expect(state.world.frontier).toBe(0);
    expect(bankableClaimOf(state)).toBe(0);
    expect(stateNumbersFinite(state as unknown as Record<string, unknown>)).toBe(true);
    // The recovered bytes round-trip as v13: no re-recovery, no second
    // reset, an identical state.
    const text = serialize(state, 1_000);
    const reloaded = deserialize(text);
    expect(reloaded.error).toBeUndefined();
    expect(reloaded.recovered).toBeUndefined();
    expect(reloaded.migration).toBeUndefined();
    expect(serialize(reloaded.state!, 1_000)).toBe(text);
  });

  it("the recovered position plays: flow production, working purchases, and a claim route past the cleared frontier", () => {
    const { state } = recovered();
    startSession(state, 600);
    const first = advance(state, 30);
    expect(first.nousEarned).toBeGreaterThan(0);
    expect(Number.isFinite(first.nousEarned)).toBe(true);
    endSession(state);
    // The opening grant affords real development on the retained
    // collection — the economy's purchase path from the calibrated
    // opening.
    upgradeModule(state, state.modules[0]!.id);
    expect(state.modules[0]!.level).toBe(1);
    expect(stateNumbersFinite(state as unknown as Record<string, unknown>)).toBe(true);
    // The frontier cleared to zero: the whole calibrated claim ladder
    // stands ahead, banked against newly earned depth alone — nothing
    // the recovery granted sits banked against it.
    expect(bankableClaimOf(state)).toBe(0);
    expect(state.world.frontier).toBe(0);
  });

  // The scheduled recovered play evidence, behind the declared tier (the
  // migration walk's precedent): the same four-credited-hour support-policy
  // continuation the finite conversion recorded, run from the recovered
  // fixture. The frontier cleared to zero, so the first positive claim
  // banks against newly earned depth alone — the affordable
  // next-frontier route the ticket asks the recovered fixtures to
  // demonstrate. FLOWSYNTH_SAVE_RECOVERY_WALK names the artifact path;
  // running it records docs/evidence/issue-494/recovered-walk.json.
  it("the scheduled walk banks calibrated claims past the cleared frontier", { skip: !process.env.FLOWSYNTH_SAVE_RECOVERY_WALK, timeout: 3_600_000 }, () => {
    const { state, report } = recovered();
    const recipe = composePlaythroughRecipe({
      seed: 42,
      policyId: "support",
      claimTarget: 2,
      eras: 1,
      stopCreditedHours: 4,
      budgetDays: 40,
      schedule: { sessionsPerDay: 2, sessionMinutes: 60, breatherMinutes: 5 },
    });
    const record = continuePlaythrough(recipe, state, playthroughSource());
    expect(record.stop.kind).toBe("century");
    expect(record.creditedSeconds).toBeGreaterThanOrEqual(4 * 3600);
    expect(record.claims.length).toBeGreaterThanOrEqual(1);
    expect(record.claims[0]).toBeGreaterThanOrEqual(1);
    expect(stateNumbersFinite(record as unknown as Record<string, unknown>)).toBe(true);
    // Issue #505's rule: a recording names the runtime and timezone it
    // actually ran on.
    writeFileSync(process.env.FLOWSYNTH_SAVE_RECOVERY_WALK!, JSON.stringify(recordingPayload({
      ticket: "https://github.com/wvanderen/flowsynth/issues/494",
      what: "the recovered supplied-board position's scheduled continuation: the lost-money recovery's affordable route past the cleared frontier, four credited hours on the support policy",
      recordedAt: new Date().toISOString(),
      saveVersion: 13,
      runId: record.runId,
      recipe: record.recipe,
      source: record.source,
      recoveryReport: report,
      stop: record.stop,
      claims: record.claims,
      creditedHours: record.creditedSeconds / 3600,
      days: record.days,
      numbersFinite: stateNumbersFinite(record as unknown as Record<string, unknown>),
    }), null, 2) + "\n");
  });
});
