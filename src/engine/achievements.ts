// The achievement framework (ADR-0015, §6.3 as amended): a static, pure
// registry of feats — definitions live in code, never in the save; the save
// stores only `id → unlockedAt`. Feats accelerate, never gate: each adds
// ~+2% (tuning) into the single global achievementBoost term of the nous
// rate, and that term stays the only reward — a milestone's row names the
// beat's own existing unlock, expose-only (no feat ever owns a gate).
// Detection is live: syncAchievements runs at action boundaries and session
// ticks, and nothing can unlock during session one. In-session unlocks
// queue into the session's unlocked list (the summary's "unlocked this
// session" row); upgrade-mode unlocks return to the caller for toasting;
// the eager resume sync stamps silently (SyncOptions.silent).
import { ARETE_HORIZON } from "./accumulator";
import { BALANCE, SHELF_TYPES } from "./constants";
import { analyzeChords } from "./chords";
import { deployedVoices } from "./economy";
import { isInFlowNote } from "./notes";
import type { GameState } from "./types";

export interface AchievementProgress {
  current: number;
  goal: number;
}

// ADR-0015's five launch buckets: "practice capstones, console encouragers,
// board-and-economy encouragers, formula-and-horizon feats, and counter
// ladder seeds". The achievements page groups encouragers by them;
// milestone feats (the amendment) sit outside the buckets and render as
// their own first group.
export type AchievementCategory = "practice" | "console" | "board" | "formula" | "ladder" | "milestone";

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  // The amendment's split: milestone feats commemorate a singular
  // progression beat — one per beat, binary, encouraging nothing. Only
  // milestones set this; encouragers leave it unset.
  milestone?: true;
  // The milestone's beat's own existing unlock, named on its row — the
  // expose-only alternative to owning a reward.
  unlock?: string;
  // What stands before the beat, named by the un-crossed row's tooltip.
  gate?: string;
  // The row's icon slot: a unique stroke glyph in the instrument's line
  // language (issue #269) — one mark per feat, legible at the ledger
  // chip's 14px and the feats row's 22px, and mute by itself: state rides
  // the row (the engraved done-mark acquired, the muted voice un-crossed),
  // never the glyph.
  icon: string;
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

// Rolls taken: every mint pushes exactly one offer into the one shared
// queue (ADR-0041), so the un-taken count is the two meters' earned total
// minus what still waits in the Forge — feats keyed on rolls taken read
// the total, never one source.
const rollsTaken = (state: GameState): number =>
  Math.max(0, state.forge.earned + state.flow.earned - state.bankedRolls.length);

// The steepest local chord multiplier any single deployed voice sings
// under (ADR-0036, raised by ADR-0049) — the same partition the rate pass
// applies (only oscillators and silent voices sing; spacers conduct) —
// computed straight from the board so the registry stays free of the rate
// pass. Chords are local, so the feat asks what one voice carries, never a
// board-wide product that stacks disjoint formations onto a single module.
// The formation quality Q rides inside the factor (ADR-0049): Q counts
// toward the ×2.
function maxVoiceMultiplierOf(state: GameState): number {
  const { singers, spacers } = deployedVoices(state);
  let max = 0;
  for (const factor of analyzeChords(singers, spacers).voiceMultiplier.values()) {
    max = Math.max(max, factor);
  }
  return max;
}

// The feat marks (issue #269): 23 unique stroke glyphs in the instrument's
// line language — the wave, the hexagon, the ring, the bolt, the ruled
// line — each readable at the chip's 14px and the row's 22px without
// color. Filled dots are the set's only solid notes, marking the one
// taken, the one escaped, the pivot. No mark repeats another feat's, and
// none reuses a module's or an app's glyph paths (asserted in the
// registry tests); the hexagon family reads through its interiors — the
// join's plus, the open cell's dash, the pair — never through two alike
// marks.
const glyph = (body: string): string =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

