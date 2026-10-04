import { describe, expect, it } from "vitest";
import { CATEGORY_OF, MODULE_TYPES } from "../engine/constants";
import type { ModuleType, Rarity } from "../engine/types";
import { CHARGED_FILL_MIN, CHARGED_FILL_SPAN, HUE_TOKEN_OF, RAIL_CHARGED_FLOOR, RAIL_CHARGED_SPAN, RING_COUNT, moduleFace, readoutFitClass, spacerClipPath, SPACER_WINDOW_RADIUS, hexPoints } from "./face";
import { chargeGlow } from "./leads";
import { META } from "./meta";
import { moduleIcon } from "./icons";
import { defaultTheme } from "./theme";

const RARITIES: Rarity[] = ["common", "uncommon", "rare"];

describe("module face", () => {
  it("wears the category hue on rail and signature — the spacer wears its own wire hue", () => {
    for (const type of MODULE_TYPES) {
      const face = moduleFace({ type, rarity: "common", readout: "+1" });
      const token = `var(--${HUE_TOKEN_OF[type]})`;
      expect(face.split(token).length - 1, type).toBe(2);
    }
    // The hue law holds with no exceptions (ADR-0021): rail hue = category
    // hue for every type, the spacer's silent category included.
    for (const type of MODULE_TYPES) {
      expect(HUE_TOKEN_OF[type], type).toBe(`hue-${CATEGORY_OF[type]}`);
    }
    expect(defaultTheme.tokens["hue-spacer"]).toBeDefined();
  });

  it("engraves rarity as ring count — 1, 2, 3 — never a hue", () => {
    expect(RING_COUNT).toEqual({ common: 1, uncommon: 2, rare: 3 });
    for (const rarity of RARITIES) {
      const face = moduleFace({ type: "additive", rarity, readout: "+1" });
      const rings = face.split('<g data-key="rings" class="face-rings">')[1]!.split("</g>")[0]!;
      expect(rings.match(/<polygon/g), rarity).toHaveLength(RING_COUNT[rarity]);
      // No finish token may color the chassis or its engraving.
      expect(face).not.toContain("finish-");
    }
  });

  it("renders the readout-panel anatomy", () => {
    const face = moduleFace({
      type: "forge",
      rarity: "rare",
      readout: "42/60",
      readoutClass: "charge",
      note: "C4",
      level: 3,
      hexClass: "selected",
    });
    for (const key of ["hex", "rings", "rail", "level", "name", "readout", "note", "signature"]) {
      expect(face).toContain(`data-key="${key}"`);
    }
    expect(face).toContain('class="hex selected"');
    expect(face).toContain("face-readout charge");
    expect(face).toContain(">FORGE</text>");
    // The nameplate names the type; no duplicate category label. No pin
    // hardware exists anymore — nothing is pinned (ADR-0021).
    expect(face).not.toContain('data-key="category"');
    expect(face).not.toContain('data-key="pin"');
    expect(face).not.toContain('data-key="bolts"');
  });

  it("keeps every hue var resolvable in the theme token table", () => {
    for (const type of MODULE_TYPES as ModuleType[]) {
      expect(defaultTheme.tokens, type).toHaveProperty(HUE_TOKEN_OF[type]);
    }
  });

  it("scales the charged chassis fill and rail with the received-charge glow", () => {
    const face = (chargeGlow?: number) =>
      moduleFace({ type: "additive", rarity: "common", readout: "+1", ...(chargeGlow ? { hexClass: "charged", chargeGlow } : {}) });
    // The glow rides the chassis fill-opacity and the rail stroke-opacity;
    // the colors themselves never leave the stylesheet/token table.
    const inline = (markup: string, prop: string) => Number(markup.match(new RegExp(`${prop}:([\\d.]+)`))![1]);
    const weak = face(chargeGlow(1));
    const strong = face(chargeGlow(4));
    expect(inline(weak, "fill-opacity")).toBeCloseTo(CHARGED_FILL_MIN + CHARGED_FILL_SPAN * 0.5, 3);
    expect(inline(weak, "stroke-opacity")).toBeCloseTo(RAIL_CHARGED_FLOOR + RAIL_CHARGED_SPAN * 0.5, 3);
    expect(inline(strong, "fill-opacity")).toBeGreaterThan(inline(weak, "fill-opacity"));
    expect(inline(strong, "stroke-opacity")).toBeGreaterThan(inline(weak, "stroke-opacity"));
    expect(inline(strong, "fill-opacity")).toBeLessThan(CHARGED_FILL_MIN + CHARGED_FILL_SPAN + 0.001);
    // Uncharged faces carry no inline overrides.
    expect(face()).not.toContain("fill-opacity");
    expect(face()).not.toContain("stroke-opacity");
  });

  it("the open-wire spacer keeps cap and base, opening the window between (#201, ring window #219)", () => {
    const face = moduleFace({ type: "spacer", rarity: "rare", readout: "⌇", note: "G4", openWire: true });
    // The chassis wears the shared window clip; the hairline rides the
    // plate. Both are polygons now: the clip is the evenodd ring (chassis
    // minus inner hexagon), the hairline traces the inner hexagon.
    expect(face).toContain('clip-path="url(#spacer-window)"');
    expect(face).toContain('data-key="spacer-frame"');
    expect(face).not.toContain("<rect");
    // Glyph, readout glyph, level line, rings, and rail all go quiet.
    for (const key of ["signature", "readout", "rings", "rail", "level"]) {
      expect(face).not.toContain(`data-key="${key}"`);
    }
    // The cap carries the name; the base keeps the note.
    expect(face).toContain('data-key="name" y="-40"');
    expect(face).toContain(">G4</text>");
    // The rarity rings go quiet even at rare — the finish reads nowhere.
    expect(face).not.toContain("face-rings");
    // The ring window's two halves agree: the clip carries chassis and
    // inner hexagon as two subpaths (the evenodd pair), and the hairline
    // traces the same inner hexagon.
    expect(spacerClipPath()).toContain(" Z M ");
    expect(spacerClipPath().match(/M /g)).toHaveLength(2);
    expect(face).toContain(`points="${hexPoints(SPACER_WINDOW_RADIUS)}"`);
  });

  it("the expanded face and candidates never wear the window — board faces only", () => {
    const bloom = moduleFace({ type: "spacer", rarity: "common", readout: "⌇", variant: "bloom" });
    expect(bloom).not.toContain("spacer-window");
    expect(bloom).toContain('data-key="signature"');
    const plain = moduleFace({ type: "spacer", rarity: "common", readout: "⌇" });
    expect(plain).not.toContain("spacer-window");
    expect(plain).toContain('data-key="signature"');
  });

  it("the bloom re-proportions with the prototype's opened spacing (#219)", () => {
    // The −7/11 pair overlapped at bloom scale; the prototype validated
    // glyph −12 / readout 16 and that is what ships.
    const bloom = moduleFace({ type: "additive", rarity: "common", readout: "+1", variant: "bloom" });
    expect(bloom).toContain('data-key="signature" class="face-signature" transform="translate(0 -12) scale(0.7)"');
    expect(bloom).toContain('data-key="readout" x="0" y="16"');
    const compact = moduleFace({ type: "additive", rarity: "common", readout: "+1" });
    expect(compact).toContain('data-key="signature" class="face-signature" transform="translate(0 0) scale(0.8)"');
    expect(compact).toContain('data-key="readout" x="0" y="30"');
  });

  it("wears the wave-1 names and the D-set glyph family (#219)", () => {
    // Renames are display-layer: the type keys stay, META carries the
    // final names, and the faceplate is the short uppercased.
    const names: Record<string, [string, string]> = {
      additive: ["Oscillator", "OSC"],
      conditional: ["Harmonizer", "HARM"],
      focusKeyed: ["Focus Generator", "FOCUS"],
      infusor: ["Booster", "BOOST"],
      spacer: ["Spacer", "SPACER"],
      forge: ["Forge", "FORGE"],
      mutatorForge: ["Mutator Forge", "MUT. FORGE"],
    };
    for (const type of MODULE_TYPES as ModuleType[]) {
      expect(META[type].name, type).toBe(names[type]![0]);
      expect(moduleFace({ type, rarity: "common", readout: "+1" })).toContain(
        `>${META[type].short.toUpperCase()}</text>`,
      );
    }
    // The D-set glyphs: sine, diamond, bolt, chevrons around a dot, the
    // seeded-hexagon Mutator Forge on the bare chassis.
    expect(moduleIcon("additive")).toBe('<path d="M-12 0C-8-10-4-10 0 0C4 10 8 10 12 0"/>');
    expect(moduleIcon("conditional")).toBe('<path d="M0-10 8 0 0 10-8 0Z"/>');
    expect(moduleIcon("focusKeyed")).toBe('<path d="M2-13-6 1H0L-2 13 6-1H0Z"/>');
    expect(moduleIcon("infusor")).toBe('<circle r="2.2"/><path d="M-5-7-13 0-5 7M5-7 13 0 5 7"/>');
    expect(moduleIcon("mutatorForge")).toContain('<path d="M0-5.5 4.8-2.7V2.7L0 5.5-4.8 2.7V-2.7Z"/><circle r="1.5"/>');
    // The Mutator Forge's chassis drops the lattice — distinct from the
    // Module Forge's.
    expect(moduleIcon("mutatorForge")).not.toContain("v28");
    expect(moduleIcon("forge")).toContain("v28");
  });

  it("the long-readout fit picks the approved compression steps (#201)", () => {
    expect(readoutFitClass("+0.12")).toBe("");
    expect(readoutFitClass("+1,234")).toBe("");
    expect(readoutFitClass("+1,234 ν")).toBe(" face-readout-sm");
    expect(readoutFitClass("+123,456 ν")).toBe(" face-readout-xs");
    expect(readoutFitClass("1,234/5,678")).toBe(" face-readout-xs");
  });
});
