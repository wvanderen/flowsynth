import type { FocusApp } from "../engine/apps";
import type { ModuleType } from "../engine/types";

// The D-set glyph language (issue #219, wave 1): one wave family — the
// Oscillator's bare sine, the Harmonizer's muted tonehead diamond, the
// generators' bolt, the Booster's outward chevrons around a center dot.
const PATHS: Record<ModuleType, string> = {
  // The Oscillator: a bare sine — the scope trace, one full period.
  additive: '<path d="M-12 0C-8-10-4-10 0 0C4 10 8 10 12 0"/>',
  // The Harmonizer: the diamond — a muted tonehead (it sweetens, never
  // multiplies its own production).
  conditional: '<path d="M0-10 8 0 0 10-8 0Z"/>',
  // The spacer's wire glyph (ADR-0021): a silent conductor stepping through
  // one cell — a running wire with solder points, never a voice. The board
  // face and tray tile render the ring window instead (issue #219); the
  // glyph remains for the expanded face and candidate tiles.
  spacer: '<path d="M-13 0h7l4-6 5 12 5-12 4 6h4"/><circle r="1.6" cx="-13" cy="0"/><circle r="1.6" cx="12" cy="0"/>',
  // The Focus Generator: the bolt, bare — the corner marks belong to the
  // Note and Goal generators (issue #232).
  focusKeyed: '<path d="M2-13-6 1H0L-2 13 6-1H0Z"/>',
  // The Booster: outward chevrons around a center dot — it affects its
  // neighbors (replaces the rayed sun).
  infusor: '<circle r="2.2"/><path d="M-5-7-13 0-5 7M5-7 13 0 5 7"/>',
  forge: '<path d="m0-14 12 7v14L0 14-12 7V-7Zm0 0v28m-12-21 24 14m0-14L-12 7"/>',
  // The Mutator Forge wears the Forge chassis with a seeded hexagon at its
  // core replacing the lattice (issue #219) — the second branch, minting
  // into the Mutator tray, distinct from the Module Forge.
  mutatorForge:
    '<path d="m0-14 12 7v14L0 14-12 7V-7Z"/><path d="M0-5.5 4.8-2.7V2.7L0 5.5-4.8 2.7V-2.7Z"/><circle r="1.5"/>',
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
