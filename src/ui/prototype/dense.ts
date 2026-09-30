// PROTOTYPE — throwaway artifact for wayfinder ticket #174 (map #169).
// Never merge to main. Lives on the prototype/dense-board-174 branch.
//
// ITERATION FOUR (clarification): the spacer is NOT fully transparent —
// its plate keeps the cap and base where the name and note sit, opening
// only a center window where the chord lines run visibly through.
//
// ITERATION THREE (second reaction): distant bridged pairs stay straight;
// the row unlock settles on the board; the ghost previews wear the same
// seam language as formed chords (hooked in render.ts); and the spacer
// becomes the open wire.
//
// ITERATION TWO (maintainer reaction to one): C wins overall and absorbs
// A's edge seams; the refinements below are all in. A and B stay switchable
// for reference (A now wears the same polygon language; B stays shipped).
//
//   C — the merged direction: chords whisper at rest and lift OVER the
//       faces on selection (the lift clones the focused marks into a top
//       layer with a wash, so a chord reads straight through spacer
//       plates); two-voice chords seal the shared edge with twin parallel
//       lines — and the line extends along collinear runs (octave columns,
//       fifth chains, wired pairs), one continuous edge line first voice
//       to last; 3+ voice polygons wear one corner per note, each just
//       past its voice's outline — no hull bevels, no loop-back kinks;
//       empty cells turn translucent so the chord work shows through;
//       spacers wear no marker — hovering one asks its chords into the
//       reserved readout like a note module; add-cell greys the owned
//       board behind one big pill that carries the single cost spot
//       ("New cell · <price> ν — Cancel · Esc"), the frontier hexes lose
//       their stamped prices, and the next octave row renders shaded with
//       one Arete unlock banner across the whole row (mock figure).
//   A — Edge seams (reference): the same seam language at full strength
//       with the slim polygon + region wash; add-cell rests owned modules
//       under a hint pill; the roll docks as a right-hand sheet.
//   B — Bold hulls (reference): the shipped geometry and modal behavior,
//       re-weighted.
//
// Switchable via ?variant=A|B|C on the live route (dev builds only; the
// switcher bar bottom-center cycles with ←/→, and carries Roll / New cell
// buttons that set the judging states up). The board seeds from the
// playtest save (38 cells, 21 modules, two spacers) with one banked roll
// and enough nous to arm a cell purchase. Saving is disabled while the
// prototype runs.
import { computeRates, deployedAt } from "../../engine/economy";
import { generateOffer } from "../../engine/rolls";
import { cellCost } from "../../engine/economy";
import { octaveRowOf, positionInRange } from "../../engine/lattice";
import { deserialize } from "../../engine/save";
import { chordOverlay, type ChordMark, type ChordSeam, type Point } from "../chordlayer";
import { HEX_RADIUS, hexPoints } from "../face";
import { chordTermLabel, formatInt } from "../format";
import type { Hex } from "../../engine/types";
import type { App } from "../app";
import playtestSaveRaw from "./playtest-save.json?raw";

type VariantKey = "A" | "B" | "C";

const VARIANTS: { key: VariantKey; name: string }[] = [
  { key: "A", name: "A (Edge seams — full-strength reference)" },
  { key: "B", name: "B (Bold hulls — the shipped language, reference)" },
  { key: "C", name: "C (Edge seams + quiet board — the merged direction)" },
];

// The prototype's own lattice projection — mirrors render.ts's `point`
// (SPACING 65) without importing it.
const PROTO_SPACING = 65;
function protoPoint({ q, r }: Hex): Point {
  return [Math.sqrt(3) * PROTO_SPACING * (q + r / 2), PROTO_SPACING * 1.5 * r];
}
const PROTO_STEP = Math.sqrt(3) * PROTO_SPACING;

// Whether the prototype should run at all: a ?variant= param on a dev
// build. Production builds never carry the furniture.
export function prototypeWanted(): boolean {
  if (!import.meta.env.DEV) return false;
  const key = new URLSearchParams(location.search).get("variant");
  return key === "A" || key === "B" || key === "C";
}

