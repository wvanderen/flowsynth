// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { App } from "./app";
import { createAppFixture } from "./testing/app-fixture";
import { combineMutatorsPreview } from "../engine/actions";
import { BALANCE } from "../engine/constants";
import { hex, sameHex } from "../engine/hex";
import { serialize, STORAGE_KEY } from "../engine/save";
import { createInitialState, createModule } from "../engine/state";
import type { GameState, Hex, MutatorFamily, MutatorInstance, Rarity } from "../engine/types";

// The Mutator Grid's UI (issue #199): the vertical layer legend (issue
// #295), the second layer's slot faces and presence outlines, the tray
// strip, the gestures, the unlock arm, and the rolls — booted on the real
// index.html skeleton, every landing routed through the engine actions
// from #198. The idle slot click opens the Hex detail (issue #295), the
// declaration having moved there.

const fixture = createAppFixture();
const boot = fixture.boot;

let app: App;

function mut(id: string, family: MutatorFamily, rarity: Rarity, pos: Hex | null): MutatorInstance {
  return { id, family, rarity, pos };
}

// An era past the entry: three slots on the opening footprint, a placed
// power mutator hosting the opening synth, its combine twin in the tray,
// and a second placed mutator on a hostless cell.
function seedMutatorEra(): void {
  const s = app.state;
  s.mode = "upgrade";
  s.catalogEntryOwned = true;
  s.arete = 20;
  s.mutatorSlots = [hex(0, 0), hex(1, 0)];
  s.mutators = [
    mut("mu1", "power", "common", hex(0, 0)),
    mut("mu2", "power", "common", null),
    mut("mu3", "charge", "uncommon", hex(1, 0)),
  ];
  app.render();
}

function slotNode(q: number, r: number): SVGGElement {
  return document.querySelector(`[data-mut-slot="${q},${r}"]`)!;
}

// The seed plus the board facts the layer-ownership test needs: a second
// voice an octave up (a formed chord's seam), a keyed generator and its
// adjacent amplifier (a charge lead), and two further owned cells — one
// hosting the generator, one left empty.
function seedBoardFacts(): void {
  seedMutatorEra();
  const s = app.state;
  s.cells.push(hex(2, 0), hex(3, 0));
  const voice = createModule(s, "additive");
  voice.pos = hex(0, 1);
  const receiver = createModule(s, "amplifier");
  receiver.pos = hex(1, 0);
  const generator = createModule(s, "focusKeyed");
  generator.pos = hex(2, 0);
  s.modules.push(voice, receiver, generator);
  app.render();
}

function unlockNode(q: number, r: number): SVGGElement {
  return document.querySelector(`[data-mut-unlock="${q},${r}"]`)!;
}

function clickSlot(q: number, r: number): void {
  slotNode(q, r).dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function rightClickSlot(q: number, r: number): void {
  slotNode(q, r).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
}

function mutatorOf(s: GameState, id: string): MutatorInstance {
  return s.mutators.find((m) => m.id === id)!;
}

beforeEach(() => {
  localStorage.clear();
  app = boot();
});

afterEach(() => fixture.release());

describe("the vertical layer legend (issue #295)", () => {
  it("the locked symbol carries its mechanics on its own tooltip — no ⓘ disclosure rides strip or sheet (issue #314 review)", () => {
    const checkLegend = (host: HTMLElement) => {
      // The tooltip doctrine cuts: the padlock's native title says the
      // lock mechanic; a second disclosure would restate it.
      expect(host.querySelector(".inst-tip-trigger")).toBeNull();
      expect(host.querySelector("[data-legend-layer=mutators]")!.getAttribute("title")).toContain("locked; unlocks with the Mutator entry");
    };
    checkLegend(document.getElementById("layer-legend")!);
    expect(app.ui.modal).toBeNull();
    app.openModal("inventory");
    checkLegend(document.querySelector<HTMLElement>(".tray-switch")!);
    expect(app.ui.modal).toBe("inventory");
    // The click still walks to the entry screen.
    document.querySelector<HTMLButtonElement>(".tray-switch [data-legend-layer=mutators]")!.click();
    expect(app.ui.modal).toBe("catalog");
    expect(app.ui.catalogFace).toBe("arete");
  });

  it("pre-entry the strip stands locked-but-visible: muted outline + lock, and the click previews the entry screen (#273)", () => {
    app.render();
    const legend = document.getElementById("layer-legend")!;
    expect(legend.hidden).toBe(false);
    const lockedSymbol = document.querySelector<HTMLButtonElement>('[data-legend-layer="mutators"]')!;
    expect(lockedSymbol.classList.contains("locked")).toBe(true);
    // The lock mark rides the symbol; the click never flips the mode — it
    // walks to the ◇ entry screen, pre-prestige included.
    expect(lockedSymbol.querySelector(".mut-tab-lock")).not.toBeNull();
    expect(app.ui.mutLayer).toBe("modules");
    lockedSymbol.click();
    expect(app.ui.mutLayer).toBe("modules");
    expect(app.ui.modal).toBe("catalog");
    expect(app.ui.catalogFace).toBe("arete");
    expect(document.querySelector(".entry-screen")).not.toBeNull();
    // The entry cannot sell pre-prestige: its price mutes.
    expect((document.getElementById("buy-arete-entry") as HTMLButtonElement).disabled).toBe(true);
    // Arming the unlock without the entry says so and arms nothing.
    app.closeModal();
    app.mutArmUnlock();
    expect(app.ui.mutUnlockArmed).toBe(false);
  });

  it("past the first prestige, the locked symbol's click lands on the ◇ entry screen itself", () => {
    app.state.prestiges = 1;
    app.state.arete = 0;
    app.render();
    document.querySelector<HTMLButtonElement>('[data-legend-layer="mutators"]')!.click();
    expect(app.ui.mutLayer).toBe("modules");
    expect(app.ui.modal).toBe("catalog");
    expect(app.ui.catalogFace).toBe("arete");
    expect(document.querySelector(".entry-screen")).not.toBeNull();
  });

  it("stands in every mode: flow keeps the legend, the layer switchable and read-only (issue #387)", () => {
    seedMutatorEra();
    expect(document.getElementById("layer-legend")!.hidden).toBe(false);
    // The unlocked symbol's name stops claiming the lock — the accessible
    // name tracks the state the mark shows (issue #298).
    expect(document.querySelector('[data-legend-layer="mutators"]')!.getAttribute("aria-label")).toBe("Mutators layer");
    app.mutSetLayer("mutators");
    expect(document.body.classList.contains("mut-layer-live")).toBe(true);
    // Entering flow lands the board at rest on Modules; the legend stands by.
    app.beginFlow(null);
    expect(app.ui.mutLayer).toBe("modules");
    expect(app.ui.mutUnlockArmed).toBe(false);
    expect(document.getElementById("layer-legend")!.hidden).toBe(false);
    // The switch navigates the session's grid: the layer stands read-only,
    // its faces drawn, the edit furniture never riding along.
    document.querySelector<HTMLButtonElement>('[data-legend-layer="mutators"]')!.click();
    expect(app.ui.mutLayer).toBe("mutators");
    expect(document.body.classList.contains("mut-layer-live")).toBe(true);
    expect(document.querySelector("#grid [data-mut-slot]")).not.toBeNull();
    expect(document.getElementById("mutator-tray")!.hidden).toBe(true);
    // Pause reads the same way (issue #387): the legend stands, the switch
    // navigates read-only, and resume hands the layer back.
    app.pause();
    expect(document.getElementById("layer-legend")!.hidden).toBe(false);
    document.querySelector<HTMLButtonElement>('[data-legend-layer="modules"]')!.click();
    expect(app.ui.mutLayer).toBe("modules");
    expect(document.body.classList.contains("mut-layer-live")).toBe(false);
    app.resume();
    expect(app.ui.mutLayer).toBe("modules");
  });

  it("mutators lead every co-list: strip and sheet switch order Mutators before Modules, in sight and tab order (issue #314)", () => {
    const checkOrder = (host: HTMLElement) => {
      const symbols = [...host.querySelectorAll<HTMLButtonElement>("[data-legend-layer]")];
      expect(symbols.map((b) => b.getAttribute("data-legend-layer"))).toEqual(["mutators", "modules"]);
      // Native buttons tab in DOM order and the symbols carry no tabindex,
      // so the visual lead is the keyboard lead.
      expect(symbols.every((b) => !b.hasAttribute("tabindex"))).toBe(true);
    };
    // Pre-entry, locked: the strip still leads with the Mutators symbol.
    app.render();
    checkOrder(document.getElementById("layer-legend")!);
    seedMutatorEra();
    checkOrder(document.getElementById("layer-legend")!);
    app.openModal("inventory");
    checkOrder(document.querySelector<HTMLElement>(".tray-switch")!);
  });

  it("switching layers drops the armed gestures with the walk-away", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    app.mutArmTray("mu2");
    app.mutSetLayer("modules");
    expect(app.ui.mutArmedTray).toBeNull();
  });
});

