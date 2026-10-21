import { createInitialState, createModule, normalizeChordDiscovery, normalizeModules, normalizeWorld } from "./state";
import { classDefOf, freshClassPair, normalizeHabitClasses } from "./classes";
import { normalizeGoals } from "./goals";
import { DEFAULT_HABIT_COLOR, normalizeHabitColor } from "./habits";
import { longGoalCost, mutatorSlotCost } from "./economy";
import { generateOffer, type Rng } from "./rolls";
import { BALANCE, SAVE_VERSION } from "./constants";
import type { BreatherState, GameState, Goal, Meter, SpecialDraftKind } from "./types";

export interface SaveFile {
  app: "flowsynth";
  version: number;
  savedAt: number;
  state: GameState;
}

export interface LoadResult {
  state?: GameState;
  error?: string;
}

export function serialize(state: GameState, savedAt: number = Date.now()): string {
  const file: SaveFile = { app: "flowsynth", version: SAVE_VERSION, savedAt, state };
  return JSON.stringify(file, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// ADR-0017's pattern at the version boundary: every version older than
// v10 rejects with the start-fresh message — no chain, no archive, no
// import path for rejected versions. The explicit steps this build
// carries run for their own versions alone: `migrateV10ToV11` (the
// retired purchases' refunds, the Engineer conversion, the flow meter's
// final payout, the goal retirement — issue #427) and `migrateV11ToV12`
// (the one-goal narrowing's habit colors and pending choices — issue
// #445), each writing the next schema once so a re-run cannot exist.
export function deserialize(text: string, rng: Rng = Math.random): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: "The save data is not valid JSON." };
  }
  if (!isRecord(parsed) || parsed.app !== "flowsynth" || typeof parsed.version !== "number") {
    return { error: "This file is not a FlowSynth save." };
  }
  if (parsed.version < 10) {
    return {
      error: `Incompatible older version (save v${parsed.version}, this build is v${SAVE_VERSION}) — starting fresh.`,
    };
  }
  if (parsed.version > SAVE_VERSION) {
    return { error: `Save version ${parsed.version} is newer than this build supports (${SAVE_VERSION}).` };
  }
  if (!isRecord(parsed.state)) {
    return { error: "The save data is incomplete." };
  }
  const raw = parsed.state as Partial<GameState> & Record<string, unknown>;
  const fresh = createInitialState();
  if (typeof raw.mode !== "string" || !["upgrade", "flow", "paused", "breather"].includes(raw.mode)) {
    return { error: "The save data has an unknown session mode." };
  }
  const merged: GameState = { ...fresh, ...raw } as GameState;
  if (
    !Array.isArray(merged.modules) ||
    !Array.isArray(merged.cells) ||
    !Array.isArray(merged.bankedRolls) ||
    !Array.isArray(merged.notes) ||
    !Array.isArray(merged.habits) ||
    !Array.isArray(merged.practiceLog) ||
    !Array.isArray(merged.sessionRecords) ||
    !Array.isArray(merged.goals)
  ) {
    return { error: "The save data is incomplete." };
  }
  // The octave-row gate ledger (ADR-0022): lenient default — a save written
  // before it exists owes no gates it can't know about. The check reads the
  // raw save, not the merge: a fresh state's granted opening rows must not
  // masquerade as a ledger the save carried.
  if (!Array.isArray(raw.gatedRows)) {
    merged.gatedRows = [];
  }
  // The Row unlock's ledger and the Mutator tree's sheet purchases
  // (issue #197) lenient-default the same way: absent means never unlocked,
  // never bought — which is also exactly what a pre-Catalog save owes.
  if (!Array.isArray(raw.unlockedRows)) {
    merged.unlockedRows = [];
  }
  if (typeof raw.catalogEntryOwned !== "boolean") {
    merged.catalogEntryOwned = false;
  }
  if (typeof raw.rollPoolJoined !== "boolean") {
    merged.rollPoolJoined = false;
  }
  // The World layer (issue #425) lenient-defaults the same way, per field:
  // a save written before the layer carries none of it — an unclaimed
  // frontier, no occupants, no Hone ranks, every enemy reserved at its
  // fixed stats — which is exactly what a fresh shape writes. Corrupt
  // figures re-default; unknown enemy keys drop.
  merged.world = normalizeWorld(raw.world);
  // The Horizon break (ADR-0042, issue #200) retired with the frontier
  // claim curve (issue #425): the Headroom flag is gone. The migration's
  // exact Arete refund (#427) reads the raw save's field — untouched by
  // this delete, which is the raw copy's — and the retired purchase's
  // price before the flag leaves the merged shape.
  delete (merged as unknown as Record<string, unknown>).horizonBroken;
  // The scrap balance (issue #377) lenient-defaults the same way: absent
  // or corrupt reads as nothing banked — exactly what a pre-scrap save
  // owes. A negative figure is corrupt, not a debt.
  if (typeof raw.scrap !== "number" || !Number.isFinite(raw.scrap) || raw.scrap < 0) {
    merged.scrap = 0;
  }
  // The Draft Loom's owned rungs (issue #378) lenient-default the same
  // way: absent or corrupt reads as none owned — exactly what a pre-loom
  // save owes. An implausibly large count clamps at the ladder's end, so
  // "fully tuned" can never disagree with the prices the purchase quotes
  // (the capacity offerings' clamp pattern).
  merged.draftTierBonus =
    typeof raw.draftTierBonus === "number" && Number.isFinite(raw.draftTierBonus) && raw.draftTierBonus > 0
      ? Math.min(Math.floor(raw.draftTierBonus), BALANCE.tierBonusCosts.length)
      : 0;
  // The special drafts' held entitlements (issue #379) lenient-default the
  // same way: absent or corrupt reads as none held — exactly what a
  // pre-specials save owes. Per-kind counts floor at zero; a corrupt
  // record can never read as a free draft.
  const heldCount = (value: unknown): number =>
    typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  const rawSpecials: Partial<Record<SpecialDraftKind, unknown>> = isRecord(raw.specialDrafts) ? raw.specialDrafts : {};
  merged.specialDrafts = {
    category: heldCount(rawSpecials.category),
    rare: heldCount(rawSpecials.rare),
    tier: heldCount(rawSpecials.tier),
  };
  // The harmonic-capacity ladder (issue #259) lenient-defaults the same
  // way: absent or corrupt counts read as zero — no purchases this era, no
  // Arete offerings owned — exactly what a pre-ladder save owes, and
  // nothing unrelated resets with them. An implausibly large offering
  // count clamps at the ladder's end, so "both owned" can never disagree
  // with the prices and shares those rows quote; purchases clamp where
  // they are read (capacity.ts's ceiling).
  const clampOffering = (value: unknown, ladder: readonly number[]): number =>
    typeof value === "number" && Number.isFinite(value) && value > 0
      ? Math.min(Math.floor(value), ladder.length)
      : 0;
  merged.capacityBought =
    typeof raw.capacityBought === "number" && Number.isFinite(raw.capacityBought) && raw.capacityBought > 0
      ? Math.floor(raw.capacityBought)
      : 0;
  merged.capacityCeilings = clampOffering(raw.capacityCeilings, BALANCE.capacityCeilingCosts);
  merged.capacityDiscounts = clampOffering(raw.capacityDiscounts, BALANCE.capacityDiscountCosts);
  // The Warp Beam's owned rungs (issue #380) lenient-default the same way:
  // absent or corrupt reads as none owned — exactly what a pre-beam save
  // owes. An implausibly large count clamps at the ladder's end, so the
  // unlocked cap can never promise a tier the prices have stopped selling.
  merged.mergeCapPurchases = clampOffering(raw.mergeCapPurchases, BALANCE.mergeCapCosts);
  // The Mutator layer (ADR-0043, issue #198) lenient-defaults the same
  // way: absent means the entry was never bought — no slots, no mutators,
  // no Mutator Forge fill, no pending mutator rolls — which is exactly
  // what a pre-mutator save owes.
  if (!Array.isArray(raw.mutatorSlots)) {
    merged.mutatorSlots = [];
  }
  if (!Array.isArray(raw.mutators)) {
    merged.mutators = [];
  }
  if (!Array.isArray(raw.bankedMutatorRolls)) {
    merged.bankedMutatorRolls = [];
  }
  if (!isRecord(raw.mutatorForge)) {
    merged.mutatorForge = { progress: 0, earned: 0 };
  }
  // The entry's grant backfills (issue #198): a save written between the
  // sheet purchase (#197) and the entry's engine effects carries the owned
  // flag without the Mutator Forge module it grants — the purchase refuses
  // as owned, so loading grants what the entry owed. The first slot needs
  // no backfill: its free placement rides unlockMutatorSlot's empty patch.
  if (merged.catalogEntryOwned && !merged.modules.some((module) => module.type === "mutatorForge")) {
    merged.modules.push(createModule(merged, "mutatorForge"));
  }
  // The arc card's seen flag (§8) lenient-defaults the same way: absent or
  // corrupt means never dismissed — the save is still owed its one hint.
  if (typeof raw.arcCardSeen !== "boolean") {
    merged.arcCardSeen = false;
  }
  // The breather (docs/breather-spec.md, ADR-0073) lenient-defaults the
  // same way: absent facts read as none banked, and a breather mode saved
  // without a coherent breather state cannot stand — it lands in upgrade
  // mode beside the summary that offered it, exactly where a declined
  // breather sits. The elapsed clamps at the allowance: a save written
  // after the deadline can never resume a phase already over.
  if (typeof raw.lastSessionClock !== "number" || !Number.isFinite(raw.lastSessionClock) || raw.lastSessionClock < 0) {
    merged.lastSessionClock = 0;
  }
  merged.breathersCompleted =
    typeof raw.breathersCompleted === "number" && Number.isFinite(raw.breathersCompleted) && raw.breathersCompleted > 0
      ? Math.floor(raw.breathersCompleted)
      : 0;
  merged.breatherSeconds =
    typeof raw.breatherSeconds === "number" && Number.isFinite(raw.breatherSeconds) && raw.breatherSeconds > 0
      ? Math.floor(raw.breatherSeconds)
      : 0;
  const rawBreather = raw.breather as Partial<BreatherState> | null | undefined;
  if (
    merged.mode === "breather" &&
    isRecord(rawBreather) &&
    typeof rawBreather.allowanceSeconds === "number" &&
    Number.isFinite(rawBreather.allowanceSeconds) &&
    rawBreather.allowanceSeconds > 0 &&
    typeof rawBreather.elapsed === "number" &&
    Number.isFinite(rawBreather.elapsed) &&
    rawBreather.elapsed >= 0
  ) {
    merged.breather = {
      startedAt: typeof rawBreather.startedAt === "number" && Number.isFinite(rawBreather.startedAt) ? rawBreather.startedAt : 0,
      allowanceSeconds: rawBreather.allowanceSeconds,
      elapsed: Math.min(rawBreather.elapsed, rawBreather.allowanceSeconds),
    };
  } else {
    merged.breather = null;
    if (merged.mode === "breather") merged.mode = "upgrade";
  }
  // The summary's breather allowance (docs/breather-spec.md §2) lenient-
  // defaults to none: a pre-breather summary carries no offer. A corrupt
  // figure reads as none too — an offer is a whole-minute figure at most.
  if (merged.summary && !(typeof merged.summary.breatherAllowance === "number" && Number.isFinite(merged.summary.breatherAllowance) && merged.summary.breatherAllowance > 0)) {
    merged.summary.breatherAllowance = 0;
  }
  // The records' breather line (docs/breather-spec.md §5) lenient-defaults
  // to null: a pre-breather record took no breather.
  for (const record of merged.sessionRecords) {
    if (!record.breather) record.breather = null;
  }
  // The retired 120 s reconcile dialog's frozen gap (ADR-0010 → ADR-0019):
  // a save may still carry one; drop it rather than resuming a state shape
  // this build no longer reads.
  delete (merged as unknown as Record<string, unknown>).pendingGap;
  // The activation ladder's record (ADR-0013, retired by issue #313): every
  // app is free, so a save can only ever carry the empty launch default —
  // drop the field rather than resume a state shape this build no longer
  // reads.
  delete (merged as unknown as Record<string, unknown>).activatedApps;
  // The session's per-source rolls ledger (ADR-0041) lenient-defaults the
  // same way: a save written mid-flow before it exists resumes with zeroed
  // counts, never a crash.
  if (merged.session && !isRecord(raw.session?.rolls)) {
    merged.session.rolls = { flow: 0, forge: 0, mutator: 0 };
  }
  // The chord discovery ledger (#218, the v8 surface) lenient-defaults the
  // same way: absent or corrupt means nothing discovered yet — exactly
  // what a pre-roster save owes.
  if (!isRecord(raw.chordDiscovery)) {
    merged.chordDiscovery = {};
  }
  // The ledger's per-entry root set (issue #230) lenient-defaults the way
  // the per-module surface does: a pre-wave-3 entry carries the count
  // alone, and the set waits empty beneath it.
  normalizeChordDiscovery(merged.chordDiscovery);
  // The allocation retention hint (issue #258) lenient-defaults the same
  // way: a save written before the capacity economy carries no keys, and
  // the next allocation simply falls back to the solver's stable order.
  if (!Array.isArray(raw.activeChords)) {
    merged.activeChords = [];
  }
  // The habit builds (ADR-0046) retired with the legacy build system
  // (ADR-0076): the equipped node ids carried no state worth converting —
  // no compensatory XP, no second practice conversion — so the field drops
  // per the retired-field precedent and current saves stop writing it.
  // Class ledgers, levels, allocation, and partial roll progress are the
  // pair state below and are untouched here.
  for (const habit of merged.habits) {
    delete (habit as unknown as Record<string, unknown>).build;
  }
  // The goal-generator fuel pool (issue #423) lenient-defaults the same
  // way: a save written before the budget carries no fuel — exactly what
  // a fresh shape owes. A negative figure is corrupt, never a debt.
  if (typeof raw.goalFuel !== "number" || !Number.isFinite(raw.goalFuel) || raw.goalFuel < 0) {
    merged.goalFuel = 0;
  }
  // The habit-class layer (issue #423) lenient-defaults the same way: a
  // habit saved before the class wave carries no class wear, and every
  // habit reads as an Engineer from zero — exactly what a fresh shape
  // writes. Unknown pair keys drop; corrupt figures re-default.
  normalizeHabitClasses(merged.habits);
  // The habit's palette key (issue #445) lenient-defaults the same way:
  // a habit saved before the palette wave carries no color, and the
  // default is what it wore. The migration below replaces the default
  // where a transferred single goal's color speaks.
  for (const habit of merged.habits) {
    habit.color = normalizeHabitColor(habit.color);
  }
  // The one-step migrations (ADR-0017's pattern): each runs for its own
  // version alone — a v10 save passes through the v11 conversion before
  // the one-goal narrowing, a v11 save skips straight to it — and the
  // schema each writes is what the next load reads, so no conversion can
  // ever run twice. The v12 normalization (the goals' live slices and the
  // per-goal palette key's drop) follows both, since the narrowing's
  // transfer reads the raw save's goal colors first.
  if (parsed.version < 11) migrateV10ToV11(raw, merged, rng);
  if (parsed.version < SAVE_VERSION) migrateV11ToV12(merged);
  // The goals' live-share surface (ADR-0047, wave 5) lenient-defaults the
  // same way: a goal saved before the generators wave carries no live
  // slice, which reads — honestly — as a manual-only history that banks
  // nothing at its next completion. The per-goal palette key drops here,
  // after the migration above has read it.
  normalizeGoals(merged.goals);
  // The retired player-wide flow meter (ADR-0041 as retired by issue
  // #423): its schema slot is gone — the per-pair practice-roll meters
  // replaced it. The field drops here per the retired-field precedent;
  // the v10 → v11 conversion above paid its nonzero progress out as one
  // banked roll, reading the raw save's field before this deletion.
  delete (merged as unknown as Record<string, unknown>).flow;
  // The v9 → v10 migration (issue #371) retired with its version: nothing
  // below v10 loads, so no conversion step exists at this boundary yet.
  // The per-module reserve/shift surface (ADR-0047, ADR-0048) lenient-
  // defaults per module: a module saved before the roster wave carries
  // neither — zero reserve, and the Bend the ♯ pick.
  normalizeModules(merged.modules);
  // The retired player-wide scalar (ADR-0047): whatever a pre-v8 save
  // carried is gone — its value rode into the reserves above.
  delete (merged as unknown as Record<string, unknown>).chargeWindow;
  merged.purchased = { ...fresh.purchased, ...merged.purchased };
  return { state: merged };
}