function currentVariant(): VariantKey {
  const key = new URLSearchParams(location.search).get("variant");
  return key === "A" || key === "B" || key === "C" ? key : "A";
}

function setVariant(key: VariantKey): void {
  const params = new URLSearchParams(location.search);
  params.set("variant", key);
  history.replaceState(null, "", `?${params.toString()}`);
}

// Seed the representative dense board, one banked roll, and enough nous to
// arm a cell purchase; saving is disabled — the prototype checks
// interaction, not persistence.
export function seedDenseBoard(app: App): void {
  const result = deserialize(playtestSaveRaw);
  if (result.error || !result.state) {
    app.say(`Prototype board failed to load: ${result.error ?? "unknown"}`);
    return;
  }
  app.state = result.state;
  app.ui.selected = null;
  app.state.bankedRolls.push(generateOffer(app.state, Math.random));
  app.state.nous = Math.max(app.state.nous, cellCost(app.state.cellsBought) * 4);
  app.save = () => {};
  // A and C open the roll immediately — their roll presentations are the
  // docked sheet and the scrimless peek. B's presentation IS the chip.
  if (currentVariant() !== "B") app.openModal("forge");
  app.render();
}

/* ── The seam language: edge brackets and collinear runs ──
   A two-voice chord's seam leaves the centers: from the shipped
   center-to-center segment the voice centers are recovered, then the
   shared edge is rebuilt — twin parallel lines riding the ~7px gap
   between the faces, trimmed short of the corners. Chords the seams
   can't carry go one better when their voices line up: octave columns,
   fifth chains, and wired pairs extend ONE continuous edge line from the
   first voice to the last. Everything else wraps in a polygon whose
   corners sit on the notes — one per voice, just past its outline. */

const SEAM_TRIM = HEX_RADIUS * (Math.sqrt(3) / 2) + 2; // mirrors chordlayer's seamTrim
const EDGE_OFFSET = 1.8; // each line's offset off the shared edge, into the gap
const EDGE_HALF = 22; // half a two-voice bracket's length along the shared edge
const CORNER_REACH = HEX_RADIUS + 6; // a polygon corner sits just past its voice

function edgeSeam(seam: ChordSeam): ChordSeam[] {
  const dx = seam.x2 - seam.x1;
  const dy = seam.y2 - seam.y1;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return [seam];
  const ux = dx / len;
  const uy = dy / len;
  const px = seam.x1 - ux * SEAM_TRIM;
  const py = seam.y1 - uy * SEAM_TRIM;
  const qx = seam.x2 + ux * SEAM_TRIM;
  const qy = seam.y2 + uy * SEAM_TRIM;
  const mx = (px + qx) / 2;
  const my = (py + qy) / 2;
  const vx = -uy;
  const vy = ux;
  const line = (off: number): ChordSeam => ({
    x1: Number((mx + ux * off - vx * EDGE_HALF).toFixed(2)),
    y1: Number((my + uy * off - vy * EDGE_HALF).toFixed(2)),
    x2: Number((mx + ux * off + vx * EDGE_HALF).toFixed(2)),
    y2: Number((my + uy * off + vy * EDGE_HALF).toFixed(2)),
  });
  return [line(EDGE_OFFSET), line(-EDGE_OFFSET)];
}

// Whether the points all sit on one lattice line, and the line's unit
// axis with the points sorted along it.
function collinearSpan(points: Point[]): { axis: Point; ordered: Point[] } | null {
  if (points.length < 2) return null;
  const [p, q] = [points[0]!, points[1]!];
  let ax = q[0] - p[0];
  let ay = q[1] - p[1];
  const alen = Math.hypot(ax, ay);
  if (alen < 1e-6) return null;
  ax /= alen;
  ay /= alen;
  for (let i = 2; i < points.length; i++) {
    const rx = points[i]![0] - p[0];
    const ry = points[i]![1] - p[1];
    if (Math.abs(ax * ry - ay * rx) > 1e-6) return null;
  }
  const ordered = [...points].sort((a, b) => a[0] * ax + a[1] * ay - (b[0] * ax + b[1] * ay));
  return { axis: [ax, ay], ordered };
}

