// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { App } from "./app";
import { STORAGE_KEY } from "../engine/save";
import { createAppFixture } from "./testing/app-fixture";

// The whole-workflow verification (issue #474, parent #465): one
// continuous thread across the five workflow stages — scenario selection,
// a configured scripted run, terminal interventions, historical
// curve/board inspection, and export/import — exercising the human entry
// points (the panel's controls through real DOM events) and the agent
// entry points (`window.__flowsynth` methods and the terminal's
// commands) on the same instruments. The parent's boundaries must hold
// across the whole thread, not only inside one stage: parity between the
// doors, the ordinary save untouched throughout, read-only recorded
// evidence, the walked preset's continuity, and the audit's controls
// still standing with their promised dispositions. The per-stage
// behavioral depth lives in the stage suites this file threads together
// (app.scenarios, app.playthrough, app.terminal, and the engine runner
// suites); the cases here walk one instrument through every seam.

const fixture = createAppFixture();
const boot = fixture.boot;

let app: App;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => { fixture.release(); vi.restoreAllMocks(); });

const scenarioNote = (): string => document.getElementById("dev-scenario-note")?.textContent ?? "";
const note = (): string => document.getElementById("dev-playthrough-note")?.textContent ?? "";
const terminalLog = (): string[] =>
  [...document.querySelectorAll("#dev-terminal-log .dev-terminal-line")].map((row) => row.textContent ?? "");

const clickDev = (key: string): void => {
  document.querySelector<HTMLButtonElement>(`[data-dev="${key}"]`)!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
};

// The human terminal door: type into the panel's input and press Enter.
function typeTerminal(command: string): string {
  const input = document.getElementById("dev-terminal") as HTMLInputElement;
  input.value = command;
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  return terminalLog().at(-1)!;
}

