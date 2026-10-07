// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { NAMED_CHORDS } from "../engine/constants";
import type { ChordDiscovery, NamedChordTerm } from "../engine/types";
import {
  activeTipText,
  bonusTipText,
  chordGlyphSvg,
  instancesByClass,
  latticeOffset,
  libraryHeaderHtml,
  libraryIndexRowHtml,
  libraryStageHtml,
  rootsTipText,
  wireCells,
} from "./library";

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

  it("an undiscovered glyph is the solid dimmed hueless silhouette, ring absent, labels gone", () => {
    const svg = chordGlyphSvg(def("Minor seventh"), false);
    // Hueless and dimmed: no class hue anywhere, the muted token carries it.
    expect(svg).not.toContain("chord-minor-seventh");
    expect(svg).toContain("var(--muted)");
    // Solid voice hexes: the only dashes left are the wire gaps' —
    // modules and spacers distinct at a glance (#278).
    expect(svg).toContain('stroke-dasharray="2.5 2.5"');
    expect(svg).not.toContain('stroke-dasharray="3.5 2.5"');
    expect(svg).not.toContain('stroke-dasharray="5 4"');
    // The sealing ring is absent, not dashed: no annotation path at all.
    expect(svg).not.toContain('stroke-width="1.6"');
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

describe("the instance tally", () => {
  const term = (name: string, instances: number): NamedChordTerm => ({ name, bonus: 0.3, instances, moduleIds: ["m1"], root: 0 });

  it("sums the live terms' instances per class", () => {
    const tally = instancesByClass([term("Fifth", 2), term("Octave", 1), term("Fifth", 1)]);
    expect(tally.get("Fifth")).toBe(3);
    expect(tally.get("Octave")).toBe(1);
    expect(tally.size).toBe(2);
  });

  it("an empty pass tallies nothing", () => {
    expect(instancesByClass([]).size).toBe(0);
  });
});

describe("the index rows (#278)", () => {
  const def = (name: string) => NAMED_CHORDS.find((d) => d.name === name)!;

  it("a discovered row carries its name, its live pip + instance count, and its selection state", () => {
    const record: ChordDiscovery = { formed: true, firstFormedAt: 1, rootsHeard: 4, roots: [0, 7, 2, 9] };
    const html = libraryIndexRowHtml(def("Major triad"), record, 2, true);
    expect(html).toContain('class="chord-row"');
    expect(html).toContain('data-chord="Major triad"');
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("Major triad");
    expect(html).not.toContain("·····");
    // The live pip rides the class's hue; the count reads ×n.
    expect(html).toContain("--pip:var(--chord-major-triad)");
    expect(html).toContain("×2");
  });

  it("a discovered class standing idle shows no pip and no count — heard, never earning (#258)", () => {
    const record: ChordDiscovery = { formed: true, firstFormedAt: 1, rootsHeard: 1, roots: [0] };
    const html = libraryIndexRowHtml(def("Major triad"), record, 0, false);
    expect(html).toContain('aria-current="false"');
    expect(html).not.toContain("chord-pip");
    expect(html).not.toContain("×0");
  });

  it("an undiscovered row is the dotted leader and the dim silhouette — no name, no count", () => {
    const html = libraryIndexRowHtml(def("Minor seventh"), undefined, 0, false);
    expect(html).toContain("locked");
    expect(html).toContain("·····");
    // The name stays out of the visible text — the wiring's data attribute
    // carries it, the row never reads it.
    expect(html).not.toContain(">Minor seventh<");
    expect(html).not.toContain("chord-pip");
    expect(html).toContain("Undiscovered chord glyph");
  });
});

describe("the stage (#278)", () => {
  const def = (name: string) => NAMED_CHORDS.find((d) => d.name === name)!;
  const record: ChordDiscovery = { formed: true, firstFormedAt: 1, rootsHeard: 5, roots: [0, 7, 2, 9, 4] };

  it("a discovered stage is the giant glyph, the name, the bonus, the active read, and the roots history", () => {
    const html = libraryStageHtml(def("Major triad"), record, 3, [{ name: "Major triad", instances: 2 }, { name: "Fifth", instances: 1 }]);
    expect(html).toContain('class="chord-stage"');
    expect(html).toContain("<h3");
    expect(html).toContain("Major triad");
    // The bonus figure — no "while it sings", no mechanics outside the tooltip.
    expect(html).toContain("×1.75");
    expect(html).not.toContain("while it sings");
    expect(html).toContain(bonusTipText(def("Major triad")));
    // The active read counts standing instances; the roots history is the
    // inline mono figure — the ring and the hairline are not taken.
    expect(html).toContain("3 active");
    expect(html).toContain(activeTipText([{ name: "Major triad", instances: 2 }, { name: "Fifth", instances: 1 }]));
    expect(html).toContain("5/12 roots");
    expect(html).toContain(rootsTipText(5));
    expect(html).not.toContain("library-hairline");
    expect(html).not.toContain("rootsRing");
  });

  it("an undiscovered stage keeps the silhouette and the dashes — no name, bonus, or roots", () => {
    const html = libraryStageHtml(def("Minor seventh"), undefined, 0, []);
    expect(html).toContain("·····");
    expect(html).toContain("Undiscovered chord glyph");
    expect(html).not.toContain("Minor seventh");
    expect(html).not.toContain("×1.");
    expect(html).not.toContain("/12 roots");
    // The active read is the board's own news — it stands regardless.
    expect(html).toContain("0 active");
  });
});

describe("the tooltip texts", () => {
  const def = NAMED_CHORDS.find((d) => d.name === "Major triad")!;

  it("the bonus tooltip carries the only mechanics — stacking on members, no board-wide claim", () => {
    const text = bonusTipText(def);
    expect(text).toContain("×1.75");
    expect(text).toContain("Instances stack on their members");
    expect(text).not.toContain("while it sings");
    expect(text).not.toContain("board");
  });

  it("the active tooltip names the classes ringing and states the stacking", () => {
    expect(activeTipText([{ name: "Fifth", instances: 2 }, { name: "Octave", instances: 1 }])).toContain("Fifth ×2 · Octave ×1");
    expect(activeTipText([{ name: "Fifth", instances: 1 }])).toContain("rings on the board — 1 standing instance");
    expect(activeTipText([])).toContain("No chord instance stands");
  });

  it("the roots tooltip counts distinct roots, never formations", () => {
    expect(rootsTipText(5)).toContain("5 of 12");
    expect(rootsTipText(5)).toContain("counts once");
  });
});

describe("the header (#278)", () => {
  it("reads the count with the bonus parenthetical — no explanatory paragraph", () => {
    const html = libraryHeaderHtml(4, NAMED_CHORDS.length, 1, 4);
    expect(html).toContain('id="modal-title"');
    expect(html).toContain("Chords");
    expect(html).toContain("(4/11)");
    expect(html).toContain("(+4% ν)");
    // The mechanics ride the tooltip layer alone.
    expect(html).toContain("+1% ν to the rate");
    expect(html).not.toContain("class=\"lead\"");
  });
});
