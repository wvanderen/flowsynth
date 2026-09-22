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

// A static stat row: label left, value right.
export function stat(label: string, value: string): string {
  return `<div class="stat-row"><span>${label}</span><span class="mono">${value}</span></div>`;
}

// A stat row whose value moves with ticks: the value span carries a
// data-live id the region's live pass updates in place.
export function statLive(id: string, label: string, value: string): string {
  return `<div class="stat-row"><span>${label}</span><span class="mono" data-live="${id}">${value}</span></div>`;
}
