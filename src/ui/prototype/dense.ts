// PROTOTYPE — throwaway artifact for wayfinder ticket #174 (map #169).
// Never merge to main. Lives on the prototype/dense-board-174 branch.
//
// Question: what concrete board and modal behavior removes the visual and
// interaction blockers found in dense play — chord polygons at 3+ voices,
// two-voice parallel seams, chord visibility through spacers/empty cells,
// large values, empty-cell note alignment, add-cell cancel and
// noninteractable owned modules, and inspecting the board while a Forge
// roll waits?
//
// Three radically different answers, switchable via ?variant=A|B|C on the
// live route (dev builds only; the switcher bar bottom-center cycles with
// ←/→, and carries Roll / New cell buttons that set the judging states up):
//
//   A — Edge seams. Two-voice chords seal the gap: twin parallel lines ride
//       the shared edge, face centers left to charge. Polygons slim to a
//       hugging outline with a faint region wash; spacers inside a chord
//       wear a solder dot. Add-cell dims owned modules under an
//       Esc-cancel pill. The roll docks as a right-hand sheet — the board
//       stays visible and hoverable beside it.
//   B — Bold hulls. Center-to-center seams stay as shipped; polygons get a
//       glowing emphasis stroke; spacers inside a chord wear a wired-hex
//       marker, empty cells a faint dot. Add-cell keeps the board at full
//       strength and hangs a Cancel pill off the dock. The roll minimizes
//       to a corner chip — inspection never waits.
//   C — Quiet board, loud ask. Every chord whispers at rest; selecting a
//       voice lifts its polygon OVER the faces with a wash, reading
//       straight through spacers; dots mark participants at rest. Add-cell
//       greys the owned board and fronts one big Cancel. The roll modal
//       drops its scrim entirely — the board peeks and hovers through it.
//
// Shared proposals on every variant: the empty-cell note centers on its
// cell, and long face readouts shrink to fit.
//
// The board seeds from the playtest save (38 cells, 21 modules, two
// spacers, triads and bridged pairs) with one banked roll and enough nous
// to arm a cell purchase. Saving is disabled while the prototype runs.
import { deserialize } from "../../engine/save";
import { generateOffer } from "../../engine/rolls";
import { cellCost } from "../../engine/economy";
import type { ChordMark, ChordSeam } from "../chordlayer";
import type { App } from "../app";
import playtestSaveRaw from "./playtest-save.json?raw";

type VariantKey = "A" | "B" | "C";

const VARIANTS: { key: VariantKey; name: string }[] = [
  { key: "A", name: "A (Edge seams — the gap is the chord)" },
  { key: "B", name: "B (Bold hulls — the shipped language, re-weighted)" },
  { key: "C", name: "C (Quiet board, loud ask — chords lift on selection)" },
];

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

/* ── Variant A: edge seams ──
   A two-voice chord's seam leaves the centers: from the shipped
   center-to-center segment the voice centers are recovered, then the
   shared edge is rebuilt — twin parallel lines riding the ~7px gap
   between the faces, trimmed short of the corners. The polygon tuning
   (tighter clearance, smaller poke, faint wash) rides the stylesheet. */

const SEAM_TRIM = 61 * (Math.sqrt(3) / 2) + 2; // mirrors chordlayer's seamTrim
const EDGE_OFFSET = 1.8; // each line's offset off the shared edge, into the gap
const EDGE_HALF = 22; // half the bracket's length along the shared edge

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

// The render-pass hook: variant A rewrites two-voice seams as edge
// brackets; every other variant keeps the shipped geometry.
export function transformChordMarks(marks: ChordMark[]): ChordMark[] {
  if (!prototypeWanted() || currentVariant() !== "A") return marks;
  return marks.map((mark) => (mark.outline ? mark : { ...mark, seams: mark.seams.flatMap(edgeSeam) }));
}

/* ── Shared geometry: who sits inside a chord polygon ── */

function polygonPoints(polygon: SVGPolygonElement): [number, number][] {
  return polygon
    .getAttribute("points")!
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return [x!, y!] as [number, number];
    });
}

function pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    if (yi! > y !== yj! > y && x! < ((xj! - xi!) * (y - yi!)) / (yj! - yi!) + xi!) inside = !inside;
  }
  return inside;
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
  renderArmCancel(app, variant);
  // Shared proposals + the participation markers on the freshly rebuilt svg.
  fitFaceReadouts();
  renderParticipation(app, variant);
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

/* ── Shared proposal: the empty-cell note centers on its cell (CSS) ── */

/* ── Variant A + C: participation markers ──
   Spacers (A, B: a marker; C: a rest-state dot) and — B, C — empty cells
   inside a formed polygon get a chord-hued dot so the chord's path reads
   through the silent cells. Rebuilt after every grid render; a polygon's
   own color carries via its mark's --cc. */

