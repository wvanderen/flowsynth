import type { FocusApp } from "../engine/apps";
import type { ModuleType } from "../engine/types";

// The D-set glyph language (issue #219, wave 1; roster glyphs wave 2): one
// wave family — the Oscillator's bare sine, the Harmonizer's muted tonehead
// diamond, the generators' bolt, the Booster's outward chevrons around a
// center dot — extended by the roster's own marks: the Blaster's charged
// sine, the Echo's doubled waves, the Bend's bent line, the Amplifier's
// through-flowing chevrons.
const PATHS: Record<ModuleType, string> = {
  // The Oscillator: a bare sine — the scope trace, one full period.
  additive: '<path d="M-12 0C-8-10-4-10 0 0C4 10 8 10 12 0"/>',
  // The Harmonizer: the diamond — a muted tonehead (it sweetens, never
  // multiplies its own production).
  harmonizer: '<path d="M0-10 8 0 0 10-8 0Z"/>',
  // The Echo: the sine doubled — two waveforms, the second nested inside
  // the first at half size (the octave down it sings).
  echo: '<path d="M-12 0C-8-10-4-10 0 0C4 10 8 10 12 0"/><path d="M-6 0C-4-5-2-5 0 0C2 5 4 5 6 0"/>',
  // The Bend: the sine with one inflection flattened mid-travel — the
  // ♯/♭ shift it sings with, drawn as the kink in an otherwise level trace.
  bend: '<path d="M-12 2C-8-8-5-8-2 0L2 0C5 8 8 8 12-2"/>',
  // The Amplifier: two outward chevrons pushing a center dot onward —
  // charge in one side, out the other, stronger (the Booster's mark turned
  // into a conduit: same chevrons, the dot riding the flow between them).
  amplifier: '<circle r="2.2"/><path d="M-6-7-13 0-6 7M6-7 13 0 6 7"/><path d="M-9 0h5M4 0h5"/>',
  // RITUAL: the habit-cycle ring around a sustained wave (issue #219) —
  // the Habit app's ring language closed into a full circle, the scope
  // trace sustained inside it; the one habit-keyed board module.
  ritual: '<circle r="11"/><path d="M-6.5 0C-4.3-5-2.2-5 0 0C2.2 5 4.3 5 6.5 0"/>',
  // The Blaster: the sine wearing its charge — the scope trace plus the
  // generator's bolt at its core (the oscillator category's second
  // producer, converting received charge into its term).
  blaster: '<path d="M-12 0C-8-10-4-10 0 0C4 10 8 10 12 0"/><path d="M1.5-9-4-1H0L-1.5 9 4 1H0Z"/>',
  // The waveform profiles (issue #369): the four common designs wear their
  // own scope traces — the Sine keeps the bare wave above, the Triangle,
  // Square, and Saw draw the shapes their names say. Identity marks, not
  // waveform physics.
  triangle: '<path d="M-12 8-4-8 4 8 12-8"/>',
  square: '<path d="M-12 8V-8h9v16h9V-8h6"/>',
  saw: '<path d="M-12 8-1-8v16L10-8v16"/>',
  // The Afterglow (issue #372): the swelling wave — the trace opens low
  // and warms to full amplitude, the warmup curve it rides drawn as its
  // own envelope.
  afterglow: '<path d="M-12 0C-10.5-4-7.5-4-6 0C-4.5-8-1.5-8 0 0C1.5 16 4.5 16 6 0C7.5-16 10.5-16 12 0"/>',
  // The Sideband (issue #375): the sine flanked by two side bands — the
  // charge it receives converted into the chord content around its trace,
  // never into the trace itself.
  sideband: '<path d="M-11 0C-7.5-9-3.5-9 0 0C3.5 9 7.5 9 11 0"/><path d="M-14-5.5v11M14-5.5v11"/>',
  // The Release (issue #416): the envelope's own silhouette — attack,
  // decay, the sustained stretch, and the release ramp that outlives the
  // key. The ADSR stage the breather specialist is named for.
  release: '<path d="M-13 8-9.5-8-7.5-3H1.5L5.5 8"/><path d="M-13 8H13"/>',
  // The Standby (issue #416): the powered-down circuit's mark — the broken
  // ring with the standing stroke, the hardware state of resting while
  // production compounds.
  standby: '<path d="M-3.5-9.4A10 10 0 1 0 3.5-9.4"/><path d="M0-12V0"/>',
  // The Tail (issue #416): the struck note's reverb — one wave arc and the
  // decaying ripples that settle toward the axis, the sound that outlives
  // the session it followed.
  tail: '<path d="M-12 0C-9.5-8-7-8-4.5 0"/><path d="M-4.5 0c1.5-4.5 3-4.5 4.5 0c1-3 2-3 3 0c.7-2 1.4-2 2 0"/>',
  // The spacer's wire glyph (ADR-0021): a silent conductor stepping through
  // one cell — a running wire with solder points, never a voice. The board
  // face and tray tile render the ring window instead (issue #219); the
  // glyph remains for the expanded face and candidate tiles.
  spacer: '<path d="M-13 0h7l4-6 5 12 5-12 4 6h4"/><circle r="1.6" cx="-13" cy="0"/><circle r="1.6" cx="12" cy="0"/>',
  // The Flywheel: the bolt, bare — the corner marks distinguish its two
  // generator siblings (issue #232, named in issue #371).
  focusKeyed: '<path d="M2-13-6 1H0L-2 13 6-1H0Z"/>',
  // The Scribe: the bolt with a double-line corner mark (issue
  // #232) — the ruled lines of the written fact it earns from.
  noteKeyed: '<path d="M2-13-6 1H0L-2 13 6-1H0Z"/><path d="M5-14.5l3.5 3.5M7.5-15.5 11-12"/>',
  // The Milestone: the bolt with a check corner mark (issue #232) —
  // the completion tick it earns from.
  goalKeyed: '<path d="M2-13-6 1H0L-2 13 6-1H0Z"/><path d="M4.5-11.5 7-9 11.5-14.5"/>',
  // The Pulsewell (issue #372): the bolt with a burst corner mark — the
  // radiating fan of the periodic delivery burst it spends its reserve on.
  pulsewell: '<path d="M2-13-6 1H0L-2 13 6-1H0Z"/><path d="M6-13l2.2-2.2M8.5-9.5l3-.6M9-6.5l2.8 1"/>',
  // The Booster: outward chevrons around a center dot — it affects its
  // neighbors (replaces the rayed sun).
  infusor: '<circle r="2.2"/><path d="M-5-7-13 0-5 7M5-7 13 0 5 7"/>',
  // The Field (issue #374): the Booster's chevrons doubled inward and
  // outward — breadth, the moderate support it spreads to every neighbor.
  field: '<circle r="2.2"/><path d="M-5-7-13 0-5 7M5-7 13 0 5 7"/><path d="M-2.5-3.5-7 0-2.5 3.5M2.5-3.5 7 0 2.5 3.5"/>',
  // The Spotlight (issue #374): the Booster's dot with one focused beam —
  // the single chosen neighbor its stronger share lands on.
  spotlight: '<circle r="2.2"/><path d="M4-4.5 12.5-9M4 4.5 12.5 9M12.5-9v18"/>',
  // The Chorus (issue #375): the Booster's dot fronting three voice lines
  // of differing reach — the choir it conducts, the chord responses it
  // lifts instead of any amplitude.
  chorus: '<circle r="2.2"/><path d="M-7.5-5v10M0-8v16M7.5-5v10"/>',
  // The Exciter (issue #376): the Booster's dot between two inward charge
  // zigzags — the charge responses it deepens, fed by the charged
  // recipients it needs instead of any amplitude.
  exciter: '<circle r="2.2"/><path d="M-13 5.5-8.5-4.5-4 5.5M13 5.5 8.5-4.5 4 5.5"/>',
  forge: '<path d="m0-14 12 7v14L0 14-12 7V-7Zm0 0v28m-12-21 24 14m0-14L-12 7"/>',
  // The Mutator Forge wears the Forge chassis with a seeded hexagon at its
  // core replacing the lattice (issue #219) — the second branch, minting
  // into the Mutator tray, distinct from the Module Forge.
  mutatorForge:
    '<path d="m0-14 12 7v14L0 14-12 7V-7Z"/><path d="M0-5.5 4.8-2.7V2.7L0 5.5-4.8 2.7V-2.7Z"/><circle r="1.5"/>',
};

