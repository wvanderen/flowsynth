import { describe, expect, it } from "vitest";
import { CATEGORY_OF, MODULE_TYPES } from "../engine/constants";
import type { ModuleType, Rarity } from "../engine/types";
import { CHARGED_FILL_MIN, CHARGED_FILL_SPAN, HUE_TOKEN_OF, RAIL_CHARGED_FLOOR, RAIL_CHARGED_SPAN, RING_COUNT, moduleFace } from "./face";
import { chargeGlow } from "./leads";
import { defaultTheme } from "./theme";

const RARITIES: Rarity[] = ["common", "uncommon", "rare"];

describe("module face", () => {
  it("wears the category hue on rail and signature — the Carrier wears white", () => {
    for (const type of MODULE_TYPES) {
      const face = moduleFace({ type, rarity: "common", readout: "+1" });
      const token = `var(--${HUE_TOKEN_OF[type]})`;
      expect(face.split(token).length - 1, type).toBe(2);
    }
    // The hue law: rail hue = category hue, except the Carrier's white.
    for (const type of MODULE_TYPES) {
      if (type !== "carrier") expect(HUE_TOKEN_OF[type], type).toBe(`hue-${CATEGORY_OF[type]}`);
    }
    expect(HUE_TOKEN_OF.carrier).toBe("hue-carrier");
    expect(defaultTheme.tokens["hue-carrier"]).toBeDefined();
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
      note: "P2",
      level: 3,
      hexClass: "selected",
      pinned: true,
    });
    for (const key of ["hex", "rings", "rail", "level", "name", "readout", "note", "signature", "pin"]) {
      expect(face).toContain(`data-key="${key}"`);
    }
    expect(face).toContain('class="hex selected"');
    expect(face).toContain("face-readout charge");
    expect(face).toContain(">FORGE</text>");
    // The nameplate names the type; no duplicate category label.
    expect(face).not.toContain('data-key="category"');
  });

  it("seats the bare lock top-center above the level, with three mounting bolts", () => {
    const face = moduleFace({ type: "carrier", rarity: "common", readout: "+1", level: 2, pinned: true });
    // The badge paints after the chassis polygon — a marking under the plate
    // would never read.
    const hex = face.indexOf('data-key="hex"');
    const pin = face.indexOf('data-key="pin"');
    expect(pin).toBeGreaterThan(hex);
    // Top center, right above the engraved level.
    expect(face).toContain('data-key="pin" class="module-pin" transform="translate(0,-48)"');
    // The marking is a bare padlock — shackle arc over a rounded body, no housing.
    expect(face).toContain('d="M-2.7-.5v-2.4a2.7 2.7 0 0 1 5.4 0v2.4"');
    expect(face).toContain('<rect x="-4.4" y="-0.5" width="8.8" height="6.8" rx="1.5"/>');
    expect(face).not.toContain("pin-plate");
    // Panel-mount hardware: three bolt circles at alternating corners, the
    // lock's (top) corner skipped — upper-right, bottom, upper-left.
    const bolts = face.split('<g data-key="bolts" class="module-bolts">')[1]!.split("</g>")[0]!;
    expect(bolts.match(/<circle/g)).toHaveLength(3);
    expect(bolts).toContain('cx="49.80" cy="-28.75"');
    expect(bolts).toContain('cx="0.00" cy="57.50"');
    expect(bolts).toContain('cx="-49.80" cy="-28.75"');
    expect(bolts).not.toContain('cy="-57.50"');
  });

  it("carries no pin hardware without pinned — the treatment is carrier-only", () => {
    const face = moduleFace({ type: "additive", rarity: "common", readout: "+1" });
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
});