function renderParticipation(app: App, variant: VariantKey): void {
  const svg = byId("grid");
  if (!svg) return;
  let layer = svg.querySelector("#proto-participation");
  if (!layer) {
    layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
    layer.id = "proto-participation";
    svg.append(layer);
  }
  layer.innerHTML = "";
  const polygons = [...svg.querySelectorAll<SVGPolygonElement>(".chord-mark:not(.ghost-mark) .chord-loop")];
  if (polygons.length === 0) return;
  const hulls = polygons.map((polygon) => ({ points: polygonPoints(polygon), color: polygon.closest<SVGGElement>(".chord-mark")?.style.getPropertyValue("--cc") ?? "" }));
  const inside = (x: number, y: number): string | null => {
    for (const hull of hulls) if (pointInPolygon(x, y, hull.points)) return hull.color;
    return null;
  };
  const pointOf = (q: number, r: number): [number, number] => [Math.sqrt(3) * 65 * (q + r / 2), 65 * 1.5 * r];
  const hexMarker = (x: number, y: number): string =>
    Array.from({ length: 6 }, (_, i) => {
      const a = ((60 * i - 30) * Math.PI) / 180;
      return `${(x + 7 * Math.cos(a)).toFixed(2)},${(y + 7 * Math.sin(a)).toFixed(2)}`;
    }).join(" ");
  const marks: string[] = [];
  // Spacers: A and C a solder dot, B a wired-hex marker.
  for (const module of app.state.modules) {
    if (module.type !== "spacer" || module.pos === null) continue;
    const [x, y] = pointOf(module.pos.q, module.pos.r);
    const color = inside(x, y);
    if (!color) continue;
    if (variant === "B") {
      marks.push(`<polygon points="${hexMarker(x, y)}" fill="none" stroke="${color}" stroke-width="2" opacity=".9"/>`);
    } else {
      marks.push(`<circle cx="${x}" cy="${y}" r="4.5" fill="${color}" opacity=".85"/>`);
    }
  }
  // Empty cells inside a chord: B and C dot them faintly; A lets the
  // polygon's region wash carry the answer.
  if (variant !== "A") {
    const deployed = new Set(app.state.modules.filter((m) => m.pos !== null).map((m) => `${m.pos!.q},${m.pos!.r}`));
    for (const cell of app.state.cells) {
      if (deployed.has(`${cell.q},${cell.r}`)) continue;
      const [x, y] = pointOf(cell.q, cell.r);
      const color = inside(x, y);
      if (!color) continue;
      marks.push(`<circle cx="${x}" cy="${y}" r="3" fill="${color}" opacity=".45"/>`);
    }
  }
  layer.innerHTML = marks.join("");
}

/* ── Variant A: the arming pill ── */

function renderArmCancel(app: App, variant: VariantKey): void {
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
    host.innerHTML = `✕ Cancel<span class="proto-esc">Esc</span>`;
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

/* Shared proposal: the empty-cell note centers on its cell. */
#grid .cell-node > .hex-note { y: 0; dominant-baseline: central; }

/* Shared: participation markers never catch the pointer. */
#proto-participation { pointer-events: none; }

/* ── A — Edge seams ── */
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

/* ── B — Bold hulls ── */
body.proto-b .chord-mark:not(.ghost-mark) .chord-loop { stroke-width: 5; filter: drop-shadow(0 0 5px var(--cc)); }
.hex.buy-here { animation: proto-beacon 1.4s ease-in-out infinite; }
@keyframes proto-beacon { 50% { fill: var(--accent-soft, #d24d2e55); stroke-width: 2.5; } }
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

/* ── C — Quiet board, loud ask ── */
body.proto-c .chord-mark:not(.chord-focus):not(.ghost-mark) .chord-seam {
  opacity: .3; stroke-width: 2.5;
}
body.proto-c .chord-mark.chord-focus .chord-seam { stroke-width: 6; }
body.proto-c-arming #grid .module-node,
body.proto-c-arming #grid .cell-node:has(.hex.empty) {
  filter: grayscale(.85); opacity: .4; pointer-events: none;
}
body.proto-c-arming #grid .cell-node:has(.buy-here) { filter: none; opacity: 1; pointer-events: auto; }
body.proto-c-arming #proto-arm-pill {
  top: 10px; left: 50%; transform: translateX(-50%);
  padding: 12px 22px; font-size: 13px;
}
body.proto-roll-peek .modal-backdrop { background: transparent; pointer-events: none; }
body.proto-roll-peek .modal { pointer-events: auto; }

@media (max-width: 600px) {
  #proto-switcher { left: 8px; right: 8px; transform: none; justify-content: center; flex-wrap: wrap; }
}`;
  document.head.append(style);
}
