// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from "vitest";
import { hex } from "../engine/hex";
import { give } from "../engine/fixtures";
import { createInitialState } from "../engine/state";
import { PINNED_SENTENCE } from "./lexicon";
import { bindPointerDrag } from "./drag";
import type { UiIntents } from "./context";
import type { UiState } from "./app";
import type { Hex } from "../engine/types";

// The drag machine's interface test: pointer sequence in, intents out, with
// hit-testing arriving through the injected adapter — the one seam that makes
// drop routing testable in a layoutless DOM.

const freshUi = (): UiState => ({
  selected: null,
  app: null,
  placing: null,
  managing: true,
  reshape: null,
  buyingCell: false,
  modal: null,
  importError: null,
  chosenTarget: null,
  showChords: false,
});

interface Harness {
  intents: UiIntents;
  calls: { verb: string; args: unknown[] }[];
  state: ReturnType<typeof createInitialState>;
  ui: UiState;
  tile: HTMLElement;
  targetAt: (x: number, y: number) => Element | null;
  setTarget: (element: Element | null) => void;
}

function harness(): Harness {
  const state = createInitialState();
  state.mode = "upgrade";
  const ui = freshUi();
  const calls: { verb: string; args: unknown[] }[] = [];
  const intents = {
    say: (m: string) => calls.push({ verb: "say", args: [m] }),
    returnToInventory: (id: string) => calls.push({ verb: "returnToInventory", args: [id] }),
    dropCombine: (id: string, partner: string, pos: Hex) => calls.push({ verb: "dropCombine", args: [id, partner, pos] }),
    pickCellThenPlace: (id: string, pos: Hex) => calls.push({ verb: "pickCellThenPlace", args: [id, pos] }),
  } as unknown as UiIntents;
  const tile = document.createElement("button");
  document.body.append(tile);
  let target: Element | null = null;
  const h: Harness = {
    intents,
    calls,
    state,
    ui,
    tile,
    targetAt: () => target,
    setTarget: (element) => (target = element),
  };
  bindPointerDrag(
    { state, ui, intents, exitPending: false, forgeFlashUntil: 0, dev: false, memo: { projected: () => { throw new Error("unused"); }, snapshot: () => { throw new Error("unused"); } } },
    tile,
    "drag-me",
    h.targetAt,
  );
  // The dragged module exists under a fixed id the harness controls.
  give(state, "additive", hex(0, 0)).id = "drag-me";
  return h;
}

const cellNode = (q: number, r: number): Element => {
  const node = document.createElement("g");
  node.setAttribute("data-cell", `${q},${r}`);
  return node;
};

const drag = (h: Harness, from: [number, number], to: [number, number], drop: Element | null): void => {
  h.tile.dispatchEvent(new MouseEvent("pointerdown", { clientX: from[0], clientY: from[1], button: 0 }));
  document.dispatchEvent(new MouseEvent("pointermove", { clientX: to[0], clientY: to[1] }));
  h.setTarget(drop);
  document.dispatchEvent(new MouseEvent("pointerup", { clientX: to[0], clientY: to[1] }));
};

describe("the drag machine (drop routing through the hit-test seam)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("drops onto a twin: same type and rarity combines", () => {
    const h = harness();
    const twin = give(h.state, "additive", hex(1, 0));
    drag(h, [100, 100], [160, 130], cellNode(1, 0));
    expect(h.calls).toEqual([{ verb: "dropCombine", args: ["drag-me", twin.id, { q: 1, r: 0 }] }]);
  });

  it("drops onto an unlike occupant or an empty cell: a plain place", () => {
    const h = harness();
    give(h.state, "infusor", hex(1, 0));
    drag(h, [100, 100], [160, 130], cellNode(1, 0));
    expect(h.calls).toEqual([{ verb: "pickCellThenPlace", args: ["drag-me", { q: 1, r: 0 }] }]);
  });

  it("drops into the inventory zone: a return", () => {
    const h = harness();
    const zone = document.createElement("div");
    zone.id = "inventory-zone";
    const inside = document.createElement("p");
    zone.append(inside);
    document.body.append(zone);
    drag(h, [100, 100], [160, 130], inside);
    expect(h.calls).toEqual([{ verb: "returnToInventory", args: ["drag-me"] }]);
  });

  it("drops onto nothing: no intent fires", () => {
    const h = harness();
    drag(h, [100, 100], [160, 130], null);
    expect(h.calls).toEqual([]);
  });

  it("refuses the pinned Carrier at the threshold: the canonical sentence, no drop", () => {
    const h = harness();
    // Swap the dragged module for the pinned Carrier under the same id.
    h.state.modules = h.state.modules.filter((m) => m.id !== "drag-me");
    const pinned = give(h.state, "carrier", hex(0, 0));
    pinned.id = "drag-me";
    h.tile.dispatchEvent(new MouseEvent("pointerdown", { clientX: 100, clientY: 100, button: 0 }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 160, clientY: 130 }));
    h.setTarget(cellNode(1, 0));
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 160, clientY: 130 }));
    expect(h.calls).toEqual([{ verb: "say", args: [PINNED_SENTENCE] }]);
  });

  it("a real drop suppresses the click that follows the pointer", () => {
    const h = harness();
    drag(h, [100, 100], [160, 130], cellNode(1, 0));
    const click = new Event("click", { cancelable: true });
    document.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
  });

  it("a drag below the threshold never moves: pointerup places nothing", () => {
    const h = harness();
    h.tile.dispatchEvent(new MouseEvent("pointerdown", { clientX: 100, clientY: 100, button: 0 }));
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 103, clientY: 102 }));
    h.setTarget(cellNode(1, 0));
    document.dispatchEvent(new MouseEvent("pointerup", { clientX: 103, clientY: 102 }));
    expect(h.calls).toEqual([]);
  });
});
