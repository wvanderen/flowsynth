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
import { adjacent, sameHex } from "./hex";
import type { GameState, Hex, RateSnapshot, WeaponCopy, WeaponType, WorldEnemyState } from "./types";

const ENEMY_BY_KEY = new Map(WORLD_ENEMIES.map((def) => [def.key, def]));

export function enemyDefOf(key: string) {
  return ENEMY_BY_KEY.get(key);
}

// The authored enemy whose World position is this coordinate, if any.
export function enemyDefAt(pos: Hex) {
  return WORLD_ENEMIES.find((def) => sameHex(def.pos, pos));
}

// The World occupant standing on this coordinate — a placed Column or a
// deployed weapon — if any. One World occupant per cell, beside whatever
// module occupies the cell beneath (issue #425, priority 10: the shared
// coordinates' second face, the Mutator Grid's engine precedent).
export function worldOccupantAt(state: GameState, pos: Hex): { kind: "column" | "weapon"; id: string } | undefined {
  if (state.world.columns.some((column) => column.pos !== null && sameHex(column.pos, pos))) {
    return { kind: "column", id: state.world.columns.find((column) => column.pos !== null && sameHex(column.pos, pos))!.id };
  }
  const weapon = state.world.weapons.find((weapon) => weapon.pos !== null && sameHex(weapon.pos, pos));
  return weapon ? { kind: "weapon", id: weapon.id } : undefined;
}

// The enemy's live state — always present for an authored key after
// normalization; a missing key reads as the authored fresh state rather
// than poisoning a read.
export function enemyStateOf(state: GameState, key: string): WorldEnemyState {
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
// nine-living-enemies floor is penalty⁹, never an additive sum. Undiscovered
// enemies weigh nothing. Nous production only: charge generation, routing,
// and combat never read this.
export function worldFactorOf(state: GameState): number {
  let factor = 1;
  for (const def of WORLD_ENEMIES) {
    const live = state.world.enemies[def.key];
    if (!live?.discovered) continue;
    factor *= enemyDefeated(state, def.key) ? 1 + def.bonus : 1 - def.penalty;
  }
  return factor;
}

// The discovery sync (issue #425): every authored enemy whose reveal
// threshold the era-earned measure has crossed discovers NOW — all
// thresholds crossed in one move discover together, sequentially-ordered
// discovery is rejected by design. Idempotent; returns how many flipped.
// The advance walk splits at the first crossing so a span never produces
// past a threshold at the pre-discovery rate; the bucket's one-move bank
// after an honesty settlement meets this sync directly.
export function syncWorldDiscoveries(state: GameState): number {
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

// The World's own span boundary (issue #425, priority 5): the earlier of
// the discovery crossing and the next attack tick — the one read both walk
// loops share, so the trusted-time legs can never drift apart.
export function worldBoundarySeconds(state: GameState, rate: number): number {
  return Math.min(discoverySecondsOf(state, rate), combatBoundaryOf(state));
}

// The weapon type's current attack power (issue #425): the authored base
// plus the type's owned Hone ranks — type-level, so every current and
// future copy of the type deals the same figure.
export function attackPowerOf(state: GameState, type: WeaponType): number {
  return BALANCE.world.attackBase + state.world.hone[type] * BALANCE.world.honeAttackPerRank;
}

// The Charge Column's escalating Arete ladder (issue #425): the copy `owned`
// columns already stand behind costs firstPrice × growth^owned. The entry
// price is the floor the frontier curve's construction asserts the first
// World-eligible claim clears.
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
  const cadence = BALANCE.world.attackCadenceSeconds;
  for (const weapon of state.world.weapons) {
    if (weapon.pos === null) continue;
    weapon.cooldown += spanSeconds;
    let fires = Math.floor(weapon.cooldown / cadence);
    if (fires <= 0) continue;
    weapon.cooldown -= fires * cadence;
    while (fires-- > 0) {
      const target = eligibleTargetsOf(state, weapon)[0];
      if (target === undefined) break;
      if (weapon.store < BALANCE.world.attackCost) break;
      weapon.store -= BALANCE.world.attackCost;
      const live = state.world.enemies[target]!;
      live.hp = Math.max(0, live.hp - attackPowerOf(state, weapon.type));
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
}

export function columnLiftsOf(
  state: GameState,
  snapshot: Pick<RateSnapshot, "chargeStrength">,
  override?: { id: string; pos: Hex | null },
): WorldLift {
  const lift: WorldLift = { byColumn: new Map(), byWeapon: new Map() };
  const positionOf = (id: string, pos: Hex | null): Hex | null =>
    override && override.id === id ? override.pos : pos;
  for (const column of state.world.columns) {
    const pos = positionOf(column.id, column.pos);
    if (pos === null) continue;
    const module = state.modules.find((m) => m.pos !== null && sameHex(m.pos, pos));
    if (!module) continue;
    const copied = snapshot.chargeStrength.get(module.id) ?? 0;
    if (copied <= EPS) continue;
    lift.byColumn.set(column.id, (lift.byColumn.get(column.id) ?? 0) + copied);
    const consumers = state.world.weapons
      .map((weapon) => ({ id: weapon.id, pos: positionOf(weapon.id, weapon.pos) }))
      .filter((entry): entry is { id: string; pos: Hex } => entry.pos !== null && adjacent(entry.pos, pos));
    if (consumers.length === 0) continue;
    // Unlimited storage: the split's routing shape alone.
    const split = splitColumnSupply(
      copied,
      new Map(consumers.map(({ id }) => [id, Infinity])),
    );
    for (const [id, amount] of split.accepted) {
      lift.byWeapon.set(id, (lift.byWeapon.get(id) ?? 0) + amount);
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
  for (const column of state.world.columns) {
    const pos = column.pos;
    if (pos === null) continue;
    const module = state.modules.find((m) => m.pos !== null && sameHex(m.pos, pos));
    if (!module) continue;
    const copied = (snapshot.chargeStrength.get(module.id) ?? 0) * spanSeconds;
    if (copied <= EPS) continue;
    const consumers: { weapon: WeaponCopy; space: number }[] = [];
    for (const weapon of state.world.weapons) {
      const weaponPos = weapon.pos;
      if (weaponPos === null || !adjacent(weaponPos, pos)) continue;
      consumers.push({ weapon, space: Math.max(0, BALANCE.world.storageCap - weapon.store) });
    }
    if (consumers.length === 0) continue;
    const split = splitColumnSupply(
      copied,
      new Map(consumers.map(({ weapon, space }) => [weapon.id, space])),
    );
    for (const [id, amount] of split.accepted) {
      const weapon = state.world.weapons.find((w) => w.id === id);
      if (weapon) weapon.store += amount;
    }
  }
}
