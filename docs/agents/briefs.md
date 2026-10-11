# Briefs for implementation agents

A brief is the only thing an implementer sees of the design conversation. Implementers follow the words, so the words have to hold the point — a brief that records decisions without intent produces letter-correct, spirit-wrong work (see the [2026-10-10 retro](../retro-2026-10-10.md)).

## Every brief carries

- **Intent** — the why and the feel: what the surface is for, what it should make a player feel or never notice. The one sentence you would say if you could only say one.
- **Priorities** — what matters most, ranked, so corner trade-offs resolve without you.
- **Non-goals** — what NOT to build: the furniture already imagined and rejected. An implementer given a list renders the list plus supportive extras; non-goals are the only thing that stops them.
- **One-place rules** — each fact shows in exactly one place, named: "the planned duration reads only in the console clock". Checkable, reviewable.
- **The pointer** — [instrument standards](../instrument-standards.md) govern every surface; link the CONTEXT.md entries for any term the surface shows.

## Never

- A bare element list. "The sheet contains A, B, C" builds A, B, C and padding. State the jobs the surface does and the rules it obeys; let the implementer compose.
- Unrecorded taste. A taste-class decision — naming beyond the register, a new metaphor, feel — resolves in a design session before the brief ships, never at review.

## Review

Reviewers check the brief's spirit criteria alongside the standards': every tooltip earns its existence, names hold the register, one-place rules hold, and nothing was built that a non-goal ruled out.
