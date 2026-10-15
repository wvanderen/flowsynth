# 0060 — Generator earning is authored per named profile; the reserve stores charge quantity

Date: 2026-10-15
Status: Accepted
Issue: #371 (parent #366)

## Context

The launch generators keyed one practice fact per type: the focus-keyed
generator banked `chargeWindowFraction` of credited time at session end,
the note-keyed one credited `noteCreditPerChar` per character at the
write, and the goal-keyed one credited `goalReserveMultiple` × the focus
equivalent at the completion tick. Specialized practice therefore required
owning the matching tool, and the reserve itself stored output seconds —
a unit that conflated banked value (what the generator can still emit)
with delivery rhythm (how long it lasts), and that let level upgrades
raise delivery strength without touching earning.

## Decision

1. **Generators are three named designs with authored earning profiles.**
   `GENERATOR_PROFILES` in `src/engine/profiles.ts` authors four
   coefficients per type — focus (charge per credited practice second),
   note characters (charge per stored character), note creation (a flat
   bonus once per newly created note meeting the creation minimum), and
   goal completion (a multiple on the completion base, prorated by the
   goal's live share). The coefficients are independent authored figures,
   never percentages summing to 100%. The keys keep their save identity:
   `focusKeyed` reads "Flywheel" (focus-heavy, modest note/goal credit),
   `noteKeyed` reads "Scribe" (note-heavy, distinct character and
   creation coefficients, modest focus credit), `goalKeyed` reads
   "Milestone" (goal-heavy ×5, modest focus/note credit). Provisional
   tuning; the specialist's five-to-one lead on its own axis is the
   niche.

2. **Every practice fact reads through every owned generator's profile.**
   The one credit seam (`reserves.ts`) replaces the per-type credit: each
   fact — session end, written note, completion tick — credits every
   owned generator, board or tray alike, at full independent credit per
   copy. Earning kind is explicit per axis: focus earning is **banked**
   (it accrues with credited time and lands at session end,
   honesty-credited reconciliation seconds included); note and goal
   earning are **immediate** (they land at the fact, in flow, paused, or
   between sessions). Tray copies bank without emitting — placement is a
   delivery choice, never an earning one.

3. **Power scales earning and delivery together.** Every banked figure
   multiplies by the module's power (`modulePower` — the same figure
   delivery strength uses, mutators included through `hostPower`), so a
   level or merge tier scales both legs by one multiplier: the
   proportions between the axes and the delivery rhythm (quantity ÷
   strength) never move. The charge-tap build nodes (ADR-0046) scale the
   focus bank exactly as before.

4. **The reserve stores charge quantity.** A deployed generator emits at
   its strength (power + the steady-conduit node's flat bonus) and
   consumes reserve at that same rate while flow is live. Banked charge
   is exactly the charge the generator can still emit; delivery reaches
   every adjacent eligible receiver at full strength and expenditure
   never depends on the receiver count. The advance split walks the
   earliest emptying reserve (`quantity ÷ strength`) exactly as it walked
   the earliest emptying window. Consequence, accepted: the steady
   conduit's strength bonus now spends reserve faster instead of adding
   free total charge — it accelerates delivery, it does not multiply it.

5. **The note-creation minimum is 20 stored characters** (`BALANCE.
   noteCreationMinChars`, provisional): a newly created note meeting it
   earns its profile's creation bonus once — notes are append-only, so
   there is no edit or re-save path that could re-award it, and character
   earning keeps no minimum. The character axis stays capped per note
   (`noteCharCreditCap`, 300 charge before power scaling; the old
   `noteCreditPerChar`/`noteCreditCapSeconds`/`goalReserveMultiple`
   constants die into the profile table). The goal-completion base — the
   focus equivalent — now reads the Flywheel's focus coefficient, the
   figure's one home: `chargeWindowFraction` dies with the split, so the
   "equivalent" can never drift from the earning it names.

6. **Ordinary endings retain, Arete clears.** Session end banks the
   focus window and leaves every other reserve untouched; prestige
   (the Arete boundary) zeroes stored charge with the rest of the era's
   economy, as ADR-0047 already established.

7. **Legacy-save conversion (v9 → v10), settled before implementation.**
   Loading a v9 save converts each owned module's stored reserve from
   output seconds to charge quantity: `legacySeconds × modulePower`.
   Under the seconds model the reserve delivered `legacySeconds ×
   authored power` of module-owned charge; the conversion preserves that
   total and, with it, the authored-power delivery duration (`quantity ÷
   strength` equals the stored seconds). Board-side strength — power
   mutators on the cell, the steady-conduit build node's flat bonus —
   was never the reserve's: it amplified delivery without adding to the
   banked budget, and future delivery re-applies it at the live strength.
   A corrupt or absent figure reads as an empty reserve. The conversion
   runs only on `version === SAVE_VERSION - 1`, is repeatable, and
   round-trips byte-identically; anything older rejects with the
   start-fresh message (ADR-0017's pattern).

## Consequences

- `creditOwnedGenerators` dies; `creditFocusEarning`,
  `creditNoteEarning`, and `creditGoalEarning` are the three fact seams.
  `noteReserveCredit` dies with it — the credit lives in the seams.
- `SAVE_VERSION` bumps to 10 with the one-step v9 conversion; the v8 →
  v9 migration retires (v8 and older reject).
- The generator reserves now answer "how much charge is left", not "how
  many seconds remain" — at power 1 the numbers coincide, which the
  level-0 test fixtures ride.
- Later profile waves (Pulsewell's bursts, the boosters) author against
  the same table and grade bands without re-ranking anything.
- The provisional coefficients reproduce the pre-profile specialists'
  economies exactly at power 1 (Flywheel focus, Scribe characters,
  Milestone goals) and add the modest cross-axes on top.
