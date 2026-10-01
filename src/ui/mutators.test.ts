// @vitest-environment happy-dom
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { App } from "./app";
import { combineMutatorsPreview } from "../engine/actions";
import { hex, sameHex } from "../engine/hex";
import type { GameState, Hex, MutatorFamily, MutatorInstance, Rarity } from "../engine/types";
import type { SignalChannels } from "./signals";

// The Mutator Grid's UI (issue #199): the tabbed second layer, its slot
// faces and presence outlines, the tray strip, the gestures, the unlock
// arm, and the rolls — booted on the real index.html skeleton, every
// landing routed through the engine actions from #198.

function boot(channels?: SignalChannels): App {
  const html = readFileSync("index.html", "utf8");
  const body = html.slice(html.indexOf("<body>") + 6, html.lastIndexOf("</body>"));
  document.body.innerHTML = body;
  const els: Record<string, HTMLElement> = {};
  for (const id of [
    "console-session",
    "console-apps",
    "board-tools",
    "thumb-bar",
    "grid",
    "status",
    "modal",
    "modal-content",
  ]) {
    const element = document.getElementById(id);
    if (element) els[id] = element;
  }
  return new App(els, false, channels);
}

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

// Synthetic drags install a once-capture click suppressor with a timer;
// drain it and drop any elementFromPoint mock the test left behind.
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  delete (document as unknown as { elementFromPoint?: unknown }).elementFromPoint;
});

describe("the tab pair (issue #199)", () => {
  it("never shows before the entry purchase — the layer does not exist yet", () => {
    app.render();
    expect(document.getElementById("mut-tabs")!.hidden).toBe(true);
    expect(app.ui.mutLayer).toBe("modules");
    // Arming the unlock without the entry says so and arms nothing.
    app.mutArmUnlock();
    expect(app.ui.mutUnlockArmed).toBe(false);
  });

  it("stands in upgrade mode once the tree is entered, and flow shows neither tab nor layer", () => {
    seedMutatorEra();
    expect(document.getElementById("mut-tabs")!.hidden).toBe(false);
    app.mutSetLayer("mutators");
    expect(document.body.classList.contains("mut-layer-live")).toBe(true);
    // Entering flow clears the layer with the rest of the transient modes.
    app.beginFlow(null);
    expect(app.ui.mutLayer).toBe("modules");
    expect(app.ui.mutUnlockArmed).toBe(false);
    expect(document.getElementById("mut-tabs")!.hidden).toBe(true);
    expect(document.body.classList.contains("mut-layer-live")).toBe(false);
  });

  it("switching layers drops the armed gestures with the walk-away", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    app.mutArmTray("mu2");
    app.mutSetLayer("modules");
    expect(app.ui.mutArmedTray).toBeNull();
    expect(app.ui.mutPopover).toBeNull();
  });
});