// ── The v10 → v11 migration (issue #427, ADR-0017's one step) ───────────
//
// Every returning player keeps their life: the record, the habits, the
// collection, the banked rolls — untouched. What the World experiment
// retires comes home as currency, once and exactly, refunded in the
// currency it was paid in; what it converts converts once, by one stated
// rule. The migration runs for a v10 save alone — the version gate in
// deserialize routes only v10 here, and the save it writes is v11, so no
// refund, conversion, or payout can ever run twice. The retired flag
// fields die in the same pass.

// The Engineer conversion rule (issue #427), stated once: each habit's
// recorded development converts to Engineer experience at 1 XP per
// recorded second. `habit.seconds` already includes historical manual
// practice credited under the old rules, and the rule's honesty is that
// it converts the record as it stands — no interest, no rounding up, no
// second conversion path in tests or dev tools. Revisable only by a
// future design round, never re-applied: the conversion writes the new
// schema and the pair ledger it writes is what v11 saves carry.
const ENGINEER_XP_PER_RECORDED_SECOND = 1;

// The goal-slot refund's plausibility bound (the lenient clamps'
// precedent: an implausibly large count clamps so it can never disagree
// with the prices). The long-goal ladder is unbounded — its nth rung
// costs 500·5^n — so the refund walk clamps at a count no purchase
// history could ever have held: rung 64 alone costs ~7e45 nous, past any
// lifetime the save could have lived. A corrupt figure refunds the
// ladder's plausible head, never spins.
export const GOAL_CAPACITY_REFUND_CAP = 64;

