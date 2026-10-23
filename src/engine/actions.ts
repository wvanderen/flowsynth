import { BALANCE, BREATHER, CATEGORY_OF, EPS, isOscillatorType, NEXT_RARITY, REFLECTION_SLIDER_MIN, REFLECTION_SLIDER_NEUTRAL, REFLECTION_SLIDER_POSITIONS, ROLL_POOL, POOL_JOIN_TYPE, SHELF_MODULE, SHELF_TYPES, typeRarityOf, WORLD_ENEMIES } from "./constants";
import { bankableClaimOf, frontierEntitlement, horizonReached } from "./accumulator";
import { rowUnlockCost, unlockableRows, unlockedMergeCap, mergeCapIncreaseCost } from "./catalog";
import { nextCapacityPrice, nextCeilingPrice, nextDiscountPrice } from "./capacity";
import { affordableLevels, cellPurchasePrice, chargeDelivered, maxChordFactorOf, deployedAt, findModule, levelCost, levelsCost, mutatorSlotCost, rowGateOwed, syncRates, wholeNous } from "./economy";
import { columnCost, enemyDefAt, honeCostOf, worldOccupantAt } from "./world";
import { summaryTermsOf } from "./allocation";
import { arcCardDue } from "./arc";
import { adjacent, hex, hexKey, isConnected, neighbors, sameHex } from "./hex";
import { octaveRowOf, positionInRange } from "./lattice";
import { createModule, createMutator, createWeapon, createWorldColumn, freshEnemyStates, openingGrant } from "./state";
import { logSessionPractice } from "./habits";
import { plannedTargetHit } from "./records";
import { rollGoalOccurrences } from "./goals";
import { creditFocusEarning } from "./reserves";
import { moduleScrapValue, skipPayoutOf } from "./scrap";
import { syncAchievements } from "./achievements";
import { syncChordDiscoveries } from "./library";
import { freshAccounting } from "./trust";
import { generateMutatorOffer, generateSpecialOffer, nextDraftUpgradePrice, type Rng } from "./rolls";
import type { Category, GameState, Hex, ModuleInstance, MutatorInstance, Rarity, SessionReflection, ShelfType, SpecialDraftKind, WeaponType } from "./types";

// The Arete purchases' shared refusal, one wording everywhere: nothing of
// Arete acts outside upgrade mode (ADR-0044).
const ARETE_MODE_LOCK = "Arete is spent between sessions.";

export interface ActionResult {
  ok: boolean;
  reason?: string;
  refund?: number;
  // What a bulk purchase actually landed (issue #195, the #173 contract):
  // levels bought, modules touched, and the exact spend. Partial by design —
  // the caller reports these instead of a flat success line.
  bulk?: BulkPurchase;
  // What the merge-all sweep actually landed (issue #368): the pairs
  // combined and the total refund, reported by the caller like the bulk
  // sweeps'.
  merge?: MergeSweep;
  // Feats unlocked by this action (ADR-0015): in-session unlocks queue into
  // the session's summary row instead, so callers don't toast these twice.
  unlocked?: string[];
  // The scrap a scrapping or skipping action banked (issue #377): the
  // caller reports the payout — the recovery value with the scrap action,
  // the offer's payout with the skip.
  scrap?: number;
}

// The bulk result shared by the per-module ladder and the board sweeps.
export interface BulkPurchase {
  levels: number;
  modules: number;
  spent: number;
}

const ok: ActionResult = { ok: true };

function fail(reason: string): ActionResult {
  return { ok: false, reason };
}

// The action-boundary check (ADR-0015 + issue #230): the two permanent
// live ledgers sync together after any state-mutating action — feats and
// chord discoveries both read the board they sit behind. The gated rate
// pass (issue #258) serves both. In development play: every recognized voice-set — active
// or idle — stays available to discovery, the feats that read production
// factors read the factor actually earned, and the retention hint advances
// with the board. Returns the feats' ids for the result's unlocked field;
// discoveries carry no toast of their own — the board's readout names the
// chord the moment it forms.
function checkUnlocks(state: GameState): string[] {
  const snapshot = syncRates(state, true);
  syncChordDiscoveries(state, { chords: snapshot.allocation ? summaryTermsOf(snapshot.allocation) : snapshot.namedChords });
  return syncAchievements(state, {
    chargeDelivered: chargeDelivered(snapshot),
    maxChordFactor: maxChordFactorOf(snapshot),
  }).map((def) => def.id);
}

export function startSession(state: GameState, target: number | null, now: number = 0): ActionResult {
  if (state.mode !== "upgrade") return fail("A session is already running.");
  state.sessionIndex++;
  state.mode = "flow";
  // An unstructured session starts with no active habit selected.
  if (state.activeHabitId === null) state.unstructuredSessions++;
  state.session = {
    target,
    elapsed: 0,
    earned: 0,
    unlocked: [],
    accounting: freshAccounting(),
    targetSignaled: false,
    // The record's start stamp (§9), taken from the start gesture.
    startedAt: now,
    goalSeconds: {},
    // The summary's rolls line (ADR-0041): per-source counts accrue as the
    // meters cross, attributed at the mint — the Mutator Forge's crossings
    // attribute to their own source (ADR-0043).
    rolls: { flow: 0, forge: 0, mutator: 0 },
  };
  // In-session unlocks (Untethered, past session one) queue into the
  // session's summary row — the result carries nothing to toast.
  syncAchievements(state);
  return ok;
}

