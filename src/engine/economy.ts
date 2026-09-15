import { BALANCE, CATEGORY_OF, CHARGE_RECEIVING_CATEGORIES, EPS } from "./constants";
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

export function deployed(state: GameState): ModuleInstance[] {
  return state.modules.filter((m) => m.pos !== null);
}

export function deployedGenerators(state: GameState): ModuleInstance[] {
  return deployed(state).filter((m) => CATEGORY_OF[m.type] === "generator");
}

export function findModule(state: GameState, id: string): ModuleInstance | undefined {
  return state.modules.find((m) => m.id === id);
}

export function deployedAt(state: GameState, pos: { q: number; r: number }): ModuleInstance | undefined {
  return state.modules.find((m) => m.pos !== null && m.pos.q === pos.q && m.pos.r === pos.r);
}

export function wholeNous(state: GameState): number {
  return Math.floor(state.nous + EPS);
}

// Charge exists only while flow is live: board production is session-bound.
export function flowLive(state: GameState): boolean {
  return state.mode === "flow";
}

// A generator's charge output: strength scales with its amplitude (level and
// rarity). Only generators produce charge (§2.3 boundary rule).
export function emittedStrength(module: ModuleInstance, flow: boolean): number {
  if (!flow || CATEGORY_OF[module.type] !== "generator" || module.pos === null) return 0;
  return modulePower(module);
}

// Received charge: the sum of adjacent deployed generators' output.
// Generators never charge themselves or each other; only the chargeable and
// continuous-charge categories receive.
export function receivedStrength(state: GameState, module: ModuleInstance, flow: boolean): number {
  if (!CHARGE_RECEIVING_CATEGORIES.includes(CATEGORY_OF[module.type]) || module.pos === null) return 0;
  let strength = 0;
  for (const generator of deployedGenerators(state)) {
    if (generator.pos !== null && adjacent(module.pos, generator.pos)) {
      strength += emittedStrength(generator, flow);
    }
  }
  return strength;
}

function infusorBonusAt(state: GameState, module: ModuleInstance, flow: boolean): number {
  if (module.pos === null) return 0;
  let total = 0;
  for (const other of deployed(state)) {
    if (CATEGORY_OF[other.type] !== "infusor" || other.pos === null) continue;
    if (!adjacent(module.pos, other.pos)) continue;
    const strength = receivedStrength(state, other, flow);
    total += BALANCE.infusorBonus * modulePower(other) * chargedFactor(strength);
  }
  return total;
}

export function computeRates(state: GameState, flow: boolean = flowLive(state)): RateSnapshot {
  const contributions = new Map<string, Contribution>();
  const chargeStrength = new Map<string, number>();

  let base = 0;
  let forgeRate = 0;

  for (const module of deployed(state)) {
    const strength = receivedStrength(state, module, flow);
    chargeStrength.set(module.id, strength);
    const localBonus = infusorBonusAt(state, module, flow);
    const chargeFactor = chargedFactor(strength);
    const effect = modulePower(module) * (1 + localBonus) * chargeFactor;
    let value = 0;
    switch (module.type) {
      case "carrier":
        value = BALANCE.carrierRate * effect;
        base += value;
        break;
      case "additive":
        value = BALANCE.additiveRate * effect;
        base += value;
        break;
      case "conditional":
        value = BALANCE.conditionalRate * effect;
        base += value;
        break;
      case "forge":
        value = strength * modulePower(module);
        forgeRate += value;
        break;
      default:
        break;
    }
    contributions.set(module.id, {
      moduleId: module.id,
      type: module.type,
      value,
      infusorBonus: localBonus,
      chargeFactor,
      chargeStrength: strength,
    });
  }

  return {
    base,
    rate: base,
    forgeRate,
    contributions,
    chargeStrength,
  };
}
