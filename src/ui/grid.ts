// The grid region: the hex board — viewBox, chord overlay, charge leads,
// cells and frontier purchase hexes, module faces, event binding, and the
// arrange-mode manage view (the inspector's callback seam ends here, in the
// region that owns the drag wiring). Structural identity comes from svg.ts's
// keyed diff; every write is an intent.
import { cellCost, deployedAt, emittedStrength, isSource, modulePower, nominalContribution, wholeNous } from "../engine/economy";
import { adjacent, neighbors, sameHex } from "../engine/hex";
import { forgeThreshold } from "../engine/rolls";
import { isCarrier } from "../engine/state";
import type { Hex, ModuleInstance, RateSnapshot } from "../engine/types";
import { formatInt, formatNumber } from "./format";
import { META, RARITY_LABEL } from "./meta";
import { byId, escapeHtml } from "./dom";
import { HEX_RADIUS, hexApothem, hexPoints, hexTileSvg, moduleFace } from "./face";
import { chargeGlow, chargeLeads } from "./leads";
import { chordOverlay } from "./chordlayer";
import { updateSvg } from "./svg";
import { bindPointerDrag } from "./drag";
import type { RenderContext } from "./context";

const SPACING = 65;
const boundCells = new WeakSet<SVGElement>();

function point({ q, r }: Hex): [number, number] {
  return [Math.sqrt(3) * SPACING * (q + r / 2), SPACING * 1.5 * r];
}

// The board's frontier: empty hexes adjacent to the owned board — the only
// places a new cell may join (topology over the owned cells, pure).
function frontierOf(cells: Hex[]): Hex[] {
  const out: Hex[] = [];
  const seen = (h: Hex) => cells.some((c) => sameHex(c, h)) || out.some((c) => sameHex(c, h));
  for (const cell of cells) {
    for (const n of neighbors(cell)) {
      if (!seen(n)) out.push(n);
    }
  }
  return out;
}

