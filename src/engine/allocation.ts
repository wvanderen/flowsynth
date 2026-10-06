import { BALANCE, CATEGORY_OF, NAMED_CHORDS } from "./constants";
import { chordClusters, formationQuality, formationTension, type ChordAnalysis, type Singer } from "./chords";
import type { AllocationSummary, DeployedModule, NamedChordTerm, RecognizedInstance } from "./types";

// Whole-chord capacity allocation (issue #257, carrying the confirmed
// harmonic-capacity design — its ADR lives in the design tree's numbering,
// and the issue states the required behavior independently; it reopens
// ADR-0049's uncapped multiplicative stacking): every voice — the silent
// voices included — owns a finite budget; an active chord instance is one
// complete voice-set and consumes one unit on every participating voice;
// no partial chord earns anything and no budget is ever exceeded. Selection is automatic: the
// allocator maximizes the summed final ν/s of the board's oscillators, the
// per-voice weights standing in for every non-chord leg of the real rate
// pass (power, local boosters, charge, active build factors, achievements,
// discoveries), with resonance and silent-voice uplift folded inside. The
// empty allocation stays available — activating chords can reduce
// production, and then nothing activates.
//
// Formation quality (ADR-0049) evaluates every voice in the connected
// formation but modifies only active participants: Q is scored once per
// cluster over all its deduplicated pitch classes, multiplies each
// participant's named-instance product, and leaves an unallocated voice at
// exactly ×1. Equal-output allocations retain the previous active set where
// possible (the `keep` hint), then fall back to a stable lexicographic
// order — the solve is deterministic, so a reload recomputes the same
// answer.
//
// Optimality is certified, never presumed. The search is an exact
// branch-and-bound over the materialized candidate list — every complete
// voice-set, nothing forced, nothing truncated — in a fixed canonical
// order, each subset visited exactly once, an optimistic per-voice bound
// pruning what the incumbent already beats. It is bounded by a
// deterministic node budget plus a wall-clock valve; if either trips the
// read says `certified: false` and carries the best incumbent found — a
// heuristic is never silently substituted. The exhaustive oracle in
// allocation.test.ts certifies small-instance outcomes independently, and
// the stress ladder in allocation-stress.test.ts repeats the certification
// story up through the 72-voice upper size.

// The per-voice inputs the objective needs beyond the singer itself: the
// voice's full chordless final ν/s (every non-chord leg of the rate pass
// multiplied out — the caller reads it off the real engine pass) and the
// resonance mutator's magnitude on its cell.
export interface AllocationVoiceParams {
  weight: number;
  resonance: number;
}

// The search budget: a deterministic node cap plus a wall-clock safety
// valve. The node cap is the real limit — a deterministic budget keeps the
// chosen allocation stable across recomputation; the clock valve only
// guards a pathological node cost, and firing it flags the solve
// uncertified rather than letting it drift.
export interface AllocationBudget {
  maxNodes: number;
  maxMs: number;
}

export const DEFAULT_ALLOCATION_BUDGET: AllocationBudget = { maxNodes: 250_000, maxMs: 750 };

// Issue #257's adopted development range; the default production chord
// pass retains ADR-0049's provisional tuning.
export const ALLOCATION_QUALITY_BOUNDS = { floor: 0.5, cap: 1.5 } as const;

// One complete voice-set the board recognizes — the atom of allocation.
// `bonus` is the bonus the instance actually carries (the named bonus
// scaled by any active build factor, plus every singing silent voice's
// uplift); `key` is the stable identity (pattern, root, sorted members)
// allocations retain across recomputation.
export interface AllocatedInstance extends RecognizedInstance {}

// The whole-board allocation read: a drop-in ChordAnalysis for the rate
// pass's chord seam, plus the capacity and certification reads the
// development board inspects.
export interface AllocationRead {
  analysis: ChordAnalysis;
  // Capacity consumed on every singing voice — one unit per active
  // instance the voice participates in, silent voices included.
  used: Map<string, number>;
  instances: AllocatedInstance[];
  // Every complete voice-set the board recognized, active or not —
  // recognized-but-inactive chords still count as discoveries. The
  // all-silent sets ride here too: they grant nothing and never activate,
  // but the board does sing them.
  recognized: number;
  recognizedInstances: AllocatedInstance[];
  certified: boolean;
  nodes: number;
  ms: number;
}

