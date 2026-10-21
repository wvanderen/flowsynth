// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { updateSvg } from "./svg";

// The board's keyed SVG diff must keep a reused node's bare text live
// beside its element children (#442): the face nameplate mixes the name's
// text node with the tier tspan, and a module replacing another in the
// same cell reuses the node — the name froze at the first occupant's.
describe("updateSvg", () => {
  const cell = (name: string, readout: string): string =>
    `<g class="cell-node" data-cell="0,0"><g class="module-node" data-type="x"><polygon data-key="hex"/><text data-key="name">${name}<tspan class="face-tier"> I</tspan></text><text data-key="readout">${readout}</text></g></g>`;

  it("updates a reused node's bare text beside its element children", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    updateSvg(svg, cell("BOOST", "+28.8%"));
    expect(svg.querySelector('[data-key="name"]')!.textContent).toBe("BOOST I");
    updateSvg(svg, cell("ECHO", "G3"));
    const name = svg.querySelector('[data-key="name"]')!;
    expect(name.textContent).toBe("ECHO I");
    expect(name.querySelector("tspan")!.textContent).toBe(" I");
    expect(svg.querySelector('[data-key="readout"]')!.textContent).toBe("G3");
  });

  it("keeps sibling nodes intact across the sync", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    updateSvg(svg, cell("BOOST", "+28.8%"));
    updateSvg(svg, cell("ECHO", "G3"));
    expect(svg.querySelector('[data-key="hex"]')).not.toBeNull();
    expect(svg.querySelector('[data-cell="0,0"]')!.children.length).toBe(1);
  });

  it("replaces a reused node when the bare-text count changes", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    updateSvg(svg, cell("BOOST", "+1"));
    updateSvg(svg, cell("ECHO", "+1"));
    updateSvg(
      svg,
      `<g class="cell-node" data-cell="0,0"><g class="module-node" data-type="x"><text data-key="name">A <tspan>b</tspan> C<tspan>d</tspan></text></g></g>`,
    );
    expect(svg.querySelector('[data-key="name"]')!.textContent).toBe("A b Cd");
  });
});