// One continuous double line spanning the run, trimmed at the end voices.
function runSeams(ordered: Point[], axis: Point): ChordSeam[] {
  const [ax, ay] = axis;
  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  const vx = -ay;
  const vy = ax;
  const line = (off: number): ChordSeam => ({
    x1: Number((first[0] + ax * SEAM_TRIM - vx * off).toFixed(2)),
    y1: Number((first[1] + ay * SEAM_TRIM - vy * off).toFixed(2)),
    x2: Number((last[0] - ax * SEAM_TRIM - vx * off).toFixed(2)),
    y2: Number((last[1] - ay * SEAM_TRIM - vy * off).toFixed(2)),
  });
  return [line(EDGE_OFFSET), line(-EDGE_OFFSET)];
}

// Andrew's monotone chain over pixel coordinates (mirrors chordlayer's
// private hull — the prototype's outline re-orders corners onto notes).
function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return [...points];
  const sorted = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o: Point, a: Point, b: Point): number =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

// The note-corner polygon: each hull voice owns one corner, pushed just
// past its own outline in the voice's outward direction — no bevel cuts,
// no angles that loop back between notes.
function voiceOutline(points: Point[]): string {
  const hull = convexHull(points);
  const cx = hull.reduce((acc, p) => acc + p[0], 0) / hull.length;
  const cy = hull.reduce((acc, p) => acc + p[1], 0) / hull.length;
  return hull
    .map(([x, y]) => {
      const dx = x - cx;
      const dy = y - cy;
      const len = Math.hypot(dx, dy) || 1;
      return `${(x + (dx / len) * CORNER_REACH).toFixed(2)},${(y + (dy / len) * CORNER_REACH).toFixed(2)}`;
    })
    .join(" ");
}

// The render-pass hook: A and C wear the new seam language — brackets for
// reachable pairs, one continuous line along collinear runs, note-corner
// polygons for the rest. B keeps the shipped geometry for reference.
export function transformChordMarks(marks: ChordMark[], toPoint: (id: string) => Point | null): ChordMark[] {
  if (!prototypeWanted()) return marks;
  const variant = currentVariant();
  if (variant !== "A" && variant !== "C") return marks;
  return marks.map((mark) => {
    const centers = mark.voices.map(toPoint);
    if (centers.some((c) => c === null)) return mark;
    const pts = centers as Point[];
    if (mark.outline) {
      const span = collinearSpan(pts);
      if (span) return { ...mark, seams: runSeams(span.ordered, span.axis), outline: null };
      return { ...mark, outline: voiceOutline(pts) };
    }
    return { ...mark, seams: mark.seams.flatMap(edgeSeam) };
  });
}

/* ── Shared geometry helpers ── */

function parsePoints(text: string): Point[] {
  return text
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return [x!, y!] as Point;
    });
}

function pointInPolygon(x: number, y: number, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    if (yi! > y !== yj! > y && x! < ((xj! - xi!) * (y - yi!)) / (yj! - yi!) + xi!) inside = !inside;
  }
  return inside;
}

/* ── Spacers ask their chords (iteration two) ──
   No markers: hovering a spacer asks every chord whose outline contains
   it into the reserved readout, exactly like hovering a note module. The
   app's own hover handler runs first and blanks the readout (spacer ids
   sing in no chord's voice list); this listener, bound after, rewrites
   it. Mirrors the app's rule: with a selection standing, the pinned chips
   win and the hover asks nothing. */

const boundSpacerGrids = new WeakSet<SVGSVGElement>();

