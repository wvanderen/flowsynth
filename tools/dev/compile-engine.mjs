// The recorders' shared Vite compile (issue #506: production recording and
// the smoke tier ride one seam). Compile the recorder's engine module with
// Vite's real glob/raw transforms — the verified path whose fingerprint
// certifies the compiled engine — and return the loaded module. Plain
// JavaScript so the npm-script path runs under plain node; the TypeScript
// surface lives in compile-engine.d.mts.
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";

// Compile into a caller-owned directory and return the bundle path — the
// job supervisor's seam (issue #507): workers import the same bundle the
// supervisor certified, so one compiled engine identity covers the job.
export async function compileEngineTo(entry, name, outDir) {
  await mkdir(outDir, { recursive: true });
  await build({ configFile: false, logLevel: "error", build: {
    ssr: entry, outDir, emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: `${name}.mjs` } },
  } });
  return join(outDir, `${name}.mjs`);
}

export async function compileEngine(entry, name) {
  const output = await mkdtemp(join(tmpdir(), `flowsynth-${name}-compile-`));
  try {
    return await import(pathToFileURL(await compileEngineTo(entry, name, output)).href);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
}