describe("the Mutators layer's slot faces", () => {
  it("one face per slot, in words — family, glyph, rarity, effect — and never a ν/s figure", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    const face = slotNode(0, 0);
    expect(face).not.toBeNull();
    const words = face.textContent ?? "";
    expect(words).toContain("POWER");
    expect(words).toContain("+50%");
    expect(words).not.toContain("ν/s");
    expect(words).not.toContain("ν");
    // The tray twin waits; the hostless cell's charge mutator says so.
    expect(slotNode(1, 0)!.textContent).toContain("inert · no host");
  });

  it("the quiet overview never speaks the host (issue #298) — the accessible name keeps it", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    const face = slotNode(0, 0)!;
    // The visible face says the mutator alone; the host relationship is
    // the Hex detail's to supply.
    expect(face.textContent).not.toContain("Oscillator");
    expect(face.textContent).not.toContain("· C4");
    // The accessible name keeps the host, so the fact never rides on
    // sight alone; the hover ask speaks it too (pinned below).
    expect(face.getAttribute("aria-label")).toContain("hosts Sine · C4");
  });

  it("a vacant slot speaks: OPEN SLOT, inert · no host", () => {
    seedMutatorEra();
    app.state.mutatorSlots.push(hex(0, 1));
    app.render();
    app.mutSetLayer("mutators");
    const face = slotNode(0, 1)!;
    expect(face.textContent).toContain("OPEN SLOT");
    expect(face.textContent).toContain("inert · no host");
  });

  it("resonance on a chordless host is inert · no chord", () => {
    seedMutatorEra();
    // The opening synth sings alone: chordFactor 1. Its power mutator
    // steps aside so the resonance one can take the host's slot.
    mutatorOf(app.state, "mu1").pos = null;
    app.state.mutators.push(mut("mu4", "resonance", "common", hex(0, 0)));
    app.render();
    app.mutSetLayer("mutators");
    const face = slotNode(0, 0)!;
    expect(face.textContent).toContain("inert · no chord");
    // The never-say rule (issue #199): an inert case promises no effect.
    expect(face.textContent).not.toContain("RES +");
  });

  it("the layer renders alone: module faces, empty artwork, chord marks, and charge leads never enter the svg (issues #298, #386)", () => {
    seedBoardFacts();
    // Modules first: the board's facts stand — the chord seam, the charge
    // lead, and the empty owned cell's own artwork.
    expect(document.querySelector("#grid .chord-mark")).not.toBeNull();
    expect(document.querySelector("#grid .charge-line, #grid .charge-preview-line")).not.toBeNull();
    expect(document.querySelector('[data-cell="3,0"] .hex.empty')).not.toBeNull();
    app.mutSetLayer("mutators");
    expect(document.body.classList.contains("mut-layer-live")).toBe(true);
    // The renderer omits the module board entire: no cell-node of either
    // kind, no marks, no leads, no ghost group — nothing can leak beneath.
    expect(document.querySelector("#grid .cell-node")).toBeNull();
    expect(document.querySelector("#grid .hex.empty")).toBeNull();
    expect(document.querySelector("#grid .hex-note")).toBeNull();
    expect(document.querySelector("#grid .chord-mark")).toBeNull();
    expect(document.querySelector("#grid .charge-line")).toBeNull();
    expect(document.querySelector("#grid .charge-preview-line")).toBeNull();
    expect(document.querySelector('#grid [data-key="ghost-chords"]')).toBeNull();
    // The layer's own faces stand — one per owned coordinate.
    expect(document.querySelector('#grid [data-key="mut-grid"]')!.children).toHaveLength(app.state.cells.length);
    // Switching back restores the Modules rendering whole.
    app.mutSetLayer("modules");
    expect(document.querySelector('[data-cell="3,0"] .hex.empty')).not.toBeNull();
    expect(document.querySelector("#grid .chord-mark")).not.toBeNull();
    expect(document.querySelector("#grid .charge-preview-line")).not.toBeNull();
    expect(document.querySelector("#grid .mut-presence")).not.toBeNull();
  });

  it("switching layers alters no board or slot state", () => {
    seedMutatorEra();
    const snapshot = (): string =>
      JSON.stringify([app.state.cells, app.state.modules, app.state.mutatorSlots, app.state.mutators, app.state.arete, app.state.nous]);
    const before = snapshot();
    app.mutSetLayer("mutators");
    app.mutSetLayer("modules");
    app.mutSetLayer("mutators");
    expect(snapshot()).toBe(before);
  });
});

