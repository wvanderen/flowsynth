import { describe, expect, it } from "vitest";
import { BALANCE, CATEGORY_OF, NAMED_CHORDS } from "./constants";
import { chordClusters, partitionVoices, type ChordAnalysis, type Singer } from "./chords";
import { computeRates } from "./economy";
import { allocateChords, type AllocatedInstance, type AllocationVoiceParams } from "./allocation";
import { fresh, give, sumSynthValues } from "./fixtures";
import { hex } from "./hex";
import type { DeployedModule, GameState, ModuleType } from "./types";

// Whole-chord capacity allocation (issue #257): every voice — silent voices
// included — owns a budget; an active instance consumes one unit on every
// participating voice; allocation maximizes summed final oscillator
// production and stays empty when activating would reduce it. These suites
// certify the solver against an independent exhaustive oracle, hold the
// structural contracts (whole chords only, budgets never exceeded, every
// leg of the real rate pass inside the objective), and pin the stability
// rules (retain-then-stable across recomputation, determinism across
// reload).

// ── The independent exhaustive oracle ──────────────────────────────────
// A separate implementation: its own recognition walk, its own quality
// math from BALANCE, its own subset enumeration. It brute-forces every
// subset of every complete voice-set and returns the best value — slow,
// small fixtures only, sharing no solver code beyond the constants.

const mod12 = (pitch: number): number => ((Math.round(pitch) % 12) + 12) % 12;

function oracleQuality(classes: readonly number[]): number {
  let tension = 0;
  for (let i = 0; i < classes.length; i++) {
    for (let j = i + 1; j < classes.length; j++) {
      const d = Math.abs(classes[i]! - classes[j]!);
      tension += BALANCE.tensionWeights[Math.min(d, 12 - d)] ?? 0;
    }
  }
  const complexity = BALANCE.complexityRate * Math.max(0, classes.length - 1);
  const effective = Math.max(0, tension - BALANCE.tensionAllowance);
  return Math.min(BALANCE.qualityCap, Math.max(BALANCE.qualityFloor, 1 + complexity - effective));
}

interface OracleVoice {
  id: string;
  klass: number;
  weight: number;
  uplift: number;
  resonance: number;
}

function oracleBestValue(voices: OracleVoice[], capacity: number): number {
  const byClass = new Map<number, OracleVoice[]>();
  for (const voice of voices) {
    const list = byClass.get(voice.klass) ?? [];
    list.push(voice);
    byClass.set(voice.klass, list);
  }
  const combos = (group: OracleVoice[], k: number): OracleVoice[][] => {
    const res: OracleVoice[][] = [];
    const pick = (start: number, left: number, current: OracleVoice[]): void => {
      if (left === 0) {
        res.push([...current]);
        return;
      }
      for (let j = start; j <= group.length - left; j++) pick(j + 1, left - 1, [...current, group[j]!]);
    };
    pick(0, k, []);
    return res;
  };
  // Every complete voice-set the cluster recognizes.
  const flat: { members: OracleVoice[]; factor: number }[] = [];
  for (const def of NAMED_CHORDS) {
    const intervals = [...new Set(def.intervals)].sort((a, b) => a - b);
    const multiplicity = intervals.map((iv) => def.intervals.filter((i) => i === iv).length);
    for (let root = 0; root < 12; root++) {
      const groups = intervals.map((iv) => byClass.get((root + iv) % 12) ?? []);
      if (groups.some((group, i) => group.length < multiplicity[i]!)) continue;
      const choices = groups.map((group, i) => combos(group, multiplicity[i]!));
      const walk = (i: number, members: OracleVoice[]): void => {
        if (i === choices.length) {
          flat.push({ members: [...members], factor: 1 + def.bonus + members.reduce((t, v) => t + v.uplift, 0) });
          return;
        }
        for (const seats of choices[i]!) walk(i + 1, [...members, ...seats]);
      };
      walk(0, []);
    }
  }
  expect(flat.length).toBeLessThanOrEqual(18); // 2^18 subsets is the oracle's ceiling
  const classes = [...new Set(voices.map((v) => v.klass))];
  const q = oracleQuality(classes);
  const idle = voices.reduce((total, v) => total + v.weight, 0);
  let best = idle;
  for (let mask = 0; mask < 1 << flat.length; mask++) {
    const prods = new Map(voices.map((v) => [v.id, 1]));
    const counts = new Map(voices.map((v) => [v.id, 0]));
    let active = false;
    let feasible = true;
    for (let bit = 0; bit < flat.length && feasible; bit++) {
      if (!(mask & (1 << bit))) continue;
      const instance = flat[bit]!;
      for (const member of instance.members) {
        const count = counts.get(member.id)!;
        if (count >= capacity) {
          feasible = false;
          break;
        }
        counts.set(member.id, count + 1);
        prods.set(member.id, prods.get(member.id)! * instance.factor);
      }
      active = true;
    }
    if (!feasible) continue;
    let total = 0;
    for (const v of voices) {
      total += (counts.get(v.id) ?? 0) > 0 ? v.weight * (1 + v.resonance) * prods.get(v.id)! * q : v.weight;
    }
    best = Math.max(best, active ? total : idle);
  }
  return best;
}

