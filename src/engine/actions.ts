import { BALANCE, EPS, NEXT_RARITY, REFLECTION_SLIDER_NEUTRAL, REFLECTION_SLIDER_POSITIONS, SHELF_MODULE, SHELF_TYPES } from "./constants";
import { claimOf, horizonReached } from "./accumulator";
import { affordableLevels, cellPurchasePrice, computeRates, deployedAt, findModule, levelCost, levelsCost, longGoalCost, rowGateOwed, wholeNous } from "./economy";
import { arcCardDue } from "./arc";
import { nextRungCost, appActive, LADDER_APPS, type FocusApp } from "./apps";
import { adjacent, hexKey, isConnected, sameHex } from "./hex";
import { octaveRowOf, positionInRange } from "./lattice";
import { createModule, openingGrant } from "./state";
import { logSessionPractice } from "./habits";
import { plannedTargetHit } from "./records";
import { rollGoalOccurrences } from "./goals";
import { syncAchievements } from "./achievements";
import { freshAccounting } from "./trust";
import type { GameState, Hex, ModuleInstance, Rarity, SessionReflection, ShelfType } from "./types";

export interface ActionResult {
  ok: boolean;
  reason?: string;
  refund?: number;
  // What a bulk purchase actually landed (issue #195, the #173 contract):
  // levels bought, modules touched, and the exact spend. Partial by design —
  // the caller reports these instead of a flat success line.
  bulk?: BulkPurchase;
  // Feats unlocked by this action (ADR-0015): in-session unlocks queue into
  // the session's summary row instead, so callers don't toast these twice.
  unlocked?: string[];
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

// The action-boundary check (ADR-0015): run after any state-mutating action
// that can flip a feat. Returns the ids for the result's unlocked field.
function checkAchievements(state: GameState): string[] {
  return syncAchievements(state).map((def) => def.id);
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
  state.session = null;
  state.sessionsCompleted++;
  if (targetHit) state.plannedSessionsCompleted++;
  // The focus-keyed generator's rule (§2.3, ADR-0012; basis amended by
  // ADR-0019): ending any session banks a charge window of fraction ×
  // credited practice time. Banked windows extend the remaining duration —
  // the spec's only stacking rule. Manual practice logs never pass through
  // here and never bank one.
  state.chargeWindow += BALANCE.chargeWindowFraction * credited;
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
    goalsAdvanced: Object.entries(session?.goalSeconds ?? {}).map(([goalId, seconds]) => ({ goalId, seconds })),
    achievements,
  });
  // The loud summary (§5.7): every exit path lands here, so the modal's
  // rows are captured from the session itself — earned, practice time, rate
  // achieved with the breakdown legs — whatever the length or exit. The
  // unlock row stays in design but never fires at launch (ADR-0019): the
  // launch apps are free from minute 0, so there is nothing to unlock.
  const snapshot = computeRates(state, true);
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
    achievements,
    // The reflection (§8) records from the summary itself, so it starts
    // absent here.
    reflection: null,
    seen: false,
  };
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
    // The decided range is clamped here, not only in the DOM control.
    slider: Math.min(REFLECTION_SLIDER_POSITIONS, Math.max(1, Math.round(part.slider ?? current.slider))),
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
  state.modules.push(createModule(state, SHELF_MODULE[type], "common"));
  return ok;
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
  if (!positionInRange(pos)) return fail("That cell lies outside the board's lattice.");
  const row = octaveRowOf(pos);
  const gateOwed = rowGateOwed(state, row);
  const price = cellPurchasePrice(state, pos);
  if (wholeNous(state) < price) return fail("Not enough whole nous.");
  state.nous -= price;
  state.cells.push(pos);
  state.cellsBought++;
  if (gateOwed) state.gatedRows.push(row);
  return { ok: true, unlocked: checkAchievements(state) };
}

// The activation ladder's purchase (ADR-0013): the rung price is shared —
// buying one tenant first prices the next rung — so order stays free while
// the ladder always rises. The ladder rests empty at launch (ADR-0019):
// every launch app is free, so this refuses everything until a tenant
// (Tasks, post-launch) joins LADDER_APPS.
export function buyActivation(state: GameState, app: FocusApp): ActionResult {
  if (state.mode !== "upgrade") return fail("Purchases happen between sessions.");
  if (!LADDER_APPS.includes(app)) return fail("That app is not sold on the activation ladder.");
  if (appActive(state, app)) return fail("That app is already active.");
  const price = nextRungCost(state);
  if (wholeNous(state) < price) return fail("Not enough whole nous.");
  state.nous -= price;
  state.activatedApps.push(app);
  return ok;
}

// The first console long goal (ADR-0012 as amended by ADR-0034, issue
// #42): goal capacity. Each purchase adds exactly one slot — no occupancy
// gate, so successive slots ride back-to-back whenever affordable — and
// gates behind the Goals app's activation, every price far past the last.
export function buyGoalCapacity(state: GameState): ActionResult {
  if (state.mode !== "upgrade") return fail("Purchases happen between sessions.");
  if (!appActive(state, "goals")) return fail("Goals must be active before its upgrades appear.");
  const price = longGoalCost(state.goalCapacityBought);
  if (wholeNous(state) < price) return fail("Not enough whole nous.");
  state.nous -= price;
  state.goalCapacityBought++;
  return ok;
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
  return { ok: true, bulk: { levels: bought, modules: 1, spent }, unlocked: checkAchievements(state) };
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
  return { ok: true, bulk, unlocked: checkAchievements(state) };
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
  return state.modules.find((other) => other.id !== id && other.type === module.type && other.rarity === module.rarity);
}

