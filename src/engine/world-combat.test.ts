import { expect, it } from "vitest";
import { endSession, pauseSession, placeWorldOccupant, prestige, resumeSession, retrieveWorldOccupant, setWorldConduitDirection, startBreather, startSession } from "./actions";
import { advance, advanceBreather } from "./advance";
import { hex } from "./hex";
import { scenarioOf } from "./scenarios";
import { columnLiftsOf, enemyStateOf, worldFactorOf } from "./world";
import { applyGap, flushPendingAway, resolveHonestyReport } from "./trust";
import { syncRates } from "./economy";
import { walkWorldCombatProof } from "./world-combat-walks";

const rng = () => 0.3;

it("lets an unfed creature and its adjacent wall trade timed hits", () => {
  const fixture = scenarioOf("world-combat")!;
  expect(fixture).toBeTruthy();
  const state = fixture.build(0);
  fixture.assert(state, 0);
  const proof = state.world.proof!;
  expect(placeWorldOccupant(state, proof.creature.id, hex(0, 0)).ok).toBe(true);
  expect(startSession(state, null).ok).toBe(true);
  expect(advance(state, 3, rng).fault).toBeUndefined();
  expect(proof.creature.hp).toBe(24);
  expect(enemyStateOf(state, "shale").hp).toBe(48);
  advance(state, 3, rng);
  expect(proof.creature.hp).toBe(18);
  expect(enemyStateOf(state, "shale").hp).toBe(45);
});

it("adjacent armor enables a wounded bench return; defeat locks the tray until full HP", () => {
  const state = scenarioOf("world-combat")!.build(0);
  const { creature, armor } = state.world.proof!;
  const front = hex(0, 0);
  expect(placeWorldOccupant(state, creature.id, front).ok).toBe(true);
  expect(placeWorldOccupant(state, armor.id, hex(0, 1)).ok).toBe(true);
  startSession(state, null);
  advance(state, 16, rng);
  endSession(state);
  expect(creature.hp).toBe(12);
  expect(retrieveWorldOccupant(state, creature.id).ok).toBe(true);
  expect(placeWorldOccupant(state, creature.id, front).ok).toBe(true);
  expect(creature.hp).toBe(12);
  expect(placeWorldOccupant(state, armor.id, hex(1, 1)).ok).toBe(true);
  startSession(state, null);
  advance(state, 8, rng);
  endSession(state);
  expect(creature).toMatchObject({ pos: null, hp: 0, recovering: true });
  expect(armor.pos).toEqual(hex(1, 1));
  expect(placeWorldOccupant(state, creature.id, front).ok).toBe(false);
  startSession(state, null);
  advance(state, 11, rng);
  endSession(state);
  expect(creature.hp).toBe(22);
  expect(placeWorldOccupant(state, creature.id, front).ok).toBe(false);
  startSession(state, null);
  advance(state, 1, rng);
  endSession(state);
  expect(creature).toMatchObject({ pos: null, hp: 24, recovering: false });
  expect(placeWorldOccupant(state, creature.id, front).ok).toBe(true);
});

it("a directed route feeds unbound gear without firing or multiplying the Column's supply", () => {
  const state = scenarioOf("world-combat")!.build(0);
  const { conduit, spell } = state.world.proof!;
  const [blade] = state.world.weapons;
  const [column] = state.world.columns;
  for (const [id, position] of [
    [column!.id, hex(1, 1)], [conduit.id, hex(1, 0)], [blade!.id, hex(1, -1)], [spell.id, hex(0, 1)],
  ] as const) expect(placeWorldOccupant(state, id, position).ok).toBe(true);
  startSession(state, null);
  const lift = columnLiftsOf(state, syncRates(state));
  const supply = lift.byColumn.get(column!.id)!;
  expect(supply).toBeGreaterThan(0);
  advance(state, 8, rng);
  expect(blade!.store).toBeCloseTo(4 * supply, 6);
  expect(spell.store).toBeCloseTo(4 * supply, 6);
  expect(enemyStateOf(state, "shale").hp).toBe(48);
  expect(setWorldConduitDirection(state, conduit.id, 5).ok).toBe(false);
  endSession(state);
  // Edge 5 points straight back to the supplying Column.
  expect(setWorldConduitDirection(state, conduit.id, 5).ok).toBe(true);
  const banked = blade!.store;
  startSession(state, null);
  advance(state, 80, rng);
  expect(blade!.store).toBe(banked);
  expect(spell.store).toBe(6);
  expect(enemyStateOf(state, "shale").hp).toBe(48);
});

