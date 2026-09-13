export type Rarity = "common" | "uncommon" | "rare";

export type CoreType = "enter" | "time" | "habit" | "notes" | "goals" | "tasks";

export type GameplayType = "additive" | "conditional" | "infusor" | "forge" | "expander";

export type ModuleType = CoreType | GameplayType;

export interface Hex {
  q: number;
  r: number;
}

export interface Burst {
  strength: number;
  seconds: number;
}

export interface ModuleInstance {
  id: string;
  type: ModuleType;
  rarity: Rarity;
  level: number;
  invested: number;
  pos: Hex | null;
  bursts: Burst[];
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

export type StarterType = GameplayType;

export interface SessionState {
  target: number | null;
  elapsed: number;
  burstAwarded: boolean;
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
  cellTokens: number;
  forge: Meter;
  expansion: Meter;
  bankedRolls: RollOffer[];
  purchased: Record<StarterType, boolean>;
  timeActive: boolean;
  notesActive: boolean;
  notes: NoteEntry[];
  habits: Habit[];
  activeHabitId: string | null;
  practiceLog: PracticeEntry[];
  goalsActive: boolean;
  goals: Goal[];
  storeOpened: boolean;
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
  adjacentActiveCores: number;
}

export interface RateSnapshot {
  base: number;
  timeBonus: number;
  conditionalBonus: number;
  rate: number;
  forgeRate: number;
  expansionRate: number;
  contributions: Map<string, Contribution>;
  chargeStrength: Map<string, number>;
  chargeSeconds: number;
}

export interface AdvanceResult {
  nousEarned: number;
  rollsBanked: number;
  cellsEarned: number;
  burstAwarded: boolean;
  storeOpened: boolean;
  goalsCompleted: number;
}
