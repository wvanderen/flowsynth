import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createServer } from "vite";
import {
  devProvenance,
  isEvidenceOutputPath,
  readSourceStatus,
  type DevProvenance,
  type SourceStatus,
} from "./dev/provenance.mjs";

const git = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

const gitIn = (root: string, ...args: string[]): string =>
  execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

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
  expect(actual.branch).toBe(git("branch", "--show-current") || null);
  expect(actual.commit).toBe(git("rev-parse", "HEAD"));
  const source = actual.source as SourceStatus | null;
  expect(source).not.toBeNull();
  expect(source!.clean).toBe(source!.changes.length === 0);
}

const fetchProvenanceFrom = async (local: string): Promise<DevProvenance> => {
  const response = await fetch(new URL("-/dev/provenance", local));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  return (await response.json()) as DevProvenance;
};

// Issue #454: dirtiness cases need a repo whose history and working tree the
// test fully owns; the real checkout must stay untouched except for the
// untracked probes below, which are always removed.
const tempRoots: string[] = [];
afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function makeRepo(): {
  root: string;
  write: (filePath: string, contents: string) => void;
  commitAll: (message: string) => void;
} {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "flowsynth-provenance-")));
  tempRoots.push(root);
  gitIn(root, "init", "-b", "main");
  gitIn(root, "config", "user.email", "preflight@example.invalid");
  gitIn(root, "config", "user.name", "Preflight Test");
  const write = (filePath: string, contents: string): void => {
    const full = path.join(root, filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents);
  };
  const commitAll = (message: string): void => {
    gitIn(root, "add", "-A");
    gitIn(root, "commit", "-m", message, "--quiet");
  };
  write("src/main.ts", 'export const app = "flowsynth";\n');
  commitAll("seed");
  return { root, write, commitAll };
}

describe("devProvenance", () => {
  it("reports the active worktree and the current commit", () => {
    expectProvenance(devProvenance() as unknown as Record<string, unknown>);
  });
});

