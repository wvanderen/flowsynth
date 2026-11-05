// Explicit, long-running evidence tier. Compile with Vite's real glob/raw
// transforms so a recording's fingerprint certifies the compiled engine —
// one identity with the suite, dev server, and build since #503's fix
// made that fingerprint content-sensitive in every path — then record the
// same functions the tests exercise. No listening server.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { composeRecordingPayload, recordingEnvironment, recordingPayload, requireRuntimeEnvironment } from "./dev/runtime.mjs";

await requireRuntimeEnvironment();

const [command, slice] = process.argv.slice(2);
if (command !== "compose" && !(command === "slice" && /^(25|60):(support|combat|ignoring)$/.test(slice ?? ""))) {
  throw new Error("Usage: node tools/record-later-eras.mjs slice <25|60>:<support|combat|ignoring> | compose");
}
execFileSync("git", ["diff", "--exit-code", "HEAD", "--", "src", "tools"], { stdio: "pipe" });
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const output = await mkdtemp(join(tmpdir(), "flowsynth-later-eras-"));
try {
  await build({ configFile: false, logLevel: "error", build: {
    ssr: "tools/later-eras.ts", outDir: output, emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: "later-eras.mjs" } },
  } });
  const m = await import(pathToFileURL(join(output, "later-eras.mjs")).href);
  const source = m.playthroughSource();
  const slicePath = (minutes, policy) => `docs/later-era-slice-${minutes}-${policy}.json`;
  const assertRows = (rows, minutes, policy) => {
    assert.deepEqual(rows.map(row => row.seed), m.LATER_ERA_SEEDS);
    for (const row of rows) {
      assert.equal(row.sessionMinutes, minutes);
      assert.equal(row.policy, policy);
      assert.equal(row.noGrant, true);
      if (policy === "ignoring") {
        assert.deepEqual(row.defeats, []);
        assert.ok(row.eras.every(era => era.placements.length === 0));
      }
      let frontier = 0;
      for (const era of row.eras) {
        if (era.claim === null) continue;
        assert.equal(era.finite, true);
        if (era.index > 0) assert.ok(Math.abs(era.familiarHours + era.newHours - era.hours) < 0.02);
        assert.ok(era.frontierAfter > frontier);
        frontier = era.frontierAfter;
      }
    }
  };
  if (command === "slice") {
    const [raw, policy] = slice.split(":");
    const minutes = Number(raw);
    const rows = [];
    for (const seed of m.LATER_ERA_SEEDS) {
      const record = m.runPlaythrough(m.laterEraRecipe(seed, minutes, policy));
      // Every era owns its actual end-of-era kills, including repeated
      // enemies. Check the pre-bank board, not the reset board.
      const banks = record.events.flatMap((event, index) => event.kind === "prestige" && event.ok ? [index] : []);
      for (const [index, bank] of banks.entries()) {
        const last = record.events.slice(0, bank).reverse().find(event => event.kind === "session" || event.kind === "breather");
        const state = record.snapshots[last.snapshot].state;
        const defeats = Object.entries(state.world.enemies).filter(([, enemy]) => enemy.discovered && enemy.hp === 0).map(([key]) => key);
        assert.deepEqual(m.laterEraView(record, index, null).defeats, defeats);
      }
      for (const snapshot of record.snapshots) {
        assert.equal(m.stateNumbersFinite(snapshot.state), true);
        assert.ok(Number.isFinite(snapshot.rate));
      }
      for (const event of record.events) assert.equal(record.snapshots[event.snapshot].credited, event.credited);
      for (const era of record.eras) {
        if (era.priorDepthPassed) assert.equal(era.familiarCredited, era.priorDepthPassed.credited);
      }
      rows.push(m.laterEraRow(seed, minutes, record));
      console.log(`${slice} seed ${seed}: ${record.claims.length} banks, ${record.creditedSeconds / 3600} credited hours`);
    }
    assertRows(rows, minutes, policy);
    // Issue #505: every recording names the runtime and timezone it ran on.
    await writeFile(slicePath(minutes, policy), JSON.stringify(recordingPayload({ source, recordingCommit: commit, minutes, policy, rows }), null, 2));
  } else {
    const runs = [];
    const inputs = [];
    for (const minutes of [25, 60]) for (const policy of m.WORLD_POLICIES) {
      const recorded = JSON.parse(await readFile(slicePath(minutes, policy), "utf8"));
      // Each slice carries its own recording commit and the compiled
      // engine fingerprint. Composition verifies the fingerprint byte for
      // byte and the commit's ancestry: a slice recorded on an ancestor
      // whose engine source compiled identically is the same evidence,
      // while a divergent engine source is refused (issue #503's
      // provenance discipline, kept for the recorder-fix commits that
      // landed between slices).
      assert.deepEqual(recorded.source, source);
      execFileSync("git", ["merge-base", "--is-ancestor", recorded.recordingCommit, commit], { stdio: "pipe" });
      assertRows(recorded.rows, minutes, policy);
      inputs.push({ path: slicePath(minutes, policy), recording: recorded });
      runs.push(...recorded.rows);
    }
    const report = m.laterEraReport(runs);
    const walk = m.runPlaythrough(m.laterEraRecipe(23, 60, "support"));
    const routeProbes = m.routeProbes(walk, { budgetDays: 30 });
    // The probed frontiers are the walk's own banks — strictly increasing
    // at whatever reach the calibrated curve pays (issue #492's slope
    // recalibration moved the shipped reach; the probe reads it live).
    const probedFrontiers = routeProbes.map(probe => probe.frontier);
    assert.ok(probedFrontiers.length >= 2, "the walk banked enough frontiers to probe");
    for (let i = 1; i < probedFrontiers.length; i++) assert.ok(probedFrontiers[i] > probedFrontiers[i - 1]);
    for (const probe of routeProbes) {
      assert.equal(probe.routeDemonstrated, true);
      for (const order of probe.orders) {
        assert.equal(order.purchasesOk, true);
        assert.equal(order.finite, true);
        assert.ok(order.spend <= probe.budget);
        assert.equal(order.forward.noGrant, true);
        assert.equal(order.forward.noRefund, true);
        assert.equal(order.forward.finite, true);
        assert.equal(order.forward.outcome, "advanced");
        assert.ok(order.forward.frontierAfter > probe.frontier);
      }
    }
    // The fighting demonstration (issue #491's capability clause): at
    // the calibrated slope a route continuation banks its claim by depth
    // growth before its weapon's fight resolves — the per-bank read — so
    // the fighting configurations are demonstrated by the support
    // policy's recorded walks, whose defeats ride every slice, while the
    // probes demonstrate the no-refund advancement at every tested
    // frontier. Every order's forward defeats ride the recorded JSON for
    // the per-configuration read.
    assert.ok(
      runs.some(row => row.policy === "support" && row.defeats.length > 0),
      "the support walks demonstrate fighting configurations",
    );
    await writeFile(process.env.FLOWSYNTH_LATER_ERA_REPORT || "docs/later-era-results.json", JSON.stringify(composeRecordingPayload({
      ...report, recordingCommit: commit, routeProbes,
      // These probes really ran during composition, unlike the input rows.
      routeProbeRecordingEnvironment: recordingEnvironment(),
    }, inputs), null, 2));
    console.log(`Recorded ${runs.length} matrix walks and ${routeProbes.reduce((n, probe) => n + probe.orders.length, 0)} directly continued purchase orders.`);
  }
} finally {
  await rm(output, { recursive: true, force: true });
}