// Who melts: the lower level; a level tie leaves the dropped copy (the
// first argument) standing. The one rule both the preview and the combine
// read — the review can never promise a different melt.
function meltOf(selected: ModuleInstance, partner: ModuleInstance): ModuleInstance {
  return partner.level > selected.level ? selected : partner;
}

// The confirmation's terms (issue #152): what combining these two would
// produce, read without touching state. Null whenever the pair cannot
// combine — wrong mode, mismatched type or rarity, or the highest tier —
// so the caller has nothing to offer.
export interface CombinePreview {
  keepId: string;
  meltId: string;
  nextRarity: Rarity;
  level: number;
  refund: number;
}

export function combinePreview(state: GameState, id: string, partnerId: string): CombinePreview | null {
  if (state.mode !== "upgrade") return null;
  const selected = findModule(state, id);
  const partner = findModule(state, partnerId);
  if (!selected || !partner || selected.id === partner.id) return null;
  if (selected.type !== partner.type || selected.rarity !== partner.rarity) return null;
  const nextRarity = NEXT_RARITY[selected.rarity];
  if (nextRarity === null) return null;
  const melt = meltOf(selected, partner);
  const keep = melt === selected ? partner : selected;
  return { keepId: keep.id, meltId: melt.id, nextRarity, level: keep.level, refund: melt.invested };
}

export function combine(state: GameState, id: string, partnerId?: string): ActionResult {
  if (state.mode !== "upgrade") return fail("Combining happens between sessions.");
  const selected = findModule(state, id);
  if (!selected) return fail("Module not found.");
  // The checks above and the pairing below only route the failure message;
  // every term of the act — melt, keep, level, refund, next rarity — reads
  // from the one pure preview (ADR-0035), so confirm can never disagree
  // with what the review offered.
  let partner: ModuleInstance | undefined;
  if (partnerId !== undefined) {
    partner = findModule(state, partnerId);
    if (!partner || partner.id === selected.id || partner.type !== selected.type || partner.rarity !== selected.rarity) {
      return fail("Those modules cannot be combined.");
    }
  } else {
    partner = findCombinePartner(state, id);
  }
  if (!partner) return fail("No second copy of this type and rarity.");
  const preview = combinePreview(state, id, partner.id);
  if (!preview) return fail("The highest rarity does not combine further.");

  const melt = findModule(state, preview.meltId)!;
  const keep = findModule(state, preview.keepId)!;
  state.nous += preview.refund;
  keep.rarity = preview.nextRarity;
  keep.level = preview.level;
  // The result lands where the drop target was (issue #152): the target
  // cell when a deployed copy received the drop, the tray when the target
  // waited in inventory.
  keep.pos = partner.pos;
  melt.pos = null;
  state.modules = state.modules.filter((m) => m.id !== melt.id);
  state.combinations++;
  return { ok: true, refund: preview.refund, unlocked: checkAchievements(state) };
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
  return { ok: true, unlocked: checkAchievements(state) };
}

export function returnModule(state: GameState, id: string): ActionResult {
  if (state.mode !== "upgrade") return fail("The grid is locked during flow.");
  const module = findModule(state, id);
  if (!module) return fail("Module not found.");
  if (module.pos === null) return fail("This module is already in inventory.");
  module.pos = null;
  return ok;
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
  if (next.some((cell) => !positionInRange(cell))) return fail("The board must stay inside the board's lattice.");
  if (!isConnected(next)) return fail("The board must stay connected.");
  state.cells = next;
  return { ok: true, unlocked: checkAchievements(state) };
}

export function chooseRoll(state: GameState, offerId: string, candidateId: string): ActionResult {
  if (state.mode !== "upgrade") return fail("Forge choices belong to upgrade mode.");
  const index = state.bankedRolls.findIndex((o) => o.id === offerId);
  if (index === -1) return fail("That roll is not banked.");
  const offer = state.bankedRolls[index]!;
  const candidate = offer.candidates.find((c) => c.id === candidateId);
  if (!candidate) return fail("That candidate is not part of this roll.");
  state.bankedRolls.splice(index, 1);
  state.modules.push(createModule(state, candidate.type, candidate.rarity));
  // A taken candidate can be the first rare (Fine china) or Forge roll.
  return { ok: true, unlocked: checkAchievements(state) };
}

// Prestige (ADR-0039, issue #170): the door at the horizon banks the era's
// claim and begins the next era. The only Arete source in the game — claim
// on reset, never before — and the nth reset banks n (ADR-0042's linear
// base). The reset boundary: owned modules (types, rarity, secondaries),
// cells with placement, `cellsBought` and the paid row gates, tray
// inventory, banked rolls and Forge progress, achievements and their
// boost, the life record, the Arete balance, and lifetime `totalEarned`
// persist; module levels return to base, nous to a fresh opening grant,
// and the charge window resets. The era measure rebases to 0, which is the
// bar's own rebase; the era count rises as economy-bearing engine state
// (ADR-0038's no-new-furniture rule holds).
export function prestige(state: GameState): ActionResult {
  if (state.mode !== "upgrade") return fail("Prestige happens between sessions.");
  if (!horizonReached(state)) return fail("The horizon is not reached yet.");
  state.arete += claimOf(state);
  state.prestiges++;
  for (const module of state.modules) {
    module.level = 0;
    module.invested = 0;
  }
  state.nous = openingGrant();
  state.chargeWindow = 0;
  state.eraEarned = 0;
  return ok;
}