export interface AllocateOptions {
  capacity: number;
  params: Map<string, AllocationVoiceParams>;
  // The active build's named-chord bonus scale (ADR-0046), as the rate
  // pass threads it — the displayed bonus rides the term.
  bonusScale?: number;
  // Instance keys from the previous allocation: on equal output the solver
  // retains these before falling back to the stable order.
  keep?: ReadonlySet<string>;
  budget?: AllocationBudget;
}

const mod12 = (pitch: number): number => ((Math.round(pitch) % 12) + 12) % 12;

// Two values within TIE_EPS read as one output: equal-output allocations
// are where retention and the stable fallback decide, so the search visits
// them rather than pruning them.
const TIE_EPS = 1e-9;

interface ClusterVoice {
  id: string;
  index: number;
  klass: number;
  weight: number;
  uplift: number;
  resonance: number;
}

interface Candidate {
  inst: AllocatedInstance;
  factor: number;
  members: ClusterVoice[];
}

// One voice's remaining-candidate material: the indices (into the ordered
// candidate list) of every candidate containing it, and for each suffix
// length t the prefix products of the top factors among the last t — the
// bound's whole lookup table.
interface VoiceSuffix {
  indices: number[];
  // suffixProducts[t][k] = the product of the k largest factors among the
  // t remaining candidates containing the voice (t = 0 carries [1]).
  suffixProducts: number[][];
  // The walk position: the first index in `indices` still undecided.
  ptr: number;
}

interface Solve {
  voices: ClusterVoice[];
  capacity: number;
  q: number;
  keep: ReadonlySet<string>;
  candidates: Candidate[];
  byKey: Map<string, Candidate>;
  suffix: Map<string, VoiceSuffix>;
  nodes: number;
  exhausted: boolean;
  deadline: number;
  maxNodes: number;
  prods: number[];
  counts: number[];
  sumActive: number;
  sumIdle: number;
  chosen: AllocatedInstance[];
  // A voice-set is one instance, never repeatable — the greedy's sweep and
  // the trim's rebuild both check it (the include/exclude search needs no
  // check: each candidate is decided exactly once per path).
  chosenKeys: Set<string>;
  best: { value: number; kept: number; lex: string; instances: AllocatedInstance[] };
}

class BudgetExhausted extends Error {}

function valueOf(solve: Solve): number {
  // An unnamed formation pays every voice its idle value; one active
  // instance names it, and Q then rides every participant's product.
  return solve.chosen.length > 0 ? solve.q * solve.sumActive + solve.sumIdle : solve.sumActive + solve.sumIdle;
}

// The exact marginal gain of activating one more instance: the first names
// the cluster and pays Q on all its members; later ones multiply into the
// products Q already rides.
function deltaOf(solve: Solve, candidate: Candidate): number {
  let delta = 0;
  for (const voice of candidate.members) {
    const term = voice.weight * (1 + voice.resonance);
    if (solve.counts[voice.index] === 0) delta += solve.q * term * candidate.factor - voice.weight;
    else delta += solve.q * term * solve.prods[voice.index]! * (candidate.factor - 1);
  }
  return delta;
}

function applyCandidate(solve: Solve, candidate: Candidate): void {
  for (const voice of candidate.members) {
    const term = voice.weight * (1 + voice.resonance);
    if (solve.counts[voice.index] === 0) {
      solve.sumIdle -= voice.weight;
      solve.sumActive += term * candidate.factor;
    } else {
      solve.sumActive += term * solve.prods[voice.index]! * (candidate.factor - 1);
    }
    solve.prods[voice.index]! *= candidate.factor;
    solve.counts[voice.index]!++;
  }
  solve.chosen.push(candidate.inst);
  solve.chosenKeys.add(candidate.inst.key);
}

