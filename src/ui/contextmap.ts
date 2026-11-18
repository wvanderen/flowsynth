import type { App } from "./app";
import { boardPoint, HEX_RADIUS, hexPoints, HUE_TOKEN_OF } from "./face";
import { BALANCE } from "../engine/constants";
import { cellNoteOf, columnInRange, octaveRowOf, rowInRange } from "../engine/lattice";
import { chordMarkCovers, type ChordMark } from "./chordlayer";
import type { GameState, Hex, ModuleInstance } from "../engine/types";

/* ── The context map (ADR-0072) ───────────────────────
   The details column's head: a miniature of the whole in-range board
   answering one question — where does this voice sit in my formation.
   The opened hex wears the state grammar's firm selected marker; its
   active chords draw in their chord hues, adapted for the miniature's
   scale — a chord the seams carry draws as one center-to-center link
   between its voices (the board's twin edge lines blur together at this
   size), a chord the seams can't keeps its offset outline. Occupied
   cells dot their category hue so the voice's neighborhood reads without
   a legend; owned-but-empty cells shade in the panel tier; unowned
   in-range space stays hairline. Owned cells navigate: click, Enter, or
   Space opens that coordinate's Hex detail (the opened cell itself stays
   a marker, not a control). No charge leads, no idle chords, no chip
   labels — the formation is the content. */

// The miniature's frame in CSS pixels — the details column's width at
// the map's own aspect.
const MAP_WIDTH = 264;
const MAP_HEIGHT = 172;

// The window's column bounds, mirrored from the lattice's own gate
// (five columns before the start column, twelve wide).
const MIN_Q = -5;
const MAX_Q = -5 + 11;

// Every in-range cell: the launch band's rows plus the Row unlock's rows,
// across the twelve-column fifths window — the same patch the board
// draws, enumerated from the lattice's one projection.
function inRangeCells(state: GameState): Hex[] {
  const rows = new Set<number>();
  for (let row = -BALANCE.launchRowsBelow; row <= BALANCE.launchRowsAbove; row++) rows.add(row);
  for (const row of state.unlockedRows) rows.add(row);
  const cells: Hex[] = [];
  for (let q = MIN_Q; q <= MAX_Q; q++) {
    for (const row of rows) cells.push({ q, r: row - Math.floor((7 * q) / 12) });
  }
  return cells.filter((pos) => rowInRange(state, octaveRowOf(pos)) && columnInRange(pos));
}

