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

  it("legacy queues and flags cannot expose a Mutator branch or inflate the Forge badge", () => {
    app.ui.boardLayer = "modules";
    app.openModal("forge");
    expect(panel().querySelectorAll("[data-choice]")).toHaveLength(3);
    expect(panel().querySelectorAll("[data-mut-choice]")).toHaveLength(0);
    expect([...panel().querySelectorAll("[data-forge-face]")].map(b => b.getAttribute("data-forge-face"))).toEqual(["modules"]);
    expect(panel().querySelector('[data-live="modal-mutator-line"]')).toBeNull();
    expect(document.querySelector('[data-op="forge"] .tool-badge')?.textContent).toBe("1");
  });

  it("an empty ordinary queue never falls back to pending legacy rolls", () => {
    app.state.bankedRolls = [];
    app.openModal("forge");
    expect(app.ui.forgeFace).toBe("modules");
    expect(panel().textContent).toContain("No module rolls banked.");
    expect(panel().textContent).not.toMatch(/Mutator|mutator/);
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

  it("ordinary picks close when dry despite retained legacy queues", () => {
    app.openModal("forge");
    panel().querySelector<HTMLButtonElement>('[data-choice="m1"]')!.click();
    expect(app.state.bankedRolls).toHaveLength(0);
    expect(app.state.modules.at(-1)?.pos ?? null).toBeNull();
    expect(app.state.mutators).toHaveLength(0);
    expect(app.state.bankedMutatorRolls).toHaveLength(1);
    expect(app.ui.modal).toBeNull();
    expect(app.ui.placing).toBeNull();
  });

  it("opens the section Charge reference without choosing and returns to the same draft", () => {
    app.openModal("forge");
    expect(panel().querySelector('[aria-label="charge — what it means"]')).toBeNull();
    const trigger = panel().querySelector<HTMLButtonElement>('#forge-about-charge')!;
    expect(trigger.closest("[data-choice], [data-mut-choice]")).toBeNull();
    trigger.focus(); trigger.click();
    expect(panel().textContent).toContain("Illustrative example");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(app.ui.modal).toBe("forge");
    expect(document.activeElement?.id).toBe("forge-about-charge");
    expect(app.state.bankedRolls).toHaveLength(1);
    expect(app.state.bankedMutatorRolls).toHaveLength(1);
    panel().querySelector<HTMLButtonElement>('[data-choice="m1"]')!.click();
    expect(app.state.bankedRolls).toHaveLength(0);
    // Retained legacy rolls do not keep the visit open.
    expect(app.state.bankedMutatorRolls).toHaveLength(1);
    expect(app.ui.modal).toBeNull();
    expect(app.ui.forgeFace).toBe("modules");
  });

  it("discloses live effects without presenting a retained Mutator Forge candidate", () => {
    app.state.bankedRolls[0].candidates = [
      { id: "pitch", type: "harmonizer", tier: 0 },
      { id: "module", type: "forge", tier: 0 },
      { id: "mutator", type: "mutatorForge", tier: 0 },
    ];
    app.openModal("forge");
    const terms = [...panel().querySelectorAll(".candidate-effect .term-trigger")].map(t => t.textContent);
    expect(terms).toEqual(["pitch", "chords", "module rolls"]);
    expect(panel().querySelector("#forge-about-charge")).not.toBeNull();
    expect(panel().querySelector('[data-choice="mutator"]')).toBeNull();
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
