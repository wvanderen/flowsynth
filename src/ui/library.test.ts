// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { NAMED_CHORDS } from "../engine/constants";
import type { ChordDiscovery } from "../engine/types";
import { chordGlyphSvg, latticeOffset, libraryCardHtml, wireCells } from "./library";

describe("canonical lattice offsets", () => {
  it("lands each interval on its fifths-axis column, ties broken toward the root", () => {
    // The difficulty ladder is the geometry's: one hex step to the fifth
    // and the fourth, two to the ♭7 and the whole tone, three to the m3
    // and M6, four to the M3/m6, five to the M7 and minor second. Where a
    // register row ties on hex distance, the diagonal cell euclidean-
    // closest to the root wins — the compact spread.
    expect(latticeOffset(0)).toEqual({ dq: 0, dr: 0, dist: 0 });
    expect(latticeOffset(7)).toEqual({ dq: 1, dr: 0, dist: 1 });
    expect(latticeOffset(5)).toEqual({ dq: -1, dr: 1, dist: 1 });
    expect(latticeOffset(10)).toEqual({ dq: -2, dr: 1, dist: 2 });
    expect(latticeOffset(2)).toEqual({ dq: 2, dr: -1, dist: 2 });
    expect(latticeOffset(3)).toEqual({ dq: -3, dr: 2, dist: 3 });
    expect(latticeOffset(9)).toEqual({ dq: 3, dr: -1, dist: 3 });
    expect(latticeOffset(4)).toEqual({ dq: 4, dr: -2, dist: 4 });
    expect(latticeOffset(8)).toEqual({ dq: -4, dr: 2, dist: 4 });
    expect(latticeOffset(11)).toEqual({ dq: 5, dr: -2, dist: 5 });
  });

  it("counts the wire gaps the ladder prices", () => {
    const root = latticeOffset(0);
    // ♭7 one wire cell between, m3 two, M3/m6 three (ADR-0021).
    expect(wireCells(root, latticeOffset(7))).toHaveLength(0);
    expect(wireCells(root, latticeOffset(10))).toHaveLength(1);
    expect(wireCells(root, latticeOffset(3))).toHaveLength(2);
    expect(wireCells(root, latticeOffset(4))).toHaveLength(3);
    expect(wireCells(root, latticeOffset(8))).toHaveLength(3);
    // The intermediate cells sound the line's own pitches (the ♭7's path
    // passes the register-mate of the fourth).
    expect(wireCells(root, latticeOffset(10))).toEqual([{ dq: -1, dr: 1 }]);
  });
});

