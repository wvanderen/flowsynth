// Tiny DOM shared utilities — one home for the byId lookup and the markup
// escaper every region module uses.

export function byId(id: string): HTMLElement | null {
  return document.getElementById(id);
}

// Escapes text bound for innerHTML strings. Forgetting a call site is an
// injection bug, so user-typed names route through here at every markup
// seam.
export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
