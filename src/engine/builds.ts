// The habit-build surface (ADR-0046, wave 4): one shared, habit-agnostic
// node catalog in two branches — charge/Forge progress and nous production —
// unlocked as the habit's credited practice time (live, honesty-credited,
// and manual-log: the same stream habit development reads) crosses the
// wave-2 milestone ladder, equipped freely into the habit's slot ladder.
// Unlocks derive idempotently from `habit.seconds` at read time — never
// stored, so a long-practiced habit sees its milestones immediately and
// prestige never un-earns them. Unlocks are free; the equip slots are the
// permanent decision point. Respec is free and immediate in upgrade mode.
//
// Effects are active-only: they apply while that habit is the session's
// active habit, never as always-on cross-habit bonuses; unstructured
// sessions run no build. RITUAL (the chargeable board module) amplifies the
// equipped magnitudes while receiving charge — the amplification is passed
// in by the rate pass, never derived here. The boundary stands (ADR-0012):
// charge never crosses to the console; manual logs feed time-side
// milestones only. All magnitudes are the spec's provisional tuning.
import { activeHabit } from "./habits";
import type { GameState, Habit } from "./types";

// The milestone ladder (credited practice seconds per habit): 1h, 5h, 15h,
// 40h, 80h, 150h. Wave 4 hangs one node per branch per rung.
export const BUILD_MILESTONE_SECONDS: readonly number[] = [
  3600,
  5 * 3600,
  15 * 3600,
  40 * 3600,
  80 * 3600,
  150 * 3600,
];

// How many milestones a habit's practice time has crossed — the derivation
// the catalog maps onto its nodes. Idempotent in seconds; monotone in time.
export function buildUnlocksFor(seconds: number): number {
  return BUILD_MILESTONE_SECONDS.filter((milestone) => seconds >= milestone).length;
}

// The equip-slot ladder (ADR-0046): one slot at the first unlock, +1 at
// 15h, 80h, and 150h — four at most. Time buys options; slots force
// choices.
export const EQUIP_SLOT_MILESTONES: readonly number[] = [
  BUILD_MILESTONE_SECONDS[0]!,
  BUILD_MILESTONE_SECONDS[2]!,
  BUILD_MILESTONE_SECONDS[4]!,
  BUILD_MILESTONE_SECONDS[5]!,
];

export const EQUIP_SLOT_MAX = EQUIP_SLOT_MILESTONES.length;

export function equipSlotsFor(seconds: number): number {
  return EQUIP_SLOT_MILESTONES.filter((milestone) => seconds >= milestone).length;
}

export type BuildBranch = "charge" | "nous";

// One catalog entry. `milestone` indexes BUILD_MILESTONE_SECONDS — both
// branches unlock their node at the same practice time. `stacking` marks a
// base node's second copy: its magnitude adds to the base's (the spec's
// "stacks" entries).
export interface BuildNodeDef {
  id: string;
  branch: BuildBranch;
  name: string;
  milestone: number;
  effect: string;
  stacking?: boolean;
}

// The launch catalog (ADR-0046; magnitudes provisional per the tuning
// table): six rungs, one node per branch per rung.
export const BUILD_NODES: readonly BuildNodeDef[] = [
  // ── Charge / Forge-progress branch ──
  { id: "charge-tap", branch: "charge", name: "Charge tap", milestone: 0, effect: "+10% Focus Generator window bank" },
  { id: "steady-conduit", branch: "charge", name: "Steady conduit", milestone: 1, effect: "+1 output strength, owned generators" },
  { id: "forge-hand", branch: "charge", name: "Forge hand", milestone: 2, effect: "+10% Forge progress efficiency" },
  { id: "charge-tap-ii", branch: "charge", name: "Charge tap II", milestone: 3, effect: "+15% window bank", stacking: true },
  { id: "ritual-attunement", branch: "charge", name: "RITUAL attunement", milestone: 4, effect: "+25% RITUAL amplification" },
  { id: "forge-hand-ii", branch: "charge", name: "Forge hand II", milestone: 5, effect: "+15% Forge efficiency", stacking: true },
  // ── Nous-production branch ──
  { id: "weights", branch: "nous", name: "Weights", milestone: 0, effect: "+5% synth term" },
  { id: "pitch-ear", branch: "nous", name: "Pitch ear", milestone: 1, effect: "+10% named-chord instance bonuses" },
  { id: "steady-hand", branch: "nous", name: "Steady hand", milestone: 2, effect: "+10% booster uplift" },
  { id: "weights-ii", branch: "nous", name: "Weights II", milestone: 3, effect: "+10% synth term", stacking: true },
  { id: "feat-resonance", branch: "nous", name: "Feat resonance", milestone: 4, effect: "+10% achievementBoost" },
  { id: "deep-practice", branch: "nous", name: "Deep practice", milestone: 5, effect: "+15% named-chord bonuses", stacking: true },
];

