# Header status display — design session record

Status: confirmed 2026-10-19 through the grilling design session with the owner; implemented in this checkout. Follow-up pinning in [instrument standards](instrument-standards.md) remains a separate decision.

## Intent and priorities

The console header is one of the two things a player watches during flow (the board is the other). Recompose the Focus door deliberately: a device status display in the synth-faceplate register — simple, clear, elegant — with the goal progress of the selected habit as its one status indicator.

1. The time is the display's face: full-height, glance-first.
2. One goal read only — the selected habit's — cute within the machined register.
3. Nothing else moves: the main switch, pause, session strip, and the sheet anchor keep their posts.

## Confirmed direction

Decided in three interview rounds (rounds 1–2 settled scope, the banner's retirement, the meter's form and behavior, the provisional logo; round 3 recomposed the door as the display panel):

- **The door becomes a display panel.** The one-button Focus door keeps its pinned unity (CONTEXT.md console entry); its interior recomposes as a recessed display well — panel-deep, hairline border, square-cut — with the hypercube badge and wordmark on the chassis beside it. Composition V3, time-first: the full-height display clock leads, the program block follows (habit name over caption, the provisional line while the honesty pool holds), and the goal meter closes the well at its right edge.
- **The display clock takes the 36px reserved moment** (28 narrow, 24 phone; 24 down to the 360px line) — the header-status ramp amendment to the type ramp's reserved moments, recorded in DESIGN.md and the sidecar.
- **The goal meter** is a vertical LED column of seven square segments lighting bottom-up — the cute register: a hardware level meter. It wears the shown goal's palette token. Unlit segments stay engraved; a `·N` mono count mark answers for further open goals in play (interim — the planned one-goal-per-habit rework retires it). Nothing qualifies — no habit, or no goal matching it — and the meter does not stand; the well closes over its slot. The column stays flush at the well's right edge in every state: completion's engraved check rides the practice name in the program block, never inside the meter row.
- **Pick rule**: qualifying goals are the selected habit's own plus the habit-agnostic ones; the nearest-to-completion open goal lights the column; completion never displaces an open goal; an all-done set closes on its mark — the engraved check beside the practice name. This rule is interim by design — the owner plans the habits/goals rework to make a goal a function of the habit itself, one per habit, collapsing the rule to identity.
- **The meter speaks once.** A tooltip gloss on hover, keyboard focus (its own tab stop — the one read stop inside the door), and touch: which goal and what remains (`Daily 20 min · 6 min to go`). The habit name stays off the gloss — the display already reads it. The meter opens nothing; the whole door still opens PLAN.
- **The caption drops its "of"**: a planned session reads the bare target under the clock (`20:00`); state words (`paused`, `overrun`, `open-ended`, `planned`) are unchanged.
- **The provisional line moves inside** the program block as its third line, keeping the switch's vermillion alarm voice (the stylesheet's old `--accent` was drift against its own comment); the well grows one line only while the honesty pool holds. Still hidden on phone.
- **The banner retires.** The five-bar all-goals banner is gone from the header; other habits' progress lives in the GOALS face and session summary. The phone row gains the meter where the banner never reached.
- **Small phones yield the furniture, never the controls.** The well shrinks inside its door before anything covers the session's controls (the program block absorbs the squeeze; the clock's digits and the meter column hold size). Below 380px the badge and the disclosure chevron step aside — the wordmark is already gone, the door's tap discloses the sheet — and below 360px the switch cluster and doors give up their slack. At the 320px floor every read survives: clock, habit with its done mark, meter, pause, End, doors.
- **The logo is provisionally the inventory hypercube** (filled core), wordmark unchanged. This amends the inventory brief's "separate decision" note and DESIGN.md's "main logo is unchanged" — adoption is dated and cheap to reverse.

## Behavior matrix

| Mode | Meter | Caption |
| --- | --- | --- |
| Flow, planned | ticking live (earned live light) | bare target |
| Flow, open-ended | ticking live | `open-ended` |
| Overrun | ticking live | `overrun` |
| Paused | frozen | `paused` |
| Upgrade | static today's accrued progress | `planned` / `open-ended` |
| Complete | all lit + engraved check | unchanged |
| No qualifying goal | absent | unchanged |

Reduced motion: everything static; segment steps, marks, and illumination carry the state without animation. Completion's brief local accent is the only motion the meter earns.

## Boundaries and one-place rules

- [Instrument standards](instrument-standards.md) govern presentation: square-cut well, no radii, goal palette tokens only, state never color alone, tabular figures. Pinning the display panel there is a follow-up decision.
- The meter is a display-only tooltip trigger — the instrument layer's access grammar minus the ⓘ (instrument.ts places such tips at the tip's own bounds).
- The GOALS face remains goals' editing and detail home; the meter reads, it never manages.
- The type ramp's reserved moments carry the display clock's ladder; the sidecar (`.impeccable/design.json`) and the ramp sweep may not drift apart.
