import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

describe("standalone recording environment gates", () => {
  for (const script of ["record-century.mjs", "record-later-eras.mjs"]) {
    it(`${script} refuses an incompatible environment before git, compilation, or input loading`, () => {
      // No Git checkout and no slices: without the environment gate this
      // invocation fails later for the wrong reason. The fake declaration
      // makes this portable without requiring a second installed Node.
      const cwd = mkdtempSync(path.join(tmpdir(), "flowsynth-recording-gate-"));
      try {
        writeFileSync(path.join(cwd, ".node-version"), "99.99.99\n");
        const result = spawnSync(process.execPath, [path.join(root, "tools", script), "compose"], {
          cwd, encoding: "utf8", env: process.env,
        });
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("runtime preflight failed");
        expect(result.stderr).toContain(`effective ${process.version}, declared 99.99.99`);
        expect(result.stderr).toContain("mise install node@99.99.99");
        expect(result.stderr).not.toMatch(/ENOENT|not a git repository|Command failed: git/);
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    });
  }
});