export function endSession(state: GameState, now: number = 0): ActionResult {
  if (state.mode === "upgrade") return fail("No session is running.");
  const session = state.session;
  // The exit gate (spec §1–2): the honesty report's answer is mandatory and
  // final — the bucket must bank or drop before the session ends. A still
  // unclassified absence buffer counts too: it would have flushed at the
  // visible boundary that preceded any real exit.
  if (session && (session.accounting.poolSeconds > EPS || session.accounting.pendingAwaySeconds > EPS)) {
    return fail("Provisional time is waiting on the honesty report.");
  }
  // Credited practice time (§3) is the seam: the practice-log entry, the
  // charge window, and the summary's practice minutes all key off C —
  // never raw elapsed. The target hit derives from C too — the one shared
  // rule (records.plannedTargetHit) — so a reported miss never suppresses a
  // presence-earned hit.
  const credited = session?.accounting.creditedSeconds ?? 0;
  const earned = session?.earned ?? 0;
  const queued = [...(session?.unlocked ?? [])];
  const target = session?.target ?? null;
  const targetHit = plannedTargetHit(credited, target);
  state.mode = "upgrade";
  // The departed session's final clock (docs/breather-spec.md §1): the
  // temporal base a following breather advances — a breather keeps the
  // Afterglow warm and the Pulsewell cycling from where the session left
  // them. Dead in upgrade mode; reset by the next session start.
  state.lastSessionClock = session?.elapsed ?? 0;
  state.session = null;
  state.sessionsCompleted++;
  if (targetHit) state.plannedSessionsCompleted++;
  // The breather allowance (docs/breather-spec.md §2): credited practice
  // seconds ÷ 5, gated at ten credited minutes, capped at ten minutes,
  // floored to the whole minute. Captured onto the summary — the offer
  // exists only while that summary stands unseen, and a decline expires it.
  const breatherAllowance =
    credited >= BREATHER.minCreditedSeconds
      ? Math.floor(Math.min(credited / BREATHER.creditDivisor, BREATHER.capSeconds) / 60) * 60
      : 0;
  // The banked-earning seam (§2.3, ADR-0012; basis amended by ADR-0019,
  // generalized by issue #371): ending any session banks every owned
  // generator's focus earning — its authored focus coefficient per credited
  // practice second — into its reserve, board or tray alike, at the
  // module's power exactly as delivery scales. Manual practice
  // logs never pass through here and never bank one.
  creditFocusEarning(state, credited);
  logSessionPractice(state, credited, now);
  rollGoalOccurrences(state, now);
  // The session-end boundary check (ADR-0015): First light, On the clock,
  // Keeping time, and friends fire here and join the summary row.
  const ended = syncAchievements(state, { now });
  const achievements = [...queued, ...ended.map((def) => def.id)];
  // The settled honesty events, copied — the session object is gone after
  // this, so both the record and the summary carry their own.
  const events = (session?.accounting.events ?? []).map((event) => ({ ...event }));
  // The session record (§9): one append-only entry at close, whatever the
  // length or mode. The habit id stores raw — it resolves at render — and
  // the goals-advanced ledger snapshots from the session, so deleting or
  // replacing a goal never rewrites history. The reflection joins after
  // close, as the summary records it (see recordSummaryReflection).
  state.sessionRecords.push({
    sessionNumber: state.sessionsCompleted,
    // A session resumed from a pre-§9 save carries no start stamp; its end
    // time stands in rather than dating the record to 1970.
    startedAt: session && session.startedAt > 0 ? session.startedAt : now,
    endedAt: now,
    habitId: state.activeHabitId,
    mode: target !== null ? "planned" : "open-ended",
    plannedTarget: target,
    creditedSeconds: credited,
    earned,
    honestyEvents: events,
    reflection: null,
    goalsAdvanced: Object.entries(session?.goalSeconds ?? {}).map(([goalId, seconds]) => {
      const goal = state.goals.find((row) => row.id === goalId);
      return { goalId, seconds, ...(goal ? { goal: structuredClone(goal) } : {}) };
    }),
    achievements,
    // No breather followed at write time — the line fills if one is taken
    // (docs/breather-spec.md §5).
    breather: null,
  });
  // The loud summary (§5.7): every exit path lands here, so the modal's
  // rows are captured from the session itself — earned, practice time, rate
  // achieved with the breakdown legs — whatever the length or exit. The
  // unlock row stays in design but never fires at launch (ADR-0019): the
  // launch apps are free from minute 0, so there is nothing to unlock.
  const snapshot = syncRates(state, true);
  state.summary = {
    sessionNumber: state.sessionsCompleted,
    // The headline is banked nous — a dropped bucket is absent from it,
    // visible in the event lines instead (§8).
    earned,
    // Practice minutes show credited time (§3, §8).
    seconds: credited,
    // Achieved, not projected (§5.7): a session that ended before any
    // practice accrued has no rate to report.
    ratePerMinute: credited > EPS ? (earned / credited) * 60 : 0,
    synths: snapshot.synths,
    infusors: snapshot.infusors,
    empowerment: snapshot.empowerment,
    // The unlock row renders inert at launch (ADR-0019, issue #83); it
    // fires again when the ladder's first tenant joins, post-launch.
    timeUnlocked: false,
    // The practice row's denominator (§8): "X / Y min" on planned sessions.
    plannedTarget: target,
    // The honesty events beneath the final numbers (§8), where a dropped
    // bucket's drop is visible.
    honestyEvents: events,
    // The rolls line (ADR-0041): this session's banked rolls, split by
    // source — one source reads plainly, both split. The Mutator Forge's
    // crossings (ADR-0043) capture beside them; the summary's rolls line
    // grows the mutator split with the Mutators layer's UI.
    rollsFlow: session?.rolls.flow ?? 0,
    rollsForge: session?.rolls.forge ?? 0,
    rollsMutator: session?.rolls.mutator ?? 0,
    achievements,
    // The reflection (§8) records from the summary itself, so it starts
    // absent here.
    reflection: null,
    // The breather offer (docs/breather-spec.md §2): rides beside dismissal
    // whenever the session minted an allowance.
    breatherAllowance,
    seen: false,
  };
  return ok;
}

// The breather's start (docs/breather-spec.md §1–2, ADR-0073): from the
// summary that minted the allowance, before its dismissal — a dismissed
// summary is a declined breather, and the allowance expires with it. One
// breather per session; nothing starts while a session or breather is live.
export function startBreather(state: GameState, now: number = 0): ActionResult {
  if (state.mode === "breather") return fail("A breather is already running.");
  if (state.mode !== "upgrade") return fail("A session is already running.");
  const summary = state.summary;
  if (!summary) return fail("No session summary to breathe from.");
  if (summary.seen) return fail("The summary is closed — the breather offer expired.");
  if (!(summary.breatherAllowance > 0)) return fail("This session minted no breather.");
  summary.seen = true;
  state.mode = "breather";
  state.breather = { startedAt: now, allowanceSeconds: summary.breatherAllowance, elapsed: 0 };
  return ok;
}

// The breather's one end (docs/breather-spec.md §4–6): the deadline's
// auto-complete and the early exit land here identically — no penalty,
// nothing prorated, the bonus was the response-scaled rate while it ran.
// Completion is the allowance run to zero; an early exit never increments
// the completed count. Both endings bank the breather seconds lived, and
// the factual line lands on the session record the breather followed.
export function endBreather(state: GameState): ActionResult {
  if (state.mode !== "breather" || !state.breather) return fail("No breather is running.");
  const breather = state.breather;
  const completed = breather.elapsed >= breather.allowanceSeconds - EPS;
  state.breatherSeconds += breather.elapsed;
  if (completed) state.breathersCompleted++;
  const record = state.sessionRecords[state.sessionRecords.length - 1];
  if (record) record.breather = { seconds: breather.elapsed, completed };
  state.mode = "upgrade";
  state.breather = null;
  return ok;
}

export function pauseSession(state: GameState): ActionResult {
  if (state.mode !== "flow") return fail("Only a live session can be paused.");
  state.mode = "paused";
  return ok;
}

export function resumeSession(state: GameState): ActionResult {
  if (state.mode !== "paused") return fail("Only a paused session can be resumed.");
  state.mode = "flow";
  return ok;
}

// The summary's reflection (§8): recorded the moment either field is
// touched — the untouched field keeps its neutral default (empty text,
// middle slider) — and absent while neither is. Recording is the logging,
// so every dismissal path (Continue, close, backdrop, Esc) then logs the
// same thing: reflection-or-absent, no distinct skip state. The engine hold
// also persists the half-touched reflection across a reload alongside the
// unseen summary it rides.
export function recordSummaryReflection(
  state: GameState,
  part: Partial<SessionReflection>,
): ActionResult {
  if (!state.summary) return fail("No session summary to reflect on.");
  const current = state.summary.reflection ?? { text: "", slider: REFLECTION_SLIDER_NEUTRAL };
  state.summary.reflection = {
    text: part.text ?? current.text,
    // The decided range is clamped here, not only in the DOM control. The
    // slider is continuous (#233): the range holds and decimals store raw —
    // saved integers stay valid points on the same scale, nothing migrates.
    slider: Math.min(REFLECTION_SLIDER_POSITIONS, Math.max(REFLECTION_SLIDER_MIN, part.slider ?? current.slider)),
  };
  // The record's reflection slot (§9) fills from the same touch: the
  // reflection records after close (it rides the summary), and this is the
  // same session completing its own record — not a rewrite of history.
  const record = state.sessionRecords.find((r) => r.sessionNumber === state.summary!.sessionNumber);
  if (record) record.reflection = { ...state.summary.reflection };
  return ok;
}

// The loud summary's dismissal (§5.7): one-time per session, persisted so a
// reload with an unseen summary re-opens the modal. The reflection is not
// dismissal's business — it recorded as its fields were touched — so all
// four dismissal paths pass through here identically.
export function dismissSummary(state: GameState): ActionResult {
  if (!state.summary) return fail("No session summary to dismiss.");
  state.summary.seen = true;
  return ok;
}

// The opening arc's one pop-up (§8): the second synthesizer's card. One
// dismissal, ever — the flag persists, so the card never fires again
// whatever the board grows into. Idempotent, like every dismissal.
export function dismissArcCard(state: GameState): ActionResult {
  if (!arcCardDue(state)) return fail("No arc card to dismiss.");
  state.arcCardSeen = true;
  return ok;
}

