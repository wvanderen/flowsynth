import { describe, expect, it } from "vitest";
import { CATEGORY_OF, MODULE_TYPES } from "../engine/constants";
import type { ModuleType, Rarity } from "../engine/types";
import { HUE_TOKEN_OF, RING_COUNT, moduleFace } from "./face";
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
    for (const key of ["hex", "rings", "rail", "level", "name", "readout", "note", "category", "signature", "pin"]) {
      expect(face).toContain(`data-key="${key}"`);
    }
    expect(face).toContain('class="hex selected"');
    expect(face).toContain("face-readout charge");
    expect(face).toContain(">FORGE</text>");
  });

  it("keeps every hue var resolvable in the theme token table", () => {
    for (const type of MODULE_TYPES as ModuleType[]) {
      expect(defaultTheme.tokens, type).toHaveProperty(HUE_TOKEN_OF[type]);
    }
  });
});
