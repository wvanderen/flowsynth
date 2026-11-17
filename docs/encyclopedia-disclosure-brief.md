# Encyclopedia and selective disclosure — confirmed design brief

Status: owner-confirmed design. Issue #533 implements Charge; #534 implements Chords and harmonic capacity through the shared seams. Issue #535 adds Prestige through those same seams, preserving reset facts locally. Implementation evidence and acceptance limitations live in `docs/evidence/issue-533/README.md`, `docs/evidence/issue-534/README.md` and `docs/evidence/issue-535/README.md`. This document records the completed design interview, not visual acceptance or human comprehension.

## Intent and priorities

Teach complex or exceptional concepts in a durable Encyclopedia so the live interface can lose repeated conceptual explanations. Protect uninterrupted practice, keep present decisions honest, and make explanations easy to find again. Success is less teaching furniture in the UI, not an additional help layer beside unchanged tooltips.

The Encyclopedia is a browsable reference, not a mandatory tutorial sequence. Its presentation follows [instrument standards](instrument-standards.md); exact global-door placement and final compositions require layout review and are not approved by this brief.

## Disclosure boundary

The Encyclopedia owns conceptual teaching. Live surfaces retain current state, concrete effects, costs, requirements, exceptional activation conditions, and consequential warnings. A reset confirmation still states what this reset loses and preserves; a merge review still identifies consumed copies and the result. Understanding a concept does not substitute for seeing the facts of the present choice.

Removal test: **Could a player who understands the concept still make a materially mistaken choice because this fact is missing?** If yes, keep the fact local. Short local disclosures remain where useful, but blanket interactive domain terms retire. Accessible names and labels for unfamiliar actions remain.

Provide one deliberately placed contextual help door per meaningful section where needed, such as “About chords,” rather than linking every occurrence of a term. It opens the relevant available entry. Link visibility and entry availability follow the same rule; clicking help is not a separate progression trigger.

## Availability and attention

- Make an entry available at the first meaningful encounter: a visible mechanic, an owned item using it, or a newly available interaction. Do not wait for affordability or first purchase when the constraint is already encountered.
- Visible consequences may receive a limited explanation without revealing their hidden system. Enemy pressure can be explained before World discovery without revealing its map or combat.
- Unavailable entries are absent from browsing, search, and related links. No locked titles, silhouettes, total-entry denominator, or completion percentage.
- Entries never open automatically, including in upgrade mode. No forced tours or queued popups.
- A stable global book-style Encyclopedia icon is reachable on desktop and phone, independent of Settings and contextual links. It has an accessible name and does not compete with the primary flow action. Exact placement remains a layout-review decision.
- Show one persistent, nonanimated dot on that door when any available entry is unseen, and individual unseen marks within the library. No numeric badge, toast, sound, pulse, repeated reminder, or unread inbox. The dot may appear during flow without interrupting it.
- Opening an entry immediately clears its unseen mark. Do not infer learning from scrolling, elapsed reading time, acknowledgment, or opening. Closing partway still counts as seen.

## Content and retrieval

An entry explains what a concept is, how it behaves, and what decision it changes. Prefer short, concrete, example-led teaching. Use annotated diagrams or stepped examples where they help; do not require an illustration when words explain better.

Illustrations are authored examples, clearly identified as illustrative rather than live board state. Exact general rules must agree with the game; current costs, outputs, and conditions remain authoritative on the live surface. The Encyclopedia is not a second inspector or catalog.

Organize available entries into stable named topic groups with title/keyword search. Search recognizes familiar player phrasing as well as canonical terms. Related-entry links appear only for available destinations. Discovery chronology is not the primary organization.

Supporting sections may become available within a seen entry without re-badging it. A distinct new mental model deserving attention gets a separate entry and normal unseen mark. Copy edits and balance updates never mark entries unseen again.

No mandatory exercises, quizzes, reading order, tutorial completion gates, or actions on the real board. Optional diagram controls may clarify examples, but essential information must work without animation, precise gestures, or completing an exercise.

## Reading and continuity

Reading is temporary over the current task. Provide visible Close, Escape, and sensible back navigation between entries without losing the route back to the originating task. Dismissal restores selections, browsing/scroll context, and board position/zoom. Phone may use a full-screen reading surface, but closing restores the same task.

