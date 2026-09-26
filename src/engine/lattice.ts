// The octave-stack lattice (ADR-0021): an isomorphic board, Wicki–Hayden
// kin, rendered in 12-TET. Pitch is an absolute property of each cell,
// derived from its coordinates and never persisted — there is no origin
// module and nothing to learn before the first chord.
//
// The mapping: one horizontal lattice step (+q) walks the circle of fifths
// (+7 semitones); one step along the (0, ±1) direction stacks an octave
// (±12 semitones). Columns (constant q mod 12) therefore read as one note
// name top to bottom, each note appearing exactly once per octave row, and
// the octave-row bands (the register the gate economy prices) run as
// r + floor(7q / 12) — relative to the start register, which is row 0.
//
// The difficulty ladder falls out of the geometry: a ♭7 sits two fifths
// steps out (one wire cell between), m3/M6 three steps (two wire cells),
// M3/m6 four steps (three) — harder chords literally cost more board
// (board-redesign spec §3).
import { BALANCE } from "./constants";
import type { Hex } from "./types";

// The start register's anchor: the opening synthesizer sits at C4 (MIDI 60)
// on the origin cell.
export const START_PITCH = 60;

// Absolute pitch in MIDI semitones — the note a cell sounds.
export function pitchOf(pos: Hex): number {
  return START_PITCH + 7 * pos.q + 12 * pos.r;
}

// Pitch class 0–11 (C = 0). Depends on the column alone: same column, same
// note name.
export function pitchClassOf(pos: Hex): number {
  return ((7 * pos.q) % 12 + 12) % 12;
}

// The octave row a cell sits in, counted from the start register (row 0):
// the band of cells whose pitches sit in the same octave. Rows are finite
// and symmetric around the start register (ADR-0022); the fifths axis is
// ungated.
export function octaveRowOf(pos: Hex): number {
  return pos.r + Math.floor((7 * pos.q) / 12);
}

// Whether a position sits inside the board's finite patch. Rows are finite
// and symmetric around the start register (ADR-0022); columns span the
// circle of fifths once — twelve names, ending just past the tritone —
// because the pitch kernel repeats every twelve columns ((q+12, r−7) sounds
// exactly what (q, r) does). Bounding them is what keeps each note
// appearing exactly once per octave row. The fifths axis stays ungated: no
// premium, only the ordinary cell scaler.
export function rowInRange(row: number): boolean {
  return Math.abs(row) <= BALANCE.octaveRows;
}

// The column window: the twelve fifths steps starting five left of the
// start column — C sits near the middle, the tritone (F♯/G♭) at one edge.
const COLUMNS_BEFORE = 5;

export function columnInRange(pos: Hex): boolean {
  return pos.q >= -COLUMNS_BEFORE && pos.q <= -COLUMNS_BEFORE + (BALANCE.fifthsColumns - 1);
}

export function positionInRange(pos: Hex): boolean {
  return rowInRange(octaveRowOf(pos)) && columnInRange(pos);
}

// Chromatic note names indexed by pitch class (C = 0), sharp spellings
// throughout — "key" is a reading of the columns, not a tuning (ADR-0021),
// so no accidental policy is ever load-bearing.
const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"] as const;

// Scientific-pitch readout of an absolute pitch: "C4", "G♯5". Octave −1 is
// MIDI 0, so C4 sits at 60.
export function noteNameOf(pitch: number): string {
  const className = NOTE_NAMES[((pitch % 12) + 12) % 12]!;
  const octave = Math.floor(pitch / 12) - 1;
  return `${className}${octave}`;
}

// A cell's note name: columns read as one note name, so this is also the
// column's name at the cell's register.
export function cellNoteOf(pos: Hex): string {
  return noteNameOf(pitchOf(pos));
}