function preparedShale() {
  const state = scenarioOf("world-combat")!.build(0);
  const { creature, armor, conduit, spell } = state.world.proof!;
  for (const [id, pos] of [
    [creature.id, hex(0, 0)], [armor.id, hex(-1, 1)], [conduit.id, hex(1, 0)], [spell.id, hex(0, 1)],
    [state.world.columns[0]!.id, hex(1, 1)], [state.world.weapons[0]!.id, hex(1, -1)],
  ] as const) expect(placeWorldOccupant(state, id, pos).ok).toBe(true);
  return state;
}

it("spends Blade charge on its own cadence and casts Pulse at its banked threshold", () => {
  const state = preparedShale();
  startSession(state, null);
  advance(state, 4, rng);
  expect(enemyStateOf(state, "shale").hp).toBe(48);
  expect(state.world.proof!.creature.hp).toBe(21);
  advance(state, 1, rng);
  expect(enemyStateOf(state, "shale").hp).toBe(44);
  expect(state.world.weapons[0]!.store).toBeCloseTo(1.5);
  advance(state, 6.9, rng);
  const before = enemyStateOf(state, "shale").hp;
  expect(state.world.proof!.spell.store).toBeCloseTo(5.95);
  // At t=12 base hit and the banked Pulse land; the wall heals in combat.
  advance(state, 0.1, rng);
  expect(enemyStateOf(state, "shale").hp).toBeCloseTo(before + 0.035 - 3 - 11);
  expect(state.world.proof!.spell.store).toBeCloseTo(0);
});

it("hands pressure to the next wall at victory, then preserves victories and wounds at prestige", () => {
  const state = preparedShale();
  const shale = enemyStateOf(state, "shale");
  const basalt = enemyStateOf(state, "basalt");
  const creature = state.world.proof!.creature;
  const column = state.world.columns[0]!;
  expect(worldFactorOf(state)).toBe(0.8);
  expect(basalt.discovered).toBe(false);
  expect(placeWorldOccupant(state, column.id, hex(-1, 0)).ok).toBe(false);
  startSession(state, null);
  advance(state, 34, rng);
  endSession(state);
  expect(shale.hp).toBe(0);
  expect(creature.hp).toBeGreaterThan(0);
  expect(basalt.discovered).toBe(true);
  expect(worldFactorOf(state)).toBe(0.65);
  expect(placeWorldOccupant(state, column.id, hex(-1, 0)).ok).toBe(true);
  expect(retrieveWorldOccupant(state, creature.id).ok).toBe(true);
  startSession(state, null);
  advance(state, 12, rng);
  endSession(state);
  expect(placeWorldOccupant(state, creature.id, hex(2, -2)).ok).toBe(true);
  startSession(state, null);
  advance(state, 6, rng);
  endSession(state);
  const wounds = { sentinel: creature.hp, basalt: basalt.hp };
  expect(wounds.basalt).toBeLessThan(35);
  expect(prestige(state).ok).toBe(true);
  expect(creature.hp).toBe(wounds.sentinel);
  expect(basalt.hp).toBe(wounds.basalt);
  expect(shale.hp).toBe(0);
  expect(basalt.discovered).toBe(false);
  expect(worldFactorOf(state)).toBe(1);
  expect(placeWorldOccupant(state, column.id, hex(2, -1)).ok).toBe(false);
  startSession(state, null);
  advance(state, 1, rng);
  expect(basalt.hp).toBeCloseTo(wounds.basalt + 0.4);
  expect(basalt.discovered).toBe(false);
  advance(state, 200, rng);
  expect(shale.hp).toBe(0);
  expect(basalt.discovered).toBe(true);
  expect(worldFactorOf(state)).toBe(0.65);
});

it("uses only trusted World time through pause, honesty settlement, and a breather", () => {
  const state = scenarioOf("world-combat")!.build(0);
  const proof = state.world.proof!;
  expect(advance(state, 600, rng).nousEarned).toBe(0);
  expect(placeWorldOccupant(state, proof.creature.id, hex(0, 0)).ok).toBe(true);
  startSession(state, null);
  advance(state, 6, rng);
  const hp = () => ({ creature: proof.creature.hp, enemy: enemyStateOf(state, "shale").hp, world: proof.elapsed });
  expect(hp()).toEqual({ creature: 18, enemy: 45, world: 6 });
  pauseSession(state);
  applyGap(state, 100, "visible", 0, rng);
  expect(hp()).toEqual({ creature: 18, enemy: 45, world: 6 });
  resumeSession(state);
  for (const answer of ["missed", "full"] as const) {
    applyGap(state, 600, "away", 0, rng);
    flushPendingAway(state, rng);
    expect(state.session!.accounting.poolSeconds).toBe(600);
    expect(hp()).toEqual({ creature: 18, enemy: 45, world: 6 });
    expect(resolveHonestyReport(state, answer, rng).ok).toBe(true);
    expect(hp()).toEqual({ creature: 18, enemy: 45, world: 6 });
  }
  expect(state.session!.accounting.creditedSeconds).toBe(606);
  expect(endSession(state).ok).toBe(true);
  expect(retrieveWorldOccupant(state, proof.creature.id).ok).toBe(true);
  advance(state, 100, rng);
  expect(hp()).toEqual({ creature: 18, enemy: 45, world: 6 });
  expect(startBreather(state).ok).toBe(true);
  const records = structuredClone(state.sessionRecords);
  advanceBreather(state, 2, rng);
  expect(hp()).toEqual({ creature: 22, enemy: 45.7, world: 8 });
  expect(state.sessionRecords).toEqual(records);
});