describe("the layer's owned faces (issue #386)", () => {
  // The seed's patch plus a cell two steps past it: the board's four
  // owned coordinates then cover all four faces — occupied with a host
  // (0,0), occupied hostless (1,0), eligible (0,1), locked (3,0).
  function seedPatchAndBeyond(): void {
    seedMutatorEra();
    app.state.cells.push(hex(3, 0));
    app.render();
  }

  it("every owned coordinate wears its applicable face — occupied, open, eligible, locked — hostless included", () => {
    seedPatchAndBeyond();
    app.mutSetLayer("mutators");
    const faces = document.querySelector('#grid [data-key="mut-grid"]')!;
    expect(faces.children).toHaveLength(app.state.cells.length);
    // The hosted slot speaks its mutator; the hostless cell's slot keeps
    // its own face and verdict.
    expect(slotNode(0, 0)!.textContent).toContain("POWER");
    expect(slotNode(1, 0)!.textContent).toContain("inert · no host");
    // Eligible: adjacent to the patch — the clear outline, the vocabulary
    // word, no unlock affordance while the arm is down.
    const eligible = faces.querySelector('[data-key="mut-noslot-0,1"]')!;
    expect(eligible.textContent).toContain("NO SLOT");
    expect(eligible.querySelector(".mut-slot-hex")!.classList.contains("clear")).toBe(true);
    expect(eligible.hasAttribute("data-mut-unlock")).toBe(false);
    expect(eligible.getAttribute("tabindex")).toBeNull();
    // Locked: beyond the patch — the muted face and the parent rule's help.
    const locked = faces.querySelector('[data-key="mut-locked-3,0"]')!;
    expect(locked.textContent).toContain("LOCKED");
    expect(locked.getAttribute("aria-label")).toContain("unlock an adjacent Mutator slot first");
    expect(locked.getAttribute("tabindex")).toBeNull();
  });

  it("a vacant slot wears the open face; the locked face holds beyond the grown patch", () => {
    seedPatchAndBeyond();
    app.state.mutatorSlots.push(hex(0, 1));
    app.render();
    app.mutSetLayer("mutators");
    expect(slotNode(0, 1)!.textContent).toContain("OPEN SLOT");
    // (3,0) stays three steps from the grown patch: still locked.
    expect(document.querySelector('[data-key="mut-locked-3,0"]')).not.toBeNull();
    expect(document.querySelector('[data-key="mut-noslot-0,1"]')).toBeNull();
  });

  it("the idle eligible face is inert; armed, it becomes the unlock pick", () => {
    seedPatchAndBeyond();
    app.mutSetLayer("mutators");
    expect(document.querySelector('[data-mut-unlock="0,1"]')).toBeNull();
    app.mutArmUnlock();
    const target = unlockNode(0, 1)!;
    expect(target.classList.contains("mut-unlock-target")).toBe(true);
    expect(target.getAttribute("aria-label")).toBe("Unlock a Mutator slot at C5");
    target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.mutatorSlots.some((slot) => sameHex(slot, hex(0, 1)))).toBe(true);
    expect(app.state.arete).toBe(17); // 20 − the ladder's 3
  });

  it("with an empty patch every owned cell reads eligible — the first-slot exception keeps one vocabulary", () => {
    const s = app.state;
    s.mode = "upgrade";
    s.catalogEntryOwned = true;
    app.render();
    app.mutSetLayer("mutators");
    const faces = document.querySelector('#grid [data-key="mut-grid"]')!;
    expect(faces.querySelectorAll(".mut-slot-locked")).toHaveLength(0);
    expect(faces.querySelectorAll(".mut-slot-noslot")).toHaveLength(s.cells.length);
    const idle = faces.querySelector('[data-key="mut-noslot-0,0"]')!;
    expect(idle.getAttribute("aria-label")).toContain("the first is free");
  });

  it("pre-entry no Mutator faces exist and the Modules board stands untouched", () => {
    app.render();
    expect(document.querySelector('#grid [data-key="mut-grid"]')).toBeNull();
    expect(document.querySelector("#grid .hex.empty")).not.toBeNull();
    expect(document.body.classList.contains("mut-layer-live")).toBe(false);
    // The locked legend's walk never flips the layer (issue #273, kept).
    document.querySelector<HTMLButtonElement>('[data-legend-layer="mutators"]')!.click();
    expect(app.ui.mutLayer).toBe("modules");
    expect(document.querySelector('#grid [data-key="mut-grid"]')).toBeNull();
  });
});

