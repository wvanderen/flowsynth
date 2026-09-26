import { describe, expect, it } from "vitest";
import renderSource from "./render.ts?raw";
import stylesheet from "./style.css?raw";
import { defaultTheme, themeCss } from "./theme";

const tokens = defaultTheme.tokens;

describe("theme token table", () => {
  it("carries the ADR-0016 dark indigo-blue substrate", () => {
    expect(tokens.bg).toBe("#0d1122");
    expect(tokens.panel).toBe("#141a30");
    expect(tokens["panel-soft"]).toBe("#111627");
    expect(tokens.line).toBe("#2a3150");
    expect(tokens.ink).toBe("#e5e9f5");
  });

  it("carries the ADR-0016 category hue table", () => {
    expect(tokens["hue-generator"]).toBe("#238858");
    expect(tokens["hue-synthesizer"]).toBe("#6360d4");
    expect(tokens["hue-infusor"]).toBe("#1f95b5");
    expect(tokens["hue-forge"]).toBe("#bc9239");
    expect(tokens.charge).toBe("#9affa8");
    expect(tokens.nous).toBe("#cbcaff");
    expect(tokens.switch).toBe("#cc603d");
  });

  it("reserves the unbound hues and wires the spacer's grey", () => {
    expect(tokens["reserved-yellow"]).toBeDefined();
    expect(tokens["reserved-violet"]).toBeDefined();
    expect(tokens["hue-spacer"]).toBeDefined();
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
    // No palette literals and no color math may live in the stylesheet —
    // every color resolves through a token custom property.
    expect(stylesheet).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(stylesheet).not.toMatch(/\b(?:rgba?|hsla?|color-mix)\(/);
    // --mono is the one non-color token the stylesheet owns.
    const referenced = new Set([...stylesheet.matchAll(/var\(--([a-z0-9-]+)[),]/g)].map((m) => m[1]));
    for (const name of referenced) {
      expect(name === "mono" || name in tokens, `--${name} resolves`).toBe(true);
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
