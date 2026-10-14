// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { App } from "./app";
import { createAppFixture } from "./testing/app-fixture";

const fixture = createAppFixture();
let app: App;
beforeEach(() => {
  app = fixture.boot();
  app.state.catalogEntryOwned = true;
  app.state.bankedRolls = [{ id: "module-roll", candidates: [
    { id: "m1", type: "additive", rarity: "common" },
    { id: "m2", type: "spacer", rarity: "common" },
    { id: "m3", type: "infusor", rarity: "rare" },
  ] }];
  app.state.bankedMutatorRolls = [{ id: "mutator-roll", candidates: [
    { id: "u1", family: "power", rarity: "common" },
    { id: "u2", family: "charge", rarity: "rare" },
  ] }];
});
afterEach(() => fixture.release());
const panel = () => document.getElementById("modal-content")!;
const switchTo = (face: string) => panel().querySelector<HTMLButtonElement>(`[data-forge-face="${face}"]`)!.click();

describe("Forge drafts (#335)", () => {
  it("opens on the board layer and switches without consuming either offer", () => {
    app.ui.mutLayer = "modules";
    app.openModal("forge");
    expect(panel().querySelectorAll("[data-choice]")).toHaveLength(3);
    expect(panel().querySelectorAll("[data-mut-choice]")).toHaveLength(0);
    expect([...panel().querySelectorAll("[data-forge-face]")].map(b => b.getAttribute("data-forge-face"))).toEqual(["mutators", "modules"]);
    switchTo("mutators");
    expect(panel().querySelectorAll("[data-choice]")).toHaveLength(0);
    expect(panel().querySelectorAll("[data-mut-choice]")).toHaveLength(2);
    expect(document.activeElement?.getAttribute("data-forge-face")).toBe("mutators");
    expect(app.state.bankedRolls).toHaveLength(1);
    expect(app.state.bankedMutatorRolls).toHaveLength(1);
    expect(panel().querySelector('[data-live="modal-flow-line"]')).toBeNull();
    expect(panel().querySelector('[data-live="modal-mutator-line"]')).not.toBeNull();
    expect(document.querySelector('[data-op="forge"] .tool-badge')?.textContent).toBe("2");
  });

  it("falls back only when opening, then preserves an intentionally empty branch", () => {
    app.state.bankedRolls = [];
    app.openModal("forge");
    expect(app.ui.forgeFace).toBe("mutators");
    switchTo("modules");
    app.render();
    expect(panel().textContent).toContain("No module rolls banked.");
    app.closeModal();
    app.openModal("forge");
    expect(app.ui.forgeFace).toBe("mutators");
  });

  it("keeps horizontal meters live without replacing focused choices", () => {
    app.openModal("forge");
    const choice = panel().querySelector<HTMLButtonElement>("[data-choice]")!;
    choice.focus();
    app.state.flow.progress = 90;
    app.render();
    expect(document.activeElement).toBe(choice);
    expect(panel().querySelector('[data-live="modal-flow-pip"]')?.getAttribute("style")).toBe("width:50.0%");
    expect(panel().querySelector('[data-live="modal-flow-line"]')?.textContent).toBe("1:30 / 3:00");
    expect(panel().querySelector(".gbar")).toBeNull();
  });

  it("mints only the active draft and retains the existing landing behavior", () => {
    app.openModal("forge");
    switchTo("mutators");
    panel().querySelector<HTMLButtonElement>('[data-mut-choice="u2"]')!.click();
    expect(app.state.bankedMutatorRolls).toHaveLength(0);
    expect(app.state.bankedRolls).toHaveLength(1);
    expect(app.state.mutators.at(-1)?.family).toBe("charge");
    expect(app.ui.modal).toBe("forge");
    expect(app.ui.forgeFace).toBe("mutators");
    switchTo("modules");
    panel().querySelector<HTMLButtonElement>('[data-choice="m1"]')!.click();
    expect(app.state.bankedRolls).toHaveLength(0);
    expect(app.ui.modal).toBeNull();
    expect(app.ui.placing).toBeTruthy();
  });

  it("opens effect definitions without choosing and dismisses them before the draft", () => {
    app.openModal("forge");
    const trigger = panel().querySelector<HTMLButtonElement>('.candidate-effect .term-trigger')!;
    expect(trigger.closest("[data-choice], [data-mut-choice]")).toBeNull();
    trigger.focus();
    const body = document.getElementById(trigger.getAttribute("aria-describedby")!)!;
    expect(body.classList.contains("inst-show")).toBe(true);
    expect(body.textContent).toBe("Generator output that powers other modules");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(body.classList.contains("inst-show")).toBe(false);
    expect(app.ui.modal).toBe("forge");
    trigger.click();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(app.state.bankedRolls).toHaveLength(1);
    expect(app.state.bankedMutatorRolls).toHaveLength(1);
    panel().querySelector<HTMLElement>(".forge-choice-cue")!.click();
    expect(body.classList.contains("inst-show")).toBe(false);
    panel().querySelector<HTMLButtonElement>('[data-choice="m1"]')!.click();
    expect(app.state.bankedRolls).toHaveLength(0);
    expect(app.ui.placing).toBeTruthy();
  });

  it("discloses pitch, chords, and both roll types in their effects", () => {
    app.state.bankedRolls[0].candidates = [
      { id: "pitch", type: "harmonizer", rarity: "common" },
      { id: "module", type: "forge", rarity: "common" },
      { id: "mutator", type: "mutatorForge", rarity: "common" },
    ];
    app.openModal("forge");
    const terms = [...panel().querySelectorAll(".candidate-effect .term-trigger")].map(t => t.textContent);
    expect(terms).toEqual(["pitch", "chords", "charge", "module rolls", "charge", "mutator rolls"]);
    expect(panel().querySelectorAll("button button")).toHaveLength(0);
  });

  it("Close and Escape keep both rolls banked", () => {
    app.openModal("forge");
    panel().querySelector<HTMLButtonElement>("#close-modal")!.click();
    expect(app.ui.modal).toBeNull();
    app.openModal("forge");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(app.ui.modal).toBeNull();
    expect(app.state.bankedRolls).toHaveLength(1);
    expect(app.state.bankedMutatorRolls).toHaveLength(1);
  });
});

describe("the draft choice's hit target", () => {
  it("the pick's hover guard mirrors the shared control's, so its coat never paints the face", () => {
    // The pick is a positioned overlay above the static face. The generic
    // button:hover:not(:disabled) coat is (0,2,1); a bare .candidate-pick:hover
    // override is (0,2,0) and loses — an opaque background then covers the hex
    // and the readout, leaving only the positioned glossary terms visible.
    const css = readFileSync("src/ui/style.css", "utf8");
    expect(css).toContain(".candidate-pick:hover:not(:disabled) { background: transparent; border-color: transparent; }");
  });
});
