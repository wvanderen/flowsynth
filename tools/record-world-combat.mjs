// #542 fixed-kit proof, not live-economy calibration. Every walk takes seconds.
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { compileEngineTo } from "./dev/compile-engine.mjs";
import { devProvenance } from "./dev/provenance.mjs";
import { recordingPayload, requireRuntimeEnvironment, resolveSmokeRoot, writeJsonAtomic, writeSmokeArtifact } from "./dev/runtime.mjs";

await requireRuntimeEnvironment();
const [mode, file, ...extra] = process.argv.slice(2);
const smoke = mode === "smoke" && file === undefined;
if (!smoke && (mode !== "record" || !file || extra.length)) {
  throw new Error("Usage: node tools/run-supported.mjs tools/record-world-combat.mjs smoke | record <output.json>");
}
const before = devProvenance();
if (!smoke && !before.source?.clean) throw new Error("Freeze the source before recording the combat proof.");
const output = smoke ? join(await resolveSmokeRoot("flowsynth-world-combat-"), "walks.json") : resolve(file);
const compiled = await mkdtemp(join(tmpdir(), "flowsynth-world-combat-compile-"));
try {
  const entry = await compileEngineTo("src/engine/world-combat-walks.ts", "world-combat", compiled);
  const engineSha256 = createHash("sha256").update(await readFile(entry)).digest("hex");
  /** @type {typeof import('../src/engine/world-combat-walks')} */
  const engine = await import(pathToFileURL(entry).href);
  const walks = engine.walkWorldCombatProof();
  const after = devProvenance();
  if (!smoke && (!after.source?.clean || before.commit !== after.commit)) {
    throw new Error("Source moved during the World combat proof; nothing was published.");
  }
  const report = recordingPayload({
    kind: "isolated World prototype",
    tier: smoke ? "smoke" : "proof",
    recordingCommit: before.commit,
    engineSha256,
    ...walks,
  });
  if (smoke) await writeSmokeArtifact(output, report, "World combat smoke");
  else await writeJsonAtomic(output, report);
  console.log(`World combat ${report.tier}: ${before.commit} · ${engineSha256}\n${output}`);
} finally {
  await rm(compiled, { recursive: true, force: true });
}
