export type Rarity = "common" | "uncommon" | "rare";

// ADR-0048's roster landscape, on ADR-0021's module → category → type shape:
// board modules are module → category → type. The spacer is its own silent
// category; the silent-voice and charge-conduit categories join with the
// roster iteration, and the synthesizer/infusor categories take their
// display words from their modules (issue #219): oscillator and booster.
export type Category =
  | "oscillator"
  | "silentVoice"
  | "spacer"
  | "generator"
  | "booster"
  | "forge"
  | "conduit";

// Oscillators contribute synth terms to the nous composite — one unified
// leg shared by every oscillator (ADR-0022, ADR-0048). The Blaster is the
// category's second producer role: it converts received charge into its
// synth term, singing and completing chords even uncharged at zero output.
export type OscillatorType = "additive" | "blaster";

// The silent-voice category (ADR-0048): silent pitched modules that produce
// no nous but count in chord clusters — they form and complete chords and
// conduct them as voices. Differentiated only by pitch source: the
// Harmonizer sings its own cell's pitch, the Echo an adjacent voice's pitch
// one octave down, the Bend its own pitch altered by a player-picked small
// interval.
export type SilentVoiceType = "harmonizer" | "echo" | "bend";

// The spacer (ADR-0021): a silent wire occupying one cell. It never sounds,
// never joins a pitch set, and never produces — it only conducts chord
// adjacency through chains of wired cells. Reaches the board through forge
// rolls only.
export type SpacerType = "spacer";

// Generators produce charge. The launch generator is the focus-keyed one
// (ADR-0018): it reads focus state, and its charge-window rule is the §2.3
// launch exception. The plain "generator" type was retired pre-release —
// every generator banks its window and releases it next session.
export type GeneratorType = "focusKeyed";

export type InfusorType = "infusor";

export type ForgeType = "forge";
// The Mutator Forge (ADR-0043, issue #198): the Forge family's second
// branch — the chargeable module whose thresholds mint mutator rolls.
// Catalog-exclusive until the Mutator tree's roll-pool purchase joins it
// to the module roll pool.
export type MutatorForgeType = "mutatorForge";

// The charge-conduit category (ADR-0048): silent modules that neither
// produce charge nor sing — they route received charge onward. Its launch
// member is the Amplifier.
export type ConduitType = "amplifier";

export type ModuleType =
  | OscillatorType
  | SilentVoiceType
  | SpacerType
  | GeneratorType
  | InfusorType
  | ForgeType
  | MutatorForgeType
  | ConduitType;

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
  // The module's own reserve (ADR-0047, the v8 surface): the player-wide
  // charge-window scalar generalized per module. The Focus Generator banks
  // output seconds here at session end and spends 1 s/s while deployed;
  // the Note and Goal generators join the same surface with their
  // reserves. Charge state — reset at prestige. Lenient-defaulted to 0 at
  // load.
  reserve: number;
  // The Bend's player-picked shift (ADR-0048): semitones added to its
  // cell's pitch. The selectable set grows with rarity only (±1 at launch,
  // ±2 joining at rare); null on every other type. Lenient-defaulted at
  // load — a Bend loads with the ♯ pick.
  shift: number | null;
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

// The mutator families (ADR-0043): power rides the host's power term,
// resonance the host's chord factor, charge the strength the host
// receives. One geometric rarity rule scales each family's base.
export type MutatorFamily = "power" | "resonance" | "charge";

// A mutator sits in a Mutator slot — its cell's second face — and modifies
// whatever module occupies that cell; `pos === null` waits in the Mutator
// tray. No levels: rarity alone scales the family's magnitude.
export interface MutatorInstance {
  id: string;
  family: MutatorFamily;
  rarity: Rarity;
  pos: Hex | null;
}

export interface MutatorCandidate {
  id: string;
  family: MutatorFamily;
  rarity: Rarity;
}

// A mutator roll offers exactly two candidates (ADR-0043) — three families
// cannot fill three meaningful slots — and no first-roll rig.
export interface MutatorRollOffer {
  id: string;
  candidates: [MutatorCandidate, MutatorCandidate];
}

export interface Meter {
  progress: number;
  earned: number;
}