const NODE_BY_ID: ReadonlyMap<string, BuildNodeDef> = new Map(BUILD_NODES.map((node) => [node.id, node]));

export function buildNode(id: string): BuildNodeDef | undefined {
  return NODE_BY_ID.get(id);
}

// The nodes a habit's practice time has unlocked — one per branch per
// crossed milestone, in catalog order. Derived, never stored.
export function unlockedNodes(seconds: number): readonly BuildNodeDef[] {
  const rungs = BUILD_MILESTONE_SECONDS.filter((milestone) => seconds >= milestone).length;
  return BUILD_NODES.filter((node) => node.milestone < rungs);
}

// The habit's equipped nodes, validated: unknown ids drop (a save can carry
// none — the catalog is code, the save only ids), unequipped-at-unlock
// never happens the other way (seconds only grow), duplicates collapse,
// and catalog order holds so display is stable.
export function equippedNodes(habit: Habit | undefined): readonly BuildNodeDef[] {
  if (!habit?.build || habit.build.length === 0) return [];
  const equipped = habit.build.map((id) => NODE_BY_ID.get(id)).filter((node): node is BuildNodeDef => node !== undefined);
  return BUILD_NODES.filter((node) => equipped.includes(node));
}

// The equipped build's magnitudes, un-amplified — the RITUAL-free read the
// session-end window bank and the equip UI quote. Additive stacking: a
// stacking node's magnitude adds to its base's.
export interface BuildFactors {
  windowBank: number;
  generatorStrength: number;
  forgeEfficiency: number;
  ritualAttunement: number;
  synthTerm: number;
  namedChordBonus: number;
  boosterUplift: number;
  achievementBoost: number;
}

const MAGNITUDE_OF: Record<string, number> = {
  "charge-tap": 0.1,
  "steady-conduit": 1,
  "forge-hand": 0.1,
  "charge-tap-ii": 0.15,
  "ritual-attunement": 0.25,
  "forge-hand-ii": 0.15,
  weights: 0.05,
  "pitch-ear": 0.1,
  "steady-hand": 0.1,
  "weights-ii": 0.1,
  "feat-resonance": 0.1,
  "deep-practice": 0.15,
};

const ZERO_FACTORS: BuildFactors = {
  windowBank: 0,
  generatorStrength: 0,
  forgeEfficiency: 0,
  ritualAttunement: 0,
  synthTerm: 0,
  namedChordBonus: 0,
  boosterUplift: 0,
  achievementBoost: 0,
};

// The un-amplified factors of a habit's equipped build. The habit must be
// the active one for its build to run at all — callers read
// `activeHabit(state)`; undefined (unstructured) yields zero factors.
export function baseBuildFactors(habit: Habit | undefined): BuildFactors {
  const factors: BuildFactors = { ...ZERO_FACTORS };
  for (const node of equippedNodes(habit)) {
    const magnitude = MAGNITUDE_OF[node.id] ?? 0;
    switch (node.id) {
      case "charge-tap":
      case "charge-tap-ii":
        factors.windowBank += magnitude;
        break;
      case "steady-conduit":
        factors.generatorStrength += magnitude;
        break;
      case "forge-hand":
      case "forge-hand-ii":
        factors.forgeEfficiency += magnitude;
        break;
      case "ritual-attunement":
        factors.ritualAttunement += magnitude;
        break;
      case "weights":
      case "weights-ii":
        factors.synthTerm += magnitude;
        break;
      case "pitch-ear":
      case "deep-practice":
        factors.namedChordBonus += magnitude;
        break;
      case "steady-hand":
        factors.boosterUplift += magnitude;
        break;
      case "feat-resonance":
        factors.achievementBoost += magnitude;
        break;
    }
  }
  return factors;
}

