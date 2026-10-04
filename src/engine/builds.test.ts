import { describe, expect, it } from "vitest";
import { advance } from "./advance";
import { endSession, startSession, prestige } from "./actions";
import {
  BUILD_MILESTONE_SECONDS,
  BUILD_NODES,
  baseBuildFactors,
  buildFactorsFor,
  buildUnlocksFor,
  equipBuildNode,
  equipSlotsFor,
  equippedNodes,
  normalizeHabitBuilds,
  unequipBuildNode,
  unlockedNodes,
} from "./builds";
import { BALANCE, ROLL_POOL } from "./constants";
import { computeRates, receivedStrength } from "./economy";
import { addPracticeLog, createHabit, selectHabit } from "./habits";
import { fresh, give } from "./fixtures";
import { hex } from "./hex";
import { deserialize, serialize } from "./save";
import type { GameState, Habit } from "./types";

// The habit builds and RITUAL (ADR-0046, wave 4): one shared catalog in two
// branches, unlocked by the habit's credited practice time, equipped freely
// into the slot ladder, active only while the habit is the session's active
// habit. RITUAL amplifies the equipped magnitudes while receiving charge —
// board-side only; nothing crosses to the console (ADR-0012).

function habitOf(s: GameState, seconds: number, name = "Piano"): Habit {
  const result = createHabit(s, name);
  expect(result.ok).toBe(true);
  const habit = result.habit!;
  habit.seconds = seconds;
  return habit;
}

describe("the milestone and slot ladders", () => {
  it("a habit past 1h has its first nodes unlocked in both branches and one slot", () => {
    expect(buildUnlocksFor(3599)).toBe(0);
    expect(buildUnlocksFor(3600)).toBe(1);
    const unlocked = unlockedNodes(3600);
    expect(unlocked.map((node) => node.id)).toEqual(["charge-tap", "weights"]);
    expect(equipSlotsFor(3600)).toBe(1);
  });

  it("slot growth follows the table: +1 at 15h, 80h, 150h — four at most", () => {
    expect(equipSlotsFor(5 * 3600)).toBe(1);
    expect(equipSlotsFor(15 * 3600)).toBe(2);
    expect(equipSlotsFor(40 * 3600)).toBe(2);
    expect(equipSlotsFor(80 * 3600)).toBe(3);
    expect(equipSlotsFor(149 * 3600)).toBe(3);
    expect(equipSlotsFor(150 * 3600)).toBe(4);
    expect(equipSlotsFor(1000 * 3600)).toBe(4);
  });

  it("every milestone rung carries one node per branch", () => {
    for (let rung = 0; rung < BUILD_MILESTONE_SECONDS.length; rung++) {
      const atRung = BUILD_NODES.filter((node) => node.milestone === rung);
      expect(atRung.map((node) => node.branch).sort()).toEqual(["charge", "nous"]);
    }
  });
});

describe("equipping (free respec, upgrade mode only)", () => {
  it("equips within the slots and refuses past them", () => {
    const s = fresh();
    const habit = habitOf(s, 15 * 3600); // 2 slots, 4 unlocked nodes
    expect(equipBuildNode(s, habit.id, "charge-tap").ok).toBe(true);
    expect(equipBuildNode(s, habit.id, "weights").ok).toBe(true);
    const third = equipBuildNode(s, habit.id, "pitch-ear");
    expect(third.ok).toBe(false);
    expect(third.reason).toContain("No slot free");
  });

  it("respec is free and immediate: unequip then equip spends nothing", () => {
    const s = fresh();
    const habit = habitOf(s, 3600);
    const nousBefore = s.nous;
    expect(equipBuildNode(s, habit.id, "charge-tap").ok).toBe(true);
    expect(unequipBuildNode(s, habit.id, "charge-tap").ok).toBe(true);
    expect(equipBuildNode(s, habit.id, "weights").ok).toBe(true);
    expect(s.nous).toBe(nousBefore);
    expect(habit.build).toEqual(["weights"]);
  });

  it("refuses locked nodes, unknown nodes, and duplicates", () => {
    const s = fresh();
    const habit = habitOf(s, 3600);
    const locked = equipBuildNode(s, habit.id, "forge-hand"); // 15h node
    expect(locked.ok).toBe(false);
    expect(locked.reason).toContain("15h");
    expect(equipBuildNode(s, habit.id, "no-such-node").ok).toBe(false);
    expect(equipBuildNode(s, habit.id, "charge-tap").ok).toBe(true);
    expect(equipBuildNode(s, habit.id, "charge-tap").ok).toBe(false);
  });

  it("is locked during flow — the build is read-only while a session runs", () => {
    const s = fresh();
    const habit = habitOf(s, 3600);
    selectHabit(s, habit.id);
    startSession(s, null);
    expect(equipBuildNode(s, habit.id, "charge-tap").ok).toBe(false);
    expect(unequipBuildNode(s, habit.id, "charge-tap").ok).toBe(false);
  });
});

