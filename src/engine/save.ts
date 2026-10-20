import { createInitialState, createModule, normalizeChordDiscovery, normalizeModules, normalizeWorld } from "./state";
import { normalizeHabitBuilds } from "./builds";
import { normalizeHabitClasses } from "./classes";
import { normalizeGoals } from "./goals";
import { BALANCE, SAVE_VERSION } from "./constants";
import type { BreatherState, GameState, SpecialDraftKind } from "./types";

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

// ADR-0017's pattern at the v11 boundary (issue #423): the habit-class
// cut is the iteration's schema step. Every version older than v10
// rejects with the start-fresh message — no chain, no archive, no import
// path for rejected versions. A v10 save loads through the lenient-default
// block alone for now: the explicit `migrateV10ToV11` (Engineer
// conversion, the flow meter's final payout, the retired purchases'
// refunds) belongs to the migration brief (#427) and lands beside it.
// The retired v9 step is gone with its version: nothing below v10 loads,
// so nothing can still need it.
export function deserialize(text: string): LoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: "The save data is not valid JSON." };
  }
  if (!isRecord(parsed) || parsed.app !== "flowsynth" || typeof parsed.version !== "number") {
    return { error: "This file is not a FlowSynth save." };
  }
  if (parsed.version < SAVE_VERSION - 1) {
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
  // claim curve (issue #425): the Headroom flag is gone — the migration
  // brief's exact Arete refund (#427) reads the raw save's field and the
  // retired purchase's price before this deletion.
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
  // The habit builds (ADR-0046, wave 4) lenient-default the same way: a
  // habit saved before the builds wave carries no build, and unknown node
  // ids drop — the catalog is code, the save only ids. The unlocks
  // themselves are never stored: they derive idempotently from
  // habit.seconds at read time (the v8 promise — no second bump).
  normalizeHabitBuilds(merged.habits);
  // The goals' live-share surface (ADR-0047, wave 5) lenient-defaults the
  // same way: a goal saved before the generators wave carries no live
  // slice, which reads — honestly — as a manual-only history that banks
  // nothing at its next completion.
  normalizeGoals(merged.goals);
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
  // The retired player-wide flow meter (ADR-0041 as retired by issue
  // #423): its schema slot is gone — the per-pair practice-roll meters
  // replaced it. The field drops here per the retired-field precedent;
  // the v10 → v11 conversion that pays its nonzero progress out as one
  // banked roll belongs to the migration brief (#427), which will read
  // the raw save's field before this deletion.
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

export const STORAGE_KEY = "flowsynth.save.v1";
