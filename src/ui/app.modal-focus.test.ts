// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { App } from "./app";
import { startSession, endSession } from "../engine/actions";
import { advance } from "../engine/advance";
import { createAppFixture } from "./testing/app-fixture";

// Modal focus management for every dialog (issue #346): focus moves into a
// dialog when it opens, Tab cycles within the blocking ones, and every
// dismissal — Escape, the close control, a completed action — hands focus
// back to the control that invoked it. The scrimless surfaces (the Forge
// peek, the tray sheet) declare the background interactive and stay
// outside the ring, but their open and dismissal still manage focus. The
// Notes dialog's own suite (app.notes.test.ts) pins its composer landing
// and door return.
const fixture = createAppFixture();
let app: App;

beforeEach(() => {
  localStorage.clear();
  app = fixture.boot();
});

afterEach(() => fixture.release());

const backdrop = () => document.getElementById("modal")!;
const sheet = () => document.getElementById("modal-content")!;
const gear = () => document.getElementById("console-settings")!;
const dockTool = (op: string) =>
  document.querySelector<HTMLButtonElement>(`#board-tools [data-op="${op}"]`)!;

function pressEscape(): void {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

function tab(shift = false): void {
  sheet().dispatchEvent(
    new KeyboardEvent("keydown", { key: "Tab", shiftKey: shift, bubbles: true, cancelable: true }),
  );
}

// The trap's own ring, mirrored: every control a Tab walk could reach.
function ring(content: HTMLElement): HTMLElement[] {
  return [...content.querySelectorAll<HTMLElement>(
    "button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
  )].filter((el) => !el.closest("[hidden]"));
}

describe("a blocking dialog's focus round trip (#346)", () => {
  it("settings opens with focus inside, Tab cycles both ways, and Escape and ✕ return it to the gear", () => {
    gear().focus();
    app.openModal("settings");
    expect(backdrop().hidden).toBe(false);
    expect(sheet().contains(document.activeElement)).toBe(true);
    const controls = ring(sheet());
    const [first, last] = [controls[0]!, controls[controls.length - 1]!];
    // Forward from the last control wraps to the first.
    last.focus();
    tab();
    expect(document.activeElement).toBe(first);
    // Backward from the first wraps to the last.
    first.focus();
    tab(true);
    expect(document.activeElement).toBe(last);
    // Escape returns to the gear.
    pressEscape();
    expect(app.ui.modal).toBeNull();
    expect(document.activeElement).toBe(gear());
    // So does the ✕ control.
    app.openModal("settings");
    sheet().querySelector<HTMLButtonElement>("#close-modal")!.click();
    expect(app.ui.modal).toBeNull();
    expect(document.activeElement).toBe(gear());
  });

  it("a step from settings to export keeps the gear as the return address, not a control the step replaced", () => {
    gear().focus();
    app.openModal("settings");
    const walk = sheet().querySelector<HTMLButtonElement>("#settings-export")!;
    walk.focus();
    walk.click();
    expect(app.ui.modal).toBe("export");
    pressEscape();
    expect(app.ui.modal).toBeNull();
    expect(document.activeElement).toBe(gear());
  });

  it("import dismisses by Escape from the paste box, and a completed import returns to the gear", () => {
    gear().focus();
    app.openModal("settings");
    sheet().querySelector<HTMLButtonElement>("#settings-import")!.click();
    const box = document.getElementById("import-text") as HTMLTextAreaElement;
    box.focus();
    box.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(app.ui.modal).toBeNull();
    expect(document.activeElement).toBe(gear());
    // A completed import is a dismissal too: the save lands, focus returns.
    gear().focus();
    app.openModal("settings");
    sheet().querySelector<HTMLButtonElement>("#settings-import")!.click();
    (document.getElementById("import-text") as HTMLTextAreaElement).value = app.exportText();
    document.querySelector<HTMLButtonElement>("#import-apply")!.click();
    expect(app.ui.modal).toBeNull();
    expect(document.activeElement).toBe(gear());
  });

  it("confirming the erase returns to the gear", () => {
    gear().focus();
    app.openModal("settings");
    sheet().querySelector<HTMLButtonElement>("#settings-reset")!.click();
    expect(app.ui.modal).toBe("reset");
    document.querySelector<HTMLButtonElement>("#reset-confirm")!.click();
    expect(app.ui.modal).toBeNull();
    expect(document.activeElement).toBe(gear());
  });

  it("catalog: the dock tool's return address survives the renders that replaced it", () => {
    dockTool("catalog").focus();
    app.openModal("catalog");
    expect(sheet().contains(document.activeElement)).toBe(true);
    // Renders that rebuild the dock replace the invoking node; the return
    // falls back to the fresh control with the same id.
    app.ui.buyingCell = true;
    app.render();
    app.ui.buyingCell = false;
    app.render();
    expect(dockTool("catalog").id).toBe("board-tools-tool-catalog");
    pressEscape();
    expect(app.ui.modal).toBeNull();
    expect(document.activeElement).toBe(dockTool("catalog"));
  });

  it("achievements: the ledger chip returns focus on dismissal", () => {
    const chip = document.getElementById("feats-chip")!;
    chip.focus();
    chip.click();
    expect(app.ui.modal).toBe("achievements");
    pressEscape();
    expect(app.ui.modal).toBeNull();
    expect(document.activeElement).toBe(chip);
  });

  it("rate: the ledger cell's sheet returns focus to the cell", () => {
    const cell = document.getElementById("rate-cell")!;
    cell.focus();
    cell.click();
    expect(app.ui.modal).toBe("rate");
    pressEscape();
    expect(app.ui.modal).toBeNull();
    expect(document.activeElement).toBe(cell);
  });

  it("collection: the thumb-bar segment returns focus on dismissal", () => {
    const segment = document.querySelector<HTMLButtonElement>('#thumb-bar [data-op="collection"]')!;
    segment.focus();
    segment.click();
    expect(app.ui.modal).toBe("collection");
    pressEscape();
    expect(app.ui.modal).toBeNull();
    expect(document.activeElement).toBe(document.querySelector('#thumb-bar [data-op="collection"]'));
  });
});

describe("the scrimless surfaces manage focus without claiming the screen", () => {
  // One banked roll to open the Forge with.
  const bankRoll = (): void => {
    app.state.sessionsCompleted = 1;
    app.state.bankedRolls.push({
      id: "roll1",
      candidates: [
        { id: "rc1", type: "additive", tier: 0 },
        { id: "rc2", type: "spacer", tier: 0 },
        { id: "rc3", type: "infusor", tier: 1 },
      ],
    });
  };

  it("forge: focus lands inside, but Tab is not caged — the peek never claims the screen", () => {
    bankRoll();
    dockTool("forge").focus();
    app.openModal("forge");
    expect(backdrop().getAttribute("aria-modal")).toBe("false");
    expect(sheet().contains(document.activeElement)).toBe(true);
    // No ring: Tab at an edge walks on, exactly as the pointer does — the
    // close control keeps no private cycle.
    const close = sheet().querySelector<HTMLButtonElement>("#close-modal")!;
    close.focus();
    tab();
    expect(document.activeElement).toBe(close);
    // Escape hands focus back to the tool.
    pressEscape();
    expect(app.ui.modal).toBeNull();
    expect(document.activeElement).toBe(dockTool("forge"));
  });

  it("forge: taking the last roll is a dismissal — focus returns to the tool", () => {
    bankRoll();
    dockTool("forge").focus();
    app.openModal("forge");
    sheet().querySelector<HTMLButtonElement>("[data-choice]")!.click();
    // One banked roll, both queues dry after the pick: the batch visit
    // ends and the Forge dismisses itself, unplaced mint included.
    expect(app.ui.modal).toBeNull();
    expect(app.ui.placing).toBeNull();
    expect(document.activeElement).toBe(dockTool("forge"));
  });
});

describe("the programmatic dialogs and the dissolved review", () => {
  it("the honesty report is non-dismissible: Escape leaves it standing with focus inside", () => {
    app.ui.modal = "honesty";
    app.render();
    const choice = sheet().querySelector<HTMLButtonElement>("[data-honesty]")!;
    choice.focus();
    pressEscape();
    expect(app.ui.modal).toBe("honesty");
    expect(document.activeElement).toBe(choice);
  });

  it("the summary presents without a return address; its dismissal strands nobody inside", () => {
    const s = app.state;
    s.sessionsCompleted = 1;
    startSession(s, 600);
    advance(s, 60);
    endSession(s);
    app.ui.modal = "summary";
    app.render();
    expect(sheet().contains(document.activeElement)).toBe(true);
    document.getElementById("summary-continue")!.click();
    expect(app.ui.modal).toBeNull();
    expect(backdrop().hidden).toBe(true);
    expect(sheet().contains(document.activeElement)).toBe(false);
  });

  it("a combine review whose pair dissolved under it never strands focus", () => {
    const base = app.state.modules[0]!;
    app.state.modules.push({ ...base, id: "twin" });
    gear().focus();
    app.offerCombine(base.id, "twin");
    // The review stood; a mode flip dissolved the pair out from under it.
    expect(app.ui.modal).toBe("combine");
    app.state.mode = "flow";
    app.render();
    expect(app.ui.modal).toBeNull();
    expect(document.activeElement).toBe(gear());
  });
});

describe("dialog dismissal regressions", () => {
  it.each(["pref-confirm", "pref-mute"])("Escape from settings %s returns to the gear", (id) => {
    gear().focus();
    app.openModal("settings");
    const control = document.getElementById(id)!;
    control.focus();
    control.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(app.ui.modal).toBeNull();
    expect(document.activeElement).toBe(gear());
  });

  it("Escape from the export text returns to the gear", () => {
    gear().focus();
    app.openModal("settings");
    document.getElementById("settings-export")!.click();
    const control = document.getElementById("export-text")!;
    control.focus();
    control.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(app.ui.modal).toBeNull();
    expect(document.activeElement).toBe(gear());
  });

  it("Escape from the catalog checkbox returns to the dock", () => {
    dockTool("catalog").focus();
    app.openModal("catalog");
    const control = document.getElementById("catalog-show-acquired")!;
    control.focus();
    control.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(app.ui.modal).toBeNull();
    expect(document.activeElement).toBe(dockTool("catalog"));
  });

  it.each(["summary-continue", "summary-reflection-text", "summary-reflection-slider"])(
    "a keyboard session exit returns to its switch after dismissal from %s", (id) => {
      startSession(app.state, 600);
      advance(app.state, 60);
      app.render();
      const exit = document.getElementById("flow-switch")!;
      exit.focus();
      exit.click();
      expect(app.ui.modal).toBe("summary");
      const control = document.getElementById(id)!;
      control.focus();
      if (id === "summary-continue") control.click();
      else control.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      expect(app.ui.modal).toBeNull();
      expect(document.activeElement).toBe(document.getElementById("flow-switch"));
    },
  );

  it("honesty → summary retains the exit switch as its return address", () => {
    startSession(app.state, 600);
    advance(app.state, 60);
    app.state.session!.accounting.poolSeconds = 30;
    app.render();
    const exit = document.getElementById("flow-switch")!;
    exit.focus();
    exit.click();
    expect(app.ui.modal).toBe("honesty");
    const answer = document.querySelector<HTMLButtonElement>('[data-honesty="missed"]')!;
    answer.focus();
    answer.click();
    expect(app.ui.modal).toBe("summary");
    document.getElementById("summary-continue")!.click();
    expect(document.activeElement).toBe(document.getElementById("flow-switch"));
  });

  it("closing a dialog hides its portaled tooltip before removing its trigger", () => {
    gear().focus();
    app.openModal("settings");
    const trigger = sheet().querySelector<HTMLButtonElement>(".inst-tip-trigger")!;
    trigger.focus();
    trigger.click();
    const tooltip = document.getElementById(trigger.getAttribute("aria-describedby")!)!;
    expect(tooltip.parentElement).toBe(document.body);
    expect(tooltip.classList.contains("inst-show")).toBe(true);
    document.getElementById("close-modal")!.click();
    expect(tooltip.classList.contains("inst-show")).toBe(false);
    expect(document.activeElement).toBe(gear());
  });
});