function undoCandidate(solve: Solve, candidate: Candidate): void {
  solve.chosen.pop();
  solve.chosenKeys.delete(candidate.inst.key);
  for (const voice of candidate.members) {
    const term = voice.weight * (1 + voice.resonance);
    solve.counts[voice.index]!--;
    solve.prods[voice.index]! /= candidate.factor;
    if (solve.counts[voice.index] === 0) {
      solve.sumIdle += voice.weight;
      solve.sumActive -= term * candidate.factor;
    } else {
      solve.sumActive -= term * solve.prods[voice.index]! * (candidate.factor - 1);
    }
  }
}

function feasible(solve: Solve, candidate: Candidate): boolean {
  return candidate.members.every((voice) => solve.counts[voice.index]! < solve.capacity);
}

function lexKeyOf(instances: readonly AllocatedInstance[]): string {
  return instances
    .map((inst) => inst.key)
    .sort()
    .join(";");
}

// The incumbent comparison: higher output wins; equal output retains more
// of the previous active set; a full tie takes the lexicographically
// smallest key list — the stable fallback that makes recomputation and
// reload agree. The empty allocation is the smallest list of all.
function consider(solve: Solve): void {
  const value = valueOf(solve);
  const best = solve.best;
  if (value < best.value - TIE_EPS) return;
  let kept = 0;
  for (const inst of solve.chosen) if (solve.keep.has(inst.key)) kept++;
  if (value > best.value + TIE_EPS || kept > best.kept) {
    best.value = value;
    best.kept = kept;
    best.lex = lexKeyOf(solve.chosen);
    best.instances = [...solve.chosen];
    return;
  }
  if (kept < best.kept) return;
  const lex = lexKeyOf(solve.chosen);
  if (lex < best.lex) {
    best.value = value;
    best.kept = kept;
    best.lex = lex;
    best.instances = [...solve.chosen];
  }
}

// Advance/retreat the per-voice walk past candidate `i`, so the bound
// reads only candidates still undecided. Only members' pointers move —
// amortized O(members) per step.
function advance(solve: Solve, i: number): void {
  for (const voice of solve.candidates[i]!.members) {
    const suffix = solve.suffix.get(voice.id)!;
    if (suffix.indices[suffix.ptr] === i) suffix.ptr++;
  }
}

function retreat(solve: Solve, i: number): void {
  for (const voice of solve.candidates[i]!.members) {
    const suffix = solve.suffix.get(voice.id)!;
    if (suffix.ptr > 0 && suffix.indices[suffix.ptr - 1] === i) suffix.ptr--;
  }
}

// The optimistic completion bound: with candidates i.. still undecided,
// every voice independently takes its remaining capacity's worth of the
// largest factors among its remaining candidates, Q and resonance folded
// in — and never reads below its idle value, which is what the empty
// allocation would pay it. Shared budgets make the true optimum lower; the
// bound never reads higher.
function boundOf(solve: Solve): number {
  let bound = 0;
  for (const voice of solve.voices) {
    const count = solve.counts[voice.index]!;
    const suffix = solve.suffix.get(voice.id)!;
    // The table is built by unshifting a reverse walk, so entry `ptr`
    // (the candidates already walked past) carries the products for the
    // m − ptr candidates still undecided.
    const products = suffix.suffixProducts[suffix.ptr]!;
    const slots = Math.min(solve.capacity - count, products.length - 1);
    const best = products[slots]!;
    const optimistic =
      count > 0
        ? solve.q * (1 + voice.resonance) * solve.prods[voice.index]! * best
        : Math.max(1, solve.q * (1 + voice.resonance) * best);
    bound += voice.weight * optimistic;
  }
  return bound;
}

function combinations<T>(items: readonly T[], k: number): T[][] {
  const out: T[][] = [];
  const pick = (start: number, left: number, current: T[]): void => {
    if (left === 0) {
      out.push([...current]);
      return;
    }
    for (let j = start; j <= items.length - left; j++) pick(j + 1, left - 1, [...current, items[j]!]);
  };
  pick(0, k, []);
  return out;
}

