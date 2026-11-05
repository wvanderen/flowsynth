// Manual, non-calibration provenance probe for PR #515. No engine files are edited.
// Run: node tools/run-supported.mjs docs/evidence/pr515-review/provenance-probe.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build, createServer } from "vite";

const root = process.cwd();
const output = await mkdtemp(join(tmpdir(), "flowsynth-pr515-"));
let server;
try {
  const paths = (await readdir("src/engine", { recursive: true }))
    .filter(path => path.endsWith(".ts") && !path.endsWith(".test.ts")).sort();
  const entries = await Promise.all(paths.map(async path =>
    [`./${path}`, await readFile(join("src/engine", path), "utf8")],
  ));
  // Independent digest of disk contents, not a call to the implementation.
  const text = JSON.stringify(entries);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const expected = hash.toString(16).padStart(8, "0");
  await build({ configFile: false, logLevel: "error", build: {
    ssr: "src/engine/playthrough.ts", outDir: join(output, "build"), emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: "probe.mjs" } },
  } });
  const compiled = await import(pathToFileURL(join(output, "build/probe.mjs")).href);
  assert.deepEqual(compiled.playthroughSourceEntries(), entries);
  assert.equal(compiled.playthroughSource().engineSource, expected);
  server = await createServer({ root, configFile: false, logLevel: "error",
    server: { middlewareMode: true, hmr: false },
  });
  const dev = await server.ssrLoadModule("/src/engine/playthrough.ts");
  assert.deepEqual(dev.playthroughSourceEntries(), entries);
  assert.deepEqual(dev.playthroughSource(), compiled.playthroughSource());

  // An isolated temporary Vitest project uses the real raw/glob transform
  // without adding a test file to the checkout or changing engine content.
  await symlink(join(root, "node_modules"), join(output, "node_modules"), "dir");
  await writeFile(join(output, "vitest.config.mjs"), `export default ${JSON.stringify({
    root: output,
    server: { fs: { allow: [root, output] } },
    test: { include: ["identity.test.ts"], environment: "node", pool: "forks",
      globalSetup: [join(root, "tools/dev/runtime-guard.mjs")] },
  })};\n`);
  await writeFile(join(output, "identity.test.ts"), `
import { it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { playthroughSource, playthroughSourceEntries } from ${JSON.stringify(join(root, "src/engine/playthrough.ts"))};
it("Vitest raw entries match disk and share the independently computed dev/build identity", () => {
  const directory = ${JSON.stringify(join(root, "src/engine"))};
  const paths = readdirSync(directory, { recursive: true }).filter(path => path.endsWith(".ts") && !path.endsWith(".test.ts")).sort();
  expect(playthroughSourceEntries()).toEqual(paths.map(path => ["./" + path, readFileSync(directory + "/" + path, "utf8")]));
  expect(playthroughSource().engineSource).toBe(${JSON.stringify(expected)});
});\n`);
  const vitest = execFileSync(process.execPath, [join(root, "node_modules/vitest/vitest.mjs"),
    "run", "--config", join(output, "vitest.config.mjs")], { cwd: root, encoding: "utf8" });
  console.log(vitest);
  console.log(JSON.stringify({
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    runtime: process.version, modules: entries.length,
    checked: ["all raw entries equal disk", "independent disk digest", "Vite dev SSR", "recorder-style SSR build", "Vitest"],
    engineSource: expected,
    unavailable: ["browser client/HMR parity not exercised by this server-side probe", "multi-hour calibration not rerun"],
  }, null, 2));
} finally {
  if (server) await server.close();
  await rm(output, { recursive: true, force: true });
}