// The starter shelf (ADR-0013, amended by ADR-0022): one-time offers for
// the non-synthesizer landscape — the generator, one infusor, and the Forge.
// Synthesizers and spacers come only through the forge loop. All nous
// spending is upgrade-mode-only (§3); there is no separate catalog gate —
// upgrade mode itself is the purchase window.
export function buyShelfModule(state: GameState, type: ShelfType): ActionResult {
  if (state.mode !== "upgrade") return fail("Purchases happen between sessions.");
  if (!SHELF_TYPES.includes(type)) return fail("That offer is not on the shelf.");
  if (state.purchased[type]) return fail("This shelf offer was already purchased.");
  const price = BALANCE.shelfPrices[type];
  if (wholeNous(state) < price) return fail("Not enough whole nous.");
  state.nous -= price;
  state.purchased[type] = true;
  state.modules.push(createModule(state, SHELF_MODULE[type]));
  return { ok: true, unlocked: checkUnlocks(state) };
}

// Cells (ADR-0013, amended by ADR-0022): direct nous purchases, bought and
// placed in upgrade mode. A new cell must extend the connected frontier, so
// the board grows without ever disconnecting; reshaping stays the
// count-preserving rule. The first purchase into each new octave row pays a
// one-time gate premium on top of the cell price — escalating with row
// distance from the start register, never advancing the purchase scaler,
// and never owed twice (the gatedRows ledger records every paid row,
// including the opening's, which the grant paid). Movement between rows is
// a different action entirely and never meets a gate. The fifths axis is
// ungated; the row range is finite and symmetric around the start register.
export function buyCell(state: GameState, pos: Hex): ActionResult {
  if (state.mode !== "upgrade") return fail("Purchases happen between sessions.");
  if (state.cells.some((c) => sameHex(c, pos))) return fail("That cell is already part of the board.");
  if (!state.cells.some((c) => adjacent(c, pos))) return fail("New cells must touch the board.");
  if (!positionInRange(state, pos)) return fail("That cell lies outside the board's lattice.");
  const row = octaveRowOf(pos);
  const gateOwed = rowGateOwed(state, row);
  const price = cellPurchasePrice(state, pos);
  if (wholeNous(state) < price) return fail("Not enough whole nous.");
  state.nous -= price;
  state.cells.push(pos);
  state.cellsBought++;
  if (gateOwed) state.gatedRows.push(row);
  return { ok: true, unlocked: checkUnlocks(state) };
}

export function upgradeModule(state: GameState, id: string): ActionResult {
  return upgradeModuleLevels(state, id, 1);
}

// The bulk ladder on one module (issue #195): up to `want` levels in one
// action — "max" buying every affordable level — charged at the same
// per-level prices as `upgradeModule`. Partial by design, so a purchase
// that cannot cover its full ladder still buys what the bank covers and
// reports the shortfall through the bulk payload. Zero affordable levels
// refuses and touches nothing.
export function upgradeModuleLevels(state: GameState, id: string, want: number | "max"): ActionResult {
  const module = findModule(state, id);
  if (!module) return fail("Module not found.");
  if (state.mode !== "upgrade") return fail("Upgrades happen between sessions.");
  const budget = affordableLevels(wholeNous(state), module.level);
  const bought = want === "max" ? budget : Math.min(want, budget);
  if (bought < 1) return fail("Not enough whole nous for even one level.");
  const spent = levelsCost(module.level, bought);
  state.nous -= spent;
  module.invested += spent;
  module.level += bought;
  return { ok: true, bulk: { levels: bought, modules: 1, spent }, unlocked: checkUnlocks(state) };
}

// The spacer is silent wire (#193): its level buys nothing, so every bulk
// surface excludes it — the one eligibility rule, read in one place.
export const levelable = (module: ModuleInstance): boolean => module.type !== "spacer";

// The board-wide sweep's plan: per-module level counts whose summed price
// never exceeds the bank. +N walks the modules cheapest-next-level first,
// buying up to N on each until the bank runs dry; MAX is the confirmed
// max-all sweep (issue #173) — repeatedly buy the globally cheapest next
// level until nothing is affordable, which raises the low tail and leaves
// expensive veterans unbuyable. Equal next costs fall to the older module
// (first in the roster), as the approved prototype read them. The plan is
// pure, so the apply below charges exactly what was counted.
function sweepPlan(state: GameState, want: number | "max"): Map<string, number> {
  const eligible = state.modules.filter(levelable);
  const plan = new Map<string, number>();
  const bank = wholeNous(state);
  let remaining = bank;
  if (want === "max") {
    const levelOf = (module: ModuleInstance): number => module.level + (plan.get(module.id) ?? 0);
    // Every purchase spends at least the first level's price, so this
    // bounds the iterations above anything the sweep can actually buy;
    // the growth curve's affordability break ends it far sooner.
    const maxBuys = Math.floor(bank / BALANCE.upgradeFirstCost);
    for (let guard = 0; guard < maxBuys; guard++) {
      let best: ModuleInstance | null = null;
      let bestCost = Number.POSITIVE_INFINITY;
      for (const module of eligible) {
        const nextCost = levelCost(levelOf(module));
        if (nextCost <= remaining && nextCost < bestCost) {
          best = module;
          bestCost = nextCost;
        }
      }
      if (!best) break;
      remaining -= bestCost;
      plan.set(best.id, (plan.get(best.id) ?? 0) + 1);
    }
    return plan;
  }
  const ordered = [...eligible].sort((a, b) => levelCost(a.level) - levelCost(b.level));
  for (const module of ordered) {
    for (let step = 0; step < want; step++) {
      const cost = levelCost(module.level + (plan.get(module.id) ?? 0));
      if (cost > remaining) break;
      remaining -= cost;
      plan.set(module.id, (plan.get(module.id) ?? 0) + 1);
    }
  }
  return plan;
}

// The Upgrade All cluster's action (issue #195): the board-wide bulk sweep
// over every levelable module — deployed and tray alike (tray modules wear
// no face of their own, so this is their only bulk path) — with spacers
// excluded everywhere. Partial by design like the per-module ladder.
export function upgradeAll(state: GameState, want: number | "max"): ActionResult {
  if (state.mode !== "upgrade") return fail("Upgrades happen between sessions.");
  if (!state.modules.some(levelable)) return fail("Nothing to upgrade.");
  const plan = sweepPlan(state, want);
  if (plan.size === 0) return fail("Not enough whole nous for even one level.");
  const bulk = planTotal(state, plan);
  for (const [id, count] of plan) {
    const module = findModule(state, id)!;
    module.invested += levelsCost(module.level, count);
    module.level += count;
  }
  state.nous -= bulk.spent;
  return { ok: true, bulk, unlocked: checkUnlocks(state) };
}

// The sweep's shape without touching state (issue #195): the cluster's
// tooltips preview the same plan the purchase will run, so the promise and
// the charge can never disagree.
export function upgradeAllPreview(state: GameState, want: number | "max"): BulkPurchase {
  return planTotal(state, sweepPlan(state, want));
}

// A plan's totals, read without touching state: the levels, the modules
// touched, and the exact spend the apply loop below charges.
function planTotal(state: GameState, plan: Map<string, number>): BulkPurchase {
  let levels = 0;
  let spent = 0;
  for (const [id, count] of plan) {
    const module = findModule(state, id)!;
    levels += count;
    spent += levelsCost(module.level, count);
  }
  return { levels, modules: plan.size, spent };
}

export function findCombinePartner(state: GameState, id: string): ModuleInstance | undefined {
  const module = findModule(state, id);
  if (!module) return undefined;
  // Exact copies only (ADR-0058): the same named type at the same merge
  // tier — unequal tiers and different types stay separate.
  return state.modules.find((other) => other.id !== id && other.type === module.type && other.tier === module.tier);
}

// Whether a copy has a legal twin anywhere in the roster — board or tray —
// under the one-combine eligibility rule (ADR-0058): the same named type at
// the same merge tier, short of the unlocked cap. The one predicate both
// the library's eligibility marks and the merge-all count read, so a tile's
// pip and the control's number can never disagree.
export function hasMergeTwin(state: GameState, id: string): boolean {
  const partner = findCombinePartner(state, id);
  return partner !== undefined && combinePreview(state, id, partner.id) !== null;
}

