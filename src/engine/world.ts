// The World layer's engine seam (issue #425, ADR-0074): everything the
// second face shares between the advance walk, the actions, and the rate
// pass. The authored figures live in constants.ts alone (BALANCE.world and
// WORLD_ENEMIES — the brief's one authored location); this module holds the
// arithmetic that reads them: the remaining-production factor, the
// discovery sync and its boundary, the combat clock, and the Charge
// Column's one conservation split. State creators and normalization live in
// state.ts beside their module kin; the claim curve lives in accumulator.ts
// beside the horizon it gates.
import { BALANCE, EPS, WORLD_ENEMIES } from "./constants";
import type { WorldEnemyDef } from "./constants";
import { adjacent, neighbors, sameHex } from "./hex";
import { requireFinite } from "./numeric";
import type { GameState, Hex, RateSnapshot, WeaponCopy, WeaponType, WorldColumn, WorldCombatCreature, WorldCombatProof, WorldEnemyState } from "./types";
import { activeProofWall, advanceCombatProof, COMBAT_PROOF, proofCombatBoundary, proofDiscoverySeconds, syncProofWall } from "./world-combat";

const ENEMY_BY_KEY = new Map(WORLD_ENEMIES.map((def) => [def.key, def]));

export function enemyDefOf(key: string) {
  return ENEMY_BY_KEY.get(key);
}

// The authored enemy whose World position is this coordinate, if any.
export function enemyDefAt(pos: Hex) {
  return WORLD_ENEMIES.find((def) => sameHex(def.pos, pos));
}

// The proof has its own roster; ordinary saves keep the shipped enemies.
export function worldEnemiesOf(state: GameState): readonly WorldEnemyDef[] {
  return state.world.proof ? COMBAT_PROOF.walls : WORLD_ENEMIES;
}

export function worldEnemyAt(state: GameState, pos: Hex): WorldEnemyDef | undefined {
  return worldEnemiesOf(state).find((def) => sameHex(def.pos, pos));
}

export function worldCellReserved(state: GameState, pos: Hex): boolean {
  const def = worldEnemyAt(state, pos);
  return Boolean(def && (!state.world.proof || !enemyDefeated(state, def.key)));
}

export type WorldPiece =
  | { kind: "column" | "armor"; copy: WorldColumn }
  | { kind: "weapon"; copy: WeaponCopy }
  | { kind: "creature"; copy: WorldCombatCreature }
  | { kind: "conduit"; copy: WorldCombatProof["conduit"] }
  | { kind: "spell"; copy: WorldCombatProof["spell"] };

export function worldPiecesOf(state: GameState): WorldPiece[] {
  const { proof, columns, weapons } = state.world;
  const pieces: WorldPiece[] = [
    ...columns.map((copy) => ({ kind: "column" as const, copy })),
    ...weapons.map((copy) => ({ kind: "weapon" as const, copy })),
  ];
  if (proof) pieces.push(
    { kind: "creature", copy: proof.creature }, { kind: "armor", copy: proof.armor },
    { kind: "spell", copy: proof.spell }, { kind: "conduit", copy: proof.conduit },
  );
  return pieces;
}

export function worldPieceOf(state: GameState, id: string): WorldPiece | undefined {
  return worldPiecesOf(state).find(({ copy }) => copy.id === id);
}

// World occupation is independent of the Modules occupant below.
export function worldOccupantAt(state: GameState, pos: Hex): { kind: WorldPiece["kind"]; id: string } | undefined {
  const piece = worldPiecesOf(state).find(({ copy }) => copy.pos !== null && sameHex(copy.pos, pos));
  return piece && { kind: piece.kind, id: piece.copy.id };
}

// The enemy's live state — always present for an authored key after
// normalization; a missing key reads as the authored fresh state rather
// than poisoning a read.
export function enemyStateOf(state: GameState, key: string): WorldEnemyState {
  const trial = state.world.proof?.enemies[key];
  if (trial) return trial;
  const def = ENEMY_BY_KEY.get(key)!;
  return state.world.enemies[key] ?? { discovered: false, hp: def.maxHp };
}

// Whether the enemy has been defeated: zero HP. Derived, never stored —
// the cleared face and the era bonus both read this one comparison.
export function enemyDefeated(state: GameState, key: string): boolean {
  return enemyStateOf(state, key).hp <= EPS;
}

