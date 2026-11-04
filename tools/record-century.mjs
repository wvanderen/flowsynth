// Explicit, long-running evidence tier for the century calibration
// (issue #492). Compile with Vite's real glob/raw transforms (rather than
// vitest's insensitive fingerprint, issue #503), then record the same
// functions the tests exercise. No listening server.
//
//   node tools/record-century.mjs slice <25|60>:<prompt|pushing|support|combat|ignoring>
//   node tools/record-century.mjs compose
//
// The ten slices (two session shapes × five policies, eight seeds each)
// run independently and compose into the report; the compose pass also
// walks the anonymized supplied-board fixture's two declared variants and
// writes the frozen calibration baseline beside the results.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";

const [command, slice] = process.argv.slice(2);
const SLICE_PATTERN = /^(25|60):(prompt|pushing|support|combat|ignoring)$/;
if (command !== "compose" && !(command === "slice" && SLICE_PATTERN.test(slice ?? ""))) {
  throw new Error("Usage: node tools/record-century.mjs slice <25|60>:<prompt|pushing|support|combat|ignoring> | compose");
}
execFileSync("git", ["diff", "--exit-code", "HEAD", "--", "src", "tools"], { stdio: "pipe" });
const commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const output = await mkdtemp(join(tmpdir(), "flowsynth-century-"));
try {
  await build({ configFile: false, logLevel: "error", build: {
    ssr: "tools/century.ts", outDir: output, emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: "century.mjs" } },
  } });
  const m = await import(pathToFileURL(join(output, "century.mjs")).href);
  const source = m.playthroughSource();
  const slicePath = (minutes, policy) => `docs/century-slice-${minutes}-${policy}.json`;

  const assertRows = (rows, minutes, policy) => {
    assert.deepEqual(rows.map(row => row.seed), m.CENTURY_SEEDS);
    for (const row of rows) {
      assert.equal(row.sessionMinutes, minutes);
      assert.equal(row.policy, policy);
      assert.equal(row.kind, "representative");
      // The century stop is the walk's declared completion.
      assert.equal(row.complete, true);
      assert.equal(row.stopKind, "century");
      assert.ok(row.creditedHours >= m.CENTURY_MARK_HOURS, `credited ${row.creditedHours} below the mark`);
      // Currency integrity and finite, representable state at every
      // recorded snapshot, with the serialized round trip intact.
      assert.equal(row.noGrant, true);
      assert.equal(row.numeric.finiteSnapshots, true);
      assert.equal(row.numeric.serializedChecks > 0, true);
      assert.equal(row.numeric.serializedOk, row.numeric.serializedChecks);
      // The policy's own faces. The prompt door's first crossing banks
      // the honest zero on the baseline schedule; a single long session
      // can carry an era past the entry depth before its first door, so
      // the long-session slices assert only the door-banking shape.
      if (policy === "prompt" && minutes === 25) assert.equal(row.claims[0], 0, "the prompt door's honest zero");
      if (policy === "ignoring") {
        assert.deepEqual(row.defeats, []);
        for (const era of row.eras) assert.equal(era.placements, 0);
        for (const entry of row.investments) assert.ok(!entry.key.startsWith("Charge Column") && entry.key !== "Hone ladder");
      }
      // Every closed era with a positive claim advanced the frontier
      // strictly; zero-claim doors (the prompt policy's honest resets)
      // hold the frontier and are not failures. The recorded state at
      // each bank stayed finite.
      let frontier = 0;
      for (const era of row.eras) {
        if (!era.claim) continue;
        assert.equal(era.finite, true);
        assert.ok(era.frontierAfter > frontier);
        frontier = era.frontierAfter;
      }
      // The long-decision-gap read: no recorded failure may hide here.
      assert.equal(row.gaps.longCount, row.eras.reduce((sum, era) => sum + era.longGaps.length, 0));
    }
  };

  if (command === "slice") {
    const [raw, policy] = slice.split(":");
    const minutes = Number(raw);
    const rows = [];
    for (const seed of m.CENTURY_SEEDS) {
      const t0 = performance.now();
      const recipe = m.centuryRecipe(seed, minutes, policy);
      const record = m.runPlaythrough(recipe);
      for (const snapshot of record.snapshots) {
        assert.equal(m.stateNumbersFinite(snapshot.state), true);
        assert.ok(Number.isFinite(snapshot.rate));
      }
      for (const event of record.events) assert.equal(record.snapshots[event.snapshot].credited, event.credited);
      for (const era of record.eras) {
        if (era.priorDepthPassed) assert.equal(era.familiarCredited, era.priorDepthPassed.credited);
      }
      rows.push(m.centuryRow(seed, minutes, record));
      console.log(`${slice} seed ${seed}: ${record.claims.length} banks, frontier ${record.state.world.frontier}, ${record.days}d, ${dt(t0)} — ${record.stop.kind}`);
    }
    assertRows(rows, minutes, policy);
    await writeFile(slicePath(minutes, policy), JSON.stringify({ source, recordingCommit: commit, minutes, policy, rows }, null, 2));
  } else {
    const runs = [];
    for (const minutes of [25, 60]) for (const policy of m.CENTURY_POLICIES) {
      const recorded = JSON.parse(await readFile(slicePath(minutes, policy), "utf8"));
      assert.equal(recorded.recordingCommit, commit);
      assert.deepEqual(recorded.source, source);
      assertRows(recorded.rows, minutes, policy);
      runs.push(...recorded.rows);
    }
    const report = m.centuryReport(runs);
    // The anonymized supplied-board fixture's two declared walks: the raw
    // position's recorded stranding and the collection-reset's calibrated
    // century. Both ride kind "continuation" and never join the matrix.
    const rawFixtureStart = performance.now();
    const rawRecord = m.suppliedBoardRecord("raw");
    const rawRow = m.centuryRow(m.CENTURY_SEEDS[0], m.CENTURY_SESSION_MINUTES.long, rawRecord);
    assert.equal(rawRecord.kind, "continuation");
    assert.equal(rawRow.noGrant, true);
    assert.equal(rawRow.numeric.finiteSnapshots, true);
    assert.equal(rawRow.numeric.serializedOk, rawRow.numeric.serializedChecks);
    // The retained levels bank a frontier the calibrated curve cannot
    // re-reach: the stranding the save translation (issue #493) exists to
    // repair. Recorded, never silently repaired here.
    assert.ok(rawRow.claims[0] > 12, `raw fixture's first claim ${rawRow.claims[0]}`);
    const closedRaw = rawRow.eras.filter(era => era.claim !== null).length;
    assert.equal(closedRaw, rawRow.claims.length);
    assert.ok(rawRow.eras.at(-1).claim === null, "the raw position's later era stays open at the mark");
    console.log(`raw fixture: ${closedRaw} bank(s), claim ${rawRow.claims[0]}, ${dt(rawFixtureStart)}`);

    const resetStart = performance.now();
    const resetRecord = m.suppliedBoardRecord("collection-reset");
    const resetRow = m.centuryRow(m.CENTURY_SEEDS[0], m.CENTURY_SESSION_MINUTES.long, resetRecord);
    assert.equal(resetRecord.kind, "continuation");
    assert.equal(resetRow.noGrant, true);
    assert.equal(resetRow.numeric.finiteSnapshots, true);
    assert.equal(resetRow.numeric.serializedOk, resetRow.numeric.serializedChecks);
    assert.ok(resetRow.claims.length >= 1, "the collection-reset position banks calibrated claims");
    let frontier = 0;
    for (const era of resetRow.eras) {
      if (era.claim === null) continue;
      assert.ok(era.frontierAfter > frontier);
      frontier = era.frontierAfter;
    }
    console.log(`collection-reset fixture: ${resetRow.claims.length} banks, frontier ${frontier}, ${dt(resetStart)}`);

    const baseline = m.calibrationBaseline();
    const representative = runs.find(row => row.seed === 468 && row.sessionMinutes === 60 && row.policy === "support");
    assert.ok(representative, "the representative run recorded");
    const results = {
      ...report,
      recordingCommit: commit,
      fixtures: {
        raw: { ...rawRow, trajectory: rawRow.trajectory.filter((_, index) => index % 4 === 0) },
        collectionReset: { ...resetRow, trajectory: resetRow.trajectory.filter((_, index) => index % 4 === 0) },
      },
      representative: {
        seed: representative.seed,
        sessionMinutes: representative.sessionMinutes,
        policy: representative.policy,
        runIdNote: "the composed rows carry their recipes; this names the baseline's reference walk",
        claims: representative.claims,
        frontiers: representative.frontiers,
        creditedHours: representative.creditedHours,
      },
    };
    await writeFile(process.env.FLOWSYNTH_CENTURY_REPORT || "docs/century-calibration-results.json", JSON.stringify(results, null, 2));
    await writeFile("docs/century-calibration-baseline.json", JSON.stringify({
      ...baseline,
      recordingCommit: commit,
      results: "docs/century-calibration-results.json",
      representative: results.representative,
      limitations: [
        "The claim curve's entry depth and the opening era's 8-12 credited-hour window are #490's calibration, unchanged here.",
        "The enemy ladder's two upper decades (w7, w8) sit past the 100-credited-hour horizon on every recorded walk; the roster's reachable span is w0-w6.",
        "Later eras lengthen as the board matures: the recorded distributions carry every over-window and open era explicitly.",
        "The prompt door policy banks the honest zero at every early crossing and cannot sustain century-scale progression; its runs are recorded, not repaired.",
        "The raw supplied-board position strands its frontier past the calibrated curve's reach; the translation that repairs it is issue #493's work, grounded in the baseline's frozen figures.",
        "The Arete product ladders (Hone, Chord Catalysts, Expansion Bays) saturate inside the century; Charge Columns remain the open-ended sink.",
      ],
    }, null, 2));
    console.log(`Recorded ${runs.length} matrix walks, the fixture pair, and the frozen baseline.`);
  }
} finally {
  await rm(output, { recursive: true, force: true });
}

function dt(from) {
  const seconds = (performance.now() - from) / 1000;
  return seconds >= 60 ? `${(seconds / 60).toFixed(1)}m` : `${seconds.toFixed(0)}s`;
}
