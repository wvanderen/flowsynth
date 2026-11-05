# Lost monetary state recovers by an explicit, explained choice — never an invented balance

Accepted, 2026-11-05 (issue #494, parent #484's story 38).

## Context

The calibrated translation (ADR-0081) converts finite pre-calibration saves once at the v13 boundary. A separate class arrives beside it: saves whose monetary figures are already gone. The supplied save carried 35 modules at level 1506 with null monetary fields — the runaway's arithmetic exceeded what JSON numbers can hold, and the pre-integrity serializer wrote those nonfinite figures as null (the corruption #486's serialization refusal now prevents). Ordinary migration refuses these bytes with the lost paths named, but a refusal is not a future: the player needs an explicit, honest way back to meaningful play. Fabricating replacement currency — guessing a wallet, a lifetime total, a banked Arete — would rewrite history the save no longer holds; silently normalizing the loss to zero would pretend the money was always nothing.

## Decision

1. **Lost monetary state is a distinct class at the same boundary.** The lost-figure walk reads the raw save before normalization, lenient defaults, or older refunds can hide a loss, riding the boundary the version gate converts (every version older than v13) — the bytes the pre-integrity builds could corrupt; a v13 file is only ever written by the refusing serializer, and its corrupt figures keep the established lenient schema resilience. Whole-shape corruption (a meter that is not a record) stays the established lenient-defaults' domain; an explicit lost figure inside a present shape is the recovery class. Ordinary loading repairs nothing — it refuses, names the paths, and protects the stored bytes.

2. **The recovery is one explicit choice, offered where the save arrived.** Boot's load and the import walk present the offer — no duplicate ambient warning surface. The explanation precedes the choice and names: the unavailable figures verbatim (the detection's own paths), the development that stands, the economy that rebases, and the original's backup. Downloading the original offers the exact source bytes.

3. **The repair starts every lost figure at its field's calibrated value — zero, or the opening grant for the working balance — and never invents a balance.** Detection and repair are one walk, so they cannot disagree about what was lost; the report names exactly the replaced paths. Readable figures ride the finite conversion's own retention/reset table: banked Arete and World purchases stand, the claimed frontier clears, no entitlement mints, and practice credit is never rewritten — settling a retained honesty pool banks the minutes, not the retired economy's money.

4. **The recovery applies the ordinary boundary, then is structurally over.** A pre-v13 source rides its pinned chain (a v10 step's earned refunds still land, onto the repaired zero); a source the gate never converts, which has no boundary conversion, gets the calibrated era reset applied by the recovery itself, once. The recovered save writes v13 and serializes finite, so a reload cannot re-recover, re-explain, or duplicate anything.

5. **Cancel, refusal, and failure leave the original bytes intact.** The protected source cannot be replaced — forced saves included — until the choice's adoption succeeds; the adoption retains the exact source as the new lineage's original (archiving an earlier lineage's backup first) before the recovered state saves. A retention denial fails the recovery honestly, and the next boot offers the same choice again.

## Consequences

- A player whose save lost its money can return to meaningful play — purchases, flow, combat, and prestige progression from the calibrated opening, with an affordable claim route past the cleared frontier — without the game pretending to know what they once had.
- The retention table is shared with the finite conversion, so the two classes cannot drift: the recovery is the calibrated era reset plus an honest starting-value repair, never a second migration policy.
- Anonymized synthetic fixtures stand in for the personal save; the personal save, its note content, habit names, and practice details stay out of the repository, and no missing historical balance is reconstructed anywhere.
- A save too damaged for the boundary's shape checks (beyond lost figures) fails recovery the way an ordinary load would — honestly, with the original untouched.

## Provenance

The boundary's contract: [save-migration](../save-migration.md) (the recovery section). The evidence: `src/engine/save-recovery.test.ts`, `src/ui/app.recovery.test.ts`, `src/ui/shared-save.test.ts`, `tools/save-recovery.test.ts` with the recorded walk `docs/evidence/issue-494/recovered-walk.json`, and the captures under `docs/evidence/issue-494/`.
