import { BALANCE, NEXT_RARITY } from "./constants";
import { cellCost, deployedAt, findModule, levelCost, wholeNous } from "./economy";
import { adjacent, hexKey, isConnected, sameHex } from "./hex";
import { createModule, isCarrier } from "./state";
import { logSessionPractice } from "./habits";
import { rollGoalOccurrences } from "./goals";
import type { GameState, Hex, ModuleInstance, ShelfType } from "./types";

export interface ActionResult {
  ok: boolean;
  reason?: string;
  refund?: number;
}

const ok: ActionResult = { ok: true };

function fail(reason: string): ActionResult {
  return { ok: false, reason };
}

export function startSession(state: GameState, target: number | null): ActionResult {
  if (state.mode !== "upgrade") return fail("A session is already running.");
  state.sessionIndex++;
  state.mode = "flow";
  state.session = { target, elapsed: 0 };
  state.pendingGap = null;
  return ok;
}

export function endSession(state: GameState, now: number = 0): ActionResult {
  if (state.mode === "upgrade") return fail("No session is running.");
  const elapsed = state.session?.elapsed ?? 0;
  state.mode = "upgrade";
  state.session = null;
  state.pendingGap = null;
  state.sessionsCompleted++;
  // The focus-keyed generator's rule (§2.3, ADR-0012): ending any session
  // banks a charge window of fraction × live practice time. Banked windows
  // extend the remaining duration — the spec's only stacking rule. Manual
  // practice logs never pass through here and never bank one.
  state.chargeWindow += BALANCE.chargeWindowFraction * elapsed;
  logSessionPractice(state, elapsed, now);
  rollGoalOccurrences(state, now);
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
  return ok;
}

// The starter shelf (ADR-0013): one-time offers for the launch categories.
// All nous spending is upgrade-mode-only (§3); there is no separate store
// gate — upgrade mode itself is the purchase window.
export function buyShelfModule(state: GameState, type: ShelfType): ActionResult {
  if (state.mode !== "upgrade") return fail("Purchases happen between sessions.");
  if (state.purchased[type]) return fail("This shelf offer was already purchased.");
  const price = BALANCE.shelfPrices[type];
  if (wholeNous(state) < price) return fail("Not enough whole nous.");
  state.nous -= price;
  state.purchased[type] = true;
  state.modules.push(createModule(state, type, "common"));
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
  return { ok: true, refund };
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
  return ok;
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
  return ok;
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
  return ok;
}