// The full candidate survey — every complete voice-set the cluster
// recognizes, member for member, nothing forced and nothing truncated:
// for each (pattern, root), every member combination over the pattern's
// required classes, cross-producted, exactly as recognition reads them
// today. Instances whose every member is silent are recognized — they
// count toward `recognized`, the discovery read — but never join the
// solvable list: they grant nothing and only spend budget. The order is
// canonical (best empty-board marginal gain first, then key), so the
// search below is deterministic and dives into strong incumbents first.
function surveyCandidates(
  byClass: ClusterVoice[][],
  bonusScale: number,
  q: number,
): { solvable: Candidate[]; silentOnly: AllocatedInstance[]; recognized: number } {
  const out: Candidate[] = [];
  const silentOnly: AllocatedInstance[] = [];
  let recognized = 0;
  for (const def of NAMED_CHORDS) {
    const intervals = [...new Set(def.intervals)].sort((a, b) => a - b);
    const multiplicity = intervals.map((interval) => def.intervals.filter((i) => i === interval).length);
    for (let root = 0; root < 12; root++) {
      const groups = intervals.map((interval) => byClass[(root + interval) % 12]!);
      if (groups.some((group, i) => group.length < multiplicity[i]!)) continue;
      const combos = groups.map((group, i) => combinations(group, multiplicity[i]!));
      const walk = (i: number, members: ClusterVoice[]): void => {
        if (i === combos.length) {
          recognized++;
          const sorted = [...members].sort((a, b) => a.id.localeCompare(b.id));
          const memberIds = sorted.map((voice) => voice.id);
          const bonus = def.bonus * bonusScale + sorted.reduce((total, voice) => total + voice.uplift, 0);
          const inst: AllocatedInstance = {
            key: `${def.name}|${root}|${memberIds.join(",")}`,
            name: def.name,
            root,
            bonus,
            memberIds,
          };
          // All-silent sets stay recognized — the discovery read counts
          // them — but never join the solvable list: they grant nothing
          // and only spend budget.
          if (members.every((voice) => voice.weight === 0)) {
            silentOnly.push(inst);
            return;
          }
          out.push({ inst, factor: 1 + bonus, members: sorted });
          return;
        }
        for (const seats of combos[i]!) walk(i + 1, [...members, ...seats]);
      };
      walk(0, []);
    }
  }
  // Canonical order: the strongest first-instances lead — a greedy dive
  // lands deep before any branching — with the key breaking ties.
  const emptyDelta = (candidate: Candidate): number =>
    candidate.members.reduce(
      (total, voice) => total + (q * (1 + voice.resonance) * candidate.factor - 1) * voice.weight,
      0,
    );
  out.sort((a, b) => emptyDelta(b) - emptyDelta(a) || a.inst.key.localeCompare(b.inst.key));
  return { solvable: out, silentOnly, recognized };
}

// The cluster's Q, read once for the survey's ordering heuristic.
function qualityOf(voices: ClusterVoice[]): number {
  const classes = [...new Set(voices.map((voice) => voice.klass))].sort((a, b) => a - b);
  return formationQuality(classes, formationTension(classes), true, ALLOCATION_QUALITY_BOUNDS);
}

// Each voice's bound material: which ordered candidates contain it, and
// the top-factor prefix products over every suffix of that list — built in
// one reverse walk carrying a running top-`capacity` list.
function buildSuffixes(solve: Solve): void {
  const capacity = solve.capacity;
  for (const voice of solve.voices) {
    const indices: number[] = [];
    solve.candidates.forEach((candidate, i) => {
      if (candidate.members.includes(voice)) indices.push(i);
    });
    // top: the current largest factors, ascending; products[t] as built.
    const suffixProducts: number[][] = [[1]];
    const top: number[] = [];
    for (let t = indices.length - 1; t >= 0; t--) {
      const factor = solve.candidates[indices[t]!]!.factor;
      insert(top, factor, capacity);
      // Ascending by count: products[t] is the product of the t largest
      // factors among the remaining candidates.
      const products = [1];
      for (let k = top.length - 1; k >= 0; k--) products.push(products[products.length - 1]! * top[k]!);
      suffixProducts.unshift(products);
    }
    solve.suffix.set(voice.id, { indices, suffixProducts, ptr: 0 });
  }
}

