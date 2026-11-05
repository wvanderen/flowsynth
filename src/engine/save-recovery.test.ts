import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, startSession, upgradeModule } from "./actions";
import { fresh, give, giveHabit } from "./fixtures";
import { BALANCE, SAVE_VERSION } from "./constants";
import { deserialize, recoverLostSave, serialize } from "./save";
import { freshEnemyStates, openingGrant } from "./state";
import { resolveHonestyReport } from "./trust";
import { bankableClaimOf } from "./accumulator";
import { stateNumbersFinite } from "./playthrough";
import { hex } from "./hex";
import type { GameState } from "./types";

// The lost-money recovery (issue #494, parent #484's story 38): saves
// whose monetary figures serialized to null are a distinct class at the
// same boundary. Ordinary loading refuses them with the paths named and
// repairs nothing; the explicit recovery — the player's choice at the
// save/import destination — replaces each unreadable figure with the
// field's calibrated starting value, applies the same retention/reset
// transition the finite conversion uses, and keeps the original bytes
// as the backup. No historical balance is ever invented: the report
// names what was unavailable, and the lost figures land at their
// starting values, never at a reconstruction.

// A finite overpowered save in the parent's shape — the runaway build
// whose next writes would corrupt — with practice history and earned
// development beside it.
function overpowered(): GameState {
  const s = fresh();
  const runaway = give(s, "additive", hex(1, 0));
  runaway.level = 1504;
  runaway.invested = 1.6e308;
  runaway.reserve = 40;
  const tiered = give(s, "blaster", hex(0, 1));
  tiered.tier = 3;
  tiered.level = 900;
  s.nous = 8.2e9;
  s.totalEarned = 4.5e11;
  s.eraEarned = 4e14;
  s.capacityBought = 3;
  s.prestiges = 1;
  s.arete = 4;
  s.catalogEntryOwned = true;
  s.rollPoolJoined = true;
  s.world.frontier = 1;
  s.world.starterWeaponGranted = true;
  s.world.columns.push({ id: "col1", pos: null });
  s.world.weapons.push({ id: "w1", type: "chargeBlade", pos: null, store: 25, cooldown: 2, targetPriority: [] });
  const enemies = freshEnemyStates();
  const first = Object.keys(enemies)[0]!;
  enemies[first] = { discovered: true, hp: 0 };
  s.world.enemies = enemies;
  const { habit } = giveHabit(s);
  habit.seconds = 7_200;
  s.practiceLog.push({ id: "log-1", habitId: habit.id, seconds: 1_200, source: "live", at: 500 });
  s.notes.push({ id: "note-1", text: "kept", sessionId: 0, atElapsed: 60, habitId: habit.id, at: 600 });
  s.bankedRolls.push({ id: "roll-1", candidates: [{ id: "c1", type: "additive", tier: 1 }, { id: "c2", type: "additive", tier: 1 }, { id: "c3", type: "additive", tier: 1 }] });
  return s;
}

// The corruption as the pre-integrity build wrote it: nonfinite numbers
// serialize to JSON null. Every monetary figure the parent's report
// named is gone; the levels and the record survived. The runaway is the
// first given module (the opening starter rides index 0).
function lostMoneyV12(state: GameState = overpowered()): string {
  const runawayIndex = state.modules.findIndex((m) => m.level > 1000);
  const file = JSON.parse(serialize(state, 1_000));
  file.version = 12;
  file.state.nous = null;
  file.state.totalEarned = null;
  file.state.eraEarned = null;
  file.state.arete = null;
  file.state.modules[runawayIndex].invested = null;
  file.state.modules[runawayIndex].reserve = null;
  file.state.world.frontier = null;
  file.state.world.weapons[0].store = null;
  file.state.forge.progress = null;
  file.state.session = null;
  return JSON.stringify(file);
}