// The World layer's remaining-production factor (issue #425): every
// discovered, living enemy multiplies its (1 − penalty) into the product,
// every defeated one its (1 + bonus) — multiplicative stacking, so the
// nine-living-enemies floor is penalty⁹, never an additive sum. The
// penalty is the enemy's live depth band (issue #489): it deepens with
// era-earned past the enemy's own reveal, bounded by the authored bands'
// strictly positive floor. Undiscovered enemies weigh nothing. Nous
// production only: charge generation, routing, and combat never read this.
export function worldFactorOf(state: GameState): number {
  if (state.world.proof) return 1 - (activeProofWall(state.world.proof)?.pressure ?? 0);
  let factor = 1;
  for (const def of WORLD_ENEMIES) {
    const live = state.world.enemies[def.key];
    if (!live?.discovered) continue;
    factor *= enemyDefeated(state, def.key) ? 1 + def.bonus : 1 - enemyPenaltyOf(state, def.key);
  }
  return factor;
}

// The enemy's authored band marks: its discovery threshold times each
// authored step — the crossings the depth read counts and the walk's
// boundary splits at. One construction, so the two reads can never
// disagree about what a band crossing is.
function bandMarksOf(def: WorldEnemyDef): number[] {
  return BALANCE.world.enemyDepthSteps.map((step) => def.threshold * step);
}

// The enemy's depth (issue #489): how many authored band steps its era
// has earned past its OWN discovery threshold. Derived, never stored —
// era-earned is the whole input, so spending the wallet provides no
// relief, a prestige rebases the depth away with the era, and an enemy
// the era's one-move settlement reveals past several of its steps lands
// at its full earned depth at once. Exact threshold counts as crossed.
export function enemyDepthOf(state: GameState, key: string): number {
  const def = ENEMY_BY_KEY.get(key)!;
  const eraEarned = state.eraEarned;
  return bandMarksOf(def).filter((mark) => mark <= eraEarned).length;
}

// The enemy's live penalty at its current depth (issue #489): the one
// read the production factor and both inspection surfaces (the World
// plate and the Hex detail's World line) share, so no inspection can
// disagree with the rate pass about the pressure. The authored array is
// the single source; its last entry is the bound.
export function enemyPenaltyOf(state: GameState, key: string): number {
  if (state.world.proof) {
    const active = activeProofWall(state.world.proof);
    return active?.key === key ? active.pressure : 0;
  }
  return BALANCE.world.enemyDepthPenalties[enemyDepthOf(state, key)]!;
}

// The discovery sync (issue #425): every authored enemy whose reveal
// threshold the era-earned measure has crossed discovers NOW — all
// thresholds crossed in one move discover together, sequentially-ordered
// discovery is rejected by design. Idempotent; returns how many flipped.
// The advance walk splits at the first crossing so a span never produces
// past a threshold at the pre-discovery rate; the bucket's one-move bank
// after an honesty settlement meets this sync directly.
export function syncWorldDiscoveries(state: GameState): number {
  if (state.world.proof) return syncProofWall(state, state.world.proof);
  let discovered = 0;
  for (const def of WORLD_ENEMIES) {
    const live = state.world.enemies[def.key];
    if (live && !live.discovered && state.eraEarned >= def.threshold) {
      live.discovered = true;
      discovered++;
    }
  }
  return discovered;
}

// The discovery boundary (issue #425, priority 5): seconds of production at
// this rate until era-earned crosses the lowest not-yet-revealed threshold —
// a rate-relevant boundary the walk splits at, because the penalty change
// lands exactly at the discovery point. Infinity when no reveal waits or
// nothing produces.
export function discoverySecondsOf(state: GameState, rate: number): number {
  if (rate <= EPS) return Infinity;
  let next = Infinity;
  for (const def of WORLD_ENEMIES) {
    if (def.threshold <= state.eraEarned) continue;
    const live = state.world.enemies[def.key];
    if (live?.discovered) continue;
    next = Math.min(next, def.threshold);
  }
  return next === Infinity ? Infinity : (next - state.eraEarned) / rate;
}