// Keep `top` the sorted (ascending) list of the `capacity` largest factors
// seen: insert at the ascending position, then drop the smallest when the
// window is over — a factor larger than everything kept always enters.
function insert(top: number[], factor: number, capacity: number): void {
  let i = top.length;
  while (i > 0 && top[i - 1]! > factor) i--;
  top.splice(i, 0, factor);
  if (top.length > capacity) top.shift();
}

// The value of an arbitrary instance list over the cluster — the
// independent evaluator the greedy's trim pass uses (it recomputes every
// product from the members, never trusting incremental state).
function evaluateList(solve: Solve, instances: readonly AllocatedInstance[]): number {
  const prods = new Map(solve.voices.map((voice) => [voice.id, 1]));
  const counts = new Map(solve.voices.map((voice) => [voice.id, 0]));
  for (const inst of instances) {
    for (const id of inst.memberIds) {
      prods.set(id, prods.get(id)! * (1 + inst.bonus));
      counts.set(id, counts.get(id)! + 1);
    }
  }
  let active = 0;
  let idle = 0;
  for (const voice of solve.voices) {
    if ((counts.get(voice.id) ?? 0) > 0) active += voice.weight * (1 + voice.resonance) * prods.get(voice.id)!;
    else idle += voice.weight;
  }
  return instances.length > 0 ? solve.q * active + idle : active + idle;
}

function resetToEmpty(solve: Solve): void {
  solve.chosen = [];
  solve.chosenKeys = new Set();
  solve.prods = solve.voices.map(() => 1);
  solve.counts = solve.voices.map(() => 0);
  solve.sumActive = 0;
  solve.sumIdle = solve.voices.reduce((total, voice) => total + voice.weight, 0);
  for (const suffix of solve.suffix.values()) suffix.ptr = 0;
}

// The greedy incumbent: repeatedly activate the best exact marginal gain
// until nothing improves, then trim any instance that no longer pays (a
// late instance can stop earning once Q is long paid and budgets
// tightened). Two rankings — raw gain and gain per seat — seed the
// incumbent the exact search then improves.
function greedyIncumbent(solve: Solve, perSeat: boolean): void {
  resetToEmpty(solve);
  for (;;) {
    // The greedy shares the budget: one sweep counts one node, and the
    // clock valve bounds a pathologically wide candidate list.
    solve.nodes++;
    if (solve.nodes > solve.maxNodes || performance.now() > solve.deadline) {
      solve.exhausted = true;
      throw new BudgetExhausted();
    }
    let best: Candidate | null = null;
    let bestRank = 0;
    for (const candidate of solve.candidates) {
      if (solve.chosenKeys.has(candidate.inst.key) || !feasible(solve, candidate)) continue;
      const gain = deltaOf(solve, candidate);
      const rank = perSeat ? gain / candidate.members.length : gain;
      if (rank > bestRank + 1e-12) {
        bestRank = rank;
        best = candidate;
      }
    }
    if (!best) break;
    applyCandidate(solve, best);
  }
  consider(solve);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = solve.chosen.length - 1; i >= 0; i--) {
      const without = solve.chosen.filter((_, j) => j !== i);
      if (evaluateList(solve, without) > valueOf(solve) + TIE_EPS) {
        resetToEmpty(solve);
        for (const inst of without) {
          const candidate = solve.byKey.get(inst.key);
          if (candidate && feasible(solve, candidate)) applyCandidate(solve, candidate);
        }
        changed = true;
      }
    }
  }
  consider(solve);
}

