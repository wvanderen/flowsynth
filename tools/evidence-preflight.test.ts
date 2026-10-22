import { afterEach, describe, expect, it } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  verifyCaptureProvenance,
  type DevProvenance,
} from "./dev/provenance.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const worktree = (): string =>
  execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: repoRoot, encoding: "utf8" }).trim();

const head = (): string =>
  execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();

const COMMIT = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0";

const servedProvenance = (overrides: Partial<DevProvenance> = {}): DevProvenance => ({
  app: "flowsynth",
  worktree: "/checkout",
  branch: "t3/issue-454",
  commit: COMMIT,
  source: { clean: true, changes: [], evidence: [] },
  ...overrides,
});

const check = (overrides: {
  provenance?: unknown;
  expectedWorktree?: string;
  expectedCommit?: string;
} = {}) =>
  verifyCaptureProvenance({
    provenance: servedProvenance(),
    url: "http://localhost:5173/",
    expectedWorktree: "/checkout",
    expectedCommit: COMMIT,
    ...overrides,
  });

describe("verifyCaptureProvenance (issue #454)", () => {
  it("accepts a matching clean checkout and records it", () => {
    const verdict = check();
    expect(verdict.accepted).toBe(true);
    expect(verdict.reason).toBeNull();
    expect(verdict.record).not.toBeNull();
    expect(verdict.record!.worktree).toBe("/checkout");
    expect(verdict.record!.commit).toBe(COMMIT);
    expect(verdict.record!.source.clean).toBe(true);
    expect(verdict.record!.check).toBe("capture-preflight");
  });

  it("accepts evidence outputs beside the clean source", () => {
    const verdict = check({
      provenance: servedProvenance({
        source: {
          clean: true,
          changes: [],
          evidence: [{ path: "docs/evidence/issue-454/desktop.png", state: "??" }],
        },
      }),
    });
    expect(verdict.accepted).toBe(true);
  });

  it("rejects dirty source and names the offending files and the fix", () => {
    const verdict = check({
      provenance: servedProvenance({
        source: {
          clean: false,
          changes: [{ path: "src/ui/app.ts", state: " M" }],
          evidence: [{ path: "docs/evidence/issue-454/desktop.png", state: "??" }],
        },
      }),
    });
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toBe("dirty-source");
    expect(verdict.record).toBeNull();
    const text = verdict.diagnostics.join("\n");
    expect(text).toContain("src/ui/app.ts");
    expect(text).toContain("Commit or stash");
    expect(text).toContain("docs/evidence/issue-454/desktop.png");
    expect(text).toContain("Not counted as source");
  });

  it("rejects a foreign worktree and names both paths", () => {
    const verdict = check({ provenance: servedProvenance({ worktree: "/sibling/other" }) });
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toBe("foreign-worktree");
    const text = verdict.diagnostics.join("\n");
    expect(text).toContain("/sibling/other");
    expect(text).toContain("/checkout");
    expect(text).toContain("npm run dev");
  });

  it("rejects a commit mismatch", () => {
    const verdict = check({ provenance: servedProvenance({ commit: "b".repeat(40) }) });
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toBe("commit-mismatch");
    expect(verdict.diagnostics.join("\n")).toContain("bbbbbbbb");
  });

  it("rejects unavailable provenance", () => {
    for (const provenance of [null, servedProvenance({ commit: null, source: null })]) {
      const verdict = check({ provenance });
      expect(verdict.accepted).toBe(false);
      expect(verdict.reason).toBe("unavailable");
      expect(verdict.record).toBeNull();
    }
  });

  it("rejects provenance that reports no cleanliness", () => {
    const verdict = check({ provenance: servedProvenance({ source: null }) });
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toBe("cleanliness-unavailable");
    expect(verdict.diagnostics.join("\n")).toContain("issue #454");
  });

  it.each([
    { app: "other" },
    { worktree: 42 },
    { commit: 42 },
    { source: { clean: "false" } },
    { source: { clean: true, changes: [{ path: "src/main.ts", state: " M" }], evidence: [] } },
    { source: { clean: true, changes: [], evidence: [{ path: "src/main.ts", state: " M" }] } },
    { source: { clean: false, changes: [null], evidence: [] } },
  ])("rejects malformed provenance: %j", (override) => {
    const verdict = check({ provenance: { ...servedProvenance(), ...override } });
    expect(verdict.accepted).toBe(false);
    expect(verdict.record).toBeNull();
    expect(verdict.diagnostics.join("\n")).toContain("npm run dev");
  });

  it("checks identity before cleanliness", () => {
    const dirty = servedProvenance({
      worktree: "/sibling/other",
      source: { clean: false, changes: [{ path: "src/ui/app.ts", state: " M" }], evidence: [] },
    });
    expect(check({ provenance: dirty }).reason).toBe("foreign-worktree");

    const stale = servedProvenance({
      commit: "b".repeat(40),
      source: { clean: false, changes: [{ path: "src/ui/app.ts", state: " M" }], evidence: [] },
    });
    expect(check({ provenance: stale }).reason).toBe("commit-mismatch");
  });
});

