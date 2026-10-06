import { describe, expect, it } from "vitest";
import { syncAchievements } from "./achievements";
import { analyzeChords } from "./chords";
import { allocateRates, computeRates, deployedVoices, syncAllocation } from "./economy";
import { fresh, give, sumSynthValues } from "./fixtures";
import { hex } from "./hex";
import { discoveryCount, syncChordDiscoveries } from "./library";
import { recognizedTermsOf } from "./allocation";
import { deserialize, serialize } from "./save";
import { createInitialState } from "./state";
import type { GameState, ModuleInstance } from "./types";

// The live one-capacity economy (issue #258, carrying the confirmed
// harmonic-capacity design): every voice opens with capacity one and the
// board earns from the selected whole chords only — active instances alone
// populate the bonus terms, recognized-but-inactive chords still count as
// discoveries, and the authoritative allocation rides the real rate pass.
// The development gate is explicit (ADR-0052): the ordinary economy's
// prices and horizon stay untouched pending calibration.

// The board suites' convention: the fifths axis — +7 semitones per +q,
// +12 per row, so a recipe's classes land on the columns 7·q ≡ interval
// (mod 12). `placed` pushes the cell it needs, so recipes stay
// declarative.
function placed(state: GameState, type: ModuleInstance["type"], q: number, r = 0, level = 0): ModuleInstance {
  if (!state.cells.some((c) => c.q === q && c.r === r)) state.cells.push(hex(q, r));
  return give(state, type, hex(q, r), level);
}

function activeOf(state: GameState) {
  return allocateRates(state, true).snapshot.allocation!;
}
void activeOf;