describe("the Modules layer's presence outline", () => {
  it("hosted mutators wear the thin arete outline; a vacant slot wears nothing; neither says a word", () => {
    seedMutatorEra();
    app.state.mutatorSlots.push(hex(0, 1)); // vacant
    app.render();
    expect(document.body.classList.contains("mut-layer-live")).toBe(false);
    // Two placed mutators, one vacant slot: two outlines, no words.
    const outlines = [...document.querySelectorAll("#grid .mut-presence")];
    expect(outlines).toHaveLength(2);
    for (const outline of outlines) {
      expect(outline.textContent!.trim()).toBe("");
    }
  });
});

describe("the gestures (issue #199)", () => {
  it("click-then-slot places a tray mutator into a vacant slot", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    app.state.mutatorSlots.push(hex(0, 1));
    app.render();
    document.querySelector<HTMLButtonElement>('[data-mut-tray="mu2"]')!.click();
    document.querySelector<HTMLButtonElement>("[data-inventory-place]")!.click();
    expect(app.ui.mutArmedTray).toBe("mu2");
    clickSlot(0, 1);
    expect(mutatorOf(app.state, "mu2").pos).toEqual(hex(0, 1));
    expect(app.ui.mutArmedTray).toBeNull();
  });

  it("an occupied slot swaps: the occupant waits in the Mutator tray", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    document.querySelector<HTMLButtonElement>('[data-mut-tray="mu2"]')!.click();
    document.querySelector<HTMLButtonElement>("[data-inventory-place]")!.click();
    clickSlot(0, 0);
    expect(mutatorOf(app.state, "mu2").pos).toEqual(hex(0, 0));
    expect(mutatorOf(app.state, "mu1").pos).toBeNull();
  });

  it("right-click retrieves a placed mutator to the tray", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    rightClickSlot(0, 0);
    expect(mutatorOf(app.state, "mu1").pos).toBeNull();
  });

  it("an idle click opens the Mutators detail; retrieval refreshes it to an open slot", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    clickSlot(0, 0);
    expect(app.ui.detail).toEqual({ pos: hex(0, 0), face: "mutators" });
    const mutators = document.querySelector(".hex-detail-layer.mutators")!;
    expect(mutators.textContent).toContain("POWER");
    expect(mutators.textContent).toContain("+50%");
    // The hosting relation is the stack itself — the face never says "hosts".
    expect(mutators.textContent).not.toContain("Oscillator · C4");
    app.mutRetrieve("mu1");
    expect(mutatorOf(app.state, "mu1").pos).toBeNull();
    expect(app.ui.detail).toEqual({ pos: hex(0, 0), face: "mutators" });
    expect(document.querySelector(".hex-detail-layer.mutators")!.textContent).toContain("OPEN SLOT");
  });

  it("dragging a placed mutator onto a matching twin opens the combine review; confirm combines", async () => {
    seedMutatorEra();
    app.state.mutatorSlots.push(hex(0, 1));
    mutatorOf(app.state, "mu2").pos = hex(0, 1); // the twin, parked on C5
    app.render();
    app.mutSetLayer("mutators");
    const target = slotNode(0, 1).querySelector(".mut-hit")!;
    document.elementFromPoint = () => target;
    slotNode(0, 0).dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 100 }));
    expect(document.querySelector(".drag-ghost.mut-ghost")).not.toBeNull();
    expect(slotNode(0, 1).classList.contains("mut-land-combine")).toBe(true);
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 130, clientY: 100 }));
    expect(app.ui.modal).toBe("mutcombine");
    // The review's terms: resulting rarity, the no-levels rule.
    const content = document.getElementById("modal-content")!;
    expect(content.textContent).toContain("Resulting rarity");
    expect(content.textContent).toContain("Mutators carry no levels — nothing is retained or refunded.");
    expect(content.textContent).toContain("The combined mutator holds the C5 slot.");
    // The drag's release suppresses the synthetic post-drop click; drain
    // the suppressor before the confirm's own click lands.
    await new Promise((resolve) => setTimeout(resolve, 0));
    document.getElementById("mut-combine-confirm")!.click();
    expect(app.state.mutators).toHaveLength(2);
    expect(mutatorOf(app.state, "mu2").rarity).toBe("uncommon");
    expect(mutatorOf(app.state, "mu2").pos).toEqual(hex(0, 1));
    expect(app.ui.modal).toBeNull();
  });

  it("cancelling the review leaves both copies untouched", () => {
    seedMutatorEra();
    app.state.mutatorSlots.push(hex(0, 1));
    app.render();
    app.mutSetLayer("mutators");
    app.mutOfferCombine("mu1", "mu2");
    document.getElementById("mut-combine-cancel")!.click();
    expect(app.state.mutators).toHaveLength(3);
    expect(mutatorOf(app.state, "mu1").rarity).toBe("common");
    expect(mutatorOf(app.state, "mu2").rarity).toBe("common");
    expect(app.ui.mutCombineOffer).toBeNull();
  });

  it("rare pairs refuse to combine — the drop lands as a swap instead", () => {
    const s = app.state;
    s.mode = "upgrade";
    s.catalogEntryOwned = true;
    s.mutatorSlots = [hex(0, 0), hex(1, 0)];
    s.mutators = [
      mut("mu1", "power", "rare", hex(0, 0)),
      mut("mu2", "power", "rare", hex(1, 0)),
    ];
    app.render();
    expect(combineMutatorsPreview(s, "mu1", "mu2")).toBeNull();
    app.mutSetLayer("mutators");
    const target = slotNode(1, 0).querySelector(".mut-hit")!;
    document.elementFromPoint = () => target;
    slotNode(0, 0).dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 220, clientY: 100 }));
    expect(slotNode(1, 0).classList.contains("mut-land-swap")).toBe(true);
    expect(slotNode(1, 0).classList.contains("mut-land-combine")).toBe(false);
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 220, clientY: 100 }));
    expect(app.ui.modal).toBeNull();
    expect(mutatorOf(s, "mu1").pos).toEqual(hex(1, 0));
    expect(mutatorOf(s, "mu2").pos).toEqual(hex(0, 0));
  });

  it("dragging a placed mutator into the tray strip retrieves it", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    const tray = document.getElementById("mutator-tray")!;
    document.elementFromPoint = () => tray;
    slotNode(0, 0).dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 100 }));
    expect(tray.classList.contains("drag-over")).toBe(true);
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 100, clientY: 500 }));
    expect(mutatorOf(app.state, "mu1").pos).toBeNull();
  });

  it("dragging a tray tile onto its matching twin in a slot opens the review", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    const target = slotNode(0, 0).querySelector(".mut-hit")!;
    document.elementFromPoint = () => target;
    document.querySelector<HTMLButtonElement>('[data-mut-tray="mu2"]')!.dispatchEvent(
      new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 400 }),
    );
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 130, clientY: 100 }));
    expect(app.ui.modal).toBe("mutcombine");
  });

  it("the Esc walk backs out: gesture, then the detail, then the layer", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    app.mutArmTray("mu2");
    pressEscape();
    expect(app.ui.mutArmedTray).toBeNull();
    expect(app.ui.mutLayer).toBe("mutators");
    clickSlot(0, 0);
    expect(app.ui.detail).not.toBeNull();
    pressEscape();
    expect(app.ui.detail).toBeNull();
    expect(app.ui.mutLayer).toBe("mutators");
    pressEscape();
    expect(app.ui.mutLayer).toBe("modules");
  });

  function pressEscape(): void {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }
});