// The depth-band boundary (issue #489): seconds of production until
// era-earned crosses the next authored band step of any discovered,
// undefeated enemy — a rate-relevant boundary the walk splits at, because
// the penalty change lands exactly at the crossing. Defeated enemies
// hold no boundary (their pressure is gone), undiscovered ones neither
// (their reveal boundary is the earlier split and always fires first — a
// step mark sits at or above the enemy's own threshold). Infinity when
// no deeper band waits or nothing produces.
export function bandBoundarySeconds(state: GameState, rate: number): number {
  if (rate <= EPS) return Infinity;
  let next = Infinity;
  for (const def of WORLD_ENEMIES) {
    const live = state.world.enemies[def.key];
    if (!live?.discovered || enemyDefeated(state, def.key)) continue;
    for (const mark of bandMarksOf(def)) {
      if (mark > state.eraEarned) {
        next = Math.min(next, mark);
        break;
      }
    }
  }
  return next === Infinity ? Infinity : (next - state.eraEarned) / rate;
}

// The World's own span boundary (issue #425, priority 5): the earlier of
// the discovery crossing, the depth-band crossing (issue #489), and the
// next attack tick — the one read both walk loops share, so the
// trusted-time legs can never drift apart.
export function worldBoundarySeconds(state: GameState, rate: number, snapshot?: Pick<RateSnapshot, "chargeStrength">): number {
  const proof = state.world.proof;
  if (proof) {
    const lift = snapshot && proof.spell.pos ? columnLiftsOf(state, snapshot, undefined, true) : undefined;
    const spellIncoming = lift?.bySpell.get(proof.spell.id) ?? 0;
    // Split again when another store fills: its share can then reach the
    // spell and move the exact instant at which it can spend threshold charge.
    let fillBoundary = Infinity;
    if (spellIncoming > EPS) for (const blade of state.world.weapons) {
      const incoming = lift?.byWeapon.get(blade.id) ?? 0;
      if (incoming > EPS) fillBoundary = Math.min(fillBoundary, (BALANCE.world.storageCap - blade.store) / incoming);
    }
    return Math.min(proofDiscoverySeconds(state, proof, rate), proofCombatBoundary(proof, state.world.weapons, spellIncoming), fillBoundary);
  }
  return Math.min(discoverySecondsOf(state, rate), combatBoundaryOf(state), bandBoundarySeconds(state, rate));
}

// The weapon type's current attack power (issue #425): the authored base
// plus the type's owned Hone ranks — type-level, so every current and
// future copy of the type deals the same figure.
export function attackPowerOf(state: GameState, type: WeaponType): number {
  return BALANCE.world.attackBase + state.world.hone[type] * BALANCE.world.honeAttackPerRank;
}

// Historical Column-price arithmetic retained for calibration/translation
// tooling provenance. ADR-0087 retires the purchase: the action refuses and
// neither the live starter grant nor Catalog reads this price.
export function columnCost(owned: number): number {
  if (owned < 0) throw new Error("owned must be non-negative");
  return BALANCE.world.columnFirstPrice * BALANCE.world.columnPriceGrowth ** owned;
}

// The Hone ladder's next-rank price for a weapon type, or null past the
// authored ladder's end — the type is at its ceiling and nothing more is
// sold.
export function honeCostOf(state: GameState, type: WeaponType): number | null {
  const rank = state.world.hone[type];
  const ladder = BALANCE.world.honeCosts;
  return rank < ladder.length ? ladder[rank]! : null;
}

// A weapon's ordered target preference (issue #425): the stored priority
// first, in order, then the authored roster order — so an unconfigured or
// exhausted priority falls back to the authored sequence. Only eligible
// enemies qualify: discovered, undefeated, and adjacent to the weapon's
// World cell. Tray weapons qualify nothing.
export function eligibleTargetsOf(state: GameState, weapon: WeaponCopy): string[] {
  if (weapon.pos === null) return [];
  const seen = new Set<string>();
  const order: string[] = [];
  for (const key of [...weapon.targetPriority, ...WORLD_ENEMIES.map((def) => def.key)]) {
    if (seen.has(key)) continue;
    seen.add(key);
    order.push(key);
  }
  const eligible: string[] = [];
  for (const key of order) {
    const def = ENEMY_BY_KEY.get(key)!;
    const live = state.world.enemies[key];
    if (!live?.discovered || enemyDefeated(state, key)) continue;
    if (!adjacent(weapon.pos, def.pos)) continue;
    eligible.push(key);
  }
  return eligible;
}

