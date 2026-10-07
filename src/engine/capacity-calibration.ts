import { ARETE_HORIZON } from "./accumulator";
import { advance } from "./advance";
import {
  buyCapacity,
  buyCapacityCeiling,
  buyCapacityDiscount,
  buyCell,
  buyShelfModule,
  chooseRoll,
  endSession,
  placeModule,
  prestige,
  startSession,
  upgradeAll,
  upgradeModuleLevels,
} from "./actions";
import { nextCapacityPrice } from "./capacity";
import { CATEGORY_OF, isOscillatorType } from "./constants";
import { allocateRates, levelCost, setAllocationEnabled, wholeNous } from "./economy";
import { createGoal, deleteGoal } from "./goals";
import { neighbors, sameHex } from "./hex";
import { octaveRowOf, positionInRange } from "./lattice";
import { writeNote } from "./notes";
import { createInitialState } from "./state";
import type { GameState, Hex } from "./types";

// The harmonic-capacity calibration harness (issue #262): the authoritative
// progression run — real purchases, rolls, charge, practice advancement and
// prestige through the engine's own actions, with the allocation model
// enabled so every rate reads the whole-chord selector — repeatable across
// seeds and policies. The horizon never influences within-era behavior
// (prestige only fires at the crossing), so one run records its full
// (minute, eraEarned) trajectory and capacity milestones, and candidate
// horizons read against that record; the adopted tuning's final evidence
// re-runs true multi-era progressions, where each prestige's moment really
// shapes the next era's starting board.

export type CalibrationShape = "compact" | "fifths";

export interface CalibrationPolicy {
  name: string;
  shape: CalibrationShape;
  // Buy every affordable capacity rung at each management break.
  capacity: "prompt";
  // Buy the cheapest affordable Arete offering at each management break.
  arete: "prompt" | "never";
  // modest: at most one shelf purchase and two cells per break, the rest
  // to levels. aggressive: every affordable shelf purchase and cell, then
  // levels.
  expansion: "modest" | "aggressive";
  // sweep: five-level gestures, cheapest voice first; all: the bulk
  // ladder across every voice, holding half the bank in reserve while a
  // rung stands unsold — the saving posture that lets the
  // ceiling-unlocked rungs actually sell.
  upgrades: "sweep" | "all";
}

export const ORDINARY: CalibrationPolicy = {
  name: "ordinary",
  shape: "compact",
  capacity: "prompt",
  arete: "prompt",
  expansion: "modest",
  upgrades: "sweep",
};

// The pushy policy: ordinary's level gestures, but every affordable cell
// each break — the acquisition-hungry variant that maps the cell curve's
// real cost.
export const PUSHY: CalibrationPolicy = {
  name: "pushy",
  shape: "compact",
  capacity: "prompt",
  arete: "prompt",
  expansion: "aggressive",
  upgrades: "sweep",
};

export const AGGRESSIVE: CalibrationPolicy = {
  name: "aggressive",
  shape: "compact",
  capacity: "prompt",
  arete: "prompt",
  expansion: "aggressive",
  upgrades: "all",
};