// Who melts: the lower level; a level tie leaves the dropped copy (the
// first argument) standing. The one rule both the preview and the combine
// read — the review can never promise a different melt.
function meltOf(selected: ModuleInstance, partner: ModuleInstance): ModuleInstance {
  return partner.level > selected.level ? selected : partner;
}

// The confirmation's terms (issue #152): what combining these two would
// produce, read without touching state. Null whenever the pair cannot
// combine — wrong mode, mismatched type or tier, or a copy already at the
// unlocked cap (#380: the cap the Warp Beam raises) — so the caller has
// nothing to offer.
export interface CombinePreview {
  keepId: string;
  meltId: string;
  nextTier: number;
  level: number;
  refund: number;
}

export function combinePreview(state: GameState, id: string, partnerId: string, keepSelected = false): CombinePreview | null {
  if (state.mode !== "upgrade") return null;
  const selected = findModule(state, id);
  const partner = findModule(state, partnerId);
  if (!selected || !partner || selected.id === partner.id) return null;
  if (selected.type !== partner.type || selected.tier !== partner.tier) return null;
  const nextTier = selected.tier + 1;
  if (nextTier > unlockedMergeCap(state)) return null;
  const melt = meltOf(selected, partner);
  const keep = melt === selected ? partner : selected;
  return { keepId: keepSelected ? selected.id : keep.id, meltId: keepSelected ? partner.id : melt.id, nextTier, level: keep.level, refund: melt.invested };
}

export function combine(state: GameState, id: string, partnerId?: string, keepSelected = false): ActionResult {
  if (state.mode !== "upgrade") return fail("Combining happens between sessions.");
  const selected = findModule(state, id);
  if (!selected) return fail("Module not found.");
  // The checks above and the pairing below only route the failure message;
  // every term of the act — melt, keep, level, refund, next tier — reads
  // from the one pure preview (ADR-0035), so confirm can never disagree
  // with what the review offered.
  let partner: ModuleInstance | undefined;
  if (partnerId !== undefined) {
    partner = findModule(state, partnerId);
    if (!partner || partner.id === selected.id || partner.type !== selected.type || partner.tier !== selected.tier) {
      return fail("Those modules cannot be combined.");
    }
  } else {
    partner = findCombinePartner(state, id);
  }
  if (!partner) return fail("No second copy of this type and tier.");
  const preview = combinePreview(state, id, partner.id, keepSelected);
  if (!preview) return fail("This copy stands at the unlocked tier cap.");

  const melt = findModule(state, preview.meltId)!;
  const keep = findModule(state, preview.keepId)!;
  const retainedInvestment = selected.level >= partner.level ? selected.invested : partner.invested;
  state.nous += preview.refund;
  keep.invested = retainedInvestment;
  keep.tier = preview.nextTier;
  keep.level = preview.level;
  // The result lands where the drop target was (issue #152): the target
  // cell when a deployed copy received the drop, the tray when the target
  // waited in inventory.
  keep.pos = partner.pos;
  melt.pos = null;
  state.modules = state.modules.filter((m) => m.id !== melt.id);
  // The merge transition's targeting rule (issue #374): a melted
  // recipient's id resolves to nothing, so every Spotlight pointing at it
  // drops its pick — the booster returns to its unselected state and its
  // own recovery control, never a stale dead reference. The kept copy
  // keeps its own selection; the melted copy's pick dies with it.
  for (const module of state.modules) {
    if (module.target === melt.id) module.target = null;
  }
  state.combinations++;
  return { ok: true, refund: preview.refund, unlocked: checkUnlocks(state) };
}

// Row merging preserves the chosen copy's secondary effects while inheriting
// the higher input's purchased level and investment. Board/drop semantics stay
// on combine's default path. Recheck inventory membership at commit time.
export function inventoryCombinePreview(state: GameState, id: string, partnerId: string): CombinePreview | null {
  if (!state.modules.some((m) => m.id === id && m.pos === null) ||
      !state.modules.some((m) => m.id === partnerId && m.pos === null)) return null;
  return combinePreview(state, id, partnerId, true);
}

export function combineInventory(state: GameState, id: string, partnerId: string): ActionResult {
  if (!inventoryCombinePreview(state, id, partnerId)) return fail("Choose two matching inventory copies.");
  return combine(state, id, partnerId, true);
}

// Validate the complete batch before removing anything. Hidden selections are
// included, stale/deployed selections refuse the entire action, and duplicates
// cannot pay twice.
export function scrapInventoryBatch(state: GameState, ids: readonly string[]): ActionResult {
  if (state.mode !== "upgrade") return fail("Scrapping happens between sessions.");
  const unique = [...new Set(ids)];
  if (!unique.length) return fail("Select modules to scrap.");
  if (unique.some((id) => !state.modules.some((m) => m.id === id && m.pos === null))) {
    return fail("Selection changed. Review your inventory again.");
  }
  let scrap = 0;
  const unlocked: string[] = [];
  for (const id of unique) {
    const result = scrapModule(state, id);
    scrap += result.scrap ?? 0;
    unlocked.push(...(result.unlocked ?? []));
  }
  return { ok: true, scrap, unlocked };
}

// What a merge-all sweep lands (issue #368): the exact-copy pairs combined
// and the total nous refunded from the melted copies' upgrades.
export interface MergeSweep {
  combines: number;
  refund: number;
}

// The library's batch combine (issue #368): repeatedly pairs every eligible
// exact copy — the same named type at the same merge tier, short of the
// unlocked cap (ADR-0058) — until no legal pair remains. Each pair merges
// through the one-combine action itself, so a sweep can never promise terms
// the drop gesture wouldn't honor: the retention policy (ADR-0058 §7), the
// refund, the feat counter, and the landing all ride the existing path.
// Capped copies and unequal tiers never melt. Partial by design like the
// other bulk actions: with no eligible pair the sweep refuses, touching
// nothing, so repeated activation is harmless.
export function mergeAll(state: GameState): ActionResult {
  if (state.mode !== "upgrade") return fail("Combining happens between sessions.");
  const sweep = runMergeSweep(state);
  if (sweep.combines === 0) return fail("No eligible copies to combine.");
  return { ok: true, merge: { combines: sweep.combines, refund: sweep.refund }, unlocked: sweep.unlocked };
}

// The sweep's shape without touching state (issue #368): the control's
// tooltip previews the same plan the activation runs, so the promise and
// the charge can never disagree. The simulation runs on a JSON clone —
// the save's own shape — with the identical loop.
export function mergeAllPreview(state: GameState): MergeSweep {
  if (state.mode !== "upgrade") return { combines: 0, refund: 0 };
  const clone = JSON.parse(JSON.stringify(state)) as GameState;
  const sweep = runMergeSweep(clone);
  return { combines: sweep.combines, refund: sweep.refund };
}

// The shared loop: roster order, one pass per scan, until a full pass
// lands nothing. The single-combine action re-reads its partner and terms
// from the live roster every call, so mid-pass survivors (a chain: two
// tier pairs producing two copies that then pair) merge in the same sweep.
function runMergeSweep(state: GameState): MergeSweep & { unlocked: string[] } {
  const unlocked: string[] = [];
  let combines = 0;
  let refund = 0;
  let progress = true;
  while (progress) {
    progress = false;
    for (const module of [...state.modules]) {
      // A copy melted earlier in this pass is gone; skip the stale entry.
      if (findModule(state, module.id) !== module) continue;
      const result = combine(state, module.id);
      if (!result.ok) continue;
      combines++;
      refund += result.refund ?? 0;
      unlocked.push(...(result.unlocked ?? []));
      progress = true;
    }
  }
  return { combines, refund, unlocked };
}

// The scrap action (issue #377, ADR-0066): an owned module leaves the
// roster once and its recovery value — the one valuation schedule, the
// named type's fixed rarity scaled per merge tier — banks into the scrap
// balance. Upgrade-mode-only like every reconfiguration; levels and
// invested nous are not refunded (the schedule values the collection, not
// the upgrade spend — ADR-0066). The melted-targeting rule (issue #374)
// applies to removal the same way combining treats it: a scrapped
// recipient's id resolves to nothing forever, so every Spotlight
// pointing at it drops its pick — the remembered-selection rule keeps
// temporary invalidation, never a dead reference.
export function scrapModule(state: GameState, id: string): ActionResult {
  if (state.mode !== "upgrade") return fail("Scrapping happens between sessions.");
  const module = findModule(state, id);
  if (!module) return fail("Module not found.");
  const value = moduleScrapValue(module);
  state.modules = state.modules.filter((m) => m.id !== id);
  for (const other of state.modules) {
    if (other.target === id) other.target = null;
  }
  state.scrap += value;
  return { ok: true, scrap: value, unlocked: checkUnlocks(state) };
}