describe("one-capacity voices (#258)", () => {
  it("every singing module opens at capacity one, rarity never altering it", () => {
    const state = fresh();
    placed(state, "additive", 1, 0);
    const rare = placed(state, "additive", -2, 0);
    rare.rarity = "rare";
    placed(state, "spacer", -1, 0);
    const { snapshot, read } = allocateRates(state, true);
    expect(snapshot.allocation?.capacity).toBe(1);
    for (const used of read.used.values()) expect(used).toBeLessThanOrEqual(1);
    // Spacers conduct but never consume: no spacer id rides the used map.
    for (const module of state.modules.filter((m) => m.type === "spacer")) {
      expect(read.used.has(module.id)).toBe(false);
    }
  });

  it("a shared silent voice cannot serve two chords at capacity one", () => {
    const state = fresh();
    // C4 · G4 · D5 with a Harmonizer on G: the silent voice sings in
    // several recognized candidates (the G-Octave and the root-G sus
    // fourth's second seat), but its one unit — like every voice's — can
    // only ever land in one active instance.
    placed(state, "additive", 1, 0);
    placed(state, "additive", 2, 0);
    const harmonizer = placed(state, "harmonizer", 1, 1);
    const { snapshot, read } = allocateRates(state, true);
    expect(snapshot.allocation?.capacity).toBe(1);
    for (const used of read.used.values()) expect(used).toBeLessThanOrEqual(1);
    // The sharing is real: at least two recognized candidates want the
    // harmonizer — and no active instance overlaps another.
    const wanting = read.recognizedInstances.filter((instance) => instance.memberIds.includes(harmonizer.id));
    expect(wanting.length).toBeGreaterThanOrEqual(2);
    const spent = new Map<string, number>();
    for (const instance of snapshot.allocation!.active) {
      for (const id of instance.memberIds) {
        expect(spent.get(id) ?? 0).toBe(0);
        spent.set(id, 1);
      }
    }
    expect(read.used.get(harmonizer.id)!).toBeLessThanOrEqual(1);
  });

  it("only active instances populate the bonus terms; recognized idles stay discoveries", () => {
    const state = fresh();
    // C4 with a doubled G: two equal Fifths are recognized, one earns, the
    // other stays an idle candidate — in the read, never in the terms.
    placed(state, "additive", 1, 0);
    placed(state, "additive", 1, 1);
    const { snapshot, read } = allocateRates(state, true);
    const allocation = snapshot.allocation!;
    expect(allocation.active.length).toBe(1);
    const idle = allocation.recognized.filter((instance) => !allocation.activeKeys.has(instance.key));
    expect(idle.length).toBeGreaterThanOrEqual(1);
    for (const instance of idle) {
      expect(
        snapshot.namedChords.some(
          (term) => term.name === instance.name && term.root === instance.root && term.moduleIds.join() === instance.memberIds.join(),
        ),
      ).toBe(false);
    }
    // Recognition parity: the allocator's recognized set is exactly the
    // plain recognizer's (name, root) pairs — the discovery read never
    // narrows with activation.
    const { singers, spacers } = deployedVoices(state);
    const uncapped = new Set(analyzeChords(singers, spacers).namedChords.map((t) => `${t.name}|${t.root}`));
    const recognized = new Set(read.recognizedInstances.map((i) => `${i.name}|${i.root}`));
    expect([...recognized].sort()).toEqual([...uncapped].sort());
    // And the ledger hears the idle candidate: the sync takes the
    // allocated read's terms, active or not.
    syncChordDiscoveries(state, { chords: recognizedTermsOf(read) });
    expect(discoveryCount(state)).toBeGreaterThan(0);
    expect(state.chordDiscovery[idle[0]!.name]?.formed).toBe(true);
  });

  it("duplicate voices split into complete sets the budget can afford", () => {
    const state = fresh();
    placed(state, "additive", 1, 0);
    placed(state, "additive", 1, 1);
    const { snapshot, read } = allocateRates(state, true);
    const fifths = snapshot.allocation!.active.filter((instance) => instance.name === "Fifth");
    expect(fifths.length).toBe(1);
    // The opening C4 spends its one unit; the idle G sits at ×1.
    expect(read.used.get(state.modules[0]!.id)).toBe(1);
    const busy = new Set(fifths[0]!.memberIds);
    for (const module of state.modules.filter((m) => m.type === "additive")) {
      if (!busy.has(module.id)) {
        expect(snapshot.contributions.get(module.id)?.chordFactor).toBe(1);
      }
    }
  });

  it("chordless voices keep chord factor exactly one", () => {
    const state = fresh();
    placed(state, "additive", 1, 0); // a lone G — no chord in earshot
    const lonely = placed(state, "additive", -3, 5); // disconnected, chordless
    const { snapshot } = allocateRates(state, true);
    const contribution = snapshot.contributions.get(lonely.id)!;
    expect(contribution.chordFactor).toBe(1);
    expect(contribution.formationQ).toBe(1);
    expect(contribution.chordTerms).toBe(0);
  });

  it("reselection rides charge, upgrades, and placement through the same pass", () => {
    const state = fresh();
    const c = state.modules[0]!; // the opening C4
    c.level = 1;
    placed(state, "additive", 1, 0);
    const generator = placed(state, "focusKeyed", -1, 0, 1);
    generator.reserve = 3600;
    const before = allocateRates(state, true);
    expect(before.snapshot.allocation!.active.map((i) => i.name)).toEqual(["Fifth"]);
    expect(before.snapshot.contributions.get(c.id)!.chordFactor).toBeGreaterThan(1);
    // Upgrades move the weights; the allocation recomputes against them.
    c.level = 5;
    const upgraded = syncAllocation(state, true);
    expect(upgraded.snapshot.allocation!.active.map((i) => i.name)).toEqual(["Fifth"]);
    expect(state.activeChords).toEqual(upgraded.read.instances.map((i) => i.key));
    // Placement: drop the G and the Fifth can't form — the empty
    // allocation is the honest answer, the C voice back at ×1.
    const g = state.modules.find((m) => m.pos !== null && m.pos.q === 1 && m.pos.r === 0)!;
    g.pos = null;
    const after = allocateRates(state, true);
    expect(after.snapshot.allocation!.active.length).toBe(0);
    expect(after.snapshot.contributions.get(c.id)!.chordFactor).toBe(1);
  });

  it("charge alone reselects the active chord", () => {
    const state = fresh();
    // C4 shared by two candidates: the Fifth (with a loud G4) and the ♭7
    // (with a quiet B♭). Uncharged the Fifth earns more even counting the
    // voice each leaves idle; a charged generator beside B♭ alone lifts
    // the ♭7's spend past it and takes the shared voice's one unit.
    placed(state, "additive", 1, 0, 4);
    placed(state, "additive", -2, 0);
    placed(state, "spacer", -1, 0);
    const generator = placed(state, "focusKeyed", -3, 0, 2);
    generator.reserve = 0;
    const uncharged = allocateRates(state, true);
    expect(uncharged.snapshot.allocation!.active.map((i) => i.name)).toEqual(["Fifth"]);
    generator.reserve = 3600;
    const charged = allocateRates(state, true);
    expect(charged.snapshot.allocation!.active.map((i) => i.name)).toEqual(["Flat seventh"]);
    const bflat = state.modules.find((m) => m.pos !== null && m.pos.q === -2 && m.pos.r === 0)!;
    expect(charged.snapshot.contributions.get(bflat.id)!.chargeFactor).toBeGreaterThan(1);
  });

  it("equal-output allocations retain the state's active set across syncs and reload", () => {
    const state = fresh();
    // C4 with a doubled G: the two Fifths are exactly equal in output, so
    // the retention hint — not the solver's lex fallback — must decide.
    placed(state, "additive", 1, 0);
    const kept = placed(state, "additive", 1, 1);
    const wanted = `Fifth|0|${state.modules[0]!.id},${kept.id}`;
    state.activeChords = [wanted];
    const first = syncAllocation(state, true);
    expect(first.read.instances.map((instance) => instance.key)).toEqual([wanted]);
    // The sync writes the hint back; the next sync — and a save/reload —
    // hold the same set.
    expect(state.activeChords).toEqual([wanted]);
    const reloaded = deserialize(serialize(state)).state!;
    expect(reloaded.activeChords).toEqual([wanted]);
    const again = syncAllocation(reloaded, true);
    expect(again.read.instances.map((instance) => instance.key)).toEqual([wanted]);
  });

  it("saves load compatible defaults and keep the allocation deterministic", () => {
    const state = fresh();
    placed(state, "additive", 1, 0);
    const { snapshot } = syncAllocation(state, true);
    const rate = snapshot.rate;
    const text = serialize(state);
    // A pre-capacity save carries no hint field: lenient-default, with
    // board inventory, placement, and the life record untouched.
    const raw = JSON.parse(text) as { state: Record<string, unknown> };
    delete raw.state.activeChords;
    const legacy = deserialize(JSON.stringify(raw)).state!;
    expect(legacy.activeChords).toEqual([]);
    expect(legacy.modules.length).toBe(state.modules.length);
    expect(legacy.nous).toBe(state.nous);
    expect(legacy.totalEarned).toBe(state.totalEarned);
    // The allocation recomputes to the same answer, deterministically.
    const loaded = deserialize(text).state!;
    expect(syncAllocation(loaded, true).snapshot.rate).toBe(rate);
  });

  it("the allocated contributions sum to the board's production", () => {
    const state = fresh();
    placed(state, "additive", 1, 0);
    placed(state, "additive", 4, 0);
    placed(state, "spacer", 2, 0);
    placed(state, "spacer", 3, 0);
    placed(state, "infusor", 0, 1);
    const { snapshot } = syncAllocation(state, true);
    expect(sumSynthValues(snapshot)).toBeCloseTo(snapshot.rate, 6);
  });

  it("the empty allocation wins when activation would reduce production", () => {
    const state = fresh();
    // A chromatic C · D♭ · D · E♭ cluster (spacers conduct the fifths-axis
    // gaps): tension prices the formation at the Q floor, and the Octave's
    // 1.15 × 0.5 buys less than the voices' idle value — so nothing
    // activates, while the recognized sets still reach the ledger.
    placed(state, "additive", 0, 1); // the second C — the opening already sits at the origin
    placed(state, "additive", 7, 0);
    placed(state, "additive", 2, 0);
    placed(state, "additive", 9, 0);
    for (const q of [1, 3, 4, 5, 6, 8]) placed(state, "spacer", q, 0);
    const { snapshot, read } = allocateRates(state, true);
    expect(snapshot.allocation!.active.length).toBe(0);
    expect(read.recognized).toBeGreaterThan(0);
    for (const module of state.modules.filter((m) => m.type === "additive")) {
      expect(snapshot.contributions.get(module.id)?.chordFactor).toBe(1);
    }
    // Recognition without activation is still a discovery.
    syncChordDiscoveries(state, { chords: recognizedTermsOf(read) });
    expect(discoveryCount(state)).toBeGreaterThan(0);
  });

  it("the feats read the factor actually earned, not the uncapped stack", () => {
    const state = fresh();
    placed(state, "additive", 1, 0);
    placed(state, "additive", 2, 0);
    placed(state, "additive", 2, 1);
    state.sessionsCompleted = 1;
    const { read } = allocateRates(state, true);
    const earned = Math.max(...read.analysis.voiceMultiplier.values());
    // The uncapped recognizer stacks every candidate at once; capacity one
    // affords strictly less, and the sync carries the earned figure.
    const { singers, spacers } = deployedVoices(state);
    const uncapped = Math.max(0, ...analyzeChords(singers, spacers).voiceMultiplier.values());
    expect(earned).toBeLessThan(uncapped);
    const unlocked = syncAchievements(state, { maxChordFactor: earned });
    expect(unlocked.map((def) => def.id)).not.toContain("power-chord");
  });

  it("the plain recognizer pass stays available and carries no allocation summary", () => {
    const state = fresh();
    placed(state, "additive", 1, 0);
    const plain = computeRates(state, true);
    expect(plain.allocation).toBeUndefined();
    expect(plain.namedChords.length).toBeGreaterThan(0);
    // The fresh opening board allocates through the same seam.
    const opening = createInitialState();
    expect(syncAllocation(opening, true).snapshot.rate).toBeGreaterThan(0);
  });
});
