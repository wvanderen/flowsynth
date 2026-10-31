import { describe, expect, it } from "vitest";
import { advance, advanceBreather } from "./advance";
import { pauseSession, prestige, startSession } from "./actions";
import { NumericFault } from "./numeric";
import { addForgeProgress, addMutatorForgeProgress } from "./rolls";
import { deserialize, serialize } from "./save";
import { resolveHonestyReport } from "./trust";
import { advanceWorldCharge } from "./world";
import { createWeapon } from "./state";
import { fresh, give } from "./fixtures";
import { hex } from "./hex";
import type { GameState } from "./types";

// Save integrity at the numeric limits (issue #486, parent #484 stories
// 30–35, 39): an economy update whose arithmetic leaves the representable
// range is refused whole — no invalid figure, no half-applied span, no
// silently retained earning or combat outcome on any sink — and the state
// it leaves behind still saves and loads. Every case drives the real
// engine seams (advance, the honesty report, the prestige action, the
// save file); the runaway the parent save carried is expressed through
// the authored power curve, never a patched helper.

// 1.2^level overflows the double range near level 3889 — 5000 is the
// runaway compounding the parent save carried (level 1506 plus chord and
// support multiplication), reached through the profile curve alone.
const OVERFLOW_LEVEL = 5000;

function flowState(): GameState {
  const s = fresh();
  startSession(s, null);
  return s;
}

function breatherState(): GameState {
  const s = fresh();
  s.mode = "breather";
  s.breather = { startedAt: 0, allowanceSeconds: 600, elapsed: 0 };
  return s;
}

// Everything a refused update must leave exactly as it stood: the
// balances, the session's clock and accounting, the practice and goal
// legs, both forge meters, the reserves, and the World's supply and
// combat surfaces.
function snapshotOf(s: GameState) {
  return JSON.stringify({
    nous: s.nous,
    totalEarned: s.totalEarned,
    eraEarned: s.eraEarned,
    arete: s.arete,
    frontier: s.world.frontier,
    prestiges: s.prestiges,
    session: s.session && {
      elapsed: s.session.elapsed,
      earned: s.session.earned,
      creditedSeconds: s.session.accounting.creditedSeconds,
      bucketNous: s.session.accounting.bucketNous,
      poolSeconds: s.session.accounting.poolSeconds,
      pendingAwaySeconds: s.session.accounting.pendingAwaySeconds,
    },
    habitSeconds: s.habits.map((h) => h.seconds),
    goalFuel: s.goalFuel,
    forge: s.forge,
    mutatorForge: s.mutatorForge,
    reserves: s.modules.map((m) => m.reserve),
    weapons: s.world.weapons.map((w) => ({ store: w.store, cooldown: w.cooldown })),
    enemies: s.world.enemies,
    breather: s.breather,
  });
}

describe("the advance walk refuses what it cannot represent (issue #486)", () => {
  it("a production rate past the representable range refuses the span and commits nothing", () => {
    const s = flowState();
    give(s, "additive", hex(0, 0), OVERFLOW_LEVEL);
    const before = snapshotOf(s);
    const result = advance(s, 60);
    expect(result.fault).toBeTruthy();
    expect(snapshotOf(s)).toBe(before);
  });

  it("a generator whose delivery strength left the range refuses the span, reserve untouched", () => {
    const s = flowState();
    const generator = give(s, "focusKeyed", hex(0, 0), OVERFLOW_LEVEL);
    generator.reserve = 1e308;
    const before = snapshotOf(s);
    const result = advance(s, 60);
    expect(result.fault).toBeTruthy();
    expect(snapshotOf(s)).toBe(before);
  });

  it("forge progress past the representable range refuses the span, meter untouched", () => {
    const s = flowState();
    const charged = give(s, "focusKeyed", hex(1, 0));
    charged.reserve = 600;
    give(s, "forge", hex(0, 0), OVERFLOW_LEVEL);
    const before = snapshotOf(s);
    const result = advance(s, 60);
    expect(result.fault).toBeTruthy();
    expect(snapshotOf(s)).toBe(before);
  });

  it("combat supply past the representable range refuses the span, store untouched", () => {
    const s = flowState();
    const generator = give(s, "focusKeyed", hex(2, 0), OVERFLOW_LEVEL);
    generator.reserve = 600;
    give(s, "additive", hex(0, 1), 4); // the module the Column stands over
    s.world.columns.push({ id: "col1", pos: hex(0, 1) });
    const weapon = createWeapon(s, "chargeBlade");
    weapon.pos = hex(0, 0); // adjacent to the Column
    s.world.weapons.push(weapon);
    const before = snapshotOf(s);
    const result = advance(s, 60);
    expect(result.fault).toBeTruthy();
    expect(snapshotOf(s)).toBe(before);
  });

  it("a big-but-finite board still banks: the refusal never bites the representable range", () => {
    const s = flowState();
    // The last representable level under the authored power curve, the
    // figure the parent save actually carried.
    give(s, "additive", hex(0, 0), 1505);
    const result = advance(s, 60);
    expect(result.fault).toBeUndefined();
    expect(s.nous).toBeGreaterThan(0);
    expect(Number.isFinite(s.nous)).toBe(true);
  });

  it("a paused session advances nothing even with the board out of range", () => {
    const s = flowState();
    give(s, "additive", hex(0, 0), OVERFLOW_LEVEL);
    expect(pauseSession(s).ok).toBe(true);
    const before = snapshotOf(s);
    const result = advance(s, 60);
    expect(result.fault).toBeUndefined();
    expect(result.nousEarned).toBe(0);
    expect(snapshotOf(s)).toBe(before);
  });
});

