import { breatherTermsHtml, termTipHtml } from "./terms";
import { generatorProfileOf } from "../engine/profiles";
import type { App } from "./app";
import { inventoryCombinePreview } from "../engine/actions";
import { CATEGORY_OF, isVoiceType, typeRarityOf } from "../engine/constants";
import { boosterBonusOf, boosterTermOf, modulePower, voiceCapacityOf } from "../engine/economy";
import { moduleScrapValue } from "../engine/scrap";
import type { ModuleInstance } from "../engine/types";
import { faceLevel, inventoryTileSvg, moduleFace } from "./face";
import { formatInt, formatNumber } from "./format";
import { closeTooltips, wireTooltips } from "./instrument";
import { CATEGORY_WORD, META, RARITY_LABEL, rarityMark, tierNumeral, tierWord } from "./meta";
import { profileGradesHtml } from "./profile";

// The tray browser (ADR-0027 as amended): the modules face of the shared
// tray switch. The World face's occupants render through world.ts's own
// tray builder (issue #426); the switch itself is the layer legend both
// share. UI state is visit-local; roster ordering is the collection's
// durable acquisition order.

export type InventorySort = "type" | "rarity" | "level" | "newest";
export interface InventoryState {
  collapsed: boolean;
  dragOpen: boolean;
  filters: Record<string, string>;
  sorts: Record<string, InventorySort>;
  scroll: Record<string, number>;
  inspect: string | null;
  merge: { id: string; partner: string | null } | null;
  menu: boolean;
  scrapMode: boolean;
  selected: string[];
  scrapReview: boolean;
  returnId: string | null;
}
export const createInventoryState = (): InventoryState => ({
  collapsed: false, dragOpen: false,
  filters: { modules: "all" },
  sorts: { modules: "type" }, scroll: { modules: 0 },
  inspect: null, merge: null, menu: false, scrapMode: false, selected: [], scrapReview: false, returnId: null,
});
const INVENTORY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="m12 2 9 5v10l-9 5-9-5V7Z"/><path d="m12 7 4.5 2.5v5L12 17l-4.5-2.5v-5ZM3 7l4.5 2.5M21 7l-4.5 2.5M3 17l4.5-2.5M21 17l-4.5-2.5M12 2v5m0 10v5"/><path class="inventory-core" d="m12 9.8 1.9 1.1v2.2L12 14.2l-1.9-1.1v-2.2Z" fill="currentColor" stroke="none"/></svg>';
const MERGE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="square" stroke-linejoin="miter"><path d="M5 4v4l7 6 7-6V4M12 14v6m-3-3 3 3 3-3"/></svg>';
let mergeTipSequence = 0;
function mergeButton(id: string, name: string, eligible: boolean): string {
  const tip = `inventory-merge-tip-${++mergeTipSequence}`;
  return `<span class="inst-tip inventory-merge-control"><button class="inventory-merge inst-tip-trigger" data-inventory-merge="${id}" aria-disabled="${!eligible}" aria-label="Merge ${name}" aria-describedby="${tip}" aria-expanded="false">${MERGE_ICON}</button><span class="inst-tip-body" id="${tip}" role="tooltip">Merge</span></span>`;
}
const rarityRank = { common: 0, uncommon: 1, rare: 2 };

