// Issue #457: the recovery health check for a stalled evidence pass. A pass
// that dies mid-capture (a snapshot timeout, a resize that never lands, a
// hidden tab, a server that stopped answering) must not end the verification:
// run this first, learn which of the four failure classes the pass is in,
// and apply that class's bounded recovery. The server/provenance side is
// checked here for real — the exact URL, the same way the capture preflight
// reads it — and the browser side is printed as precise checks the agent's
// browser tooling runs, with the pass/fail observable, the failure class it
// maps to, and the retry budget. Every class ends one of two ways: recovery
// resumes the pass (re-preflight, confirm the viewport, capture on), or the
// budget is exhausted and the raw failure, the recovery attempts, and the
// exact unavailable checks are recorded — never claimed as verified.
// The one authoritative recovery workflow: docs/agents/visual-evidence.md §5.
// Development-only: never part of a production build.
import { pathToFileURL } from "node:url";
import { verifyCaptureProvenance, fetchProvenance, expectedCheckout } from "./dev/provenance.mjs";

const USAGE =
  "Usage: node tools/evidence-healthcheck.mjs --url <server-url> [--viewport <WxH>] [--worktree <dir>]";
const WORKFLOW = "docs/agents/visual-evidence.md §5";

// The four failure classes a stalled pass can be in, in check order.
export const SERVER = "server-provenance";
export const VISIBILITY = "browser-visibility";
export const SNAPSHOT = "browser-snapshot";
export const VIEWPORT = "browser-viewport";

export const RETRY_BUDGET =
  "At most three attempts per browser operation — the first failure plus two recoveries — with the class's recovery action between attempts. Three failed attempts is the whole budget; exhausting it ends recovery for this pass. Record, don't retry.";

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--url") flags.url = argv[(i += 1)];
    else if (flag === "--viewport") flags.viewport = argv[(i += 1)];
    else if (flag === "--worktree") flags.worktree = argv[(i += 1)];
    else return { error: `Unknown argument: ${flag}\n${USAGE}` };
  }
  return { flags };
}

export function parseViewport(spec) {
  if (spec === undefined) return null;
  const match = /^(\d{2,4})x(\d{2,4})$/.exec(spec);
  if (!match) return { error: `--viewport must be <WxH>, e.g. 390x844 (got "${spec}").` };
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width < 240 || width > 3840 || height < 240 || height > 3840) {
    return { error: `--viewport is outside the browser's supported range 240–3840 (got ${spec}).` };
  }
  return { width, height };
}

// A preflight rejection is always class server-provenance; the reason is the
// detail the record carries.
export function classifyServerFailure(reason) {
  return `${SERVER} (${reason})`;
}

