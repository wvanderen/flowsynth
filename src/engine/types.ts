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
  | "conduit"
  | "ritual";

// Oscillators contribute synth terms to the nous composite — one unified
// leg shared by every oscillator (ADR-0022, ADR-0048), with each named
// type's authored profile (issue #369, ADR-0059) scaling the leg's pieces:
// base production, booster response, chord response, and charge response.
// The Blaster is the category's second producer role: it converts received
// charge into its synth term, singing and completing chords even uncharged
// at zero output — the profile wave's first alternative charge behavior.
// The Afterglow (issue #372) carries the category's first temporal profile:
// its production warms up on the shared session clock. The Sideband
// (issue #375) is the third alternative-charge behavior: received charge
// converts into its chord response instead of empowering it, over weak
// standalone production. The breather specialists (issue #416) make rest
// their identity: the Release is the plain strongest responder, the
// Standby deepens its response with lifetime completed breathers, and the
// Tail's weak term warms with lifetime breather seconds.
export type OscillatorType =
  | "additive"
  | "blaster"
  | "triangle"
  | "square"
  | "saw"
  | "afterglow"
  | "sideband"
  | "release"
  | "standby"
  | "tail";

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

// Generators produce charge (issue #371's named designs): the Flywheel
// (focusKeyed), the Scribe (noteKeyed), and the Milestone (goalKeyed) each
// read every practice fact — credited focus time, written notes, completed
// goals — through its authored earning profile (profiles.GENERATOR_
// PROFILES), banking charge quantity into its own reserve. The keys
// predate the profiles and stay the save's identity, like `additive` for
// the Sine. The plain "generator" type was retired pre-release — every
// generator banks its window and releases it next session. The Pulsewell
// (issue #372) joins the family with a mixed earning profile and a
// periodic burst cycle on the shared session clock.
export type GeneratorType = "focusKeyed" | "noteKeyed" | "goalKeyed" | "pulsewell";

// The booster category's named amplitude designs (issue #374, parent
// #366): the Booster is the launch broad design, the Field the second —
// moderate support to every adjacent oscillator — and the Spotlight the
// narrow one, stronger support to the one player-selected adjacent
// oscillator. The Spotlight's selection lives on the module's own
// `target` field. The Chorus (issue #375) is the category's first
// non-amplitude design: its primary effect is the chord response — it
// adds its share to adjacent oscillators' chord-response term and grants
// no amplitude bonus, so it is inert without an active chord. The Exciter
// (issue #376) is the second: its primary effect is the charge response —
// its share adds to the recipients' authored charge response, the
// conversion types' alternatives included — and never to the amplitude
// leg, so it grants no base production and no second charge behavior: an
// uncharged recipient reads exactly its uncharged value.
export type BoosterType = "infusor" | "field" | "spotlight" | "chorus" | "exciter";

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

// RITUAL (ADR-0046, retired by ADR-0076): the chargeable-family board
// module rolled through the module-roll pool. Its build amplification
// retired with the legacy habit builds — it remains a continuous-charge
// receiver, habit-keyed, wearing the switch vermillion.
export type RitualType = "ritual";

export type ModuleType =
  | OscillatorType
  | SilentVoiceType
  | SpacerType
  | GeneratorType
  | BoosterType
  | ForgeType
  | MutatorForgeType
  | ConduitType
  | RitualType;

export interface Hex {
  q: number;
  r: number;
}

