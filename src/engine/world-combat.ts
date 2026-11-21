import { BALANCE, EPS, type WorldEnemyDef } from "./constants";
import { adjacent, hex } from "./hex";
import { requireFinite } from "./numeric";
import type { GameState, Hex, WeaponCopy, WorldCombatProof } from "./types";

interface CombatWall extends WorldEnemyDef {
  key: "shale" | "basalt";
  name: string;
  pressure: number;
  damage: number;
  regeneration: number;
}

// Proof figures only. The live roster, claim curve and Hone are unchanged.
export const COMBAT_PROOF = {
  creature: { name: "Sentinel", hp: 24, damage: 3, cadence: 6, regeneration: 2 },
  enemyCadence: 4,
  armor: { name: "Guard Plate", remainingDamage: 0.5 },
  bladeCadence: 5,
  spell: { name: "Pulse", threshold: 6, damage: 11 },
  conduit: { name: "Conduit" },
  walls: [
    { key: "shale", name: "Shale", pos: hex(-1, 0), threshold: 8, maxHp: 48, bonus: 0, pressure: 0.2, damage: 6, regeneration: 0.35 },
    { key: "basalt", name: "Basalt", pos: hex(2, -1), threshold: 18, maxHp: 35, bonus: 0, pressure: 0.35, damage: 8, regeneration: 0.4 },
  ] satisfies readonly CombatWall[],
};

export function activeProofWall(proof: WorldCombatProof): CombatWall | undefined {
  return COMBAT_PROOF.walls.find((wall) => proof.enemies[wall.key]!.discovered && proof.enemies[wall.key]!.hp > 0);
}

function frontierWall(proof: WorldCombatProof): CombatWall | undefined {
  return COMBAT_PROOF.walls.find((wall) => proof.enemies[wall.key]!.hp > 0);
}

export function syncProofWall(state: GameState, proof: WorldCombatProof): number {
  const frontier = frontierWall(proof);
  for (const wall of COMBAT_PROOF.walls) {
    // Keep the report of a defeated wall; undiscover only living walls
    // below the new era's threshold.
    if (wall !== frontier && proof.enemies[wall.key]!.hp > 0) proof.enemies[wall.key]!.discovered = false;
  }
  if (!frontier) return 0;
  const live = proof.enemies[frontier.key]!;
  const active = state.eraEarned >= frontier.threshold;
  const activated = active && !live.discovered;
  if (live.discovered !== active) proof.enemyCooldown = 0;
  live.discovered = active;
  return Number(activated);
}

export function proofDiscoverySeconds(state: GameState, proof: WorldCombatProof, rate: number): number {
  const wall = frontierWall(proof);
  return wall && rate > EPS && state.eraEarned < wall.threshold
    ? (wall.threshold - state.eraEarned) / rate
    : Infinity;
}

export function proofGearBound(proof: WorldCombatProof, pos: Hex | null): boolean {
  return !!(proof.creature.pos && pos && adjacent(proof.creature.pos, pos));
}

export function proofDuel(proof: WorldCombatProof): CombatWall | undefined {
  const wall = activeProofWall(proof);
  return wall && proof.creature.pos && adjacent(proof.creature.pos, wall.pos) ? wall : undefined;
}

export function proofCombatBoundary(proof: WorldCombatProof, weapons: readonly WeaponCopy[], spellIncoming: number): number {
  if (!proofDuel(proof)) return Infinity;
  const next = [COMBAT_PROOF.creature.cadence - proof.creature.cooldown, COMBAT_PROOF.enemyCadence - proof.enemyCooldown];
  for (const blade of weapons) {
    if (proofGearBound(proof, blade.pos)) next.push(COMBAT_PROOF.bladeCadence - blade.cooldown);
  }
  if (proofGearBound(proof, proof.spell.pos)) {
    const missing = COMBAT_PROOF.spell.threshold - proof.spell.store;
    if (missing <= EPS) next.push(EPS);
    else if (spellIncoming > EPS) next.push(missing / spellIncoming);
  }
  return Math.max(EPS, Math.min(...next));
}

export function resetProofDuel(proof: WorldCombatProof): void {
  proof.creature.cooldown = 0;
  proof.enemyCooldown = 0;
}

export function advanceCombatProof(proof: WorldCombatProof, seconds: number, weapons: readonly WeaponCopy[], bladePower: number): void {
  proof.elapsed = requireFinite(proof.elapsed + seconds, "the World clock");
  const creature = proof.creature;
  const stats = COMBAT_PROOF.creature;
  if (!creature.pos) {
    creature.hp = Math.min(stats.hp, creature.hp + stats.regeneration * seconds);
    if (creature.hp === stats.hp) creature.recovering = false;
  }
  for (const wall of COMBAT_PROOF.walls) {
    const live = proof.enemies[wall.key]!;
    if (live.hp > 0) live.hp = Math.min(wall.maxHp, live.hp + wall.regeneration * seconds);
  }
  const wall = proofDuel(proof);
  if (!wall) return;
  const live = proof.enemies[wall.key]!;
  creature.cooldown += seconds;
  proof.enemyCooldown += seconds;
  if (creature.cooldown + EPS >= stats.cadence) {
    creature.cooldown = Math.max(0, creature.cooldown - stats.cadence);
    live.hp = Math.max(0, live.hp - stats.damage);
  }
  for (const blade of weapons) {
    if (!proofGearBound(proof, blade.pos)) continue;
    blade.cooldown += seconds;
    if (blade.cooldown + EPS < COMBAT_PROOF.bladeCadence) continue;
    blade.cooldown = Math.max(0, blade.cooldown - COMBAT_PROOF.bladeCadence);
    if (live.hp <= EPS || blade.store + EPS < BALANCE.world.attackCost) continue;
    blade.store = Math.max(0, blade.store - BALANCE.world.attackCost);
    live.hp = Math.max(0, live.hp - bladePower);
  }
  if (live.hp > EPS && proofGearBound(proof, proof.spell.pos) && proof.spell.store + EPS >= COMBAT_PROOF.spell.threshold) {
    proof.spell.store = Math.max(0, proof.spell.store - COMBAT_PROOF.spell.threshold);
    live.hp = Math.max(0, live.hp - COMBAT_PROOF.spell.damage);
  }
  if (live.hp <= EPS) {
    live.hp = 0;
    resetProofDuel(proof);
    return;
  }
  if (proof.enemyCooldown + EPS >= COMBAT_PROOF.enemyCadence) {
    proof.enemyCooldown = Math.max(0, proof.enemyCooldown - COMBAT_PROOF.enemyCadence);
    const armoured = proofGearBound(proof, proof.armor.pos);
    creature.hp = Math.max(0, creature.hp - wall.damage * (armoured ? COMBAT_PROOF.armor.remainingDamage : 1));
    if (creature.hp === 0) {
      creature.pos = null;
      creature.recovering = true;
      resetProofDuel(proof);
    }
  }
}
