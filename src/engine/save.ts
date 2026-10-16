import { createInitialState, createModule, normalizeChordDiscovery, normalizeModules } from "./state";
import { normalizeHabitBuilds } from "./builds";
import { normalizeGoals } from "./goals";
import { modulePower } from "./economy";
import { BALANCE, SAVE_VERSION } from "./constants";
import type { GameState } from "./types";

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

// ADR-0017's pattern at the v10 boundary (issue #371): the charge-quantity
// cut is the iteration's one migration. Every version older than v9
// rejects with the start-fresh message — no chain, no archive, no import
// path for rejected versions — while a v9 save migrates in place:
//   1. Each owned module's stored reserve converts from output seconds to
//      charge quantity: legacySeconds × the module's authored power
//      (modulePower). Under the seconds model the reserve delivered
//      legacySeconds × authored power of module-owned charge; the
//      conversion preserves that total and, with it, the authored-power
//      delivery duration (quantity ÷ strength = the stored seconds).
//      Board-side strength — power mutators, the steady-conduit node's
//      flat bonus — was never the reserve's: it amplified delivery
//      without adding to the banked budget, and delivery re-applies it at
//      the live strength.
//   2. Everything else stands exactly where it was — levels, tiers,
//      placement, notes, goals, the life record. Earning coefficients are
//      code, never save state.
// The conversion is repeatable: it runs only on version === SAVE_VERSION
// - 1, writes only the new shape, and a save/load round-trip is stable.
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
  const migrating = parsed.version === SAVE_VERSION - 1;
  const raw = parsed.state as Partial<GameState> & Record<string, unknown>;
  const fresh = createInitialState();
  if (typeof raw.mode !== "string" || !["upgrade", "flow", "paused"].includes(raw.mode)) {
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
  // The Horizon break (ADR-0042, issue #200) lenient-defaults the same way:
  // absent means never bought — exactly what a pre-break save owes.
  if (typeof raw.horizonBroken !== "boolean") {
    merged.horizonBroken = false;
  }
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
  // The v9 → v10 migration (issue #371): transform in place, before the
  // per-module normalization below reads the new shape.
  if (migrating) {
    migrateV9ToV10(merged);
  }
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

// The one migration step (ADR-0017's pattern, issue #371): a v9 save's
// per-module reserve converts from output seconds to charge quantity at
// the module's authored power — the delivered total and the delivery
// duration both stand, whatever the module's level, tier, or rarity. A
// corrupt or absent figure reads as an empty reserve — charge the old
// system never explained banks nothing it cannot show. The tier keys and
// the banked candidates need no conversion: the v9 shape is the current
// shape everywhere but the reserve's unit.
function migrateV9ToV10(merged: GameState): void {
  for (const module of merged.modules) {
    const legacySeconds = typeof module.reserve === "number" && Number.isFinite(module.reserve) ? module.reserve : 0;
    module.reserve = legacySeconds > 0 ? legacySeconds * modulePower(module) : 0;
  }
}

export const STORAGE_KEY = "flowsynth.save.v1";