export function seededRng(seed: number): () => number {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// The expansion frontier — compact hugs the start register; fifths chases
// the circle of fifths across octave rows.
export function frontier(state: GameState, shape: CalibrationShape): Hex[] {
  const unique = new Map<string, Hex>();
  for (const cell of state.cells) for (const pos of neighbors(cell)) {
    if (positionInRange(state, pos) && !state.cells.some((c) => sameHex(c, pos))) unique.set(`${pos.q},${pos.r}`, pos);
  }
  return [...unique.values()].sort((a, b) => {
    const score = (p: Hex) => shape === "compact"
      ? Math.abs(p.q) * 4 + Math.abs(octaveRowOf(p))
      : Math.abs(octaveRowOf(p)) * 12 + Math.abs(p.q);
    return score(a) - score(b) || a.q - b.q || a.r - b.r;
  });
}

export interface CapacityMilestone {
  rung: number;
  // Credited practice minutes since the era began.
  minute: number;
  // The board's whole-board rate immediately before and after the
  // purchase — the optimization opportunity the rung opened, measured on
  // the board as the player actually held it.
  rateBefore: number;
  rateAfter: number;
}

export interface EraTrajectory {
  era: number;
  // (credited minute, eraEarned) at every minute step — the post-hoc
  // horizon read.
  earned: { minute: number; value: number }[];
  milestones: CapacityMilestone[];
  // End-of-era reads (or at the cap when the horizon never crossed).
  minutes: number;
  cells: number;
  voices: number;
  capacityBought: number;
  nous: number;
}

export interface EraRunOptions {
  // The run stops after this many 30-minute sessions even without a
  // crossing (the generous cap that lets one run serve many horizons).
  maxSessions: number;
  // The advance step in seconds. Production is exact at any step (the
  // walk splits at reserve and goal boundaries internally); only the
  // crossing's granularity coarsens. Search sweeps use 120; the adopted
  // evidence uses 60.
  stepSeconds?: number;
  // Search-phase horizon: the era ends at this crossing instead of the
  // adopted one. The prestige boundary then lands on the real action by
  // reading the era measure at the real horizon — exact for at-threshold
  // resets, whose claim is the era count alone — so a candidate horizon
  // never forks the engine's semantics. Final evidence runs without it.
  horizonOverride?: number;
}

const SESSION_SECONDS = 1800;
const NOTE_TEXT = "keep the shoulders down and the wrist loose through the scale run";

// One management break, allocation-aware: the policy's purchases,
// placements scored by the authoritative preview, level gestures, and the
// capacity and Arete ladders. Returns the capacity milestones recorded
// here.
function manage(state: GameState, policy: CalibrationPolicy, minute: number): CapacityMilestone[] {
  const milestones: CapacityMilestone[] = [];
  // Accept an oscillator when offered; otherwise a keyed generator —
  // otherwise keep the first candidate.
  for (const offer of [...state.bankedRolls]) {
    const candidate =
      offer.candidates.find((c) => isOscillatorType(c.type)) ??
      offer.candidates.find((c) => CATEGORY_OF[c.type] === "generator") ??
      offer.candidates[0];
    if (candidate) chooseRoll(state, offer.id, candidate.id);
  }
  // One small goal tracked at all times, re-minted each break (the sim
  // compresses days; a completed daily never rolls over). Completing it
  // is the Goal Generator's console fact (ADR-0047) — the pool's keyed
  // generators earn their reserves through play, never for free.
  for (const goal of [...state.goals]) deleteGoal(state, goal.id);
  createGoal(state, { habitId: null, minutes: 25, schedule: "once", now: 0 });
  // Shelf and cell purchases.
  for (const type of ["generator", "forge", "infusor"] as const) {
    if (!state.purchased[type] && (policy.expansion === "aggressive" || type === "generator")) {
      buyShelfModule(state, type);
      if (policy.expansion === "modest") break;
    }
  }
  const cellsPerBreak = policy.expansion === "modest" ? 2 : Infinity;
  for (let i = 0; i < cellsPerBreak; i++) {
    const pos = frontier(state, policy.shape)[0];
    if (!pos || !buyCell(state, pos).ok) break;
  }
  // Preview-driven placement over the vacancies — the authoritative
  // allocation read scores each candidate seat, so the capacity era's
  // organized placements are the ones the policy actually prefers.
  for (const module of [...state.modules].sort((a, b) => Number(isOscillatorType(b.type)) - Number(isOscillatorType(a.type)))) {
    if (module.pos !== null) continue;
    const vacancies = state.cells.filter((c) => !state.modules.some((m) => m.pos && sameHex(m.pos, c)));
    let best: Hex | undefined;
    let bestScore = -1;
    for (const pos of vacancies) {
      module.pos = pos;
      const rates = allocateRates(state, true);
      const score = rates.snapshot.rate + rates.snapshot.forgeRate;
      if (score > bestScore) { bestScore = score; best = pos; }
    }
    module.pos = null;
    if (best) placeModule(state, module.id, best);
  }
  // The harmonic-capacity ladder comes before the level gestures: a
  // player watching the Catalog buys the milestone before sinking the
  // bank into levels — the ladder-first order is what lets the
  // ceiling-unlocked rungs actually sell. Each milestone records the
  // optimization opportunity the purchase opened.
  for (;;) {
    if (nextCapacityPrice(state) === null) break;
    const before = allocateRates(state, true).snapshot.rate;
    if (!buyCapacity(state).ok) break;
    const after = allocateRates(state, true).snapshot.rate;
    milestones.push({ rung: state.capacityBought, minute, rateBefore: before, rateAfter: after });
  }
  // Level gestures: the modest player sweeps five-level gestures over the
  // deployed voices, cheapest first; the aggressive player runs the bulk
  // ladder across every voice — holding half the bank back while the
  // capacity ladder still has a rung for sale, the war chest that lets
  // the top rungs sell before prestige wipes the bank.
  if (policy.upgrades === "sweep") {
    const voices = state.modules.filter((m) => m.pos && isOscillatorType(m.type)).sort((a, b) => a.level - b.level);
    for (const module of voices) upgradeModuleLevels(state, module.id, 5);
  } else if (nextCapacityPrice(state) !== null) {
    const warChest = Math.floor(wholeNous(state) / 2);
    let spent = 0;
    let guard = 0;
    while (spent < warChest && guard++ < 500) {
      const voice = state.modules
        .filter((m) => m.pos !== null && m.type !== "spacer")
        .sort((a, b) => a.level - b.level)[0]!;
      const price = levelCost(voice.level);
      if (spent + price > warChest) break;
      if (!upgradeModuleLevels(state, voice.id, 1).ok) break;
      spent += price;
    }
  } else {
    upgradeAll(state, "max");
  }
  // The Arete offerings: the cheapest affordable one each break —
  // discounts price under the ceilings by design, and they order the
  // purchases.
  if (policy.arete === "prompt") {
    for (;;) {
      if (buyCapacityDiscount(state).ok) continue;
      if (buyCapacityCeiling(state).ok) continue;
      break;
    }
  }
  return milestones;
}

// One era: sessions of credited practice until the horizon crosses (or
// the session cap). Minute steps bound the crossing to within one minute
// of credited play.
export function runEra(
  state: GameState,
  rng: () => number,
  policy: CalibrationPolicy,
  era: number,
  opts: EraRunOptions,
): EraTrajectory {
  const stepSeconds = opts.stepSeconds ?? 60;
  const earned: { minute: number; value: number }[] = [];
  const milestones: CapacityMilestone[] = [];
  let minutes = 0;
  for (let session = 1; session <= opts.maxSessions; session++) {
    milestones.push(...manage(state, policy, minutes));
    startSession(state, SESSION_SECONDS, (session - 1) * SESSION_SECONDS);
    writeNote(state, NOTE_TEXT);
    for (let step = 1; step <= SESSION_SECONDS / stepSeconds; step++) {
      advance(state, stepSeconds, rng);
      minutes += stepSeconds / 60;
      earned.push({ minute: minutes, value: state.eraEarned });
    }
    endSession(state, session * SESSION_SECONDS);
    if (state.eraEarned >= (opts.horizonOverride ?? ARETE_HORIZON)) break;
  }
  return {
    era,
    earned,
    milestones,
    minutes,
    cells: state.cells.length,
    voices: state.modules.filter((m) => m.pos && isOscillatorType(m.type)).length,
    capacityBought: state.capacityBought,
    nous: state.nous,
  };
}

export interface ProgressionOptions extends EraRunOptions {
  eras: number;
}

export interface ProgressionRecord {
  seed: number;
  policy: string;
  eras: EraTrajectory[];
  claims: number[];
  areteSpent: { ceilings: number; discounts: number };
  totalMinutes: number;
}

// A full progression: fresh state, allocation enabled, eras until the cap
// or the era count. Each prestige fires at the crossing and banks the
// live claim; the Arete offerings ride the following era's breaks.
export function runProgression(seed: number, policy: CalibrationPolicy, opts: ProgressionOptions): ProgressionRecord {
  const state = createInitialState();
  setAllocationEnabled(state, true);
  const rng = seededRng(seed);
  const eras: EraTrajectory[] = [];
  const claims: number[] = [];
  const owned = { ceilings: state.capacityCeilings, discounts: state.capacityDiscounts };
  for (let era = 1; era <= opts.eras; era++) {
    const trajectory = runEra(state, rng, policy, era, opts);
    eras.push(trajectory);
    if (state.eraEarned < (opts.horizonOverride ?? ARETE_HORIZON)) break;
    if (opts.horizonOverride !== undefined) state.eraEarned = ARETE_HORIZON;
    const before = state.arete;
    if (!prestige(state).ok) throw new Error("prestige failed at the horizon");
    claims.push(state.arete - before);
  }
  return {
    seed,
    policy: policy.name,
    eras,
    claims,
    areteSpent: { ceilings: state.capacityCeilings - owned.ceilings, discounts: state.capacityDiscounts - owned.discounts },
    totalMinutes: eras.reduce((total, era) => total + era.minutes, 0),
  };
}

// The crossing minute of a recorded trajectory under a candidate horizon —
// the post-hoc read that lets one long era serve horizon comparisons.
export function crossingMinute(trajectory: EraTrajectory, horizon: number): number | null {
  const hit = trajectory.earned.find((point) => point.value >= horizon);
  return hit ? hit.minute : null;
}
