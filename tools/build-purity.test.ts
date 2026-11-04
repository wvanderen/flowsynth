import { describe, expect, it } from "vitest";
import { build } from "vite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

// Issue #253: production artifacts must carry no absolute local paths and no
// development provenance endpoint — the launcher, its log, and /-/dev/provenance
// belong to the dev server only.
describe("production build purity (issue #253)", () => {
  // The build runs inside the parallel engine forks, where a heavy
  // allocation-stress worker can starve it past vitest's default 5 s;
  // give the real build its own explicit budget (issue #505's suite runs).
  it("dist carries no absolute local paths and no provenance endpoint", { timeout: 120_000 }, async () => {
    await build({ root: repoRoot, logLevel: "error" });
    const dist = path.join(repoRoot, "dist");
    const files = walk(dist);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      expect(text, file).not.toContain(repoRoot);
      expect(text, file).not.toMatch(/\/(?:Users|home)\//);
      expect(text, file).not.toContain("-/dev/provenance");
      expect(text, file).not.toContain("dev-server.mjs");
    }
  });
});
