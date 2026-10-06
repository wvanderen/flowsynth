import { BALANCE, CATEGORY_OF, isVoiceType, NAMED_CHORDS } from "./constants";
import { adjacent, neighbors } from "./hex";
import { pitchOf } from "./lattice";
import type { DeployedModule, GameState, Hex, ModuleInstance, NamedChordTerm } from "./types";

// The chord model (ADR-0021/0022 as extended by ADR-0048/0049): chords are
// register-free pitch sets — a named pattern is recognized by pitch content
// over a connected formation, any voicing, any octave. The formation's
// voices are the oscillators and the silent voices together, each singing
// its own derived pitch (ADR-0048: the Harmonizer its cell, the Echo an
// adjacent voice an octave down, the Bend its cell altered by its picked
// shift); the spacer conducts: a silent wire module joins clusters (and
// nothing else) so chains of wired cells bridge voices into one connected
// group. Adjacency alone is chordless: there is no anonymous pair bonus.
//
// Harmony scoring (ADR-0049) rides the same pass: each connected formation
// scores one quality factor Q over its deduplicated pitch classes —
//   Q = clamp(1 + complexity − max(0, tension − A), Qmin, cap)
// with pair-based tension by interval class, linear complexity per class
// past the first, and a tension allowance A forgiven to named formations.
// A formation that names no chord sits at exactly ×1.00. Q multiplies each
// member's named-instance product inside its chord factor — chord-sourced
// production only, locality intact (ADR-0036).

// One singer: a deployed module with the pitch it sounds. A voice that
// sings nothing (an Echo with no adjacent voice) is no singer at all.
export interface Singer {
  module: DeployedModule;
  pitch: number;
}

// Connected clusters over singers and spacers together: the wire conducts,
// the voices sing. Every other category stays out.
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

const mod12 = (pitch: number): number => ((Math.round(pitch) % 12) + 12) % 12;

// Pair-based symbolic tension (ADR-0049): every pair of distinct classes
// weighed by interval class. Tuning in BALANCE.tensionWeights. Shared by
// the chord pass and the capacity allocator's formation read.
export function formationTension(classes: readonly number[]): number {
  let total = 0;
  for (let i = 0; i < classes.length; i++) {
    for (let j = i + 1; j < classes.length; j++) {
      const d = Math.abs(classes[i]! - classes[j]!);
      total += BALANCE.tensionWeights[Math.min(d, 12 - d)] ?? 0;
    }
  }
  return total;
}

// The formation quality (ADR-0049): clamp(1 + complexity − max(0, tension −
// A), Qmin, cap) — the allowance A forgiven to named formations, the floor
// materially below neutral so chromatic density is priced down. Chordless
// formations never reach this: exactly ×1.00.
export function formationQuality(classes: readonly number[], tension: number, named: boolean): number {
  if (!named) return 1;
  const complexity = BALANCE.complexityRate * Math.max(0, classes.length - 1);
  const effective = Math.max(0, tension - BALANCE.tensionAllowance);
  return Math.min(BALANCE.qualityCap, Math.max(BALANCE.qualityFloor, 1 + complexity - effective));
}

interface RootMatch {
  term: NamedChordTerm;
  // Per required class: the singers available at that class, sorted by id.
  groups: Singer[][];
  // The multiplicity each class is sung with (1, or 2 for the Octave).
  multiplicity: number[];
}

// One (pattern, root) match over one formation: the formation holds at
// least the required singers at each interval class. Instances count
// complete voice-sets — doubled voices stack (each pair of same-class
// voices is its own Octave; a double in a triad doubles that triad) — and
// every instance multiplies only its member voices (ADR-0036): chord
// bonuses are local, so a distant module's rate never moves.
function matchRoots(singers: Singer[], bonusScale: number): RootMatch[] {
  if (singers.length === 0) return [];
  const matches: RootMatch[] = [];
  const byClass: Singer[][] = Array.from({ length: 12 }, () => []);
  for (const singer of singers) byClass[mod12(singer.pitch)]!.push(singer);
  for (const group of byClass) group.sort((a, b) => a.module.id.localeCompare(b.module.id));
  for (const def of NAMED_CHORDS) {
    const intervals = [...new Set(def.intervals)].sort((a, b) => a - b);
    const multiplicity = intervals.map((interval) => def.intervals.filter((i) => i === interval).length);
    for (let root = 0; root < 12; root++) {
      const groups = intervals.map((interval) => byClass[(root + interval) % 12]!);
      if (groups.some((group, i) => group.length < multiplicity[i]!)) continue;
      const instances = groups.reduce((total, group, i) => total * choose(group.length, multiplicity[i]!), 1);
      if (instances < 1) continue;
      // Every singer that rings in at least one complete instance — all
      // the formation's voices at the chord's required classes (each class
      // clears its multiplicity, or there is no match). The per-module read
      // and the chord hulls share this list, so a doubled voice is never
      // shown chordless while its instances multiply the rate.
      const moduleIds = groups.flatMap((group) => group.map(({ module }) => module.id));
      matches.push({
        term: { name: def.name, bonus: def.bonus * bonusScale, instances, moduleIds, root },
        groups,
        multiplicity,
      });
    }
  }
  return matches;
}

