export type Rarity = "common" | "uncommon" | "rare";

// ADR-0012 category landscape: board modules are module → category → type.
export type Category = "synthesizer" | "generator" | "infusor" | "forge";

// Synthesizers contribute harmonic terms to the nous composite. The Carrier
// is the unique granted origin module (never rolled, never shelved); every
// other synthesizer is strictly harmonics.
export type SynthesizerType = "carrier" | "additive" | "conditional";

// Generators produce charge. The launch generator is the focus-keyed one
// (ADR-0018): it reads focus state, and its charge-window rule is the §2.3
// launch exception. The plain "generator" type was retired pre-release —
// every generator banks its window and releases it next session.
export type GeneratorType = "focusKeyed";

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

// The starter shelf (ADR-0013, amended by ADR-0018): one-time catalog offers
// completing the category landscape — the additive synth joins so the octave
// chord is teachable in session one, and the generator offer is the
// focus-keyed generator. "generator" stays the shelf key the save stores.
export type ShelfType = "additive" | "generator" | "infusor" | "forge";

// The per-reconciliation honesty outcome (focus-tool spec §2): how a
// provisional absence's past-target slice settled.
export type HonestyOutcome = "missed" | "planned" | "full";

// One settled reconciliation's factual line (spec §9): the away minutes and
// their outcome. Rendered neutrally in history — accounting, not judgment.
export interface HonestyEvent {
  awaySeconds: number;
  outcome: HonestyOutcome;
}

// Trust accounting for the running session (focus-tool spec §1–3). Presence
// is always trusted; away time is trusted up to a planned target, and
// provisional past it (all provisional on open-ended, beyond the floor).
// The bucket holds provisional nous until the honesty report banks or drops
// it in one move; the pool holds the provisional minutes behind it. C —
// creditedSeconds — is the seam every focus-side consumer keys off: live
// present and trusted time accrue it at their boundary, provisional time
// only when the report credits it. Additive v5 fields; older saves default
// the whole object at load.
export interface SessionAccounting {
  // Credited practice time: present + trusted + provisionally credited.
  creditedSeconds: number;
  // The provisional pool: away minutes awaiting the honesty report.
  poolSeconds: number;
  // The provisional bucket: nous produced by provisional time, visibly
  // flagged on the console until the report settles it.
  bucketNous: number;
  // Away time accumulated by the current contiguous absence — a hidden
  // stretch's throttled wake-ups buffer here, and the whole absence is
  // classified in one pass when presence returns (the reconciliation floor
  // and the target split both read the whole absence, never a chunk).
  pendingAwaySeconds: number;
  // Settled reconciliations, in order. Target hits, the honesty summary,
  // and miss rows derive from these — never stored.
  events: HonestyEvent[];
}

export interface SessionState {
  target: number | null;
  elapsed: number;
  // Nous produced by the board during this session (§5.7): the loud
  // summary's headline and rate read from it at session end. Only banked
  // nous counts — a dropped bucket is absent from the number.
  earned: number;
  // Achievements unlocked while this session was live (ADR-0015): they
  // queue here and read out as the summary's "unlocked this session" row.
  unlocked: string[];
  // The trust ledger (spec §1–3): credited time, the provisional bucket
  // and pool, and settled honesty events.
  accounting: SessionAccounting;
  // Set at the first wake-up past the target — the overrun entry that fires
  // the signals (spec §4). Persisted so a discard/reload never re-delivers
  // them; the chime's re-fire cadence stays ephemeral UI state.
  targetSignaled: boolean;
}

// The summary's reflection (spec §8): free text plus the five-position
// rough–great slider. Recorded when either field is touched — the untouched
// field keeps its neutral default (empty text, middle slider) — and absent
// when neither was. Pure insight at launch: nothing in the economy reads it.
export interface SessionReflection {
  text: string;
  slider: number;
}

// The loud summary (§5.7): captured once at session end — however the
// session ended — and shown on returning to upgrade mode. No countdown rows;
// the modal carries the reflection slot. `seen` marks the player's dismissal
// so an unseen summary survives a reload.
export interface SessionSummary {
  sessionNumber: number;
  earned: number;
  seconds: number;
  ratePerMinute: number;
  // The rate breakdown at session end (carrier-only during session one).
  carrier: number;
  harmonics: number;
  chordMultiplier: number;
  empowerment: number;
  // Session one only: Time auto-activated with this session's end.
  timeUnlocked: boolean;
  // The session's planned target seconds, null on open-ended (§8): the
  // practice-time row's "X / Y min" denominator.
  plannedTarget: number | null;
  // Settled honesty events (§8): the neutral factual lines beneath the
  // final numbers — where a dropped bucket's drop is visible.
  honestyEvents: HonestyEvent[];
  // Feats unlocked during the session, including at its end boundary —
  // the summary's "unlocked this session" row.
  achievements: string[];
  // The reflection (§8): records as its fields are touched, survives a
  // reload with the summary, absent (null) when untouched.
  reflection: SessionReflection | null;
  seen: boolean;
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

// The console's fixed-function instruments (ADR-0012). Defined here because
// the save state records which of them the activation ladder has unlocked.
export type FocusApp = "habit" | "time" | "notes" | "goals";

export interface GameState {
  mode: Mode;
  sessionIndex: number;
  sessionsCompleted: number;
  // Achievement counters (ADR-0015 §6.3): the unstructured-session counter
  // is new with the framework; the other two are the triggers that have no
  // pure read off existing state.
  unstructuredSessions: number;
  plannedSessionsCompleted: number;
  combinations: number;
  nous: number;
  totalEarned: number;
  // The Arete accumulator (ADR-0015): Arete minted at the horizon, inert
  // until prestige's design lands; and whether the reserved prestige button
  // has been pressed — the acknowledgment the achievements ticket detects.
  arete: number;
  horizonAcknowledged: boolean;
  // The one-time welcome card (§5.1): false until the player follows its CTA
  // to the Carrier's upgrade button or dismisses it — then it never returns.
  welcomeAcked: boolean;
  // One global mute (§5): gates every app sound, including the target
  // chime's hidden re-fires. No volume slider, no per-sound mix.
  muted: boolean;
  // The notification permission ask (§4): rides the first planned-session
  // start, once ever. Denial or dismissal degrades silently and never
  // re-prompts — the flag, not the browser's permission state, is the gate.
  notificationAsked: boolean;
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
  // The activation ladder (ADR-0013): the apps unlocked by rung purchases,
  // in purchase order — free order, globally rising rungs. Habit is always
  // on and Time auto-activates; neither is ever stored here.
  activatedApps: FocusApp[];
  // Console long goals (ADR-0012): goal capacity is the first named beat —
  // each purchase grows the Goals app's slot capacity.
  goalCapacityBought: number;
  notes: NoteEntry[];
  habits: Habit[];
  activeHabitId: string | null;
  practiceLog: PracticeEntry[];
  goals: Goal[];
  // The achievement ledger (ADR-0015): achievement id → unlockedAt (epoch
  // ms). Definitions live in code, never in the save.
  achievements: Record<string, number>;
  session: SessionState | null;
  // The last session's loud summary (§5.7): set at every session end,
  // dismissed once by the player, replaced by the next session's end.
  summary: SessionSummary | null;
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
