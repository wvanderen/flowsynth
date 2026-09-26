import type { FocusApp } from "../engine/apps";
import type { ModuleType } from "../engine/types";

const PATHS: Record<ModuleType, string> = {
  additive: '<path d="M-12 0H12M0-12V12"/>',
  conditional: '<path d="m-9-9 18 18m0-18-18 18"/>',
  // The spacer's wire glyph (ADR-0021): a silent conductor stepping through
  // one cell — a running wire with solder points, never a voice.
  spacer: '<path d="M-13 0h7l4-6 5 12 5-12 4 6h4"/><circle r="1.6" cx="-13" cy="0"/><circle r="1.6" cx="12" cy="0"/>',
  focusKeyed: '<path d="M-6-12h12l4 8-10 8-10-8Z"/><path d="M-4-4l3 3 6-6"/>',
  infusor: '<circle r="4"/><path d="M0-15v6M0 9v6M-15 0h6M9 0h6m-20-11 5 5m12 12 5 5m0-22-5 5M-6 6l-5 5"/>',
  forge: '<path d="m0-14 12 7v14L0 14-12 7V-7Zm0 0v28m-12-21 24 14m0-14L-12 7"/>',
};

// Focus-app glyphs (ADR-0016: geometric synthesis glyphs, every hue paired
// with a glyph — the console stays monochrome, so these ride ink/muted).
const APP_PATHS: Record<FocusApp, string> = {
  // Habit: a cycle that carries a mark — a ~300° ring (from twelve, clockwise
  // to ten o'clock) closing into a connected chevron arrowhead that points
  // along the travel, plus a stroked center dot for the practice inside the
  // cycle. The old open arc's hairline nubs read as a spinner at tile size.
  habit: '<path d="M0-8A8 8 0 1 1-6.9-4"/><path d="M-11.1-2.5-6.9-4-6.1 .4"/><circle r="1.8"/>',
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