it("keeps HP, charge, and threshold-split production when the advance is subdivided", () => {
  const once = preparedShale();
  const split = preparedShale();
  startSession(once, null);
  startSession(split, null);
  advance(once, 34, rng);
  for (let i = 0; i < 340; i++) advance(split, 0.1, rng);
  expect(enemyStateOf(once, "shale").hp).toBe(0);
  expect(enemyStateOf(split, "shale").hp).toBe(0);
  expect(split.eraEarned).toBeCloseTo(once.eraEarned, 5);
  expect(split.world.proof!.creature.hp).toEqual(once.world.proof!.creature.hp);
  expect(split.world.proof!.spell.store).toBeCloseTo(once.world.proof!.spell.store, 6);
  expect(split.world.weapons[0]!.store).toBeCloseTo(once.world.weapons[0]!.store, 6);
});

it("separates a win, attrition, lost ground, and a Hone-funded return from equal starts", () => {
  const walks = walkWorldCombatProof();
  const [effective, attrition, weak] = walks.shale;
  expect(effective.outcome).toBe("won");
  expect(effective.deployments).toBe(1);
  expect(attrition.outcome).toBe("won");
  expect(attrition.deployments).toBeGreaterThan(1);
  expect(effective.start).toEqual(attrition.start);
  expect(effective.start).toEqual(weak.start);
  expect(weak.outcome).toBe("lost ground");
  expect(weak.end.shaleHp).toBeGreaterThan(weak.start.shaleHp);
  const [unspent, honed] = walks.basalt;
  expect(unspent.start).toEqual(honed.start);
  expect(unspent.outcome).toBe("defeated");
  expect(honed.outcome).toBe("won");
  expect(honed.honeRank).toBe(2);
  expect(honed.start.shaleHp).toBe(0);
  expect(walks.beforePrestige.bladeDamage).toBe(walks.afterPrestige.bladeDamage);
});

it("does not activate the next wall until its own threshold, even if the predecessor is cleared", () => {
  // Same trusted command seam; this starts a fresh era just before the
  // next threshold, rather than walking through a live-economy claim.
  const state = scenarioOf("world-combat")!.build(0);
  state.world.proof!.enemies.shale!.hp = 0;
  state.eraEarned = 17;
  expect(placeWorldOccupant(state, state.world.proof!.creature.id, hex(2, -2)).ok).toBe(true);
  startSession(state, null);
  const large = structuredClone(state);
  expect(worldFactorOf(state)).toBe(1);
  const before = syncRates(state).rate;
  const until = (18 - state.eraEarned) / before;
  advance(state, until / 2, rng);
  expect(enemyStateOf(state, "basalt").discovered).toBe(false);
  advance(state, until / 2, rng);
  expect(enemyStateOf(state, "basalt").discovered).toBe(true);
  expect(worldFactorOf(state)).toBe(0.65);
  expect(state.world.proof!.creature.hp).toBe(24);
  advance(state, 4, rng);
  advance(large, until + 4, rng);
  expect(state.world.proof!.creature.hp).toBe(16);
  expect(large.world.proof!.creature.hp).toBe(16);
  expect(large.eraEarned).toBeCloseTo(state.eraEarned, 9);
});

it("clearing an unowned wall removes its World reservation without granting the cell", () => {
  const state = preparedShale();
  expect(placeWorldOccupant(state, state.world.proof!.creature.id, hex(-1, 0)).ok).toBe(false);
  // The spare target is made unowned before the encounter; winning should
  // not populate it. World availability remains separate from ownership.
  state.cells = state.cells.filter((p) => p.q !== -1 || p.r !== 0);
  startSession(state, null);
  advance(state, 34, rng);
  endSession(state);
  expect(enemyStateOf(state, "shale").hp).toBe(0);
  expect(placeWorldOccupant(state, state.world.proof!.creature.id, hex(-1, 0))).toMatchObject({ ok: false, reason: "Only an owned cell carries a World face." });
});
