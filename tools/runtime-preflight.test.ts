import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The runtime preflight's CLI contract (issue #505): a cheap gate that
// reports the declared and effective runtime, the host's calendar zone, and
// the UI harness's storage capability — accepting the ready environment and
// refusing anything else before expensive work, with the fix in its output.
// The refusal case runs against a temp root whose declaration cannot match
// any real runtime; the acceptance case runs against this checkout, which
// the suite's runtime guard only lets load under the declared runtime.

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const preflight = path.join(repoRoot, "tools", "runtime-preflight.mjs");

const run = (args: string[]): { code: number; out: string } => {
  try {
    const out = execFileSync(process.execPath, [preflight, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { code: failure.status ?? 1, out: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
  }
};

const tempRoot = (declaration: string): string => {
  const root = mkdtempSync(path.join(tmpdir(), "flowsynth-preflight-"));
  writeFileSync(path.join(root, ".node-version"), declaration);
  return root;
};

describe("the runtime preflight (issue #505)", () => {
  it("accepts the supported environment and reports what it verified", () => {
    const { code, out } = run(["--root", repoRoot]);
    expect(code).toBe(0);
    expect(out).toContain("FlowSynth runtime preflight");
    expect(out).toContain("declared");
    expect(out).toContain("22.23.4");
    expect(out).toContain("effective");
    expect(out).toContain(process.version);
    expect(out).toContain("timezone");
    expect(out).toContain(Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(out).toContain("storage");
    expect(out).toContain("ACCEPT");
    // The calendar basis is declared in the report, not left implicit.
    expect(out).toContain("calendar");
  });

  it("rejects an incompatible runtime before expensive work, naming the fix", () => {
    const root = tempRoot("99.99.99\n");
    try {
      const { code, out } = run(["--root", root]);
      expect(code).toBe(1);
      expect(out).toContain("REJECT");
      expect(out).toContain("version-mismatch");
      expect(out).toContain("99.99.99");
      expect(out).toContain(process.version);
      expect(out).toMatch(/mise|nvm|fnm/);
      expect(out).toContain(".node-version");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a checkout with no declaration", () => {
    const root = mkdtempSync(path.join(tmpdir(), "flowsynth-preflight-"));
    try {
      const { code, out } = run(["--root", root]);
      expect(code).toBe(1);
      expect(out).toContain("missing-declaration");
      expect(out).toContain(".node-version");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses unknown arguments with the usage line", () => {
    const { code, out } = run(["--wat"]);
    expect(code).toBe(1);
    expect(out).toContain("Usage");
  });
});