describe("build effects are active-only", () => {
  it("Forge-hand scales Forge progress only while its habit is the active one", () => {
    const s = fresh();
    give(s, "forge", hex(1, 0));
    const generator = give(s, "focusKeyed", hex(2, 0));
    generator.reserve = 600;
    const power = BALANCE.rarityPower.common ** 0;
    const practiced = habitOf(s, 15 * 3600);
    equipBuildNode(s, practiced.id, "forge-hand");
    // computeRates reads the current selection, so a habit switch drops the
    // effects the same tick — no session boundary needed.
    selectHabit(s, practiced.id);
    expect(computeRates(s, true).forgeRate).toBeCloseTo(power * 1.1, 6);
    const other = habitOf(s, 15 * 3600, "Cooking");
    selectHabit(s, other.id);
    expect(computeRates(s, true).forgeRate).toBeCloseTo(power, 6);
    selectHabit(s, null);
    expect(computeRates(s, true).forgeRate).toBeCloseTo(power, 6);
  });

  it("Weights scale the synth term; the effects drop the same tick the habit switches", () => {
    const s = fresh();
    const practiced = habitOf(s, 40 * 3600);
    equipBuildNode(s, practiced.id, "weights"); // +5%
    equipBuildNode(s, practiced.id, "weights-ii"); // +10%, stacks
    selectHabit(s, practiced.id);
    const withBuild = computeRates(s, true).synths;
    selectHabit(s, null);
    const without = computeRates(s, true).synths;
    expect(withBuild).toBeCloseTo(without * 1.15, 6);
    expect(without).toBeCloseTo(BALANCE.synthRate, 6);
  });

  it("the unamplified read: baseBuildFactors quotes magnitudes, amplifyFactors scales them", () => {
    const s = fresh();
    const habit = habitOf(s, 150 * 3600);
    equipBuildNode(s, habit.id, "forge-hand");
    equipBuildNode(s, habit.id, "forge-hand-ii");
    const base = baseBuildFactors(habit);
    expect(base.forgeEfficiency).toBeCloseTo(0.25, 6);
    const amplified = buildFactorsFor(habit, 0.5);
    expect(amplified.forgeEfficiency).toBeCloseTo(0.375, 6);
    // A zero build stays exactly zero whatever the amplification reads.
    expect(buildFactorsFor(undefined, 10).synthTerm).toBe(0);
  });
});

describe("the charge branch", () => {
  it("Charge tap scales the session-end window bank", () => {
    const s = fresh();
    give(s, "forge", hex(1, 0));
    give(s, "focusKeyed", hex(2, 0));
    const generator = s.modules.find((m) => m.type === "focusKeyed")!;
    const habit = habitOf(s, 40 * 3600);
    equipBuildNode(s, habit.id, "charge-tap"); // +10%
    equipBuildNode(s, habit.id, "charge-tap-ii"); // +15%, stacks
    selectHabit(s, habit.id);
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    expect(generator.reserve).toBeCloseTo(60 * 1.25, 6);
  });

  it("manual logs feed the time-side milestones only — never a window, tapped or not", () => {
    const s = fresh();
    give(s, "forge", hex(1, 0));
    give(s, "focusKeyed", hex(2, 0));
    const generator = s.modules.find((m) => m.type === "focusKeyed")!;
    const habit = habitOf(s, 0);
    equipBuildNode(s, habit.id, "charge-tap");
    selectHabit(s, habit.id);
    expect(addPracticeLog(s, habit.id, 60).ok).toBe(true);
    expect(generator.reserve).toBe(0);
    expect(buildUnlocksFor(habit.seconds)).toBe(1);
  });

  it("Steady conduit adds a flat +1 to each emitting generator's strength", () => {
    const s = fresh();
    const forge = give(s, "forge", hex(1, 0));
    const generator = give(s, "focusKeyed", hex(2, 0));
    generator.reserve = 600;
    const habit = habitOf(s, 5 * 3600);
    equipBuildNode(s, habit.id, "steady-conduit");
    selectHabit(s, habit.id);
    const power = BALANCE.rarityPower.common ** 0;
    expect(receivedStrength(s, forge, true)).toBeCloseTo(power + 1, 6);
    unequipBuildNode(s, habit.id, "steady-conduit");
    expect(receivedStrength(s, forge, true)).toBeCloseTo(power, 6);
  });
});

