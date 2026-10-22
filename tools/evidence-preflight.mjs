// Issue #454: the capture preflight — the one gate visual evidence must pass.
// It asks the exact URL a tab will be screenshotted for its provenance,
// verifies the served worktree and commit against the checkout it runs in,
// and refuses evidence from uncommitted source — tracked changes and
// non-ignored untracked files alike, evidence outputs exempt. Every rejection
// exits 1 with the fix in its output; acceptance records the verified
// provenance with --record (default: docs/evidence/preflight/provenance.json).
// Development-only: never part of a production build.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { verifyCaptureProvenance, fetchProvenance, expectedCheckout } from "./dev/provenance.mjs";

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
