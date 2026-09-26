// The achievement framework (ADR-0015, §6.3): a static, pure registry of
// feats — definitions live in code, never in the save; the save stores only
// `id → unlockedAt`. Feats accelerate, never gate: each adds ~+2% (tuning)
// into the single global achievementBoost term of the nous rate. Detection
// is live: syncAchievements runs at action boundaries and session ticks,
// and nothing can unlock during session one. In-session unlocks queue into
// the session's unlocked list (the summary's "unlocked this session" row);
// upgrade-mode unlocks return to the caller for toasting.
import { BALANCE, CATEGORY_OF } from "./constants";
import { analyzeChords } from "./chords";
import { isInFlowNote } from "./notes";
import type { DeployedModule, GameState } from "./types";

export interface AchievementProgress {
  current: number;
  goal: number;
}

// ADR-0015's five launch buckets: "practice capstones, console encouragers,
// board-and-economy encouragers, formula-and-horizon feats, and counter
// ladder seeds". The achievements page groups by them.
export type AchievementCategory = "practice" | "console" | "board" | "formula" | "ladder";

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  // Pure predicate over saved state — the unlock condition.
  evaluate: (state: GameState, ctx: AchievementContext) => boolean;
  // Pure read for the achievements page's progress bars; no secrets at launch.
  progress: (state: GameState, ctx: AchievementContext) => AchievementProgress;
}

// Inputs the caller may know better than the state alone: charge only
// exists live during flow, so the tick that has the rate snapshot passes
// whether any module actually received charge.
export interface AchievementContext {
  chargeDelivered: boolean;
}

const fraction = (numerator: number, denominator: number): AchievementProgress => ({
  current: Math.min(numerator, denominator),
  goal: denominator,
});

const totalPracticeSeconds = (state: GameState): number =>
  state.habits.reduce((total, habit) => total + habit.seconds, 0);

const livePracticeSeconds = (state: GameState): number =>
  state.practiceLog.reduce((total, entry) => (entry.source === "live" ? total + entry.seconds : total), 0);

const manualLogCount = (state: GameState): number =>
  state.practiceLog.reduce((total, entry) => (entry.source === "manual" ? total + 1 : total), 0);

const goalCompletions = (state: GameState): number =>
  state.goals.reduce((total, goal) => total + goal.completedCount, 0);

const ownsRare = (state: GameState): boolean => state.modules.some((m) => m.rarity === "rare");

// Rolls taken: every mint pushes exactly one offer, so the un-taken count
// is the earned total minus what still waits in the Forge.
const rollsTaken = (state: GameState): number => Math.max(0, state.forge.earned - state.bankedRolls.length);

// The chord multiplier over the deployed synthesizers and spacers — the
// same filter the rate pass applies (generators, infusors, and forges never
// chord; spacers conduct) — computed straight from the board so the
// registry stays free of the rate pass.
function chordMultiplierOf(state: GameState): number {
  const conductors = state.modules.filter(
    (m): m is DeployedModule =>
      m.pos !== null && (CATEGORY_OF[m.type] === "synthesizer" || CATEGORY_OF[m.type] === "spacer"),
  );
  return analyzeChords(
    conductors.filter((m) => CATEGORY_OF[m.type] === "synthesizer"),
    conductors.filter((m) => CATEGORY_OF[m.type] === "spacer"),
  ).multiplier;
}

