// The two recorder adapters supply only their compiled recipe and domain
// checks. Isolation, publication, provenance, and composition live here so
// the safety rules cannot drift between the century and later-era CLIs.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import {
  assertSameCompiledSource,
  assertSmokeTier,
  composeRecordingPayload,
  readRecordingFile,
  recordingPayload,
  refuseExistingArtifact,
  resolveSmokeRoot,
  writeSmokeArtifact,
} from "./runtime.mjs";

export async function runSmoke(leg, commit, { name, script, load }) {
  const root = await resolveSmokeRoot(`flowsynth-${name}-smoke-`);
  const slicePath = join(root, `${name}-smoke-slice.json`);
  const reportPath = join(root, `${name}-smoke-report.json`);
  const sliceLabel = `the ${name} smoke slice`;
  const reportLabel = `the ${name} smoke report`;
  const remedy = `record it with: node tools/${script}.mjs smoke slice`;
  // Missing/corrupt inputs and occupied output paths fail before compiling.
  const recorded = leg === "compose"
    ? await readRecordingFile(slicePath, { what: sliceLabel, remedy })
    : null;
  await refuseExistingArtifact(leg === "slice" ? slicePath : reportPath,
    leg === "slice" ? sliceLabel : reportLabel);
  const adapter = await load();
  // Compare the actual persisted JSON representation, including the seed,
  // schedule, budget, stop, and every other behavior-affecting input.
  const recipe = JSON.parse(JSON.stringify(adapter.recipe));
  const assertRecipe = (payload) => {
    assert.equal(payload.rows?.length, 1, "the smoke slice carries exactly one bounded walk");
    const row = payload.rows[0];
    assert.deepEqual({
      recipe: payload.recipe,
      minutes: payload.minutes,
      policy: payload.policy,
      row: { seed: row?.seed, sessionMinutes: row?.sessionMinutes, policy: row?.policy },
    }, {
      recipe,
      minutes: recipe.schedule.sessionMinutes,
      policy: recipe.policyId,
      row: { seed: recipe.seed, sessionMinutes: recipe.schedule.sessionMinutes, policy: recipe.policyId },
    }, `the smoke slice's recipe is not the declared smoke recipe — stale recipe evidence cannot compose; ${remedy}`);
    adapter.assertRow(row);
  };
  if (leg === "slice") {
    const t0 = performance.now();
    const record = adapter.run(adapter.recipe);
    adapter.assertWalk(record);
    const row = adapter.row(record);
    const payload = recordingPayload({
      tier: "smoke", source: adapter.source, recordingCommit: commit,
      recipe, minutes: recipe.schedule.sessionMinutes, policy: recipe.policyId,
      rows: [row],
    });
    assertRecipe(payload);
    await writeSmokeArtifact(slicePath, payload, sliceLabel);
    console.log(`smoke slice: seed ${row.seed} completed at its declared credited stop, ${row.creditedHours} credited h, ${((performance.now() - t0) / 1000).toFixed(0)}s — ${slicePath}`);
    return;
  }
  assertSmokeTier(recorded, slicePath);
  assertSameCompiledSource(recorded.source, adapter.source, slicePath);
  assert.equal(typeof recorded.recordingCommit, "string", "the smoke slice names its recording commit");
  execFileSync("git", ["merge-base", "--is-ancestor", recorded.recordingCommit, commit], { stdio: "pipe" });
  assertRecipe(recorded);
  await writeSmokeArtifact(reportPath, composeRecordingPayload({
    tier: "smoke", recordingCommit: commit, smoke: adapter.smoke, recipe,
    runs: recorded.rows,
  }, [{ path: slicePath, recording: recorded }]), reportLabel);
  console.log(`smoke report: composed the bounded walk — ${reportPath}`);
}