function bindSpacerHover(app: App): void {
  const svg = document.getElementById("grid") as SVGSVGElement | null;
  if (!svg || boundSpacerGrids.has(svg)) return;
  boundSpacerGrids.add(svg);
  svg.addEventListener("pointerover", (event) => {
    if (app.dragging || app.ui.selected !== null) return;
    const cellNode = (event.target as Element).closest?.("[data-cell]");
    const [q, r] = (cellNode?.getAttribute("data-cell") ?? "").split(",").map(Number);
    if (!cellNode || !Number.isFinite(q)) return;
    const module = deployedAt(app.state, { q: q!, r: r! });
    if (!module || module.type !== "spacer" || module.pos === null) return;
    const host = document.getElementById("chord-readout");
    if (!host) return;
    const deployedById = new Map(app.state.modules.filter((m) => m.pos !== null).map((m) => [m.id, m]));
    const marks = chordOverlay({
      namedChords: computeRates(app.state, true).namedChords,
      posOf: (id) => deployedById.get(id)?.pos ?? null,
      point: protoPoint,
      radius: HEX_RADIUS,
      step: PROTO_STEP,
      labelFor: chordTermLabel,
    }).marks;
    const [x, y] = protoPoint(module.pos);
    const chips = marks.filter((mark) => mark.outline && pointInPolygon(x, y, parsePoints(mark.outline)));
    if (chips.length === 0) {
      host.hidden = true;
      host.innerHTML = "";
      return;
    }
    host.hidden = false;
    host.innerHTML = chips
      .map((mark) => `<span class="chord-readout-chip mono" style="--cc:var(--${mark.colorVar})">${escapeHtml(mark.label)}</span>`)
      .join("");
  });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ── The selection lift (variant C) ──
   The focused chords' marks clone into a top layer, drawn OVER the faces
   with a wash — a selected chord reads straight through spacer plates
   and translucent empty cells. */

function renderLift(app: App): void {
  const svg = document.getElementById("grid") as SVGSVGElement | null;
  if (!svg) return;
  let layer = svg.querySelector("#proto-lift");
  if (currentVariant() !== "C" || app.ui.selected === null) {
    layer?.remove();
    return;
  }
  if (!layer) {
    layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    layer.id = "proto-lift";
    svg.append(layer);
  }
  layer.innerHTML = "";
  for (const mark of svg.querySelectorAll<SVGGElement>(".chord-mark.chord-focus:not(.ghost-mark)")) {
    const clone = mark.cloneNode(true) as SVGGElement;
    clone.classList.add("proto-lifted");
    layer.append(clone);
  }
}

/* ── The spacer's window ──
   The plate keeps everything except a roughly squared window framed
   inside it — inset from the sides like a real window, not a band
   reaching the edges. The clip is the hex minus the window (evenodd),
   in the cell's own user space (origin = the cell center; the chassis
   spans ±61, vertical edges ±52.83). A hairline in the chassis stroke
   color frames the opening, and the texts sit centered in the opaque
   bands the window leaves: the name rides high, the note low. */

const SPACER_HEX_D =
  "M -52.83 -30.5 L 0 -61 L 52.83 -30.5 L 52.83 30.5 L 0 61 L -52.83 30.5 Z";
const SPACER_WINDOW_D =
  "M -26 -20 L 26 -20 L 26 24 L -26 24 Z";

function openSpacerPlates(svg: SVGSVGElement): void {
  let defs = svg.querySelector("#proto-spacer-defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.id = "proto-spacer-defs";
    defs.innerHTML = `<clipPath id="proto-spacer-window" clipPathUnits="userSpaceOnUse"><path clip-rule="evenodd" d="${SPACER_HEX_D} ${SPACER_WINDOW_D}"/></clipPath>`;
    svg.append(defs);
  }
  for (const node of svg.querySelectorAll<SVGElement>('#grid .module-node[data-type="spacer"]')) {
    const hex = node.querySelector<SVGElement>(".hex");
    if (!hex) continue;
    if (hex.getAttribute("clip-path") !== "url(#proto-spacer-window)") {
      hex.setAttribute("clip-path", "url(#proto-spacer-window)");
    }
    if (!node.querySelector(".proto-spacer-frame")) {
      const frame = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      frame.classList.add("proto-spacer-frame");
      frame.setAttribute("x", "-28");
      frame.setAttribute("y", "-22");
      frame.setAttribute("width", "56");
      frame.setAttribute("height", "48");
      frame.setAttribute("rx", "3");
      node.append(frame);
      // The name rides the cap's center (SVG text x/y are attribute-only).
      node.querySelector('[data-key="name"]')?.setAttribute("y", "-40");
    }
  }
}

/* ── Per-frame entry, called from render() ── */

function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}