// The value the solver's chosen instances produce — recomputed here, never
// read from the solver, with the structural contracts asserted inline:
// whole chords only, budgets never exceeded.
function valueOfInstances(voices: readonly OracleVoice[], instances: readonly AllocatedInstance[], capacity: number): number {
  const prods = new Map(voices.map((v) => [v.id, 1]));
  const counts = new Map(voices.map((v) => [v.id, 0]));
  for (const inst of instances) {
    const def = NAMED_CHORDS.find((d) => d.name === inst.name)!;
    expect(inst.memberIds.length).toBe(def.intervals.length); // complete voice-set
    for (const id of inst.memberIds) {
      const count = counts.get(id)!;
      expect(count).toBeLessThan(capacity); // no budget ever exceeded
      counts.set(id, count + 1);
      prods.set(id, prods.get(id)! * (1 + inst.bonus));
    }
  }
  if (instances.length === 0) return voices.reduce((total, v) => total + v.weight, 0);
  const classes = [...new Set(voices.map((v) => v.klass))];
  const q = oracleQuality(classes);
  let total = 0;
  for (const v of voices) {
    total += (counts.get(v.id) ?? 0) > 0 ? v.weight * (1 + v.resonance) * prods.get(v.id)! * q : v.weight;
  }
  return total;
}

// ── Fixture helpers ───────────────────────────────────────────────────
// Scenario boards of real modules at real lattice cells, so the engine's
// own pitch derivation and partition carry the fixtures.

interface Scenario {
  state: GameState;
  params: Map<string, AllocationVoiceParams>;
  voices: Map<string, OracleVoice>;
}

function scenario(): Scenario {
  const state = fresh();
  state.cells = [];
  state.modules = [];
  return { state, params: new Map(), voices: new Map() };
}

function addVoice(
  s: Scenario,
  type: ModuleType,
  pos: { q: number; r: number },
  level = 0,
  weight = BALANCE.synthRate,
  resonance = 0,
): string {
  const module = give(s.state, type, hex(pos.q, pos.r), level);
  if (!s.state.cells.some((c) => c.q === pos.q && c.r === pos.r)) s.state.cells.push(hex(pos.q, pos.r));
  s.params.set(module.id, { weight, resonance });
  return module.id;
}

function addSpacers(s: Scenario, positions: { q: number; r: number }[]): void {
  for (const pos of positions) {
    if (!s.state.cells.some((c) => c.q === pos.q && c.r === pos.r)) s.state.cells.push(hex(pos.q, pos.r));
    give(s.state, "spacer", hex(pos.q, pos.r));
  }
}

function partsOf(s: Scenario): { singers: Singer[]; spacers: DeployedModule[] } {
  const placed = s.state.modules.filter((m): m is DeployedModule => m.pos !== null);
  return partitionVoices(placed);
}