// The exact search: include/exclude over the canonically ordered
// candidates — every subset visited exactly once, no permutations — pruned
// by the completion bound and the incumbent. The exclude walk is a loop
// (a monolithic board chains tens of thousands of exclusions; the include
// recursion only ever descends one level per activated instance, which the
// capacity bounds to a few hundred). Ties are visited, not pruned, so
// retention and the stable fallback can decide them; the deterministic
// node budget certifies the optimum when the search completes within it.
function exactSearch(solve: Solve, start: number): void {
  let advanced = -1;
  try {
    for (let i = start; i < solve.candidates.length; i++) {
      solve.nodes++;
      if (solve.nodes > solve.maxNodes || performance.now() > solve.deadline) {
        solve.exhausted = true;
        throw new BudgetExhausted();
      }
      consider(solve);
      if (boundOf(solve) < solve.best.value - TIE_EPS) return;
      const candidate = solve.candidates[i]!;
      if (feasible(solve, candidate)) {
        applyCandidate(solve, candidate);
        advance(solve, i);
        exactSearch(solve, i + 1);
        retreat(solve, i);
        undoCandidate(solve, candidate);
      }
      advance(solve, i);
      advanced = i;
    }
    solve.nodes++;
    if (solve.nodes > solve.maxNodes || performance.now() > solve.deadline) {
      solve.exhausted = true;
      throw new BudgetExhausted();
    }
    consider(solve);
  } finally {
    for (let j = advanced; j >= start; j--) retreat(solve, j);
  }
}

// Solve one connected formation exactly, budget permitting.
function solveCluster(
  voices: ClusterVoice[],
  capacity: number,
  bonusScale: number,
  keep: ReadonlySet<string>,
  budget: AllocationBudget,
): { instances: AllocatedInstance[]; recognizedInstances: AllocatedInstance[]; candidates: number; certified: boolean; nodes: number } {
  const byClass: ClusterVoice[][] = Array.from({ length: 12 }, () => []);
  for (const voice of voices) byClass[voice.klass]!.push(voice);
  const q = qualityOf(voices);
  const idle = voices.reduce((total, voice) => total + voice.weight, 0);
  const survey = surveyCandidates(byClass, bonusScale, q);
  const candidates = survey.solvable;
  const solve: Solve = {
    voices,
    capacity,
    q,
    keep,
    candidates,
    byKey: new Map(candidates.map((candidate) => [candidate.inst.key, candidate])),
    suffix: new Map(),
    nodes: 0,
    exhausted: false,
    deadline: performance.now() + budget.maxMs,
    maxNodes: budget.maxNodes,
    prods: voices.map(() => 1),
    counts: voices.map(() => 0),
    sumActive: 0,
    sumIdle: idle,
    chosen: [],
    chosenKeys: new Set(),
    best: { value: idle, kept: 0, lex: "", instances: [] },
  };
  buildSuffixes(solve);
  if (survey.recognized > 0) {
    // Each phase aborts independently on the budget: a greedy that trips
    // leaves its incumbent standing, and the exact search still gets its
    // turn (usually to abort at once — the point is the honest flag).
    for (const perSeat of [false, true]) {
      try {
        greedyIncumbent(solve, perSeat);
      } catch (error) {
        if (!(error instanceof BudgetExhausted)) throw error;
      }
    }
    resetToEmpty(solve);
    try {
      exactSearch(solve, 0);
    } catch (error) {
      if (!(error instanceof BudgetExhausted)) throw error;
    }
  }
  return {
    instances: solve.best.instances,
    recognizedInstances: [...candidates.map((candidate) => candidate.inst), ...survey.silentOnly],
    candidates: survey.recognized,
    certified: !solve.exhausted,
    nodes: solve.nodes,
  };
}