// The starter shelf (ADR-0013, amended by ADR-0022): one-time catalog
// offers completing the non-synthesizer landscape — the generator, one
// infusor, and the Forge. Synthesizers come only from the opening grant and
// forge rolls; the shelf-sold additive synth is retired. "generator" stays
// the shelf key the save stores.
export type ShelfType = "generator" | "infusor" | "forge";

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
  // The session record's start stamp (§9): wall-clock epoch ms from the
  // start gesture. Zero only on lenient defaults — a pre-§9 session resumed
  // from an older save falls back to its end time at close.
  startedAt: number;
  // This session's goal-advancement ledger (§9): goalId → credited seconds
  // accrued while the session ran. Snapshot into the record at close, so
  // deleting or replacing a goal never rewrites history; the ledger dies
  // with the session object.
  goalSeconds: Record<string, number>;
  // Rolls this session banked, by source (ADR-0041): the summary's rolls
  // line splits practice (flow meter) from charge (Forge progress). The
  // queue they land in is one and interchangeable — these counts only
  // attribute.
  rolls: RollSources;
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
  // The rate breakdown at session end (one synth term alone during session
  // one): the unified synths leg (local chords included, ADR-0036) plus the
  // infusor uplift as its own named leg (ADR-0022). No chord-multiplier
  // row: chords are local, and a board-wide claim would overstate them.
  synths: number;
  infusors: number;
  empowerment: number;
  // The summary's unlock row (ADR-0015): in design, inert at launch — the
  // launch apps are free from minute 0 (ADR-0019) and it fires again only
  // when the ladder's first tenant joins.
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
  // Rolls banked this session, by source (ADR-0041): the rolls line shows
  // one source plainly and splits the two when both fired.
  rollsFlow: number;
  rollsForge: number;
  // The Mutator Forge's crossings this session (ADR-0043): captured at
  // close beside the other sources; the summary's rolls line grows its
  // mutator split with the Mutators layer's UI.
  rollsMutator: number;
  // The reflection (§8): records as its fields are touched, survives a
  // reload with the summary, absent (null) when untouched.
  reflection: SessionReflection | null;
  seen: boolean;
}

// The session record's mode (§9): derived from the plan at close. Planned
// sessions carry a target; open-ended ones carry none.
export type SessionMode = "planned" | "open-ended";

// The goals-advanced snapshot (§9): one row per goal the session credited
// time toward, captured at close so deleting or replacing a goal never
// rewrites history — the id resolves at render.
export interface GoalAdvanceSnapshot {
  goalId: string;
  seconds: number;
}

// The session record (§9): the permanent per-session entry, written once at
// close, append-only and never pruned. Every flow session gets one —
// planned, open-ended, unstructured, seconds-long. The habit id resolves at
// render; credited seconds are post-reconciliation; earned is what actually
// banked after any bucket drop, so history never contradicts the balance.
// Derived, never stored: the target hit, the honesty summary, and miss-row
// status (see records.ts). Present/away/paused breakdowns are not stored.
export interface SessionRecord {
  sessionNumber: number;
  startedAt: number;
  endedAt: number;
  // null = unstructured.
  habitId: string | null;
  mode: SessionMode;
  // null on open-ended.
  plannedTarget: number | null;
  creditedSeconds: number;
  earned: number;
  honestyEvents: HonestyEvent[];
  // Absent (null) = never touched; renders neutral.
  reflection: SessionReflection | null;
  goalsAdvanced: GoalAdvanceSnapshot[];
  achievements: string[];
}

