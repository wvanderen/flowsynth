import { advance } from "./advance";
import { endBreather, endSession, startBreather, startSession } from "./actions";
import { allocationMemoStats, allocateRates, displayedRates, investment, sessionClockOf } from "./economy";
import { createInitialState, createModule } from "./state";
import { seededRng } from "./capacity-calibration";
import { writeNote } from "./notes";
import { applyBreatherGap } from "./trust";
import { hex } from "./hex";
import { createHabit, selectHabit } from "./habits";
import { productionClockFactorOf } from "./profiles";
import { CATEGORY_OF } from "./constants";
import type { GameState, ModuleType } from "./types";

// The breather's production-economy calibration harness (issue #417): the
// three-time-kind arc the breather spec describes — flow practice, paid
// rest, upgrade quiet — run twice over identical representative boards,
// once taking the minted breather and once declining it. Every figure the
// pass reads comes through the engine's own actions and walks; the only
// fixture work is the roster seats themselves (the profile waves' niche
// method — the shape, never the wealth, is what a niche prices). The
// measurements are provisional tuning, recorded in
// docs/breather-tuning.md.

// The reference session the spec's own example names: 25 credited minutes
// mint a 5-minute breather at the 1:5 divisor. A warmup session precedes
// the measured one, so every flow leg reads a board in its steady arc —
// reserves banked, feats earned — never the first-session cold start. The
// next session runs 30 minutes, its first five the opening window the
// boundary pacing reads.
export const ARC_SESSION_SECONDS = 1500;
export const ARC_NEXT_SESSION_SECONDS = 1800;
export const ARC_OPENING_SECONDS = 300;
// The wall-clock stamp the breather starts at — arbitrary, fixed, so the
// arc's joins land on the same solves every run.
export const ARC_BREATHER_START = 1000;
const STEP = 60;
export const NOTE_TEXT = "keep the shoulders down and the wrist loose through the scale run";

// One niche board: fixture seats on real cells (a level when the niche's
// weight needs one). The opening Sine stays at the origin unless the
// builder adds around it.
export type BoardBuilder = (state: GameState) => void;

function place(state: GameState, type: ModuleType, q: number, r: number, level = 0): void {
  const module = { ...createModule(state, type), pos: hex(q, r) };
  if (level > 0) {
    module.level = level;
    module.invested = investment(level);
  }
  state.modules.push(module);
}

function seat(state: GameState, q: number, r: number): void {
  const pos = hex(q, r);
  if (!state.cells.some((cell) => cell.q === pos.q && cell.r === pos.r)) state.cells.push(pos);
}

// ── The sample niches ────────────────────────────────────────────────

// The naked board: the opening Sine alone — the first breather a player
// can ever take lives here, on a board with no charge economy at all.
export const NAKED: BoardBuilder = () => {};

// The starter niche: the shelf trio around the Sine — the Flywheel feeding
// it charge, the Forge turning on that charge, the Booster amplifying the
// voice. The board the first real breathers ride.
export const STARTER: BoardBuilder = (state) => {
  place(state, "focusKeyed", 1, 0);
  place(state, "forge", 1, 1);
  place(state, "infusor", 0, 1);
  seat(state, 1, 1);
};

// The charged niche: the Saw's home — the charge specialist fed steadily,
// the board shape the profile wave authored the ×3 delta for.
export const CHARGED: BoardBuilder = (state) => {
  place(state, "saw", 0, 1);
  place(state, "focusKeyed", 1, 0);
  place(state, "infusor", 1, 1);
  seat(state, 1, 1);
};

// The temporal niche: the Afterglow and a Sine in an Octave on the
// Pulsewell's burst cycle — the two designs the boundary pacing criterion
// names, warm and cycling across the flow → breather → next-session arc.
export const TEMPORAL: BoardBuilder = (state) => {
  place(state, "afterglow", 0, 1);
  place(state, "pulsewell", 1, 0);
};

// The responder niche: every launch responder in one formation beside the
// Sine's absent mark — the maximum-launch-boost board, where the spread's
// top end reads.
export const RESPONDERS: BoardBuilder = (state) => {
  place(state, "triangle", 1, 0);
  place(state, "square", 0, 1);
  place(state, "saw", 1, 1);
  place(state, "afterglow", 0, 2);
  place(state, "sideband", 1, 2);
  seat(state, 1, 1);
  seat(state, 0, 2);
  seat(state, 1, 2);
};

// The specialist niche: #416's wave beside a Flywheel — the S-band
// signatures the launch spread must stay clearly under, read on the same
// arc the responder niche rides.
export const SPECIALISTS: BoardBuilder = (state) => {
  place(state, "release", 1, 0);
  place(state, "standby", 0, 1);
  place(state, "tail", 1, 1);
  place(state, "focusKeyed", 0, 2);
  seat(state, 1, 1);
  seat(state, 0, 2);
};

