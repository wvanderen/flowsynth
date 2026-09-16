export type Rarity = "common" | "uncommon" | "rare";

// ADR-0012 category landscape: board modules are module → category → type.
export type Category = "synthesizer" | "generator" | "infusor" | "forge";

// Synthesizers contribute harmonic terms to the nous composite. The Carrier
// is the unique granted origin module (never rolled, never shelved); every
// other synthesizer is strictly harmonics.
export type SynthesizerType = "carrier" | "additive" | "conditional";

// Generators produce charge. The focus-keyed generator reads focus state
// (its charge-window rule is the §2.3 launch exception).
export type GeneratorType = "generator" | "focusKeyed";

export type InfusorType = "infusor";

export type ForgeType = "forge";

export type ModuleType = SynthesizerType | GeneratorType | InfusorType | ForgeType;

export interface Hex {
  q: number;
  r: number;
}

export interface ModuleInstance {
  id: string;
  type: ModuleType;
  rarity: Rarity;
  level: number;
  invested: number;
  pos: Hex | null;
}

// A module known to sit on the board — the shape chord math and rate passes
// work in once deployment has been filtered.
export type DeployedModule = ModuleInstance & { pos: Hex };

export interface Candidate {
  id: string;
  type: ModuleType;
  rarity: Rarity;
}

export interface RollOffer {
  id: string;
  candidates: [Candidate, Candidate, Candidate];
}

export interface Meter {
  progress: number;
  earned: number;
}

// The starter shelf (ADR-0013): one-time catalog offers that complete the
// category landscape — every launch category guaranteed exactly once. The
// focus-keyed generator is not shelved; its acquisition point is tuning.
export type ShelfType = "generator" | "infusor" | "forge";

export interface SessionState {
  target: number | null;
  elapsed: number;
}

export interface PendingGap {
  seconds: number;
  detectedAt: number;
}

export interface NoteEntry {
  id: string;
  sessionId: number;
  atElapsed: number;
  text: string;
}

export interface Habit {
  id: string;
  name: string;
  seconds: number;
  archived: boolean;
}

export interface PracticeEntry {
  id: string;
  habitId: string;
  seconds: number;
  source: "live" | "manual";
  at: number;
}

export interface GoalCondition {
  kind: "habit-minutes";
  habitId: string | null;
  minutes: number;
}

export type GoalSchedule = { kind: "once" } | { kind: "daily" } | { kind: "weekly" };

export interface Goal {
  id: string;
  condition: GoalCondition;
  schedule: GoalSchedule;
  occurrenceKey: string;
  progressSeconds: number;
  completed: boolean;
  completedCount: number;
  createdAt: number;
}

export type Mode = "upgrade" | "flow" | "paused";

export interface GameState {
  mode: Mode;
  sessionIndex: number;
  sessionsCompleted: number;
  nous: number;
  totalEarned: number;
  // The Arete accumulator (ADR-0015): Arete minted at the horizon, inert
  // until prestige's design lands; and whether the reserved prestige button
  // has been pressed — the acknowledgment the achievements ticket detects.
  arete: number;
  horizonAcknowledged: boolean;
  modules: ModuleInstance[];
  cells: Hex[];
  // Total cells ever bought (§3): the geometric cell-price scaler counts
  // purchases, never the current board size reshaping may rearrange.
  cellsBought: number;
  forge: Meter;
  // The charge window (§2.3): remaining output seconds banked at session
  // end by the focus-keyed generator rule, spent as that generator's output
  // during the next session's first minutes.
  chargeWindow: number;
  bankedRolls: RollOffer[];
  purchased: Record<ShelfType, boolean>;
  notes: NoteEntry[];
  habits: Habit[];
  activeHabitId: string | null;
  practiceLog: PracticeEntry[];
  goals: Goal[];
  session: SessionState | null;
  pendingGap: PendingGap | null;
  nextId: number;
}

// A raw chord pair: two adjacent synthesizers one pitch apart. Each pair
// multiplies the composite by a small bonus — stacking is multiplicative and
// uncapped (ADR-0014).
export interface ChordPairTerm {
  a: string;
  b: string;
  bonus: number;
}

// A recognized named chord: one bonus term replacing its member pairs'
// bonuses, with one breakdown line per recognition.
export interface NamedChordTerm {
  name: string;
  pitches: number[];
  bonus: number;
  moduleIds: string[];
}

export interface Contribution {
  moduleId: string;
  type: ModuleType;
  pitch: number | null;
  amplitude: number;
  value: number;
  chordTerms: number;
  infusorBonus: number;
  chargeFactor: number;
  chargeStrength: number;
}

// The live rate breakdown (§4): carrier / harmonics / chords / empowerment /
// achievements → rate. The carrier and harmonic legs are uncharged; charge
// empowerment aggregates into its own leg so the lines always multiply out:
// rate = composite × empowerment × achievementBoost.
export interface RateSnapshot {
  carrier: number;
  harmonics: number;
  amplitude: number;
  chordMultiplier: number;
  pairs: ChordPairTerm[];
  namedChords: NamedChordTerm[];
  composite: number;
  empowerment: number;
  achievementBoost: number;
  rate: number;
  forgeRate: number;
  contributions: Map<string, Contribution>;
  chargeStrength: Map<string, number>;
}

export interface AdvanceResult {
  nousEarned: number;
  rollsBanked: number;
  goalsCompleted: number;
  areteMinted: number;
}