// One bounded recovery per failure class: what the failure looks like, the
// exact recovery steps, the class's slice of the retry budget, what a
// successful recovery must confirm before the pass resumes, and exactly what
// gets recorded when the budget is exhausted.
export function recoveryPlan(failureClass, viewport) {
  const target = viewport ? `${viewport.width}×${viewport.height}` : "the capture viewport (pass --viewport WxH to pin it)";
  switch (failureClass) {
    case SERVER:
      return {
        cls: SERVER,
        observed: [
          "The capture preflight rejects the URL, or the server stops answering between captures:",
          "unreachable, non-JSON, HTTP-not-ok, foreign-worktree, commit-mismatch, dirty-source.",
        ],
        recovery: [
          "Relaunch `npm run dev` in this worktree and note the URL it prints.",
          "If the port changed, repoint the tab at the new URL — never capture from a stale tab.",
          "Re-run the capture preflight (tools/evidence-preflight.mjs) against the URL before any capture. The preflight is the acceptance gate; this health check is diagnostic.",
        ],
        budget: "The budget is one relaunch, then re-check; a provenance failure that survives its relaunch ends recovery for this pass.",
        exhausted: [
          "Record the pass blocked: the raw preflight rejection (class + reason, verbatim), the relaunch attempt and its outcome,",
          "and that every browser check and capture on this URL is unavailable. Nothing from this pass may be claimed as verified.",
        ],
      };
    case VISIBILITY:
      return {
        cls: VISIBILITY,
        observed: [
          "preview_status reports unavailable, loading forever, a pending dialog, or a url that is not the verified URL.",
          "A false visible flag alone is not a failure: this harness can report it for its sole current tab.",
        ],
        recovery: [
          "Activate the tab with preview_open({ tabId, open: true }), then read preview_status on that same tabId.",
          "Confirm available, not loading, no dialog, url equal to the verified URL. If the URL is wrong, navigate the same tab to the verified URL before rechecking.",
          "When visible stays false despite activation, record visibility confirmation unavailable; use those status observables and a successful preview_snapshot on the same tab to confirm capture readiness, not visibility.",
          "If ready status is followed by a failed confirmation snapshot, use browser-snapshot recovery and count it as attempt one; changing class never resets an operation's retry budget.",
          "If the status shows a dialog, answer or dismiss it before anything else.",
        ],
        budget: "The budget is at most two activation attempts, each confirmed by preview_status; a tab that fails capture readiness after both ends recovery for the capture checks.",
        exhausted: [
          "Record the affected snapshot and capture checks unavailable: the raw status output showing the tab unavailable, loading, wrong, or dialog-bound,",
          "and both activation attempts in order. Do not substitute click/evaluate results for the missing captures.",
        ],
      };
    case SNAPSHOT:
      return {
        cls: SNAPSHOT,
        observed: [
          "preview_snapshot times out or errors while the server is verified and preview_status reports an available, loaded, dialog-free tab",
          "on the verified URL (issue #456's pass: snapshots hung on two tabs while evaluate and clicks kept working).",
        ],
        recovery: [
          "Read preview_status once — it classifies visibility and often revives the pipeline — then retry the same snapshot.",
          "Never retry a different capture instead: the record must name the check that failed.",
        ],
        budget: RETRY_BUDGET,
        exhausted: [
          "Record every capture that needed a screenshot unavailable: each snapshot attempt's raw failure message,",
          "the preview_status/activation steps between attempts, and which captures exist only as unavailable.",
          "Seeding or assertions that still ran via evaluate are named as run, never as captures.",
        ],
      };
    case VIEWPORT:
      return {
        cls: VIEWPORT,
        observed: [
          `preview_resize to ${target} times out ("Preview automation resize timed out"), or the page's live size differs from`,
          "the target — the pass would capture at the wrong viewport and mislabel it.",
        ],
        recovery: [
          "After a timeout, call preview_status once (it often revives the viewport), then retry the same resize at most once more.",
          `Confirm the live size with an in-page read (window.innerWidth / window.innerHeight) — the resize's own echo and the status read's viewportSetting can both be stale.`,
          "Get resizing done before captures, not during: after a resize lands, batch that viewport's whole capture pass before resizing again.",
        ],
        budget: `Three failed attempts is the whole budget — the first plus the two recoveries above; beyond that, the ${target} viewport pass is unavailable.`,
        exhausted: [
          `Record that viewport's captures unavailable, e.g. "phone ${target} unavailable: preview_resize timed out ×3",`,
          "with the reads between attempts. The other viewport's captures stand on their own evidence.",
        ],
      };
    default:
      throw new Error(`Unknown failure class: ${failureClass}`);
  }
}

// The resume rule every successful recovery passes through before the pass
// may claim anything again.
export function resumeSteps(viewport) {
  const target = viewport ? `${viewport.width}×${viewport.height}` : "the exact expected viewport";
  return [
    "Re-run the capture preflight against the exact URL before capturing — recovery keeps the same checkout and URL; if the port changed, preflight the new URL instead.",
    `Confirm capture readiness (preview_status: available, not loading, no dialog, verified URL; successful same-tab snapshot when visible is unreliable) and that the page is actually at ${target}: a resize's own success is not a confirmation (its response can echo a stale size, and preview_status carries the requested setting), so read the live size in the page — window.innerWidth / window.innerHeight — when the status read shows only the setting. Then resume the pass at the same URL.`,
  ];
}

