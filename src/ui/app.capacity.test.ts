// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { App } from "./app";
import { BALANCE, isVoiceType } from "../engine/constants";
import { STORAGE_KEY } from "../engine/save";
import { ARETE_HORIZON } from "../engine/accumulator";
import { startSession } from "../engine/actions";
import { displayedRates, allocateRates, projectPlacement } from "../engine/economy";
import { give } from "../engine/fixtures";
import * as allocation from "../engine/allocation";
import { hex, sameHex } from "../engine/hex";
import { formatNumber } from "./format";
import { createAppFixture, clickCell } from "./testing/app-fixture";

// capacity rendering and interaction on the production HTML skeleton.
const fixture = createAppFixture();
const boot = fixture.boot;
let app: App;

beforeEach(() => {
  localStorage.clear();
  app = boot();
});
afterEach(() => fixture.release());

describe("the dev allocation board (#257)", () => {
  afterEach(() => vi.unstubAllGlobals());

  class StressWorker {
    static latest: StressWorker;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    terminate = vi.fn();
    postMessage = vi.fn();
    constructor() { StressWorker.latest = this; }
    send(data: unknown): void { this.onmessage?.({ data } as MessageEvent); }
  }

  const openBoard = (): App => {
    const devApp = boot(undefined, true);
    devApp.devToggleBoard();
    return devApp;
  };
  const solverLine = (): string => document.querySelector('[data-dev="solver"]')!.textContent!;
  const rateLine = (): string => document.querySelector('#dev-board [data-dev="rate"]')!.textContent!;
  const voiceRow = (id: string): HTMLElement => document.querySelector(`[data-devvoice="${id}"]`)!;
  const scenarioVoiceIds = (devApp: App): string[] =>
    devApp.devBoard!.scenario.modules.filter((m) => m.pos !== null && isVoiceType(m.type)).map((m) => m.id);

  it("opens dev-only, through the real rate path, with capacity and certification reads", () => {
    const devApp = openBoard();
    expect(document.getElementById("dev-board")).not.toBeNull();
    // The rate is a real snapshot figure through the allocation seam.
    expect(rateLine()).toMatch(/ν\/s$/);
    // The solver line reads instances, candidates, timing, certification.
    expect(solverLine()).toMatch(/cands/);
    expect(solverLine()).toMatch(/certified/);
    // Every voice row carries used/available capacity and a final ν/s.
    for (const id of scenarioVoiceIds(devApp)) {
      const row = voiceRow(id);
      expect(row.querySelector(".dev-cap")!.textContent).toMatch(/^(\d)\/(\d)$/);
    }
    devApp.devToggleBoard();
    expect(document.getElementById("dev-board")).toBeNull();
    // Non-dev boots never see the board.
    app.render();
    expect(document.getElementById("dev-board")).toBeNull();
    app.devToggleBoard();
    expect(document.getElementById("dev-board")).toBeNull();
  });

  it("changing capacity changes the active set through the whole-chord budget", () => {
    const devApp = openBoard();
    const reads = (board: App): { instances: string[]; maxUsed: number } => {
      const result = board.devBoardResult()!;
      return {
        instances: result.read.instances.map((i) => i.key),
        maxUsed: Math.max(...[...result.read.used.values()]),
      };
    };
    devApp.devBoardSetCapacity(1);
    const atOne = reads(devApp);
    devApp.devBoardSetCapacity(5);
    const atFive = reads(devApp);
    // Capacity 1 never exceeds any voice's budget; capacity 5 activates a
    // strictly richer web of instances on the same board.
    expect(atOne.maxUsed).toBeLessThanOrEqual(1);
    expect(atFive.instances.length).toBeGreaterThan(atOne.instances.length);
    expect(atFive.maxUsed).toBeGreaterThan(1);
    // The panel's instance chips follow.
    expect(document.querySelectorAll(".dev-instance").length).toBe(atFive.instances.length);
  });

  it("changing a voice's power recomputes its actual final production", () => {
    const devApp = openBoard();
    devApp.devBoardSetCapacity(2);
    const ids = scenarioVoiceIds(devApp);
    // Pick the loudest voice — its ν/s must rise with power.
    let target = ids[0]!;
    let best = -1;
    for (const id of ids) {
      const row = voiceRow(id);
      if (!row.textContent!.includes("harm")) {
        const value = Number(row.querySelector(".dev-value")!.textContent!.replace(/[^0-9.]/g, ""));
        if (value > best) {
          best = value;
          target = id;
        }
      }
    }
    devApp.devBoardSelect(target);
    devApp.devBoardPower(3);
    const after = Number(voiceRow(target).querySelector(".dev-value")!.textContent!.replace(/[^0-9.]/g, ""));
    expect(after).toBeGreaterThan(best);
  });

  it("moving a voice recomputes the active chords", () => {
    const devApp = openBoard();
    devApp.devBoardSetCapacity(2);
    const before = devApp.devBoardResult()!;
    const moved = devApp.devBoard!.scenario.modules.find(
      (m) => m.pos !== null && m.type === "additive" && m.pos.q === 1,
    )!;
    devApp.devBoardSelect(moved.id);
    // Formation two's dyad has a free cell beside it.
    devApp.devBoardMoveTo(1, 3);
    const after = devApp.devBoardResult()!;
    expect(after.read.instances.map((i) => i.key)).not.toEqual(before.read.instances.map((i) => i.key));
    // And the readout path still sums: the rate is the figures' sum.
    let sum = 0;
    for (const contribution of after.snapshot.contributions.values()) {
      if (contribution.type === "additive" || contribution.type === "blaster") sum += contribution.value;
    }
    expect(sum).toBeCloseTo(after.snapshot.rate, 9);
  });

  it("retains its active set across a change that returns the board to equal output", () => {
    const devApp = openBoard();
    devApp.devBoardSetCapacity(2);
    const first = devApp.devBoardResult()!;
    // Power up and back down: the board lands on identical weights, so the
    // solver faces its own previous optimum as one equal-output tie — and
    // retains it (the hint advanced at each mutation).
    const aVoice = scenarioVoiceIds(devApp)[0]!;
    devApp.devBoardSelect(aVoice);
    devApp.devBoardPower(1);
    devApp.devBoardPower(-1);
    const again = devApp.devBoardResult()!;
    expect(again.read.instances.map((i) => i.key)).toEqual(first.read.instances.map((i) => i.key));
  });

  it("reset rebuilds the deterministic scenario", () => {
    const devApp = openBoard();
    const first = devApp.devBoardResult()!;
    devApp.devBoardSetCapacity(3);
    devApp.devBoardSelect(scenarioVoiceIds(devApp)[0]!);
    devApp.devBoardPower(4);
    devApp.devBoardReset();
    expect(devApp.devBoard!.capacity).toBe(1);
    const after = devApp.devBoardResult()!;
    expect(after.read.instances.map((i) => i.key)).toEqual(first.read.instances.map((i) => i.key));
  });

  it("exposes module identity and keeps selection and keyboard focus across recomputation", () => {
    openBoard();
    const cell = document.querySelector<HTMLButtonElement>('[data-devcell="0,0"]')!;
    expect(cell.getAttribute("aria-label")).toBe("Oscillator at C4");
    expect(cell.querySelector("svg .tile-glyph")).not.toBeNull();
    cell.focus();
    cell.click();
    expect(document.activeElement?.getAttribute("data-devcell")).toBe("0,0");
    expect(document.activeElement?.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector('.dev-voice.picked')?.getAttribute("aria-pressed")).toBe("true");
    document.querySelector<HTMLButtonElement>('[data-devcap="5"]')!.click();
    expect(document.querySelector('[data-devcap="5"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector('[data-devcap="1"]')?.getAttribute("aria-pressed")).toBe("false");
  });

  it("streams stress results while board controls remain usable, and ignores cancelled work", () => {
    vi.stubGlobal("Worker", StressWorker);
    const devApp = openBoard();
    devApp.devBoardStress();
    const worker = StressWorker.latest;
    expect(worker.postMessage).toHaveBeenCalledOnce();
    expect(devApp.devBoard!.stressRunning).toBe(true);
    devApp.devBoardSetCapacity(3);
    expect(devApp.devBoard!.capacity).toBe(3);
    const row = { fixture: "triads-6", voices: 6, capacity: 1, clusters: 1, candidates: 15, instances: 2, certified: true, ms: 5, value: 1 };
    worker.send({ row });
    expect(document.querySelector('.dev-board-stress')?.textContent).toContain("triads-6");
    expect(devApp.devBoard!.stress).toHaveLength(1);
    devApp.devBoardStress(); // The running button cancels.
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(devApp.devBoard!.stressRunning).toBe(false);
    worker.send({ row });
    expect(devApp.devBoard!.stress).toHaveLength(1);
    devApp.devBoardStress();
    const next = StressWorker.latest;
    devApp.devToggleBoard();
    expect(next.terminate).toHaveBeenCalledOnce();
    devApp.devToggleBoard();
    next.send({ row });
    expect(devApp.devBoard!.stress).toBeNull();
  });

  it("finishes or reports failed stress workers and allows retry", () => {
    vi.stubGlobal("Worker", StressWorker);
    const devApp = openBoard();
    devApp.devBoardStress();
    StressWorker.latest.send({ done: true });
    expect(devApp.devBoard!.stressRunning).toBe(false);
    expect(StressWorker.latest.terminate).toHaveBeenCalledOnce();
    devApp.devBoardStress();
    StressWorker.latest.onerror!();
    expect(devApp.devBoard!.stressRunning).toBe(false);
    expect(document.querySelector('#dev-board [role="alert"]')?.textContent).toContain("Try again");
    devApp.devBoardStress();
    expect(devApp.devBoard!.stressError).toBeNull();
    devApp.devBoardReset();
    expect(StressWorker.latest.terminate).toHaveBeenCalledOnce();
  });
});

describe("the one-capacity economy on the board (#258)", () => {
  beforeEach(() => { app = boot(undefined, true); });
  const readout = () => document.getElementById("chord-readout") as HTMLElement;

  it("ordinary reloads ride the allocation engine and show the capacity readout, even after a dev save", () => {
    const fifth = give(app.state, "additive", null);
    app.pickCellThenPlace(fifth.id, hex(1, 0));
    const octave = give(app.state, "additive", null);
    app.pickCellThenPlace(octave.id, hex(0, 1));
    app.save();
    app = boot();
    expect(app.dev).toBe(false);
    // The allocation pass is the production path since the release
    // calibration (#262): the display twin matches it, not the uncapped
    // pass.
    expect(displayedRates(app.state, true)).toEqual(allocateRates(app.state, true).snapshot);
    document.querySelector('[data-cell="0,0"]')!.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(readout().textContent).toContain("(1/1)");
    app.openModal("rate");
    // The sheet carries no capacity leg — the used/available read stays
    // local to the reserved readout and Hex detail (issue #334's roster).
    expect(document.getElementById("modal-content")!.textContent).not.toContain("Capacity");
    app.closeModal();
    app.openModal("library");
    expect(document.querySelector("#modal-content .chord-count")!.textContent).toContain("×1");
  });

  it("uncertified development results are named on the board and in rate details", () => {
    const solve = allocation.allocateChords;
    const spy = vi.spyOn(allocation, "allocateChords").mockImplementation((singers, spacers, opts) =>
      solve(singers, spacers, { ...opts, budget: { maxNodes: 0, maxMs: Infinity } }),
    );
    try {
      give(app.state, "additive", hex(1, 0));
      app.render();
      document.querySelector('[data-cell="0,0"]')!.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
      expect(readout().textContent).toContain("Allocation uncertified");
      app.openModal("rate");
      const sheet = document.getElementById("modal-content")!;
      const status = sheet.querySelector<HTMLElement>(".rd-allocation-state")!;
      expect(status.hidden).toBe(false);
      const trigger = status.querySelector<HTMLButtonElement>(".inst-tip-trigger")!;
      trigger.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      const tip = document.getElementById(trigger.getAttribute("aria-describedby")!)!;
      expect(tip.classList.contains("inst-show")).toBe(true);
      expect(tip.textContent).toContain("maximum production is unproven");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(tip.classList.contains("inst-show")).toBe(false);
      spy.mockRestore();
      app.render();
      expect(readout().textContent).not.toContain("Allocation uncertified");
      expect(status.hidden).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it("the hover ask survives a capacity-driven chord replacement; the readout follows the new set", () => {
    // C4 · G4 earns the Fifth. Moving the G up an octave breaks it: at
    // capacity one the pair can sing the Fifth or the Octave, never both —
    // the active set replaces, and a fresh ask reads the new whole chord
    // with no stale claim.
    give(app.state, "additive", hex(1, 0));
    app.render();
    const ask = () => {
      document.querySelector('[data-cell="0,0"]')!.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
      return readout().textContent;
    };
    expect(ask()).toContain("(1/1)");
    expect(ask()).toContain("Fifth ×1.3");
    const g = app.state.modules.find((m) => m.pos !== null && sameHex(m.pos, hex(1, 0)))!;
    app.state.cells.push(hex(0, 1));
    g.pos = hex(0, 1);
    app.render();
    expect(ask()).toContain("(1/1)");
    expect(ask()).toContain("Octave ×1.15");
    expect(readout().textContent).not.toContain("Fifth");
    expect(readout().textContent).not.toContain("idle");
  });

  it("the library counts the singing class's standing instances and demotes them when the chord breaks (#258, #278)", () => {
    // The placement runs the real action boundary: the discovery lands,
    // and the sheet's index counts the class's standing instance. Returning
    // the module breaks the chord — discovered stays, the count goes.
    const tray = give(app.state, "additive", null);
    app.pickCellThenPlace(tray.id, hex(1, 0));
    app.render();
    app.openModal("library");
    let sheet = document.getElementById("modal-content")!;
    const count = sheet.querySelector(".chord-count")!;
    expect(count.textContent).toContain("×1");
    expect(count.querySelector(".chord-pip")).not.toBeNull();
    app.closeModal();
    app.returnToInventory(tray.id);
    app.openModal("library");
    sheet = document.getElementById("modal-content")!;
    expect(sheet.querySelector(".chord-count")).toBeNull();
  });

  it("the allocation rides the real save/reload path deterministically", () => {
    give(app.state, "additive", hex(1, 0));
    app.render();
    const saved = localStorage.getItem(STORAGE_KEY)!;
    expect(saved).toContain("activeChords");
    const rebooted = boot(undefined, true);
    rebooted.render();
    expect(rebooted.state.activeChords).toEqual(app.state.activeChords);
  });
});

describe("placement previews with capacity-aware production (#260)", () => {
  beforeEach(() => { app = boot(undefined, true); });
  const readout = () => document.getElementById("chord-readout") as HTMLElement;
  const chips = () => [...readout().querySelectorAll(".chord-readout-chip")].map((chip) => chip.textContent);
  const cell = (q: number, r: number) => document.querySelector(`[data-cell="${q},${r}"]`)!;
  const ghostLabels = () =>
    [...document.querySelectorAll(".ghost-mark .chord-label")].map((node) => node.textContent);
  // The delta chip's exact contract: signed, rounded at the readout's own
  // precision — pinned here so the preview's lead figure cannot drift.
  const deltaText = (projection: ReturnType<typeof projectPlacement>): string => {
    const rounded = Math.round((projection.projected.rate - projection.current.rate) * 100) / 100;
    if (Math.abs(rounded) < 0.005) return "±0";
    return rounded > 0 ? `+${formatNumber(rounded)}` : `-${formatNumber(Math.abs(rounded))}`;
  };

  it("an armed placement previews the projected board: figures, delta, and the quality scale", () => {
    // C4 · G4 earns the Fifth at capacity one. Hovering the armed tray
    // synth over C5 projects the whole board through the same allocation
    // that commits the drop — the Fifth holds, the newcomer's Octave and
    // doubled Fifth stay idle, and the preview says so, discovery legs
    // included.
    give(app.state, "additive", hex(1, 0));
    app.state.cells.push(hex(0, 1));
    const traySynth = give(app.state, "additive", null);
    app.render();
    const projection = projectPlacement(app.state, traySynth.id, hex(0, 1), false);
    document.querySelector<HTMLButtonElement>(`[data-inv="${traySynth.id}"]`)!.click();
    expect(app.ui.placing).toBe(traySynth.id);
    cell(0, 1).dispatchEvent(new MouseEvent("pointerenter", { bubbles: true }));
    expect(app.ui.dropHover).toEqual({ moduleId: traySynth.id, pos: hex(0, 1) });
    expect(readout().hidden).toBe(false);
    expect(projection.projected.rate).toBeGreaterThan(projection.current.rate);
    expect(chips()).toEqual([
      `Placement ${deltaText(projection)} ν/s`,
      `+${formatNumber(projection.projected.contributions.get(traySynth.id)!.value)} ν/s`,
      "Capacity 0/1",
      "×1",
      "Fifth ×1.3 · idle",
      "Octave ×1.15 · idle",
    ]);
    // The applied formation term is absent — the placed voice carries no
    // active chord — but the formation's measured quality still reads on
    // the low-to-high scale, marker at the measurement.
    const scale = readout().querySelector<HTMLElement>(".chord-readout-scale")!;
    expect(scale).not.toBeNull();
    expect(scale.getAttribute("data-q")).toBe(String(1 + BALANCE.allocationComplexityRate));
    expect(readout().querySelector(".scale-marker")).not.toBeNull();
    // The plain scale keeps its measured quality accessible even when
    // there is no applied formation chip and no disclosure button.
    expect(scale.getAttribute("role")).toBe("img");
    expect(scale.getAttribute("aria-label")).toContain(`this formation measures ×${formatNumber(1 + BALANCE.allocationComplexityRate)}`);
    expect(scale.getAttribute("aria-label")).toContain("×1 neutral");
    expect(readout().querySelector("button, .inst-tip")).toBeNull();
    // The preview is transient: leaving the cell restores the readout and
    // the board never moved.
    cell(0, 1).dispatchEvent(new MouseEvent("pointerleave", { bubbles: true }));
    expect(app.ui.dropHover).toBeNull();
    expect(readout().hidden).toBe(true);
    expect(traySynth.pos).toBeNull();
    // Esc cancels the arm the same way.
    cell(0, 1).dispatchEvent(new MouseEvent("pointerenter", { bubbles: true }));
    expect(readout().hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(app.ui.placing).toBeNull();
    expect(readout().hidden).toBe(true);
  });

  it("the committed placement agrees with the preview; hover summarizes and Hex detail retains the figures", () => {
    give(app.state, "additive", hex(1, 0));
    app.state.cells.push(hex(0, 1));
    const traySynth = give(app.state, "additive", null);
    app.render();
    document.querySelector<HTMLButtonElement>(`[data-inv="${traySynth.id}"]`)!.click();
    cell(0, 1).dispatchEvent(new MouseEvent("pointerenter", { bubbles: true }));
    const previewed = chips().slice(1); // the projected voice row, past the delta chip
    expect(previewed.length).toBeGreaterThan(0);
    const before = displayedRates(app.state, true).rate;
    clickCell(0, 1);
    expect(traySynth.pos).toEqual(hex(0, 1));
    // The board delivered the projected rate, the commit's discovery beat
    // included — the projection and the landing are one economy.
    expect(displayedRates(app.state, true).rate).toBeGreaterThan(before);
    // Hover carries the compact result; opening Hex detail retains the
    // complete projected chord facts, including measured quality.
    cell(0, 1).dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(chips()).toEqual([previewed[0], "(0/1) ", "2 idle"]);
    expect(readout().querySelector(".chord-readout-scale")).toBeNull();
    expect(readout().querySelector(".chord-readout-factor")).toBeNull();
    clickCell(0, 1);
    const detail = document.getElementById("hex-detail")!;
    const detailed = [...detail.querySelectorAll(".chord-readout-chip")].map((chip) => chip.textContent);
    expect(detailed).toEqual(previewed.slice(1));
    expect(detail.querySelector(".chord-readout-scale")!.getAttribute("data-q"))
      .toBe(String(1 + BALANCE.allocationComplexityRate));
  });

  it("ghost promises classify by the projected allocation — idle says idle", () => {
    // The C5 drop's newcomers (the Octave and the doubled Fifth) both sit
    // idle at capacity one: the ghosts say so, in the dotted quiet
    // register with "· idle" on their chips.
    give(app.state, "additive", hex(1, 0));
    app.state.cells.push(hex(0, 1));
    const traySynth = give(app.state, "additive", null);
    app.render();
    document.querySelector<HTMLButtonElement>(`[data-inv="${traySynth.id}"]`)!.click();
    cell(0, 1).dispatchEvent(new MouseEvent("pointerenter", { bubbles: true }));
    expect(ghostLabels().sort()).toEqual(["Fifth ×1.3 ×2 · idle", "Octave ×1.15 · idle"]);
    expect(document.querySelectorAll(".ghost-mark.chord-idle")).toHaveLength(2);
    // A promise the capacity can afford stays an earning promise: the
    // lone C4's Fifth previews without the idle word.
    app = boot(undefined, true);
    const tray = give(app.state, "additive", null);
    app.render();
    document.querySelector<HTMLButtonElement>(`[data-inv="${tray.id}"]`)!.click();
    cell(1, 0).dispatchEvent(new MouseEvent("pointerenter", { bubbles: true }));
    expect(ghostLabels()).toEqual(["Fifth ×1.3"]);
    expect(document.querySelectorAll(".ghost-mark.chord-idle")).toHaveLength(0);
  });

  it("a capacity-driven replacement previews honestly and commits without stale claims", () => {
    // C4 · G4 earns the Fifth. Dropping a B♭ beside C4 (a wire bridging
    // the gap) offers the Flat seventh the shared voice's one unit wants
    // more: the preview names the replacement, and the commit leaves the
    // displaced Fifth an idle claim — never a stale active one beside it.
    give(app.state, "additive", hex(1, 0));
    app.state.cells.push(hex(-1, 0), hex(-2, 0));
    give(app.state, "spacer", hex(-1, 0));
    const traySynth = give(app.state, "additive", null);
    app.render();
    const before = displayedRates(app.state, true).rate;
    document.querySelector<HTMLButtonElement>(`[data-inv="${traySynth.id}"]`)!.click();
    cell(-2, 0).dispatchEvent(new MouseEvent("pointerenter", { bubbles: true }));
    // The newcomer earns: its ghost promises without the idle word.
    expect(ghostLabels()).toEqual(["Flat seventh ×1.45"]);
    const projection = projectPlacement(app.state, traySynth.id, hex(-2, 0), false);
    expect(projection.projected.rate).toBeGreaterThan(projection.current.rate);
    const q3 = 1 + 2 * BALANCE.allocationComplexityRate;
    // The moved voice's row: it earns the ♭7's whole term. The displaced
    // Fifth is G4's idle candidate — the commit's assertions below read it
    // there, where it belongs.
    expect(chips()).toEqual([
      `Placement ${deltaText(projection)} ν/s`,
      `+${formatNumber(projection.projected.contributions.get(traySynth.id)!.value)} ν/s`,
      "Capacity 1/1",
      `×${formatNumber((1 + 0.45) * q3)}`,
      `Formation ×${formatNumber(q3)}`,
      "Flat seventh ×1.45",
    ]);
    const scale = readout().querySelector<HTMLElement>(".chord-readout-scale")!;
    expect(scale.getAttribute("data-q")).toBe(String(q3));
    // Commit: the ♭7 takes C4's unit, the Fifth demotes to idle, and no
    // surface claims the Fifth twice.
    clickCell(-2, 0);
    expect(traySynth.pos).toEqual(hex(-2, 0));
    expect(displayedRates(app.state, true).rate).toBeGreaterThan(before);
    const snapshot = displayedRates(app.state, true);
    expect(snapshot.allocation!.active.map((instance) => instance.name)).toEqual(["Flat seventh"]);
    document.querySelector('[data-cell="1,0"]')!.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(readout().textContent).toContain("1 idle");
    expect(chips().filter((chip) => chip === "Fifth ×1.3")).toHaveLength(0);
    expect(document.querySelectorAll('[data-key="chord-marks"] .chord-idle')).toHaveLength(1);
  });

  it("a drag over the tray previews the retrieval, and the drop delivers it", () => {
    give(app.state, "additive", hex(1, 0));
    app.render();
    const g4 = app.state.modules.find((m) => m.pos !== null && sameHex(m.pos, hex(1, 0)))!;
    const before = displayedRates(app.state, true).rate;
    const zone = document.getElementById("inventory-zone")!;
    document.elementFromPoint = () => zone;
    try {
      cell(1, 0).dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
      document.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 100 }));
      expect(app.ui.dropHover).toEqual({ moduleId: g4.id, pos: null });
      expect(readout().hidden).toBe(false);
      // The board loses the Fifth: the delta says so, the departing voice
      // reads zero, and nothing would form.
      expect(chips()[0]).toBe(`Placement -${formatNumber(before - 0.1)} ν/s`);
      expect(chips()).toContain("+0 ν/s");
      expect(chips()).toContain("Capacity 0/1");
      expect(ghostLabels()).toEqual([]);
      document.dispatchEvent(new MouseEvent("pointerup", { clientX: 130, clientY: 110 }));
      expect(g4.pos).toBeNull();
      expect(displayedRates(app.state, true).rate).toBeCloseTo(0.1, 9);
      expect(app.ui.dropHover).toBeNull();
    } finally {
      delete (document as unknown as { elementFromPoint?: unknown }).elementFromPoint;
    }
  });

  it("a matching twin drag offers combination without a swap preview", () => {
    give(app.state, "additive", hex(1, 0));
    app.render();
    document.elementFromPoint = () => cell(1, 0);
    try {
      cell(0, 0).dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
      document.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 100 }));
      expect(document.querySelector(".drop-combine")).not.toBeNull();
      expect(readout().querySelector(".chord-readout-preview")).toBeNull();
      expect(ghostLabels()).toEqual([]);
      document.dispatchEvent(new MouseEvent("pointerup", { clientX: 130, clientY: 100 }));
      expect(document.getElementById("modal-content")!.textContent).toContain("Combine");
    } finally {
      delete (document as unknown as { elementFromPoint?: unknown }).elementFromPoint;
    }
  });

  it("the placement preview reads plain: figures without disclosures, cancellation untouched (#334)", () => {
    give(app.state, "additive", hex(1, 0));
    const mover = give(app.state, "additive", null);
    app.render();
    document.querySelector<HTMLButtonElement>(`[data-inv="${mover.id}"]`)!.click();
    cell(0, 1).dispatchEvent(new MouseEvent("pointerenter", { bubbles: true }));
    // The transient readout carries no interactive terms at all — every
    // figure is a plain chip, and no hover cue promises a disclosure that
    // isn't there. Escape still cancels the arm beneath the plain reads.
    expect(readout().querySelector("button, .inst-tip, .readout-tip-trigger")).toBeNull();
    expect(app.ui.placing).toBe(mover.id);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(app.ui.placing).toBeNull();
    expect(readout().hidden).toBe(true);
  });

  it("a placement costs no open detail (#260's contract over the Hex detail)", () => {
    give(app.state, "additive", hex(1, 0));
    app.state.cells.push(hex(0, 1), hex(2, 0));
    give(app.state, "additive", hex(2, 0));
    app.render();
    const d4 = app.state.modules.find((m) => m.pos !== null && sameHex(m.pos, hex(2, 0)))!;
    // The C4 detail stands.
    clickCell(0, 0);
    expect(app.ui.detail).toEqual({ pos: hex(0, 0), face: "modules" });
    // Drag D4 onto C5: the placement lands, and the C4 detail is untouched
    // — a placement must not cost the player their inspection.
    document.elementFromPoint = () => cell(0, 1);
    try {
      cell(2, 0).dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
      document.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 100 }));
      document.dispatchEvent(new MouseEvent("pointerup", { clientX: 130, clientY: 110 }));
      expect(d4.pos).toEqual(hex(0, 1));
      expect(app.ui.detail).toEqual({ pos: hex(0, 0), face: "modules" });
      expect(!document.getElementById("hex-detail")!.hidden).toBe(true);
    } finally {
      delete (document as unknown as { elementFromPoint?: unknown }).elementFromPoint;
    }
  });
});