export function placeModule(state: GameState, id: string, pos: Hex): ActionResult {
  if (state.mode !== "upgrade") return fail("The grid is locked during flow.");
  const module = findModule(state, id);
  if (!module) return fail("Module not found.");
  if (!state.cells.some((c) => sameHex(c, pos))) return fail("That cell is not part of the board.");
  const occupant = deployedAt(state, pos);
  if (module.pos !== null && sameHex(module.pos, pos)) return ok;
  // No module is spatially privileged (ADR-0021): every placement swaps
  // freely, and a swap of identical synthesizers can never break a chord —
  // pitch lives in the cell.
  if (occupant) occupant.pos = module.pos;
  module.pos = pos;
  // Layout changes move the chord multiplier (Power chord).
  return { ok: true, unlocked: checkUnlocks(state) };
}

export function returnModule(state: GameState, id: string): ActionResult {
  if (state.mode !== "upgrade") return fail("The grid is locked during flow.");
  const module = findModule(state, id);
  if (!module) return fail("Module not found.");
  if (module.pos === null) return fail("This module is already in inventory.");
  module.pos = null;
  return { ok: true, unlocked: checkUnlocks(state) };
}

// Reshaping moves owned cells anywhere within the finite row band — always
// free, never gated (ADR-0022: gates tax acquisition only).
export function reshapeCells(state: GameState, next: Hex[]): ActionResult {
  if (state.mode !== "upgrade") return fail("Reshaping happens between sessions.");
  if (next.length !== state.cells.length) return fail("Reshaping preserves the cell count.");
  const keys = new Set(next.map(hexKey));
  if (keys.size !== next.length) return fail("Duplicate cells in the proposed shape.");
  for (const module of state.modules) {
    if (module.pos !== null && !keys.has(hexKey(module.pos))) {
      return fail("Every deployed module needs a cell.");
    }
  }
  if ([...state.world.columns, ...state.world.weapons].some((occupant) => occupant.pos !== null && !keys.has(hexKey(occupant.pos)))) {
    return fail("Every deployed World occupant needs a cell.");
  }
  if (state.mutatorSlots.some((slot) => !keys.has(hexKey(slot)))) {
    return fail("Every unlocked Mutator slot needs its cell.");
  }
  if (next.some((cell) => !positionInRange(state, cell))) return fail("The board must stay inside the board's lattice.");
  if (!isConnected(next)) return fail("The board must stay connected.");
  state.cells = next;
  return { ok: true, unlocked: checkUnlocks(state) };
}

export function chooseRoll(state: GameState, offerId: string, candidateId: string): ActionResult {
  if (state.mode !== "upgrade") return fail("Forge choices belong to upgrade mode.");
  const index = state.bankedRolls.findIndex((o) => o.id === offerId);
  if (index === -1) return fail("That roll is not banked.");
  const offer = state.bankedRolls[index]!;
  const candidate = offer.candidates.find((c) => c.id === candidateId);
  if (!candidate) return fail("That candidate is not part of this roll.");
  state.bankedRolls.splice(index, 1);
  // The candidate's carried tier mints (ADR-0058): 0 from every fresh
  // draw, the converted legacy band from an old save.
  state.modules.push(createModule(state, candidate.type, candidate.tier));
  return { ok: true, unlocked: checkUnlocks(state) };
}

// The skip action (issue #377, ADR-0066): the module roll's second path —
// take none of the three candidates and bank the offer's payout, the
// greatest scrap value among them. The payout equals taking the best
// candidate and immediately scrapping it (the same mint, the same
// schedule), so skipping can never beat the take-and-scrap round trip.
// The offer is consumed once — a repeated id is simply not banked — and
// the payout lands in the one scrap balance, nowhere else. Mutator rolls
// are untouched: unchosen candidates still vanish without consolation
// (ADR-0043).
export function skipRoll(state: GameState, offerId: string): ActionResult {
  if (state.mode !== "upgrade") return fail("Forge choices belong to upgrade mode.");
  const index = state.bankedRolls.findIndex((o) => o.id === offerId);
  if (index === -1) return fail("That roll is not banked.");
  const offer = state.bankedRolls[index]!;
  const payout = skipPayoutOf(offer);
  state.bankedRolls.splice(index, 1);
  state.scrap += payout;
  return { ok: true, scrap: payout, unlocked: checkUnlocks(state) };
}

// The Draft Loom's purchase (issue #378, parent #366): scrap buys a
// permanent rung — each raises every fresh candidate's chance to mint one
// merge tier higher, offered tiers clamped to the unlocked cap. The scrap
// balance is the one currency; nothing else spends or banks it. A past-
// the-ladder-end purchase is unavailable and refuses before any charge,
// as does one the unlocked cap cannot improve (a cap below the first tier
// gives every rung nothing to lift); an unaffordable price never consumes
// scrap. The rungs are memorized: they survive the arete reset beside the
// scrap that pays for them.
export function buyDraftUpgrade(state: GameState): ActionResult {
  if (state.mode !== "upgrade") return fail("Purchases happen between sessions.");
  if (unlockedMergeCap(state) < 1) return fail("No draft can mint above the base tier.");
  const price = nextDraftUpgradePrice(state.draftTierBonus);
  if (price === null) return fail("The Draft Loom is fully tuned.");
  if (state.scrap < price) return fail("Not enough scrap.");
  state.scrap -= price;
  state.draftTierBonus++;
  return { ok: true, unlocked: checkUnlocks(state) };
}

// The special drafts' purchase (issue #379, parent #366): scrap buys one
// unused entitlement of the product's kind — the Jacquard Card (category),
// the Silk Warp (rare), the Plied Weft (+1 merge tier). Every candidate of
// the draft it later weaves will satisfy the bought guarantee; nothing is
// promised beyond it. Refusals land before any charge: the flow lock, an
// unaffordable price, and a Plied Weft the unlocked cap cannot honor (no
// candidate could mint above base) all refuse without consuming scrap.
// Entitlements are memorized: they survive the arete reset beside the
// scrap that pays for them, and counts stack — each weave consumes
// exactly one.
export function buySpecialDraft(state: GameState, kind: SpecialDraftKind): ActionResult {
  if (state.mode !== "upgrade") return fail("Purchases happen between sessions.");
  if (kind === "tier" && unlockedMergeCap(state) < 1) return fail("No draft can mint above the base tier.");
  const price = BALANCE.specialDraftCosts[kind];
  if (state.scrap < price) return fail("Not enough scrap.");
  state.scrap -= price;
  state.specialDrafts[kind] = (state.specialDrafts[kind] ?? 0) + 1;
  return { ok: true, unlocked: checkUnlocks(state) };
}

// The special drafts' weave (issue #379, parent #366): one held
// entitlement is consumed exactly once and the guarantee'd offer banks
// into the ordinary queue — choice, skip payout, and later scrap all read
// the same authoritative rules as any banked roll, because from here on it
// is one. The Jacquard Card names its category in the roll, which must
// be one the current pool drafts (the roll-pool join included). Repeated
// rolls with nothing held refuse without minting an offer.
export function useSpecialDraft(state: GameState, kind: SpecialDraftKind, category: Category, rng: Rng = Math.random): ActionResult {
  if (state.mode !== "upgrade") return fail("Forge choices belong to upgrade mode.");
  if ((state.specialDrafts[kind] ?? 0) < 1) return fail("That special draft is not held.");
  const pool = state.rollPoolJoined ? [...ROLL_POOL, POOL_JOIN_TYPE] : [...ROLL_POOL];
  if (!pool.some((type) => CATEGORY_OF[type] === category)) return fail("That category is not in the draft pool.");
  state.specialDrafts[kind]--;
  state.bankedRolls.push(generateSpecialOffer(state, kind, category, rng));
  return ok;
}

