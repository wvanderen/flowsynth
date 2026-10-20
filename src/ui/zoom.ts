// Board navigation (§7): the viewBox is the only lens. Zoom shrinks the
// base viewBox around the pan center; pan is the world point held at the
// wrap's center; the pan center clamps to the base bounds, so a full or
// larger-than-screen board always stays reachable. World coordinates never
// move — seams, chips, and bloom frames are zoom-agnostic by construction.
import type { App } from "./app";
import { HEX_RADIUS } from "./face";

// The zoom range (prototype tuning, #121): fitted is 1; a hair below 1 lets
// a wide board letterbox more tightly, 3× is comfortably inside a face.
export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 3;

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
  view: ViewRect;
}

// The lens's world-space rectangle: what the board can currently see.
export interface ViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
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

// Slider nodes survive render ticks, including while the thumb is held.
export function renderZoomCluster(app: App): void {
  const host = document.getElementById("zoom-cluster");
  if (!host) return;
  if (!host.dataset.renderKey) {
    host.dataset.renderKey = "slider";
    host.innerHTML = `<input id="board-zoom" type="range" min="80" max="300" step="1" aria-label="Board zoom"><output id="board-zoom-value" for="board-zoom"></output><button id="zoom-fit" aria-label="Reset board position and zoom">Reset</button>`;
    app.listen(host.querySelector("#board-zoom"), "input", (event) => zoomBy(app, Number((event.target as HTMLInputElement).value) / 100 / app.ui.zoom));
    app.listen(host.querySelector("#zoom-fit"), "click", () => fitBoard(app));
  }
  const input = host.querySelector<HTMLInputElement>("#board-zoom")!;
  const value = String(Math.round(app.ui.zoom * 100));
  if (input.value !== value) input.value = value;
  host.querySelector("output")!.textContent = `${value}%`;
}

// Zooming keeps one world point fixed: with a pointer anchor that is the
// point under the cursor, so the board grows beneath it instead of sliding
// away; without one, the wrap's center holds and the cluster buttons feel
// like the board breathing.
export function zoomBy(app: App, factor: number, anchor?: { x: number; y: number }): void {
  const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, app.ui.zoom * factor));
  if (next === app.ui.zoom) return;
  const bounds = app.boardBounds;
  const center = resolvePan(app.ui.pan, bounds);
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

// The breathe's lens (issue #348): a lit module the current view can't see
// rests its glow — no animation, no light, no per-frame work — and picks
// the breathe back up when the lens brings it home. The sweep reads each
// lit face's world position off its cell's transform — the translate the
// render path writes from the same projection that drew it — and compares
// it with the view rect plus a margin of the chassis radius and the glow's
// blur spill, so only safely unseen hexes ever rest. Both lens paths call
// it: the render path (renderGrid) and the pan path below, where the
// viewBox moves without a render.
const GLOW_SPILL = 8;

// The lens margin a lit hex must clear before its glow rests.
export const GLOW_REACH = HEX_RADIUS + GLOW_SPILL;

