// Board navigation (§7): the viewBox is the only lens. Zoom shrinks the
// base viewBox around the pan center; pan is the world point held at the
// wrap's center; the pan center clamps to the base bounds, so a full or
// larger-than-screen board always stays reachable. World coordinates never
// move — seams, chips, and bloom frames are zoom-agnostic by construction.
import type { App } from "./app";

// The zoom range (prototype tuning, #121): fitted is 1; a hair below 1 lets
// a wide board letterbox more tightly, 3× is comfortably inside a face.
export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 3;
// The wheel and the cluster buttons ride the same factor.
const ZOOM_STEP = 1.25;

// The lens's base: the board's own bounds plus breathing room for the chip
// layer above the top row and the faces' shadows below.
export interface BoardBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function boardBounds(points: [number, number][], padX: number, padTop: number, padBottom: number): BoardBounds {
  const minX = Math.min(...points.map((p) => p[0]));
  const maxX = Math.max(...points.map((p) => p[0]));
  const minY = Math.min(...points.map((p) => p[1]));
  const maxY = Math.max(...points.map((p) => p[1]));
  return { x: minX - padX, y: minY - padTop, width: maxX - minX + 2 * padX, height: maxY - minY + padTop + padBottom };
}

function boundsCenter(bounds: BoardBounds): { x: number; y: number } {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

// The clamped pan center: the board's bounds always intersect the frame.
// A null pan means fitted — the wrap holds the bounds' center.
export function resolvePan(pan: { x: number; y: number } | null, bounds: BoardBounds): { x: number; y: number } {
  const at = pan ?? boundsCenter(bounds);
  return {
    x: Math.min(bounds.x + bounds.width, Math.max(bounds.x, at.x)),
    y: Math.min(bounds.y + bounds.height, Math.max(bounds.y, at.y)),
  };
}

// A render-cycle reading of the lens: the viewBox string for the svg and
// the ViewFrame the bloom math consumes, cut from the same numbers.
export interface LensFrame {
  viewBox: string;
  view: { x: number; y: number; width: number; height: number };
}

export function lensFrame(zoom: number, pan: { x: number; y: number } | null, bounds: BoardBounds): LensFrame {
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
  const center = resolvePan(pan, bounds);
  const width = bounds.width / z;
  const height = bounds.height / z;
  const view = { x: center.x - width / 2, y: center.y - height / 2, width, height };
  return {
    viewBox: `${view.x.toFixed(2)} ${view.y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)}`,
    view,
  };
}

const ZOOM_CLUSTER_SVG = {
  in: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 6v12M6 12h12"/></svg>`,
  out: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 12h12"/></svg>`,
  fit: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/></svg>`,
};

// The zoom cluster (§7): +/−/fit floating over the board's right edge,
// below the chord readout and beside the horizon bar; wheel zoom rides the board.
export function renderZoomCluster(app: App): void {
  const host = document.getElementById("zoom-cluster");
  if (!host) return;
  if (host.dataset.renderKey) return;
  host.dataset.renderKey = "cluster";
  host.innerHTML = `
    <button id="zoom-in" aria-label="Zoom in" title="Zoom in">${ZOOM_CLUSTER_SVG.in}</button>
    <button id="zoom-out" aria-label="Zoom out" title="Zoom out">${ZOOM_CLUSTER_SVG.out}</button>
    <button id="zoom-fit" aria-label="Fit the board" title="Fit the board">${ZOOM_CLUSTER_SVG.fit}</button>`;
  app.listen(host.querySelector("#zoom-in"), "click", () => zoomBy(app, ZOOM_STEP));
  app.listen(host.querySelector("#zoom-out"), "click", () => zoomBy(app, 1 / ZOOM_STEP));
  app.listen(host.querySelector("#zoom-fit"), "click", () => fitBoard(app));
}

// Zooming keeps one world point fixed: with a pointer anchor that is the
// point under the cursor, so the board grows beneath it instead of sliding
// away; without one, the wrap's center holds and the cluster buttons feel
// like the board breathing.
export function zoomBy(app: App, factor: number, anchor?: { x: number; y: number }): void {
  const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, app.ui.zoom * factor));
  if (next === app.ui.zoom) return;
  const bounds = app.boardBounds;
  const center = boundsCenter(bounds);
  const anchorAt = anchor ?? center;
  const kept = {
    x: center.x + (anchorAt.x - center.x) * (1 - app.ui.zoom / next),
    y: center.y + (anchorAt.y - center.y) * (1 - app.ui.zoom / next),
  };
  app.ui.zoom = next;
  app.ui.pan = resolvePan(kept, bounds);
  app.render();
}

export function fitBoard(app: App): void {
  app.ui.zoom = 1;
  app.ui.pan = null;
  app.render();
}

// Wheel zoom keeps the cursor's world point anchored.
export function zoomAtPointer(app: App, factor: number, clientX: number, clientY: number): void {
  const svg = document.getElementById("grid") as SVGSVGElement | null;
  const rect = svg?.getBoundingClientRect();
  if (!svg || !rect || rect.width <= 0 || rect.height <= 0) {
    zoomBy(app, factor);
    return;
  }
  const frame = lensFrame(app.ui.zoom, app.ui.pan, app.boardBounds);
  const u = (clientX - rect.left) / rect.width;
  const v = (clientY - rect.top) / rect.height;
  zoomBy(app, factor, { x: frame.view.x + u * frame.view.width, y: frame.view.y + v * frame.view.height });
}

// Pan by dragging (§7): outside the grid at any zoom — the bare svg
// background — and inside the grid when zoomed in, so a zoomed board can
// always be walked around. Clamped so the board never leaves the frame.
// A drag past the threshold swallows the release click, exactly like a
// module drag.
const PAN_DRAG_THRESHOLD_PX = 5;

const panBoundBoards = new WeakSet<SVGSVGElement>();

export function bindBoardNavigation(app: App, svg: SVGSVGElement): void {
  if (panBoundBoards.has(svg)) return;
  panBoundBoards.add(svg);

  app.listen(svg, "wheel", (event) => {
    event.preventDefault();
    // Scroll up zooms in; scroll down eases back out.
    zoomAtPointer(app, event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, event.clientX, event.clientY);
  }, { passive: false });

  const startPan = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const wrapWidth = svg.clientWidth;
    const wrapHeight = svg.clientHeight;
    if (wrapWidth <= 0 || wrapHeight <= 0) return;
    const start = lensFrame(app.ui.zoom, app.ui.pan, app.boardBounds).view;
    const wx = start.width / wrapWidth;
    const wy = start.height / wrapHeight;
    const origin = { x: event.clientX, y: event.clientY, pan: resolvePan(app.ui.pan, app.boardBounds) };
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) > PAN_DRAG_THRESHOLD_PX) moved = true;
      if (!moved) return;
      app.ui.pan = resolvePan(
        { x: origin.pan.x - (ev.clientX - origin.x) * wx, y: origin.pan.y - (ev.clientY - origin.y) * wy },
        app.boardBounds,
      );
      // Pan repaints the lens without a full render: the viewBox is the
      // only thing that moves.
      svg.setAttribute("viewBox", lensFrame(app.ui.zoom, app.ui.pan, app.boardBounds).viewBox);
    };
    let finished = false;
    let forget = () => {};
    const finish = () => {
      if (finished) return;
      finished = true;
      forget();
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
      if (moved && !app.released) {
        // A pan is a gesture, not a click: the release must not fall
        // through to whatever cell sits under it.
        app.suppressClick();
        app.render();
      }
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", finish);
    forget = app.ownCleanup(finish);
  };

  // Outside the grid — the bare svg — pans at any zoom.
  app.listen(svg, "pointerdown", (event) => {
    if (event.target === svg) startPan(event);
  });

  // Press-and-move on an empty cell pans too once zoomed in: the world
  // under the finger follows it. At fitted zoom the tap stays a tap.
  app.listen(svg, "pointerdown", (event) => {
    if (event.target === svg || event.button !== 0) return;
    if (app.ui.zoom <= 1) return;
    const cellNode = (event.target as Element).closest?.("[data-cell]");
    if (!cellNode || cellNode.querySelector(".module-node")) return;
    if (app.ui.placing || app.ui.buyingCell) return;
    startPan(event);
  });
}