describe("source cleanliness (issue #454)", () => {
  it("reads a committed tree as clean", () => {
    const { root } = makeRepo();
    expect(readSourceStatus(root)).toEqual({ clean: true, changes: [], evidence: [] });
    expect(devProvenance(root).source).toEqual({ clean: true, changes: [], evidence: [] });
  });

  it("counts a tracked modification as dirty source", () => {
    const { root, write } = makeRepo();
    write("src/main.ts", 'export const app = "changed";\n');
    const status = readSourceStatus(root)!;
    expect(status.clean).toBe(false);
    expect(status.changes).toContainEqual({ path: "src/main.ts", state: " M" });
    expect(status.evidence).toEqual([]);
  });

  it("counts a relevant untracked source file as dirty", () => {
    const { root, write } = makeRepo();
    write("src/ui/new-panel.ts", "export {};\n");
    const status = readSourceStatus(root)!;
    expect(status.clean).toBe(false);
    expect(status.changes).toContainEqual({ path: "src/ui/new-panel.ts", state: "??" });
  });

  it("never counts evidence outputs as source, tracked or untracked", () => {
    const { root, write, commitAll } = makeRepo();
    write("docs/evidence/issue-454/README.md", "v1\n");
    commitAll("evidence");
    write("docs/evidence/issue-454/README.md", "v2\n");
    write("docs/evidence/issue-454/desktop.png", "png");
    write(".dev/server.log", "launch\n");
    const status = readSourceStatus(root)!;
    expect(status.clean).toBe(true);
    expect(status.changes).toEqual([]);
    expect(status.evidence).toEqual(
      expect.arrayContaining([
        { path: "docs/evidence/issue-454/README.md", state: " M" },
        { path: "docs/evidence/issue-454/desktop.png", state: "??" },
        { path: ".dev/server.log", state: "??" },
      ]),
    );
  });

  it("counts a mixed tree as dirty, listing only the source side", () => {
    const { root, write } = makeRepo();
    write("src/main.ts", 'export const app = "changed";\n');
    write("docs/evidence/issue-454/desktop.png", "png");
    const status = readSourceStatus(root)!;
    expect(status.clean).toBe(false);
    expect(status.changes).toEqual([{ path: "src/main.ts", state: " M" }]);
    expect(status.evidence).toEqual([{ path: "docs/evidence/issue-454/desktop.png", state: "??" }]);
  });

  it("counts a rename whose source side is app code as dirty", () => {
    const { root } = makeRepo();
    gitIn(root, "mv", "src/main.ts", "src/renamed.ts");
    const status = readSourceStatus(root)!;
    expect(status.clean).toBe(false);
    expect(status.changes).toEqual([{ path: "src/renamed.ts", state: "R " }]);
  });

  it("treats ignored files as absent, and a git-less root as unknown", () => {
    const { root, write, commitAll } = makeRepo();
    write(".gitignore", ".dev/\n");
    commitAll("ignore dev outputs");
    write(".dev/server.log", "launch\n");
    expect(readSourceStatus(root)).toEqual({ clean: true, changes: [], evidence: [] });

    const plain = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "flowsynth-nogit-")));
    tempRoots.push(plain);
    expect(readSourceStatus(plain)).toBeNull();
    const provenance = devProvenance(plain);
    expect(provenance.commit).toBeNull();
    expect(provenance.source).toBeNull();
  });

  it("classifies evidence-output paths by prefix", () => {
    expect(isEvidenceOutputPath("docs/evidence/issue-454/desktop.png")).toBe(true);
    expect(isEvidenceOutputPath("docs/evidence")).toBe(true);
    expect(isEvidenceOutputPath(".dev/server.log")).toBe(true);
    expect(isEvidenceOutputPath("docs/evidenceous/keep.png")).toBe(false);
    expect(isEvidenceOutputPath("src/evidence/keep.ts")).toBe(false);
    expect(isEvidenceOutputPath("src/main.ts")).toBe(false);
  });
});

describe("dev provenance endpoint (issue #253)", () => {
  it("serves the serving worktree's identity and commit", async () => {
    const server = await testServer();
    await server.listen();
    try {
      const local = server.resolvedUrls?.local[0];
      expect(local).toBeDefined();
      expectProvenance((await fetchProvenanceFrom(local!)) as unknown as Record<string, unknown>);
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

  it("exposes uncommitted source, untracked files included (issue #454)", async () => {
    const server = await testServer();
    await server.listen();
    const root = git("rev-parse", "--show-toplevel");
    const sourceProbe = path.join(root, ".preflight-source-probe.txt");
    const evidenceProbe = path.join(root, "docs", "evidence", ".preflight-probe");
    try {
      const before = await fetchProvenanceFrom(server.resolvedUrls!.local[0]);
      expect(before.source).not.toBeNull();

      fs.writeFileSync(sourceProbe, "probe\n");
      const dirty = await fetchProvenanceFrom(server.resolvedUrls!.local[0]);
      expect(dirty.source!.clean).toBe(false);
      expect(dirty.source!.changes).toContainEqual({
        path: ".preflight-source-probe.txt",
        state: "??",
      });

      fs.mkdirSync(evidenceProbe, { recursive: true });
      fs.writeFileSync(path.join(evidenceProbe, "desktop.png"), "png");
      const mixed = await fetchProvenanceFrom(server.resolvedUrls!.local[0]);
      expect(mixed.source!.changes.some((change) => change.path.includes(".preflight-probe"))).toBe(
        false,
      );
      expect(mixed.source!.evidence).toContainEqual({
        path: "docs/evidence/.preflight-probe/desktop.png",
        state: "??",
      });
      expect(mixed.source!.clean).toBe(mixed.source!.changes.length === 0);
    } finally {
      fs.rmSync(sourceProbe, { force: true });
      fs.rmSync(evidenceProbe, { recursive: true, force: true });
      await server.close();
    }
  });
});
