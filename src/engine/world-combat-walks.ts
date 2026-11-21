// A bounded, deterministic evaluation of the fixed World-combat proof.
// Every change after fixture construction uses normal game actions and
// the existing trusted session walk, not a second combat simulator.
import { buyHoneRank, endSession, placeWorldOccupant, prestige, retrieveWorldOccupant, startSession, type ActionResult } from "./actions";
import { advance } from "./advance";
import { hex } from "./hex";
import type { GameState, Hex } from "./types";
import { attackPowerOf, enemyStateOf, worldPiecesOf } from "./world";
import { createWorldCombatScenario } from "./world-combat-scenario";

const EPOCH = Date.UTC(2026, 10, 21, 12);
const rng = () => 0.3;
const proofOf = (state: GameState) => state.world.proof!;
const stamp = (state: GameState) => EPOCH + proofOf(state).elapsed * 1_000;

function sample(state: GameState) {
  const { creature, spell, elapsed } = proofOf(state);
  return {
    worldSeconds: elapsed,
    creditedSeconds: state.sessionRecords.reduce((total, record) => total + record.creditedSeconds, 0) + (state.session?.accounting.creditedSeconds ?? 0),
    sentinelHp: creature.hp,
    deployed: creature.pos !== null,
    recovering: creature.recovering,
    shaleHp: enemyStateOf(state, "shale").hp,
    basaltHp: enemyStateOf(state, "basalt").hp,
    basaltActive: enemyStateOf(state, "basalt").discovered,
    bladeCharge: state.world.weapons[0]!.store,
    pulseCharge: spell.store,
    eraEarned: state.eraEarned,
  };
}

type Point = ReturnType<typeof sample> & { phase: string };
function accept(what: string, result: ActionResult): void {
  if (!result.ok) throw new Error(`${what}: ${result.reason}`);
}
function land(state: GameState, id: string, pos: Hex): void {
  accept(`Place ${id} at ${pos.q},${pos.r}`, placeWorldOccupant(state, id, pos));
}
function flow(state: GameState, phase: string, seconds: number, points: Point[], stop: () => boolean = () => false, step = 1): void {
  accept("Start flow", startSession(state, null, stamp(state)));
  points.push({ phase, ...sample(state) });
  for (let left = seconds; left > 0 && !stop();) {
    const span = Math.min(step, left);
    const { fault } = advance(state, span, rng);
    if (fault) throw new Error(`${phase}: ${fault}`);
    left -= span;
    points.push({ phase, ...sample(state) });
  }
  accept("Finish flow", endSession(state, stamp(state)));
}

function layout(state: GameState) {
  return worldPiecesOf(state).map(({ kind, copy }) => ({ kind, id: copy.id, pos: copy.pos }));
}

function shaleWalk(origin: GameState, variant: "effective" | "attrition" | "weak") {
  const state = structuredClone(origin);
  const { armor, conduit, creature, spell } = proofOf(state);
  if (variant !== "effective") accept("Bench armor", retrieveWorldOccupant(state, armor.id));
  const [column] = state.world.columns;
  const [blade] = state.world.weapons;
  land(state, column!.id, variant === "weak" ? hex(0, -1) : hex(1, 1));
  land(state, conduit.id, hex(1, 0));
  land(state, blade!.id, hex(1, -1));
  land(state, spell.id, hex(0, 1));
  const start = sample(state);
  const points: Point[] = [];
  const wall = enemyStateOf(state, "shale");
  const limit = variant === "effective" ? 1 : variant === "weak" ? 3 : 6;
  let firstLayout: ReturnType<typeof layout> = [];
  let deployments = 0;
  for (let attempt = 1; attempt <= limit && wall.hp > 0; attempt++) {
    land(state, creature.id, hex(0, 0));
    if (attempt === 1) firstLayout = layout(state);
    deployments++;
    flow(state, `deployment ${attempt}`, 40, points, () => wall.hp === 0 || creature.recovering);
    if (creature.recovering) flow(state, `recovery ${attempt}`, 12, points);
    else break;
  }
  const end = sample(state);
  const outcome = wall.hp === 0 ? "won" : wall.hp > start.shaleHp ? "lost ground" : "not cleared";
  return { state, record: { variant, layout: firstLayout, start, end, outcome, deployments, points } };
}

function basaltWalk(origin: GameState, invest: boolean) {
  const state = structuredClone(origin);
  const { creature, armor, spell } = proofOf(state);
  const start = sample(state);
  const areteBeforeBuy = state.arete;
  if (invest) for (let rank = 0; rank < 2; rank++) accept("Buy type-wide Hone", buyHoneRank(state, "chargeBlade"));
  // The Blade uses the same Column–conduit route as in the Shale walk.
  // Remove Pulse from the comparison to observe the purchased change alone.
  accept("Bench Pulse", retrieveWorldOccupant(state, spell.id));
  land(state, creature.id, hex(2, -2));
  land(state, armor.id, hex(1, -2));
  const deployedLayout = layout(state);
  const wall = enemyStateOf(state, "basalt");
  const points: Point[] = [];
  flow(state, invest ? "Hone ranks 1+2" : "bare prestige", 24, points);
  return {
    start, end: sample(state), layout: deployedLayout, points,
    outcome: wall.hp === 0 ? "won" : creature.recovering ? "defeated" : "not cleared",
    honeRank: state.world.hone.chargeBlade, bladeDamage: attackPowerOf(state, "chargeBlade"),
    areteBeforeBuy, areteAfterBuy: state.arete,
  };
}

export function walkWorldCombatProof() {
  const origin = createWorldCombatScenario();
  const { creature, armor, conduit } = proofOf(origin);
  const preparation: Point[] = [];
  // A common, played injury checkpoint matters: a weak build starting
  // against full HP can only stand still, never show an actual loss.
  land(origin, creature.id, hex(0, 0));
  land(origin, armor.id, hex(-1, 1));
  flow(origin, "common armored probe without charge", 32, preparation);
  flow(origin, "common full recovery", 12, preparation);
  const effective = shaleWalk(origin, "effective");
  const attrition = shaleWalk(origin, "attrition");
  const weak = shaleWalk(origin, "weak");

  const returned = effective.state;
  accept("Bench Sentinel for rebuild", retrieveWorldOccupant(returned, creature.id));
  const beforePrestige = { ...sample(returned), arete: returned.arete, bladeDamage: attackPowerOf(returned, "chargeBlade") };
  accept("Prestige and bank the existing claim", prestige(returned));
  const afterPrestige = { ...sample(returned), arete: returned.arete, bladeDamage: attackPowerOf(returned, "chargeBlade"), rebuildNous: returned.nous };
  const rebuild: Point[] = [];
  flow(returned, "common credited return (no deployment)", 900, rebuild, undefined, 30);
  return {
    seed: "constant RNG 0.3; no draft picks or post-fixture grants",
    conduitDirection: conduit.direction,
    preparation, beforePrestige, afterPrestige, rebuild,
    shale: [effective.record, attrition.record, weak.record] as const,
    basalt: [basaltWalk(returned, false), basaltWalk(returned, true)] as const,
  };
}
