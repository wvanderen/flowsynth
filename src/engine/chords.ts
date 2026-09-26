import { NAMED_CHORDS } from "./constants";
import { adjacent } from "./hex";
import { pitchClassOf } from "./lattice";
import type { DeployedModule, NamedChordTerm } from "./types";

// The chord model (ADR-0021/0022): chords are register-free pitch sets —
// a named pattern is recognized by pitch content over a connected cluster
// of synthesizers, any voicing, any octave. Adjacency alone is chordless:
// there is no anonymous pair bonus, matching what the board's hulls show.
// The spacer conducts adjacency: a silent wire module joins clusters (and
// nothing else) so chains of wired cells bridge synthesizers into one
// connected group — bridged chords are pitch-set matches, not fixed shapes.

// Connected clusters over synthesizers and spacers together: the wire
// conducts, the voices sing. Every other category stays out.
export function chordClusters(conductors: DeployedModule[]): DeployedModule[][] {
  const remaining = [...conductors];
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

// Choose m voices from a sorted group of k — the combination count. The
// Octave is the m = 2 case over one pitch class; ordinary chords take one
// voice per class (m = 1).
function choose(k: number, m: number): number {
  if (k < m) return 0;
  let out = 1;
  for (let i = 0; i < m; i++) out = (out * (k - i)) / (i + 1);
  return Math.round(out);
}

interface RootMatch {
  term: NamedChordTerm;
  // Per required class: the voices available at that class, sorted by id.
  groups: DeployedModule[][];
  // The multiplicity each class is sung with (1, or 2 for the Octave).
  multiplicity: number[];
  instances: number;
}

// One (pattern, root) match over one cluster: the cluster holds at least
// the required voices at each interval class. Instances count complete
// voice-sets — doubled voices stack (each pair of same-class voices is its
// own Octave; a double in a triad doubles that triad) — and every instance
// multiplies the composite by the same bonus.
function matchRoots(cluster: DeployedModule[]): RootMatch[] {
  const voices = cluster.filter((m) => m.type !== "spacer");
  if (voices.length === 0) return [];
  const matches: RootMatch[] = [];
  const byClass: DeployedModule[][] = Array.from({ length: 12 }, () => []);
  for (const voice of voices) {
    byClass[pitchClassOf(voice.pos)]!.push(voice);
  }
  for (const group of byClass) group.sort((a, b) => a.id.localeCompare(b.id));
  for (const def of NAMED_CHORDS) {
    const intervals = [...new Set(def.intervals)].sort((a, b) => a - b);
    const multiplicity = intervals.map((interval) => def.intervals.filter((i) => i === interval).length);
    for (let root = 0; root < 12; root++) {
      const groups = intervals.map((interval) => byClass[(root + interval) % 12]!);
      if (groups.some((group, i) => group.length < multiplicity[i]!)) continue;
      const instances = groups.reduce((total, group, i) => total * choose(group.length, multiplicity[i]!), 1);
      if (instances < 1) continue;
      // One representative voice set for rendering: the lowest-id voice at
      // each class (two for the Octave's doubled class).
      const representative = groups.flatMap((group, i) => group.slice(0, multiplicity[i]!));
      matches.push({
        term: { name: def.name, bonus: def.bonus, instances, moduleIds: representative.map((m) => m.id) },
        groups,
        multiplicity,
        instances,
      });
    }
  }
  return matches;
}

export interface ChordAnalysis {
  namedChords: NamedChordTerm[];
  multiplier: number;
  // Chord instances each module participates in: the Conditional's bonus
  // counts one per instance it belongs to (ADR-0022) — a doubled cluster
  // counts every complete voice-set the module sings in.
  participation: Map<string, number>;
}

// The chord pass over the deployed synthesizers and spacers: per connected
// cluster, per pattern and root, the cluster's voices decide whether the
// chord forms and how many instances it stacks. Overlapping instances
// (shared voices) and disjoint same-chord clusters (separate terms) both
// stack multiplicatively. Bonus-only: no dissonance penalties, and the
// board's finite cell budget is the only cap.
export function analyzeChords(synths: DeployedModule[], spacers: DeployedModule[] = []): ChordAnalysis {
  const namedChords: NamedChordTerm[] = [];
  const participation = new Map<string, number>();
  for (const cluster of chordClusters([...synths, ...spacers])) {
    for (const match of matchRoots(cluster)) {
      namedChords.push(match.term);
      // The instances a specific voice belongs to: choose it at its class,
      // then any complete combination of the other classes.
      for (const voice of cluster) {
        if (voice.type === "spacer") continue;
        const own = match.groups.findIndex(
          (group, i) => group.includes(voice) && match.multiplicity[i]! >= 1,
        );
        if (own === -1) continue;
        const containing =
          choose(match.groups[own]!.length - 1, match.multiplicity[own]! - 1) *
          match.groups.reduce((total, group, i) => (i === own ? total : total * choose(group.length, match.multiplicity[i]!)), 1);
        participation.set(voice.id, (participation.get(voice.id) ?? 0) + containing);
      }
    }
  }
  const multiplier = namedChords.reduce((acc, chord) => acc * (1 + chord.bonus) ** chord.instances, 1);
  return { namedChords, multiplier, participation };
}