describe("the whole workflow through both entry points", () => {
  it("threads scenario selection, a configured run, interventions, historical inspection, and export/import", { timeout: 120_000 }, async () => {
    app = boot(undefined, true);
    const saved = localStorage.getItem(STORAGE_KEY);

    // ── Stage 1: scenario selection. The agent's catalog is the panel's
    // select; the Launch control drives the same launch command, and the
    // agent door re-confirms the assertion on the installed state.
    const select = document.getElementById("dev-scenario") as HTMLSelectElement;
    expect([...select.options].map((option) => option.value)).toEqual(app.devScenarios().map((scenario) => scenario.id));
    select.value = "fresh-start";
    clickDev("scenario");
    expect(app.devScenarioId).toBe("fresh-start");
    expect(scenarioNote()).toContain("Fresh start");
    expect(scenarioNote()).toContain("✓");
    expect(() => app.devScenarioAssert()).not.toThrow();

    // ── Stage 2: a configured scripted run. The panel's inputs compose
    // the same recipe the agent command takes: pushing policy, claim
    // target 2, seed 468, a one-day budget — an honest incomplete
    // outcome, never a fabricated bank.
    const policy = document.getElementById("dev-playthrough-policy") as HTMLSelectElement;
    policy.value = "pushing";
    (document.getElementById("dev-playthrough-target") as HTMLInputElement).value = "2";
    (document.getElementById("dev-playthrough-seed") as HTMLInputElement).value = "468";
    (document.getElementById("dev-playthrough-budget") as HTMLInputElement).value = "1";
    clickDev("playthrough");
    const panelRun = app.devPlaythrough!;
    expect(panelRun.policy.id).toBe("pushing");
    expect(panelRun.claimTarget).toBe(2);
    expect(panelRun.complete).toBe(false);
    expect(panelRun.stop.kind).toBe("budget");
    expect(panelRun.claims).toEqual([]);
    expect(note()).toBe(app.devPlaythroughNote);
    expect(note()).toContain("Pushing ✗");
    expect(note()).toContain("claim none/2 Arete");
    // The agent door, same declared inputs: identical composition and
    // outcomes, a distinct execution identity.
    const agentRun = app.devRunPlaythrough({ scenarioId: "fresh-start", policyId: "pushing", claimTarget: 2, seed: 468, budgetDays: 1 });
    expect(agentRun.runId).not.toBe(panelRun.runId);
    expect(agentRun.recipe).toEqual(panelRun.recipe);
    expect(agentRun.source).toEqual(panelRun.source);
    expect(agentRun.trajectory).toEqual(panelRun.trajectory);
    expect(agentRun.days).toBe(panelRun.days);
    expect(agentRun.stop).toEqual(panelRun.stop);
    const runs = document.getElementById("dev-runs") as HTMLSelectElement;
    expect(runs.options).toHaveLength(2);
    expect(runs.value).toBe(agentRun.runId);

    // ── Stage 3: interventions. The agent's terminal and the panel's
    // quick controls land in one intervention record on the installed
    // run; refusals record without earning the modified mark's company.
    expect(app.devTerminalRun("inspect")).toContain("fresh-start · mode upgrade");
    expect(app.devScenarioModified).toBe(false);
    clickDev("nous");
    expect(app.devScenarioModified).toBe(true);
    expect(typeTerminal("start 25")).toMatch(/^✓/);
    expect(app.state.mode).toBe("flow");
    expect(typeTerminal("advance 60")).toMatch(/^✓/);
    expect(typeTerminal("end")).toMatch(/^✓/);
    expect(app.state.mode).toBe("upgrade");
    const refusal = typeTerminal("prestige");
    expect(refusal).toBe("✗ The horizon is not reached yet.");
    expect(app.devInterventions.map((intervention) => intervention.label)).toEqual([
      "Dev grant — +100ν",
      "Start a 25-minute session",
      "Dev clock +60s",
      "End the session",
      "Prestige",
    ]);
    expect(app.devInterventions.at(-1)!.ok).toBe(false);
    expect(scenarioNote()).toContain("modified — 5 interventions");

    // ── Stage 4: historical inspection. The curves surface reads the
    // selected run; a plotted click and the shared command land on the
    // same exact recorded state; the board draws read-only.
    clickDev("curves");
    expect(app.devCurvesOpen).toBe(true);
    let curves = document.getElementById("dev-curves")!;
    expect(curves.textContent).toContain("RESOURCE CURVES");
    expect(curves.querySelectorAll("circle.dev-curves-pt")).toHaveLength(agentRun.trajectory.length);
    const point = agentRun.trajectory[3]!;
    curves.querySelectorAll("circle.dev-curves-pt")[3]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.devInspected).toBe(point.snapshot);
    curves = document.getElementById("dev-curves")!;
    expect(curves.textContent).toContain(`sample ${point.snapshot + 1}/${agentRun.snapshots.length} · sim `);
    const inspection = app.devInspectPlaythrough(point.snapshot)!;
    expect(inspection.elapsed).toBe(point.elapsed);
    expect(inspection.credited).toBe(point.credited);
    expect(inspection.rate).toBeCloseTo(point.rate, 9);
    expect(inspection.events.every((event) => event.snapshot <= point.snapshot)).toBe(true);
    // The history board draws the recorded layers and no live affordances.
    const board = document.querySelector(".dev-history-board")!;
    expect(board.querySelectorAll("[data-history-module]")).toHaveLength(inspection.state.cells.length);
    expect(board.querySelectorAll("[data-buy], [data-cell], [data-world-cell]")).toHaveLength(0);
    // Stepping and the keyboard-opened term disclosure.
    const count = agentRun.snapshots.length;
    document.getElementById("dev-curves")!.querySelector<HTMLButtonElement>('[data-devcurve="next"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.devInspected).toBe((point.snapshot + 1) % count);
    document.getElementById("dev-curves")!.querySelector<HTMLButtonElement>('[data-devcurve="prev"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.devInspected).toBe(point.snapshot);
    const term = document.querySelector<HTMLButtonElement>('.dev-curves-line2 [aria-label="nous — what it means"]')!;
    term.focus();
    expect(term.getAttribute("aria-expanded")).toBe("true");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(term.getAttribute("aria-expanded")).toBe("false");
    term.click();
    expect(term.getAttribute("aria-expanded")).toBe("true");
    // The evidence is frozen; inspection changed neither run nor save.
    expect(Object.isFrozen(inspection.state)).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);

    // ── Stage 5: export/import. The panel's controls and the terminal's
    // verbs ride the same artifact commands the agent methods call.
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    clickDev("export-run");
    expect(anchorClick).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]![0] as Blob;
    const downloaded = JSON.parse(await blob.text()) as Record<string, unknown>;
    expect(downloaded.format).toBe("flowsynth-playthrough");
    expect(downloaded.runId).toBe(agentRun.runId);
    // The human import door: the same artifact through the file picker.
    const input = document.getElementById("dev-import-file") as HTMLInputElement;
    const file = new File([app.devExportPlaythrough()], "run.json", { type: "application/json" });
    Object.defineProperty(input, "files", {
      configurable: true,
      value: { 0: file, length: 1, item: (index: number) => (index === 0 ? file : null) },
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(app.devResults.find((result) => result.record.runId === agentRun.runId)!.imported).toBe(true);
    expect(app.devSelectedRunId).toBe(agentRun.runId);
    expect(note()).toContain("Imported · ");
    // The agent door: the terminal's receipts over the same library.
    expect(app.devTerminalRun("runs")).toContain(`${agentRun.runId} ✗ imported`);
    expect(app.devTerminalRun("export")).toContain(`✓ exported ${agentRun.runId}`);
    expect(app.devTerminalRun(`select ${panelRun.runId}`)).toBe(app.devPlaythroughNote);
    expect(app.devSelectedRunId).toBe(panelRun.runId);
    expect(app.devTerminalRun(`import ${app.devExportPlaythrough()}`)).toContain("✓ imported —");
    expect(app.devResults[0]!.imported).toBe(true);
    // The whole thread left the ordinary save byte-identical.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
  });
});

describe("the walked preset rides the same workflow", () => {
  it("installs with its walked record, marks interventions on it, and carries it through artifacts and continuation", { timeout: 240_000 }, async () => {
    app = boot(undefined, true);
    const saved = localStorage.getItem(STORAGE_KEY);
    // The agent door launches the checkpoint preset; the walk lands its
    // own walked record as the library's selected result.
    await app.devLaunchScenario("approaching-prestige", Date.UTC(2026, 0, 20, 9));
    const walked = app.devPlaythrough!;
    expect(app.devScenarioId).toBe("approaching-prestige");
    expect(walked.stop.kind).toBe("checkpoint");
    expect(walked.state.prestiges).toBe(0);
    expect(app.devResults).toHaveLength(1);
    expect(app.devResults[0]!.modified).toBe(false);
    expect(app.devResults[0]!.imported).toBe(false);
    expect(scenarioNote()).toContain("Approaching prestige ✓");
    expect(() => app.devScenarioAssert()).not.toThrow();

    // Curves read the walked record and name where it came from.
    app.devToggleCurves();
    let curves = document.getElementById("dev-curves")!;
    expect(curves.textContent).toContain(walked.runId);
    expect(curves.querySelector(".dev-curves-prov")!.textContent).toContain("walked here");
    const index = Math.floor(walked.trajectory.length / 2);
    const point = walked.trajectory[index]!;
    curves.querySelectorAll("circle.dev-curves-pt")[index]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.devInspected).toBe(point.snapshot);
    const inspection = app.devInspectPlaythrough(point.snapshot)!;
    expect(inspection.balances.prestiges).toBe(0);
    expect(inspection.balances.eraEarned).toBe(point.eraEarned);

    // One intervention marks the walked record's library entry: altered
    // evidence never reads as baseline.
    app.devNous();
    expect(app.devScenarioModified).toBe(true);
    expect(app.devResults[0]!.modified).toBe(true);
    expect(app.devResults[0]!.interventions).toHaveLength(1);
    expect(scenarioNote()).toContain("modified — 1 intervention");
    curves = document.getElementById("dev-curves")!;
    expect(curves.querySelector(".dev-curves-prov")!.textContent).toContain("modified — 1 intervention");
    // The artifact carries the checkpoint stop and the modified status.
    const artifact = app.devExportPlaythrough();
    const parsed = JSON.parse(artifact) as Record<string, unknown>;
    expect(parsed.modified).toBe(true);
    expect((parsed.record as { stop: { kind: string } }).stop.kind).toBe("checkpoint");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);

    // A fresh browser reopens the checkpoint evidence as carried. (A dev
    // boot writes its own opening save at once — the ordinary save's
    // baseline here is that write, and the workflow must not alter it.)
    app.dispose();
    const fresh = boot(undefined, true);
    const freshBaseline = localStorage.getItem(STORAGE_KEY);
    fresh.devImportPlaythrough(artifact);
    expect(fresh.devPlaythrough!.stop.kind).toBe("checkpoint");
    expect(fresh.devResults[0]!.modified).toBe(true);
    expect(fresh.devResults[0]!.interventions).toHaveLength(1);
    const reopened = fresh.devInspectPlaythrough(0)!;
    expect(reopened.state.prestiges).toBe(0);

    // Continuations start from the walked state through the same command,
    // each its own identified record. The prompt policy meets the
    // preset's open door at its first between-sessions moment and banks
    // the honest zero-Arete claim; the pushing policy holds the door and
    // plays real sessions instead.
    const promptContinuation = fresh.devRunPlaythrough({ scenarioId: "approaching-prestige", budgetDays: 1 });
    expect(promptContinuation.runId.startsWith("approaching-prestige-s468-")).toBe(true);
    expect(promptContinuation.complete).toBe(true);
    expect(promptContinuation.stop.kind).toBe("prestige");
    expect(promptContinuation.claims).toEqual([0]);
    expect(promptContinuation.state.prestiges).toBe(1);
    const continuation = fresh.devRunPlaythrough({ scenarioId: "approaching-prestige", policyId: "pushing", claimTarget: 2, budgetDays: 1 });
    expect(continuation.runId.startsWith("approaching-prestige-s468-")).toBe(true);
    expect(continuation.claims).toEqual([]);
    expect(continuation.state.sessionRecords.length).toBeGreaterThan(walked.state.sessionRecords.length);
    expect(continuation.state.prestiges).toBe(0);
    expect(fresh.devResults).toHaveLength(3);
    const carried = fresh.devResults.find((result) => result.record.runId === walked.runId)!;
    expect(carried.record.events).toEqual(walked.events);
    expect(carried.modified).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(freshBaseline);
  });
});

