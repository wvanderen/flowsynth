import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { createServer } from "vite";
import { devProvenance } from "./dev/provenance";

const git = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

describe("devProvenance", () => {
  it("reports the active worktree and the current commit", () => {
    const p = devProvenance();
    expect(p.app).toBe("flowsynth");
    expect(p.worktree).toBe(git("rev-parse", "--show-toplevel"));
    expect(p.branch).toBe(git("branch", "--show-current"));
    expect(p.commit).toBe(git("rev-parse", "HEAD"));
  });
});

describe("dev provenance endpoint (issue #253)", () => {
  it("serves the serving worktree's identity and commit", async () => {
    const server = await createServer({
      root: process.cwd(),
      server: { port: 0, strictPort: true },
      logLevel: "error",
    });
    await server.listen();
    try {
      const local = server.resolvedUrls?.local[0];
      expect(local).toBeDefined();
      const response = await fetch(new URL("-/dev/provenance", local));
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      const body = await response.json();
      expect(body.app).toBe("flowsynth");
      expect(body.worktree).toBe(git("rev-parse", "--show-toplevel"));
      expect(body.branch).toBe(git("branch", "--show-current"));
      expect(body.commit).toBe(git("rev-parse", "HEAD"));
    } finally {
      await server.close();
    }
  });
});