export function renderDensePrototype(app: App): void {
  if (!prototypeWanted()) return;
  ensureStyle();
  ensureSwitcher(app);
  const variant = currentVariant();
  const upgrade = app.state.mode === "upgrade";
  for (const key of ["proto-a", "proto-b", "proto-c"]) document.body.classList.toggle(key, `proto-${variant.toLowerCase()}` === key);
  // The roll presentation rides the modal's own lifecycle: A docks it, C
  // strips its scrim, B ignores the modal and shows the chip when shut.
  document.body.classList.toggle("proto-roll-dock", variant === "A" && app.ui.modal === "forge");
  document.body.classList.toggle("proto-roll-peek", variant === "C" && app.ui.modal === "forge");
  renderRollChip(app, variant);
  // The add-cell treatments ride ui.buyingCell's lifecycle.
  document.body.classList.toggle("proto-a-arming", variant === "A" && upgrade && app.ui.buyingCell);
  document.body.classList.toggle("proto-c-arming", variant === "C" && upgrade && app.ui.buyingCell);
  renderArmPill(app, variant);
  bindSpacerHover(app);
  // Shared proposals + the per-variant layers on the freshly rebuilt svg.
  fitFaceReadouts();
  const gridSvg = document.getElementById("grid") as SVGSVGElement | null;
  if (gridSvg) openSpacerPlates(gridSvg);
  renderLift(app);
  renderRowBands(app);
}

/* ── The switcher bar ── */

function ensureSwitcher(app: App): void {
  if (byId("proto-switcher")) return;
  const bar = document.createElement("div");
  bar.id = "proto-switcher";
  bar.innerHTML = `<button data-dir="-1" aria-label="previous variant">◀</button><span id="proto-switcher-label"></span><button data-dir="1" aria-label="next variant">▶</button><i class="proto-sep"></i><button class="proto-action" data-act="roll">Roll</button><button class="proto-action" data-act="cell">New cell</button>`;
  document.body.append(bar);
  bar.querySelectorAll<HTMLButtonElement>("button[data-dir]").forEach((button) => {
    button.addEventListener("click", () => cycleVariant(app, Number(button.dataset.dir)));
  });
  bar.querySelector<HTMLButtonElement>('[data-act="roll"]')?.addEventListener("click", () => {
    app.openModal("forge");
  });
  bar.querySelector<HTMLButtonElement>('[data-act="cell"]')?.addEventListener("click", () => {
    if (app.ui.buyingCell) app.cancelCellPurchase();
    else app.armCellPurchase();
    app.render();
  });
  document.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
    if (event.key === "ArrowLeft") cycleVariant(app, -1);
    if (event.key === "ArrowRight") cycleVariant(app, 1);
  });
}

function cycleVariant(app: App, dir: number): void {
  const keys = VARIANTS.map((v) => v.key);
  const next = keys[(keys.indexOf(currentVariant()) + dir + keys.length) % keys.length]!;
  setVariant(next);
  app.render();
}

/* ── Shared proposal: face readouts shrink to fit ── */

function fitFaceReadouts(): void {
  document.querySelectorAll<SVGElement>("#grid .face-readout").forEach((node) => {
    const text = node.textContent ?? "";
    const size = text.length > 9 ? "12px" : text.length > 7 ? "14px" : "";
    if (node.style.fontSize !== size) node.style.fontSize = size;
  });
}

/* ── The arming pill: one cost spot, one obvious exit ──
   C carries the consolidated display: the single "New cell · <price> ν"
   pill doubles as the Cancel affordance, the frontier hexes lose their
   stamped prices, and the next octave rows render shaded with one Arete
   unlock banner each (renderRowBands). B keeps the plain Cancel pill; A
   keeps the non-interactive hint. */

