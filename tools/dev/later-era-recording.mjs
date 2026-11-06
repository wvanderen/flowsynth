// The later-era recording domain's adapter half (issue #507): how the job
// supervisor's units compose into the published evidence. The compiled
// bundle owns identity and execution (tools/later-eras.ts); this module
// owns publication and slice-shape verification — the same functions the
// run CLI uses to publish and the compose command uses to verify. Plain
// JavaScript so the npm-script path runs under plain node; imported by the
// CLI and by the verification, so production recording and its checks
// cannot drift apart.
import assert from "node:assert/strict";
import { writeJsonAtomic, recordingPayload } from "./runtime.mjs";

export const PROBE_EVIDENCE_PATH = "docs/later-era-probe.json";
export const slicePath = (minutes, policy) => `docs/later-era-slice-${minutes}-${policy}.json`;

// The slice-shape checks both the job's publication and composition
// enforce: the full seed matrix in declared order, each row's identity,
// and the postponed-combat policy's own faces.
export const assertSliceRows = (m, rows, minutes, policy) => {
  assert.deepEqual(rows.map(row => row.seed), m.LATER_ERA_SEEDS);
  for (const row of rows) {
    m.assertLaterEraRowCore(row);
    assert.equal(row.sessionMinutes, minutes);
    assert.equal(row.policy, policy);
    if (policy === "ignoring") {
      assert.deepEqual(row.defeats, []);
      assert.ok(row.eras.every(era => era.placements.length === 0));
    }
  }
};

export const unitProvenanceOf = (unitsById) => Object.fromEntries(
  Object.entries(unitsById).map(([id, unit]) => [id, {
    recordingCommit: unit.provenance.recordingCommit,
    recordingEnvironment: unit.provenance.recordingEnvironment,
  }]),
);

// `paths.slice` overrides the published slice file's location (the
// verification passes isolated paths; the CLI publishes the committed
// default).
export const sliceGroup = (m, source, slice, paths = {}) => {
  const [minutes, policy] = slice;
  return {
    id: `slice-${minutes}-${policy}`,
    unitIds: m.LATER_ERA_SEEDS.map((seed) => `seed-${minutes}-${policy}-${seed}`),
    publish: async (unitsById, { commit }) => {
      const rows = m.LATER_ERA_SEEDS.map((seed) => unitsById[`seed-${minutes}-${policy}-${seed}`].result.row);
      assertSliceRows(m, rows, minutes, policy);
      const target = paths.slice ?? slicePath(minutes, policy);
      // Atomic overwrite: re-recording at a new engine replaces the stale
      // evidence; git history keeps the old bytes.
      await writeJsonAtomic(target, recordingPayload({
        source, recordingCommit: commit, minutes, policy, rows,
        unitProvenance: unitProvenanceOf(unitsById),
      }));
      return target;
    },
  };
};

export const sliceGroups = (m, source) => [25, 60].flatMap((minutes) =>
  m.WORLD_POLICIES.map((policy) => sliceGroup(m, source, [minutes, policy])));

// The probe evidence group: the walk plus every derived forward. The
// forward units are resolved at readiness time — they exist only once
// the probe walk has derived them.
export const probeGroup = (m, source, paths = {}) => ({
  id: "probe",
  unitIds: () => ["probe-walk"],
  publish: async (unitsById, { commit }) => {
    const walk = unitsById["probe-walk"];
    const banks = walk.result.banks.map((bank, b) => ({
      ...bank,
      orders: bank.orders.map((order, o) => {
        const forwardUnit = unitsById[`forward-b${b}-o${o}`];
        assert.ok(forwardUnit, `the probe's bank ${b} order ${o} has no persisted forward unit`);
        assert.deepEqual(forwardUnit.result.prepared.order, order.order,
          `the forward unit for bank ${b} order ${o} carries a different order`);
        assert.deepEqual(
          {
            spend: forwardUnit.result.prepared.spend,
            purchasesOk: forwardUnit.result.prepared.purchasesOk,
            placementsOk: forwardUnit.result.prepared.placementsOk,
            finite: forwardUnit.result.prepared.finite,
          },
          {
            spend: order.spend,
            purchasesOk: order.purchasesOk,
            placementsOk: order.placementsOk,
            finite: order.finite,
          },
          `the forward unit for bank ${b} order ${o} disagrees with the walk's enumeration`,
        );
        return { ...order, forward: forwardUnit.result.forward };
      }),
    }));
    const target = paths.probe ?? PROBE_EVIDENCE_PATH;
    await writeJsonAtomic(target, recordingPayload({
      source,
      recordingCommit: commit,
      seed: m.PROBE_WALK_SEED,
      minutes: m.LONG_SESSION_MINUTES,
      policy: "support",
      walk: { recipe: walk.identity.recipe, row: walk.result.row },
      banks,
      unitProvenance: unitProvenanceOf(unitsById),
    }));
    return target;
  },
});
