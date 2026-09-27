// In-place text swap for a data-live node within a scope; tick-safe.
export function liveSet(scope: ParentNode, live: string, text: string): void {
  const node = scope.querySelector(`[data-live="${live}"]`);
  if (node && node.textContent !== text) node.textContent = text;
}
