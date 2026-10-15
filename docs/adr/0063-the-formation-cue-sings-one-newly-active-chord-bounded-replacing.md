# 0063 — The formation cue sings one newly active chord, bounded, replacing

Date: 2026-10-15
Status: Accepted; amends ADR-0052 §4's recognized-basis strum
Issue: #390 (parent spec #385)

## Context

The formation strum (ADR-0025's one remaining event sound beside the
target chime) diffed recognition: every newcomer the board newly
*recognized* strummed in sequence, idle candidates included, so a
placement could sound like a long performance and an idle-only change —
a chord the capacity never seats — rang like an earned effect. The
2026-10-15 design session (parent spec #385) settled the repair: the
cue is brief, truthful feedback about the action, and feedback, not a
claim about the largest production bonus.

## Decision

1. **Only newly active chords are eligible.** The cue's diff runs on the
   authoritative allocation's selected instances (`newlyActiveTermsOf`, comparing authoritative instance keys),
   never the recognized summary: an idle candidate never sounds, and an
   action whose allocation activates nothing — an idle-only change
   included — stays silent. Recognition, discovery, and the economy
   keep their recognized basis (the action boundary's sync is
   untouched); only the cue narrows to earning.

2. **One chord per action.** At most one newcomer is chosen: a newly
   active instance containing the placed or changed voice is preferred,
   and among equals — or when none contains that voice (a conducting
   spacer's bridge) — the first in the allocation's stable instance
   order stands. The same board change always cues the same chord.

3. **The cue is bounded and replaces.** Complete playback, tail
   included, stays within approximately 1.5 seconds (onsets clamp inside
   the bound whatever the chord vocabulary sings), and a subsequent
   formation cue stops the unfinished one at the adapter boundary
   instead of queuing or overlapping it. Mute, missing/suspended-audio
   no-ops, and the independent target-hit chime stand unchanged.

## Consequences

- `signals.ts`'s `playStrum` takes one chord, keeps its per-context cue
  record weakly, and owns the bound and the replacement; `app.ts`'s
  cue seam (`strumFormedChords`) owns the active-only diff and the
  selection, passing the placed or re-pitched voice. Instance keys include
  membership: an unchanged name/root total does not hide a new voice-set,
  and a growing total does not make retained instances eligible.
- ADR-0052 §4's closing sentence ("celebrates newly *recognized*
  chords — the discovery moment") is amended accordingly; the reserved
  readout's idle chips and the library's "heard — not singing" carry
  the recognition moment alone.
- The suites pin idle-only silence, the one-cue selection with
  changed-voice preference and stable fallback through player actions
  and the injected signal channels, and — at a controllable audio
  context over the adapter boundary — the schedule bound and the
  replacement's observed stops.
