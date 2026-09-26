import { CATEGORY_OF, NAMED_CHORDS } from "./constants";
import { adjacent } from "./hex";
import { pitchClassOf } from "./lattice";
import type { DeployedModule, GameState, Hex, ModuleInstance, NamedChordTerm } from "./types";

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
      // Every voice that sings in at least one complete instance — all the
      // cluster's voices at the chord's required classes (each class clears
      // its multiplicity, or there is no match). The per-module panel read
      // and the chord hulls share this list, so a doubled voice is never
      // shown chordless while its instances multiply the rate.
      const moduleIds = groups.flatMap((group) => group.map((m) => m.id));
      matches.push({
        term: { name: def.name, bonus: def.bonus, instances, moduleIds, root },
        groups,
        multiplicity,
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

// The would-form pass (board-redesign spec §5–§6): what the board would
// carry after the drop. `chords` is the hypothetical board's named-chord
// terms; `positions` maps every module the drop moves to its would-be cell
// — the drop lands, and an occupied target swaps. The drop may come from
// the board (the occupant takes the mover's cell) or from the tray (the
// occupant leaves the board). A drop of identical synthesizers onto each
// other changes nothing here — pitch lives in the cell (§8), so a swap can
// never break a chord. Callers diff against the live terms (newChordTerms)
// and draw only the newcomers; what breaks is expressed by what disappears,
// never previewed.
export interface WouldFormPreview {
  chords: NamedChordTerm[];
  positions: ReadonlyMap<string, Hex>;
}

export function wouldFormPreview(state: GameState, id: string, target: Hex): WouldFormPreview {
  const dragged = state.modules.find((m) => m.id === id);
  if (!dragged) return { chords: [], positions: new Map() };
  const positions = new Map<string, Hex>([[id, target]]);
  const hypothetical: ModuleInstance[] = [];
  for (const module of state.modules) {
    if (module.id === id) {
      hypothetical.push({ ...module, pos: target });
      continue;
    }
    if (module.pos === null) continue;
    if (module.pos.q === target.q && module.pos.r === target.r) {
      // The occupant swaps out — to the mover's cell when the drop came
      // from the board, off the board when it came from the tray.
      hypothetical.push(
        dragged.pos ? { ...module, pos: dragged.pos } : { ...module, pos: null },
      );
      if (dragged.pos) positions.set(module.id, dragged.pos);
      continue;
    }
    hypothetical.push(module);
  }
  const synths = hypothetical.filter((m): m is DeployedModule => m.pos !== null && CATEGORY_OF[m.type] === "synthesizer");
  const spacers = hypothetical.filter((m): m is DeployedModule => m.pos !== null && m.type === "spacer");
  return { chords: analyzeChords(synths, spacers).namedChords, positions };
}

// The newcomers between two chord-term lists — the would-form ghosts. A
// chord identifies by pattern and root: the same name over the same root is
// the same chord however the board arrived at it, so a Fifth that merely
// sheds a doubled voice (Fifth ×2 → ×1) never masquerades as forming, while
// a chord at a new root — or an altogether new pattern — previews.
export function newChordTerms(current: readonly NamedChordTerm[], next: readonly NamedChordTerm[]): NamedChordTerm[] {
  const key = (chord: NamedChordTerm): string => `${chord.name}|${chord.root}`;
  const live = new Set(current.map(key));
  return next.filter((chord) => !live.has(key(chord)));
}
