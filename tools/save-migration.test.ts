import { describe, expect, it } from "vitest";
import { bankableClaimOf } from "../src/engine/accumulator";
import { buyChargeColumn, endSession, startSession, upgradeModule } from "../src/engine/actions";
import { advance } from "../src/engine/advance";
import { BALANCE } from "../src/engine/constants";
import { deserialize, serialize } from "../src/engine/save";
import { continuePlaythrough, composePlaythroughRecipe, playthroughSource, stateNumbersFinite } from "../src/engine/playthrough";
import { SUPPLIED_BOARD_LEVEL, SUPPLIED_BOARD_MODULE_COUNT, suppliedBoardState } from "./century";

// The save translation's recoverability evidence (issue #493, parent
// #484's stories 35–37, 39–40, 43): the anonymized supplied-board
// position — the overpowered topology the century record walked —
// arrives as v12 save bytes, converts once at the boundary, and plays.
// The raw position's recorded stranding (frontier 684, then unreachable)
// is what the conversion repairs; the collection-reset grounding is what
// the conversion implements, beside the ticket's determined
// Arete/purchase/frontier treatment.

// The overpowered position, carried as a v12 save: the fixture's state
// with the era measure a runaway left representable — every figure
// finite, the levels at the float64 boundary.
function overpoweredV12Text(): string {
  const state = suppliedBoardState();
  state.eraEarned = 4e14;
  const file = JSON.parse(serialize(state, 1_000));
  file.version = 12;
  return JSON.stringify(file);
}

function migrated() {
  const loaded = deserialize(overpoweredV12Text());
  expect(loaded.error).toBeUndefined();
  return { state: loaded.state!, report: loaded.migration! };
}

describe("the calibrated translation's recoverability (issue #493)", () => {
  it("the overpowered position converts once: the era resets, the collection stands, no entitlement mints", () => {
    const { state, report } = migrated();
    // The era reset took the collection's levels and the runaway-era
    // balances; the tiers and board stand; the enemies restore with the
    // era. The save-boundary cases assert the full retention list; these
    // name the fixture's own figures.
    expect(report).toMatchObject({
      fromVersion: 12,
      modulesCleared: SUPPLIED_BOARD_MODULE_COUNT,
      eraEarnedCleared: 4e14,
      nousCleared: 8.2e9,
      frontierCleared: 0,
      areteRetained: 0,
    });
    expect(state.modules.every((m) => m.level === 0 && m.invested === 0)).toBe(true);
    // The mix's tier spread survives: rare-tier plates ride the reset.
    expect(state.modules.some((m) => m.tier === 3)).toBe(true);
    expect(state.eraEarned).toBe(0);
    expect(state.world.frontier).toBe(0);
    expect(state.nous).toBe(BALANCE.openingGrant);
    // The conversion grants nothing: no Arete, no instant claim, and the
    // whole state carries only finite numbers the save can hold.
    expect(state.arete).toBe(0);
    expect(bankableClaimOf(state)).toBe(0);
    expect(stateNumbersFinite(state)).toBe(true);
  });

  it("the converted position plays through real engine actions: finite production, working purchases", () => {
    const { state } = migrated();
    // A session on the converted board produces finite nous and rate —
    // the retained collection re-growing from the calibrated opening.
    startSession(state, 600);
    const result = advance(state, 30);
    expect(result.nousEarned).toBeGreaterThan(0);
    expect(Number.isFinite(result.nousEarned)).toBe(true);
    endSession(state);
    // The session's credited earnings bought development on the retained
    // collection: the economy's purchase path works from the opening.
    upgradeModule(state, state.modules[0]!.id);
    expect(state.modules[0]!.level).toBe(1);
    expect(stateNumbersFinite(state)).toBe(true);
  });

  it("the retained Arete funds an affordable no-refund route beside the claims", () => {
    const file = JSON.parse(overpoweredV12Text());
    file.state.arete = 6;
    const loaded = deserialize(JSON.stringify(file));
    const state = loaded.state!;
    expect(loaded.migration!.areteRetained).toBe(6);
    // The World purchase route: a Charge Column buys at the calibrated
    // ladder's floor, and no refund path exists to unwind it.
    const result = buyChargeColumn(state);
    expect(result.ok).toBe(true);
    expect(state.world.columns).toHaveLength(1);
    expect(state.arete).toBe(5);
    expect(stateNumbersFinite(state)).toBe(true);
    // And the claim route stands beside it: the frontier at zero leaves
    // the whole calibrated ladder ahead, with nothing banked against.
    expect(bankableClaimOf(state)).toBe(0);
    expect(state.eraEarned).toBe(0);
  });

  it("the boundary level rides the conversion without loss, and the converted bytes round-trip as v13", () => {
    // The fixture's levels sit at the float64 boundary (invested
    // 1.65e308 at 1504): the conversion must clear them without ever
    // producing a nonfinite figure, and the converted bytes reload as
    // v13 untouched — the idempotence proof at the real fixture's shape.
    const { state } = migrated();
    const deepest = state.modules.reduce((max, m) => Math.max(max, m.invested), 0);
    expect(deepest).toBe(0);
    expect(SUPPLIED_BOARD_LEVEL).toBe(1504);
    const text = serialize(state, 1_000);
    const reloaded = deserialize(text);
    expect(reloaded.error).toBeUndefined();
    expect(reloaded.migration).toBeUndefined();
    expect(serialize(reloaded.state!, 1_000)).toBe(text);
  });

  // The scheduled converted-play evidence, behind the declared tier (the
  // century evidence's precedent): a four-credited-hour support-policy
  // continuation on the migrated position, through the runner's real
  // engine actions. The recorded run banked a 6-Arete claim inside four
  // credited hours — the frontier past the translated zero — with the
  // century stop reached and every figure finite. Recorded run:
  // docs/evidence/issue-493/converted-walk.json.
  it("the scheduled walk banks calibrated claims past the translated frontier", { skip: !process.env.FLOWSYNTH_SAVE_MIGRATION_WALK, timeout: 3_600_000 }, () => {
    const { state } = migrated();
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
  });
});