export interface ModuleInstance {
  id: string;
  type: ModuleType;
  // The copy's merge tier (ADR-0058): duplicate-earned improvement, advanced
  // by combining two copies of the same named type and tier, capped by the
  // finite unlocked cap. Fixed type rarity is never stored — it derives from
  // the type (constants.TYPE_RARITY); levels are the nous-purchased axis.
  // Lenient-defaulted to 0 at load.
  tier: number;
  level: number;
  invested: number;
  pos: Hex | null;
  // The module's own reserve (ADR-0047, generalized by issue #371): a
  // store of charge quantity. A generator's profile banks charge into it
  // at the practice facts — focus windows at session end, note and goal
  // credit at their facts — and a deployed generator spends it at its
  // emission rate while flow is live. Charge state — reset at prestige.
  // Lenient-defaulted to 0 at load.
  reserve: number;
  // The Bend's player-picked shift (ADR-0048): semitones added to its
  // cell's pitch. The selectable set grows with rarity only (±1 at launch,
  // ±2 joining at rare); null on every other type. Lenient-defaulted at
  // load — a Bend loads with the ♯ pick.
  shift: number | null;
  // The Spotlight's player-selected recipient (issue #374): the module id
  // of the one oscillator whose term its stronger uplift lands on. The
  // selection is remembered through invalidity — a recipient that leaves
  // the board or loses adjacency leaves the booster inactive, never
  // silently retargeted — and resumes when adjacency returns; a recipient
  // melted in a combination drops the pick. Null on every other type and
  // until the player picks; lenient-defaulted to null at load, with ids
  // that resolve to nothing dropped.
  target: string | null;
}

// A module known to sit on the board — the shape chord math and rate passes
// work in once deployment has been filtered.
export type DeployedModule = ModuleInstance & { pos: Hex };

// A module-roll candidate (ADR-0058): the named type carries the fixed
// rarity; `tier` is the tier the choice mints at — 0 from every fresh draw,
// carried over from the legacy rolled band only by the v8 → v9 conversion.
export interface Candidate {
  id: string;
  type: ModuleType;
  tier: number;
}

