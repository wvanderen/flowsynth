import { BALANCE } from "./constants";
import { chordClusters, formationQuality, formationTension, type Singer } from "./chords";
import { hex } from "./hex";
import { ALLOCATION_QUALITY_BOUNDS, allocateChords, type AllocationRead, type AllocationVoiceParams } from "./allocation";
import type { DeployedModule, ModuleType } from "./types";

// The repeatable stress comparison (issue #257): whole-chord allocation
// across the supported board's sizes — doubled-triad formations scaled to
// the 72-voice upper bound, monolithic chromatic masses, and a silent-
// voice mix — at capacities one through five, through the one allocator
// the development board rides. Each row records the solve honestly:
// candidates recognized (never truncated), wall time, and whether
// optimality was certified within the budget — a row that trips the
// budget says so; it never claims certification it did not earn.

// The stress budget: the deterministic node cap is the binding limit —
// enough nodes to certify every structured board at any supported size —
// and the clock valve sits far above it so certification flags never
// depend on machine speed, however loaded the runner.
export const STRESS_BUDGET = { maxNodes: 250_000, maxMs: 30_000 };

export interface StressFixture {
  name: string;
  singers: Singer[];
  spacers: DeployedModule[];
  params: Map<string, AllocationVoiceParams>;
}

export interface StressRow {
  fixture: string;
  voices: number;
  capacity: number;
  clusters: number;
  candidates: number;
  instances: number;
  certified: boolean;
  ms: number;
  value: number;
}

export type StressProgress = { row: StressRow } | { done: true } | { error: string };

let nextId = 1;

function stressModule(type: ModuleType, pos: { q: number; r: number }, level: number): DeployedModule {
  return {
    id: `s${nextId++}`,
    type,
    rarity: "common",
    level,
    invested: 0,
    pos: hex(pos.q, pos.r),
    reserve: 0,
    shift: null,
  };
}

// A voice's weight stands in for its full chordless final ν/s: the same
// shape the real rate pass produces (synthRate × rarityPower^level here;
// the development board threads the real engine's figures).
function weightOf(level: number, uniform: boolean): number {
  return BALANCE.synthRate * BALANCE.rarityPower.common ** (uniform ? 0 : level);
}

// One doubled-triad formation — C·C·E·E·G·G bridged by spacers, the
// economy's densest clean shape — parked at column `base`, rows 0–1. Each
// cluster recognizes 15 complete voice-sets (three Octaves, four Fifths,
// eight Major triads) and scores the clean ×1.12 quality.
function triadCluster(fixture: StressFixture, base: number, levels: number[], uniform: boolean): void {
  const seats = [
    [0, 0],
    [0, 1],
    [4, 0],
    [4, 1],
    [1, 0],
    [1, 1],
  ];
  seats.forEach(([q, r], i) => {
    const module = stressModule("additive", { q: base + q, r }, levels[i] ?? 0);
    fixture.singers.push({ module, pitch: 60 + 7 * (base + q) + 12 * r });
    fixture.params.set(module.id, { weight: weightOf(levels[i] ?? 0, uniform), resonance: 0 });
  });
  for (const q of [2, 3]) {
    for (const r of [0, 1]) {
      fixture.spacers.push(stressModule("spacer", { q: base + q, r }, 0));
    }
  }
}

export function triadBoard(clusters: number, uniform: boolean): StressFixture {
  const fixture: StressFixture = { name: "", singers: [], spacers: [], params: new Map() };
  for (let c = 0; c < clusters; c++) {
    triadCluster(fixture, c * 7, [0, 1, 2, 3, 1, 0], uniform);
  }
  fixture.name = `triads-${clusters * 6}${uniform ? "" : "-unequal"}`;
  return fixture;
}