describe("the slot unlock (issue #199, re-docked by the #272 review)", () => {
  it("Add arms the unlock in mutator mode; the pill carries the price and no tray card does", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    // The unlock lives in Add, never a tray card.
    expect(document.getElementById("mut-unlock")).toBeNull();
    const add = document.querySelector<HTMLButtonElement>('#board-tools [data-op="cell"]')!;
    expect(add.getAttribute("aria-label")).toBe("Add");
    expect(add.querySelector(".tool-detail")!.textContent).toContain("Unlock a Mutator slot — 3 Arete");
    add.click();
    expect(app.ui.mutUnlockArmed).toBe(true);
    const pill = document.getElementById("mut-unlock-pill")!;
    expect(pill.hidden).toBe(false);
    expect(pill.textContent).toContain("Unlock Mutator slot");
    expect(pill.textContent).toContain("3 Arete");
    // The armed Add wears the arm: active, cancel-worded.
    const armed = document.querySelector<HTMLButtonElement>('#board-tools [data-op="cell"]')!;
    expect(armed.classList.contains("active")).toBe(true);
    expect(armed.querySelector(".tool-detail")!.textContent).toContain("Pick an eligible cell · Esc cancels");
    app.mutCancelGestures();
    expect(document.querySelector<HTMLButtonElement>('#board-tools [data-op="cell"]')!.querySelector(".tool-detail")!.textContent).toContain("Unlock a Mutator slot");
  });

  it("Add in module mode still arms the cell purchase — the mode directs the arm", () => {
    seedMutatorEra();
    app.state.nous = 500;
    app.render();
    const add = document.querySelector<HTMLButtonElement>('#board-tools [data-op="cell"]')!;
    expect(add.querySelector(".tool-detail")!.textContent).toContain("Add — ");
    add.click();
    expect(app.ui.buyingCell).toBe(true);
    expect(app.ui.mutUnlockArmed).toBe(false);
    app.cancelCellPurchase();
  });

  it("the entry's first slot is free and sits on any owned cell; eligible cells pulse", () => {
    const s = app.state;
    s.mode = "upgrade";
    s.catalogEntryOwned = true;
    s.arete = 5;
    app.render();
    app.mutSetLayer("mutators");
    app.mutArmUnlock();
    expect(app.ui.mutUnlockArmed).toBe(true);
    expect(document.getElementById("mut-unlock-pill")!.textContent).toContain("free");
    const pulses = [...document.querySelectorAll("#grid .mut-unlock-target")];
    expect(pulses).toHaveLength(3);
    expect(pulses.map((n) => n.getAttribute("data-mut-unlock"))).toEqual(["0,0", "1,0", "0,1"]);
    unlockNode(1, 0).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(s.mutatorSlots.some((slot) => sameHex(slot, hex(1, 0)))).toBe(true);
    expect(s.arete).toBe(5);
    expect(app.ui.mutUnlockArmed).toBe(false);
  });

  it("later unlocks attach to the patch, priced on the ladder, and refuse elsewhere", () => {
    const s = app.state;
    s.mode = "upgrade";
    s.catalogEntryOwned = true;
    s.arete = 10;
    s.mutatorSlots = [hex(0, 0)];
    app.render();
    app.mutSetLayer("mutators");
    app.mutArmUnlock();
    // (1,0) is adjacent to the patch: 2 Arete.
    unlockNode(1, 0).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(s.mutatorSlots).toHaveLength(2);
    expect(s.arete).toBe(8);
    // (0,1) is adjacent too: 3 Arete.
    app.mutArmUnlock();
    unlockNode(0, 1).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(s.mutatorSlots).toHaveLength(3);
    expect(s.arete).toBe(5);
    // A wrong pick — a cell that already holds a slot — refuses through the
    // engine and keeps the arm for another pick.
    app.mutArmUnlock();
    clickSlot(0, 0);
    expect(s.mutatorSlots).toHaveLength(3);
    expect(app.ui.mutUnlockArmed).toBe(true);
    expect(document.getElementById("status")!.textContent).toContain("already holds a Mutator slot");
  });
});

