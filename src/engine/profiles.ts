import { BALANCE, CATEGORY_OF } from "./constants";
import type { GeneratorType, ModuleType, OscillatorType } from "./types";

// The authored oscillator profiles (issue #369, parent #366; ADR-0059):
// each named type carries one fixed profile — a stable authored identity,
// never rolled per copy. One defining behavior and at most two supporting
// tradeoffs per design; the four waveform names identify individual common
// designs, not mechanically prescribed waveform families. Tier, level, and
// mutators scale the strengths these coefficients author — they never
// change the proportions between the axes, so a profile's shape survives
// progression intact.
//
// All figures are provisional tuning (the parent issue's accepted sample
// niches with representative boards, not balanced tables):
//   Sine     — the strong independent producer: full base term, but it
//              converts only half of every booster bonus (reduced booster
//              response).
//   Triangle — the chord specialist: every chord instance's bonus counts
//              2.5× toward its term, paid for with a reduced base.
//   Square   — the booster-fed producer: double booster response, paid for
//              with a reduced chord response and a slightly reduced base.
//   Saw      — the charge specialist: 3× the charged-empowerment delta, so
//              a steadily charged board flips it past the Sine, paid for
//              with the lowest uncharged production.
//   Blaster  — the category's standing alternative charge behavior
//              (ADR-0048): the conversion curve replaces the charge factor
//              entirely, so its charge axis has no comparable multiplier —
//              the absent mark, with the replacement stated in disclosure.
export interface OscillatorProfile {
  // The base-term multiplier over the category's unified synthRate.
  base: number;
  // How much of each adjacent booster's bonus the term receives.
  booster: number;
  // How much of every chord instance's bonus the term receives (the
  // formation's quality Q rides outside it, untouched — ADR-0049's
  // chordless ×1.00 contract holds per profile).
  chord: number;
  // The multiplier on the charged-empowerment curve's delta above ×1.
  charge: number;
  // The Blaster's structural alternative: received charge converts into
  // the term (×0 uncharged, ×1 at the asymptote) instead of empowering.
  chargeConversion?: boolean;
}

export const OSCILLATOR_PROFILES: Record<OscillatorType, OscillatorProfile> = {
  additive: { base: 1.0, booster: 0.5, chord: 1.0, charge: 1.0 },
  triangle: { base: 0.75, booster: 1.0, chord: 2.5, charge: 1.0 },
  square: { base: 0.9, booster: 2.0, chord: 0.6, charge: 1.0 },
  saw: { base: 0.7, booster: 1.0, chord: 1.0, charge: 3.0 },
  blaster: { base: 1.0, booster: 1.0, chord: 1.0, charge: 1.0, chargeConversion: true },
};

// The one profile read. Non-oscillators have no profile — callers guard by
// category; this accessor returns null rather than a neutral shape so a
// stray read cannot masquerade as authored data.
export function oscillatorProfileOf(type: ModuleType): OscillatorProfile | null {
  const category = CATEGORY_OF[type];
  if (category !== "oscillator") return null;
  return OSCILLATOR_PROFILES[type as OscillatorType];
}

// The response accessors the passes read. Every non-oscillator module —
// the silent voices singing into formations, future categories — reads
// neutral: the profiles so far author oscillators only.
export function baseProductionOf(type: ModuleType): number {
  return oscillatorProfileOf(type)?.base ?? 1;
}

export function boosterResponseOf(type: ModuleType): number {
  return oscillatorProfileOf(type)?.booster ?? 1;
}

export function chordResponseOf(type: ModuleType): number {
  return oscillatorProfileOf(type)?.chord ?? 1;
}

export function chargeResponseOf(type: ModuleType): number {
  return oscillatorProfileOf(type)?.charge ?? 1;
}

export function usesChargeConversion(type: ModuleType): boolean {
  return oscillatorProfileOf(type)?.chargeConversion === true;
}

// The base term's magnitude for one type at a given tier power — the one
// read every surface that quotes the figure shares (the Forge effect
// line, the candidate readout, the breakdown's Base output row), so the
// quoted number cannot drift from the pass's own.
export function baseTermOf(type: ModuleType, tierPower = 1): number {
  return BALANCE.synthRate * baseProductionOf(type) * tierPower;
}

/* ── Fixed aptitude grades (issue #370) ───────────────
   Every profile axis carries one grade from fixed coefficient bands —
   the quick-comparison shorthand beside the exact coefficients the
   disclosure layer already carries. Grades are absolute within the
   category: adding roster entries never reranks an existing grade, and
   level, tier, mutators, and live conditions change output without
   touching them. Grades summarize comparable numerical aptitudes only —
   temporal rules and structural alternatives (the Blaster's conversion)
   take the absent mark and are described directly. */

export type AptitudeGrade = "S" | "A" | "B" | "C" | "D" | "—";

// Anything at or below reads as absent rather than weak — zero is no
// effect, not a small one.
const EPS_FLOOR = 1e-9;

// The two band ladders, provisional tuning. Base production bands against
// the category's unified synthRate (the pre-profile standard = A strong);
// the response axes band around neutral ×1 (neutral = B standard). D weak
// and — absent complete the ladder for the later profile waves; the launch
// roster's lowest coefficient is C reduced.
const BASE_BANDS: readonly { min: number; grade: AptitudeGrade }[] = [
  { min: 1.2, grade: "S" },
  { min: 1.0, grade: "A" },
  { min: 0.85, grade: "B" },
  { min: 0.6, grade: "C" },
  { min: EPS_FLOOR, grade: "D" },
];