// The monolithic chromatic mass: every pitch class voiced ⌈n/12⌉ times on
// one connected grid — semitone tension floors Q at ×0.5, so activation
// trades against idleness and the candidate count explodes combinatorially
// (the 72-voice case recognizes 60,660 voice-sets). The deliberately
// pathological upper bound.
export function chromaticBoard(voices: number, uniform = true, silentCount = 0): StressFixture {
  const fixture: StressFixture = {
    name: `chromatic-${voices}${uniform ? "" : "-unequal"}${silentCount ? "-silent" : ""}`,
    singers: [],
    spacers: [],
    params: new Map(),
  };
  const silentStep = silentCount > 0 ? Math.max(2, Math.floor(voices / silentCount)) : 0;
  for (let i = 0; i < voices; i++) {
    const q = i % 12;
    const r = Math.floor(i / 12);
    const level = uniform ? 0 : i % 4;
    const type: ModuleType = silentStep > 0 && i % silentStep === 0 ? "harmonizer" : "additive";
    const module = stressModule(type, { q, r }, level);
    fixture.singers.push({ module, pitch: 60 + 7 * q + 12 * r });
    fixture.params.set(module.id, { weight: type === "harmonizer" ? 0 : weightOf(level, uniform), resonance: 0 });
  }
  return fixture;
}

export function stressFixtures(): StressFixture[] {
  const fixtures: StressFixture[] = [];
  for (const clusters of [1, 2, 4, 8, 12]) fixtures.push(triadBoard(clusters, true));
  fixtures.push(triadBoard(12, false));
  for (const voices of [6, 12, 24, 48, 72]) fixtures.push(chromaticBoard(voices));
  fixtures.push(chromaticBoard(72, false));
  fixtures.push(chromaticBoard(72, true, 6));
  return fixtures;
}

// Connected-formation count over a fixture's singers and spacers — the
// engine's own clustering, reused.
function countClusters(fixture: StressFixture): number {
  return chordClusters([...fixture.singers.map(({ module }) => module), ...fixture.spacers]).length;
}

// The allocation's objective value, recomputed from the returned instances
// — the row's `value` never trusts the solver's own figure. The per-voice
// factor is Π(1+bonus) × Q when participating (Q per formation, from
// BALANCE exactly as the engine scores it), exactly 1 otherwise. Every
// stress fixture family spans one class set per formation, so one Q read
// covers the triad boards' identical formations and the monoliths' single
// formation alike.
export function totalValueOf(fixture: StressFixture, read: AllocationRead): number {
  const product = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const inst of read.instances) {
    for (const id of inst.memberIds) {
      product.set(id, (product.get(id) ?? 1) * (1 + inst.bonus));
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const classes = [...new Set(fixture.singers.map(({ pitch }) => ((Math.round(pitch) % 12) + 12) % 12))];
  const q = read.instances.length > 0 ? formationQuality(classes, formationTension(classes), true, ALLOCATION_QUALITY_BOUNDS) : 1;
  let total = 0;
  for (const { module } of fixture.singers) {
    const { weight } = fixture.params.get(module.id)!;
    const active = (counts.get(module.id) ?? 0) > 0;
    total += active ? weight * q * (product.get(module.id) ?? 1) : weight;
  }
  return total;
}

export function runAllocationStress(onRow?: (row: StressRow) => void): StressRow[] {
  const rows: StressRow[] = [];
  for (const fixture of stressFixtures()) {
    const clusters = countClusters(fixture);
    for (const capacity of [1, 2, 3, 4, 5]) {
      const read = allocateChords(fixture.singers, fixture.spacers, {
        capacity,
        params: fixture.params,
        budget: STRESS_BUDGET,
      });
      const row: StressRow = {
        fixture: fixture.name,
        voices: fixture.singers.length,
        capacity,
        clusters,
        candidates: read.recognized,
        instances: read.instances.length,
        certified: read.certified,
        ms: read.ms,
        value: totalValueOf(fixture, read),
      };
      rows.push(row);
      onRow?.(row);
    }
  }
  return rows;
}