export function inventoryModules(app: App): ModuleInstance[] {
  const inv = app.ui.inventory;
  const acquired = new Map(app.state.modules.map((m, i) => [m.id, i]));
  const sort = inv.sorts.modules;
  return app.state.modules.filter((m) => m.pos === null && (inv.filters.modules === "all" || CATEGORY_OF[m.type] === inv.filters.modules))
    .sort((a, b) => {
      if (sort === "newest") return acquired.get(b.id)! - acquired.get(a.id)!;
      const primary = sort === "level" ? b.level - a.level : sort === "rarity" ? rarityRank[typeRarityOf(b.type)] - rarityRank[typeRarityOf(a.type)] : 0;
      return primary || CATEGORY_WORD[CATEGORY_OF[a.type]].localeCompare(CATEGORY_WORD[CATEGORY_OF[b.type]]) || META[a.type].name.localeCompare(META[b.type].name) || b.tier - a.tier || b.level - a.level || acquired.get(a.id)! - acquired.get(b.id)!;
    });
}
export function inventoryPartners(app: App, id: string): string[] {
  const chosen = app.state.modules.find((m) => m.id === id && m.pos === null);
  if (!chosen) return [];
  const matches = app.state.modules.filter((m) => m.pos === null && m.id !== id && m.type === chosen.type && m.tier === chosen.tier);
  // Matching copies share eligibility. Ask the authoritative preview once,
  // rather than repeatedly searching the roster for every potential twin.
  return matches[0] && inventoryCombinePreview(app.state, id, matches[0].id) ? matches.map((m) => m.id) : [];
}
function moduleRead(m: ModuleInstance): string {
  return `${RARITY_LABEL[typeRarityOf(m.type)]} · ${tierWord(m.tier)}${faceLevel(m) === undefined ? "" : ` · Lv. ${m.level}`}`;
}
function moduleRow(app: App, m: ModuleInstance, partner = false): string {
  const inv = app.ui.inventory;
  const selected = inv.selected.includes(m.id);
  const eligible = inventoryPartners(app, m.id).length > 0;
  const select = inv.scrapMode && !partner;
  return `<div class="inventory-row${selected && select ? " selected" : ""}">
    <button class="inventory-copy" ${partner ? `data-partner="${m.id}"` : `data-inv="${m.id}"`} data-type="${m.type}" data-rarity="${typeRarityOf(m.type)}"${select ? ` aria-pressed="${selected}"` : ""} aria-label="${select ? (selected ? "Deselect" : "Select for scrap") : partner ? "Merge with" : "Inspect"} ${META[m.type].name} · ${moduleRead(m)}${m.reserve > 0 ? ` · ${formatNumber(m.reserve)} charge reserve` : ""}">
      <span class="inventory-mark">${inventoryTileSvg(m)}</span><span class="inventory-copy-read">${rarityMark(typeRarityOf(m.type))}<strong>${META[m.type].name}</strong><span class="inventory-tier mono" aria-hidden="true">${tierNumeral(m.tier)}</span>${faceLevel(m) === undefined ? "" : `<span class="inventory-level mono" aria-hidden="true">Lv. ${m.level}</span>`}</span>${select ? `<span class="inventory-check" aria-hidden="true">${selected ? "✓" : ""}</span>` : ""}</button>
    ${select ? `<span class="inventory-row-payout mono">+${formatInt(moduleScrapValue(m))}</span>` : partner ? "" : mergeButton(m.id, META[m.type].name, eligible)}</div>`;
}
function back(): string { return `<button data-inventory-back>Back to inventory</button>`; }
// Owned-copy strengths exclude neighbors, mutators, and habit build effects.
function intrinsicEffectsHtml(m: ModuleInstance): string {
  const power = modulePower(m);
  const profile = generatorProfileOf(m.type);
  if (profile) return `<div class="inventory-intrinsics">
    <p class="mono">${formatNumber(profile.focus * power)} ${termTipHtml("charge")} / focus s</p>
    <p class="mono">${formatNumber(profile.noteChar * power)} / note character · +${formatNumber(profile.noteCreate * power)} / new note</p>
    <p class="mono">×${formatNumber(profile.goal * power)} goal-completion base</p>
    <p class="mono">${formatNumber(power)} base delivery strength</p></div>`;
  if (CATEGORY_OF[m.type] === "booster") return `<p class="mono">+${formatNumber(100 * boosterBonusOf(m.type) * power)}% ${boosterTermOf(m.type)}</p>`;
  return "";
}
function inspectHtml(app: App): string {
  const id = app.ui.inventory.inspect!;
  const m = app.state.modules.find((m) => m.id === id && m.pos === null);
  if (!m) return `${back()}<p class="inventory-empty">This copy is no longer in inventory.</p>`;
  return `${back()}<div class="inventory-inspection"><svg class="inventory-detail-face hex-stack-face" viewBox="-70 -70 140 140" data-type="${m.type}" data-rarity="${typeRarityOf(m.type)}" aria-label="${META[m.type].name}" role="img">${moduleFace({ type: m.type, tier: m.tier, variant: "identity", readout: "" })}</svg>
    <h3 class="inventory-detail-name" aria-label="${META[m.type].name} · ${moduleRead(m)}">${rarityMark(typeRarityOf(m.type))}${META[m.type].name}<span class="mono">${tierNumeral(m.tier)}</span>${faceLevel(m) === undefined ? "" : `<span class="inventory-level mono">Lv. ${m.level}</span>`}</h3><p>${breatherTermsHtml(META[m.type].role)}</p>${profileGradesHtml(m.type, { breatherDisclosed: true })}${intrinsicEffectsHtml(m)}
    ${isVoiceType(m.type) ? `<p class="mono">${voiceCapacityOf(app.state, m.type)} ${termTipHtml("Harmonic capacity")}</p>` : ""}
    ${m.reserve > 0 ? `<p class="mono">${formatNumber(m.reserve)} charge reserve</p>` : ""}${m.shift !== null ? `<p class="mono">Pitch shift ${m.shift > 0 ? "+" : ""}${m.shift}</p>` : ""}
    <button class="primary" data-inventory-place="${m.id}">Place</button></div>`;
}
function mergeHtml(app: App): string {
  const offer = app.ui.inventory.merge!;
  const partners = inventoryPartners(app, offer.id);
  if (!offer.partner) return `${back()}<h3>Choose merge partner</h3><div class="inventory-list">${partners.map((id) => moduleRow(app, app.state.modules.find((m) => m.id === id)!, true)).join("") || `<p class="inventory-empty">No eligible inventory partner.</p>`}</div>`;
  if (!partners.includes(offer.partner)) return `${back()}<p class="inventory-empty">These copies can no longer merge.</p>`;
  const a = app.state.modules.find((m) => m.id === offer.id)!;
  const b = app.state.modules.find((m) => m.id === offer.partner)!;
  const preview = inventoryCombinePreview(app.state, a.id, b.id)!;
  return `${back()}<h3>Review merge</h3><div class="inventory-review-pair">${moduleRow(app, a, true)}${moduleRow(app, b, true)}</div><div class="stat-row"><span>Result</span><span class="mono">${tierWord(preview.nextTier)}${faceLevel(a) === undefined ? "" : ` · Lv. ${preview.level}`}</span></div><div class="stat-row"><span>Upgrade refund</span><span class="mono">${formatInt(preview.refund)} ν</span></div><p class="inventory-loss">Partner consumed${b.reserve > 0 ? ` · ${formatNumber(b.reserve)} charge reserve lost` : ""}${b.shift !== null ? ` · pitch shift ${b.shift} lost` : ""}${b.target !== null ? " · recipient selection lost" : ""}. Chosen copy's secondary effects retained.</p><button class="primary" data-inventory-merge-confirm>Merge pair</button>`;
}
function scrapReviewHtml(app: App): string {
  const selected = app.ui.inventory.selected;
  const copies = selected.map((id) => app.state.modules.find((m) => m.id === id && m.pos === null));
  const stale = copies.some((m) => !m);
  const modules = copies.filter((m): m is ModuleInstance => !!m);
  const payout = modules.reduce((sum, m) => sum + moduleScrapValue(m), 0);
  const invested = modules.reduce((sum, m) => sum + m.invested, 0);
  const reserve = modules.reduce((sum, m) => sum + m.reserve, 0);
  return `<button data-inventory-back>Back to selection</button><h3>Scrap ${selected.length} module${selected.length === 1 ? "" : "s"}?</h3><div class="inventory-scrap-review">${modules.map((m) => `<div class="stat-row"><span>${META[m.type].name} · ${tierWord(m.tier)}${faceLevel(m) === undefined ? "" : ` · Lv. ${m.level}`}</span><span class="mono">+${formatInt(moduleScrapValue(m))}</span></div>`).join("")}</div><div class="stat-row"><span>Scrap payout</span><span class="mono">+${formatInt(payout)}</span></div><p class="inventory-loss">Copies and purchased levels lost · ${formatInt(invested)} ν invested${reserve > 0 ? ` · ${formatNumber(reserve)} charge reserve` : ""}. Cannot undo.</p>${stale ? `<p role="alert">Selection changed. Go back and select again.</p>` : ""}<button class="danger" data-inventory-scrap-confirm${stale || !selected.length ? " disabled" : ""}>Confirm scrap</button>`;
}