// The whole-board allocation: per connected formation (the spacer conducts
// as always), one exact solve; the reads assemble into a drop-in
// ChordAnalysis for the rate pass's chord seam. An unallocated voice keeps
// exactly ×1 — no Q, no resonance — while the formation's Q stays scored
// over every voice in it, participant or not.
export function allocateChords(singers: Singer[], spacers: DeployedModule[] = [], opts: AllocateOptions): AllocationRead {
  const bonusScale = opts.bonusScale ?? 1;
  const keep = opts.keep ?? new Set<string>();
  const budget = opts.budget ?? DEFAULT_ALLOCATION_BUDGET;
  const started = performance.now();
  const namedChords: NamedChordTerm[] = [];
  const voiceMultiplier = new Map<string, number>();
  const formationQ = new Map<string, number>();
  const namedFormation = new Map<string, boolean>();
  const participation = new Map<string, number>();
  const used = new Map<string, number>();
  const instances: AllocatedInstance[] = [];
  const recognizedInstances: AllocatedInstance[] = [];
  let recognized = 0;
  let certified = true;
  let nodes = 0;
  const pitchById = new Map(singers.map(({ module, pitch }) => [module.id, pitch]));
  for (const cluster of chordClusters([...singers.map(({ module }) => module), ...spacers])) {
    const memberIds = cluster.filter((m) => pitchById.has(m.id)).map((m) => m.id);
    if (memberIds.length === 0) continue;
    const voices: ClusterVoice[] = memberIds
      .map((id) => {
        const module = singers.find((s) => s.module.id === id)!.module;
        const params = opts.params.get(id) ?? { weight: 0, resonance: 0 };
        const silent = CATEGORY_OF[module.type] === "silentVoice";
        const uplift = silent ? BALANCE.silentVoiceUpliftPerLevel * module.level : 0;
        const weight = silent ? 0 : params.weight;
        return { id, index: 0, klass: mod12(pitchById.get(id)!), weight, uplift, resonance: params.resonance };
      })
      .sort((a, b) => a.id.localeCompare(b.id));
    voices.forEach((voice, i) => (voice.index = i));
    const solved = solveCluster(voices, opts.capacity, bonusScale, keep, budget);
    recognized += solved.candidates;
    recognizedInstances.push(...solved.recognizedInstances);
    nodes += solved.nodes;
    certified = certified && solved.certified;
    const product = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const inst of solved.instances) {
      instances.push(inst);
      namedChords.push({ name: inst.name, bonus: inst.bonus, instances: 1, moduleIds: [...inst.memberIds], root: inst.root });
      for (const id of inst.memberIds) {
        product.set(id, (product.get(id) ?? 1) * (1 + inst.bonus));
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    const q = solved.instances.length > 0 ? qualityOf(voices) : 1;
    for (const voice of voices) {
      const count = counts.get(voice.id) ?? 0;
      used.set(voice.id, count);
      participation.set(voice.id, count);
      voiceMultiplier.set(voice.id, count > 0 ? (product.get(voice.id) ?? 1) * q : 1);
      formationQ.set(voice.id, q);
      namedFormation.set(voice.id, count > 0);
    }
  }
  return {
    analysis: { namedChords, voiceMultiplier, formationQ, namedFormation, participation },
    used,
    instances,
    recognized,
    recognizedInstances,
    certified,
    nodes,
    ms: performance.now() - started,
  };
}

// Every recognized voice-set as the rate pass's terms — the discovery
// sync's exact input, active and idle alike (one entry per instance). The
// mapping is derived, never stored alongside the read.
export function recognizedTermsOf(read: AllocationRead): NamedChordTerm[] {
  return read.recognizedInstances.map(termOfInstance);
}

// The summary's recognized voice-sets — active and idle — as the same
// terms: the would-form ghost's recognition diff reads this.
export function summaryTermsOf(summary: AllocationSummary): NamedChordTerm[] {
  return summary.recognized.map(termOfInstance);
}

// The summary's recognized-but-idle candidates as the same terms — the
// board's dotted seams, the readout's idle chips, and the rate details'
// idle notes all read this one mapping, never a private re-derivation.
export function idleTermsOf(summary: AllocationSummary): NamedChordTerm[] {
  return summary.recognized
    .filter((instance) => !summary.activeKeys.has(instance.key))
    .map(termOfInstance);
}

function termOfInstance(instance: RecognizedInstance): NamedChordTerm {
  return { name: instance.name, bonus: instance.bonus, instances: 1, moduleIds: [...instance.memberIds], root: instance.root };
}
