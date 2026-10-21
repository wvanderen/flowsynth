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
      // A node mixing bare text with elements (the face nameplate: the
      // name's text before the tier tspan) carries meaning in its bare
      // text nodes — the keyed element walk below never touches them, so
      // a reused node kept its first occupant's name (#442). Pair the
      // bare texts positionally; a different count is a different shape,
      // so take the whole desired node rather than risk a mispair.
      if (desired.children.length > 0 && !syncBareText(child, desired)) {
        const fresh = desired.cloneNode(true) as Element;
        child.replaceWith(fresh);
        child = fresh;
      } else {
        syncChildren(child, desired);
      }
    }
    const atIndex = current.children[index] ?? null;
    if (child !== atIndex) current.insertBefore(child, atIndex);
  });
  for (const child of existing.values()) child.remove();
}

function syncBareText(current: Element, next: Element): boolean {
  const currentTexts = bareTextNodes(current);
  const nextTexts = bareTextNodes(next);
  if (currentTexts.length !== nextTexts.length) return false;
  for (let i = 0; i < nextTexts.length; i++) {
    const value = nextTexts[i]!.nodeValue ?? "";
    if (currentTexts[i]!.nodeValue !== value) currentTexts[i]!.nodeValue = value;
  }
  return true;
}

function bareTextNodes(element: Element): Text[] {
  return Array.from(element.childNodes).filter((node): node is Text => node.nodeType === Node.TEXT_NODE);
}