function allocate(s: Scenario, capacity: number, keep?: ReadonlySet<string>) {
  const { singers, spacers } = partsOf(s);
  return allocateChords(singers, spacers, { capacity, params: s.params, ...(keep ? { keep } : {}) });
}

// The oracle's read of the same board: voices clustered exactly as the
// engine clusters them — spacers conducting, like the real pass — valued
// by the independent math above.
function oracleVoicesOf(s: Scenario): Map<string, OracleVoice[]> {
  const { singers, spacers } = partsOf(s);
  const out = new Map<string, OracleVoice[]>();
  for (const cluster of chordClusters([...singers.map((x) => x.module), ...spacers])) {
    const list: OracleVoice[] = [];
    for (const module of cluster) {
      const singer = singers.find((x) => x.module.id === module.id);
      if (!singer) continue; // the spacer conducts, never sings
      const p = s.params.get(module.id) ?? { weight: 0, resonance: 0 };
      const silent = CATEGORY_OF[module.type] === "silentVoice";
      list.push({
        id: module.id,
        klass: mod12(singer.pitch),
        weight: silent ? 0 : p.weight,
        uplift: silent ? BALANCE.silentVoiceUpliftPerLevel * module.level : 0,
        resonance: p.resonance,
      });
    }
    if (list.length > 0) out.set(list.map((v) => v.id).sort().join(","), list);
  }
  return out;
}

function oracleValue(s: Scenario, capacity: number): number {
  let total = 0;
  for (const voices of oracleVoicesOf(s).values()) total += oracleBestValue(voices, capacity);
  return total;
}

function solverValue(s: Scenario, read: ReturnType<typeof allocate>, capacity: number): number {
  // Valued per cluster — each formation's instances under its own Q —
  // then summed, exactly as the board reads.
  let total = 0;
  for (const voices of oracleVoicesOf(s).values()) {
    const members = new Set(voices.map((v) => v.id));
    const instances = read.instances.filter((inst) => inst.memberIds.every((id) => members.has(id)));
    total += valueOfInstances(voices, instances, capacity);
  }
  return total;
}

const sortIds = (ids: string[]): string[] => [...ids].sort((a, b) => a.localeCompare(b));
const fifthKey = (a: string, b: string): string => `Fifth|0|${sortIds([a, b]).join(",")}`;

// ── The suites ────────────────────────────────────────────────────────