describe("glyph rendering", () => {
  const def = (name: string) => NAMED_CHORDS.find((d) => d.name === name)!;

  it("a discovered glyph rides the class's board hue and carries labels", () => {
    const svg = chordGlyphSvg(def("Major triad"), true);
    expect(svg).toContain("var(--chord-major-triad)");
    // The voices and ring sit solid — only the wire gaps stay dashed.
    expect(svg).not.toContain('stroke-dasharray="3.5 2.5"');
    expect(svg).not.toContain('stroke-dasharray="5 4"');
    // Recipe labels, no accidentals: R and the half-step counts.
    expect(svg).toContain(">R</text>");
    expect(svg).toContain(">4</text>");
    expect(svg).toContain(">7</text>");
  });

  it("the Octave's far voice reads 12", () => {
    const svg = chordGlyphSvg(def("Octave"), true);
    expect(svg).toContain(">12</text>");
  });

  it("an undiscovered glyph is the hueless dashed silhouette, labels gone", () => {
    const svg = chordGlyphSvg(def("Minor seventh"), false);
    expect(svg).not.toContain("chord-minor-seventh");
    expect(svg).toContain("stroke-dasharray");
    expect(svg).toContain("var(--line-strong)");
    expect(svg).not.toContain("</text>");
    // The wire gaps stay counted — the invitation.
    expect(svg).toContain('stroke="var(--line-strong)" stroke-width="1"');
  });

  it("keeps every recipe label on discovered chords, including sprawling recipes", () => {
    for (const chord of NAMED_CHORDS) {
      const host = document.createElement("div");
      host.innerHTML = chordGlyphSvg(chord, true);
      const labels = [...host.querySelectorAll("text")].map((text) => text.textContent);
      const intervals = chord.name === "Octave" ? [0, 12] : chord.intervals;
      expect(labels, chord.name).toEqual(intervals.map((interval) => interval === 0 ? "R" : String(interval)));
    }
  });

  it("keeps undiscovered names out of accessible labels", () => {
    for (const chord of NAMED_CHORDS) {
      const host = document.createElement("div");
      host.innerHTML = chordGlyphSvg(chord, false);
      expect(host.querySelector("svg")?.getAttribute("aria-label")).toBe("Undiscovered chord glyph");
      expect(host.textContent?.trim()).toBe("");
    }
  });

  it("encloses every voice face in a nondegenerate outline for every chord", () => {
    const points = (path: Element): number[][] =>
      [...path.getAttribute("d")!.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)]
        .map((match) => [Number(match[1]), Number(match[2])]);
    for (const chord of NAMED_CHORDS) {
      const host = document.createElement("div");
      host.innerHTML = chordGlyphSvg(chord, true);
      const outline = points(host.querySelector('path[stroke-width="1.6"]')!);
      const area = outline.reduce((sum, [x, y], i) => {
        const next = outline[(i + 1) % outline.length]!;
        return sum + x! * next[1]! - y! * next[0]!;
      }, 0);
      expect(Math.abs(area), chord.name).toBeGreaterThan(1);
      for (const face of host.querySelectorAll('path[stroke-width="1.3"]')) {
        for (const [x, y] of points(face)) {
          for (let i = 0; i < outline.length; i++) {
            const a = outline[i]!;
            const b = outline[(i + 1) % outline.length]!;
            const cross = (b[0]! - a[0]!) * (y! - a[1]!) - (b[1]! - a[1]!) * (x! - a[0]!);
            expect(cross * Math.sign(area), chord.name).toBeGreaterThanOrEqual(-0.1);
          }
        }
      }
    }
  });

  it("every one of the eleven classes renders both states", () => {
    for (const chord of NAMED_CHORDS) {
      expect(chordGlyphSvg(chord, true)).toContain("<svg");
      expect(chordGlyphSvg(chord, false)).toContain("<svg");
    }
  });
});

describe("field-guide cards", () => {
  const def = (name: string) => NAMED_CHORDS.find((d) => d.name === name)!;

  it("a discovered card shows glyph, name, bonus, and the roots-heard hairline", () => {
    const record: ChordDiscovery = { formed: true, firstFormedAt: 1, rootsHeard: 4, roots: [0, 7, 2, 9] };
    const html = libraryCardHtml(def("Major triad"), record);
    expect(html).toContain("<article");
    expect(html).not.toContain("locked");
    expect(html).toContain("<h3>Major triad</h3>");
    expect(html).toContain("×1.75 while it sings");
    expect(html).toContain('width:33.3%');
    expect(html).toContain('aria-label="4 of 12 roots heard"');
  });

  it("an undiscovered card is the glyph and the hairline — nothing else", () => {
    const html = libraryCardHtml(def("Major triad"), undefined);
    expect(html).toContain("locked");
    expect(html).not.toContain("<h3>");
    expect(html).not.toContain("while it sings");
    expect(html).toContain("library-hairline");
    expect(html).toContain("width:0.0%");
  });

  it("a discovered card names its singing state — active bonus or recognized idle (#258)", () => {
    const record: ChordDiscovery = { formed: true, firstFormedAt: 1, rootsHeard: 1, roots: [0] };
    const singing = libraryCardHtml(def("Major triad"), record, true);
    expect(singing).toContain("singing now");
    expect(singing).toContain("library-state-active");
    expect(singing).toContain('class="library-card singing"');
    const idle = libraryCardHtml(def("Major triad"), record, false);
    expect(idle).toContain("heard — not singing");
    expect(idle).not.toContain("singing now");
    // The default is the honest one: recognized, not singing.
    expect(libraryCardHtml(def("Major triad"), record)).toContain("heard — not singing");
  });
});