export interface NoteEntry {
  id: string;
  sessionId: number;
  atElapsed: number;
  text: string;
  // The habit-keyed tag (§9): the session's selected habit at capture —
  // null for unstructured and between-sessions notes. Tagged once, never
  // retagged; the id resolves at render so renames and archiving never
  // rewrite the stream.
  habitId: string | null;
  // The wall-clock capture stamp (epoch ms); zero on lenient defaults,
  // which render undated.
  at: number;
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

// Rolls banked during a session, attributed by source (ADR-0041): the flow
// meter's practice crossings and the Forge branches' charge crossings. The
// counts never gate anything — module rolls share one queue, mutator rolls
// bank into the Mutator tray's own.
export interface RollSources {
  flow: number;
  forge: number;
  mutator: number;
}

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
  // Lifetime ν earned — the monotonic truth underneath every era (ADR-0039).
  // The "Eyes on the horizon" feat reads this, never the per-era measure.
  totalEarned: number;
  // The current era's earned ν (ADR-0039): the accumulator's per-era
  // measure. Rebases to 0 at each prestige; lifetime totalEarned does not.
  eraEarned: number;
  // Banked prestige (ADR-0039): Arete arrives only through the reset
  // action — the nth prestige banks n (ADR-0042's linear base), and no
  // code path grants it otherwise, permanently.
  arete: number;
  // The era/prestige count (ADR-0039): economy-bearing state (the claim
  // reads it), still awaiting a surface (ADR-0038's one-figure discipline).
  prestiges: number;
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
  // purchases, never the current board size reshaping may rearrange. Row
  // gates never advance it — gate nous is a premium on top, not a purchase
  // the scaler counts (ADR-0022).
  cellsBought: number;
  // Octave rows whose one-time gate premium is already paid (ADR-0022): row
  // indices relative to the start register. An explicit array, not a
  // max-distance scalar, so purchase order never matters; lenient-defaults
  // to [] at load.
  gatedRows: number[];
  // Octave rows the Row unlock has opened (ADR-0040 as amended by
  // ADR-0044, issue #197): the one Arete row per side beyond the launch
  // band. The purchase stands in the row gate too — the row also joins
  // gatedRows — so cells inside buy with nous as usual. Persists through
  // prestige; lenient-defaults to [] at load.
  unlockedRows: number[];
  // The Arete Catalog's Mutator tree purchases (ADR-0040 as amended by
  // ADR-0044, issue #197): the entry — the Mutator Grid's activation, the
  // Mutator Forge module itself, and the first slot's unlock (#198) — and
  // the pricier join that admits the Mutator Forge type to the module roll
  // pool. One-time, Arete-paid, and persisting through prestige;
  // lenient-default to false.
  catalogEntryOwned: boolean;
  rollPoolJoined: boolean;
  // The Horizon break (ADR-0042, issue #200): the one-time Catalog purchase
  // that lets per-era overfill scale the claim — min(n × (1 + log₁₀ R), CAP)
  // with R the era's earned ν over the horizon line. One-time, Arete-paid,
  // persisting through prestige; lenient-defaults to false.
  horizonBroken: boolean;
  // The Mutator Grid's unlocked slots (ADR-0043, issue #198): the cells
  // whose second face holds a mutator. The entry's first unlock may sit on
  // any owned cell; every later unlock attaches adjacent to the
  // already-unlocked patch. Unbounded, per-item priced on the tree's
  // escalating ladder; persists through prestige; lenient-defaults to [].
  mutatorSlots: Hex[];
  // Every owned mutator — placed (pos = its slot cell) or waiting in the
  // Mutator tray (pos = null). Placed mutators and the tray persist
  // through prestige; lenient-defaults to [].
  mutators: MutatorInstance[];
  forge: Meter;
  // The Mutator Forge branch's own meter (ADR-0043, issue #198): ADR-0009's
  // shared-meter pattern with its own constants — growth ≈×2, charge-only
  // (no practice leg, ADR-0041). Each crossing banks a mutator roll into
  // the Mutator tray's queue. Fill and earned count persist through
  // prestige; lenient-defaults to an empty meter.
  mutatorForge: Meter;
  // The flow meter (ADR-0041): the player-wide meter credited practice
  // fills, sibling of Forge progress — never a branch of the Forge family.
  // Each crossing banks a module roll into the one shared queue. Fill and
  // earned count persist through prestige (the #170 boundary class).
  flow: Meter;
  // The opening arc's one pop-up (board-redesign spec §8): the dismissal
  // sets this once, so the card fires exactly once, ever. Lenient-defaults
  // to false at load — a save written before the card existed is still
  // owed its one hint.
  arcCardSeen: boolean;
  bankedRolls: RollOffer[];
  // The Mutator tray's own pending-roll queue (ADR-0043, issue #198): the
  // Mutator Forge branch's crossings bank here — two candidates each,
  // unchosen candidates vanish. Persists through prestige; lenient-defaults
  // to [].
  bankedMutatorRolls: MutatorRollOffer[];
  purchased: Record<ShelfType, boolean>;
  // The activation ladder's permanent record (ADR-0013): apps unlocked by
  // rung purchases, in purchase order — free order, globally rising rungs.
  // The ladder rests empty at launch (ADR-0019): all four launch apps are
  // free from the first session, so nothing is stored here until a tenant
  // joins.
  activatedApps: FocusApp[];
  // Console long goals (ADR-0012): goal capacity is the first named beat —
  // each purchase grows the Goals app's slot capacity.
  goalCapacityBought: number;
  notes: NoteEntry[];
  habits: Habit[];
  activeHabitId: string | null;
  practiceLog: PracticeEntry[];
  // The session history (§9): the complete append-only run of session
  // records, browsed in the Time app. Kept in full — no pruning, no caps.
  sessionRecords: SessionRecord[];
  goals: Goal[];
  // The achievement ledger (ADR-0015): achievement id → unlockedAt (epoch
  // ms). Definitions live in code, never in the save.
  achievements: Record<string, number>;
  // The chord discovery library's ledger (#218, the v8 surface): chord
  // class → its discovery record — whether a live formation of the class
  // has formed, when it was first heard, and how many distinct roots have
  // rung it. Persists through prestige like the feats ledger;
  // lenient-defaults to {} at load.
  chordDiscovery: Record<string, ChordDiscovery>;
  session: SessionState | null;
  // The last session's loud summary (§5.7): set at every session end,
  // dismissed once by the player, replaced by the next session's end.
  summary: SessionSummary | null;
  nextId: number;
}