// One class's instance compositions, from one voice's seat: the silent-
// voice subsets a complete voice-set might carry at this class, each
// weighted by how many loud-only completions fill the rest. `reserved`
// marks the seat's own voice — it occupies one slot the enumeration never
// re-chooses. With no silent voices at the class the list holds exactly
// the empty subset, so the general product below collapses to the plain
// (1 + bonus)^instances the pre-roster engine computed.
interface ClassChoice {
  singers: DeployedModule[];
  uplift: number;
  completions: number;
}

function classChoices(group: Singer[], multiplicity: number, reserved: Singer | undefined): ClassChoice[] {
  const silent = group.filter(
    ({ module }) => module !== reserved?.module && CATEGORY_OF[module.type] === "silentVoice",
  );
  // The seats the enumeration fills: the reserved seat's voice is already
  // placed, so its slot is out — one fewer seat and one fewer voice to
  // choose.
  const seats = multiplicity - (reserved ? 1 : 0);
  const loudAvailable = group.length - (reserved ? 1 : 0) - silent.length;
  const out: ClassChoice[] = [
    { singers: [], uplift: 0, completions: choose(loudAvailable, seats) },
  ];
  for (let mask = 1; mask < 1 << silent.length; mask++) {
    const singers: DeployedModule[] = [];
    for (let i = 0; i < silent.length; i++) {
      if (mask & (1 << i)) singers.push(silent[i]!.module);
    }
    if (singers.length > seats) continue;
    out.push({
      singers,
      uplift: singers.reduce((total, m) => total + BALANCE.silentVoiceUpliftPerLevel * m.level, 0),
      completions: choose(loudAvailable, seats - singers.length),
    });
  }
  return out;
}

export interface ChordAnalysis {
  namedChords: NamedChordTerm[];
  // Each module's local chord multiplier (ADR-0036 as extended by
  // ADR-0049): the product of every sung instance's (1 + bonus) — bonuses
  // uplifted by the silent voices singing in each instance, additive
  // across them (ADR-0048) — times the formation's quality Q. A module in
  // no chord but a named formation carries Q alone; a module in a
  // chordless formation is absent (read it as 1).
  voiceMultiplier: Map<string, number>;
  // The formation quality each module's cluster scored (ADR-0049): its own
  // named term per member — read aloud as "Formation ×1.12". Exactly 1 on
  // a chordless formation.
  formationQ: Map<string, number>;
  // Whether each module's formation named at least one chord — the
  // resonance mutator's live gate (inert on a chordless host).
  namedFormation: Map<string, boolean>;
  // Chord instances each module participates in.
  participation: Map<string, number>;
}

