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
  modules: ModuleInstance[];
  cells: Hex[];
  forge: Meter;
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

export interface Contribution {
  moduleId: string;
  type: ModuleType;
  value: number;
  infusorBonus: number;
  chargeFactor: number;
  chargeStrength: number;
}

export interface RateSnapshot {
  base: number;
  rate: number;
  forgeRate: number;
  contributions: Map<string, Contribution>;
  chargeStrength: Map<string, number>;
}

export interface AdvanceResult {
  nousEarned: number;
  rollsBanked: number;
  goalsCompleted: number;
}
