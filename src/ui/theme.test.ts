import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defaultTheme, themeCss } from "./theme";
import { GOAL_COLORS } from "../engine/goals";

// Vitest stubs CSS imports empty (even via ?raw), so assertions that must
// see real source read it off disk — one canonical load per file.
const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
// Stylesheet comments are stripped first: they carry issue references
// ("#151"), not palette literals. render.ts keeps its comments — its guards
// only read var(--…) tokens, and stripping block comments there could mangle
// string literals.
const stylesheet = readSource("./style.css").replace(/\/\*[\s\S]*?\*\//g, "");
const renderSource = readSource("./render.ts");

const tokens = defaultTheme.tokens;

describe("theme token table", () => {
  it("carries the ADR-0070 neutral graphite substrate", () => {
    expect(tokens.bg).toBe("#111213");
    expect(tokens.panel).toBe("#1b1d1f");
    expect(tokens["panel-soft"]).toBe("#17191b");
    expect(tokens.line).toBe("#34383b");
    expect(tokens.ink).toBe("#e9eae8");
  });

  it("carries the ADR-0016 category hue table", () => {
    expect(tokens["hue-generator"]).toBe("#238858");
    expect(tokens["hue-oscillator"]).toBe("#6360d4");
    expect(tokens["hue-booster"]).toBe("#1f95b5");
    expect(tokens["hue-forge"]).toBe("#bc9239");
    expect(tokens.charge).toBe("#9affa8");
    expect(tokens.nous).toBe("#cbcaff");
    expect(tokens.switch).toBe("#cc603d");
  });

  it("binds the reserved hues to the new categories and wires the spacer's grey (#219)", () => {
    // Silent voice takes the reserved violet, charge conduit the reserved
    // yellow, and RITUAL wears the console's switch vermillion.
    expect(tokens["hue-voice"]).toBe("#9d7bea");
    expect(tokens["hue-conduit"]).toBe("#d9b84a");
    expect(tokens["hue-ritual"]).toBe("#cc603d");
    expect(tokens["hue-spacer"]).toBeDefined();
  });

  it("carries the Arete register: the one token every Arete surface wears (issue #197)", () => {
    expect(tokens.arete).toBe("#b994f5");
    expect(tokens["arete-faint"]).toMatch(/^color-mix\(in srgb, var\(--arete\) 13%/);
    expect(tokens["arete-tint"]).toMatch(/^color-mix\(in srgb, var\(--arete\) 9%/);
    expect(tokens["arete-line"]).toMatch(/^color-mix\(in srgb, var\(--arete\) 38%/);
  });

  describe("the main switch's AA pairing (issue #347)", () => {
    // WCAG relative luminance and contrast over sRGB hex.
    const channel = (c: number) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
    };
    const contrast = (fg: string, bg: string) => {
      const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
      return (a + 0.05) / (b + 0.05);
    };
    // What color-mix(in srgb, fg P%, transparent) composites to over bg —
    // the switch's faint wash over the console rail's panel-soft.
    const over = (fg: string, bg: string, percent: number) => {
      const f = parseInt(fg.slice(1), 16);
      const b = parseInt(bg.slice(1), 16);
      const channelAt = (shift: number) =>
        Math.round((percent / 100) * ((f >> shift) & 255) + (1 - percent / 100) * ((b >> shift) & 255));
      return `#${[16, 8, 0].map(channelAt).map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    };

    const idleBackdrop = over(tokens.switch, tokens["panel-soft"], 7);
    const hoverBackdrop = over(tokens.switch, tokens["panel-soft"], 14);

    it("carries the deep and bright stops beside the untouched session vermillion", () => {
      expect(tokens.switch).toBe("#cc603d");
      expect(tokens["switch-bright"]).toBe("#dd6f49");
      expect(tokens["switch-deep"]).toBe("#a94c2b");
    });

    it("reads AA in every state: switch text ≥ 4.5:1 (idle, hover, live, held)", () => {
      expect(contrast(tokens["switch-bright"], idleBackdrop)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens["switch-bright"], hoverBackdrop)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens["switch-ink"], tokens["switch-deep"])).toBeGreaterThanOrEqual(4.5);
    });

    it("keeps the unchanged grammar above the non-text floor: border and state dot ≥ 3:1", () => {
      expect(contrast(tokens.switch, tokens["panel-soft"])).toBeGreaterThanOrEqual(3);
      expect(contrast(tokens["switch-dim"], tokens["panel-soft"])).toBeGreaterThanOrEqual(3);
      expect(contrast(tokens["switch-ink"], tokens["switch-deep"])).toBeGreaterThanOrEqual(3);
    });

    it("wires the stops to the switch's states in the stylesheet", () => {
      expect(stylesheet).toMatch(/\.main-switch\.idle \{[^}]*color:\s*var\(--switch-bright\)/);
      expect(stylesheet).toMatch(/\.main-switch\.live,[\s\S]*?\.main-switch\.held \{[^}]*background:\s*var\(--switch-deep\)/);
    });
  });

  it("carries the goal palette: the six swatches vermillion-first (issue #312)", () => {
    expect(tokens["goal-vermillion"]).toBe("#cc603d");
    expect(tokens["goal-amber"]).toBe("#bc9239");
    expect(tokens["goal-green"]).toBe("#9affa8");
    expect(tokens["goal-cyan"]).toBe("#1f95b5");
    expect(tokens["goal-indigo"]).toBe("#6360d4");
    expect(tokens["goal-violet"]).toBe("#b994f5");
    // The stylesheet paints goals only through these tokens — never a
    // literal, never a foreign register.
    expect(stylesheet.match(/var\(--goal-(?!vermillion|amber|green|cyan|indigo|violet)[a-z0-9-]+\)/g)).toBeNull();
    // Every color key the engine puts on goal state resolves to its token —
    // the palette's one seam between state and theme.
    for (const color of GOAL_COLORS) {
      expect(tokens[`goal-${color}`], color).toBeDefined();
    }
  });

  it("derives the rarity plate tints from the finish tokens", () => {
    for (const rarity of ["common", "uncommon", "rare"]) {
      expect(tokens[`plate-${rarity}`], rarity).toMatch(/^color-mix\(in srgb, var\(--finish-/);
    }
  });

  it("retires rarity-as-hue: finish tokens never color a stroke", () => {
    // Rarity is engraved rings + plate tint (ADR-0016) — the stylesheet must
    // not paint chassis outlines, icons, or labels in finish hues.
    expect(stylesheet.match(/stroke:\s*var\(--finish-/g)).toBeNull();
    expect(stylesheet.match(/\.hex-icon/g)).toBeNull();
  });

  it("keeps board and tray gestures from selecting text (#151)", () => {
    // Dragging a module or the board is a gesture, not a text edit: every
    // drag surface (grid, Hex detail, tray) must be a selector of some rule
    // whose body denies selection, so Chrome never highlights page text.
    for (const surface of ["#grid", ".hex-detail", ".tray-column", ".inventory-tray"]) {
      const denied = [...stylesheet.matchAll(/([^{}]+)\{([^}]*)\}/g)].some(
        ([, selectors, body]) =>
          selectors!.split(",").map((s) => s.trim()).includes(surface) &&
          body!.includes("user-select: none"),
      );
      expect(denied, `${surface} denies text selection`).toBe(true);
    }
  });

  it("only produces valid color values", () => {
    const primitive = /^(#[0-9a-fA-F]{3,8}|rgba\(.+\))$/;
    const derived = /^color-mix\(in srgb, var\(--[a-z0-9-]+\) \d+%, (var\(--[a-z0-9-]+\)|transparent)\)$/;
    for (const [key, value] of Object.entries(tokens)) {
      expect(value, key).toMatch(new RegExp(`${primitive.source}|${derived.source}`));
    }
  });

  it("derives colors only from tokens that exist", () => {
    for (const [key, value] of Object.entries(tokens)) {
      for (const ref of value.matchAll(/var\(--([a-z0-9-]+)\)/g)) {
        expect(tokens, `${key} references --${ref[1]}`).toHaveProperty(ref[1]);
      }
    }
  });

  it("renders every token into the :root custom-property block", () => {
    const css = themeCss(defaultTheme);
    expect(css).toMatch(/^:root \{/);
    for (const [key, value] of Object.entries(tokens)) {
      expect(css).toContain(`--${key}: ${value};`);
    }
  });

  it("is the single source the stylesheet colors through", () => {
    // No palette literals may live in the stylesheet, and the color math it
    // runs must combine token custom properties — the same derived grammar
    // the token table itself uses. (Literal hues live only in theme.ts.)
    expect(stylesheet).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(stylesheet).not.toMatch(/\b(?:rgba?|hsla?)\(/);
    const derived = /^(?:in srgb,\s*)?var\(--[a-z0-9-]+\)\s+\d+%,\s*(?:var\(--[a-z0-9-]+\)|transparent)$/;
    for (const [, args] of stylesheet.matchAll(/color-mix\(((?:[^()]|\([^()]*\))*)\)/g)) {
      expect(args!.replace(/\s+/g, " ").trim(), `color-mix(${args})`).toMatch(derived);
    }
    // --mono is the one non-color token the stylesheet owns. --cc,
    // --seam-dur, --pip, and --category-hue are runtime properties —
    // the markup injects them (render.ts, library.ts), each resolving
    // through a token key itself (--category-hue is the Jacquard picks'
    // per-category frame hue, inline from HUE_TOKEN_OF). Anything the
    // stylesheet defines itself (e.g. the --modal-pad spacing var)
    // resolves by definition.
    const defined = new Set([...stylesheet.matchAll(/(^|[\s;{])--([a-z0-9-]+)\s*:/g)].map((m) => m[2]!));
    const referenced = new Set([...stylesheet.matchAll(/var\(--([a-z0-9-]+)[),]/g)].map((m) => m[1]!));
    for (const name of referenced) {
      expect(name === "mono" || name === "cc" || name === "seam-dur" || name === "pip" || name === "category-hue" || name in tokens || defined.has(name), `--${name} resolves`).toBe(true);
    }
  });

  it("is the single source the rendered markup colors through", () => {
    for (const match of renderSource.matchAll(/var\(--([a-z0-9-]+)/g)) {
      const name = match[1];
      // Dynamic refs are built by prefix, e.g. var(--finish-${rarity}).
      const resolves = name.endsWith("-")
        ? Object.keys(tokens).some((key) => key.startsWith(name))
        : name in tokens;
      expect(resolves, `--${name} resolves`).toBe(true);
    }
  });
});