describe("the lost-money recovery (issue #494)", () => {
  it("a lost-money save recovers once onto the calibrated economy: the reset lands, the record stands", () => {
    const before = overpowered();
    const loaded = recoverLostSave(lostMoneyV12(before));
    expect(loaded.error).toBeUndefined();
    const state = loaded.state!;
    expect(loaded.recovered).toMatchObject({ fromVersion: 12 });
    expect(loaded.migration).toBeUndefined();
    // The lost monetary figures landed at their starting values — the
    // opening grant for the wallet, zero for the unreadable ledgers.
    expect(state.nous).toBe(openingGrant());
    expect(state.eraEarned).toBe(0);
    expect(state.totalEarned).toBe(0);
    expect(state.arete).toBe(0);
    // The era reset cleared the runaway levels and the live charge — the
    // same reset the finite conversion applies.
    expect(state.modules.every((m) => m.level === 0 && m.invested === 0 && m.reserve === 0)).toBe(true);
    expect(state.capacityBought).toBe(0);
    expect(state.world.frontier).toBe(0);
    expect(state.world.weapons[0]!.store).toBe(0);
    expect(state.world.enemies).toEqual(freshEnemyStates());
    expect(state.forge.progress).toBe(0);
    // The retention half stands untouched: the collection with its tier,
    // the board, the life record, class development, earned rolls, and
    // the memorized purchases. The collection reference is an ordinary
    // load of the same save — the catalog entry's Mutator Forge backfill
    // rides every load, recovery included.
    const reference = deserialize(serialize(before, 1_000)).state!;
    expect(state.modules.map((m) => [m.type, m.tier, m.pos])).toEqual(reference.modules.map((m) => [m.type, m.tier, m.pos]));
    expect(state.habits[0]!.seconds).toBe(7_200);
    expect(state.practiceLog).toHaveLength(1);
    expect(state.notes).toHaveLength(1);
    expect(state.bankedRolls).toHaveLength(1);
    expect(state.catalogEntryOwned).toBe(true);
    expect(state.rollPoolJoined).toBe(true);
    expect(state.prestiges).toBe(1);
    expect(state.world.starterWeaponGranted).toBe(true);
    expect(state.world.columns).toHaveLength(1);
    expect(stateNumbersFinite(state as unknown as Record<string, unknown>)).toBe(true);
  });

  it("the recovery names exactly the figures it could not read — no reconstruction is claimed", () => {
    const lost = recoverLostSave(lostMoneyV12()).recovered!.lost;
    for (const path of [
      "nous",
      "totalEarned",
      "eraEarned",
      "arete",
      "modules[1].invested",
      "modules[1].reserve",
      "world.frontier",
      "world.weapons[0].store",
      "forge.progress",
    ]) {
      expect(lost).toContain(path);
    }
    expect(lost).toHaveLength(9);
  });

  it("partial loss keeps the readable money: banked Arete stands beside the reset, the frontier clears", () => {
    const file = JSON.parse(lostMoneyV12());
    file.state.arete = 6;
    file.state.totalEarned = 4.5e11;
    const loaded = recoverLostSave(JSON.stringify(file));
    const state = loaded.state!;
    // Readable figures ride the same transition as the finite conversion:
    // earned currency and lifetime truth stand, the claim ledger clears.
    expect(state.arete).toBe(6);
    expect(state.totalEarned).toBe(4.5e11);
    expect(state.world.frontier).toBe(0);
    // The unreadable figures still land at their starting values.
    expect(state.nous).toBe(openingGrant());
    expect(loaded.recovered!.lost).toEqual([
      "nous",
      "eraEarned",
      "modules[1].invested",
      "modules[1].reserve",
      "world.frontier",
      "world.weapons[0].store",
      "forge.progress",
    ]);
  });

  it("a v13 source recovers through the same door: the era reset applies where no boundary conversion rides", () => {
    // The recovery door reads any supported version's bytes. A v13 file's
    // ordinary load keeps the established lenient schema resilience, but
    // the door itself repairs the lost figures and — since no boundary
    // conversion runs for v13 — applies the calibrated era reset itself,
    // so the excessive levels clear exactly as a converted save's do.
    const file = JSON.parse(serialize(overpowered(), 1_000));
    file.state.nous = null;
    file.state.modules[0].invested = null;
    const loaded = recoverLostSave(JSON.stringify(file));
    expect(loaded.error).toBeUndefined();
    expect(loaded.recovered).toMatchObject({ fromVersion: SAVE_VERSION, lost: ["nous", "modules[0].invested"] });
    const state = loaded.state!;
    expect(state.modules[0]!.level).toBe(0);
    expect(state.modules[0]!.invested).toBe(0);
    expect(state.nous).toBe(openingGrant());
    expect(state.eraEarned).toBe(0);
    expect(state.world.enemies).toEqual(freshEnemyStates());
    expect(state.arete).toBe(4);
  });

  it("a v10 lost save chains through its own conversions: the refund stands, the reset lands, nothing runs twice", () => {
    const file = JSON.parse(serialize(overpowered(), 1_000));
    file.version = 10;
    file.state.nous = null;
    file.state.arete = null;
    const loaded = recoverLostSave(JSON.stringify(file));
    expect(loaded.error).toBeUndefined();
    expect(loaded.recovered).toMatchObject({ fromVersion: 10 });
    const recovered = loaded.state!;
    // The repaired arete (zero) collected the v10 step's exact refund for
    // the memorized Mutator purchases the save carried — real
    // entitlement, never fabricated.
    const expectedRefund = BALANCE.catalogEntryCost + BALANCE.rollPoolJoinCost;
    expect(recovered.arete).toBe(expectedRefund);
    expect(recovered.nous).toBe(openingGrant());
    expect(recovered.habits[0]!.classes.engineer).toBeDefined();
    // The whole chain ran once: the recovered bytes reload as v13 with
    // no report and an identical state.
    const text = serialize(recovered, 1_000);
    const reloaded = deserialize(text);
    expect(reloaded.error).toBeUndefined();
    expect(reloaded.migration).toBeUndefined();
    expect(reloaded.recovered).toBeUndefined();
    expect(reloaded.recoveryRequired).toBeUndefined();
    expect(serialize(reloaded.state!, 1_000)).toBe(text);
  });

  it("the recovered bytes serialize finite and reload clean: no re-recovery, no duplicated entitlement", () => {
    const loaded = recoverLostSave(lostMoneyV12());
    const text = serialize(loaded.state!, 1_000);
    const reloaded = deserialize(text);
    expect(reloaded.error).toBeUndefined();
    expect(reloaded.state).toBeDefined();
    expect(reloaded.migration).toBeUndefined();
    expect(reloaded.recovered).toBeUndefined();
    expect(reloaded.recoveryRequired).toBeUndefined();
    // The cleared frontier duplicates nothing: the whole calibrated
    // ladder stands ahead, banked against newly earned depth alone.
    expect(bankableClaimOf(reloaded.state!)).toBe(0);
    expect(reloaded.state!.world.frontier).toBe(0);
    expect(stateNumbersFinite(reloaded.state! as unknown as Record<string, unknown>)).toBe(true);
  });

  it("the recovered position plays: purchases, flow production, and combat charge all work from the opening", () => {
    const state = recoverLostSave(lostMoneyV12()).state!;
    startSession(state, 600);
    const first = advance(state, 30);
    expect(first.nousEarned).toBeGreaterThan(0);
    expect(Number.isFinite(first.nousEarned)).toBe(true);
    endSession(state);
    // The opening grant affords real development on the retained
    // collection.
    upgradeModule(state, state.modules[0]!.id);
    expect(state.modules[0]!.level).toBe(1);
    // The World layer's charge route fills from production into the
    // granted weapon whose stored charge was unreadable.
    advance(state, 120);
    expect(Number.isFinite(state.world.weapons[0]!.store)).toBe(true);
    expect(Number.isFinite(state.eraEarned)).toBe(true);
    expect(stateNumbersFinite(state as unknown as Record<string, unknown>)).toBe(true);
  });

  it.each(["nous", "eraEarned", "totalEarned", "arete", "scrap", "capacityBought"])(
    "a lost %s in an otherwise fresh v13 save recovers to its starting value",
    (field) => {
      const file = JSON.parse(serialize(fresh(), 1_000));
      file.state[field] = null;
      const loaded = recoverLostSave(JSON.stringify(file));
      expect(loaded.error).toBeUndefined();
      expect(loaded.recovered!.lost).toEqual([field]);
      const state = loaded.state!;
      expect(state[field as keyof GameState]).toBe(field === "nous" ? openingGrant() : 0);
      expect(stateNumbersFinite(state as unknown as Record<string, unknown>)).toBe(true);
    },
  );

  it("a lost provisional bucket in a mid-flow save recovers without rewriting practice credit", () => {
    const s = overpowered();
    startSession(s, null);
    const produced = advance(s, 600, () => 0.4, "provisional");
    expect(produced.fault).toBeUndefined();
    const accounting = s.session!.accounting;
    expect(accounting.poolSeconds).toBeGreaterThan(0);
    expect(accounting.bucketNous).toBeGreaterThan(0);
    const file = JSON.parse(serialize(s, 1_000));
    file.version = 12;
    file.state.session.accounting.bucketNous = null;
    file.state.modules[1].invested = null;
    const loaded = recoverLostSave(JSON.stringify(file));
    const state = loaded.state!;
    expect(state.mode).toBe("flow");
    expect(state.session).not.toBeNull();
    // The unreadable bucket landed at zero; the credited minutes and the
    // pool stand, and settling the report banks practice credit — never
    // the retired economy's money.
    expect(state.session!.accounting.bucketNous).toBe(0);
    expect(state.session!.accounting.creditedSeconds).toBe(accounting.creditedSeconds);
    expect(state.session!.accounting.poolSeconds).toBe(accounting.poolSeconds);
    expect(resolveHonestyReport(state, "full").ok).toBe(true);
    expect(state.habits[0]!.seconds).toBeGreaterThan(0);
    expect(state.eraEarned).toBe(0);
    expect(bankableClaimOf(state)).toBe(0);
    // Reload: the recovery is over, the session continues, nothing repeats.
    const reloaded = deserialize(serialize(state));
    expect(reloaded.recovered).toBeUndefined();
    expect(reloaded.migration).toBeUndefined();
    expect(reloaded.state!.session!.accounting.creditedSeconds).toBe(state.session!.accounting.creditedSeconds);
  });

  it.each([10, 11, 12])("v%s missing session accounting refuses ordinary loading and fails recovery without inventing practice", (version) => {
    const file = JSON.parse(serialize(overpowered(), 1000));
    file.version = version;
    file.state.mode = "flow";
    file.state.session = {};
    const source = JSON.stringify(file);
    const ordinary = deserialize(source);
    expect(ordinary.recoveryRequired).toBe(true);
    expect(ordinary.lost).toContain("session.accounting.bucketNous");
    expect(ordinary.state).toBeUndefined();
    const recovered = recoverLostSave(source);
    expect(recovered.error).toContain("practice accounting");
    expect(recovered.state).toBeUndefined();
    expect(recovered.recovered).toBeUndefined();
  });

  it("bytes too incomplete to read fail with the ordinary error before any recovery step", () => {
    const file = JSON.parse(lostMoneyV12());
    file.state.modules = "gone";
    const loaded = recoverLostSave(JSON.stringify(file));
    expect(loaded.state).toBeUndefined();
    expect(loaded.error).toBe("The save data is incomplete.");
    expect(loaded.recovered).toBeUndefined();
  });

  it("bytes that are not a save at all fail with the ordinary error, adopting nothing", () => {
    const loaded = recoverLostSave("not a save at all");
    expect(loaded.state).toBeUndefined();
    expect(loaded.error).toBe("The save data is not valid JSON.");
    expect(loaded.recovered).toBeUndefined();
  });
});