// One chord class's discovery record (#218): keyed by the class name in the
// save's v8 surface. `formed` flips with the first live formation (the
// would-form ghosts never discover); `firstFormedAt` stamps it (epoch ms);
// `rootsHeard` counts the distinct roots the class has rung.
export interface ChordDiscovery {
  formed: boolean;
  firstFormedAt: number;
  rootsHeard: number;
}

// A recognized chord instance group (ADR-0021/0022): one entry per matched
// (pattern, root) over a connected cluster — register-free pitch content,
// any voicing, any octave. `instances` is how many complete voice-sets the
// cluster sings the pattern through (doubled voices stack; disjoint
// same-chord clusters are separate entries), and each instance multiplies
// only its member synthesizers (ADR-0036). `moduleIds` carries one
// representative voice set for rendering; `root` is the match's root pitch
// class — the (name, root) pair is a chord's identity across board changes
// (the would-form preview diffs on it).
export interface NamedChordTerm {
  name: string;
  bonus: number;
  instances: number;
  moduleIds: string[];
  root: number;
}

export interface Contribution {
  moduleId: string;
  type: ModuleType;
  // The cell's absolute pitch (MIDI) for synthesizers, null otherwise —
  // derived from coordinates, never persisted.
  pitch: number | null;
  amplitude: number;
  // The module's final ν/s — the local infusor, chord, charge, and
  // achievement effects all included (ADR-0036). Oscillators only: silent
  // voices, spacers, and conduits are 0 and the Forge's value is Forge
  // progress per second, not nous. The displayed figures sum to the board's
  // rate.
  value: number;
  chordTerms: number;
  // The module's local chord multiplier (ADR-0036): the formation's named
  // product × its quality Q (ADR-0049) — 1 when the module sings no chord,
  // null for the categories that never chord at all — never 0, which would
  // read as a multiplied-to-zero voice. Silent voices carry their display
  // factor as muted participants; they produce nothing for it to multiply.
  chordFactor: number | null;
  // The formation quality Q the module's cluster scored (ADR-0049): its own
  // named term per member — read aloud as "Formation ×1.12". Exactly 1
  // whenever the formation names no chord (chordless is exactly neutral).
  formationQ: number;
  infusorBonus: number;
  chargeFactor: number;
  chargeStrength: number;
}

// The live rate breakdown (§4; leg naming per ADR-0020 as amended by
// ADR-0022 and ADR-0036): synths / infusors / empowerment / achievements →
// rate. Chords are local: each synthesizer's term carries its own chord
// factor, so the synths leg is every synthesizer's term with its chords in,
// the infusor uplift rides chord-weighted beside it, and the lines always
// multiply out: rate = (synths + infusors) × empowerment × achievementBoost.
// The chord terms themselves surface as names and multipliers
// (namedChords), never as a board-wide multiplier claim.
export interface RateSnapshot {
  synths: number;
  infusors: number;
  amplitude: number;
  namedChords: NamedChordTerm[];
  empowerment: number;
  achievementBoost: number;
  rate: number;
  forgeRate: number;
  // The Mutator Forge branch's progress rate (ADR-0043, issue #198): the
  // sum over deployed Mutator Forges of received strength × power — its
  // own meter, never the Module Forge's. The power mutator boosting its
  // own branch here is intended.
  mutatorForgeRate: number;
  contributions: Map<string, Contribution>;
  chargeStrength: Map<string, number>;
}

export interface AdvanceResult {
  nousEarned: number;
  rollsBanked: number;
  // The total's split by source (ADR-0041): flow-meter crossings vs Forge
  // charge crossings, for the session's per-source attribution.
  rollsFlow: number;
  rollsForge: number;
  // The Mutator Forge branch's crossings (ADR-0043): mutator rolls bank
  // into the Mutator tray's own queue, counted beside the module rolls.
  rollsMutator: number;
  goalsCompleted: number;
}