describe("the mutator rolls (issue #199)", () => {
  it("the Forge modal renders two candidates styled after the module rolls, effect words only", () => {
    const s = app.state;
    s.mode = "upgrade";
    s.catalogEntryOwned = true;
    s.bankedMutatorRolls = [
      {
        id: "ro1",
        candidates: [
          { id: "c1", family: "power", rarity: "common" },
          { id: "c2", family: "charge", rarity: "uncommon" },
        ],
      },
    ];
    app.render();
    app.openModal("forge");
    const content = document.getElementById("modal-content")!;
    expect(content.querySelector('[data-forge-face="mutators"]')?.getAttribute("aria-label")).toBe("Mutators, 1 banked roll");
    expect(content.textContent).toContain("+50% to this module's power");
    expect(content.textContent).toContain("+100% to the strength this module receives");
    expect(content.textContent).not.toContain("ν/s");
    expect(content.querySelectorAll(".mut-candidate")).toHaveLength(2);
    // The branch's meter row rides with the entry.
    expect(content.textContent).toContain("Mutator Forge");
  });

  it("taking a candidate mints it into the Mutator tray; the other vanishes", () => {
    const s = app.state;
    s.mode = "upgrade";
    s.catalogEntryOwned = true;
    s.bankedMutatorRolls = [
      {
        id: "ro1",
        candidates: [
          { id: "c1", family: "power", rarity: "common" },
          { id: "c2", family: "charge", rarity: "uncommon" },
        ],
      },
    ];
    app.render();
    app.chooseMutatorCandidate("ro1", "c2");
    expect(s.bankedMutatorRolls).toHaveLength(0);
    expect(s.mutators).toHaveLength(1);
    expect(s.mutators[0]!.family).toBe("charge");
    expect(s.mutators[0]!.pos).toBeNull();
    expect(document.getElementById("status")!.textContent).toContain("Mutator tray");
  });

  it("without the entry, the Forge modal carries no mutator block at all", () => {
    app.render();
    app.openModal("forge");
    expect(document.getElementById("modal-content")!.textContent).not.toContain("MUTATOR FORGE");
  });
});

describe("the readouts (issue #199)", () => {
  it("the reserved readout answers a slot hover with the full declaration", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    slotNode(0, 0).dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    const readout = document.getElementById("chord-readout")!;
    expect(readout.hidden).toBe(false);
    expect(readout.textContent).toContain("Power · +50% to this module's power — hosts Sine · C4");
    expect(readout.textContent).not.toContain("ν/s");
  });

  it("a vacant slot's ask promises only inertness", () => {
    seedMutatorEra();
    app.state.mutatorSlots.push(hex(0, 1));
    app.render();
    app.mutSetLayer("mutators");
    slotNode(0, 1).dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    const readout = document.getElementById("chord-readout")!;
    expect(readout.textContent).toContain("Open Mutator slot · C5 — inert until a host lands");
  });

  it("the Hex detail's declaration lives on the mutator face alone (issue #295)", () => {
    seedMutatorEra();
    app.openDetail(hex(0, 0));
    // The stack carries the declaration once — the arete face above — and
    // no text column repeats it beside the module.
    const mutators = document.querySelector(".hex-detail-layer.mutators")!;
    expect(mutators.textContent).toContain("POWER");
    expect(mutators.textContent).toContain("+50%");
    expect(document.querySelector(".hex-detail-mutline")).toBeNull();
  });
});

describe("the never-say rules (issue #199)", () => {
  it("no mutator surface promises a ν/s figure or a rate-details row", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    app.state.mutatorSlots.push(hex(0, 1));
    app.state.mutators.push(mut("mu4", "resonance", "rare", hex(0, 1)));
    app.render();
    const grid = document.getElementById("grid")!;
    for (const face of [...grid.querySelectorAll("[data-mut-slot]")]) {
      expect(face.textContent).not.toContain("ν/s");
    }
    expect(document.getElementById("status")!.textContent).not.toContain("ν/s");
  });
});

describe("the tray column (issue #272)", () => {
  it("the Mutator tray is the column's face, switched by the board tabs alone", () => {
    seedMutatorEra();
    const column = document.getElementById("tray-column")!;
    const mutTray = document.getElementById("mutator-tray")!;
    expect(mutTray.hidden).toBe(true);
    app.mutSetLayer("mutators");
    // The face lives inside the column, wearing the minimal-mark tiles.
    expect(mutTray.hidden).toBe(false);
    expect(column.contains(mutTray)).toBe(true);
    const tile = mutTray.querySelector<HTMLButtonElement>('[data-mut-tray="mu2"]')!;
    expect(tile).not.toBeNull();
    expect(tile.querySelector(".mut-tile-hex")).not.toBeNull();
    // The unlock arm lives in Add — no tray card carries it.
    expect(mutTray.querySelector("#mut-unlock")).toBeNull();
    // The column wears no second switch — the legend is the one.
    expect(document.getElementById("tray-head")).toBeNull();
    expect(column.querySelectorAll("[data-legend-layer]")).toHaveLength(0);
  });

  it("flow clears the whole column", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    app.beginFlow(null);
    app.render();
    expect(document.getElementById("mutator-tray")!.hidden).toBe(true);
    expect(document.getElementById("inventory-zone")!.classList.contains("off")).toBe(true);
  });
});