// The column and phone sheet share every content/action builder.
export function renderInventoryContent(app: App, host: HTMLElement, sheet: boolean, bindDrag: (element: Element, id: string) => void): void {
  const inv = app.ui.inventory;
  const copies = inventoryModules(app);
  const count = app.state.modules.filter((m) => m.pos === null).length;
  const locked = app.state.mode !== "upgrade";
  const collapsed = !sheet && inv.collapsed && !inv.dragOpen;
  const { scroll: _scroll, ...viewState } = inv;
  const key = JSON.stringify([locked, sheet, collapsed, app.ui.detail?.pos, viewState, app.state.capacityBought,
    app.state.modules.map((m) => [m.id, m.type, m.pos, m.level, m.tier, m.invested, m.reserve, m.shift, m.target]), app.state.mergeCapPurchases]);
  if (host.dataset.inventoryKey === key) return;
  const active = document.activeElement;
  const focusKey = active instanceof HTMLElement && host.contains(active) ? active.dataset.inventoryFocus : undefined;
  closeTooltips(host);
  host.dataset.inventoryKey = key;
  host.classList.toggle("inventory-collapsed", collapsed);
  host.classList.add("inventory-browser", ...(sheet ? [] : ["inst-panel"]));
  host.classList.toggle("inventory-subview", inv.inspect !== null || inv.merge !== null || inv.scrapReview);
  const filters = Object.entries(CATEGORY_WORD).map(([value, name]) => `<option value="${value}"${inv.filters.modules === value ? " selected" : ""}>${name}</option>`).join("");
  const selected = app.state.modules.filter((m) => m.pos === null && inv.selected.includes(m.id));
  const total = selected.reduce((sum, m) => sum + moduleScrapValue(m), 0);
  const browse = `<div class="inventory-tools"><label><span class="sr-only">Category</span><select data-inventory-filter aria-label="Category"><option value="all">All categories</option>${filters}</select></label><label><span class="sr-only">Sort inventory</span><select data-inventory-sort aria-label="Sort inventory">${(["type", "rarity", "level", "newest"] as InventorySort[]).map((value) => `<option value="${value}"${inv.sorts.modules === value ? " selected" : ""}>${value === "type" ? "Category / type" : value === "rarity" ? "Rarity" : value === "level" ? "Level" : "Newest"}</option>`).join("")}</select></label></div>
    ${inv.scrapMode ? `<div class="inventory-selection"><span role="status">${inv.selected.length} selected · +${formatInt(total)} scrap</span><button data-inventory-select-all>Select all matching</button><div class="inventory-selection-actions"><button data-inventory-cancel>Cancel</button><button data-inventory-review${inv.selected.length ? "" : " disabled"}>Scrap selected</button></div></div>` : ""}
    <div class="inventory-list" data-inventory-scroll>${copies.map((m) => moduleRow(app, m)).join("") || `<p class="inventory-empty">${count ? "No matching copies." : "No stored modules."}</p>`}</div>`;
  const subview = inv.inspect !== null ? inspectHtml(app) : inv.merge !== null ? mergeHtml(app) : inv.scrapReview ? scrapReviewHtml(app) : browse;
  host.innerHTML = `${sheet ? "" : '<div class="inventory-frame inst-panel-face">'}<div class="inventory-head"><button data-inventory-collapse aria-expanded="${!collapsed}" aria-label="${sheet ? "Close inventory" : collapsed ? "Expand inventory" : "Collapse inventory"}, ${count} stored">${collapsed ? INVENTORY_ICON : "Inventory"}<span class="mono">${count}</span>${collapsed ? "" : `<span aria-hidden="true">${sheet ? "×" : "−"}</span>`}</button>${!collapsed && !inv.scrapMode ? `<button data-inventory-menu aria-expanded="${inv.menu}" aria-label="Inventory actions">Actions</button>` : ""}</div>${collapsed ? "" : `<div class="inventory-body">${inv.menu ? `<div class="inventory-menu"><button data-inventory-scrap-mode${locked ? " disabled" : ""}>Select for scrap</button></div>` : ""}${subview}</div>`}${sheet ? "" : "</div>"}`;
  host.querySelectorAll<HTMLElement>("button, select").forEach((node) => {
    const attr = node.getAttributeNames().find((name) => name.startsWith("data-"));
    node.dataset.inventoryFocus = attr ? `${attr}:${node.getAttribute(attr)}` : node.getAttribute("aria-label") ?? "";
  });
  const filterSelect = host.querySelector<HTMLSelectElement>("[data-inventory-filter]");
  const sortSelect = host.querySelector<HTMLSelectElement>("[data-inventory-sort]");
  if (filterSelect) filterSelect.value = inv.filters.modules;
  if (sortSelect) sortSelect.value = inv.sorts.modules;
  const update = () => app.render();
  const on = (selector: string, fn: (el: HTMLElement) => void) => host.querySelectorAll<HTMLElement>(selector).forEach((el) => app.listen(el, "click", () => fn(el)));
  on("[data-inventory-collapse]", () => { if (sheet) app.closeModal(); else { inv.collapsed = !inv.collapsed; inv.menu = false; update(); } });
  on("[data-inventory-menu]", () => { inv.menu = !inv.menu; update(); });
  on("[data-inventory-scrap-mode]", () => {
    if (locked) return;
    inv.menu = false; inv.inspect = null; inv.merge = null; inv.scrapMode = true; inv.scrapReview = false; inv.selected = [];
    app.ui.placing = null; app.worldCancelGestures(); update();
  });
  on("[data-inventory-cancel]", () => { inv.scrapMode = false; inv.scrapReview = false; inv.selected = []; update(); });
  on("[data-inventory-select-all]", () => { inv.selected = [...new Set([...inv.selected, ...inventoryModules(app).map((m) => m.id)])]; update(); });
  on("[data-inventory-review]", () => { inv.scrapReview = true; update(); });
  on("[data-inventory-scrap-confirm]", () => app.confirmInventoryScrap());
  on("[data-inventory-back]", () => { inv.inspect = null; inv.merge = null; inv.scrapReview = false; update(); });
  host.querySelectorAll<HTMLSelectElement>("[data-inventory-filter], [data-inventory-sort]").forEach((el) => app.listen(el, "change", () => {
    if (el.hasAttribute("data-inventory-filter")) inv.filters.modules = el.value;
    else inv.sorts.modules = el.value as InventorySort;
    inv.scroll.modules = 0; update();
  }));
  on("[data-inv]", (el) => {
    const id = el.dataset.inv!;
    if (inv.scrapMode) inv.selected = inv.selected.includes(id) ? inv.selected.filter((s) => s !== id) : [...inv.selected, id];
    else { inv.inspect = id; inv.menu = false; inv.returnId = id; }
    update();
  });
  if (!locked && !inv.scrapMode) {
    host.querySelectorAll<HTMLElement>("[data-inv]").forEach((el) => bindDrag(el, el.dataset.inv!));
  }
  on("[data-inventory-place]", (el) => {
    if (locked) return;
    const id = el.dataset.inventoryPlace!;
    inv.inspect = null;
    if (app.ui.detail) {
      if (sheet) app.closeModal();
      app.detailPlaceModule(id);
      return;
    }
    if (sheet) app.closeModal();
    app.beginPlacing(id);
  });
  host.querySelectorAll<HTMLElement>("[data-inventory-merge]").forEach((el) => {
    let touch = false;
    app.listen(el, "pointerdown", (event) => { touch = (event as PointerEvent).pointerType === "touch"; });
    app.listen(el, "click", (event) => {
      const touchClick = touch || (event as PointerEvent).pointerType === "touch";
      touch = false;
      // A first touch names the unfamiliar glyph; a second opens review.
      if (touchClick && !el.closest(".inst-tip")?.classList.contains("show")) return;
      if (locked || inv.scrapMode) return;
      const id = el.dataset.inventoryMerge!;
      const partners = inventoryPartners(app, id);
      if (!partners.length) return;
      inv.returnId = id;
      inv.merge = { id, partner: partners.length === 1 ? partners[0]! : null }; update();
    });
  });
  on("[data-partner]", (el) => { if (inv.merge) { inv.merge.partner = el.dataset.partner!; update(); } });
  // Inputs in the final review are read-only, not another partner picker.
  if (inv.merge?.partner) host.querySelectorAll<HTMLButtonElement>("[data-partner]").forEach((el) => { el.disabled = true; });
  on("[data-inventory-merge-confirm]", () => app.confirmInventoryMerge());
  const scroller = host.querySelector<HTMLElement>("[data-inventory-scroll]");
  if (scroller) {
    scroller.scrollTop = inv.scroll.modules;
    app.listen(scroller, "scroll", () => { inv.scroll.modules = scroller.scrollTop; });
  }
  if (locked) host.querySelectorAll<HTMLButtonElement>("[data-inventory-place], [data-inventory-merge-confirm], [data-inventory-scrap-confirm]").forEach((el) => { el.disabled = true; });
  wireTooltips(host, app.signal);
  if (focusKey !== undefined) {
    const target = [...host.querySelectorAll<HTMLElement>("[data-inventory-focus]")].find((el) => el.dataset.inventoryFocus === focusKey);
    (target ?? (inv.inspect || inv.merge || inv.scrapReview ? host.querySelector<HTMLElement>("[data-inventory-back]") : [...host.querySelectorAll<HTMLElement>("[data-inv]")].find((el) => el.dataset.inv === inv.returnId)) ?? host.querySelector<HTMLElement>("button"))?.focus({ preventScroll: true });
  }
}

// Temporary opening does not rebuild drag targets: cleanup runs before drop
// hit testing, so leave the expanded DOM until the next render after the drop.
export function openInventoryForDrag(app: App, hit: Element | null): void {
  const inv = app.ui.inventory;
  if (!inv.collapsed || inv.dragOpen || !hit?.closest("#inventory-zone, #world-tray")) return;
  inv.dragOpen = true;
  app.render();
}
