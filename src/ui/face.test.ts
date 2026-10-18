import { describe, expect, it } from "vitest";
import { BALANCE, CATEGORY_OF, MODULE_TYPES } from "../engine/constants";
import { computeRates } from "../engine/economy";
import { fresh, give } from "../engine/fixtures";
import type { ModuleType } from "../engine/types";
import { CHARGED_OUTLINE_MIN, CHARGED_OUTLINE_SPAN, HUE_TOKEN_OF, faceReadoutFor, moduleFace, readoutFitClass, ringCount, spacerClipPath, SPACER_WINDOW_RADIUS, hexPoints } from "./face";
import { chargeGlow } from "./leads";
import { META } from "./meta";
import { moduleIcon } from "./icons";
import { defaultTheme } from "./theme";

describe("module face", () => {
  it("wears the category hue on rail and signature — the spacer wears its own wire hue", () => {
    for (const type of MODULE_TYPES) {
      const face = moduleFace({ type, tier: 0, readout: "+1" });
      const token = `var(--${HUE_TOKEN_OF[type]})`;
      expect(face.split(token).length - 1, type).toBe(2);
    }
    // The hue law holds with no exceptions (ADR-0021): rail hue = category
    // hue for every type, the spacer's silent category included — with the
    // two reserved bindings issue #219 bound: the silent voices wear
    // hue-voice, the conduit hue-conduit.
    const TOKEN_OF_CATEGORY: Record<string, string> = {
      oscillator: "hue-oscillator",
      silentVoice: "hue-voice",
      conduit: "hue-conduit",
      ritual: "hue-ritual",
      spacer: "hue-spacer",
      generator: "hue-generator",
      booster: "hue-booster",
      forge: "hue-forge",
    };
    for (const type of MODULE_TYPES) {
      expect(HUE_TOKEN_OF[type], type).toBe(TOKEN_OF_CATEGORY[CATEGORY_OF[type]]);
    }
    expect(defaultTheme.tokens["hue-spacer"]).toBeDefined();
    expect(defaultTheme.tokens["hue-voice"]).toBeDefined();
    expect(defaultTheme.tokens["hue-conduit"]).toBeDefined();
  });

  it("engraves the merge tier as ring count through the purchased cap — never a hue", () => {
    // The rings read the copy's merge tier (ADR-0058); the plate tint's
    // rarity never touches them.
    const maxTier = BALANCE.mergeCap + BALANCE.mergeCapCosts.length;
    for (let tier = 0; tier <= maxTier; tier++) {
      expect(ringCount(tier)).toBe(tier + 1);
      const face = moduleFace({ type: "additive", tier, readout: "+1" });
      const rings = face.split('<g data-key="rings" class="face-rings">')[1]!.split("</g>")[0]!;
      expect(rings.match(/<polygon/g), String(tier)).toHaveLength(tier + 1);
      // No finish token may color the chassis or its engraving.
      expect(face).not.toContain("finish-");
    }
    // A lenient guard past the authored radii: the top count holds.
    expect(ringCount(9)).toBe(maxTier + 1);
  });

  it("renders the readout-panel anatomy", () => {
    const face = moduleFace({
      type: "forge",
      tier: 2,
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

  it("scales only the charging outline and preserves the category rail", () => {
    const face = (glow: number) => moduleFace({ type: "additive", tier: 0, readout: "+1", hexClass: "charged", chargeGlow: glow });
    const weak = face(chargeGlow(1));
    const strong = face(chargeGlow(4));
    const opacity = (markup: string) => Number(markup.match(/stroke-opacity:([\d.]+)/)![1]);
    expect(opacity(weak)).toBeCloseTo(CHARGED_OUTLINE_MIN + CHARGED_OUTLINE_SPAN * 0.5, 3);
    expect(opacity(strong)).toBeGreaterThan(opacity(weak));
    expect(strong).not.toContain("fill-opacity");
    expect(strong).toContain('stroke="var(--hue-oscillator)"');
    expect(strong.match(/stroke-opacity/g)).toHaveLength(1);
  });

  it("the open-wire spacer keeps cap and base, opening the window between (#201, ring window #219)", () => {
    const face = moduleFace({ type: "spacer", tier: 2, readout: "⌇", note: "G4", openWire: true });
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
    // The tier rings go quiet even at the cap — the finish reads nowhere.
    expect(face).not.toContain("face-rings");
    // The ring window's two halves agree: the clip carries chassis and
    // inner hexagon as two subpaths (the evenodd pair), and the hairline
    // traces the same inner hexagon.
    expect(spacerClipPath()).toContain(" Z M ");
    expect(spacerClipPath().match(/M /g)).toHaveLength(2);
    expect(face).toContain(`points="${hexPoints(SPACER_WINDOW_RADIUS)}"`);
  });

  it("the expanded face and candidates never wear the window — board faces only", () => {
    const bloom = moduleFace({ type: "spacer", tier: 0, readout: "⌇", variant: "bloom" });
    expect(bloom).not.toContain("spacer-window");
    expect(bloom).toContain('data-key="signature"');
    const plain = moduleFace({ type: "spacer", tier: 0, readout: "⌇" });
    expect(plain).not.toContain("spacer-window");
    expect(plain).toContain('data-key="signature"');
  });

  it("the bloom re-proportions with the prototype's opened spacing (#219)", () => {
    // The −7/11 pair overlapped at bloom scale; the prototype validated
    // glyph −12 / readout 16 and that is what ships.
    const bloom = moduleFace({ type: "additive", tier: 0, readout: "+1", variant: "bloom" });
    expect(bloom).toContain('data-key="signature" class="face-signature" transform="translate(0 -12) scale(0.7)"');
    expect(bloom).toContain('data-key="readout" x="0" y="16"');
    const compact = moduleFace({ type: "additive", tier: 0, readout: "+1" });
    expect(compact).toContain('data-key="signature" class="face-signature" transform="translate(0 0) scale(0.8)"');
    expect(compact).toContain('data-key="readout" x="0" y="30"');
  });

  it("wears the final names and the D-set glyph family (#219, roster wave 2)", () => {
    // META carries the final names, and the faceplate is the short
    // uppercased.
    const names: Record<string, [string, string]> = {
      additive: ["Sine", "SINE"],
      blaster: ["Blaster", "BLST"],
      triangle: ["Triangle", "TRI"],
      square: ["Square", "SQR"],
      saw: ["Saw", "SAW"],
      afterglow: ["Afterglow", "GLOW"],
      sideband: ["Sideband", "SIDE"],
      harmonizer: ["Harmonizer", "HARM"],
      echo: ["Echo", "ECHO"],
      bend: ["Bend", "BEND"],
      amplifier: ["Amplifier", "AMP"],
      ritual: ["RITUAL", "RITUAL"],
      focusKeyed: ["Flywheel", "FLYW"],
      noteKeyed: ["Scribe", "SCRB"],
      goalKeyed: ["Milestone", "MILE"],
      pulsewell: ["Pulsewell", "PLSW"],
      infusor: ["Booster", "BOOST"],
      field: ["Field", "FIELD"],
      spotlight: ["Spotlight", "SPOT"],
      chorus: ["Chorus", "CHOR"],
      exciter: ["Exciter", "EXCT"],
      spacer: ["Spacer", "SPACER"],
      forge: ["Forge", "FORGE"],
      mutatorForge: ["Mutator Forge", "MUT. FORGE"],
    };
    for (const type of MODULE_TYPES as ModuleType[]) {
      expect(META[type].name, type).toBe(names[type]![0]);
      expect(moduleFace({ type, tier: 0, readout: "+1" })).toContain(
        `>${META[type].short.toUpperCase()}</text>`,
      );
    }
    // The D-set glyphs: sine, diamond, bolt, chevrons around a dot, the
    // seeded-hexagon Mutator Forge on the bare chassis — plus the roster's
    // own marks.
    expect(moduleIcon("additive")).toBe('<path d="M-12 0C-8-10-4-10 0 0C4 10 8 10 12 0"/>');
    expect(moduleIcon("triangle")).toBe('<path d="M-12 8-4-8 4 8 12-8"/>');
    expect(moduleIcon("square")).toBe('<path d="M-12 8V-8h9v16h9V-8h6"/>');
    expect(moduleIcon("saw")).toBe('<path d="M-12 8-1-8v16L10-8v16"/>');
    expect(moduleIcon("harmonizer")).toBe('<path d="M0-10 8 0 0 10-8 0Z"/>');
    expect(moduleIcon("focusKeyed")).toBe('<path d="M2-13-6 1H0L-2 13 6-1H0Z"/>');
    // The keyed siblings: the bolt with the corner mark each fact wears —
    // the Note's ruled double line, the Goal's completion check (#232).
    expect(moduleIcon("noteKeyed")).toBe('<path d="M2-13-6 1H0L-2 13 6-1H0Z"/><path d="M5-14.5l3.5 3.5M7.5-15.5 11-12"/>');
    expect(moduleIcon("goalKeyed")).toBe('<path d="M2-13-6 1H0L-2 13 6-1H0Z"/><path d="M4.5-11.5 7-9 11.5-14.5"/>');
    // The temporal wave (issue #372): the Afterglow's swelling trace, the
    // Pulsewell's bolt with the burst fan at its corner.
    expect(moduleIcon("afterglow")).toBe('<path d="M-12 0C-10.5-4-7.5-4-6 0C-4.5-8-1.5-8 0 0C1.5 16 4.5 16 6 0C7.5-16 10.5-16 12 0"/>');
    expect(moduleIcon("pulsewell")).toBe('<path d="M2-13-6 1H0L-2 13 6-1H0Z"/><path d="M6-13l2.2-2.2M8.5-9.5l3-.6M9-6.5l2.8 1"/>');
    expect(moduleIcon("infusor")).toBe('<circle r="2.2"/><path d="M-5-7-13 0-5 7M5-7 13 0 5 7"/>');
    // The booster wave (issue #374): the Field's doubled chevrons, the
    // Spotlight's single beam — identity marks over the shared dot.
    expect(moduleIcon("field")).toContain('<circle r="2.2"/>');
    expect(moduleIcon("field")).toContain('M-5-7-13 0-5 7M5-7 13 0 5 7');
    expect(moduleIcon("spotlight")).toContain('<circle r="2.2"/>');
    expect(moduleIcon("spotlight")).toContain('M12.5-9v18');
    // The chord-centered wave (issue #375): the Sideband's flanked trace,
    // the Chorus's voice lines fronting the shared dot.
    expect(moduleIcon("sideband")).toContain('M-14-5.5v11M14-5.5v11');
    expect(moduleIcon("chorus")).toContain('<circle r="2.2"/>');
    expect(moduleIcon("chorus")).toContain('M0-8v16');
    // The charge-response booster (issue #376): the Exciter's inward
    // charge zigzags flanking the shared dot.
    expect(moduleIcon("exciter")).toContain('<circle r="2.2"/>');
    expect(moduleIcon("exciter")).toContain('M-13 5.5-8.5-4.5-4 5.5');
    expect(moduleIcon("mutatorForge")).toContain('<path d="M0-5.5 4.8-2.7V2.7L0 5.5-4.8 2.7V-2.7Z"/><circle r="1.5"/>');
    // The Mutator Forge's chassis drops the lattice — distinct from the
    // Module Forge's.
    expect(moduleIcon("mutatorForge")).not.toContain("v28");
    expect(moduleIcon("forge")).toContain("v28");
    // The roster glyphs: the Echo's doubled waves, the Bend's kink, the
    // Blaster's bolt-cored sine, the Amplifier's through-flow.
    expect(moduleIcon("echo")).toContain("M-6 0C-4-5-2-5 0 0C2 5 4 5 6 0");
    expect(moduleIcon("bend")).toContain("M-12 2C-8-8-5-8-2 0L2 0");
    expect(moduleIcon("blaster")).not.toContain("fill=");
    expect(moduleIcon("blaster")).not.toContain("stroke=\"none\"");
    expect(moduleIcon("amplifier")).toContain("M-9 0h5M4 0h5");
    // RITUAL: the habit-cycle ring around a sustained wave.
    expect(moduleIcon("ritual")).toContain('<circle r="11"/>');
    expect(moduleIcon("ritual")).toContain("M-6.5 0C-4.3-5-2.2-5 0 0C2.2 5 4.3 5 6.5 0");
  });

  it("the long-readout fit picks the approved compression steps (#201)", () => {
    expect(readoutFitClass("+0.12")).toBe("");
    expect(readoutFitClass("+1,234")).toBe("");
    expect(readoutFitClass("+1,234 ν")).toBe(" face-readout-sm");
    expect(readoutFitClass("+123,456 ν")).toBe(" face-readout-xs");
    expect(readoutFitClass("1,234/5,678")).toBe(" face-readout-xs");
  });
});

describe("face readouts", () => {
  it("the Chorus's share names its term — chord response, never amplitude (issue #375)", () => {
    const s = fresh();
    const chorus = give(s, "chorus", null);
    const read = faceReadoutFor(s, chorus, null, computeRates(s, false));
    expect(read.readout).toBe("+50%");
    expect(read.note).toBe("chord response");
  });

  it("the Exciter's share names its term — charge response, never amplitude (issue #376)", () => {
    const s = fresh();
    const exciter = give(s, "exciter", null);
    const read = faceReadoutFor(s, exciter, null, computeRates(s, false));
    expect(read.readout).toBe("+50%");
    expect(read.note).toBe("charge response");
  });
});
