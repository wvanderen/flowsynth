import { CATEGORY_OF, CHARGE_RECEIVING_CATEGORIES } from "./constants";
import { adjacent } from "./hex";
import type { GameState, Hex } from "./types";

// The runner and its route probes share this structural seat rule. A
// resting generator is still a charge source: reserves affect the strength
// tiebreak, not the existence of the line. This is a placement policy,
// never a substitute for the economy's actual received-charge calculation.
export function chargeLineCells(state: GameState): Hex[] {
  const placed = state.modules.filter((module) => module.pos !== null);
  const sources = placed.filter((module) =>
    CATEGORY_OF[module.type] === "generator" || CATEGORY_OF[module.type] === "conduit");
  return placed.filter((module) =>
    CHARGE_RECEIVING_CATEGORIES.includes(CATEGORY_OF[module.type]) &&
    sources.some((source) => adjacent(module.pos!, source.pos!)))
    .map((module) => module.pos!);
}