export function contextMapSvg(state: GameState, pos: Hex, module: ModuleInstance | undefined, marks: ChordMark[], expanded = false): string {
  const cells = inRangeCells(state);
  if (cells.length === 0) return "";
  const points = cells.map((cell) => boardPoint(cell));
  const minX = Math.min(...points.map((p) => p[0])) - HEX_RADIUS;
  const maxX = Math.max(...points.map((p) => p[0])) + HEX_RADIUS;
  const minY = Math.min(...points.map((p) => p[1])) - HEX_RADIUS;
  const maxY = Math.max(...points.map((p) => p[1])) + HEX_RADIUS;
  const scale = Math.min(MAP_WIDTH / (maxX - minX), MAP_HEIGHT / (maxY - minY));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const at = (x: number, y: number): [number, number] =>
    [(x - cx) * scale + MAP_WIDTH / 2, (y - cy) * scale + MAP_HEIGHT / 2];
  const px = (v: number): string => v.toFixed(2);
  const cellRadius = HEX_RADIUS * scale;
  const ownedSet = new Set(state.cells.map((cell) => `${cell.q},${cell.r}`));
  const occupied = new Map<string, ModuleInstance>();
  for (const other of state.modules) {
    if (other.pos !== null) occupied.set(`${other.pos.q},${other.pos.r}`, other);
  }
  const posOfVoice = new Map(state.modules.filter((m) => m.pos !== null).map((m) => [m.id, m.pos as Hex]));
  // The voice's own active marks (the same rule the readout's chips ask
  // by — containment for the conducting spacer, membership otherwise),
  // scaled into the frame: one hue link per chord the seams carry, the
  // offset outline for a chord they can't.
  const voiceMarks = marks.filter((mark) => !mark.inactive).filter((mark) =>
    module
      ? module.type === "spacer"
        ? chordMarkCovers(mark, boardPoint(pos))
        : mark.voices.includes(module.id)
      : false,
  );
  let chords = "";
  for (const mark of voiceMarks) {
    const hue = `var(--${mark.colorVar})`;
    if (mark.outline) {
      const pts = mark.outline.map(([x, y]) => {
        const [ax, ay] = at(x, y);
        return `${px(ax)},${px(ay)}`;
      }).join(" ");
      chords += `<polygon class="ctx-seam ctx-outline" points="${pts}" stroke="${hue}"/>`;
      continue;
    }
    // The seam geometry is twin edge lines at board scale — at the
    // miniature's the faces nearly touch and any between-faces link is
    // sub-pixel. Draw the chord as the graph edge it is: center to
    // center across the faces, pulled in just short of the dots.
    const placed = mark.voices
      .map((id) => posOfVoice.get(id))
      .filter((p): p is Hex => p !== undefined)
      .map((p) => boardPoint(p));
    if (placed.length < 2) continue;
    let a = placed[0]!;
    let b = placed[1]!;
    let best = -1;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const d = (placed[i]![0] - placed[j]![0]) ** 2 + (placed[i]![1] - placed[j]![1]) ** 2;
        if (d > best) { best = d; a = placed[i]!; b = placed[j]!; }
      }
    }
    const trim = cellRadius * 0.5;
    const len = Math.sqrt(best) || 1;
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    const [x1, y1] = at(a[0] + ux * trim, a[1] + uy * trim);
    const [x2, y2] = at(b[0] - ux * trim, b[1] - uy * trim);
    chords += `<line class="ctx-link" x1="${px(x1)}" y1="${px(y1)}" x2="${px(x2)}" y2="${px(y2)}" stroke="${hue}"/>`;
  }
  let board = "";
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    const [x, y] = points[i]!;
    const [ax, ay] = at(x, y);
    const key = `${cell.q},${cell.r}`;
    const owned = ownedSet.has(key);
    const isOpened = cell.q === pos.q && cell.r === pos.r;
    const resident = occupied.get(key);
    const hexAttrs = `class="ctx-cell${owned ? " owned" : ""}" points="${hexPoints(cellRadius)}"`;
    if (owned && (!isOpened || expanded)) {
      // The owned cell is the map's one navigation: a button in the
      // board grid's own SVG grammar, opening that coordinate's detail.
      board += `<g class="ctx-cell-node" data-ctx-cell="${cell.q},${cell.r}" tabindex="0" role="button" aria-label="${expanded ? "Select" : "Open the Hex detail at"} ${cellNoteOf(cell)} · ${cell.q},${cell.r}"><polygon ${hexAttrs} transform="translate(${px(ax)} ${px(ay)})"/>${resident ? `<circle class="ctx-dot" style="fill:var(--${HUE_TOKEN_OF[resident.type]})" cx="${px(ax)}" cy="${px(ay)}" r="${Math.max(1.6, cellRadius * 0.16).toFixed(2)}"/>` : ""}</g>`;
    } else {
      board += `<polygon ${hexAttrs} transform="translate(${px(ax)} ${px(ay)})"/>`;
      if (resident && !isOpened) {
        board += `<circle class="ctx-dot" style="fill:var(--${HUE_TOKEN_OF[resident.type]})" cx="${px(ax)}" cy="${px(ay)}" r="${Math.max(1.6, cellRadius * 0.16).toFixed(2)}"/>`;
      }
    }
  }
  const [ox, oy] = at(boardPoint(pos)[0], boardPoint(pos)[1]);
  const marker = `<polygon class="ctx-opened" points="${hexPoints(cellRadius)}" transform="translate(${px(ox)} ${px(oy)})"/>`;
  const svg = `<svg class="ctx-map" data-cell-radius="${cellRadius}" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}" role="group" aria-label="Context map — the opened hex, its active chords, and the owned board">${board}${chords}${marker}</svg>`;
  if (expanded) return svg;
  const touchSvg = svg.replace(/data-ctx-cell="[^"]*"/g, "").replace(/tabindex="0"/g, "").replace(/role="button"/g, "").replace('role="group"', 'aria-hidden="true"');
  return `<div class="ctx-navigation"><div class="ctx-desktop">${svg}</div><button class="ctx-touch" data-context-expand aria-label="Open cell navigator">${touchSvg}</button></div>`;
}