// The launch set (§6.3): seventeen feats in spec order. Names provisional.
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: "first-light",
    category: "practice",
    name: "First light",
    description: "Complete your first flow session.",
    evaluate: (s) => s.sessionsCompleted >= 1,
    progress: (s) => fraction(s.sessionsCompleted, 1),
  },
  {
    id: "off-the-clock",
    category: "console",
    name: "Off the clock",
    description: "Log practice manually for the first time.",
    evaluate: (s) => manualLogCount(s) >= 1,
    progress: (s) => fraction(manualLogCount(s), 1),
  },
  {
    id: "kept-promise",
    category: "console",
    name: "Kept promise",
    description: "Complete a goal in the Goals app.",
    evaluate: (s) => goalCompletions(s) >= 1,
    progress: (s) => fraction(goalCompletions(s), 1),
  },
  {
    id: "untethered",
    category: "console",
    name: "Untethered",
    description: "Start an unstructured session.",
    evaluate: (s) => s.unstructuredSessions >= 1,
    progress: (s) => fraction(s.unstructuredSessions, 1),
  },
  {
    id: "marginalia",
    category: "console",
    name: "Marginalia",
    description: "Write a note during a flow session.",
    // Between-session notes (ADR-0018) don't count — the feat is the
    // in-flow capture.
    evaluate: (s) => s.notes.some(isInFlowNote),
    progress: (s) => fraction(s.notes.filter(isInFlowNote).length, 1),
  },
  {
    id: "on-the-clock",
    category: "console",
    name: "On the clock",
    description: "Complete a planned session to its target.",
    evaluate: (s) => s.plannedSessionsCompleted >= 1,
    progress: (s) => fraction(s.plannedSessionsCompleted, 1),
  },
  {
    id: "room-to-grow",
    category: "board",
    name: "Room to grow",
    description: "Buy your first cell.",
    evaluate: (s) => s.cellsBought >= 1,
    progress: (s) => fraction(s.cellsBought, 1),
  },
  {
    id: "spark",
    category: "board",
    name: "Spark",
    description: "Deliver charge to a module during flow.",
    evaluate: (_s, ctx) => ctx.chargeDelivered,
    progress: (_s, ctx) => fraction(ctx.chargeDelivered ? 1 : 0, 1),
  },
  {
    id: "roll-credit",
    category: "board",
    name: "Roll credit",
    description: "Take your first Forge roll.",
    evaluate: (s) => rollsTaken(s) >= 1,
    progress: (s) => fraction(rollsTaken(s), 1),
  },
  {
    id: "two-of-a-kind",
    category: "board",
    name: "Two of a kind",
    description: "Combine a pair of modules for the first time.",
    evaluate: (s) => s.combinations >= 1,
    progress: (s) => fraction(s.combinations, 1),
  },
  {
    id: "power-chord",
    category: "formula",
    name: "Power chord",
    description: "Stack chord multipliers to ×2 of the composite.",
    evaluate: (s) => chordMultiplierOf(s) >= 2,
    progress: (s) => fraction(chordMultiplierOf(s), 2),
  },
  {
    id: "fine-china",
    category: "board",
    name: "Fine china",
    description: "Own a rare module.",
    evaluate: (s) => ownsRare(s),
    progress: (s) => fraction(ownsRare(s) ? 1 : 0, 1),
  },
  {
    id: "eyes-on-the-horizon",
    category: "formula",
    name: "Eyes on the horizon",
    description: "Press the reserved prestige button.",
    evaluate: (s) => s.horizonAcknowledged,
    progress: (s) => fraction(s.horizonAcknowledged ? 1 : 0, 1),
  },
  {
    id: "time-in-the-seat",
    category: "practice",
    name: "Time in the seat",
    description: "Log 100 lifetime practice minutes, live or manual.",
    evaluate: (s) => totalPracticeSeconds(s) >= 100 * 60,
    progress: (s) => fraction(totalPracticeSeconds(s), 100 * 60),
  },
  {
    id: "keeping-time",
    category: "ladder",
    name: "Keeping time",
    description: "Complete 10 flow sessions.",
    evaluate: (s) => s.sessionsCompleted >= 10,
    progress: (s) => fraction(s.sessionsCompleted, 10),
  },
  {
    id: "marathoner",
    category: "practice",
    name: "Marathoner",
    description: "Practice 10 lifetime hours across flow sessions.",
    evaluate: (s) => livePracticeSeconds(s) >= 10 * 3600,
    progress: (s) => fraction(livePracticeSeconds(s), 10 * 3600),
  },
  {
    id: "commonplace-book",
    category: "ladder",
    name: "Commonplace book",
    description: "Record 25 notes.",
    evaluate: (s) => s.notes.length >= 25,
    progress: (s) => fraction(s.notes.length, 25),
  },
];

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

export function achievementName(id: string): string {
  return ACHIEVEMENTS.find((a) => a.id === id)?.name ?? id;
}

// The single global term (ADR-0014's third leg): each unlocked feat adds
// BALANCE.achievementBoostPerFeat, additively, nous-rate only.
export function achievementBoostOf(state: GameState): number {
  return 1 + Object.keys(state.achievements).length * BALANCE.achievementBoostPerFeat;
}

export interface SyncOptions {
  now?: number;
  // True when the caller has a live rate snapshot showing a module actually
  // receiving charge (the Spark trigger; charge exists only in flow).
  chargeDelivered?: boolean;
}

// The one detection entry point: evaluates every definition against the
// current state, records unlocks with their timestamps, queues in-session
// unlocks into the session's summary row, and returns the newly unlocked
// definitions (upgrade-mode callers toast them). Nothing can unlock during
// session one, and already-unlocked feats never re-fire.
export function syncAchievements(state: GameState, options: SyncOptions = {}): AchievementDef[] {
  if (state.sessionsCompleted === 0) return [];
  const ctx: AchievementContext = { chargeDelivered: options.chargeDelivered ?? false };
  const now = options.now ?? Date.now();
  const unlocked: AchievementDef[] = [];
  for (const def of ACHIEVEMENTS) {
    if (state.achievements[def.id] !== undefined) continue;
    if (!def.evaluate(state, ctx)) continue;
    state.achievements[def.id] = now;
    unlocked.push(def);
  }
  if (state.session !== null) {
    state.session.unlocked.push(...unlocked.map((def) => def.id));
  }
  return unlocked;
}
