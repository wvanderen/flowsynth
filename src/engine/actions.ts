import { BALANCE, EPS, NEXT_RARITY, SHELF_MODULE } from "./constants";
import { cellCost, computeRates, deployedAt, findModule, levelCost, longGoalCost, wholeNous } from "./economy";
import { nextRungCost, appActive, LADDER_APPS, type FocusApp } from "./apps";
import { adjacent, hexKey, isConnected, sameHex } from "./hex";
import { createModule, isCarrier } from "./state";
import { logSessionPractice } from "./habits";
import { rollGoalOccurrences } from "./goals";
import { syncAchievements } from "./achievements";
import type { GameState, Hex, ModuleInstance, ShelfType } from "./types";

export interface ActionResult {
  ok: boolean;
  reason?: string;
  refund?: number;
  // Feats unlocked by this action (ADR-0015): in-session unlocks queue into
  // the session's summary row instead, so callers don't toast these twice.
  unlocked?: string[];
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

export function startSession(state: GameState, target: number | null): ActionResult {
  if (state.mode !== "upgrade") return fail("A session is already running.");
  state.sessionIndex++;
  state.mode = "flow";
  // An unstructured session starts with no active habit selected.
  if (state.activeHabitId === null) state.unstructuredSessions++;
  state.session = { target, elapsed: 0, earned: 0, unlocked: [] };
  state.pendingGap = null;
  // In-session unlocks (Untethered, past session one) queue into the
  // session's summary row — the result carries nothing to toast.
  syncAchievements(state);
  return ok;
}

export function endSession(state: GameState, now: number = 0): ActionResult {
  if (state.mode === "upgrade") return fail("No session is running.");
  const session = state.session;
  const elapsed = session?.elapsed ?? 0;
  const earned = session?.earned ?? 0;
  const queued = [...(session?.unlocked ?? [])];
  const reachedTarget = session !== null && session.target !== null && session.elapsed >= session.target;
  state.mode = "upgrade";
  state.session = null;
  state.pendingGap = null;
  state.sessionsCompleted++;
  if (reachedTarget) state.plannedSessionsCompleted++;
  // The focus-keyed generator's rule (§2.3, ADR-0012): ending any session
  // banks a charge window of fraction × live practice time. Banked windows
  // extend the remaining duration — the spec's only stacking rule. Manual
  // practice logs never pass through here and never bank one.
  state.chargeWindow += BALANCE.chargeWindowFraction * elapsed;
  logSessionPractice(state, elapsed, now);
  rollGoalOccurrences(state, now);
  // The session-end boundary check (ADR-0015): First light, On the clock,
  // Keeping time, and friends fire here and join the summary row.
  const ended = syncAchievements(state, { now });
  // The loud summary (§5.7): every exit path lands here, so the modal's
  // rows are captured from the session itself — earned, practice time, rate
  // achieved with the breakdown legs — whatever the length or exit. Time
  // auto-activated with the first completion; only its session says so.
  const snapshot = computeRates(state, true);
  state.summary = {
    sessionNumber: state.sessionsCompleted,
    earned,
    seconds: elapsed,
    // Achieved, not projected (§5.7): a session that ended before any
    // practice accrued has no rate to report.
    ratePerMinute: elapsed > EPS ? (earned / elapsed) * 60 : 0,
    carrier: snapshot.carrier,
    harmonics: snapshot.harmonics,
    chordMultiplier: snapshot.chordMultiplier,
    empowerment: snapshot.empowerment,
    timeUnlocked: state.sessionsCompleted === 1,
    achievements: [...queued, ...ended.map((def) => def.id)],
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

// The reserved prestige button (ADR-0015): inert at launch — pressing only
// acknowledges the horizon. The flag persists so the achievements ticket can
// detect the gesture ("Eyes on the horizon").
export function acknowledgeHorizon(state: GameState): ActionResult {
  state.horizonAcknowledged = true;
  return { ok: true, unlocked: checkAchievements(state) };
}

// The one-time welcome card (§5.1): following its CTA to the Carrier's
// upgrade button — or dismissing it — is the one acknowledgment; the save
// keeps the flag so the card never returns. Skipping straight to a session
// loses nothing: the card forces nothing. It is an upgrade-mode surface —
// it stands down for live sessions, so nothing unlocks mid-session-one.
export function acknowledgeWelcome(state: GameState): ActionResult {
  if (state.mode !== "upgrade") return fail("The welcome card waits for upgrade mode.");
  state.welcomeAcked = true;
  return ok;
}

// The loud summary's dismissal (§5.7): one-time per session, persisted so a
// reload with an unseen summary re-opens the modal.
export function dismissSummary(state: GameState): ActionResult {
  if (!state.summary) return fail("No session summary to dismiss.");
  state.summary.seen = true;
  return ok;
}

// The starter shelf (ADR-0013, ADR-0018): one-time offers for the launch
// categories plus the additive synth that makes chord play possible before
// the first roll. All nous spending is upgrade-mode-only (§3); there is no
// separate store gate — upgrade mode itself is the purchase window.
export function buyShelfModule(state: GameState, type: ShelfType): ActionResult {
  if (state.mode !== "upgrade") return fail("Purchases happen between sessions.");
  if (state.purchased[type]) return fail("This shelf offer was already purchased.");
  const price = BALANCE.shelfPrices[type];
  if (wholeNous(state) < price) return fail("Not enough whole nous.");
  state.nous -= price;
  state.purchased[type] = true;
  state.modules.push(createModule(state, SHELF_MODULE[type], "common"));
  return ok;
}

// Cells (ADR-0013): direct nous purchases, bought and placed in upgrade
// mode. A new cell must extend the connected frontier, so the board grows
// without ever disconnecting; reshaping stays the count-preserving rule.
export function buyCell(state: GameState, pos: Hex): ActionResult {
  if (state.mode !== "upgrade") return fail("Purchases happen between sessions.");
  if (state.cells.some((c) => sameHex(c, pos))) return fail("That cell is already part of the board.");
  if (!state.cells.some((c) => adjacent(c, pos))) return fail("New cells must touch the board.");
  const price = cellCost(state.cellsBought);
  if (wholeNous(state) < price) return fail("Not enough whole nous.");
  state.nous -= price;
  state.cells.push(pos);
  state.cellsBought++;
  return { ok: true, unlocked: checkAchievements(state) };
}

// The activation ladder (ADR-0013): the purchase that flips a focus app on.
// The rung price is shared — buying Notes first makes Goals cost rung two —
// so order is free while the ladder always rises.
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

// The first console long goal (ADR-0012, issue #42): goal capacity. One at
// a time, gated behind the Goals app's activation, each purchase pricing
// the next past the current build-out.
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
  const module = findModule(state, id);
  if (!module) return fail("Module not found.");
  if (state.mode !== "upgrade") return fail("Upgrades happen between sessions.");
  const cost = levelCost(module.level);
  if (wholeNous(state) < cost) return fail("Not enough whole nous.");
  state.nous -= cost;
  module.invested += cost;
  module.level++;
  return ok;
}

export function findCombinePartner(state: GameState, id: string): ModuleInstance | undefined {
  const module = findModule(state, id);
  if (!module) return undefined;
  return state.modules.find((other) => other.id !== id && other.type === module.type && other.rarity === module.rarity);
}

export function combine(state: GameState, id: string, partnerId?: string): ActionResult {
  if (state.mode !== "upgrade") return fail("Combining happens between sessions.");
  const selected = findModule(state, id);
  if (!selected) return fail("Module not found.");
  if (isCarrier(selected)) return fail("The Carrier cannot be combined.");
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
  if (NEXT_RARITY[selected.rarity] === null) return fail("The highest rarity does not combine further.");

  let keep = selected;
  let melt = partner;
  if (melt.level > keep.level) {
    keep = partner;
    melt = selected;
  }

  const refund = melt.invested;
  state.nous += refund;
  const nextRarity = NEXT_RARITY[keep.rarity];
  if (nextRarity === null) return fail("The highest rarity does not combine further.");
  keep.rarity = nextRarity;
  keep.level = Math.max(keep.level, melt.level);
  if (keep.pos === null && melt.pos !== null) {
    keep.pos = melt.pos;
    melt.pos = null;
  }
  state.modules = state.modules.filter((m) => m.id !== melt.id);
  state.combinations++;
  return { ok: true, refund, unlocked: checkAchievements(state) };
}

export function placeModule(state: GameState, id: string, pos: Hex): ActionResult {
  if (state.mode !== "upgrade") return fail("The grid is locked during flow.");
  const module = findModule(state, id);
  if (!module) return fail("Module not found.");
  if (isCarrier(module)) return fail("The Carrier is pinned at the origin.");
  if (!state.cells.some((c) => sameHex(c, pos))) return fail("That cell is not part of the board.");
  const occupant = deployedAt(state, pos);
  if (module.pos !== null && sameHex(module.pos, pos)) return ok;
  if (occupant && isCarrier(occupant)) return fail("The Carrier keeps its cell.");
  if (occupant) occupant.pos = module.pos;
  module.pos = pos;
  // Layout changes move the chord multiplier (Power chord).
  return { ok: true, unlocked: checkAchievements(state) };
}

export function returnModule(state: GameState, id: string): ActionResult {
  if (state.mode !== "upgrade") return fail("The grid is locked during flow.");
  const module = findModule(state, id);
  if (!module) return fail("Module not found.");
  if (isCarrier(module)) return fail("The Carrier is pinned at the origin.");
  if (module.pos === null) return fail("This module is already in inventory.");
  module.pos = null;
  return ok;
}

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