function renderArmPill(app: App, variant: VariantKey): void {
  const upgrade = app.state.mode === "upgrade";
  const arming = upgrade && app.ui.buyingCell;
  let host = byId("proto-arm-pill");
  if (!arming || variant === "A") {
    host?.remove();
  } else {
    if (!host) {
      host = document.createElement("button");
      host.id = "proto-arm-pill";
      host.addEventListener("click", () => {
        app.cancelCellPurchase();
        app.render();
      });
      document.querySelector(".board-space")?.append(host);
    }
    if (variant === "C") {
      const price = formatInt(cellCost(app.state.cellsBought));
      host.innerHTML = `New cell · <span class="mono">${price} ν</span><span class="proto-esc">Cancel · Esc</span>`;
    } else {
      host.innerHTML = `✕ Cancel<span class="proto-esc">Esc</span>`;
    }
  }
  if (variant === "A" && arming) {
    let pill = byId("proto-arm-hint");
    if (!pill) {
      pill = document.createElement("div");
      pill.id = "proto-arm-hint";
      document.querySelector(".board-space")?.append(pill);
    }
    pill.textContent = "Pick a frontier hex · Esc cancels · owned modules rest";
  } else {
    byId("proto-arm-hint")?.remove();
  }
}

/* ── The next octave rows, shaded (variant C, arming) ──
   The raw frontier already knows the cells past the owned band — the
   shipped render filters them out. Here they return shaded, with one
   unlock banner across each row: the row unlock as one unit (the Arete
   figure is a mock — Octave tree pricing lands with implementation). */

function renderRowBands(app: App): void {
  const svg = byId("grid");
  if (!svg) return;
  const active = currentVariant() === "C" && app.state.mode === "upgrade" && app.ui.buyingCell;
  let layer = svg.querySelector("#proto-rows");
  if (!active) {
    layer?.remove();
    return;
  }
  if (!layer) {
    layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    layer.id = "proto-rows";
    svg.append(layer);
  }
  const rows = new Map<number, { hexes: string[]; xs: number[]; ys: number[] }>();
  for (const pos of app.frontierCells()) {
    if (positionInRange(pos)) continue;
    const row = octaveRowOf(pos);
    const entry = rows.get(row) ?? { hexes: [], xs: [], ys: [] };
    const [x, y] = protoPoint(pos);
    entry.hexes.push(`<polygon points="${hexPoints(HEX_RADIUS)}" transform="translate(${x.toFixed(2)},${y.toFixed(2)})"/>`);
    entry.xs.push(x);
    entry.ys.push(y);
    rows.set(row, entry);
  }
  const parts: string[] = [];
  // The label clamps to the owned board's span and anchors away from it —
  // the raw band can span far more columns than the player's board.
  const ownedXs = app.state.cells.map((cell) => protoPoint(cell)[0]);
  const ownedYs = app.state.cells.map((cell) => protoPoint(cell)[1]);
  const minX = Math.min(...ownedXs);
  const maxX = Math.max(...ownedXs);
  const boardCy = ownedYs.reduce((a, b) => a + b, 0) / ownedYs.length;
  for (const entry of rows.values()) {
    parts.push(`<g class="proto-row-band">${entry.hexes.join("")}</g>`);
    const cx = Math.max(minX, Math.min(maxX, entry.xs.reduce((a, b) => a + b, 0) / entry.xs.length));
    const cy = entry.ys.reduce((a, b) => a + b, 0) / entry.ys.length;
    const dir = cy < boardCy ? -1 : 1;
    parts.push(`<text class="proto-row-label" x="${cx.toFixed(2)}" y="${(cy + dir * (HEX_RADIUS + 20)).toFixed(2)}">Unlock this octave row · 1 Arete</text>`);
  }
  layer.innerHTML = parts.join("");
}

/* ── Variant B: the roll chip ── */

