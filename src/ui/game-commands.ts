import * as habits from "../engine/habits";
import * as goals from "../engine/goals";
import * as classes from "../engine/classes";
import { writeNote } from "../engine/notes";
import { resolveHonestyReport } from "../engine/trust";
import * as actions from "../engine/actions";
import type { ActionResult } from "../engine/actions";
import type { GameState, Hex } from "../engine/types";

// A declared data-only vocabulary: no method lookup, code evaluation, or RNG input.
// Each argument is checked before the engine sees it; the engine owns prerequisites.
type Reader<T> = (value: unknown) => T;
const text: Reader<string> = (v) => {
  if (typeof v !== "string" || !v) throw new Error("Expected a nonempty string.");
  return v;
};
const number: Reader<number> = (v) => {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error("Expected a finite number.");
  return v;
};
const integer: Reader<number> = (v) => {
  const n = number(v);
  if (!Number.isInteger(n)) throw new Error("Expected a whole number.");
  return n;
};
const choice = <T extends string>(...values: T[]): Reader<T> => (v) => {
  const match = values.find((value) => value === v);
  if (match === undefined) throw new Error(`Expected ${values.join(" or ")}.`);
  return match;
};
const nullable = <T>(read: Reader<T>): Reader<T | null> => (v) => v === null ? null : read(v);
const list = <T>(read: Reader<T>): Reader<T[]> => (v) => {
  if (!Array.isArray(v)) throw new Error("Expected an array.");
  return v.map(read);
};
const position: Reader<Hex> = (v) => {
  if (typeof v !== "object" || v === null || !("q" in v) || !("r" in v)) throw new Error("Expected {q, r} coordinates.");
  return { q: integer(v.q), r: integer(v.r) };
};
const levels: Reader<number | "max"> = (v) => {
  if (v === "max") return v;
  const n = integer(v);
  if (n < 1) throw new Error("Expected positive levels or max.");
  return n;
};
const kind = choice("category", "rare", "tier");
const category = choice("oscillator", "silentVoice", "spacer", "generator", "booster", "forge", "conduit", "ritual");
interface Command { run(state: GameState, args: unknown[]): ActionResult; }
function command<T extends unknown[]>(readers: { [K in keyof T]: Reader<T[K]> }, run: (state: GameState, ...args: T) => ActionResult): Command {
  return { run(state, args) {
    if (args.length !== readers.length) throw new Error(`Expected ${readers.length} arguments; found ${args.length}.`);
    const parsed = readers.map((read, i) => read(args[i])) as T;
    return run(state, ...parsed);
  } };
}

export const GAME_COMMANDS: Readonly<Record<string, Command>> = {
  createHabit: command([text], habits.createHabit),
  renameHabit: command([text, text], habits.renameHabit),
  archiveHabit: command([text], habits.archiveHabit),
  selectHabit: command([nullable(text)], habits.selectHabit),
  setHabitColor: command([text, choice("vermillion", "amber", "green", "cyan", "indigo", "violet")], habits.setHabitColor),
  addPracticeLog: command([text, number], (s, id, minutes) => habits.addPracticeLog(s, id, minutes, Date.now())),
  createGoal: command([text, number, choice("once", "daily", "weekly")], (s, habitId, minutes, schedule) => goals.createGoal(s, { habitId, minutes, schedule, now: Date.now() })),
  editGoal: command([text, number, choice("once", "daily", "weekly")], (s, id, minutes, schedule) => goals.editGoal(s, id, { minutes, schedule }, Date.now())),
  deleteGoal: command([text], goals.deleteGoal),
  retainGoalChoice: command([text], goals.retainGoalChoice),
  selectHabitClass: command([text, choice("engineer")], classes.selectHabitClass),
  allocateClassNode: command([text, text], classes.allocateClassNode),
  respecClassTree: command([text], classes.respecClassTree),
  applyClassPreset: command([text, text], classes.applyClassPreset),
  writeNote: command([text], (s, value) => writeNote(s, value, Date.now())),
  resolveHonestyReport: command([choice("full", "planned", "missed")], (s, outcome) => resolveHonestyReport(s, outcome)),
  buyCapacity: command([], actions.buyCapacity),
  buyCapacityCeiling: command([], actions.buyCapacityCeiling),
  buyCapacityDiscount: command([], actions.buyCapacityDiscount),
  buyCatalogEntry: command([], (s) => actions.buyCatalogEntry(s)),
  buyCell: command([position], actions.buyCell),
  buyDraftUpgrade: command([], actions.buyDraftUpgrade),
  buyMergeCapIncrease: command([], actions.buyMergeCapIncrease),
  buyRowUnlock: command([integer], actions.buyRowUnlock),
  buyShelfModule: command([choice("generator", "infusor", "forge")], actions.buyShelfModule),
  buySpecialDraft: command([kind], actions.buySpecialDraft),
  buyChargeColumn: command([], actions.buyChargeColumn),
  buyHoneRank: command([choice("chargeBlade")], actions.buyHoneRank),
  chooseMutatorRoll: command([text, text], actions.chooseMutatorRoll),
  chooseRoll: command([text, text], actions.chooseRoll),
  combine: command([text, text], (s, id, partner) => actions.combine(s, id, partner)),
  combineInventory: command([text, text], actions.combineInventory),
  scrapInventoryBatch: command([list(text)], actions.scrapInventoryBatch),
  dismissArcCard: command([], actions.dismissArcCard),
  dismissSummary: command([], actions.dismissSummary),
  endBreather: command([], actions.endBreather),
  endSession: command([], (s) => actions.endSession(s, Date.now())),
  joinRollPool: command([], actions.joinRollPool),
  mergeAll: command([], actions.mergeAll),
  pauseSession: command([], actions.pauseSession),
  placeModule: command([text, position], actions.placeModule),
  placeWorldOccupant: command([text, position], actions.placeWorldOccupant),
  prestige: command([], actions.prestige),
  reflectionText: command([text], (s, value) => actions.recordSummaryReflection(s, { text: value })),
  reflectionSlider: command([number], (s, value) => actions.recordSummaryReflection(s, { slider: value })),
  resumeSession: command([], actions.resumeSession),
  returnModule: command([text], actions.returnModule),
  retrieveWorldOccupant: command([text], actions.retrieveWorldOccupant),
  scrapModule: command([text], actions.scrapModule),
  setBendShift: command([text, integer], actions.setBendShift),
  setBoosterTarget: command([text, nullable(text)], actions.setBoosterTarget),
  setWeaponTargetPriority: command([text, list(text)], actions.setWeaponTargetPriority),
  skipRoll: command([text], actions.skipRoll),
  startBreather: command([], (s) => actions.startBreather(s, Date.now())),
  startSession: command([nullable(number)], (s, seconds) => {
    if (seconds !== null && (!Number.isInteger(seconds / 60) || seconds < 60 || seconds > 36000)) throw new Error("Session seconds must be whole minutes 60–36000, or null.");
    return actions.startSession(s, seconds, Date.now());
  }),
  upgradeAll: command([levels], actions.upgradeAll),
  upgradeModuleLevels: command([text, levels], actions.upgradeModuleLevels),
  useSpecialDraft: command([kind, category], (s, k, c) => actions.useSpecialDraft(s, k, c)),
};
