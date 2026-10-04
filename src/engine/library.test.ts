import { describe, expect, it } from "vitest";
import { ARETE_HORIZON } from "./accumulator";
import { prestige } from "./actions";
import { NAMED_CHORDS } from "./constants";
import { wouldFormPreview } from "./chords";
import { computeRates } from "./economy";
import { fresh, give, sumSynthValues } from "./fixtures";
import { hex } from "./hex";
import { discoveryBoostOf, discoveryCount, syncChordDiscoveries } from "./library";
import { deserialize, serialize } from "./save";

// A formation recipe: oscillators (and the optional conducting spacers) at
// the cells whose pitches ring the named class rooted at C4. Cells walk the
// fifths axis (+7 semitones per +q), so a class's intervals land on the
// columns 7·q ≡ interval (mod 12); spacers bridge the gaps the voices
// leave. The opening board's own synth joins every formation from its
// origin cell — `roots` is the full set of (pattern, root) matches the
// formation must hear (symmetric classes ring several roots at once).
interface Recipe {
  name: string;
  voices: [number, number][];
  spacers?: [number, number][];
  roots: number[];
}

const RECIPES: Recipe[] = [
  { name: "Octave", voices: [[0, 1]], roots: [0] },
  { name: "Fifth", voices: [[1, 0]], roots: [0] },
  { name: "Flat seventh", voices: [[-2, 0]], spacers: [[-1, 0]], roots: [0] },
  { name: "Suspended fourth", voices: [[-1, 0], [1, 0]], roots: [0] },
  { name: "Minor triad", voices: [[1, 0], [-3, 0]], spacers: [[-1, 0], [-2, 0]], roots: [0] },
  {
    name: "Diminished triad",
    voices: [[-3, 0], [-6, 0]],
    spacers: [[-1, 0], [-2, 0], [-4, 0], [-5, 0]],
    roots: [0],
  },
  {
    name: "Augmented triad",
    voices: [[4, 0], [-4, 0]],
    spacers: [[1, 0], [2, 0], [3, 0], [-1, 0], [-2, 0], [-3, 0]],
    // The augmented triad is symmetric: one formation rings three roots.
    roots: [0, 4, 8],
  },
  { name: "Major triad", voices: [[1, 0], [4, 0]], spacers: [[2, 0], [3, 0]], roots: [0] },
  {
    name: "Minor seventh",
    voices: [[1, 0], [-3, 0], [-2, 0]],
    spacers: [[-1, 0]],
    roots: [0],
  },
  {
    name: "Dominant seventh",
    voices: [[1, 0], [4, 0], [-2, 0]],
    spacers: [[2, 0], [3, 0], [-1, 0]],
    roots: [0],
  },
  {
    name: "Major seventh",
    voices: [[1, 0], [4, 0], [5, 0]],
    spacers: [[2, 0], [3, 0]],
    roots: [0],
  },
];

function buildFormation(state: ReturnType<typeof fresh>, recipe: Recipe): void {
  for (const [q, r] of recipe.voices) give(state, "additive", hex(q, r));
  for (const [q, r] of recipe.spacers ?? []) give(state, "spacer", hex(q, r));
}