Opening or reading during flow neither pauses nor ends the session. No unsolicited teaching interrupts flow.

## Persistence and existing saves

Available entries and seen state belong to the save, not to an era or a device-wide history. Preserve them through prestige, reload, and export/import. A deliberate full save reset clears them; a genuinely new save starts fresh.

When introducing the system to an existing save, backfill entries already relevant to its established progression as seen. This avoids an introductory attention backlog without making the reference unavailable. Genuinely new concepts encountered afterward receive normal unseen marks. Exact evidence of relevance for each entry must be specified in its implementation slice, not guessed from “seen means learned.”

## Bounded first delivery and transition

Establish the reusable library, availability/seen behavior, and contextual routes with:

1. **Charge:** spatial supply and receivers.
2. **Chords and harmonic capacity:** recognition versus activation, including idle chords and where to inspect the actual constraint.
3. **Prestige:** the enduring progression boundary, with actual reset consequences retained in confirmation.

These are teaching topics, not a mandatory one-topic/one-page partition. Split a distinct mental model into its own entry when justified. World discovery is a separate later-available explanation, not a spoiler embedded in initial prestige teaching.

Migrate in coherent concept slices: deliver the entry, relevance trigger, contextual access, and useful example before removing corresponding redundant teaching. Preserve local facts and leave unrelated surfaces unchanged until their concept migrates. Existing tooltips are not globally defective solely because the new target policy exists.

## Non-goals

No feature implementation in this documentation change; no complete encyclopedia content catalog, global tooltip purge, mandatory onboarding, achievement/checklist system, live-board lesson engine, or balance changes. No approved icon placement or visual composition without layout review.

## Acceptance mapping for implementation

Each criterion below must map to a named test or recorded verification in the implementation completion record. This brief defines obligations, not results.

| Criterion | Required verification |
| --- | --- |
| Entries become available at meaningful encounters, not affordability alone | Named trigger cases for each delivered concept, including owned-item and visible-constraint encounters where applicable |
| Unavailable knowledge stays hidden | Browse, search, related-link and contextual-door checks, including pre-discovery World spoiler protection |
| Opening is voluntary and attention stays quiet | Upgrade/flow encounter checks; no automatic panel, popup queue or repeated alert; aggregate and per-entry indicators |
| Opening marks seen without claiming learning | Open/close cases without scroll or acknowledgment; multiple unseen entries; edits do not re-badge |
| Knowledge belongs to the save | Reload, prestige, export/import, full reset, fresh-save and existing-save backfill cases |
| Reading preserves the task and session | Contextual open, related-entry back navigation and dismissal from inspection/browsing; live session continues; selections, scroll and board view restore |
| Entries are retrievable and accessible | Topic/search checks using canonical and familiar phrasing; keyboard and touch access/dismissal; readable desktop/phone examples and static/reduced-motion access |
| Migration reduces teaching without hiding decisions | Per-surface before/after inventory of removed teaching and retained state, costs, effects, requirements and warnings; apply the removal test |
| Explanations support decisions | Recorded comprehension tasks for representative concepts, e.g. explain why a recognized chord may be idle and locate its actual constraint |
| Presentation follows the approved language | Preliminary source/spec review, then source freeze and desktop/phone evidence and final acceptance under the standing workflow |

Human comprehension is not proven by opening/seen-state tests. If a human session, browser check, or accessibility judgment cannot run, record it as unavailable. This agreement itself claims no test, browser or comprehension results; implementation completion records own those claims.

## Policy ownership and historical decisions

This brief owns the agreed feature behavior and initial scope. CONTEXT.md owns domain definitions. Instrument standards owns presentation and the selective-disclosure policy, referencing this brief rather than duplicating it.

The selective-disclosure decision explicitly supersedes the blanket tooltip-only conceptual-teaching interpretation in the historical standards and ADR-0037's “doctrine stands unexceptioned” language. It does not authorize inline rate-roster calculations, expandable Details, or removal of local facts mandated by existing ADRs. Those interaction contracts remain unchanged unless separately approved.
