// The recorders' shared Vite compile (issue #506: production recording and
// the smoke tier ride one seam). Compile the recorder's engine module with
// Vite's real glob/raw transforms — the verified path whose fingerprint
// certifies the compiled engine — and return the loaded module. Plain
// JavaScript so the npm-script path runs under plain node; the TypeScript
// surface lives in compile-engine.d.mts.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";

export async function compileEngine(entry, name) {
  const output = await mkdtemp(join(tmpdir(), `flowsynth-${name}-compile-`));
  try {
    await build({ configFile: false, logLevel: "error", build: {
      ssr: entry, outDir: output, emptyOutDir: true,
      rollupOptions: { output: { entryFileNames: `${name}.mjs` } },
    } });
    return await import(pathToFileURL(join(output, `${name}.mjs`)).href);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
}
