// The theme token table (ADR-0016): the single source of every color the UI
// uses. Themes are table swaps; no theme variants ship — the table just makes
// them cheap. Hexes are provisional tuning unless the ADR pins them.
//
// Keys become CSS custom properties verbatim (`--key`), applied before first
// paint by the vite config's transformIndexHtml. The stylesheet must
// reference tokens, never literals.

export interface Theme {
  readonly name: string;
  readonly tokens: Readonly<Record<string, string>>;
}

// Substrate — the dark indigo-blue default. The five ADR-0016 hexes are the
// record; the rest of the group extends them for surfaces the UI needs.
const substrate = {
  bg: "#0d1122",
  panel: "#141a30",
  "panel-soft": "#111627",
  "panel-deep": "#0a0e1b",
  "panel-veil": "color-mix(in srgb, var(--panel-soft) 95%, transparent)",
  line: "#2a3150",
  "line-soft": "#222841",
  "line-strong": "#414a75",
  ink: "#e5e9f5",
  muted: "#99a1c2",
  scrim: "rgba(5, 8, 19, 0.82)",
  shadow: "rgba(2, 4, 12, 0.6)",
  // The board's ambient breath: the synthesizer hue in its glow register.
  "board-glow": "rgba(99, 96, 212, 0.14)",
} as const;

// The category hue table (ADR-0016, amended by ADR-0021). Hue = category;
// per-type identity rides the glyph and nameplate. The spacer wears a muted
// wire grey — its own silent category. Yellow and violet stay unbound for
// future categories.
const hues = {
  "hue-generator": "#238858",
  "hue-synthesizer": "#6360d4",
  "hue-spacer": "#8a93a8",
  "hue-infusor": "#1f95b5",
  "hue-forge": "#bc9239",
  "reserved-yellow": "#d9b84a",
  "reserved-violet": "#9d7bea",
} as const;

// Resource registers — the register rule: a resource wears the luminous glow
// register of its producing category's hue (generator ⇄ charge green,
// synthesizer ⇄ nous indigo). Interactive roles pick from the same families.
const resources = {
  charge: "#9affa8",
  nous: "#cbcaff",
  "forge-glow": "#eecb82",
} as const;

const interactive = {
  accent: "#cbcaff",
  "accent-bright": "#e8e6ff",
  "accent-ink": "#10142b",
  switch: "#cc603d",
  "switch-dim": "#96562f",
  "switch-ink": "#fff3ec",
  danger: "#e08a8a",
} as const;

// Rarity = finish: engraved ring count (rendered by the module face) plus a
// subtle plate tint, never glowing, never taking a category hue (ADR-0016).
const finishes = {
  "finish-common": "#b4bdd8",
  "finish-uncommon": "#7fd0a8",
  "finish-rare": "#b39cf2",
} as const;

// Semantic surfaces and states, derived from the primitives above so a theme
// swap carries its whole interaction language.
const semantics = {
  "hover-bg": "color-mix(in srgb, var(--ink) 6%, var(--panel))",
  "accent-faint": "color-mix(in srgb, var(--accent) 9%, var(--panel-soft))",
  "accent-soft": "color-mix(in srgb, var(--accent) 16%, var(--panel-soft))",
  "charge-faint": "color-mix(in srgb, var(--charge) 13%, var(--panel-soft))",
  "charge-tint": "color-mix(in srgb, var(--charge) 7%, transparent)",
  "charge-line": "color-mix(in srgb, var(--charge) 38%, transparent)",
  "forge-faint": "color-mix(in srgb, var(--forge-glow) 15%, var(--panel-soft))",
  "danger-faint": "color-mix(in srgb, var(--danger) 13%, var(--panel-soft))",
  "meter-fill": "color-mix(in srgb, var(--accent) 40%, var(--line))",
  "hex-face": "color-mix(in srgb, var(--panel) 58%, var(--bg))",
  "switch-faint": "color-mix(in srgb, var(--switch) 7%, transparent)",
  "switch-faint-strong": "color-mix(in srgb, var(--switch) 14%, transparent)",
  "switch-glow": "color-mix(in srgb, var(--switch) 48%, transparent)",
  // Rarity plate tints (ADR-0016): the chassis carries its rarity as a faint
  // wash of its finish over the panel face — never a hue, never a glow.
  "plate-common": "color-mix(in srgb, var(--finish-common) 4%, var(--hex-face))",
  "plate-uncommon": "color-mix(in srgb, var(--finish-uncommon) 9%, var(--hex-face))",
  "plate-rare": "color-mix(in srgb, var(--finish-rare) 14%, var(--hex-face))",
} as const;

export const defaultTheme: Theme = {
  name: "indigo",
  tokens: {
    ...substrate,
    ...hues,
    ...resources,
    ...interactive,
    ...finishes,
    ...semantics,
  },
};

// Render the table as the `:root` custom-property block the page loads before
// first paint.
export function themeCss(theme: Theme): string {
  const body = Object.entries(theme.tokens)
    .map(([key, value]) => `  --${key}: ${value};`)
    .join("\n");
  return `:root {\n${body}\n}\n`;
}
