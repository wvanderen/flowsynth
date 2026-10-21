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

// Neutral graphite substrate (ADR-0070). Semantic category/resource hues
// remain independent; the surrounding instrument never supplies a hue.
const substrate = {
  bg: "#111213",
  panel: "#1b1d1f",
  "panel-soft": "#17191b",
  "panel-deep": "#0d0f10",
  "panel-veil": "color-mix(in srgb, var(--panel-soft) 95%, transparent)",
  line: "#34383b",
  "line-soft": "#292d30",
  "line-strong": "#555c61",
  ink: "#e9eae8",
  muted: "#a4aaa9",
  "rarity-common": "#a4aaa9",
  "rarity-uncommon": "#70c58c",
  "rarity-rare": "#7db4ef",
  scrim: "rgba(8, 9, 10, 0.82)",
  shadow: "rgba(0, 0, 0, 0.6)",
} as const;

// The category hue table (ADR-0016, amended by ADR-0021; the reserved hues
// bound by issue #219, wave 1). Hue = category; per-type identity rides the
// glyph and nameplate. The spacer wears a muted wire grey — its own silent
// category. The formerly reserved violet and yellow are the categories that
// arrived with the roster (ADR-0048) — silent voice and charge conduit —
// and RITUAL wears the console's switch vermillion: the one habit-keyed
// board module carries the session color. The oscillator and booster hues
// kept their values through the category rename (issue #219).
const hues = {
  "hue-generator": "#238858",
  "hue-oscillator": "#6360d4",
  "hue-spacer": "#8a93a8",
  "hue-booster": "#1f95b5",
  "hue-forge": "#bc9239",
  "hue-voice": "#9d7bea",
  "hue-conduit": "#d9b84a",
  "hue-ritual": "#cc603d",
} as const;

// Resource registers — the register rule: a resource wears the luminous glow
// register of its producing category's hue (generator ⇄ charge green,
// synthesizer ⇄ nous indigo). Interactive roles pick from the same families.
// Arete is its own register (issue #197): the prestige resource's violet —
// the prototype's — worn by every Arete surface; it produces from no
// category, so it stands beside them rather than under one. The World
// layer's steel (issue #426's design round) is a layer register, not a
// resource: the square-cut plates' stroke and wash, kept cold beside the
// charge green the weapons' figures wear.
const resources = {
  charge: "#9affa8",
  nous: "#cbcaff",
  "forge-glow": "#eecb82",
  arete: "#b994f5",
  world: "#a7b7c4",
  // Scrap (issue #377): the recovered collection value — its own token,
  // wearing the forge register's amber family: the value feeds the Forge's
  // draft products. Reuses the forge-glow figure, free to diverge in a
  // table swap.
  scrap: "#eecb82",
} as const;

const interactive = {
  accent: "#cbcaff",
  "accent-bright": "#e8e6ff",
  "accent-ink": "#141516",
  switch: "#cc603d",
  "switch-dim": "#96562f",
  "switch-ink": "#fff3ec",
  // Issue #347's AA pairing: the deep stop carries the switch's live/held
  // fill (ink ≥ 4.5:1), the bright stop its idle text on the faint wash
  // (≥ 4.5:1). `switch` stays the session color — borders, glow, strips.
  "switch-bright": "#dd6f49",
  "switch-deep": "#a94c2b",
  danger: "#e08a8a",
} as const;

// Rarity = finish: engraved ring count (rendered by the module face) plus a
// subtle plate tint, never glowing, never taking a category hue (ADR-0016).
const finishes = {
  "finish-common": "#b4bdd8",
  "finish-uncommon": "#7fd0a8",
  "finish-rare": "#b39cf2",
} as const;

// Chord annotation hues (§6): one hue per named chord — the seams' identity
// in the prototype's chord-feedback language (#120). Annotation, not
// category: these never ride a module face. The six classes #218 added ride
// the same table (issue #229); unknown names take the Octave fallback in
// chordlayer.ts.
const chords = {
  "chord-octave": "#8f8ce8",
  "chord-fifth": "#3fb5c9",
  "chord-flat-seventh": "#a86ad4",
  "chord-suspended-fourth": "#5aa8d4",
  "chord-minor-triad": "#d4657f",
  "chord-diminished-triad": "#c46a9e",
  "chord-augmented-triad": "#d48a6a",
  "chord-major-triad": "#e09a5a",
  "chord-minor-seventh": "#b06ad0",
  "chord-dominant-seventh": "#d06a9a",
  "chord-major-seventh": "#e8b06a",
} as const;

// The habit palette (issue #312, re-owned by the habit with issue #445):
// the six swatches the habit editor offers, vermillion the default. The
// six keys ride habit state (`HabitColor`) and read these tokens wherever
// the habit — and the goal that inherits its color — renders. The hexes
// are the issue's pin.
const goalPalette = {
  "habit-vermillion": "#cc603d",
  "habit-amber": "#bc9239",
  "habit-green": "#9affa8",
  "habit-cyan": "#1f95b5",
  "habit-indigo": "#6360d4",
  "habit-violet": "#b994f5",
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
  // The Arete register's derivatives (issue #197): the unlock banner's
  // shaded row, the chip's wash, and the sheet's accents all mix from the
  // one token, the way the charge family does. The bright stop keeps the
  // buy buttons' hover inside the register.
  "arete-bright": "color-mix(in srgb, var(--arete) 72%, var(--ink))",
  "arete-faint": "color-mix(in srgb, var(--arete) 13%, var(--panel-soft))",
  "arete-tint": "color-mix(in srgb, var(--arete) 9%, transparent)",
  "arete-line": "color-mix(in srgb, var(--arete) 38%, transparent)",
  // The World register's derivatives (issue #426's design round): the
  // plates' firm stroke wash and their hover tint, mixed from the one token
  // the way the arete family is.
  "world-bright": "color-mix(in srgb, var(--world) 72%, var(--ink))",
  "world-faint": "color-mix(in srgb, var(--world) 13%, var(--panel-soft))",
  "world-tint": "color-mix(in srgb, var(--world) 7%, transparent)",
  "world-line": "color-mix(in srgb, var(--world) 38%, transparent)",
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
  name: "graphite",
  tokens: {
    ...substrate,
    ...hues,
    ...resources,
    ...interactive,
    ...finishes,
    ...chords,
    ...goalPalette,
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