describe("the canvas-edge capacity read (#333)", () => {
  beforeEach(() => { app = boot(undefined, true); });
  const ledgerRead = (): string =>
    (document.querySelector("#board-ledger .ledger-capacity [data-live='capacity']") as HTMLElement).textContent!;
  const stripRead = (): string =>
    (document.querySelector("#game-info-strip .info-capacity [data-live='i-capacity']") as HTMLElement).textContent!;
  const askVoice = (q: number, r: number): string => {
    document.querySelector(`[data-cell="${q},${r}"]`)!.dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    return (document.getElementById("chord-readout") as HTMLElement).textContent ?? "";
  };

  it("the allowance reads at the canvas edge on the ledger and the phone strip", () => {
    // One ambient figure — the per-voice whole-chord allowance the
    // authoritative economy itself spends — live on both faces.
    expect(ledgerRead()).toBe("1");
    expect(stripRead()).toBe("1");
  });

  it.each([".ledger-capacity", ".info-capacity"])("%s discloses by focus and tap, dismisses, and survives live updates", (selector) => {
    const trigger = document.querySelector<HTMLButtonElement>(selector)!;
    const tip = () => document.getElementById(trigger.getAttribute("aria-describedby")!)!;
    expect(trigger.tagName).toBe("BUTTON");
    const name = () => trigger.getAttribute("aria-labelledby")!.split(" ").map((id) => document.getElementById(id)!.textContent).join(" ");
    expect(name()).toBe("Harmonic capacity 1");
    trigger.focus();
    expect(tip().classList.contains("inst-show")).toBe(true);
    expect(tip().textContent).toBe("Whole-chord budget per voice");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(tip().classList.contains("inst-show")).toBe(false);
    trigger.click();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    app.state.nous = 1_000_000;
    app.buyCapacityAction();
    expect(trigger.querySelector("b")!.textContent).toBe("2");
    expect(name()).toBe("Harmonic capacity 2");
    expect(tip().classList.contains("inst-show")).toBe(true);
    document.body.click();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(tip().classList.contains("inst-show")).toBe(false);
  });

  it("buying Poly Expander advances the ambient allowance and the selected-voice denominator; new voices inherit it", () => {
    give(app.state, "additive", hex(1, 0));
    app.state.nous = 1_000_000;
    app.buyCapacityAction();
    expect(app.state.capacityBought).toBe(1);
    expect(ledgerRead()).toBe("2");
    expect(stripRead()).toBe("2");
    // The C4·G4 Fifth spends one of G4's two units — the denominator moved
    // with the purchase, the used count stays the allocation's own.
    expect(askVoice(1, 0)).toContain("(1/2)");
    // A newly acquired voice receives the same allowance — the ladder is
    // board-wide by construction, never per-module. Placed alone, it has
    // sung nothing: 0 of the new 2.
    app.state.cells.push(hex(3, 1));
    give(app.state, "additive", hex(3, 1));
    app.render();
    expect(askVoice(3, 1)).toContain("(0/2)");
  });

  it("a purchase that cannot pay changes nothing; flow forbids the purchase", () => {
    app.state.nous = 1;
    app.buyCapacityAction();
    expect(app.state.capacityBought).toBe(0);
    expect(document.getElementById("status")!.textContent).toContain("Not enough");
    expect(ledgerRead()).toBe("1");
    startSession(app.state, null);
    app.state.nous = 1_000_000;
    app.buyCapacityAction();
    expect(app.state.capacityBought).toBe(0);
    expect(document.getElementById("status")!.textContent).toContain("between sessions");
    app.render();
    expect(ledgerRead()).toBe("1");
  });

  it("the ceiling holds the ambient allowance; an Expansion Bay opens the next rung", () => {
    app.state.capacityBought = 2;
    app.render();
    expect(ledgerRead()).toBe("3");
    app.state.nous = 1_000_000;
    app.buyCapacityAction();
    expect(app.state.capacityBought).toBe(2);
    expect(document.getElementById("status")!.textContent).toContain("capped");
    app.state.arete = 100;
    app.state.prestiges = 1;
    app.state.catalogEntryOwned = true;
    app.buyCapacityCeilingAction();
    expect(app.state.capacityCeilings).toBe(1);
    app.buyCapacityAction();
    expect(app.state.capacityBought).toBe(3);
    expect(ledgerRead()).toBe("4");
    expect(stripRead()).toBe("4");
  });

  it("the allowance rides the real save/reload path", () => {
    app.state.nous = 1_000_000;
    app.buyCapacityAction();
    expect(app.state.capacityBought).toBe(1);
    app = boot();
    expect(app.state.capacityBought).toBe(1);
    expect(ledgerRead()).toBe("2");
  });

  it("the arete reset returns the voices to one — the ambient read follows", () => {
    app.state.nous = 1_000_000;
    app.buyCapacityAction();
    expect(app.state.capacityBought).toBe(1);
    expect(ledgerRead()).toBe("2");
    app.state.eraEarned = ARETE_HORIZON;
    app.openPrestigeConfirm();
    document.querySelector<HTMLButtonElement>("#prestige-confirm")!.click();
    expect(app.state.capacityBought).toBe(0);
    app.render();
    expect(ledgerRead()).toBe("1");
    expect(stripRead()).toBe("1");
  });

  it("selected-voice usage stays accurate when allocation leaves capacity unused", () => {
    // One Fifth sung, capacity two: the voice shows 1/2 — used counts
    // instances, never the allowance's slack.
    give(app.state, "additive", hex(1, 0));
    app.state.nous = 1_000_000;
    app.buyCapacityAction();
    app.render();
    expect(askVoice(1, 0)).toContain("(1/2)");
  });
});