describe("the existing-control audit's reconciliation", () => {
  it("keeps every audited control on the final panel with its promised save tier", () => {
    app = boot(undefined, true);
    // The audited inventory (docs/dev-controls-audit.md) stands on the
    // final panel: minute jumps, the timed-target jump, both quick
    // grants, the World setup, the allocation board, curves, and the
    // ADR-0050 grip.
    for (const key of ["60", "600", "target", "nous", "synth", "worldera", "board", "curves"]) {
      expect(document.querySelector(`[data-dev="${key}"]`), key).toBeTruthy();
    }
    expect(document.getElementById("dev-grip")).toBeTruthy();
    // ADR-0077's two tiers on one control: +100ν with no run installed
    // is the live-save quick grant — written to the ordinary save at
    // once, the audit's repair — and no intervention exists to record.
    const before = localStorage.getItem(STORAGE_KEY);
    clickDev("nous");
    expect(app.state.nous).toBe(112);
    expect(localStorage.getItem(STORAGE_KEY)).not.toBe(before);
    expect(app.devScenarioModified).toBe(false);
    expect(app.devInterventions).toHaveLength(0);
    // With a run installed the same control is an intervention on the
    // isolated run, and the ordinary save's bytes stay exactly as they were.
    app.devLaunchScenario("fresh-start");
    expect(app.state.nous).toBe(12);
    const isolatedBytes = localStorage.getItem(STORAGE_KEY);
    clickDev("nous");
    expect(app.state.nous).toBe(112);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(isolatedBytes);
    expect(app.devInterventions.map((intervention) => intervention.label)).toEqual(["Dev grant — +100ν"]);
    expect(app.devScenarioModified).toBe(true);
  });

  it("keeps the Focus scenario and the allocation laboratory available per their recorded dispositions", () => {
    app = boot(undefined, true);
    // Focus setup: retained, reachable through the suite entry, its
    // assertion re-confirming on demand.
    app.devLaunchScenario("focus");
    expect(app.devScenarioId).toBe("focus");
    expect(scenarioNote()).toContain("Focus");
    expect(scenarioNote()).toContain("✓");
    expect(() => app.devScenarioAssert()).not.toThrow();
    // Allocation laboratory: retained (ADR-0051), opening its
    // deterministic scenario through the real rate path, never saved.
    app.devToggleBoard();
    const board = document.getElementById("dev-board")!;
    expect(board.querySelectorAll("[data-devcap]")).toHaveLength(5);
    expect(board.textContent).toContain("certified");
    app.devToggleBoard();
    expect(document.getElementById("dev-board")).toBeNull();
  });
});
