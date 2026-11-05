import { describe, expect, it } from "vitest";
import {
  PLAYTHROUGH_RUNNER_VERSION,
  defaultPlaythroughRecipe,
  playthroughRunId,
  playthroughSource,
  playthroughSourceDigest,
  playthroughSourceEntries,
} from "./playthrough";

// Engine provenance (stories 13, 36; issue #503): the fingerprint the
// record cites as source identity must move when engine content moves —
// including playthrough.ts's own bytes, which vite's importGlob excludes
// from a module's own glob matches in every path.
describe("engine source provenance", () => {
  it("carries the self file in the digest input", () => {
    // The regression this pins: the digest once hashed a file set that
    // silently lacked playthrough.ts itself, so self edits moved nothing.
    const paths = playthroughSourceEntries().map(([path]) => path);
    expect(paths).toContain("./playthrough.ts");
    const self = playthroughSourceEntries().find(([path]) => path === "./playthrough.ts")!;
    expect(self[1].length).toBeGreaterThan(0);
    // Every path beside its own bytes: no empty content entries.
    for (const [, content] of playthroughSourceEntries()) expect(content.length).toBeGreaterThan(0);
  });

  it("moves the digest when a scratch copy's content changes", () => {
    // The pinned sensitivity (issue #503): edit a scratch copy of the
    // exact hash input — no real engine file is touched — and the digest
    // must move. Both boundaries: another engine module, and
    // playthrough.ts itself, whose bytes vite's importGlob once dropped
    // from the set entirely.
    const entries = playthroughSourceEntries();
    const baseline = playthroughSourceDigest(entries);
    const edit = (target: string) =>
      entries.map(([path, content]) =>
        path === target ? [path, `${content}\n// scratch edit`] as const : [path, content] as const,
      );
    expect(playthroughSourceDigest(edit("./advance.ts"))).not.toBe(baseline);
    expect(playthroughSourceDigest(edit("./playthrough.ts"))).not.toBe(baseline);
  });

  it("moves the digest when the file set changes", () => {
    // The other historical mover: a new engine module joins the set.
    const entries = playthroughSourceEntries();
    const grown = [...entries, ["./scratch.ts", "// a new module"] as const];
    expect(playthroughSourceDigest(grown)).not.toBe(playthroughSourceDigest(entries));
  });

  it("hashes the live input, not a copy", () => {
    // The exported entries are the digest's real input: recomputing over
    // them reproduces the source's fingerprint exactly.
    expect(playthroughSourceDigest(playthroughSourceEntries())).toBe(playthroughSource().engineSource);
    expect(playthroughSource().engineSource).toMatch(/^[0-9a-f]{8}$/);
    expect(playthroughSource().runnerVersion).toBe(PLAYTHROUGH_RUNNER_VERSION);
  });

  it("identifies a changed source in the run id", () => {
    const recipe = defaultPlaythroughRecipe();
    const source = playthroughSource();
    expect(playthroughRunId(recipe, source))
      .not.toBe(playthroughRunId(recipe, { ...source, engineSource: "changed-engine" }));
  });
});
