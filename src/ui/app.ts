import { advance } from "../engine/advance";
import type { AdvanceResult } from "../engine/types";
import {
  buyStarter,
  chooseRoll,
  combine,
  endSession,
  pauseSession,
  placeCell,
  placeModule,
  reshapeCells,
  resumeSession,
  returnModule,
  startSession,
  upgradeModule,
  type ActionResult,
} from "../engine/actions";
import { chargeSecondsRemaining, deployedTime, isCore, wholeNous } from "../engine/economy";
import { adjacent, neighbors, sameHex } from "../engine/hex";
import { deserialize, serialize, STORAGE_KEY } from "../engine/save";
import { planTick } from "../engine/clock";
import { createInitialState } from "../engine/state";
import { writeNote } from "../engine/notes";
import type { GameState, Hex, StarterType } from "../engine/types";
import { render } from "./render";
import { META } from "./meta";

export type ModalKind = "settings" | "store" | "forge" | "export" | "import" | "reset" | "reconcile" | null;

export interface UiState {
  selected: string | null;
  placing: string | null | "cell";
  managing: boolean;
  reshape: { adds: Hex[]; removes: Hex[] } | null;
  modal: ModalKind;
  importText: string;
  importError: string | null;
  chosenTarget: number | null;
  showAcquired: boolean;
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
    placing: null,
    managing: false,
    reshape: null,
    modal: null,
    importText: "",
    importError: null,
    chosenTarget: 600,
    showAcquired: false,
  };
  lastWall: number | null = null;
  lastSaveWall = 0;
  dev: boolean;
  private els: Record<string, HTMLElement>;

  constructor(els: Record<string, HTMLElement>, dev: boolean) {
    this.els = els;
    this.dev = dev;
    const loaded = this.load();
    if (loaded) {
      this.resumeFromSave(loaded);
    } else {
      this.state = createInitialState();
    }
    this.bindGlobalEvents();
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
        this.say(`Could not load the local save: ${parsed.error}. A fresh instrument was created.`);
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

  importText(text: string): boolean {
    const parsed = parseSave(text);
    if ("error" in parsed) {
      this.ui.importError = parsed.error;
      this.render();
      return false;
    }
    this.ui.selected = null;
    this.ui.placing = null;
    this.ui.managing = false;
    this.ui.reshape = null;
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
    this.ui.selected = null;
    this.ui.placing = null;
    this.ui.managing = false;
    this.ui.reshape = null;
    this.ui.modal = null;
    this.ui.importError = null;
    this.ui.chosenTarget = 600;
    this.lastWall = null;
    this.say("A fresh instrument. Enter flow to begin your first practice.");
    this.save();
    this.render();
  }

  say(text: string): void {
    const el = this.els["status"];
    if (el) el.textContent = text;
  }

  greet(): void {
    if (this.state.sessionsCompleted === 0 && this.state.mode === "upgrade") {
      this.say("Welcome. Enter flow, practice for the ten-minute target, and let real work power the instrument.");
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
    window.setInterval(() => this.tick(), 500);
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
      const result = advance(this.state, plan.apply);
      this.reportAdvance(result);
    }
    this.lastWall = now;
    if (now - this.lastSaveWall > 5000) this.save(now);
    this.render();
  }

  private reportAdvance(result: AdvanceResult): void {
    const notes: string[] = [];
    if (result.storeOpened) notes.push("Timed target complete — the starter store and upgrades are open.");
    if (result.burstAwarded) notes.push("Completion burst earned: charge flows to adjacent modules.");
    if (result.rollsBanked > 0) notes.push(`${result.rollsBanked} forge ${result.rollsBanked === 1 ? "roll" : "rolls"} banked.`);
    if (result.cellsEarned > 0) notes.push(`${result.cellsEarned} new ${result.cellsEarned === 1 ? "cell" : "cells"} earned.`);
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
    const target = this.ui.chosenTarget;
    const started = this.act(
      startSession(this.state, target),
      target === null
        ? "Open-ended flow is live. Banked charge still works; no completion bonus."
        : `Flow is live for ${Math.round(target / 60)} minutes. Your layout is locked; the instrument takes care of itself.`,
    );
    if (started) {
      this.lastWall = Date.now();
      this.ui.managing = false;
      this.ui.placing = null;
      this.ui.selected = null;
    }
  }

  endFlow(): void {
    const firstSession = this.state.sessionIndex === 1;
    if (this.act(endSession(this.state), "")) {
      this.lastWall = null;
      // Read the bank after ending: session-end bursts (Notes) join Time's.
      const banked = chargeSecondsRemaining(this.state);
      if (firstSession) {
        this.say("First session complete — Time is now active. Its multiplier and completion bursts power your build.");
      } else if (banked > 0) {
        this.say(`Session ended. Earned nous is kept; ${Math.round(banked)}s of charge are banked for next time.`);
      } else {
        this.say("Session ended. Earned nous is kept. Arrange, upgrade, and begin again when ready.");
      }
    }
  }

  pause(): void {
    if (this.act(pauseSession(this.state), "Practice and charge are paused. Your layout stays locked.")) {
      this.lastWall = null;
    }
  }

  resume(): void {
    if (this.act(resumeSession(this.state), "Flow resumed.")) {
      this.lastWall = Date.now();
    }
  }

  buy(type: StarterType): void {
    if (this.act(buyStarter(this.state, type), `${META[type].name} purchased. Choose a cell for it.`)) {
      this.ui.modal = null;
      this.beginPlacing(this.state.modules[this.state.modules.length - 1]!.id);
    }
  }

  upgrade(id: string): void {
    const module = this.state.modules.find((m) => m.id === id);
    if (!module) return;
    const nextLevel = module.level + 1;
    this.act(upgradeModule(this.state, id), `${META[module.type].name} upgraded to level ${nextLevel}.`);
  }

  combinePair(id: string): void {
    const result = combine(this.state, id);
    if (result.ok) {
      this.say(
        result.refund && result.refund > 0
          ? `Combined into a stronger copy; ${result.refund} ν of the lower copy's upgrades refunded. Global progress is unchanged.`
          : "Combined into a stronger copy. Global progress is unchanged.",
      );
      this.save();
    } else {
      this.say(result.reason ?? "Cannot combine.");
    }
    this.render();
  }

  select(id: string | null): void {
    this.ui.selected = this.ui.selected === id ? null : id;
    this.ui.placing = null;
    this.render();
  }

  beginPlacing(id: string): void {
    this.ui.selected = id;
    this.ui.placing = id;
    this.say("Choose a cell. Occupied gameplay modules swap; a spare core replaces its matching core.");
    this.render();
  }

  beginCellPlacement(): void {
    this.ui.placing = "cell";
    this.ui.reshape = null;
    this.say("Choose an outlined position for the new cell.");
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
    if (ui.placing === "cell") {
      const result = placeCell(state, pos);
      this.act(result, "A new cell is ready. Place a module to put it to work.");
      if (state.cellTokens === 0) ui.placing = null;
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
    if (state.mode !== "upgrade" || this.ui.reshape) return;
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
      this.say("Noted. This session's practice counts toward the Notes burst.");
      this.save();
    } else {
      this.say(result.reason ?? "Cannot capture a note right now.");
    }
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
    if (id && id !== "cell") {
      const module = this.state.modules.find((m) => m.id === id);
      if (module) {
        this.say(module.pos === null ? `${META[module.type].name} kept in inventory.` : `Move cancelled; ${META[module.type].name} stays deployed.`);
      }
    } else {
      this.say("Cell placement cancelled.");
    }
    this.render();
  }

  rightClickCell(pos: Hex): void {
    if (this.state.mode !== "upgrade") return;
    if (this.ui.reshape) return;
    if (this.ui.placing) {
      this.cancelPlacing();
      return;
    }
    if (this.ui.managing) {
      const occupant = this.state.modules.find((m) => m.pos !== null && sameHex(m.pos, pos));
      if (occupant && !isCore(occupant)) this.returnToInventory(occupant.id);
    }
  }

  startManaging(): void {
    this.ui.managing = true;
    this.ui.selected = null;
    this.ui.placing = null;
    this.ui.reshape = null;
    this.say("Grid & inventory: drag modules between cells or into inventory.");
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
    if (kind === "store" && !this.state.storeOpened) {
      this.say("The store opens after your first completed timed target.");
      this.render();
      return;
    }
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

  devCharge(): void {
    const time = deployedTime(this.state);
    if (time && this.state.timeActive) {
      time.bursts.push({ strength: 1, seconds: 60 });
      this.say("Dev: granted 60s of strength-1 charge.");
      this.render();
    } else {
      this.say("No active Time module.");
    }
  }

  devNous(): void {
    this.state.nous += 100;
    this.state.totalEarned += 100;
    this.say("Dev: +100 ν.");
    this.render();
  }

  stats(): { charge: number; nous: number } {
    return { charge: chargeSecondsRemaining(this.state), nous: wholeNous(this.state) };
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
  }
}