describe("whole-chord capacity allocation (#257)", () => {
  it("consumes one unit on every singing member, silent voices included, and never exceeds a budget", () => {
    // A doubled C-major shape — C·C·E·E·G·G bridged by spacers — with a
    // shared harmonizer singing G: at capacity 1 each voice sings at most
    // one instance, and the silent voice's budget binds like any other.
    const s = scenario();
    addVoice(s, "additive", { q: 0, r: 0 });
    addVoice(s, "additive", { q: 0, r: 1 });
    addVoice(s, "additive", { q: 4, r: 0 }); // E column (7·4 ≡ 4)
    addVoice(s, "additive", { q: 4, r: 1 });
    addVoice(s, "additive", { q: 1, r: 0 }); // G
    addVoice(s, "additive", { q: 1, r: 1 });
    addVoice(s, "harmonizer", { q: 1, r: 2 }, 2);
    addSpacers(s, [
      { q: 2, r: 0 },
      { q: 3, r: 0 },
      { q: 2, r: 1 },
      { q: 3, r: 1 },
      { q: 1, r: 3 },
    ]);
    const read = allocate(s, 1);
    expect(read.certified).toBe(true);
    expect(read.instances.length).toBeGreaterThan(0);
    for (const [id, used] of read.used) {
      expect(used).toBeLessThanOrEqual(1);
      expect(s.state.modules.find((m) => m.id === id)?.type).not.toBe("spacer");
    }
    for (const inst of read.instances) {
      const def = NAMED_CHORDS.find((d) => d.name === inst.name)!;
      expect(inst.memberIds.length).toBe(def.intervals.length);
    }
  });

  it("keeps the empty allocation when activating chords would reduce production", () => {
    // Classes {0,1,2,7} — semitone tension floors Q at ×0.05, so the one
    // candidate Fifth pays its members less than idling does.
    const s = scenario();
    addVoice(s, "additive", { q: 0, r: 0 }); // C
    addVoice(s, "additive", { q: 7, r: 0 }); // 7·7 ≡ 1 → C♯
    addVoice(s, "additive", { q: 2, r: 0 }); // D
    addVoice(s, "additive", { q: 1, r: 0 }); // G
    addSpacers(s, [
      { q: 3, r: 0 },
      { q: 4, r: 0 },
      { q: 5, r: 0 },
      { q: 6, r: 0 },
    ]);
    const read = allocate(s, 1);
    expect(read.certified).toBe(true);
    expect(read.instances).toHaveLength(0);
    expect(oracleValue(s, 1)).toBeCloseTo(solverValue(s, read, 1), 9);
  });

  it("matches the exhaustive oracle on duplicate voices, shared silent voices, multiple roots, unequal power, and disconnected formations", () => {
    const s = scenario();
    // Formation one: duplicate C voices with unequal power, a shared
    // harmonizer, E and G — octaves, fifths and triads across roots.
    addVoice(s, "additive", { q: 0, r: 0 }, 0, 0.1);
    addVoice(s, "additive", { q: 0, r: 1 }, 3, 0.4);
    addVoice(s, "additive", { q: 4, r: 0 }, 1, 0.2);
    addVoice(s, "additive", { q: 1, r: 0 }, 2, 0.3);
    addVoice(s, "harmonizer", { q: 1, r: 1 }, 2);
    addSpacers(s, [
      { q: 2, r: 0 },
      { q: 3, r: 0 },
      { q: 2, r: 1 },
      { q: 3, r: 1 },
    ]);
    // Formation two: a disconnected dominant shape two registers up — the
    // row gap keeps it out of formation one's adjacency (dr ≥ 2 never
    // touches).
    addVoice(s, "additive", { q: -1, r: 4 }, 0, 0.15);
    addVoice(s, "additive", { q: 3, r: 4 }, 1, 0.25);
    addVoice(s, "additive", { q: 0, r: 4 }, 0, 0.2);
    addVoice(s, "additive", { q: 6, r: 4 }, 0, 0.05);
    addSpacers(s, [
      { q: -1, r: 5 },
      { q: 0, r: 5 },
      { q: 1, r: 5 },
      { q: 2, r: 5 },
      { q: 3, r: 5 },
      { q: 1, r: 4 },
      { q: 2, r: 4 },
      { q: 4, r: 4 },
      { q: 5, r: 4 },
    ]);
    for (const capacity of [1, 2, 3, 5]) {
      const read = allocate(s, capacity);
      expect(read.certified).toBe(true);
      expect(solverValue(s, read, capacity)).toBeCloseTo(oracleValue(s, capacity), 9);
    }
  });

  it("matches the oracle across a randomized battery of small boards", () => {
    // Deterministic LCG battery: random pitch classes (duplicates and
    // silent voices included), random weights and resonance, capacities
    // one through three — every solve certified and oracle-exact.
    let seed = 20261006;
    const rng = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let trial = 0; trial < 60; trial++) {
      const s = scenario();
      const columns = [0, 1, 2, 4, 6, 7, 9, 11];
      const count = 2 + Math.floor(rng() * 4); // 2..5 voices
      for (let i = 0; i < count; i++) {
        const q = columns[Math.floor(rng() * columns.length)]!;
        const r = Math.floor(rng() * 2);
        if (s.state.modules.some((m) => m.pos && m.pos.q === q && m.pos.r === r)) continue;
        if (!s.state.cells.some((c) => c.q === q && c.r === r)) s.state.cells.push(hex(q, r));
        const silent = rng() < 0.25;
        const level = Math.floor(rng() * 3);
        if (silent) addVoice(s, "harmonizer", { q, r }, level);
        else addVoice(s, "additive", { q, r }, level, 0.05 + rng() * 0.4, rng() < 0.2 ? 0.5 : 0);
      }
      // Spacers bridge the rectangle — one connected formation.
      const minQ = Math.min(...s.state.cells.map((c) => c.q));
      const maxQ = Math.max(...s.state.cells.map((c) => c.q));
      addSpacers(
        s,
        Array.from({ length: (maxQ - minQ + 1) * 2 }, (_, i) => ({ q: minQ + (i % (maxQ - minQ + 1)), r: Math.floor(i / (maxQ - minQ + 1)) })),
      );
      const capacity = 1 + Math.floor(rng() * 3);
      const read = allocate(s, capacity);
      expect(read.certified).toBe(true);
      const ov = oracleValue(s, capacity);
      const sv = solverValue(s, read, capacity);
      if (Math.abs(ov - sv) > 1e-9) {
        console.log("DBG trial", trial, "cap", capacity, "oracle", ov, "solver", sv);
        for (const [key, cl] of oracleVoicesOf(s)) console.log("  cluster", key, cl.map((v) => `${v.id}@${v.klass}w${v.weight}${v.uplift ? "up" + v.uplift : ""}${v.resonance ? "res" + v.resonance : ""}`).join(" "));
        console.log("  solver picks", read.instances.map((i) => `${i.name}:${i.memberIds.join("+")}x${(1 + i.bonus).toFixed(3)}`).join(" | "));
      }
      expect(sv).toBeCloseTo(ov, 9);
    }
  });

  it("weighs resonance inside the objective", () => {
    // Two Fifths compete for one shared voice; equal weights, but one
    // candidate's C voice carries a resonance mutator — its pairing wins.
    const s = scenario();
    const plain = addVoice(s, "additive", { q: 0, r: 0 }, 0, 0.1);
    const resonant = addVoice(s, "additive", { q: 0, r: 1 }, 0, 0.1, 0.5);
    const shared = addVoice(s, "additive", { q: 1, r: 0 }, 0, 0.1);
    const read = allocate(s, 1);
    expect(read.certified).toBe(true);
    expect(read.instances).toHaveLength(1);
    expect(read.instances[0]!.name).toBe("Fifth");
    expect(read.instances[0]!.memberIds).toContain(resonant);
    expect(read.instances[0]!.memberIds).not.toContain(plain);
    expect(read.instances[0]!.memberIds).toContain(shared);
    expect(oracleValue(s, 1)).toBeCloseTo(solverValue(s, read, 1), 9);
  });

  it("prefers the heavier voice when weights are unequal", () => {
    // Same classes, unequal weights: the triad routes through the heavy E
    // voice, and the light C the budget cannot fit stays at exactly ×1.
    const s = scenario();
    const lightC1 = addVoice(s, "additive", { q: 0, r: 0 }, 0, 0.02);
    const lightC2 = addVoice(s, "additive", { q: 0, r: 1 }, 0, 0.02);
    const heavy = addVoice(s, "additive", { q: 4, r: 0 }, 0, 0.9);
    const partner = addVoice(s, "additive", { q: 1, r: 0 }, 0, 0.02);
    addSpacers(s, [
      { q: 2, r: 0 },
      { q: 3, r: 0 },
    ]);
    const read = allocate(s, 1);
    expect(read.certified).toBe(true);
    const heavyUses = read.instances.filter((inst) => inst.memberIds.includes(heavy));
    expect(heavyUses).toHaveLength(1);
    expect(heavyUses[0]!.name).toBe("Major triad");
    expect(heavyUses[0]!.memberIds).toContain(partner);
    const lightsIn = [lightC1, lightC2].filter((id) => heavyUses[0]!.memberIds.includes(id));
    expect(lightsIn).toHaveLength(1);
    const leftOut = [lightC1, lightC2].find((id) => !heavyUses[0]!.memberIds.includes(id))!;
    expect(read.analysis.voiceMultiplier.get(leftOut)).toBe(1);
    expect(oracleValue(s, 1)).toBeCloseTo(solverValue(s, read, 1), 9);
  });

  it("grants no partial bonuses: a losing voice keeps exactly ×1, Q and all", () => {
    // One doubled C pair and one G at capacity 1: the Fifth beats the
    // Octave, and the C voice it cannot take stays at exactly ×1 — no
    // partial chord, no orphaned Q.
    const s = scenario();
    addVoice(s, "additive", { q: 0, r: 0 }, 0, 0.1);
    addVoice(s, "additive", { q: 0, r: 1 }, 0, 0.1);
    addVoice(s, "additive", { q: 1, r: 0 }, 0, 0.1);
    const read = allocate(s, 1);
    expect(read.certified).toBe(true);
    const used = new Set([...read.used.entries()].filter(([, u]) => u > 0).map(([id]) => id));
    expect(used.size).toBe(2);
    for (const [id, factor] of read.analysis.voiceMultiplier) {
      if (!used.has(id)) expect(factor).toBe(1);
    }
    expect(oracleValue(s, 1)).toBeCloseTo(solverValue(s, read, 1), 9);
  });
});

