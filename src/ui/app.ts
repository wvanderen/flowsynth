import { advance } from "../engine/advance";
import type { AdvanceResult } from "../engine/types";
import {
  acknowledgeHorizon,
  buyActivation,
  buyCell,
  buyGoalCapacity,
  buyShelfModule,
  chooseRoll,
  combine,
  endSession,
  pauseSession,
  placeModule,
  reshapeCells,
  resumeSession,
  returnModule,
  startSession,
  upgradeModule,
  type ActionResult,
} from "../engine/actions";
import { syncArete } from "../engine/accumulator";
import { cellCost, computeRates, wholeNous } from "../engine/economy";
import { adjacent, neighbors, sameHex } from "../engine/hex";
import { deserialize, serialize, STORAGE_KEY } from "../engine/save";
import { planTick } from "../engine/clock";
import { createInitialState } from "../engine/state";
import { appActive, type FocusApp } from "../engine/apps";
import { writeNote } from "../engine/notes";
import { BALANCE } from "../engine/constants";
import {
  activeHabit,
  addPracticeLog,
  archiveHabit,
  createHabit,
  renameHabit,
  selectHabit,
} from "../engine/habits";
import { createGoal, deleteGoal, rollGoalOccurrences } from "../engine/goals";
import type { GameState, Hex, ShelfType } from "../engine/types";
import { render } from "./render";
import { APP_LABELS, META } from "./meta";
import { formatInt, practiceCountdown } from "./format";

export type ModalKind = "settings" | "store" | "forge" | "export" | "import" | "reset" | "reconcile" | null;

export interface UiState {
  selected: string | null;
  // The focus app whose console popover is open, if any (ADR-0012).
  app: FocusApp | null;
  placing: string | null;
  managing: boolean;
  reshape: { adds: Hex[]; removes: Hex[] } | null;
  // Cell purchase (ADR-0013): armed from the catalog, resolved by clicking a
  // frontier hex. The buy only lands when a frontier cell is clicked.
  buyingCell: boolean;
  modal: ModalKind;
  importText: string;
  importError: string | null;
  chosenTarget: number | null;
  showAcquired: boolean;
  editingHabitId: string | null;
}

interface LoadedSave {
  state: GameState;
  savedAt: number;
}

type ParsedSave = LoadedSave | { error: string };

function parseSave(text: string): ParsedSave {
  const result = deserialize(text);
  if (result.error || !result.state) {
    return { error: result.error ?? "unknown error" };
  }
  let savedAt = Date.now();
  try {
    savedAt = (JSON.parse(text) as { savedAt?: number }).savedAt ?? savedAt;
  } catch {
    // keep fallback
  }
  return { state: result.state, savedAt };
}

export class App {
  state: GameState = createInitialState();
  ui: UiState = {
    selected: null,
    app: null,
    placing: null,
    managing: false,
    reshape: null,
    buyingCell: false,
    modal: null,
    importText: "",
    importError: null,
    chosenTarget: 600,
    showAcquired: false,
    editingHabitId: null,
  };
  lastWall: number | null = null;
  lastSaveWall = 0;
  dev: boolean;
  // The Forge's threshold-crossing flash: a roll was minted, so its face
  // flashes until this wall-clock moment.
  forgeFlashUntil = 0;
  // Set when the stored save was rejected (e.g. the ADR-0017 v5 clean cut):
  // the message must survive the constructor's greeting.
  private loadNotice: string | null = null;
  private els: Record<string, HTMLElement>;

  // Management mode counts only while the grid is unlocked: entering flow or
  // importing a save clears the flag, but stale values must never linger.
  get managing(): boolean {
    return this.ui.managing && this.state.mode === "upgrade";
  }

  constructor(els: Record<string, HTMLElement>, dev: boolean) {
    this.els = els;
    this.dev = dev;
    const loaded = this.load();
    if (loaded) {
      this.resumeFromSave(loaded);
    } else {
      this.state = createInitialState();
    }
    rollGoalOccurrences(this.state, Date.now());
    this.bindGlobalEvents();
    document.getElementById("manage-banner-done")?.addEventListener("click", () => this.stopManaging());
    document.getElementById("buy-banner-cancel")?.addEventListener("click", () => this.cancelCellPurchase());
    document.getElementById("console-settings")?.addEventListener("click", () => this.openModal("settings"));
    this.greet();
    this.render();
    this.save();
  }