// The Arete Catalog's sheet purchases (ADR-0040 as amended by ADR-0044,
// issue #197): upgrade-mode-only, Arete-paid, one-time, and surviving
// prestige. The entry's engine effects landed with the mutator contracts
// (issue #198): the Mutator Forge module joins the Tray, and the first
// Mutator slot rides the entry — free, on whatever owned cell the player
// arms it on (unlockMutatorSlot's empty-patch case). Since the entry
// sequence (issue #274) the purchase also performs one normal, unrigged
// Mutator roll: the shared two-candidate generator under the shared
// rarity table, banked into the Mutator tray's own queue where every
// Mutator roll waits. A resonance- or charge-family first mutator is an
// accepted dud (ADR-0043's no-rig stands).
export function buyCatalogEntry(state: GameState, rng: Rng = Math.random): ActionResult {
  if (state.mode !== "upgrade") return fail(ARETE_MODE_LOCK);
  if (state.catalogEntryOwned) return fail("The Mutator tree is already entered.");
  if (state.arete < BALANCE.catalogEntryCost) return fail("Not enough Arete.");
  state.arete -= BALANCE.catalogEntryCost;
  state.catalogEntryOwned = true;
  state.modules.push(createModule(state, "mutatorForge"));
  state.bankedMutatorRolls.push(generateMutatorOffer(state, rng));
  return { ok: true, unlocked: checkUnlocks(state) };
}

export function joinRollPool(state: GameState): ActionResult {
  if (state.mode !== "upgrade") return fail(ARETE_MODE_LOCK);
  if (!state.catalogEntryOwned) return fail("Enter the Mutator tree first.");
  if (state.rollPoolJoined) return fail("The Mutator Forge already rolls with the pool.");
  if (state.arete < BALANCE.rollPoolJoinCost) return fail("Not enough Arete.");
  state.arete -= BALANCE.rollPoolJoinCost;
  state.rollPoolJoined = true;
  return { ok: true, unlocked: checkUnlocks(state) };
}

// The board-side Row unlock (ADR-0044, #174's approved surface): one Arete
// purchase opens the octave row beyond the launch band — one per side,
// either order, the ladder escalating 1 then 2 — and the purchase stands in
// the row gate for the row it opens, so cells inside buy with nous as
// usual. The board must reach the row it unlocks (frontier-adjacent rows
// only, matching the banner's construction): a row the board doesn't touch
// has no banner to click and opens by no other path. Past the ladder's end
// the board is at its six-row cap: nothing is unlockable, and no price
// exists to charge.
export function buyRowUnlock(state: GameState, row: number): ActionResult {
  if (state.mode !== "upgrade") return fail(ARETE_MODE_LOCK);
  if (!unlockableRows(state).includes(row)) return fail("That octave row cannot be unlocked.");
  if (!state.cells.some((cell) => neighbors(cell).some((n) => octaveRowOf(n) === row))) {
    return fail("The board must reach the octave row it unlocks.");
  }
  const price = rowUnlockCost(state);
  if (price === null) return fail("The board is at its row cap.");
  if (state.arete < price) return fail("Not enough Arete.");
  state.arete -= price;
  state.unlockedRows.push(row);
  state.gatedRows.push(row);
  return { ok: true, unlocked: checkUnlocks(state) };
}

// ── The Mutator layer's engine (ADR-0043, issue #198) ───────────────────

// The slot ladder's unlock (ADR-0043): the entry's first slot sits free on
// any owned cell — the empty-patch case, its price already inside the
// entry — and every later unlock attaches adjacent to the already-unlocked
// patch, the growth-constrained gesture, paying the ladder's rung for the
// count already unlocked. Slots stay put forever; modules move freely
// across them.
export function unlockMutatorSlot(state: GameState, pos: Hex): ActionResult {
  if (state.mode !== "upgrade") return fail(ARETE_MODE_LOCK);
  if (!state.catalogEntryOwned) return fail("Enter the Mutator tree first.");
  if (!state.cells.some((c) => sameHex(c, pos))) return fail("That cell is not part of the board.");
  if (state.mutatorSlots.some((s) => sameHex(s, pos))) return fail("That cell already holds a Mutator slot.");
  const first = state.mutatorSlots.length === 0;
  if (!first) {
    if (!state.mutatorSlots.some((slot) => adjacent(slot, pos))) {
      return fail("A new Mutator slot must attach to the unlocked patch.");
    }
    const price = mutatorSlotCost(state.mutatorSlots.length);
    if (state.arete < price) return fail("Not enough Arete.");
    state.arete -= price;
  }
  state.mutatorSlots.push(hex(pos.q, pos.r));
  return ok;
}

// Placing a mutator (the Mutator tray's gesture): a tray mutator placed
// into an unlocked slot. An occupied slot swaps, mirroring the board's
// free-swap rule; a mutator needs no host — a slot on a vacant cell holds
// it inert.
export function placeMutator(state: GameState, id: string, pos: Hex): ActionResult {
  if (state.mode !== "upgrade") return fail("The grid is locked during flow.");
  const mutator = state.mutators.find((m) => m.id === id);
  if (!mutator) return fail("Mutator not found.");
  if (!state.mutatorSlots.some((s) => sameHex(s, pos))) return fail("That cell holds no Mutator slot.");
  if (mutator.pos !== null && sameHex(mutator.pos, pos)) return ok;
  const occupant = state.mutators.find((m) => m.pos !== null && sameHex(m.pos, pos));
  if (occupant) occupant.pos = mutator.pos;
  mutator.pos = hex(pos.q, pos.r);
  return ok;
}

// Retrieving a mutator (the drag or right-click gesture): back to the
// Mutator tray, its slot left vacant and inert.
export function returnMutator(state: GameState, id: string): ActionResult {
  if (state.mode !== "upgrade") return fail("The grid is locked during flow.");
  const mutator = state.mutators.find((m) => m.id === id);
  if (!mutator) return fail("Mutator not found.");
  if (mutator.pos === null) return fail("This mutator is already in the Mutator tray.");
  mutator.pos = null;
  return ok;
}

// The mutator roll's choice (ADR-0043): two candidates, the chosen one
// minted into the Mutator tray, the unchosen vanished without consolation.
export function chooseMutatorRoll(state: GameState, offerId: string, candidateId: string): ActionResult {
  if (state.mode !== "upgrade") return fail("Forge choices belong to upgrade mode.");
  const index = state.bankedMutatorRolls.findIndex((o) => o.id === offerId);
  if (index === -1) return fail("That roll is not banked.");
  const offer = state.bankedMutatorRolls[index]!;
  const candidate = offer.candidates.find((c) => c.id === candidateId);
  if (!candidate) return fail("That candidate is not part of this roll.");
  state.bankedMutatorRolls.splice(index, 1);
  state.mutators.push(createMutator(state, candidate.family, candidate.rarity));
  return ok;
}

// The mutator combination's terms (ADR-0043): two of the same family and
// rarity yield one of the next rarity, same family — mutators carry no
// levels, so nothing is retained or refunded. The kept copy is the drop
// target (the second argument), mirroring the module gesture's landing;
// null whenever the pair cannot combine.
export interface MutatorCombinePreview {
  keepId: string;
  meltId: string;
  nextRarity: Rarity;
}

export function combineMutatorsPreview(state: GameState, id: string, partnerId: string): MutatorCombinePreview | null {
  if (state.mode !== "upgrade") return null;
  const selected = state.mutators.find((m) => m.id === id);
  const partner = state.mutators.find((m) => m.id === partnerId);
  if (!selected || !partner || selected.id === partner.id) return null;
  if (selected.family !== partner.family || selected.rarity !== partner.rarity) return null;
  const nextRarity = NEXT_RARITY[selected.rarity];
  if (nextRarity === null) return null;
  return { keepId: partner.id, meltId: selected.id, nextRarity };
}