// The lenient read for a retired scalar: absent or corrupt owes nothing.
function retiredPositive(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function migrateV10ToV11(raw: Partial<GameState> & Record<string, unknown>, merged: GameState, rng: Rng): void {
  // ── Arete refunds, original currency, exact ladders ──────────────────
  // One-place rule: every refunded amount comes from the same price
  // function or constant its purchase charged — the refund and the price
  // can never drift apart. A retired purchase never owned refunds nothing.
  // The refund settles the purchase's cost; it does not flip ownership —
  // the flags rest exactly as carried (the Mutator layer's standing data,
  // whose deletion the brief forbids), and whether production still reads
  // them belongs to the briefs that own those surfaces, never to this
  // conversion.
  let areteRefund = 0;
  if (merged.catalogEntryOwned) {
    // The Mutator tree's entry (BALANCE.catalogEntryCost).
    areteRefund += BALANCE.catalogEntryCost;
    // Mutator slot unlocks past the entry's free first slot: the exact
    // rung each unlock paid, summed over the count of paid slots — the
    // same ladder mutatorSlotCost quotes (economy.ts), read over the
    // slots the save carries.
    for (let unlocked = 1; unlocked < merged.mutatorSlots.length; unlocked++) {
      areteRefund += mutatorSlotCost(unlocked);
    }
  }
  if (merged.rollPoolJoined) {
    // The Mutator Forge's pool join (BALANCE.rollPoolJoinCost).
    areteRefund += BALANCE.rollPoolJoinCost;
  }
  if (raw.horizonBroken === true) {
    // Headroom (BALANCE.horizonBreakCost), read off the raw save's
    // retired flag — the merged copy's key is already deleted above.
    areteRefund += BALANCE.horizonBreakCost;
  }
  merged.arete += areteRefund;

  // ── The nous refund: the shared goal-slot economy retires ────────────
  // `goalCapacityBought` refunds its exact `longGoalCost` ladder sum —
  // the same price function buyGoalCapacity charged per purchase — as
  // one refund, whole nous. The retired count then retires with its
  // economy: capacity is the per-habit fixed figure now.
  const goalCapacityBought = Math.min(Math.floor(retiredPositive(raw.goalCapacityBought)), GOAL_CAPACITY_REFUND_CAP);
  for (let bought = 0; bought < goalCapacityBought; bought++) {
    merged.nous += longGoalCost(bought);
  }
  merged.goalCapacityBought = 0;

  // ── The Engineer conversion, once, one rule ──────────────────────────
  // Each habit's recorded seconds convert at the stated rule into its
  // Engineer pair's experience. The write is assignment, never accrual:
  // the pair's shape after this pass is the only shape it produces. Level
  // and tree points derive through the authored thresholds — the same
  // BALANCE.engineerLevelThresholds the accrual leg (classes.ts) walks,
  // whose array is the one source both walks read — and allocations start
  // at the default: every derived point unspent. The pair's practice-roll
  // meter starts empty. Idempotence is structural: the version gate alone
  // routes a v10 save here, the conversion writes the v11 schema, and the
  // retired fields die in this pass.
  const engineer = classDefOf("engineer");
  for (const habit of merged.habits) {
    const pair = habit.classes.engineer ?? freshClassPair();
    habit.classes.engineer = pair;
    pair.experience = retiredPositive(habit.seconds) * ENGINEER_XP_PER_RECORDED_SECOND;
    pair.level = 0;
    pair.points = 0;
    pair.spent = {};
    while (pair.level < engineer.levelThresholds.length && pair.experience >= engineer.levelThresholds[pair.level]!) {
      pair.level++;
      pair.points++;
    }
  }

  // ── The flow meter's final payout ────────────────────────────────────
  // Nonzero shared flow-meter progress converts into exactly one banked
  // module roll, appended to the shared queue before the meter retires;
  // zero (or a corrupt figure — meters never ran negative) converts to
  // nothing. The meter's `earned` count retires from active use with the
  // meter — already-banked rolls are in the player's hands and untouched.
  const rawFlow = raw.flow as Partial<Meter> | undefined;
  if (rawFlow && retiredPositive(rawFlow.progress) > 0) {
    merged.bankedRolls.push(generateOffer(merged, rng));
  }

  // Retire in place: session history resolves goal IDs against this list.
  // Keep the full condition, schedule, and progress even for goals that
  // have never appeared in a session. Active readers exclude retired rows.
  // The capacity the retirement clamps to is v10's own historical per-
  // habit figure — the v11 knob it retired never sold and the one-goal
  // narrowing (issue #445) supersedes it — so the number lives beside the
  // step that reads it, never in BALANCE.
  const V10_HABIT_GOAL_SLOTS = 3;
  const perHabit = new Map<string, Goal[]>();
  for (const goal of merged.goals) {
    if (goal.condition.habitId === null) goal.retired = true;
    if (goal.retired || goal.condition.habitId === null) continue;
    const own = perHabit.get(goal.condition.habitId) ?? [];
    own.push(goal);
    perHabit.set(goal.condition.habitId, own);
  }
  for (const own of perHabit.values()) {
    const overflow = own.length - V10_HABIT_GOAL_SLOTS;
    if (overflow <= 0) continue;
    const oldestFirst = own
      .map((goal, index) => ({ goal, index }))
      .sort((a, b) => a.goal.createdAt - b.goal.createdAt || a.index - b.index);
    for (const { goal } of oldestFirst.slice(0, overflow)) goal.retired = true;
  }
}

// ── The v11 → v12 migration (issue #445, ADR-0017's one step) ───────────
//
// The one-goal narrowing. A v11 save's habits wear no color of their own
// and may carry several active goals. The conversion, once, per habit:
// zero active goals — the palette default; exactly one — the habit adopts
// that goal's color and the row runs on unchanged (condition, schedule,
// progress, completions); several — every row holds pending a retain-one
// choice at the next habit edit, and the habit wears the default until
// the editor's swatches speak. No row is deleted, combined, or silently
// chosen; no completion fires, so no generator fuel can move. Idempotence
// is structural: the version gate routes a v11 save here alone, and the
// schema this pass writes is what v12 saves carry.

function migrateV11ToV12(merged: GameState): void {
  const perHabit = new Map<string, Goal[]>();
  for (const goal of merged.goals) {
    if (goal.retired || goal.condition.habitId === null) continue;
    const own = perHabit.get(goal.condition.habitId) ?? [];
    own.push(goal);
    perHabit.set(goal.condition.habitId, own);
  }
  for (const habit of merged.habits) {
    const own = perHabit.get(habit.id) ?? [];
    if (own.length === 1) {
      // The raw save's palette key is the oracle: read it off the goal
      // before normalizeGoals drops the retired field.
      habit.color = normalizeHabitColor((own[0] as unknown as { color?: unknown }).color);
      continue;
    }
    habit.color = DEFAULT_HABIT_COLOR;
    for (const goal of own) goal.pendingChoice = true;
  }
}

export const STORAGE_KEY = "flowsynth.save.v1";
