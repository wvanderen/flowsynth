// The chord discovery library's engine half (#218, issue #230): discovery
// keys on the chord class alone — the first live formation of a class names
// it forever, its roots accumulating beneath. The would-form preview never
// discovers: the sync reads the live board's terms only, the same terms the
// rate pass sings. The ledger persists through prestige like the feats
// ledger (the v8 surface), and each discovered class adds a permanent
// +1% (tuning) into the rate as its own global leg beside the achievements
// boost. Detection is live: the sync runs at action boundaries and session
// ticks, exactly where the achievements' does.

import { analyzeChords } from "./chords";
import { BALANCE, NAMED_CHORDS } from "./constants";
import { deployedVoices } from "./economy";
import type { ChordDiscovery, GameState, NamedChordTerm } from "./types";

export interface DiscoverySyncOptions {
  // The wall-clock stamp a first formation records. Defaults to now, the
  // achievements' convention.
  now?: number;
  // A caller holding the live rate pass's terms passes them here — the
  // session tick syncs without recomputing the analysis. Absent, the sync
  // derives the terms from the deployed board itself.
  chords?: readonly NamedChordTerm[];
}

// The live board's named-chord terms — the one read the sync falls back to:
// the same partition the rate pass applies (only oscillators and silent
// voices sing; spacers conduct), so a silent voice's pitch completes a
// discovery and chordless adjacency never forms one.
function liveTerms(state: GameState): NamedChordTerm[] {
  const { singers, spacers } = deployedVoices(state);
  return analyzeChords(singers, spacers).namedChords;
}

// The ledger entry for a class, created on first write — the save's v8
// shape grown by wave 3's root set.
function recordFor(state: GameState, name: string): ChordDiscovery {
  let record = state.chordDiscovery[name];
  if (!record || typeof record.formed !== "boolean") {
    record = { formed: false, firstFormedAt: 0, rootsHeard: 0, roots: [] };
    state.chordDiscovery[name] = record;
  }
  return record;
}

// The one detection entry point (the achievements' pattern): evaluates the
// live formations against the ledger, flips `formed` with its stamp on
// first sight and accumulates the distinct roots. Each root new to the
// set raises the carried count by one — a migrated entry's pre-roots
// figure is the floor history owes, never a ceiling that absorbs the
// roots it can't name.
export function syncChordDiscoveries(state: GameState, options: DiscoverySyncOptions = {}): void {
  const now = options.now ?? Date.now();
  for (const term of options.chords ?? liveTerms(state)) {
    const def = NAMED_CHORDS.find((candidate) => candidate.name === term.name);
    if (!def) continue;
    const record = recordFor(state, term.name);
    if (!record.formed) {
      record.formed = true;
      record.firstFormedAt = now;
    }
    if (!record.roots.includes(term.root)) {
      record.roots.push(term.root);
      record.rootsHeard += 1;
    }
  }
}

// How many of the eleven classes the ledger names.
export function discoveryCount(state: GameState): number {
  let count = 0;
  for (const def of NAMED_CHORDS) {
    if (state.chordDiscovery[def.name]?.formed === true) count++;
  }
  return count;
}

// One class's roots-heard figure — the hairline's numerator, read through
// the engine that owns the ledger rather than reached into at every
// surface.
export function rootsHeardOf(state: GameState, name: string): number {
  return state.chordDiscovery[name]?.rootsHeard ?? 0;
}

// The single global term (the achievements boost's sibling): each
// discovered class adds BALANCE.discoveryBonusPerClass, additively,
// nous-rate only, permanent across prestige.
export function discoveryBoostOf(state: GameState): number {
  return 1 + discoveryCount(state) * BALANCE.discoveryBonusPerClass;
}
