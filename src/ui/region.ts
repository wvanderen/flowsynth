// The keyed-region mechanism: every region's dual-mode render protocol in
// one place. A region's structural rebuild is gated on a key it derives
// from the facts its markup reads; when the key is unchanged, only the
// in-place live pass runs — so focus, scroll position, and CSS animations
// survive clock ticks. (svg.ts's keyed child-diff is the same idea at node
// granularity; this is the region-scale version.) One protocol rule the
// gate imposes: a region that hides its host outright must clear the
// stored key with it (as modals.ts's shell does), because the key alone
// decides rebuilds — a re-shown region must never keep a stale one.

/**
 * Runs `build` only when `key` differs from the host's last structural key.
 * The build must (re)populate the host and bind its controls; the caller
 * owns what happens on either path.
 */
export function keyedRegion(host: HTMLElement, key: string, build: (host: HTMLElement) => void): void {
  if (host.dataset.renderKey === key) return;
  host.dataset.renderKey = key;
  build(host);
}

/** In-place text swap for a data-live node within a scope; tick-safe. */
export function liveText(scope: ParentNode, live: string, text: string): void {
  const node = scope.querySelector(`[data-live="${live}"]`);
  if (node && node.textContent !== text) node.textContent = text;
}

/** In-place width swap for a fill-style node within a scope; tick-safe. */
export function liveWidth(scope: ParentNode, selector: string, width: string): void {
  const node = scope.querySelector<HTMLElement>(selector);
  if (node && node.style.width !== width) node.style.width = width;
}
