// Issues #253 and #454: development-only provenance for the serving checkout —
// the absolute worktree path, branch, current commit, and whether the served
// source still matches that commit. The dev server serves it at
// /-/dev/provenance so browser evidence can be tied to the exact checkout and
// source state under review, and the capture preflight
// (tools/evidence-preflight.mjs) gates evidence on the same numbers. Nothing
// here ever runs in a production build.
import { execFileSync } from "node:child_process";
import path from "node:path";

export const ENDPOINT_PATH = "/-/dev/provenance";

// Issue #454: evidence outputs are products of capturing evidence, not inputs
// to the served app — the captures and their READMEs, the preflight's own
// record, and the dev-server log. They never taint source cleanliness.
export const EVIDENCE_OUTPUT_PREFIXES = ["docs/evidence", ".dev"];

export function isEvidenceOutputPath(filePath) {
  const normalized = filePath.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "");
  return EVIDENCE_OUTPUT_PREFIXES.some(
    (candidate) => normalized === candidate || normalized.startsWith(`${candidate}/`),
  );
}

const unquote = (rawPath) =>
  rawPath.startsWith('"') && rawPath.endsWith('"') ? rawPath.slice(1, -1) : rawPath;

// The one authoritative read of a checkout's working tree: every non-ignored
// change git reports, split into source changes (which taint evidence) and
// evidence outputs (which never do). A rename taints when either side is a
// source path. Null when git is unavailable — cleanliness is then unknown,
// and the preflight must refuse evidence rather than assume.
export function readSourceStatus(root) {
  let status;
  try {
    status = execFileSync("git", ["status", "--porcelain=v1", "-uall", "--"], {
      cwd: root,
      encoding: "utf8",
    });
  } catch {
    return null;
  }
  const changes = [];
  const evidence = [];
  for (const line of status.split("\n")) {
    if (!line) continue;
    const state = line.slice(0, 2);
    const sides = unquote(line.slice(3))
      .split(" -> ")
      .map((side) => unquote(side));
    const entry = { path: sides[sides.length - 1], state };
    if (sides.every(isEvidenceOutputPath)) evidence.push(entry);
    else changes.push(entry);
  }
  return { clean: changes.length === 0, changes, evidence };
}

const git = (args, cwd) => {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
};

// Recomputed per call, not cached at server start: a server restarted after
// a checkout change — or even one that keeps running across one — reports
// the commit now checked out, never a stale one.
export function devProvenance(root = process.cwd()) {
  // --show-toplevel resolves to this worktree's root, not the main checkout.
  const worktree = git(["rev-parse", "--show-toplevel"], root) ?? root;
  const commit = git(["rev-parse", "HEAD"], worktree);
  return {
    app: "flowsynth",
    worktree,
    branch: git(["branch", "--show-current"], worktree),
    commit,
    // Cleanliness is only meaningful against a known commit; without git it
    // stays null and the capture preflight refuses evidence.
    source: commit === null ? null : readSourceStatus(worktree),
  };
}

const shortSha = (commit) => (commit ? commit.slice(0, 8) : "(none)");

// Issue #457: the provenance fetch shared by the capture preflight and the
// evidence health check — the health check must read the exact URL the same
// way the preflight does, or its server/provenance classification could
// disagree with the gate that accepts evidence.
//
// The endpoint hangs off the origin; a bare server URL or the endpoint URL
// itself are both accepted.
export function endpointUrl(rawUrl) {
  const base = new URL(rawUrl);
  if (base.pathname.replace(/\/+$/, "") === ENDPOINT_PATH) return base.href;
  return new URL(ENDPOINT_PATH, base.origin).href;
}