const RESPONSE_BANDS: readonly { min: number; grade: AptitudeGrade }[] = [
  { min: 1.4, grade: "S" },
  { min: 1.1, grade: "A" },
  { min: 0.8, grade: "B" },
  { min: 0.5, grade: "C" },
  { min: EPS_FLOOR, grade: "D" },
];

export function gradeOfCoefficient(value: number, axis: "base" | "booster" | "chord" | "charge"): AptitudeGrade {
  if (value <= EPS_FLOOR) return "—";
  for (const band of axis === "base" ? BASE_BANDS : RESPONSE_BANDS) {
    if (value >= band.min) return band.grade;
  }
  return "D";
}

// The grade's word for disclosure bodies — the one phrasing table, so no
// two surfaces drift apart on what a letter says.
export const GRADE_WORDS: Record<AptitudeGrade, string> = {
  S: "exceptional",
  A: "strong",
  B: "standard",
  C: "reduced",
  D: "weak",
  "—": "absent effect",
};

// One comparable numerical axis of a type's profile, with its fixed grade
// and exact coefficient. Axes a type lacks entirely read absent — the
// launch case is the Blaster's charge axis, whose conversion replaces the
// ordinary charge factor instead of scaling it.
export interface ProfileAxisRead {
  id: "base" | "booster" | "chord" | "charge";
  label: string;
  grade: AptitudeGrade;
  // The exact authored multiplier, or null when the axis has no
  // comparable multiplier (the absent mark).
  coefficient: number | null;
}

export const PROFILE_AXIS_LABELS: Record<ProfileAxisRead["id"], string> = {
  base: "Base production",
  booster: "Booster response",
  chord: "Chord response",
  charge: "Charge response",
};

// The type's fixed profile axes, grades included — the one read the Forge
// tiles and the Hex detail share. Types without authored profiles (every
// non-oscillator, until their waves land) read empty: no axes, no grades,
// nothing to compare yet.
export function profileAxesOf(type: ModuleType): readonly ProfileAxisRead[] {
  const profile = oscillatorProfileOf(type);
  if (!profile) return [];
  const axes: ProfileAxisRead[] = [];
  const push = (id: ProfileAxisRead["id"], coefficient: number, absent = false): void => {
    axes.push({ id, label: PROFILE_AXIS_LABELS[id], grade: absent ? "—" : gradeOfCoefficient(coefficient, id), coefficient: absent ? null : coefficient });
  };
  push("base", profile.base);
  push("booster", profile.booster);
  push("chord", profile.chord);
  push("charge", profile.charge, profile.chargeConversion === true);
  return axes;
}

/* ── Generator profiles (issue #371, parent #366) ─────────────
   Each named generator carries one fixed earning profile: authored
   coefficients over the practice inputs, balanced as a whole and never
   percentages summing to 100%. The module's power (level × tier, mutators)
   scales every axis by the same figure — earning and delivery scale
   together, so the proportions between the axes and the delivery rhythm
   survive progression intact.
   
   Earning kind is explicit per axis:
   - `focus` is BANKED earning: credited practice seconds accrue the
     charge during the session and the whole window lands at session end
     (honesty-credited reconciliation seconds included).
   - `noteChar`, `noteCreate`, and `goal` are IMMEDIATE earning: the
     charge lands at the practice fact itself — the written note, the
     completion tick — in flow, while paused, or between sessions.
   
   Delivery is the family's shared steady shape: a deployed generator
   emits at its power-scaled strength and consumes reserve quantity at
   that same rate — every adjacent eligible receiver gets full strength,
   expenditure never depends on the neighbor count, and the reserve is a
   store of charge quantity, so banked charge is exactly the charge the
   generator can still emit.
   
   All figures are provisional tuning (the parent issue's accepted sample
   niches, not balanced tables):
   - Flywheel  (focusKeyed) — focus-heavy: the full 0.1/s focus window,
     modest note and goal credit. Specialized focus practice is viable
     without owning the other tools.
   - Scribe    (noteKeyed)  — note-heavy: the distinct character
     coefficient (1/char, capped per note) and creation bonus (a flat
     30 once per newly created note meeting the minimum length), plus
     modest focus credit.
   - Milestone (goalKeyed)  — goal-heavy: ×5 the completion base, modest
     focus and note credit. */
export interface GeneratorProfile {
  // Charge per credited practice second, banked at session end.
  focus: number;
  // Charge per stored note character, immediate, under the per-note cap.
  noteChar: number;
  // Charge once per newly created note meeting the creation minimum —
  // never on re-saves (notes are append-only, one credit per written note).
  noteCreate: number;
  // Multiple on the goal-completion base (the focus equivalent, prorated
  // by the goal's live share), immediate at the completion tick.
  goal: number;
}

export const GENERATOR_PROFILES: Record<GeneratorType, GeneratorProfile> = {
  focusKeyed: { focus: 0.1, noteChar: 0.2, noteCreate: 5, goal: 1 },
  noteKeyed: { focus: 0.02, noteChar: 1, noteCreate: 30, goal: 1 },
  goalKeyed: { focus: 0.02, noteChar: 0.2, noteCreate: 5, goal: 5 },
};

// The one profile read for generators. Non-generators have none — callers
// guard by category; null rather than a neutral shape so a stray read
// cannot masquerade as authored data.
export function generatorProfileOf(type: ModuleType): GeneratorProfile | null {
  const category = CATEGORY_OF[type];
  if (category !== "generator") return null;
  return GENERATOR_PROFILES[type as GeneratorType];
}
