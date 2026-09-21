// The keyed-region mechanism: every region's dual-mode render protocol in
// one place. A region's structural rebuild is gated on a key it derives
// from the facts its markup reads; when the key is unchanged, only the
// in-place live pass runs — so focus, scroll position, and CSS animations
// survive clock ticks. (svg.ts's keyed child-diff is the same idea at node
// granularity; this is the region-scale version.)

/**
 * Runs `build` only when `key` differs from the host's last structural key.
 * Returns whether the rebuild happened. The build must (re)populate the
 * host and bind its controls; the caller owns what happens on either path.
 */
export function keyedRegion(host: HTMLElement, key: string, build: (host: HTMLElement) => void): boolean {
  if (host.dataset.renderKey === key) return false;
  host.dataset.renderKey = key;
  build(host);
  return true;
}

/** In-place text swap for a data-live node within a scope; tick-safe. */
export function liveText(scope: ParentNode, live: string, text: string): void {
  const node = scope.querySelector(`[data-live="${live}"]`);
  if (node && node.textContent !== text) node.textContent = text;
}
