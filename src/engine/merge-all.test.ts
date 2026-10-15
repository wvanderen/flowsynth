import { describe, expect, it } from "vitest";
import { BALANCE } from "./constants";
import { endSession, mergeAll, mergeAllPreview, startSession } from "./actions";
import { fresh, give } from "./fixtures";
import { hex } from "./hex";
import { advance } from "./advance";
import { createHabit, selectHabit } from "./habits";
import type { GameState } from "./types";

const NOW = 1_700_000_000_000;

// Unlock syncing reads a finished session's ledger; the feat test completes
// one, exactly like the achievement suite's own fixture.
function completeSession(s: GameState): void {
  if (!s.habits.some((h) => !h.archived)) createHabit(s, "Piano");
  selectHabit(s, s.habits.find((h) => !h.archived)!.id);
  startSession(s, null);
  advance(s, 10);
  endSession(s, NOW);
}

// The library's batch combine (issue #368): one activation merges every
// eligible exact-copy pair — same named type, same merge tier (ADR-0058) —
// until no legal pair remains or the unlocked cap ends the ladder. Chains
// resolve in the sweep; capped copies and unequal tiers stay separate; the
// retention policy is the one-combine action's own (ADR-0058 §7), because
// every pair merges through it. The opening synthesizer (an additive at
// tier 0) stands in every fixture's roster like any real library.

