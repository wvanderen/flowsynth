import { BALANCE, NAMED_CHORDS } from "./constants";
import { adjacent, hexDistance } from "./hex";
import { ORIGIN } from "./state";
import type { ChordPairTerm, DeployedModule, NamedChordTerm } from "./types";

// Pitch is a synthesizer's harmonic number: hex distance from the Carrier
// plus one (ADR-0014). The Carrier is pinned at the origin, so pitch is pure
// distance — no relaying; the readout never lies. Cell purchases deepen
// achievable pitch by growing the board outward.
export function pitchOf(pos: { q: number; r: number }): number {
  return hexDistance(pos, ORIGIN) + 1;
}

// Free-floating connected clusters of adjacent synthesizers (direct adjacency
// at launch). The carrier sets every cell's pitch globally, but chords need
// no path back to it — deep chords are free-standing islands.
export function synthComponents(synths: DeployedModule[]): DeployedModule[][] {
  const remaining = [...synths];
  const components: DeployedModule[][] = [];
  while (remaining.length > 0) {
    const seed = remaining.pop()!;
    const component: DeployedModule[] = [seed];
    const frontier = [seed];
    while (frontier.length > 0) {
      const current = frontier.pop()!;
      for (let i = remaining.length - 1; i >= 0; i--) {
        const other = remaining[i]!;
        if (adjacent(current.pos, other.pos)) {
          remaining.splice(i, 1);
          component.push(other);
          frontier.push(other);
        }
      }
    }
    components.push(component);
  }
  return components;
}

function connectedVoices(voices: DeployedModule[]): boolean {
  const seen = new Set([voices[0]!.id]);
  const frontier = [voices[0]!];
  while (frontier.length > 0) {
    const current = frontier.pop()!;
    for (const other of voices) {
      if (seen.has(other.id)) continue;
      if (adjacent(current.pos, other.pos)) {
        seen.add(other.id);
        frontier.push(other);
      }
    }
  }
  return seen.size === voices.length;
}

// One recognition per named pattern per cluster: the first connected
// voice-set (one module per pattern pitch, deterministic by module id) wins.
// Overlapping patterns — a 4·5·6·7 run is both triads — match separately and
// stack multiplicatively downstream. Extra voices at a chord's pitches stay
// amplitude, not a second bonus: identical pitches add amplitude, no chord.
function recognizeChords(component: DeployedModule[]): NamedChordTerm[] {
  const matches: NamedChordTerm[] = [];
  for (const def of NAMED_CHORDS) {
    const groups = def.pitches.map((pitch) =>
      component.filter((m) => pitchOf(m.pos) === pitch).sort((a, b) => a.id.localeCompare(b.id)),
    );
    if (groups.some((group) => group.length === 0)) continue;
    const combinations = groups.reduce((total, group) => total * group.length, 1);
    for (let n = 0; n < combinations; n++) {
      let rest = n;
      const voices = groups.map((group) => {
        const chosen = group[rest % group.length]!;
        rest = Math.floor(rest / group.length);
        return chosen;
      });
      if (connectedVoices(voices)) {
        matches.push({ name: def.name, pitches: [...def.pitches], bonus: def.bonus, moduleIds: voices.map((v) => v.id) });
        break;
      }
    }
  }
  return matches;
}

export interface ChordAnalysis {
  pairs: ChordPairTerm[];
  namedChords: NamedChordTerm[];
  multiplier: number;
  // Chord terms each module participates in: surviving pairs containing it
  // plus named chords whose voices include it. The Conditional's bonus counts
  // these; a named chord counts once however many of its member pairs the
  // module shares in.
  participation: Map<string, number>;
}

// The chord pass over the deployed synthesizers: adjacent synthesizers one
// pitch apart form raw pair terms (identical pitches only stack amplitude —
// no chord); each named chord replaces the pair terms of its member pairs —
// the voices it actually sings through — while pairs outside any named chord
// keep the anonymous bonus (#29). Bonus-only: no dissonance penalties, and
// the board's finite cell budget is the only cap.
export function analyzeChords(synths: DeployedModule[]): ChordAnalysis {
  const pairs: ChordPairTerm[] = [];
  const namedChords: NamedChordTerm[] = [];
  for (const component of synthComponents(synths)) {
    const named = recognizeChords(component);
    namedChords.push(...named);
    for (let i = 0; i < component.length; i++) {
      for (let j = i + 1; j < component.length; j++) {
        const a = component[i]!;
        const b = component[j]!;
        if (!adjacent(a.pos, b.pos)) continue;
        const pa = pitchOf(a.pos);
        const pb = pitchOf(b.pos);
        if (Math.abs(pa - pb) !== 1) continue;
        // A named chord replaces its member pairs' bonuses only: a pair both
        // of whose modules sing in it. Pairs outside any named chord —
        // including doubled voices at a chord's pitches — keep the anonymous
        // bonus (#29).
        if (named.some((chord) => chord.moduleIds.includes(a.id) && chord.moduleIds.includes(b.id))) continue;
        pairs.push({ a: a.id, b: b.id, bonus: BALANCE.pairBonus });
      }
    }
  }
  const participation = new Map<string, number>();
  for (const pair of pairs) {
    participation.set(pair.a, (participation.get(pair.a) ?? 0) + 1);
    participation.set(pair.b, (participation.get(pair.b) ?? 0) + 1);
  }
  for (const chord of namedChords) {
    for (const id of chord.moduleIds) {
      participation.set(id, (participation.get(id) ?? 0) + 1);
    }
  }
  const multiplier =
    pairs.reduce((acc, pair) => acc * (1 + pair.bonus), 1) *
    namedChords.reduce((acc, chord) => acc * (1 + chord.bonus), 1);
  return { pairs, namedChords, multiplier, participation };
}
