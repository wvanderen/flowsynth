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
  it("dist carries no absolute local paths and no provenance endpoint", async () => {
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
