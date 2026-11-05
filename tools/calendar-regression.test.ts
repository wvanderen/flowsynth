import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CALENDAR_TEST_FILES, CALENDAR_ZONES } from "./calendar-regression.mjs";

// The calendar regression runner's contract (issue #505): the
// calendar-sensitive regressions run under UTC and a DST-observing zone —
// the two calendar bases the repository declares — as a targeted set, never
// a duplicated full suite. These checks pin the targeting: the file set
// stays narrow and present, and the zone pair stays {UTC, a DST zone}.

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

describe("the calendar regression runner (issue #505)", () => {
  it("targets a narrow set of existing calendar-sensitive files", () => {
    // Targeted: goals' local-calendar primitives and the engine's own
    // calendar cases. No UI files, no whole-suite duplication.
    expect(CALENDAR_TEST_FILES).toEqual(["src/engine/calendar.test.ts", "src/engine/goals.test.ts"]);
    for (const file of CALENDAR_TEST_FILES) {
      expect(existsSync(path.join(repoRoot, file)), `${file} exists`).toBe(true);
    }
  });

  it("runs under UTC and a DST-observing zone", () => {
    expect(CALENDAR_ZONES[0]).toBe("UTC");
    const dstZone = CALENDAR_ZONES[1];
    expect(dstZone).not.toBe("UTC");
    // A resolvable IANA zone that really observes DST: its 2026 summer and
    // winter offsets must differ.
    const format = (at: number) =>
      new Intl.DateTimeFormat("en-US", { timeZone: dstZone, timeZoneName: "longOffset" })
        .formatToParts(new Date(at)).find((part) => part.type === "timeZoneName")?.value;
    const summer = format(Date.UTC(2026, 6, 15));
    const winter = format(Date.UTC(2026, 0, 15));
    expect(summer).not.toBeNull();
    expect(summer).not.toBe(winter);
  });
});