describe("the Mutators layer's slot faces", () => {
  it("one face per slot, in words — family, host, effect — and never a ν/s figure", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    const face = slotNode(0, 0);
    expect(face).not.toBeNull();
    const words = face.textContent ?? "";
    expect(words).toContain("POWER");
    expect(words).toContain("Additive Synth · C4");
    expect(words).toContain("PWR +50%");
    expect(words).not.toContain("ν/s");
    expect(words).not.toContain("ν");
    // The tray twin waits; the hostless cell's charge mutator says so.
    expect(slotNode(1, 0)!.textContent).toContain("inert · no host");
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

  it("the board rests greyed beneath: the layer's live class stands", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    expect(document.body.classList.contains("mut-layer-live")).toBe(true);
    app.mutSetLayer("modules");
    expect(document.body.classList.contains("mut-layer-live")).toBe(false);
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
    expect(app.ui.mutArmedTray).toBe("mu2");
    clickSlot(0, 1);
    expect(mutatorOf(app.state, "mu2").pos).toEqual(hex(0, 1));
    expect(app.ui.mutArmedTray).toBeNull();
  });

  it("an occupied slot swaps: the occupant waits in the Mutator tray", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    document.querySelector<HTMLButtonElement>('[data-mut-tray="mu2"]')!.click();
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

  it("an idle click opens the declaration popover; Retrieve lands it in the tray", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    clickSlot(0, 0);
    expect(app.ui.mutPopover).toBe("mu1");
    const popover = document.getElementById("mut-popover")!;
    expect(popover.hidden).toBe(false);
    expect(popover.textContent).toContain("Power");
    expect(popover.textContent).toContain("+50% to this module's power");
    expect(popover.textContent).toContain("Additive Synth · C4");
    document.getElementById("mut-pop-retrieve")!.click();
    expect(mutatorOf(app.state, "mu1").pos).toBeNull();
    expect(app.ui.mutPopover).toBeNull();
  });

  it("the popover's Move arms a move that lands on a vacant slot", () => {
    seedMutatorEra();
    app.state.mutatorSlots.push(hex(0, 1));
    app.render();
    app.mutSetLayer("mutators");
    clickSlot(0, 0);
    document.getElementById("mut-pop-move")!.click();
    expect(app.ui.mutMoving).toBe("mu1");
    clickSlot(0, 1);
    expect(mutatorOf(app.state, "mu1").pos).toEqual(hex(0, 1));
    expect(app.ui.mutMoving).toBeNull();
  });

  it("the armed move refuses a held slot and says drag instead", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    clickSlot(0, 0);
    document.getElementById("mut-pop-move")!.click();
    clickSlot(1, 0);
    expect(mutatorOf(app.state, "mu1").pos).toEqual(hex(0, 0));
    expect(app.ui.mutMoving).toBe("mu1");
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

  it("the Esc walk backs out: gesture, then popover, then the layer", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    app.mutArmTray("mu2");
    pressEscape();
    expect(app.ui.mutArmedTray).toBeNull();
    expect(app.ui.mutLayer).toBe("mutators");
    clickSlot(0, 0);
    expect(app.ui.mutPopover).toBe("mu1");
    pressEscape();
    expect(app.ui.mutPopover).toBeNull();
    expect(app.ui.mutLayer).toBe("mutators");
    pressEscape();
    expect(app.ui.mutLayer).toBe("modules");
  });

  function pressEscape(): void {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }
});

describe("the slot unlock (issue #199)", () => {
  it("the tray's unlock button arms the gesture; the pill carries the price", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    document.getElementById("mut-unlock")!.click();
    expect(app.ui.mutUnlockArmed).toBe(true);
    const pill = document.getElementById("mut-unlock-pill")!;
    expect(pill.hidden).toBe(false);
    expect(pill.textContent).toContain("Unlock Mutator slot");
    expect(pill.textContent).toContain("3 Arete");
  });

  it("the entry's first slot is free and sits on any owned cell; eligible cells pulse", () => {
    const s = app.state;
    s.mode = "upgrade";
    s.catalogEntryOwned = true;
    s.arete = 5;
    app.render();
    app.mutArmUnlock();
    expect(app.ui.mutLayer).toBe("mutators");
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
    expect(content.textContent).toContain("MUTATOR FORGE · 1 banked");
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
    expect(readout.textContent).toContain("Power · +50% to this module's power — hosts Additive Synth · C4");
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

  it("the expanded face gains the mutator line", () => {
    seedMutatorEra();
    const synth = app.state.modules[0]!;
    app.select(synth.id);
    const bloom = document.getElementById("module-bloom")!;
    expect(bloom.hidden).toBe(false);
    const line = bloom.querySelector(".mut-bloom-line")!;
    expect(line.textContent).toContain("Mutator · Power");
    expect(line.textContent).toContain("+50% to this module's power");
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

describe("flow locks the layer away", () => {
  it("the board locks during flow: no tabs, no tray, no gestures", () => {
    seedMutatorEra();
    app.mutSetLayer("mutators");
    app.beginFlow(null);
    app.render();
    expect(document.getElementById("mut-tabs")!.hidden).toBe(true);
    expect(document.getElementById("mutator-tray")!.hidden).toBe(true);
    expect(document.querySelector("#grid [data-mut-slot]")).toBeNull();
    // And the engine still refuses behind the UI's gates.
    app.mutPickSlot(hex(0, 0));
    expect(app.ui.mutPopover).toBeNull();
  });
});