export function syncGlowLens(svg: SVGSVGElement, view: ViewRect): void {
  // The grid uses SVG's default xMidYMid meet. Letterbox bands expose
  // world content beyond the viewBox, so include that content before culling.
  const width = svg.clientWidth;
  const height = svg.clientHeight;
  const scale = width > 0 && height > 0
    ? Math.min(width / view.width, height / view.height)
    : 0;
  const extraX = scale > 0 ? (width / scale - view.width) / 2 : 0;
  const extraY = scale > 0 ? (height / scale - view.height) / 2 : 0;
  const left = view.x - extraX - GLOW_REACH;
  const right = view.x + view.width + extraX + GLOW_REACH;
  const top = view.y - extraY - GLOW_REACH;
  const bottom = view.y + view.height + extraY + GLOW_REACH;
  for (const glow of svg.querySelectorAll<SVGElement>(".module-node > .hex-glow")) {
    const at = glow.closest(".cell-node")?.getAttribute("transform")?.match(/-?[\d.]+/g);
    const x = at ? Number(at[0]) : NaN;
    const y = at ? Number(at[1]) : NaN;
    const off = Number.isNaN(x) || Number.isNaN(y) || x < left || x > right || y < top || y > bottom;
    glow.classList.toggle("off-view", off);
  }
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
  const scale = Math.min(rect.width / frame.view.width, rect.height / frame.view.height);
  zoomBy(app, factor, {
    x: frame.view.x + frame.view.width / 2 + (clientX - rect.left - rect.width / 2) / scale,
    y: frame.view.y + frame.view.height / 2 + (clientY - rect.top - rect.height / 2) / scale,
  });
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

  let space = false;
  const editing = (target: EventTarget | null): boolean => target instanceof Element && !!target.closest("input, textarea, select, button, a, [contenteditable], [role=button], [role=slider], [role=dialog], dialog");
  app.listen(document, "keydown", (event) => {
    if (event.code !== "Space" || editing(event.target) || app.ui.modal) return;
    space = true;
    event.preventDefault();
    svg.classList.add("pan-ready");
  });
  const releaseSpace = () => { space = false; svg.classList.remove("pan-ready"); };
  app.listen(document, "keyup", (event) => { if (event.code === "Space") releaseSpace(); });
  app.listen(window, "blur", releaseSpace);

  const scale = (): number => {
    const view = lensFrame(app.ui.zoom, app.ui.pan, app.boardBounds).view;
    return Math.min(svg.clientWidth / view.width, svg.clientHeight / view.height) || 1;
  };
  const paint = () => {
    const lens = lensFrame(app.ui.zoom, app.ui.pan, app.boardBounds);
    svg.setAttribute("viewBox", lens.viewBox);
    syncGlowLens(svg, lens.view);
  };
  const panBy = (dx: number, dy: number) => {
    const center = resolvePan(app.ui.pan, app.boardBounds);
    const px = scale();
    app.ui.pan = resolvePan({ x: center.x - dx / px, y: center.y - dy / px }, app.boardBounds);
    paint();
  };
  let pendingWheel: { dx: number; dy: number; factor: number; x: number; y: number } | null = null;
  let wheelFrame: number | null = null;
  const flushWheel = () => {
    wheelFrame = null;
    const next = pendingWheel;
    pendingWheel = null;
    if (!next || app.released) return;
    panBy(next.dx, next.dy);
    if (next.factor !== 1) zoomAtPointer(app, next.factor, next.x, next.y);
  };
  app.listen(svg, "wheel", (event) => {
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? svg.clientHeight : 1;
    const previous = pendingWheel;
    pendingWheel = {
      dx: (previous?.dx ?? 0) + (event.ctrlKey ? 0 : event.deltaX * unit),
      dy: (previous?.dy ?? 0) + (event.ctrlKey ? 0 : event.deltaY * unit),
      factor: (previous?.factor ?? 1) * (event.ctrlKey ? Math.exp(-event.deltaY * unit * .01) : 1),
      x: event.clientX, y: event.clientY,
    };
    if (wheelFrame !== null) return;
    if (typeof requestAnimationFrame === "function") wheelFrame = requestAnimationFrame(flushWheel);
    else flushWheel();
  }, { passive: false });
  const glowResize = new ResizeObserver(() => { if (!app.released) paint(); });
  glowResize.observe(svg);
  app.ownCleanup(() => { glowResize.disconnect(); if (wheelFrame !== null) cancelAnimationFrame(wheelFrame); });

  const pointers = new Map<number, { x: number; y: number }>();
  let dragging: { id: number; x: number; y: number; moved: boolean } | null = null;
  let multi = false;
  const centroid = () => {
    const [a, b] = [...pointers.values()];
    return { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2, distance: Math.hypot(a!.x - b!.x, a!.y - b!.y) };
  };
  app.listen(svg, "pointerdown", (event) => {
    if (event.button !== 0) return;
    if (event.pointerType === "touch") pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2) {
      // A second finger takes ownership from any in-flight placement drag.
      cancellingPlacement = true;
      for (const id of pointers.keys()) document.dispatchEvent(new PointerEvent("pointercancel", { pointerId: id }));
      cancellingPlacement = false;
      multi = true;
      dragging = null;
      app.suppressClick();
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const target = event.target as Element;
    const empty = target.closest?.("[data-cell]") && !target.closest("[data-cell]")?.querySelector(".module-node");
    if (!space && target !== svg && !(empty && app.ui.zoom > 1 && !app.ui.placing && !app.ui.buyingCell)) return;
    dragging = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    if (space) { event.preventDefault(); event.stopPropagation(); }
  }, { capture: true });
  app.listen(document, "pointermove", (event) => {
    if (multi && pointers.has(event.pointerId) && pointers.size >= 2) {
      const before = centroid();
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const after = centroid();
      panBy(after.x - before.x, after.y - before.y);
      zoomAtPointer(app, before.distance > 0 ? after.distance / before.distance : 1, after.x, after.y);
      event.preventDefault();
      return;
    }
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!dragging || dragging.id !== event.pointerId || multi) return;
    const dx = event.clientX - dragging.x, dy = event.clientY - dragging.y;
    if (!dragging.moved && Math.hypot(dx, dy) <= PAN_DRAG_THRESHOLD_PX) return;
    dragging.moved = true;
    panBy(dx, dy);
    dragging.x = event.clientX; dragging.y = event.clientY;
    event.preventDefault();
  }, { passive: false });
  let cancellingPlacement = false;
  const finish = (event: PointerEvent) => {
    if (cancellingPlacement) return;
    pointers.delete(event.pointerId);
    if (multi || dragging?.moved) app.suppressClick();
    if (pointers.size === 0) multi = false;
    if (dragging?.id === event.pointerId) dragging = null;
  };
  app.listen(document, "pointerup", finish);
  app.listen(document, "pointercancel", finish);
}
