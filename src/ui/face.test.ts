import { describe, expect, it } from "vitest";
import { CATEGORY_OF, MODULE_TYPES } from "../engine/constants";
import type { ModuleType, Rarity } from "../engine/types";
import { CHARGED_FILL_MIN, CHARGED_FILL_SPAN, HUE_TOKEN_OF, RAIL_CHARGED_FLOOR, RAIL_CHARGED_SPAN, RING_COUNT, moduleFace, readoutFitClass } from "./face";
import { chargeGlow } from "./leads";
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

  it("the open-wire spacer keeps cap and base, opening the window between (#201)", () => {
    const face = moduleFace({ type: "spacer", rarity: "rare", readout: "⌇", note: "G4", openWire: true });
    // The chassis wears the shared window clip; the frame rides the plate.
    expect(face).toContain('clip-path="url(#spacer-window)"');
    expect(face).toContain("spacer-frame");
    // Glyph, readout glyph, level line, rings, and rail all go quiet.
    for (const key of ["signature", "readout", "rings", "rail", "level"]) {
      expect(face).not.toContain(`data-key="${key}"`);
    }
    // The cap carries the name; the base keeps the note.
    expect(face).toContain('data-key="name" y="-40"');
    expect(face).toContain(">G4</text>");
    // The rarity rings go quiet even at rare — the finish reads nowhere.
    expect(face).not.toContain("face-rings");
  });

  it("the expanded face and candidates never wear the window — board faces only", () => {
    const bloom = moduleFace({ type: "spacer", rarity: "common", readout: "⌇", variant: "bloom" });
    expect(bloom).not.toContain("spacer-window");
    expect(bloom).toContain('data-key="signature"');
    const plain = moduleFace({ type: "spacer", rarity: "common", readout: "⌇" });
    expect(plain).not.toContain("spacer-window");
    expect(plain).toContain('data-key="signature"');
  });

  it("the long-readout fit picks the approved compression steps (#201)", () => {
    expect(readoutFitClass("+0.12")).toBe("");
    expect(readoutFitClass("+1,234")).toBe("");
    expect(readoutFitClass("+1,234 ν")).toBe(" face-readout-sm");
    expect(readoutFitClass("+123,456 ν")).toBe(" face-readout-xs");
    expect(readoutFitClass("1,234/5,678")).toBe(" face-readout-xs");
  });
});
