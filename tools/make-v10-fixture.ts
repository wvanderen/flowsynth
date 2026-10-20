// One-off generator for the v10 migration fixture (issue #427). Run with
// `npx vite-node tools/make-v10-fixture.ts` and delete or leave — the
// fixture file is the committed artifact, generated once and frozen.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInitialState } from "../src/engine/state";
import { hex } from "../src/engine/hex";
import { SAVE_VERSION } from "../src/engine/constants";

const state = createInitialState() as unknown as Record<string, unknown>;
const habit = (id: string, name: string, seconds: number): Record<string, unknown> => ({
  id,
  name,
  seconds,
  archived: false,
  build: [],
});
const goal = (
  id: string,
  habitId: string | null,
  minutes: number,
  schedule: "once" | "daily" | "weekly",
  createdAt: number,
  progressSeconds = 0,
  completed = false,
  completedCount = 0,
): Record<string, unknown> => ({
  id,
  condition: { kind: "habit-minutes", habitId, minutes },
  schedule: { kind: schedule },
  occurrenceKey: schedule === "daily" ? "2026-10-19" : schedule === "weekly" ? "2026-W42" : "once",
  color: "vermillion",
  progressSeconds,
  completed,
  completedCount,
  createdAt,
});

// Board: the opening synth plus the two Forge branches, one placed.
const modules = state.modules as Record<string, unknown>[];
const forge = { id: "m2", type: "forge", tier: 0, level: 2, invested: 6, pos: hex(1, 0), reserve: 0, shift: null, target: null };
const mutatorForge = { id: "m3", type: "mutatorForge", tier: 0, level: 0, invested: 0, pos: hex(0, 1), reserve: 0, shift: null, target: null };
const booster = { id: "m4", type: "infusor", tier: 0, level: 1, invested: 2, pos: hex(2, 0), reserve: 0, shift: null, target: null };
modules.push(forge, mutatorForge, booster);

// Known purchase history: the full Mutator tree (entry, three slots, pool
// join), the Horizon break, and two goal-capacity purchases. Partial flow
// progress pays out one roll; the per-habit seconds feed the conversion.
state.arete = 3;
state.nous = 150;
state.totalEarned = 4_000;
state.eraEarned = 4_000;
state.catalogEntryOwned = true;
state.rollPoolJoined = true;
state.mutatorSlots = [hex(0, 1), hex(1, 0), hex(2, 0)];
state.mutators = [
  { id: "mu1", family: "power", rarity: "uncommon", pos: hex(0, 1) },
  { id: "mu2", family: "charge", rarity: "rare", pos: null },
];
state.mutatorForge = { progress: 33, earned: 2 };
state.bankedMutatorRolls = [
  {
    id: "mo1",
    candidates: [
      { id: "mc1", family: "resonance", rarity: "common" },
      { id: "mc2", family: "power", rarity: "rare" },
    ],
  },
];
state.forge = { progress: 40, earned: 3 };
state.bankedRolls = [
  {
    id: "offer1",
    candidates: [
      { id: "c1", type: "additive", tier: 0 },
      { id: "c2", type: "spacer", tier: 2 },
      { id: "c3", type: "infusor", tier: 0 },
    ],
  },
];
state.horizonBroken = true;
state.goalCapacityBought = 2;
state.flow = { progress: 300, earned: 1 };
state.cells = [...(state.cells as unknown[]), hex(2, 0), hex(-1, 0)];
state.cellsBought = 2;
state.gatedRows = [0, 1, -1];
state.unlockedRows = [2];
state.capacityCeilings = 1;
state.capacityDiscounts = 1;
state.mergeCapPurchases = 1;
state.scrap = 25;
state.draftTierBonus = 1;
state.specialDrafts = { category: 0, rare: 1, tier: 0 };
state.achievements = {
  "first-light": 1_700_000_000_000,
  "breaking-the-horizon": 1_700_000_000_001,
  "mutator-entry": 1_700_000_000_002,
  "roll-pool-join": 1_700_000_000_003,
  "roll-credit": 1_700_000_000_004,
};
const piano = habit("h1", "Piano", 36_000);
const reading = habit("h2", "Reading", 8_000);
state.habits = [piano, reading];
state.activeHabitId = "h1";
state.practiceLog = [
  { id: "p1", habitId: "h1", seconds: 1_200, source: "live", at: 1_700_000_100_000 },
  { id: "p2", habitId: "h1", seconds: 600, source: "manual", at: 1_700_000_200_000 },
];
state.notes = [{ id: "n1", sessionId: 1, atElapsed: 90, text: "slower left hand", habitId: "h1", at: 1_700_000_150_000 }];
state.sessionRecords = [
  {
    sessionNumber: 1,
    startedAt: 1_700_000_000_000,
    endedAt: 1_700_000_600_000,
    habitId: "h1",
    mode: "planned",
    plannedTarget: 600,
    creditedSeconds: 600,
    earned: 42,
    honestyEvents: [],
    reflection: { text: "steady", slider: 4 },
    goalsAdvanced: [{ goalId: "g1", seconds: 300 }],
    achievements: ["first-light"],
    breather: null,
  },
];
// Four goals for Piano (capacity retires the oldest to history), two for
// Reading (within capacity, untouched), one cross-habit goal (retires to
// history in full, never re-read as single-habit).
state.goals = [
  goal("g1", "h1", 20, "daily", 1_690_000_000_000, 600, true, 3),
  goal("g2", "h1", 45, "once", 1_691_000_000_000, 900),
  goal("g3", "h1", 30, "weekly", 1_692_000_000_000, 300),
  goal("g4", null, 60, "once", 1_692_500_000_000, 1_200, false, 1),
  goal("g5", "h1", 15, "daily", 1_693_000_000_000),
  goal("g6", "h2", 30, "daily", 1_693_000_000_001, 120),
  goal("g7", "h2", 60, "once", 1_693_000_000_002),
];
state.chordDiscovery = {};
state.activeChords = [];
state.nextId = 10;
state.summary = null;
state.session = null;
state.sessionsCompleted = 1;
state.sessionIndex = 1;

// The v10 shape: none of the v11 additions carried, the retired player-wide
// fields on. (horizonBroken / flow / goalCapacityBought set above.)
delete state.world;
delete state.goalFuel;
for (const h of state.habits as Record<string, unknown>[]) {
  delete h.classId;
  delete h.classes;
}

const file = { app: "flowsynth", version: SAVE_VERSION - 1, savedAt: 1_700_000_900_000, state };
const out = resolve(import.meta.dirname!, "../src/engine/fixtures/saves/v10-migration.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`);
console.log(`wrote ${out}`);