describe("allocation stability (#257)", () => {
  function pairedFifths(): { s: Scenario; c1: string; c2: string; g1: string; g2: string } {
    // Two C voices over two G voices, all one connected formation: at
    // capacity 1 exactly two disjoint Fifths fit, and the two diagonal
    // pairings are a genuine equal-output tie.
    const s = scenario();
    const c1 = addVoice(s, "additive", { q: 0, r: 0 }, 0, 0.1);
    const c2 = addVoice(s, "additive", { q: 0, r: 1 }, 0, 0.1);
    const g1 = addVoice(s, "additive", { q: 1, r: 0 }, 0, 0.1);
    const g2 = addVoice(s, "additive", { q: 1, r: 1 }, 0, 0.1);
    return { s, c1, c2, g1, g2 };
  }

  it("retains the previous active set on equal output, then falls back stably", () => {
    const { s, c1, c2, g1, g2 } = pairedFifths();
    const first = allocate(s, 1);
    expect(first.certified).toBe(true);
    expect(first.instances).toHaveLength(2);
    // Recompute keeping the first allocation: the same instances stand.
    const kept = allocate(s, 1, new Set(first.instances.map((i) => i.key)));
    expect(kept.instances.map((i) => i.key).sort()).toEqual(first.instances.map((i) => i.key).sort());
    // Recompute keeping the other diagonal — retention wins over the
    // solver's own fallback: the previous active set is held.
    const other =
      first.instances.some((i) => i.key === fifthKey(c1, g1))
        ? [fifthKey(c1, g2), fifthKey(c2, g1)]
        : [fifthKey(c1, g1), fifthKey(c2, g2)];
    const retained = allocate(s, 1, new Set(other));
    expect(retained.instances.map((i) => i.key).sort()).toEqual([...other].sort());
  });

  it("recomputes identically from scratch — the reload guarantee", () => {
    const { s } = pairedFifths();
    const a = allocate(s, 2);
    const b = allocate(s, 2);
    expect(a.instances.map((i) => i.key)).toEqual(b.instances.map((i) => i.key));
    expect(a.used).toEqual(b.used);
    expect(a.analysis.voiceMultiplier).toEqual(b.analysis.voiceMultiplier);
  });
});

