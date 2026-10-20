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
    { id: "m1", type: "additive", tier: 0 },
    { id: "m2", type: "spacer", tier: 0 },
    { id: "m3", type: "infusor", tier: 2 },
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
  it("describes carried tiers and shows their acquired effects", () => {
    app.openModal("forge");
    const pick = panel().querySelector('[data-choice="m3"]')!;
    expect(pick.getAttribute("aria-label")).toBe("Take common Booster · Tier III");
    const tile = pick.closest(".candidate-tile")!;
    // The tile shows the inventory's simple mark; the tier reads in the
    // name and the acquired effect in the readout beneath.
    expect(tile.querySelector(".module-preview svg")).not.toBeNull();
    expect(tile.querySelector(".candidate-effect")?.textContent).toContain("+45%");
    (pick as HTMLButtonElement).click();
    expect(app.state.modules.find(m => m.type === "infusor")?.tier).toBe(2);
  });

  it("names the generator designs and quotes their profile effect lines (issue #371)", () => {
    // The Forge panel presents the newest banked roll.
    app.state.bankedRolls.push({ id: "generator-roll", candidates: [
      { id: "g1", type: "focusKeyed", tier: 0 },
      { id: "g2", type: "noteKeyed", tier: 0 },
      { id: "g3", type: "goalKeyed", tier: 0 },
    ] });
    app.openModal("forge");
    switchTo("modules");
    const line = (id: string) => panel().querySelector(`[data-choice="${id}"]`)!.closest(".candidate-tile")!.querySelector(".candidate-effect")!.textContent!;
    expect(line("g1")).toContain("+0.1");
    expect(line("g1")).toContain("modest note and goal credit");
    expect(line("g2")).toContain("+30");
    expect(line("g2")).toContain("≥20 chars");
    expect(line("g2")).toContain("+1/char (300 max/note)");
    expect(line("g3")).toContain("+30");
    expect(line("g3")).toContain("charge");
    expect(line("g3")).toContain("/live goal minute at completion");
    expect(line("g3")).toContain("modest practice and note credit");
    // The named designs' labels ride the tiles' accessible names.
    expect(panel().querySelector('[data-choice="g1"]')!.getAttribute("aria-label")).toBe("Take common Flywheel · Tier I");
    expect(panel().querySelector('[data-choice="g2"]')!.getAttribute("aria-label")).toBe("Take common Scribe · Tier I");
    expect(panel().querySelector('[data-choice="g3"]')!.getAttribute("aria-label")).toBe("Take common Milestone · Tier I");
  });

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
    app.state.forge.progress = 30;
    app.render();
    expect(document.activeElement).toBe(choice);
    expect(panel().querySelector('[data-live="modal-forge-pip"]')?.getAttribute("style")).toBe("width:50.0%");
    expect(panel().querySelector('[data-live="modal-forge-line"]')?.textContent).toBe("30 / 60");
    expect(panel().querySelector(".gbar")).toBeNull();
  });

  it("mints only the active draft; the batch walks both queues and closes when dry", () => {
    app.openModal("forge");
    switchTo("mutators");
    panel().querySelector<HTMLButtonElement>('[data-mut-choice="u2"]')!.click();
    expect(app.state.bankedMutatorRolls).toHaveLength(0);
    expect(app.state.bankedRolls).toHaveLength(1);
    expect(app.state.mutators.at(-1)?.family).toBe("charge");
    // The mint lands unplaced — pick-and-place is retired — and the
    // emptied branch hands the visit to the one with rolls left.
    expect(app.state.mutators.at(-1)?.pos ?? null).toBeNull();
    expect(app.ui.modal).toBe("forge");
    expect(app.ui.forgeFace).toBe("modules");
    expect(app.ui.placing).toBeNull();
    panel().querySelector<HTMLButtonElement>('[data-choice="m1"]')!.click();
    expect(app.state.bankedRolls).toHaveLength(0);
    expect(app.state.modules.at(-1)?.pos ?? null).toBeNull();
    // Both queues dry: the batch visit ends and the Forge dismisses itself.
    expect(app.ui.modal).toBeNull();
    expect(app.ui.placing).toBeNull();
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
    // The standing landing: the mutator roll still waits, so the visit
    // walks to its face and keeps the peek.
    expect(app.state.bankedMutatorRolls).toHaveLength(1);
    expect(app.ui.modal).toBe("forge");
    expect(app.ui.forgeFace).toBe("mutators");
  });

  it("discloses pitch, chords, and both roll types in their effects", () => {
    app.state.bankedRolls[0].candidates = [
      { id: "pitch", type: "harmonizer", tier: 0 },
      { id: "module", type: "forge", tier: 0 },
      { id: "mutator", type: "mutatorForge", tier: 0 },
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