// Answers { provenance, detail }: provenance is the parsed body on success,
// null otherwise, with `detail` naming why — an invalid URL, a non-dev
// server, or an unreachable one. Every rejection is a diagnostic, never a
// throw, so callers can print the fix instead of a stack.
export async function fetchProvenance(rawUrl) {
  let href;
  try {
    href = endpointUrl(rawUrl);
  } catch {
    return {
      provenance: null,
      detail: `"${rawUrl}" is not a valid URL — pass the server URL exactly as the launcher printed it.`,
    };
  }
  try {
    const response = await fetch(href, {
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      return { provenance: null, detail: `${href} answered HTTP ${response.status} — not a FlowSynth dev server.` };
    }
    const body = await response.text();
    try {
      return { provenance: JSON.parse(body), detail: null };
    } catch {
      return { provenance: null, detail: `${href} answered a non-JSON body — not a FlowSynth dev server.` };
    }
  } catch (error) {
    const code = error?.cause?.code ?? error?.name ?? "error";
    return { provenance: null, detail: `${href} is unreachable (${code}) — the server may have died.` };
  }
}

// Issue #454: the one capture gate, shared by the preflight CLI and any
// workflow that would accept evidence. Identity first — the served worktree
// must be the expected checkout and the served commit its HEAD — then
// cleanliness: the served source must match that commit, evidence outputs
// excepted. Every rejection names its fix, so a failed preflight is an
// instruction, not a dead end.
export function verifyCaptureProvenance({ provenance, url, expectedWorktree, expectedCommit }) {
  const relaunch = `Relaunch \`npm run dev\` in \`${expectedWorktree}\` and run the preflight again against the URL it prints.`;
  if (!provenance || typeof provenance !== "object" || provenance.app !== "flowsynth" ||
      typeof provenance.worktree !== "string" || !provenance.worktree ||
      typeof provenance.commit !== "string" || !provenance.commit ||
      (provenance.branch !== null && typeof provenance.branch !== "string")) {
    return {
      accepted: false,
      reason: "unavailable",
      diagnostics: [
        `No FlowSynth provenance answered at ${url} — the tab may be stale, or pointed at a server that is not this project's dev server.`,
        relaunch,
      ],
      record: null,
    };
  }
  if (path.resolve(provenance.worktree) !== path.resolve(expectedWorktree)) {
    return {
      accepted: false,
      reason: "foreign-worktree",
      diagnostics: [
        `The server at ${url} serves \`${provenance.worktree}\`, not this checkout (\`${expectedWorktree}\`) — a sibling worktree's dev server is answering this URL, and its page would silently review the wrong source.`,
        relaunch,
      ],
      record: null,
    };
  }
  if (provenance.commit !== expectedCommit) {
    return {
      accepted: false,
      reason: "commit-mismatch",
      diagnostics: [
        `The server serves commit ${shortSha(provenance.commit)}, but this checkout's HEAD is ${shortSha(expectedCommit)} — the server predates the checkout's current state, or is not this checkout's server.`,
        relaunch,
      ],
      record: null,
    };
  }
  if (!provenance.source) {
    return {
      accepted: false,
      reason: "cleanliness-unavailable",
      diagnostics: [
        `The provenance at ${url} reports no source cleanliness — this server predates the capture preflight (issue #454) and cannot promise the browser shows committed code.`,
        relaunch,
      ],
      record: null,
    };
  }
  const source = provenance.source;
  const validChange = (entry) => entry !== null && typeof entry === "object" &&
    typeof entry.path === "string" && entry.path.length > 0 && typeof entry.state === "string";
  if (typeof source.clean !== "boolean" ||
      !Array.isArray(source.changes) || !source.changes.every(validChange) ||
      !Array.isArray(source.evidence) || !source.evidence.every(validChange) ||
      source.clean !== (source.changes.length === 0) ||
      !source.evidence.every((entry) => isEvidenceOutputPath(entry.path))) {
    return {
      accepted: false,
      reason: "cleanliness-unavailable",
      diagnostics: [
        `The provenance at ${url} reports malformed or contradictory source cleanliness; clean must be a boolean matching the source change list, and evidence entries must be evidence-output paths.`,
        relaunch,
      ],
      record: null,
    };
  }
  if (!provenance.source.clean) {
    const diagnostics = [
      `The served source differs from commit ${shortSha(provenance.commit)} — ${provenance.source.changes.length} uncommitted change(s) the browser may already be displaying:`,
      ...provenance.source.changes.map((change) => `  ${change.state.trim() || "?"} ${change.path}`),
      "Commit or stash the changes above, then run the preflight again — a new commit needs no relaunch, because the endpoint recomputes per request and the served commit moves with HEAD.",
    ];
    if (provenance.source.evidence.length > 0) {
      diagnostics.push(
        `Not counted as source (evidence outputs): ${provenance.source.evidence.map((entry) => entry.path).join(", ")}.`,
      );
    }
    return { accepted: false, reason: "dirty-source", diagnostics, record: null };
  }
  return {
    accepted: true,
    reason: null,
    diagnostics: [
      `Verified: ${url} serves \`${provenance.worktree}\` at commit ${shortSha(provenance.commit)} with clean source.`,
    ],
    record: {
      app: "flowsynth",
      check: "capture-preflight",
      acceptedAt: new Date().toISOString(),
      url,
      worktree: provenance.worktree,
      branch: provenance.branch,
      commit: provenance.commit,
      source: provenance.source,
    },
  };
}

export function expectedCheckout(dir) {
  const worktree = dir ? path.resolve(dir) : git(["rev-parse", "--show-toplevel"], process.cwd());
  if (!worktree) {
    return { error: "Not inside a git checkout — run the evidence command from the worktree you are editing, or pass --worktree <dir>." };
  }
  const commit = git(["rev-parse", "HEAD"], worktree);
  if (!commit) {
    return { error: `\`${worktree}\` has no HEAD commit — commit the work before capturing evidence from it.` };
  }
  return { worktree, commit };
}