describe("mergeAll", () => {
  it("merges every eligible pair in a mixed inventory and leaves singletons intact", () => {
    const s = fresh();
    const opening = s.modules[0]!; // additive t0
    opening.level = 2;
    opening.invested = 26;
    const twin = give(s, "additive", null, 1); // invested 10 — the melt
    const h1 = give(s, "harmonizer", hex(0, 1));
    give(s, "harmonizer", null);
    const solo = give(s, "infusor", null);
    const result = mergeAll(s);
    expect(result.ok).toBe(true);
    expect(result.merge).toEqual({ combines: 2, refund: 10 });
    expect(opening.tier).toBe(1);
    expect(opening.level).toBe(2);
    expect(opening.invested).toBe(26);
    expect(s.modules.includes(twin)).toBe(false);
    expect(h1.tier).toBe(1);
    expect(solo.tier).toBe(0);
    expect(s.modules.filter((m) => m.type === "additive")).toHaveLength(1);
    expect(s.modules.filter((m) => m.type === "harmonizer")).toHaveLength(1);
    expect(s.modules.filter((m) => m.type === "infusor")).toHaveLength(1);
    expect(s.nous).toBe(22); // the 12 ν opening grant plus the 10 ν refund
    expect(s.combinations).toBe(2);
  });

  it("resolves multi-step chains: four copies collapse to one two tiers up", () => {
    const s = fresh();
    const copies = [0, 1, 2, 3].map(() => give(s, "infusor", null));
    const result = mergeAll(s);
    expect(result.ok).toBe(true);
    expect(result.merge).toEqual({ combines: 3, refund: 0 });
    expect(s.modules.filter((m) => m.type === "infusor")).toHaveLength(1);
    expect(copies.filter((m) => s.modules.includes(m))[0]!.tier).toBe(2);
    expect(s.combinations).toBe(3);
  });

  it("an odd copy out survives the chain at its own tier", () => {
    const s = fresh();
    const copies = [0, 1, 2, 3, 4].map(() => give(s, "infusor", null));
    const result = mergeAll(s);
    expect(result.ok).toBe(true);
    expect(result.merge).toEqual({ combines: 3, refund: 0 });
    const tiers = copies.filter((m) => s.modules.includes(m)).map((m) => m.tier).sort();
    expect(tiers).toEqual([0, 2]);
  });

  it("unequal tiers stay separate and the refusal touches nothing", () => {
    const s = fresh();
    const low = give(s, "harmonizer", hex(1, 0));
    const high = give(s, "harmonizer", null);
    high.tier = 1;
    const result = mergeAll(s);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("No eligible copies to combine.");
    expect(low.tier).toBe(0);
    expect(high.tier).toBe(1);
    expect(s.modules).toHaveLength(3);
  });

  it("respects the unlocked cap: capped pairs never melt while eligible pairs still merge", () => {
    const s = fresh();
    const capA = give(s, "additive", hex(1, 0));
    const capB = give(s, "additive", null);
    capA.tier = BALANCE.mergeCap;
    capB.tier = BALANCE.mergeCap;
    const h1 = give(s, "harmonizer", hex(0, 1));
    give(s, "harmonizer", null);
    const result = mergeAll(s);
    expect(result.ok).toBe(true);
    expect(result.merge).toEqual({ combines: 1, refund: 0 });
    expect(capA.tier).toBe(BALANCE.mergeCap);
    expect(capB.tier).toBe(BALANCE.mergeCap);
    expect(s.modules.filter((m) => m.id === capA.id || m.id === capB.id)).toHaveLength(2);
    expect(h1.tier).toBe(1);
    expect(s.modules.filter((m) => m.type === "harmonizer")).toHaveLength(1);
  });

  it("retains the higher level and refunds the melt's investment through the one-combine terms", () => {
    const s = fresh();
    const veteran = give(s, "harmonizer", hex(1, 0), 3); // invested 52
    const rookie = give(s, "harmonizer", null, 1); // invested 10 — the melt
    const result = mergeAll(s);
    expect(result.ok).toBe(true);
    expect(result.merge).toEqual({ combines: 1, refund: 10 });
    expect(veteran.level).toBe(3);
    expect(veteran.invested).toBe(52);
    expect(veteran.tier).toBe(1);
    expect(s.modules.includes(rookie)).toBe(false);
    expect(s.nous).toBe(22);
  });

  it("keeps each survivor's own secondary effects and forfeits the melts' (ADR-0058 §7)", () => {
    const s = fresh();
    // A tier-0 pair and a tier-1 pair: each survivor keeps its own shift
    // (never summed, never copied over), and the tier-1 result lands at
    // the cap where no further pair exists.
    const flat = give(s, "bend", hex(1, 0));
    const flatTwin = give(s, "bend", null);
    flat.shift = 0;
    flatTwin.shift = 1;
    const sharp = give(s, "bend", hex(2, 0));
    const sharpTwin = give(s, "bend", null);
    sharp.tier = 1;
    sharpTwin.tier = 1;
    sharp.shift = -1;
    sharpTwin.shift = 1;
    const scribe = give(s, "noteKeyed", hex(2, -2));
    const scribeTwin = give(s, "noteKeyed", null);
    scribe.reserve = 100;
    scribeTwin.reserve = 40;
    const result = mergeAll(s);
    expect(result.ok).toBe(true);
    expect(result.merge).toEqual({ combines: 3, refund: 0 });
    expect(s.modules.filter((m) => m.type === "bend")).toHaveLength(2);
    expect(flat.shift).toBe(0);
    expect(flat.tier).toBe(1);
    expect(sharp.shift).toBe(-1);
    expect(sharp.tier).toBe(BALANCE.mergeCap);
    expect(s.modules.find((m) => m.type === "noteKeyed")).toBe(scribe);
    expect(scribe.reserve).toBeCloseTo(100, 6);
  });

  it("lands each result where its drop target was, board or tray", () => {
    const s = fresh();
    const deployed = give(s, "harmonizer", hex(1, 0), 2);
    const tray = give(s, "harmonizer", null, 1);
    mergeAll(s);
    // The tray target's place wins: the result waits in the tray.
    expect(deployed.tier).toBe(1);
    expect(deployed.pos).toBeNull();
    expect(s.modules.includes(tray)).toBe(false);
    // A second sweep merges the survivor with a board twin at the next tier.
    const boardTwin = give(s, "harmonizer", hex(3, 0));
    boardTwin.tier = 1;
    deployed.pos = hex(1, 0);
    mergeAll(s);
    expect(deployed.tier).toBe(2);
    expect(deployed.pos).toEqual(hex(3, 0));
  });

  it("is harmless when repeated: no eligible pairs refuses and touches nothing", () => {
    const s = fresh();
    give(s, "harmonizer", hex(1, 0), 2);
    give(s, "harmonizer", null, 1);
    expect(mergeAll(s).ok).toBe(true);
    const before = {
      nous: s.nous,
      combinations: s.combinations,
      roster: s.modules.map((m) => `${m.id}:${m.type}:${m.tier}:${m.level}`),
    };
    const again = mergeAll(s);
    expect(again.ok).toBe(false);
    expect(again.reason).toBe("No eligible copies to combine.");
    expect(s.nous).toBe(before.nous);
    expect(s.combinations).toBe(before.combinations);
    expect(s.modules.map((m) => `${m.id}:${m.type}:${m.tier}:${m.level}`)).toEqual(before.roster);
  });

  it("stays behind the upgrade-mode gate", () => {
    const s = fresh();
    give(s, "harmonizer", hex(1, 0));
    give(s, "harmonizer", null);
    startSession(s, 600);
    expect(mergeAll(s).ok).toBe(false);
    endSession(s);
    expect(mergeAll(s).ok).toBe(true);
  });

  it("reports the feat the sweep's combine crosses", () => {
    const s = fresh();
    completeSession(s);
    give(s, "harmonizer", hex(1, 0));
    give(s, "harmonizer", null);
    const result = mergeAll(s);
    expect(result.ok).toBe(true);
    expect(result.unlocked).toContain("two-of-a-kind");
  });
});

describe("mergeAllPreview", () => {
  it("previews the same counts the activation lands, without touching state", () => {
    const s = fresh();
    const veteran = give(s, "harmonizer", hex(1, 0), 2); // invested 26
    const rookie = give(s, "harmonizer", null, 1); // invested 10 — the melt
    give(s, "infusor", null);
    const before = s.modules.map((m) => `${m.id}:${m.tier}:${m.level}:${m.pos}`);
    const preview = mergeAllPreview(s);
    expect(preview).toEqual({ combines: 1, refund: 10 });
    expect(s.modules.map((m) => `${m.id}:${m.tier}:${m.level}:${m.pos}`)).toEqual(before);
    expect(s.combinations).toBe(0);
    expect(veteran.tier).toBe(0);
    expect(rookie.tier).toBe(0);
    // The promise is the charge: the real sweep lands exactly the preview.
    const result = mergeAll(s);
    expect(result.merge).toEqual(preview);
  });

  it("reads zero in flow mode", () => {
    const s = fresh();
    give(s, "harmonizer", hex(1, 0));
    give(s, "harmonizer", null);
    startSession(s, 600);
    expect(mergeAllPreview(s)).toEqual({ combines: 0, refund: 0 });
  });
});