function planLines(plan, prefix = "  ") {
  const lines = [];
  lines.push(`${prefix}Looks like:`);
  for (const line of plan.observed) lines.push(`${prefix}  ${line}`);
  lines.push(`${prefix}Recovery (bounded):`);
  plan.recovery.forEach((step, i) => lines.push(`${prefix}  ${i + 1}. ${step}`));
  lines.push(`${prefix}Budget: ${plan.budget}`);
  lines.push(`${prefix}If the budget is exhausted, record:`);
  for (const line of plan.exhausted) lines.push(`${prefix}  ${line}`);
  return lines;
}

// The browser-side half of the check, printed when the server side is
// verified: precise tool calls with the observable that passes and the
// failure class each failure maps to, so a stalled pass classifies in one
// read and recovery starts immediately.
export function browserChecks(viewport) {
  const target = viewport ? `${viewport.width}×${viewport.height}` : "(your capture viewport — e.g. run with --viewport 390x844 to pin it)";
  return [
    "Browser checks — run against the stalled tab, in this order. Each maps to one failure class and one bounded recovery.",
    "",
    "  1. Visible tab — preview_status",
    "     pass: preview_status reports available, not loading, no dialog, and its url matches the verified URL above. A false visible flag alone is not a failure; after activation, a successful same-tab snapshot confirms capture readiness while visibility confirmation remains unavailable.",
    `     fail → ${VISIBILITY}: unavailable or perpetually loading tab, pending dialog, or a url that is not the verified one.`,
    "",
    "  2. Snapshot — preview_snapshot",
    "     pass: a snapshot returns (image and page state).",
    `     fail → ${SNAPSHOT}: timeout or error while check 1 passes.`,
    "",
    `  3. Viewport — preview_resize to ${target}, then confirm the page's live size`,
    "     pass: the resize returns and a page read (window.innerWidth / window.innerHeight) reports exactly the target size — the resize's own echo and the status read's viewportSetting can both be stale.",
    `     fail → ${VIEWPORT}: timeout, or a page read that differs from the target.`,
  ];
}

function printPlan(title, plan) {
  console.log(`  ${title}`);
  for (const line of planLines(plan)) console.log(line);
}

export async function runHealthcheck(argv) {
  const parsed = parseFlags(argv);
  if (parsed.error || !parsed.flags?.url) {
    console.error(parsed.error ?? `--url is required.\n${USAGE}`);
    return 1;
  }
  const { url, worktree, viewport: viewportSpec } = parsed.flags;
  const viewport = parseViewport(viewportSpec);
  if (viewport?.error) {
    console.error(viewport.error);
    return 1;
  }

  console.log("\nFlowSynth evidence health check\n");
  console.log(`  url       ${url}`);

  const expected = expectedCheckout(worktree);
  if (expected.error) {
    console.log("  worktree  (unknown)");
    console.log(`\n  ${expected.error}`);
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

  if (!verdict.accepted) {
    const cls = classifyServerFailure(verdict.reason);
    console.log(`  server    FAIL — ${cls}`);
    for (const line of verdict.diagnostics) console.log(`  ${line}`);
    console.log("");
    printPlan(`Recovery for ${cls}`, recoveryPlan(SERVER, viewport));
    console.log("");
    console.log(`  Recovery rules: ${WORKFLOW}\n`);
    return 1;
  }

  console.log(`  server    OK — provenance verified for this checkout at commit ${verdict.record.commit.slice(0, 8)}, clean source.`);
  console.log("");
  for (const line of browserChecks(viewport)) console.log(line);
  console.log("");
  console.log(`  Budget: ${RETRY_BUDGET}`);
  console.log("");
  console.log("  After any successful recovery, before the pass claims anything again:");
  resumeSteps(viewport).forEach((step, i) => console.log(`  ${i + 1}. ${step}`));
  console.log("");
  console.log(`  Recovery rules: ${WORKFLOW}\n`);
  return 0;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runHealthcheck(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(`Health check failed unexpectedly: ${error?.stack ?? error}`);
      process.exit(1);
    });
}
