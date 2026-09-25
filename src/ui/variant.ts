// PROTOTYPE (issue #119) — throwaway. Shared plumbing for the console-
// hierarchy variants: the production ledger's shared anatomy, the feats
// chip, and the tool icons the standardized action rows are built from.
// Nothing here ships; the validated decision gets folded into real code.
import { ACHIEVEMENTS } from "../engine/achievements";
import type { GameState } from "../engine/types";
import { formatInt, formatNumber } from "./format";

export type PrototypeVariant = "a" | "b" | "c" | "d" | "e";

// Single source of truth for which keys the prototype accepts — main.ts
// gates body[data-variant] through this, so a new variant lands here only.
export function isPrototypeVariant(v: string | null | undefined): v is PrototypeVariant {
  return v === "a" || v === "b" || v === "c" || v === "d" || v === "e";
}

export function prototypeVariant(): PrototypeVariant | null {
  const v = document.body.dataset.variant;
  return isPrototypeVariant(v) ? v : null;
}

// The ledger's three cells, shared by every placement (console in A and D,
// monitor footer in B, board strip in C).
export function ledgerCellsHtml(): string {
  return `
    <div class="prod-cell"><span class="prod-label">Nous</span><strong class="mono" data-live="nous"></strong></div>
    <div class="prod-cell"><span class="prod-label">Rate</span><strong class="mono" data-live="rate"></strong></div>
    <div class="prod-cell"><span class="prod-label">Session</span><strong class="mono" data-live="session"></strong></div>`;
}

// The production ledger: nous, rate, and session as three labeled cells of
// one bordered instrument — the "reads as one system" answer every variant
// shares, placed differently (console in A, monitor footer in B, board
// strip in C).
export function ledgerHtml(): string {
  return `<div class="prod-ledger" role="group" aria-label="Production">${ledgerCellsHtml()}</div>`;
}

// D and E: the ledger with the formula disclosure riding the Rate cell —
// hover or focus reveals it on pointer devices; tap pins it open, and on
// narrow widths it presents as a modal sheet. On wide layouts the ambient
// equation rides in the Rate cell, collapsing the plain total into the
// formula's own; on narrow the equation hides and the total stands alone.
// The formula's full detail is exposed ONLY through this cell; the scrim
// rides outside the ledger so it can cover the viewport.
export function ledgerFormulaHtml(ambientEquation: string, panel: string): string {
  return `<div class="prod-ledger prod-ledger-formula" role="group" aria-label="Production">
    <div class="prod-cell"><span class="prod-label">Nous</span><strong class="mono" data-live="nous"></strong></div>
    <div class="prod-cell prod-cell-rate" tabindex="0" role="button" aria-expanded="false" aria-label="Rate — show the formula breakdown"><span class="prod-label">Rate</span><span class="rate-equation">${ambientEquation}</span><strong class="mono" data-live="rate"></strong><span class="monitor-hint ledger-hint" aria-hidden="true">ⓘ</span>${panel}</div>
    <div class="prod-cell"><span class="prod-label">Session</span><strong class="mono" data-live="session"></strong></div>
  </div>
  <div class="formula-scrim" aria-hidden="true"></div>`;
}

export function unlockedCount(state: GameState): number {
  return Object.keys(state.achievements).length;
}

export function updateLedgerLive(scope: ParentNode, state: GameState, rate: number): void {
  const set = (live: string, text: string) => {
    const node = scope.querySelector(`[data-live="${live}"]`);
    if (node && node.textContent !== text) node.textContent = text;
  };
  set("nous", `${formatInt(state.nous)} ν`);
  set("rate", `${formatNumber(rate)} ν/s`);
  set("session", state.session ? `${formatNumber(state.session.earned)} ν` : "—");
}

export const FEATS_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
  <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
  <path d="M4 22h16"/>
  <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
  <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
  <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
</svg>`;

export function featsChipHtml(count: number): string {
  return `<button class="feats-chip" id="feats-chip" title="Achievements — every feat, and how close the next one is">${FEATS_SVG}<span class="mono">${count}/${ACHIEVEMENTS.length} feats</span></button>`;
}

// The standardized action row's icon set. Every action wears the same
// anatomy — icon + label in A, icon alone in B and C — so no action reads
// as a different kind of thing from its neighbors.
export const TOOL_ICONS = {
  catalog: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5Z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/></svg>`,
  forge: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c1.8 3.2-3.2 4.6-3.2 8.4a3.2 3.2 0 0 0 6.4 0c0-1.4-.6-2.3-1.1-2.9 1.9.5 3.4 2 3.4 4.3a5.5 5.5 0 0 1-11 0C6.5 7.6 10.8 6.4 12 3Z"/></svg>`,
  arrange: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 9-3 3 3 3"/><path d="m9 5 3-3 3 3"/><path d="m15 19-3 3-3-3"/><path d="m19 9 3 3-3 3"/><path d="M2 12h20"/><path d="M12 2v20"/></svg>`,
  chords: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>`,
};