export interface RollOffer {
  id: string;
  candidates: [Candidate, Candidate, Candidate];
  // The special draft a rolled offer came from (issue #379): the Forge
  // names the product and its guarantee above the candidates that resolve
  // it. Ordinary offers carry no marker.
  special?: { kind: SpecialDraftKind; category?: Category };
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

// The World layer's weapon types (issue #425, ADR-0074): the first
// experiment ships exactly one — the Charge Blade, the capped-cadence
// weapon the first World-eligible claim grants. The union is the whole
// schema a later type joins: a new key in the per-type records (Hone
// ranks, storage, attack), no reshaping of saves.
export type WeaponType = "chargeBlade";

// A Charge Column (issue #425, ADR-0074): the World layer's lift occupant.
// It sits over an owned module cell, copies the charge received at that
// cell upward without draining the module beneath, and splits its copied
// supply among adjacent World consumers. `pos === null` waits in the World
// tray; persistence rides the reset contract, never a memorized purchase.
export interface WorldColumn {
  id: string;
  pos: Hex | null;
}

// A weapon copy (issue #425, ADR-0074): stores charge up to its type's
// capped quantity (persists between sessions, resets on prestige), attacks
// adjacent discovered undefeated enemies on the capped cadence, spending
// the fixed cost per attack. `targetPriority` is the between-sessions
// control: the ordered preference among authored enemy keys, resolved
// against the authored roster order when unconfigured or exhausted.
// `cooldown` is combat state — seconds accumulated toward the next attack;
// lenient-defaulted to 0 at load.
export interface WeaponCopy {
  id: string;
  type: WeaponType;
  pos: Hex | null;
  store: number;
  cooldown: number;
  targetPriority: string[];
}

// One authored enemy's live World state (issue #425), keyed by the
// authored roster key: discovered flips the moment era-earned crosses the
// threshold (the penalty activates), `hp` carries damage between sessions
// and restores at fixed stats on prestige. Defeat reads `hp <= 0` — the
// era bonus replaces the penalty, never stored twice.
export interface WorldEnemyState {
  discovered: boolean;
  hp: number;
}

// The World layer's save surface (issue #425, ADR-0074): the claimed
// frontier (the entitlement already banked against, advanced only on
// prestige), the once-ever starter weapon flag, the placed and tray
// occupants (Columns and weapons), the per-type Hone ranks, and the
// enemies' live state. World purchases persist through prestige; enemy
// encounters, damage, and stored World charge reset with the era.
export interface WorldState {
  frontier: number;
  starterWeaponGranted: boolean;
  columns: WorldColumn[];
  weapons: WeaponCopy[];
  hone: Record<WeaponType, number>;
  enemies: Record<string, WorldEnemyState>;
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

// The special drafts' product kinds (issue #379, parent #366): the
// scrap-purchased one-time drafts, each carrying one explicit guarantee
// every candidate satisfies — `category` draws its whole offer from the
// category picked when the entitlement is woven, `rare` draws the rare
// band, `tier` mints every candidate at least one merge tier above base
// (clamped to the unlocked cap, the Draft Loom's rungs riding on top).
export type SpecialDraftKind = "category" | "rare" | "tier";

export interface Meter {
  progress: number;
  earned: number;
}

// The habit-class layer (ADR-0074, issue #423): a class is a specialization
// a habit wears; progression belongs to the habit–class PAIR, never to the
// player or the habit across classes. `engineer` is the launch class; the
// id union and the per-pair record are the whole schema a second class
// joins — a new key under `Habit.classes`, no reshaping of saves.
export type ClassId = "engineer";

// One habit–class pair's progression. Experience accrues only from credited
// flow time with this pair selected (live advance and honesty-credited
// reconciliation — never manual logs, never breathers); authored level
// thresholds grant tree points; allocations are ordinary, freely
// re-assignable ranks. The practice-roll meter replaces the retired
// player-wide flow meter (ADR-0041 as replaced by ADR-0074): credited
// seconds fill it while the pair is selected, it freezes otherwise, and
// each crossing banks a module roll into the shared queue.
export interface ClassPairState {
  // Credited flow seconds earned with this pair selected — the class XP.
  experience: number;
  level: number;
  // Unspent tree points.
  points: number;
  // Allocated ranks by node id. Ordinary points: respec and presets
  // rewrite them freely, never experience or level.
  spent: Record<string, number>;
  // The pair's practice-roll meter: progress in credited seconds, earned
  // = module rolls minted. Freezes while another pair is selected.
  rollMeter: Meter;
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
  // The breather offer (docs/breather-spec.md §2): the allowance this
  // session's end minted, in seconds — 0 when the session sat below the
  // credited gate or the save predates the offer. The offer exists only
  // while this summary stands unseen; a dismissal is a declined breather.
  breatherAllowance: number;
  seen: boolean;
}

// The session record's mode (§9): derived from the plan at close. Planned
// sessions carry a target; open-ended ones carry none.
export type SessionMode = "planned" | "open-ended";

// The goals-advanced snapshot (§9): one row per goal the session credited
// time toward, captured at close so deleting or replacing a goal never
// rewrites history. Older records resolve by id until the next edit/removal
// captures their description.
export interface GoalAdvanceSnapshot {
  goal?: Goal;
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
  // The breather that followed this session (docs/breather-spec.md §5):
  // one factual line — duration taken, and whether the allowance ran to
  // zero or the player ended it early. Null when no breather was taken;
  // lenient-defaulted to null at load.
  breather: BreatherTaken | null;
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
  // The habit's own palette key (issue #445, ADR-0075): identity rides the
  // habit, independently of its class, and every goal read inherits it.
  // Lenient-defaulted at load — a save written before the palette wave
  // carried no color, and the default is what a fresh habit wears. The
  // v11 → v12 migration adopts a transferred single goal's color instead.
  color: HabitColor;
  // The habit's selected class (ADR-0074): the specialization its next
  // session practices under. Locked for the whole session like the habit
  // itself; changes happen between sessions. Lenient-defaulted to
  // "engineer" at load — the launch class is every habit's default wear.
  classId: ClassId;
  // The per-pair progression ledger (ADR-0074): one entry per class the
  // habit has practiced under, keyed by class id. Switching classes or
  // habits never moves or destroys an entry — experience, level, points,
  // allocations, and partial roll progress all freeze in place. Only the
  // selected pair accrues. Lenient-defaulted to a fresh engineer pair at
  // load; unknown keys drop.
  classes: Record<ClassId, ClassPairState>;
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

// The player-picked palette key (issue #312, re-owned by the habit with
// issue #445): one of the six swatches the habit editor offers. The key
// rides habit state; the UI reads its theme token everywhere the habit —
// and the goal that inherits it — renders.
export type HabitColor = "vermillion" | "amber" | "green" | "cyan" | "indigo" | "violet";

export interface Goal {
  // Retired goals retain their facts for session history but never run.
  retired?: true;
  // A multi-goal habit's carried-over row (issue #445): the save held more
  // than the one active goal a habit now owns, and which to retain is the
  // player's explicit choice at the next habit edit. A pending row never
  // accrues, never completes, and never lights a read; retaining one row
  // retires its pending siblings. The flag survives reload until resolved.
  pendingChoice?: true;
  id: string;
  condition: GoalCondition;
  schedule: GoalSchedule;
  occurrenceKey: string;
  progressSeconds: number;
  // The occurrence's live slice of `progressSeconds` (ADR-0047): credited
  // present, trusted, and honesty-credited seconds — manual logs never
  // join it. The completion credit prorates by this
  // share, so a manual-only completion banks nothing; the reset at a
  // recurring occurrence's boundary clears it. Lenient-defaulted to 0 at
  // load.
  liveSeconds: number;
  completed: boolean;
  completedCount: number;
  createdAt: number;
}

export type Mode = "upgrade" | "flow" | "paused" | "breather";

// The running breather (docs/breather-spec.md §1, ADR-0073): the timed
// break phase between a closed flow session and upgrade mode. The clock is
// the wall clock — the phase self-ends at its allowance whatever the
// player's presence — while `elapsed` advances exactly like a session's,
// so a discard/reload reconciles from the saved figure. `startedAt` stamps
// the start gesture (epoch ms). The temporal clock reads
// lastSessionClock + elapsed: breather seconds advance the departed
// session's clock (spec §1), never a private timer.
export interface BreatherState {
  startedAt: number;
  allowanceSeconds: number;
  elapsed: number;
}

// The breather facts (docs/breather-spec.md §6): lifetime completed
// breathers live on GameState; this is the record line's shape — what the
// breather that followed a session took.
export interface BreatherTaken {
  seconds: number;
  completed: boolean;
}

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
// The Goals app retired with its separate face (issue #445): goals edit
// inside their habit.
export type FocusApp = "habit" | "time" | "notes";

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
  // The scrap balance (issue #377, ADR-0066): the collection value
  // recovered from scrapped modules and skipped module rolls — the one
  // canonical store; payouts land nowhere else. Survives the arete reset
  // with the collection it values. Lenient-defaulted to 0 at load.
  scrap: number;
  // The Draft Loom's owned rungs (issue #378, parent #366): the
  // scrap-purchased permanent draft improvement — each rung raises every
  // fresh candidate's chance to mint one merge tier higher (clamped to
  // the unlocked cap). Memorized with the scrap that pays for it: it
  // survives the arete reset. Lenient-defaulted to 0 at load.
  draftTierBonus: number;
  // The special drafts' held entitlements (issue #379, parent #366):
  // unused one-time purchases, keyed by product kind. A purchase
  // increments its kind's count; weaving the entitlement consumes it
  // exactly once and banks a guaranteed offer into the ordinary queue.
  // Memorized with the scrap that pays for them: they survive the arete
  // reset. Lenient-defaulted to all-zero at load.
  specialDrafts: Record<SpecialDraftKind, number>;
  // The Warp Beam's owned rungs (issue #380, parent #366): the Arete
  // Catalog's merge-cap purchases — each rung raises the unlocked merge
  // cap one tier above BALANCE.mergeCap, up to the authored ladder's
  // end. Memorized Arete purchases: they survive the arete reset.
  // Lenient-defaulted to 0 at load.
  mergeCapPurchases: number;
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
  // The World layer (issue #425, ADR-0074): the two-layer World's whole
  // save surface — the claimed frontier, the occupants, the Hone ranks,
  // and the enemies' live state. Lenient-defaulted to a fresh World at
  // load, per field.
  world: WorldState;
  // The harmonic-capacity ladder (issue #259, the confirmed design beside
  // ADR-0050). `capacityBought` counts this era's nous Catalog purchases —
  // each adds one whole-chord unit to every current and future voice, and
  // prestige returns it to zero. `capacityCeilings` and `capacityDiscounts`
  // count the Arete Catalog's permanent offerings — ceiling unlocks (the
  // prototype maximums four and five) and price discounts (20%, then 40% in
  // total) — which persist through prestige. All three lenient-default to 0
  // at load; the ladder's math lives in capacity.ts alone.
  capacityBought: number;
  capacityCeilings: number;
  capacityDiscounts: number;
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
  // The goal-generator fuel pool (issue #423): the bounded budget behind
  // every goal completion's generator credit. It accrues at
  // BALANCE.goalFuelPerCreditedSecond per credited practice second — the
  // same live legs class development rides — and completions draw it down
  // through the one credit seam (reserves.creditGoalEarning), so more
  // goals, shorter targets, and repeated replacement cannot raise the
  // generator credit the same practice time yields. A rule, never a
  // resource: no surface displays it. Floors at zero; lenient-defaulted
  // to 0 at load.
  goalFuel: number;
  // The achievement ledger (ADR-0015): achievement id → unlockedAt (epoch
  // ms). Definitions live in code, never in the save.
  achievements: Record<string, number>;
  // The chord discovery library's ledger (#218, the v8 surface): chord
  // class → its discovery record — whether a live formation of the class
  // has formed, when it was first heard, and how many distinct roots have
  // rung it. Persists through prestige like the feats ledger;
  // lenient-defaults to {} at load.
  chordDiscovery: Record<string, ChordDiscovery>;
  // The live allocation's retention hint (issue #258, the harmonic-
  // capacity design): the active instance keys of the last authoritative
  // allocation. The engine's allocation sync reads it as the solver's
  // `keep` hint and writes the new active keys back, so equal-output
  // allocations hold their active set across recomputation — and,
  // persisted, across save/reload. The empty list simply falls back to the
  // solver's stable order; lenient-defaults to [] at load.
  activeChords: string[];
  session: SessionState | null;
  // The last session's loud summary (§5.7): set at every session end,
  // dismissed once by the player, replaced by the next session's end.
  summary: SessionSummary | null;
  // The running breather (docs/breather-spec.md §1): non-null only in
  // breather mode. Lenient-defaulted to null at load.
  breather: BreatherState | null;
  // The departed session's final clock (docs/breather-spec.md §1): stamped
  // at every session end, it is the temporal base a following breather
  // advances — breather seconds keep the Afterglow warm and the Pulsewell
  // cycling. Never read outside breather mode. Lenient-defaulted to 0.
  lastSessionClock: number;
  // The breather facts (docs/breather-spec.md §6): lifetime completed
  // breathers — the allowance run to zero; early exits never count — and
  // lifetime breather seconds lived, early exits included. Persist through
  // prestige with the life record; lenient-defaulted to 0 at load.
  breathersCompleted: number;
  breatherSeconds: number;
  nextId: number;
}

// One chord class's discovery record (#218, the v8 surface): keyed by the
// class name in the save's v8 surface. `formed` flips with the first live
// formation (the would-form ghosts never discover); `firstFormedAt` stamps
// it (epoch ms); `rootsHeard` counts the distinct roots the class has rung.
export interface ChordDiscovery {
  formed: boolean;
  firstFormedAt: number;
  rootsHeard: number;
  // The distinct roots themselves (issue #230, wave 3's growth of the
  // surface) — the truth `rootsHeard` counts, grown by the discovery sync
  // and never rewritten. Lenient-defaulted to [] at load, with a save's
  // carried count respected so history never shrinks.
  roots: number[];
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

// One complete voice-set the board recognized (issue #258, the harmonic-
// capacity design): the atom of allocation. Active instances earn their
// bonus on every member and consume one capacity unit apiece; recognized
// but idle instances earn nothing and spend nothing — they still count as
// discoveries. `key` is the stable identity (pattern, root, sorted
// members) allocations retain across recomputation.
export interface RecognizedInstance {
  key: string;
  name: string;
  root: number;
  bonus: number;
  memberIds: string[];
}

// The live board's whole-chord allocation summary (issue #258): the reads
// every surface needs to distinguish recognized chords from active
// bonuses. Present only when the snapshot came through the authoritative
// allocation pass; the plain recognizer's snapshots leave it unset.
export interface AllocationSummary {
  // The standard voice's whole-chord budget — intrinsic one plus the
  // shared purchased rungs (issue #373) — the board-level read the ladder
  // and the ambient meter quote. One voice's own budget sits beside it:
  // profiles author higher intrinsic seats, and `capacities` carries each
  // singing voice's own figure.
  capacity: number;
  // Each singing voice's own whole-chord budget (issue #373): the
  // heterogeneous figure the allocation spent against, keyed by module
  // id — a profile's intrinsic seats included, so a Blaster's
  // used/available read quotes its two seats and not this scalar.
  capacities: ReadonlyMap<string, number>;
  used: Map<string, number>;
  // The selected instances. Active seams and bonus terms read these
  // alone.
  active: readonly RecognizedInstance[];
  // Their keys, as a set — the "is this term earning?" test.
  activeKeys: ReadonlySet<string>;
  // Every complete voice-set the board recognized, active or not — the
  // discovery read and the idle candidates' source.
  recognized: readonly RecognizedInstance[];
  // False when the solver's budget tripped and the best incumbent stands
  // uncertified — never silently substituted.
  certified: boolean;
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
  // The formation quality Q the module's cluster scored (ADR-0049), as
  // APPLIED to this module's production (issue #260): the named term its
  // chord factor actually carries — exactly 1 whenever the voice carries no
  // active chord (capacity left it unallocated) and whenever the formation
  // names no chord. Read aloud as "Formation ×1.12".
  formationQ: number;
  // The formation quality as MEASURED (issue #260): one read per connected
  // formation, scored over every singing voice it holds — voices whose
  // recognized chords sat inactive included — whether or not any chord
  // activated. The quality scale reads this; the applied term above is
  // what the breakdown multiplies. Equals formationQ on the plain
  // recognizer's pass.
  formationMeasuredQ: number;
  // The booster uplift the voice's term receives — every booster design's
  // grant rides this one term (the launch Booster, the Field, the
  // Spotlight), already scaled by the voice's authored booster response.
  infusorBonus: number;
  chargeFactor: number;
  chargeStrength: number;
}

// The live rate breakdown (§4; leg naming per ADR-0020 as amended by
// ADR-0022 and ADR-0036): synths / infusors / empowerment / achievements /
// discoveries → rate. Chords are local: each synthesizer's term carries its
// own chord factor, so the synths leg is every synthesizer's term with its
// chords in, the infusor uplift rides chord-weighted beside it, and the
// lines always multiply out: rate = (synths + infusors) × empowerment ×
// achievementBoost × discoveryBoost. The chord terms themselves surface as
// names and multipliers (namedChords), never as a board-wide multiplier
// claim.
export interface RateSnapshot {
  synths: number;
  infusors: number;
  amplitude: number;
  namedChords: NamedChordTerm[];
  empowerment: number;
  achievementBoost: number;
  // The chord library's permanent discovery bonus (issue #230): each
  // discovered class adds BALANCE.discoveryBonusPerClass into one global
  // leg, riding every oscillator's final value beside the achievements
  // boost. Nous-rate only.
  discoveryBoost: number;
  // The World layer's remaining-production factor (issue #425): the
  // discovered enemies' penalties and defeated enemies' era bonuses
  // multiplied together — a figure in (0, ∞), 1 with no World effect
  // standing. It multiplies every oscillator's final value and divides
  // back out of the empowerment leg, so the breakdown multiplies out
  // exactly and the rate details can show the one factor where the math
  // actually carries it — never an aggregate penalty meter elsewhere.
  worldFactor: number;
  rate: number;
  forgeRate: number;
  // The Mutator Forge branch's progress rate (ADR-0043, issue #198): the
  // sum over deployed Mutator Forges of received strength × power — its
  // own meter, never the Module Forge's. The power mutator boosting its
  // own branch here is intended.
  mutatorForgeRate: number;
  contributions: Map<string, Contribution>;
  chargeStrength: Map<string, number>;
  // The authoritative allocation's summary (issue #258) when this snapshot
  // came through the allocating pass — the default recognizer leaves it
  // unset, and readers must treat absence as "no allocation read".
  allocation?: AllocationSummary;
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
