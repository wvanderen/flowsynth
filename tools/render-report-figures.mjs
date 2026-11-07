// Recorded-report figure regeneration (issue #512): check or rewrite the
// generated numerical sections of the later-era and century reports from
// their recorded JSON — the same path the suite's staleness test runs.
// Generation validates the evidence first (duplicate or incomplete matrix
// rows, inconsistent totals, incompatible provenance, and contradicting
// route flags all refuse) and never simulates.
//
//   node tools/run-supported.mjs tools/render-report-figures.mjs check
//   node tools/run-supported.mjs tools/render-report-figures.mjs write
//   node tools/run-supported.mjs tools/render-report-figures.mjs check --out /tmp/figures.md
//
// `check` exits nonzero when a committed generated section no longer
// matches what the recorded evidence regenerates. `write` rewrites only
// the fenced generated region of each document — the handwritten
// interpretation around it is never touched — through an exclusive
// temporary file and an atomic rename, so concurrent work is neither
// clobbered nor observed half-written. `--out` publishes the rendered
// sections to a fresh path for inspection without touching the documents.
import { open, readFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { compileEngine } from "./dev/compile-engine.mjs";

const root = join(import.meta.dirname, "..");
const docs = (name) => join(root, "docs", name);

const [command, ...flags] = process.argv.slice(2);
const outIndex = flags.indexOf("--out");
const outPath = outIndex !== -1 ? flags[outIndex + 1] : undefined;
if (command !== undefined && !["check", "write"].includes(command)) {
  console.error("Usage: node tools/run-supported.mjs tools/render-report-figures.mjs <check|write> [--out <file>]");
  process.exit(2);
}
if (outPath === undefined && outIndex !== -1) {
  console.error("--out requires a path");
  process.exit(2);
}

const readJson = async (name) => JSON.parse(await readFile(docs(name), "utf8"));

const module = await compileEngine(join(root, "tools", "report-figures.ts"), "report-figures");

const laterEra = {
  id: module.LATER_ERA_BLOCK_ID,
  doc: "later-era-productivity.md",
  rendered: module.renderLaterEraBlock(
    module.laterEraFigures(
      await readJson("later-era-results.json"),
      {
        slices: await Promise.all(
          ["25-support", "25-combat", "25-ignoring", "60-support", "60-combat", "60-ignoring"]
            .map((suffix) => `later-era-slice-${suffix}.json`).map(readJson),
        ),
        probe: await readJson("later-era-probe.json"),
      },
    ),
  ),
};
const century = {
  id: module.CENTURY_BLOCK_ID,
  doc: "century-calibration.md",
  rendered: module.renderCenturyBlock(
    module.centuryFigures(
      await readJson("century-calibration-results.json"),
      {
        slices: await Promise.all(
          ["25-prompt", "25-pushing", "25-support", "25-combat", "25-ignoring",
            "60-prompt", "60-pushing", "60-support", "60-combat", "60-ignoring"]
            .map((suffix) => `century-slice-${suffix}.json`).map(readJson),
        ),
        fixtures: {
          raw: await readJson("century-fixture-raw.json"),
          collectionReset: await readJson("century-fixture-collection-reset.json"),
        },
      },
    ),
  ),
};

// Publish rendered sections to an explicit path without touching the
// documents — the temporary-output route. Exclusive creation: two
// concurrent invocations never overwrite one another's file.
if (outPath !== undefined) {
  const handle = await open(outPath, "wx");
  try {
    await handle.writeFile(
      [laterEra, century]
        .map(({ id, doc, rendered }) => `# ${doc} — generated section (${id})\n\n${module.generatedBlock(id, rendered)}\n`)
        .join("\n"),
    );
  } finally {
    await handle.close();
  }
  console.log(`Rendered generated sections published to ${outPath} (documents untouched).`);
}

const mode = command ?? "check";
for (const { id, doc, rendered } of [laterEra, century]) {
  const text = await readFile(docs(doc), "utf8");
  if (module.figuresCurrent(text, id, rendered)) {
    console.log(`${doc}: generated figures match the recorded evidence.`);
    continue;
  }
  if (mode === "check") {
    console.error(`${doc}: the committed generated section is stale — it does not match what the recorded evidence regenerates.`);
    console.error(`  Run: node tools/run-supported.mjs tools/render-report-figures.mjs write`);
    process.exitCode = 1;
    continue;
  }
  const updated = module.spliceGeneratedBlock(text, id, rendered);
  if (updated === text) {
    console.log(`${doc}: generated figures match the recorded evidence.`);
    continue;
  }
  // Exclusive temporary file in the document's own directory (so the
  // final rename stays on one filesystem), then an atomic rename: a
  // concurrent reader sees the old or the new document, never a
  // half-written one, and two invocations cannot collide on the
  // temporary path.
  const staging = join(root, "docs", `.figures-${process.pid}-${Math.random().toString(36).slice(2)}.tmp`);
  const handle = await open(staging, "wx");
  try {
    await handle.writeFile(updated, "utf8");
  } finally {
    await handle.close();
  }
  await rename(staging, docs(doc));
  console.log(`${doc}: generated section rewritten from the recorded evidence; handwritten interpretation untouched.`);
}
if (process.exitCode === 1) {
  process.exit(1);
}
