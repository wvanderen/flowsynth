import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { candidateBinDirs, locateDeclaredRuntime } from "./run-supported.mjs";

// The npm-script wrapper's contract (issue #505): ordinary checks select the
// declared runtime themselves — an agent never reconstructs a private PATH
// override. The locating seam is unit-tested with fabricated layouts; the
// CLI is exercised through subprocesses, including the re-exec through an
// explicit FLOWSYNTH_NODE override and the refusal when no declared runtime
// is installed.

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const wrapper = path.join(repoRoot, "tools", "run-supported.mjs");

const run = (args: string[], env: NodeJS.ProcessEnv = {}): { code: number; out: string } => {
  try {
    const out = execFileSync(process.execPath, [wrapper, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    return { code: 0, out };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { code: failure.status ?? 1, out: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
  }
};

describe("candidateBinDirs (issue #505)", () => {
  it("covers the version managers' install layouts for the declared version", () => {
    const dirs = candidateBinDirs("22.23.4", "/home/tester");
    expect(dirs).toContain("/home/tester/.local/share/mise/installs/node/22.23.4/bin");
    expect(dirs).toContain("/home/tester/.nvm/versions/node/v22.23.4/bin");
    expect(dirs).toContain("/home/tester/.local/share/fnm/node-versions/v22.23.4-installation/bin");
    expect(dirs).toContain("/home/tester/.fnm/node-versions/v22.23.4-installation/bin");
    expect(dirs).toContain("/home/tester/.volta/tools/image/node/22.23.4/bin");
    expect(dirs).toContain("/home/tester/.asdf/installs/nodejs/22.23.4/bin");
    expect(dirs).toContain("/usr/local/n/versions/node/22.23.4/bin");
  });
});

describe("locateDeclaredRuntime (issue #505)", () => {
  it("prefers the explicit FLOWSYNTH_NODE override", () => {
    const found = locateDeclaredRuntime("22.23.4", { override: "/explicit/node" });
    expect(found).toEqual({ bin: "/explicit/node" });
  });

  it("finds the declared runtime in a version manager's layout", () => {
    const home = mkdtempSync(path.join(tmpdir(), "flowsynth-run-"));
    try {
      const binDir = path.join(home, ".local/share/mise/installs/node/22.23.4/bin");
      mkdirSync(binDir, { recursive: true });
      writeFileSync(path.join(binDir, "node"), "");
      const found = locateDeclaredRuntime("22.23.4", { home, candidates: candidateBinDirs("22.23.4", home) });
      expect(found).toEqual({ bin: path.join(binDir, "node") });
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("answers a named error when no installed runtime matches", () => {
    const home = mkdtempSync(path.join(tmpdir(), "flowsynth-run-"));
    try {
      const found = locateDeclaredRuntime("22.23.4", { home, candidates: candidateBinDirs("22.23.4", home) });
      expect(found).toHaveProperty("error");
      expect((found as { error: string }).error).toContain("22.23.4");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("the run-supported CLI (issue #505)", () => {
  let temp: string;
  let fakeNode: string;

  afterEach(() => {
    if (temp !== undefined) rmSync(temp, { recursive: true, force: true });
  });

  const makeFakeNode = (): string => {
    temp = mkdtempSync(path.join(tmpdir(), "flowsynth-wrap-"));
    fakeNode = path.join(temp, "fake-node");
    writeFileSync(fakeNode, "#!/bin/sh\necho 'v99.99.99'\n");
    chmodSync(fakeNode, 0o755);
    return fakeNode;
  };

  it("runs the entry directly when the ambient runtime matches the declaration", () => {
    const { code, out } = run(["--print-runtime"]);
    expect(code).toBe(0);
    expect(out).toContain(process.version);
    expect(out).toContain("22.23.4");
  });

  it("re-execs the entry under an explicitly selected runtime when the ambient one differs", () => {
    const override = makeFakeNode();
    writeFileSync(path.join(temp, ".node-version"), "99.99.99\n");
    // The ambient (supported) runtime cannot match the temp root's
    // declaration, so the wrapper must go through the override binary.
    const { code, out } = run(["--root", temp, "--print-runtime"], { FLOWSYNTH_NODE: override });
    expect(code).toBe(0);
    expect(out).toContain("v99.99.99");
  });

  it("refuses with the per-manager fix when the declared runtime is not installed", () => {
    const temp2 = mkdtempSync(path.join(tmpdir(), "flowsynth-wrap-"));
    try {
      writeFileSync(path.join(temp2, ".node-version"), "99.99.99\n");
      const { code, out } = run(["--root", temp2, "--print-runtime"], { HOME: "" });
      expect(code).toBe(1);
      expect(out).toContain("99.99.99");
      expect(out).toMatch(/mise|nvm|fnm/);
      expect(out).toContain("FLOWSYNTH_NODE");
    } finally {
      rmSync(temp2, { recursive: true, force: true });
    }
  });

  it("names the located runtime — not the override — when a scanned binary lies", () => {
    const temp4 = mkdtempSync(path.join(tmpdir(), "flowsynth-wrap-"));
    try {
      writeFileSync(path.join(temp4, ".node-version"), "99.99.98\n");
      const binDir = path.join(temp4, ".local/share/mise/installs/node/99.99.98/bin");
      mkdirSync(binDir, { recursive: true });
      writeFileSync(path.join(binDir, "node"), "#!/bin/sh\necho 'v1.2.3'\n");
      chmodSync(path.join(binDir, "node"), 0o755);
      const { code, out } = run(["--root", temp4, "--print-runtime"], { HOME: temp4 });
      expect(code).toBe(1);
      expect(out).toContain("reports v1.2.3");
      // The binary came from the layout scan, not the override — the hint
      // must name what to fix without inventing an override the user never
      // set.
      expect(out).not.toContain("FLOWSYNTH_NODE");
    } finally {
      rmSync(temp4, { recursive: true, force: true });
    }
  });

  it("refuses a checkout with no runtime declaration", () => {
    const temp3 = mkdtempSync(path.join(tmpdir(), "flowsynth-wrap-"));
    try {
      const { code, out } = run(["--root", temp3, "--print-runtime"]);
      expect(code).toBe(1);
      expect(out).toContain(".node-version");
    } finally {
      rmSync(temp3, { recursive: true, force: true });
    }
  });

  it("names a missing entry instead of failing opaquely", () => {
    const { code, out } = run(["no-such-entry.mjs"]);
    expect(code).toBe(1);
    expect(out).toContain("no-such-entry.mjs");
  });

  it("prints the usage line when given nothing", () => {
    const { code, out } = run([]);
    expect(code).toBe(1);
    expect(out).toContain("Usage");
  });
});
