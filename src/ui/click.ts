// One-shot click suppression shared by every drag path (§5, §7): a gesture
// that ends in a release must not fall through to whatever sits under it —
// the release is the drag's end, never a click. The capture-phase listener
// eats exactly the next click; the timeout frees the document if no click
// ever comes.
export function suppressNextClick(): void {
  const suppress = (clickEvent: Event) => {
    clickEvent.preventDefault();
    clickEvent.stopImmediatePropagation();
  };
  document.addEventListener("click", suppress, { capture: true, once: true });
  setTimeout(() => document.removeEventListener("click", suppress, true), 0);
}