describe("flow reads the layer (issue #387)", () => {
  it("the legend navigates the session's grid; the tray column stands down", () => {
    seedMutatorEra();
    app.beginFlow(null);
    app.render();
    expect(document.getElementById("layer-legend")!.hidden).toBe(false);
    expect(document.getElementById("mutator-tray")!.hidden).toBe(true);
    expect(document.getElementById("inventory-zone")!.classList.contains("off")).toBe(true);
    document.querySelector<HTMLButtonElement>('[data-legend-layer="mutators"]')!.click();
    expect(app.ui.mutLayer).toBe("mutators");
    expect(document.querySelector("#grid [data-mut-slot]")).not.toBeNull();
    expect(document.getElementById("mutator-tray")!.hidden).toBe(true);
  });

  it("the session's clicks read: a slot opens the detail read-only, nothing edits", () => {
    seedMutatorEra();
    app.beginFlow(null);
    app.render();
    app.mutSetLayer("mutators");
    // The unlock cannot arm mid-session: Arete is spent between sessions.
    app.mutArmUnlock();
    expect(app.ui.mutUnlockArmed).toBe(false);
    // An idle slot click answers the lock with the read-only detail —
    // never an unlock, a placement, or a swap.
    clickSlot(0, 0);
    expect(app.ui.detail).toEqual({ pos: hex(0, 0), face: "mutators" });
    expect(document.querySelector(".hex-detail-readonly")!.textContent).toContain("read-only");
    app.closeDetail();
    // Right-click retrieves nothing during flow.
    rightClickSlot(0, 0);
    expect(mutatorOf(app.state, "mu1").pos).toEqual(hex(0, 0));
    // A held placed mutator starts no drag — the carry is an edit's first half.
    document.elementFromPoint = () => document.getElementById("grid")!;
    slotNode(0, 0).dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 100 }));
    expect(document.querySelector(".mut-ghost")).toBeNull();
    expect(app.ui.mutCarrying).toBeNull();
  });

  it("pre-entry the locked legend stays navigable but inert in flow — the Catalog never opens mid-session", () => {
    app.beginFlow(null);
    app.render();
    const locked = document.querySelector<HTMLButtonElement>('[data-legend-layer="mutators"]')!;
    expect(locked.classList.contains("locked")).toBe(true);
    // The lock's own copy answers what the click answers now (issue #387):
    // the session's refusal, not the Catalog walk upgrade speaks.
    expect(locked.getAttribute("title")).toContain("Arete is spent between sessions");
    expect(locked.getAttribute("aria-label")).toBe("Mutators layer — locked");
    locked.click();
    expect(app.ui.modal).toBeNull();
    expect(app.ui.mutLayer).toBe("modules");
    expect(document.getElementById("status")!.textContent).toContain("Arete is spent between sessions");
    // The grid shows no Mutator faces pre-entry, whatever the click asked.
    expect(document.querySelector("#grid [data-mut-slot]")).toBeNull();
  });
});


describe("mutator drag cancellation", () => {
  it.each(["Escape", "layer", "flow"])("%s removes the drag and prevents its later release", (exit) => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    document.elementFromPoint = () => document.getElementById("mutator-tray")!;
    slotNode(0, 0).dispatchEvent(new MouseEvent("pointerdown", { button: 0, bubbles: true, clientX: 100, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 130, clientY: 100 }));
    expect(document.querySelector(".mut-ghost")).not.toBeNull();
    if (exit === "Escape") {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      expect(app.ui.mutLayer).toBe("mutators");
    } else if (exit === "layer") app.mutSetLayer("modules");
    else app.beginFlow(null);
    expect(document.querySelector(".mut-ghost")).toBeNull();
    expect(app.ui.mutCarrying).toBeNull();
    expect(app.cancelMutDrag).toBeNull();
    app.state.mode = "upgrade";
    app.mutSetLayer("mutators");
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 150, clientY: 100 }));
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 150, clientY: 100 }));
    expect(mutatorOf(app.state, "mu1").pos).toEqual(hex(0, 0));
    expect(app.ui.modal).toBeNull();
    expect(document.querySelector(".mut-ghost")).toBeNull();
  });
});

describe("inert declarations", () => {
  it.each(["resonance", "power"] as const)("%s promises no effect in hover or detail", (family) => {
    seedMutatorEra();
    const pos = family === "resonance" ? hex(0, 0) : hex(1, 0);
    const item = family === "resonance" ? mutatorOf(app.state, "mu1") : mutatorOf(app.state, "mu3");
    item.family = family;
    app.mutSetLayer("mutators");
    slotNode(pos.q, pos.r).dispatchEvent(new MouseEvent("pointerover", { bubbles: true }));
    expect(document.getElementById("chord-readout")!.textContent).toContain("inert");
    expect(document.getElementById("chord-readout")!.textContent).not.toContain("%");
    clickSlot(pos.q, pos.r);
    expect(document.querySelector(".hex-detail-layer.mutators")!.textContent).toContain("inert");
    expect(document.querySelector(".hex-detail-layer.mutators")!.textContent).not.toContain("%");
    if (family === "resonance") {
      // The verdict rides the mutator face alone; no module-face line repeats it.
      expect(document.querySelector(".hex-detail-mutline")).toBeNull();
    }
  });
});

