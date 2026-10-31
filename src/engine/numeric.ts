// The numeric fault (issue #486, parent #484 stories 33–35): the economy
// refuses figures it cannot represent. JSON.stringify silently writes null
// for a nonfinite number — the corruption the parent save carried — and an
// accumulated Infinity compounds silently forever after. Both are refused
// at the commit point: every economy commit checks its figure first, the
// advance walk restores the state it was given, and the caller receives
// the refusal instead of a half-applied update.

// One thrown shape, caught by the advance walk's restore wrapper (and by
// nothing else — every other commit site refuses before it mutates, so the
// throw only ever travels to the walk that can undo it).
export class NumericFault extends Error {
  constructor(readonly detail: string) {
    super(`numeric fault: ${detail}`);
    this.name = "NumericFault";
  }
}

// The one commit-point check: the figure must be a finite double to land.
// Returns the value so a guard can wrap the computed figure inline.
export function requireFinite(value: number, detail: string): number {
  if (!Number.isFinite(value)) throw new NumericFault(detail);
  return value;
}
