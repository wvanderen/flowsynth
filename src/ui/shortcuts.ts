/** Shared bindings for document handlers and the read-only Settings reference. */
export const SHORTCUTS = {
  layer: { key: "l", label: "L", description: "Cycle available layers" },
  escape: { key: "Escape", label: "Esc", description: "Dismiss or cancel the current action" },
  maximum: { key: "Shift", label: "Shift", description: "Hold for maximum module upgrades" },
  pan: { key: "Space", label: "Space + drag", description: "Pan the board over occupied cells" },
} as const;

export function isLayerShortcut(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
  const target = event.target;
  if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')) return false;
  return event.key.toLowerCase() === SHORTCUTS.layer.key;
}