describe("the nous branch", () => {
  it("Pitch ear scales every named instance's bonus, term displayed included", () => {
    const s = fresh();
    give(s, "additive", hex(1, 0)); // G4 beside the opening C4 — a Fifth
    const plain = computeRates(s, true);
    const term = plain.namedChords.find((chord) => chord.name === "Fifth")!;
    const habit = habitOf(s, 5 * 3600);
    equipBuildNode(s, habit.id, "pitch-ear");
    selectHabit(s, habit.id);
    const scaled = computeRates(s, true);
    const scaledTerm = scaled.namedChords.find((chord) => chord.name === "Fifth")!;
    expect(scaledTerm.bonus).toBeCloseTo(term.bonus * 1.1, 6);
    // The named-instance product scales; the formation quality does not.
    const voiceId = term.moduleIds[0]!;
    const plainC = plain.contributions.get(voiceId)!;
    const scaledC = scaled.contributions.get(voiceId)!;
    expect(scaledC.chordFactor! / scaledC.formationQ).toBeCloseTo(
      ((1 + term.bonus * 1.1) / (1 + term.bonus)) * (plainC.chordFactor! / plainC.formationQ),
      6,
    );
  });

  it("Steady hand scales the booster uplift the oscillators read", () => {
    const s = fresh();
    give(s, "additive", hex(0, 0));
    give(s, "infusor", hex(1, 0));
    const habit = habitOf(s, 15 * 3600);
    equipBuildNode(s, habit.id, "steady-hand");
    selectHabit(s, habit.id);
    const withBuild = computeRates(s, true);
    const contribution = withBuild.contributions.get(s.modules[0]!.id)!;
    expect(contribution.infusorBonus).toBeCloseTo(BALANCE.infusorBonus * 1.1, 6);
  });

  it("Feat resonance scales the achievement boost", () => {
    const s = fresh();
    s.achievements["first-light"] = 1000; // boost 1.02
    const habit = habitOf(s, 80 * 3600);
    equipBuildNode(s, habit.id, "feat-resonance");
    selectHabit(s, habit.id);
    expect(computeRates(s, true).achievementBoost).toBeCloseTo(1.02 * 1.1, 6);
  });
});

