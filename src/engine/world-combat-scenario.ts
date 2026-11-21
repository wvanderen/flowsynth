import { BALANCE } from "./constants";
import { hex } from "./hex";
import { createInitialState, createModule, createWeapon, createWorldColumn } from "./state";
import type { GameState } from "./types";
import { COMBAT_PROOF } from "./world-combat";
import { syncWorldDiscoveries, worldPiecesOf } from "./world";

export function createWorldCombatScenario(): GameState {
  const state = createInitialState();
  state.eraEarned = BALANCE.world.entryNous * 10;
  state.totalEarned = state.eraEarned;
  state.cells.push(hex(1, 1), hex(1, -1), hex(2, 0), hex(0, -1), hex(1, -2), hex(2, -2), hex(-1, 1), hex(-1, 0));
  // The proof grants a compact, connected patch and a charged Module rig.
  // It neither prices these cells nor claims this start can be earned live.
  const host = createModule(state, "additive");
  host.pos = hex(1, 1);
  const flywheel = createModule(state, "focusKeyed");
  flywheel.pos = hex(2, 0);
  flywheel.reserve = 240;
  state.modules.push(host, flywheel);
  state.world.unlocked = state.world.starterColumnGranted = state.world.starterWeaponGranted = true;
  state.world.columns.push(createWorldColumn(state));
  state.world.weapons.push(createWeapon(state, "chargeBlade"));
  state.world.proof = {
    creature: { id: "sentinel", pos: null, hp: COMBAT_PROOF.creature.hp, recovering: false, cooldown: 0 },
    armor: { id: "guard-plate", pos: null },
    spell: { id: "pulse", pos: null, store: 0 },
    conduit: { id: "conduit", pos: null, direction: 2 },
    enemies: Object.fromEntries(COMBAT_PROOF.walls.map((wall) => [wall.key, { hp: wall.maxHp, discovered: false }])),
    enemyCooldown: 0,
    elapsed: 0,
  };
  syncWorldDiscoveries(state);
  return state;
}

export function assertWorldCombatScenario(state: GameState): void {
  const proof = state.world.proof;
  const pieces = worldPiecesOf(state);
  if (state.mode !== "upgrade" || !state.world.unlocked || !proof || proof.elapsed !== 0 ||
      proof.creature.hp !== 24 || proof.creature.recovering || proof.enemies.shale?.hp !== 48 || !proof.enemies.shale.discovered ||
      proof.enemies.basalt?.hp !== 35 || proof.enemies.basalt.discovered || state.world.hone.chargeBlade !== 0 ||
      state.world.columns.length !== 1 || state.world.weapons.length !== 1 || pieces.length !== 6 || pieces.some(({ copy }) => copy.pos !== null)) {
    throw new Error("World combat: expected a fresh, unplayed fixed kit at Shale.");
  }
}
