import { describe, expect, it } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SERVER,
  VISIBILITY,
  SNAPSHOT,
  VIEWPORT,
  RETRY_BUDGET,
  classifyServerFailure,
  parseViewport,
  recoveryPlan,
  resumeSteps,
  browserChecks,
} from "./evidence-healthcheck.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const worktree = (): string =>
  execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: repoRoot, encoding: "utf8" }).trim();

const head = (): string =>
  execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" }).trim();

const ALL_CLASSES = [SERVER, VISIBILITY, SNAPSHOT, VIEWPORT];

describe("recovery plans (issue #457)", () => {
  it("gives every failure class an observed failure, bounded recovery, budget, and an exhausted record", () => {
    for (const cls of ALL_CLASSES) {
      const plan = recoveryPlan(cls);
      expect(plan.cls, cls).toBe(cls);
      expect(plan.observed.join(" ").length, cls).toBeGreaterThan(0);
      expect(plan.recovery.length, cls).toBeGreaterThan(0);
      expect(plan.budget, cls).toContain("budget");
      expect(plan.exhausted.join(" "), cls).toContain("Record");
      expect(plan.exhausted.join(" "), cls).toContain("unavailable");
    }
  });

  it("recovers server-provenance by relaunching once and re-running the preflight gate", () => {
    const plan = recoveryPlan(SERVER);
    expect(plan.recovery.join(" ")).toContain("npm run dev");
    expect(plan.recovery.join(" ")).toContain("evidence-preflight");
    expect(plan.budget).toContain("one relaunch");
    expect(plan.exhausted.join(" ")).toContain("blocked");
    expect(plan.exhausted.join(" ")).toContain("Nothing from this pass may be claimed as verified");
  });

  it("recovers browser-visibility by activating the tab, twice at most, each confirmed", () => {
    const plan = recoveryPlan(VISIBILITY);
    expect(plan.recovery.join(" ")).toContain("preview_status");
    expect(plan.recovery.join(" ")).toContain("visible");
    expect(plan.budget).toContain("two activation attempts");
  });

  it("does not reject a usable tab solely because visible remains false", () => {
    const recovery = recoveryPlan(VISIBILITY).recovery.join(" ");
    const checks = browserChecks({ width: 390, height: 844 }).join(" ");
    expect(checks).toContain("A false visible flag alone is not a failure");
    expect(recovery).toContain("available, not loading, no dialog");
    expect(recovery).toContain("successful preview_snapshot on the same tab");
    expect(recovery).toContain("visibility confirmation unavailable");
    expect(recovery).toContain("navigate the same tab to the verified URL");
    expect(fs.readFileSync(path.join(repoRoot, "docs/agents/visual-evidence.md"), "utf8"))
      .toContain("without claiming visibility was verified");
  });

  it("recovers browser-snapshot with a status read and a retry of the same snapshot, three attempts", () => {
    const plan = recoveryPlan(SNAPSHOT);
    expect(plan.recovery.join(" ")).toContain("preview_status");
    expect(plan.recovery.join(" ")).toContain("retry the same snapshot");
    expect(plan.budget).toContain("Three failed attempts is the whole budget");
    expect(plan.exhausted.join(" ")).toContain("never as captures");
  });

  it("recovers browser-viewport with the documented resize budget: status once, retry once more", () => {
    const plan = recoveryPlan(VIEWPORT);
    expect(plan.recovery.join(" ")).toContain("preview_status");
    expect(plan.recovery.join(" ")).toContain("at most once more");
    expect(plan.budget).toContain("Three failed attempts is the whole budget");
  });

  it("never accepts a resize's own echo as the viewport confirmation — the live page read decides", () => {
    const plan = recoveryPlan(VIEWPORT);
    const steps = resumeSteps({ width: 390, height: 844 }).join(" ");
    for (const text of [plan.recovery.join(" "), steps, browserChecks({ width: 390, height: 844 }).join(" ")]) {
      expect(text).toContain("window.innerWidth");
      expect(text).toContain("stale");
    }
  });

  it("pins the viewport target into the viewport plan when --viewport is given", () => {
    const plan = recoveryPlan(VIEWPORT, { width: 390, height: 844 });
    expect(plan.observed.join(" ")).toContain("390×844");
    expect(plan.exhausted.join(" ")).toContain("390×844");
  });

  it("throws on an unknown class instead of inventing a recovery", () => {
    expect(() => recoveryPlan("browser-screenshot")).toThrow("Unknown failure class");
  });

  it("carries the shared retry budget: three attempts, record don't retry", () => {
    expect(RETRY_BUDGET).toContain("Three failed attempts is the whole budget");
    expect(RETRY_BUDGET).toContain("Record, don't retry");
  });
});

describe("failure classification (issue #457)", () => {
  it("maps every preflight rejection reason onto the server-provenance class with its reason", () => {
    for (const reason of [
      "unavailable",
      "foreign-worktree",
      "commit-mismatch",
      "dirty-source",
      "cleanliness-unavailable",
    ]) {
      expect(classifyServerFailure(reason)).toBe(`server-provenance (${reason})`);
    }
  });
});

describe("viewport parsing (issue #457)", () => {
  it("parses WxH and rejects malformed or out-of-range specs", () => {
    expect(parseViewport(undefined)).toBeNull();
    expect(parseViewport("390x844")).toEqual({ width: 390, height: 844 });
    expect(parseViewport("nope")).toHaveProperty("error");
    expect(parseViewport("39x844")).toHaveProperty("error");
    expect(parseViewport("9999x844")).toHaveProperty("error");
  });
});