// The combat boundary (issue #425, priority 5): seconds until the next
// attack tick of any deployed weapon holding an eligible target — a
// rate-relevant boundary whether or not the weapon is currently fed, since
// the tick is when a kill can land and the unfed tick is when new supply
// first gets spent. A weapon with no eligible target holds no boundary (a
// target appears only at a discovery or a prestige, both their own
// boundaries), so quiet eras span whole board boundaries. Clamped off zero
// so a lenient save's stale cooldown cannot wedge the walk on an empty
// span.
export function combatBoundaryOf(state: GameState): number {
  const cadence = BALANCE.world.attackCadenceSeconds;
  let next = Infinity;
  for (const weapon of state.world.weapons) {
    if (weapon.pos === null) continue;
    if (eligibleTargetsOf(state, weapon).length === 0) continue;
    next = Math.min(next, Math.max(cadence - weapon.cooldown, EPS));
  }
  return next;
}

// One span's combat (issue #425, priorities 4–5): every deployed weapon's
// cadence clock advances by the span, then the ticks it crossed resolve in
// order — each spends the fixed charge cost and deals the type's current
// attack power into its highest-priority eligible target. A tick with no
// eligible target or no charge is wasted (uptime is what storage buys);
// the walk itself cuts at combatBoundaryOf so a kill lands on a span edge
// and the remainder's production really carries the changed factor.
// Trusted time only: the callers gate this on the live and breather walks —
// provisional spans hold fire, and honesty-credited minutes never retro-fight.
export function advanceWorldCombat(state: GameState, spanSeconds: number): void {
  if (state.world.proof) return advanceCombatProof(state.world.proof, spanSeconds, state.world.weapons, attackPowerOf(state, "chargeBlade"));
  const cadence = BALANCE.world.attackCadenceSeconds;
  for (const weapon of state.world.weapons) {
    if (weapon.pos === null) continue;
    weapon.cooldown = requireFinite(weapon.cooldown + spanSeconds, "a weapon's combat clock");
    let fires = Math.floor(weapon.cooldown / cadence);
    if (fires <= 0) continue;
    weapon.cooldown -= fires * cadence;
    while (fires-- > 0) {
      const target = eligibleTargetsOf(state, weapon)[0];
      if (target === undefined) break;
      if (weapon.store < BALANCE.world.attackCost) break;
      weapon.store = requireFinite(weapon.store - BALANCE.world.attackCost, "a weapon's stored charge");
      const live = state.world.enemies[target]!;
      live.hp = Math.max(0, requireFinite(live.hp - attackPowerOf(state, weapon.type), "an enemy's health"));
    }
  }
}

export interface ColumnSplit {
  // What each consumer accepted, by id.
  accepted: Map<string, number>;
  // What no consumer could take — supply conserved on paper, lost in the
  // pipes. Conservation is the invariant the tests pin: accepted total plus
  // wasted equals the copied supply.
  wasted: number;
}

// The Charge Column's one conservation split (issue #425, priority 6 — the
// brief's "one function, never two divergent copies", read by the advance
// walk and the UI's preview paths alike): the copied supply divides equally
// among the consumers that still have storage space; a consumer capped at
// its remaining space takes exactly that and drops out, its overflow
// redistributing to whoever can still accept. Full storage wastes no share
// while another consumer can accept. `space` maps consumer id → remaining
// storage.
export function splitColumnSupply(supply: number, space: ReadonlyMap<string, number>): ColumnSplit {
  const accepted = new Map<string, number>();
  const room = new Map(space);
  let left = Math.max(0, supply);
  let active = [...room.entries()].filter(([, free]) => free > EPS).map(([id]) => id);
  while (left > EPS && active.length > 0) {
    const share = left / active.length;
    let filled: string[] = [];
    let distributed = 0;
    for (const id of active) {
      const free = room.get(id)!;
      const take = Math.min(share, free);
      accepted.set(id, (accepted.get(id) ?? 0) + take);
      room.set(id, free - take);
      distributed += take;
      if (free - take > EPS) filled.push(id);
    }
    left -= distributed;
    active = filled;
  }
  let taken = 0;
  for (const amount of accepted.values()) taken += amount;
  return { accepted, wasted: Math.max(0, supply - taken) };
}

// The lift read (issue #426's preview seam): what the Columns copy and the
// weapons receive per second — the routing outcome of the one conservation
// split. Storage never enters the read: the walk clamps each span against
// live headroom (below), while the faces and the placement preview need
// the routing itself — who a Column feeds, and at what share. `override`
// re-positions one occupant hypothetically (the placement preview's moved
// piece); the real state is never touched. A full store still reads fed on
// the routing read — the store figure carries fullness on the face.
export interface WorldLift {
  // Copied supply per placed Column, per second.
  byColumn: Map<string, number>;
  // Routing share per deployed weapon, per second.
  byWeapon: Map<string, number>;
  bySpell: Map<string, number>;
}