// The milestone feats (ADR-0015 amended, issue #268): one per singular
// progression beat, commemorating it without owning its gate — each beat's
// gate stays on its own surface (the Arete Catalog, the accumulator, the
// shelf). The row names the beat's own existing unlock; the +2% ν boost is
// the only reward. The feats page's Milestones section is built explicitly
// from the milestone flag; leading the array keeps every plain list read —
// and detection — milestone-first too.
const MILESTONES: readonly AchievementDef[] = [
  {
    id: "mutator-entry",
    category: "milestone",
    milestone: true,
    name: "Mutator entry",
    description: "Buy the Mutator tree's entry in the Arete Catalog.",
    unlock: "Mutator Grid on",
    gate: "The entry is bought in the Arete Catalog — the Catalog opens with the first banked Arete.",
    icon: glyph('<path d="M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z"/>'),
    evaluate: (s) => s.catalogEntryOwned,
    progress: (s) => fraction(s.catalogEntryOwned ? 1 : 0, 1),
  },
  {
    id: "roll-pool-join",
    category: "milestone",
    milestone: true,
    name: "Roll-pool join",
    description: "Join the Mutator Forge to the roll pool.",
    unlock: "In future rolls",
    gate: "The join is bought in the Arete Catalog, behind the Mutator tree's entry.",
    // The join: the mutator hexagon with the pool's plus.
    icon: glyph('<path d="M12 2.5 20.2 7.25v9.5L12 21.5 3.8 16.75v-9.5Z"/><path d="M12 8.2v7.6M8.2 12h7.6"/>'),
    evaluate: (s) => s.rollPoolJoined,
    progress: (s) => fraction(s.rollPoolJoined ? 1 : 0, 1),
  },
  {
    id: "first-prestige",
    category: "milestone",
    milestone: true,
    name: "First prestige",
    description: "Bank your first Arete at the horizon.",
    unlock: "The first Arete banks",
    gate: "Prestige stands at the horizon — fill the accumulator with lifetime nous, then bank the era.",
    // The Arete mark landing on the bank line — the era banked.
    icon: glyph('<path d="M12 2 20.1 7.9 17 17.4H7L3.9 7.9 12 2Z"/><path d="M4.5 21h15"/>'),
    evaluate: (s) => s.prestiges >= 1,
    progress: (s) => fraction(s.prestiges, 1),
  },
  {
    id: "first-row",
    category: "milestone",
    milestone: true,
    name: "First row",
    description: "Unlock an octave row beyond the launch band.",
    unlock: "An octave row joins the board",
    gate: "In New cell mode, reach the next octave row and buy its board unlock banner with Arete.",
    icon: glyph('<path d="M4 6.5h16M4 17.5h16"/><path d="M7 12h10"/>'),
    evaluate: (s) => s.unlockedRows.length >= 1,
    progress: (s) => fraction(s.unlockedRows.length, 1),
  },
  {
    id: "shelf-complete",
    category: "milestone",
    milestone: true,
    name: "Shelf completion",
    description: "Buy all three starter-shelf offers.",
    unlock: "Generator, Booster, and Forge owned",
    gate: "The starter shelf sells the Focus Generator, a Booster, and the Forge — one purchase each.",
    icon: glyph('<path d="M3.5 20.5h17"/><path d="M7.5 20.5v-7H11v7M13 20.5V9h3.5v11.5"/>'),
    evaluate: (s) => SHELF_TYPES.every((type) => s.purchased[type]),
    progress: (s) => fraction(SHELF_TYPES.filter((type) => s.purchased[type]).length, SHELF_TYPES.length),
  },
];