  private load(): LoadedSave | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = parseSave(raw);
      if ("error" in parsed) {
        this.loadNotice = `Could not load the local save: ${parsed.error}`;
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  // Resumes an in-flow session from a save: ordinary background time applies
  // silently; extended gaps (sleep, closure, import) freeze for confirmation
  // instead of finalizing silently.
  private resumeFromSave(loaded: LoadedSave): void {
    this.state = loaded.state;
    this.lastWall = null;
    if (this.state.mode !== "flow") return;
    const plan = planTick(loaded.savedAt, Date.now());
    if (plan.pending !== null) {
      this.state.pendingGap = { seconds: plan.pending, detectedAt: Date.now() };
      this.ui.modal = "reconcile";
    } else {
      advance(this.state, plan.apply);
      this.lastWall = Date.now();
    }
  }

  save(now: number = Date.now()): void {
    try {
      localStorage.setItem(STORAGE_KEY, serialize(this.state, now));
    } catch {
      // Private browsing or full storage: the session continues without durable saves.
    }
    this.lastSaveWall = now;
  }

  exportText(): string {
    return serialize(this.state);
  }

  // The transient interaction modes are mutually exclusive: every exit path
  // (import, reset, session start, arming another mode) clears them together.
  private clearTransientUi(): void {
    this.ui.selected = null;
    this.ui.app = null;
    this.ui.placing = null;
    this.ui.managing = false;
    this.ui.reshape = null;
    this.ui.buyingCell = false;
  }

  importText(text: string): boolean {
    const parsed = parseSave(text);
    if ("error" in parsed) {
      this.ui.importError = parsed.error;
      this.render();
      return false;
    }
    this.clearTransientUi();
    this.ui.modal = null;
    this.ui.importError = null;
    this.resumeFromSave(parsed);
    this.say(
      this.state.pendingGap
        ? "Save imported while a session was running. Confirm the away interval before it counts."
        : "Save imported. Everything is where you left it.",
    );
    this.save();
    this.render();
    return true;
  }

  hardReset(): void {
    this.state = createInitialState();
    this.clearTransientUi();
    this.ui.modal = null;
    this.ui.importError = null;
    this.ui.chosenTarget = 600;
    this.lastWall = null;
    this.say("A fresh instrument. The Carrier is yours — enter flow when ready.");
    this.save();
    this.render();
  }

  say(text: string): void {
    const el = this.els["status"];
    if (el) el.textContent = text;
  }

  greet(): void {
    if (this.loadNotice) {
      this.say(`${this.loadNotice} A fresh instrument was created.`);
      this.loadNotice = null;
      return;
    }
    if (this.state.sessionsCompleted === 0 && this.state.mode === "upgrade") {
      this.say("Welcome. The Carrier is granted at the origin — upgrade it, then enter flow and let real practice power the instrument.");
    } else if (this.state.mode === "flow") {
      this.say("Flow is live. The instrument runs itself; your attention stays with your practice.");
    } else {
      this.say("The instrument is ready. Arrange, upgrade, and enter flow again.");
    }
  }

  private bindGlobalEvents(): void {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.save();
      } else {
        this.tick();
      }
    });
    window.addEventListener("beforeunload", () => this.save());
    window.setInterval(() => this.tick(), 100);
    // A popover is light furniture: clicking anywhere outside the console's
    // app section dismisses it. The board never dims beneath it (ADR-0012).
    // composedPath stays valid even when a tile click re-rendered the DOM.
    document.addEventListener("click", (event) => {
      if (this.ui.app === null) return;
      const inside = event.composedPath().some((node) => node instanceof Element && node.id === "console-apps");
      if (inside) return;
      this.closeApp();
    });
  }

  tick(): void {
    if (this.state.mode !== "flow" || this.state.pendingGap) {
      if (this.state.mode !== "flow") this.lastWall = null;
      return;
    }
    const now = Date.now();
    if (this.lastWall === null) {
      this.lastWall = now;
      return;
    }
    const plan = planTick(this.lastWall, now);
    if (plan.pending !== null) {
      this.state.pendingGap = { seconds: plan.pending, detectedAt: now };
      this.lastWall = now;
      this.ui.modal = "reconcile";
      this.render();
      return;
    }
    if (plan.apply > 0) {
      rollGoalOccurrences(this.state, now);
      const result = advance(this.state, plan.apply);
      this.reportAdvance(result);
    }
    this.lastWall = now;
    if (now - this.lastSaveWall > 5000) this.save(now);
    this.render();
  }

  private reportAdvance(result: AdvanceResult): void {
    const notes: string[] = [];
    if (result.rollsBanked > 0) {
      notes.push(`${result.rollsBanked} forge ${result.rollsBanked === 1 ? "roll" : "rolls"} banked.`);
      this.forgeFlashUntil = Date.now() + 900;
    }
    if (result.goalsCompleted > 0) notes.push(`${result.goalsCompleted} goal${result.goalsCompleted === 1 ? "" : "s"} completed.`);
    if (result.areteMinted > 0) notes.push("The accumulator filled — Arete minted at the horizon.");
    if (notes.length > 0) this.say(notes.join(" "));
  }

  private act(result: ActionResult, success: string): boolean {
    if (!result.ok) {
      this.say(result.reason ?? "That action is not available.");
    } else {
      this.say(success);
    }
    if (result.ok) this.save();
    this.render();
    return result.ok;
  }

  startFlow(): void {
    // Planned targets belong to the Time app (§2.3): until it auto-activates,
    // every session is mechanically open-ended.
    const target = appActive(this.state, "time") ? this.ui.chosenTarget : null;
    const started = this.act(
      startSession(this.state, target),
      target === null
        ? "Open-ended flow is live. The board produces exactly what it produces."
        : `Flow is live for ${Math.round(target / 60)} minutes. Your layout is locked; the instrument takes care of itself.`,
    );
    if (started) {
      this.lastWall = Date.now();
      this.clearTransientUi();
    }
  }

  endFlow(): void {
    if (this.act(endSession(this.state, Date.now()), "")) {
      this.lastWall = null;
      this.say("Session ended. The board's production is banked. Arrange, upgrade, and begin again when ready.");
    }
  }

  pause(): void {
    if (this.act(pauseSession(this.state), "Practice is paused. Your layout stays locked.")) {
      this.lastWall = null;
    }
  }

  resume(): void {
    if (this.act(resumeSession(this.state), "Flow resumed.")) {
      this.lastWall = Date.now();
    }
  }

  // The reserved prestige button (ADR-0015): inert at launch — pressing
  // only acknowledges the horizon, and the flag stays detectable.
  acknowledgeHorizon(): void {
    this.act(acknowledgeHorizon(this.state), "The horizon is acknowledged. Prestige itself waits beyond it.");
  }

  buyShelf(type: ShelfType): void {
    if (this.act(buyShelfModule(this.state, type), `${META[type].name} purchased. Choose a cell for it.`)) {
      this.ui.modal = null;
      this.beginPlacing(this.state.modules[this.state.modules.length - 1]!.id);
    }
  }

  // The activation ladder (ADR-0013): buying a rung flips the app on; the
  // telegraph and the other ladder rows step to the next price.
  buyActivationAction(appKey: FocusApp): void {
    this.act(buyActivation(this.state, appKey), `${APP_LABELS[appKey]} app activated. It stays yours.`);
  }

  // The first console long goal (ADR-0012): goal capacity, one beat at a
  // time from the Goals panel's dashed strip.
  buyGoalCapacityAction(): void {
    this.act(buyGoalCapacity(this.state), `Goal capacity grows by ${BALANCE.goalSlotsPerLongGoal} slots. The next beat prices itself past this one.`);
  }

  // Arm the cell purchase from the catalog: the buy itself lands only when a
  // frontier hex is clicked, so the price is always attached to a placement.
  armCellPurchase(): void {
    if (this.state.mode !== "upgrade") {
      this.say("Purchases happen between sessions.");
      return;
    }
    this.clearTransientUi();
    this.ui.modal = null;
    this.ui.buyingCell = true;
    const price = cellCost(this.state.cellsBought);
    this.say(`Choose a hex touching your board — the new cell costs ${formatInt(price)} ν. Esc or Cancel on the banner backs out.`);
    this.render();
  }

  cancelCellPurchase(): void {
    this.ui.buyingCell = false;
    this.say("Cell purchase cancelled.");
    this.render();
  }

  upgrade(id: string): void {
    const module = this.state.modules.find((m) => m.id === id);
    if (!module) return;
    const nextLevel = module.level + 1;
    this.act(upgradeModule(this.state, id), `${META[module.type].name} upgraded to level ${nextLevel}.`);
  }

  combinePair(id: string): void {
    this.reportCombine(combine(this.state, id));
  }

  // Drag-to-combine: dropping a module onto a same-type, same-rarity twin.
  // The survivor lands on the drop cell so the merge reads physically.
  dropCombine(id: string, partnerId: string, pos: Hex): void {
    const a = this.state.modules.find((m) => m.id === id);
    const b = this.state.modules.find((m) => m.id === partnerId);
    if (!a || !b) return;
    const result = combine(this.state, id, partnerId);
    if (result.ok) {
      // combine() keeps the higher-level input (ties keep `id`); land it here.
      const keeperId = b.level > a.level ? b.id : a.id;
      const keeper = this.state.modules.find((m) => m.id === keeperId);
      if (keeper) keeper.pos = pos;
    }
    this.reportCombine(result);
  }

  private reportCombine(result: ActionResult): void {
    if (result.ok) {
      this.say(
        result.refund && result.refund > 0
          ? `Combined into a stronger copy; ${result.refund} ν of the lower copy's upgrades refunded.`
          : "Combined into a stronger copy.",
      );
      this.save();
    } else {
      this.say(result.reason ?? "Cannot combine.");
    }
    this.render();
  }

  select(id: string | null): void {
    this.ui.selected = this.ui.selected === id ? null : id;
    this.ui.app = null;
    this.ui.placing = null;
    this.render();
  }

  openApp(app: FocusApp): void {
    // Locked tiles open nothing (ADR-0012): the tile is inert, greyed, and
    // carries its locknote; no panel, no message.
    if (!appActive(this.state, app)) return;
    this.ui.app = this.ui.app === app ? null : app;
    this.ui.selected = null;
    this.ui.placing = null;
    this.render();
  }

  closeApp(): void {
    this.ui.app = null;
    this.ui.editingHabitId = null;
    this.render();
  }

  beginPlacing(id: string): void {
    this.ui.selected = id;
    this.ui.app = null;
    this.ui.placing = id;
    this.say("Choose a cell. Occupied modules swap positions.");
    this.render();
  }

  pickCell(pos: Hex): void {
    const { state, ui } = this;
    if (state.mode !== "upgrade") {
      const occupant = state.modules.find((m) => m.pos !== null && sameHex(m.pos, pos));
      if (occupant) this.select(occupant.id);
      return;
    }
    if (ui.reshape) {
      this.stageReshape(pos);
      return;
    }
    if (ui.buyingCell) {
      // The arm persists across buys: sweep several cells, then back out
      // yourself via the banner's Cancel (or Esc). act() re-renders each
      // time, so the banner hint and hex prices step to the next scaler rung.
      this.act(buyCell(state, pos), "Cell bought. The board grew — buy another, or Cancel when done.");
      return;
    }
    if (ui.placing) {
      const module = state.modules.find((m) => m.id === ui.placing);
      if (!module) return;
      const result = placeModule(state, module.id, pos);
      if (this.act(result, `${META[module.type].name} placed. Production and adjacency have updated.`)) {
        ui.placing = null;
      }
      return;
    }
    const occupant = state.modules.find((m) => m.pos !== null && sameHex(m.pos, pos));
    if (occupant) this.select(occupant.id);
  }

  pickCellThenPlace(id: string, pos: Hex): void {
    const { state } = this;
    if (state.mode !== "upgrade" || this.ui.reshape || this.ui.buyingCell) return;
    const module = state.modules.find((m) => m.id === id);
    if (!module) return;
    this.ui.placing = null;
    this.act(placeModule(state, id, pos), `${META[module.type].name} placed.`);
  }

  returnToInventory(id: string): void {
    this.act(returnModule(this.state, id), "Returned to inventory. Its state is kept.");
  }

  addNote(text: string): void {
    const result = writeNote(this.state, text);
    if (result.ok) {
      this.say("Noted.");
      this.save();
    } else {
      this.say(result.reason ?? "Cannot capture a note right now.");
    }
    this.render();
  }

  // ── Habits (#5) ─────────────────────────────────────────────────────────

  habitAction(
    run: () => { ok: boolean; reason?: string },
    success: string,
  ): void {
    const result = run();
    if (result.ok) {
      this.say(success);
      this.save();
    } else {
      this.say(result.reason ?? "That habit action is unavailable.");
    }
    this.render();
  }

  createHabitAction(name: string): void {
    this.habitAction(() => createHabit(this.state, name), `${name.trim()} added to your habits.`);
  }

  renameHabitAction(id: string, name: string): void {
    this.ui.editingHabitId = null;
    this.habitAction(() => renameHabit(this.state, id, name), "Habit renamed.");
  }

  archiveHabitAction(id: string): void {
    const habit = this.state.habits.find((h) => h.id === id);
    this.habitAction(() => archiveHabit(this.state, id), `${habit?.name ?? "Habit"} archived. Its development is kept.`);
  }

  selectHabitAction(id: string | null): void {
    // Clicking the already-active habit clears the selection, so unstructured
    // practice is always one click away.
    const togglingOff = id !== null && this.state.activeHabitId === id;
    const target = togglingOff ? null : id;
    const habit = this.state.habits.find((h) => h.id === target);
    this.habitAction(
      () => selectHabit(this.state, target),
      togglingOff
        ? "Next session is unstructured; no habit selected."
        : habit
          ? `${habit.name} will be the active habit for your next session.`
          : "Next session is unstructured; no habit selected.",
    );
  }

  logPracticeAction(minutes: number): void {
    const habit = activeHabit(this.state);
    if (!habit) {
      this.say("Select a habit first; logs apply to the active habit.");
      this.render();
      return;
    }
    const result = addPracticeLog(this.state, habit.id, minutes, Date.now());
    if (result.ok) {
      const goalNote =
        result.completions && result.completions > 0
          ? ` A goal completed.`
          : "";
      this.say(`Logged ${minutes} minutes of ${habit.name}. Development grows; no nous or charge is produced.${goalNote}`);
      this.save();
    } else {
      this.say(result.reason ?? "Could not log practice.");
    }
    this.render();
  }

  // ── Goals (#6) ──────────────────────────────────────────────────────────

  createGoalAction(habitId: string | null, minutes: number, schedule: "once" | "daily" | "weekly"): void {
    const result = createGoal(this.state, { habitId, minutes, schedule, now: Date.now() });
    if (result.ok) {
      this.save();
      const habit = habitId ? this.state.habits.find((h) => h.id === habitId)?.name : "any habit";
      this.say(`Goal tracking: ${habit}, ${minutes} minutes ${schedule}.`);
    } else {
      this.say(result.reason ?? "Could not create the goal.");
    }
    this.render();
  }

  deleteGoalAction(id: string): void {
    const result = deleteGoal(this.state, id);
    this.say(result.ok ? "Goal removed; the slot is free." : result.reason ?? "Could not remove the goal.");
    if (result.ok) this.save();
    this.render();
  }

  chooseCandidate(offerId: string, candidateId: string): void {
    const offer = this.state.bankedRolls.find((o) => o.id === offerId);
    const candidate = offer?.candidates.find((c) => c.id === candidateId);
    if (!candidate) return;
    if (this.act(chooseRoll(this.state, offerId, candidateId), "")) {
      const added = this.state.modules[this.state.modules.length - 1]!;
      this.ui.modal = null;
      this.ui.managing = true;
      this.ui.reshape = null;
      this.ui.selected = added.id;
      this.ui.placing = added.id;
      const more = this.state.bankedRolls.length > 0 ? ` ${this.state.bankedRolls.length} more choice${this.state.bankedRolls.length === 1 ? "" : "s"} wait in the Forge.` : "";
      this.say(`${META[candidate.type].name} added. Click a cell to place it; right-click keeps it in inventory.${more}`);
      this.render();
    }
  }

  cancelPlacing(): void {
    const id = this.ui.placing;
    this.ui.placing = null;
    if (id) {
      const module = this.state.modules.find((m) => m.id === id);
      if (module) {
        this.say(module.pos === null ? `${META[module.type].name} kept in inventory.` : `Move cancelled; ${META[module.type].name} stays deployed.`);
      }
    }
    this.render();
  }

  rightClickCell(pos: Hex): void {
    if (this.state.mode !== "upgrade") return;
    if (this.ui.reshape) return;
    if (this.ui.buyingCell) {
      this.cancelCellPurchase();
      return;
    }
    if (this.ui.placing) {
      this.cancelPlacing();
      return;
    }
    if (this.ui.managing) {
      const occupant = this.state.modules.find((m) => m.pos !== null && sameHex(m.pos, pos));
      if (occupant) this.returnToInventory(occupant.id);
    }
  }

  startManaging(): void {
    this.clearTransientUi();
    this.ui.managing = true;
    this.say("Arranging: drag the raised tiles between cells or into the inventory. Done or Esc finishes.");
    this.render();
  }

  stopManaging(): void {
    this.ui.managing = false;
    this.ui.placing = null;
    this.ui.reshape = null;
    this.render();
  }

  startReshape(): void {
    this.ui.reshape = { adds: [], removes: [] };
    this.ui.placing = null;
    this.ui.buyingCell = false;
    this.say("Reshape: click empty cells to remove them and frontier outlines to add. Removals and additions must balance.");
    this.render();
  }

  stageReshape(pos: Hex): void {
    const stage = this.ui.reshape;
    if (!stage) return;
    const inAdds = stage.adds.findIndex((c) => sameHex(c, pos));
    const inRemoves = stage.removes.findIndex((c) => sameHex(c, pos));
    if (inAdds !== -1) {
      stage.adds.splice(inAdds, 1);
    } else if (inRemoves !== -1) {
      stage.removes.splice(inRemoves, 1);
    } else if (this.state.cells.some((c) => sameHex(c, pos))) {
      const occupied = this.state.modules.some((m) => m.pos !== null && sameHex(m.pos, pos));
      if (occupied) {
        this.say("Only empty cells can be removed.");
        return;
      }
      stage.removes.push(pos);
    } else if (this.state.cells.some((c) => adjacent(c, pos)) || stage.adds.some((c) => adjacent(c, pos))) {
      stage.adds.push(pos);
    }
    this.render();
  }

  private stagedCells(): Hex[] | null {
    const stage = this.ui.reshape;
    if (!stage) return null;
    return this.state.cells
      .filter((c) => !stage.removes.some((r) => sameHex(r, c)))
      .concat(stage.adds);
  }

  reshapeValidity(): { ok: boolean; message: string } {
    const stage = this.ui.reshape;
    if (!stage) return { ok: false, message: "" };
    if (stage.adds.length === 0 && stage.removes.length === 0) {
      return { ok: false, message: "Click cells to stage removals and additions." };
    }
    if (stage.adds.length !== stage.removes.length) {
      return { ok: false, message: `Unbalanced: −${stage.removes.length} removed, +${stage.adds.length} added.` };
    }
    const next = this.stagedCells();
    if (!next) return { ok: false, message: "" };
    const keys = new Set(next.map((c) => `${c.q},${c.r}`));
    if (keys.size !== next.length) return { ok: false, message: "Duplicate cells staged." };
    const probe = structuredClone(this.state);
    const result = reshapeCells(probe, next);
    if (!result.ok) return { ok: false, message: result.reason ?? "Invalid shape." };
    return { ok: true, message: "Shape is valid and connected." };
  }

  applyReshape(): void {
    const next = this.stagedCells();
    if (!next) return;
    if (this.act(reshapeCells(this.state, next), "Board reshaped. Modules keep their positions.")) {
      this.ui.reshape = null;
    }
  }

  cancelReshape(): void {
    this.ui.reshape = null;
    this.render();
  }

  confirmGap(): void {
    const gap = this.state.pendingGap;
    if (gap) {
      const result = advance(this.state, gap.seconds);
      this.reportAdvance(result);
      this.say(`Confirmed ${Math.round(gap.seconds / 60)} minutes of practice. Flow continues.`);
    }
    this.state.pendingGap = null;
    this.ui.modal = null;
    this.lastWall = Date.now();
    this.save();
    this.render();
  }

  discardGap(): void {
    this.state.pendingGap = null;
    this.ui.modal = null;
    this.lastWall = Date.now();
    this.say("Interval discarded. That away time did not power the instrument.");
    this.save();
    this.render();
  }

  openModal(kind: ModalKind): void {
    this.ui.modal = kind;
    if (kind === "import") this.ui.importText = "";
    this.render();
  }

  closeModal(): void {
    if (this.ui.modal === "reconcile") return;
    this.ui.modal = null;
    this.ui.importError = null;
    this.render();
  }

  // Dev helpers (?dev=1): time-warp and fixtures for hands-on verification only.

  devAdvance(seconds: number): void {
    if (this.state.mode !== "flow") {
      this.say("Dev clock only works during flow.");
      return;
    }
    const result = advance(this.state, seconds);
    this.reportAdvance(result);
    this.say(`Dev clock +${seconds}s.`);
    this.render();
  }

  devToTarget(): void {
    const session = this.state.session;
    if (this.state.mode !== "flow" || !session || session.target === null) {
      this.say("No timed target running.");
      return;
    }
    this.devAdvance(Math.max(0, session.target - session.elapsed));
  }

  devNous(): void {
    this.state.nous += 100;
    this.state.totalEarned += 100;
    const minted = syncArete(this.state);
    this.say(minted > 0 ? "Dev: +100 ν. The accumulator filled — Arete minted." : "Dev: +100 ν.");
    this.render();
  }

  stats(): { nous: number } {
    return { nous: wholeNous(this.state) };
  }

  frontierCells(): Hex[] {
    const { state } = this;
    const out: Hex[] = [];
    const seen = (h: Hex) => state.cells.some((c) => sameHex(c, h)) || out.some((c) => sameHex(c, h));
    for (const cell of state.cells) {
      for (const n of neighbors(cell)) {
        if (!seen(n)) out.push(n);
      }
    }
    return out;
  }

  render(): void {
    render(this);
    document.body.classList.toggle("live", this.state.mode === "flow");
    // Arranging is unmistakable: the body-level class drives the banner,
    // dimmed cells, and raised tiles. It can only be on while the grid is
    // unlocked.
    document.body.classList.toggle("managing", this.managing);
    // Same visibility contract for the armed cell purchase (ADR-0013).
    document.body.classList.toggle("buying", this.ui.buyingCell && this.state.mode === "upgrade");
    if (this.ui.buyingCell && this.state.mode === "upgrade") {
      const hint = document.getElementById("buy-banner-hint");
      const price = cellCost(this.state.cellsBought);
      // The armed purchase is an upgrade-mode surface: the price counts down
      // in practice minutes when it is out of reach (§7).
      const countdown = practiceCountdown(price, wholeNous(this.state), computeRates(this.state, true).rate);
      const text = `Choose a hex touching your board — the new cell costs ${formatInt(price)} ν${countdown ? ` · ${countdown}` : ""}`;
      if (hint && hint.textContent !== text) hint.textContent = text;
    }
  }
}