type WorldMove = { id: string; pos: Hex | null };
type ChargeStore = { copy: WorldColumn & { store: number }; cap: number; kind: "weapon" | "spell" };

function worldChargeStores(state: GameState): ChargeStore[] {
  const stores: ChargeStore[] = state.world.weapons.map((copy) => ({ copy, cap: BALANCE.world.storageCap, kind: "weapon" }));
  if (state.world.proof) stores.push({ copy: state.world.proof.spell, cap: COMBAT_PROOF.spell.threshold, kind: "spell" });
  return stores;
}

function worldLiftRoutes(state: GameState, snapshot: Pick<RateSnapshot, "chargeStrength">, override?: WorldMove) {
  const positionOf = (copy: WorldColumn): Hex | null => override?.id === copy.id ? override.pos : copy.pos;
  const stores = worldChargeStores(state);
  const conduit = state.world.proof?.conduit;
  const conduitPos = conduit ? positionOf(conduit) : null;
  const outlet = conduitPos && conduit ? neighbors(conduitPos)[conduit.direction] : undefined;
  return state.world.columns.flatMap((column) => {
    const pos = positionOf(column);
    if (!pos) return [];
    const module = state.modules.find((m) => m.pos !== null && sameHex(m.pos, pos));
    const supply = module ? snapshot.chargeStrength.get(module.id) ?? 0 : 0;
    if (supply <= 0) return [];
    const forwards = conduitPos && outlet && adjacent(conduitPos, pos);
    // Only terminal stores accept supply. An empty edge, a back edge to
    // the Column, or a second path to the same store cannot mint charge.
    const consumers = stores.filter(({ copy }) => {
      const target = positionOf(copy);
      return target && (adjacent(pos, target) || (forwards && sameHex(outlet!, target)));
    });
    return [{ column, supply, consumers }];
  });
}

export function columnLiftsOf(
  state: GameState,
  snapshot: Pick<RateSnapshot, "chargeStrength">,
  override?: WorldMove,
  bounded = false,
): WorldLift {
  const lift: WorldLift = { byColumn: new Map(), byWeapon: new Map(), bySpell: new Map() };
  for (const { column, supply, consumers } of worldLiftRoutes(state, snapshot, override)) {
    lift.byColumn.set(column.id, supply);
    const room = new Map(consumers.map(({ copy, cap }) => [copy.id, bounded && cap - copy.store <= EPS ? 0 : Infinity]));
    const split = splitColumnSupply(supply, room);
    for (const { copy, kind } of consumers) {
      const amount = split.accepted.get(copy.id);
      if (amount === undefined) continue;
      const rates = kind === "weapon" ? lift.byWeapon : lift.bySpell;
      rates.set(copy.id, (rates.get(copy.id) ?? 0) + amount);
    }
  }
  return lift;
}

// One span's World charge lift (issue #425, priority 6): each placed
// Column copies the charge its module cell received over the span —
// without draining the module beneath, whose received strength the
// snapshot already carries — and feeds adjacent World weapons through the
// one conservation split, clamped against each weapon's live headroom.
// Both trusted and provisional spans lift (the charge economy runs in
// both); only the combat legs above gate on trust.
export function advanceWorldCharge(state: GameState, snapshot: RateSnapshot, spanSeconds: number): void {
  for (const { supply, consumers } of worldLiftRoutes(state, snapshot)) {
    const copied = requireFinite(supply * spanSeconds, "a Charge Column's copied supply");
    const room = new Map(consumers.map(({ copy, cap }) => [copy.id, Math.max(0, cap - copy.store)]));
    const split = splitColumnSupply(copied, room);
    for (const { copy } of consumers) {
      const amount = split.accepted.get(copy.id);
      if (amount !== undefined) copy.store = requireFinite(copy.store + amount, "stored World charge");
    }
  }
}


// Shared definition for progression checkpoint detection and assertions.
export function hasActiveWorldEnemy(state: GameState): boolean {
  return Object.values(state.world.proof?.enemies ?? state.world.enemies).some((enemy) => enemy.discovered && enemy.hp > 0);
}