describe("chord discovery sync", () => {
  it.each(RECIPES.map((r) => [r.name, r] as const))("the first live %s names the class", (_name, recipe) => {
    const state = fresh();
    buildFormation(state, recipe);
    syncChordDiscoveries(state, { now: 5000 });
    // One formation often names several classes at once (overlapping
    // matches are the engine's design) — the class under test is among
    // them, named by its first live formation.
    expect(state.chordDiscovery[recipe.name]?.formed).toBe(true);
    const record = state.chordDiscovery[recipe.name]!;
    expect(record.firstFormedAt).toBe(5000);
    expect(record.rootsHeard).toBe(recipe.roots.length);
    expect([...record.roots].sort((a, b) => a - b)).toEqual(recipe.roots);
    // A second sync is idempotent: the stamp untouched.
    syncChordDiscoveries(state, { now: 6000 });
    expect(state.chordDiscovery[recipe.name]!.firstFormedAt).toBe(5000);
  });

  it("discovers every one of the eleven classes and counts the ledger", () => {
    expect(NAMED_CHORDS.length).toBe(11);
    const state = fresh();
    for (const recipe of RECIPES) {
      buildFormation(state, recipe);
      syncChordDiscoveries(state);
    }
    expect(discoveryCount(state)).toBe(11);
    expect(discoveryBoostOf(state)).toBeCloseTo(1.11, 10);
  });

  it("a silent voice's pitch completes a discovery", () => {
    const state = fresh();
    give(state, "harmonizer", hex(1, 0));
    syncChordDiscoveries(state);
    expect(state.chordDiscovery["Fifth"]?.formed).toBe(true);
  });

  it("chordless adjacency never discovers", () => {
    const state = fresh();
    // An adjacent Bend flattened a half-step: pitch classes 0 and 6 — a
    // tritone pair no class names. The voices touch; the content is
    // chordless, so nothing is ever heard.
    const bend = give(state, "bend", hex(1, 0));
    bend.shift = -1;
    syncChordDiscoveries(state);
    expect(state.chordDiscovery).toEqual({});
  });

  it("counts distinct roots heard, never formations", () => {
    const state = fresh();
    // Seed the Fifth so later boards' plain fifths never read as new.
    give(state, "additive", hex(1, 0));
    syncChordDiscoveries(state);
    // C-rooted major triad: voices at pitch classes 0, 4, 7.
    buildFormation(state, RECIPES.find((r) => r.name === "Major triad")!);
    syncChordDiscoveries(state);
    expect(state.chordDiscovery["Major triad"]!.rootsHeard).toBe(1);
    // Strike it and build a G-rooted one: voices at pitch classes 7, 11, 2.
    for (const module of state.modules) module.pos = null;
    give(state, "additive", hex(1, 0));
    give(state, "additive", hex(2, 0));
    give(state, "additive", hex(5, 0));
    give(state, "spacer", hex(3, 0));
    give(state, "spacer", hex(4, 0));
    syncChordDiscoveries(state);
    const record = state.chordDiscovery["Major triad"]!;
    expect(record.formed).toBe(true);
    expect(record.rootsHeard).toBe(2);
    expect([...record.roots].sort((a, b) => a - b)).toEqual([0, 7]);
  });

  it("would-form ghosts never discover", () => {
    const state = fresh();
    syncChordDiscoveries(state);
    // The tray's second synth would form a Fifth at (1, 0) — the preview
    // answers, and the ledger never hears it.
    const ghost = give(state, "additive", null);
    const preview = wouldFormPreview(state, ghost.id, hex(1, 0));
    expect(preview.chords.map((term) => term.name)).toContain("Fifth");
    expect(state.chordDiscovery).toEqual({});
  });

  it("prestige keeps the discovery like the feats ledger", () => {
    const state = fresh();
    give(state, "additive", hex(1, 0));
    syncChordDiscoveries(state);
    state.eraEarned = ARETE_HORIZON;
    expect(prestige(state).ok).toBe(true);
    expect(state.chordDiscovery["Fifth"]!.formed).toBe(true);
    expect(discoveryBoostOf(state)).toBeCloseTo(1.01, 10);
  });

  it("a page reload keeps the discovery, roots included", () => {
    const state = fresh();
    give(state, "additive", hex(1, 0));
    syncChordDiscoveries(state, { now: 1234 });
    const loaded = deserialize(serialize(state, 9999));
    expect(loaded.error).toBeUndefined();
    const record = loaded.state!.chordDiscovery["Fifth"]!;
    expect(record).toEqual({ formed: true, firstFormedAt: 1234, rootsHeard: 1, roots: [0] });
    expect(discoveryBoostOf(loaded.state!)).toBeCloseTo(1.01, 10);
  });

  it("a pre-roots entry lenient-defaults its root set, keeping the count", () => {
    const raw = {
      app: "flowsynth",
      version: 8,
      state: {
        mode: "upgrade",
        chordDiscovery: { "Major triad": { formed: true, firstFormedAt: 1000, rootsHeard: 2 } },
      },
    };
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.error).toBeUndefined();
    const record = loaded.state!.chordDiscovery["Major triad"]!;
    expect(record.formed).toBe(true);
    expect(record.rootsHeard).toBe(2);
    expect(record.roots).toEqual([]);
    // The carried count is the floor history owes, not a ceiling: every
    // root new to the set raises it by one.
    buildFormation(loaded.state!, RECIPES.find((r) => r.name === "Major triad")!);
    syncChordDiscoveries(loaded.state!);
    expect(loaded.state!.chordDiscovery["Major triad"]!.rootsHeard).toBe(3);
    expect(loaded.state!.chordDiscovery["Major triad"]!.roots).toEqual([0]);
  });
});

describe("discovery bonus in the rate", () => {
  it("rides every oscillator's final value and the snapshot's own leg", () => {
    const state = fresh();
    give(state, "additive", hex(1, 0));
    syncChordDiscoveries(state, { now: 100 });
    const snapshot = computeRates(state, false);
    expect(snapshot.discoveryBoost).toBeCloseTo(1.01, 10);
    // The displayed figures still sum to the board's rate.
    expect(sumSynthValues(snapshot)).toBeCloseTo(snapshot.rate, 6);
    const values = [...snapshot.contributions.values()].filter((c) => c.value > 0);
    expect(values.length).toBe(2);
    for (const contribution of values) {
      expect(contribution.value).toBeGreaterThan(0.1);
    }
    // The breakdown multiplies out exactly: rate = amplitude × empowerment ×
    // achievementBoost × discoveryBoost.
    expect(snapshot.amplitude * snapshot.empowerment * snapshot.achievementBoost * snapshot.discoveryBoost)
      .toBeCloseTo(snapshot.rate, 6);
  });
});