describe("the allocation seam on the real rate path (#257)", () => {
  const emptyAnalysis = (): ChordAnalysis => ({
    namedChords: [],
    voiceMultiplier: new Map(),
    formationQ: new Map(),
    namedFormation: new Map(),
    participation: new Map(),
  });

  function allocatedBoard(): { state: GameState; capacity: number } {
    // A real board with a local booster and live charge: C4 (boosted and
    // charged), G4 level 2, E4 level 1, a shared harmonizer, an infusor,
    // a focus generator holding reserve, spacers bridging the E column.
    const state = fresh();
    state.cells = [];
    state.modules = [];
    give(state, "additive", hex(0, 0), 0);
    give(state, "additive", hex(1, 0), 2);
    give(state, "additive", hex(4, 0), 1);
    give(state, "harmonizer", hex(1, 1), 2);
    give(state, "infusor", hex(0, 1), 1);
    const generator = give(state, "focusKeyed", hex(-1, 0), 1);
    generator.reserve = 3600;
    give(state, "spacer", hex(2, 0));
    give(state, "spacer", hex(3, 0));
    give(state, "spacer", hex(2, 1));
    give(state, "spacer", hex(3, 1));
    for (const pos of [
      hex(0, 0),
      hex(1, 0),
      hex(4, 0),
      hex(1, 1),
      hex(0, 1),
      hex(-1, 0),
      hex(2, 0),
      hex(3, 0),
      hex(2, 1),
      hex(3, 1),
    ]) {
      state.cells.push(pos);
    }
    return { state, capacity: 2 };
  }

  it("drives computeRates through the allocator's analysis, every leg included", () => {
    const { state, capacity } = allocatedBoard();
    // Pass zero: chordless weights through the real engine pass.
    const bare = computeRates(state, true, () => emptyAnalysis());
    const params = new Map<string, AllocationVoiceParams>();
    const placed: DeployedModule[] = state.modules.filter((m): m is DeployedModule => m.pos !== null);
    for (const module of placed) {
      if (CATEGORY_OF[module.type] !== "oscillator" && CATEGORY_OF[module.type] !== "silentVoice") continue;
      params.set(module.id, { weight: bare.contributions.get(module.id)?.value ?? 0, resonance: 0 });
    }
    // Charge and the booster leg must be inside the weights — they differ
    // per voice, so the objective would be wrong without them.
    expect(new Set([...params.values()].map((p) => p.weight)).size).toBeGreaterThan(1);
    // The allocated pass over the same real engine.
    const { singers, spacers } = partitionVoices(placed);
    const read = allocateChords(singers, spacers, { capacity, params });
    expect(read.certified).toBe(true);
    const snapshot = computeRates(state, true, () => read.analysis);
    // Figures sum to the rate (ADR-0036's discipline holds through the seam).
    expect(sumSynthValues(snapshot)).toBeCloseTo(snapshot.rate, 9);
    // Participation is used capacity, per voice; budgets hold.
    for (const [id, used] of read.used) {
      expect(used).toBeLessThanOrEqual(capacity);
      expect(read.analysis.participation.get(id)).toBe(used);
    }
    // The rate equals the independently weighted objective: every voice's
    // chordless real value times its allocated factor (Q included,
    // unallocated exactly ×1) — charge, booster and the global boosts in.
    let expected = 0;
    for (const module of placed) {
      if (CATEGORY_OF[module.type] !== "oscillator") continue;
      expected += bare.contributions.get(module.id)!.value * (read.analysis.voiceMultiplier.get(module.id) ?? 1);
    }
    expect(snapshot.rate).toBeCloseTo(expected, 9);
    // The uncapped default would have stacked more instances than the
    // capacity allows — the seam demonstrably bounds it.
    const uncapped = computeRates(state, true);
    const uncappedTotal = uncapped.namedChords.reduce((total, chord) => total + chord.instances, 0);
    expect(read.instances.length).toBeLessThan(uncappedTotal);
  });

  it("leaves the default production path untouched", () => {
    // The seam is opt-in: with no chord pass, computeRates is exactly the
    // uncapped recognizer it has always been (ADR-0049 behavior).
    const state = fresh();
    give(state, "additive", hex(1, 0));
    const snapshot = computeRates(state, true);
    expect(snapshot.namedChords.map((c) => `${c.name}×${c.instances}`)).toEqual(["Fifth×1"]);
    expect(snapshot.contributions.get("m1")?.chordFactor).toBeCloseTo((1 + 0.3) * (1 + BALANCE.complexityRate), 9);
  });
});