export function renderGrid(ctx: RenderContext): void {
  const { state, ui } = ctx;
  const svg = document.getElementById("grid") as SVGSVGElement | null;
  if (!svg) return;
  const upgrade = state.mode === "upgrade";
  const showFrontier = upgrade && (ui.reshape !== null || ui.buyingCell);
  const frontier = showFrontier ? frontierOf(state.cells) : [];
  const allCells = [...state.cells, ...frontier];
  const coords = allCells.map(point);
  const minX = Math.min(...coords.map((p) => p[0])) - 78;
  const maxX = Math.max(...coords.map((p) => p[0])) + 78;
  const minY = Math.min(...coords.map((p) => p[1])) - 82;
  const maxY = Math.max(...coords.map((p) => p[1])) + 82;
  svg.setAttribute("viewBox", `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
  svg.classList.toggle("chord-view", ui.showChords);

  const flow = state.mode === "flow";
  const snapshot = ctx.memo.snapshot();
  const selectedModule = state.modules.find((m) => m.id === ui.selected) ?? null;

  // The chord view (issue #62): a display-only read of the board's chord
  // terms — the same pairs and named chords the formula chip names, drawn
  // where they live. Chord voices stay lit; everything else dims; pair links
  // and named-chord hulls wear the chord register. Purely cosmetic: no
  // gating, no gameplay effect, available in every mode.
  const deployedById = new Map(state.modules.filter((m) => m.pos !== null).map((m) => [m.id, m]));
  const overlay = ui.showChords
    ? chordOverlay({
        pairs: snapshot.pairs,
        namedChords: snapshot.namedChords,
        posOf: (id) => deployedById.get(id)?.pos ?? null,
        point,
        radius: HEX_RADIUS,
        pad: 5,
        labelFor: (chord) => `${chord.name} ×${formatNumber(1 + chord.bonus)}`,
      })
    : null;
  const nodeClass = (moduleId: string | null): string =>
    ui.showChords ? `cell-node ${moduleId !== null && overlay!.participants.has(moduleId) ? "chord-lit" : "chord-dim"}` : "cell-node";

  // Charge leads (§8, #41): uniform green patch leads, center-to-center,
  // directional generator → receiver. Leads in live flow animate; everything
  // else — paused, upgrade mode (charge pauses between sessions, ADR-0001),
  // or a generator whose charge window is spent — sits dim and static as
  // wiring previews (ADR-0002).
  let html = CHARGE_LEAD_DEFS;
  for (const { generator, receiver, emitting } of chargeLeads(state, flow)) {
    if (generator.pos === null || receiver.pos === null) continue;
    const [x1, y1] = point(generator.pos);
    const [x2, y2] = point(receiver.pos);
    const cls = emitting ? "charge-line" : "charge-preview-line";
    html += `<line data-key="charge-${generator.id}-${receiver.id}" class="${cls}" ${leadSegment(x1, y1, x2, y2)}/>`;
  }

  // Chord pair links: seam bridges beneath the faces, in the chord register
  // — the wiring language, re-register for the board's optimization game.
  if (overlay) {
    html += `<g data-key="chord-links">${overlay.links
      .map((link) => `<line data-key="pair-${link.key}" class="chord-link" x1="${link.x1}" y1="${link.y1}" x2="${link.x2}" y2="${link.y2}"/>`)
      .join("")}</g>`;
  }

  for (const pos of state.cells) {
    const [x, y] = point(pos);
    const module = deployedAt(state, pos);
    const isRemoval = ui.reshape?.removes.some((c) => sameHex(c, pos)) ?? false;
    let classes = "hex empty";
    if (isRemoval) classes += " remove-stage";
    if (!module && isTargetCell(ctx, pos)) classes += " target";
    html += `<g class="${nodeClass(module?.id ?? null)}" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="${module ? META[module.type].name : "Empty cell"}">
      ${module ? "" : `<polygon class="${classes}" points="${hexPoints(HEX_RADIUS)}"/>`}`;
    if (module) {
      html += moduleNode(ctx, module, { snapshot, selectedModule });
    } else {
      html += `<path class="empty-plus" d="M-7-6H7M0-13V1"/><text y="24" text-anchor="middle" class="hex-sub">EMPTY CELL</text>`;
    }
    html += `</g>`;
  }

  if (showFrontier) {
    const price = cellCost(state.cellsBought);
    const affordable = wholeNous(state) >= price;
    for (const pos of frontier) {
      const [x, y] = point(pos);
      if (ui.buyingCell) {
        // The purchase arm: every frontier hex carries its price; the buy
        // lands only where clicked (ADR-0013).
        html += `<g class="${nodeClass(null)}" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="Buy cell here for ${formatInt(price)} nous">
          <polygon class="hex ${affordable ? "buy-here" : "future"}" points="${hexPoints(HEX_RADIUS)}"/>
          <text y="-24" text-anchor="middle" class="hex-sub">NEW CELL</text>
          ${affordable ? `<text y="8" text-anchor="middle" fill="var(--accent)" font-size="22">+</text>` : ""}
          <text y="${affordable ? 34 : 8}" text-anchor="middle" class="hex-sub">${formatInt(price)} ν</text>
        </g>`;
      } else {
        const isAdd = ui.reshape?.adds.some((c) => sameHex(c, pos)) ?? false;
        html += `<g class="${nodeClass(null)}" transform="translate(${x},${y})" data-cell="${pos.q},${pos.r}" tabindex="0" role="button" aria-label="Expand here">
          <polygon class="hex ${isAdd ? "target" : "future"}" points="${hexPoints(HEX_RADIUS)}"/>
          ${isAdd ? `<text y="5" text-anchor="middle" fill="var(--accent)" font-size="20">+</text>` : ""}
        </g>`;
      }
    }
  }

  // Named-chord marks: a hull wrapping each chord's voices plus its
  // formula-chip label, drawn over the faces so a chord names itself.
  if (overlay) {
    html += `<g data-key="chord-marks">${overlay.marks
      .map(
        (mark) =>
          `<g data-key="${mark.key}"><polygon class="chord-hull" points="${mark.points}"/><text class="chord-label mono" x="${mark.labelX}" y="${mark.labelY}">${escapeHtml(mark.label)}</text></g>`,
      )
      .join("")}</g>`;
  }

  updateSvg(svg, html);
  bindGridEvents(ctx, svg);
}

// Directional tips for the patch leads, in the charge register: full for
// live flow, dimmed for everything that only previews the wiring.
const leadMarker = (id: string, cls: string): string =>
  `<marker id="${id}" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto"><path class="${cls}" d="M0 0 10 5 0 10Z"/></marker>`;
const CHARGE_LEAD_DEFS = `<defs data-key="charge-defs">${leadMarker("fs-lead-tip", "lead-tip")}${leadMarker("fs-lead-tip-dim", "lead-tip-dim")}</defs>`;

// A lead runs center-to-center beneath the faces, trimmed to the chassis:
// the pad is the face's apothem plus a hair, so the lead spans the seam
// between neighboring hexes and the directional tip lands on the receiver's
// edge rather than vanishing under it.
const LEAD_PAD = Math.round(hexApothem(HEX_RADIUS)) + 1;

function leadSegment(x1: number, y1: number, x2: number, y2: number): string {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  return `x1="${(x1 + ux * LEAD_PAD).toFixed(2)}" y1="${(y1 + uy * LEAD_PAD).toFixed(2)}" x2="${(x2 - ux * LEAD_PAD).toFixed(2)}" y2="${(y2 - uy * LEAD_PAD).toFixed(2)}"`;
}

interface GridNodeCtx {
  snapshot: RateSnapshot;
  selectedModule: ModuleInstance | null;
}

function moduleNode(ctx: RenderContext, module: ModuleInstance, grid: GridNodeCtx): string {
  const { ui, state } = ctx;
  const selected = ui.selected === module.id;
  // Charge is session-bound: the snapshot is flow-gated, so any strength it
  // reports is live. Receivers brighten with their received strength, and a
  // generator lights only while it actually emits (a spent charge window
  // emits nothing).
  const strength = grid.snapshot.chargeStrength.get(module.id) ?? 0;
  const charged = strength > 0;
  const emittingNow = state.mode === "flow" && isSource(module) && emittedStrength(state, module, true) > 0;
  const contribution = grid.snapshot.contributions.get(module.id);

  let hexClass = "";
  if (selected) hexClass += " selected";
  if (charged) hexClass += " charged";
  if (emittingNow) hexClass += " dispensing";

  // Highlight eligible receivers while a generator is selected in upgrade mode.
  let highlight = "";
  if (state.mode === "upgrade" && grid.selectedModule && isSource(grid.selectedModule) && module.id !== grid.selectedModule.id && module.pos && grid.selectedModule.pos && adjacent(module.pos, grid.selectedModule.pos)) {
    highlight = `<polygon data-key="preview" class="highlight-ring" points="${hexPoints(HEX_RADIUS - 4)}"/>`;
  }

  // The chargeable face-hierarchy exception: the Forge's prominent readout is
  // charge-vs-threshold, rendered as a threshold fill with a flash at crossing.
  let under = "";
  let readout: string;
  let readoutClass: string | undefined;
  let note: string | undefined;
  if (module.type === "forge") {
    under = waterFill(module.id, state.forge.progress / forgeThreshold(state.forge.earned));
    // The face's glanceable readout rounds; the inspector keeps exact values.
    readout = `${formatNumber(Math.floor(Math.max(0, state.forge.progress)))}/${formatNumber(Math.round(forgeThreshold(state.forge.earned)))}`;
    readoutClass = "charge";
  } else if (isSource(module)) {
    readout = `⌁${formatNumber(modulePower(module))}`;
  } else if (module.type === "infusor") {
    readout = `+${formatNumber(100 * nominalContribution(module, grid.snapshot.chargeStrength.get(module.id) ?? 0))}%`;
  } else {
    // Synthesizers wear their contribution, pitch beneath it: hex distance
    // from the Carrier + 1.
    readout = `+${formatNumber(contribution?.value ?? 0)}`;
    const pitch = contribution?.pitch ?? null;
    note = pitch !== null ? `P${pitch}` : undefined;
  }

  // The threshold-crossing flash fires for a moment after a roll is minted.
  const crossed = module.type === "forge" && ctx.forgeFlashUntil > Date.now();

  return `<g class="module-node${crossed ? " forge-crossed" : ""}" data-type="${module.type}" data-rarity="${module.rarity}">
    ${moduleFace({
      type: module.type,
      rarity: module.rarity,
      readout,
      ...(readoutClass ? { readoutClass } : {}),
      ...(note ? { note } : {}),
      level: module.level,
      hexClass: hexClass.trim(),
      under,
      pinned: isCarrier(module),
      ...(charged ? { chargeGlow: chargeGlow(strength) } : {}),
    })}${highlight}
    </g>`;
}

const FILL_INSET = 3;

function waterFill(moduleId: string, progress: number): string {
  const clamped = Math.min(1, Math.max(0, progress));
  const radius = HEX_RADIUS - FILL_INSET;
  const height = 2 * radius * clamped;
  const y = radius - height;
  const clipId = `water-${moduleId}`;
  return `<clipPath id="${clipId}"><polygon points="${hexPoints(radius)}"/></clipPath>
    <rect data-key="fill" clip-path="url(#${clipId})" class="water-fill" x="${-radius}" y="${y}" width="${2 * radius}" height="${height}"/>`;
}

function isTargetCell(ctx: RenderContext, pos: Hex): boolean {
  const { ui, state } = ctx;
  if (state.mode !== "upgrade") return false;
  if (ui.reshape) return false;
  if (ui.placing) {
    const module = state.modules.find((m) => m.id === ui.placing);
    if (!module) return false;
    const occupant = deployedAt(state, pos);
    return !occupant || !isCarrier(occupant);
  }
  return false;
}

function bindGridEvents(ctx: RenderContext, svg: SVGSVGElement): void {
  svg.querySelectorAll<SVGElement>("[data-cell]").forEach((node) => {
    if (boundCells.has(node)) return;
    boundCells.add(node);
    const position = () => {
      const [q, r] = node.getAttribute("data-cell")!.split(",").map(Number);
      return { q: q!, r: r! };
    };
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        ctx.intents.pickCell(position());
      }
    });
    node.addEventListener("click", () => ctx.intents.pickCell(position()));
    node.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      ctx.intents.rightClickCell(position());
    });
    bindPointerDrag(ctx, node, () => deployedAt(ctx.state, position())?.id ?? null);
  });
}

