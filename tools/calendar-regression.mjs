// Issue #505: the targeted calendar regression runner. The engine's calendar
// basis is the host's local calendar — goal occurrence days and playthrough
// schedule days both read it — so the calendar-sensitive regressions run
// under UTC and a DST-observing zone, the two bases the repository declares,
// and establish the intended behavior in each. Targeted by design: the two
// files below, twice — never a duplicated full suite. CI's ubuntu runner is
// UTC, so the DST leg is the one CI could not otherwise see; local hosts run
// the same command and get the same pair of verdicts regardless of where
// they sit.
//
//   npm run test:calendar
//
// Runs under the declared runtime through tools/run-supported.mjs.
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// The calendar-sensitive regressions: the engine's calendar-basis cases
// (zone-invariant by construction) and the goals suite, whose local-calendar
// accounting every case exercises through local-day-constructed stamps.
export const CALENDAR_TEST_FILES = ["src/engine/calendar.test.ts", "src/engine/goals.test.ts"];

// UTC — CI's basis — and a DST-observing zone, where a calendar day is 23 or
// 25 hours at the transitions the regressions cross.
export const CALENDAR_ZONES = ["UTC", "America/Chicago"];

function runZone(zone) {
  console.log(`\n=== calendar regressions under TZ=${zone} ===\n`);
  const result = spawnSync(process.execPath, [path.join(repoRoot, "node_modules/vitest/vitest.mjs"), "run", ...CALENDAR_TEST_FILES], {
    stdio: "inherit",
    cwd: repoRoot,
    env: { ...process.env, TZ: zone },
  });
  if (result.error) {
    console.error(`running vitest under TZ=${zone} failed: ${result.error.message}`);
    return false;
  }
  if (result.status !== 0) {
    console.error(`\ncalendar regressions failed under TZ=${zone}.`);
    return false;
  }
  return true;
}

export function main() {
  for (const zone of CALENDAR_ZONES) {
    if (!runZone(zone)) return 1;
  }
  console.log(`\ncalendar regressions passed under ${CALENDAR_ZONES.join(" and ")}.`);
  return 0;
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  process.exit(main());
}