// The launch set (§6.3): seventeen feats in spec order, plus the horizon
// break's encourager (ADR-0042), led by the milestone feats. Names
// provisional.
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  ...MILESTONES,
  {
    id: "first-light",
    category: "practice",
    name: "First light",
    description: "Complete your first flow session.",
    // The dawn: the half-risen body over the horizon line, one ray up.
    icon: glyph('<path d="M4 17h16M7 17a5 5 0 0 1 10 0M12 6v2.5M6.2 10.8l1.4 1.4M17.8 10.8l-1.4 1.4"/>'),
    evaluate: (s) => s.sessionsCompleted >= 1,
    progress: (s) => fraction(s.sessionsCompleted, 1),
  },
  {
    id: "off-the-clock",
    category: "console",
    name: "Off the clock",
    description: "Log practice manually for the first time.",
    // The hand-entered entry: the pencil.
    icon: glyph('<path d="m4.5 19.5 1-4L16.6 4.4a2 2 0 0 1 2.8 2.8L8.3 18.3l-3.8 1.2Z"/><path d="m14.8 6.2 3 3"/>'),
    evaluate: (s) => manualLogCount(s) >= 1,
    progress: (s) => fraction(manualLogCount(s), 1),
  },
  {
    id: "kept-promise",
    category: "console",
    name: "Kept promise",
    description: "Complete a goal in the Goals app.",
    // The target hit: the bullseye's two rings.
    icon: glyph('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/>'),
    evaluate: (s) => goalCompletions(s) >= 1,
    progress: (s) => fraction(goalCompletions(s), 1),
  },
  {
    id: "untethered",
    category: "console",
    name: "Untethered",
    description: "Start an unstructured session.",
    // The released tether: the ring open, its bead detached in the gap.
    icon: glyph('<path d="M13.5 3.6A8.5 8.5 0 1 0 19.4 7.7"/><circle cx="16.9" cy="5" r="2.1"/>'),
    evaluate: (s) => s.unstructuredSessions >= 1,
    progress: (s) => fraction(s.unstructuredSessions, 1),
  },
  {
    id: "marginalia",
    category: "console",
    name: "Marginalia",
    description: "Write a note during a flow session.",
    // Between-session notes (ADR-0018) don't count — the feat is the
    // in-flow capture. The ruled page whose last line sings: the note
    // written while the flow runs.
    icon: glyph('<path d="M5 4.5h14M5 10.5h14"/><path d="M5 16.5c1.2-2.4 2.3-2.4 3.5 0s2.3 2.4 3.5 0 2.3-2.4 3.5 0 2.3 2.4 3.5 0"/>'),
    evaluate: (s) => s.notes.some(isInFlowNote),
    progress: (s) => fraction(s.notes.filter(isInFlowNote).length, 1),
  },
  {
    id: "on-the-clock",
    category: "console",
    name: "On the clock",
    description: "Complete a planned session to its target.",
    // The timed session: the stopwatch, crown and all — not the console's
    // bare clock face.
    icon: glyph('<circle cx="12" cy="13.5" r="7.5"/><path d="M9.8 2.8h4.4M12 2.8v3.2"/><path d="M12 13.5V9M12 13.5l2.8 1.8"/>'),
    evaluate: (s) => s.plannedSessionsCompleted >= 1,
    progress: (s) => fraction(s.plannedSessionsCompleted, 1),
  },
  {
    id: "room-to-grow",
    category: "board",
    name: "Room to grow",
    description: "Buy your first cell.",
    // The open cell itself: the dashed hexagon the board shows before the
    // purchase fills it.
    icon: glyph('<path d="M12 2.5 20.2 7.25v9.5L12 21.5 3.8 16.75v-9.5L12 2.5Z" stroke-dasharray="3.2 2.4"/>'),
    evaluate: (s) => s.cellsBought >= 1,
    progress: (s) => fraction(s.cellsBought, 1),
  },
  {
    id: "spark",
    category: "board",
    name: "Spark",
    description: "Deliver charge to a module during flow.",
    // The delivered charge: the bolt over its ground — the module the
    // charge lands in.
    icon: glyph('<path d="M14 1.5 8 11h4L10.5 18l6-9.5H13L14 1.5Z"/><path d="M6 20.2h12M9 22.8h6"/>'),
    evaluate: (_s, ctx) => ctx.chargeDelivered,
    progress: (_s, ctx) => fraction(ctx.chargeDelivered ? 1 : 0, 1),
  },
  {
    id: "roll-credit",
    category: "board",
    name: "Roll credit",
    description: "Take your first Forge roll.",
    // The draw: two candidates offered, the filled one taken.
    icon: glyph('<circle cx="8" cy="6.5" r="2.6"/><circle cx="16" cy="6.5" r="2.6"/><circle cx="12" cy="17.5" r="2.2" fill="currentColor" stroke="none"/>'),
    evaluate: (s) => rollsTaken(s) >= 1,
    progress: (s) => fraction(rollsTaken(s), 1),
  },
  {
    id: "two-of-a-kind",
    category: "board",
    name: "Two of a kind",
    description: "Combine a pair of modules for the first time.",
    // The pair: two hexagon voices side by side, about to be one.
    icon: glyph('<path d="M7.2 6.8l4.5 2.6v5.2l-4.5 2.6-4.5-2.6V9.4Z"/><path d="M16.8 6.8l4.5 2.6v5.2l-4.5 2.6-4.5-2.6V9.4Z"/>'),
    evaluate: (s) => s.combinations >= 1,
    progress: (s) => fraction(s.combinations, 1),
  },
  {
    id: "power-chord",
    category: "formula",
    name: "Power chord",
    description: "Stack chord multipliers on one voice to ×2 — the Formation term counts.",
    // The written interval: two note heads beamed as one voice's chord.
    icon: glyph('<circle cx="8.5" cy="15.5" r="2.3"/><circle cx="15.5" cy="8.5" r="2.3"/><path d="M10.8 15.5V7l7-2.5V8.5"/>'),
    evaluate: (s) => maxVoiceMultiplierOf(s) >= 2,
    progress: (s) => fraction(maxVoiceMultiplierOf(s), 2),
  },
  {
    id: "fine-china",
    category: "board",
    name: "Fine china",
    description: "Own a rare module.",
    // The gem: faceted, girdled — the rarity the shelf never sells.
    icon: glyph('<path d="M7.5 4h9l4 5.5L12 20 3.5 9.5 7.5 4Z"/><path d="M3.5 9.5h17M9.5 9.5 12 20l2.5-10.5"/>'),
    evaluate: (s) => ownsRare(s),
    progress: (s) => fraction(ownsRare(s) ? 1 : 0, 1),
  },
  {
    id: "eyes-on-the-horizon",
    category: "formula",
    name: "Eyes on the horizon",
    description: "Reach the horizon.",
    // The lifetime crossing is the trigger (ADR-0039): the feat reads the
    // monotonic totalEarned, never the per-era measure prestige rebases.
    // The body rising to the horizon arc.
    icon: glyph('<path d="M2.5 18.5q9.5-10 19 0"/><circle cx="12" cy="8" r="2" fill="currentColor" stroke="none"/>'),
    evaluate: (s) => s.totalEarned >= ARETE_HORIZON,
    progress: (s) => fraction(s.totalEarned, ARETE_HORIZON),
  },
  {
    id: "breaking-the-horizon",
    category: "formula",
    name: "Breaking the horizon",
    description: "Break the horizon.",
    // The purchase is the trigger (ADR-0042): an encourager for the
    // overfill stretch, accelerating and never gating. The arc broken, the
    // body already past it.
    icon: glyph('<path d="M2.5 18.5q6.5-7 11.5-7.8"/><path d="M17.8 11.2q2.4.6 3.7 2.3"/><circle cx="16.8" cy="5.2" r="2" fill="currentColor" stroke="none"/>'),
    evaluate: (s) => s.horizonBroken,
    progress: (s) => fraction(s.horizonBroken ? 1 : 0, 1),
  },
  {
    id: "time-in-the-seat",
    category: "practice",
    name: "Time in the seat",
    description: "Log 100 lifetime practice minutes, live or manual.",
    // The tally: four strokes and the strike — minutes counted.
    icon: glyph('<path d="M5 5.5v13M9.7 5.5v13M14.4 5.5v13M19.1 5.5v13"/><path d="M2.8 15.5 21.2 8.5"/>'),
    evaluate: (s) => totalPracticeSeconds(s) >= 100 * 60,
    progress: (s) => fraction(totalPracticeSeconds(s), 100 * 60),
  },
  {
    id: "keeping-time",
    category: "ladder",
    name: "Keeping time",
    description: "Complete 10 flow sessions.",
    // The metronome: the steady beat the sessions keep.
    icon: glyph('<path d="M8.6 3.5h6.8L19 20.5H5L8.6 3.5Z"/><path d="M12 14.5 16 6.5"/><circle cx="12" cy="14.5" r="1.2" fill="currentColor" stroke="none"/>'),
    evaluate: (s) => s.sessionsCompleted >= 10,
    progress: (s) => fraction(s.sessionsCompleted, 10),
  },
  {
    id: "marathoner",
    category: "practice",
    name: "Marathoner",
    description: "Practice 10 lifetime hours across flow sessions.",
    // The long road: receding edges, the dashed center line.
    icon: glyph('<path d="M9 4 6 20M15 4 18 20"/><path d="M12 6.5v2M12 11v2M12 15.5v2"/>'),
    evaluate: (s) => livePracticeSeconds(s) >= 10 * 3600,
    progress: (s) => fraction(livePracticeSeconds(s), 10 * 3600),
  },
  {
    id: "commonplace-book",
    category: "ladder",
    name: "Commonplace book",
    description: "Record 25 notes.",
    // The open book: the collected pages.
    icon: glyph('<path d="M12 5.5C10 4 7.5 3.5 4 3.5v14c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2v-14c-3.5 0-6 .5-8 2Z"/><path d="M12 5.5v14"/>'),
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
  // The eager resume sync (ADR-0015 amended): already-satisfied milestones
  // grant silently on load — `unlockedAt` stamps, no toast, and nothing
  // joins a live session's "unlocked this session" row.
  silent?: boolean;
}

// The one detection entry point: evaluates every definition against the
// current state, records unlocks with their timestamps, queues in-session
// unlocks into the session's summary row (unless silent), and returns the
// newly unlocked definitions (upgrade-mode callers toast them; the resume
// caller discards them). Nothing can unlock during session one, and
// already-unlocked feats never re-fire.
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
  if (!options.silent && state.session !== null) {
    state.session.unlocked.push(...unlocked.map((def) => def.id));
  }
  return unlocked;
}