export function combineMutators(state: GameState, id: string, partnerId?: string): ActionResult {
  if (state.mode !== "upgrade") return fail("Combining happens between sessions.");
  const selected = state.mutators.find((m) => m.id === id);
  if (!selected) return fail("Mutator not found.");
  let partner: MutatorInstance | undefined;
  if (partnerId !== undefined) {
    partner = state.mutators.find((m) => m.id === partnerId);
    if (!partner || partner.id === selected.id || partner.family !== selected.family || partner.rarity !== selected.rarity) {
      return fail("Those mutators cannot be combined.");
    }
  } else {
    partner = state.mutators.find((m) => m.id !== id && m.family === selected.family && m.rarity === selected.rarity);
  }
  if (!partner) return fail("No second copy of this family and rarity.");
  const preview = combineMutatorsPreview(state, id, partner.id);
  if (!preview) return fail("The highest rarity does not combine further.");

  const melt = state.mutators.find((m) => m.id === preview.meltId)!;
  const keep = state.mutators.find((m) => m.id === preview.keepId)!;
  keep.rarity = preview.nextRarity;
  // The result lands where the drop target was (ADR-0035's gesture) — the
  // kept copy is the target, so it never moves; a tray target combines in
  // the tray.
  state.mutators = state.mutators.filter((m) => m.id !== melt.id);
  return ok;
}

// The harmonic-capacity purchase (issue #259, the confirmed design beside
// ADR-0050): the nous Catalog's global ladder. One purchase spends its
// quoted whole-nous price exactly and adds one whole-chord unit to every
// current and future voice — the price is the milestone, so no earned-nous
// gate and no per-module purchase exists. The ladder is strictly finite;
// the ceiling's further rungs stand for sale in the Arete Catalog.
export function buyCapacity(state: GameState): ActionResult {
  if (state.mode !== "upgrade") return fail("Purchases happen between sessions.");
  const price = nextCapacityPrice(state);
  if (price === null) return fail("The capacity ladder is capped.");
  if (wholeNous(state) < price) return fail("Not enough whole nous.");
  state.nous -= price;
  state.capacityBought++;
  return { ok: true, unlocked: checkUnlocks(state) };
}

// The Arete offerings beside the capacity ladder (issue #259): two
// permanent ceiling unlocks — each lets the nous ladder sell one rung
// further, to prototype maximums four and five — and two discounts off the
// original rung prices, 20% then 40% in total. One-time, Arete-paid, and
// surviving prestige; every ceiling costs more than the discount standing
// beside it. Both render only past the Arete Catalog's entry (the face's
// lock screen), so the entry is their mandatory prerequisite here too —
// the playable purchase path the harness buys (issue #262).
export function buyCapacityCeiling(state: GameState): ActionResult {
  if (state.mode !== "upgrade") return fail(ARETE_MODE_LOCK);
  if (!state.catalogEntryOwned) return fail("Enter the Arete Catalog first.");
  const price = nextCeilingPrice(state);
  if (price === null) return fail("Both ceiling unlocks are owned.");
  if (state.arete < price) return fail("Not enough Arete.");
  state.arete -= price;
  state.capacityCeilings++;
  return { ok: true, unlocked: checkUnlocks(state) };
}

export function buyCapacityDiscount(state: GameState): ActionResult {
  if (state.mode !== "upgrade") return fail(ARETE_MODE_LOCK);
  if (!state.catalogEntryOwned) return fail("Enter the Arete Catalog first.");
  const price = nextDiscountPrice(state);
  if (price === null) return fail("Both discounts are owned.");
  if (state.arete < price) return fail("Not enough Arete.");
  state.arete -= price;
  state.capacityDiscounts++;
  return { ok: true, unlocked: checkUnlocks(state) };
}

// The merge cap's Arete purchase (issue #380, parent #366, ADR-0058's
// finite cap): the Catalog's Warp Beam — each owned rung raises the
// unlocked merge cap one tier, so exact-copy progression keeps a reachable
// milestone past the base ceiling. One-time, Arete-paid, escalating
// ladder, strictly finite; the rungs are memorized and survive prestige
// like the Catalog's other sheet purchases. Refusals land before any
// charge: the Arete mode lock, the Catalog entry the surface stands
// behind, the exhausted ladder, and the unaffordable price.
export function buyMergeCapIncrease(state: GameState): ActionResult {
  if (state.mode !== "upgrade") return fail(ARETE_MODE_LOCK);
  if (!state.catalogEntryOwned) return fail("Enter the Arete Catalog first.");
  const price = mergeCapIncreaseCost(state);
  if (price === null) return fail("The merge ladder is at its cap.");
  if (state.arete < price) return fail("Not enough Arete.");
  state.arete -= price;
  state.mergeCapPurchases++;
  return { ok: true, unlocked: checkUnlocks(state) };
}

// Prestige (ADR-0039, issue #170): the door at the horizon banks the era's
// pending frontier claim and begins the next era. The only Arete source in
// the game — claim on reset, never before. The claim (issue #425,
// ADR-0074's frontier contract) is the positive difference between the
// cumulative entitlement at the era's score and the entitlement already
// banked against; the claimed frontier advances only here, atomically with
// banking, in one save transaction. Whole Arete banks; the frontier
// advances by exactly the banked whole step, which is what makes arbitrary
// prestige splittings telescope and leaves the sub-unit fraction pending
// rather than lost. A zero-claim reset is valid — nothing banks, the
// frontier stays.
// The first World-eligible claim (era score past the 1T entry) grants the
// starter Charge Blade outright — a granted copy, not a roll, not a
// purchase; no other claim or prestige ever grants a weapon.
// The reset boundary: owned modules (types, rarity, secondaries),
// cells with placement, `cellsBought` and the paid row gates, tray
// inventory, banked rolls, Forge progress, and the per-pair practice-roll
// meters' fill and earned counts (ADR-0041 — progress earned by real life
// time is never un-earned at the moment prestige pays off), achievements
// and their boost, the life record, the Arete balance, and lifetime
// `totalEarned` persist — as do the Catalog unlocks (issue #197): the Row
// unlock's rows and the Mutator tree's purchases — and, with them, the
// whole mutator layer (issue #198): the unlocked Mutator slots, the placed
// mutators, and the Mutator tray with its pending rolls and its Forge
// branch's fill and earned count — and the Arete offerings beside the
// harmonic-capacity ladder (issue #259): the owned ceiling unlocks and
// discounts — and the scrap balance (issue #377), which persists with the
// collection it values, the Draft Loom's owned rungs (issue #378), which
// persist with the scrap that pays for them, and the special drafts' held
// entitlements (issue #379), which persist unused beside them — and the
// Warp Beam's owned rungs (issue #380), which persist with the raised
// cap they bought — and the whole habit-class layer (issue #423,
// ADR-0074): every habit's class wear, and each habit–class pair's
// experience, level, tree points, allocations, and practice-roll meter.
// Class progress persists through prestige; nothing class-side resets.
// And the whole World layer's purchases (issue #425): the claimed
// frontier, the starter weapon's granted flag, the Charge Columns, the
// weapon copies with their between-session target priorities, and the
// Hone ranks — purchases are permanent, no refund path exists. What
// resets: every enemy restores at its fixed stats (discoveries, damage,
// and the defeated state's era bonuses clear — prestige never raises
// enemy strength), and stored World charge empties (weapon stores and
// cadence clocks; the Columns carry no charge of their own).
// Module levels return to base, nous to
// a fresh opening grant, and the charge window resets — as does the
// ladder's purchased capacity (issue #259): the voices return to one. The era measure
// rebases to 0, which is the bar's own rebase; the era count rises as
// economy-bearing engine state (ADR-0038's no-new-furniture rule holds).
// The prestige's declared tuning (issue #472): an isolated playtesting run
// pays its recipe's opening grant and reads its claim curve base; ordinary
// play passes nothing and keeps the shipped constants.
export interface PrestigeTuning {
  readonly openingGrant?: number;
  readonly claimBase?: number;
}