describe("resume steps (issue #457)", () => {
  it("re-runs the preflight on the exact URL and confirms the live viewport before resuming", () => {
    const steps = resumeSteps({ width: 390, height: 844 });
    expect(steps.join(" ")).toContain("capture preflight");
    expect(steps.join(" ")).toContain("preview_status");
    expect(steps.join(" ")).toContain("390×844");
    expect(steps.join(" ")).toContain("same URL");
  });
});

describe("browser checks (issue #457)", () => {
  it("prints the three precise checks and names the class each failure maps to", () => {
    const text = browserChecks({ width: 390, height: 844 }).join("\n");
    expect(text).toContain("preview_status");
    expect(text).toContain("preview_snapshot");
    expect(text).toContain("preview_resize");
    expect(text).toContain("390×844");
    for (const cls of [VISIBILITY, SNAPSHOT, VIEWPORT]) {
      expect(text).toContain(cls);
    }
  });
});

describe("evidence health check CLI (issue #457)", () => {
  const runCli = (args: string[], cwd = repoRoot): Promise<{ status: number | null; stdout: string; stderr: string }> =>
    new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [path.join(repoRoot, "tools", "evidence-healthcheck.mjs"), ...args],
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

  const served = (overrides: Record<string, unknown> = {}): unknown => ({
    app: "flowsynth",
    worktree: worktree(),
    branch: "test",
    commit: head(),
    source: { clean: true, changes: [], evidence: [] },
    ...overrides,
  });

  const freePort = (): Promise<number> =>
    new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.listen(0, "127.0.0.1", () => {
        const address = (probe.address() as net.AddressInfo).port;
        probe.close(() => resolve(address));
      });
      probe.on("error", reject);
    });

  it("verifies a healthy server, prints the browser checks with budgets, and exits 0", async () => {
    const server = await provenanceServer(served());
    try {
      const result = await runCli(["--url", server.url, "--viewport", "390x844"]);
      expect(result.status).toBe(0);
      const text = `${result.stdout}\n${result.stderr}`;
      expect(text).toContain("server    OK");
      expect(text).toContain("preview_status");
      expect(text).toContain("preview_snapshot");
      expect(text).toContain("preview_resize");
      expect(text).toContain("390×844");
      expect(text).toContain("browser-visibility");
      expect(text).toContain("browser-snapshot");
      expect(text).toContain("browser-viewport");
      expect(text).toContain("Three failed attempts is the whole budget");
      expect(text).toContain("capture preflight");
      expect(text).toContain("docs/agents/visual-evidence.md §5");
    } finally {
      await server.close();
    }
  });

  it("classifies an unreachable server as server-provenance and prints its recovery and exhausted record", async () => {
    const port = await freePort();
    const result = await runCli(["--url", `http://127.0.0.1:${port}/`]);
    expect(result.status).toBe(1);
    const text = `${result.stdout}\n${result.stderr}`;
    expect(text).toContain("server-provenance (unavailable)");
    expect(text).toContain("unreachable");
    expect(text).toContain("npm run dev");
    expect(text).toContain("Nothing from this pass may be claimed as verified");
  });

  it.each([
    { overrides: { worktree: "/sibling/other-worktree" }, expected: "foreign-worktree" },
    { overrides: { commit: "d".repeat(40) }, expected: "commit-mismatch" },
    {
      overrides: {
        source: { clean: false, changes: [{ path: "src/ui/app.ts", state: " M" }], evidence: [] },
      },
      expected: "dirty-source",
    },
    { overrides: { commit: null, source: null }, expected: "unavailable" },
  ])("classifies a provenance rejection as server-provenance ($expected)", async ({ overrides, expected }) => {
    const server = await provenanceServer(served(overrides));
    try {
      const result = await runCli(["--url", server.url]);
      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain(`server-provenance (${expected})`);
    } finally {
      await server.close();
    }
  });

  it("fails with usage when --url is missing and when --viewport is malformed", async () => {
    const missing = await runCli([]);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain("Usage");

    const badViewport = await runCli(["--url", "http://localhost:5173/", "--viewport", "wide"]);
    expect(badViewport.status).toBe(1);
    expect(badViewport.stderr).toContain("--viewport");
  });
});

describe("one authoritative recovery workflow (issue #457)", () => {
  const doc = (): string => fs.readFileSync(path.join(repoRoot, "docs", "agents", "visual-evidence.md"), "utf8");

  it("keeps the recovery workflow in visual-evidence.md §5 with the health check invocation", () => {
    const text = doc();
    expect(text).toContain("## 5. Recover a stalled pass");
    expect(text).toContain("node tools/evidence-healthcheck.mjs --url");
    expect(text).toContain("server-provenance");
    expect(text).toContain("browser-visibility");
    expect(text).toContain("browser-snapshot");
    expect(text).toContain("browser-viewport");
  });

  it("states the same retry budget and the exhausted-record rule as the tool", () => {
    const text = doc();
    expect(text).toContain("Three failed attempts is the whole budget");
    expect(text).toContain("the raw failure");
    expect(text).toContain("never claimed as verified");
    expect(text).toContain("two activation attempts");
  });

  it("documents the external service limitation explicitly", () => {
    expect(doc()).toContain("The preview service is outside this repo");
  });

  it("states the live-viewport confirmation rule: a resize's echo and the status setting can be stale", () => {
    const text = doc();
    expect(text).toContain("window.innerWidth");
    expect(text).toContain("stale");
  });
});