describe("RITUAL", () => {
  it("reaches players through the module-roll pool only", () => {
    expect(ROLL_POOL).toContain("ritual");
    expect(ROLL_POOL).toHaveLength(11);
  });

  it("produces nothing and receives charge as a continuous member", () => {
    const s = fresh();
    const ritual = give(s, "ritual", hex(1, 0));
    give(s, "focusKeyed", hex(2, 0));
    const generator = s.modules.find((m) => m.type === "focusKeyed")!;
    generator.reserve = 600;
    startSession(s, null);
    const snapshot = computeRates(s, true);
    expect(snapshot.contributions.get(ritual.id)!.value).toBe(0);
    expect(snapshot.contributions.get(ritual.id)!.amplitude).toBe(0);
    expect(snapshot.chargeStrength.get(ritual.id)!).toBeCloseTo(BALANCE.rarityPower.common ** 0, 6);
  });

  it("amplifies the equipped build proportionally to received charge, and only then", () => {
    const s = fresh();
    const ritual = give(s, "ritual", hex(1, 0));
    const generator = give(s, "focusKeyed", hex(2, 0));
    const habit = habitOf(s, 3600);
    equipBuildNode(s, habit.id, "weights");
    selectHabit(s, habit.id);

    // Uncharged (no reserve): no amplification, the plain +5%.
    const uncharged = computeRates(s, true);
    expect(uncharged.ritualAmplification).toBe(0);
    expect(uncharged.synths).toBeCloseTo(BALANCE.synthRate * 1.05, 6);

    // Charged: the amp rides the charged-empowerment curve — the family's
    // continuous-empowerment read — of the strength the ritual receives,
    // level-scaled.
    ritual.level = 2;
    generator.reserve = 600;
    const charged = computeRates(s, true);
    const strength = charged.chargeStrength.get(ritual.id)!;
    const curve = 1 + strength / (1 + strength);
    const amp = BALANCE.ritualAmpPerLevel * 2 * curve;
    expect(charged.ritualAmplification).toBeCloseTo(amp, 6);
    // The amplification scales the node's magnitude: +5% → +5% × (1 + amp).
    expect(charged.synths).toBeCloseTo(BALANCE.synthRate * (1 + 0.05 * (1 + amp)), 6);
  });

  it("RITUAL attunement scales the amplification itself, never its own magnitude", () => {
    const s = fresh();
    const ritual = give(s, "ritual", hex(1, 0));
    give(s, "focusKeyed", hex(2, 0));
    const generator = s.modules.find((m) => m.type === "focusKeyed")!;
    generator.reserve = 600;
    ritual.level = 1;
    const habit = habitOf(s, 80 * 3600);
    equipBuildNode(s, habit.id, "ritual-attunement");
    selectHabit(s, habit.id);
    const snapshot = computeRates(s, true);
    const strength = snapshot.chargeStrength.get(ritual.id)!;
    const curve = 1 + strength / (1 + strength);
    expect(snapshot.ritualAmplification).toBeCloseTo(BALANCE.ritualAmpPerLevel * 1.25 * curve, 6);
    // The attunement node has no other magnitude to scale.
    expect(baseBuildFactors(habit).ritualAttunement).toBeCloseTo(0.25, 6);
    expect(buildFactorsFor(habit, snapshot.ritualAmplification).ritualAttunement).toBeCloseTo(0.25, 6);
  });

  it("nothing crosses to the console: amplification touches board factors only", () => {
    const s = fresh();
    give(s, "ritual", hex(1, 0));
    give(s, "focusKeyed", hex(2, 0));
    const generator = s.modules.find((m) => m.type === "focusKeyed")!;
    generator.reserve = 600;
    const habit = habitOf(s, 15 * 3600); // two slots: weights and charge-tap
    equipBuildNode(s, habit.id, "weights");
    equipBuildNode(s, habit.id, "charge-tap");
    selectHabit(s, habit.id);
    startSession(s, 600);
    advance(s, 600);
    endSession(s);
    // The habit's credited practice and the banked window are untouched by
    // the ritual's presence — charge stayed board-side. (The habit seeded
    // with 15h to hold both nodes; the session adds its 600 live.)
    expect(habit.seconds).toBeCloseTo(54600, 6);
    expect(generator.reserve).toBeCloseTo(60 * 1.1, 6); // charge tap, un-amplified at session end
  });
});

describe("persistence", () => {
  it("prestige keeps builds, unlocks, and slots exactly as they were", () => {
    const s = fresh();
    s.eraEarned = 1e23;
    const habit = habitOf(s, 15 * 3600);
    equipBuildNode(s, habit.id, "charge-tap");
    equipBuildNode(s, habit.id, "weights");
    prestige(s);
    expect(habit.build).toEqual(["charge-tap", "weights"]);
    expect(habit.seconds).toBe(15 * 3600);
    expect(equippedNodes(habit)).toHaveLength(2);
    expect(equipSlotsFor(habit.seconds)).toBe(2);
    expect(buildUnlocksFor(habit.seconds)).toBe(3);
  });

  it("the save round-trips the equipped build; a pre-builds habit lenient-defaults", () => {
    const s = fresh();
    const habit = habitOf(s, 3600);
    equipBuildNode(s, habit.id, "weights");
    const loaded = deserialize(serialize(s)).state!;
    expect(loaded.habits[0]!.build).toEqual(["weights"]);

    // A v8 save written before wave 4 carries no build arrays at all.
    const raw = JSON.parse(serialize(s));
    delete raw.state.habits[0].build;
    const migrated = deserialize(JSON.stringify(raw)).state!;
    expect(migrated.habits[0]!.build).toEqual([]);
  });

  it("normalizeHabitBuilds drops unknown ids and duplicates, never crashes", () => {
    const habit: Habit = { id: "h1", name: "Piano", seconds: 10, archived: false, build: ["weights", "ghost", "weights"] };
    normalizeHabitBuilds([habit]);
    expect(habit.build).toEqual(["weights"]);
  });
});