// The chord pass over the formation's singers and conducting spacers: per
// connected formation, per pattern and root, the singers decide whether
// the chord forms and how many instances stack; the formation scores one
// Q; every member's factor is its instance product × Q. Overlapping
// instances (shared voices) and disjoint same-chord formations (separate
// terms) stack multiplicatively on their members. `bonusScale` scales
// every named instance's bonus — the active build's pitch-ear nodes
// (ADR-0046) pass their factor, the displayed bonus riding the term so the
// chips and the rate never disagree; the formation quality is untouched.
export function analyzeChords(singers: Singer[], spacers: DeployedModule[] = [], bonusScale = 1): ChordAnalysis {
  const namedChords: NamedChordTerm[] = [];
  const participation = new Map<string, number>();
  const voiceMultiplier = new Map<string, number>();
  const formationQ = new Map<string, number>();
  const namedFormation = new Map<string, boolean>();
  const pitchById = new Map(singers.map(({ module, pitch }) => [module.id, pitch]));
  for (const cluster of chordClusters([...singers.map(({ module }) => module), ...spacers])) {
    const members = cluster.filter((m) => m.type !== "spacer");
    // One stable singer per voice — the match's groups and the per-voice
    // walk share these objects, so membership reads by identity.
    const clusterSingers = members.map((module) => ({ module, pitch: pitchById.get(module.id)! }));
    // Deduplicated pitch classes from the derived pitches — the Q read is
    // register-free and multiplicity-blind (ADR-0049).
    const classes = [...new Set(members.map((m) => mod12(pitchById.get(m.id)!)))];
    const matches = matchRoots(clusterSingers, bonusScale);
    const named = matches.length > 0;
    const q = formationQuality(classes, formationTension(classes), named);
    // The named-instance product per voice, accumulated across terms —
    // the formation's Q multiplies it exactly once, after the walk.
    const namedProduct = new Map<string, number>();
    // The whole-formation silent read, once per cluster: without a silent
    // voice no instance bonus ever varies, and every factor is the plain
    // (1 + bonus)^instances product.
    const anySilent = clusterSingers.some(({ module }) => CATEGORY_OF[module.type] === "silentVoice");
    for (const match of matches) {
      namedChords.push(match.term);
      // The unreserved compositions per class, shared by every voice's
      // walk; only the singing voice's own class re-derives its reserved
      // variant.
      const sharedLists = match.groups.map((group, i) => classChoices(group, match.multiplicity[i]!, undefined));
      const bonus = match.term.bonus;
      // The match's own singers, with each one's class index — the walk
      // never visits a voice the chord doesn't carry.
      const memberSingers: { singer: Singer; own: number }[] = [];
      match.groups.forEach((group, i) => {
        for (const singer of group) memberSingers.push({ singer, own: i });
      });
      for (const { singer, own } of memberSingers) {
        let factor: number;
        let containing: number;
        if (!anySilent) {
          // The fast path: choose the rest of the voice's class, then any
          // complete combination of the other classes.
          containing =
            choose(match.groups[own]!.length - 1, match.multiplicity[own]! - 1) *
            match.groups.reduce((total, group, i) => (i === own ? total : total * choose(group.length, match.multiplicity[i]!)), 1);
          factor = (1 + bonus) ** containing;
        } else {
          // The compositions per class from this voice's seat: its own
          // class reserves its slot; the seat's own uplift rides every
          // containing instance (a silent voice uplifts the chords it
          // sings in, itself included — landing on the other members).
          const lists = sharedLists.slice();
          lists[own] = classChoices(match.groups[own]!, match.multiplicity[own]!, singer);
          const ownUplift =
            CATEGORY_OF[singer.module.type] === "silentVoice"
              ? BALANCE.silentVoiceUpliftPerLevel * singer.module.level
              : 0;
          // The cross product walks every distinct instance bonus exactly:
          // each path multiplies one instance factor per combination,
          // raised to the combination's loud-completion count.
          factor = 1;
          containing = 1;
          const walk = (i: number, uplift: number, weight: number): void => {
            if (i === lists.length) {
              factor *= (1 + bonus + uplift + ownUplift) ** weight;
              return;
            }
            for (const choice of lists[i]!) walk(i + 1, uplift + choice.uplift, weight * choice.completions);
          };
          walk(0, 0, 1);
          for (const choice of lists) containing *= choice.reduce((total, c) => total + c.completions, 0);
        }
        participation.set(singer.module.id, (participation.get(singer.module.id) ?? 0) + containing);
        namedProduct.set(singer.module.id, (namedProduct.get(singer.module.id) ?? 1) * factor);
      }
    }
    // The formation's quality lands exactly once per member: on the named
    // product the voice accumulated, or alone on an instance-less member
    // of a named formation. Chordless formations sit at exactly ×1.00,
    // whatever the tension reads.
    for (const voice of members) {
      const product = namedProduct.get(voice.id);
      voiceMultiplier.set(voice.id, product !== undefined ? product * q : named ? q : 1);
    }
    for (const voice of members) {
      if (!formationQ.has(voice.id)) formationQ.set(voice.id, q);
      if (!namedFormation.has(voice.id)) namedFormation.set(voice.id, named);
    }
  }
  return { namedChords, voiceMultiplier, formationQ, namedFormation, participation };
}

