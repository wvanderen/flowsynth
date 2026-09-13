import { BALANCE, CORE_TYPES, EPS } from "./constants";
import { adjacent } from "./hex";
import type { Contribution, GameState, ModuleInstance, RateSnapshot } from "./types";

export function chargedFactor(strength: number): number {
  return 1 + strength / (1 + strength);
}

export function levelCost(level: number): number {
  if (level < 0) throw new Error("level must be non-negative");
  const numerator = BigInt(BALANCE.upgradeFirstCost) * BALANCE.upgradeCostGrowthNumerator ** BigInt(level);
  const denominator = BALANCE.upgradeCostGrowthDenominator ** BigInt(level);
  return Number((numerator + denominator - 1n) / denominator);
}

export function investment(level: number): number {
  let total = 0;
  for (let i = 0; i < level; i++) total += levelCost(i);
  return total;
}

export function modulePower(module: ModuleInstance): number {
  return BALANCE.rarityPower[module.rarity] ** module.level;
}

export function isCore(module: ModuleInstance): boolean {
  return (CORE_TYPES as readonly string[]).includes(module.type);
}

export function isActive(state: GameState, module: ModuleInstance): boolean {
  if (!isCore(module)) return true;
  if (module.type === "enter") return true;
  if (module.type === "time") return state.timeActive;
  if (module.type === "notes") return state.notesActive;
  if (module.type === "habit") return true;
  if (module.type === "goals") return state.goalsActive;
  return false;
}

export function deployed(state: GameState): ModuleInstance[] {
  return state.modules.filter((m) => m.pos !== null);
}

export function deployedActive(state: GameState): ModuleInstance[] {
  return deployed(state).filter((m) => isActive(state, m));
}

export function findModule(state: GameState, id: string): ModuleInstance | undefined {
  return state.modules.find((m) => m.id === id);
}

export function deployedAt(state: GameState, pos: { q: number; r: number }): ModuleInstance | undefined {
  return state.modules.find((m) => m.pos !== null && m.pos.q === pos.q && m.pos.r === pos.r);
}

export function deployedTime(state: GameState): ModuleInstance | undefined {
  return state.modules.find((m) => m.type === "time" && m.pos !== null);
}

export function wholeNous(state: GameState): number {
  return Math.floor(state.nous + EPS);
}

export function chargeSecondsRemaining(state: GameState): number {
  const time = deployedTime(state);
  if (!time) return 0;
  return time.bursts.reduce((sum, b) => sum + b.seconds, 0);
}

function dispensingStrength(state: GameState): number {
  if (!state.timeActive) return 0;
  const time = deployedTime(state);
  if (!time || time.bursts.length === 0) return 0;
  return time.bursts[0]!.strength;
}

export function chargeActive(state: GameState): boolean {
  return dispensingStrength(state) > 0;
}

function resolveStrength(state: GameState, chargeOverride?: boolean): number {
  const actual = dispensingStrength(state);
  if (chargeOverride === false) return 0;
  if (actual > 0) return actual;
  return chargeOverride === true && state.timeActive ? 1 : 0;
}

export function receivedStrength(state: GameState, module: ModuleInstance, flow: number): number {
  if (flow <= 0 || !isActive(state, module) || module.pos === null) return 0;
  const time = deployedTime(state);
  if (!time || time.pos === null || time.id === module.id) return 0;
  return adjacent(module.pos, time.pos) ? flow : 0;
}

export function infusorBonusAt(state: GameState, module: ModuleInstance, flow: number): number {
  if (module.pos === null) return 0;
  let total = 0;
  for (const other of deployedActive(state)) {
    if (other.type !== "infusor" || other.pos === null || !adjacent(module.pos, other.pos)) continue;
    const strength = receivedStrength(state, other, flow);
    total += BALANCE.infusorBonus * modulePower(other) * chargedFactor(strength);
  }
  return total;
}

function adjacentActiveCores(state: GameState, module: ModuleInstance): number {
  if (module.pos === null) return 0;
  let count = 0;
  for (const other of deployedActive(state)) {
    if (!CORE_TYPES.includes(other.type as (typeof CORE_TYPES)[number])) continue;
    if (other.pos !== null && adjacent(module.pos, other.pos)) count++;
  }
  return count;
}

export function computeRates(state: GameState, chargeOverride?: boolean): RateSnapshot {
  const flow = resolveStrength(state, chargeOverride);
  const active = deployedActive(state);
  const contributions = new Map<string, Contribution>();
  const chargeStrength = new Map<string, number>();

  let base = 0;
  let timeBonus = 0;
  let conditionalBonus = 0;
  let forgeRate = 0;
  let expansionRate = 0;

  for (const module of active) {
    const strength = receivedStrength(state, module, flow);
    chargeStrength.set(module.id, strength);
    const localBonus = infusorBonusAt(state, module, flow);
    const effect = modulePower(module) * (1 + localBonus) * chargedFactor(strength);
    const cores = adjacentActiveCores(state, module);
    let value = 0;
    switch (module.type) {
      case "enter":
        value = BALANCE.baseRate * effect;
        base += value;
        break;
      case "additive":
        value = BALANCE.additiveRate * effect;
        base += value;
        break;
      case "time":
        value = BALANCE.timeBonus * effect;
        timeBonus += value;
        break;
      case "conditional":
        value = BALANCE.conditionalBonusPerActiveCore * cores * effect;
        conditionalBonus += value;
        break;
      case "infusor":
        value = BALANCE.infusorBonus * modulePower(module) * chargedFactor(strength);
        break;
      case "forge":
        value = strength * modulePower(module);
        forgeRate += value;
        break;
      case "expander":
        value = strength * modulePower(module);
        expansionRate += value;
        break;
      default:
        break;
    }
    contributions.set(module.id, {
      moduleId: module.id,
      type: module.type,
      value,
      infusorBonus: localBonus,
      chargeFactor: chargedFactor(strength),
      adjacentActiveCores: cores,
    });
  }

  return {
    base,
    timeBonus,
    conditionalBonus,
    rate: base * (1 + timeBonus) * (1 + conditionalBonus),
    forgeRate,
    expansionRate,
    contributions,
    chargeStrength,
    chargeSeconds: chargeSecondsRemaining(state),
  };
}