// Focus-app glyphs (ADR-0016: geometric synthesis glyphs, every hue paired
// with a glyph — the console stays monochrome, so these ride ink/muted).
// One glyph per door-wearing app: Time wears none — the console clock is
// itself the PLAN face's affordance, so the door glyph the app once had is
// retired unused (issue #313).
const APP_PATHS: Record<Exclude<FocusApp, "time">, string> = {
  // Habit: a cycle that carries a mark — a ~300° ring (from twelve, clockwise
  // to ten o'clock) closing into a connected chevron arrowhead that points
  // along the travel, plus a stroked center dot for the practice inside the
  // cycle. The old open arc's hairline nubs read as a spinner at tile size.
  habit: '<path d="M0-8A8 8 0 1 1-6.9-4"/><path d="M-11.1-2.5-6.9-4-6.1 .4"/><circle r="1.8"/>',
  goals: '<path d="M-6-8V8M-6-7H6L3-3l3 4H-6"/>',
  notes: '<path d="M-7-8H7M-7-2H7M-7 4h3M6.5 3.5 8 5l-4 4-2 .5.5-2Z"/>',
};

// The one lock mark (issue #336): the padlock drawing every locked control
// wears — the layer legend's locked symbol (issue #273) shared with the
// board actions' flow locks, so unavailability reads as one mark everywhere.
// Consumers wrap it in their own svg chassis; the drawing never drifts.
export const LOCK_MARK_PATHS =
  '<rect x="2.7" y="5.4" width="6.6" height="4.9" rx="1.1"/><path d="M4.2 5.4V3.9a1.8 1.8 0 0 1 3.6 0v1.5"/>';

export function lockMarkSvg(chassisClass?: string): string {
  return `<svg${chassisClass ? ` class="${chassisClass}"` : ""} viewBox="0 0 12 12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${LOCK_MARK_PATHS}</svg>`;
}

export function moduleIcon(type: ModuleType): string {
  return PATHS[type];
}

export function appIcon(app: Exclude<FocusApp, "time">): string {
  return APP_PATHS[app];
}
