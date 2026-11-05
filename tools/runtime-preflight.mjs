// Issue #505: the runtime preflight — the cheap gate an incompatible
// environment must fail before an agent spends time on checks or evidence.
// It reports the declared and effective Node runtime (the one declaration,
// .node-version, which CI installs and the version managers read), the
// host's timezone — gameplay's goal and schedule days follow the host's
// local calendar, so the basis is declared here, never silently assumed —
// and the storage capability the UI harness requires (happy-dom's
// localStorage, probed the way the fixtures use it). Every rejection exits 1
// with the fix in its output. Development-only: never part of a production
// build.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { checkRuntimeEnvironment, DECLARATION_FILE, declaredRuntimeVersion, probeStorageCapability } from "./dev/runtime.mjs";

const USAGE = "Usage: node tools/runtime-preflight.mjs [--root <checkout-dir>]";

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--root") flags.root = argv[(i += 1)];
    else return { error: `Unknown argument: ${flag}\n${USAGE}` };
  }
  return { flags };
}

function utcOffsetLabel(minutes) {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const mins = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hours}:${mins}`;
}

export async function runPreflight(argv) {
  const parsed = parseFlags(argv);
  if (parsed.error) {
    console.error(parsed.error);
    return 1;
  }
  const root = path.resolve(parsed.flags.root ?? process.cwd());

  console.log("\nFlowSynth runtime preflight\n");
  const storage = await probeStorageCapability();
  const report = checkRuntimeEnvironment({ root, storage });

  const declaredLabel = report.declared === null
    ? `missing (${DECLARATION_FILE} not found)`
    : `${report.declared} (${DECLARATION_FILE})`;
  console.log(`  declared   ${declaredLabel}`);
  console.log(`  effective  ${report.effective}`);
  console.log(`  timezone   ${report.timeZone} (${utcOffsetLabel(report.utcOffsetMinutes)})`);
  console.log(`  storage    ${report.storage.ok ? "ok" : "unavailable"} — ${report.storage.detail}`);
  // The calendar basis is a declaration, not a discovery: the engine's goal
  // and schedule days follow the host's local calendar, so this zone is what
  // gameplay reads. Calendar-sensitive regressions run under UTC and a
  // DST-observing zone via `npm run test:calendar`.
  console.log("  calendar   the host's local calendar — goal days and schedule days follow this zone");
  console.log("");

  if (report.ok) {
    console.log("  ACCEPT — runtime, calendar zone, and UI storage are ready for checks and evidence.\n");
    return 0;
  }
  console.log(`  REJECT (${report.reason}) — fix the environment before running checks or recording evidence.`);
  for (const line of report.diagnostics.flatMap((block) => block.split("\n"))) {
    console.log(`  ${line}`);
  }
  console.log("");
  return 1;
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