describe("solid chord paths (#333)", () => {
  beforeEach(() => { app = boot(undefined, true); });
  const marks = (): HTMLElement => document.querySelector('[data-key="chord-marks"]')!;

  it("an active chord involving a silent voice draws solid — the mute styling is retired", () => {
    // Capacity two lets both fifths sing: C4·G4 and G4·D5, the second
    // carrying the Harmonizer — a silent voice — as a full earning chord.
    app.state.cells.push(hex(2, 0));
    app.state.nous = 1_000_000;
    app.buyCapacityAction();
    expect(app.state.capacityBought).toBe(1);
    give(app.state, "additive", hex(1, 0));
    give(app.state, "harmonizer", hex(2, 0));
    app.render();
    const silent = app.state.modules.find((m) => m.type === "harmonizer")!.id;
    const withSilent = [...marks().querySelectorAll<HTMLElement>(".chord-mark")].filter((mark) =>
      (mark.getAttribute("data-voices") ?? "").split(" ").includes(silent),
    );
    expect(withSilent.length).toBeGreaterThan(0);
    for (const mark of withSilent) {
      expect(mark.classList.contains("chord-muted")).toBe(false);
      expect(mark.querySelectorAll(".chord-seam").length).toBeGreaterThan(0);
    }
    expect(document.querySelectorAll(".chord-muted")).toHaveLength(0);
  });

  it("idle candidates stay the board's only quiet paths — dotted and dim, never dashed by a silent voice", () => {
    // C4·G4 active; the C5 newcomer's Octave and doubled Fifth idle at
    // capacity one. Idle marks keep their class; nothing else is dimmed
    // by a silent voice, and the dashed mute rule is gone from the sheet.
    give(app.state, "additive", hex(1, 0));
    app.state.cells.push(hex(0, 1));
    give(app.state, "additive", hex(0, 1));
    app.render();
    expect(marks().querySelectorAll(".chord-idle").length).toBeGreaterThan(0);
    const active = [...marks().querySelectorAll<HTMLElement>(".chord-mark:not(.chord-idle)")];
    for (const mark of active) expect(mark.classList.contains("chord-muted")).toBe(false);
  });
});