// The build's factors under a RITUAL's raw amplification: every magnitude
// scales by (1 + amp) — the attunement node feeds the amp itself (the
// caller folds it in before calling), never its own amplification. The
// zero build stays exactly zero whatever the amp reads.
export function amplifyFactors(base: BuildFactors, rawAmplification: number): BuildFactors {
  const amp = 1 + rawAmplification;
  return {
    windowBank: base.windowBank * amp,
    generatorStrength: base.generatorStrength * amp,
    forgeEfficiency: base.forgeEfficiency * amp,
    ritualAttunement: base.ritualAttunement,
    synthTerm: base.synthTerm * amp,
    namedChordBonus: base.namedChordBonus * amp,
    boosterUplift: base.boosterUplift * amp,
    achievementBoost: base.achievementBoost * amp,
  };
}

// The one entry point callers outside the rate pass use: the active habit's
// amplified factors. `rawAmplification` comes from the deployed RITUALs
// (zero outside the live rate pass).
export function buildFactorsFor(habit: Habit | undefined, rawAmplification = 0): BuildFactors {
  return amplifyFactors(baseBuildFactors(habit), rawAmplification);
}

// The active habit's build factors for a state — the session-end seam
// (endSession's window bank runs outside the rate pass, so it quotes the
// un-amplified magnitudes; RITUAL amplifies while receiving charge, and no
// charge is received at session end).
export function activeBuildFactors(state: GameState): BuildFactors {
  return baseBuildFactors(activeHabit(state));
}

// ── Equipping (upgrade mode only; free, immediate respec) ────────────────

export function equipBuildNode(state: GameState, habitId: string, nodeId: string): { ok: boolean; reason?: string } {
  if (state.mode !== "upgrade") return { ok: false, reason: "Builds are managed between sessions." };
  const habit = state.habits.find((h) => h.id === habitId);
  if (!habit) return { ok: false, reason: "Habit not found." };
  const node = buildNode(nodeId);
  if (!node) return { ok: false, reason: "That build node does not exist." };
  if (habit.build.includes(nodeId)) return { ok: false, reason: "Already equipped." };
  const milestone = BUILD_MILESTONE_SECONDS[node.milestone]!;
  if (habit.seconds < milestone) {
    return { ok: false, reason: `${node.name} unlocks at ${Math.round(milestone / 3600)}h of practice on this habit.` };
  }
  const slots = equipSlotsFor(habit.seconds);
  if (equippedNodes(habit).length >= slots) {
    return { ok: false, reason: `No slot free — ${slots} equipped. Unequip one first.` };
  }
  habit.build.push(nodeId);
  return { ok: true };
}

export function unequipBuildNode(state: GameState, habitId: string, nodeId: string): { ok: boolean; reason?: string } {
  if (state.mode !== "upgrade") return { ok: false, reason: "Builds are managed between sessions." };
  const habit = state.habits.find((h) => h.id === habitId);
  if (!habit) return { ok: false, reason: "Habit not found." };
  const index = habit.build.indexOf(nodeId);
  if (index < 0) return { ok: false, reason: "That node is not equipped." };
  habit.build.splice(index, 1);
  return { ok: true };
}

// Load-time lenient default (no second version bump — the v8 surface's
// build-derivation promise): a habit saved before the builds wave carries
// no build; corrupt shapes reset to unequipped, never crash. Unknown ids
// drop (the catalog is code, the save only ids) and duplicates collapse.
export function normalizeHabitBuilds(habits: Habit[]): void {
  for (const habit of habits) {
    if (!Array.isArray(habit.build)) habit.build = [];
    habit.build = [...new Set(habit.build.filter((id) => typeof id === "string" && NODE_BY_ID.has(id)))];
  }
}