// The pitch a module sings (ADR-0048): oscillators and the Harmonizer sing
// their cell's pitch; the Bend its cell altered by its picked shift; the
// Echo an adjacent voice's pitch one octave down — the lowest-id adjacent
// voice when several qualify, and nothing at all when none does. Echo
// chains descend octave by octave; a cycle sings nothing. `voiceAt`
// resolves an adjacent voice so the hypothetical board (the would-form
// preview) derives pitches from its own layout.
export function voicePitchOf(
  module: ModuleInstance,
  voiceAt: (pos: Hex) => ModuleInstance | undefined,
  visiting: Set<string> = new Set(),
): number | null {
  if (module.pos === null) return null;
  const category = CATEGORY_OF[module.type];
  if (category === "oscillator" || module.type === "harmonizer") return pitchOf(module.pos);
  if (module.type === "bend") return pitchOf(module.pos) + (module.shift ?? BALANCE.bendDefaultShift);
  if (module.type === "echo") {
    if (visiting.has(module.id)) return null;
    let neighbor: ModuleInstance | undefined;
    for (const direction of neighbors(module.pos)) {
      const other = voiceAt(direction);
      if (!other || other.id === module.id || other.pos === null) continue;
      if (!isVoiceType(other.type)) continue;
      if (!neighbor || other.id < neighbor.id) neighbor = other;
    }
    if (!neighbor) return null;
    const next = new Set(visiting);
    next.add(module.id);
    const source = voicePitchOf(neighbor, voiceAt, next);
    return source === null ? null : source - 12;
  }
  return null;
}

// The formation's two parts, partitioned from a placed-module list: the
// singers — oscillators and silent voices, each with its derived pitch,
// those that sing nothing dropped — and the conducting spacers. One
// partition for the rate pass, the achievements' chord read, and the
// would-form preview, never three that can drift.
export function partitionVoices(placed: DeployedModule[]): { singers: Singer[]; spacers: DeployedModule[] } {
  const voiceAt = (pos: Hex): ModuleInstance | undefined =>
    placed.find((m) => m.pos.q === pos.q && m.pos.r === pos.r);
  const singers: Singer[] = [];
  const spacers: DeployedModule[] = [];
  for (const module of placed) {
    if (module.type === "spacer") {
      spacers.push(module);
      continue;
    }
    if (!isVoiceType(module.type)) continue;
    const pitch = voicePitchOf(module, voiceAt);
    if (pitch !== null) singers.push({ module, pitch });
  }
  return { singers, spacers };
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

export function wouldFormPreview(state: GameState, id: string, target: Hex, bonusScale = 1): WouldFormPreview {
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
  const placed = hypothetical.filter((m): m is DeployedModule => m.pos !== null);
  const { singers, spacers } = partitionVoices(placed);
  return { chords: analyzeChords(singers, spacers, bonusScale).namedChords, positions };
}

// The newcomers between two chord-term lists — the would-form ghosts. A
// chord identifies by pattern and root, and its instances count across
// terms — doubled voices and disjoint clusters stack alike. An identity
// would newly form when the drop's board sings more instances of it than
// the live one does: a doubled Fifth (×1 → ×2) is a chord forming, so it
// previews. An equal or smaller count is at best a re-voicing of the same
// chord (a swapped identical synth) and at worst a break — neither
// previews, because what breaks is expressed by what disappears, never
// previewed.
export function newChordTerms(current: readonly NamedChordTerm[], next: readonly NamedChordTerm[]): NamedChordTerm[] {
  const instanceTotals = (terms: readonly NamedChordTerm[]): Map<string, number> => {
    const totals = new Map<string, number>();
    for (const chord of terms) {
      const key = `${chord.name}|${chord.root}`;
      totals.set(key, (totals.get(key) ?? 0) + chord.instances);
    }
    return totals;
  };
  const live = instanceTotals(current);
  const would = instanceTotals(next);
  return next.filter((chord) => {
    const key = `${chord.name}|${chord.root}`;
    return (would.get(key) ?? 0) > (live.get(key) ?? 0);
  });
}