describe("every sink refuses whole (issue #486)", () => {
  it("a provisional span's refused moments leave neither bucket nor pool", () => {
    const s = flowState();
    give(s, "additive", hex(0, 0), OVERFLOW_LEVEL);
    const before = snapshotOf(s);
    const result = advance(s, 60, Math.random, "provisional");
    expect(result.fault).toBeTruthy();
    expect(snapshotOf(s)).toBe(before);
  });

  it("an honesty report banking an unrepresentable bucket is refused before it credits a minute", () => {
    const s = flowState();
    s.session!.accounting.poolSeconds = 3600;
    s.session!.accounting.bucketNous = Infinity;
    const before = snapshotOf(s);
    const resolution = resolveHonestyReport(s, "full");
    expect(resolution.ok).toBe(false);
    expect(resolution.reason).toBeTruthy();
    expect(snapshotOf(s)).toBe(before);
  });

  it("a breather's refused span leaves the phase and the balance untouched", () => {
    const s = breatherState();
    give(s, "additive", hex(0, 0), OVERFLOW_LEVEL);
    const before = snapshotOf(s);
    const result = advanceBreather(s, 60);
    expect(result.fault).toBeTruthy();
    expect(snapshotOf(s)).toBe(before);
  });
});

describe("the commit points refuse at their own seams (issue #486)", () => {
  it("a forge meter fed past the range banks nothing", () => {
    const s = fresh();
    s.forge.progress = 0.5;
    expect(() => addForgeProgress(s, Infinity)).toThrow(NumericFault);
    expect(s.forge.progress).toBe(0.5);
    expect(s.bankedRolls).toHaveLength(0);
    s.mutatorForge.progress = 0.5;
    expect(() => addMutatorForgeProgress(s, Infinity)).toThrow(NumericFault);
    expect(s.mutatorForge.progress).toBe(0.5);
    expect(s.bankedMutatorRolls).toHaveLength(0);
  });

  it("a weapon's store never accepts an unrepresentable delivery", () => {
    const s = fresh();
    const under = give(s, "additive", hex(0, 1));
    s.world.columns.push({ id: "col1", pos: hex(0, 1) });
    const weapon = createWeapon(s, "chargeBlade");
    weapon.pos = hex(0, 0);
    s.world.weapons.push(weapon);
    const snapshot = { chargeStrength: new Map([[under.id, Infinity]]) } as never;
    // The supply seam refuses through the numeric fault the advance walk
    // wraps (issue #486); the delivery it refused wrote nothing.
    expect(() => advanceWorldCharge(s, snapshot, 60)).toThrow(NumericFault);
    expect(weapon.store).toBe(0);
  });

  it("a claim the ledger cannot hold refuses the prestige whole", () => {
    const s = fresh();
    s.eraEarned = Infinity; // the horizon reads reached; the claim does not fit
    const before = snapshotOf(s);
    const result = prestige(s);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
    expect(snapshotOf(s)).toBe(before);
  });
});

describe("failure without destructive mutation, then a valid save (issue #486)", () => {
  it("prior valid progress survives the refused update and saves whole", () => {
    const s = flowState();
    const working = give(s, "additive", hex(0, 0), 4);
    const first = advance(s, 60);
    expect(first.fault).toBeUndefined();
    const validNous = s.nous;
    expect(validNous).toBeGreaterThan(0);
    // The runaway arrives mid-session: the next span refuses and restores
    // exactly the state the valid span left.
    working.level = OVERFLOW_LEVEL;
    const refused = advance(s, 60);
    expect(refused.fault).toBeTruthy();
    expect(s.nous).toBe(validNous);
    // The refused-for state is the last valid economy state: it saves,
    // loads, and carries nothing from the refused span.
    const file = JSON.parse(serialize(s, 1000));
    expect(file.version).toBeGreaterThan(0);
    const reloaded = deserialize(serialize(s, 1000));
    expect(reloaded.state?.nous).toBe(validNous);
    expect(reloaded.state?.session?.earned).toBe(s.session!.earned);
  });
});
