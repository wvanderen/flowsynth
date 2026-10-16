import type { FocusApp, ModuleType, Rarity, ShelfType } from "../engine/types";

// The final names and faceplates (issue #219, wave 1; roster types wave 2):
// display-layer only — `name` is the full name every tooltip, roster row,
// and toast reads; `short` is the face's compact nameplate.
export const META: Record<ModuleType, { name: string; short: string; role: string }> = {
  // The waveform oscillators (issue #369, ADR-0059): four named designs
  // over one shared leg — the `additive` key predates the profiles and
  // stays the save's key for the Sine, like `focusKeyed` before it.
  additive: { name: "Sine", short: "SINE", role: "Strong base term" },
  blaster: { name: "Blaster", short: "BLST", role: "Charge into synth term" },
  triangle: { name: "Triangle", short: "TRI", role: "Chord-heavy term" },
  square: { name: "Square", short: "SQR", role: "Booster-fed term" },
  saw: { name: "Saw", short: "SAW", role: "Charge-fed term" },
  // The temporal profile wave (issue #372): the timing is the identity,
  // so the role names the condition and the profile line spells it out.
  afterglow: { name: "Afterglow", short: "GLOW", role: "Session-clocked term · warms up" },
  // The alternative-charge wave's oscillator (issue #375): the role names
  // the replacement — charge lands in the chord response, never the term.
  sideband: { name: "Sideband", short: "SIDE", role: "Charge into chord response · weak alone" },
  harmonizer: { name: "Harmonizer", short: "HARM", role: "Silent voice — its cell's pitch" },
  echo: { name: "Echo", short: "ECHO", role: "Silent voice — neighbor, one octave down" },
  bend: { name: "Bend", short: "BEND", role: "Silent voice — its pitch, shifted" },
  amplifier: { name: "Amplifier", short: "AMP", role: "Relays charge onward" },
  ritual: { name: "RITUAL", short: "RITUAL", role: "Amplifies the active habit's build while charged" },
  spacer: { name: "Spacer", short: "Spacer", role: "Silent wire" },
  // The generator profile wave (issue #371): three named designs over the
  // one reserve surface — the keys predate the profiles and stay the
  // save's identity, like `additive` for the Sine.
  focusKeyed: { name: "Flywheel", short: "FLYW", role: "Focus-fed reserve · steady" },
  noteKeyed: { name: "Scribe", short: "SCRB", role: "Note-fed reserve · per character" },
  goalKeyed: { name: "Milestone", short: "MILE", role: "Goal-fed reserve · per completion" },
  pulsewell: { name: "Pulsewell", short: "PLSW", role: "Mixed-fed reserve · bursts" },
  infusor: { name: "Booster", short: "BOOST", role: "Neighbor bonuses" },
  // The booster wave (issue #374): coverage traded against strength — the
  // Field spreads moderate support, the Spotlight focuses a stronger share
  // on the player's chosen recipient.
  field: { name: "Field", short: "FIELD", role: "Broad uplift · every neighbor" },
  spotlight: { name: "Spotlight", short: "SPOT", role: "Focused uplift · one recipient" },
  // The chord-response booster (issue #375): the category's first
  // non-amplitude design — the role names its term.
  chorus: { name: "Chorus", short: "CHOR", role: "Chord response · every neighbor" },
  // The charge-response booster (issue #376): the role names its term and
  // its condition — the grant reads only on charged recipients.
  exciter: { name: "Exciter", short: "EXCT", role: "Charge response · charged recipients" },
  forge: { name: "Forge", short: "Forge", role: "Rolls at threshold" },
  mutatorForge: { name: "Mutator Forge", short: "Mut. Forge", role: "Mutator rolls at threshold" },
};

// The catalog shelf's per-row description (issue #310 steering): the one
// line the row carries, overriding the roster's short role where the
// purchase needs the fuller sentence.
export const SHELF_DESCRIPTIONS: Partial<Record<ShelfType, string>> = {
  generator: "Banks focus into a charge reserve — modest note and goal credit",
};

export const RARITY_LABEL: Record<Rarity, string> = { common: "common", uncommon: "uncommon", rare: "rare" };

// The merge tier's player-facing word (ADR-0058), 1-based — the verbal
// home of the engraved rings for labels, tooltips, and screen readers.
export function tierWord(tier: number): string {
  return `Tier ${tier + 1}`;
}

// Focus-app display names, shared by the console tiles and purchase surfaces.
export const APP_LABELS: Record<FocusApp, string> = { habit: "Habit", time: "Time", notes: "Notes", goals: "Goals" };

// The one-line pitch a ladder row carries in the catalog (spec §2.2's
// launch function column). The ladder rests empty at launch (ADR-0019), so
// no row renders; the pitches stay for the ladder's first tenant.
export const APP_ROLES: Record<FocusApp, string> = {
  habit: "Select the active habit.",
  time: "Planned targets and timing tools.",
  notes: "Capture what you notice.",
  goals: "Track practice conditions.",
};

// The planned target's free-entry range (§6): whole minutes, 1–90.
export const PLAN_MIN_MINUTES = 1;
export const PLAN_MAX_MINUTES = 90;

// The planned-target preset chips (§6): quick picks, the set gained 90.
// Open-ended is its own mode — never a duration choice. Values are minutes.
export const PLAN_PRESET_MINUTES: readonly number[] = [10, 15, 20, 25, 30, 45, 60, 90];

// The history list's page size (§9): ~20 rows with a show-more tail, no
// grouping, no caps on what is kept — only on what is drawn at once.
export const HISTORY_PAGE_ROWS = 20;