describe("the mutator entry sequence (issue #274)", () => {
  // The purchase staged through the real sheet: first Arete banked, the
  // door walked to the ◇ entry screen.
  function stageEntry(): void {
    app.state.prestiges = 1;
    app.state.arete = BALANCE.catalogEntryCost;
    app.render();
    app.openMutatorEntry();
    expect(app.ui.modal).toBe("catalog");
    expect(app.ui.catalogFace).toBe("arete");
  }

  function buyEntry(): void {
    stageEntry();
    document.getElementById("buy-arete-entry")!.click();
  }

  function pressEscape(): void {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }

  it("the purchase closes the sheet, flips to the Mutators layer, and auto-arms the free first slot", () => {
    buyEntry();
    const s = app.state;
    expect(s.catalogEntryOwned).toBe(true);
    // The entry's contents: Grid activation + the Forge module in the
    // module tray + the free first slot's arm + one performed roll banked.
    expect(s.modules.some((m) => m.type === "mutatorForge")).toBe(true);
    expect(s.bankedMutatorRolls).toHaveLength(1);
    expect(app.ui.modal).toBeNull();
    expect(app.ui.mutLayer).toBe("mutators");
    expect(document.body.classList.contains("mut-layer-live")).toBe(true);
    expect(document.getElementById("mutator-tray")!.hidden).toBe(false);
    expect(app.ui.mutUnlockArmed).toBe(true);
    const pill = document.getElementById("mut-unlock-pill")!;
    expect(pill.hidden).toBe(false);
    expect(pill.textContent).toContain("free");
    expect([...document.querySelectorAll("#grid .mut-unlock-target")]).toHaveLength(3);
  });

  it("the first slot's landing auto-opens the roll choice; choosing mints to the tray with no placement arm", () => {
    buyEntry();
    unlockNode(1, 0).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.mutatorSlots).toHaveLength(1);
    expect(app.ui.mutUnlockArmed).toBe(false);
    // The moment the slot lands, the existing Forge modal's mutator block
    // stands open — no bespoke first-roll furniture.
    expect(app.ui.modal).toBe("forge");
    const candidates = [...document.querySelectorAll("#modal-content .mut-candidate")];
    expect(candidates).toHaveLength(2);
    candidates[1]!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const minted = app.state.mutators[0]!;
    expect(minted.pos).toBeNull();
    expect(app.state.bankedMutatorRolls).toHaveLength(0);
    // The entry arm is retired with pick-and-place: the choice mints to
    // the tray, nothing arms, and with both queues dry the batch visit
    // closes the Forge.
    expect(app.ui.modal).toBeNull();
    expect(app.ui.mutArmedTray).toBeNull();
    expect(app.ui.placing).toBeNull();
    expect(document.getElementById("status")!.textContent).toContain("the Mutators layer holds it");
    // The tray arm stays available through the normal gesture; the arm
    // resolves on the fresh slot.
    app.mutArmTray(minted.id);
    clickSlot(1, 0);
    expect(minted.pos !== null && sameHex(minted.pos, hex(1, 0))).toBe(true);
  });

  it("Esc retires the entry automation; Add unlocks the free slot without reopening Forge", () => {
    buyEntry();
    pressEscape();
    expect(app.ui.mutUnlockArmed).toBe(false);
    expect(app.state.mutatorSlots).toHaveLength(0);
    // The free first slot stays reachable through Add's normal arm.
    document.querySelector<HTMLButtonElement>('#board-tools [data-op="cell"]')!.click();
    expect(app.ui.mutUnlockArmed).toBe(true);
    unlockNode(0, 1).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.mutatorSlots).toHaveLength(1);
    expect(app.ui.modal).toBeNull();
    expect(app.ui.entryRollPending).toBe(false);
    expect(app.state.bankedMutatorRolls).toHaveLength(1);
  });

  it("purchase through the surrounding navigation returns to the grid with every free-slot target available", () => {
    app.state.prestiges = 1;
    app.state.arete = BALANCE.catalogEntryCost;
    app.openDetail(hex(0, 0));
    // The detail carries no destination button (issue #388): the entry
    // walk lives in the surrounding navigation — the legend's locked
    // symbol and the dock's Catalog door — which the walk here uses.
    expect(document.getElementById("detail-mutator-entry")).toBeNull();
    app.openMutatorEntry();
    document.getElementById("buy-arete-entry")!.click();
    expect(app.ui.detail).toBeNull();
    expect(document.body.classList.contains("hex-detail-open")).toBe(false);
    expect(app.ui.mutLayer).toBe("mutators");
    expect(app.ui.mutUnlockArmed).toBe(true);
    expect(document.querySelectorAll("#grid .mut-unlock-target")).toHaveLength(app.state.cells.length);
  });

  it("a first slot unlocked through Hex detail opens the entry roll; the choice mints to the tray unplaced", () => {
    buyEntry();
    app.openDetail(hex(1, 0), "mutators");
    document.getElementById("detail-mutator-unlock")!.click();
    expect(app.state.mutatorSlots).toEqual([hex(1, 0)]);
    expect(app.ui.mutUnlockArmed).toBe(false);
    expect(app.ui.detail).toBeNull();
    expect(app.ui.modal).toBe("forge");
    document.querySelector<HTMLElement>("#modal-content .mut-candidate")!.click();
    const minted = app.state.mutators[0]!;
    expect(minted.pos).toBeNull();
    expect(app.ui.mutArmedTray).toBeNull();
    expect(app.ui.modal).toBeNull();
    app.mutArmTray(minted.id);
    clickSlot(1, 0);
    expect(minted.pos).toEqual(hex(1, 0));
  });

  it("closing the Forge modal banks the roll; a later choice mints to the tray and closes the dry visit", () => {
    buyEntry();
    unlockNode(1, 0).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    pressEscape();
    expect(app.ui.modal).toBeNull();
    // Nothing is lost: the roll waits banked like any banked roll.
    expect(app.state.bankedMutatorRolls).toHaveLength(1);
    app.openModal("forge");
    const candidate = document.querySelector("#modal-content .mut-candidate")!;
    candidate.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.mutators).toHaveLength(1);
    expect(app.state.mutators[0]!.pos).toBeNull();
    // The choice mints to the tray; nothing auto-arms, and with both
    // queues dry the batch visit closes the Forge.
    expect(app.ui.modal).toBeNull();
    expect(app.ui.mutArmedTray).toBeNull();
    app.mutSetLayer("modules");
    app.mutSetLayer("mutators");
    app.mutArmTray(app.state.mutators[0]!.id);
    clickSlot(1, 0);
    expect(app.state.mutators[0]!.pos).toEqual(hex(1, 0));
  });

  it("a reload mid-sequence lands on the standard surfaces; the banked roll waits and nothing replays", () => {
    buyEntry();
    expect(app.ui.entryRollPending).toBe(true);
    app = boot();
    expect(app.state.bankedMutatorRolls).toHaveLength(1);
    expect(app.ui.mutLayer).toBe("modules");
    expect(app.ui.modal).toBeNull();
    expect(app.ui.mutUnlockArmed).toBe(false);
    expect(app.ui.entryRollPending).toBe(false);
    // The banked roll waits in the Forge modal...
    app.openModal("forge");
    expect(document.querySelectorAll("#modal-content .mut-candidate")).toHaveLength(2);
    app.closeModal();
    // ...and the automation never replays: the first slot lands silent.
    app.mutSetLayer("mutators");
    app.mutArmUnlock();
    unlockNode(0, 1).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(app.state.mutatorSlots).toHaveLength(1);
    expect(app.ui.modal).toBeNull();
  });

  it("an existing save that already owns the entry boots to the standard surfaces with no roll performed", () => {
    const s = createInitialState();
    s.prestiges = 1;
    s.catalogEntryOwned = true;
    localStorage.setItem(STORAGE_KEY, serialize(s, Date.now() - 1_000));
    app = boot();
    expect(app.state.bankedMutatorRolls).toHaveLength(0);
    expect(app.state.mutatorSlots).toHaveLength(0);
    expect(app.ui.mutLayer).toBe("modules");
    expect(app.ui.modal).toBeNull();
    expect(app.ui.mutUnlockArmed).toBe(false);
  });
});