function renderRollChip(app: App, variant: VariantKey): void {
  const banked = app.state.bankedRolls.length;
  let chip = byId("proto-roll-chip");
  const show = variant === "B" && banked > 0 && app.ui.modal !== "forge";
  if (!show) {
    chip?.remove();
    return;
  }
  if (!chip) {
    chip = document.createElement("button");
    chip.id = "proto-roll-chip";
    chip.addEventListener("click", () => app.openModal("forge"));
    document.body.append(chip);
  }
  chip.innerHTML = `<b class="mono">${banked}</b> roll${banked === 1 ? "" : "s"} banked — inspect the board, click to choose`;
}

/* ── Styles ── */

function ensureStyle(): void {
  if (byId("proto-dense-style")) return;
  const style = document.createElement("style");
  style.id = "proto-dense-style";
  style.textContent = `
#proto-switcher {
  position: fixed; left: 50%; bottom: 10px; transform: translateX(-50%);
  z-index: 90; display: flex; align-items: center; gap: 8px;
  background: #101018; color: #e8e8f0; border: 1px solid #3a3a55; border-radius: 999px;
  padding: 6px 10px; font: 12px/1.2 system-ui, sans-serif; box-shadow: 0 6px 24px rgba(0,0,0,.5);
}
#proto-switcher button { all: unset; cursor: pointer; padding: 2px 6px; border-radius: 6px; }
#proto-switcher button:hover { background: #26263a; }
#proto-switcher-label { white-space: nowrap; opacity: .9; }
#proto-switcher .proto-sep { width: 1px; height: 14px; background: #3a3a55; }
#proto-switcher .proto-action { border: 1px solid #3a3a55; font-weight: 600; }

/* Shared proposal: the empty-cell note centers on its cell, and the empty
   cells go translucent so the chord work shows through them. */
#grid .cell-node > .hex-note { y: 0; dominant-baseline: central; }
#grid .cell-node > .hex.empty { fill-opacity: .45; }

/* The open wire (iteration four): the spacer's plate keeps its cap and
   base — the bands where the name and note live — and opens a window in
   the center where the chord lines run visibly through. The face keeps
   its name and note; the glyph, readout glyph, level line, rings, and
   rail go quiet, leaving nothing between the two bands. The window itself
   is a userSpaceOnUse clipPath applied per cell by openSpacerPlates —
   CSS clip-path: path() proved reference-box-dependent and clipped away
   from the hex. */
#grid .module-node[data-type="spacer"] .face-signature,
#grid .module-node[data-type="spacer"] [data-key="readout"],
#grid .module-node[data-type="spacer"] [data-key="level"],
#grid .module-node[data-type="spacer"] .face-rings,
#grid .module-node[data-type="spacer"] .face-rail { display: none; }
/* The name rides the cap's center; the window's frame wears the chassis
   stroke as a hairline. */
.proto-spacer-frame {
  fill: none;
  stroke: var(--line-strong, #44445c);
  stroke-width: 1.25;
  pointer-events: none;
}

/* The selection lift (C): the cloned marks draw over everything. */
#proto-lift { pointer-events: none; }
#proto-lift .chord-mark .chord-loop { fill: var(--cc); fill-opacity: .09; }
#proto-lift .chord-seam { opacity: 1; }

/* The next octave rows, shaded (C, arming). */
.proto-row-band polygon {
  fill: rgba(185, 148, 245, .09);
  stroke: #b994f5;
  stroke-width: 1.5;
  stroke-dasharray: 6 5;
}
.proto-row-label {
  fill: #cfa9ff;
  font: 600 14px var(--mono, monospace);
  letter-spacing: .05em;
  text-anchor: middle;
  paint-order: stroke;
  stroke: rgba(10, 10, 18, .85);
  stroke-width: 5px;
  pointer-events: none;
}

/* ── A — Edge seams (reference) ── */
body.proto-a .chord-seam.chord-loop { stroke-width: 2.5; }
body.proto-a .chord-mark:not(.ghost-mark) .chord-loop { fill: var(--cc); fill-opacity: .05; }
body.proto-a-arming #grid .module-node { opacity: .45; pointer-events: none; }
#proto-arm-hint {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  z-index: 22; padding: 6px 14px; border-radius: 999px;
  background: rgba(20, 20, 31, 0.94); border: 1px solid var(--accent, #d24d2e);
  color: #f0f0f6; font: 600 11px/1 system-ui, sans-serif; letter-spacing: .04em;
  pointer-events: none;
}
body.proto-roll-dock .modal-backdrop {
  background: transparent; pointer-events: none;
  justify-content: flex-end; padding: 0; align-items: stretch;
}
body.proto-roll-dock .modal {
  pointer-events: auto; position: relative; height: 100%; max-height: none;
  width: 430px; max-width: 90vw; border-radius: 0; border: none;
  border-left: 1px solid var(--line-strong, #33334a); animation: none;
  overflow-y: auto;
}

/* ── B — Bold hulls (reference) ── */
body.proto-b .chord-mark:not(.ghost-mark) .chord-loop { stroke-width: 5; filter: drop-shadow(0 0 5px var(--cc)); }
.hex.buy-here { animation: proto-beacon 1.4s ease-in-out infinite; }
@keyframes proto-beacon { 50% { fill: var(--accent-soft, #d24d2e55); stroke-width: 2.5; } }
#proto-roll-chip {
  position: fixed; right: 18px; bottom: 60px; z-index: 40; cursor: pointer;
  display: flex; align-items: center; gap: 6px;
  padding: 10px 16px; border-radius: 12px;
  background: rgba(20, 20, 31, 0.96); border: 1px solid var(--charge, #4ad48a);
  color: #f0f0f6; font: 500 12px/1.3 system-ui, sans-serif;
  box-shadow: 0 6px 24px rgba(0,0,0,.5); text-align: left;
}
#proto-roll-chip:hover { background: rgba(74, 212, 138, .18); }
#proto-roll-chip .mono { color: var(--charge, #4ad48a); font-weight: 700; }

/* ── C — Edge seams + quiet board (the merged direction) ── */
body.proto-c .chord-mark:not(.chord-focus):not(.ghost-mark) .chord-seam {
  opacity: .3; stroke-width: 2.5;
}
body.proto-c .chord-mark.chord-focus .chord-seam { stroke-width: 6; }
body.proto-c-arming #grid .module-node,
body.proto-c-arming #grid .cell-node:has(.hex.empty) {
  filter: grayscale(.85); opacity: .4; pointer-events: none;
}
body.proto-c-arming #grid .cell-node:has(.buy-here) { filter: none; opacity: 1; pointer-events: auto; }
/* One cost spot: the frontier hexes drop their stamped prices and
   NEW CELL labels; the pill carries the single figure. The buy targets
   keep a firm accent outline so they read through the grey. */
body.proto-c-arming #grid .cell-node text.hex-sub { display: none; }
body.proto-c-arming #grid .cell-node text[font-size="22"] { display: none; }
body.proto-c-arming #grid .hex.buy-here { stroke-width: 2.5; stroke-dasharray: none; }
body.proto-c-arming #proto-arm-pill {
  top: 10px; left: 50%; transform: translateX(-50%);
  padding: 12px 22px; font-size: 13px;
}
body.proto-roll-peek .modal-backdrop { background: transparent; pointer-events: none; }
body.proto-roll-peek .modal { pointer-events: auto; }

/* The arming pill (B and C): the C shape carries the cost read. */
#proto-arm-pill {
  position: absolute; top: 10px; left: 66px; z-index: 22;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 14px; border-radius: 999px; cursor: pointer;
  background: rgba(20, 20, 31, 0.94); border: 1px solid var(--danger, #e05252);
  color: #f0f0f6; font: 600 11px/1 system-ui, sans-serif; letter-spacing: .04em;
}
#proto-arm-pill:hover { background: rgba(224, 82, 82, .35); }
#proto-arm-pill .proto-esc {
  padding: 2px 6px; border: 1px solid #55556a; border-radius: 4px;
  font: 600 9px/1 system-ui, sans-serif; color: #a0a0b8;
}

@media (max-width: 600px) {
  #proto-switcher { left: 8px; right: 8px; transform: none; justify-content: center; flex-wrap: wrap; }
}`;
  document.head.append(style);
}
