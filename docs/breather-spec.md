# FlowSynth breather spec

The breather: an optional, timed break phase after a flow session ends — the board keeps producing while the player steps away, paid in authored per-voice responses. Assembled for implementation.

**Status**: produced by the breather design interview (2026-10-19). Every decision below is final for this effort; exact numbers are **provisional tuning** unless a source says otherwise. Companion records: [ADR-0073](adr/0073-breathers-self-end-pretrusted-and-pay-per-profile.md) (the decision record) and the amended `CONTEXT.md` (glossary — **Breather**, **Breather allowance**, **Breather response**). Where this spec and the ADR disagree, the ADR wins. Scope, agreed in the interview: the mechanic only — the dedicated breather module roster and the economy rebalance are their own later passes, built against the facts this mechanic persists (§6).

---

## 1. The phase

*Decided in the interview, questions 1–2, 10, 12, 14.*

- **A fourth mode**, not a session phase. The flow session closes completely — record written, summary shown — before a breather can begin. The breather is the period between the closed session and upgrade mode. It never appears inside a running session, so the honesty machinery and the session's practice accounting are never patched to accommodate it.
- **The board runs at full production**: nous rate, charge delivery (generator reserve drains, empowerment applies), and forge progress — everything flow runs, minus practice. Excluded: habit accrual, goal progress, the flow meter, the generators' focus earning, session achievements. Breather seconds credit nothing; they produce.
- **The temporal clock advances.** Breather seconds feed the session clock the departed session left behind — Afterglow boards breathe at their peak warmth, Pulsewell cycles on. The next session start resets the clock as today; no phase is ever carried into a new session.
- **One breather per session**, offered once, at that session's end. Declining expires the allowance.
- **No pause.** The clock is the point. The early exit (§4) is the only way out.

## 2. The breather allowance

*Decided in the interview, questions 4–5, 12.*

- **Formula**: a session's end mints a breather allowance of its **credited practice seconds ÷ 5**.
- **Gate**: nothing under **10 credited minutes**. **Cap**: **10 minutes**. **Rounding**: down to the whole minute.
- **Use-it-or-lose-it**: the offer exists only at that session's end, inside the session summary (§5). No persisted allowance balance; nothing banks toward a later session; allowance does not accrue visibly during flow.
- The basis is credited practice time — the post-reconciliation total — so a session whose provisional time was dropped mints from what actually credited.

## 3. The bonus: breather response

*Decided in the interview, questions 13, 19–21; the global-multiplier reading was rejected.*

- **A per-profile comparable axis**, authored per named oscillator type like base production, booster response, chord response, and charge response. During a breather, each oscillator voice's **final ν/s** — synth term, chord factors, charge empowerment, and received booster uplift all included — multiplies by its type's breather response.
- **The absent mark is exactly ×1**, the Sideband precedent. The axis speaks only during a breather; flow and upgrade mode read nothing from it.
- **Graded** on the absolute bands like every comparable axis (S/A/B/C/D, absent mark), shown on the profile-grades chip as `×1.50 (A)` — identical wherever the profile renders.
- **Oscillator-category only.** Generators, boosters' own grants, and forge progress carry no breather response; a specialist voice backed by boosters scales as one coherent build because the multiplier rides the voice's final value.
- **Launch roster**: existing oscillator types author modest breather responses so the mechanic is live from day one — figures are provisional tuning done at implementation. Dedicated breather-specialist types (the ones that make the axis their identity) join with the later roster iteration, per the scope note.
- There is **no global breather term**. The achievement and discovery boosts are untouched; the breather's economy is the responses.

## 4. Trust and endings

*Decided in the interview, questions 6–8, 15, 17.*

- **Breather time is pre-trusted** — the honest counter-image of the provisional pool. It is never provisional, never honesty-adjudicated, never practice credit. The honesty system governs practice claims; a breather claims nothing.
- **The phase self-ends** — the game's first auto-timed transition. The player is by design away when it ends, so it ends itself: at the wall-clock deadline the board stops, the phase closes into upgrade mode, and the completion is a fact the player returns to.
- **Away reconciliation inside a breather**: sleep, tab hide, reload — any wall gap up to the deadline reconciles as live breather production when the player returns, at full rate, no bucket, no report. A gap reaching past the deadline reconciles production up to the deadline and completes the breather at that deadline.
- **Early exit is always allowed, without penalty**: the bonus was the response-scaled rate while it lasted — nothing prorates, nothing forfeits, and an early exit does not increment the completed count (§6).
- **End signals** mirror target-hit signals: chime and browser notification fire together the moment the breather completes.

## 5. Surfaces

*Decided in the interview, questions 9–11, 17; presentation judged against the [instrument standards](instrument-standards.md).*

- **The offer rides the session summary** — one control beside dismissal, `Take a 5:00 breather` in the name + state + effect register (concrete allowance, no explanatory paragraph). The summary behaves as today when declined. An unseen summary survives reload with its offer intact.
- **No takeover screen** — the point is leaving the screen. The board stays live with its readouts exactly as in flow; the shared flow lock covers grid actions, Catalog, Forge, Add, and Inventory; Collection and the console stay readable; **Notes capture stays allowed**.
- **The console's main switch reads the breather**: the dominant switch shows the live breather state, and its activation is the early exit. The session progress strip shows the breather's countdown in the same position and hue treatment; the tab title reads the remaining breather.
- **A reload mid-breather lands directly in the breather**, reconciled per §4 — never back into the summary.
- **Completion**: returning to a finished breather finds upgrade mode, the end signals already fired, and a brief completion read on the console (tuning: toast or held switch caption) — the record line is permanent (§6).
- **The session record gains one factual line** for a taken breather — duration taken, completed or ended early — rendered in the history drill-down beside the session's other honesty-style event lines. Accounting, not a new entity; no breather records of their own.

## 6. The facts future content reads

*Decided in the interview, question 16.*

Two lifetime facts persist through prestige with the life record, minted for the later roster and rebalance passes:

- **Completed breathers** — count of breathers whose allowance ran to zero. Early exits never increment it.
- **Total breather seconds** — lifetime sum of breather time lived, early exits included.

## 7. Implementation seams

From the code survey backing the interview; the implementer verifies each against current source.

- **Mode union**: `Mode` gains `"breather"`; save validation and the shared-save staleness rules must accept it. Breather state persists (`startedAt`, allowance, completed flag) so a reload mid-breather reconciles on the wall clock.
- **Rate**: the breather response joins `computeRates` as a per-voice term keyed to breather mode **and** the allocation fingerprint — a stale chord solve must never survive the mode change.
- **Sequence**: the offer slots between `dismissSummary` and free upgrade play; the early exit and the deadline both land in `upgrade` mode through the same `endBreather` action as `endSession`'s sibling.
- **Boundary loop**: the existing `applyBoundary`/`applyGap` machinery classifies breather gaps; breather mode feeds a new branch — live production, no practice sinks, deadline clamp.
- **Signals**: the end chime + notification reuse the target-signal channels; the breather countdown rides `syncTitle` and the progress strip.
- **First auto-timed transition**: mode changes have only ever been explicit gestures; the deadline path is new and needs its own idempotent reconciliation so a reload after completion cannot re-run or re-bank it.