/* ── Grid & inventory panel (arranging view) ────────── */

export function renderManageView(ctx: RenderContext, host: HTMLElement): void {
  const { state, ui, intents } = ctx;
  const inventory = state.modules.filter((m) => m.pos === null);
  const deployedCount = state.modules.length - inventory.length;
  const reshaping = ui.reshape !== null;
  const validity = reshaping ? intents.reshapeValidity() : null;
  host.innerHTML = `
    <div class="detail-head">
      <h1>Grid &amp; inventory</h1>
      <button class="primary small" id="manage-done">Done</button>
    </div>
    <p class="small muted">${
      reshaping
        ? "Reshaping — removals and additions must balance."
        : ui.placing
          ? "Choose a destination cell. Occupied modules swap."
          : "Drag tiles between cells or into the inventory; drop onto a twin to combine."
    }</p>
    <p class="manage-counts mono">${deployedCount} deployed · ${state.cells.length - deployedCount} empty · ${inventory.length} in inventory</p>
    <div class="manage-actions">
      ${reshaping
        ? `<div class="reshape-panel">
            <h3>Reshape board</h3>
            <p class="small muted">Staged: −${ui.reshape!.removes.length} / +${ui.reshape!.adds.length}. Count must stay equal; shape must stay connected.</p>
            <p class="reshape-valid ${validity!.ok ? "ok" : "bad"}">${validity!.message}</p>
            <div class="reshape-actions">
              <button class="primary small" id="reshape-apply" ${validity!.ok ? "" : "disabled"}>Apply</button>
              <button class="small" id="reshape-cancel">Cancel</button>
            </div>
          </div>`
        : `<button id="reshape-start">Reshape board</button>`}
    </div>
    <section class="inventory-drop" id="inventory-zone">
      <h3>Inventory</h3>
      <p class="small muted">Drop a tile here to store it; click to place.</p>
      <div class="inventory-hexes" id="inventory-list">
        ${inventory.map((m) => {
          return `<button class="inventory-tile" data-inv="${m.id}" data-rarity="${m.rarity}" title="${META[m.type].name} · ${RARITY_LABEL[m.rarity]}">
            ${hexTileSvg(m)}
          </button>`;
        }).join("") || `<p class="empty-copy">Inventory is empty.</p>`}
      </div>
    </section>`;

  byId("manage-done")?.addEventListener("click", () => intents.stopManaging());
  byId("reshape-start")?.addEventListener("click", () => intents.startReshape());
  byId("reshape-apply")?.addEventListener("click", () => intents.applyReshape());
  byId("reshape-cancel")?.addEventListener("click", () => intents.cancelReshape());
  host.querySelectorAll<HTMLButtonElement>("[data-inv]").forEach((button) => {
    const id = button.getAttribute("data-inv")!;
    button.addEventListener("click", () => intents.beginPlacing(id));
    bindPointerDrag(ctx, button, id);
  });
}
