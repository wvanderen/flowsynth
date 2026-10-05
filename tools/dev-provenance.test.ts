import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import net from "node:net";
import { createServer } from "vite";
import { devProvenance } from "./dev/provenance";

const git = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

// Vite's own port picking can collide with whatever else holds 5173 on this
// machine, and port 0 is not honoured under strictPort; ask the OS directly.
const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const port = (probe.address() as net.AddressInfo).port;
      probe.close(() => resolve(port));
    });
    probe.on("error", reject);
  });

const testServer = async () =>
  createServer({
    root: process.cwd(),
    server: { port: await freePort(), strictPort: true },
    logLevel: "error",
  });

function expectProvenance(actual: Record<string, unknown>): void {
  expect(actual.app).toBe("flowsynth");
  expect(actual.worktree).toBe(git("rev-parse", "--show-toplevel"));
  expect(actual.branch).toBe(git("branch", "--show-current"));
  expect(actual.commit).toBe(git("rev-parse", "HEAD"));
}

describe("devProvenance", () => {
  it("reports the active worktree and the current commit", () => {
    expectProvenance(devProvenance() as unknown as Record<string, unknown>);
  });
});

describe("dev provenance endpoint (issue #253)", () => {
  it("serves the serving worktree's identity and commit", async () => {
    const server = await testServer();
    await server.listen();
    try {
      const local = server.resolvedUrls?.local[0];
      expect(local).toBeDefined();
      const response = await fetch(new URL("-/dev/provenance", local));
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toContain("no-store");
      expectProvenance(await response.json());
    } finally {
      await server.close();
    }
  });

  it("answers GET on the exact route only", async () => {
    const server = await testServer();
    await server.listen();
    try {
      const local = server.resolvedUrls!.local[0];
      const base = new URL(local);
      base.pathname = "/-/dev/provenance";
      expect((await fetch(base, { method: "POST" })).status).toBe(404);
      expect((await fetch(base + "X")).status).toBe(404);
    } finally {
      await server.close();
    }
  });
});
