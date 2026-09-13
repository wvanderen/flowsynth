// Update the existing SVG so browser animations, transitions, and focus survive
// clock ticks. Cells and charge links retain identity when neighbors change.
export function updateSvg(svg: SVGSVGElement, markup: string): void {
  const next = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  next.innerHTML = markup;
  syncChildren(svg, next);
}

function key(element: Element, index: number): string {
  return element.getAttribute("data-cell") ?? element.getAttribute("data-key") ?? `${element.localName}:${index}`;
}

function syncChildren(current: Element, next: Element): void {
  if (next.children.length === 0) {
    if (current.children.length > 0 || current.textContent !== next.textContent) current.textContent = next.textContent;
    return;
  }
  const existing = new Map(Array.from(current.children, (child, index) => [key(child, index), child]));
  Array.from(next.children).forEach((desired, index) => {
    const childKey = key(desired, index);
    let child = existing.get(childKey);
    if (!child || child.localName !== desired.localName) {
      child = desired.cloneNode(true) as Element;
    } else {
      existing.delete(childKey);
      for (const attribute of Array.from(child.attributes)) {
        if (!desired.hasAttribute(attribute.name)) child.removeAttribute(attribute.name);
      }
      for (const attribute of Array.from(desired.attributes)) {
        if (child.getAttribute(attribute.name) !== attribute.value) child.setAttribute(attribute.name, attribute.value);
      }
      syncChildren(child, desired);
    }
    const atIndex = current.children[index] ?? null;
    if (child !== atIndex) current.insertBefore(child, atIndex);
  });
  for (const child of existing.values()) child.remove();
}
