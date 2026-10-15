import { BALANCE } from "./constants";
import type { ModuleInstance } from "./types";

// The tier ladder's multiplier (ADR-0058): past the authored ladder's end —
// a lenient guard, the combine gate keeps copies inside it — the last entry
// holds.
export function tierPowerOf(tier: number): number {
  return BALANCE.tierPower[Math.min(Math.max(tier, 0), BALANCE.tierPower.length - 1)]!;
}

export function silentVoiceUpliftOf(module: ModuleInstance): number {
  return BALANCE.silentVoiceUpliftPerLevel * module.level * tierPowerOf(module.tier);
}

export function amplifierGainOf(module: ModuleInstance): number {
  return (1 + BALANCE.amplifierGainPerLevel * module.level) * tierPowerOf(module.tier);
}
