// Issue #454: the capture preflight — the one gate visual evidence must pass.
// It asks the exact URL a tab will be screenshotted for its provenance,
// verifies the served worktree and commit against the checkout it runs in,
// and refuses evidence from uncommitted source — tracked changes and
// non-ignored untracked files alike, evidence outputs exempt. Every rejection
// exits 1 with the fix in its output; acceptance records the verified
// provenance with --record (default: docs/evidence/preflight/provenance.json).
// Development-only: never part of a production build.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { verifyCaptureProvenance } from "./dev/provenance.mjs";

const ENDPOINT_PATH = "/-/dev/provenance";
const USAGE =
  "Usage: node tools/evidence-preflight.mjs --url <server-url> [--worktree <dir>] [--record <file>]";

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--url") flags.url = argv[(i += 1)];
    else if (flag === "--worktree") flags.worktree = argv[(i += 1)];
    else if (flag === "--record") flags.record = argv[(i += 1)];
    else return { error: `Unknown argument: ${flag}\n${USAGE}` };
  }
  return { flags };
}

// The endpoint hangs off the origin; a bare server URL or the endpoint URL
// itself are both accepted.
function endpointUrl(rawUrl) {
  const base = new URL(rawUrl);
  if (base.pathname.replace(/\/+$/, "") === ENDPOINT_PATH) return base.href;
  return new URL(ENDPOINT_PATH, base.origin).href;
}

async function fetchProvenance(rawUrl) {
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

const git = (args, cwd) => {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
};

function expectedCheckout(dir) {
  const worktree = dir ? path.resolve(dir) : git(["rev-parse", "--show-toplevel"], process.cwd());
  if (!worktree) {
    return { error: "Not inside a git checkout — run the preflight from the worktree you are editing, or pass --worktree <dir>." };
  }
  const commit = git(["rev-parse", "HEAD"], worktree);
  if (!commit) {
    return { error: `\`${worktree}\` has no HEAD commit — commit the work before capturing evidence from it.` };
  }
  return { worktree, commit };
}

export async function runPreflight(argv) {
  const parsed = parseFlags(argv);
  if (parsed.error || !parsed.flags?.url) {
    console.error(parsed.error ?? `--url is required.\n${USAGE}`);
    return 1;
  }
  const { url, worktree, record } = parsed.flags;

  console.log("\nFlowSynth capture preflight\n");
  console.log(`  url       ${url}`);

  const expected = expectedCheckout(worktree);
  if (expected.error) {
    console.log("  worktree  (unknown)");
    console.log("\n  REJECT — evidence is not accepted.");
    console.log(`  ${expected.error}`);
    console.log("\n  Evidence rules: docs/agents/visual-evidence.md\n");
    return 1;
  }
  console.log(`  worktree  ${expected.worktree}`);
  console.log(`  commit    ${expected.commit.slice(0, 8)}`);
  console.log("");

  const { provenance, detail } = await fetchProvenance(url);
  const verdict = verifyCaptureProvenance({
    provenance,
    url,
    expectedWorktree: expected.worktree,
    expectedCommit: expected.commit,
  });
  if (detail) verdict.diagnostics.unshift(detail);

  for (const line of verdict.diagnostics) console.log(`  ${line}`);
  console.log("");
  if (verdict.accepted) {
    const recordPath = path.resolve(record ?? "docs/evidence/preflight/provenance.json");
    try {
      fs.mkdirSync(path.dirname(recordPath), { recursive: true });
      fs.writeFileSync(recordPath, `${JSON.stringify(verdict.record, null, 2)}\n`);
    } catch (error) {
      console.error(`  REJECT — could not save provenance to ${recordPath}: ${error.message}`);
      console.error("  Pass --record with a writable file path, then run the preflight again.");
      return 1;
    }
    console.log(`  record    ${recordPath}`);
    console.log("  ACCEPT — evidence may be captured from this URL.");
  } else {
    console.log(`  REJECT (${verdict.reason}) — do not capture evidence from this URL.`);
  }
  console.log("\n  Evidence rules: docs/agents/visual-evidence.md\n");
  return verdict.accepted ? 0 : 1;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runPreflight(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(`Preflight failed unexpectedly: ${error?.stack ?? error}`);
      process.exit(1);
    });
}