// The re-pick niche: a contended voice between a Fifth (the upgrade-quiet
// and drained optimum) and a charged, breathing Flat seventh (the
// breather's) — the board where the mode join genuinely re-picks.
export const REPICK: BoardBuilder = (state) => {
  place(state, "additive", 1, 0, 3); // G4 — the Fifth partner's weight
  place(state, "spacer", -1, 0); // conducts the wire
  place(state, "afterglow", -2, 0); // B♭4 — the charged Flat seventh voice
  place(state, "pulsewell", -3, 0); // feeds the Afterglow alone
  seat(state, -1, 0);
  seat(state, -2, 0);
  seat(state, -3, 0);
};

// ── The arc ──────────────────────────────────────────────────────────

export interface ArcLeg {
  // The flow session: earned nous and the mean credited ν/s.
  sessionEarned: number;
  flowNuPerSecond: number;
  // Generator reserves at close, after endSession's focus bank.
  reservesAtClose: number;
  // The breather leg, zeros on the declined control.
  allowanceSeconds: number;
  breatherEarned: number;
  // The breather's boosted yield per minute — the figure the note states
  // per sample board.
  breatherNuPerMinute: number;
  // Boosted yield per minted minute over the minting session's mean:
  // above 1 means the paid minute out-produces the practice minute.
  boostedPerMintedMinute: number;
  // The breather's whole yield against the session that minted it.
  dwarfRatio: number;
  // Forge meters turned during the breather: the raw progress the meters
  // gained and the roll crossings it banked.
  forgeProgressDuringBreather: number;
  forgeRollsDuringBreather: number;
  // The allocation joins: memo solves at the mode change in, across the
  // breather's steady steps, and at the ending mode change.
  joinSolves: number;
  steadySolves: number;
  endSolves: number;
  // The active chord keys at flow's close and after the join (the re-pick
  // read), how many times they moved mid-breather (the thrash read), and
  // whether the retained solve ever fell short of a cold one (the
  // equal-output read).
  flowKeys: string[];
  breatherKeys: string[];
  keyMoves: number;
  keySets: number;
  retainedExact: boolean;
  // The next session: reserves at open, the opening window's earn, the
  // whole session's earn.
  nextReservesAtOpen: number;
  nextOpeningEarned: number;
  nextSessionEarned: number;
  // The departed clock the breather left behind (0 when declined), the
  // Afterglow's clock factor there, at the break's end, and at the next
  // open.
  clockAfterBreather: number;
  afterglowDuringBreather: number;
  afterglowAtBreatherEnd: number;
  afterglowAtNextOpen: number;
  // Per-oscillator ν/s at flow's close and at the breather's open — the
  // per-voice response read the spread validation quotes.
  voiceFlow: Record<string, number>;
  voiceBreather: Record<string, number>;
}

export interface ArcPair {
  taken: ArcLeg;
  declined: ArcLeg;
}

function activeKeys(state: GameState): string[] {
  const rates = displayedRates(state);
  return rates.allocation ? [...rates.allocation.activeKeys].sort() : [];
}

function voiceValues(state: GameState): Record<string, number> {
  const read: Record<string, number> = {};
  for (const contribution of displayedRates(state).contributions.values()) {
    const module = state.modules.find((m) => m.id === contribution.moduleId);
    if (module && module.pos !== null) read[module.type] = contribution.value;
  }
  return read;
}

