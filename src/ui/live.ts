// In-place text swap for a data-live node within a scope; tick-safe.
export function liveSet(scope: ParentNode, live: string, text: string): void {
  const node = scope.querySelector(`[data-live="${live}"]`);
  if (node && node.textContent !== text) node.textContent = text;
}

// In-place attribute swap for a data-live node, same guard as the text
// swap and the horizon clip's numeric compare: the tick never rewrites an
// attribute it hasn't changed, so nothing churns while a value holds.
export function liveAttr(scope: ParentNode, live: string, attr: string, value: string): void {
  const node = scope.querySelector(`[data-live="${live}"]`);
  if (node && node.getAttribute(attr) !== value) node.setAttribute(attr, value);
}
