import type { FocusApp } from "../engine/apps";
import type { ModuleType } from "../engine/types";

const PATHS: Record<ModuleType, string> = {
  carrier: '<circle r="4.5"/><path d="M0-15v5M0 10v5M-15 0h5M10 0h5m-21.5-10.5 3.8 3.8m13.4 13.4 3.8 3.8m0-21-3.8 3.8M-10.2 10.2l3.8-3.8"/>',
  additive: '<path d="M-12 0H12M0-12V12"/>',
  conditional: '<path d="m-9-9 18 18m0-18-18 18"/>',
  generator: '<path d="M-6-12h12l4 8-10 8-10-8Z"/><path d="M-4-4l3 3 6-6"/>',
  focusKeyed: '<circle cx="0" cy="-4" r="7"/><path d="M0-14v-2M-2 3h4M-7 9h14"/>',
  infusor: '<circle r="4"/><path d="M0-15v6M0 9v6M-15 0h6M9 0h6m-20-11 5 5m12 12 5 5m0-22-5 5M-6 6l-5 5"/>',
  forge: '<path d="m0-14 12 7v14L0 14-12 7V-7Zm0 0v28m-12-21 24 14m0-14L-12 7"/>',
};

// Focus-app glyphs (ADR-0016: geometric synthesis glyphs, every hue paired
// with a glyph — the console stays monochrome, so these ride ink/muted).
const APP_PATHS: Record<FocusApp, string> = {
  habit: '<path d="M0-8A8 8 0 1 1-6.9 3.9M-6.9 3.9l-3.2-.8M-6.9 3.9l.9 3.2"/>',
  time: '<circle r="8"/><path d="M0-4.5V0l3.4 2.2"/>',
  goals: '<path d="M-6-8V8M-6-7H6L3-3l3 4H-6"/>',
  notes: '<path d="M-7-8H7M-7-2H7M-7 4h3M6.5 3.5 8 5l-4 4-2 .5.5-2Z"/>',
};

export function moduleIcon(type: ModuleType): string {
  return PATHS[type];
}

export function appIcon(app: FocusApp): string {
  return APP_PATHS[app];
}

export function moduleSymbol(type: ModuleType): string {
  const symbols: Record<ModuleType, string> = {
    carrier: "◉",
    additive: "+",
    conditional: "×",
    generator: "⌁",
    focusKeyed: "⚡",
    infusor: "✳",
    forge: "⬡",
  };
  return symbols[type];
}