describe("evidence preflight CLI (issue #454)", () => {
  const tempRoots: string[] = [];
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  const tempDir = (): string => {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "flowsynth-preflight-")));
    tempRoots.push(dir);
    return dir;
  };

  // Async on purpose: a synchronous spawn would block this process's event
  // loop and the in-test provenance server could never answer the child.
  const runCli = (args: string[], cwd = repoRoot): Promise<{ status: number | null; stdout: string; stderr: string }> =>
    new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [path.join(repoRoot, "tools", "evidence-preflight.mjs"), ...args],
        { cwd },
      );
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.on("error", reject);
      child.on("close", (code) => resolve({ status: code, stdout, stderr }));
    });

  const provenanceServer = (
    payload: unknown,
    status = 200,
  ): Promise<{ url: string; close: () => Promise<void> }> =>
    new Promise((resolve) => {
      const server = http.createServer((_request, response) => {
        response.writeHead(status, { "content-type": "application/json" });
        response.end(typeof payload === "string" ? payload : JSON.stringify(payload));
      });
      server.listen(0, "127.0.0.1", () => {
        const { port } = server.address() as net.AddressInfo;
        resolve({
          url: `http://127.0.0.1:${port}/`,
          close: () => new Promise((done) => server.close(() => done())),
        });
      });
    });

  const served = (overrides: Partial<DevProvenance> = {}): DevProvenance => ({
    app: "flowsynth",
    worktree: worktree(),
    branch: "test",
    commit: head(),
    source: { clean: true, changes: [], evidence: [] },
    ...overrides,
  });

  it("accepts the matching clean checkout and writes the record", async () => {
    const server = await provenanceServer(served());
    const recordPath = path.join(tempDir(), "docs", "evidence", "issue-454", "provenance.json");
    try {
      const result = await runCli(["--url", server.url, "--record", recordPath]);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("ACCEPT");
      const record = JSON.parse(fs.readFileSync(recordPath, "utf8"));
      expect(record.worktree).toBe(worktree());
      expect(record.commit).toBe(head());
      expect(record.source.clean).toBe(true);
      expect(record.check).toBe("capture-preflight");
    } finally {
      await server.close();
    }
  });

  it("persists a default record when --record is omitted", async () => {
    const server = await provenanceServer(served());
    const cwd = tempDir();
    try {
      const result = await runCli(["--url", server.url, "--worktree", worktree()], cwd);
      expect(result.status).toBe(0);
      const record = JSON.parse(fs.readFileSync(path.join(cwd, "docs/evidence/preflight/provenance.json"), "utf8"));
      expect(record.worktree).toBe(worktree());
      expect(record.commit).toBe(head());
      expect(record.source.clean).toBe(true);
    } finally {
      await server.close();
    }
  });

  it("does not announce acceptance when the record cannot be written", async () => {
    const server = await provenanceServer(served());
    const recordPath = tempDir();
    try {
      const result = await runCli(["--url", server.url, "--record", recordPath]);
      expect(result.status).toBe(1);
      expect(result.stdout).not.toContain("ACCEPT");
      expect(result.stderr).toContain("writable file path");
    } finally {
      await server.close();
    }
  });

  it("rejects dirty source with the offending paths and writes no record", async () => {
    const server = await provenanceServer(
      served({
        source: {
          clean: false,
          changes: [{ path: "src/ui/app.ts", state: " M" }],
          evidence: [],
        },
      }),
    );
    const recordPath = path.join(tempDir(), "provenance.json");
    try {
      const result = await runCli(["--url", server.url, "--record", recordPath]);
      expect(result.status).toBe(1);
      const text = `${result.stdout}\n${result.stderr}`;
      expect(text).toContain("REJECT");
      expect(text).toContain("dirty-source");
      expect(text).toContain("src/ui/app.ts");
      expect(text).toContain("Commit or stash");
      expect(fs.existsSync(recordPath)).toBe(false);
    } finally {
      await server.close();
    }
  });

  it("rejects a foreign worktree by name", async () => {
    const server = await provenanceServer(served({ worktree: "/sibling/other-worktree" }));
    try {
      const result = await runCli(["--url", server.url]);
      expect(result.status).toBe(1);
      const text = `${result.stdout}\n${result.stderr}`;
      expect(text).toContain("/sibling/other-worktree");
      expect(text).toContain(worktree());
      expect(text).toContain("foreign-worktree");
      expect(text).toContain("npm run dev");
    } finally {
      await server.close();
    }
  });

  it("rejects a commit mismatch", async () => {
    const server = await provenanceServer(served({ commit: "c".repeat(40) }));
    try {
      const result = await runCli(["--url", server.url]);
      expect(result.status).toBe(1);
      const text = `${result.stdout}\n${result.stderr}`;
      expect(text).toContain("commit-mismatch");
      expect(text).toContain("cccccccc");
    } finally {
      await server.close();
    }
  });

  it("rejects provenance that cannot answer", async () => {
    const server = await provenanceServer("nope", 404);
    try {
      const result = await runCli(["--url", server.url]);
      expect(result.status).toBe(1);
      const text = `${result.stdout}\n${result.stderr}`;
      expect(text).toContain("HTTP 404");
      expect(text).toContain("unavailable");
    } finally {
      await server.close();
    }
  });

  it("rejects an unreachable server", async () => {
    const port = await new Promise<number>((resolve, reject) => {
      const probe = net.createServer();
      probe.listen(0, "127.0.0.1", () => {
        const address = (probe.address() as net.AddressInfo).port;
        probe.close(() => resolve(address));
      });
      probe.on("error", reject);
    });
    const result = await runCli(["--url", `http://127.0.0.1:${port}/`]);
    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain("unreachable");
  });

  it("rejects a non-JSON body", async () => {
    const server = await provenanceServer("<html>not the dev server</html>", 200);
    try {
      const result = await runCli(["--url", server.url]);
      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain("non-JSON");
    } finally {
      await server.close();
    }
  });

  it("prints usage and fails without --url", async () => {
    const result = await runCli([]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Usage");
  });
});