export function openContextMap(app: App, currentMarks: () => ChordMark[]): void {
  const detail = app.ui.detail;
  if (!detail) return;
  const invoker = document.activeElement as HTMLElement | null;
  const dialog = document.createElement("dialog");
  dialog.className = "context-overview";
  dialog.setAttribute("aria-label", "Open hex");
  const module = app.state.modules.find(m => m.pos?.q === detail.pos.q && m.pos?.r === detail.pos.r);
  dialog.innerHTML = `<div class="context-overview-face"><header><h2>Open hex</h2><button data-map-close>Close</button></header><div class="context-overview-stage">${contextMapSvg(app.state, detail.pos, module, currentMarks(), true)}</div><label class="map-zoom">Zoom <input type="range" min="100" max="400" value="100" aria-label="Context map zoom"></label><div class="context-selection"><output class="mono" data-map-selection aria-live="polite"></output><div class="context-navigation-actions"><button data-map-go>Navigate</button><button data-map-go-close>Navigate &amp; close</button></div></div></div>`;
  document.body.append(dialog);
  let closed = false;
  let forget = () => {};
  let resize: ResizeObserver | undefined;
  const close = () => {
    if (closed) return;
    closed = true;
    resize?.disconnect();
    dialog.close(); dialog.remove(); forget();
    (invoker?.isConnected ? invoker : document.querySelector<HTMLElement>("[data-context-expand]"))?.focus();
  };
  forget = app.ownCleanup(close);
  dialog.querySelector("[data-map-close]")!.addEventListener("click", close);
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  dialog.addEventListener("keydown", event => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); } });
  dialog.addEventListener("click", event => { if (event.target === dialog) close(); });
  let selected = { ...detail.pos };
  const selection = dialog.querySelector<HTMLOutputElement>("[data-map-selection]")!;
  const paintSelection = () => {
    selection.textContent = `${cellNoteOf(selected)} · ${selected.q},${selected.r}`;
    dialog.querySelectorAll<SVGElement>("[data-ctx-cell]").forEach(node => {
      const active = node.dataset.ctxCell === `${selected.q},${selected.r}`;
      node.classList.toggle("ctx-selected", active);
      node.setAttribute("aria-pressed", String(active));
    });
  };
  const navigate = (dismiss: boolean) => {
    app.openDetail(selected, detail.face);
    // The detail render has refreshed the chord cache for this destination.
    // Keep the SVG root (and its pan/zoom listeners), but replace its facts.
    const resident = app.state.modules.find(m => m.pos?.q === selected.q && m.pos?.r === selected.r);
    const fresh = document.createElement("template");
    fresh.innerHTML = contextMapSvg(app.state, selected, resident, currentMarks(), true);
    svg.innerHTML = fresh.content.querySelector("svg")!.innerHTML;
    paintSelection();
    if (dismiss) {
      close();
      document.getElementById("hex-detail-return")?.focus();
    }
  };
  dialog.querySelector("[data-map-go]")!.addEventListener("click", () => navigate(false));
  dialog.querySelector("[data-map-go-close]")!.addEventListener("click", () => navigate(true));
  const select = (event: Event) => {
    const node = event.target instanceof Element ? event.target.closest<SVGElement>("[data-ctx-cell]") : null;
    if (!node) return;
    const [q, r] = node.dataset.ctxCell!.split(",").map(Number);
    selected = { q: q!, r: r! };
    paintSelection();
  };
  // Delegate so replacing destination-dependent map content retains access.
  dialog.addEventListener("click", select);
  dialog.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      if (!(event.target instanceof Element) || !event.target.closest("[data-ctx-cell]")) return;
      event.preventDefault(); select(event);
    }
  });
  paintSelection();
  const svg = dialog.querySelector<SVGSVGElement>(".ctx-map")!;
  const slider = dialog.querySelector<HTMLInputElement>("input")!;
  let zoom = 1, minimumZoom = 1, maximumZoom = 4;
  let x = MAP_WIDTH / 2, y = MAP_HEIGHT / 2, moved = false;
  const paint = () => {
    zoom = Math.max(minimumZoom, Math.min(maximumZoom, zoom));
    const w = MAP_WIDTH / zoom, h = MAP_HEIGHT / zoom;
    svg.setAttribute("viewBox", `${x - w / 2} ${y - h / 2} ${w} ${h}`);
    slider.value = String(Math.round(zoom * 100));
  };
  slider.addEventListener("input", () => { zoom = Number(slider.value) / 100; paint(); });
  svg.addEventListener("focusin", event => {
    const cell = event.target instanceof Element ? event.target.closest("[data-ctx-cell]") : null;
    const transform = cell?.querySelector("polygon")?.getAttribute("transform");
    const center = transform?.match(/translate\(([-\d.]+) ([-\d.]+)\)/);
    if (!center) return;
    const cx = Number(center[1]), cy = Number(center[2]);
    const radius = Number(svg.getAttribute("data-cell-radius"));
    if (Math.abs(cx - x) + radius > MAP_WIDTH / zoom / 2 || Math.abs(cy - y) + radius > MAP_HEIGHT / zoom / 2) {
      x = cx; y = cy; paint();
    }
  });
  const contacts = new Map<number, { x: number; y: number }>();
  svg.addEventListener("pointerdown", event => {
    moved = false; contacts.set(event.pointerId, { x: event.clientX, y: event.clientY });
  });
  const centroid = () => {
    const values = [...contacts.values()];
    return { x: values.reduce((sum,p) => sum+p.x,0)/values.length, y: values.reduce((sum,p) => sum+p.y,0)/values.length, d: values.length>1 ? Math.hypot(values[0]!.x-values[1]!.x,values[0]!.y-values[1]!.y) : 0 };
  };
  svg.addEventListener("pointermove", event => {
    const before = contacts.get(event.pointerId);
    if (!before) return;
    if (!moved && Math.hypot(event.clientX-before.x,event.clientY-before.y)<5) return;
    moved = true;
    svg.setPointerCapture(event.pointerId);
    const old = centroid(); contacts.set(event.pointerId, { x:event.clientX,y:event.clientY }); const next=centroid();
    const scale=Math.min(svg.clientWidth/(MAP_WIDTH/zoom),svg.clientHeight/(MAP_HEIGHT/zoom));
    x -= (next.x-old.x)/scale; y -= (next.y-old.y)/scale;
    if(old.d>0) zoom=zoom*next.d/old.d;
    paint();
  });
  for (const type of ["pointerup","pointercancel"] as const) dialog.addEventListener(type, event => contacts.delete(event.pointerId));
  svg.addEventListener("click", event => { if(moved){event.preventDefault();event.stopPropagation();} },true);
  svg.addEventListener("wheel", event => {
    event.preventDefault();
    if(event.ctrlKey) zoom=zoom*Math.exp(-event.deltaY*.01);
    else { const scale=Math.min(svg.clientWidth/(MAP_WIDTH/zoom),svg.clientHeight/(MAP_HEIGHT/zoom)); x+=event.deltaX/scale; y+=event.deltaY/scale; }
    paint();
  },{passive:false});
  dialog.showModal();
  // A full-board fit can leave phone cells too small to select. Keep each
  // hex's inscribed diameter at least 44 CSS px, even at minimum zoom.
  // Recalculate on resize and allow further zoom on arbitrarily tall boards.
  const fitTargets = () => {
    const scale = Math.min(svg.clientWidth / MAP_WIDTH, svg.clientHeight / MAP_HEIGHT);
    if (!(scale > 0)) return; // Non-layout test environments have no viewport.
    const diameter = Math.sqrt(3) * Number(svg.getAttribute("data-cell-radius"));
    minimumZoom = Math.max(1, Math.ceil(100 * 44 / (diameter * scale)) / 100);
    maximumZoom = Math.max(4, minimumZoom * 4);
    slider.min = String(Math.round(minimumZoom * 100));
    slider.max = String(Math.round(maximumZoom * 100));
    paint();
  };
  // Start over the opened cell rather than the full board's geometric center.
  const marker = svg.querySelector(".ctx-opened")!.getAttribute("transform")!;
  const center = marker.match(/translate\(([-\d.]+) ([-\d.]+)\)/)!;
  x = Number(center[1]); y = Number(center[2]);
  fitTargets();
  resize = new ResizeObserver(fitTargets);
  resize.observe(svg);
}