export function prestige(state: GameState, tuning: PrestigeTuning = {}): ActionResult {
  if (state.mode !== "upgrade") return fail("Prestige happens between sessions.");
  if (!horizonReached(state)) return fail("The horizon is not reached yet.");
  // The claim transaction (issue #425): bank and advance in one move.
  const claim = bankableClaimOf(state, tuning.claimBase);
  state.arete += claim;
  state.world.frontier += claim;
  // The starter grant (issue #425, priority 2): the first World-eligible
  // claim — the era's entitlement reaching at least the Column's price,
  // which the entry grant's construction guarantees — lands the Charge
  // Blade copy outright. Granted exactly once, ever; the eligibility read
  // keeps the grant tied to the curve, not to the claim's rounded figure.
  if (!state.world.starterWeaponGranted && frontierEntitlement(state.eraEarned, tuning.claimBase) >= columnCost(0)) {
    state.world.weapons.push(createWeapon(state, "chargeBlade"));
    state.world.starterWeaponGranted = true;
  }
  state.prestiges++;
  for (const module of state.modules) {
    module.level = 0;
    module.invested = 0;
  }
  state.nous = openingGrant(tuning.openingGrant);
  // Reserves are charge state (ADR-0047): they reset with everything else
  // charge-shaped. Class development, practice history, and the discovery
  // ledger persist.
  for (const module of state.modules) {
    module.reserve = 0;
  }
  // The harmonic-capacity ladder resets with the levels (issue #259):
  // purchased capacity is era progress like everything else the era
  // trained — the voices return to one and the rungs must be earned again
  // through practice. The Arete offerings persist: ceilings and discounts
  // are permanent Catalog purchases.
  state.capacityBought = 0;
  state.eraEarned = 0;
  // The World's era-state resets (issue #425, priority 9): enemies restore
  // at their authored fixed stats — undiscovered, undamaged, era bonuses
  // gone with the defeat state they derived from — and stored World charge
  // empties. Purchases and the frontier persist above.
  state.world.enemies = freshEnemyStates();
  for (const weapon of state.world.weapons) {
    weapon.store = 0;
    weapon.cooldown = 0;
  }
  return { ok: true, unlocked: checkUnlocks(state) };
}

// The Bend's player-picked shift (ADR-0048): one of the rarity's selectable
// ♯/♭ steps, added to the cell's pitch. Upgrade-mode-only like every other
// reconfiguration — the board is locked during flow.
export function setBendShift(state: GameState, id: string, shift: number): ActionResult {
  if (state.mode !== "upgrade") return fail("The grid is locked during flow.");
  const module = findModule(state, id);
  if (!module) return fail("Module not found.");
  if (module.type !== "bend") return fail("Only the Bend picks a shift.");
  // The selectable set grows with the type's FIXED rarity only (ADR-0058).
  if (!BALANCE.bendShifts[typeRarityOf(module.type)].includes(shift)) {
    return fail("That shift is outside this rarity's set.");
  }
  module.shift = shift;
  return { ok: true, unlocked: checkUnlocks(state) };
}

// The Spotlight's player-selected recipient (issue #374, the targeting
// contract): the one oscillator whose term its stronger uplift lands on.
// The pick is by identity — never by output ranking — and upgrade-mode-only
// like every reconfiguration (the board is locked during flow). Any owned
// oscillator may be picked, adjacent or not: the support is live only while
// adjacency holds, so a pick that waits for a later reshuffle is the same
// remembered selection the restoration rule keeps. `null` clears the pick.
export function setBoosterTarget(state: GameState, id: string, targetId: string | null): ActionResult {
  if (state.mode !== "upgrade") return fail("The grid is locked during flow.");
  const module = findModule(state, id);
  if (!module) return fail("Module not found.");
  if (module.type !== "spotlight") return fail("Only the Spotlight picks a recipient.");
  if (targetId === null) {
    module.target = null;
    return { ok: true, unlocked: checkUnlocks(state) };
  }
  const target = findModule(state, targetId);
  if (!target) return fail("Recipient not found.");
  if (!isOscillatorType(target.type)) return fail("Only an oscillator can receive the focus.");
  module.target = targetId;
  return { ok: true, unlocked: checkUnlocks(state) };
}

// ── The World layer's between-session actions (issue #425, ADR-0074) ──

// The Charge Column's Arete purchase (issue #425, priority 6): another
// copy on the authored escalating ladder — multiple copies allowed, the
// entry priced from the frontier curve's floor. The purchase is permanent:
// it is memorized by nothing but the reset contract, and no refund path
// exists for it or any World purchase.
export function buyChargeColumn(state: GameState): ActionResult {
  if (state.mode !== "upgrade") return fail(ARETE_MODE_LOCK);
  const price = columnCost(state.world.columns.length);
  if (state.arete < price) return fail("Not enough Arete.");
  state.arete -= price;
  state.world.columns.push(createWorldColumn(state));
  return { ok: true, unlocked: checkUnlocks(state) };
}

// The Hone purchase (issue #425, priority 7): one rank of the weapon
// type's persistent attack-power upgrade — every current and future copy
// of the type deals the raised figure, and the rank survives prestige.
// Like every World purchase: irreversible, no refund action anywhere.
export function buyHoneRank(state: GameState, type: WeaponType): ActionResult {
  if (state.mode !== "upgrade") return fail(ARETE_MODE_LOCK);
  const price = honeCostOf(state, type);
  if (price === null) return fail("That weapon type is at its Hone ceiling.");
  if (state.arete < price) return fail("Not enough Arete.");
  state.arete -= price;
  state.world.hone[type]++;
  return { ok: true, unlocked: checkUnlocks(state) };
}

// World placement (issue #425, priority 10): an occupant — Column or
// weapon — lands on an owned cell's World face. The shared coordinates'
// rules, the Mutator Grid's precedent: reserved enemy cells block only
// World placement (and stay blocked after defeat — the encounter and its
// era bonus remain), one World occupant per cell, and the module layer
// beneath never reads the occupancy. Relocation is free between sessions;
// upgrade mode is the only window, like every reconfiguration.
export function placeWorldOccupant(state: GameState, id: string, pos: Hex): ActionResult {
  if (state.mode !== "upgrade") return fail("The grid is locked during flow.");
  const column = state.world.columns.find((entry) => entry.id === id);
  const weapon = state.world.weapons.find((entry) => entry.id === id);
  if (!column && !weapon) return fail("World occupant not found.");
  if (!state.cells.some((cell) => sameHex(cell, pos))) return fail("Only an owned cell carries a World face.");
  if (enemyDefAt(pos)) return fail("That cell is reserved for an enemy.");
  const occupied = worldOccupantAt(state, pos);
  if (occupied && occupied.id !== id) return fail("That World cell is already occupied.");
  if (column) column.pos = pos;
  else weapon!.pos = pos;
  return { ok: true, unlocked: checkUnlocks(state) };
}

// World retrieval (issue #425): the occupant returns to the World tray,
// free — placement and relocation never charge.
export function retrieveWorldOccupant(state: GameState, id: string): ActionResult {
  if (state.mode !== "upgrade") return fail("The grid is locked during flow.");
  const column = state.world.columns.find((entry) => entry.id === id);
  const weapon = state.world.weapons.find((entry) => entry.id === id);
  if (!column && !weapon) return fail("World occupant not found.");
  if (column) column.pos = null;
  else weapon!.pos = null;
  return { ok: true, unlocked: checkUnlocks(state) };
}

// A weapon's between-session target priority (issue #425): the ordered
// preference among the authored enemies, stored and locked with everything
// else in flow. Keys resolve against the authored roster — unknown keys
// drop, duplicates collapse — and an unconfigured or exhausted priority
// falls back to the authored sequence order.
export function setWeaponTargetPriority(state: GameState, id: string, keys: string[]): ActionResult {
  if (state.mode !== "upgrade") return fail("The grid is locked during flow.");
  const weapon = state.world.weapons.find((entry) => entry.id === id);
  if (!weapon) return fail("Weapon not found.");
  const known = keys.filter((key, index) => WORLD_ENEMIES.some((def) => def.key === key) && keys.indexOf(key) === index);
  weapon.targetPriority = known;
  return { ok: true, unlocked: checkUnlocks(state) };
}
