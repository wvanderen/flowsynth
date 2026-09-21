// The drag machine: shared pointer-drag binding for grid modules and
// inventory items — a ghost after a small threshold, hover-target painting,
// click suppression, and drop routing (place, swap, combine with a twin, or
// return to inventory). The pinned Carrier refuses the drag at the
// threshold: a face shake plus the canonical sentence.
//
// Hit-testing arrives through the dropTargetAt adapter — the real one wraps
// document.elementFromPoint; tests inject a fake, because layoutless DOM
// returns null for everything. Two adapters make this a real seam.
import { isCarrier } from "../engine/state";
import { deployedAt } from "../engine/economy";
import { NEXT_RARITY } from "../engine/constants";
import { HEX_RADIUS, hexPoints, hexTileSvg } from "./face";
import { PINNED_SENTENCE } from "./lexicon";
import type { RenderContext } from "./context";

/** Resolves the element under a viewport point, for hit-testing. */
export type DropTargetAt = (x: number, y: number) => Element | null;

/** The real adapter: the browser's own hit test. */
export const domDropTargetAt: DropTargetAt = (x, y) => document.elementFromPoint(x, y);

const DRAG_THRESHOLD_PX = 6;

// The canonical pinned sentence (#94): the inspector's note and the drag
// refusal's toast say exactly the same thing, once worded.

// The pinned face's visible refusal: a short shake on the module node (which
// only grid cells carry — the Carrier can never reach inventory). The
// translate property keeps the arranging lift intact, and the class restarts
// cleanly on repeat attempts.
function refusePinnedDrag(element: Element): void {
  const node = element.querySelector(".module-node");
  if (!node) return;
  node.classList.remove("pin-refused");
  node.getBoundingClientRect(); // flush style so re-adding restarts the shake
  node.classList.add("pin-refused");
  node.addEventListener("animationend", () => node.classList.remove("pin-refused"), { once: true });
}

export function bindPointerDrag(
  ctx: RenderContext,
  element: Element,
  moduleId: string | (() => string | null),
  dropTargetAt: DropTargetAt = domDropTargetAt,
): void {
  const { state, ui, intents } = ctx;
  element.addEventListener("pointerdown", (baseEvent: Event) => {
    const event = baseEvent as PointerEvent;
    if (event.button !== 0 || !ui.managing || state.mode !== "upgrade" || ui.reshape || ui.buyingCell) return;
    const id = typeof moduleId === "function" ? moduleId() : moduleId;
    if (!id) return;
    const dragModule = state.modules.find((m) => m.id === id) ?? null;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    let ghost: HTMLDivElement | null = null;
    let hoverTarget: Element | null = null;
    const zone = document.getElementById("inventory-zone");
    const canCombineWith = (occupant: { id: string; type: string; rarity: string } | undefined): boolean =>
      !!dragModule &&
      !!occupant &&
      occupant.id !== dragModule.id &&
      occupant.type === dragModule.type &&
      occupant.rarity === dragModule.rarity &&
      NEXT_RARITY[dragModule.rarity] !== null;

    const setHoverTarget = (ev: PointerEvent) => {
      const hit = dropTargetAt(ev.clientX, ev.clientY);
      const cellNode = hit?.closest("[data-cell]") ?? null;
      if (cellNode !== hoverTarget) {
        hoverTarget?.querySelector(".hex")?.classList.remove("drop-target", "combine-target");
        hoverTarget = cellNode;
        const [q, r] = (hoverTarget?.getAttribute("data-cell") ?? "").split(",").map(Number);
        const occupant =
          hoverTarget && Number.isFinite(q) && Number.isFinite(r)
            ? state.modules.find((m) => m.pos !== null && m.pos.q === q && m.pos.r === r)
            : undefined;
        hoverTarget
          ?.querySelector(".hex")
          ?.classList.add(canCombineWith(occupant) ? "combine-target" : "drop-target");
      }
      const overZone = !!hit?.closest("#inventory-zone");
      zone?.classList.toggle("drag-over", overZone);
    };

    const suppressNextClick = () => {
      const suppress = (clickEvent: Event) => {
        clickEvent.preventDefault();
        clickEvent.stopImmediatePropagation();
      };
      document.addEventListener("click", suppress, { capture: true, once: true });
      setTimeout(() => document.removeEventListener("click", suppress, true), 0);
    };
    let refused = false;
    const move = (ev: PointerEvent) => {
      if (!moved && !refused && Math.hypot(ev.clientX - startX, ev.clientY - startY) > DRAG_THRESHOLD_PX) {
        if (dragModule && isCarrier(dragModule)) {
          refused = true;
          intents.say(PINNED_SENTENCE);
          refusePinnedDrag(element);
          suppressNextClick();
          return;
        }
        moved = true;
        const module = state.modules.find((m) => m.id === id);
        // The ghost is the module's own hex tile — what you carry is what you
        // drop — centered under the cursor.
        ghost = document.createElement("div");
        ghost.className = "drag-ghost";
        if (module) ghost.dataset.rarity = module.rarity;
        ghost.innerHTML = module
          ? hexTileSvg(module)
          : `<svg viewBox="-75 -75 150 150" aria-hidden="true"><polygon class="hex" points="${hexPoints(HEX_RADIUS)}"/></svg>`;
        document.body.append(ghost);
        element.classList.add("dragging");
      }
      if (ghost) {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
        setHoverTarget(ev);
      }
    };
    const finish = (ev: PointerEvent, apply: boolean) => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", cancel);
      ghost?.remove();
      element.classList.remove("dragging");
      hoverTarget?.querySelector(".hex")?.classList.remove("drop-target", "combine-target");
      hoverTarget = null;
      zone?.classList.remove("drag-over");
      if (!apply || !moved) return;
      suppressNextClick();
      const target = dropTargetAt(ev.clientX, ev.clientY);
      const cellNode = target?.closest("[data-cell]");
      if (target?.closest("#inventory-zone")) {
        intents.returnToInventory(id);
      } else if (cellNode) {
        const cell = cellNode.getAttribute("data-cell")!.split(",").map(Number);
        const pos = { q: cell[0]!, r: cell[1]! };
        const occupant = deployedAt(state, pos);
        if (canCombineWith(occupant)) intents.dropCombine(id, occupant!.id, pos);
        else intents.pickCellThenPlace(id, pos);
      }
    };
    const up = (ev: PointerEvent) => finish(ev, true);
    const cancel = () => finish(new PointerEvent("pointerup"), false);
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", cancel);
  });
}