function runLeg(board: BoardBuilder, seed: number, take: boolean): ArcLeg {
  const state = createInitialState();
  board(state);
  const habit = createHabit(state, "Calibration");
  if (habit.ok && habit.habit) selectHabit(state, habit.habit.id);
  const rng = seededRng(seed);

  const session = (): number => {
    startSession(state, null, 0);
    writeNote(state, NOTE_TEXT);
    let earned = 0;
    for (let step = 0; step < ARC_SESSION_SECONDS / STEP; step++) {
      earned += advance(state, STEP, rng).nousEarned;
    }
    endSession(state, ARC_SESSION_SECONDS);
    return earned;
  };

  // The warmup session: the arc's steady state, never measured.
  session();
  // The minting session: live present time in one-minute steps, one note
  // written — the ordinary session shape. The per-voice read happens
  // inside the session, on the charged, warm basis the breather follows.
  startSession(state, null, 0);
  writeNote(state, NOTE_TEXT);
  let sessionEarned = 0;
  for (let step = 0; step < ARC_SESSION_SECONDS / STEP; step++) {
    sessionEarned += advance(state, STEP, rng).nousEarned;
  }
  const voiceFlow = voiceValues(state);
  endSession(state, ARC_SESSION_SECONDS);
  const flowNuPerSecond = sessionEarned / ARC_SESSION_SECONDS;
  const reservesAtClose = reserveSum(state);
  const allowance = state.summary?.breatherAllowance ?? 0;
  // The upgrade-quiet read — the allocation the console shows between
  // sessions, and the basis the join re-picks from.
  const flowKeys = activeKeys(state);

  const leg: ArcLeg = {
    sessionEarned,
    flowNuPerSecond,
    reservesAtClose,
    allowanceSeconds: allowance,
    breatherEarned: 0,
    breatherNuPerMinute: 0,
    boostedPerMintedMinute: 0,
    dwarfRatio: 0,
    forgeProgressDuringBreather: 0,
    forgeRollsDuringBreather: 0,
    joinSolves: 0,
    steadySolves: 0,
    endSolves: 0,
    flowKeys,
    breatherKeys: flowKeys,
    keyMoves: 0,
    keySets: 1,
    retainedExact: true,
    nextReservesAtOpen: 0,
    nextOpeningEarned: 0,
    nextSessionEarned: 0,
    clockAfterBreather: 0,
    afterglowDuringBreather: 1,
    afterglowAtBreatherEnd: 1,
    afterglowAtNextOpen: 1,
    voiceFlow,
    voiceBreather: voiceFlow,
  };

  if (take && allowance > 0) {
    // The join: exactly one re-solve at the mode change, read on the
    // display basis the UI renders through.
    const before = allocationMemoStats.solves;
    startBreather(state, ARC_BREATHER_START);
    leg.breatherKeys = activeKeys(state);
    leg.voiceBreather = voiceValues(state);
    leg.joinSolves = allocationMemoStats.solves - before;
    leg.afterglowDuringBreather = productionClockFactorOf("afterglow", sessionClockOf(state));
    const forgeBefore = state.forge.progress + state.forge.earned;
    let breatherEarned = 0;
    let previousKeys = leg.breatherKeys.join("|");
    const seenSets = new Set<string>([previousKeys]);
    for (;;) {
      const steadyBefore = allocationMemoStats.solves;
      const applied = applyBreatherGap(state, STEP, rng);
      displayedRates(state);
      leg.steadySolves += allocationMemoStats.solves - steadyBefore;
      const keys = activeKeys(state).join("|");
      if (keys !== previousKeys) {
        leg.keyMoves++;
        seenSets.add(keys);
        previousKeys = keys;
      }
      // Equal-output retention: the retained solve never falls short of a
      // cold one on the same inputs.
      const cold = allocateRates(state, true, { keep: new Set() });
      if (displayedRates(state).rate < cold.snapshot.rate - 1e-9) leg.retainedExact = false;
      breatherEarned += applied.result.nousEarned;
      leg.forgeRollsDuringBreather += applied.result.rollsForge;
      if (applied.completed) break;
    }
    leg.keySets = seenSets.size;
    leg.forgeProgressDuringBreather = state.forge.progress + state.forge.earned - forgeBefore;
    leg.breatherEarned = breatherEarned;
    leg.breatherNuPerMinute = (breatherEarned / allowance) * 60;
    leg.boostedPerMintedMinute = breatherEarned / allowance / flowNuPerSecond;
    leg.dwarfRatio = breatherEarned / sessionEarned;
    leg.clockAfterBreather = sessionClockOf(state);
    leg.afterglowAtBreatherEnd = productionClockFactorOf("afterglow", sessionClockOf(state));

    const endBefore = allocationMemoStats.solves;
    endBreather(state);
    displayedRates(state);
    leg.endSolves = allocationMemoStats.solves - endBefore;
  }

  // The next session: the opening window read separately, then the
  // remaining 25 minutes.
  leg.nextReservesAtOpen = reserveSum(state);
  startSession(state, null, 0);
  leg.afterglowAtNextOpen = productionClockFactorOf("afterglow", sessionClockOf(state));
  writeNote(state, NOTE_TEXT);
  for (let step = 0; step < ARC_OPENING_SECONDS / STEP; step++) {
    leg.nextOpeningEarned += advance(state, STEP, rng).nousEarned;
  }
  for (let step = 0; step < (ARC_NEXT_SESSION_SECONDS - ARC_OPENING_SECONDS) / STEP; step++) {
    leg.nextSessionEarned += advance(state, STEP, rng).nousEarned;
  }
  leg.nextSessionEarned += leg.nextOpeningEarned;
  endSession(state, ARC_NEXT_SESSION_SECONDS);
  return leg;
}

function reserveSum(state: GameState): number {
  return state.modules.reduce((total, module) => total + (module.pos !== null ? module.reserve : 0), 0);
}

export function runArcPair(board: BoardBuilder, seed: number): ArcPair {
  return { taken: runLeg(board, seed, true), declined: runLeg(board, seed, false) };
}

// The deployed generator's reserve after `seconds` more of breather — the
// drain-rate read. The bank landed at close (the focus window); what the
// sample reads back is the strength the breather really spent.
export function generatorReserveAfter(state: GameState, seconds: number, rng: () => number): number {
  applyBreatherGap(state, seconds, rng);
  const generator = state.modules.find((module) => module.pos !== null && CATEGORY_OF[module.type] === "generator");
  return generator?.reserve ?? 0;
}
