# Generators own their reserves, credited at the console fact

The charge roster grows past the single focus-keyed generator — note-keyed and goal-keyed generators read the console's Notes and Goals facts through the board seam (ADR-0012) — and with three types, reserve ownership, credit timing, and sizing become observable design questions. The decision map (issue #212, ticket #214, 2026-10-02) settled them, keeping the charge earned separate from its trigger and upholding ADR-0002's module-owned vocabulary.

## Decision

- **Each generator owns its reserve.** Every console fact credits all owned generators of the matching type, board and tray alike — tray copies hold their reserve until placed. Copy-count multiplication is deliberate strategy: copies bank more reservoir, not just reach. The save's single player-wide charge-window scalar generalizes into per-module reserve state, which is what ADR-0002's "remaining output belongs to the generator" always described.
- **Focus stays as it is.** The focus-keyed generator banks a charge window of 0.1 × the session's credited practice time (provisional) at session end, live practice only — manual logs never bank. The generator itself stays flat; amplification lives in habit-build nodes (ADR-0046), never in an upgrade path on the fraction. N copies each bank their own window.
- **The note generator credits by character count.** Every note written — in flow or between sessions, tagged or not — credits each owned note generator with output time sized linearly by the note's character count up to a per-note cap (provisional 1 s/char, 5-minute cap, so ~40 chars ≈ 40 s). No minimum length and no per-day cap: short jotted notes and many notes are both legitimate, and there is no similarity detection — trust-based, like the honesty system. Notes stay append-only this iteration; a future delete never refunds.
- **The goal generator credits a multiple of the focus equivalent.** Completing a goal of M minutes banks k × (0.1 × M) (provisional k = 5) — substantially stronger than practicing for the same duration, which is the point. Recurring goals credit once per occurrence; overlapping completions each credit — goal slots and the practice itself keep farming self-limiting, so no size floor.
- **Manual logs prorate, never zero out mixed practice.** Goals track live versus manual seconds; a completion banks k × (0.1 × M) × liveShare. Manual logs alone bank nothing (the honesty boundary), but a player who logged half a goal manually does not forfeit the rest.
- **Bank at the fact.** A note credits the moment it is written; a goal credits at its completion tick, live mid-session or at honesty reconciliation. Focus keeps session-end banking because its basis is the session's total. One uniform rule: a console fact grows its reserve, a running generator drains it.
- **Level scales delivery, never duration.** Banked duration is flat per the sizing laws; level, rarity, and mutators scale output strength (the existing hostPower path), so a banked second from a stronger module is worth more at the receiver. Level is never double-counted into duration.
- **Sizing keys off minutes only.** Richer goal criteria — multi-habit days and friends — stay deferred; when they land they carry a nominal-minutes value chosen at creation purely for reserve sizing. No difficulty multipliers this iteration.
- **Standing semantics unchanged.** Reserves burn one second per live flow second, even with no adjacent receivers; reserves are charge state and reset at prestige; the consumed module's unspent reserve is forfeited on combination.

## Consequences

- `CONTEXT.md` gains **Note pool** and **Goal reserve** (working names; the roster effort — issues #215, #219 — owns final names, glyphs, and roll-pool wiring), and the **Charge window** entry becomes per-module.
- The charge-window save scalar migrates to per-module reserve state; existing saves map the scalar onto the sole focus-keyed generator.
- Character sizing makes note length a real if soft signal; if playtests show char-count farming, a diminishing curve is the considered lever — not caps or minimums.
- Exact fractions, k, seconds-per-char, and caps are provisional tuning, per the map's standing note.
